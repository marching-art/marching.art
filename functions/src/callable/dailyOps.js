const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { getDb, dataNamespaceParam } = require("../config");
const { calculateXPUpdates, XP_SOURCES } = require("../helpers/xpCalculations");
const { addCoinHistoryEntryToTransaction } = require("./economy");
const { assertAuth } = require("../helpers/callableGuards");
const {
  CHALLENGE_POOL,
  getGameDay,
  getChallengesForGameDay,
  pruneOldChallenges,
} = require("../helpers/dailyChallenges");
const {
  PREDICTION_QUESTIONS,
  SCORE_FREE_QUESTION_IDS,
  fetchRecentRecaps,
  findLatestResultForCorps,
  resolveBucket,
  pruneOldPredictions,
} = require("../helpers/dailyPredictions");
const { sweepProfileAchievements, sweepCosmeticGrants } = require("../helpers/achievements");
// Reward tables live in helpers/engagementRewards.js (the single source of
// truth, also read by the economy earning guide).
const {
  LEVEL_UP_STIPEND,
  STREAK_MILESTONES,
  STREAK_FREEZE_COST,
} = require("../helpers/engagementRewards");

/**
 * Season-ladder baseline for accounts that predate the ladder: returns a
 * one-time { xpAtSeasonStart } stamp (the profile's pre-award XP) when the
 * baseline is missing, else {}. Merged into every daily XP callable's update
 * so the ladder starts counting on a player's first XP event after deploy —
 * new seasons stamp the baseline properly at rollover.
 */
function seasonBaselineStamp(profileData) {
  return typeof profileData.xpAtSeasonStart === 'number'
    ? {}
    : { xpAtSeasonStart: profileData.xp || 0 };
}

/**
 * Claim Daily Login
 * Now awards XP and checks for streak milestone bonuses
 */
const claimDailyLogin = onCall({ cors: true }, async (request) => {
  const uid = assertAuth(request);
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
          // Already logged in today. Still stamp the season-ladder baseline
          // if it's missing — otherwise a player who claimed before this
          // code deployed would show zero season XP until tomorrow.
          const baseline = seasonBaselineStamp(profileData);
          if (baseline.xpAtSeasonStart !== undefined) {
            transaction.update(profileRef, baseline);
          }
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

      // Season-ladder baseline (no-op once stamped)
      Object.assign(updates, seasonBaselineStamp(profileData));

      // Level-up stipend: +100 CC per level gained, settled daily against
      // lastRewardedLevel (a server-only field). XP is earned through many
      // callables; settling here keeps the payout in one idempotent place.
      const previousRewardedLevel =
        profileData.lastRewardedLevel ?? Math.floor((profileData.xp || 0) / 1000) + 1;
      const levelsGained = Math.max(0, xpResult.newLevel - previousRewardedLevel);
      const stipendCoin = levelsGained * LEVEL_UP_STIPEND;
      coinAwarded += stipendCoin;
      updates.lastRewardedLevel = Math.max(previousRewardedLevel, xpResult.newLevel);

      // Daily achievement sweep — the single server-side award point for the
      // whole catalog (streak tiers, levels, class unlocks, career milestones).
      // Replaces the legacy client-side achievement writers; also backfills
      // existing directors on their next login. Evaluated against post-update
      // state (new streak/level/unlocks from this claim).
      const newAchievements = sweepProfileAchievements(profileData, {
        streak: newStreak,
        level: xpResult.newLevel,
        unlockedClasses: xpResult.updates.unlockedClasses || profileData.unlockedClasses,
      });
      const achievementCoin = newAchievements.reduce((sum, a) => sum + (a.ccReward || 0), 0);
      coinAwarded += achievementCoin;
      if (newAchievements.length > 0) {
        updates.achievements = admin.firestore.FieldValue.arrayUnion(...newAchievements);
      }

      // Cosmetic grants driven by profile state (e.g. the 'Earned, Not
      // Given' title for an XP-path early class unlock). Merge any unlock
      // paths this very claim just set so the grant lands same-day.
      const mergedUnlockPaths = { ...(profileData.classUnlockPaths || {}) };
      for (const [key, value] of Object.entries(xpResult.updates)) {
        if (key.startsWith('classUnlockPaths.')) {
          mergedUnlockPaths[key.split('.')[1]] = value;
        }
      }
      const cosmeticGrants = sweepCosmeticGrants(profileData, {
        classUnlockPaths: mergedUnlockPaths,
      });
      if (cosmeticGrants.length > 0) {
        updates['cosmetics.owned'] = admin.firestore.FieldValue.arrayUnion(...cosmeticGrants);
      }

      // Add CorpsCoin if milestone reached / levels gained / achievements earned
      if (coinAwarded > 0) {
        updates.corpsCoin = admin.firestore.FieldValue.increment(coinAwarded);
      }

      transaction.update(profileRef, updates);

      // Write coin history to subcollection (outside profile doc to avoid unbounded growth)
      if (milestoneReached && milestoneReached.coin > 0) {
        addCoinHistoryEntryToTransaction(transaction, db, uid, {
          type: 'streak_milestone',
          amount: milestoneReached.coin,
          description: `${newStreak}-day streak milestone!${freeFreeze ? ' +Free Streak Freeze!' : ''}`,
        });
      }
      if (stipendCoin > 0) {
        addCoinHistoryEntryToTransaction(transaction, db, uid, {
          type: 'level_up',
          amount: stipendCoin,
          description: `Reached Level ${xpResult.newLevel}`,
        });
      }
      for (const achievement of newAchievements) {
        if (achievement.ccReward > 0) {
          addCoinHistoryEntryToTransaction(transaction, db, uid, {
            type: 'achievement',
            amount: achievement.ccReward,
            description: `Achievement unlocked: ${achievement.title}`,
          });
        }
      }

      return {
        alreadyClaimed: false,
        loginStreak: newStreak,
        previousStreak,
        streakBroken,
        xpAwarded,
        coinAwarded,
        milestoneReached,
        newAchievements,
        levelsGained,
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
      streakBroken: result.streakBroken,
      xpAwarded: result.xpAwarded,
      coinAwarded: result.coinAwarded,
      milestoneReached: result.milestoneReached,
      levelsGained: result.levelsGained,
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
 * Complete Daily Challenge
 *
 * Server-authoritative completion of one of today's three rotating
 * challenges. Validates the challenge is actually offered today (the
 * rotation is deterministic from the game day, so client and server agree
 * without a round trip), guards against double-completion via the
 * `challenges` day-bucket on the profile (a server-only field in
 * firestore.rules), and awards the catalog XP through the shared XP
 * pipeline (level-ups and class unlocks included).
 */
const completeDailyChallenge = onCall({ cors: true }, async (request) => {
  const uid = assertAuth(request);
  const { challengeId } = request.data || {};

  if (!challengeId || typeof challengeId !== "string") {
    throw new HttpsError("invalid-argument", "A challengeId is required.");
  }
  if (!CHALLENGE_POOL.some((c) => c.id === challengeId)) {
    throw new HttpsError("invalid-argument", "Unknown challenge.");
  }

  const db = getDb();
  const profileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);

  try {
    const result = await db.runTransaction(async (transaction) => {
      const profileDoc = await transaction.get(profileRef);
      if (!profileDoc.exists) {
        throw new HttpsError("not-found", "User profile not found.");
      }
      const profileData = profileDoc.data();

      const gameDay = getGameDay();
      const challenge = getChallengesForGameDay(gameDay).find((c) => c.id === challengeId);
      if (!challenge) {
        // Valid challenge, but not in today's rotation — a soft no-op so
        // pages that auto-complete on visit don't surface errors.
        return { success: false, notInRotation: true, xpAwarded: 0 };
      }

      const allBuckets = profileData.challenges || {};
      const todayBucket = allBuckets[gameDay] || [];
      if (todayBucket.some((c) => c.id === challengeId && c.completed)) {
        return { success: true, alreadyCompleted: true, xpAwarded: 0 };
      }

      const xpResult = calculateXPUpdates(profileData, challenge.xp);
      const updatedBucket = [
        ...todayBucket.filter((c) => c.id !== challengeId),
        {
          id: challenge.id,
          label: challenge.label,
          xp: challenge.xp,
          completed: true,
          completedAt: new Date().toISOString(),
        },
      ];

      transaction.update(profileRef, {
        challenges: pruneOldChallenges({ ...allBuckets, [gameDay]: updatedBucket }),
        ...xpResult.updates,
        ...seasonBaselineStamp(profileData),
      });

      return {
        success: true,
        xpAwarded: challenge.xp,
        challenge: { id: challenge.id, label: challenge.label, xp: challenge.xp },
        completedToday: updatedBucket.length,
        newLevel: xpResult.newLevel,
        classUnlocked: xpResult.classUnlocked,
      };
    });

    if (result.success && !result.alreadyCompleted) {
      logger.info(
        `User ${uid} completed daily challenge ${challengeId} (+${result.xpAwarded} XP)`
      );
    }
    return result;
  } catch (error) {
    logger.error(`Error completing daily challenge for user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to complete challenge.");
  }
});

/**
 * Purchase Streak Freeze
 * Protects streak for 24 hours if user misses a day
 * Cost: 300 CorpsCoin
 * Limit: 1 freeze per 7 days
 */
const purchaseStreakFreeze = onCall({ cors: true }, async (request) => {
  const uid = assertAuth(request);
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
  const uid = assertAuth(request);
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

/**
 * Submit a Daily Prediction pick
 *
 * Saves one of the day's prediction picks to the profile's server-only
 * `predictions` bucket (mirrors the challenges ledger). Picks lock once made —
 * a question can't be re-answered, and once the day resolves the whole bucket
 * is closed — so predictions can't be farmed. The stored threshold is what the
 * pick is scored against later, so it survives even if the recent-results the
 * questions were generated from change.
 */
const submitPrediction = onCall({ cors: true }, async (request) => {
  const uid = assertAuth(request);
  const { questionId, pick, threshold, corpsClass, snapshotEvent } = request.data || {};

  if (!questionId || typeof questionId !== "string") {
    throw new HttpsError("invalid-argument", "A questionId is required.");
  }
  if (!PREDICTION_QUESTIONS.some((q) => q.id === questionId)) {
    throw new HttpsError("invalid-argument", "Unknown prediction question.");
  }
  if (!pick || typeof pick !== "string") {
    throw new HttpsError("invalid-argument", "A pick is required.");
  }
  if (!corpsClass || typeof corpsClass !== "string") {
    throw new HttpsError("invalid-argument", "A corpsClass is required.");
  }
  // SoundSport is a ratings-only format — its numeric scores are never shown,
  // so it only gets the placement-based questions (medal + improvement),
  // whose prompts and resolutions reveal no score.
  if (corpsClass === "soundSport" && !SCORE_FREE_QUESTION_IDS.includes(questionId)) {
    throw new HttpsError(
      "invalid-argument",
      "That prediction is not available for SoundSport."
    );
  }

  const db = getDb();
  const profileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);

  try {
    const result = await db.runTransaction(async (transaction) => {
      const profileDoc = await transaction.get(profileRef);
      if (!profileDoc.exists) {
        throw new HttpsError("not-found", "User profile not found.");
      }
      const profileData = profileDoc.data();

      const gameDay = getGameDay();
      const allBuckets = profileData.predictions || {};
      const bucket = allBuckets[gameDay] || {
        picks: {},
        corpsClass,
        snapshotEvent: snapshotEvent ?? null,
        resolved: false,
      };

      // The day's predictions are closed once resolved, and each question can
      // only be answered once.
      if (bucket.resolved) {
        return { success: true, locked: true };
      }
      if (bucket.picks && bucket.picks[questionId]) {
        return { success: true, alreadyPicked: true };
      }

      const updatedBucket = {
        ...bucket,
        // Lock the corps + snapshot context to whatever the first pick saw.
        corpsClass: bucket.corpsClass || corpsClass,
        snapshotEvent: bucket.snapshotEvent ?? snapshotEvent ?? null,
        resolved: false,
        picks: {
          ...(bucket.picks || {}),
          [questionId]: {
            pick,
            threshold: typeof threshold === "number" ? threshold : null,
          },
        },
      };

      transaction.update(profileRef, {
        predictions: pruneOldPredictions({ ...allBuckets, [gameDay]: updatedBucket }),
      });

      return { success: true, picked: questionId };
    });

    return result;
  } catch (error) {
    logger.error(`Error submitting prediction for user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to submit prediction.");
  }
});

/**
 * Resolve outstanding Daily Predictions and award bonuses
 *
 * Reads the authoritative fantasy_recaps for the director's active season to
 * determine each pending prediction's real outcome, then awards XP and a
 * CorpsCoin bonus for every correct pick (plus a perfect-day bonus). Because
 * the outcome is derived server-side from recap data — never taken from the
 * client — accuracy bonuses can't be forged. Idempotent: buckets flip to
 * `resolved` in the same transaction that pays out, so repeat calls (or a
 * concurrent one) never double-award.
 */
const resolvePredictions = onCall({ cors: true }, async (request) => {
  const uid = assertAuth(request);
  const db = getDb();
  const profileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);

  try {
    // Read the profile once up front to discover pending buckets and the
    // active season. Recaps are immutable, so they're read outside the
    // transaction (a bounded query, not an unbounded in-txn collection read).
    const profileSnap = await profileRef.get();
    if (!profileSnap.exists) {
      throw new HttpsError("not-found", "User profile not found.");
    }
    const profileData = profileSnap.data();
    const seasonUid = profileData.activeSeasonId;
    const allBuckets = profileData.predictions || {};

    const pendingDays = Object.keys(allBuckets).filter((day) => {
      const bucket = allBuckets[day];
      return (
        bucket &&
        !bucket.resolved &&
        bucket.picks &&
        Object.keys(bucket.picks).length > 0
      );
    });

    if (!seasonUid || pendingDays.length === 0) {
      return { success: true, resolvedDays: 0 };
    }

    const recapDocs = await fetchRecentRecaps(db, seasonUid);

    // Precompute each pending day's resolution. The latest result per corps
    // class is the same across buckets, so cache it.
    const latestByClass = {};
    const resolutions = {};
    for (const day of pendingDays) {
      const bucket = allBuckets[day];
      const corpsClass = bucket.corpsClass;
      if (!corpsClass) continue;
      if (!(corpsClass in latestByClass)) {
        latestByClass[corpsClass] = findLatestResultForCorps(recapDocs, uid, corpsClass);
      }
      const resolution = resolveBucket(bucket, latestByClass[corpsClass]);
      if (resolution) resolutions[day] = resolution;
    }

    if (Object.keys(resolutions).length === 0) {
      return { success: true, resolvedDays: 0 };
    }

    const result = await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(profileRef);
      if (!doc.exists) {
        throw new HttpsError("not-found", "User profile not found.");
      }
      const data = doc.data();
      const buckets = { ...(data.predictions || {}) };

      let totalXp = 0;
      let totalCoin = 0;
      let totalCorrect = 0;
      let totalCount = 0;
      const resolvedDays = [];

      for (const [day, resolution] of Object.entries(resolutions)) {
        const bucket = buckets[day];
        // Re-check under the transaction so a concurrent resolve can't
        // double-pay.
        if (!bucket || bucket.resolved) continue;
        buckets[day] = {
          ...bucket,
          resolved: true,
          results: resolution.results,
          resolvedEvent: resolution.resolvedEvent,
        };
        totalXp += resolution.xpAwarded;
        totalCoin += resolution.coinAwarded;
        totalCorrect += resolution.correctCount;
        totalCount += resolution.totalCount;
        resolvedDays.push(day);
      }

      if (resolvedDays.length === 0) {
        return { success: true, resolvedDays: 0 };
      }

      const prevStats = data.predictionStats || { correct: 0, total: 0 };
      const updates = {
        predictions: pruneOldPredictions(buckets),
        predictionStats: {
          correct: (prevStats.correct || 0) + totalCorrect,
          total: (prevStats.total || 0) + totalCount,
        },
      };

      Object.assign(updates, seasonBaselineStamp(data));
      let newLevel = data.xpLevel;
      let classUnlocked = null;
      if (totalXp > 0) {
        const xpResult = calculateXPUpdates(data, totalXp);
        Object.assign(updates, xpResult.updates);
        newLevel = xpResult.newLevel;
        classUnlocked = xpResult.classUnlocked;
      }
      if (totalCoin > 0) {
        updates.corpsCoin = admin.firestore.FieldValue.increment(totalCoin);
      }

      transaction.update(profileRef, updates);

      if (totalCoin > 0) {
        addCoinHistoryEntryToTransaction(transaction, db, uid, {
          type: "prediction_bonus",
          amount: totalCoin,
          description: `Prediction bonus — ${totalCorrect}/${totalCount} correct`,
        });
      }

      return {
        success: true,
        resolvedDays: resolvedDays.length,
        xpAwarded: totalXp,
        coinAwarded: totalCoin,
        correct: totalCorrect,
        total: totalCount,
        newLevel,
        classUnlocked,
      };
    });

    if (result.resolvedDays > 0) {
      logger.info(
        `User ${uid} resolved ${result.resolvedDays} prediction day(s): ` +
          `${result.correct}/${result.total} correct (+${result.xpAwarded} XP, +${result.coinAwarded} CC)`
      );
    }
    return result;
  } catch (error) {
    logger.error(`Error resolving predictions for user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to resolve predictions.");
  }
});

module.exports = {
  claimDailyLogin,
  completeDailyChallenge,
  submitPrediction,
  resolvePredictions,
  purchaseStreakFreeze,
  getStreakStatus,
  STREAK_MILESTONES,
  STREAK_FREEZE_COST,
};
