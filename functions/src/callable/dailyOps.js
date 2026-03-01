const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { getDb, dataNamespaceParam } = require("../config");
const { calculateXPUpdates, XP_SOURCES } = require("../helpers/xpCalculations");
const { addCoinHistoryEntryToTransaction } = require("./economy");

// Streak milestone rewards (XP + CC + optional free streak freeze)
const STREAK_MILESTONES = {
  3: { xp: 50, coin: 50, title: '3 Day Streak!' },
  7: { xp: 100, coin: 100, title: 'Week Warrior!' },
  14: { xp: 250, coin: 200, title: 'Two Week Terror!' },
  30: { xp: 500, coin: 500, title: 'Monthly Master!', freeFreeze: true },
  60: { xp: 750, coin: 750, title: 'Streak Legend!' },
  100: { xp: 1000, coin: 1000, title: 'Century Club!' },
};

// Streak freeze cost
const STREAK_FREEZE_COST = 300;

/**
 * Claim Daily Login
 * Now awards XP and checks for streak milestone bonuses
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
            loginStreak: engagement.loginStreak || 1,
            xpAwarded: 0,
            coinAwarded: 0,
          };
        }
      }

      // Calculate streak
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let newStreak = 1;
      let streakBroken = false;
      const previousStreak = engagement.loginStreak || 0;

      if (lastLogin) {
        const lastLoginDay = new Date(lastLogin.getFullYear(), lastLogin.getMonth(), lastLogin.getDate());
        if (lastLoginDay.getTime() === yesterday.getTime()) {
          // Consecutive day - increment streak
          newStreak = previousStreak + 1;
        } else {
          // Check if streak freeze is active
          const streakFreezeUntil = engagement.streakFreezeUntil
            ? (engagement.streakFreezeUntil.toDate ? engagement.streakFreezeUntil.toDate() : new Date(engagement.streakFreezeUntil))
            : null;

          if (streakFreezeUntil && now <= streakFreezeUntil) {
            // Streak was protected!
            newStreak = previousStreak + 1;
            logger.info(`User ${uid} streak protected by freeze - continuing at ${newStreak}`);
          } else {
            // Streak broken
            streakBroken = previousStreak > 1;
          }
        }
      }

      // Calculate rewards
      let xpAwarded = XP_SOURCES.dailyLogin; // Base daily XP
      let coinAwarded = 0;
      let milestoneReached = null;

      // Check for streak milestone
      let freeFreeze = false;
      if (STREAK_MILESTONES[newStreak]) {
        const milestone = STREAK_MILESTONES[newStreak];
        xpAwarded += milestone.xp;
        coinAwarded += milestone.coin;
        freeFreeze = milestone.freeFreeze || false;
        milestoneReached = {
          days: newStreak,
          title: milestone.title,
          xp: milestone.xp,
          coin: milestone.coin,
          freeFreeze,
        };
      }

      // Calculate XP updates (includes level-ups and class unlocks)
      const xpResult = calculateXPUpdates(profileData, xpAwarded);

      // Build update object
      const updates = {
        'engagement.loginStreak': newStreak,
        'engagement.lastLogin': admin.firestore.FieldValue.serverTimestamp(),
        'engagement.totalLogins': admin.firestore.FieldValue.increment(1),
        'engagement.streakFreezeUntil': null, // Clear any used freeze
        ...xpResult.updates,
      };

      // Award free streak freeze at 30-day milestone
      if (freeFreeze) {
        const freezeUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        updates['engagement.streakFreezeUntil'] = freezeUntil;
        logger.info(`User ${uid} awarded free streak freeze for ${newStreak}-day milestone`);
      }

      // Add CorpsCoin if milestone reached
      if (coinAwarded > 0) {
        updates.corpsCoin = admin.firestore.FieldValue.increment(coinAwarded);
      }

      transaction.update(profileRef, updates);

      // Write coin history to subcollection (outside profile doc to avoid unbounded growth)
      if (coinAwarded > 0) {
        addCoinHistoryEntryToTransaction(transaction, db, uid, {
          type: 'streak_milestone',
          amount: coinAwarded,
          description: `${newStreak}-day streak milestone!${freeFreeze ? ' +Free Streak Freeze!' : ''}`,
        });
      }

      return {
        alreadyClaimed: false,
        loginStreak: newStreak,
        previousStreak,
        streakBroken,
        xpAwarded,
        coinAwarded,
        milestoneReached,
        newLevel: xpResult.newLevel,
        classUnlocked: xpResult.classUnlocked,
      };
    });

    logger.info(`User ${uid} daily login: streak=${result.loginStreak}, xp=${result.xpAwarded}, coin=${result.coinAwarded}`);

    if (result.alreadyClaimed) {
      return {
        success: true,
        message: `Welcome back! ${result.loginStreak} day streak`,
        loginStreak: result.loginStreak,
        alreadyClaimed: true,
      };
    }

    // Build response message
    let message = result.streakBroken
      ? 'Streak reset - keep going!'
      : result.loginStreak === 1
        ? 'Welcome back!'
        : `${result.loginStreak} day streak!`;

    if (result.milestoneReached) {
      message = `${result.milestoneReached.title} +${result.milestoneReached.xp} XP +${result.milestoneReached.coin} CC`;
      if (result.milestoneReached.freeFreeze) {
        message += ' +Free Streak Freeze!';
      }
    }

    return {
      success: true,
      message,
      loginStreak: result.loginStreak,
      xpAwarded: result.xpAwarded,
      coinAwarded: result.coinAwarded,
      milestoneReached: result.milestoneReached,
      newLevel: result.newLevel,
      classUnlocked: result.classUnlocked,
    };
  } catch (error) {
    logger.error(`Error recording daily login for user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to record daily login.");
  }
});

/**
 * Purchase Streak Freeze
 * Protects streak for 24 hours if user misses a day
 * Cost: 300 CorpsCoin
 * Limit: 1 freeze per 7 days
 */
const purchaseStreakFreeze = onCall({ cors: true }, async (request) => {
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

      // Check if user has enough CorpsCoin
      const currentCoin = profileData.corpsCoin || 0;
      if (currentCoin < STREAK_FREEZE_COST) {
        throw new HttpsError(
          "failed-precondition",
          `Not enough CorpsCoin. Need ${STREAK_FREEZE_COST}, have ${currentCoin}.`
        );
      }

      // Check cooldown (7 days since last freeze)
      const engagement = profileData.engagement || {};
      const lastFreezePurchase = engagement.lastFreezePurchase
        ? (engagement.lastFreezePurchase.toDate ? engagement.lastFreezePurchase.toDate() : new Date(engagement.lastFreezePurchase))
        : null;

      if (lastFreezePurchase) {
        const daysSinceFreeze = (now - lastFreezePurchase) / (1000 * 60 * 60 * 24);
        if (daysSinceFreeze < 7) {
          const daysRemaining = Math.ceil(7 - daysSinceFreeze);
          throw new HttpsError(
            "failed-precondition",
            `Streak freeze on cooldown. Available in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}.`
          );
        }
      }

      // Check if already has active freeze
      const streakFreezeUntil = engagement.streakFreezeUntil
        ? (engagement.streakFreezeUntil.toDate ? engagement.streakFreezeUntil.toDate() : new Date(engagement.streakFreezeUntil))
        : null;

      if (streakFreezeUntil && now < streakFreezeUntil) {
        throw new HttpsError("already-exists", "You already have an active streak freeze.");
      }

      // Calculate freeze expiration (24 hours from now)
      const freezeUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      // Deduct CorpsCoin and activate freeze
      transaction.update(profileRef, {
        corpsCoin: admin.firestore.FieldValue.increment(-STREAK_FREEZE_COST),
        'engagement.streakFreezeUntil': freezeUntil,
        'engagement.lastFreezePurchase': admin.firestore.FieldValue.serverTimestamp(),
      });

      addCoinHistoryEntryToTransaction(transaction, db, uid, {
        type: 'streak_freeze',
        amount: -STREAK_FREEZE_COST,
        balance: currentCoin - STREAK_FREEZE_COST,
        description: 'Streak freeze protection (24h)',
      });

      return {
        freezeUntil,
        newBalance: currentCoin - STREAK_FREEZE_COST,
      };
    });

    logger.info(`User ${uid} purchased streak freeze - expires ${result.freezeUntil}`);

    return {
      success: true,
      message: 'Streak freeze activated! Your streak is protected for 24 hours.',
      freezeUntil: result.freezeUntil.toISOString(),
      newBalance: result.newBalance,
    };
  } catch (error) {
    logger.error(`Error purchasing streak freeze for user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to purchase streak freeze.");
  }
});

/**
 * Get Streak Status
 * Returns current streak info including freeze status
 */
const getStreakStatus = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const uid = request.auth.uid;
  const db = getDb();
  const profileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);

  try {
    const profileDoc = await profileRef.get();
    if (!profileDoc.exists) {
      throw new HttpsError("not-found", "User profile not found.");
    }

    const profileData = profileDoc.data();
    const engagement = profileData.engagement || {};
    const now = new Date();

    // Parse dates
    const lastLogin = engagement.lastLogin
      ? (engagement.lastLogin.toDate ? engagement.lastLogin.toDate() : new Date(engagement.lastLogin))
      : null;

    const streakFreezeUntil = engagement.streakFreezeUntil
      ? (engagement.streakFreezeUntil.toDate ? engagement.streakFreezeUntil.toDate() : new Date(engagement.streakFreezeUntil))
      : null;

    const lastFreezePurchase = engagement.lastFreezePurchase
      ? (engagement.lastFreezePurchase.toDate ? engagement.lastFreezePurchase.toDate() : new Date(engagement.lastFreezePurchase))
      : null;

    // Calculate streak status
    const hasActiveFreeze = streakFreezeUntil && now < streakFreezeUntil;
    const freezeCooldownDays = lastFreezePurchase
      ? Math.max(0, 7 - Math.floor((now - lastFreezePurchase) / (1000 * 60 * 60 * 24)))
      : 0;
    const canPurchaseFreeze = freezeCooldownDays === 0 && !hasActiveFreeze;

    // Calculate hours until streak at risk
    let hoursUntilAtRisk = null;
    let isAtRisk = false;
    if (lastLogin) {
      const hoursSinceLogin = (now - lastLogin) / (1000 * 60 * 60);
      if (hoursSinceLogin >= 18 && hoursSinceLogin < 24) {
        isAtRisk = true;
        hoursUntilAtRisk = 24 - hoursSinceLogin;
      } else if (hoursSinceLogin < 18) {
        hoursUntilAtRisk = 24 - hoursSinceLogin;
      }
    }

    // Get next milestone
    const currentStreak = engagement.loginStreak || 0;
    const milestones = Object.keys(STREAK_MILESTONES).map(Number).sort((a, b) => a - b);
    const nextMilestone = milestones.find(m => m > currentStreak) || null;

    return {
      success: true,
      streak: currentStreak,
      lastLogin: lastLogin?.toISOString() || null,
      hasActiveFreeze,
      freezeExpiresAt: hasActiveFreeze ? streakFreezeUntil.toISOString() : null,
      canPurchaseFreeze,
      freezeCooldownDays,
      freezeCost: STREAK_FREEZE_COST,
      isAtRisk: isAtRisk && !hasActiveFreeze,
      hoursUntilAtRisk: hoursUntilAtRisk ? Math.round(hoursUntilAtRisk * 10) / 10 : null,
      nextMilestone: nextMilestone ? {
        days: nextMilestone,
        rewards: STREAK_MILESTONES[nextMilestone],
        daysRemaining: nextMilestone - currentStreak,
      } : null,
    };
  } catch (error) {
    logger.error(`Error getting streak status for user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to get streak status.");
  }
});

module.exports = {
  claimDailyLogin,
  purchaseStreakFreeze,
  getStreakStatus,
  STREAK_MILESTONES,
  STREAK_FREEZE_COST,
};
