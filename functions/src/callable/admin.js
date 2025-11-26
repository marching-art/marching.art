const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
const { startNewOffSeason, startNewLiveSeason, archiveSeasonResultsLogic } = require("../helpers/season");
const { processAndArchiveOffSeasonScoresLogic, calculateCorpsStatisticsLogic, processAndScoreLiveSeasonDayLogic } = require("../helpers/scoring");
const { createBattlePassSeasonManual } = require("../scheduled/battlePassRotation");

exports.startNewOffSeason = onCall({ cors: true }, async (request) => {
  if (!request.auth || !request.auth.token.admin) {
    throw new HttpsError("permission-denied", "You must be an admin to perform this action.");
  }
  try {
    logger.info(`Manual override triggered by admin: ${request.auth.uid}. Starting new off-season.`);
    await startNewOffSeason();
    return { success: true, message: "A new off-season has been started successfully." };
  } catch (error) {
    logger.error("Error manually starting new off-season:", error);
    throw new HttpsError("internal", `An error occurred while starting the season: ${error.message}`);
  }
});

exports.startNewLiveSeason = onCall({ cors: true }, async (request) => {
  if (!request.auth || !request.auth.token.admin) {
    throw new HttpsError("permission-denied", "You must be an admin to perform this action.");
  }
  try {
    logger.info(`Manual override triggered by admin: ${request.auth.uid}. Starting new live-season.`);
    await startNewLiveSeason();
    return { success: true, message: "A new live-season has been started successfully." };
  } catch (error) {
    logger.error("Error manually starting new live-season:", error);
    throw new HttpsError("internal", `An error occurred while starting the live season: ${error.message}`);
  }
});

exports.manualTrigger = onCall({ cors: true }, async (request) => {
  if (!request.auth || !request.auth.token.admin) {
    throw new HttpsError("permission-denied", "You must be an admin to perform this action.");
  }

  const { jobName } = request.data;
  logger.info(`Admin ${request.auth.uid} is manually triggering job: ${jobName}`);

  try {
    switch (jobName) {
    case "calculateCorpsStatistics":
      await calculateCorpsStatisticsLogic();
      return { success: true, message: "Successfully calculated and saved corps statistics." };
    case "archiveSeasonResults":
      await archiveSeasonResultsLogic();
      return { success: true, message: "Season results and league champions have been archived." };
    case "processAndArchiveOffSeasonScores":
      await processAndArchiveOffSeasonScoresLogic();
      return { success: true, message: "Off-Season Score Processor & Archiver finished successfully." };
    case "processLiveSeasonScores": {
      const db = getDb();
      const seasonDoc = await db.doc("game-settings/season").get();
      if (!seasonDoc.exists || seasonDoc.data().status !== "live-season") {
        throw new HttpsError("failed-precondition", "No active live season found.");
      }
      const seasonData = seasonDoc.data();
      const seasonStartDate = seasonData.schedule.startDate.toDate();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const diffInMillis = yesterday.getTime() - seasonStartDate.getTime();
      const scoredDay = Math.floor(diffInMillis / (1000 * 60 * 60 * 24)) + 1;
      await processAndScoreLiveSeasonDayLogic(scoredDay, seasonData);
      return { success: true, message: `Live Season scores processed for day ${scoredDay}.` };
    }
    case "createBattlePassSeason":
      await createBattlePassSeasonManual();
      return { success: true, message: "Battle pass season created successfully." };
    default:
      throw new HttpsError("not-found", `Job named '${jobName}' was not found.`);
    }
  } catch (error) {
    logger.error(`Manual trigger for job '${jobName}' failed:`, error);
    throw new HttpsError("internal", `An error occurred while running ${jobName}.`);
  }
});

exports.initializeBattlePassSeason = onCall({ cors: true }, async (request) => {
  if (!request.auth || !request.auth.token.admin) {
    throw new HttpsError("permission-denied", "You must be an admin to perform this action.");
  }
  try {
    logger.info(`Admin ${request.auth.uid} is manually creating a battle pass season.`);
    const season = await createBattlePassSeasonManual();
    return {
      success: true,
      message: "Battle pass season created successfully.",
      season: {
        seasonId: season.seasonId,
        name: season.name,
        startDate: season.startDate,
        endDate: season.endDate,
      },
    };
  } catch (error) {
    logger.error("Error manually creating battle pass season:", error);
    throw new HttpsError("internal", `Failed to create battle pass season: ${error.message}`);
  }
});