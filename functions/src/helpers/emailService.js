/**
 * Email Service for marching.art
 * Handles all outbound email communications via Brevo (formerly Sendinblue)
 */

const admin = require("firebase-admin");
const { NEW_DIRECTOR_CORPSCOIN } = require("./economy");
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

// Define secrets for Brevo (set via `firebase functions:secrets:set`)
const brevoApiKey = defineSecret("BREVO_API_KEY");

// Email configuration
const EMAIL_CONFIG = {
  fromEmail: "noreply@marching.art",
  fromName: "marching.art",
  replyTo: "support@marching.art",
  appUrl: "https://marching.art",
  unsubscribeUrl: "https://marching.art/profile?settings=emails",
};

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
 * @returns {Promise<boolean>} - Success status
 */
async function sendEmail({ to, subject, html, text, emailType }) {
  try {
    const client = getBrevoClient();

    // v6 SDK: plain request object (no SendSmtpEmail model class) sent via the
    // client's transactionalEmails namespace. Field names are unchanged.
    await client.transactionalEmails.sendTransacEmail({
      subject,
      htmlContent: html,
      textContent: text || stripHtml(html),
      sender: {
        email: EMAIL_CONFIG.fromEmail,
        name: EMAIL_CONFIG.fromName,
      },
      to: [{ email: to }],
      replyTo: { email: EMAIL_CONFIG.replyTo },
      tags: [emailType],
    });
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
// EMAIL TEMPLATES
// =============================================================================

/**
 * Base email wrapper with consistent styling
 */
function emailWrapper(content, preheader = "") {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>marching.art</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background-color: #0f172a;
      color: #f1f5f9;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #1e293b;
      border-radius: 8px;
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #0057B8 0%, #003d82 100%);
      padding: 32px 24px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: -0.5px;
    }
    .header .tagline {
      margin-top: 8px;
      font-size: 14px;
      color: rgba(255,255,255,0.8);
    }
    .content {
      padding: 32px 24px;
    }
    .content h2 {
      margin: 0 0 16px;
      font-size: 24px;
      color: #ffffff;
    }
    .content p {
      margin: 0 0 16px;
      line-height: 1.6;
      color: #cbd5e1;
    }
    .button {
      display: inline-block;
      background: linear-gradient(135deg, #0057B8 0%, #003d82 100%);
      color: #ffffff !important;
      padding: 14px 28px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      font-size: 16px;
      margin: 16px 0;
    }
    .button:hover {
      background: #003d82;
    }
    .stat-box {
      background-color: #0f172a;
      border-radius: 8px;
      padding: 20px;
      margin: 16px 0;
      text-align: center;
    }
    .stat-number {
      font-size: 48px;
      font-weight: 700;
      color: #0057B8;
    }
    .stat-label {
      font-size: 14px;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .streak-fire {
      color: #f97316;
    }
    .streak-warning {
      color: #eab308;
    }
    .footer {
      padding: 24px;
      text-align: center;
      font-size: 12px;
      color: #64748b;
      border-top: 1px solid #334155;
    }
    .footer a {
      color: #94a3b8;
    }
    .divider {
      height: 1px;
      background-color: #334155;
      margin: 24px 0;
    }
    .preheader {
      display: none;
      max-width: 0;
      max-height: 0;
      overflow: hidden;
      font-size: 1px;
      line-height: 1px;
      color: #0f172a;
    }
  </style>
</head>
<body>
  <div class="preheader">${preheader}</div>
  <div style="padding: 20px; background-color: #0f172a;">
    <div class="container">
      <div class="header">
        <h1>marching.art</h1>
        <div class="tagline">Fantasy Drum Corps</div>
      </div>
      ${content}
      <div class="footer">
        <p>
          <a href="${EMAIL_CONFIG.appUrl}">marching.art</a> |
          <a href="${EMAIL_CONFIG.unsubscribeUrl}">Email Preferences</a>
        </p>
        <p>&copy; ${new Date().getFullYear()} marching.art. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Welcome email template
 */
function welcomeEmailTemplate({ username, corpsCoinGift = NEW_DIRECTOR_CORPSCOIN }) {
  const content = `
    <div class="content">
      <h2>Welcome to the Field, ${escapeHtml(username)}! 🎺</h2>
      <p>
        You've joined thousands of drum corps fans in the ultimate fantasy experience.
        Build your dream corps, compete in leagues, and climb the leaderboards.
      </p>

      <div class="stat-box">
        <div class="stat-number">${corpsCoinGift}</div>
        <div class="stat-label">CorpsCoin Welcome Bonus</div>
      </div>

      <p>Here's what to do next:</p>
      <ul style="color: #cbd5e1; line-height: 2;">
        <li><strong>Create your corps</strong> — Give it a name and pick your class</li>
        <li><strong>Build your lineup</strong> — Draft caption heads for each position</li>
        <li><strong>Register for shows</strong> — Earn points as your corps competes</li>
        <li><strong>Join a league</strong> — Go head-to-head with other fans</li>
      </ul>

      <p style="text-align: center;">
        <a href="${EMAIL_CONFIG.appUrl}/dashboard" class="button">
          Start Competing →
        </a>
      </p>

      <div class="divider"></div>

      <p style="font-size: 14px; color: #94a3b8;">
        Pro tip: Log in daily to build your streak and earn bonus CorpsCoin!
      </p>
    </div>
  `;

  return emailWrapper(content, `Welcome to marching.art! Your ${corpsCoinGift} CorpsCoin welcome bonus is waiting.`);
}

/**
 * Streak broken email template
 */
function streakBrokenEmailTemplate({ username, previousStreak }) {
  const content = `
    <div class="content">
      <h2>Your Streak Has Reset</h2>
      <p>
        Hey ${escapeHtml(username)}, your ${previousStreak}-day streak has ended.
        But every champion has setbacks — what matters is getting back up.
      </p>

      <div class="stat-box">
        <div class="stat-number">0</div>
        <div class="stat-label">Current Streak</div>
      </div>

      <p>
        Start rebuilding today. Your next milestone is just 3 days away!
      </p>

      <p style="text-align: center;">
        <a href="${EMAIL_CONFIG.appUrl}/dashboard" class="button">
          Start a New Streak →
        </a>
      </p>
    </div>
  `;

  return emailWrapper(content, `Time to start a new streak — log in today!`);
}

/**
 * Rival-context email template (replaces the legacy weekly digest)
 *
 * Renders only meaningful changes vs. the user's last-emailed rivals snapshot:
 * passes, medal-tier shifts (SoundSport), and class-rank movement. The
 * scheduler is responsible for skipping the email entirely when events is empty.
 *
 * SoundSport entries never reveal raw scores — only medal designations.
 */
function rivalContextEmailTemplate({ username, headline, events }) {
  const safeUsername = escapeHtml(username || "Director");
  // Event titles/details embed rival corps names and other user-chosen strings
  // (see emailNotifications.js) — escape every event field, including the
  // color, which lands inside a style attribute.
  const safeHeadline = escapeHtml(headline);
  const eventList = (events || [])
    .map((event) => {
      const detail = event.detail
        ? `<div style="font-size: 13px; color: #94a3b8; margin-top: 4px;">${escapeHtml(event.detail)}</div>`
        : "";
      return `
        <li style="margin: 12px 0; padding: 12px 14px; background-color: #0f172a; border-left: 3px solid ${escapeHtml(event.color || "#0057B8")}; border-radius: 4px;">
          <div style="font-weight: 600; color: #f1f5f9;">${event.icon ? escapeHtml(event.icon) + " " : ""}${escapeHtml(event.title)}</div>
          ${detail}
        </li>
      `;
    })
    .join("");

  const content = `
    <div class="content">
      <h2 style="color: #ffffff; margin-bottom: 8px;">${safeHeadline}</h2>
      <p style="color: #cbd5e1;">
        Here's what shifted in your class this week, ${safeUsername}.
      </p>

      <ul style="list-style: none; padding: 0; margin: 16px 0;">
        ${eventList}
      </ul>

      <p style="text-align: center;">
        <a href="${EMAIL_CONFIG.appUrl}/dashboard" class="button">
          See the standings →
        </a>
      </p>

      <div class="divider"></div>
      <p style="font-size: 12px; color: #64748b;">
        You only get this email when something actually changes in your class.
        Adjust frequency in <a href="${EMAIL_CONFIG.unsubscribeUrl}" style="color: #94a3b8;">Email Preferences</a>.
      </p>
    </div>
  `;

  return emailWrapper(content, safeHeadline);
}

/**
 * Admin notification template — new article submitted for approval
 */
function adminArticleSubmissionEmailTemplate({ headline, summary, authorName, category, submissionId }) {
  const reviewUrl = `${EMAIL_CONFIG.appUrl}/admin?tab=submissions&id=${encodeURIComponent(submissionId || "")}`;
  const safeHeadline = escapeHtml(headline || "(no headline)");
  const content = `
    <div class="content">
      <h2 style="color: #ffffff; margin-bottom: 8px;">New article needs review</h2>
      <p style="color: #cbd5e1;">
        <strong>${escapeHtml(authorName || "A user")}</strong> submitted an article for approval.
      </p>

      <div style="margin: 16px 0; padding: 14px; background-color: #0f172a; border-radius: 4px;">
        <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 6px;">
          ${escapeHtml(category || "uncategorized")}
        </div>
        <div style="font-weight: 600; color: #f1f5f9; margin-bottom: 8px;">${safeHeadline}</div>
        <div style="font-size: 13px; color: #94a3b8;">${escapeHtml(summary || "")}</div>
      </div>

      <p style="text-align: center;">
        <a href="${reviewUrl}" class="button">Review submission →</a>
      </p>
    </div>
  `;
  return emailWrapper(content, `New submission: ${safeHeadline}`);
}

/**
 * Admin notification template — comment reported / pending moderation
 */
function adminCommentReportEmailTemplate({
  reason,
  commentExcerpt,
  commentAuthor,
  reporterName,
  articleId,
  reportId,
}) {
  const queueUrl = `${EMAIL_CONFIG.appUrl}/admin?tab=moderation`;
  const articleUrl = articleId ? `${EMAIL_CONFIG.appUrl}/article/${encodeURIComponent(articleId)}` : null;
  const content = `
    <div class="content">
      <h2 style="color: #ffffff; margin-bottom: 8px;">Comment flagged for review</h2>
      <p style="color: #cbd5e1;">
        <strong>${escapeHtml(reporterName || "A user")}</strong> reported a comment by
        <strong>${escapeHtml(commentAuthor || "an unknown user")}</strong>.
      </p>

      ${reason ? `
      <div style="margin: 16px 0; padding: 12px 14px; background-color: #0f172a; border-left: 3px solid #ef4444; border-radius: 4px;">
        <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 6px;">Reason</div>
        <div style="color: #f1f5f9;">${escapeHtml(reason)}</div>
      </div>
      ` : ""}

      ${commentExcerpt ? `
      <div style="margin: 16px 0; padding: 12px 14px; background-color: #0f172a; border-radius: 4px;">
        <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 6px;">Comment</div>
        <div style="color: #cbd5e1; font-style: italic;">"${escapeHtml(commentExcerpt)}"</div>
      </div>
      ` : ""}

      <p style="text-align: center;">
        <a href="${queueUrl}" class="button">Open moderation queue →</a>
      </p>
      ${articleUrl ? `<p style="font-size: 13px; text-align: center;"><a href="${articleUrl}" style="color: #94a3b8;">View the article in context</a></p>` : ""}

      ${reportId ? `<p style="font-size: 11px; color: #64748b; margin-top: 16px;">Report ID: ${escapeHtml(reportId)}</p>` : ""}
    </div>
  `;
  return emailWrapper(content, `Comment reported: ${escapeHtml(reason || "see admin queue")}`);
}

/**
 * Admin notification template — periodic digest of everything awaiting review.
 *
 * Sent by the pendingApprovalsDigest scheduled job when at least one queue is
 * non-empty. It's the safety net behind the immediate per-event admin emails
 * (article submitted, comment reported): if one of those is missed, this
 * reminds admins that items are still sitting in the queue. It also covers the
 * one queue with no immediate email — comments held for moderation.
 *
 * All values are server-computed integer counts; no user-supplied strings are
 * interpolated, so nothing here needs escaping.
 */
function adminPendingApprovalsDigestEmailTemplate({
  pendingArticles = 0,
  pendingComments = 0,
  pendingReports = 0,
}) {
  const articles = Math.max(0, Number(pendingArticles) || 0);
  const comments = Math.max(0, Number(pendingComments) || 0);
  const reports = Math.max(0, Number(pendingReports) || 0);
  const total = articles + comments + reports;

  const submissionsUrl = `${EMAIL_CONFIG.appUrl}/admin?tab=submissions`;
  const moderationUrl = `${EMAIL_CONFIG.appUrl}/admin?tab=moderation`;

  // One stat row per non-empty queue. label/url are trusted constants; count is
  // a coerced integer — nothing user-supplied reaches the markup.
  const row = (count, label, url) =>
    count > 0
      ? `
      <tr>
        <td style="padding: 12px 14px; background-color: #0f172a; border-radius: 4px;">
          <span style="display: inline-block; min-width: 40px; font-size: 22px; font-weight: 700; color: #0057B8;">${count}</span>
          <a href="${url}" style="color: #f1f5f9; text-decoration: none; font-weight: 600;">${label}</a>
        </td>
      </tr>
      <tr><td style="height: 8px; line-height: 8px;">&nbsp;</td></tr>`
      : "";

  const content = `
    <div class="content">
      <h2 style="color: #ffffff; margin-bottom: 8px;">${total} item${total === 1 ? "" : "s"} awaiting review</h2>
      <p style="color: #cbd5e1;">
        Here's what's currently sitting in the moderation queues on marching.art.
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 16px 0;">
        ${row(articles, "article submission" + (articles === 1 ? "" : "s") + " pending approval", submissionsUrl)}
        ${row(comments, "comment" + (comments === 1 ? "" : "s") + " awaiting moderation", moderationUrl)}
        ${row(reports, "reported comment" + (reports === 1 ? "" : "s") + " to review", moderationUrl)}
      </table>

      <p style="text-align: center;">
        <a href="${submissionsUrl}" class="button">Open the admin queue →</a>
      </p>

      <div class="divider"></div>
      <p style="font-size: 12px; color: #64748b;">
        You're receiving this because you're an admin. This digest only goes out
        when something is waiting.
      </p>
    </div>
  `;

  return emailWrapper(content, `${total} item${total === 1 ? "" : "s"} awaiting review on marching.art`);
}

/**
 * Win-back campaign email template (7 days inactive)
 */
function winBackEmailTemplate({ username, daysMissed, streakLost, corpsCoinBalance }) {
  const content = `
    <div class="content">
      <h2>We Miss You, ${escapeHtml(username)}! 💔</h2>
      <p>
        It's been ${daysMissed} days since your last visit to marching.art.
        The competition is heating up — don't get left behind!
      </p>

      ${streakLost > 3 ? `
      <div class="stat-box">
        <p style="margin: 0; color: #94a3b8;">Your ${streakLost}-day streak was lost</p>
        <p style="margin: 8px 0 0; color: #f97316;">Come back and start fresh!</p>
      </div>
      ` : ''}

      <div class="stat-box">
        <div class="stat-number">${corpsCoinBalance}</div>
        <div class="stat-label">CorpsCoin Waiting</div>
      </div>

      <p>Here's what you're missing:</p>
      <ul style="color: #cbd5e1; line-height: 2;">
        <li>Daily streak bonuses (up to 1000 CC at 100 days!)</li>
        <li>League matchups and rivalries</li>
        <li>New shows and scoring opportunities</li>
      </ul>

      <p style="text-align: center;">
        <a href="${EMAIL_CONFIG.appUrl}/dashboard" class="button">
          Return to marching.art →
        </a>
      </p>
    </div>
  `;

  return emailWrapper(content, `We miss you! ${corpsCoinBalance} CorpsCoin is waiting in your account.`);
}

/**
 * Milestone achieved email template
 */
function milestoneEmailTemplate({ username, milestoneType, milestoneValue, xpReward, coinReward }) {
  const milestoneMessages = {
    streak: `${milestoneValue}-Day Streak!`,
    level: `Level ${milestoneValue} Achieved!`,
    shows: `${milestoneValue} Shows Completed!`,
    score: `${milestoneValue} Points Milestone!`,
  };

  const content = `
    <div class="content">
      <h2>🎉 ${milestoneMessages[milestoneType] || 'Milestone Achieved!'}</h2>
      <p>
        Congratulations ${escapeHtml(username)}! You've reached an incredible milestone.
      </p>

      <div class="stat-box">
        <div class="stat-number" style="color: #22c55e;">🏆</div>
        <div class="stat-label">${milestoneMessages[milestoneType]}</div>
      </div>

      ${(xpReward || coinReward) ? `
      <div style="display: flex; gap: 16px; flex-wrap: wrap;">
        ${xpReward ? `
        <div class="stat-box" style="flex: 1; min-width: 120px;">
          <div class="stat-number" style="color: #a855f7;">+${xpReward}</div>
          <div class="stat-label">XP Earned</div>
        </div>
        ` : ''}
        ${coinReward ? `
        <div class="stat-box" style="flex: 1; min-width: 120px;">
          <div class="stat-number" style="color: #eab308;">+${coinReward}</div>
          <div class="stat-label">CorpsCoin</div>
        </div>
        ` : ''}
      </div>
      ` : ''}

      <p style="text-align: center;">
        <a href="${EMAIL_CONFIG.appUrl}/dashboard" class="button">
          Keep Going! →
        </a>
      </p>
    </div>
  `;

  return emailWrapper(content, `Congrats! ${milestoneMessages[milestoneType]} ${coinReward ? `+${coinReward} CC` : ''}`);
}

// =============================================================================
// EMAIL SENDING FUNCTIONS
// =============================================================================

/**
 * Send welcome email to new user
 */
async function sendWelcomeEmail(email, username) {
  const html = welcomeEmailTemplate({ username });
  return sendEmail({
    to: email,
    subject: "Welcome to marching.art! 🎺",
    html,
    emailType: EMAIL_TYPES.WELCOME,
  });
}

/**
 * Send streak broken email
 */
async function sendStreakBrokenEmail(email, username, previousStreak) {
  const html = streakBrokenEmailTemplate({ username, previousStreak });
  return sendEmail({
    to: email,
    subject: "Your streak has reset — start fresh today!",
    html,
    emailType: EMAIL_TYPES.STREAK_BROKEN,
  });
}

/**
 * Send the rival-context weekly email. Caller is responsible for ensuring
 * `data.events.length > 0` — this function does not gate on its own.
 */
async function sendRivalContextEmail(email, data) {
  const html = rivalContextEmailTemplate(data);
  return sendEmail({
    to: email,
    subject: data.headline || "Your class moved this week",
    html,
    emailType: EMAIL_TYPES.WEEKLY_DIGEST,
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
async function sendWinBackEmail(email, username, daysMissed, streakLost, corpsCoinBalance) {
  const html = winBackEmailTemplate({ username, daysMissed, streakLost, corpsCoinBalance });
  return sendEmail({
    to: email,
    subject: `We miss you, ${username}! Come back to marching.art`,
    html,
    emailType: EMAIL_TYPES.WIN_BACK,
  });
}

/**
 * Send milestone achieved email
 */
async function sendMilestoneEmail(email, username, milestoneType, milestoneValue, xpReward, coinReward) {
  const html = milestoneEmailTemplate({ username, milestoneType, milestoneValue, xpReward, coinReward });
  return sendEmail({
    to: email,
    subject: `🎉 Milestone: ${milestoneValue}-day streak achieved!`,
    html,
    emailType: EMAIL_TYPES.MILESTONE_ACHIEVED,
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
