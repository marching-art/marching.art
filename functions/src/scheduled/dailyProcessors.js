const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
const { processAndArchiveOffSeasonScoresLogic, processAndScoreLiveSeasonDayLogic } = require("../helpers/scoring");
const { getCompletedCalendarDay } = require("../helpers/gameDay");
const { isDropSchedulingEnabled } = require("../helpers/features");
const {
  runDiscordStage,
  runEasternClassicStage,
  runShowcaseStage,
} = require("./nightlyStages");
const {
  discordScoresWebhookUrl,
  discordAnnouncementsWebhookUrl,
} = require("../helpers/discord");

/**
 * True when the timezone-aware drop dispatcher owns tonight's pipeline
 * (scheduled/dropDispatcher.js) and these legacy 2 AM jobs must stand down.
 * Even without this check the shared {seasonUid}_day{N} scoring lease
 * prevents double-scoring — the gate just saves the wasted run and keeps
 * the Discord/Eastern stages from racing their own leases.
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
 * Announce the Eastern Classic two-night lineups to the Discord
 * #announcements channel. Isolated like every other stage; no-op while
 * DISCORD_ANNOUNCEMENTS_WEBHOOK_URL is unset, on every night outside the
 * days-38-40 window, and once its lease records the post.
 *
 * Runs after the fantasy scoring pass (which publishes the preview); the
 * Podium night snake is already published by the 9 PM podiumNightly job hours
 * earlier, so the post carries whichever halves of the split exist by then.
 * @param {FirebaseFirestore.Firestore} db
 */
async function runEasternClassicStageIsolated(db) {
  try {
    const result = await runEasternClassicStage(db, discordAnnouncementsWebhookUrl.value());
    if (result.status === "ran" && result.announcement?.status === "posted") {
      logger.info(`[eastern-classic] result: ${JSON.stringify(result)}`);
    }
  } catch (error) {
    logger.error(`[eastern-classic] stage failed (scoring unaffected): ${error.message}`);
  }
}

/**
 * Post the nightly fantasy score drop to Discord after fantasy scoring. Fully
 * isolated: a Discord failure is logged and swallowed so it can never block or
 * retry the fantasy pipeline. No-op while the DISCORD_SCORES_WEBHOOK_URL secret
 * is unset/empty; the scoreDrop lease makes scheduler retries of a completed
 * run post-at-most-once.
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

/**
 * Finalize/announce the monthly Showcase (helpers/showcase.js). Runs BEFORE
 * the drop-dispatcher stand-down in both nightly jobs — the Showcase follows
 * the calendar month, not the scoring pipeline, so it must run even on nights
 * the dispatcher owns. Everything inside is idempotent (results-doc gate,
 * postOnce leases), so both jobs running it is harmless.
 * @param {FirebaseFirestore.Firestore} db
 */
async function runShowcaseStageIsolated(db) {
  try {
    const result = await runShowcaseStage(db, discordAnnouncementsWebhookUrl.value());
    if (result.finalized === "finalized" || result.announcements.length > 0) {
      logger.info(`[showcase-stage] result: ${JSON.stringify(result)}`);
    }
  } catch (error) {
    logger.error(`[showcase-stage] failed (scoring unaffected): ${error.message}`);
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
  secrets: [discordScoresWebhookUrl, discordAnnouncementsWebhookUrl],
}, async () => {
  const db = getDb();
  await runShowcaseStageIsolated(db);
  if (await dropDispatcherOwnsTonight(db, "off-season-2am")) return;
  await processAndArchiveOffSeasonScoresLogic();
  // Podium is NOT run here — it processes and publishes at 9 PM ET year-round
  // (dropDispatcher.js podiumNightly), independent of this fantasy pipeline.
  await runEasternClassicStageIsolated(db);
  await runDiscordStageIsolated(db);
});

/**
 * The live-season fantasy scoring pass, exactly as it has always run.
 * Extracted so its early returns (spring training, season over) end the
 * FANTASY stage only, leaving the Eastern Classic and Discord stages below to
 * run on their own terms. (Podium — which also runs during spring training for
 * recovery/decay/camp economics — is now its own 9 PM job, podiumNightly.)
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
  secrets: [discordScoresWebhookUrl, discordAnnouncementsWebhookUrl],
}, async () => {
  const db = getDb();
  await runShowcaseStageIsolated(db);
  if (await dropDispatcherOwnsTonight(db, "live-2am")) return;
  await runLiveFantasyStage(db);
  // Podium is NOT run here — it processes and publishes at 9 PM ET year-round
  // (dropDispatcher.js podiumNightly), independent of this fantasy pipeline.
  await runEasternClassicStageIsolated(db);
  await runDiscordStageIsolated(db);
});

// Note: league matchups are NOT generated here. They are ensured daily by
// scheduled/leagueAutomation.js generateWeeklyMatchups (6 AM ET, after this
// job) and RESOLVED by this one, inside runScoringDay's week boundary
// (helpers/scoring.js -> processWeeklyMatchups). Standings are folded server
// side from those resolved matchups (helpers/leagueStandings.js); the client
// computes a table only as a labelled provisional fallback when the league has
// no rows yet (src/hooks/useLeagueLiveStandings.ts).
