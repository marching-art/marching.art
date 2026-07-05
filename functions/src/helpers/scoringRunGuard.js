/**
 * Idempotency guard for the daily scoring pipeline.
 *
 * The 2 AM processors and the admin manualTrigger jobs award CorpsCoin and
 * weekly league records via FieldValue.increment, so running the same season
 * day twice double-awards currency and double-counts records. Scheduler
 * delivery is at-least-once, and admins can (and do) re-run jobs manually,
 * so each run must first claim its season day here.
 *
 * One document per (season, day) in the backend-only `scoring_runs`
 * collection (no client rules exist for it; Firestore denies unmatched
 * paths). The claim is a transaction so two concurrent runs — e.g. the
 * scheduler racing a manual trigger — cannot both proceed.
 *
 * Lifecycle: claim writes status "running"; the processor marks "completed"
 * after all writes land, or "failed" on error so a retry can re-claim
 * immediately instead of waiting out the stale lease. A "running" claim older
 * than STALE_LEASE_MS is treated as a crashed run and can be re-claimed.
 *
 * Residual risk (unchanged from before this guard): the scoring commit is a
 * ChunkedWriter, not a single atomic batch. If a run fails mid-commit,
 * re-running it re-applies increments from chunks that already landed. The
 * guard eliminates the larger hazard — re-running a day that already
 * completed successfully.
 */

const { logger } = require("firebase-functions/v2");

const RUNS_COLLECTION = "scoring_runs";
// A "running" claim older than this is assumed crashed and may be re-claimed.
// Scoring jobs run with 540s timeouts, so 30 minutes is comfortably past any
// live run.
const STALE_LEASE_MS = 30 * 60 * 1000;

function scoringRunRef(db, seasonUid, scoredDay) {
  return db.collection(RUNS_COLLECTION).doc(`${seasonUid}_day${scoredDay}`);
}

// startedAt round-trips as a Firestore Timestamp in production but stays a
// plain Date in unit-test fakes.
function toDate(value) {
  return value && typeof value.toDate === "function" ? value.toDate() : value;
}

/**
 * Atomically claim the scoring run for a season day.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} seasonUid
 * @param {number} scoredDay
 * @param {Object} [options]
 * @param {boolean} [options.force] - Re-claim even a completed day (admin
 *   escape hatch for reprocessing after a data fix; re-runs re-apply coin
 *   and league-record increments).
 * @param {Date} [options.now] - Injectable clock for tests.
 * @returns {Promise<{claimed: boolean, reason?: "completed"|"in-progress"}>}
 */
async function claimScoringRun(db, seasonUid, scoredDay, { force = false, now = new Date() } = {}) {
  const ref = scoringRunRef(db, seasonUid, scoredDay);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const previous = snapshot.exists ? snapshot.data() : null;

    if (previous && !force) {
      if (previous.status === "completed") {
        return { claimed: false, reason: "completed" };
      }
      if (previous.status === "running") {
        const startedAt = toDate(previous.startedAt);
        if (startedAt && now.getTime() - startedAt.getTime() < STALE_LEASE_MS) {
          return { claimed: false, reason: "in-progress" };
        }
        logger.warn(`Scoring run ${ref.id} has a stale "running" claim; re-claiming.`);
      }
      // "failed" (or stale "running") falls through to re-claim.
    }

    transaction.set(ref, {
      seasonUid,
      scoredDay,
      status: "running",
      startedAt: now,
      attempts: (previous?.attempts || 0) + 1,
      ...(force && previous ? { forced: true } : {}),
    });
    return { claimed: true };
  });
}

/**
 * Mark a claimed run completed. `details` (e.g. write counts, a "no shows"
 * note) is merged for diagnostics.
 */
async function markScoringRunCompleted(db, seasonUid, scoredDay, details = {}) {
  await scoringRunRef(db, seasonUid, scoredDay).set(
    { status: "completed", completedAt: new Date(), ...details },
    { merge: true },
  );
}

/**
 * Best-effort: mark a claimed run failed so a retry can re-claim immediately.
 * Never throws — the original scoring error must propagate, not this write's.
 */
async function markScoringRunFailed(db, seasonUid, scoredDay, error) {
  try {
    await scoringRunRef(db, seasonUid, scoredDay).set(
      { status: "failed", failedAt: new Date(), lastError: String(error?.message || error) },
      { merge: true },
    );
  } catch (writeError) {
    logger.error(`Failed to mark scoring run ${seasonUid}_day${scoredDay} as failed:`, writeError);
  }
}

module.exports = {
  claimScoringRun,
  markScoringRunCompleted,
  markScoringRunFailed,
  STALE_LEASE_MS,
};
