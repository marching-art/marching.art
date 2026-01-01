const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
const { startNewOffSeason, startNewLiveSeason, archiveSeasonResultsLogic, refreshLiveSeasonSchedule, updateScheduleDay, generateOffSeasonSchedule, writeScheduleToSubcollection } = require("../helpers/season");
const { processAndArchiveOffSeasonScoresLogic, calculateCorpsStatisticsLogic, processAndScoreLiveSeasonDayLogic } = require("../helpers/scoring");
const { sendWelcomeEmail, brevoApiKey } = require("../helpers/emailService");

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
    case "patchChampionshipShows": {
      // Migration to add isChampionship flag to existing season's championship shows
      // Now updates the subcollection instead of the main season document
      const db = getDb();
      const seasonDoc = await db.doc("game-settings/season").get();
      if (!seasonDoc.exists) {
        throw new HttpsError("failed-precondition", "No active season found.");
      }
      const seasonData = seasonDoc.data();
      const seasonId = seasonData.seasonUid;
      let patched = 0;

      // Day 45: Open and A Class Prelims
      await updateScheduleDay(seasonId, 45, [{
        eventName: "Open and A Class Prelims",
        location: "Marion, IN",
        date: null,
        isChampionship: true,
        eligibleClasses: ["openClass", "aClass"],
        mandatory: true,
      }]);
      patched++;

      // Day 46: Open and A Class Finals
      await updateScheduleDay(seasonId, 46, [{
        eventName: "Open and A Class Finals",
        location: "Marion, IN",
        date: null,
        isChampionship: true,
        eligibleClasses: ["openClass", "aClass"],
        advancementRules: { openClass: 8, aClass: 4 },
        mandatory: true,
      }]);
      patched++;

      // Day 47: World Championship Prelims
      await updateScheduleDay(seasonId, 47, [{
        eventName: "DCI World Championship Prelims",
        location: "Indianapolis, IN",
        date: null,
        isChampionship: true,
        eligibleClasses: ["worldClass", "openClass", "aClass"],
        mandatory: true,
      }]);
      patched++;

      // Day 48: World Championship Semifinals
      await updateScheduleDay(seasonId, 48, [{
        eventName: "DCI World Championship Semifinals",
        location: "Indianapolis, IN",
        date: null,
        isChampionship: true,
        eligibleClasses: ["worldClass", "openClass", "aClass"],
        advancementRules: { all: 25 },
        mandatory: true,
      }]);
      patched++;

      // Day 49: World Championship Finals + SoundSport Festival
      await updateScheduleDay(seasonId, 49, [
        {
          eventName: "DCI World Championship Finals",
          location: "Indianapolis, IN",
          date: null,
          isChampionship: true,
          eligibleClasses: ["worldClass", "openClass", "aClass"],
          advancementRules: { all: 12 },
          mandatory: true,
        },
        {
          eventName: "SoundSport International Music & Food Festival",
          location: "Indianapolis, IN",
          date: null,
          isChampionship: true,
          eligibleClasses: ["soundSport"],
          mandatory: true,
        },
      ]);
      patched++;

      logger.info(`Patched ${patched} championship days in season ${seasonId}.`);
      return { success: true, message: `Successfully patched ${patched} championship days with isChampionship flag.` };
    }
    case "refreshLiveSeasonSchedule": {
      // Scrape DCI events and refresh the live season schedule
      const result = await refreshLiveSeasonSchedule();
      return {
        success: true,
        message: `Schedule refreshed. Added ${result.addedCount} new events from ${result.totalEvents} scraped.`,
      };
    }
    case "regenerateOffSeasonSchedule": {
      // Regenerate schedule for current off-season without starting a new season
      const db = getDb();
      const seasonDoc = await db.doc("game-settings/season").get();
      if (!seasonDoc.exists) {
        throw new HttpsError("failed-precondition", "No active season found.");
      }
      const seasonData = seasonDoc.data();
      if (seasonData.status !== "off-season") {
        throw new HttpsError("failed-precondition", "This function only works for off-seasons. Current status: " + seasonData.status);
      }
      const seasonId = seasonData.seasonUid;
      logger.info(`Regenerating schedule for off-season: ${seasonId}`);

      // Generate new schedule (49 days for off-season)
      const schedule = await generateOffSeasonSchedule(49, 1);

      // Write to subcollection
      await writeScheduleToSubcollection(seasonId, schedule);

      logger.info(`Successfully regenerated schedule with ${schedule.length} days for season ${seasonId}`);
      return {
        success: true,
        message: `Schedule regenerated with ${schedule.length} days for season ${seasonId}.`
      };
    }
    default:
      throw new HttpsError("not-found", `Job named '${jobName}' was not found.`);
    }
  } catch (error) {
    logger.error(`Manual trigger for job '${jobName}' failed:`, error);
    throw new HttpsError("internal", `An error occurred while running ${jobName}.`);
  }
});

/**
 * Send a test email to verify Brevo integration
 * Admin only - sends a welcome email to the admin's own email
 */
exports.sendTestEmail = onCall(
  {
    cors: true,
    secrets: [brevoApiKey],
  },
  async (request) => {
    if (!request.auth || !request.auth.token.admin) {
      throw new HttpsError("permission-denied", "You must be an admin to perform this action.");
    }

    const { email } = request.data;
    const targetEmail = email || request.auth.token.email;

    if (!targetEmail) {
      throw new HttpsError("invalid-argument", "No email address provided or found in auth token.");
    }

    logger.info(`Admin ${request.auth.uid} sending test email to ${targetEmail}`);

    try {
      const success = await sendWelcomeEmail(targetEmail, "Test User");

      if (success) {
        return {
          success: true,
          message: `Test email sent successfully to ${targetEmail}`,
        };
      } else {
        throw new HttpsError("internal", "Email sending returned false - check function logs for details.");
      }
    } catch (error) {
      logger.error("Error sending test email:", error);
      throw new HttpsError("internal", `Failed to send test email: ${error.message}`);
    }
  }
);

