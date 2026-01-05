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

    const db = admin.firestore();
    const namespace = dataNamespaceParam.value();
    const now = new Date();
    const today = now.toISOString().split("T")[0];

    // Calculate the threshold - users who last logged in 18-24 hours ago
    // (giving them 6 hours warning before 24-hour streak expires)
    const warningStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const warningEnd = new Date(now.getTime() - (24 - STREAK_WARNING_HOURS) * 60 * 60 * 1000);

    try {
      // Step 1: Get all user IDs
      const usersSnapshot = await db
        .collection(`artifacts/${namespace}/users`)
        .get();

      if (usersSnapshot.empty) {
        logger.info("No users found");
        return;
      }

      const userIds = usersSnapshot.docs.map((doc) => doc.id);

      // Step 2: OPTIMIZATION - Batch fetch all profiles in ONE operation
      const profileRefs = userIds.map((uid) =>
        db.doc(`artifacts/${namespace}/users/${uid}/profile/data`)
      );
      const profileDocs = await db.getAll(...profileRefs);

      // Step 3: Process profiles and identify users needing warnings
      const usersToNotify = [];
      profileDocs.forEach((profileDoc, index) => {
        if (!profileDoc.exists) return;

        const profile = profileDoc.data();
        if (!profile?.engagement) return;

        const { loginStreak, lastLogin } = profile.engagement;

        // Skip users without a streak
        if (!loginStreak || loginStreak <= 0) return;

        // Check if user hasn't logged in today and is in the warning window
        const lastLoginDate = new Date(lastLogin);
        const lastLoginDay = lastLoginDate.toISOString().split("T")[0];

        // Skip if user already logged in today
        if (today === lastLoginDay) return;

        // Check if within warning window
        if (lastLoginDate > warningEnd || lastLoginDate < warningStart) return;

        // Check if we already sent a warning today
        const lastWarning = profile.settings?.lastStreakWarningPush;
        if (lastWarning && lastWarning.startsWith(today)) return;

        // Calculate hours remaining
        const msRemaining = 24 * 60 * 60 * 1000 - (now - lastLoginDate);
        const hoursRemaining = msRemaining / (60 * 60 * 1000);

        if (hoursRemaining > 0 && hoursRemaining <= STREAK_WARNING_HOURS) {
          usersToNotify.push({
            userId: userIds[index],
            profileRef: profileDoc.ref,
            loginStreak,
            hoursRemaining,
          });
        }
      });

      // Step 4: Send notifications in parallel chunks
      const PARALLEL_LIMIT = 25;
      let sentCount = 0;

      for (let i = 0; i < usersToNotify.length; i += PARALLEL_LIMIT) {
        const chunk = usersToNotify.slice(i, i + PARALLEL_LIMIT);
        const results = await Promise.allSettled(
          chunk.map(async (user) => {
            const sent = await sendStreakAtRiskPush(
              user.userId,
              user.loginStreak,
              user.hoursRemaining
            );
            if (sent) {
              await user.profileRef.update({
                "settings.lastStreakWarningPush": now.toISOString(),
              });
              return true;
            }
            return false;
          })
        );

        sentCount += results.filter(
          (r) => r.status === "fulfilled" && r.value === true
        ).length;
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

    const db = admin.firestore();
    const namespace = dataNamespaceParam.value();

    try {
      // Get current season week
      const seasonDoc = await db.doc("game-settings/season").get();
      const season = seasonDoc.data();

      if (!season?.currentWeek) {
        logger.info("No active season week, skipping matchup notifications");
        return;
      }

      const currentWeek = season.currentWeek;

      // Get all active leagues
      const leaguesSnapshot = await db
        .collection(`artifacts/${namespace}/leagues`)
        .get();

      // Step 1: Collect all matchups from all leagues first
      const allMatchups = [];
      const allUserIds = new Set();

      for (const leagueDoc of leaguesSnapshot.docs) {
        const league = leagueDoc.data();

        // Get this week's matchups for the league
        const matchupsSnapshot = await db
          .collection(`artifacts/${namespace}/leagues/${leagueDoc.id}/matchups`)
          .where("week", "==", currentWeek)
          .where("status", "==", "scheduled")
          .get();

        for (const matchupDoc of matchupsSnapshot.docs) {
          const matchup = matchupDoc.data();
          allMatchups.push({
            homeUserId: matchup.homeUserId,
            awayUserId: matchup.awayUserId,
            leagueName: league.name,
          });
          allUserIds.add(matchup.homeUserId);
          allUserIds.add(matchup.awayUserId);
        }
      }

      if (allMatchups.length === 0) {
        logger.info("No scheduled matchups found for this week");
        return;
      }

      // Step 2: OPTIMIZATION - Batch fetch ALL profiles in ONE operation
      const userIdsArray = [...allUserIds];
      const profileRefs = userIdsArray.map((uid) =>
        db.doc(`artifacts/${namespace}/users/${uid}/profile/data`)
      );
      const profileDocs = await db.getAll(...profileRefs);

      // Build username map
      const usernameMap = new Map();
      profileDocs.forEach((doc, index) => {
        const username = doc.exists ? doc.data()?.username || "Opponent" : "Opponent";
        usernameMap.set(userIdsArray[index], username);
      });

      // Step 3: Send notifications in parallel chunks
      const PARALLEL_LIMIT = 25;
      let totalSent = 0;

      // Build notification tasks
      const notificationTasks = allMatchups.flatMap((matchup) => [
        {
          userId: matchup.homeUserId,
          opponentName: usernameMap.get(matchup.awayUserId),
          leagueName: matchup.leagueName,
        },
        {
          userId: matchup.awayUserId,
          opponentName: usernameMap.get(matchup.homeUserId),
          leagueName: matchup.leagueName,
        },
      ]);

      for (let i = 0; i < notificationTasks.length; i += PARALLEL_LIMIT) {
        const chunk = notificationTasks.slice(i, i + PARALLEL_LIMIT);
        const results = await Promise.allSettled(
          chunk.map((task) =>
            sendMatchupStartPush(task.userId, task.opponentName, task.leagueName)
          )
        );

        totalSent += results.filter(
          (r) => r.status === "fulfilled" && r.value === true
        ).length;
      }

      logger.info(`Weekly matchup push job complete. Sent ${totalSent} notifications.`);
    } catch (error) {
      logger.error("Error in weekly matchup push job:", error);
    }
  }
);
