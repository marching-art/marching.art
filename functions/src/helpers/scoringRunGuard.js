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
const { FieldValue } = require("firebase-admin/firestore");

const RUNS_COLLECTION = "scoring_runs";
// Season rollover (archiveAndResetProfiles + league champion payout) shares
// the same lease pattern under its own backend-only collection, keyed by the
// season being closed out.
const ROLLOVERS_COLLECTION = "season_rollovers";
// A "running" claim older than this is assumed crashed and may be re-claimed.
// Scoring jobs run with 540s timeouts, so 30 minutes is comfortably past any
// live run.
const STALE_LEASE_MS = 30 * 60 * 1000;

function scoringRunRef(db, seasonUid, scoredDay) {
  return db.collection(RUNS_COLLECTION).doc(`${seasonUid}_day${scoredDay}`);
}

function rolloverRef(db, seasonUid) {
  return db.collection(ROLLOVERS_COLLECTION).doc(seasonUid);
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
 * @param {string} [options.kind] - What the lease guards: "scoring" (default,
 *   the fantasy pipeline — a failure is a critical incident) vs "announce"
 *   (Discord posts and similar side channels — the watchdog reports those as
 *   warnings, not critical). Docs written before this field existed carry no
 *   kind and are treated as "scoring".
 * @returns {Promise<{claimed: boolean, reason?: "completed"|"in-progress"}>}
 */
async function claimScoringRun(db, seasonUid, scoredDay, { force = false, now = new Date(), kind = "scoring" } = {}) {
  return claimRun(db, scoringRunRef(db, seasonUid, scoredDay), { seasonUid, scoredDay, kind }, { force, now });
}

/** Shared lease transaction behind claimScoringRun and claimSeasonRollover. */
async function claimRun(db, ref, claimFields, { force = false, now = new Date() } = {}) {
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
        logger.warn(`Run ${ref.id} has a stale "running" claim; re-claiming.`);
      }
      // "failed" (or stale "running") falls through to re-claim.
    }

    transaction.set(ref, {
      ...claimFields,
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

/**
 * Atomically claim the one-time rollover (payouts + profile archival) for a
 * season that just ended. Same lease semantics as claimScoringRun — a
 * completed rollover is never re-claimed unless force is passed, so a forced
 * double season-start cannot re-pay finish bonuses or re-increment
 * lifetimeStats.totalSeasons.
 */
async function claimSeasonRollover(db, seasonUid, { force = false, now = new Date() } = {}) {
  return claimRun(db, rolloverRef(db, seasonUid), { seasonUid, kind: "rollover" }, { force, now });
}

async function markSeasonRolloverCompleted(db, seasonUid, details = {}) {
  await rolloverRef(db, seasonUid).set(
    { status: "completed", completedAt: new Date(), ...details },
    { merge: true },
  );
}

/** Best-effort, never throws — the original rollover error must propagate. */
async function markSeasonRolloverFailed(db, seasonUid, error) {
  try {
    await rolloverRef(db, seasonUid).set(
      { status: "failed", failedAt: new Date(), lastError: String(error?.message || error) },
      { merge: true },
    );
  } catch (writeError) {
    logger.error(`Failed to mark season rollover ${seasonUid} as failed:`, writeError);
  }
}

/**
 * Failure markers for work that has NO lease of its own to mark.
 *
 * The isolated nightly stages (dailyProcessors.js, dropDispatcher.js
 * podiumNightly) and the 3 AM season scheduler swallow or surface their errors
 * through `logger.error` only. A stage that throws BEFORE it claims its lease
 * (the season read, a feature flag, a config fetch) therefore leaves no
 * failed/stale doc for the 4:30 AM watchdog to find, and the night reads as
 * healthy. These markers close that gap: one doc per (stage, day) shaped like
 * a failed lease (`status: "failed"`, `startedAt`, `lastError`), in the same
 * collection the watchdog already scans, so no new query is needed.
 *
 * Always merge + increment so a scheduler retry of the same night updates the
 * one marker instead of leaving three. Never throws — the marker write must
 * not become a second failure inside a catch block.
 */

/** YYYY-MM-DD in Eastern time — the game's calendar day, same as scrape_runs. */
function easternDateKey(now) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(now);
}

/** @param {FirebaseFirestore.DocumentReference} ref */
async function writeFailureMarker(ref, fields, error, now) {
  try {
    await ref.set(
      {
        ...fields,
        status: "failed",
        startedAt: now,
        failedAt: now,
        lastError: String(error?.message || error),
        attempts: FieldValue.increment(1),
      },
      { merge: true },
    );
  } catch (writeError) {
    logger.error(`Failed to write failure marker ${ref.id}:`, writeError);
  }
}

/**
 * Record that an isolated nightly stage failed tonight, so the watchdog
 * reports it. Writes `scoring_runs/stage_{stage}_{YYYY-MM-DD}`.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} stage - Stable stage tag, e.g. "discord-stage", "podium-nightly".
 * @param {unknown} error
 * @param {Object} [options]
 * @param {"scoring"|"announce"} [options.kind] - "announce" (default) is a
 *   side-channel miss the watchdog reports as a warning; pass "scoring" for a
 *   stage whose failure means players are missing results (Podium).
 * @param {Date} [options.now]
 */
async function recordStageFailure(db, stage, error, { kind = "announce", now = new Date() } = {}) {
  const ref = db.collection(RUNS_COLLECTION).doc(`stage_${stage}_${easternDateKey(now)}`);
  await writeFailureMarker(ref, { kind, stage }, error, now);
}

/**
 * Record that the daily season scheduler (scheduled/seasonScheduler.js)
 * threw. Writes `season_rollovers/scheduler_{YYYY-MM-DD}` — the collection
 * the watchdog scans for rollover health — with kind "scheduler".
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {unknown} error
 * @param {Object} [options]
 * @param {string|null} [options.seasonUid] - The season the scheduler was
 *   acting on (or null when bootstrapping / malformed).
 * @param {Date} [options.now]
 */
async function recordSchedulerFailure(db, error, { seasonUid = null, now = new Date() } = {}) {
  const ref = db.collection(ROLLOVERS_COLLECTION).doc(`scheduler_${easternDateKey(now)}`);
  await writeFailureMarker(ref, { kind: "scheduler", seasonUid: seasonUid || null }, error, now);
}

module.exports = {
  claimScoringRun,
  markScoringRunCompleted,
  markScoringRunFailed,
  claimSeasonRollover,
  markSeasonRolloverCompleted,
  markSeasonRolloverFailed,
  recordStageFailure,
  recordSchedulerFailure,
  RUNS_COLLECTION,
  ROLLOVERS_COLLECTION,
  STALE_LEASE_MS,
};
