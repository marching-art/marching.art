// Publishes a season-summary (Article 6) generation request.
//
// The nightly 5-article batch is driven by fantasy_recaps day documents, which
// are only written when there are shows to score. On a competition day (15–49)
// with NO events, the scoring processors return early and no recap — and
// therefore no articles — is produced. To give users something to engage with
// on those quiet days, the processors call this helper, which publishes a
// `season_summary` request onto the same news-generation topic the daily batch
// uses. The (slow, image-generating) article build then happens off the
// scoring path in processNewsGeneration.

const { PubSub } = require("@google-cloud/pubsub");
const { logger } = require("firebase-functions/v2");

const NEWS_GENERATION_TOPIC = "news-generation-topic";

// Season-summary window: only days 15–49 (enough season has elapsed to be worth
// summarizing, and 49 is the last competition day).
const SEASON_SUMMARY_MIN_DAY = 15;
const SEASON_SUMMARY_MAX_DAY = 49;

let pubsubClient;

/**
 * Publish a season-summary request for an empty scored day, if the day is in
 * the 15–49 window. Never throws — a publish failure must not disturb scoring.
 *
 * @param {Object} params
 * @param {string} params.seasonId - seasonUid (also the news_hub partition).
 * @param {string} params.dataDocId - dci-data doc id for design/theme lookups.
 * @param {number} params.scoredDay - The empty competition day (1–49).
 * @returns {Promise<boolean>} true if a request was published.
 */
async function publishSeasonSummaryRequest({ seasonId, dataDocId, scoredDay }) {
  if (
    !seasonId ||
    !Number.isFinite(scoredDay) ||
    scoredDay < SEASON_SUMMARY_MIN_DAY ||
    scoredDay > SEASON_SUMMARY_MAX_DAY
  ) {
    return false;
  }

  try {
    if (!pubsubClient) pubsubClient = new PubSub();
    const payload = {
      type: "season_summary",
      data: { seasonId, dataDocId: dataDocId || seasonId, throughDay: scoredDay },
    };
    const dataBuffer = Buffer.from(JSON.stringify(payload));
    await pubsubClient.topic(NEWS_GENERATION_TOPIC).publishMessage({ data: dataBuffer });
    logger.info(`Published season-summary request for empty day ${scoredDay} (season ${seasonId}).`);
    return true;
  } catch (error) {
    logger.error(`Failed to publish season-summary request for day ${scoredDay}:`, error);
    return false;
  }
}

module.exports = {
  publishSeasonSummaryRequest,
  NEWS_GENERATION_TOPIC,
  SEASON_SUMMARY_MIN_DAY,
  SEASON_SUMMARY_MAX_DAY,
};
