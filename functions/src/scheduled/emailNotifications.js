// @ts-nocheck -- grandfathered when functions checkJs landed (functions/tsconfig.json); remove when this file is typed or cleaned up
/**
 * Scheduled Email Notification Functions
 * Handles automated email campaigns for user retention and engagement
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { getDb } = require("../config");
const { paths } = require("../helpers/paths");
const {
  sendStreakBrokenEmail,
  sendRivalContextEmail,
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
  const emailLogRef = db.collection(paths.userEmailLog(uid)).doc();

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
  const cooldownTime = new Date(Date.now() - cooldownHours * 60 * 60 * 1000);

  const recentEmails = await db
    .collection(paths.userEmailLog(uid))
    .where("emailType", "==", emailType)
    .where("sentAt", ">=", cooldownTime)
    .limit(1)
    .get();

  return !recentEmails.empty;
}

// =============================================================================
// WEEKLY RIVAL-CONTEXT EMAIL (Runs every Sunday at 10 AM)
// =============================================================================
//
// Replaces the legacy "weekly digest" with a personalized rival-context email.
// We diff each user's current rivals (written daily by scheduledRivalsUpdate)
// against the snapshot we stored the last time we emailed them. Only users with
// at least one meaningful change event get an email — quiet weeks send nothing.
//
// SoundSport never reveals raw scores; medal-tier transitions are surfaced
// instead. Rival data shape comes from functions/src/scheduled/rivalsComputation.js.

const MAX_EVENTS_PER_EMAIL = 5;

function computeRivalEvents(currentRivals, priorRivals) {
  const events = [];
  if (!currentRivals || typeof currentRivals !== "object") return events;
  const prior = priorRivals && typeof priorRivals === "object" ? priorRivals : {};
  const hasPriorAtAll = Object.values(prior).some(
    (list) => Array.isArray(list) && list.length > 0,
  );

  for (const classKey of Object.keys(currentRivals)) {
    const currentList = currentRivals[classKey] || [];
    const priorList = prior[classKey] || [];
    if (currentList.length === 0) continue;

    const priorByUid = new Map();
    priorList.forEach((r) => priorByUid.set(r.uid, r));

    const currentSample = currentList[0];
    const priorSample = priorList[0];
    const isSoundSport = classKey === "soundSport";

    // User-level: medal tier change (SoundSport) or class rank change (competitive).
    if (isSoundSport) {
      if (
        currentSample?.userMedal &&
        priorSample?.userMedal &&
        currentSample.userMedal !== priorSample.userMedal
      ) {
        const movedUp =
          (currentSample.userMedalRank || 0) > (priorSample.userMedalRank || 0);
        events.push({
          priority: 90,
          color: movedUp ? "#22c55e" : "#ef4444",
          icon: movedUp ? "🥇" : "🎖️",
          title: movedUp
            ? `You moved up to ${currentSample.userMedal}`
            : `Your medal slipped to ${currentSample.userMedal}`,
          detail: `Was ${priorSample.userMedal} last week.`,
        });
      }
    } else if (
      currentSample?.userBucketRank != null &&
      priorSample?.userBucketRank != null &&
      currentSample.userBucketRank !== priorSample.userBucketRank
    ) {
      const movedUp = currentSample.userBucketRank < priorSample.userBucketRank;
      events.push({
        priority: 80,
        color: movedUp ? "#22c55e" : "#ef4444",
        icon: movedUp ? "⬆️" : "⬇️",
        title: movedUp
          ? `Climbed to #${currentSample.userBucketRank} in your class`
          : `Dropped to #${currentSample.userBucketRank} in your class`,
        detail: `Was #${priorSample.userBucketRank} last week.`,
      });
    }

    // Per-rival events (passes, medal transitions, new rivals).
    for (const rival of currentList) {
      const prev = priorByUid.get(rival.uid);
      const rivalIsSoundSport =
        isSoundSport || rival.corpsClass === "soundSport";

      if (!prev) {
        // Suppress "new rival" noise on the first ever run — only flag once
        // we've actually emailed before.
        if (hasPriorAtAll) {
          events.push({
            priority: 30,
            color: "#0057B8",
            icon: "🆕",
            title: `New rival: ${rival.corpsName}`,
            detail: rivalIsSoundSport
              ? `Closest competitor on the medal ladder.`
              : `Now one of your closest scores.`,
          });
        }
        continue;
      }

      if (rivalIsSoundSport) {
        // Medal transition for the rival.
        if (rival.medal && prev.medal && rival.medal !== prev.medal) {
          const movedUp = (rival.medalRank || 0) > (prev.medalRank || 0);
          events.push({
            priority: movedUp ? 60 : 55,
            color: movedUp ? "#eab308" : "#94a3b8",
            icon: "🎖️",
            title: movedUp
              ? `${rival.corpsName} earned ${rival.medal}`
              : `${rival.corpsName} dropped to ${rival.medal}`,
            detail: `Was ${prev.medal}.`,
          });
        }
        // Cross above/below the user's medal tier.
        const prevAhead = (prev.medalRank || 0) > (prev.userMedalRank || 0);
        const nowAhead = (rival.medalRank || 0) > (rival.userMedalRank || 0);
        if (prevAhead !== nowAhead) {
          if (nowAhead) {
            events.push({
              priority: 95,
              color: "#ef4444",
              icon: "⚠️",
              title: `${rival.corpsName} jumped above you`,
              detail: `Their tier (${rival.medal}) is now above yours (${rival.userMedal}).`,
            });
          } else {
            events.push({
              priority: 95,
              color: "#22c55e",
              icon: "🏁",
              title: `You overtook ${rival.corpsName}`,
              detail: `Your tier (${rival.userMedal}) is now above theirs (${rival.medal}).`,
            });
          }
        }
      } else {
        // Competitive: detect a pass via scoreDelta sign flip.
        const prevAhead = (prev.scoreDelta || 0) > 0;
        const nowAhead = (rival.scoreDelta || 0) > 0;
        if (prevAhead !== nowAhead) {
          const margin = Math.abs(rival.scoreDelta || 0);
          if (nowAhead) {
            events.push({
              priority: 95,
              color: "#ef4444",
              icon: "⚠️",
              title: `${rival.corpsName} passed you`,
              detail: `Now ahead by ${margin.toFixed(2)} pts.`,
            });
          } else {
            events.push({
              priority: 95,
              color: "#22c55e",
              icon: "🏁",
              title: `You passed ${rival.corpsName}`,
              detail: `Now ahead by ${margin.toFixed(2)} pts.`,
            });
          }
        }
      }
    }
  }

  events.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  return events.slice(0, MAX_EVENTS_PER_EMAIL);
}

/**
 * Send rival-context emails. Skips users with no rivals data and users whose
 * rivals haven't meaningfully shifted since last week.
 */
exports.weeklyDigestEmailJob = onSchedule(
  {
    schedule: "0 10 * * 0", // Every Sunday at 10 AM
    timeZone: "America/New_York",
    // Unbounded collection-group scan over every active profile — the default
    // 60s timeout would cut the job off mid-scan as the user base grows. 540s
    // matches the scoring jobs (see dailyProcessors.js).
    timeoutSeconds: 540,
    secrets: [brevoApiKey],
  },
  async () => {
    const db = getDb();

    logger.info("Starting weekly rival-context email job...");

    let processed = 0;
    let sent = 0;
    let skipped = 0;
    let noEvents = 0;
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

        const processUser = async (doc) => {
          const profile = doc.data();
          const uid = doc.ref.parent.parent.id;

          if (!shouldSendEmail(profile, EMAIL_TYPES.WEEKLY_DIGEST)) {
            return { status: "skipped", reason: "preferences" };
          }

          const events = computeRivalEvents(
            profile.rivals,
            profile.rivalsSnapshotForEmail,
          );
          if (events.length === 0) {
            return { status: "no_events" };
          }

          // Pre-send dedupe (same email_log guard the other jobs use): the
          // post-send rivalsSnapshotForEmail write is only the diff baseline,
          // so a crash/timeout between send and snapshot would otherwise
          // resend everyone on the retry. 6 days sits safely under the weekly
          // cadence while still allowing next Sunday's send.
          const [recentlySent, email] = await Promise.all([
            wasEmailRecentlySent(db, uid, EMAIL_TYPES.WEEKLY_DIGEST, 6 * 24),
            getUserEmail(uid),
          ]);

          if (recentlySent) {
            return { status: "skipped", reason: "recently_sent" };
          }

          if (!email) {
            return { status: "skipped", reason: "no_email" };
          }

          const headline = events[0].title;
          const success = await sendRivalContextEmail(email, {
            username: profile.username || "Director",
            headline,
            events,
          });

          if (!success) return { status: "failed" };

          // Persist current rivals as the new baseline so next week diffs
          // against what we just emailed.
          await doc.ref.set(
            {
              rivalsSnapshotForEmail: profile.rivals,
              rivalsSnapshotEmailedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
          await trackEmailSent(db, uid, EMAIL_TYPES.WEEKLY_DIGEST, {
            eventCount: events.length,
            headline,
          });

          return { status: "sent" };
        };

        for (let i = 0; i < snapshot.docs.length; i += PARALLEL_LIMIT) {
          const chunk = snapshot.docs.slice(i, i + PARALLEL_LIMIT);
          const results = await Promise.allSettled(chunk.map(processUser));

          for (const result of results) {
            processed++;
            if (result.status === "fulfilled") {
              if (result.value.status === "sent") sent++;
              else if (result.value.status === "no_events") noEvents++;
              else skipped++;
            } else {
              skipped++;
            }
          }
        }
      } while (true);

      logger.info(
        `Rival-context email job complete: ${processed} processed, ${sent} sent, ${noEvents} quiet weeks, ${skipped} skipped`,
      );
    } catch (error) {
      logger.error("Error in rival-context email job:", error);
      throw error;
    }
  },
);

// Exported for unit-testing the diff logic without spinning up the scheduler.
exports._computeRivalEvents = computeRivalEvents;

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
    // Unbounded collection-group scan over every active profile — the default
    // 60s timeout would cut the job off mid-scan as the user base grows. 540s
    // matches the scoring jobs (see dailyProcessors.js).
    timeoutSeconds: 540,
    secrets: [brevoApiKey],
  },
  async () => {
    const db = getDb();
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
    // Unbounded collection-group scan over every active profile — the default
    // 60s timeout would cut the job off mid-scan as the user base grows. 540s
    // matches the scoring jobs (see dailyProcessors.js).
    timeoutSeconds: 540,
    secrets: [brevoApiKey],
  },
  async () => {
    const db = getDb();
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
