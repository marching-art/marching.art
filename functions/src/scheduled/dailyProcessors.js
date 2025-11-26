const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions/v2");
const { getDb, dataNamespaceParam } = require("../config");
const { processAndArchiveOffSeasonScoresLogic, processAndScoreLiveSeasonDayLogic } = require("../helpers/scoring");

exports.dailyOffSeasonProcessor = onSchedule({
  schedule: "every day 02:00",
  timeZone: "America/New_York",
}, async () => {
  await processAndArchiveOffSeasonScoresLogic();
});

exports.processDailyLiveScores = onSchedule({
  schedule: "every day 02:00",
  timeZone: "America/New_York",
}, async () => {
  const db = getDb();
  logger.info("Running Daily Live Season Score Processor...");

  const seasonDoc = await db.doc("game-settings/season").get();
  
  if (!seasonDoc.exists || seasonDoc.data().status !== "live-season") {
    logger.info("No active live season found. Exiting processor.");
    return;
  }

  const seasonData = seasonDoc.data();
  const seasonStartDate = seasonData.schedule.startDate.toDate();

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const diffInMillis = yesterday.getTime() - seasonStartDate.getTime();
  const scoredDay = Math.floor(diffInMillis / (1000 * 60 * 60 * 24)) + 1;

  if (scoredDay < 1) {
    logger.info(`Scored day (${scoredDay}) is not within the season yet. Exiting.`);
    return;
  }
  
  await processAndScoreLiveSeasonDayLogic(scoredDay, seasonData);
});

// Note: Legacy H2H matchup generation removed.
// Leagues now use circuit-style scoring where all members compete at weekly "tour stops"
// and are ranked by their fantasy_recaps scores. No matchup generation needed.
// Circuit standings are calculated client-side from existing fantasy_recaps data.