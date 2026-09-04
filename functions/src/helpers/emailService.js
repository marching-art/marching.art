/**
 * Email Service for marching.art
 * Handles all outbound email communications via Brevo (formerly Sendinblue)
 */

const admin = require("firebase-admin");
// @getbrevo/brevo is required lazily inside the client/send paths: every
// function in the deploy unit loads this module at cold start, and only the
// email senders touch Brevo.
const { defineSecret } = require("firebase-functions/params");
const { logger } = require("firebase-functions/v2");
// Every user-derived string (usernames, corps names, headlines, reasons,
// comment excerpts...) MUST pass through escapeHtml before being interpolated
// into an email HTML template — otherwise it's stored XSS in the recipient's
// inbox. Trusted constants (EMAIL_CONFIG URLs, literal copy) stay unescaped.
const { escapeHtml } = require("./escapeHtml");
const { deriveUnsubscribeKey, buildUnsubscribeUrl } = require("./unsubscribeToken");
const {
  EMAIL_CONFIG,
  welcomeEmailTemplate,
  streakBrokenEmailTemplate,
  rivalContextEmailTemplate,
  adminArticleSubmissionEmailTemplate,
  adminCommentReportEmailTemplate,
  adminPendingApprovalsDigestEmailTemplate,
  winBackEmailTemplate,
  milestoneEmailTemplate,
} = require("./emailTemplates");

// Define secrets for Brevo (set via `firebase functions:secrets:set`)
const brevoApiKey = defineSecret("BREVO_API_KEY");

/**
 * The recipient's no-login, one-click unsubscribe link
 * (helpers/unsubscribeToken.js; served by triggers/unsubscribe.js). Null when
 * the Brevo key is not configured — in which case no mail goes out anyway.
 * @param {string | null | undefined} uid
 * @returns {string | null}
 */
function unsubscribeUrlFor(uid) {
  if (!uid) return null;
  let apiKey = "";
  try {
    apiKey = brevoApiKey.value() || "";
  } catch {
    // Secret not bound to this function — no token, keep the signed-in link.
  }
  const key = deriveUnsubscribeKey(apiKey);
  return key ? buildUnsubscribeUrl(uid, key, EMAIL_CONFIG.appUrl) : null;
}

/**
 * The Brevo request for one email. Pure and exported so the header contract
 * can be tested without a client.
 *
 * With a per-recipient `unsubscribeUrl` the message carries the
 * List-Unsubscribe / List-Unsubscribe-Post headers Gmail and Yahoo require of
 * bulk senders (RFC 8058 one-click), and the footer's "Email Preferences"
 * link becomes that URL so the visible link works without a login too.
 *
 * @param {{to: string, subject: string, html: string, text?: string, emailType: string, unsubscribeUrl?: string | null}} options
 */
function buildSendRequest({ to, subject, html, text, emailType, unsubscribeUrl }) {
  const htmlContent = unsubscribeUrl
    ? html.split(EMAIL_CONFIG.unsubscribeUrl).join(unsubscribeUrl)
    : html;
  return {
    subject,
    htmlContent,
    textContent: text || stripHtml(htmlContent),
    sender: {
      email: EMAIL_CONFIG.fromEmail,
      name: EMAIL_CONFIG.fromName,
    },
    to: [{ email: to }],
    replyTo: { email: EMAIL_CONFIG.replyTo },
    tags: [emailType],
    ...(unsubscribeUrl
      ? {
          headers: {
            "List-Unsubscribe": `<${unsubscribeUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        }
      : {}),
  };
}

// Email types for tracking and preferences
const EMAIL_TYPES = {
  WELCOME: "welcome",
  STREAK_BROKEN: "streak_broken",
  WEEKLY_DIGEST: "weekly_digest",
  WIN_BACK: "win_back",
  LINEUP_REMINDER: "lineup_reminder",
  SHOW_REMINDER: "show_reminder",
  LEAGUE_ACTIVITY: "league_activity",
  MATCHUP_RESULT: "matchup_result",
  MILESTONE_ACHIEVED: "milestone_achieved",
  ADMIN_ARTICLE_SUBMISSION: "admin_article_submission",
  ADMIN_COMMENT_REPORT: "admin_comment_report",
  ADMIN_PENDING_DIGEST: "admin_pending_digest",
  ADMIN_GENERIC_ALERT: "admin_generic_alert",
};

// settings.emailPreferences key per email type. The Settings modal writes
// camelCase keys (streakBroken, weeklyDigest, …) while EMAIL_TYPES values are
// snake_case; the senders used to index preferences by the snake_case type,
// so every per-type opt-out except `allEmails` was silently ignored. Mirrors
// PUSH_PREFERENCE_MAP in pushService.js.
const EMAIL_PREFERENCE_MAP = {
  [EMAIL_TYPES.WELCOME]: "welcome",
  [EMAIL_TYPES.STREAK_BROKEN]: "streakBroken",
  [EMAIL_TYPES.WEEKLY_DIGEST]: "weeklyDigest",
  [EMAIL_TYPES.WIN_BACK]: "winBack",
  [EMAIL_TYPES.LINEUP_REMINDER]: "lineupReminder",
  [EMAIL_TYPES.SHOW_REMINDER]: "showReminder",
  [EMAIL_TYPES.LEAGUE_ACTIVITY]: "leagueActivity",
  [EMAIL_TYPES.MATCHUP_RESULT]: "matchupResult",
  [EMAIL_TYPES.MILESTONE_ACHIEVED]: "milestoneAchieved",
};

/**
 * Whether a director's email preferences allow one email type.
 *
 * `allEmails: false` wins over everything. Otherwise the camelCase key the
 * Settings modal writes decides; a legacy snake_case key is honored too;
 * absent → `defaultValue` (engagement emails are opt-out, so true).
 *
 * @param {Record<string, unknown> | null | undefined} emailPreferences
 * @param {string} emailType One of EMAIL_TYPES.
 * @param {boolean} [defaultValue]
 * @returns {boolean}
 */
function isEmailTypeEnabled(emailPreferences, emailType, defaultValue = true) {
  const prefs = emailPreferences && typeof emailPreferences === "object" ? emailPreferences : {};
  if (prefs.allEmails === false) return false;
  const key = EMAIL_PREFERENCE_MAP[emailType];
  if (key && typeof prefs[key] === "boolean") return prefs[key];
  if (typeof prefs[emailType] === "boolean") return prefs[emailType];
  return defaultValue;
}

// Cached Brevo client instance - reused across requests in same instance
let cachedBrevoClient = null;

/**
 * Get or create the Brevo client (cached for performance)
 */
function getBrevoClient() {
  if (!cachedBrevoClient) {
    // Trim the secret: when BREVO_API_KEY is set from a file or piped input it
    // commonly picks up a trailing newline/whitespace, which corrupts the
    // Authorization header and makes Brevo reject every request with 401.
    const apiKey = (brevoApiKey.value() || "").trim();
    if (!apiKey) {
      throw new Error("Brevo API key not configured");
    }
    // v6 SDK: one BrevoClient with per-resource namespaces (replaces the v2
    // per-API classes like TransactionalEmailsApi + setApiKey).
    const { BrevoClient } = require("@getbrevo/brevo");
    cachedBrevoClient = new BrevoClient({ apiKey });
  }
  return cachedBrevoClient;
}

/**
 * Send an email using Brevo
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 * @param {string} [options.text] - Plain text content (optional; derived from the HTML when omitted)
 * @param {string} options.emailType - Type of email for tracking
 * @param {string | null} [options.unsubscribeUrl] - The recipient's one-click unsubscribe link (engagement mail)
 * @returns {Promise<boolean>} - Success status
 */
async function sendEmail({ to, subject, html, text, emailType, unsubscribeUrl = null }) {
  try {
    const client = getBrevoClient();

    // v6 SDK: plain request object (no SendSmtpEmail model class) sent via the
    // client's transactionalEmails namespace. Field names are unchanged.
    await client.transactionalEmails.sendTransacEmail(
      buildSendRequest({ to, subject, html, text, emailType, unsubscribeUrl })
    );
    logger.info(`Email sent successfully: ${emailType} to ${to}`);
    return true;
  } catch (error) {
    // v6 BrevoError subclasses expose the HTTP status and parsed body at the
    // top level (error.statusCode / error.body); the error.response fallback
    // covers any non-SDK error shape. Surface both so failures (e.g. a 401
    // from a bad/disabled BREVO_API_KEY) are diagnosable from logs.
    const statusCode = error.statusCode || error.response?.statusCode;
    const responseBody = error.body || error.response?.body;
    logger.error(`Failed to send email: ${emailType} to ${to}`, {
      statusCode,
      responseBody,
      message: error.message,
    });

    if (statusCode === 401) {
      // The cached client holds the rejected key for the life of this instance.
      // Drop it so a corrected/rotated secret can be picked up on the next
      // cold start, and log an actionable hint.
      cachedBrevoClient = null;
      logger.error(
        "Brevo rejected the API key (401 Unauthorized). Verify the " +
          "BREVO_API_KEY secret is set, enabled, and has no stray whitespace: " +
          "firebase functions:secrets:set BREVO_API_KEY",
      );
    }
    return false;
  }
}

/**
 * Strip HTML tags for plain text version
 */
function stripHtml(html) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    // Decode the entities escapeHtml produces so the plain-text version stays
    // readable. &amp; must decode last to avoid double-decoding.
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

// =============================================================================
// EMAIL SENDING FUNCTIONS
// =============================================================================

/**
 * Send welcome email to new user
 */
async function sendWelcomeEmail(email, username, { uid = null } = {}) {
  const html = welcomeEmailTemplate({ username });
  return sendEmail({
    to: email,
    subject: "Welcome to marching.art! 🎺",
    html,
    emailType: EMAIL_TYPES.WELCOME,
    unsubscribeUrl: unsubscribeUrlFor(uid),
  });
}

/**
 * Send streak broken email
 */
async function sendStreakBrokenEmail(email, username, previousStreak, { uid = null } = {}) {
  const html = streakBrokenEmailTemplate({ username, previousStreak });
  return sendEmail({
    to: email,
    subject: "Your streak has reset — start fresh today!",
    html,
    emailType: EMAIL_TYPES.STREAK_BROKEN,
    unsubscribeUrl: unsubscribeUrlFor(uid),
  });
}

/**
 * Send the rival-context weekly email. Caller is responsible for ensuring
 * `data.events.length > 0` — this function does not gate on its own.
 */
async function sendRivalContextEmail(email, data, { uid = null } = {}) {
  const html = rivalContextEmailTemplate(data);
  return sendEmail({
    to: email,
    subject: data.headline || "Your class moved this week",
    html,
    emailType: EMAIL_TYPES.WEEKLY_DIGEST,
    unsubscribeUrl: unsubscribeUrlFor(uid),
  });
}

/**
 * Notify a single admin about a new article submission.
 */
async function sendAdminArticleSubmissionEmail(email, data) {
  const html = adminArticleSubmissionEmailTemplate(data);
  return sendEmail({
    to: email,
    subject: `[Admin] New article submission: ${data.headline || "(untitled)"}`,
    html,
    emailType: EMAIL_TYPES.ADMIN_ARTICLE_SUBMISSION,
  });
}

/**
 * Notify a single admin about a reported / pending comment.
 */
async function sendAdminCommentReportEmail(email, data) {
  const html = adminCommentReportEmailTemplate(data);
  return sendEmail({
    to: email,
    subject: `[Admin] Comment flagged for review`,
    html,
    emailType: EMAIL_TYPES.ADMIN_COMMENT_REPORT,
  });
}

/**
 * Notify a single admin with a digest of everything awaiting review.
 */
async function sendAdminPendingApprovalsDigestEmail(email, data) {
  const html = adminPendingApprovalsDigestEmailTemplate(data);
  const total =
    (Number(data?.pendingArticles) || 0) +
    (Number(data?.pendingComments) || 0) +
    (Number(data?.pendingReports) || 0);
  return sendEmail({
    to: email,
    subject: `[Admin] ${total} item${total === 1 ? "" : "s"} awaiting review`,
    html,
    emailType: EMAIL_TYPES.ADMIN_PENDING_DIGEST,
  });
}

/**
 * Notify a single admin with a free-form operational alert (plain text body,
 * HTML-escaped). Used for security/audit events that have no dedicated
 * template — e.g. a supporter link claimed with a mismatched email.
 */
async function sendAdminGenericAlertEmail(email, { subject, body }) {
  const escaped = escapeHtml(body || "");
  return sendEmail({
    to: email,
    subject: `[Admin] ${subject || "marching.art alert"}`,
    html: `<p style="font-family:sans-serif;white-space:pre-wrap;">${escaped}</p>`,
    emailType: EMAIL_TYPES.ADMIN_GENERIC_ALERT,
  });
}

/**
 * Send win-back campaign email
 */
async function sendWinBackEmail(
  email,
  username,
  daysMissed,
  streakLost,
  corpsCoinBalance,
  { uid = null } = {}
) {
  const html = winBackEmailTemplate({ username, daysMissed, streakLost, corpsCoinBalance });
  return sendEmail({
    to: email,
    subject: `We miss you, ${username}! Come back to marching.art`,
    html,
    emailType: EMAIL_TYPES.WIN_BACK,
    unsubscribeUrl: unsubscribeUrlFor(uid),
  });
}

/**
 * Send milestone achieved email
 */
async function sendMilestoneEmail(
  email,
  username,
  milestoneType,
  milestoneValue,
  xpReward,
  coinReward,
  { uid = null } = {}
) {
  const html = milestoneEmailTemplate({ username, milestoneType, milestoneValue, xpReward, coinReward });
  return sendEmail({
    to: email,
    subject: `🎉 Milestone: ${milestoneValue}-day streak achieved!`,
    html,
    emailType: EMAIL_TYPES.MILESTONE_ACHIEVED,
    unsubscribeUrl: unsubscribeUrlFor(uid),
  });
}

// =============================================================================
// ADMIN HELPERS
// =============================================================================

/**
 * Resolve the email addresses of all admins. Used to fan out notifications
 * (article submissions, reported comments). Returns [{ uid, email }].
 *
 * Admins are identified by the `admin: true` CUSTOM CLAIM — the same single
 * source of truth every callable gate uses (callableGuards.assertAdmin) and
 * the only thing setUserRole actually writes. The previous implementation
 * queried `profile.role === "admin"` in Firestore, a field setUserRole never
 * maintained: admins granted via the claim silently missed these emails, and
 * a stale role field kept receiving them after revocation.
 *
 * listUsers pages through the whole Auth user base (1000/page); admin
 * fan-outs are rare (submission/report notifications), so the scan cost is
 * irrelevant next to the correctness of a single admin definition.
 */
async function getAdminEmails() {
  const recipients = [];
  try {
    let pageToken = undefined;
    do {
      const page = await admin.auth().listUsers(1000, pageToken);
      for (const userRecord of page.users) {
        if (userRecord.customClaims?.admin === true && userRecord.email) {
          recipients.push({ uid: userRecord.uid, email: userRecord.email });
        }
      }
      pageToken = page.pageToken;
    } while (pageToken);
  } catch (err) {
    logger.warn(`Could not enumerate admin users: ${err.message}`);
  }
  return recipients;
}

/**
 * Best-effort fan-out helper: delivers a per-recipient send and swallows errors.
 * Returns the number of successful deliveries.
 */
async function fanOutToAdmins(senderFn, payload) {
  const recipients = await getAdminEmails();
  if (recipients.length === 0) {
    logger.info("No admins configured; skipping admin notification.");
    return 0;
  }
  const results = await Promise.all(
    recipients.map((r) => senderFn(r.email, payload).catch((err) => {
      logger.warn(`Admin email send failed to ${r.email}: ${err.message}`);
      return false;
    })),
  );
  return results.filter(Boolean).length;
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  buildSendRequest,
  unsubscribeUrlFor,
  EMAIL_PREFERENCE_MAP,
  isEmailTypeEnabled,
  // Configuration
  EMAIL_TYPES,
  EMAIL_CONFIG,
  brevoApiKey,

  // Core function
  sendEmail,

  // Escaping helper (re-exported so email-adjacent code shares one impl)
  escapeHtml,

  // Email senders
  sendWelcomeEmail,
  sendStreakBrokenEmail,
  sendRivalContextEmail,
  sendWinBackEmail,
  sendMilestoneEmail,
  sendAdminArticleSubmissionEmail,
  sendAdminCommentReportEmail,
  sendAdminPendingApprovalsDigestEmail,
  sendAdminGenericAlertEmail,

  // Admin fan-out helpers
  getAdminEmails,
  fanOutToAdmins,

  // Templates (for testing)
  welcomeEmailTemplate,
  rivalContextEmailTemplate,
  winBackEmailTemplate,
  adminArticleSubmissionEmailTemplate,
  adminCommentReportEmailTemplate,
  adminPendingApprovalsDigestEmailTemplate,
};
