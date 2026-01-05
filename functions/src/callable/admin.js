const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
const { startNewOffSeason, startNewLiveSeason, archiveSeasonResultsLogic, refreshLiveSeasonSchedule, updateScheduleDay, generateOffSeasonSchedule } = require("../helpers/season");
const { processAndArchiveOffSeasonScoresLogic, calculateCorpsStatisticsLogic, processAndScoreLiveSeasonDayLogic } = require("../helpers/scoring");
const { sendWelcomeEmail, brevoApiKey } = require("../helpers/emailService");
const { DCI_CORPS_DATA } = require("../scripts/seedDciReference");

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
        eventName: "marching.art World Championship Prelims",
        location: "Indianapolis, IN",
        date: null,
        isChampionship: true,
        eligibleClasses: ["worldClass", "openClass", "aClass"],
        mandatory: true,
      }]);
      patched++;

      // Day 48: World Championship Semifinals
      await updateScheduleDay(seasonId, 48, [{
        eventName: "marching.art World Championship Semifinals",
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
          eventName: "marching.art World Championship Finals",
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

      // Transform to competitions array format (used by schedules collection)
      const competitions = [];
      schedule.forEach(day => {
        const week = Math.ceil(day.offSeasonDay / 7);
        (day.shows || []).forEach((show, idx) => {
          competitions.push({
            id: `${seasonId}_day${day.offSeasonDay}_${idx}`,
            name: show.eventName,
            location: show.location || "",
            date: show.date || null,
            day: day.offSeasonDay,
            week: week,
            type: show.isChampionship ? "championship" : "regular",
            allowedClasses: show.eligibleClasses || ["World Class", "Open Class", "A Class", "SoundSport"],
            mandatory: show.mandatory || false,
          });
        });
      });

      // Write to schedules collection
      await db.doc(`schedules/${seasonId}`).set({ competitions });

      // Clear user schedule selections for current week and future weeks
      // This prevents stale registrations for shows that no longer exist
      let currentWeek = 1;
      if (seasonData.schedule?.startDate) {
        const startDate = seasonData.schedule.startDate.toDate();
        const now = new Date();
        const diffInMillis = now.getTime() - startDate.getTime();
        const diffInDays = Math.floor(diffInMillis / (1000 * 60 * 60 * 24));
        currentWeek = Math.max(1, Math.ceil((diffInDays + 1) / 7));
      }

      logger.info(`Clearing schedule selections for week ${currentWeek} and beyond for season ${seasonId}`);

      const profilesQuery = db.collectionGroup("profile").where("activeSeasonId", "==", seasonId);
      const profilesSnapshot = await profilesQuery.get();
      let usersUpdated = 0;

      if (!profilesSnapshot.empty) {
        let batch = db.batch();
        let batchCount = 0;

        const corpsClasses = ["worldClass", "openClass", "aClass", "soundSport"];

        for (const doc of profilesSnapshot.docs) {
          const profileData = doc.data();
          const corpsData = profileData.corps || {};
          const updates = {};
          let hasUpdates = false;

          // Clear selectedShows for current week and all future weeks (up to 7 weeks)
          for (const corpsClass of corpsClasses) {
            const corps = corpsData[corpsClass];
            if (corps?.selectedShows) {
              for (let week = currentWeek; week <= 7; week++) {
                const weekKey = `week${week}`;
                if (corps.selectedShows[weekKey] && corps.selectedShows[weekKey].length > 0) {
                  updates[`corps.${corpsClass}.selectedShows.${weekKey}`] = [];
                  hasUpdates = true;
                }
              }
            }
          }

          if (hasUpdates) {
            batch.update(doc.ref, updates);
            batchCount++;
            usersUpdated++;

            if (batchCount >= 400) {
              await batch.commit();
              batch = db.batch();
              batchCount = 0;
            }
          }
        }

        if (batchCount > 0) {
          await batch.commit();
        }

        logger.info(`Cleared schedule selections for ${usersUpdated} users from week ${currentWeek} onward`);
      }

      logger.info(`Successfully regenerated schedule with ${competitions.length} competitions for season ${seasonId}`);
      return {
        success: true,
        message: `Schedule regenerated with ${competitions.length} competitions for season ${seasonId}. Cleared schedule selections for ${usersUpdated} users from week ${currentWeek} onward.`
      };
    }
    case "seedDciReference": {
      // Seed Firestore with DCI corps and show reference data
      const db = getDb();
      const batch = db.batch();
      const corpsRef = db.doc("dci-reference/corps");
      const corpsIndex = {};

      // Process each corps
      for (const [corpsName, corpsData] of Object.entries(DCI_CORPS_DATA)) {
        const { shows, ...corpsMeta } = corpsData;
        corpsIndex[corpsData.id] = {
          name: corpsName,
          ...corpsMeta,
        };

        // Create shows document for this corps
        const showsRef = db.doc(`dci-reference/shows/${corpsData.id}`);
        batch.set(showsRef, { shows }, { merge: true });
      }

      // Write corps index document
      batch.set(corpsRef, { corps: corpsIndex }, { merge: true });

      // Commit the batch
      await batch.commit();

      const corpsCount = Object.keys(DCI_CORPS_DATA).length;
      logger.info(`Seeded DCI reference data: ${corpsCount} corps`);
      return {
        success: true,
        message: `Successfully seeded DCI reference data with ${corpsCount} corps.`,
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

