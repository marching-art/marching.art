const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getDb, dataNamespaceParam } = require("../config");
const admin = require("firebase-admin");
const { logger } = require("firebase-functions/v2");

/**
 * Process corps decisions during season reset
 * Handles continue/retire/unretire/new decisions for all classes atomically
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
  const validActions = ["continue", "retire", "unretire", "new", "skip"];

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
  }

  const db = getDb();
  const userProfileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);
  const seasonSettingsRef = db.doc("game-settings/season");

  try {
    const result = await db.runTransaction(async (transaction) => {
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
            break;
        }
      }

      // Update profile with activeSeasonId to mark user as having acknowledged the new season
      transaction.update(userProfileRef, {
        corps: updatedCorps,
        retiredCorps: updatedRetiredCorps,
        activeSeasonId: currentSeasonUid
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

    // Check if corps has an active lineup - can't retire mid-season
    if (corps.lineup && profileData.activeSeasonId) {
      throw new HttpsError("failed-precondition",
        "Cannot retire a corps during an active season. Please wait until the season ends.");
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

      // Check registration is open
      if (!seasonData.registrationOpen) {
        throw new HttpsError("failed-precondition", "Registration is closed for this season.");
      }

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
