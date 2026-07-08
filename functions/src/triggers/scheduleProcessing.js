const { onMessagePublished } = require("firebase-functions/v2/pubsub");
const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
const { fetchEventForArchive } = require("../helpers/eventDetails");
const { archiveScheduleEvents } = require("../helpers/historicalSchedules");

const DCI_EVENT_TOPIC = "dci-event-topic";

/**
 * Deep-scrape schedule worker. Consumes one event detail URL per message from
 * dci-event-topic (fanned out by discoverAndQueueEventUrls), fetches + parses the
 * running order + performance times, and merges it into historical_schedules/{year}
 * (appending missing events/lineup entries and filling only blank timing fields).
 *
 * The schedule analog of processDciRecap. maxInstances is capped so a full-history
 * deep scrape doesn't hammer dci.org or stampede the per-year Firestore document.
 */
exports.processDciEvent = onMessagePublished({
  topic: DCI_EVENT_TOPIC,
  maxInstances: 3,
  timeoutSeconds: 120,
  memory: "512MiB",
}, async (message) => {
  let url;
  try {
    const payload = Buffer.from(message.data.message.data, "base64").toString("utf-8");
    ({ url } = JSON.parse(payload));
  } catch (parseError) {
    logger.error("[EventWorker] Failed to parse message payload:", parseError);
    return;
  }

  if (!url) {
    logger.warn("[EventWorker] Received a message with no URL. Skipping.");
    return;
  }

  try {
    const event = await fetchEventForArchive(url);
    if (!event) {
      // No posted schedule (or a page whose markup drifted). Not an error — the
      // deep scrape is idempotent and can be re-run to pick up a later posting.
      logger.info(`[EventWorker] No lineup/timing to archive for ${url}.`);
      return;
    }
    const { archived } = await archiveScheduleEvents(getDb(), [event]);
    logger.info(
      `[EventWorker] ${archived ? "Archived" : "Skipped"} schedule for "${event.eventName}" ` +
      `(${event.lineup?.length ?? 0} corps): ${url}`
    );
  } catch (error) {
    // Swallow so a single bad event doesn't trigger pubsub redelivery storms.
    logger.error(`[EventWorker] Failed to process event ${url}: ${error.message}`);
  }
});
