/**
 * New supporters → the #announcements channel.
 *
 * Buy Me a Coffee's own Discord bot only grants roles — it never posts, and
 * because it talks to Discord over REST it shows as offline. So the only
 * "someone just supported the game" signal the server ever sees is this one,
 * posted through the marching.art announcements webhook.
 *
 * Who gets named: a supporter is named only once they have linked their
 * support to a marching.art account (so we have a username, not a PayPal
 * email) and have not opted out of the public wall. Until then a recurring
 * supporter is silent — a named post follows the moment they link — while a
 * one-time coffee is announced anonymously, because one-time donors rarely
 * bother to link and the thank-you is the whole point.
 *
 * When: on a tier GAIN only (new supporter, upgrade, or a return after a
 * lapse). A monthly renewal re-sends `membership.updated` at the same tier
 * and must stay silent, as must cancellations and the nightly reconcile.
 *
 * Best-effort: never throws, never fails the webhook or the link callable.
 */

const { logger } = require("firebase-functions/v2");
const { COLORS, clampName, link, payloadOf, postToDiscordWebhook } = require("./discord");
const { SUPPORTER_TIERS, TIER_RANK } = require("./bmacSupporters");

const BMAC_PAGE_URL = "https://buymeacoffee.com/marching.art";

/** Display names for every effective tier, including the one-time 'friend'. */
const TIER_NAMES = Object.freeze({
  friend: "Friend",
  ...Object.fromEntries(SUPPORTER_TIERS.map((t) => [t.id, t.name])),
});

/**
 * Comparable rank of an effective tier: none < friend < rookie < … < corps angel.
 * @param {string|null|undefined} tier
 * @returns {number}
 */
function tierRank(tier) {
  if (!tier) return -1;
  if (tier === "friend") return 0;
  const rank = TIER_RANK[tier];
  return rank == null ? -1 : rank + 1;
}

/**
 * A post is warranted only when the effective tier rose.
 * @param {string|null|undefined} prevTier
 * @param {string|null|undefined} tier
 */
function shouldAnnounceTierChange(prevTier, tier) {
  return tierRank(tier) > tierRank(prevTier);
}

/**
 * Build the shout-out embed.
 *
 * @param {Object} params
 * @param {string} params.tier - Effective tier id (friend | rookie | … | corps_angel).
 * @param {string|null} [params.prevTier] - Tier before this change (upgrade copy).
 * @param {string|null} [params.name] - Username to credit; omitted → anonymous.
 * @returns {Object} Webhook payload.
 */
function buildSupporterPayload({ tier, prevTier = null, name = null }) {
  const tierName = TIER_NAMES[tier] || "Supporter";
  const who = name ? `**${clampName(name, 30)}**` : "A director";
  const upgraded = tierRank(prevTier) > 0 && tierRank(tier) > tierRank(prevTier);

  if (tier === "friend") {
    return payloadOf({
      title: `☕ ${name ? clampName(name, 30) : "Someone"} just bought the game a coffee`,
      url: link("/supporters"),
      description:
        `${who} chipped in a one-time coffee. It keeps the servers scoring every night — thank you.`,
      color: COLORS.supporter,
      footer: { text: "Donation-only, no pay-to-win · buymeacoffee.com/marching.art" },
    });
  }

  return payloadOf({
    title: upgraded
      ? `🎉 ${name ? clampName(name, 30) : "A director"} moved up to ${tierName} supporter`
      : `🎉 ${name ? clampName(name, 30) : "A director"} joined as a ${tierName} supporter`,
    url: link("/supporters"),
    description:
      `${who} now backs marching.art monthly as a **${tierName}**. ` +
      "That's profile flair and a spot on the Supporters wall — cosmetic only, never a competitive edge.",
    color: COLORS.supporter,
    fields: [
      { name: "Tier", value: tierName, inline: true },
      { name: "Join them", value: `[Buy the game a coffee](${BMAC_PAGE_URL})`, inline: true },
    ],
    footer: { text: "Donation-only, no pay-to-win · marching.art/supporters" },
  });
}

/**
 * Post a supporter shout-out. Never throws.
 *
 * @param {string} webhookUrl - Falsy disables (secret unset/empty).
 * @param {Parameters<typeof buildSupporterPayload>[0]} params
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<{status: string, error?: string}>}
 */
async function announceSupporter(webhookUrl, params, fetchImpl) {
  if (!webhookUrl) return { status: "disabled" };
  try {
    await postToDiscordWebhook(webhookUrl, buildSupporterPayload(params), fetchImpl);
    logger.info(`[supporters] announced a ${params.tier} supporter to Discord.`);
    return { status: "posted" };
  } catch (error) {
    logger.warn(`[supporters] Discord announcement failed: ${error.message}`);
    return { status: "failed", error: error.message };
  }
}

module.exports = {
  TIER_NAMES,
  tierRank,
  shouldAnnounceTierChange,
  buildSupporterPayload,
  announceSupporter,
};
