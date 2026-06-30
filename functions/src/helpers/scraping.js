const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const { PubSub } = require("@google-cloud/pubsub");
const axios = require("axios");
const cheerio = require("cheerio");

// NOTE: Puppeteer/Chromium scraping has been moved to functions-scraper codebase
// to reduce cold start time for all other functions (~800ms-1.2s improvement)
// See: functions-scraper/index.js for scrapeUpcomingDciEvents

// Declare clients in the global scope but do not initialize them.
let pubsubClient;

const PAGINATION_TOPIC = "dci-pagination-topic";

async function scrapeDciScoresLogic(urlToScrape, topic = "dci-scores-topic") {
  // Lazy initialize the client if it hasn't been already
  if (!pubsubClient) {
    pubsubClient = new PubSub();
  }

  logger.info(`[scrapeDciScoresLogic] Starting for URL: ${urlToScrape}`);
  if (!urlToScrape) {
    logger.error("[scrapeDciScoresLogic] Critical error: No URL provided.");
    throw new Error("A URL is required to scrape.");
  }

  try {
    const { data } = await axios.get(urlToScrape);
    const $ = cheerio.load(data);
    const scoresData = [];

    const eventNameSelector = "div[data-widget_type=\"theme-post-title.default\"] h1.elementor-heading-title";
    const eventName = $(eventNameSelector).text().trim() || "Unknown DCI Event";
    const dateLocationDiv = $("div[data-widget_type=\"shortcode.default\"] div.score-date-location");
    const dateText = dateLocationDiv.find("p").eq(0).text().trim();
    const locationText = dateLocationDiv.find("p").eq(1).text().trim();

    let eventDate = new Date();
    let eventLocation = locationText || "Unknown Location";
    let year = new Date().getFullYear();

    if (dateText) {
      const parsedDate = new Date(dateText);
      if (!isNaN(parsedDate.getTime())) {
        eventDate = parsedDate;
        year = eventDate.getFullYear();
      }
    }

    const logMsg = `PARSED DATA --> Name: '${eventName}', Date: '${eventDate.toISOString()}', ` +
      `Location: '${eventLocation}', Year: '${year}'`;
    logger.info(logMsg);

    const headerSelector = "table#effect-table-0 > tbody > tr.table-top";
    const headerRow = $(headerSelector);
    const orderedCaptionTitles = [];
    headerRow.find("td.type").each((_i, el) => {
      orderedCaptionTitles.push($(el).text().trim());
    });

    $("table#effect-table-0 > tbody > tr").not(".table-top").each((i, row) => {
      const corpsName = $(row).find("td.sticky-td").first().text().trim();
      if (!corpsName) return;

      const totalScore = parseFloat($(row).find("td.data-total").last().find("span").first().text().trim());

      const tempScores = {
        "General Effect 1": [], "General Effect 2": [],
        "Visual Proficiency": [], "Visual Analysis": [], "Color Guard": [],
        "Music Brass": [], "Music Analysis": [], "Music Percussion": [],
      };

      const mapCaptionTitleToKey = (title) => {
        const normalized = title.replace(/\s-\s/g, " ").trim();
        return Object.prototype.hasOwnProperty.call(tempScores, normalized) ? normalized : null;
      };

      const scoreTables = $(row).find("table.data");

      scoreTables.each((index, table) => {
        const captionTitle = orderedCaptionTitles[index];
        const mappedTitle = mapCaptionTitleToKey(captionTitle);

        if (mappedTitle) {
          const score = parseFloat($(table).find("td").eq(2).text().trim());
          if (!isNaN(score)) {
            tempScores[mappedTitle].push(score);
          }
        }
      });

      const processCaption = (captionName) => {
        const scores = tempScores[captionName];
        if (!scores || scores.length === 0) return 0;
        if (scores.length === 1) return scores[0];
        const sum = scores.reduce((a, b) => a + b, 0);
        return parseFloat((sum / scores.length).toFixed(3));
      };

      const captions = {
        GE1: processCaption("General Effect 1"),
        GE2: processCaption("General Effect 2"),
        VP: processCaption("Visual Proficiency"),
        VA: processCaption("Visual Analysis"),
        CG: processCaption("Color Guard"),
        B: processCaption("Music Brass"),
        MA: processCaption("Music Analysis"),
        P: processCaption("Music Percussion"),
      };

      const scoreObject = { corps: corpsName, score: totalScore, captions: captions };
      scoresData.push(scoreObject);
    });

    if (scoresData.length === 0) {
      logger.warn(`No scores found on ${urlToScrape}.`);
      return { eventName, eventLocation, eventDate: eventDate.toISOString(), year, count: 0 };
    }

    const payload = { scores: scoresData, eventName, eventLocation, eventDate: eventDate.toISOString(), year };
    const dataBuffer = Buffer.from(JSON.stringify(payload));
    await pubsubClient.topic(topic).publishMessage({ data: dataBuffer });
    logger.info(`Successfully published ${scoresData.length} corps scores from ${eventName}.`);
    return { eventName, eventLocation, eventDate: eventDate.toISOString(), year, count: scoresData.length };
  } catch (error) {
    logger.error(`[scrapeDciScoresLogic] CRITICAL ERROR for URL ${urlToScrape}:`, error);
    throw error;
  }
}

const testScraper = onCall({ cors: true }, async (request) => {
  if (!request.auth || !request.auth.token.admin) {
    throw new HttpsError("permission-denied", "You must be an admin to perform this action.");
  }

  logger.info("Running scraper test...");

  // Test URL - using a known DCI recap page
  const testUrl = "https://www.dci.org/scores/recap/2024-07-13-dci-southwestern-championship-san-antonio-tx";
  
  try {
    await scrapeDciScoresLogic(testUrl, "dci-scores-topic");
    return { success: true, message: "Scraper test completed successfully. Check logs for details." };
  } catch (error) {
    logger.error("Scraper test failed:", error);
    return { success: false, message: `Scraper test failed: ${error.message}` };
  }
});

/**
 * Admin-only "deep scrape": walk every page of dci.org/scores (all events, all
 * years) and archive each recap into historical_scores/{year}.
 *
 * Kicks off an asynchronous, self-chaining pubsub pipeline:
 *   discoverAndQueueUrls -> dci-pagination-topic (processPaginationPage)
 *     -> for each recap found -> dci-recap-topic (processDciRecap)
 *       -> scrapeDciScoresLogic -> dci-scores-topic (processDciScores)
 *         -> merge into historical_scores/{year}
 *
 * processDciScores merges by event (name+date), appending missing corps and
 * filling only blank/zero captions, so re-running is safe and idempotent: it
 * backfills missing scores without overwriting existing values.
 */
const discoverAndQueueUrls = onCall({ cors: true }, async (request) => {
  if (!request.auth || !request.auth.token.admin) {
    throw new HttpsError("permission-denied", "You must be an admin to perform this action.");
  }
  // Lazy initialize the client
  if (!pubsubClient) {
    pubsubClient = new PubSub();
  }

  logger.info(`Admin ${request.auth.uid} kicked off a full DCI history deep scrape.`);

  const dataBuffer = Buffer.from(JSON.stringify({ pageno: 1 }));
  await pubsubClient.topic(PAGINATION_TOPIC).publishMessage({ data: dataBuffer });

  return {
    success: true,
    message: "Deep scrape started. All events across all years on dci.org will be " +
      "discovered and archived in the background (fills missing scores; existing " +
      "values are preserved). This can take a while — watch the function logs for progress.",
  };
});

module.exports = {
  scrapeDciScoresLogic,
  testScraper,
  discoverAndQueueUrls,
};
