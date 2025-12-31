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

exports.scrapeDciScores = onSchedule({
  schedule: "every day 01:30",
  timeZone: "America/New_York",
}, async () => {
  const db = getDb();
  const seasonDoc = await db.doc("game-settings/season").get();

  // Skip if not in live season
  if (!seasonDoc.exists || seasonDoc.data().status !== "live-season") {
    logger.info("Scraper skipped: No active live season.");
    return;
  }

  const seasonData = seasonDoc.data();
  logger.info(`Running live score scraper for season: ${seasonData.name}`);

  // Check if we've already scraped today to avoid duplicate processing
  const today = new Date().toISOString().split("T")[0];
  const lastScrapedDate = seasonData.lastScrapedDate;
  if (lastScrapedDate === today) {
    logger.info(`Scraper skipped: Already scraped today (${today}).`);
    return;
  }

  try {
    const urlToScrape = "https://www.dci.org/scores?pageno=1";
    const data = await fetchWithRetry(urlToScrape);
    const $ = cheerio.load(data);
    const recapLinkSelector = "a.arrow-btn[href*=\"/scores/recap/\"]";
    const latestRecapLink = $(recapLinkSelector).first().attr("href");

    if (latestRecapLink) {
      const fullUrl = new URL(latestRecapLink, "https://www.dci.org").href;
      await scrapeDciScoresLogic(fullUrl, LIVE_SCORES_TOPIC);

      // Update last scraped date on success
      await db.doc("game-settings/season").update({
        lastScrapedDate: today,
      });
      logger.info(`Scraping completed successfully for ${today}.`);
    } else {
      logger.info("No new recap links found on scores page 1.");
    }
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
