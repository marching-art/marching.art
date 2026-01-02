/**
 * Scheduled Email Notification Functions
 * Handles automated email campaigns for user retention and engagement
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { getDb, dataNamespaceParam } = require("../config");
const {
  sendStreakAtRiskEmail,
  sendStreakBrokenEmail,
  sendWeeklyDigestEmail,
  sendWinBackEmail,
  brevoApiKey,
  EMAIL_TYPES,
} = require("../helpers/emailService");

// Batch size for processing users
const BATCH_SIZE = 100;
// Concurrency limit for parallel email processing within a batch
const PARALLEL_LIMIT = 25;

/**
 * Check if user has opted into a specific email type
 * Default to true for most emails if no preferences set
 */
function shouldSendEmail(profile, emailType) {
  const emailPreferences = profile.settings?.emailPreferences || {};

  // Default preferences (opt-in by default for engagement emails)
  const defaults = {
    [EMAIL_TYPES.WELCOME]: true,
    [EMAIL_TYPES.STREAK_AT_RISK]: true,
    [EMAIL_TYPES.STREAK_BROKEN]: true,
    [EMAIL_TYPES.WEEKLY_DIGEST]: true,
    [EMAIL_TYPES.WIN_BACK]: true,
    [EMAIL_TYPES.LINEUP_REMINDER]: true,
    [EMAIL_TYPES.LEAGUE_ACTIVITY]: true,
    [EMAIL_TYPES.MILESTONE_ACHIEVED]: true,
  };

  // If user has explicitly set all emails to false, respect that
  if (emailPreferences.allEmails === false) {
    return false;
  }

  // Check specific preference or use default
  return emailPreferences[emailType] ?? defaults[emailType] ?? true;
}

/**
 * Get user email from Firebase Auth
 */
async function getUserEmail(uid) {
  try {
    const userRecord = await admin.auth().getUser(uid);
    return userRecord.email;
  } catch (error) {
    logger.warn(`Could not get email for user ${uid}:`, error.message);
    return null;
  }
}

/**
 * Track that an email was sent to prevent duplicates
 */
async function trackEmailSent(db, uid, emailType, metadata = {}) {
  const namespace = dataNamespaceParam.value();
  const emailLogRef = db.collection(`artifacts/${namespace}/users/${uid}/email_log`).doc();

  await emailLogRef.set({
    emailType,
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
    ...metadata,
  });
}

/**
 * Check if email was recently sent (within cooldown period)
 */
async function wasEmailRecentlySent(db, uid, emailType, cooldownHours = 24) {
  const namespace = dataNamespaceParam.value();
  const cooldownTime = new Date(Date.now() - cooldownHours * 60 * 60 * 1000);

  const recentEmails = await db
    .collection(`artifacts/${namespace}/users/${uid}/email_log`)
    .where("emailType", "==", emailType)
    .where("sentAt", ">=", cooldownTime)
    .limit(1)
    .get();

  return !recentEmails.empty;
}

// =============================================================================
// STREAK AT RISK EMAIL (Runs hourly)
// =============================================================================

/**
 * Send emails to users whose streaks are at risk (18-24 hours since last login)
 * Runs every hour to catch users in the 6-hour warning window
 */
exports.streakAtRiskEmailJob = onSchedule(
  {
    schedule: "0 * * * *", // Every hour at :00
    timeZone: "America/New_York",
    secrets: [brevoApiKey],
  },
  async () => {
    const db = getDb();
    const namespace = dataNamespaceParam.value();
    const now = new Date();

    logger.info("Starting streak at risk email job...");

    // Calculate time window for at-risk users
    // At risk = last login was 18-24 hours ago
    const atRiskStart = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
    const atRiskEnd = new Date(now.getTime() - 18 * 60 * 60 * 1000); // 18 hours ago

    let processed = 0;
    let sent = 0;
    let skipped = 0;
    let lastDoc = null;

    try {
      do {
        // Query users with streaks who logged in during the at-risk window
        let query = db
          .collectionGroup("profile")
          .where("engagement.loginStreak", ">", 0)
          .where("engagement.lastLogin", ">=", atRiskStart)
          .where("engagement.lastLogin", "<=", atRiskEnd)
          .limit(BATCH_SIZE);

        if (lastDoc) {
          query = query.startAfter(lastDoc);
        }

        const snapshot = await query.get();

        if (snapshot.empty) {
          break;
        }

        lastDoc = snapshot.docs[snapshot.docs.length - 1];

        // OPTIMIZATION: Process users in parallel chunks instead of sequentially
        const processUser = async (doc) => {
          const profile = doc.data();
          const uid = doc.ref.parent.parent.id;

          // Check if user has active streak freeze
          const freezeUntil = profile.engagement?.streakFreezeUntil?.toDate?.() ||
            (profile.engagement?.streakFreezeUntil ? new Date(profile.engagement.streakFreezeUntil) : null);

          if (freezeUntil && now < freezeUntil) {
            return { status: 'skipped', reason: 'freeze' };
          }

          // Check email preferences
          if (!shouldSendEmail(profile, EMAIL_TYPES.STREAK_AT_RISK)) {
            return { status: 'skipped', reason: 'preferences' };
          }

          // OPTIMIZATION: Parallelize the email check and user email fetch
          const [recentlySent, email] = await Promise.all([
            wasEmailRecentlySent(db, uid, EMAIL_TYPES.STREAK_AT_RISK, 12),
            getUserEmail(uid)
          ]);

          if (recentlySent) {
            return { status: 'skipped', reason: 'recently_sent' };
          }

          if (!email) {
            return { status: 'skipped', reason: 'no_email' };
          }

          // Calculate hours remaining
          const lastLogin = profile.engagement.lastLogin?.toDate?.() ||
            new Date(profile.engagement.lastLogin);
          const hoursRemaining = 24 - ((now - lastLogin) / (1000 * 60 * 60));

          // Send email
          const success = await sendStreakAtRiskEmail(
            email,
            profile.username || "Director",
            profile.engagement.loginStreak,
            hoursRemaining
          );

          if (success) {
            await trackEmailSent(db, uid, EMAIL_TYPES.STREAK_AT_RISK, {
              streakDays: profile.engagement.loginStreak,
              hoursRemaining: Math.floor(hoursRemaining),
            });
            return { status: 'sent' };
          }

          return { status: 'failed' };
        };

        // Process batch in parallel chunks
        for (let i = 0; i < snapshot.docs.length; i += PARALLEL_LIMIT) {
          const chunk = snapshot.docs.slice(i, i + PARALLEL_LIMIT);
          const results = await Promise.allSettled(chunk.map(processUser));

          for (const result of results) {
            processed++;
            if (result.status === 'fulfilled') {
              if (result.value.status === 'sent') sent++;
              else if (result.value.status === 'skipped') skipped++;
            } else {
              skipped++; // Count errors as skipped
            }
          }
        }
      } while (true);

      logger.info(`Streak at risk job complete: ${processed} processed, ${sent} sent, ${skipped} skipped`);
    } catch (error) {
      logger.error("Error in streak at risk email job:", error);
      throw error;
    }
  }
);

// =============================================================================
// WEEKLY DIGEST EMAIL (Runs every Sunday at 10 AM)
// =============================================================================

/**
 * Send weekly digest emails summarizing user performance
 */
exports.weeklyDigestEmailJob = onSchedule(
  {
    schedule: "0 10 * * 0", // Every Sunday at 10 AM
    timeZone: "America/New_York",
    secrets: [brevoApiKey],
  },
  async () => {
    const db = getDb();
    const namespace = dataNamespaceParam.value();

    logger.info("Starting weekly digest email job...");

    // Get current season info
    const seasonDoc = await db.doc("game-settings/season").get();
    const seasonData = seasonDoc.exists ? seasonDoc.data() : null;
    const currentWeek = seasonData?.currentWeek || 1;

    let processed = 0;
    let sent = 0;
    let skipped = 0;
    let lastDoc = null;

    try {
      do {
        // Query all active users (logged in within last 30 days)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        let query = db
          .collectionGroup("profile")
          .where("engagement.lastLogin", ">=", thirtyDaysAgo)
          .limit(BATCH_SIZE);

        if (lastDoc) {
          query = query.startAfter(lastDoc);
        }

        const snapshot = await query.get();

        if (snapshot.empty) {
          break;
        }

        lastDoc = snapshot.docs[snapshot.docs.length - 1];

        // OPTIMIZATION: Process users in parallel chunks instead of sequentially
        const processUser = async (doc) => {
          const profile = doc.data();
          const uid = doc.ref.parent.parent.id;

          // Check email preferences
          if (!shouldSendEmail(profile, EMAIL_TYPES.WEEKLY_DIGEST)) {
            return { status: 'skipped', reason: 'preferences' };
          }

          // Get user email
          const email = await getUserEmail(uid);
          if (!email) {
            return { status: 'skipped', reason: 'no_email' };
          }

          // Calculate weekly stats
          const corps = profile.corps || {};
          const totalScore = Object.values(corps).reduce(
            (sum, c) => sum + (c?.totalSeasonScore || 0),
            0
          );

          // Find top performer (simplified - could be enhanced)
          let topPerformer = null;
          for (const [, corpsData] of Object.entries(corps)) {
            if (corpsData?.lineup) {
              for (const [caption, slot] of Object.entries(corpsData.lineup)) {
                if (slot?.rating && (!topPerformer || slot.rating > topPerformer.score)) {
                  topPerformer = {
                    captionName: slot.staffName || caption,
                    score: slot.rating,
                  };
                }
              }
            }
          }

          // Build digest data
          const digestData = {
            username: profile.username || "Director",
            weekNumber: currentWeek,
            rankChange: profile.weeklyRankChange || 0,
            currentRank: profile.globalRank || 0,
            totalScore,
            topPerformer,
            streakDays: profile.engagement?.loginStreak || 0,
            upcomingMatchup: null, // Could be enhanced to fetch matchup data
          };

          // Send email
          const success = await sendWeeklyDigestEmail(email, digestData);

          if (success) {
            await trackEmailSent(db, uid, EMAIL_TYPES.WEEKLY_DIGEST, {
              week: currentWeek,
            });
            return { status: 'sent' };
          }

          return { status: 'failed' };
        };

        // Process batch in parallel chunks
        for (let i = 0; i < snapshot.docs.length; i += PARALLEL_LIMIT) {
          const chunk = snapshot.docs.slice(i, i + PARALLEL_LIMIT);
          const results = await Promise.allSettled(chunk.map(processUser));

          for (const result of results) {
            processed++;
            if (result.status === 'fulfilled') {
              if (result.value.status === 'sent') sent++;
              else if (result.value.status === 'skipped') skipped++;
            } else {
              skipped++; // Count errors as skipped
            }
          }
        }
      } while (true);

      logger.info(`Weekly digest job complete: ${processed} processed, ${sent} sent, ${skipped} skipped`);
    } catch (error) {
      logger.error("Error in weekly digest email job:", error);
      throw error;
    }
  }
);

// =============================================================================
// WIN-BACK CAMPAIGN (Runs daily at 9 AM)
// =============================================================================

/**
 * Send win-back emails to users inactive for 7+ days
 */
exports.winBackEmailJob = onSchedule(
  {
    schedule: "0 9 * * *", // Every day at 9 AM
    timeZone: "America/New_York",
    secrets: [brevoApiKey],
  },
  async () => {
    const db = getDb();
    const namespace = dataNamespaceParam.value();
    const now = new Date();

    logger.info("Starting win-back email job...");

    // Target users who last logged in 7-14 days ago
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    let processed = 0;
    let sent = 0;
    let skipped = 0;
    let lastDoc = null;

    try {
      do {
        let query = db
          .collectionGroup("profile")
          .where("engagement.lastLogin", ">=", fourteenDaysAgo)
          .where("engagement.lastLogin", "<=", sevenDaysAgo)
          .limit(BATCH_SIZE);

        if (lastDoc) {
          query = query.startAfter(lastDoc);
        }

        const snapshot = await query.get();

        if (snapshot.empty) {
          break;
        }

        lastDoc = snapshot.docs[snapshot.docs.length - 1];

        // OPTIMIZATION: Process users in parallel chunks instead of sequentially
        const processUser = async (doc) => {
          const profile = doc.data();
          const uid = doc.ref.parent.parent.id;

          // Check email preferences
          if (!shouldSendEmail(profile, EMAIL_TYPES.WIN_BACK)) {
            return { status: 'skipped', reason: 'preferences' };
          }

          // OPTIMIZATION: Parallelize the email check and user email fetch
          const [recentlySent, email] = await Promise.all([
            wasEmailRecentlySent(db, uid, EMAIL_TYPES.WIN_BACK, 7 * 24),
            getUserEmail(uid)
          ]);

          if (recentlySent) {
            return { status: 'skipped', reason: 'recently_sent' };
          }

          if (!email) {
            return { status: 'skipped', reason: 'no_email' };
          }

          // Calculate days missed
          const lastLogin = profile.engagement?.lastLogin?.toDate?.() ||
            (profile.engagement?.lastLogin ? new Date(profile.engagement.lastLogin) : null);
          const daysMissed = lastLogin
            ? Math.floor((now - lastLogin) / (1000 * 60 * 60 * 24))
            : 7;

          // Get lost streak (from before they went inactive)
          const streakLost = profile.engagement?.loginStreak || 0;

          // Send email
          const success = await sendWinBackEmail(
            email,
            profile.username || "Director",
            daysMissed,
            streakLost,
            profile.corpsCoin || 0
          );

          if (success) {
            await trackEmailSent(db, uid, EMAIL_TYPES.WIN_BACK, {
              daysMissed,
              streakLost,
            });
            return { status: 'sent' };
          }

          return { status: 'failed' };
        };

        // Process batch in parallel chunks
        for (let i = 0; i < snapshot.docs.length; i += PARALLEL_LIMIT) {
          const chunk = snapshot.docs.slice(i, i + PARALLEL_LIMIT);
          const results = await Promise.allSettled(chunk.map(processUser));

          for (const result of results) {
            processed++;
            if (result.status === 'fulfilled') {
              if (result.value.status === 'sent') sent++;
              else if (result.value.status === 'skipped') skipped++;
            } else {
              skipped++; // Count errors as skipped
            }
          }
        }
      } while (true);

      logger.info(`Win-back job complete: ${processed} processed, ${sent} sent, ${skipped} skipped`);
    } catch (error) {
      logger.error("Error in win-back email job:", error);
      throw error;
    }
  }
);

// =============================================================================
// STREAK BROKEN DETECTION (Runs daily at 1 AM)
// =============================================================================

/**
 * Detect users who lost their streaks yesterday and send consolation email
 */
exports.streakBrokenEmailJob = onSchedule(
  {
    schedule: "0 1 * * *", // Every day at 1 AM
    timeZone: "America/New_York",
    secrets: [brevoApiKey],
  },
  async () => {
    const db = getDb();
    const namespace = dataNamespaceParam.value();
    const now = new Date();

    logger.info("Starting streak broken email job...");

    // Find users whose last login was 24-48 hours ago AND had a streak > 3
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    let processed = 0;
    let sent = 0;
    let skipped = 0;
    let lastDoc = null;

    try {
      do {
        let query = db
          .collectionGroup("profile")
          .where("engagement.lastLogin", ">=", twoDaysAgo)
          .where("engagement.lastLogin", "<=", oneDayAgo)
          .where("engagement.loginStreak", ">=", 3) // Only notify if had meaningful streak
          .limit(BATCH_SIZE);

        if (lastDoc) {
          query = query.startAfter(lastDoc);
        }

        const snapshot = await query.get();

        if (snapshot.empty) {
          break;
        }

        lastDoc = snapshot.docs[snapshot.docs.length - 1];

        // OPTIMIZATION: Process users in parallel chunks instead of sequentially
        const processUser = async (doc) => {
          const profile = doc.data();
          const uid = doc.ref.parent.parent.id;

          // Check if user has streak freeze protection
          const freezeUntil = profile.engagement?.streakFreezeUntil?.toDate?.() ||
            (profile.engagement?.streakFreezeUntil ? new Date(profile.engagement.streakFreezeUntil) : null);

          if (freezeUntil && now < freezeUntil) {
            return { status: 'skipped', reason: 'freeze' };
          }

          // Check email preferences
          if (!shouldSendEmail(profile, EMAIL_TYPES.STREAK_BROKEN)) {
            return { status: 'skipped', reason: 'preferences' };
          }

          // OPTIMIZATION: Parallelize the email check and user email fetch
          const [recentlySent, email] = await Promise.all([
            wasEmailRecentlySent(db, uid, EMAIL_TYPES.STREAK_BROKEN, 48),
            getUserEmail(uid)
          ]);

          if (recentlySent) {
            return { status: 'skipped', reason: 'recently_sent' };
          }

          if (!email) {
            return { status: 'skipped', reason: 'no_email' };
          }

          // Send email
          const success = await sendStreakBrokenEmail(
            email,
            profile.username || "Director",
            profile.engagement.loginStreak
          );

          if (success) {
            await trackEmailSent(db, uid, EMAIL_TYPES.STREAK_BROKEN, {
              previousStreak: profile.engagement.loginStreak,
            });
            return { status: 'sent' };
          }

          return { status: 'failed' };
        };

        // Process batch in parallel chunks
        for (let i = 0; i < snapshot.docs.length; i += PARALLEL_LIMIT) {
          const chunk = snapshot.docs.slice(i, i + PARALLEL_LIMIT);
          const results = await Promise.allSettled(chunk.map(processUser));

          for (const result of results) {
            processed++;
            if (result.status === 'fulfilled') {
              if (result.value.status === 'sent') sent++;
              else if (result.value.status === 'skipped') skipped++;
            } else {
              skipped++; // Count errors as skipped
            }
          }
        }
      } while (true);

      logger.info(`Streak broken job complete: ${processed} processed, ${sent} sent, ${skipped} skipped`);
    } catch (error) {
      logger.error("Error in streak broken email job:", error);
      throw error;
    }
  }
);
