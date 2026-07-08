const { logger } = require("firebase-functions/v2");

// Scalar timing/venue fields carried on an archived schedule event. Filled only
// when blank on an existing record (additive, never overwritten).
const SCHEDULE_SCALAR_FIELDS = [
  "location", "venue", "timezone", "gatesAt", "startsAt", "scoresAt", "offSeasonDay",
];

// Per-corps lineup fields, same fill-only-when-blank rule.
const LINEUP_FILL_FIELDS = ["order", "hometown", "performanceTime", "performsAt"];

/**
 * True when a value counts as "blank" and may be filled from a fresh scrape.
 * Numbers of 0 are considered present (lineup order starts at 1 and offSeasonDay
 * is >= 1, so a real 0 never occurs — but we still treat it as present to be safe).
 * @param {*} v
 * @returns {boolean}
 */
function isBlank(v) {
  return v === undefined || v === null || v === "";
}

/**
 * Fill blank fields on `target` from `source` for the given field list.
 * @returns {boolean} true if any field was filled.
 */
function fillBlankFields(target, source, fields) {
  let changed = false;
  for (const field of fields) {
    if (isBlank(target[field]) && !isBlank(source[field])) {
      target[field] = source[field];
      changed = true;
    }
  }
  return changed;
}

/**
 * Normalize a corps name for lineup matching across scrapes (case/space-insensitive).
 * @param {string} name
 * @returns {string}
 */
function normalizeCorps(name) {
  return String(name || "").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Merge one event's running order + timing into historical_schedules/{year},
 * inside a transaction. The schedule analog of mergeEventIntoHistoricalScores,
 * so both archives fill continuously (live + backfill) and stay joinable to each
 * other by event name + date.
 *
 * Merge rules (idempotent, additive — never overwrites existing data):
 *  - No year document yet   -> create it with this event.
 *  - Event not present       -> append it.
 *  - Event already present   -> add any lineup corps not yet recorded, fill only
 *                               blank per-corps fields on existing entries, and
 *                               fill blank scalar timing/venue fields. If nothing
 *                               changed, skip the write.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {string|number} year - Calendar year; used as the document id.
 * @param {Object} newEventData - { eventName, date, location, venue, timezone,
 *   gatesAt, startsAt, scoresAt, offSeasonDay, lineup:[{order,corps,hometown,
 *   performanceTime,performsAt}] }
 * @returns {Promise<void>}
 */
async function mergeEventIntoHistoricalSchedules(db, year, newEventData) {
  const docId = year.toString();
  const yearDocRef = db.collection("historical_schedules").doc(docId);

  await db.runTransaction(async (transaction) => {
    const yearDoc = await transaction.get(yearDocRef);

    if (!yearDoc.exists) {
      logger.info(`Creating new historical_schedules document for year ${year}.`);
      transaction.set(yearDocRef, { data: [newEventData] });
      return;
    }

    const existingData = yearDoc.data().data || [];
    const eventIndex = existingData.findIndex((event) =>
      event.eventName === newEventData.eventName &&
      new Date(event.date).getTime() === new Date(newEventData.date).getTime()
    );

    if (eventIndex === -1) {
      const updatedData = [...existingData, newEventData];
      logger.info(`Appending new event to historical_schedules/${year}. Total events: ${updatedData.length}`);
      transaction.update(yearDocRef, { data: updatedData });
      return;
    }

    const eventToUpdate = existingData[eventIndex];
    let hasBeenUpdated = false;

    // Fill blank scalar timing/venue fields.
    if (fillBlankFields(eventToUpdate, newEventData, SCHEDULE_SCALAR_FIELDS)) {
      hasBeenUpdated = true;
    }

    // Merge the running order: add missing corps, fill blanks on existing ones.
    if (!Array.isArray(eventToUpdate.lineup)) eventToUpdate.lineup = [];
    const existingByCorps = new Map(
      eventToUpdate.lineup.map((entry) => [normalizeCorps(entry.corps), entry])
    );
    for (const newEntry of newEventData.lineup || []) {
      const key = normalizeCorps(newEntry.corps);
      if (!key) continue;
      const existingEntry = existingByCorps.get(key);
      if (!existingEntry) {
        eventToUpdate.lineup.push(newEntry);
        existingByCorps.set(key, newEntry);
        hasBeenUpdated = true;
        logger.info(`Adding missing lineup entry for ${newEntry.corps}.`);
      } else if (fillBlankFields(existingEntry, newEntry, LINEUP_FILL_FIELDS)) {
        hasBeenUpdated = true;
      }
    }

    if (hasBeenUpdated) {
      // Keep the running order sorted by performance time when order is known.
      eventToUpdate.lineup.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      existingData[eventIndex] = eventToUpdate;
      transaction.update(yearDocRef, { data: existingData });
      logger.info(`Successfully merged schedule into event: ${newEventData.eventName}`);
    } else {
      logger.info(`No new schedule data to merge for event: ${newEventData.eventName}. Skipping.`);
    }
  });
}

/**
 * Build the historical_schedules event record from an enriched scraped event,
 * computing the archive year and offSeasonDay the same way the scores pipeline
 * does (so schedules line up with scores by event + offSeasonDay).
 *
 * @param {Object} event - { eventName, date, location, venue, timezone, gatesAt,
 *   startsAt, scoresAt, lineup }
 * @returns {{year:number, data:Object}|null} null when the event has no date/name
 *   or carries neither timing nor a lineup (nothing worth archiving).
 */
function buildScheduleEventData(event) {
  if (!event || !event.date || !event.eventName) return null;
  const hasContent = (Array.isArray(event.lineup) && event.lineup.length > 0) || event.startsAt;
  if (!hasContent) return null;

  // Lazy require keeps this module light for the merge unit test (season.js pulls
  // a large dependency graph). Only loaded when actually archiving at runtime.
  const { calculateOffSeasonDay } = require("./season");
  const parsedDate = new Date(event.date);
  const year = parsedDate.getUTCFullYear();
  const offSeasonDay = calculateOffSeasonDay(parsedDate, year);

  return {
    year,
    data: {
      eventName: event.eventName,
      date: event.date,
      location: event.location || null,
      venue: event.venue || null,
      timezone: event.timezone || null,
      gatesAt: event.gatesAt || null,
      startsAt: event.startsAt || null,
      scoresAt: event.scoresAt || null,
      offSeasonDay,
      lineup: Array.isArray(event.lineup) ? event.lineup : [],
    },
  };
}

/**
 * Archive a batch of enriched events into historical_schedules/{year}. Events
 * with no lineup/timing are skipped. Never throws — one bad event can't abort a
 * schedule build. Returns how many were archived.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {Array<Object>} events
 * @returns {Promise<{archived:number, skipped:number}>}
 */
async function archiveScheduleEvents(db, events) {
  let archived = 0;
  let skipped = 0;
  for (const event of events || []) {
    const built = buildScheduleEventData(event);
    if (!built) {
      skipped += 1;
      continue;
    }
    try {
      await mergeEventIntoHistoricalSchedules(db, built.year, built.data);
      archived += 1;
    } catch (error) {
      skipped += 1;
      logger.warn(`[HistoricalSchedules] Failed to archive "${event.eventName}": ${error.message}`);
    }
  }
  logger.info(`[HistoricalSchedules] Archived ${archived}/${archived + skipped} events with lineup/timing.`);
  return { archived, skipped };
}

module.exports = {
  mergeEventIntoHistoricalSchedules,
  buildScheduleEventData,
  archiveScheduleEvents,
  normalizeCorps,
};
