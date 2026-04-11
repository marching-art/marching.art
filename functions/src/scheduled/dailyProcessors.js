const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions/v2");
const { getDb, dataNamespaceParam } = require("../config");
const { processAndArchiveOffSeasonScoresLogic, processAndScoreLiveSeasonDayLogic } = require("../helpers/scoring");
const { publishEmbargoedArticlesLogic } = require("../triggers/newsGeneration");

exports.dailyOffSeasonProcessor = onSchedule({
  schedule: "every day 02:00",
  timeZone: "America/New_York",
}, async () => {
  const db = getDb();
  await publishEmbargoedArticlesLogic(db);
  await processAndArchiveOffSeasonScoresLogic();
});

exports.processDailyLiveScores = onSchedule({
  schedule: "every day 02:00",
  timeZone: "America/New_York",
}, async () => {
  const db = getDb();
  await publishEmbargoedArticlesLogic(db);
  logger.info("Running Daily Live Season Score Processor...");

  const seasonDoc = await db.doc("game-settings/season").get();

  if (!seasonDoc.exists || seasonDoc.data().status !== "live-season") {
    logger.info("No active live season found. Exiting processor.");
    return;
  }

  const seasonData = seasonDoc.data();
  const seasonStartDate = seasonData.schedule.startDate.toDate();

  // Calculate "yesterday" in Eastern timezone with 2 AM game day reset.
  // This function runs at 2 AM ET via the scheduler, so we need the date of
  // the game day that just ended (i.e., yesterday's game day).
  //
  // We use Intl.DateTimeFormat to reliably get the current Eastern date,
  // which correctly handles DST transitions (unlike toLocaleString round-trip
  // which loses timezone context when re-parsed by new Date()).
  const nowUtc = new Date();
  const etParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(nowUtc);
  const etValues = {};
  for (const part of etParts) etValues[part.type] = part.value;
  // Build a UTC Date that represents the ET wall-clock time (for arithmetic only)
  const nowET = new Date(Date.UTC(
    parseInt(etValues.year),
    parseInt(etValues.month) - 1,
    parseInt(etValues.day),
    parseInt(etValues.hour === "24" ? "0" : etValues.hour),
    parseInt(etValues.minute),
    parseInt(etValues.second),
  ));
  // Shift by 2 hours to align with 2 AM game day boundary
  // e.g., 1 AM on Jan 5 becomes 11 PM on Jan 4 (still Jan 4's game day)
  const gameTimeET = new Date(nowET.getTime() - (2 * 60 * 60 * 1000));
  const yesterday = new Date(gameTimeET);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  // Normalize to start of day for consistent day calculation
  yesterday.setUTCHours(0, 0, 0, 0);

  // Also normalize seasonStartDate to start of day in ET for comparison.
  // seasonStartDate is a Firestore Timestamp stored in UTC, so convert it too.
  const startParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(seasonStartDate);
  const startValues = {};
  for (const part of startParts) startValues[part.type] = part.value;
  const seasonStartNormalized = new Date(Date.UTC(
    parseInt(startValues.year),
    parseInt(startValues.month) - 1,
    parseInt(startValues.day),
    0, 0, 0,
  ));

  const diffInMillis = yesterday.getTime() - seasonStartNormalized.getTime();
  const calendarDay = Math.floor(diffInMillis / (1000 * 60 * 60 * 24)) + 1;

  // Spring training offset: first 21 days are setup, no scoring
  // Calendar days 22-70 map to scored days 1-49
  const SPRING_TRAINING_DAYS = 21;
  const scoredDay = calendarDay - SPRING_TRAINING_DAYS;

  if (calendarDay < 1) {
    logger.info(`Calendar day (${calendarDay}) is before season start. Exiting.`);
    return;
  }

  if (scoredDay < 1) {
    logger.info(`Calendar day ${calendarDay} is during spring training (days 1-${SPRING_TRAINING_DAYS}). No scoring today.`);
    return;
  }

  if (scoredDay > 49) {
    logger.info(`Scored day (${scoredDay}) exceeds competition period (1-49). Season has ended.`);
    return;
  }

  logger.info(`Calendar day ${calendarDay} maps to competition day ${scoredDay}`);
  await processAndScoreLiveSeasonDayLogic(scoredDay, seasonData);
});

// Note: Legacy H2H matchup generation removed.
// Leagues now use circuit-style scoring where all members compete at weekly "tour stops"
// and are ranked by their fantasy_recaps scores. No matchup generation needed.
// Circuit standings are calculated client-side from existing fantasy_recaps data.