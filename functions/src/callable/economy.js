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

module.exports = {
  awardCorpsCoin,
  unlockClassWithCorpsCoin,
};
