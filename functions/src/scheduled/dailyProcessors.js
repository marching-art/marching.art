const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
const { processAndArchiveOffSeasonScoresLogic, processAndScoreLiveSeasonDayLogic } = require("../helpers/scoring");
const { getCompletedCalendarDay } = require("../helpers/gameDay");
const { runPodiumStage } = require("./nightlyStages");
const { announceScoreDrop } = require("../helpers/scoreDropAnnounce");

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
 * The off-season score drop runs at 9:00 PM ET and scores THAT evening's game
 * day (the season-aware boundary in helpers/gameDay.js) — a prime-time reveal
 * the whole player base experiences together, instead of a 2 AM background
 * job. Live season keeps its own 2 AM processor below: real West Coast DCI
 * shows post scores after 1 AM ET, so its run can't move.
 */
exports.dailyOffSeasonProcessor = onSchedule({
  schedule: "every day 21:00",
  timeZone: "America/New_York",
}, async () => {
  const db = getDb();
  const result = await processAndArchiveOffSeasonScoresLogic();
  await runPodiumStageIsolated(db);

  // Announce the drop (push + optional Discord webhook) only on nights that
  // actually scored shows — never on dark days, skips, or re-claimed runs.
  // Isolated inside announceScoreDrop: a failed announcement can't fail the run.
  if (result?.status === "processed" && !result.note) {
    const seasonDoc = await db.doc("game-settings/season").get();
    if (seasonDoc.exists) {
      await announceScoreDrop(db, seasonDoc.data(), result.scoredDay);
    }
  }
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
  const calendarDay = getCompletedCalendarDay(seasonStartDate, new Date(), "live-season");

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
}, async () => {
  const db = getDb();
  await runLiveFantasyStage(db);
  await runPodiumStageIsolated(db);
});

// Note: Legacy H2H matchup generation removed.
// Leagues now use circuit-style scoring where all members compete at weekly "tour stops"
// and are ranked by their fantasy_recaps scores. No matchup generation needed.
// Circuit standings are calculated client-side from existing fantasy_recaps data.
