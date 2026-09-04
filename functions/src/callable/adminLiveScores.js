// Admin-only live-score scrape callables: the on-demand "Scrape DCI Scores
// Now" button and the day-range backfill. Split from admin.js so that file
// stays under the max-lines gate; index.js exports both from here.

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
const { scrapeLatestLiveScores, scrapeLiveScoresForDayRange } = require("../scheduled/liveScraper");
const { scraperApiKey } = require("../helpers/dciFetch");
const { assertAdmin } = require("../helpers/callableGuards");

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
  // A night can have several events, each a slow (10-40s) JS-rendered recap
  // fetch, so give the manual scrape the same headroom as the dispatcher.
  timeoutSeconds: 540,
  memory: "512MiB",
  cpu: 1,
  secrets: [scraperApiKey],
}, async (request) => {
  assertAdmin(request);

  logger.info(`Admin ${request.auth.uid} manually triggered a live DCI score scrape.`);

  try {
    // Target the night explicitly so the scrape can reach events DCI has posted
    // but not yet linked on /scores/. An admin may pass an exact date; otherwise
    // we use the drop planner's current show date (the same 3 AM ET reset scoring
    // uses), which — unlike the old "latest listed date" default — resolves even
    // for championship-week nights that never appear in competitions[].
    let dateKey = null;
    const explicitDate = request.data?.date;
    if (typeof explicitDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(explicitDate)) {
      dateKey = explicitDate;
    } else {
      try {
        const db = getDb();
        const seasonDoc = await db.doc("game-settings/season").get();
        const seasonData = seasonDoc.exists ? seasonDoc.data() : null;
        let competitions = [];
        if (seasonData?.status === "live-season" && seasonData.seasonUid) {
          const scheduleDoc = await db.doc(`schedules/${seasonData.seasonUid}`).get();
          competitions = scheduleDoc.exists ? (scheduleDoc.data().competitions || []) : [];
        }
        const { planDrop } = require("../helpers/dropPlanner");
        const plan = seasonData ? planDrop({ seasonData, competitions }) : null;
        // Only live-season plans drive a dci.org scrape; off-season has no recap.
        if (plan && plan.seasonType === "live-season") dateKey = plan.showDateET;
      } catch (planError) {
        // Fall back to the legacy "latest listed" behavior if planning fails —
        // never block the manual scrape on the date derivation.
        logger.warn(`Could not derive target date for manual scrape: ${planError.message}`);
      }
    }

    const result = await scrapeLatestLiveScores({ force: true, ...(dateKey ? { dateKey } : {}) });

    if (!result.scraped) {
      const reasonMessages = {
        "no-live-season": "No active live season — scraping only runs during a live DCI season.",
        "no-recap-found": "No recap link was found on the DCI scores page.",
        "no-events-for-date": `No DCI events (listed or scheduled) for ${result.dateKey || dateKey} ` +
          "yet — scores may not be posted, or the schedule needs a refresh to capture the event URL.",
        "no-new-events": "Every event for this night has already been scraped.",
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
  // A multi-day range fetches many slow JS-rendered recaps; give it headroom.
  timeoutSeconds: 540,
  memory: "512MiB",
  cpu: 1,
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
