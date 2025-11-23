const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions/v2");
const { getDb, dataNamespaceParam } = require("../config");
const axios = require("axios");
const cheerio = require("cheerio");
const { scrapeDciScoresLogic } = require("../helpers/scraping");

const LIVE_SCORES_TOPIC = "live-scores-topic";

exports.scrapeDciScores = onSchedule({
  schedule: "every day 23:30",
  timeZone: "America/New_York",
}, async () => {
  logger.info("Running live score scraper...");
  const db = getDb();
  const seasonDoc = await db.doc("game-settings/season").get();

  if (!seasonDoc.exists || seasonDoc.data().status !== "live-season") {
    logger.info("No active live season. Scraper will not run.");
    return;
  }

  try {
    const urlToScrape = "https://www.dci.org/scores?pageno=1";
    const { data } = await axios.get(urlToScrape);
    const $ = cheerio.load(data);
    const recapLinkSelector = "a.arrow-btn[href*=\"/scores/recap/\"]";
    const latestRecapLink = $(recapLinkSelector).first().attr("href");

    if (latestRecapLink) {
      const fullUrl = new URL(latestRecapLink, "https://www.dci.org").href;
      await scrapeDciScoresLogic(fullUrl, LIVE_SCORES_TOPIC);
    } else {
      logger.info("No new recap links found on scores page 1.");
    }
  } catch (error) {
    logger.error("Error during live score scraping:", error);
  }
});
