/**
 * Scheduled Push Notification Functions
 * Periodic jobs for sending push notifications
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { paths } = require("../helpers/paths");
const {
  sendShowReminderPush,
  sendMatchupStartPush,
  sendPushNotification,
  PUSH_TYPES,
} = require("../helpers/pushService");
const { getCurrentSeasonWeek, getCompletedCalendarDay, toCompetitionDay } = require("../helpers/gameDay");
const { FANTASY_CLASSES } = require("../helpers/classRegistry");
const { buildScoreDropPushes } = require("../helpers/scoreDrop");
const { getLineupLockContext, buildLineupLockPushes } = require("../helpers/lineupReminders");

/**
 * Send show reminder push notifications
 * Runs every hour to check for shows starting soon
 */
exports.showReminderPushJob = onSchedule(
  {
    schedule: "every 1 hours",
    timeZone: "America/New_York",
    // Scans every in-season profile and sends pushes one-by-one — the default
    // 60s timeout would cut the job off mid-scan as the user base grows. 540s
    // matches the scoring jobs (see dailyProcessors.js).
    timeoutSeconds: 540,
    memory: "256MiB",
  },
  async () => {
    logger.info("Running show reminder push notification job");

    const now = new Date();

    // Look for shows starting in 1-2 hours (based on REAL start time).
    const reminderStart = new Date(now.getTime() + 1 * 60 * 60 * 1000);
    const reminderEnd = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    try {
      const db = admin.firestore();

      // Get current season
      const seasonDoc = await db.doc("game-settings/season").get();
      const season = seasonDoc.data();

      if (!season?.seasonUid) {
        logger.info("No active season, skipping show reminders");
        return;
      }

      // Source shows from the real schedule (schedules/{seasonId}.competitions),
      // which now carries scraped `startsAt` timing. Reminders key off startsAt,
      // NOT the midnight `date`, so they fire at real showtime.
      const scheduleDoc = await db.doc(`schedules/${season.seasonUid}`).get();
      const competitions = scheduleDoc.exists ? (scheduleDoc.data().competitions || []) : [];

      // Shows whose real start falls in the 1-2h reminder window.
      const startingSoon = competitions.filter((comp) => {
        if (!comp.startsAt) return false;
        const startsAt = new Date(comp.startsAt);
        return startsAt >= reminderStart && startsAt <= reminderEnd;
      });

      if (startingSoon.length === 0) {
        logger.info("No shows starting soon (by real start time)");
        return;
      }

      // Index the starting-soon shows by day + normalized name so we can match
      // directors' selectedShows snapshots against them.
      const normalize = (name) => String(name || "").toLowerCase().replace(/\s+/g, " ").trim();
      const soonByKey = new Map();
      for (const comp of startingSoon) {
        const hoursUntil = Math.max(
          1,
          Math.round((new Date(comp.startsAt).getTime() - now.getTime()) / (60 * 60 * 1000))
        );
        soonByKey.set(`${comp.day}::${normalize(comp.name)}`, { name: comp.name, hoursUntil });
      }

      // Find directors in this season (indexed collectionGroup query — same pattern
      // scoring.js uses). This only runs when shows are actually starting soon.
      const profilesSnapshot = await db
        .collectionGroup("profile")
        .where("activeSeasonId", "==", season.seasonUid)
        .get();

      let totalSent = 0;
      const CORPS_CLASSES = FANTASY_CLASSES;

      for (const profileDoc of profilesSnapshot.docs) {
        // profile/data lives under artifacts/{ns}/users/{uid}/profile/data
        const uid = profileDoc.ref.parent.parent?.id;
        if (!uid) continue;
        const profile = profileDoc.data();

        // Collect this director's selected shows that are starting soon (dedupe so
        // a director entering the same show in multiple classes gets one reminder).
        const notified = new Set();
        for (const corpsClass of CORPS_CLASSES) {
          const selectedShows = profile.corps?.[corpsClass]?.selectedShows || {};
          for (const weekShows of Object.values(selectedShows)) {
            if (!Array.isArray(weekShows)) continue;
            for (const sel of weekShows) {
              const key = `${sel.day}::${normalize(sel.eventName || sel.name)}`;
              const soon = soonByKey.get(key);
              if (soon && !notified.has(key)) {
                notified.add(key);
                const sent = await sendShowReminderPush(uid, soon.name, soon.hoursUntil);
                if (sent) totalSent++;
              }
            }
          }
        }
      }

      logger.info(
        `Show reminder push job complete. ${startingSoon.length} show(s) starting soon, ` +
        `sent ${totalSent} notifications.`
      );
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
    const CORPS_CLASSES = FANTASY_CLASSES;

    try {
      // Compute the current competition week from the schedule dates — the
      // same math the matchup generator uses. (This job used to read a
      // season.currentWeek field that nothing ever wrote, so it always
      // early-returned and no matchup push was ever sent.)
      const seasonDoc = await db.doc("game-settings/season").get();
      const season = seasonDoc.exists ? seasonDoc.data() : null;
      const currentWeek = season ? getCurrentSeasonWeek(season) : null;

      if (!currentWeek || currentWeek < 1 || currentWeek > 7) {
        logger.info("No active season week, skipping matchup notifications");
        return;
      }

      logger.info(`Sending notifications for week ${currentWeek} matchups`);

      // Get all active leagues
      const leaguesSnapshot = await db
        .collection(paths.leagues())
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
          .doc(paths.leagueMatchupWeek(leagueDoc.id, currentWeek))
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
        db.doc(paths.userProfile(uid))
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

/**
 * Send "scores are in" push notifications for last night's score drop.
 *
 * Runs at 8:00 AM ET — a humane hour, not the 2 AM scoring moment — and
 * notifies exactly the directors who performed last night (they appear in
 * the day's fantasy_recaps doc). Ranked-class directors get their score and
 * nightly placement; SoundSport directors get a score-free message (ratings
 * are never revealed). Because getCompletedCalendarDay uses the 2 AM ET
 * game-day reset, 8 AM still resolves to the day the 2 AM jobs just scored.
 *
 * If scoring failed or it was a dark day, the recap doc doesn't exist and
 * the job exits without sending anything.
 */
exports.scoreDropPushJob = onSchedule(
  {
    schedule: "every day 08:00",
    timeZone: "America/New_York",
    // One push per director who performed last night — same scan-and-send
    // scaling rationale as showReminderPushJob above.
    timeoutSeconds: 540,
    memory: "256MiB",
  },
  async () => {
    logger.info("Running score-drop push notification job");

    try {
      const db = admin.firestore();

      const seasonDoc = await db.doc("game-settings/season").get();
      const season = seasonDoc.exists ? seasonDoc.data() : null;
      if (!season?.seasonUid || !season?.schedule?.startDate) {
        logger.info("No active season, skipping score-drop pushes");
        return;
      }

      // Same scored-day derivation as the nightly stages: live seasons
      // offset by spring training; off-seasons don't have one.
      const calendarDay = getCompletedCalendarDay(season.schedule.startDate.toDate());
      const scoredDay = toCompetitionDay(calendarDay, season);

      if (scoredDay < 1 || scoredDay > 49) {
        logger.info(`Day ${scoredDay} is outside the competition period, skipping`);
        return;
      }

      const recapSnap = await db.doc(`fantasy_recaps/${season.seasonUid}/days/${scoredDay}`).get();
      if (!recapSnap.exists) {
        logger.info(`No recap for day ${scoredDay} (dark day or scoring failed), skipping`);
        return;
      }

      const pushes = buildScoreDropPushes({ dailyRecap: recapSnap.data(), scoredDay });

      const PARALLEL_LIMIT = 25;
      let totalSent = 0;
      for (let i = 0; i < pushes.length; i += PARALLEL_LIMIT) {
        const chunk = pushes.slice(i, i + PARALLEL_LIMIT);
        const results = await Promise.allSettled(
          chunk.map((push) =>
            sendPushNotification(
              push.uid,
              { title: push.title, body: push.body, url: push.url },
              PUSH_TYPES.SCORE_UPDATE,
              push.data
            )
          )
        );
        totalSent += results.filter((r) => r.status === "fulfilled" && r.value === true).length;
      }

      logger.info(
        `Score-drop push job complete. Day ${scoredDay}: sent ${totalSent} of ` +
          `${pushes.length} candidate notifications.`
      );
    } catch (error) {
      logger.error("Error in score-drop push job:", error);
    }
  }
);

/**
 * Send lineup-deadline reminder push notifications.
 *
 * Runs daily at 4:00 PM ET; helpers/lineupReminders.js decides whether a
 * caption-change lock lands tonight (the ~8 PM ET day boundary) and, if so,
 * which directors still have changes to lose: the end of Day 14's unlimited
 * period, the Saturday closes of days 21-42, and each Championship Week
 * day's close for the classes still competing. Directors with no changes
 * left are never pinged, and on non-lock days the job exits before touching
 * any profile.
 */
exports.lineupLockReminderPushJob = onSchedule(
  {
    schedule: "every day 16:00",
    timeZone: "America/New_York",
    // Scans every in-season profile on lock nights — same scaling rationale
    // as showReminderPushJob above.
    timeoutSeconds: 540,
    memory: "256MiB",
  },
  async () => {
    logger.info("Running lineup lock reminder push job");

    try {
      const db = admin.firestore();

      const seasonDoc = await db.doc("game-settings/season").get();
      const season = seasonDoc.exists ? seasonDoc.data() : null;
      if (!season?.seasonUid || !season?.schedule?.startDate) {
        logger.info("No active season, skipping lineup reminders");
        return;
      }

      const context = getLineupLockContext(season);
      if (!context) {
        logger.info("No caption-change lock tonight, skipping lineup reminders");
        return;
      }

      const profilesSnapshot = await db
        .collectionGroup("profile")
        .where("activeSeasonId", "==", season.seasonUid)
        .get();

      const profiles = profilesSnapshot.docs.map((doc) => ({
        uid: doc.ref.parent.parent?.id,
        corps: doc.data().corps || {},
      }));

      const pushes = buildLineupLockPushes(context, profiles, season.seasonUid);

      const PARALLEL_LIMIT = 25;
      let totalSent = 0;
      for (let i = 0; i < pushes.length; i += PARALLEL_LIMIT) {
        const chunk = pushes.slice(i, i + PARALLEL_LIMIT);
        const results = await Promise.allSettled(
          chunk.map((push) =>
            sendPushNotification(
              push.uid,
              { title: push.title, body: push.body, url: push.url },
              PUSH_TYPES.LINEUP_REMINDER,
              push.data
            )
          )
        );
        totalSent += results.filter((r) => r.status === "fulfilled" && r.value === true).length;
      }

      logger.info(
        `Lineup lock reminder job complete (${context.phase}, locks ${context.lockTimeLabel}): ` +
          `sent ${totalSent} of ${pushes.length} candidate notifications.`
      );
    } catch (error) {
      logger.error("Error in lineup lock reminder push job:", error);
    }
  }
);
