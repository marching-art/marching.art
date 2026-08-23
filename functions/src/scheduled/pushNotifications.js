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
  sendTakeTheFieldPush,
  PUSH_TYPES,
} = require("../helpers/pushService");
const { buildTakeTheFieldPushes } = require("../helpers/performancePush");
const { getCurrentSeasonWeek, getCompletedCalendarDay, toCompetitionDay } = require("../helpers/gameDay");
const { processAllInPages } = require("../helpers/firestorePaging");
const { FANTASY_CLASSES } = require("../helpers/classRegistry");
const { buildScoreDropPushes } = require("../helpers/scoreDrop");
const { getLineupLockContext, buildLineupLockPushes } = require("../helpers/lineupReminders");
const { createUserNotifications } = require("../helpers/userNotifications");
const { discordAnnouncementsWebhookUrl, postOnce } = require("../helpers/discord");
const { buildLineupLockPayload } = require("../helpers/seasonAnnounce");
const { seasonDisplayName } = require("../helpers/seasonDisplay");

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
      // Only corps.selectedShows is consumed, so project just `corps` instead
      // of pulling full profile docs, and page the scan so it never truncates
      // at a single query's cap (see helpers/firestorePaging).
      const CORPS_CLASSES = FANTASY_CLASSES;

      // Collect every (director, show) reminder first, then send in parallel
      // chunks like the other push jobs — sequential awaits made this job's
      // wall clock scale with (users × selections).
      const reminderTasks = [];
      const profilesQuery = db
        .collectionGroup("profile")
        .where("activeSeasonId", "==", season.seasonUid)
        .select("corps");
      await processAllInPages(profilesQuery, 500, async (profileDoc) => {
        // profile/data lives under artifacts/{ns}/users/{uid}/profile/data
        const uid = profileDoc.ref.parent.parent?.id;
        if (!uid) return;
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
                reminderTasks.push({ uid, name: soon.name, hoursUntil: soon.hoursUntil });
              }
            }
          }
        }
      });

      const PARALLEL_LIMIT = 25;
      let totalSent = 0;
      for (let i = 0; i < reminderTasks.length; i += PARALLEL_LIMIT) {
        const chunk = reminderTasks.slice(i, i + PARALLEL_LIMIT);
        const results = await Promise.allSettled(
          chunk.map((task) => sendShowReminderPush(task.uid, task.name, task.hoursUntil))
        );
        totalSent += results.filter((r) => r.status === "fulfilled" && r.value === true).length;
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
    // Reads every league's matchup doc and sends pushes one-by-one — the
    // default 60s timeout would cut the job off mid-scan as leagues grow. 540s
    // matches the scoring jobs (see dailyProcessors.js).
    timeoutSeconds: 540,
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

      // Batch the per-league matchup reads: one chunked getAll instead of a
      // sequential get() per league.
      const GETALL_CHUNK = 300;
      const leagueDocs = leaguesSnapshot.docs;
      const matchupDocs = [];
      for (let i = 0; i < leagueDocs.length; i += GETALL_CHUNK) {
        const chunk = leagueDocs.slice(i, i + GETALL_CHUNK);
        matchupDocs.push(
          ...(await db.getAll(
            ...chunk.map((leagueDoc) => db.doc(paths.leagueMatchupWeek(leagueDoc.id, currentWeek)))
          ))
        );
      }

      for (let leagueIndex = 0; leagueIndex < leagueDocs.length; leagueIndex++) {
        const league = leagueDocs[leagueIndex].data();
        const matchupDoc = matchupDocs[leagueIndex];

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
              leagueId: leagueDocs[leagueIndex].id,
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

      // Batch fetch all profiles (field mask: only username is consumed, so
      // don't pull the full — large — profile docs over the wire).
      const userIdsArray = [...allUserIds];
      const profileRefs = userIdsArray.map((uid) =>
        db.doc(paths.userProfile(uid))
      );
      const profileDocs = await db.getAll(...profileRefs, { fieldMask: ["username"] });

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
          leagueId: matchup.leagueId,
          leagueName: matchup.leagueName,
        },
        {
          userId: matchup.player2,
          opponentName: usernameMap.get(matchup.player1),
          leagueId: matchup.leagueId,
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

      // In-app inbox copy per matchup participant — same text as the push,
      // best-effort and never failing the job; not gated on pushPreferences
      // (see the score-drop job below for the rationale). Keyed per
      // (week, league) so a retry converges and a director in several
      // leagues still gets one entry per league.
      try {
        const inbox = await createUserNotifications(
          db,
          notificationTasks.map((task) => ({
            uid: task.userId,
            type: "matchup_start",
            title: "Matchup Starting!",
            message: `Your matchup vs ${task.opponentName} in ${task.leagueName} is about to begin!`,
            link: "/leagues",
            leagueId: task.leagueId,
            leagueName: task.leagueName,
            metadata: { week: currentWeek, opponentName: task.opponentName },
            dedupeKey: `matchup_start_w${currentWeek}_${task.leagueId}`,
          }))
        );
        logger.info(`Matchup inbox fan-out: ${inbox.written} written, ${inbox.skipped} skipped`);
      } catch (error) {
        logger.error("Matchup inbox fan-out failed:", error);
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
 * Runs at 8:00 AM ET — a humane hour, not the overnight scoring moment — and
 * notifies exactly the directors who performed last night (they appear in
 * the day's fantasy_recaps doc). Ranked-class directors get their score and
 * nightly placement; SoundSport directors get a score-free message (ratings
 * are never revealed). Because getCompletedCalendarDay uses the 2 AM ET
 * game-day reset, 8 AM resolves to last night's show date — the same day
 * both pipelines score, whether the legacy 2 AM run or the drop dispatcher
 * (which scores that day earlier, between 9 PM and 2:45 AM ET).
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

      // In-app inbox copy of the same message, per recipient — the surface for
      // directors who denied push. Best-effort and isolated (same idiom as the
      // Discord stage): an inbox failure never fails the push job. Deliberately
      // NOT gated on pushPreferences — that is a push-channel opt-out, and no
      // channel-neutral category setting exists (see helpers/userNotifications).
      // dedupeKey makes a scheduler retry overwrite instead of duplicate.
      try {
        const inbox = await createUserNotifications(
          db,
          pushes.map((push) => ({
            uid: push.uid,
            type: "score_drop",
            title: push.title,
            message: push.body,
            // Same destination as the push, tagged so score_drop_return
            // analytics can tell inbox arrivals from push arrivals.
            link: "/scores?src=inbox",
            metadata: push.data,
            dedupeKey: `score_drop_${season.seasonUid}_${scoredDay}`,
          }))
        );
        logger.info(`Score-drop inbox fan-out: ${inbox.written} written, ${inbox.skipped} skipped`);
      } catch (error) {
        logger.error("Score-drop inbox fan-out failed:", error);
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
    // The same lock is announced once to #announcements (seasonAnnounce.js).
    secrets: [discordAnnouncementsWebhookUrl],
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

      // Registration deadlines ride this job because it is the one job that
      // runs EVERY day regardless of which scoring pipeline owns the night,
      // and it already carries the #announcements webhook. It must run before
      // the lineup-lock early return below — the two deadlines are unrelated
      // and rarely fall on the same day. Isolated: never blocks the job.
      await announceRegistrationDeadlines(db, season);

      // Championship week's caption rules are announced the day BEFORE they
      // start biting, and day 43 is a blackout day — getLineupLockContext
      // returns null on it, so this must sit above the early return too.
      await announceChampionshipWeekWindows(db, season);

      const context = getLineupLockContext(season);
      if (!context) {
        logger.info("No caption-change lock tonight, skipping lineup reminders");
        return;
      }

      // The channel post reaches the directors push never will — the ones
      // who never enabled notifications. One per lock period, lease-guarded,
      // and isolated: Discord never blocks the push fan-out below.
      await announceLineupLock(db, season, context);

      // Only corps is consumed below — project it instead of full profiles,
      // and page the scan so it never truncates at a single query's cap
      // (see helpers/firestorePaging).
      const profilesQuery = db
        .collectionGroup("profile")
        .where("activeSeasonId", "==", season.seasonUid)
        .select("corps");
      const profiles = await processAllInPages(profilesQuery, 500, async (doc) => ({
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

      // In-app inbox copy per reminded director — reaches the push-denied.
      // Best-effort, never fails the job; not gated on pushPreferences (see
      // the score-drop job above for the rationale). One lock period = one
      // dedupeKey, so the daily retry window can't stack duplicates.
      try {
        const inbox = await createUserNotifications(
          db,
          pushes.map((push) => ({
            uid: push.uid,
            type: "lineup_lock",
            title: push.title,
            message: push.body,
            link: push.url,
            metadata: push.data,
            dedupeKey: `lineup_lock_${season.seasonUid}_${context.phase}_${context.periodKey}`,
          }))
        );
        logger.info(
          `Lineup-lock inbox fan-out: ${inbox.written} written, ${inbox.skipped} skipped`
        );
      } catch (error) {
        logger.error("Lineup-lock inbox fan-out failed:", error);
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

/**
 * Post tonight's lineup lock to #announcements, once per lock period.
 *
 * The lease is keyed by the caption window's periodKey, which is exactly
 * "which lock is this" — so the daily job announces each lock once and stays
 * quiet on the days between. Never throws.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {Object} season - game-settings/season data.
 * @param {Object} context - From getLineupLockContext.
 */
async function announceLineupLock(db, season, context) {
  const webhookUrl = discordAnnouncementsWebhookUrl.value();
  if (!webhookUrl) return;
  try {
    const result = await postOnce(db, {
      kind: `lineup-lock-${context.phase}`,
      tag: "lineup-lock",
      leaseKey: `${season.seasonUid}_discord_lock_${context.phase}`,
      leaseDay: context.periodKey,
      payload: buildLineupLockPayload({ context, seasonName: seasonDisplayName(season) }),
      webhookUrl,
    });
    logger.info(`[lineup-lock] Discord announcement: ${result.status}`);
  } catch (error) {
    logger.error(`[lineup-lock] Discord announcement failed: ${error.message}`);
  }
}

/**
 * Post the last week of a class's registration window to #announcements, once
 * per closing week (helpers/registrationAnnounce.js). Never throws.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {Object} season - game-settings/season data.
 */
async function announceRegistrationDeadlines(db, season) {
  const webhookUrl = discordAnnouncementsWebhookUrl.value();
  if (!webhookUrl) return;
  try {
    const { announceRegistrationDeadline } = require("../helpers/registrationAnnounce");
    const result = await announceRegistrationDeadline(db, {
      seasonUid: season.seasonUid,
      seasonName: seasonDisplayName(season),
      seasonData: season,
      webhookUrl,
    });
    // "nothing-closing" is the state on all but three days a season; logging
    // it would make every quiet day look like the job did something.
    if (result.status !== "nothing-closing") {
      logger.info(`[registration-lock] Discord announcement: ${result.status}`);
    }
  } catch (error) {
    logger.error(`[registration-lock] Discord announcement failed: ${error.message}`);
  }
}

/**
 * Post the Championship Week caption-change guide to #announcements on day 43
 * (helpers/championshipWeekAnnounce.js) — which days are closed to everyone,
 * and which days each class may change captions on. Never throws.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {Object} season - game-settings/season data.
 */
async function announceChampionshipWeekWindows(db, season) {
  const webhookUrl = discordAnnouncementsWebhookUrl.value();
  if (!webhookUrl) return;
  try {
    const { announceChampionshipWeek } = require("../helpers/championshipWeekAnnounce");
    const result = await announceChampionshipWeek(db, {
      seasonUid: season.seasonUid,
      seasonName: seasonDisplayName(season),
      seasonData: season,
      webhookUrl,
    });
    // Quiet on the 48 days a season that aren't day 43.
    if (result.status !== "not-today") {
      logger.info(`[championship-week] Discord announcement: ${result.status}`);
    }
  } catch (error) {
    logger.error(`[championship-week] Discord announcement failed: ${error.message}`);
  }
}

/** ET calendar day key (YYYY-MM-DD) for a per-day push dedup ledger. */
function etDayKey(date = new Date()) {
  const p = {};
  for (const part of new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)) {
    p[part.type] = part.value;
  }
  return `${p.year}-${p.month}-${p.day}`;
}

/**
 * "Your corps takes the field" push. Runs every 15 minutes through the evening
 * show window; for each of today's materialized fantasy running orders it pushes
 * the director whose own corps is about to perform (docs/EVENT_SCHEDULES_AND_SLOTS.md).
 * A per-day ledger dedupes so each slot fires exactly once.
 */
exports.takeTheFieldPushJob = onSchedule(
  {
    // Every 15 min, mid-afternoon through the late-night western drops (ET).
    schedule: "*/15 15-23,0-1 * * *",
    timeZone: "America/New_York",
    timeoutSeconds: 120,
    memory: "256MiB",
  },
  async () => {
    const db = admin.firestore();
    const seasonSnap = await db.doc("game-settings/season").get();
    const season = seasonSnap.exists ? seasonSnap.data() : null;
    const seasonId = season && season.seasonUid;
    if (!seasonId) return;

    const schedSnap = await db.doc(`schedules/${seasonId}`).get();
    const competitions = (schedSnap.exists && schedSnap.data().competitions) || [];
    if (competitions.length === 0) return;

    const ledgerRef = db.doc(`push_ledger/${seasonId}_takefield_${etDayKey()}`);
    const ledgerSnap = await ledgerRef.get();
    const alreadySent = new Set(Object.keys((ledgerSnap.exists && ledgerSnap.data().sentKeys) || {}));

    const pushes = buildTakeTheFieldPushes({ competitions, nowMs: Date.now(), alreadySent });
    if (pushes.length === 0) return; // nothing imminent — no ledger write

    const PARALLEL_LIMIT = 25;
    let totalSent = 0;
    for (let i = 0; i < pushes.length; i += PARALLEL_LIMIT) {
      const chunk = pushes.slice(i, i + PARALLEL_LIMIT);
      const results = await Promise.allSettled(
        chunk.map((p) => sendTakeTheFieldPush(p.uid, p.corps, p.showName, p.minutesUntil))
      );
      totalSent += results.filter((r) => r.status === "fulfilled" && r.value === true).length;
    }

    // Mark every slot we handled this tick (whether or not the send succeeded —
    // a missing token or opt-out shouldn't make us retry it next tick).
    const sentKeys = {};
    for (const p of pushes) sentKeys[p.key] = true;
    await ledgerRef.set({ seasonUid: seasonId, sentKeys }, { merge: true });

    logger.info(`[take-the-field] ${pushes.length} imminent slots, ${totalSent} pushes sent.`);
  }
);
