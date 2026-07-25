/**
 * Discord webhook plumbing, shared by every channel we post to.
 *
 * One webhook per channel, one secret per webhook — so any channel can be
 * rotated, or silenced by setting its secret empty, without touching the
 * others. An unset/empty secret disables that channel's posts entirely;
 * nothing in the game ever depends on Discord being reachable.
 *
 *   scores        DISCORD_SCORES_WEBHOOK_URL         nightly score drop,
 *                                                    all-time records,
 *                                                    season champions
 *   announcements DISCORD_ANNOUNCEMENTS_WEBHOOK_URL  Fan Favorite ballots,
 *                                                    season start,
 *                                                    lineup lock
 *   news          DISCORD_NEWS_WEBHOOK_URL           published articles,
 *                                                    the Podium Report
 *   events        DISCORD_EVENTS_WEBHOOK_URL         DIRECTOR-HOSTED shows
 *                                                    only (never the
 *                                                    generated schedule)
 *   ops           DISCORD_OPS_WEBHOOK_URL            admin-only alerts
 *
 * Every post carries `allowed_mentions: {parse: []}`. Corps names, event
 * names and director names are user-authored and flow straight into this
 * copy, so this is the guarantee that nobody can name a corps `@everyone`
 * and ping the server from inside the game. A post that SHOULD ping (a role
 * on finals night) opts in explicitly by passing its own allowed_mentions.
 */

const { logger } = require("firebase-functions/v2");
const { defineSecret } = require("firebase-functions/params");
const {
  claimScoringRun,
  markScoringRunCompleted,
  markScoringRunFailed,
} = require("./scoringRunGuard");

// Webhook URLs are post-capabilities — anyone holding one can post to the
// channel — so they live in Secret Manager, never in the world-readable
// game-settings docs.
const discordScoresWebhookUrl = defineSecret("DISCORD_SCORES_WEBHOOK_URL");
const discordAnnouncementsWebhookUrl = defineSecret("DISCORD_ANNOUNCEMENTS_WEBHOOK_URL");
const discordNewsWebhookUrl = defineSecret("DISCORD_NEWS_WEBHOOK_URL");
const discordEventsWebhookUrl = defineSecret("DISCORD_EVENTS_WEBHOOK_URL");
const discordOpsWebhookUrl = defineSecret("DISCORD_OPS_WEBHOOK_URL");

const WEBHOOK_USERNAME = "marching.art";
const SITE_URL = "https://marching.art";

// Attribution on announcement deep links: the client reads `src` on arrival
// (useScoreDropReturn) so we can tell a Discord return from an organic visit.
const SRC_PARAM = "src";
const SRC_DISCORD = "discord";

/** Site URL tagged for return attribution: link("/scores"). */
function link(path) {
  return `${SITE_URL}${path}${path.includes("?") ? "&" : "?"}${SRC_PARAM}=${SRC_DISCORD}`;
}

// Embed accents, one per kind of moment.
const COLORS = {
  scores: 0xd4af37, // gold — the nightly drop
  record: 0xff4d4f, // red — an all-time mark just fell
  champion: 0x9b59b6, // purple — season champions
  fan: 0xec4899, // pink — the Fan Favorite ballot
  season: 0x2f9e44, // green — a season opens
  event: 0x1c7ed6, // blue — a director-hosted show
  news: 0x868e96, // grey — editorial
  ops: 0xe8590c, // orange — something needs a human
};

const MEDALS = ["🥇", "🥈", "🥉"];

// Discord embed limits we design against.
const FIELD_VALUE_MAX = 1024;

/** Keep user-authored names from blowing up embed/push copy. */
function clampName(name, max = 60) {
  const text = String(name || "").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * Join lines into an embed field value, dropping the tail (with a count)
 * when a long list would blow Discord's 1024-character field limit.
 */
function joinLines(lines) {
  const kept = [];
  let length = 0;
  for (const line of lines) {
    const cost = line.length + 1;
    // Leave room for the "…and N more" tail before committing the last line.
    if (length + cost > FIELD_VALUE_MAX - 20 && kept.length < lines.length) break;
    kept.push(line);
    length += cost;
  }
  const dropped = lines.length - kept.length;
  if (dropped > 0) kept.push(`…and ${dropped} more`);
  return kept.join("\n");
}

/** 🥇🥈🥉 for the podium, a neutral marker below it. */
function place(index) {
  return MEDALS[index] || "▫️";
}

/** Wrap embeds into a webhook payload with the house username + no pings. */
function payloadOf(...embeds) {
  return {
    username: WEBHOOK_USERNAME,
    allowed_mentions: { parse: [] },
    embeds: embeds.filter(Boolean),
  };
}

/**
 * POST a payload to a Discord webhook. Throws on any non-2xx response so the
 * caller can mark its lease failed (Discord returns 204 on success).
 *
 * @param {string} webhookUrl
 * @param {Object} payload
 * @param {typeof fetch} [fetchImpl] - Injectable for tests.
 */
async function postToDiscordWebhook(webhookUrl, payload, fetchImpl = fetch) {
  const response = await fetchImpl(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // Default to silence: an explicit allowed_mentions on the payload wins.
    body: JSON.stringify({ allowed_mentions: { parse: [] }, ...payload }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Discord webhook responded ${response.status}: ${body.slice(0, 200)}`);
  }
}

/**
 * Post something at most once, ever, per (lease key, lease day).
 *
 * The nightly stages re-run every night — that is how they notice a state
 * change — so every announcement they can emit is guarded by a scoringRunGuard
 * lease. Never throws: a Discord outage marks the lease failed and is logged
 * under a stable tag, so the next run re-claims and re-posts.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {Object} params
 * @param {string} params.kind - Announcement name, for logs and the result.
 * @param {string} params.tag - Log tag, e.g. "fan-favorite".
 * @param {string} params.leaseKey - `${seasonUid}_something`.
 * @param {number} params.leaseDay
 * @param {Object} params.payload
 * @param {string} params.webhookUrl
 * @param {typeof fetch} [params.fetchImpl]
 * @returns {Promise<{kind: string, status: string, [k: string]: unknown}>}
 */
async function postOnce(db, { kind, tag, leaseKey, leaseDay, payload, webhookUrl, fetchImpl }) {
  const lease = await claimScoringRun(db, leaseKey, leaseDay);
  if (!lease.claimed) return { kind, status: "skipped", reason: lease.reason };
  try {
    await postToDiscordWebhook(webhookUrl, payload, fetchImpl);
    await markScoringRunCompleted(db, leaseKey, leaseDay, { posted: true, kind });
    logger.info(`[${tag}] announced ${kind} to Discord.`);
    return { kind, status: "posted" };
  } catch (error) {
    await markScoringRunFailed(db, leaseKey, leaseDay, error);
    logger.error(`[${tag}] ${kind} announcement failed (will retry): ${error.message}`);
    return { kind, status: "failed", error: error.message };
  }
}

module.exports = {
  discordScoresWebhookUrl,
  discordAnnouncementsWebhookUrl,
  discordNewsWebhookUrl,
  discordEventsWebhookUrl,
  discordOpsWebhookUrl,
  WEBHOOK_USERNAME,
  SITE_URL,
  SRC_PARAM,
  SRC_DISCORD,
  COLORS,
  MEDALS,
  FIELD_VALUE_MAX,
  link,
  clampName,
  joinLines,
  place,
  payloadOf,
  postToDiscordWebhook,
  postOnce,
};
