const { logger } = require("firebase-functions/v2");
const crypto = require("crypto");

// historical_scores used to be one document per year holding the whole season's
// events in a single `data` array. A full season lands near Firestore's 1 MiB
// document cap, so the nightly merge would eventually hard-fail mid-season at
// ~1:30 AM — the exact failure this file now designs away.
//
// The events are sharded into a subcollection: historical_scores/{year}/events/
// {eventDocId}, one small document per event. Writes touch a single event doc
// (O(1), no whole-array read-modify-write, structurally immune to the 1 MiB
// cap). Reads still get a whole-year array — no reader ever wants one event
// without the year (confirmed across every call site) — via loadHistoricalYear,
// which UNIONS the sharded docs with any legacy in-array events so it stays
// correct before, during, and after the one-time migration
// (scripts/migrateHistoricalScoresToSubcollection.js). Once migration clears a
// year's legacy `data`, that year is served purely from the subcollection.
//
// The parent historical_scores/{year} document is always materialized (with a
// { sharded: true } marker) on first write, so whole-collection readers that
// enumerate years via .get() still see every year.

const EVENTS_SUBCOLLECTION = "events";

/**
 * Parent year document ref.
 * @param {FirebaseFirestore.Firestore} db
 * @param {string|number} year
 * @returns {FirebaseFirestore.DocumentReference}
 */
function historicalYearRef(db, year) {
  return db.collection("historical_scores").doc(String(year));
}

/**
 * The per-year events subcollection ref.
 * @param {FirebaseFirestore.Firestore} db
 * @param {string|number} year
 * @returns {FirebaseFirestore.CollectionReference}
 */
function historicalEventsRef(db, year) {
  return historicalYearRef(db, year).collection(EVENTS_SUBCOLLECTION);
}

/**
 * The instant an event is keyed on. Events are matched by name AND date; the
 * date is normalized to an epoch so two encodings of the same instant match.
 * Returns NaN for an unparseable date (callers fall back to the raw string).
 */
function eventInstant(date) {
  return new Date(date).getTime();
}

/**
 * Stable, collision-resistant Firestore document id for an event, derived from
 * (eventName, instant). Deterministic so re-scraping the same event updates the
 * same doc rather than duplicating it. Hashed because event names contain
 * slashes and other characters illegal in a document id.
 */
function eventDocId(eventName, date) {
  const ms = eventInstant(date);
  const basis = Number.isNaN(ms)
    ? `name:${eventName} raw:${String(date)}`
    : `name:${eventName} ms:${ms}`;
  return crypto.createHash("sha256").update(basis).digest("hex").slice(0, 40);
}

/** The in-memory dedupe key mirroring eventDocId's (name, instant) identity. */
function eventMatchKey(event) {
  const ms = eventInstant(event.date);
  return Number.isNaN(ms)
    ? `${event.eventName} raw:${String(event.date)}`
    : `${event.eventName} ${ms}`;
}

/**
 * Union two event lists on (name, date) identity, with `subEvents` (the sharded,
 * authoritative copy) winning over `legacyEvents` (the pre-migration in-array
 * copy) for any event present in both.
 */
function mergeEventLists(legacyEvents, subEvents) {
  const byKey = new Map();
  for (const e of legacyEvents || []) byKey.set(eventMatchKey(e), e);
  for (const e of subEvents || []) byKey.set(eventMatchKey(e), e);
  return [...byKey.values()];
}

/**
 * Merge new scores into `base.scores` following the archive's rules. Returns
 * `{ merged, changed }`; `merged` is a fresh object (no mutation of `base`).
 *
 *  - New corps            -> appended.
 *  - overwrite mode       -> existing corps' total + captions replaced outright.
 *  - default (fill) mode  -> only blank/zero captions filled; existing non-zero
 *                            values and the existing total are never touched.
 */
function mergeScoresInto(base, incoming, overwrite) {
  const merged = { ...base, scores: [...(base.scores || [])] };
  let changed = false;

  // Backfill any top-level fields the base copy is missing (e.g. a base seeded
  // from a sparse legacy row) from the incoming event.
  for (const field of ["eventName", "date", "location", "offSeasonDay", "headerMap"]) {
    if (merged[field] === undefined && incoming[field] !== undefined) {
      merged[field] = incoming[field];
      changed = true;
    }
  }

  for (const newScore of incoming.scores || []) {
    const idx = merged.scores.findIndex((s) => s.corps === newScore.corps);
    if (idx === -1) {
      merged.scores.push(newScore);
      changed = true;
      continue;
    }
    const existing = merged.scores[idx];
    if (overwrite) {
      merged.scores[idx] = {
        ...existing,
        score: newScore.score,
        captions: { ...newScore.captions },
      };
      changed = true;
      continue;
    }
    const captions = { ...(existing.captions || {}) };
    let capChanged = false;
    for (const caption in newScore.captions) {
      if (newScore.captions[caption] > 0 && (!captions[caption] || captions[caption] === 0)) {
        captions[caption] = newScore.captions[caption];
        capChanged = true;
      }
    }
    if (capChanged) {
      merged.scores[idx] = { ...existing, captions };
      changed = true;
    }
  }

  return { merged, changed };
}

/**
 * Merge one scored event into historical_scores/{year}, writing a single event
 * document in the subcollection. Shared by the DCI and live-score recap pubsub
 * handlers. Idempotent and additive; the signature is unchanged from the
 * pre-sharding version so callers are untouched.
 *
 * Merge rules (see mergeScoresInto): no doc yet -> create it; event absent ->
 * create the event doc; event present -> add missing corps and fill blank/zero
 * captions (or, with `newEventData.overwrite === true`, replace total+captions
 * outright — used only by the admin day-range backfill to correct bad data).
 *
 * Transition safety: if the event is not yet sharded but exists in the parent's
 * legacy `data` array (the window between deploy and running the migration), it
 * is seeded from that legacy row so no corps is lost; the sharded copy then wins
 * on every subsequent read.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {string|number} year - Calendar year; the parent document id.
 * @param {Object} newEventData - { eventName, date, location, scores, headerMap, offSeasonDay, overwrite? }
 * @returns {Promise<void>}
 */
async function mergeEventIntoHistoricalScores(db, year, newEventData) {
  const yearRef = historicalYearRef(db, year);
  const eventRef = historicalEventsRef(db, year).doc(
    eventDocId(newEventData.eventName, newEventData.date)
  );
  const { overwrite, ...incoming } = newEventData;

  await db.runTransaction(async (transaction) => {
    // Firestore requires all reads before any write.
    const eventSnap = await transaction.get(eventRef);
    const yearSnap = await transaction.get(yearRef);

    let base = eventSnap.exists ? eventSnap.data() : null;
    let seededFromLegacy = false;

    if (!base && yearSnap.exists) {
      const key = eventMatchKey(incoming);
      const legacy = (yearSnap.data().data || []).find((e) => eventMatchKey(e) === key);
      if (legacy) {
        base = legacy;
        seededFromLegacy = true;
      }
    }

    // Materialize the parent so whole-collection readers enumerate this year.
    if (!yearSnap.exists) {
      transaction.set(yearRef, { createdAt: new Date(), sharded: true }, { merge: true });
    }

    if (!base) {
      logger.info(`historical_scores/${year}: creating event "${incoming.eventName}".`);
      transaction.set(eventRef, incoming);
      return;
    }

    const { merged, changed } = mergeScoresInto(base, incoming, overwrite);
    // A legacy-seeded event is written even with no new scores, to migrate it
    // out of the shrinking parent array into its own document.
    if (changed || seededFromLegacy) {
      transaction.set(eventRef, merged);
      logger.info(`historical_scores/${year}: merged scores into "${incoming.eventName}".`);
    } else {
      logger.info(`historical_scores/${year}: nothing new for "${incoming.eventName}", skipping.`);
    }
  });
}

/**
 * Load a whole year's events as an array, unioning the sharded subcollection
 * with any legacy in-array events (sharded wins). This is the single read path
 * every consumer should use in place of `doc.data().data`.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {string|number} year
 * @returns {Promise<Object[]>} events (empty if the year has none)
 */
async function loadHistoricalYear(db, year) {
  const yearRef = historicalYearRef(db, year);
  const [yearSnap, eventsSnap] = await Promise.all([
    yearRef.get(),
    yearRef.collection(EVENTS_SUBCOLLECTION).get(),
  ]);
  const legacy = yearSnap.exists ? yearSnap.data().data || [] : [];
  const sub = eventsSnap.docs.map((d) => d.data());
  return mergeEventLists(legacy, sub);
}

/**
 * Load several years, keyed by year id. Years with no events are omitted (the
 * same contract the old `if (doc.exists)` reads had).
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {Array<string|number>} years
 * @returns {Promise<Record<string, Object[]>>}
 */
async function loadHistoricalYears(db, years) {
  const unique = [...new Set(years.map(String))];
  const loaded = await Promise.all(unique.map((year) => loadHistoricalYear(db, year)));
  /** @type {Record<string, any[]>} */
  const out = {};
  unique.forEach((year, i) => {
    if (loaded[i].length) out[year] = loaded[i];
  });
  return out;
}

/**
 * Load every year in the collection, keyed by year id. Enumerates parent
 * documents (always materialized) then unions each year's events.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @returns {Promise<Record<string, Object[]>>}
 */
async function loadAllHistoricalYears(db) {
  const parents = await db.collection("historical_scores").get();
  return loadHistoricalYears(
    db,
    parents.docs.map((d) => d.id)
  );
}

module.exports = {
  EVENTS_SUBCOLLECTION,
  historicalYearRef,
  historicalEventsRef,
  eventDocId,
  eventMatchKey,
  mergeEventLists,
  mergeScoresInto,
  mergeEventIntoHistoricalScores,
  loadHistoricalYear,
  loadHistoricalYears,
  loadAllHistoricalYears,
};
