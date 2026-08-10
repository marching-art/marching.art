// @ts-nocheck -- grandfathered when functions checkJs landed (functions/tsconfig.json); remove when this file is typed or cleaned up
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { paths } = require("../helpers/paths");
const { logger } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { getDb } = require("../config");
const {
  calculateXPUpdates,
  XP_SOURCES,
  seasonBaselineStamp,
} = require("../helpers/xpCalculations");
const { addCoinHistoryEntryToTransaction } = require("../helpers/economy");
const { assertAuth, assertWriteBudget } = require("../helpers/callableGuards");
const {
  CHALLENGE_POOL,
  WEEKLY_LOOP_TARGET_DAYS,
  getGameDay,
  advanceWeeklyLoop,
  getChallengesForGameDay,
  getRequiredChallengeIds,
  rotationNeedsPodiumContext,
  rotationNeedsLeaguePoolContext,
  pruneOldChallenges,
} = require("../helpers/dailyChallenges");
// Podium keeps its show picks and show concept in a server-only subcollection,
// not on the profile's corps map — so a challenge verifier reading the profile
// alone can't see them. loadPodiumChallengeFacts bridges that gap.
const { loadPodiumChallengeFacts } = require("../helpers/podium/store");
// League prediction-pool entries live at leagues/{id}/pools/{gameDay}, off the
// profile, so the join-league-pool challenge needs the same bridge.
const { loadLeaguePoolChallengeFacts } = require("../helpers/leaguePools");
const {
  PREDICTION_QUESTIONS,
  SCORE_FREE_QUESTION_IDS,
  fetchRecentResultsForClass,
  deriveQuestionThreshold,
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
 * Claim Daily Login
 * Now awards XP and checks for streak milestone bonuses
 */
const claimDailyLogin = onCall({ cors: true }, async (request) => {
  const uid = assertAuth(request);
  const db = getDb();
  // Abuse throttle (shared engagement bucket) — far above any human rate.
  await assertWriteBudget(db, uid, "engagement", { max: 60, windowMs: 10 * 60 * 1000 });
  const profileRef = db.doc(paths.userProfile(uid));

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
  // Abuse throttle (shared engagement bucket) — far above any human rate.
  await assertWriteBudget(db, uid, "engagement", { max: 60, windowMs: 10 * 60 * 1000 });
  const profileRef = db.doc(paths.userProfile(uid));

  try {
    // Weekly-arc fairness for brand-new directors: with fewer than two
    // scored results there are NO prediction questions (buildQuestions
    // returns [] and submitPrediction rejects), so on days whose rotation
    // includes make-prediction their "full set" could never complete and
    // the arc would silently exclude exactly the players it's meant to
    // hook. When predictions are genuinely unavailable, that challenge
    // drops out of the required set. Recaps are immutable, so this is
    // safely computed outside the transaction; it only costs a recap read
    // when the answer could matter (rotation includes it, no picks yet).
    const gameDayPre = getGameDay();
    const rotationIds = getChallengesForGameDay(gameDayPre).map((c) => c.id);
    const needsPrediction = rotationIds.includes("make-prediction");
    const needsPodium = rotationNeedsPodiumContext(gameDayPre);
    const needsLeaguePool = rotationNeedsLeaguePoolContext(gameDayPre);

    let predictionAvailable = true;
    let podiumFacts = null;
    let leaguePoolFacts = null;
    // A single profile read covers every pre-transaction fact. Skip it
    // entirely when today's rotation needs none. (The transaction re-reads
    // the profile authoritatively; this pre-read exists only for the
    // cross-document lookups a transaction can't do — recaps, the podium
    // subcollection, and the leagues' pool docs.)
    if (needsPrediction || needsPodium || needsLeaguePool) {
      const preSnap = await profileRef.get();
      const pre = preSnap.exists ? preSnap.data() : {};
      const seasonUid = pre.activeSeasonId;

      if (needsPrediction) {
        const hasPicksToday =
          Object.keys(pre.predictions?.[gameDayPre]?.picks || {}).length > 0;
        if (!hasPicksToday) {
          const classes = Object.keys(pre.corps || {});
          predictionAvailable = false;
          for (const cls of classes) {
            // Class-aware source (Podium reads podium-recaps) so a podium-only
            // director's make-prediction challenge isn't wrongly dropped.
            const recent = await fetchRecentResultsForClass(db, seasonUid, uid, cls, 5);
            const available = PREDICTION_QUESTIONS.some(
              (q) =>
                (cls !== "soundSport" || SCORE_FREE_QUESTION_IDS.includes(q.id)) &&
                deriveQuestionThreshold(q.id, recent) !== null
            );
            if (available) {
              predictionAvailable = true;
              break;
            }
          }
        }
      }

      // Podium keeps its show picks and concept off the profile, so
      // register-show / set-show-concept can't be verified from profileData
      // alone. Read the podium state only when the director actually has a
      // Podium corps this season — a fantasy-only director never pays for it.
      if (needsPodium && pre.corps?.podiumClass?.corpsName) {
        podiumFacts = await loadPodiumChallengeFacts(db, uid, seasonUid);
      }

      // Read the director's league pool docs for today only when the rotation
      // includes join-league-pool and they actually belong to a league.
      if (needsLeaguePool && Array.isArray(pre.leagueIds) && pre.leagueIds.length > 0) {
        leaguePoolFacts = await loadLeaguePoolChallengeFacts(
          db,
          uid,
          pre.leagueIds,
          gameDayPre
        );
      }
    }

    const context = { predictionAvailable, podium: podiumFacts, leaguePool: leaguePoolFacts };

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
        // client auto-claims never surface errors.
        return { success: false, notInRotation: true, xpAwarded: 0 };
      }

      // Challenges are decisions with verifiable outcomes — the claim only
      // succeeds when the thing was actually done (soft no-op, since the
      // client auto-claims whenever it believes the state is satisfied).
      // `context` carries the Podium facts and prediction availability the
      // profile alone can't answer.
      if (challenge.verify && !challenge.verify(profileData, gameDay, context)) {
        return { success: false, notDoneYet: true, xpAwarded: 0 };
      }

      const allBuckets = profileData.challenges || {};
      const todayBucket = allBuckets[gameDay] || [];
      if (todayBucket.some((c) => c.id === challengeId && c.completed)) {
        return { success: true, alreadyCompleted: true, xpAwarded: 0 };
      }

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

      // Weekly arc: completing the full daily set on 5 distinct days in an
      // ET week pays a one-time bonus (pure state machine in
      // helpers/dailyChallenges.js — day-counting and payout both idempotent).
      // The REQUIRED set drops any challenge this director genuinely can't
      // satisfy today — make-prediction with no questions, or check-lineup for
      // a Podium-only director — so the arc stays winnable for everyone rather
      // than silently excluding the players it exists to hook.
      const requiredIds = getRequiredChallengeIds(gameDay, profileData, context);
      const completedIds = new Set(
        updatedBucket.filter((c) => c.completed).map((c) => c.id)
      );
      // Guard the vacuous case: a day with nothing required is not a completed
      // day (it must never credit a free weekly-arc day). Today's pool always
      // leaves at least one non-droppable challenge required, so this is a
      // future-proofing floor, not a live branch.
      const setComplete = requiredIds.length > 0 && requiredIds.every((id) => completedIds.has(id));
      const { weeklyLoop, bonus: weeklyArcBonus } = advanceWeeklyLoop(
        profileData.engagement?.weeklyLoop,
        gameDay,
        setComplete
      );

      const totalXP = challenge.xp + (weeklyArcBonus?.xp || 0);
      const xpResult = calculateXPUpdates(profileData, totalXP);

      transaction.update(profileRef, {
        challenges: pruneOldChallenges({ ...allBuckets, [gameDay]: updatedBucket }),
        "engagement.weeklyLoop": weeklyLoop,
        ...(weeklyArcBonus
          ? { corpsCoin: admin.firestore.FieldValue.increment(weeklyArcBonus.coin) }
          : {}),
        ...xpResult.updates,
        ...seasonBaselineStamp(profileData),
      });
      if (weeklyArcBonus) {
        addCoinHistoryEntryToTransaction(transaction, db, uid, {
          type: "weekly_arc",
          amount: weeklyArcBonus.coin,
          description: `Weekly arc complete — ${WEEKLY_LOOP_TARGET_DAYS} full daily sets this week`,
        });
      }

      return {
        success: true,
        xpAwarded: totalXP,
        challenge: { id: challenge.id, label: challenge.label, xp: challenge.xp },
        completedToday: updatedBucket.length,
        weeklyArcDays: weeklyLoop.countedDays?.length || 0,
        weeklyArcBonus,
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
  // Abuse throttle (shared engagement bucket) — far above any human rate.
  await assertWriteBudget(db, uid, "engagement", { max: 60, windowMs: 10 * 60 * 1000 });
  const profileRef = db.doc(paths.userProfile(uid));

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
  const profileRef = db.doc(paths.userProfile(uid));

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
  completeDailyChallenge,
  purchaseStreakFreeze,
  getStreakStatus,
  STREAK_MILESTONES,
  STREAK_FREEZE_COST,
};
