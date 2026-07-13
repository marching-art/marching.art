const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { paths } = require("../helpers/paths");
const { logger } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { getDb } = require("../config");
const { calculateXPUpdates, seasonBaselineStamp } = require("../helpers/xpCalculations");
const { addCoinHistoryEntryToTransaction } = require("../helpers/economy");
const { assertAuth } = require("../helpers/callableGuards");
const { getGameDay } = require("../helpers/dailyChallenges");
const {
  PREDICTION_QUESTIONS,
  SCORE_FREE_QUESTION_IDS,
  fetchRecentResultsForClass,
  deriveQuestionThreshold,
  resolveBucket,
  pruneOldPredictions,
} = require("../helpers/dailyPredictions");

/**
 * Submit a Daily Prediction pick
 *
 * Saves one of the day's prediction picks to the profile's server-only
 * `predictions` bucket (mirrors the challenges ledger). Picks lock once made —
 * a question can't be re-answered, and once the day resolves the whole bucket
 * is closed — so predictions can't be farmed.
 *
 * The stored threshold is what the pick is scored against later, so it is
 * DERIVED SERVER-SIDE from the director's recap history (the same math as
 * the client's buildQuestions). Accepting a client threshold would make
 * "Over -1" a guaranteed win — free accuracy CC, and worse, a certain
 * "perfect day" that drains leaguemates' escrowed league-pool antes. A
 * client-sent threshold is only compared against the canonical one so a
 * stale prediction board rejects instead of resolving against a line the
 * user never saw.
 */
const submitPrediction = onCall({ cors: true }, async (request) => {
  const uid = assertAuth(request);
  const { questionId, pick, threshold, corpsClass } = request.data || {};

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
  const profileRef = db.doc(paths.userProfile(uid));

  try {
    // Canonical question context, derived outside the transaction (recaps
    // are immutable). Same season source as resolvePredictions so the
    // threshold saved here and the resolution later read identical data.
    const preSnap = await profileRef.get();
    if (!preSnap.exists) {
      throw new HttpsError("not-found", "User profile not found.");
    }
    const seasonUid = preSnap.data().activeSeasonId;
    // Class-aware: Podium reads its own recap collection, fantasy classes read
    // fantasy_recaps. Reading the wrong source yields no results → a null
    // threshold → the pick is rejected as "not available yet" (the bug that
    // stopped Podium Class predictions from registering).
    const recentResults = await fetchRecentResultsForClass(db, seasonUid, uid, corpsClass, 5);
    const canonicalThreshold = deriveQuestionThreshold(questionId, recentResults);
    const serverSnapshotEvent = recentResults[0]?.eventName ?? null;

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
        snapshotEvent: serverSnapshotEvent,
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

      // Enforced at save time (after the soft no-ops): the question must be
      // genuinely available, and a client-sent threshold must match the
      // canonical one — otherwise the user is picking against a stale line.
      if (canonicalThreshold === null) {
        throw new HttpsError(
          "failed-precondition",
          "That prediction isn't available yet — it unlocks once your corps has a couple of scored shows."
        );
      }
      if (
        typeof threshold === "number" &&
        Math.abs(threshold - canonicalThreshold) > 0.05
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Your prediction board is out of date — refresh and pick again."
        );
      }

      const updatedBucket = {
        ...bucket,
        // Lock the corps + snapshot context to whatever the first pick saw.
        corpsClass: bucket.corpsClass || corpsClass,
        snapshotEvent: bucket.snapshotEvent ?? serverSnapshotEvent,
        resolved: false,
        picks: {
          ...(bucket.picks || {}),
          [questionId]: {
            pick,
            threshold: canonicalThreshold,
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
  const profileRef = db.doc(paths.userProfile(uid));

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

    // Precompute each pending day's resolution. The latest result per corps
    // class is the same across buckets, so cache it. Podium and fantasy classes
    // read different recap sources (fetchRecentResultsForClass), so the latest
    // result is fetched lazily per class — a podium bucket resolves against
    // podium-recaps, exactly the source its threshold was derived from.
    const latestByClass = {};
    const resolutions = {};
    for (const day of pendingDays) {
      const bucket = allBuckets[day];
      const corpsClass = bucket.corpsClass;
      if (!corpsClass) continue;
      if (!(corpsClass in latestByClass)) {
        const latest = await fetchRecentResultsForClass(db, seasonUid, uid, corpsClass, 1);
        latestByClass[corpsClass] = latest[0] || null;
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
  submitPrediction,
  resolvePredictions,
};
