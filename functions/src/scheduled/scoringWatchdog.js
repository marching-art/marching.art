// Failure watchdog for the nightly scoring pipeline.
//
// A failed 2 AM scoring run writes status "failed" (or leaves a stale
// "running" claim if the process crashed) to the backend-only `scoring_runs`
// collection (helpers/scoringRunGuard.js) — but nothing watched that
// collection, so a broken night could go unnoticed until players complained.
// This job runs after the scoring window and shouts if anything went wrong.
//
// Alerting is a loud, stably-tagged logger.error ("[scoring-watchdog]") — the
// codebase has no admin-alert email/notification helper, so a Cloud Logging
// alert on that tag is the intended hookup.

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
const { STALE_LEASE_MS } = require("../helpers/scoringRunGuard");

// Only look at runs claimed in the last 2 days: yesterday's run plus one day
// of slack. Bounds the query to a handful of docs (one per season-day) and
// keeps already-reported older failures from re-firing forever.
const LOOKBACK_MS = 2 * 24 * 60 * 60 * 1000;

// startedAt round-trips as a Firestore Timestamp in production but stays a
// plain Date in unit-test fakes (same convention as scoringRunGuard.js).
function toDate(value) {
  return value && typeof value.toDate === "function" ? value.toDate() : value;
}

/**
 * Query scoring_runs for recent unhealthy runs: status "failed", or status
 * "running" whose claim is older than the stale-lease threshold (a crashed
 * run that never reached its failed/completed marker).
 *
 * Single range filter on startedAt (auto single-field index; the
 * failed/stale-running split is done in memory over the tiny result set, so
 * no composite index is needed).
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {Date} [now] - Injectable clock for tests.
 * @returns {Promise<Array<{id: string, status: string, seasonUid?: string,
 *   scoredDay?: number, attempts?: number, lastError?: string}>>}
 */
async function findUnhealthyScoringRuns(db, now = new Date()) {
  const cutoff = new Date(now.getTime() - LOOKBACK_MS);
  const snapshot = await db.collection("scoring_runs")
    .where("startedAt", ">=", cutoff)
    .get();

  const unhealthy = [];
  for (const doc of snapshot.docs) {
    const run = doc.data();
    if (run.status === "failed") {
      unhealthy.push({
        id: doc.id,
        status: "failed",
        seasonUid: run.seasonUid,
        scoredDay: run.scoredDay,
        attempts: run.attempts,
        lastError: run.lastError,
      });
    } else if (run.status === "running") {
      const startedAt = toDate(run.startedAt);
      if (startedAt && now.getTime() - startedAt.getTime() >= STALE_LEASE_MS) {
        unhealthy.push({
          id: doc.id,
          status: "stale-running",
          seasonUid: run.seasonUid,
          scoredDay: run.scoredDay,
          attempts: run.attempts,
        });
      }
    }
  }
  return unhealthy;
}

// 04:30 ET: after the 02:00 scoring runs (and their retries) have finished or
// timed out, and past the 30-minute stale-lease window for a crashed claim.
exports.scoringWatchdog = onSchedule({
  schedule: "every day 04:30",
  timeZone: "America/New_York",
  timeoutSeconds: 120,
}, async () => {
  const unhealthy = await findUnhealthyScoringRuns(getDb());

  if (unhealthy.length === 0) {
    logger.info("[scoring-watchdog] All recent scoring runs healthy.");
    return;
  }

  // Loud and stably tagged so a log-based alert can match on the literal
  // string "[scoring-watchdog]".
  logger.error(
    `[scoring-watchdog] ${unhealthy.length} unhealthy scoring run(s) in the last 2 days: ` +
    unhealthy.map((r) => `${r.id} (${r.status}${r.lastError ? `: ${r.lastError}` : ""})`).join("; "),
    { runs: unhealthy },
  );
});

// Exported for unit tests.
exports.findUnhealthyScoringRuns = findUnhealthyScoringRuns;
exports.LOOKBACK_MS = LOOKBACK_MS;
