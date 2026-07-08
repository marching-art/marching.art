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

// Provenance precedence. A scraped (real dci.org) record outranks a learned
// (synthesized) one. Records with no `source` predate the flag and are real
// scrapes, so they default to the scraped rank.
const SOURCE_RANK = { scraped: 2, "learned-championship": 1, learned: 1 };
function sourceRank(ev) {
  return SOURCE_RANK[ev && ev.source] ?? 2;
}

/**
 * Additive fill-blanks merge of two SAME-provenance records (the original scraped
 * behavior): fill blank scalar fields, append missing lineup corps, fill blank
 * per-corps fields. Mutates `target`. Returns true if anything changed.
 */
function additiveFillMerge(target, incoming) {
  let changed = fillBlankFields(target, incoming, SCHEDULE_SCALAR_FIELDS);
  if (!Array.isArray(target.lineup)) target.lineup = [];
  const byCorps = new Map(target.lineup.map((e) => [normalizeCorps(e.corps), e]));
  for (const entry of incoming.lineup || []) {
    const key = normalizeCorps(entry.corps);
    if (!key) continue;
    const existing = byCorps.get(key);
    if (!existing) {
      target.lineup.push(entry);
      byCorps.set(key, entry);
      changed = true;
    } else if (fillBlankFields(existing, entry, LINEUP_FILL_FIELDS)) {
      changed = true;
    }
  }
  if (changed) target.lineup.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return changed;
}

/**
 * Resolve how an incoming event record merges with the existing record for the
 * same event (name+date), honoring source precedence:
 *   - scraped always beats learned (real replaces synthesized; never downgrade);
 *   - two scraped -> additive fill-blanks (idempotent live/backfill re-runs);
 *   - two learned -> replace (a rebuild adopts the latest model constants).
 * @param {Object|undefined} existing
 * @param {Object} incoming
 * @returns {{event:Object, changed:boolean}}
 */
function mergeEventRecords(existing, incoming) {
  if (!existing) return { event: incoming, changed: true };
  const re = sourceRank(existing);
  const ri = sourceRank(incoming);
  if (ri > re) return { event: incoming, changed: true }; // scraped replaces learned
  if (ri < re) return { event: existing, changed: false }; // keep scraped over learned
  if (ri === 1) { // both learned -> rebuild picks up the latest model
    return { event: incoming, changed: JSON.stringify(existing) !== JSON.stringify(incoming) };
  }
  const changed = additiveFillMerge(existing, incoming); // both scraped -> additive
  return { event: existing, changed };
}

/**
 * Merge one event's running order + timing into historical_schedules/{year},
 * inside a transaction. The schedule analog of mergeEventIntoHistoricalScores,
 * so both archives fill continuously (live + backfill + learned) and stay
 * joinable to each other by event name + date.
 *
 *  - No year document yet -> create it with this event.
 *  - Event not present     -> append it.
 *  - Event already present -> resolve via mergeEventRecords (source precedence).
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {string|number} year - Calendar year; used as the document id.
 * @param {Object} newEventData - { eventName, date, location, venue, timezone,
 *   gatesAt, startsAt, scoresAt, offSeasonDay, source, lineup:[{order,corps,
 *   hometown,performanceTime,performsAt}] }
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
      transaction.update(yearDocRef, { data: [...existingData, newEventData] });
      logger.info(`Appended new event to historical_schedules/${year}: ${newEventData.eventName}`);
      return;
    }

    const { event, changed } = mergeEventRecords(existingData[eventIndex], newEventData);
    if (changed) {
      existingData[eventIndex] = event;
      transaction.update(yearDocRef, { data: existingData });
      logger.info(`Merged schedule into event: ${newEventData.eventName}`);
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
      source: "scraped",
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
  mergeEventRecords,
  sourceRank,
  buildScheduleEventData,
  archiveScheduleEvents,
  normalizeCorps,
};
