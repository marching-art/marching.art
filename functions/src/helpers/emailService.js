/**
 * Email Service for marching.art
 * Handles all outbound email communications via SendGrid
 */

const sgMail = require("@sendgrid/mail");
const { defineSecret } = require("firebase-functions/params");
const { logger } = require("firebase-functions/v2");

// Define secrets for SendGrid (set via `firebase functions:secrets:set`)
const sendgridApiKey = defineSecret("SENDGRID_API_KEY");

// Email configuration
const EMAIL_CONFIG = {
  fromEmail: "noreply@marching.art",
  fromName: "marching.art",
  replyTo: "support@marching.art",
  appUrl: "https://marching.art",
  unsubscribeUrl: "https://marching.art/settings",
};

// Email types for tracking and preferences
const EMAIL_TYPES = {
  WELCOME: "welcome",
  STREAK_AT_RISK: "streak_at_risk",
  STREAK_BROKEN: "streak_broken",
  WEEKLY_DIGEST: "weekly_digest",
  WIN_BACK: "win_back",
  LINEUP_REMINDER: "lineup_reminder",
  SHOW_REMINDER: "show_reminder",
  LEAGUE_ACTIVITY: "league_activity",
  MATCHUP_RESULT: "matchup_result",
  MILESTONE_ACHIEVED: "milestone_achieved",
};

/**
 * Initialize SendGrid with API key
 */
function initSendGrid() {
  const apiKey = sendgridApiKey.value();
  if (!apiKey) {
    throw new Error("SendGrid API key not configured");
  }
  sgMail.setApiKey(apiKey);
}

/**
 * Send an email using SendGrid
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 * @param {string} options.text - Plain text content (optional)
 * @param {string} options.emailType - Type of email for tracking
 * @returns {Promise<boolean>} - Success status
 */
async function sendEmail({ to, subject, html, text, emailType }) {
  try {
    initSendGrid();

    const msg = {
      to,
      from: {
        email: EMAIL_CONFIG.fromEmail,
        name: EMAIL_CONFIG.fromName,
      },
      replyTo: EMAIL_CONFIG.replyTo,
      subject,
      html,
      text: text || stripHtml(html),
      trackingSettings: {
        clickTracking: { enable: true },
        openTracking: { enable: true },
      },
      customArgs: {
        emailType,
      },
    };

    await sgMail.send(msg);
    logger.info(`Email sent successfully: ${emailType} to ${to}`);
    return true;
  } catch (error) {
    logger.error(`Failed to send email: ${emailType} to ${to}`, error);
    if (error.response) {
      logger.error("SendGrid error body:", error.response.body);
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
function welcomeEmailTemplate({ username, corpsCoinGift = 100 }) {
  const content = `
    <div class="content">
      <h2>Welcome to the Field, ${username}! 🎺</h2>
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
 * Streak at risk email template
 */
function streakAtRiskEmailTemplate({ username, streakDays, hoursRemaining }) {
  const content = `
    <div class="content">
      <h2>⚠️ Your Streak is at Risk!</h2>
      <p>
        Hey ${username}, don't let your ${streakDays}-day streak slip away!
      </p>

      <div class="stat-box">
        <div class="stat-number streak-warning">${Math.floor(hoursRemaining)}h</div>
        <div class="stat-label">Until Streak Resets</div>
      </div>

      <div class="stat-box">
        <div class="stat-number streak-fire">🔥 ${streakDays}</div>
        <div class="stat-label">Current Streak</div>
      </div>

      <p>
        A quick login is all it takes to keep your streak alive.
        Don't lose all that progress!
      </p>

      <p style="text-align: center;">
        <a href="${EMAIL_CONFIG.appUrl}/dashboard" class="button">
          Save My Streak →
        </a>
      </p>

      <div class="divider"></div>

      <p style="font-size: 14px; color: #94a3b8;">
        💡 Consider buying a Streak Freeze (300 CorpsCoin) for protection when you can't log in.
      </p>
    </div>
  `;

  return emailWrapper(content, `Your ${streakDays}-day streak expires in ${Math.floor(hoursRemaining)} hours!`);
}

/**
 * Streak broken email template
 */
function streakBrokenEmailTemplate({ username, previousStreak }) {
  const content = `
    <div class="content">
      <h2>Your Streak Has Reset</h2>
      <p>
        Hey ${username}, your ${previousStreak}-day streak has ended.
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
 * Weekly digest email template
 */
function weeklyDigestEmailTemplate({
  username,
  weekNumber,
  rankChange,
  currentRank,
  totalScore,
  topPerformer,
  upcomingMatchup,
  streakDays,
}) {
  const rankChangeText = rankChange > 0
    ? `<span style="color: #22c55e;">↑ ${rankChange}</span>`
    : rankChange < 0
      ? `<span style="color: #ef4444;">↓ ${Math.abs(rankChange)}</span>`
      : `<span style="color: #94a3b8;">—</span>`;

  const content = `
    <div class="content">
      <h2>Your Week ${weekNumber} Recap 📊</h2>
      <p>
        Hey ${username}, here's how you performed this week:
      </p>

      <div style="display: flex; gap: 16px; flex-wrap: wrap;">
        <div class="stat-box" style="flex: 1; min-width: 120px;">
          <div class="stat-number">#${currentRank}</div>
          <div class="stat-label">Overall Rank ${rankChangeText}</div>
        </div>

        <div class="stat-box" style="flex: 1; min-width: 120px;">
          <div class="stat-number">${totalScore.toFixed(1)}</div>
          <div class="stat-label">Season Points</div>
        </div>
      </div>

      ${topPerformer ? `
      <div class="stat-box">
        <p style="margin: 0; color: #94a3b8;">🏆 Top Performer</p>
        <p style="margin: 8px 0 0; font-size: 18px; font-weight: 600; color: #ffffff;">
          ${topPerformer.captionName}: ${topPerformer.score.toFixed(2)} pts
        </p>
      </div>
      ` : ''}

      ${streakDays > 0 ? `
      <p style="text-align: center;">
        <span style="font-size: 24px;">🔥</span>
        <span style="color: #f97316; font-weight: 600;">${streakDays}-day streak</span>
      </p>
      ` : ''}

      ${upcomingMatchup ? `
      <div class="divider"></div>
      <h3 style="color: #ffffff; margin-bottom: 12px;">Next Week Preview</h3>
      <p>
        <strong>Matchup:</strong> vs ${upcomingMatchup.opponentName}
        ${upcomingMatchup.isRival ? '<span style="color: #f97316;"> ⚔️ Rivalry</span>' : ''}
      </p>
      ` : ''}

      <p style="text-align: center;">
        <a href="${EMAIL_CONFIG.appUrl}/dashboard" class="button">
          View Full Stats →
        </a>
      </p>
    </div>
  `;

  return emailWrapper(content, `Week ${weekNumber} Recap: Rank #${currentRank} ${rankChange > 0 ? '(↑' + rankChange + ')' : ''}`);
}

/**
 * Win-back campaign email template (7 days inactive)
 */
function winBackEmailTemplate({ username, daysMissed, streakLost, corpsCoinBalance }) {
  const content = `
    <div class="content">
      <h2>We Miss You, ${username}! 💔</h2>
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
 * Lineup reminder email template
 */
function lineupReminderEmailTemplate({ username, corpsName, showName, deadline }) {
  const content = `
    <div class="content">
      <h2>Set Your Lineup for ${showName}!</h2>
      <p>
        Hey ${username}, ${corpsName} needs your attention!
      </p>

      <div class="stat-box">
        <p style="margin: 0; color: #f97316; font-weight: 600;">Deadline: ${deadline}</p>
        <p style="margin: 8px 0 0; color: #94a3b8;">Don't miss your chance to compete</p>
      </div>

      <p>
        Make sure your lineup is optimized for the best possible score.
      </p>

      <p style="text-align: center;">
        <a href="${EMAIL_CONFIG.appUrl}/dashboard" class="button">
          Set Lineup →
        </a>
      </p>
    </div>
  `;

  return emailWrapper(content, `Reminder: Set your lineup for ${showName} before ${deadline}`);
}

/**
 * League activity email template
 */
function leagueActivityEmailTemplate({ username, leagueName, activityType, activityDetails }) {
  const activityMessages = {
    matchup_result: `Your matchup results are in!`,
    trade_proposal: `You have a new trade proposal`,
    member_joined: `A new member joined your league`,
    standings_change: `League standings have changed`,
  };

  const content = `
    <div class="content">
      <h2>${leagueName}</h2>
      <p>
        Hey ${username}, ${activityMessages[activityType] || 'there\'s league activity!'}
      </p>

      <div class="stat-box">
        <p style="margin: 0;">${activityDetails}</p>
      </div>

      <p style="text-align: center;">
        <a href="${EMAIL_CONFIG.appUrl}/leagues" class="button">
          View League →
        </a>
      </p>
    </div>
  `;

  return emailWrapper(content, `${leagueName}: ${activityMessages[activityType] || 'New activity'}`);
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
        Congratulations ${username}! You've reached an incredible milestone.
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
 * Send streak at risk email
 */
async function sendStreakAtRiskEmail(email, username, streakDays, hoursRemaining) {
  const html = streakAtRiskEmailTemplate({ username, streakDays, hoursRemaining });
  return sendEmail({
    to: email,
    subject: `⚠️ Your ${streakDays}-day streak expires in ${Math.floor(hoursRemaining)} hours!`,
    html,
    emailType: EMAIL_TYPES.STREAK_AT_RISK,
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
 * Send weekly digest email
 */
async function sendWeeklyDigestEmail(email, digestData) {
  const html = weeklyDigestEmailTemplate(digestData);
  return sendEmail({
    to: email,
    subject: `📊 Your Week ${digestData.weekNumber} Recap`,
    html,
    emailType: EMAIL_TYPES.WEEKLY_DIGEST,
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
 * Send lineup reminder email
 */
async function sendLineupReminderEmail(email, username, corpsName, showName, deadline) {
  const html = lineupReminderEmailTemplate({ username, corpsName, showName, deadline });
  return sendEmail({
    to: email,
    subject: `⏰ Set your lineup for ${showName}!`,
    html,
    emailType: EMAIL_TYPES.LINEUP_REMINDER,
  });
}

/**
 * Send league activity email
 */
async function sendLeagueActivityEmail(email, username, leagueName, activityType, activityDetails) {
  const html = leagueActivityEmailTemplate({ username, leagueName, activityType, activityDetails });
  return sendEmail({
    to: email,
    subject: `${leagueName}: New activity`,
    html,
    emailType: EMAIL_TYPES.LEAGUE_ACTIVITY,
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
// EXPORTS
// =============================================================================

module.exports = {
  // Configuration
  EMAIL_TYPES,
  EMAIL_CONFIG,
  sendgridApiKey,

  // Core function
  sendEmail,

  // Email senders
  sendWelcomeEmail,
  sendStreakAtRiskEmail,
  sendStreakBrokenEmail,
  sendWeeklyDigestEmail,
  sendWinBackEmail,
  sendLineupReminderEmail,
  sendLeagueActivityEmail,
  sendMilestoneEmail,

  // Templates (for testing)
  welcomeEmailTemplate,
  streakAtRiskEmailTemplate,
  weeklyDigestEmailTemplate,
  winBackEmailTemplate,
};
