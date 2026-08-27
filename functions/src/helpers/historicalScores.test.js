// Tests for the sharded historical_scores archive: the single-event-doc merge
// (mergeEventIntoHistoricalScores) and the union read layer (loadHistoricalYear
// / loadHistoricalYears / loadAllHistoricalYears). A purpose-built in-memory
// Firestore models the parent year doc + its `events` subcollection so the
// merge rules and the legacy↔sharded transition can be asserted without an
// emulator. Node's built-in runner (node:test); run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  mergeEventIntoHistoricalScores,
  loadHistoricalYear,
  loadHistoricalYears,
  loadAllHistoricalYears,
  eventDocId,
  eventMatchKey,
  mergeEventLists,
} = require("./historicalScores");

// -----------------------------------------------------------------------------
// In-memory Firestore modelling exactly the refs the helper touches:
//   historical_scores/{year}                    (parent doc; legacy `data` opt.)
//   historical_scores/{year}/events/{eventId}   (one doc per event)
// initial: { [year]: { legacy?: Event[], events?: {id: Event}, parent?: object } }
// -----------------------------------------------------------------------------
function makeDb(initial = {}) {
  const years = {};
  for (const [year, cfg] of Object.entries(initial)) {
    const parent =
      cfg.legacy !== undefined
        ? { data: cfg.legacy, ...(cfg.parent || {}) }
        : cfg.parent;
    years[year] = { doc: parent, events: { ...(cfg.events || {}) } };
  }
  const ensure = (year) => (years[year] ||= { doc: undefined, events: {} });
  const snap = (data, id) => ({ exists: data !== undefined, id, data: () => data });

  const eventRef = (year, id) => ({
    _kind: "event",
    year,
    id,
    get: async () => snap(ensure(year).events[id], id),
    _set: (data) => {
      ensure(year).events[id] = data;
    },
  });
  const eventsCollection = (year) => ({
    doc: (id) => eventRef(year, id),
    get: async () => ({
      docs: Object.entries(ensure(year).events).map(([id, data]) => snap(data, id)),
    }),
  });
  const yearRef = (year) => ({
    _kind: "year",
    year,
    get: async () => snap(ensure(year).doc, String(year)),
    collection: (name) => {
      assert.equal(name, "events");
      return eventsCollection(year);
    },
    _set: (data, opts) => {
      const y = ensure(year);
      y.doc = opts && opts.merge && y.doc ? { ...y.doc, ...data } : data;
    },
  });

  const db = {
    collection(name) {
      assert.equal(name, "historical_scores");
      return {
        doc: (year) => yearRef(year),
        get: async () => ({
          docs: Object.entries(years)
            .filter(([, y]) => y.doc !== undefined)
            .map(([id, y]) => snap(y.doc, id)),
        }),
      };
    },
    async runTransaction(fn) {
      const transaction = {
        get: (ref) => ref.get(),
        set: (ref, data, opts) => ref._set(data, opts),
      };
      return fn(transaction);
    },
  };
  return { db, years };
}

const event = (overrides = {}) => ({
  eventName: "Regional Championship",
  date: "2024-07-15",
  location: "Anywhere",
  scores: [{ corps: "Blue Devils", captions: { GE1: 18, B: 17 } }],
  headerMap: {},
  offSeasonDay: 20,
  ...overrides,
});

/** The lone event stored under a year's subcollection, for assertions. */
function onlyEvent(years, year) {
  const events = Object.values(years[year].events);
  assert.equal(events.length, 1, `expected exactly one sharded event for ${year}`);
  return events[0];
}

describe("mergeEventIntoHistoricalScores (sharded write)", () => {
  test("creates the event doc and materializes the parent when the year is new", async () => {
    const { db, years } = makeDb();
    await mergeEventIntoHistoricalScores(db, 2024, event());

    // Parent doc exists (so whole-collection reads enumerate the year)...
    assert.equal(years[2024].doc.sharded, true);
    // ...and the event lives in the subcollection, not a parent `data` array.
    assert.equal(years[2024].doc.data, undefined);
    assert.equal(onlyEvent(years, 2024).eventName, "Regional Championship");
  });

  test("stores each event under a deterministic id and re-scrapes the same doc", async () => {
    const { db, years } = makeDb();
    await mergeEventIntoHistoricalScores(db, 2024, event());
    await mergeEventIntoHistoricalScores(db, 2024, event()); // identical re-scrape
    assert.equal(Object.keys(years[2024].events).length, 1);
    assert.ok(years[2024].events[eventDocId("Regional Championship", "2024-07-15")]);
  });

  test("adds a missing corps to an already-sharded event", async () => {
    const id = eventDocId("Regional Championship", "2024-07-15");
    const { db, years } = makeDb({ 2024: { parent: { sharded: true }, events: { [id]: event() } } });
    await mergeEventIntoHistoricalScores(
      db,
      2024,
      event({
        scores: [
          { corps: "Blue Devils", captions: { GE1: 18, B: 17 } },
          { corps: "Bluecoats", captions: { GE1: 17, B: 16 } },
        ],
      })
    );
    assert.deepEqual(
      onlyEvent(years, 2024).scores.map((s) => s.corps),
      ["Blue Devils", "Bluecoats"]
    );
  });

  test("fills only blank/zero captions, never overwriting existing values", async () => {
    const id = eventDocId("Regional Championship", "2024-07-15");
    const existing = event({
      scores: [{ corps: "Blue Devils", captions: { GE1: 18, B: 0, VP: undefined } }],
    });
    const { db, years } = makeDb({ 2024: { parent: { sharded: true }, events: { [id]: existing } } });
    await mergeEventIntoHistoricalScores(
      db,
      2024,
      event({ scores: [{ corps: "Blue Devils", captions: { GE1: 99, B: 17, VP: 15 } }] })
    );
    const captions = onlyEvent(years, 2024).scores[0].captions;
    assert.equal(captions.GE1, 18); // existing non-zero preserved
    assert.equal(captions.B, 17); // zero filled
    assert.equal(captions.VP, 15); // blank filled
  });

  test("skips the write when a sharded event has nothing new to merge", async () => {
    const id = eventDocId("Regional Championship", "2024-07-15");
    const stored = event();
    const { db, years } = makeDb({ 2024: { parent: { sharded: true }, events: { [id]: stored } } });
    await mergeEventIntoHistoricalScores(db, 2024, event()); // identical
    // Same object reference retained — nothing was rewritten.
    assert.equal(years[2024].events[id], stored);
  });

  test("matches by name AND date — same name, different date is a separate doc", async () => {
    const id = eventDocId("Regional Championship", "2024-07-15");
    const { db, years } = makeDb({ 2024: { parent: { sharded: true }, events: { [id]: event() } } });
    await mergeEventIntoHistoricalScores(db, 2024, event({ date: "2024-07-16" }));
    assert.equal(Object.keys(years[2024].events).length, 2);
  });

  test("overwrite=true replaces total + captions and still appends new corps", async () => {
    const id = eventDocId("Regional Championship", "2024-07-15");
    const existing = event({ scores: [{ corps: "Blue Devils", score: 80, captions: { GE1: 18, B: 17 } }] });
    const { db, years } = makeDb({ 2024: { parent: { sharded: true }, events: { [id]: existing } } });
    await mergeEventIntoHistoricalScores(
      db,
      2024,
      event({
        overwrite: true,
        scores: [
          { corps: "Blue Devils", score: 95.5, captions: { GE1: 19, B: 18 } },
          { corps: "Bluecoats", score: 79, captions: { GE1: 17 } },
        ],
      })
    );
    const scores = onlyEvent(years, 2024).scores;
    assert.equal(scores[0].score, 95.5); // replaced (fill mode would never touch it)
    assert.equal(scores[0].captions.GE1, 19);
    assert.deepEqual(scores.map((s) => s.corps), ["Blue Devils", "Bluecoats"]);
    // The transient overwrite flag never gets persisted.
    assert.equal(onlyEvent(years, 2024).overwrite, undefined);
  });

  test("seeds from a legacy in-array event during the migration window (no corps lost)", async () => {
    // Year still holds the event only in the parent's legacy `data` array.
    const legacyEvent = event({ scores: [{ corps: "Blue Devils", captions: { GE1: 18 } }] });
    const { db, years } = makeDb({ 2024: { legacy: [legacyEvent] } });

    await mergeEventIntoHistoricalScores(
      db,
      2024,
      event({
        scores: [
          { corps: "Blue Devils", captions: { GE1: 18 } },
          { corps: "Cadets", captions: { GE1: 16 } },
        ],
      })
    );

    // The event is now sharded, seeded from legacy + the new corps.
    const corps = onlyEvent(years, 2024).scores.map((s) => s.corps);
    assert.deepEqual(corps, ["Blue Devils", "Cadets"]);
    // The union read returns the sharded copy (which wins over the stale legacy row).
    const loaded = await loadHistoricalYear(db, 2024);
    assert.equal(loaded.length, 1);
    assert.deepEqual(loaded[0].scores.map((s) => s.corps), ["Blue Devils", "Cadets"]);
  });
});

describe("loadHistoricalYear (union read)", () => {
  test("returns legacy events before any migration", async () => {
    const { db } = makeDb({ 2024: { legacy: [event({ eventName: "A" }), event({ eventName: "B" })] } });
    const events = await loadHistoricalYear(db, 2024);
    assert.deepEqual(events.map((e) => e.eventName).sort(), ["A", "B"]);
  });

  test("unions legacy and sharded events, sharded winning on a conflict", async () => {
    const legacy = event({ eventName: "Shared", scores: [{ corps: "Old", captions: {} }] });
    const shardedId = eventDocId("Shared", "2024-07-15");
    const sharded = event({ eventName: "Shared", scores: [{ corps: "New", captions: {} }] });
    const { db } = makeDb({
      2024: { legacy: [legacy, event({ eventName: "LegacyOnly" })], events: { [shardedId]: sharded } },
    });
    const events = await loadHistoricalYear(db, 2024);
    assert.deepEqual(events.map((e) => e.eventName).sort(), ["LegacyOnly", "Shared"]);
    const shared = events.find((e) => e.eventName === "Shared");
    assert.deepEqual(shared.scores.map((s) => s.corps), ["New"]); // sharded won
  });

  test("returns [] for a year with neither parent nor events", async () => {
    const { db } = makeDb();
    assert.deepEqual(await loadHistoricalYear(db, 1999), []);
  });
});

describe("loadHistoricalYears / loadAllHistoricalYears", () => {
  test("keys by year and omits years with no events", async () => {
    const { db } = makeDb({
      2023: { legacy: [event({ eventName: "X" })] },
      2024: { parent: { sharded: true } }, // materialized but empty
    });
    const map = await loadHistoricalYears(db, [2023, 2024, 2025]);
    assert.deepEqual(Object.keys(map).sort(), ["2023"]);
    assert.equal(map["2023"].length, 1);
  });

  test("enumerates every materialized parent year", async () => {
    const idA = eventDocId("A", "2024-07-15");
    const { db } = makeDb({
      2022: { legacy: [event({ eventName: "L" })] },
      2024: { parent: { sharded: true }, events: { [idA]: event({ eventName: "A" }) } },
    });
    const all = await loadAllHistoricalYears(db);
    assert.deepEqual(Object.keys(all).sort(), ["2022", "2024"]);
  });
});

describe("pure key/union helpers", () => {
  test("eventDocId is deterministic, hex, and matches on the same instant", () => {
    const a = eventDocId("Finals", "2024-08-10");
    const b = eventDocId("Finals", "2024-08-10T00:00:00.000Z");
    assert.equal(a, b); // same instant → same id
    assert.match(a, /^[0-9a-f]{40}$/);
    assert.notEqual(a, eventDocId("Finals", "2024-08-11"));
  });

  test("eventMatchKey pairs with eventDocId's identity", () => {
    assert.equal(eventMatchKey(event({ date: "2024-07-15" })), eventMatchKey(event({ date: "2024-07-15T00:00:00Z" })));
    assert.notEqual(eventMatchKey(event({ eventName: "A" })), eventMatchKey(event({ eventName: "B" })));
  });

  test("mergeEventLists lets the sharded list win", () => {
    const legacy = [event({ eventName: "Dup", location: "old" }), event({ eventName: "Solo" })];
    const sub = [event({ eventName: "Dup", location: "new" })];
    const merged = mergeEventLists(legacy, sub);
    assert.deepEqual(merged.map((e) => e.eventName).sort(), ["Dup", "Solo"]);
    assert.equal(merged.find((e) => e.eventName === "Dup").location, "new");
  });
});
