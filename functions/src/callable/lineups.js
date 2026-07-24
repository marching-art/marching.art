const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { paths } = require("../helpers/paths");
const { getDb } = require("../config");
const { assertAuth } = require("../helpers/callableGuards");
const { logger } = require("firebase-functions/v2");
const { analyzeLineupTrends } = require("../helpers/captionAnalytics");
const { getCaptionChangeWindow, isDayScoresProcessed } = require("../helpers/captionWindows");
const { FANTASY_CLASSES, ENABLED_CLASSES, POINT_CAPS } = require("../helpers/classRegistry");
const {
  showRegistrationEventKey,
  registrationEntryKey,
} = require("../helpers/showRegistrations");
const admin = require("firebase-admin");

/**
 * Task 2.7: Saves a user's 8-caption lineup for a specific corps class.
 *
 * @param {Object} lineup - The 8-caption lineup object
 * @param {string} corpsClass - The corps class (worldClass, openClass, aClass, soundSport)
 * @param {boolean} forceUpdate - If true and lineup needs update due to stale data,
 *                                bypasses trade limits for this one-time update
 */
// Add { cors: true } here
exports.saveLineup = onCall({ cors: true }, async (request) => {
  assertAuth(request);
  const { lineup, corpsClass, forceUpdate } = request.data;
  const uid = request.auth.uid;

  // 1. --- Validate Inputs ---
  const validClasses = FANTASY_CLASSES;
  if (!validClasses.includes(corpsClass)) {
    throw new HttpsError("invalid-argument", "Invalid corps class specified.");
  }

  if (!lineup || Object.keys(lineup).length !== 8) {
    throw new HttpsError("invalid-argument", "A complete 8-caption lineup is required.");
  }

  // 2. --- Get Season Data ---
  const db = getDb();
  const seasonSettingsRef = db.doc("game-settings/season");
  const seasonDoc = await seasonSettingsRef.get();
  if (!seasonDoc.exists || !seasonDoc.data().seasonUid) {
    throw new HttpsError("failed-precondition", "There is no active season.");
  }
  const seasonData = seasonDoc.data();
  const activeSeasonId = seasonData.seasonUid;

  // 3. --- Validate selections & points cap against the season corps registry ---
  // Caps come from the class-capability registry (Phase 1.1). Point COSTS are
  // server-authoritative: each selection's cost is resolved from the season's
  // dci-data registry, never from the client-supplied points segment — a
  // tampered "Blue Devils|2025|1" string must not field an elite corps at 1
  // point. The trailing segment is display-only sugar for the frontend; if
  // present it must agree with the registry so stored lineup strings never
  // carry a falsified cost.
  const pointCap = POINT_CAPS[corpsClass];
  const dataDocId = seasonData.dataDocId;
  const corpsDataDoc = await db.doc(`dci-data/${dataDocId}`).get();
  if (!corpsDataDoc.exists) {
    throw new HttpsError("failed-precondition", "Season corps data not found.");
  }

  const validCorps = corpsDataDoc.data().corpsValues || [];
  const corpsPointsMap = new Map(
    validCorps.map(c => [`${c.corpsName}|${c.sourceYear}`, Number(c.points) || 0])
  );

  // Check each lineup selection and total the registry cost
  let totalPoints = 0;
  for (const [caption, selection] of Object.entries(lineup)) {
    if (!selection || typeof selection !== 'string') {
      throw new HttpsError("invalid-argument", `Invalid selection for caption ${caption}.`);
    }

    const parts = selection.split("|");
    if (parts.length < 2) {
      throw new HttpsError("invalid-argument", `Invalid format for caption ${caption}.`);
    }

    const corpsName = parts[0];
    const sourceYear = parts[1];
    const corpsKey = `${corpsName}|${sourceYear}`;

    if (!corpsPointsMap.has(corpsKey)) {
      throw new HttpsError("invalid-argument",
        `${corpsName} (${sourceYear}) is not available this season. Please select from current season's corps.`);
    }

    const registryPoints = corpsPointsMap.get(corpsKey);
    if (parts.length >= 3 && Number(parts[2]) !== registryPoints) {
      throw new HttpsError("invalid-argument",
        `Point value for ${corpsName} (${sourceYear}) does not match this season's cost. Please refresh and rebuild your lineup.`);
    }

    totalPoints += registryPoints;
  }

  if (totalPoints > pointCap) {
    throw new HttpsError("invalid-argument", `Lineup exceeds ${pointCap} point limit for ${corpsClass}. Total: ${totalPoints}`);
  }

  // 4. --- Create Unique Lineup Key ---
  const lineupKey = `${corpsClass}_${Object.values(lineup).sort().join("_")}`;

  try {
    await db.runTransaction(async (transaction) => {
      const userProfileRef = db.doc(paths.userProfile(uid));
      const userProfileDoc = await transaction.get(userProfileRef);
      if (!userProfileDoc.exists) {
        throw new HttpsError("not-found", "User profile does not exist.");
      }
      
      const userProfileData = userProfileDoc.data();
      const currentCorpsData = userProfileData.corps?.[corpsClass];

      if (!currentCorpsData) {
        throw new HttpsError("not-found", `You must register a ${corpsClass} corps before saving a lineup.`);
      }

      // Hard-block lineup saves while a duplicate-name conflict is unresolved.
      // The director must rename the corps in the dashboard rename modal first.
      if (currentCorpsData.mustRename) {
        throw new HttpsError("failed-precondition",
          "This corps name conflicts with another director's corps and must be renamed before any further actions.");
      }

      // 5. --- Check Lineup Uniqueness ---
      const newActiveLineupRef = db.collection("activeLineups").doc(lineupKey);
      const existingLineupDoc = await transaction.get(newActiveLineupRef);
      if (existingLineupDoc.exists && existingLineupDoc.data().uid !== uid) {
        throw new HttpsError("already-exists", "This exact lineup has already been claimed.");
      }

      // 6. --- Check Trade Limits ---
      const oldLineupKey = currentCorpsData.lineupKey;
      const originalLineup = currentCorpsData.lineup || {};
      let newTrades = 0;
      Object.keys(lineup).forEach((caption) => {
        if (originalLineup[caption] !== lineup[caption]) newTrades++;
      });

      const profileUpdateData = {};

      // Check if this is a forced update due to stale lineup data
      const lineupNeedsUpdate = currentCorpsData.lineupNeedsUpdate === true;
      const isForcedUpdate = forceUpdate === true && lineupNeedsUpdate;

      if (newTrades > 0) {
        // Initial lineup setup (no existing lineup) is exempt from all
        // window and limit rules, as is the one-time stale-data update.
        const isInitialSetup = Object.keys(originalLineup).length === 0;
        if (isForcedUpdate) {
          logger.info(`User ${uid} using one-time lineup update exception for ${corpsClass} due to stale data.`);
        }

        if (!isInitialSetup && !isForcedUpdate) {
          // Caption-change rules (mirrored in src/utils/seasonClock.js):
          // days 1-14 unlimited; days 15-42 three per week; every Saturday
          // 8 PM ET through scores processing locked; days 43-44 closed;
          // days 45-49 two per day for each class still competing that day,
          // locking nightly at the 8 PM ET boundary.
          const window = getCaptionChangeWindow(seasonData, new Date(), corpsClass);

          if (window) {
            if (window.phase === "blackout") {
              throw new HttpsError("failed-precondition",
                "Caption changes are closed on Days 43-44. Championship changes (2 per corps per day) " +
                "open on Day 45 once scores are processed (~2:00 AM ET).");
            }
            if (window.phase === "complete") {
              throw new HttpsError("failed-precondition",
                "The season has ended — caption changes are closed until the next season begins.");
            }
            if (window.phase === "championship" && window.status === "closed") {
              // This class has finished competing for the season (Finals-week
              // bracket): Open/A wrap after Day 47, World/SoundSport after 49.
              throw new HttpsError("failed-precondition",
                "This class has finished competing for the season — its caption changes are closed.");
            }
            if (window.status === "locked") {
              throw new HttpsError("failed-precondition",
                "Caption changes are locked while scores are processed. " +
                "They reopen around 2:00 AM ET once results are in.");
            }
            if (window.pendingScoresDay) {
              const processed = await isDayScoresProcessed(db, seasonData, window.pendingScoresDay);
              if (!processed) {
                throw new HttpsError("failed-precondition",
                  "Caption changes are locked until last night's scores finish processing. Please try again shortly.");
              }
            }

            if (window.tradeLimit !== Infinity) {
              // The `week` field on the stored counter holds window.periodKey —
              // the week number for weekly limits, the competition day during
              // Championship Week (so the 2-per-day allotment resets nightly).
              const weeklyTrades = currentCorpsData.weeklyTrades || { week: 0, used: 0 };
              const tradesAlreadyUsed = (weeklyTrades.seasonUid === activeSeasonId &&
                weeklyTrades.week === window.periodKey) ? weeklyTrades.used : 0;

              if (tradesAlreadyUsed + newTrades > window.tradeLimit) {
                const remaining = Math.max(0, window.tradeLimit - tradesAlreadyUsed);
                const scope = window.phase === "championship"
                  ? "today"
                  : "this week";
                const plural = remaining === 1 ? "" : "s";
                throw new HttpsError("failed-precondition",
                  `Exceeds change limit. You have ${remaining} caption change${plural} remaining ${scope}.`);
              }

              profileUpdateData[`corps.${corpsClass}.weeklyTrades`] = {
                seasonUid: activeSeasonId,
                week: window.periodKey,
                used: tradesAlreadyUsed + newTrades,
              };
            }
          }
        }
      }

      // Clear the lineupNeedsUpdate flag if it was set (regardless of forceUpdate)
      if (lineupNeedsUpdate) {
        profileUpdateData[`corps.${corpsClass}.lineupNeedsUpdate`] = false;
      }

      // 7. --- Commit Changes ---
      if (oldLineupKey && oldLineupKey !== lineupKey) {
        transaction.delete(db.collection("activeLineups").doc(oldLineupKey));
      }
      
      transaction.set(newActiveLineupRef, {
        uid: uid,
        seasonId: activeSeasonId,
        corpsClass: corpsClass,
      });

      profileUpdateData[`corps.${corpsClass}.lineup`] = lineup;
      profileUpdateData[`corps.${corpsClass}.lineupKey`] = lineupKey;
      profileUpdateData.activeSeasonId = activeSeasonId; 

      transaction.update(userProfileRef, profileUpdateData);
    });

    return { success: true, message: `${corpsClass} lineup saved successfully!` };
  } catch (error) {
    logger.error(`[saveLineup] Transaction FAILED for user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "An error occurred while saving your lineup.");
  }
});

// Season length in weeks (49 competition days). Week numbers outside this
// range are rejected by validateShowSelection.
const TOTAL_SEASON_WEEKS = 7;

/**
 * Get maximum number of show registrations allowed for a given week
 * @param {number} week - Week number (1-7)
 * @param {number} totalWeeks - Total weeks in the season (default 7)
 * @returns {number} Maximum shows allowed for the week
 */
const getMaxShowsForWeek = (week, totalWeeks = TOTAL_SEASON_WEEKS) => {
  // Final week allows 7 registrations (1 per day max per corps)
  if (week === totalWeeks) {
    return 7;
  }
  // Regular weeks allow 4 shows
  return 4;
};

/**
 * Validate a week's show selection shape (pure — exported for tests). Throws
 * HttpsError on violation:
 *   - an integer week number in 1..TOTAL_SEASON_WEEKS and at most
 *     maxShowsForWeek shows, each with a non-empty eventName;
 *   - no two shows on the same client-declared day (early feedback only —
 *     the authoritative one-per-day check runs on schedule-derived days in
 *     resolveShowsAgainstSchedule, because the client's day is untrusted);
 *   - no event selected twice. Multi-night events (the Eastern Classic
 *     appears on both days 41 and 42) COUNT AS ONE SHOW: one registration
 *     covers every night — scoring matches by eventName and assigns each
 *     corps a single performance night server-side (§5.11) — so selecting
 *     the second night would silently burn a weekly slot.
 */
function validateShowSelection(week, shows, maxShowsForWeek) {
  if (!Number.isInteger(week) || week < 1 || week > TOTAL_SEASON_WEEKS ||
      !shows || !Array.isArray(shows) || shows.length > maxShowsForWeek) {
    throw new HttpsError("invalid-argument",
      `Invalid data. A week number (1-${TOTAL_SEASON_WEEKS}) and a maximum of ` +
      `${maxShowsForWeek} shows are required.`);
  }

  const daysUsed = new Set();
  const eventsUsed = new Set();
  for (const show of shows) {
    if (!show || typeof show !== "object" ||
        typeof show.eventName !== "string" || !show.eventName) {
      throw new HttpsError("invalid-argument",
        "Each selected show must include an event name.");
    }
    if (show.day !== undefined && show.day !== null) {
      if (daysUsed.has(show.day)) {
        throw new HttpsError("invalid-argument",
          `Cannot select multiple shows on day ${show.day}. Corps can only attend one show per day.`);
      }
      daysUsed.add(show.day);
    }
    if (eventsUsed.has(show.eventName)) {
      throw new HttpsError("invalid-argument",
        `"${show.eventName}" is already selected. Multi-night events count as one show — ` +
        "a single registration covers every night.");
    }
    eventsUsed.add(show.eventName);
  }
}

/**
 * Resolve the client's selections against the season schedule (pure —
 * exported for tests). The client's show objects are NEVER stored verbatim:
 * scoring (helpers/scoring.js) matches attendance by eventName and
 * ACCUMULATES one score per attended show per day, so a client that omitted
 * or faked `day` used to slip multiple same-day shows (or invented events)
 * past the one-per-day rule and multiply totalSeasonScore.
 *
 * Every selection is resolved by eventName within the requested week's
 * schedule (days (week-1)*7+1 .. week*7) and day/date/location are derived
 * from the schedule, never from the client. Multi-night events occupy EVERY
 * one of their nights for the one-per-day check: scoring assigns each corps
 * exactly one night via the persisted snake split (helpers/easternSplit.js,
 * §5.11), and because that split depends on final enrollment the assigned
 * night is unknowable at selection time — reserving all nights guarantees
 * the invariant for whichever night scoring picks.
 *
 * @param {number} week - Validated week number.
 * @param {Array<{eventName: string}>} shows - Validated client selections.
 * @param {Array<Object>} competitions - schedules/{seasonId}.competitions.
 * @returns {Array<{eventName: string, day: number, date: *, location: *}>}
 *   Whitelisted show objects, safe to store on the profile.
 */
function resolveShowsAgainstSchedule(week, shows, competitions) {
  const weekStartDay = (week - 1) * 7 + 1;
  const weekEndDay = week * 7;

  // Group this week's schedule entries by event name. A multi-night event
  // appears once per night; all of its nights count as occupied days.
  const eventsByName = new Map();
  for (const comp of competitions || []) {
    if (!comp || typeof comp.name !== "string" || !comp.name) continue;
    if (!Number.isInteger(comp.day) || comp.day < weekStartDay || comp.day > weekEndDay) continue;
    const nights = Array.isArray(comp.multiNight?.nights) && comp.multiNight.nights.length > 0
      ? comp.multiNight.nights
      : [comp.day];
    let entry = eventsByName.get(comp.name);
    if (!entry) {
      entry = { days: new Set(), byDay: new Map() };
      eventsByName.set(comp.name, entry);
    }
    nights.filter(Number.isInteger).forEach((night) => entry.days.add(night));
    if (!entry.byDay.has(comp.day)) entry.byDay.set(comp.day, comp);
  }

  const daysUsed = new Set();
  const resolved = [];
  for (const show of shows) {
    const entry = eventsByName.get(show.eventName);
    if (!entry) {
      throw new HttpsError("invalid-argument",
        `"${show.eventName}" is not on the week ${week} schedule.`);
    }

    const occupiedDays = [...entry.days].sort((a, b) => a - b);
    for (const day of occupiedDays) {
      if (daysUsed.has(day)) {
        throw new HttpsError("invalid-argument",
          `Cannot select multiple shows on day ${day}. Corps can only attend one show per day.`);
      }
      daysUsed.add(day);
    }

    // Store the whitelisted fields consumers actually read (scoring matches
    // eventName; the registration index keys on eventName+date; the client
    // dashboard reads day/location), derived from the first night's entry.
    const firstDay = occupiedDays[0];
    const comp = entry.byDay.get(firstDay) || entry.byDay.values().next().value;
    resolved.push({
      eventName: show.eventName,
      day: firstDay,
      date: comp.date ?? null,
      location: comp.location ?? null,
    });
  }
  return resolved;
}

/**
 * Task 3.3: Saves a user's selected shows for the week.
 */
// Add { cors: true } here
exports.selectUserShows = onCall({ cors: true }, async (request) => {
  const uid = assertAuth(request);
  const { week, shows, corpsClass } = request.data;

  // Get the max shows allowed for this week (7 for final week, 4 otherwise)
  const maxShowsForWeek = getMaxShowsForWeek(week);

  validateShowSelection(week, shows, maxShowsForWeek);

  if (!corpsClass || !FANTASY_CLASSES.includes(corpsClass)) {
    throw new HttpsError("invalid-argument", "Valid corps class is required.");
  }

  const db = getDb();

  // Validate that the week is not in the past
  const seasonRef = db.doc("game-settings/season");
  const seasonDoc = await seasonRef.get();

  if (!seasonDoc.exists) {
    throw new HttpsError("failed-precondition", "No active season found.");
  }

  const seasonData = seasonDoc.data();
  if (seasonData.schedule?.startDate) {
    const startDate = seasonData.schedule.startDate.toDate();
    const now = new Date();
    const diffInMillis = now.getTime() - startDate.getTime();
    const diffInDays = Math.floor(diffInMillis / (1000 * 60 * 60 * 24));
    // Subtract spring training so competition Day 1 starts after it (live season).
    // Off-seasons have no spring training (field absent -> 0).
    const springTrainingDays = seasonData.schedule.springTrainingDays || 0;
    const currentWeek = Math.max(1, Math.ceil((diffInDays + 1 - springTrainingDays) / 7));

    if (week < currentWeek) {
      throw new HttpsError("failed-precondition",
        `Cannot select shows for week ${week}. The current week is ${currentWeek}. You can only modify the current or future weeks.`);
    }
  }

  // Resolve every selection against the season schedule; only the resolved,
  // whitelisted objects are ever stored (clearing a week with [] needs no
  // schedule). See resolveShowsAgainstSchedule for why the client's objects
  // must never be trusted.
  let resolvedShows = [];
  if (shows.length > 0) {
    if (!seasonData.seasonUid) {
      throw new HttpsError("failed-precondition", "No active season found.");
    }
    const scheduleDoc = await db.doc(`schedules/${seasonData.seasonUid}`).get();
    if (!scheduleDoc.exists) {
      throw new HttpsError("failed-precondition", "The season schedule is not available yet.");
    }
    resolvedShows = resolveShowsAgainstSchedule(
      week, shows, scheduleDoc.data().competitions || []
    );
  }

  const userProfileRef = db.doc(paths.userProfile(uid));

  try {
    // Read the profile first: the previous week's selections drive the
    // registration-index diff below, and corpsName/username denormalize into
    // the index entries.
    const profileSnap = await userProfileRef.get();
    const profile = profileSnap.exists ? profileSnap.data() : {};
    const previousShows = profile.corps?.[corpsClass]?.selectedShows?.[`week${week}`] || [];

    // Also set activeSeasonId so user is properly tracked for season resets
    const updateData = {
      [`corps.${corpsClass}.selectedShows.week${week}`]: resolvedShows,
    };
    if (seasonData.seasonUid) {
      updateData.activeSeasonId = seasonData.seasonUid;
    }
    await userProfileRef.update(updateData);

    // Write-through to the materialized "who's attending" index so
    // getShowRegistrations reads one doc instead of scanning every profile.
    // Best-effort: the profile (source of truth) is already saved, and the
    // nightly rebuild self-heals any miss here.
    if (seasonData.seasonUid) {
      try {
        const entryKey = registrationEntryKey(uid, corpsClass);
        const entry = {
          uid,
          corpsClass,
          corpsName: profile.corps?.[corpsClass]?.corpsName || "Unnamed Corps",
          username: profile.username || null,
        };
        const eventRef = (key) =>
          db.doc(paths.showRegistrationEvent(seasonData.seasonUid, key));
        const newKeys = new Set(
          resolvedShows.map((s) => showRegistrationEventKey(week, s.eventName, s.date))
        );

        const batch = db.batch();
        for (const prev of previousShows) {
          if (!prev || typeof prev.eventName !== "string") continue;
          const key = showRegistrationEventKey(week, prev.eventName, prev.date);
          if (!newKeys.has(key)) {
            batch.set(
              eventRef(key),
              { registrations: { [entryKey]: admin.firestore.FieldValue.delete() } },
              { merge: true }
            );
          }
        }
        for (const show of resolvedShows) {
          const key = showRegistrationEventKey(week, show.eventName, show.date);
          batch.set(
            eventRef(key),
            {
              week,
              eventName: show.eventName,
              date: show.date ?? null,
              registrations: { [entryKey]: entry },
            },
            { merge: true }
          );
        }
        await batch.commit();
      } catch (indexError) {
        logger.warn(`Show-registration index update failed for ${uid} (self-heals nightly):`, indexError);
      }
    }

    return { success: true, message: `Successfully saved selections for week ${week}.` };
  } catch (error) {
    logger.error(`Failed to save show selections for user ${uid}:`, error);
    throw new HttpsError("internal", "Could not save your show selections.");
  }
});

/**
 * Save show concept (theme, music source, drill style) for synergy bonuses
 */
exports.saveShowConcept = onCall({ cors: true }, async (request) => {
  assertAuth(request);

  const { corpsClass, showConcept } = request.data;
  const uid = request.auth.uid;

  // Validate inputs. Show concepts are pure identity (title/theme/music/drill)
  // and apply to EVERY enabled class, not just the lineup-bearing ones — a
  // Podium Class corps (no lineup, so absent from FANTASY_CLASSES) designs a
  // show the same way. The lineup-synergy bonus only pays out for corps that
  // field a lineup, so this stays cosmetic for Podium.
  const validClasses = ENABLED_CLASSES;
  if (!validClasses.includes(corpsClass)) {
    throw new HttpsError("invalid-argument", "Invalid corps class specified.");
  }

  if (!showConcept || !showConcept.theme || !showConcept.musicSource || !showConcept.drillStyle) {
    throw new HttpsError("invalid-argument", "Complete show concept required (theme, musicSource, drillStyle).");
  }

  // Show title: user text that flows into recaps and the daily articles —
  // trimmed, single-line, length-capped. Optional server-side so concepts
  // saved before titles existed stay valid; the UI requires it.
  let showName = null;
  if (showConcept.showName !== undefined && showConcept.showName !== null) {
    if (typeof showConcept.showName !== "string") {
      throw new HttpsError("invalid-argument", "Show name must be text.");
    }
    showName = showConcept.showName.replace(/\s+/g, " ").trim().slice(0, 60);
    if (showName.length < 2) {
      throw new HttpsError("invalid-argument", "Show name must be at least 2 characters.");
    }
  }

  const db = getDb();
  const userProfileRef = db.doc(paths.userProfile(uid));

  try {
    await userProfileRef.update({
      [`corps.${corpsClass}.showConcept`]: {
        showName,
        theme: showConcept.theme,
        musicSource: showConcept.musicSource,
        drillStyle: showConcept.drillStyle,
        updatedAt: new Date()
      }
    });

    logger.info(`User ${uid} saved show concept for ${corpsClass}`);
    return { success: true, message: "Show concept saved successfully!" };
  } catch (error) {
    logger.error(`Failed to save show concept for user ${uid}:`, error);
    throw new HttpsError("internal", "Could not save show concept.");
  }
});

/**
 * Get "hot" status for all corps in the season, calculated PER CAPTION.
 * A corps is "hot" for a specific caption if they've performed above average
 * in that caption during the recent window (last 10 days).
 *
 * Returns: { hotCorps: { "CorpsName|Year": { GE1: {isHot, improvement}, GE2: {...}, ... } } }
 */
exports.getHotCorps = onCall({ cors: true }, async (request) => {
  // Auth required: this endpoint runs several Firestore aggregate reads per
  // call and is only used from authenticated lineup-selection UI.
  assertAuth(request);
  const db = getDb();
  const CAPTIONS = ['GE1', 'GE2', 'VP', 'VA', 'CG', 'B', 'MA', 'P'];

  try {
    // Get season data
    const seasonDoc = await db.doc("game-settings/season").get();
    if (!seasonDoc.exists) {
      return { success: true, hotCorps: {} };
    }

    const seasonData = seasonDoc.data();
    const dataDocId = seasonData.dataDocId;

    // Calculate current day
    let currentDay = 1;
    if (seasonData.schedule?.startDate) {
      const now = new Date();
      const startDate = seasonData.schedule.startDate.toDate();
      const diffInMillis = now.getTime() - startDate.getTime();
      // Recaps are keyed by competition day; subtract spring training so the
      // lookback window aligns (live season). Off-seasons have none (-> 0).
      const springTrainingDays = seasonData.schedule.springTrainingDays || 0;
      currentDay = Math.floor(diffInMillis / (1000 * 60 * 60 * 24)) + 1 - springTrainingDays;
    }

    // Define the lookback window (7 days = 1 week)
    const lookbackDays = 7;
    const windowStart = Math.max(1, currentDay - lookbackDays);
    const windowEnd = currentDay - 1; // Don't include today since scores may not be in yet

    if (windowEnd < 1) {
      // Season just started, no historical data to compare
      return { success: true, hotCorps: {} };
    }

    // The result depends only on (dataDocId, currentDay) — it is identical
    // for every caller until the day rolls over. First caller of the day
    // computes and caches it (one doc, server-written); everyone else costs
    // 2 reads (season + cache) instead of re-reading the corps list plus one
    // historical_scores doc per source year on every request.
    const hotCorpsCacheRef = db.doc("computed/hotCorps");
    const cacheKey = `${dataDocId}:${currentDay}`;
    const cachedSnap = await hotCorpsCacheRef.get();
    if (cachedSnap.exists && cachedSnap.data().cacheKey === cacheKey) {
      return { success: true, hotCorps: cachedSnap.data().hotCorps || {}, windowStart, windowEnd, currentDay };
    }

    // Get corps list for this season
    const corpsDataDoc = await db.doc(`dci-data/${dataDocId}`).get();
    if (!corpsDataDoc.exists) {
      return { success: true, hotCorps: {} };
    }

    const corpsList = corpsDataDoc.data().corpsValues || [];

    // Get the years we need to fetch
    const yearsToFetch = [...new Set(corpsList.map(c => c.sourceYear))];

    // Fetch historical scores for all relevant years
    const historicalDocs = await Promise.all(
      yearsToFetch.map(year => db.doc(`historical_scores/${year}`).get())
    );

    const historicalData = {};
    historicalDocs.forEach(doc => {
      if (doc.exists) {
        historicalData[doc.id] = doc.data().data || [];
      }
    });

    // OPTIMIZATION: Pre-build score index for O(1) lookups instead of O(n) .find()
    // Structure: Map<year, Map<corpsName, Map<offSeasonDay, scoreData>>>
    // This reduces ~96,000,000 operations to ~50,000 operations (99.95% reduction)
    const scoreIndex = new Map();
    for (const [year, events] of Object.entries(historicalData)) {
      const yearIndex = new Map();
      for (const event of events) {
        if (!event.scores) continue;
        for (const score of event.scores) {
          if (!yearIndex.has(score.corps)) {
            yearIndex.set(score.corps, new Map());
          }
          yearIndex.get(score.corps).set(event.offSeasonDay, score);
        }
      }
      scoreIndex.set(year, yearIndex);
    }

    // For each caption, collect all corps' performance metrics
    // Structure: { caption: [{ corpsName, sourceYear, recentAvg, improvement }, ...] }
    const captionPerformance = {};
    CAPTIONS.forEach(cap => { captionPerformance[cap] = []; });

    for (const corps of corpsList) {
      const { corpsName, sourceYear } = corps;
      const yearData = historicalData[sourceYear] || [];
      const corpsScoreMap = scoreIndex.get(sourceYear)?.get(corpsName);

      // Skip if no scores exist for this corps
      if (!corpsScoreMap) continue;

      // For each caption, calculate performance metrics
      for (const caption of CAPTIONS) {
        const recentScores = [];
        const allScores = [];

        for (const event of yearData) {
          // O(1) lookup instead of O(n) .find()
          const scoreData = corpsScoreMap.get(event.offSeasonDay);
          if (scoreData && scoreData.captions && scoreData.captions[caption] > 0) {
            const score = scoreData.captions[caption];
            allScores.push({ day: event.offSeasonDay, score });

            if (event.offSeasonDay >= windowStart && event.offSeasonDay <= windowEnd) {
              recentScores.push(score);
            }
          }
        }

        if (recentScores.length > 0 && allScores.length >= 3) {
          const recentAvg = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;

          // Calculate trend: compare recent to early season
          const midpoint = Math.floor(allScores.length / 2);
          const earlyScores = allScores.slice(0, midpoint).map(s => s.score);
          const earlyAvg = earlyScores.length > 0
            ? earlyScores.reduce((a, b) => a + b, 0) / earlyScores.length
            : recentAvg;

          // Improvement percentage from early season to recent
          const improvement = earlyAvg > 0 ? ((recentAvg - earlyAvg) / earlyAvg) * 100 : 0;

          captionPerformance[caption].push({
            corpsName,
            sourceYear,
            recentAvg,
            improvement,
            recentCount: recentScores.length
          });
        }
      }
    }

    // For each caption, determine which corps are "hot"
    // Hot = top 5 corps with greatest improvement percentage in that caption
    const hotCorps = {};

    for (const caption of CAPTIONS) {
      const performers = captionPerformance[caption];
      if (performers.length === 0) continue;

      // Sort by improvement percentage (descending) to find top gainers
      const sortedByImprovement = [...performers].sort((a, b) => b.improvement - a.improvement);

      // Get the top 5 corps IDs for this caption
      const top5Ids = new Set(
        sortedByImprovement
          .slice(0, 5)
          .filter(p => p.improvement > 0) // Only mark as hot if actually improving
          .map(p => `${p.corpsName}|${p.sourceYear}`)
      );

      // Set hot status for each corps in this caption
      for (const perf of performers) {
        const corpsId = `${perf.corpsName}|${perf.sourceYear}`;

        if (!hotCorps[corpsId]) {
          hotCorps[corpsId] = {};
        }

        hotCorps[corpsId][caption] = {
          isHot: top5Ids.has(corpsId),
          improvement: Math.round(perf.improvement * 10) / 10,
          recentAvg: Math.round(perf.recentAvg * 100) / 100
        };
      }
    }

    // Best-effort cache write — a failure here must not fail the request.
    try {
      await hotCorpsCacheRef.set({ cacheKey, hotCorps, windowStart, windowEnd, currentDay, computedAt: new Date() });
    } catch (cacheError) {
      logger.warn(`Failed to cache hot corps result: ${cacheError.message}`);
    }

    return { success: true, hotCorps, windowStart, windowEnd, currentDay };
  } catch (error) {
    logger.error("Error calculating hot corps:", error);
    return { success: true, hotCorps: {} };
  }
});

/**
 * Get caption trend analytics for a lineup
 * Returns trend indicators without exposing raw scores
 */
exports.getLineupAnalytics = onCall({ cors: true }, async (request) => {
  assertAuth(request);

  const { corpsClass } = request.data;
  const uid = request.auth.uid;

  const validClasses = FANTASY_CLASSES;
  if (!validClasses.includes(corpsClass)) {
    throw new HttpsError("invalid-argument", "Invalid corps class specified.");
  }

  const db = getDb();

  try {
    // Get user's lineup — field-masked; nothing else on the (large) profile
    // doc is consumed here.
    const [profileDoc] = await db.getAll(db.doc(paths.userProfile(uid)), {
      fieldMask: [`corps.${corpsClass}.lineup`],
    });
    if (!profileDoc.exists) {
      throw new HttpsError("not-found", "User profile not found.");
    }

    const profileData = profileDoc.data();
    const lineup = profileData.corps?.[corpsClass]?.lineup;

    if (!lineup) {
      return { success: true, analytics: {} };
    }

    // Get current day from season
    const seasonDoc = await db.doc("game-settings/season").get();
    const currentDay = seasonDoc.exists ? (seasonDoc.data().currentDay || 1) : 1;

    // Analyze trends
    const analytics = await analyzeLineupTrends(lineup, currentDay);

    return { success: true, analytics };
  } catch (error) {
    logger.error(`Failed to get lineup analytics for user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Could not retrieve lineup analytics.");
  }
});

/**
 * Get all active lineup keys for a corps class.
 * Used by quick fill to avoid generating duplicate lineups.
 */
exports.getActiveLineupKeys = onCall({ cors: true }, async (request) => {
  assertAuth(request);

  const { corpsClass } = request.data;
  const uid = request.auth.uid;

  const validClasses = FANTASY_CLASSES;
  if (!validClasses.includes(corpsClass)) {
    throw new HttpsError("invalid-argument", "Invalid corps class specified.");
  }

  const db = getDb();

  try {
    // Query all active lineups for this corps class
    const lineupsSnapshot = await db.collection("activeLineups")
      .where("corpsClass", "==", corpsClass)
      .get();

    // Return lineup keys, excluding the current user's lineup
    const lineupKeys = [];
    lineupsSnapshot.forEach(doc => {
      if (doc.data().uid !== uid) {
        lineupKeys.push(doc.id);
      }
    });

    return { success: true, lineupKeys };
  } catch (error) {
    logger.error(`Failed to get active lineup keys:`, error);
    throw new HttpsError("internal", "Could not retrieve active lineups.");
  }
});

/**
 * Validate a user's lineup against the current season's available corps.
 * Returns which selections are invalid (from previous seasons) and whether
 * the lineup requires a forced update.
 */
exports.validateLineup = onCall({ cors: true }, async (request) => {
  assertAuth(request);

  const { corpsClass } = request.data;
  const uid = request.auth.uid;

  const validClasses = FANTASY_CLASSES;
  if (!validClasses.includes(corpsClass)) {
    throw new HttpsError("invalid-argument", "Invalid corps class specified.");
  }

  const db = getDb();

  try {
    // Get season data and corps list
    const seasonDoc = await db.doc("game-settings/season").get();
    if (!seasonDoc.exists || !seasonDoc.data().seasonUid) {
      return { success: true, isValid: true, invalidSelections: [] };
    }

    const seasonData = seasonDoc.data();
    const dataDocId = seasonData.dataDocId;

    // Get current season's valid corps
    const corpsDataDoc = await db.doc(`dci-data/${dataDocId}`).get();
    if (!corpsDataDoc.exists) {
      return { success: true, isValid: true, invalidSelections: [] };
    }

    const validCorps = corpsDataDoc.data().corpsValues || [];
    // Build a Map of "corpsName|sourceYear" -> registry points for O(1)
    // lookup. Mirrors saveLineup: point costs are server-authoritative, so a
    // stored selection whose trailing points segment disagrees with the
    // registry (tampered or stale) is treated as invalid too.
    const corpsPointsMap = new Map(
      validCorps.map(c => [`${c.corpsName}|${c.sourceYear}`, Number(c.points) || 0])
    );

    // Get user's current lineup
    const profileDoc = await db.doc(
      paths.userProfile(uid)
    ).get();

    if (!profileDoc.exists) {
      return { success: true, isValid: true, invalidSelections: [] };
    }

    const profileData = profileDoc.data();
    const lineup = profileData.corps?.[corpsClass]?.lineup;

    // No lineup = nothing to validate
    if (!lineup || Object.keys(lineup).length === 0) {
      return { success: true, isValid: true, invalidSelections: [] };
    }

    // Check each lineup selection against valid corps and total the
    // registry cost
    const invalidSelections = [];
    let totalPoints = 0;
    for (const [caption, selection] of Object.entries(lineup)) {
      if (!selection || typeof selection !== 'string') continue;

      const parts = selection.split("|");
      if (parts.length < 2) continue;

      const corpsName = parts[0];
      const sourceYear = parts[1];
      const corpsKey = `${corpsName}|${sourceYear}`;

      const registryPoints = corpsPointsMap.get(corpsKey);
      if (!corpsPointsMap.has(corpsKey) ||
          (parts.length >= 3 && Number(parts[2]) !== registryPoints)) {
        invalidSelections.push({
          caption,
          corpsName,
          sourceYear,
          fullSelection: selection
        });
        continue;
      }

      totalPoints += registryPoints;
    }

    // A lineup that no longer fits under the class point cap (registry
    // prices, never the stored segments) also requires a forced update.
    const isValid = invalidSelections.length === 0 &&
      totalPoints <= POINT_CAPS[corpsClass];

    // If lineup is invalid, mark it on the profile for UI to show warning
    if (!isValid) {
      const needsUpdateField = `corps.${corpsClass}.lineupNeedsUpdate`;
      const currentNeedsUpdate = profileData.corps?.[corpsClass]?.lineupNeedsUpdate;

      // Only update if not already marked (avoid unnecessary writes)
      if (!currentNeedsUpdate) {
        await db.doc(
          paths.userProfile(uid)
        ).update({
          [needsUpdateField]: true
        });
      }
    }

    return {
      success: true,
      isValid,
      invalidSelections,
      requiresUpdate: !isValid
    };
  } catch (error) {
    logger.error(`Failed to validate lineup for user ${uid}:`, error);
    throw new HttpsError("internal", "Could not validate lineup.");
  }
});
// Pure validators exported for unit tests (never registered as functions —
// index.js destructures specific callables only).
module.exports.validateShowSelection = validateShowSelection;
module.exports.resolveShowsAgainstSchedule = resolveShowsAgainstSchedule;
module.exports.getMaxShowsForWeek = getMaxShowsForWeek;
