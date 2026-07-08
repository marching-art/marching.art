// Live-season schedule refresh: re-scrape upcoming DCI events and merge the
// enrichment onto the stored schedule in place. Extracted verbatim from
// season.js.

const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
const { enrichEventsWithDetails } = require("./eventDetails");
const { archiveScheduleEvents } = require("./historicalSchedules");
const {
  applyEnrichment,
  SPRING_TRAINING_DAYS,
  scrapeUpcomingDciEvents,
  brandEventName,
} = require("./seasonSchedule");

/**
 * Stable match key for a show within the schedule: competition day + normalized
 * event name. Used to line up a freshly scraped event with the show already on
 * the schedule so a refresh enriches it in place instead of replacing it.
 * @param {number} day
 * @param {string} name
 * @returns {string}
 */
function showMatchKey(day, name) {
  return `${day}::${String(name || "").toLowerCase().replace(/\s+/g, " ").trim()}`;
}

/**
 * Merge the pure schedule-refresh logic given already-loaded inputs. Extracted so
 * it can be unit-tested without Firestore. Mutates matched entries in `existing`
 * in place and returns the merged competition list plus counts.
 *
 * Contract (protects directors' saved schedules):
 *   - Existing shows are NEVER dropped — including past events that have fallen
 *     off dci.org's upcoming list and all championship-week entries.
 *   - A scraped event that matches an existing show enriches it in place, keeping
 *     the same id/day/week/type so directors' selections stay valid.
 *   - Only genuinely new events are appended (with a stable, collision-free id).
 *   - Idempotent: re-running with the same scrape adds nothing.
 *
 * @param {Array<object>} existing - Current competitions[] (mutated in place).
 * @param {Array<object>} scrapedEvents - Enriched events (need date/eventName).
 * @param {string} seasonId
 * @param {Date} startDate
 * @param {number} springTrainingDays
 * @returns {{competitions: Array, enrichedCount: number, addedCount: number, unchangedCount: number}}
 */
function mergeScheduleRefresh(existing, scrapedEvents, seasonId, startDate, springTrainingDays) {
  const millisInDay = 24 * 60 * 60 * 1000;

  // Group scraped events by competition day (1-44), de-duplicating by name.
  const showsByDay = new Map();
  for (const event of scrapedEvents) {
    if (!event.date) continue;
    const eventDate = new Date(event.date);
    const calendarDay = Math.floor((eventDate.getTime() - startDate.getTime()) / millisInDay) + 1;
    const dayNumber = calendarDay - springTrainingDays;
    if (dayNumber < 1 || dayNumber > 44) continue; // championship week isn't scraped

    if (!showsByDay.has(dayNumber)) showsByDay.set(dayNumber, []);
    const dayShows = showsByDay.get(dayNumber);
    if (dayShows.some((s) => s.eventName === event.eventName)) continue;
    dayShows.push(event);
  }

  // Index existing shows by match key, and track the highest id index per day so
  // newly appended shows get unique ids that never collide with existing ones.
  const byKey = new Map();
  const maxIdxByDay = new Map();
  for (const comp of existing) {
    byKey.set(showMatchKey(comp.day, comp.name), comp);
    const m = String(comp.id || "").match(/_day\d+_(\d+)$/);
    const idx = m ? parseInt(m[1], 10) : -1;
    if (idx > (maxIdxByDay.get(comp.day) ?? -1)) maxIdxByDay.set(comp.day, idx);
  }

  let enrichedCount = 0;
  let addedCount = 0;
  const added = [];

  for (const [dayNumber, dayShows] of showsByDay) {
    const week = Math.ceil(dayNumber / 7);
    for (const event of dayShows) {
      const key = showMatchKey(dayNumber, event.eventName);
      const match = byKey.get(key);
      if (match) {
        // Enrich the existing show in place — keep id/day/week/type/mandatory.
        applyEnrichment(match, event);
        if (!match.location && event.location) match.location = event.location;
        if (!match.date && event.date) match.date = event.date;
        enrichedCount += 1;
      } else {
        const nextIdx = (maxIdxByDay.get(dayNumber) ?? -1) + 1;
        maxIdxByDay.set(dayNumber, nextIdx);
        const competition = {
          id: `${seasonId}_day${dayNumber}_${nextIdx}`,
          name: event.eventName,
          location: event.location || "",
          date: event.date || null,
          day: dayNumber,
          week,
          type: "regular",
          allowedClasses: ["World Class", "Open Class", "A Class", "SoundSport"],
          mandatory: false,
        };
        applyEnrichment(competition, event);
        byKey.set(key, competition);
        added.push(competition);
        addedCount += 1;
      }
    }
  }

  const competitions = [...existing, ...added].sort((a, b) => a.day - b.day);
  const unchangedCount = existing.length - enrichedCount;
  return { competitions, enrichedCount, addedCount, unchangedCount };
}

/**
 * Refreshes the live season schedule with newly scraped DCI events.
 *
 * ADDITIVE, never destructive: existing shows are enriched in place with real
 * timing + running order, brand-new events are appended, and nothing is ever
 * removed. This protects directors who have already set their schedules — their
 * selected shows keep the same identity and simply gain start times + lineups.
 * Safe to re-run (idempotent).
 */
async function refreshLiveSeasonSchedule() {
  logger.info("Refreshing live season schedule with scraped events...");
  const db = getDb();

  const seasonDoc = await db.doc("game-settings/season").get();
  if (!seasonDoc.exists) {
    throw new Error("No active season found.");
  }

  const seasonData = seasonDoc.data();
  if (seasonData.status !== "live-season") {
    throw new Error("Can only refresh schedule during a live season.");
  }

  const seasonId = seasonData.seasonUid;
  const startDate = seasonData.schedule.startDate.toDate();
  const finalsDate = seasonData.schedule.endDate.toDate();
  const year = finalsDate.getFullYear();
  const springTrainingDays = seasonData.schedule.springTrainingDays || SPRING_TRAINING_DAYS;

  try {
    logger.info(`Scraping upcoming DCI events for ${year}...`);
    // Scrape with the REAL DCI event names first, and enrich with detail-page
    // timing + running order. Branding happens afterward so the historical
    // archive keeps unbranded names that join to historical_scores.
    const scrapedEvents = await scrapeUpcomingDciEvents(year);
    logger.info(`Found ${scrapedEvents.length} events to process.`);
    await enrichEventsWithDetails(scrapedEvents);

    // Archive the real running orders into historical_schedules/{year} so the
    // schedule archive fills continuously as shows are posted — the same
    // philosophy as historical_scores. Best-effort: a failure here must never
    // block the live in-game schedule refresh below.
    try {
      const { archived } = await archiveScheduleEvents(db, scrapedEvents);
      logger.info(`Archived ${archived} running orders into historical_schedules.`);
    } catch (error) {
      logger.warn(`Failed to archive schedules to history: ${error.message}`);
    }

    // Brand for the in-game schedule (DCI -> marching.art) and merge in place.
    const upcomingEvents = scrapedEvents.map((e) => ({
      ...e,
      eventName: brandEventName(e.eventName),
    }));

    const scheduleRef = db.doc(`schedules/${seasonId}`);
    const scheduleDoc = await scheduleRef.get();
    const existing = scheduleDoc.exists ? (scheduleDoc.data().competitions || []) : [];

    const { competitions, enrichedCount, addedCount, unchangedCount } = mergeScheduleRefresh(
      existing, upcomingEvents, seasonId, startDate, springTrainingDays
    );

    await scheduleRef.set({ competitions }, { merge: true });

    // Update the season document with refresh timestamp
    await db.doc("game-settings/season").update({
      lastScheduleRefresh: new Date().toISOString(),
    });

    logger.info(
      `Schedule refresh complete (additive): ${addedCount} added, ${enrichedCount} enriched in place, ` +
      `${unchangedCount} left untouched. ${competitions.length} total shows.`
    );
    return { addedCount, enrichedCount, unchangedCount, totalEvents: upcomingEvents.length };

  } catch (error) {
    logger.error("Failed to refresh schedule:", error);
    throw error;
  }
}

module.exports = {
  showMatchKey,
  mergeScheduleRefresh,
  refreshLiveSeasonSchedule,
};
