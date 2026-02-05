/**
 * Scheduled Push Notification Functions
 * Periodic jobs for sending push notifications
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { dataNamespaceParam } = require("../config");
const {
  sendShowReminderPush,
  sendMatchupStartPush,
} = require("../helpers/pushService");

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
 * Runs Monday 8:00 AM to notify users about their weekly matchups
 *
 * Matchup Schema:
 * - Documents stored as: leagues/{leagueId}/matchups/week-{N}
 * - Contains class-specific arrays: worldClassMatchups, openClassMatchups, etc.
 * - Each matchup has: { pair: [uid1, uid2], completed: boolean, ... }
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
    const CORPS_CLASSES = ['worldClass', 'openClass', 'aClass', 'soundSport'];

    try {
      // Get current season week
      const seasonDoc = await db.doc("game-settings/season").get();
      const season = seasonDoc.data();

      if (!season?.currentWeek) {
        logger.info("No active season week, skipping matchup notifications");
        return;
      }

      const currentWeek = season.currentWeek;
      logger.info(`Sending notifications for week ${currentWeek} matchups`);

      // Get all active leagues
      const leaguesSnapshot = await db
        .collection(`artifacts/${namespace}/leagues`)
        .get();

      if (leaguesSnapshot.empty) {
        logger.info("No leagues found");
        return;
      }

      // Collect all matchups from all leagues
      const allMatchups = [];
      const allUserIds = new Set();

      for (const leagueDoc of leaguesSnapshot.docs) {
        const league = leagueDoc.data();

        // Get this week's matchups document
        const matchupDoc = await db
          .doc(`artifacts/${namespace}/leagues/${leagueDoc.id}/matchups/week-${currentWeek}`)
          .get();

        if (!matchupDoc.exists) continue;

        const matchupData = matchupDoc.data();

        // Extract matchups from each corps class
        for (const corpsClass of CORPS_CLASSES) {
          const classMatchups = matchupData[`${corpsClass}Matchups`] || [];

          for (const matchup of classMatchups) {
            // Skip completed matchups and byes
            if (matchup.completed || !matchup.pair || !matchup.pair[1]) continue;

            const [player1, player2] = matchup.pair;
            if (!player1 || !player2) continue;

            allMatchups.push({
              player1,
              player2,
              leagueName: league.name,
              corpsClass,
            });
            allUserIds.add(player1);
            allUserIds.add(player2);
          }
        }
      }

      if (allMatchups.length === 0) {
        logger.info("No pending matchups found for this week");
        return;
      }

      logger.info(`Found ${allMatchups.length} matchups to notify`);

      // Batch fetch all profiles
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

      // Build notification tasks (notify both players in each matchup)
      const notificationTasks = allMatchups.flatMap((matchup) => [
        {
          userId: matchup.player1,
          opponentName: usernameMap.get(matchup.player2),
          leagueName: matchup.leagueName,
        },
        {
          userId: matchup.player2,
          opponentName: usernameMap.get(matchup.player1),
          leagueName: matchup.leagueName,
        },
      ]);

      // Send notifications in parallel chunks
      const PARALLEL_LIMIT = 25;
      let totalSent = 0;

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
