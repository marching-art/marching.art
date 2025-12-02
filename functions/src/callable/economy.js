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
      const newStaffEntry = {
        staffId: staffId,
        name: staffData.name,
        caption: staffData.caption,
        yearInducted: staffData.yearInducted,
        biography: staffData.biography || '',
        baseValue: cost,
        purchaseDate: admin.firestore.FieldValue.serverTimestamp(),
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
        // Assign to corps - caption is automatically the staff member's specialty
        staffMember.assignedTo = {
          corpsClass: corpsClass,
          caption: staffMember.caption,
        };
        resultMessage = "Staff member assigned successfully!";
      }

      // Save updated staff array
      transaction.update(profileRef, {
        staff: userStaff,
      });
    });

    logger.info(`User ${uid} ${corpsClass ? 'assigned' : 'unassigned'} staff ${staffId}${corpsClass ? ` to ${corpsClass}` : ''}`);
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
 * Fetches all available staff for client-side filtering and caching
 */
const getStaffMarketplace = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const { caption } = request.data; // Optional filter by caption (kept for backwards compatibility)
  const db = getDb();

  try {
    // Always fetch all available staff for client-side filtering
    // This reduces API calls and enables caching on the client
    let query = db.collection("staff_database")
      .where("available", "==", true)
      .orderBy("yearInducted", "desc");

    // If caption filter is provided, use it (for backwards compatibility)
    // But we recommend fetching all and filtering client-side
    if (caption) {
      query = db.collection("staff_database")
        .where("available", "==", true)
        .where("caption", "==", caption)
        .orderBy("yearInducted", "desc");
    }

    // Increased limit to support fetching all staff for client-side caching
    // With ~150 Hall of Fame members, 200 provides headroom for growth
    const snapshot = await query.limit(200).get();
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
      totalCount: staffList.length,
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
