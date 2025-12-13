const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { getDb, dataNamespaceParam } = require("../config");

/**
 * Claim Daily Login
 * Simple login tracking for streak maintenance - no XP/coin pressure
 * Just records that user logged in today for streak calculation
 */
const claimDailyLogin = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const uid = request.auth.uid;
  const db = getDb();
  const profileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);

  try {
    const result = await db.runTransaction(async (transaction) => {
      const profileDoc = await transaction.get(profileRef);
      if (!profileDoc.exists) {
        throw new HttpsError("not-found", "User profile not found.");
      }

      const profileData = profileDoc.data();
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Check if already claimed today
      const engagement = profileData.engagement || {};
      const lastLogin = engagement.lastLogin
        ? (engagement.lastLogin.toDate ? engagement.lastLogin.toDate() : new Date(engagement.lastLogin))
        : null;

      if (lastLogin) {
        const lastLoginDay = new Date(lastLogin.getFullYear(), lastLogin.getMonth(), lastLogin.getDate());
        if (lastLoginDay.getTime() === today.getTime()) {
          // Already logged in today - just return current streak info
          return {
            alreadyClaimed: true,
            loginStreak: engagement.loginStreak || 1
          };
        }
      }

      // Calculate streak
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let newStreak = 1;
      if (lastLogin) {
        const lastLoginDay = new Date(lastLogin.getFullYear(), lastLogin.getMonth(), lastLogin.getDate());
        if (lastLoginDay.getTime() === yesterday.getTime()) {
          // Consecutive day - increment streak
          newStreak = (engagement.loginStreak || 0) + 1;
        }
        // Otherwise streak resets to 1
      }

      // Update engagement data
      const updates = {
        'engagement.loginStreak': newStreak,
        'engagement.lastLogin': admin.firestore.FieldValue.serverTimestamp(),
        'engagement.totalLogins': admin.firestore.FieldValue.increment(1)
      };

      transaction.update(profileRef, updates);

      return {
        alreadyClaimed: false,
        loginStreak: newStreak,
        isNewStreak: newStreak === 1,
        streakContinued: newStreak > 1
      };
    });

    logger.info(`User ${uid} daily login recorded - streak: ${result.loginStreak}`);

    if (result.alreadyClaimed) {
      return {
        success: true,
        message: `Welcome back! ${result.loginStreak} day streak`,
        loginStreak: result.loginStreak,
        alreadyClaimed: true
      };
    }

    return {
      success: true,
      message: result.streakContinued
        ? `${result.loginStreak} day streak!`
        : 'Welcome back!',
      loginStreak: result.loginStreak
    };
  } catch (error) {
    logger.error(`Error recording daily login for user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to record daily login.");
  }
});

module.exports = {
  claimDailyLogin
};
