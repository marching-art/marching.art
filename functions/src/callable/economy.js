const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { getDb, dataNamespaceParam } = require("../config");

/**
 * CorpsCoin earning amounts by class
 */
const CORPSCOIN_REWARDS = {
  soundSport: 0,
  aClass: 50,
  open: 100,
  world: 200,
};

/**
 * Class unlock costs with CorpsCoin
 */
const CLASS_UNLOCK_COSTS = {
  aClass: 1000,
  open: 2500,
  world: 5000,
};

/**
 * Award CorpsCoin after performance (called by scoring functions)
 */
const awardCorpsCoin = async (uid, corpsClass, showName) => {
  const db = getDb();
  const profileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);

  try {
    const amount = CORPSCOIN_REWARDS[corpsClass] || 0;
    if (amount === 0) return;

    await profileRef.update({
      corpsCoin: admin.firestore.FieldValue.increment(amount),
    });

    logger.info(`Awarded ${amount} CorpsCoin to user ${uid} for ${corpsClass} performance at ${showName}`);
  } catch (error) {
    logger.error(`Error awarding CorpsCoin to user ${uid}:`, error);
  }
};

/**
 * Unlock a class with CorpsCoin
 */
const unlockClassWithCorpsCoin = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const { classToUnlock } = request.data;
  const uid = request.auth.uid;

  if (!['aClass', 'open', 'world'].includes(classToUnlock)) {
    throw new HttpsError("invalid-argument", "Invalid class specified.");
  }

  const cost = CLASS_UNLOCK_COSTS[classToUnlock];
  const db = getDb();
  const profileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);

  try {
    await db.runTransaction(async (transaction) => {
      const profileDoc = await transaction.get(profileRef);
      if (!profileDoc.exists) {
        throw new HttpsError("not-found", "User profile not found.");
      }

      const profileData = profileDoc.data();
      const currentCoin = profileData.corpsCoin || 0;
      const unlockedClasses = profileData.unlockedClasses || ['soundSport'];

      if (unlockedClasses.includes(classToUnlock)) {
        throw new HttpsError("already-exists", "Class already unlocked.");
      }

      if (currentCoin < cost) {
        throw new HttpsError("failed-precondition", `Insufficient CorpsCoin. Need ${cost}, have ${currentCoin}.`);
      }

      unlockedClasses.push(classToUnlock);
      transaction.update(profileRef, {
        corpsCoin: currentCoin - cost,
        unlockedClasses: unlockedClasses,
      });
    });

    logger.info(`User ${uid} unlocked ${classToUnlock} with ${cost} CorpsCoin`);
    return {
      success: true,
      message: `${classToUnlock} unlocked!`,
      classUnlocked: classToUnlock,
    };
  } catch (error) {
    logger.error(`Error unlocking class for user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to unlock class.");
  }
});

/**
 * Purchase staff member
 */
const purchaseStaff = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const { staffId } = request.data;
  const uid = request.auth.uid;

  if (!staffId) {
    throw new HttpsError("invalid-argument", "Staff ID required.");
  }

  const db = getDb();
  const profileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);
  const staffRef = db.doc(`staff_database/${staffId}`);

  try {
    const result = await db.runTransaction(async (transaction) => {
      const profileDoc = await transaction.get(profileRef);
      const staffDoc = await transaction.get(staffRef);

      if (!profileDoc.exists) {
        throw new HttpsError("not-found", "User profile not found.");
      }

      if (!staffDoc.exists) {
        throw new HttpsError("not-found", "Staff member not found.");
      }

      const profileData = profileDoc.data();
      const staffData = staffDoc.data();

      // Check if already owned
      const userStaff = profileData.staff || [];
      if (userStaff.some(s => s.staffId === staffId)) {
        throw new HttpsError("already-exists", "You already own this staff member.");
      }

      // Check CorpsCoin balance
      const currentCoin = profileData.corpsCoin || 0;
      const cost = staffData.baseValue || 100;

      if (currentCoin < cost) {
        throw new HttpsError("failed-precondition", `Insufficient CorpsCoin. Need ${cost}, have ${currentCoin}.`);
      }

      // Add staff to user's roster
      // Note: Cannot use FieldValue.serverTimestamp() inside arrays, so use Timestamp.now()
      const newStaffEntry = {
        staffId: staffId,
        name: staffData.name,
        caption: staffData.caption,
        yearInducted: staffData.yearInducted,
        biography: staffData.biography || '',
        baseValue: cost,
        purchaseDate: admin.firestore.Timestamp.now(),
        seasonsCompleted: 0,
        currentValue: cost,
        assignedTo: null, // Not assigned to any corps yet
      };

      userStaff.push(newStaffEntry);

      transaction.update(profileRef, {
        corpsCoin: currentCoin - cost,
        staff: userStaff,
      });

      return { staffData, cost };
    });

    logger.info(`User ${uid} purchased staff ${staffId} for ${result.cost} CorpsCoin`);
    return {
      success: true,
      message: `${result.staffData.name} added to your staff!`,
      staff: result.staffData,
    };
  } catch (error) {
    logger.error(`Error purchasing staff for user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to purchase staff.");
  }
});

/**
 * Assign staff member to a corps
 * Caption is automatically derived from the staff member's specialty
 */
const assignStaff = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const { staffId, corpsClass } = request.data;
  const uid = request.auth.uid;

  if (!staffId) {
    throw new HttpsError("invalid-argument", "Staff ID is required.");
  }

  const db = getDb();
  const profileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);

  try {
    let resultMessage;
    let corpsName = null;

    await db.runTransaction(async (transaction) => {
      const profileDoc = await transaction.get(profileRef);
      if (!profileDoc.exists) {
        throw new HttpsError("not-found", "User profile not found.");
      }

      const profileData = profileDoc.data();
      const userStaff = profileData.staff || [];
      const staffMember = userStaff.find(s => s.staffId === staffId);

      if (!staffMember) {
        throw new HttpsError("not-found", "Staff member not found in your roster.");
      }

      // If corpsClass is null/undefined, unassign the staff member
      if (!corpsClass) {
        staffMember.assignedTo = null;
        resultMessage = "Staff member unassigned successfully!";
      } else {
        // Get the corps data to include corps name
        const userCorps = profileData.corps || {};
        const targetCorps = userCorps[corpsClass];

        if (!targetCorps) {
          throw new HttpsError("not-found", `No corps found for class ${corpsClass}.`);
        }

        corpsName = targetCorps.corpsName || targetCorps.name || corpsClass;

        // Assign to corps - includes corps name for display/history
        staffMember.assignedTo = {
          corpsClass: corpsClass,
          corpsName: corpsName,
          caption: staffMember.caption,
        };
        resultMessage = `Staff member assigned to ${corpsName}!`;
      }

      // Save updated staff array
      transaction.update(profileRef, {
        staff: userStaff,
      });
    });

    logger.info(`User ${uid} ${corpsClass ? 'assigned' : 'unassigned'} staff ${staffId}${corpsClass ? ` to ${corpsName || corpsClass}` : ''}`);
    return {
      success: true,
      message: resultMessage,
    };
  } catch (error) {
    logger.error(`Error assigning staff for user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to assign staff.");
  }
});

/**
 * List available staff in marketplace (admin creates entries in staff_database)
 */
const getStaffMarketplace = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const { caption } = request.data; // Optional filter by caption
  const db = getDb();

  try {
    let query = db.collection("staff_database").where("available", "==", true);

    if (caption) {
      query = query.where("caption", "==", caption);
    }

    const snapshot = await query.limit(50).get();
    const staffList = [];

    snapshot.forEach(doc => {
      staffList.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    return {
      success: true,
      staff: staffList,
    };
  } catch (error) {
    logger.error("Error fetching staff marketplace:", error);
    throw new HttpsError("internal", "Failed to fetch staff marketplace.");
  }
});

module.exports = {
  awardCorpsCoin,
  unlockClassWithCorpsCoin,
  purchaseStaff,
  assignStaff,
  getStaffMarketplace,
};
