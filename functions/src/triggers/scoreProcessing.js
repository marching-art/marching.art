const { onMessagePublished } = require("firebase-functions/v2/pubsub");
const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
const { scrapeDciScoresLogic } = require("../helpers/scraping");
const { scraperApiKey } = require("../helpers/dciFetch");
const { calculateOffSeasonDay } = require("../helpers/season");
const { mergeEventIntoHistoricalScores } = require("../helpers/historicalScores");

const LIVE_SCORES_TOPIC = "live-scores-topic";
const DCI_RECAP_TOPIC = "dci-recap-topic";

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

    await mergeEventIntoHistoricalScores(getDb(), year, newEventData);

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

    await mergeEventIntoHistoricalScores(db, year, newEventData);

    const offSeasonDayMsg = offSeasonDay !== null ? `offSeasonDay: ${offSeasonDay}` : "offSeasonDay: null (pre-season event)";
    logger.info(`Successfully archived live scores to historical_scores/${docId}. ${offSeasonDayMsg}`);
  } catch (error) {
    logger.error("Error processing live score recap:", error);
  }
});

/**
 * Deep-scrape recap worker. Consumes one recap URL per message from
 * dci-recap-topic (fanned out by discoverAndQueueUrls) and scrapes it into the
 * standard dci-scores-topic pipeline, which merges into historical_scores/{year}
 * (appending missing corps and filling only blank/zero captions).
 *
 * maxInstances is capped so a full-history deep scrape doesn't hammer dci.org or
 * stampede the per-year Firestore document with too many concurrent transactions.
 */
exports.processDciRecap = onMessagePublished({
  topic: DCI_RECAP_TOPIC,
  maxInstances: 3,
  timeoutSeconds: 120,
  memory: "512MiB",
  secrets: [scraperApiKey],
}, async (message) => {
  let url;
  try {
    const payload = Buffer.from(message.data.message.data, "base64").toString("utf-8");
    ({ url } = JSON.parse(payload));
  } catch (parseError) {
    logger.error("[RecapWorker] Failed to parse message payload:", parseError);
    return;
  }

  if (!url) {
    logger.warn("[RecapWorker] Received a message with no URL. Skipping.");
    return;
  }

  try {
    // Default topic (dci-scores-topic) -> processDciScores -> historical_scores/{year}.
    await scrapeDciScoresLogic(url);
    logger.info(`[RecapWorker] Processed recap: ${url}`);
  } catch (error) {
    // Swallow so a single bad recap doesn't trigger pubsub redelivery storms.
    // The deep scrape is idempotent and can be re-run to pick up any misses.
    logger.error(`[RecapWorker] Failed to process recap ${url}: ${error.message}`);
  }
});