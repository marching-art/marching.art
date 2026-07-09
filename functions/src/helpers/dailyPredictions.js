/**
 * Daily Predictions Helper
 *
 * Server-authoritative catalog, resolution rules and reward table for the
 * dashboard's daily prediction game. Predictions are stored on the profile's
 * server-only `predictions` field (see firestore.rules) and resolved by the
 * resolvePredictions callable, which reads the authoritative fantasy_recaps to
 * determine the actual outcome — the client never gets to claim it was right.
 *
 * The question ids and their resolution semantics MUST STAY IN SYNC with the
 * client's buildQuestions in src/utils/dailyPredictions.js.
 */

/** XP awarded per correct prediction (matches the "+15 XP" the client shows). */
const PREDICTION_XP = 15;

/** CorpsCoin awarded per correct prediction — the tangible accuracy bonus. */
const PREDICTION_COIN = 10;

/** Extra CorpsCoin when every resolved pick for the day was correct. */
const PERFECT_BONUS_COIN = 25;

/** Day-buckets of prediction history kept on the profile document. */
const MAX_PREDICTION_DAYS_KEPT = 30;

/**
 * The prediction questions and how each resolves against an authoritative
 * result. `needs` names the result field required to resolve the question, so
 * a pick is left unresolved (rather than mis-scored) when that data is absent.
 */
const PREDICTION_QUESTIONS = [
  {
    id: "over-under",
    xp: PREDICTION_XP,
    needs: "score",
    resolve: (result, threshold) => (result.score > threshold ? "Over" : "Under"),
  },
  {
    id: "beat-prev",
    xp: PREDICTION_XP,
    needs: "score",
    resolve: (result, threshold) => (result.score > threshold ? "Yes" : "No"),
  },
  {
    id: "podium",
    xp: PREDICTION_XP,
    needs: "placement",
    resolve: (result) => (result.placement <= 3 ? "Yes" : "No"),
  },
  {
    id: "ss-improve",
    xp: PREDICTION_XP,
    needs: "placement",
    // threshold = the placement snapshot when the pick was made; improving
    // means a lower-numbered placement. Placement-only, so it's safe for
    // SoundSport's ratings-only format (no numeric score is revealed).
    resolve: (result, threshold) => (result.placement < threshold ? "Yes" : "No"),
  },
];

const PREDICTION_QUESTION_IDS = PREDICTION_QUESTIONS.map((q) => q.id);

/**
 * Questions that never reveal a numeric score (placement-based only) — the
 * subset available to SoundSport, whose scores are deliberately hidden
 * behind medal ratings.
 */
const SCORE_FREE_QUESTION_IDS = PREDICTION_QUESTIONS
  .filter((q) => q.needs !== "score")
  .map((q) => q.id);

/**
 * Read the most recent recap days for a season, newest first. Prefers the
 * `days` subcollection (current format) and falls back to the legacy
 * single-document `recaps` array. Bounded so resolution never scans an
 * unbounded collection.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} seasonUid
 * @returns {Promise<Array<Object>>}
 */
async function fetchRecentRecaps(db, seasonUid) {
  const daysSnap = await db
    .collection(`fantasy_recaps/${seasonUid}/days`)
    .orderBy("offSeasonDay", "desc")
    .limit(15)
    .get();
  if (!daysSnap.empty) return daysSnap.docs.map((doc) => doc.data());

  const legacyDoc = await db.doc(`fantasy_recaps/${seasonUid}`).get();
  if (legacyDoc.exists) return legacyDoc.data().recaps || [];
  return [];
}

/**
 * Find a director's most recent competition result for a corps class across a
 * set of recap days. Mirrors the client's useRecentResults notion of
 * recentResults[0]: the first result found scanning days newest-first.
 *
 * @param {Array<Object>} recapDocs
 * @param {string} uid
 * @param {string} corpsClass
 * @returns {{eventName: string, score: (number|null), placement: (number|null)}|null}
 */
function findLatestResultForCorps(recapDocs, uid, corpsClass) {
  const sorted = [...recapDocs].sort(
    (a, b) => (b.offSeasonDay || 0) - (a.offSeasonDay || 0)
  );
  for (const recap of sorted) {
    for (const show of recap.shows || []) {
      const userResult = (show.results || []).find(
        (r) => r.uid === uid && r.corpsClass === corpsClass
      );
      if (userResult) {
        return {
          eventName: show.eventName || show.name || "Show",
          score: userResult.totalScore ?? null,
          placement: userResult.placement ?? null,
        };
      }
    }
  }
  return null;
}

/**
 * Resolve a day's stored picks against an authoritative latest result.
 *
 * Returns null when the bucket can't be resolved yet — either there is no new
 * result (the latest event still matches the snapshot taken when the picks
 * were made) or none of the picks have the data they need to score.
 *
 * @param {Object} bucket - Stored prediction bucket { picks, snapshotEvent }
 * @param {{eventName: string, score: (number|null), placement: (number|null)}|null} latestResult
 * @returns {null | {
 *   results: Object, correctCount: number, totalCount: number,
 *   xpAwarded: number, coinAwarded: number, resolvedEvent: string
 * }}
 */
function resolveBucket(bucket, latestResult) {
  if (!latestResult || !latestResult.eventName) return null;
  // Nothing new has been scored since the picks were made.
  if (bucket.snapshotEvent && latestResult.eventName === bucket.snapshotEvent) {
    return null;
  }

  const picks = bucket.picks || {};
  const results = {};
  let correctCount = 0;
  let totalCount = 0;
  let xpAwarded = 0;
  let coinAwarded = 0;

  for (const question of PREDICTION_QUESTIONS) {
    const pick = picks[question.id];
    if (!pick) continue;
    if (question.needs === "score" && latestResult.score == null) continue;
    if (question.needs === "placement" && latestResult.placement == null) continue;

    const answer = question.resolve(latestResult, pick.threshold);
    const isCorrect = pick.pick === answer;
    results[question.id] = { answer, isCorrect };
    totalCount += 1;
    if (isCorrect) {
      correctCount += 1;
      xpAwarded += question.xp;
      coinAwarded += PREDICTION_COIN;
    }
  }

  if (totalCount === 0) return null;
  if (correctCount === totalCount) coinAwarded += PERFECT_BONUS_COIN;

  return {
    results,
    correctCount,
    totalCount,
    xpAwarded,
    coinAwarded,
    resolvedEvent: latestResult.eventName,
  };
}

/**
 * Prune old day-buckets so the profile document doesn't grow unbounded.
 * Keeps the most recent MAX_PREDICTION_DAYS_KEPT buckets (keyed by game-day
 * string, same format as challenges).
 *
 * @param {Object} predictions - Map keyed by game-day string
 * @returns {Object}
 */
function pruneOldPredictions(predictions) {
  if (!predictions || typeof predictions !== "object") return predictions;

  const entries = Object.entries(predictions);
  if (entries.length <= MAX_PREDICTION_DAYS_KEPT) return predictions;

  const sorted = entries.sort(
    ([dateA], [dateB]) => new Date(dateA).getTime() - new Date(dateB).getTime()
  );
  return Object.fromEntries(sorted.slice(-MAX_PREDICTION_DAYS_KEPT));
}

module.exports = {
  PREDICTION_XP,
  PREDICTION_COIN,
  PERFECT_BONUS_COIN,
  MAX_PREDICTION_DAYS_KEPT,
  PREDICTION_QUESTIONS,
  PREDICTION_QUESTION_IDS,
  SCORE_FREE_QUESTION_IDS,
  fetchRecentRecaps,
  findLatestResultForCorps,
  resolveBucket,
  pruneOldPredictions,
};
