const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
const {
  startNewOffSeason,
  startNewLiveSeason,
  isLiveSeasonTime,
  getFinalsDateOverrides,
  scraperInvokeKey,
} = require("../helpers/season");
const { scraperApiKey } = require("../helpers/dciFetch");
const {
  discordAnnouncementsWebhookUrl,
  discordOpsWebhookUrl,
  postOnce,
} = require("../helpers/discord");
const { postOpsAlert } = require("../helpers/opsAlerts");
const { recordSchedulerFailure } = require("../helpers/scoringRunGuard");
const { buildSeasonStartPayload } = require("../helpers/seasonAnnounce");
const { seasonDisplayName } = require("../helpers/seasonDisplay");

/**
 * The daily season-routing pass, as a pure-ish function of (db, now) with
 * every side-effecting collaborator injectable, so the failure path can be
 * unit-tested without a Firestore emulator.
 *
 * Start whichever phase the calendar says we're in right now: the live season
 * during its run-up (spring training through finals), otherwise the off-season
 * that contains `now`. isLiveSeasonTime and getNextOffSeasonWindow partition
 * the year exactly, so this is the single source of truth for the routing —
 * no duplicated finals math here (helpers/scheduleGeneration.js).
 * Manual finals-date overrides (game-settings/config) win over the computed
 * 2nd Saturday when routing live-vs-off, matching what startNew*Season use.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {Object} [options]
 * @param {Date} [options.now]
 * @param {Object} [options.deps] - Test seams; production uses the real helpers.
 * @returns {Promise<{action: "bootstrapped"|"repaired"|"rolled-over"|"active",
 *   seasonUid: string|null}>}
 */
async function runSeasonScheduler(db, { now = new Date(), deps = {} } = {}) {
  const {
    startLive = startNewLiveSeason,
    startOff = startNewOffSeason,
    isLive = isLiveSeasonTime,
    finalsOverridesFor = getFinalsDateOverrides,
    announce = announceSeasonStart,
    recordFailure = recordSchedulerFailure,
    alert = (params) => postOpsAlert(discordOpsWebhookUrl.value(), params),
  } = deps;

  logger.info("Running daily season scheduler...");
  let seasonUid = null;

  try {
    const seasonDoc = await db.doc("game-settings/season").get();
    const seasonData = seasonDoc.exists ? seasonDoc.data() : null;
    seasonUid = seasonData?.seasonUid || null;

    const finalsOverrides = await finalsOverridesFor(db);
    // `force` is only for the malformed-doc repair below: that path
    // deliberately regenerates the season the calendar says is current, which
    // may carry the same seasonUid as the broken doc
    // (helpers/season.js assertNotReminting).
    const startCurrentPhase = async ({ force = false } = {}) => {
      if (isLive(now, finalsOverrides)) {
        logger.info("It's time for the live season! Starting now.");
        await startLive({ force });
      } else {
        logger.info("Starting a new off-season.");
        await startOff({ force });
      }
      await announce(db);
    };

    if (!seasonData) {
      logger.info("No season document found. Bootstrapping the current season.");
      await startCurrentPhase();
      return { action: "bootstrapped", seasonUid };
    }

    if (!seasonData.schedule || !seasonData.schedule.endDate) {
      logger.warn("Season doc is malformed. Starting the current season to correct.");
      await startCurrentPhase({ force: true });
      return { action: "repaired", seasonUid };
    }

    const endRaw = seasonData.schedule.endDate;
    const seasonEndDate = typeof endRaw.toDate === "function" ? endRaw.toDate() : endRaw;
    if (now < seasonEndDate) {
      logger.info(`Current season (${seasonData.name}) is active. No action taken.`);
      return { action: "active", seasonUid };
    }

    logger.info(`Season ${seasonData.name} has ended. Starting next season.`);
    await startCurrentPhase();
    return { action: "rolled-over", seasonUid };
  } catch (error) {
    // A season rollover that dies is the one nightly failure a director sees
    // immediately (no registration, a schedule that never turns over) and the
    // one the scoring watchdog could not see: nothing wrote to
    // season_rollovers unless the failure happened INSIDE
    // rolloverFromOldSeason's lease. Mark it, page #operations, then rethrow
    // so Cloud Scheduler retries (the pre-season-doc steps — rankings read,
    // schedule generation, dci-data write — are idempotent, and a re-run
    // after the season doc landed is a no-op "active" pass). The retry
    // cannot re-run a rollover that failed AFTER the new season doc was
    // written (the re-run sees the new season as active); that failure sits
    // in season_rollovers/{oldSeasonUid} as a failed lease, which the
    // watchdog reports every morning until it is re-run by hand.
    logger.error(`[season-scheduler] failed: ${error.message}`, { seasonUid });
    await recordFailure(db, error, { seasonUid, now });
    await alert({
      title: "Season scheduler failed",
      source: "season-scheduler",
      severity: "critical",
      summary:
        "The 3 AM season scheduler threw. If a season was due to roll over, registration " +
        "and the schedule are stuck on the old one until this is fixed. Cloud Scheduler " +
        "retries the run up to twice; if game-settings/season already shows the new " +
        "season, check season_rollovers for a failed lease — the old season's payouts " +
        "and archival did not run.",
      details: [
        `season: ${seasonUid || "(none)"}`,
        `error: ${error.message}`,
      ],
    });
    throw error;
  }
}

exports.seasonScheduler = onSchedule({
  schedule: "every day 03:00",
  timeZone: "America/New_York",
  secrets: [scraperInvokeKey, scraperApiKey, discordAnnouncementsWebhookUrl, discordOpsWebhookUrl],
  timeoutSeconds: 540,
  memory: "512MiB",
  cpu: 1,
  // A thrown rollover is retried by Cloud Scheduler. Safe: every step before
  // the new season doc is written is idempotent, and once it is written the
  // re-run reads the season as active and does nothing (see runSeasonScheduler).
  retryCount: 2,
}, async () => {
  await runSeasonScheduler(getDb());
});

/**
 * Post "a new season starts now" to #announcements, once per season.
 *
 * Re-reads the season doc that startNew*Season just wrote rather than
 * trusting a return value, so the post always describes what actually
 * landed. Lease-guarded per seasonUid; isolated — a Discord failure must
 * never fail (or retry) a season rollover.
 *
 * @param {FirebaseFirestore.Firestore} db
 */
async function announceSeasonStart(db) {
  const webhookUrl = discordAnnouncementsWebhookUrl.value();
  if (!webhookUrl) return;
  try {
    const seasonDoc = await db.doc("game-settings/season").get();
    if (!seasonDoc.exists) return;
    const season = seasonDoc.data();
    if (!season.seasonUid) return;

    const endRaw = season.schedule && season.schedule.endDate;
    const payload = buildSeasonStartPayload({
      seasonName: seasonDisplayName(season),
      seasonType: season.status,
      endDate: endRaw && typeof endRaw.toDate === "function" ? endRaw.toDate() : endRaw,
    });
    const result = await postOnce(db, {
      kind: "season-start",
      tag: "season-scheduler",
      leaseKey: `${season.seasonUid}_discord_seasonstart`,
      leaseDay: 0,
      payload,
      webhookUrl,
    });
    logger.info(`[season-scheduler] season-start announcement: ${result.status}`);
  } catch (error) {
    logger.error(`[season-scheduler] season-start announcement failed: ${error.message}`);
  }
}

exports.announceSeasonStart = announceSeasonStart;
exports.runSeasonScheduler = runSeasonScheduler;
