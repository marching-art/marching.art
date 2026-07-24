const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
const { processAndArchiveOffSeasonScoresLogic, processAndScoreLiveSeasonDayLogic } = require("../helpers/scoring");
const { getCompletedCalendarDay } = require("../helpers/gameDay");
const { isDropSchedulingEnabled } = require("../helpers/features");
const { runPodiumStage, runDiscordStage } = require("./nightlyStages");
const { discordScoresWebhookUrl } = require("../helpers/scoreDrop");

/**
 * True when the timezone-aware drop dispatcher owns tonight's pipeline
 * (scheduled/dropDispatcher.js) and these legacy 2 AM jobs must stand down.
 * Even without this check the shared {seasonUid}_day{N} scoring lease
 * prevents double-scoring — the gate just saves the wasted run and keeps
 * Podium/Discord from racing their own leases.
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} jobName
 * @returns {Promise<boolean>}
 */
async function dropDispatcherOwnsTonight(db, jobName) {
  const enabled = await isDropSchedulingEnabled(db);
  if (enabled) {
    logger.info(`[${jobName}] drop scheduling enabled; deferring to the drop dispatcher.`);
  }
  return enabled;
}

/**
 * Run the flag-gated Podium stage after fantasy scoring (Phase 1.2). Fully
 * isolated: a Podium failure is logged and swallowed so it can never block
 * or corrupt the fantasy pipeline. No-op while
 * game-settings/features.podiumClass is off.
 * @param {FirebaseFirestore.Firestore} db
 */
async function runPodiumStageIsolated(db) {
  try {
    const result = await runPodiumStage(db);
    if (result.status !== "disabled") {
      logger.info(`[podium-stage] result: ${JSON.stringify(result)}`);
    }
  } catch (error) {
    logger.error(`[podium-stage] failed (fantasy scoring unaffected): ${error.message}`);
  }
}

/**
 * Post the nightly score drop to Discord after fantasy scoring. Fully
 * isolated like the Podium stage: a Discord failure is logged and swallowed
 * so it can never block or retry the fantasy pipeline. No-op while the
 * DISCORD_SCORES_WEBHOOK_URL secret is unset/empty; the scoreDrop lease
 * makes scheduler retries of a completed run post-at-most-once.
 * @param {FirebaseFirestore.Firestore} db
 */
async function runDiscordStageIsolated(db) {
  try {
    const result = await runDiscordStage(db, discordScoresWebhookUrl.value());
    if (result.status !== "disabled") {
      logger.info(`[discord-stage] result: ${JSON.stringify(result)}`);
    }
  } catch (error) {
    logger.error(`[discord-stage] failed (fantasy scoring unaffected): ${error.message}`);
  }
}

exports.dailyOffSeasonProcessor = onSchedule({
  schedule: "every day 02:00",
  timeZone: "America/New_York",
  // The scoring run guard's stale-lease math (helpers/scoringRunGuard.js)
  // assumes scoring jobs run with 540s timeouts — keep these in sync.
  timeoutSeconds: 540,
  memory: "512MiB",
  // A thrown scoring error is retried by Cloud Scheduler; the scoring run
  // guard makes reruns safe (a completed day is never re-claimed).
  retryCount: 2,
  secrets: [discordScoresWebhookUrl],
}, async () => {
  const db = getDb();
  if (await dropDispatcherOwnsTonight(db, "off-season-2am")) return;
  await processAndArchiveOffSeasonScoresLogic();
  await runPodiumStageIsolated(db);
  await runDiscordStageIsolated(db);
});

/**
 * The live-season fantasy scoring pass, exactly as it has always run.
 * Extracted so its early returns (spring training, season over) end the
 * FANTASY stage only — the Podium stage runs on those days too
 * (recovery/decay/camp economics happen during spring training).
 * @param {FirebaseFirestore.Firestore} db
 */
async function runLiveFantasyStage(db) {
  logger.info("Running Daily Live Season Score Processor...");

  const seasonDoc = await db.doc("game-settings/season").get();

  if (!seasonDoc.exists || seasonDoc.data().status !== "live-season") {
    logger.info("No active live season found. Exiting processor.");
    return;
  }

  const seasonData = seasonDoc.data();
  const seasonStartDate = seasonData.schedule.startDate.toDate();

  // "Yesterday" in Eastern time with the 2 AM game-day reset, as a 1-based
  // calendar day from the season start (see helpers/gameDay.js).
  const calendarDay = getCompletedCalendarDay(seasonStartDate);

  // Spring training offset: first 21 days are setup, no scoring
  // Calendar days 22-70 map to scored days 1-49
  const SPRING_TRAINING_DAYS = 21;
  const scoredDay = calendarDay - SPRING_TRAINING_DAYS;

  if (calendarDay < 1) {
    logger.info(`Calendar day (${calendarDay}) is before season start. Exiting.`);
    return;
  }

  if (scoredDay < 1) {
    logger.info(
      `Calendar day ${calendarDay} is during spring training (days 1-${SPRING_TRAINING_DAYS}). No scoring today.`
    );
    return;
  }

  if (scoredDay > 49) {
    logger.info(`Scored day (${scoredDay}) exceeds competition period (1-49). Season has ended.`);
    return;
  }

  logger.info(`Calendar day ${calendarDay} maps to competition day ${scoredDay}`);
  await processAndScoreLiveSeasonDayLogic(scoredDay, seasonData);
}

exports.processDailyLiveScores = onSchedule({
  schedule: "every day 02:00",
  timeZone: "America/New_York",
  // Same config rationale as dailyOffSeasonProcessor above.
  timeoutSeconds: 540,
  memory: "512MiB",
  retryCount: 2,
  secrets: [discordScoresWebhookUrl],
}, async () => {
  const db = getDb();
  if (await dropDispatcherOwnsTonight(db, "live-2am")) return;
  await runLiveFantasyStage(db);
  await runPodiumStageIsolated(db);
  await runDiscordStageIsolated(db);
});

// Note: Legacy H2H matchup generation removed.
// Leagues now use circuit-style scoring where all members compete at weekly "tour stops"
// and are ranked by their fantasy_recaps scores. No matchup generation needed.
// Circuit standings are calculated client-side from existing fantasy_recaps data.
