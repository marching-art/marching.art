/**
 * Scheduled Push Notification Functions
 * Periodic jobs for sending push notifications
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { dataNamespaceParam } = require("../config");
const {
  sendStreakAtRiskPush,
  sendShowReminderPush,
  sendMatchupStartPush,
} = require("../helpers/pushService");

// Hours before streak expiration to send warning
const STREAK_WARNING_HOURS = 6;

/**
 * Send streak at risk push notifications
 * Runs every hour to check for users whose streaks are about to expire
 */
exports.streakAtRiskPushJob = onSchedule(
  {
    schedule: "every 1 hours",
    timeZone: "America/New_York",
    memory: "256MiB",
  },
  async () => {
    logger.info("Running streak at risk push notification job");

    const namespace = dataNamespaceParam.value();
    const now = new Date();

    // Calculate the threshold - users who last logged in 18-24 hours ago
    // (giving them 6 hours warning before 24-hour streak expires)
    const warningStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const warningEnd = new Date(now.getTime() - (24 - STREAK_WARNING_HOURS) * 60 * 60 * 1000);

    try {
      // Query users with active streaks who last logged in within the warning window
      const usersSnapshot = await admin
        .firestore()
        .collection(`artifacts/${namespace}/users`)
        .get();

      let sentCount = 0;

      for (const userDoc of usersSnapshot.docs) {
        const profileDoc = await admin
          .firestore()
          .doc(`artifacts/${namespace}/users/${userDoc.id}/profile/data`)
          .get();

        const profile = profileDoc.data();
        if (!profile?.engagement) continue;

        const { loginStreak, lastLogin } = profile.engagement;

        // Skip users without a streak
        if (!loginStreak || loginStreak <= 0) continue;

        // Check if user hasn't logged in today and is in the warning window
        const lastLoginDate = new Date(lastLogin);
        const today = now.toISOString().split("T")[0];
        const lastLoginDay = lastLoginDate.toISOString().split("T")[0];

        // Skip if user already logged in today
        if (today === lastLoginDay) continue;

        // Check if within warning window
        if (lastLoginDate > warningEnd || lastLoginDate < warningStart) continue;

        // Check if we already sent a warning today
        const lastWarning = profile.settings?.lastStreakWarningPush;
        if (lastWarning && lastWarning.startsWith(today)) continue;

        // Calculate hours remaining
        const msRemaining = 24 * 60 * 60 * 1000 - (now - lastLoginDate);
        const hoursRemaining = msRemaining / (60 * 60 * 1000);

        if (hoursRemaining > 0 && hoursRemaining <= STREAK_WARNING_HOURS) {
          const sent = await sendStreakAtRiskPush(userDoc.id, loginStreak, hoursRemaining);

          if (sent) {
            sentCount++;
            // Mark that we sent a warning today
            await profileDoc.ref.update({
              "settings.lastStreakWarningPush": now.toISOString(),
            });
          }
        }
      }

      logger.info(`Streak at risk push job complete. Sent ${sentCount} notifications.`);
    } catch (error) {
      logger.error("Error in streak at risk push job:", error);
    }
  }
);

/**
 * Send show reminder push notifications
 * Runs every hour to check for shows starting soon
 */
exports.showReminderPushJob = onSchedule(
  {
    schedule: "every 1 hours",
    timeZone: "America/New_York",
    memory: "256MiB",
  },
  async () => {
    logger.info("Running show reminder push notification job");

    const namespace = dataNamespaceParam.value();
    const now = new Date();

    // Look for shows starting in 1-2 hours
    const reminderStart = new Date(now.getTime() + 1 * 60 * 60 * 1000);
    const reminderEnd = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    try {
      // Get current season
      const seasonDoc = await admin.firestore().doc("game-settings/season").get();
      const season = seasonDoc.data();

      if (!season?.seasonUid) {
        logger.info("No active season, skipping show reminders");
        return;
      }

      // Find shows starting soon
      const showsSnapshot = await admin
        .firestore()
        .collection(`seasons/${season.seasonUid}/shows`)
        .where("date", ">=", reminderStart)
        .where("date", "<=", reminderEnd)
        .get();

      if (showsSnapshot.empty) {
        logger.info("No shows starting soon");
        return;
      }

      let totalSent = 0;

      for (const showDoc of showsSnapshot.docs) {
        const show = showDoc.data();
        const showDate = show.date.toDate();
        const hoursUntil = Math.ceil((showDate - now) / (60 * 60 * 1000));

        // Get registrations for this show
        const registrationsSnapshot = await admin
          .firestore()
          .collection(`seasons/${season.seasonUid}/shows/${showDoc.id}/registrations`)
          .get();

        for (const regDoc of registrationsSnapshot.docs) {
          const registration = regDoc.data();
          const userId = registration.userId;

          if (userId) {
            const sent = await sendShowReminderPush(userId, show.eventName, hoursUntil);
            if (sent) totalSent++;
          }
        }
      }

      logger.info(`Show reminder push job complete. Sent ${totalSent} notifications.`);
    } catch (error) {
      logger.error("Error in show reminder push job:", error);
    }
  }
);

/**
 * Send matchup starting push notifications
 * Runs at the start of each week to notify users about their matchups
 */
exports.weeklyMatchupPushJob = onSchedule(
  {
    schedule: "every monday 08:00",
    timeZone: "America/New_York",
    memory: "256MiB",
  },
  async () => {
    logger.info("Running weekly matchup push notification job");

    const namespace = dataNamespaceParam.value();

    try {
      // Get current season week
      const seasonDoc = await admin.firestore().doc("game-settings/season").get();
      const season = seasonDoc.data();

      if (!season?.currentWeek) {
        logger.info("No active season week, skipping matchup notifications");
        return;
      }

      const currentWeek = season.currentWeek;

      // Get all active leagues
      const leaguesSnapshot = await admin
        .firestore()
        .collection(`artifacts/${namespace}/leagues`)
        .get();

      let totalSent = 0;

      for (const leagueDoc of leaguesSnapshot.docs) {
        const league = leagueDoc.data();

        // Get this week's matchups for the league
        const matchupsSnapshot = await admin
          .firestore()
          .collection(`artifacts/${namespace}/leagues/${leagueDoc.id}/matchups`)
          .where("week", "==", currentWeek)
          .where("status", "==", "scheduled")
          .get();

        for (const matchupDoc of matchupsSnapshot.docs) {
          const matchup = matchupDoc.data();
          const { homeUserId, awayUserId } = matchup;

          // Get opponent usernames
          const [homeProfile, awayProfile] = await Promise.all([
            admin.firestore().doc(`artifacts/${namespace}/users/${homeUserId}/profile/data`).get(),
            admin.firestore().doc(`artifacts/${namespace}/users/${awayUserId}/profile/data`).get(),
          ]);

          const homeUsername = homeProfile.data()?.username || "Opponent";
          const awayUsername = awayProfile.data()?.username || "Opponent";

          // Send to both users
          const sent1 = await sendMatchupStartPush(homeUserId, awayUsername, league.name);
          const sent2 = await sendMatchupStartPush(awayUserId, homeUsername, league.name);

          if (sent1) totalSent++;
          if (sent2) totalSent++;
        }
      }

      logger.info(`Weekly matchup push job complete. Sent ${totalSent} notifications.`);
    } catch (error) {
      logger.error("Error in weekly matchup push job:", error);
    }
  }
);
