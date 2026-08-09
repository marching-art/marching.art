// Pending-approvals digest (scheduled): counts everything sitting in the
// moderation queues and, when at least one queue is non-empty, alerts admins.
//
// This is the safety net behind the immediate per-event admin emails
// (an article submitted for approval, a comment reported): those fire once,
// so if an admin misses one the work can sit unnoticed. It also covers the one
// queue that never had an immediate alert at all — comments held for
// moderation (new accounts, or edited comments re-queued for review).
//
// Alerting mirrors the scrape canary / scoring watchdog: an admin email
// fan-out plus a Discord post to the admin-only #operations channel, and the
// last result is persisted to admin-stats/pendingApprovalsDigest for the admin
// dashboard. The digest is intentionally quiet — nothing is sent when every
// queue is empty.

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
const { brevoApiKey } = require("../helpers/emailService");
const { discordOpsWebhookUrl } = require("../helpers/discord");
const { postOpsAlert } = require("../helpers/opsAlerts");

const SITE_URL = "https://marching.art";

/**
 * Count the items currently awaiting admin review across every queue.
 *
 * Uses aggregation count() queries (one billed read each) rather than pulling
 * documents — the digest only needs totals. A failure on any single queue is
 * swallowed to a 0 so one broken query can't suppress the whole alert.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @returns {Promise<{pendingArticles:number,pendingComments:number,pendingReports:number,total:number}>}
 */
async function computePendingApprovals(db) {
  const countPending = async (collection, describe) => {
    try {
      const snap = await db
        .collection(collection)
        .where("status", "==", "pending")
        .count()
        .get();
      return snap.data().count || 0;
    } catch (error) {
      logger.warn(`[pending-digest] could not count ${describe}: ${error.message}`);
      return 0;
    }
  };

  const [pendingArticles, pendingComments, pendingReports] = await Promise.all([
    countPending("news_submissions", "pending article submissions"),
    countPending("article_comments", "pending comments"),
    countPending("article_comments_reports", "pending comment reports"),
  ]);

  return {
    pendingArticles,
    pendingComments,
    pendingReports,
    total: pendingArticles + pendingComments + pendingReports,
  };
}

/**
 * Run the digest: count the queues, persist the snapshot, and — only when
 * something is waiting — email admins and post an ops alert. Exported for the
 * scheduled wrapper and tests.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} [opsWebhookUrl] - Falsy disables the Discord channel.
 * @returns {Promise<{pendingArticles:number,pendingComments:number,pendingReports:number,total:number,notified:boolean}>}
 */
async function runPendingApprovalsDigest(db, opsWebhookUrl) {
  const counts = await computePendingApprovals(db);
  const result = { ...counts, checkedAt: new Date().toISOString() };

  // Best-effort persistence for the admin dashboard; never fail on it.
  try {
    await db.doc("admin-stats/pendingApprovalsDigest").set(result);
  } catch (error) {
    logger.warn(`[pending-digest] could not persist result: ${error.message}`);
  }

  if (counts.total === 0) {
    logger.info("[pending-digest] no items awaiting review; no alert sent.");
    return { ...counts, notified: false };
  }

  logger.info(
    `[pending-digest] ${counts.total} item(s) awaiting review ` +
      `(articles=${counts.pendingArticles}, comments=${counts.pendingComments}, ` +
      `reports=${counts.pendingReports}).`
  );

  // Channel 1: admin email fan-out (same plumbing as the canary/watchdog).
  try {
    const { fanOutToAdmins, sendAdminPendingApprovalsDigestEmail } =
      require("../helpers/emailService");
    await fanOutToAdmins(sendAdminPendingApprovalsDigestEmail, {
      pendingArticles: counts.pendingArticles,
      pendingComments: counts.pendingComments,
      pendingReports: counts.pendingReports,
    });
  } catch (error) {
    logger.warn(`[pending-digest] admin email fan-out failed: ${error.message}`);
  }

  // Channel 2: the admin-only #operations channel — a nudge that reaches a
  // phone. Never throws.
  await postOpsAlert(opsWebhookUrl, {
    title: `${counts.total} item${counts.total === 1 ? "" : "s"} awaiting review`,
    source: "pending-digest",
    severity: "info",
    summary: "Items are sitting in the moderation queues on marching.art.",
    details: [
      counts.pendingArticles > 0
        ? `${counts.pendingArticles} article submission(s) pending — ${SITE_URL}/admin?tab=submissions`
        : null,
      counts.pendingComments > 0
        ? `${counts.pendingComments} comment(s) awaiting moderation — ${SITE_URL}/admin?tab=moderation`
        : null,
      counts.pendingReports > 0
        ? `${counts.pendingReports} reported comment(s) to review — ${SITE_URL}/admin?tab=moderation`
        : null,
    ].filter(Boolean),
  });

  return { ...counts, notified: true };
}

/**
 * Twice daily (9 AM and 5 PM ET) — a morning and an end-of-day reminder of
 * anything still queued, without becoming noise. Silent when the queues are
 * empty.
 */
exports.pendingApprovalsDigest = onSchedule(
  {
    schedule: "0 9,17 * * *",
    timeZone: "America/New_York",
    timeoutSeconds: 60,
    secrets: [brevoApiKey, discordOpsWebhookUrl],
  },
  async () => {
    await runPendingApprovalsDigest(getDb(), discordOpsWebhookUrl.value());
  }
);

module.exports = {
  pendingApprovalsDigest: exports.pendingApprovalsDigest,
  computePendingApprovals,
  runPendingApprovalsDigest,
};
