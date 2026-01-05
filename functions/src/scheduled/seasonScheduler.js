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

  // Calculate when the live season should start (69 days before second Saturday in August)
  const findSecondSaturday = (year) => {
    const firstOfAugust = new Date(Date.UTC(year, 7, 1));
    const dayOfWeek = firstOfAugust.getUTCDay();
    const daysToAdd = (6 - dayOfWeek + 7) % 7;
    const firstSaturday = 1 + daysToAdd;
    return new Date(Date.UTC(year, 7, firstSaturday + 7));
  };

  const today = new Date();
  const currentYear = today.getFullYear();
  let nextFinalsDate = findSecondSaturday(currentYear);

  // If we're past this year's finals, use next year
  if (today >= nextFinalsDate) {
    nextFinalsDate = findSecondSaturday(currentYear + 1);
  }

  const millisInDay = 24 * 60 * 60 * 1000;
  const liveSeasonStartDate = new Date(nextFinalsDate.getTime() - 69 * millisInDay);

  // If we're in the live season window, start live season
  // Otherwise start the appropriate off-season
  if (today >= liveSeasonStartDate && today < nextFinalsDate) {
    logger.info("It's time for the live season! Starting now.");
    await startNewLiveSeason();
  } else {
    logger.info("Starting a new off-season.");
    await startNewOffSeason();
  }
});
