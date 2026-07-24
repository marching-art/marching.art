// Failure watchdog for the nightly scoring pipeline.
//
// A failed 2 AM scoring run writes status "failed" (or leaves a stale
// "running" claim if the process crashed) to the backend-only `scoring_runs`
// collection (helpers/scoringRunGuard.js) — but nothing watched that
// collection, so a broken night could go unnoticed until players complained.
// This job runs after the scoring window and shouts if anything went wrong.
// During live season it also checks last night's `scrape_runs/{date}` doc
// (scheduled/liveScraper.js): a failed or missing 1:30 AM scrape means the
// 2 AM scorer ran on a night with no DCI scores.
//
// Alerting is both a loud, stably-tagged logger.error ("[scoring-watchdog]")
// — so a Cloud Logging alert can also match on that tag — and an admin email
// via fanOutToAdmins/sendAdminGenericAlertEmail (helpers/emailService.js),
// the same fan-out the news-generation failure path uses.

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
const { STALE_LEASE_MS } = require("../helpers/scoringRunGuard");
const { brevoApiKey } = require("../helpers/emailService");

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

/**
 * During live season, check that last night's scrape recorded a successful
 * run in `scrape_runs`. Two possible keys, depending on which pipeline owns
 * the night (game-settings/features.dropScheduling):
 *
 *   - legacy 1:30 AM scrape: keyed by the MORNING'S Eastern date — the same
 *     date this 4:30 AM run sits in.
 *   - drop dispatcher (scheduled/dropDispatcher.js): keyed by the SHOW DATE —
 *     the previous Eastern calendar date, since it scrapes the same evening
 *     the shows run.
 *
 * Rather than reading the flag (which may have flipped mid-night), the check
 * passes when EITHER key has a completed run. A doc with status !==
 * "completed", or no doc under either key, means the scorer had no fresh
 * DCI scores.
 *
 * Returns null when healthy or not in live season; otherwise a problem
 * descriptor for the alert.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {Date} [now] - Injectable clock for tests.
 * @returns {Promise<null|{date: string, status: string, lastError?: string,
 *   attempted?: number, succeeded?: number, failed?: number}>}
 */
async function findScrapeRunProblem(db, now = new Date()) {
  const seasonDoc = await db.doc("game-settings/season").get();
  if (!seasonDoc.exists || seasonDoc.data().status !== "live-season") return null;

  // en-CA formats as YYYY-MM-DD — same key the legacy liveScraper.js writes.
  const legacyKey = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(now);
  // The dispatcher's key: last night's show date. At 4:30 AM the show-day
  // reset (dropPlanner.js) already points at the new date, so step back one.
  const { showDateFor } = require("../helpers/dropPlanner");
  const showDate = new Date(showDateFor(now).utcMidnight - 24 * 60 * 60 * 1000);
  const showKey = showDate.toISOString().slice(0, 10);

  const keys = [...new Set([legacyKey, showKey])];
  const docs = await Promise.all(keys.map((k) => db.collection("scrape_runs").doc(k).get()));

  let worst = null;
  for (const runDoc of docs) {
    if (!runDoc.exists) continue;
    const run = runDoc.data();
    if (run.status === "completed") return null; // either pipeline succeeded
    worst = {
      date: runDoc.id,
      status: run.status || "unknown",
      lastError: run.lastError,
      attempted: run.attempted,
      succeeded: run.succeeded,
      failed: run.failed,
    };
  }
  return worst || { date: keys.join(" | "), status: "missing" };
}

// 04:30 ET: after the 02:00 scoring runs (and their retries) have finished or
// timed out, and past the 30-minute stale-lease window for a crashed claim.
exports.scoringWatchdog = onSchedule({
  schedule: "every day 04:30",
  timeZone: "America/New_York",
  timeoutSeconds: 120,
  // The admin alert email goes out through Brevo (helpers/emailService.js).
  secrets: [brevoApiKey],
}, async () => {
  const db = getDb();
  const unhealthy = await findUnhealthyScoringRuns(db);

  // A broken scrape check must never mask (or be masked by) the scoring-run
  // check, so its errors are contained here.
  let scrapeProblem = null;
  try {
    scrapeProblem = await findScrapeRunProblem(db);
  } catch (error) {
    logger.error(`[scoring-watchdog] Could not check last night's scrape run: ${error.message}`);
    scrapeProblem = { date: "unknown", status: "check-error", lastError: error.message };
  }

  if (unhealthy.length === 0 && !scrapeProblem) {
    logger.info("[scoring-watchdog] All recent scoring runs healthy.");
    return;
  }

  const problems = [];
  if (unhealthy.length > 0) {
    problems.push(
      `${unhealthy.length} unhealthy scoring run(s) in the last 2 days: ` +
      unhealthy.map((r) => `${r.id} (${r.status}${r.lastError ? `: ${r.lastError}` : ""})`).join("; "),
    );
  }
  if (scrapeProblem) {
    problems.push(
      `Last night's DCI scrape (scrape_runs/${scrapeProblem.date}) is ${scrapeProblem.status}` +
      (scrapeProblem.lastError ? `: ${scrapeProblem.lastError}` : "") +
      (scrapeProblem.attempted != null
        ? ` (${scrapeProblem.succeeded}/${scrapeProblem.attempted} recap(s) succeeded)`
        : ""),
    );
  }

  // Loud and stably tagged so a log-based alert can match on the literal
  // string "[scoring-watchdog]".
  logger.error(
    `[scoring-watchdog] ${problems.join(" | ")}`,
    { runs: unhealthy, scrape: scrapeProblem },
  );

  // Also email the admins (same pattern as the news-generation failure path in
  // triggers/newsGeneration.js). Best-effort: a mail failure must not throw.
  try {
    const { fanOutToAdmins, sendAdminGenericAlertEmail } = require("../helpers/emailService");
    await fanOutToAdmins(sendAdminGenericAlertEmail, {
      subject: "Nightly scoring watchdog: unhealthy run(s) detected",
      body:
        "The 4:30 AM scoring watchdog found problems with last night's pipeline:\n\n" +
        problems.map((p) => `- ${p}`).join("\n") +
        "\n\nA failed scoring run can be re-run from Admin (manual trigger); a " +
        "failed scrape can be re-run with \"Scrape DCI Scores Now\".",
    });
  } catch (notifyErr) {
    logger.warn("[scoring-watchdog] Could not send admin alert email:", notifyErr);
  }
});

// Exported for unit tests.
exports.findUnhealthyScoringRuns = findUnhealthyScoringRuns;
exports.findScrapeRunProblem = findScrapeRunProblem;
exports.LOOKBACK_MS = LOOKBACK_MS;
