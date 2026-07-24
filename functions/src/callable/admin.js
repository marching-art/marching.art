// @ts-nocheck -- grandfathered when functions checkJs landed (functions/tsconfig.json); remove when this file is typed or cleaned up
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
const {
  startNewOffSeason,
  startNewLiveSeason,
  archiveSeasonResultsLogic,
  refreshLiveSeasonSchedule,
  updateScheduleDay,
  generateOffSeasonSchedule,
  scraperInvokeKey,
} = require("../helpers/season");
const { processAndArchiveOffSeasonScoresLogic, calculateCorpsStatisticsLogic, processAndScoreLiveSeasonDayLogic } = require("../helpers/scoring");
const { reconcileSelectedShows } = require("../helpers/scheduleAudit");
const { getCompletedCalendarDay } = require("../helpers/gameDay");
const { scrapeLatestLiveScores, scrapeLiveScoresForDayRange } = require("../scheduled/liveScraper");
const { scraperApiKey } = require("../helpers/dciFetch");
const { sendWelcomeEmail, brevoApiKey } = require("../helpers/emailService");
const { DCI_CORPS_DATA } = require("../scripts/seedDciReference");
const { assertAdmin } = require("../helpers/callableGuards");
const { FANTASY_CLASSES } = require("../helpers/classRegistry");

// Spring training period (calendar days) before competition day 1 in a live season.
// Kept in sync with dailyProcessors.js / season helper defaults.
const SPRING_TRAINING_DAYS = 21;

/**
 * The calendar day a MANUAL scoring/podium run should target, matching
 * whichever pipeline owns the night. With features.dropScheduling ON, the
 * drop dispatcher scores the SHOW date (3-hour reset — an admin running
 * "score now" at 10 PM means tonight, not the 2 AM-reset "yesterday");
 * with it OFF, the legacy 2 AM derivation stands so a manual run targets
 * exactly what the 2 AM scheduler would.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {object} seasonData - game-settings/season doc data.
 * @returns {Promise<number>} Calendar day (no spring-training offset applied).
 */
async function getManualRunCalendarDay(db, seasonData) {
  const { isDropSchedulingEnabled } = require("../helpers/features");
  const seasonStartDate = seasonData.schedule.startDate.toDate();
  if (await isDropSchedulingEnabled(db)) {
    const { showCalendarDay } = require("../helpers/dropPlanner");
    return showCalendarDay(seasonStartDate);
  }
  return getCompletedCalendarDay(seasonStartDate);
}

exports.startNewOffSeason = onCall({ cors: true }, async (request) => {
  assertAdmin(request);
  try {
    logger.info(`Manual override triggered by admin: ${request.auth.uid}. Starting new off-season.`);
    await startNewOffSeason();
    return { success: true, message: "A new off-season has been started successfully." };
  } catch (error) {
    logger.error("Error manually starting new off-season:", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "An error occurred while starting the season.");
  }
});

exports.startNewLiveSeason = onCall({
  cors: true,
  secrets: [scraperInvokeKey, scraperApiKey],
  timeoutSeconds: 540,
  memory: "512MiB",
}, async (request) => {
  assertAdmin(request);
  try {
    logger.info(`Manual override triggered by admin: ${request.auth.uid}. Starting new live-season.`);
    await startNewLiveSeason();
    return { success: true, message: "A new live-season has been started successfully." };
  } catch (error) {
    logger.error("Error manually starting new live-season:", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "An error occurred while starting the live season.");
  }
});

exports.manualTrigger = onCall({
  cors: true,
  secrets: [scraperInvokeKey, scraperApiKey],
  timeoutSeconds: 540,
  memory: "512MiB",
}, async (request) => {
  assertAdmin(request);

  const { jobName } = request.data;
  logger.info(`Admin ${request.auth.uid} is manually triggering job: ${jobName}`);

  try {
    switch (jobName) {
    case "calculateCorpsStatistics":
      await calculateCorpsStatisticsLogic();
      return { success: true, message: "Successfully calculated and saved corps statistics." };
    case "processPodiumStage": {
      // Alpha/beta convenience: run the flag-gated Podium nightly stage now
      // instead of waiting for the scheduler. Same lease semantics; a
      // completed day is skipped unless it is reprocessed via the guard.
      // The day is resolved to match whichever pipeline owns the night
      // (show date under drop scheduling, 2 AM-reset "yesterday" legacy) —
      // a 10 PM manual run must process TONIGHT, not yesterday.
      const db = getDb();
      const { runPodiumStage } = require("../scheduled/nightlyStages");
      const seasonDoc = await db.doc("game-settings/season").get();
      const stageOptions = {};
      if (seasonDoc.exists && seasonDoc.data()?.schedule?.startDate) {
        stageOptions.calendarDay = await getManualRunCalendarDay(db, seasonDoc.data());
      }
      const stageResult = await runPodiumStage(db, stageOptions);
      return { success: true, message: `Podium stage: ${JSON.stringify(stageResult)}` };
    }
    case "archiveSeasonResults":
      await archiveSeasonResultsLogic();
      return { success: true, message: "Season results and league champions have been archived." };
    case "rebuildGameRecords": {
      const { rebuildGameRecords } = require("../helpers/gameRecords");
      const result = await rebuildGameRecords(getDb());
      return {
        success: true,
        message: `Records Book rebuilt from ${result.daysProcessed} recap days across ${result.seasons} seasons.`,
      };
    }
    case "rebuildPodiumCurves": {
      // Rebuild the Podium realism envelope from the FULL historical_scores
      // archive (completed years only, survivorship-corrected) and publish
      // to podium-config/curves — the runtime override the engine swaps in
      // (store.applyCurveOverrides). The committed curveData stays the
      // fallback; delete the doc to revert.
      const { buildCurves } = require("../scripts/buildPodiumCurves");
      const store = require("../helpers/podium/store");
      const payload = await buildCurves(true);
      if (!store.curvesShapeValid(payload)) {
        throw new HttpsError("internal", "Rebuilt curve payload failed the shape check — not published.");
      }
      payload.meta.publishedAt = new Date().toISOString();
      await getDb().doc("podium-config/curves").set(payload);
      const finals = payload.totalBands[48];
      return {
        success: true,
        message:
          `Podium curves rebuilt from ${payload.meta.years.length} completed years ` +
          `(${payload.meta.corpsSeasons} corps-seasons). Finals band p5/p50/max = ` +
          `${finals.p5}/${finals.p50}/${finals.max}. Published to podium-config/curves.`,
      };
    }
    case "updateEconomyStats": {
      const { updateEconomyStats } = require("../helpers/economyStats");
      const stats = await updateEconomyStats(getDb(), {
        days: Number(request.data.days) > 0 ? Number(request.data.days) : undefined,
      });
      return {
        success: true,
        message:
          `Economy stats refreshed (${stats.windowDays}d): minted ${stats.minted.toLocaleString()} CC, ` +
          `sunk ${stats.sunk.toLocaleString()} CC, net ${stats.net.toLocaleString()} CC.`,
      };
    }
    case "processAndArchiveOffSeasonScores": {
      // force=true bypasses the already-processed guard for reprocessing after
      // a data fix — it re-applies coin/league-record increments, so it is
      // surfaced as an explicit admin choice, never the default.
      // Resolve the day to whichever pipeline owns the night: under drop
      // scheduling a manual evening run means TONIGHT's day (show date);
      // legacy keeps the internal 2 AM-reset derivation (passing undefined).
      const db = getDb();
      const seasonDoc = await db.doc("game-settings/season").get();
      let scoredDayOverride;
      if (seasonDoc.exists && seasonDoc.data().status === "off-season") {
        const { isDropSchedulingEnabled } = require("../helpers/features");
        if (await isDropSchedulingEnabled(db)) {
          scoredDayOverride = await getManualRunCalendarDay(db, seasonDoc.data());
        }
      }
      const result = await processAndArchiveOffSeasonScoresLogic({
        force: request.data.force === true,
        scoredDay: scoredDayOverride,
      });
      if (result.status === "skipped" && (result.reason === "completed" || result.reason === "in-progress")) {
        return {
          success: true,
          skipped: true,
          message: `Off-season day ${result.scoredDay} was already ${result.reason === "completed" ? "processed" : "being processed"}. ` +
            "Re-run with force=true to reprocess (re-applies coin awards).",
        };
      }
      return { success: true, message: "Off-Season Score Processor & Archiver finished successfully." };
    }
    case "processLiveSeasonScores": {
      const db = getDb();
      const seasonDoc = await db.doc("game-settings/season").get();
      if (!seasonDoc.exists || seasonDoc.data().status !== "live-season") {
        throw new HttpsError("failed-precondition", "No active live season found.");
      }
      const seasonData = seasonDoc.data();
      // Match whichever pipeline owns the night, including the spring-training
      // offset: under drop scheduling a manual evening run targets TONIGHT's
      // show date (the day the dispatcher scores); legacy uses the 2 AM-reset
      // "yesterday" the 2 AM scheduler would.
      const springTrainingDays = seasonData.schedule.springTrainingDays || SPRING_TRAINING_DAYS;
      const scoredDay = (await getManualRunCalendarDay(db, seasonData)) - springTrainingDays;
      if (scoredDay < 1) {
        throw new HttpsError("failed-precondition", `Season is in spring training (competition day ${scoredDay}). No scoring yet.`);
      }
      if (scoredDay > 49) {
        throw new HttpsError("failed-precondition", `Competition day ${scoredDay} is past the 49-day season. Nothing to score.`);
      }
      const result = await processAndScoreLiveSeasonDayLogic(scoredDay, seasonData, { force: request.data.force === true });
      if (result.status === "skipped") {
        return {
          success: true,
          skipped: true,
          message: `Live season day ${scoredDay} was already ${result.reason === "completed" ? "processed" : "being processed"}. ` +
            "Re-run with force=true to reprocess (re-applies coin awards).",
        };
      }
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
      // Scrape DCI events and refresh the live season schedule (additive: existing
      // shows are enriched in place with real timing + running order, new events
      // appended, nothing deleted).
      const result = await refreshLiveSeasonSchedule();
      return {
        success: true,
        message: `Schedule refreshed from ${result.totalEvents} scraped events: ` +
          `${result.addedCount} added, ${result.enrichedCount} enriched with times/lineup, ` +
          `${result.unchangedCount} unchanged.`,
      };
    }
    case "setHeritageSchedules": {
      // Feature-flag kill switch for off-season heritage schedule enrichment.
      // enabled=false reverts NEW off-seasons to the names-only schedule.
      const enabled = request.data.enabled !== false;
      await getDb().doc("game-settings/config").set({ heritageSchedulesEnabled: enabled }, { merge: true });
      return {
        success: true,
        message: `Heritage schedule enrichment ${enabled ? "ENABLED" : "DISABLED"} for future off-seasons.`,
      };
    }
    case "auditShowSelections":
    case "repairShowSelections": {
      // Re-match every director's saved show selections against the current
      // schedule. Stale snapshots (e.g. pre-branding "DCI ..." names after a
      // schedule reset) are renamed/moved to their canonical shows; entries that
      // match nothing in editable weeks are removed so they stop consuming the
      // per-week show slots. Past weeks are history: renamed when safe, never
      // removed. "audit" reports what WOULD change; "repair" applies it.
      const apply = jobName === "repairShowSelections";
      const db = getDb();

      const seasonDoc = await db.doc("game-settings/season").get();
      if (!seasonDoc.exists) throw new HttpsError("failed-precondition", "No active season found.");
      const seasonData = seasonDoc.data();
      const seasonId = seasonData.seasonUid;

      const scheduleDoc = await db.doc(`schedules/${seasonId}`).get();
      const competitions = scheduleDoc.exists ? (scheduleDoc.data().competitions || []) : [];
      if (competitions.length === 0) {
        throw new HttpsError("failed-precondition", `schedules/${seasonId} has no competitions to match against.`);
      }

      // Same current-week derivation as regenerateOffSeasonSchedule above.
      let currentWeek = 1;
      if (seasonData.schedule?.startDate) {
        const startDate = seasonData.schedule.startDate.toDate();
        const diffInDays = Math.floor((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const springTrainingDays = seasonData.schedule.springTrainingDays || 0;
        currentWeek = Math.max(1, Math.ceil((diffInDays + 1 - springTrainingDays) / 7));
      }

      const profilesSnapshot = await db.collectionGroup("profile")
        .where("activeSeasonId", "==", seasonId).get();

      const corpsClasses = FANTASY_CLASSES;
      const totals = { profiles: profilesSnapshot.size, corpsChanged: 0, renamed: 0, moved: 0, removed: 0, kept: 0 };
      let usersUpdated = 0;
      let batch = db.batch();
      let batchCount = 0;

      for (const doc of profilesSnapshot.docs) {
        const corpsData = doc.data().corps || {};
        const updates = {};
        let hasUpdates = false;

        for (const corpsClass of corpsClasses) {
          const selectedShows = corpsData[corpsClass]?.selectedShows;
          if (!selectedShows || Object.keys(selectedShows).length === 0) continue;

          const result = reconcileSelectedShows(selectedShows, competitions, currentWeek);
          totals.renamed += result.stats.renamed;
          totals.moved += result.stats.moved;
          totals.removed += result.stats.removed;
          totals.kept += result.stats.kept;

          if (result.changed) {
            totals.corpsChanged++;
            updates[`corps.${corpsClass}.selectedShows`] = result.selectedShows;
            hasUpdates = true;
          }
        }

        if (hasUpdates) {
          usersUpdated++;
          if (apply) {
            batch.update(doc.ref, updates);
            batchCount++;
            if (batchCount >= 400) {
              await batch.commit();
              batch = db.batch();
              batchCount = 0;
            }
          }
        }
      }

      if (apply && batchCount > 0) await batch.commit();

      const verb = apply ? "Repaired" : "Audit (dry run) — would repair";
      logger.info(`${verb} show selections for season ${seasonId}:`, totals);
      return {
        success: true,
        message: `${verb} ${totals.corpsChanged} corps across ${usersUpdated} of ${totals.profiles} directors ` +
          `(week ${currentWeek}+ editable): ${totals.renamed} renamed, ${totals.moved} moved, ` +
          `${totals.removed} removed (slots freed), ${totals.kept} untouched.`,
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
          const competition = {
            id: `${seasonId}_day${day.offSeasonDay}_${idx}`,
            name: show.eventName,
            location: show.location || "",
            date: show.date || null,
            day: day.offSeasonDay,
            week: week,
            type: show.isChampionship ? "championship" : "regular",
            allowedClasses: show.eligibleClasses || ["World Class", "Open Class", "A Class", "SoundSport"],
            mandatory: show.mandatory || false,
          };
          // Major-event metadata (hard-coded marching.art majors).
          if (show.eventTier) competition.eventTier = show.eventTier;
          if (show.multiNight) competition.multiNight = show.multiNight;
          competitions.push(competition);
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
        // Subtract spring training so competition Day 1 starts after it (live season).
        // Off-seasons have no spring training (field absent -> 0).
        const springTrainingDays = seasonData.schedule.springTrainingDays || 0;
        currentWeek = Math.max(1, Math.ceil((diffInDays + 1 - springTrainingDays) / 7));
      }

      logger.info(`Clearing schedule selections for week ${currentWeek} and beyond for season ${seasonId}`);

      const profilesQuery = db.collectionGroup("profile").where("activeSeasonId", "==", seasonId);
      const profilesSnapshot = await profilesQuery.get();
      let usersUpdated = 0;

      if (!profilesSnapshot.empty) {
        let batch = db.batch();
        let batchCount = 0;

        const corpsClasses = FANTASY_CLASSES;

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

        // Create shows document for this corps (using shows-{id} format for valid doc path)
        const showsRef = db.doc(`dci-reference/shows-${corpsData.id}`);
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
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", `An error occurred while running ${jobName}.`);
  }
});

/**
 * Manually scrape the latest DCI scores recap on demand (admin only).
 *
 * Runs the same routine as the nightly scheduled scraper but forces a re-run,
 * bypassing the once-per-day guard. The parsed scores are published to the
 * live-scores pubsub topic and archived into historical_scores/{year} by
 * processLiveScoreRecap. Used by the admin "Scrape DCI Scores Now" button so
 * admins can verify the active DCI season's scraped scores in near real-time.
 */
exports.scrapeLiveScoresNow = onCall({
  cors: true,
  timeoutSeconds: 300,
  memory: "512MiB",
  secrets: [scraperApiKey],
}, async (request) => {
  assertAdmin(request);

  logger.info(`Admin ${request.auth.uid} manually triggered a live DCI score scrape.`);

  try {
    const result = await scrapeLatestLiveScores({ force: true });

    if (!result.scraped) {
      const reasonMessages = {
        "no-live-season": "No active live season — scraping only runs during a live DCI season.",
        "no-recap-found": "No recap link was found on the DCI scores page.",
        "already-scraped-today": "Already scraped today (this shouldn't happen on a forced run).",
      };
      return {
        success: false,
        message: reasonMessages[result.reason] || `Scrape did not run (${result.reason}).`,
        ...result,
      };
    }

    return {
      success: true,
      message: result.count > 0 ?
        `Scraped ${result.count} corps across ${result.eventCount} event(s) for ` +
          `${result.latestDate}. Scores are being archived now.` :
        `Found ${result.eventCount} event(s) for ${result.latestDate} but no corps ` +
          "scores were parsed (recaps may not be published yet).",
      ...result,
    };
  } catch (error) {
    logger.error("Manual live score scrape failed:", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Live score scrape failed.");
  }
});

/**
 * Admin-only: backfill live DCI scores for a specific competition-day range
 * (e.g. days 22-24) rather than just the latest night. Maps each day to its
 * calendar date and scrapes every dci.org event on those dates into
 * historical_scores/{year}. Use to fill days the nightly scrape missed, or —
 * with overwrite=true — to correct days that archived bad scores.
 */
exports.backfillLiveScoresForDayRange = onCall({
  cors: true,
  timeoutSeconds: 300,
  memory: "512MiB",
  secrets: [scraperApiKey],
}, async (request) => {
  assertAdmin(request);

  const startDay = Number(request.data?.startDay);
  const endDay = Number(request.data?.endDay);
  const overwrite = request.data?.overwrite === true;

  if (!Number.isInteger(startDay) || !Number.isInteger(endDay) ||
    startDay < 1 || endDay > 49 || startDay > endDay) {
    throw new HttpsError(
      "invalid-argument",
      "startDay and endDay must be integers with 1 <= startDay <= endDay <= 49."
    );
  }

  logger.info(
    `Admin ${request.auth.uid} triggered a day-range score backfill: ` +
    `days ${startDay}-${endDay} (overwrite=${overwrite}).`
  );

  try {
    const result = await scrapeLiveScoresForDayRange({ startDay, endDay, overwrite });

    if (!result.scraped) {
      const reasonMessages = {
        "no-live-season": "No active live season — backfill only runs during a live DCI season.",
        "no-recap-found": "No recap rows were found on the DCI scores page.",
        "no-events-in-range": `No DCI events are listed for days ${startDay}-${endDay} ` +
          "(they may not be posted yet, or have scrolled off dci.org's listing).",
        "invalid-day-range": "That day range mapped to no valid competition dates.",
      };
      return {
        success: false,
        message: reasonMessages[result.reason] || `Backfill did not run (${result.reason}).`,
        ...result,
      };
    }

    const mode = overwrite ? "overwrote" : "backfilled";
    return {
      success: true,
      message: `${result.count > 0 ? `${mode} ${result.count} corps scores across ` : "Found "}` +
        `${result.eventCount} event(s) for days ${startDay}-${endDay}. Scores are being archived now.`,
      ...result,
    };
  } catch (error) {
    logger.error("Day-range score backfill failed:", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Day-range score backfill failed.");
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
    assertAdmin(request);

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

