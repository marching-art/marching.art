const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
const { startNewOffSeason, startNewLiveSeason, isLiveSeasonTime, scraperInvokeKey } = require("../helpers/season");
const { scraperApiKey } = require("../helpers/dciFetch");
const { discordAnnouncementsWebhookUrl, postOnce } = require("../helpers/discord");
const { buildSeasonStartPayload } = require("../helpers/seasonAnnounce");
const { seasonDisplayName } = require("../helpers/seasonDisplay");

exports.seasonScheduler = onSchedule({
  schedule: "every day 03:00",
  timeZone: "America/New_York",
  secrets: [scraperInvokeKey, scraperApiKey, discordAnnouncementsWebhookUrl],
  timeoutSeconds: 540,
  memory: "512MiB",
}, async () => {
  logger.info("Running daily season scheduler...");
  const now = new Date();
  const seasonSettingsRef = getDb().doc("game-settings/season");
  const seasonDoc = await seasonSettingsRef.get();

  // Start whichever phase the calendar says we're in right now: the live season
  // during its run-up (spring training through finals), otherwise the off-season
  // that contains `now`. isLiveSeasonTime and getNextOffSeasonWindow partition
  // the year exactly, so this is the single source of truth for the routing —
  // no duplicated finals math here (helpers/scheduleGeneration.js).
  const startCurrentPhase = async () => {
    if (isLiveSeasonTime(now)) {
      logger.info("It's time for the live season! Starting now.");
      await startNewLiveSeason();
    } else {
      logger.info("Starting a new off-season.");
      await startNewOffSeason();
    }
    await announceSeasonStart(getDb());
  };

  if (!seasonDoc.exists) {
    logger.info("No season document found. Bootstrapping the current season.");
    await startCurrentPhase();
    return;
  }

  const seasonData = seasonDoc.data();
  if (!seasonData.schedule || !seasonData.schedule.endDate) {
    logger.warn("Season doc is malformed. Starting the current season to correct.");
    await startCurrentPhase();
    return;
  }

  const seasonEndDate = seasonData.schedule.endDate.toDate();
  if (now < seasonEndDate) {
    logger.info(`Current season (${seasonData.name}) is active. No action taken.`);
    return;
  }

  logger.info(`Season ${seasonData.name} has ended. Starting next season.`);
  await startCurrentPhase();
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
