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

  try {
    const result = await db.runTransaction(async (transaction) => {
      const profileDoc = await transaction.get(userProfileRef);
      if (!profileDoc.exists) {
        throw new HttpsError("not-found", "User profile does not exist.");
      }

      const profileData = profileDoc.data();
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

      // Update profile
      transaction.update(userProfileRef, {
        corps: updatedCorps,
        retiredCorps: updatedRetiredCorps
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
 * If staff are assigned, they must be handled first via staffActions parameter
 * staffActions: { [staffId]: 'unassign' | 'reassign:corpsClass' | 'tradePool' | 'auction' }
 */
exports.retireCorps = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in to retire a corps.");
  }

  const { corpsClass, staffActions, checkOnly } = request.data;
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
    // First, check for assigned staff
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

    // Find staff assigned to this corps
    const userStaff = profileData.staff || [];
    const assignedStaff = userStaff.filter(s =>
      s.assignedTo && s.assignedTo.corpsClass === corpsClass
    );

    // If checkOnly, just return the assigned staff info
    if (checkOnly) {
      return {
        success: true,
        hasAssignedStaff: assignedStaff.length > 0,
        assignedStaff: assignedStaff.map(s => ({
          staffId: s.staffId,
          name: s.name,
          caption: s.caption,
          currentValue: s.currentValue || s.baseValue
        })),
        corpsName: corps.corpsName
      };
    }

    // If staff are assigned but no actions provided, return error with staff info
    if (assignedStaff.length > 0 && !staffActions) {
      return {
        success: false,
        needsStaffHandling: true,
        assignedStaff: assignedStaff.map(s => ({
          staffId: s.staffId,
          name: s.name,
          caption: s.caption,
          currentValue: s.currentValue || s.baseValue
        })),
        message: "Staff members are assigned to this corps. Please specify what to do with them."
      };
    }

    // Process the retirement with staff handling
    await db.runTransaction(async (transaction) => {
      const profileDoc = await transaction.get(userProfileRef);
      const currentData = profileDoc.data();
      const currentStaff = currentData.staff || [];
      const currentCorps = currentData.corps || {};

      // Handle each assigned staff member
      if (assignedStaff.length > 0 && staffActions) {
        for (const staff of assignedStaff) {
          const action = staffActions[staff.staffId];
          const staffIndex = currentStaff.findIndex(s => s.staffId === staff.staffId);

          if (staffIndex === -1) continue;

          if (action === 'unassign') {
            // Simply unassign the staff member
            currentStaff[staffIndex].assignedTo = null;
          } else if (action && action.startsWith('reassign:')) {
            // Reassign to another corps
            const targetClass = action.split(':')[1];
            const targetCorps = currentCorps[targetClass];
            if (targetCorps) {
              currentStaff[staffIndex].assignedTo = {
                corpsClass: targetClass,
                corpsName: targetCorps.corpsName || targetCorps.name || targetClass,
                caption: currentStaff[staffIndex].caption
              };
            } else {
              currentStaff[staffIndex].assignedTo = null;
            }
          } else if (action === 'tradePool') {
            // Mark for trade pool (will be handled by league system)
            currentStaff[staffIndex].assignedTo = null;
            currentStaff[staffIndex].inTradePool = true;
            currentStaff[staffIndex].tradePoolDate = admin.firestore.Timestamp.now();
          } else if (action === 'auction') {
            // Mark for auction
            currentStaff[staffIndex].assignedTo = null;
            currentStaff[staffIndex].forAuction = true;
            currentStaff[staffIndex].auctionDate = admin.firestore.Timestamp.now();
          } else {
            // Default: unassign
            currentStaff[staffIndex].assignedTo = null;
          }
        }
      }

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
        retiredCorps,
        staff: currentStaff
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
