/**
 * League Prediction Pools — the flagship social CC sink
 * (LIFELONG_GAMIFICATION_ROADMAP.md Step 6; LEAGUES_ENGAGEMENT_STRATEGY.md).
 *
 * Mechanics (v1): each game day, league members may buy into their league's
 * daily pool for a fixed ante. Entrants who post a PERFECT prediction day
 * (every answered pick correct — the same rule as the perfect-day CC bonus)
 * split the pot when the nightly scoring run settles it; if nobody is
 * perfect, the pot carries over to the league's next pool. Zero-sum and
 * fully escrowed: every coin paid out was staked by a member, so the pool
 * adds social stakes without inflating the economy.
 *
 * Outcomes are derived from the same server-authoritative machinery as the
 * personal prediction game (helpers/dailyPredictions.js resolveBucket
 * against fantasy_recaps) — never from anything the client claims.
 *
 * Settlement runs inside the scoringRunGuard-claimed nightly run
 * (helpers/scoring.js), so scheduler redeliveries cannot double-pay.
 */

const { logger } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { dataNamespaceParam } = require("../config");
const {
  fetchRecentRecaps,
  findLatestResultForCorps,
  resolveBucket,
} = require("./dailyPredictions");
const { getCompletedGameDayET } = require("./gameDay");
const { ChunkedWriter } = require("./chunkedWriter");

/** Fixed buy-in per member per day. ~5% of an active day's earnings. */
const POOL_ANTE = 25;

/**
 * Game-day string (Date.toDateString format, same as prediction/challenge
 * buckets) for the game day that just ended — the day whose results this
 * scoring run posted, and therefore the pool it settles.
 */
function completedGameDayString(now = new Date()) {
  const g = getCompletedGameDayET(now);
  return new Date(g.getUTCFullYear(), g.getUTCMonth(), g.getUTCDate()).toDateString();
}

/**
 * Perfect day for one entrant: every answered pick correct, with at least
 * TWO answered. The personal perfect-day bonus accepts a single pick, but a
 * pool win takes other members' escrowed antes — a one-question coin-flip
 * must not outdraw leaguemates who answered the full board. Uses the user's
 * already-resolved bucket when present, otherwise resolves read-only against
 * the recaps (the user's own bucket resolves lazily via resolvePredictions —
 * settlement can't wait for that).
 */
const POOL_MIN_ANSWERED = 2;

function entrantHadPerfectDay(uid, profileData, gameDay, recapDocs) {
  const bucket = profileData?.predictions?.[gameDay];
  if (!bucket || Object.keys(bucket.picks || {}).length === 0) return false;

  if (bucket.resolved && bucket.results) {
    const results = Object.values(bucket.results);
    return results.length >= POOL_MIN_ANSWERED && results.every((r) => r.isCorrect);
  }

  const latest = findLatestResultForCorps(recapDocs, uid, bucket.corpsClass);
  const resolved = resolveBucket(bucket, latest);
  return (
    !!resolved &&
    resolved.totalCount >= POOL_MIN_ANSWERED &&
    resolved.correctCount === resolved.totalCount
  );
}

/**
 * Settle every league's pool for the game day whose results just posted.
 * Idempotent per pool via the `resolved` flag (and the whole call runs
 * inside the guarded scoring run). Winners split the pot evenly; any
 * remainder — and the whole pot on a no-winner day — carries to the
 * league's next pool via league.poolCarry (folded in by joinLeaguePool).
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {Object} seasonData - game-settings/season doc data (for recaps)
 * @param {Date} [now] - Injectable clock for tests
 */
async function settleLeaguePoolsForDay(db, seasonData, now = new Date()) {
  const gameDay = completedGameDayString(now);
  const ns = dataNamespaceParam.value();

  const leaguesSnapshot = await db.collection(`artifacts/${ns}/leagues`).limit(500).get();
  if (leaguesSnapshot.empty) return;

  // One recap read serves every league's settlement.
  let recapDocs = null;

  const batch = new ChunkedWriter(db);
  let settled = 0;

  for (const leagueDoc of leaguesSnapshot.docs) {
    const poolRef = leagueDoc.ref.collection("pools").doc(gameDay);
    const poolSnap = await poolRef.get();
    if (!poolSnap.exists) continue;
    const pool = poolSnap.data();
    if (pool.resolved) continue;

    const entrants = Object.keys(pool.entrants || {});
    const pot = pool.pot || 0;
    if (entrants.length === 0 || pot === 0) {
      batch.set(poolRef, { resolved: true, winners: [], settledAt: new Date() }, { merge: true });
      continue;
    }

    if (!recapDocs) {
      recapDocs = await fetchRecentRecaps(db, seasonData.seasonUid);
    }

    const profileRefs = entrants.map((uid) =>
      db.doc(`artifacts/${ns}/users/${uid}/profile/data`)
    );
    const profileDocs = await db.getAll(...profileRefs);
    const winners = entrants.filter((uid, i) => {
      const doc = profileDocs[i];
      return doc.exists && entrantHadPerfectDay(uid, doc.data(), gameDay, recapDocs);
    });

    const perWinner = winners.length > 0 ? Math.floor(pot / winners.length) : 0;
    const carry = pot - perWinner * winners.length; // full pot when no winners

    batch.set(
      poolRef,
      { resolved: true, winners, paidPerWinner: perWinner, settledAt: new Date() },
      { merge: true }
    );
    if (carry > 0) {
      batch.set(
        leagueDoc.ref,
        { poolCarry: admin.firestore.FieldValue.increment(carry) },
        { merge: true }
      );
    }
    for (const uid of winners) {
      batch.set(
        db.doc(`artifacts/${ns}/users/${uid}/profile/data`),
        { corpsCoin: admin.firestore.FieldValue.increment(perWinner) },
        { merge: true }
      );
      const historyRef = db.collection(`artifacts/${ns}/users/${uid}/corpsCoinHistory`).doc();
      batch.set(historyRef, {
        type: "league_pool_win",
        amount: perWinner,
        description: `Perfect day — won the ${leagueDoc.data().name || "league"} prediction pool`,
        timestamp: new Date(),
      });
    }

    // The result is a league moment either way.
    const activityRef = leagueDoc.ref.collection("activity").doc();
    batch.set(activityRef, {
      id: activityRef.id,
      type: "pool_result",
      title: winners.length > 0 ? "Prediction Pool Won!" : "Pool Rolls Over",
      message:
        winners.length > 0
          ? `${winners.length} perfect day${winners.length > 1 ? "s" : ""} — ${perWinner} CC each from the ${pot} CC pool.`
          : `No perfect prediction day — the ${pot} CC pool carries to the next one.`,
      metadata: { gameDay, pot, winners, paidPerWinner: perWinner },
      timestamp: new Date(),
    });
    settled += 1;
  }

  await batch.commit();
  if (settled > 0) {
    logger.info(`Settled ${settled} league prediction pool(s) for ${gameDay}.`);
  }
}

module.exports = {
  POOL_ANTE,
  POOL_MIN_ANSWERED,
  completedGameDayString,
  entrantHadPerfectDay,
  settleLeaguePoolsForDay,
};
