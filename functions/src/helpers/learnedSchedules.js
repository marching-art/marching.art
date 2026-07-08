const { onCall } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
const { assertAdmin } = require("./callableGuards");
const { deriveRunningOrder } = require("./scheduleModel");
const { resolveTimezone, zonedWallTimeToUtc } = require("./eventDetails");
const { mergeEventRecords } = require("./historicalSchedules");

// Minimum scored corps for an event to get a synthesized running order — fewer
// than this isn't a meaningful "show".
const MIN_FIELD = 4;

/**
 * All-Age (adult) events are never referenced in the game and, on Finals
 * Saturday, the All-Age World Championship (morning) shares a near-identical
 * name with the DCI World Championship Finals (evening). Excluding them keeps
 * the heritage archive to the DCI (junior) events the game actually uses and
 * removes the morning/evening finals ambiguity. Matched on the event name.
 * @param {string} eventName
 * @returns {boolean}
 */
function isAllAgeEvent(eventName) {
  return /all[\s-]?age/i.test(eventName || "") || /\bDCA\b/.test(eventName || "");
}

/**
 * Placeholder events with no real title (From The Pressbox imports, 2000-2012)
 * make poor schedule entries. Their scores still feed stats; they just don't get
 * a synthesized running order.
 * @param {string} eventName
 * @returns {boolean}
 */
function isPlaceholderEvent(eventName) {
  return /^DCI Competition - /.test(eventName || "");
}

/**
 * Convert minutes-past-local-midnight (which may exceed 1440 for a show that
 * runs past midnight) to an absolute ISO instant on the given date + timezone.
 */
function localMinutesToIso(year, monthIndex, day, minutes, timeZone) {
  const dayOffset = Math.floor(minutes / 1440);
  const m = ((minutes % 1440) + 1440) % 1440;
  return zonedWallTimeToUtc(
    year, monthIndex, day + dayOffset, Math.floor(m / 60), m % 60, timeZone
  ).toISOString();
}

/**
 * Build a learned (synthesized) historical_schedules record from one
 * historical_scores event. Casts the event's REAL competing corps in a running
 * order derived from their scores (reverse standings, per the calibrated model)
 * and stamps absolute performance times on the event's own date + venue timezone.
 *
 * @param {Object} scoreEvent - historical_scores event:
 *   { eventName, date, location, offSeasonDay, scores:[{corps, score}] }
 * @returns {Object|null} A learned event record, or null when the event is
 *   all-age / placeholder / too small / undated / has no offSeasonDay.
 */
function buildLearnedScheduleEvent(scoreEvent) {
  if (!scoreEvent || !scoreEvent.eventName || !scoreEvent.date) return null;
  if (scoreEvent.offSeasonDay == null) return null;
  if (isAllAgeEvent(scoreEvent.eventName) || isPlaceholderEvent(scoreEvent.eventName)) return null;

  // A real DCI total is always positive; null/blank/zero means "no score" (e.g.
  // exhibition or DNF) and that corps must not be placed in the running order.
  const field = (scoreEvent.scores || [])
    .map((s) => ({ corps: s.corps, score: Number(s.score) }))
    .filter((f) => f.corps && Number.isFinite(f.score) && f.score > 0);
  if (field.length < MIN_FIELD) return null;

  const parsedDate = scoreEvent.date?.toDate ? scoreEvent.date.toDate() : new Date(scoreEvent.date);
  if (isNaN(parsedDate.getTime())) return null;
  const y = parsedDate.getUTCFullYear();
  const mo = parsedDate.getUTCMonth();
  const d = parsedDate.getUTCDate();

  const timezone = resolveTimezone(scoreEvent.location, null);
  const ro = deriveRunningOrder(field);
  const toIso = (mins) => localMinutesToIso(y, mo, d, mins, timezone);

  const lineup = ro.lineup.map((e) => ({
    order: e.order,
    corps: e.corps,
    hometown: null, // historical_scores carries no hometown
    performanceTime: e.performanceTime,
    performsAt: toIso(e.performsAtLocalMinutes),
  }));

  return {
    eventName: scoreEvent.eventName,
    date: typeof scoreEvent.date === "string" ? scoreEvent.date : parsedDate.toISOString(),
    location: scoreEvent.location || null,
    venue: null,
    timezone,
    gatesAt: toIso(ro.gatesLocalMinutes),
    startsAt: toIso(ro.startLocalMinutes),
    scoresAt: toIso(ro.scoresLocalMinutes),
    offSeasonDay: scoreEvent.offSeasonDay,
    source: "learned",
    modelVersion: ro.modelVersion,
    lineup,
  };
}

/**
 * Build learned schedules for one year and merge them into
 * historical_schedules/{year}, honoring source precedence: a real scraped record
 * is always kept over a learned one; a prior learned record is replaced on
 * rebuild; scraped-only events already present are left untouched.
 *
 * Reads historical_scores/{year} once, then does the schedule merge in a single
 * transaction over the year doc (avoids per-event contention).
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} year
 * @returns {Promise<Object>} Per-year counts.
 */
async function buildLearnedSchedulesForYear(db, year) {
  const counts = { year, built: 0, scrapedKept: 0, skipped: 0, total: 0 };

  const scoresDoc = await db.doc(`historical_scores/${year}`).get();
  if (!scoresDoc.exists) return counts;
  const scoreEvents = scoresDoc.data().data || [];
  counts.total = scoreEvents.length;

  const learned = [];
  for (const ev of scoreEvents) {
    const rec = buildLearnedScheduleEvent(ev);
    if (rec) learned.push(rec);
    else counts.skipped += 1;
  }
  if (learned.length === 0) return counts;

  const schedRef = db.doc(`historical_schedules/${year}`);
  await db.runTransaction(async (tx) => {
    const schedDoc = await tx.get(schedRef);
    const data = schedDoc.exists ? (schedDoc.data().data || []) : [];

    const keyOf = (e) => `${e.eventName}::${new Date(e.date).getTime()}`;
    const indexByKey = new Map(data.map((e, i) => [keyOf(e), i]));

    for (const rec of learned) {
      const idx = indexByKey.get(keyOf(rec));
      if (idx === undefined) {
        indexByKey.set(keyOf(rec), data.length);
        data.push(rec);
        counts.built += 1;
      } else {
        const { event, changed } = mergeEventRecords(data[idx], rec);
        if (changed) {
          data[idx] = event;
          counts.built += 1;
        } else {
          counts.scrapedKept += 1; // existing scraped record outranks learned
        }
      }
    }

    tx.set(schedRef, { data }, { merge: true });
  });

  logger.info(
    `[LearnedSchedules] ${year}: ${counts.built} learned, ${counts.scrapedKept} scraped kept, ` +
    `${counts.skipped}/${counts.total} skipped.`
  );
  return counts;
}

/**
 * Build learned schedules across every year present in historical_scores.
 * @param {FirebaseFirestore.Firestore} db
 * @returns {Promise<Object>} Aggregate counts + per-year breakdown.
 */
async function buildAllLearnedSchedules(db) {
  const yearRefs = await db.collection("historical_scores").listDocuments();
  const years = yearRefs.map((r) => r.id).sort();

  const perYear = [];
  const totals = { years: 0, built: 0, scrapedKept: 0, skipped: 0 };
  for (const year of years) {
    const c = await buildLearnedSchedulesForYear(db, year);
    perYear.push(c);
    totals.years += 1;
    totals.built += c.built;
    totals.scrapedKept += c.scrapedKept;
    totals.skipped += c.skipped;
  }
  return { ...totals, perYear };
}

/**
 * Admin-only: synthesize learned running orders for every archived scored event
 * and merge them into historical_schedules (source: "learned"). Idempotent and
 * safe to re-run — scraped records are never overwritten, and a rebuild adopts
 * the latest calibrated model. Run this once during the August cutover (after the
 * schedule backfill) to give pre-2019 years a running order.
 */
const buildLearnedSchedules = onCall({
  cors: true,
  timeoutSeconds: 540,
  memory: "512MiB",
}, async (request) => {
  assertAdmin(request);
  logger.info(`Admin ${request.auth.uid} kicked off a learned-schedule build.`);
  const result = await buildAllLearnedSchedules(getDb());
  return {
    success: true,
    message: `Learned schedules built across ${result.years} years: ${result.built} events ` +
      `synthesized, ${result.scrapedKept} scraped kept, ${result.skipped} skipped (all-age / ` +
      "placeholder / too few corps). Existing scraped running orders were never overwritten.",
    ...result,
  };
});

module.exports = {
  isAllAgeEvent,
  isPlaceholderEvent,
  buildLearnedScheduleEvent,
  buildLearnedSchedulesForYear,
  buildAllLearnedSchedules,
  buildLearnedSchedules,
  MIN_FIELD,
};
