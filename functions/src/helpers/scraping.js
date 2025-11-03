const { onCall, HttpsError, onRequest } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const { PubSub } = require("@google-cloud/pubsub");
const { CloudTasksClient } = require("@google-cloud/tasks");
const axios = require("axios");
const cheerio = require("cheerio");

// Declare clients in the global scope but do not initialize them.
let pubsubClient;
let tasksClient;

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
      return;
    }

    const payload = { scores: scoresData, eventName, eventLocation, eventDate: eventDate.toISOString(), year };
    const dataBuffer = Buffer.from(JSON.stringify(payload));
    await pubsubClient.topic(topic).publishMessage({ data: dataBuffer });
    logger.info(`Successfully published ${scoresData.length} corps scores from ${eventName}.`);
  } catch (error) {
    logger.error(`[scrapeDciScoresLogic] CRITICAL ERROR for URL ${urlToScrape}:`, error);
  }
}

async function queueRecapUrlForScraping(url) {
  // Lazy initialize the client
  if (!tasksClient) {
    tasksClient = new CloudTasksClient();
  }

  try {
    const project = process.env.GCLOUD_PROJECT;
    const location = "us-central1";
    const queue = "recap-scraper-queue";
    const workerUrl = `https://us-central1-${project}.cloudfunctions.net/scrapeSingleRecap`;
    const queuePath = tasksClient.queuePath(project, location, queue);

    const task = {
      httpRequest: {
        httpMethod: "POST",
        url: workerUrl,
        body: Buffer.from(JSON.stringify({ url })).toString("base64"),
        headers: { "Content-Type": "application/json" },
      },
    };

    await tasksClient.createTask({ parent: queuePath, task: task });
    logger.info(`[Queuer] Successfully queued task for URL: ${url}`);
  } catch (error) {
    logger.error(`[Queuer] Failed to queue task for URL: ${url}`, error);
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

const discoverAndQueueUrls = onCall({ cors: true }, async (request) => {
  if (!request.auth || !request.auth.token.admin) {
    throw new HttpsError("permission-denied", "You must be an admin to perform this action.");
  }
  // Lazy initialize the client
  if (!pubsubClient) {
    pubsubClient = new PubSub();
  }

  logger.info("Kicking off asynchronous discovery process...");

  const dataBuffer = Buffer.from(JSON.stringify({ pageno: 1 }));
  await pubsubClient.topic(PAGINATION_TOPIC).publishMessage({ data: dataBuffer });

  return { success: true, message: "Asynchronous scraper process initiated. See logs for progress." };
});

const scrapeSingleRecap = onRequest({ cors: true }, async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      logger.error("Worker received a task with no URL.");
      res.status(400).send("Bad Request: Missing URL in payload.");
      return;
    }

    await scrapeDciScoresLogic(url);
    res.status(200).send("Successfully processed recap URL.");
  } catch (error) {
    logger.error(`Worker failed to process URL: ${req.body.url}`, error);
    res.status(500).send("Internal Server Error");
  }
});

module.exports = {
  scrapeDciScoresLogic,
  queueRecapUrlForScraping,
  testScraper,
  discoverAndQueueUrls,
  scrapeSingleRecap,
};
