/**
 * getAdminInbox — the Admin home's "needs attention" readout in one call.
 *
 * The admin panel used to open on a static season card; everything that
 * actually needed a human (queued submissions, held comments, player reports,
 * a failed scoring night, a broken DCI scrape) was only discoverable by email
 * or by clicking through every tab. This returns the live queue counts (the
 * same tallies the twice-daily digest sends) plus the watchdog's view of
 * recent unhealthy runs and the scrape canary's last verdict.
 *
 * Every part is best-effort: a failed read degrades to null/0 for that part
 * rather than failing the home screen.
 */

const { onCall } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
const { assertAdmin } = require("../helpers/callableGuards");
const { computePendingApprovals } = require("../scheduled/pendingApprovalsDigest");
const {
  findUnhealthyScoringRuns,
  findUnhealthyRolloverRuns,
} = require("../scheduled/scoringWatchdog");

const MAX_RUNS = 10;

/** Trim a watchdog run to what the home card renders. */
const summarizeRun = (run) => ({
  id: run.id,
  kind: run.kind || null,
  stage: run.stage || null,
  status: run.status,
  seasonUid: run.seasonUid || null,
  scoredDay: run.scoredDay ?? null,
  lastError: typeof run.lastError === "string" ? run.lastError.slice(0, 300) : null,
});

async function safe(label, fn, fallback) {
  try {
    return await fn();
  } catch (error) {
    logger.warn(`[admin-inbox] ${label} failed: ${error.message}`);
    return fallback;
  }
}

async function buildAdminInbox(db, now = new Date()) {
  const [queues, scoringRuns, rolloverRuns, canarySnap] = await Promise.all([
    safe("queue counts", () => computePendingApprovals(db), null),
    safe("scoring runs", () => findUnhealthyScoringRuns(db, now), null),
    safe("rollover runs", () => findUnhealthyRolloverRuns(db, now), null),
    safe("scrape canary", () => db.doc("admin-stats/scrapeCanary").get(), null),
  ]);

  const canaryData = canarySnap?.exists ? canarySnap.data() : null;
  const unhealthy =
    scoringRuns === null && rolloverRuns === null
      ? null
      : [...(rolloverRuns || []), ...(scoringRuns || [])].slice(0, MAX_RUNS).map(summarizeRun);

  return {
    queues: {
      submissions: queues?.pendingArticles ?? 0,
      comments: queues?.pendingComments ?? 0,
      reports: queues?.pendingReports ?? 0,
      available: queues !== null,
    },
    health: {
      unhealthyRuns: unhealthy,
      scrapeCanary: canaryData
        ? {
            healthy: canaryData.healthy === true,
            problems: Array.isArray(canaryData.problems) ? canaryData.problems.slice(0, 5) : [],
            warnings: Array.isArray(canaryData.warnings) ? canaryData.warnings.slice(0, 5) : [],
            checkedAt: canaryData.checkedAt || null,
          }
        : null,
    },
    checkedAt: now.toISOString(),
  };
}

exports.getAdminInbox = onCall({ cors: true, timeoutSeconds: 30 }, async (request) => {
  assertAdmin(request);
  return { success: true, ...(await buildAdminInbox(getDb())) };
});

exports.buildAdminInbox = buildAdminInbox;
