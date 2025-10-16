const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions/v2");
const { getDb, dataNamespaceParam } = require("../config");
const { startNewOffSeason, startNewLiveSeason } = require("../helpers/season");

exports.seasonScheduler = onSchedule({
  schedule: "every day 03:00",
  timeZone: "America/New_York",
}, async () => {
  logger.info("Running daily season scheduler...");
  const now = new Date();
  const seasonSettingsRef = getDb().doc("game-settings/season");
  const seasonDoc = await seasonSettingsRef.get();

  if (!seasonDoc.exists) {
    logger.info("No season document found. Starting first off-season.");
    await startNewOffSeason();
    return;
  }

  const seasonData = seasonDoc.data();
  if (!seasonData.schedule || !seasonData.schedule.endDate) {
    logger.warn("Season doc is malformed. Starting new off-season to correct.");
    await startNewOffSeason();
    return;
  }

  const seasonEndDate = seasonData.schedule.endDate.toDate();
  if (now < seasonEndDate) {
    logger.info(`Current season (${seasonData.name}) is active. No action taken.`);
    return;
  }

  logger.info(`Season ${seasonData.name} has ended. Starting next season.`);
  const today = new Date();
  const currentYear = today.getFullYear();
  const liveSeasonStartDate = new Date(currentYear, 5, 15);

  if (seasonData.status === "off-season" && today >= liveSeasonStartDate) {
    logger.info("It's time for the live season! Starting now.");
    await startNewLiveSeason();
  } else {
    logger.info("Starting a new off-season.");
    await startNewOffSeason();
  }
});
