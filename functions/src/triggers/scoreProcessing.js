const { onMessagePublished } = require("firebase-functions/v2/pubsub");
const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
const { queueRecapUrlForScraping } = require("../helpers/scraping");
const axios = require("axios");
const cheerio = require("cheerio");
const { PubSub } = require("@google-cloud/pubsub");
const { calculateOffSeasonDay } = require("../helpers/season");

// Lazy-loaded heavy dependencies (puppeteer ~200MB, chromium ~100MB)
// Only load when actually needed to reduce cold start time by 800ms-1.2s
let puppeteer = null;
let chromium = null;

function getPuppeteerAndChromium() {
  if (!puppeteer) {
    puppeteer = require("puppeteer-core");
    chromium = require("@sparticuz/chromium");
  }
  return { puppeteer, chromium };
}

let pubsubClient; // Declare globally, initialize lazily

const PAGINATION_TOPIC = "dci-pagination-topic";
const LIVE_SCORES_TOPIC = "live-scores-topic";

exports.processDciScores = onMessagePublished("dci-scores-topic", async (message) => {
  logger.info("Received new historical scores to process.");
  try {
    const payloadBuffer = Buffer.from(message.data.message.data, "base64").toString("utf-8");
    const { eventName, scores, eventLocation, eventDate, year } = JSON.parse(payloadBuffer);

    if (!scores || scores.length === 0 || !year) {
      logger.warn("Payload was missing scores or year. Exiting function.", { eventName, year });
      return;
    }

    const docId = year.toString();
    const yearDocRef = getDb().collection("historical_scores").doc(docId); // This will now work

    const parsedEventDate = new Date(eventDate);
    const offSeasonDay = calculateOffSeasonDay(parsedEventDate, year);

    const newEventData = {
      eventName: eventName,
      date: eventDate,
      location: eventLocation,
      scores: scores,
      headerMap: {},
      offSeasonDay: offSeasonDay,
    };

    await getDb().runTransaction(async (transaction) => { // This will now work
      const yearDoc = await transaction.get(yearDocRef);

      if (!yearDoc.exists) {
        logger.info(`Creating new document for year ${year}.`);
        transaction.set(yearDocRef, { data: [newEventData] });
      } else {
        let existingData = yearDoc.data().data || [];
        const eventIndex = existingData.findIndex((event) =>
          event.eventName === newEventData.eventName &&
          new Date(event.date).getTime() === new Date(newEventData.date).getTime()
        );

        if (eventIndex > -1) {
          logger.info(`Event "${newEventData.eventName}" already exists. Checking for missing scores to merge.`);
          let eventToUpdate = existingData[eventIndex];
          let hasBeenUpdated = false;

          for (const newScore of newEventData.scores) {
            const existingScoreIndex = eventToUpdate.scores.findIndex((s) => s.corps === newScore.corps);

            if (existingScoreIndex === -1) {
              eventToUpdate.scores.push(newScore);
              hasBeenUpdated = true;
              logger.info(`Adding missing corps entry for ${newScore.corps}.`);
            } else {
              let existingScore = eventToUpdate.scores[existingScoreIndex];
              let captionsUpdated = false;
              for (const caption in newScore.captions) {
                if (newScore.captions[caption] > 0 &&
                  (!existingScore.captions[caption] || existingScore.captions[caption] === 0)) {
                  existingScore.captions[caption] = newScore.captions[caption];
                  captionsUpdated = true;
                }
              }
              if (captionsUpdated) {
                hasBeenUpdated = true;
                logger.info(`Updated captions for ${newScore.corps}.`);
              }
            }
          }

          if (hasBeenUpdated) {
            existingData[eventIndex] = eventToUpdate;
            transaction.update(yearDocRef, { data: existingData });
            logger.info(`Successfully merged new scores into event: ${newEventData.eventName}`);
          } else {
            logger.info(`No new scores to merge for event: ${newEventData.eventName}. Skipping.`);
          }
        } else {
          const updatedData = [...existingData, newEventData];
          logger.info(`Appending new event to document for year ${year}. Total events: ${updatedData.length}`);
          transaction.update(yearDocRef, { data: updatedData });
        }
      }
    });

    logger.info(`Successfully processed and archived scores to historical_scores/${docId} with offSeasonDay: ${offSeasonDay}`);
  } catch (error) {
    logger.error("Error processing and archiving historical scores:", error);
  }
});

exports.processLiveScoreRecap = onMessagePublished(LIVE_SCORES_TOPIC, async (message) => {
  logger.info("Received new live score recap to process.");
  const db = getDb();

  try {
    const payloadBuffer = Buffer.from(message.data.message.data, "base64").toString("utf-8");
    const { eventName, scores, eventDate, location } = JSON.parse(payloadBuffer);

    // Validate required data
    if (!scores || scores.length === 0 || !eventDate) {
      logger.warn("Payload was missing scores or eventDate. Exiting function.", { eventName, eventDate });
      return;
    }

    const parsedEventDate = new Date(eventDate);
    const year = parsedEventDate.getFullYear();
    const docId = year.toString();
    const yearDocRef = db.collection("historical_scores").doc(docId);

    // Calculate offSeasonDay using the same logic as historical scores
    // Returns null if event is outside the 49-day competition window (e.g., spring training)
    const offSeasonDay = calculateOffSeasonDay(parsedEventDate, year);

    const newEventData = {
      eventName: eventName,
      date: eventDate,
      location: location || "Unknown Location",
      scores: scores,
      headerMap: {},
      offSeasonDay: offSeasonDay,
    };

    // Use the same transaction pattern as processDciScores for consistency
    await db.runTransaction(async (transaction) => {
      const yearDoc = await transaction.get(yearDocRef);

      if (!yearDoc.exists) {
        logger.info(`Creating new historical_scores document for year ${year}.`);
        transaction.set(yearDocRef, { data: [newEventData] });
      } else {
        let existingData = yearDoc.data().data || [];
        const eventIndex = existingData.findIndex((event) =>
          event.eventName === newEventData.eventName &&
          new Date(event.date).getTime() === new Date(newEventData.date).getTime()
        );

        if (eventIndex > -1) {
          logger.info(`Event "${newEventData.eventName}" already exists. Checking for missing scores to merge.`);
          let eventToUpdate = existingData[eventIndex];
          let hasBeenUpdated = false;

          for (const newScore of newEventData.scores) {
            const existingScoreIndex = eventToUpdate.scores.findIndex((s) => s.corps === newScore.corps);

            if (existingScoreIndex === -1) {
              eventToUpdate.scores.push(newScore);
              hasBeenUpdated = true;
              logger.info(`Adding missing corps entry for ${newScore.corps}.`);
            } else {
              let existingScore = eventToUpdate.scores[existingScoreIndex];
              let captionsUpdated = false;
              for (const caption in newScore.captions) {
                if (newScore.captions[caption] > 0 &&
                  (!existingScore.captions[caption] || existingScore.captions[caption] === 0)) {
                  existingScore.captions[caption] = newScore.captions[caption];
                  captionsUpdated = true;
                }
              }
              if (captionsUpdated) {
                hasBeenUpdated = true;
                logger.info(`Updated captions for ${newScore.corps}.`);
              }
            }
          }

          if (hasBeenUpdated) {
            existingData[eventIndex] = eventToUpdate;
            transaction.update(yearDocRef, { data: existingData });
            logger.info(`Successfully merged new scores into event: ${newEventData.eventName}`);
          } else {
            logger.info(`No new scores to merge for event: ${newEventData.eventName}. Skipping.`);
          }
        } else {
          const updatedData = [...existingData, newEventData];
          logger.info(`Appending new event to historical_scores/${year}. Total events: ${updatedData.length}`);
          transaction.update(yearDocRef, { data: updatedData });
        }
      }
    });

    const offSeasonDayMsg = offSeasonDay !== null ? `offSeasonDay: ${offSeasonDay}` : "offSeasonDay: null (pre-season event)";
    logger.info(`Successfully archived live scores to historical_scores/${docId}. ${offSeasonDayMsg}`);
  } catch (error) {
    logger.error("Error processing live score recap:", error);
  }
});

exports.processPaginationPage = onMessagePublished({
  topic: PAGINATION_TOPIC,
  memory: "2GiB",
  timeoutSeconds: 540,
}, async (message) => {
  // Lazy initialize the client
  if (!pubsubClient) {
    pubsubClient = new PubSub();
  }

  // Lazy load puppeteer and chromium only when this function is called
  const { puppeteer: pptr, chromium: chr } = getPuppeteerAndChromium();

  const payloadBuffer = Buffer.from(message.data.message.data, "base64").toString("utf-8");
  const { pageno } = JSON.parse(payloadBuffer);
  const baseUrl = "https://www.dci.org";
  const currentUrl = `${baseUrl}/scores?pageno=${pageno}`;
  logger.info(`[Paginator] Processing page: ${currentUrl}`);

  let browser = null;
  try {
    browser = await pptr.launch({
      args: chr.args,
      defaultViewport: chr.defaultViewport,
      executablePath: await chr.executablePath(),
      headless: chr.headless,
      ignoreHTTPSErrors: true,
    });
    const page = await browser.newPage();
    await page.goto(currentUrl, { waitUntil: "domcontentloaded", timeout: 60000 });

    const finalScoresSelector = "a.arrow-btn[href*=\"/scores/final-scores/\"]";
    const linksOnPage = await page.$$eval(finalScoresSelector, (anchors) => anchors.map((a) => a.href));

    if (linksOnPage.length === 0) {
      logger.info(`[Paginator] Found no more 'final-scores' links on pageno=${pageno}. Ending discovery chain.`);
      return;
    }

    logger.info(`[Paginator] Found ${linksOnPage.length} 'final-scores' links. Queueing them for recap search.`);

    for (const finalScoresUrl of linksOnPage) {
      try {
        const { data } = await axios.get(finalScoresUrl, { timeout: 15000 });
        const $ = cheerio.load(data);

        $("a.arrow-btn[href*=\"/scores/recap/\"]").each((_idx, el) => {
          const recapLink = $(el).attr("href");
          if (recapLink) {
            const fullUrl = new URL(recapLink, baseUrl).href;
            queueRecapUrlForScraping(fullUrl);
          }
        });
      } catch (error) {
        logger.warn(`[Paginator] Could not process ${finalScoresUrl}. Skipping. Message: ${error.message}`);
      }
    }
    
    const nextDataBuffer = Buffer.from(JSON.stringify({ pageno: pageno + 1 }));
    await pubsubClient.topic(PAGINATION_TOPIC).publishMessage({ data: nextDataBuffer });
  } catch (error) {
    logger.error(`[Paginator] Failed to process page ${pageno}:`, error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});