const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions/v2");
const { getDb, dataNamespaceParam } = require("../config");
const axios = require("axios");
const cheerio = require("cheerio");
const { scrapeDciScoresLogic } = require("../helpers/scraping");

const LIVE_SCORES_TOPIC = "live-scores-topic";

/**
 * Fetch with retry logic and exponential backoff
 * @param {string} url - URL to fetch
 * @param {number} maxRetries - Maximum number of retry attempts
 * @returns {Promise<object>} - Axios response data
 */
async function fetchWithRetry(url, maxRetries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.get(url, {
        timeout: 30000, // 30 second timeout
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; MarchingArtBot/1.0)",
        },
      });
      return response.data;
    } catch (error) {
      lastError = error;
      const isRetryable =
        error.code === "ECONNRESET" ||
        error.code === "ETIMEDOUT" ||
        error.code === "ENOTFOUND" ||
        error.response?.status >= 500;

      if (!isRetryable || attempt === maxRetries) {
        logger.error(`Fetch failed after ${attempt} attempts: ${error.message}`);
        throw error;
      }

      // Exponential backoff: 2s, 4s, 8s
      const backoffMs = Math.pow(2, attempt) * 1000;
      logger.warn(`Fetch attempt ${attempt} failed, retrying in ${backoffMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }

  throw lastError;
}

/**
 * Core live-score scrape routine, shared by the nightly scheduler and the
 * admin "Scrape DCI Scores Now" button.
 *
 * Fetches the first page of dci.org/scores, locates the most recent recap link,
 * scrapes it, and publishes the parsed scores to the live-scores pubsub topic
 * (which `processLiveScoreRecap` archives into historical_scores/{year}).
 *
 * @param {object} [options]
 * @param {boolean} [options.force=false] - When true, bypass the "already
 *   scraped today" guard so an admin can re-run the scrape on demand.
 * @returns {Promise<object>} Result summary for surfacing in the admin UI.
 */
async function scrapeLatestLiveScores({ force = false } = {}) {
  const db = getDb();
  const seasonDoc = await db.doc("game-settings/season").get();

  // Skip if not in live season
  if (!seasonDoc.exists || seasonDoc.data().status !== "live-season") {
    logger.info("Scraper skipped: No active live season.");
    return { scraped: false, reason: "no-live-season" };
  }

  const seasonData = seasonDoc.data();
  logger.info(`Running live score scraper for season: ${seasonData.name} (force=${force})`);

  // Check if we've already scraped today to avoid duplicate processing.
  // A forced (manual) run bypasses this guard.
  const today = new Date().toISOString().split("T")[0];
  const lastScrapedDate = seasonData.lastScrapedDate;
  if (!force && lastScrapedDate === today) {
    logger.info(`Scraper skipped: Already scraped today (${today}).`);
    return { scraped: false, reason: "already-scraped-today", lastScrapedDate };
  }

  const urlToScrape = "https://www.dci.org/scores?pageno=1";
  const data = await fetchWithRetry(urlToScrape);
  const $ = cheerio.load(data);
  const recapLinkSelector = "a.arrow-btn[href*=\"/scores/recap/\"]";
  const latestRecapLink = $(recapLinkSelector).first().attr("href");

  if (!latestRecapLink) {
    logger.info("No new recap links found on scores page 1.");
    return { scraped: false, reason: "no-recap-found" };
  }

  const fullUrl = new URL(latestRecapLink, "https://www.dci.org").href;
  const summary = await scrapeDciScoresLogic(fullUrl, LIVE_SCORES_TOPIC);

  // Update last scraped date on success
  await db.doc("game-settings/season").update({
    lastScrapedDate: today,
  });
  logger.info(`Scraping completed successfully for ${today}.`);

  return {
    scraped: true,
    recapUrl: fullUrl,
    eventName: summary?.eventName || null,
    eventDate: summary?.eventDate || null,
    eventLocation: summary?.eventLocation || null,
    count: summary?.count ?? 0,
    scrapedDate: today,
  };
}

exports.scrapeLatestLiveScores = scrapeLatestLiveScores;

exports.scrapeDciScores = onSchedule({
  schedule: "every day 01:30",
  timeZone: "America/New_York",
}, async () => {
  try {
    await scrapeLatestLiveScores({ force: false });
  } catch (error) {
    logger.error("Error during live score scraping:", {
      message: error.message,
      code: error.code,
      status: error.response?.status,
    });
    // Don't throw - let the function complete so it doesn't retry automatically
    // The next scheduled run will try again
  }
});
