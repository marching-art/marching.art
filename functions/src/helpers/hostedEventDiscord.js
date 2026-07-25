/**
 * Director-hosted shows → the #events channel.
 *
 * A hosted event is open-enrollment (PODIUM.md §5.10, decision 27): the host
 * rents a venue, the show lands on the season schedule, and any corps can
 * select it through the normal weekly picker. The host's payout scales with
 * how many distinct directors actually show up — so the difference between a
 * profitable booking and a wasted rental is entirely whether anyone HEARS
 * about it. That is exactly what a channel post is for.
 *
 * SCOPE: this channel is for DIRECTOR-CREATED events only. The season's
 * generated schedule (helpers/seasonSchedule.js, the seasonScheduler job)
 * must never post here — it is dozens of shows nobody chose, and it would
 * bury the one show a player is trying to fill. Only callable/podiumHost.js
 * calls this.
 *
 * Best-effort and fire-and-forget: the event is already created and on the
 * schedule by the time this runs. A Discord failure is logged and swallowed —
 * it must never fail a callable the director paid CorpsCoin for.
 */

const { logger } = require("firebase-functions/v2");
const { COLORS, clampName, link, payloadOf, postToDiscordWebhook } = require("./discord");

/**
 * Build the "a director is hosting a show" post.
 *
 * @param {Object} params
 * @param {string} params.eventName
 * @param {string} params.hostName - Director's username.
 * @param {string} params.location - "City, ST".
 * @param {string} params.venueLabel - Venue tier label, e.g. "College Bowl".
 * @param {number} params.day - Competition day the show runs.
 * @param {number} [params.capacity] - Venue capacity (attendance cap).
 * @param {string} [params.seasonName]
 * @returns {Object} Webhook payload.
 */
function buildHostedEventPayload({
  eventName,
  hostName,
  location,
  venueLabel,
  day,
  capacity,
  seasonName,
}) {
  const host = hostName ? clampName(hostName, 30) : "A director";
  return payloadOf({
    title: `🎪 ${clampName(eventName, 100)}`,
    url: link("/schedule"),
    description:
      `**${host}** is hosting a show on **Day ${day}**${location ? ` in ${clampName(location, 60)}` : ""}. ` +
      "Open enrollment — pick it in your weekly show selector and go compete. " +
      "Every corps that shows up pays the house.",
    color: COLORS.event,
    fields: [
      { name: "Venue", value: venueLabel || "—", inline: true },
      { name: "Day", value: `Day ${day}`, inline: true },
      ...(capacity ? [{ name: "Capacity", value: `${capacity} corps`, inline: true }] : []),
    ],
    footer: { text: seasonName ? `${seasonName} · sign up on the Schedule page` : "Sign up on the Schedule page" },
  });
}

/**
 * Announce a newly created hosted event. Never throws.
 *
 * @param {string} webhookUrl - Falsy disables (secret unset/empty).
 * @param {Object} event - See buildHostedEventPayload.
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<{status: string, error?: string}>}
 */
async function announceHostedEvent(webhookUrl, event, fetchImpl) {
  if (!webhookUrl) return { status: "disabled" };
  try {
    await postToDiscordWebhook(webhookUrl, buildHostedEventPayload(event), fetchImpl);
    logger.info(`[hosted-events] announced "${event.eventName}" to Discord.`);
    return { status: "posted" };
  } catch (error) {
    logger.warn(`[hosted-events] Discord announcement failed: ${error.message}`);
    return { status: "failed", error: error.message };
  }
}

module.exports = { buildHostedEventPayload, announceHostedEvent };
