/**
 * Ops alerts → the admin-only #operations channel.
 *
 * The scoring watchdog and the scrape canary already detect the incidents
 * that matter (a night that never scored, a stale lease, dci.org markup
 * drift). Until now they reported via a stably-tagged logger.error plus an
 * admin email — fine for an audit trail, slow as a page. A webhook post puts
 * the same alert on a phone in seconds.
 *
 * This is ADDITIVE: the log line and the email still go out. Discord is the
 * fast path, never the only path — an alerting channel that can itself be
 * down must not be the only place an incident is reported.
 *
 * The channel is admin-only, so alerts carry operational detail (lease keys,
 * error text, run ids) that never belongs in a player-facing channel.
 *
 * Unlike the announcement posts, ops alerts are NOT lease-guarded: a problem
 * that persists across runs should keep being reported. The callers already
 * fire at most once per scheduled run.
 */

const { logger } = require("firebase-functions/v2");
const { COLORS, SITE_URL, payloadOf, clampName, joinLines, postToDiscordWebhook } = require("./discord");

const SEVERITIES = {
  critical: { emoji: "🚨", color: 0xd6336c },
  warning: { emoji: "⚠️", color: COLORS.ops },
  info: { emoji: "ℹ️", color: 0x4c6ef5 },
};

/**
 * Build an ops alert embed.
 *
 * @param {Object} params
 * @param {string} params.title - What broke, in one line.
 * @param {string} params.source - Which job found it, e.g. "scoring-watchdog".
 * @param {string} [params.summary] - A paragraph of context.
 * @param {Array<string>} [params.details] - Bullet lines (lease keys, errors).
 * @param {"critical"|"warning"|"info"} [params.severity]
 * @returns {Object} Webhook payload.
 */
function buildOpsAlertPayload({ title, source, summary, details, severity = "warning" }) {
  const level = SEVERITIES[severity] || SEVERITIES.warning;
  const lines = (details || []).filter(Boolean).map((line) => `• ${clampName(line, 220)}`);
  return payloadOf({
    title: `${level.emoji} ${clampName(title, 200)}`,
    description: summary || undefined,
    color: level.color,
    fields: lines.length > 0 ? [{ name: "Details", value: joinLines(lines) }] : [],
    footer: { text: `${source} · ${SITE_URL.replace("https://", "")}` },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Post an ops alert. Never throws and never returns a rejection: an alerting
 * channel must not be able to fail the job that noticed the problem.
 *
 * @param {string} webhookUrl - Falsy disables (secret unset/empty).
 * @param {Object} alert - See buildOpsAlertPayload.
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<{status: string, error?: string}>}
 */
async function postOpsAlert(webhookUrl, alert, fetchImpl) {
  if (!webhookUrl) return { status: "disabled" };
  try {
    await postToDiscordWebhook(webhookUrl, buildOpsAlertPayload(alert), fetchImpl);
    return { status: "posted" };
  } catch (error) {
    // Deliberately warn, not error: the caller has already logged the real
    // incident at error level, and a failed alert must not look like a
    // second incident.
    logger.warn(`[ops-alert] could not post to Discord: ${error.message}`);
    return { status: "failed", error: error.message };
  }
}

module.exports = { SEVERITIES, buildOpsAlertPayload, postOpsAlert };
