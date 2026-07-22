const { onMessagePublished } = require("firebase-functions/v2/pubsub");
const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
const { scrapeDciScoresLogic } = require("../helpers/scraping");
const { scraperApiKey } = require("../helpers/dciFetch");
const { calculateOffSeasonDay } = require("../helpers/season");
const { mergeEventIntoHistoricalScores } = require("../helpers/historicalScores");

const LIVE_SCORES_TOPIC = "live-scores-topic";
const DCI_RECAP_TOPIC = "dci-recap-topic";

exports.processDciScores = onMessagePublished({
  topic: "dci-scores-topic",
  // Redeliver on failure: the merge below is idempotent (additive, fills only
  // blank captions, skips no-op writes), so a retried message can never
  // double-apply. Without this a transient Firestore error acked the message
  // and the scraped scores were silently lost.
  retry: true,
}, async (message) => {
  logger.info("Received new historical scores to process.");

  // Parse/validation failures are terminal — a malformed payload never becomes
  // valid on redelivery, so log and ack instead of retrying a poison message.
  let parsed;
  try {
    const payloadBuffer = Buffer.from(message.data.message.data, "base64").toString("utf-8");
    parsed = JSON.parse(payloadBuffer);
  } catch (parseError) {
    logger.error("Failed to parse historical scores payload; dropping message.", parseError);
    return;
  }
  const { eventName, scores, eventLocation, eventDate, year } = parsed;

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

  try {
    await mergeEventIntoHistoricalScores(getDb(), year, newEventData);
  } catch (error) {
    // Log then rethrow so Pub/Sub redelivers — swallowing here acked and
    // permanently lost the scores on any transient failure.
    logger.error("Error processing and archiving historical scores:", error);
    throw error;
  }

  logger.info(`Successfully processed and archived scores to historical_scores/${docId} with offSeasonDay: ${offSeasonDay}`);
});

exports.processLiveScoreRecap = onMessagePublished({
  topic: LIVE_SCORES_TOPIC,
  // Redeliver on failure — same rationale as processDciScores: the merge is
  // idempotent, and acking a failed message silently lost the night's scores.
  retry: true,
}, async (message) => {
  logger.info("Received new live score recap to process.");
  const db = getDb();

  // Parse/validation failures are terminal — log and ack, don't retry a
  // poison message.
  let parsed;
  try {
    const payloadBuffer = Buffer.from(message.data.message.data, "base64").toString("utf-8");
    parsed = JSON.parse(payloadBuffer);
  } catch (parseError) {
    logger.error("Failed to parse live score recap payload; dropping message.", parseError);
    return;
  }
  const { eventName, scores, eventDate, location, overwrite } = parsed;

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
    // Opt-in from the admin day-range backfill; replaces existing values
    // instead of only filling blanks. Absent on nightly/deep-scrape runs.
    overwrite: overwrite === true,
  };

  try {
    await mergeEventIntoHistoricalScores(db, year, newEventData);
  } catch (error) {
    // Log then rethrow so Pub/Sub redelivers instead of acking a lost recap.
    logger.error("Error processing live score recap:", error);
    throw error;
  }

  const offSeasonDayMsg = offSeasonDay !== null ? `offSeasonDay: ${offSeasonDay}` : "offSeasonDay: null (pre-season event)";
  logger.info(`Successfully archived live scores to historical_scores/${docId}. ${offSeasonDayMsg}`);
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