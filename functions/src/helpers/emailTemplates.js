/**
 * Email templates for marching.art — the HTML bodies emailService.js sends.
 *
 * Every user-derived string (usernames, corps names, headlines, reasons,
 * comment excerpts...) MUST pass through escapeHtml before being interpolated
 * into a template — otherwise it's stored XSS in the recipient's inbox.
 * Trusted constants (EMAIL_CONFIG URLs, literal copy) stay unescaped.
 */

const { NEW_DIRECTOR_CORPSCOIN } = require("./economy");
const { escapeHtml } = require("./escapeHtml");

// Email configuration
const EMAIL_CONFIG = {
  fromEmail: "noreply@marching.art",
  fromName: "marching.art",
  replyTo: "support@marching.art",
  appUrl: "https://marching.art",
  // The signed-in preferences page. Engagement mail swaps this for the
  // recipient's own one-click link (unsubscribeUrlFor) when it can.
  unsubscribeUrl: "https://marching.art/profile?settings=emails",
};

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

module.exports = {
  EMAIL_CONFIG,
  emailWrapper,
  welcomeEmailTemplate,
  streakBrokenEmailTemplate,
  rivalContextEmailTemplate,
  adminArticleSubmissionEmailTemplate,
  adminCommentReportEmailTemplate,
  adminPendingApprovalsDigestEmailTemplate,
  winBackEmailTemplate,
  milestoneEmailTemplate,
};
