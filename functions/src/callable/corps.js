const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getDb, dataNamespaceParam } = require("../config");
const admin = require("firebase-admin");
const { logger } = require("firebase-functions/v2");
const { hasCorpsCompeted } = require("../helpers/corpsEligibility");

/**
 * Process corps decisions during season reset
 * Handles continue/retire/unretire/new/skip/move decisions for all classes atomically
 */
exports.processCorpsDecisions = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const { decisions } = request.data;
  const uid = request.auth.uid;

  if (!decisions || !Array.isArray(decisions)) {
    throw new HttpsError("invalid-argument", "Decisions array is required.");
  }

  const validClasses = ["worldClass", "openClass", "aClass", "soundSport"];
  const validActions = ["continue", "retire", "unretire", "new", "skip", "move"];

  // Validate all decisions
  for (const decision of decisions) {
    if (!decision.corpsClass || !validClasses.includes(decision.corpsClass)) {
      throw new HttpsError("invalid-argument", `Invalid corps class: ${decision.corpsClass}`);
    }
    if (!decision.action || !validActions.includes(decision.action)) {
      throw new HttpsError("invalid-argument", `Invalid action for ${decision.corpsClass}: ${decision.action}`);
    }
    if (decision.action === "new" && (!decision.corpsName || !decision.location)) {
      throw new HttpsError("invalid-argument", `New corps requires name and location for ${decision.corpsClass}`);
    }
    if (decision.action === "unretire" && decision.retiredIndex === undefined) {
      throw new HttpsError("invalid-argument", `Unretire requires retiredIndex for ${decision.corpsClass}`);
    }
    if (decision.action === "move" && (!decision.targetClass || !validClasses.includes(decision.targetClass))) {
      throw new HttpsError("invalid-argument", `Move requires a valid targetClass for ${decision.corpsClass}`);
    }
    if (decision.action === "move" && decision.targetClass === decision.corpsClass) {
      throw new HttpsError("invalid-argument", `Cannot move corps to the same class: ${decision.corpsClass}`);
    }
  }

  // Reject duplicate "new" corps names within the same submission so two
  // simultaneous decisions can't sneak the same name past the uniqueness check.
  const newNamesInBatch = new Set();
  for (const decision of decisions) {
    if (decision.action !== "new") continue;
    const normalized = decision.corpsName.toLowerCase().trim();
    if (newNamesInBatch.has(normalized)) {
      throw new HttpsError("invalid-argument",
        `Cannot create two corps with the same name "${decision.corpsName}" in a single submission.`);
    }
    newNamesInBatch.add(normalized);
  }

  const db = getDb();
  const userProfileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);
  const seasonSettingsRef = db.doc("game-settings/season");

  try {
    const result = await db.runTransaction(async (transaction) => {
      // Firestore transactions require all reads before any writes. We must
      // read the corpsnames reservations for any "new" decisions up front so
      // we can enforce global name uniqueness atomically.
      const [profileDoc, seasonDoc] = await Promise.all([
        transaction.get(userProfileRef),
        transaction.get(seasonSettingsRef)
      ]);
      if (!profileDoc.exists) {
        throw new HttpsError("not-found", "User profile does not exist.");
      }
      if (!seasonDoc.exists) {
        throw new HttpsError("not-found", "Season settings do not exist.");
      }

      const profileData = profileDoc.data();
      const seasonData = seasonDoc.data();
      const currentSeasonUid = seasonData.seasonUid;
      const corpsNamesSeasonId = seasonData?.seasonUid || "default";

      // Pre-read every corpsnames doc we may touch (one per "new" or "move").
      const corpsNameRefForName = (name) =>
        db.doc(`corpsnames/${corpsNamesSeasonId}_${name.toLowerCase().trim()}`);

      const newDecisionRefs = decisions
        .filter((d) => d.action === "new")
        .map((d) => ({ decision: d, ref: corpsNameRefForName(d.corpsName) }));

      const moveDecisionRefs = decisions
        .filter((d) => d.action === "move")
        .map((d) => {
          const existing = profileData.corps?.[d.corpsClass];
          return existing?.corpsName
            ? { decision: d, ref: corpsNameRefForName(existing.corpsName) }
            : null;
        })
        .filter(Boolean);

      const newDocsArr = await Promise.all(
        newDecisionRefs.map(({ ref }) => transaction.get(ref))
      );
      const moveDocsArr = await Promise.all(
        moveDecisionRefs.map(({ ref }) => transaction.get(ref))
      );

      // Enforce global uniqueness for "new" decisions. Match the strict
      // behavior of registerCorps: any existing reservation (including this
      // user's own retired or stale entries) blocks reuse of the name.
      newDecisionRefs.forEach(({ decision }, i) => {
        const snap = newDocsArr[i];
        if (snap.exists) {
          throw new HttpsError("already-exists",
            `The corps name "${decision.corpsName}" is already taken. Please choose a different name.`);
        }
      });

      let updatedCorps = { ...profileData.corps };
      let updatedRetiredCorps = [...(profileData.retiredCorps || [])];
      const corpsNeedingSetup = [];

      for (const decision of decisions) {
        const { corpsClass, action } = decision;
        const existingCorps = updatedCorps[corpsClass];

        switch (action) {
          case "continue":
            // Keep the corps, just reset season data
            if (existingCorps?.corpsName) {
              updatedCorps[corpsClass] = {
                ...existingCorps,
                lineup: null,
                lineupKey: null,
                selectedShows: {},
                weeklyScores: {},
                totalSeasonScore: 0
              };
              corpsNeedingSetup.push(corpsClass);
            }
            break;

          case "retire":
            // Move corps to retired list
            if (existingCorps?.corpsName) {
              const retiredRecord = {
                corpsClass,
                corpsName: existingCorps.corpsName,
                location: existingCorps.location,
                seasonHistory: existingCorps.seasonHistory || [],
                weeklyTrades: existingCorps.weeklyTrades || null,
                totalSeasons: existingCorps.seasonHistory?.length || 0,
                bestSeasonScore: Math.max(...(existingCorps.seasonHistory?.map(s => s.totalSeasonScore) || [0])),
                totalShows: (existingCorps.seasonHistory || []).reduce((sum, s) => sum + (s.showsAttended || 0), 0),
                retiredAt: admin.firestore.FieldValue.serverTimestamp()
              };
              updatedRetiredCorps.push(retiredRecord);
              delete updatedCorps[corpsClass];
            }
            break;

          case "unretire":
            // Restore from retired list
            const retiredRecord = updatedRetiredCorps[decision.retiredIndex];
            if (!retiredRecord || retiredRecord.corpsClass !== corpsClass) {
              throw new HttpsError("not-found", `Retired corps not found for ${corpsClass}`);
            }

            // If there's an existing corps, retire it first
            if (existingCorps?.corpsName) {
              const existingRetired = {
                corpsClass,
                corpsName: existingCorps.corpsName,
                location: existingCorps.location,
                seasonHistory: existingCorps.seasonHistory || [],
                weeklyTrades: existingCorps.weeklyTrades || null,
                totalSeasons: existingCorps.seasonHistory?.length || 0,
                bestSeasonScore: Math.max(...(existingCorps.seasonHistory?.map(s => s.totalSeasonScore) || [0])),
                totalShows: (existingCorps.seasonHistory || []).reduce((sum, s) => sum + (s.showsAttended || 0), 0),
                retiredAt: admin.firestore.FieldValue.serverTimestamp()
              };
              updatedRetiredCorps.push(existingRetired);
            }

            updatedCorps[corpsClass] = {
              corpsName: retiredRecord.corpsName,
              location: retiredRecord.location,
              seasonHistory: retiredRecord.seasonHistory || [],
              weeklyTrades: retiredRecord.weeklyTrades || null,
              lineup: null,
              lineupKey: null,
              selectedShows: {},
              weeklyScores: {},
              totalSeasonScore: 0
            };
            updatedRetiredCorps = updatedRetiredCorps.filter((_, idx) => idx !== decision.retiredIndex);
            corpsNeedingSetup.push(corpsClass);
            break;

          case "new":
            // Retire existing if present, create new corps
            if (existingCorps?.corpsName) {
              const existingRetired = {
                corpsClass,
                corpsName: existingCorps.corpsName,
                location: existingCorps.location,
                seasonHistory: existingCorps.seasonHistory || [],
                weeklyTrades: existingCorps.weeklyTrades || null,
                totalSeasons: existingCorps.seasonHistory?.length || 0,
                bestSeasonScore: Math.max(...(existingCorps.seasonHistory?.map(s => s.totalSeasonScore) || [0])),
                totalShows: (existingCorps.seasonHistory || []).reduce((sum, s) => sum + (s.showsAttended || 0), 0),
                retiredAt: admin.firestore.FieldValue.serverTimestamp()
              };
              updatedRetiredCorps.push(existingRetired);
            }

            updatedCorps[corpsClass] = {
              corpsName: decision.corpsName,
              location: decision.location,
              showConcept: decision.showConcept || "",
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              seasonHistory: [],
              lineup: null,
              lineupKey: null,
              selectedShows: {},
              weeklyScores: {},
              totalSeasonScore: 0
            };
            corpsNeedingSetup.push(corpsClass);
            break;

          case "skip":
            // Don't participate in this class this season
            // Reset season-specific data but keep corps identity so stale data doesn't persist
            if (existingCorps?.corpsName) {
              updatedCorps[corpsClass] = {
                ...existingCorps,
                lineup: null,
                lineupKey: null,
                selectedShows: {},
                weeklyScores: {},
                totalSeasonScore: 0
              };
              // Note: NOT added to corpsNeedingSetup - user chose to sit out
            }
            break;

          case "move":
            // Move corps to a different class, preserving identity
            if (existingCorps?.corpsName) {
              const targetClass = decision.targetClass;
              // Check target class is empty
              if (updatedCorps[targetClass]?.corpsName) {
                throw new HttpsError("failed-precondition",
                  `Cannot move to ${targetClass} - already has an active corps.`);
              }
              // Move corps to target class with reset season data
              updatedCorps[targetClass] = {
                ...existingCorps,
                lineup: null,
                lineupKey: null,
                selectedShows: {},
                weeklyScores: {},
                totalSeasonScore: 0
              };
              delete updatedCorps[corpsClass];
              corpsNeedingSetup.push(targetClass);
            }
            break;
        }
      }

      // Final-state guard: within this user's active corps, no two classes
      // may share the same name. This catches scenarios like "move soundSport
      // → openClass" combined with "new soundSport" using the moved name.
      const finalNames = [];
      for (const cls of validClasses) {
        const name = updatedCorps[cls]?.corpsName;
        if (name) finalNames.push(name.toLowerCase().trim());
      }
      const seen = new Set();
      for (const name of finalNames) {
        if (seen.has(name)) {
          throw new HttpsError("invalid-argument",
            `Cannot have two active corps with the same name. Each corps name must be unique.`);
        }
        seen.add(name);
      }

      // Update profile with activeSeasonId to mark user as having acknowledged the new season
      transaction.update(userProfileRef, {
        corps: updatedCorps,
        retiredCorps: updatedRetiredCorps,
        activeSeasonId: currentSeasonUid
      });

      // Reserve corpsnames for "new" decisions so the global uniqueness check
      // in registerCorps (and future processCorpsDecisions calls) sees them.
      newDecisionRefs.forEach(({ decision, ref }) => {
        transaction.set(ref, {
          uid,
          corpsName: decision.corpsName,
          corpsClass: decision.corpsClass,
          seasonId: corpsNamesSeasonId,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      // Keep the corpsClass metadata accurate when corps move between classes.
      moveDecisionRefs.forEach(({ decision, ref }, i) => {
        const snap = moveDocsArr[i];
        if (snap.exists) {
          transaction.update(ref, { corpsClass: decision.targetClass });
        }
      });

      return { corpsNeedingSetup };
    });

    logger.info(`User ${uid} processed corps decisions:`, decisions.map(d => `${d.corpsClass}:${d.action}`));
    return {
      success: true,
      corpsNeedingSetup: result.corpsNeedingSetup,
      message: "Corps decisions processed successfully!"
    };
  } catch (error) {
    logger.error(`Failed to process corps decisions for user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "An error occurred while processing corps decisions.");
  }
});

/**
 * Retire a corps - move it from active corps to retired list
 */
exports.retireCorps = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in to retire a corps.");
  }

  const { corpsClass, checkOnly } = request.data;
  const uid = request.auth.uid;

  if (!corpsClass) {
    throw new HttpsError("invalid-argument", "Corps class is required.");
  }

  const validClasses = ["worldClass", "openClass", "aClass", "soundSport"];
  if (!validClasses.includes(corpsClass)) {
    throw new HttpsError("invalid-argument", "Invalid corps class specified.");
  }

  const db = getDb();
  const userProfileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);

  try {
    // First, check the corps exists
    const profileSnap = await db.runTransaction(async (transaction) => {
      const profileDoc = await transaction.get(userProfileRef);
      if (!profileDoc.exists) {
        throw new HttpsError("not-found", "User profile does not exist.");
      }
      return profileDoc;
    });

    const profileData = profileSnap.data();
    const corps = profileData.corps?.[corpsClass];

    if (!corps || !corps.corpsName) {
      throw new HttpsError("not-found", `No active ${corpsClass} corps to retire.`);
    }

    // A corps may be retired as long as it has not competed yet this season.
    // Any lineup or show selections will be wiped as part of retirement — the
    // UI is expected to warn the director before they confirm.
    if (hasCorpsCompeted(corps)) {
      throw new HttpsError("failed-precondition",
        "Cannot retire a corps after it has competed this season. Please wait until the season ends.");
    }

    // If checkOnly, just return basic info
    if (checkOnly) {
      return {
        success: true,
        corpsName: corps.corpsName
      };
    }

    // Process the retirement
    await db.runTransaction(async (transaction) => {
      const profileDoc = await transaction.get(userProfileRef);
      const currentData = profileDoc.data();
      const currentCorps = currentData.corps || {};

      // Create retired corps record
      const retiredCorps = currentData.retiredCorps || [];
      const currentCorpsData = currentCorps[corpsClass];
      const retiredRecord = {
        corpsClass,
        corpsName: currentCorpsData.corpsName,
        location: currentCorpsData.location,
        seasonHistory: currentCorpsData.seasonHistory || [],
        weeklyTrades: currentCorpsData.weeklyTrades || null,
        totalSeasons: currentCorpsData.seasonHistory?.length || 0,
        bestSeasonScore: Math.max(...(currentCorpsData.seasonHistory?.map(s => s.totalSeasonScore) || [0])),
        totalShows: (currentCorpsData.seasonHistory || []).reduce((sum, s) => sum + (s.showsAttended || 0), 0),
        retiredAt: admin.firestore.FieldValue.serverTimestamp()
      };

      retiredCorps.push(retiredRecord);

      // Remove from active corps
      const updatedCorps = { ...currentCorps };
      delete updatedCorps[corpsClass];

      transaction.update(userProfileRef, {
        corps: updatedCorps,
        retiredCorps
      });
    });

    logger.info(`User ${uid} retired their ${corpsClass} corps`);
    return { success: true, message: "Corps retired successfully!" };
  } catch (error) {
    logger.error(`Failed to retire corps for user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "An error occurred while retiring the corps.");
  }
});

/**
 * Transfer a corps from one class to another within the same season.
 * Rules:
 * - A corps can only be transferred once per season.
 * - The target class must be unlocked and registration must still be open.
 * - If the target class already has a corps, the user must retire or downgrade it first
 *   (handled on the frontend by pre-retiring before calling this).
 * - Preserves corps identity (name, location, history) but resets season-specific data.
 */
exports.transferCorps = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const { fromClass, toClass } = request.data;
  const uid = request.auth.uid;

  if (!fromClass || !toClass) {
    throw new HttpsError("invalid-argument", "Both fromClass and toClass are required.");
  }

  if (fromClass === toClass) {
    throw new HttpsError("invalid-argument", "Cannot transfer a corps to the same class.");
  }

  const validClasses = ["worldClass", "openClass", "aClass", "soundSport"];
  if (!validClasses.includes(fromClass) || !validClasses.includes(toClass)) {
    throw new HttpsError("invalid-argument", "Invalid corps class specified.");
  }

  const db = getDb();
  const userProfileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);
  const seasonSettingsRef = db.doc("game-settings/season");

  try {
    const result = await db.runTransaction(async (transaction) => {
      // Read profile and season first so we can derive the corpsnames key,
      // then read the corpsnames doc — Firestore requires all reads before
      // any writes within a transaction.
      const [profileDoc, seasonDoc] = await Promise.all([
        transaction.get(userProfileRef),
        transaction.get(seasonSettingsRef),
      ]);

      if (!profileDoc.exists) {
        throw new HttpsError("not-found", "User profile does not exist.");
      }
      if (!seasonDoc.exists) {
        throw new HttpsError("not-found", "Season settings do not exist.");
      }

      const profileData = profileDoc.data();
      const seasonData = seasonDoc.data();
      const currentSeasonUid = seasonData.seasonUid;

      // Check the target class is unlocked
      const unlockedClasses = profileData.unlockedClasses || ["soundSport"];
      if (!unlockedClasses.includes(toClass)) {
        throw new HttpsError("failed-precondition", `You haven't unlocked ${toClass} yet.`);
      }

      // Check source corps exists
      const sourceCorps = profileData.corps?.[fromClass];
      if (!sourceCorps || !sourceCorps.corpsName) {
        throw new HttpsError("not-found", `No active corps found in ${fromClass}.`);
      }

      // A corps can only change class while it hasn't competed yet this
      // season. Any lineup/show selections will be wiped on transfer — the
      // UI is expected to warn the director before they confirm.
      if (hasCorpsCompeted(sourceCorps)) {
        throw new HttpsError("failed-precondition",
          `"${sourceCorps.corpsName}" has already competed this season and can't change class until next season.`);
      }

      // Check target class is empty (frontend should handle retiring/moving the occupant first)
      const targetCorps = profileData.corps?.[toClass];
      if (targetCorps && targetCorps.corpsName) {
        throw new HttpsError("already-exists",
          `There is already an active corps in ${toClass}. Retire or move it first.`);
      }

      // Check corps hasn't already been transferred this season
      const transferHistory = profileData.corpsTransferHistory || {};
      const seasonTransfers = transferHistory[currentSeasonUid] || [];
      const alreadyTransferred = seasonTransfers.some(
        (t) => t.corpsName === sourceCorps.corpsName
      );
      if (alreadyTransferred) {
        throw new HttpsError("failed-precondition",
          `"${sourceCorps.corpsName}" has already been transferred this season. Each corps can only move once per season.`);
      }

      // Read the corpsnames reservation so we can keep its class metadata in
      // sync once the move commits.
      const corpsNamesSeasonId = seasonData?.seasonUid || "default";
      const corpsNameRef = db.doc(
        `corpsnames/${corpsNamesSeasonId}_${sourceCorps.corpsName.toLowerCase().trim()}`
      );
      const corpsNameDoc = await transaction.get(corpsNameRef);

      // Perform the transfer: move corps data, reset season-specific fields
      const updatedCorps = { ...profileData.corps };
      updatedCorps[toClass] = {
        ...sourceCorps,
        corpsClass: toClass,
        // Reset season-specific data for the new class
        lineup: null,
        lineupKey: null,
        selectedShows: {},
        weeklyScores: {},
        totalSeasonScore: 0,
        showsAttended: 0,
        seasonHighScore: 0,
      };
      delete updatedCorps[fromClass];

      // Record the transfer
      const newTransferRecord = {
        corpsName: sourceCorps.corpsName,
        fromClass,
        toClass,
        transferredAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      const updatedSeasonTransfers = [...seasonTransfers, newTransferRecord];
      const updatedTransferHistory = {
        ...transferHistory,
        [currentSeasonUid]: updatedSeasonTransfers,
      };

      transaction.update(userProfileRef, {
        corps: updatedCorps,
        corpsTransferHistory: updatedTransferHistory,
      });

      // Keep the corpsnames reservation's class metadata accurate. If no
      // reservation exists yet (legacy data, or a corps created via the season
      // setup wizard before reservations were written for "new" decisions),
      // create one now so the name is properly reserved going forward.
      if (corpsNameDoc.exists) {
        transaction.update(corpsNameRef, { corpsClass: toClass });
      } else {
        transaction.set(corpsNameRef, {
          uid,
          corpsName: sourceCorps.corpsName,
          corpsClass: toClass,
          seasonId: corpsNamesSeasonId,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      return {
        corpsName: sourceCorps.corpsName,
        fromClass,
        toClass,
        vacatedClass: fromClass,
      };
    });

    logger.info(`User ${uid} transferred corps "${result.corpsName}" from ${result.fromClass} to ${result.toClass}`);
    return {
      success: true,
      message: `"${result.corpsName}" has been moved to ${result.toClass}!`,
      vacatedClass: result.vacatedClass,
      corpsName: result.corpsName,
    };
  } catch (error) {
    logger.error(`Failed to transfer corps for user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "An error occurred while transferring the corps.");
  }
});

/**
 * Unretire a corps - restore it from retired list to active corps
 */
exports.unretireCorps = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in to unretire a corps.");
  }

  const { corpsClass, retiredIndex } = request.data;
  const uid = request.auth.uid;

  if (!corpsClass || retiredIndex === undefined) {
    throw new HttpsError("invalid-argument", "Corps class and retired index are required.");
  }

  const validClasses = ["worldClass", "openClass", "aClass", "soundSport"];
  if (!validClasses.includes(corpsClass)) {
    throw new HttpsError("invalid-argument", "Invalid corps class specified.");
  }

  const db = getDb();
  const userProfileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);

  try {
    await db.runTransaction(async (transaction) => {
      const profileDoc = await transaction.get(userProfileRef);
      if (!profileDoc.exists) {
        throw new HttpsError("not-found", "User profile does not exist.");
      }

      const profileData = profileDoc.data();
      const retiredCorps = profileData.retiredCorps || [];

      if (!retiredCorps[retiredIndex]) {
        throw new HttpsError("not-found", "Retired corps not found.");
      }

      const retiredRecord = retiredCorps[retiredIndex];

      // Verify the corps class matches
      if (retiredRecord.corpsClass !== corpsClass) {
        throw new HttpsError("invalid-argument", "Corps class mismatch.");
      }

      // Check if user already has an active corps in this class
      if (profileData.corps?.[corpsClass]?.corpsName) {
        throw new HttpsError("already-exists",
          `You already have an active ${corpsClass} corps. Retire it first before unretiring another.`);
      }

      // Restore the corps
      const updatedCorps = { ...profileData.corps };
      updatedCorps[corpsClass] = {
        corpsName: retiredRecord.corpsName,
        location: retiredRecord.location,
        seasonHistory: retiredRecord.seasonHistory || [],
        weeklyTrades: retiredRecord.weeklyTrades || null,
        // Reset season-specific data
        lineup: null,
        lineupKey: null,
        selectedShows: {},
        weeklyScores: {},
        totalSeasonScore: 0
      };

      // Remove from retired list
      const updatedRetiredCorps = retiredCorps.filter((_, index) => index !== retiredIndex);

      transaction.update(userProfileRef, {
        corps: updatedCorps,
        retiredCorps: updatedRetiredCorps
      });
    });

    logger.info(`User ${uid} unretired their ${corpsClass} corps`);
    return { success: true, message: "Corps brought out of retirement!" };
  } catch (error) {
    logger.error(`Failed to unretire corps for user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "An error occurred while unretiring the corps.");
  }
});
