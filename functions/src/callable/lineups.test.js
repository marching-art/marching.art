// Tests for the pure show-selection validator behind selectUserShows —
// weekly caps, the one-show-per-day rule, and the Phase 6.1 counts-as-one
// rule for multi-night events (the Eastern Classic appears on days 41 AND
// 42; selecting both entries would silently burn a weekly slot for a second
// registration scoring already treats as the same event).
//
// Also covers the saveLineup/validateLineup point-cap enforcement end-to-end
// via the v2 `.run()` test hook with a fake Firestore injected through
// config.setDbForTesting (same pattern as economyCallables.test.js) — point
// costs must be SERVER-AUTHORITATIVE, resolved from the dci-data registry,
// never from the client-supplied "corpsName|sourceYear|points" third segment.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");

const { setDbForTesting } = require("../config");
const {
  validateShowSelection,
  resolveShowsAgainstSchedule,
  getMaxShowsForWeek,
  saveLineup,
  validateLineup,
  selectUserShows,
} = require("./lineups");

describe("getMaxShowsForWeek", () => {
  test("4 in regular weeks, 7 in the final week", () => {
    assert.equal(getMaxShowsForWeek(1), 4);
    assert.equal(getMaxShowsForWeek(6), 4);
    assert.equal(getMaxShowsForWeek(7), 7);
  });
});

describe("validateShowSelection", () => {
  test("accepts a normal week of distinct shows", () => {
    assert.doesNotThrow(() =>
      validateShowSelection(2, [
        { eventName: "Show A", day: 8 },
        { eventName: "Show B", day: 10 },
        { eventName: "Show C", day: 13 },
      ], 4)
    );
  });

  test("rejects a missing week, non-array shows, and over-cap selections", () => {
    assert.throws(() => validateShowSelection(0, [], 4), /week number/);
    assert.throws(() => validateShowSelection(2, null, 4), /week number/);
    assert.throws(
      () => validateShowSelection(2, [{}, {}, {}, {}, {}], 4),
      /maximum of 4/
    );
  });

  test("rejects non-integer and out-of-range week numbers", () => {
    assert.throws(() => validateShowSelection("2", [], 4), /week number/);
    assert.throws(() => validateShowSelection(2.5, [], 4), /week number/);
    assert.throws(() => validateShowSelection(8, [], 4), /week number/);
    assert.throws(() => validateShowSelection(-1, [], 4), /week number/);
  });

  test("rejects a show without an eventName", () => {
    assert.throws(
      () => validateShowSelection(2, [{ day: 9 }], 4),
      /event name/
    );
    assert.throws(
      () => validateShowSelection(2, [null], 4),
      /event name/
    );
  });

  test("rejects two shows on the same day", () => {
    assert.throws(
      () =>
        validateShowSelection(2, [
          { eventName: "Show A", day: 9 },
          { eventName: "Show B", day: 9 },
        ], 4),
      /one show per day/
    );
  });

  test("multi-night events count as one: the same event on two days is rejected", () => {
    // The Eastern Classic is one event scheduled on both day 41 and day 42 —
    // the per-day check alone cannot catch a double-registration.
    assert.throws(
      () =>
        validateShowSelection(6, [
          { eventName: "marching.art Eastern Classic", day: 41 },
          { eventName: "marching.art Eastern Classic", day: 42 },
        ], 4),
      /count as one show/
    );
  });

  test("registering the Eastern Classic once alongside other shows is fine", () => {
    assert.doesNotThrow(() =>
      validateShowSelection(6, [
        { eventName: "marching.art Eastern Classic", day: 41 },
        { eventName: "Show B", day: 37 },
        { eventName: "Show C", day: 39 },
      ], 4)
    );
  });
});

// =============================================================================
// resolveShowsAgainstSchedule — server-authoritative day/date/location
// =============================================================================

describe("resolveShowsAgainstSchedule", () => {
  // Week 2 spans days 8-14
  const week2Competitions = [
    { name: "Show A", day: 9, date: "2026-07-01", location: "Anytown, USA" },
    { name: "Show B", day: 9, date: "2026-07-01", location: "Elsewhere, USA" },
    { name: "Show C", day: 12, date: "2026-07-04", location: "Somewhere, USA" },
    { name: "Other Week Show", day: 20, date: "2026-07-12", location: "Faraway, USA" },
  ];

  // Week 6 spans days 36-42; the Eastern Classic is ONE event on nights 41+42
  const week6Competitions = [
    { name: "Eastern Classic", day: 41, date: "2026-08-01", location: "Allentown, PA",
      multiNight: { nights: [41, 42] } },
    { name: "Eastern Classic", day: 42, date: "2026-08-02", location: "Allentown, PA",
      multiNight: { nights: [41, 42] } },
    { name: "Show D", day: 42, date: "2026-08-02", location: "Reading, PA" },
    { name: "Show E", day: 38, date: "2026-07-29", location: "Hershey, PA" },
  ];

  test("rejects an event that is not on the requested week's schedule", () => {
    assert.throws(
      () => resolveShowsAgainstSchedule(2, [{ eventName: "Invented Show" }], week2Competitions),
      /not on the week 2 schedule/
    );
    // On the schedule, but in a different week
    assert.throws(
      () => resolveShowsAgainstSchedule(2, [{ eventName: "Other Week Show" }], week2Competitions),
      /not on the week 2 schedule/
    );
  });

  test("derives day/date/location from the schedule, ignoring client values", () => {
    const resolved = resolveShowsAgainstSchedule(2, [
      { eventName: "Show A", day: 999, date: "1999-01-01", location: "Faked", hax: true },
    ], week2Competitions);

    assert.deepEqual(resolved, [
      { eventName: "Show A", day: 9, date: "2026-07-01", location: "Anytown, USA" },
    ]);
  });

  test("rejects two shows on the same schedule day even when the client omits day", () => {
    // Shows A and B are both on day 9; without the schedule lookup a client
    // omitting `day` slipped both past the dedupe and scoring accumulated
    // two scores for the day.
    assert.throws(
      () => resolveShowsAgainstSchedule(2, [
        { eventName: "Show A" },
        { eventName: "Show B" },
      ], week2Competitions),
      /one show per day/
    );
  });

  test("a multi-night event occupies every one of its nights", () => {
    // Scoring assigns exactly one of nights 41/42 via the snake split, which
    // is unknowable at selection time — so the Eastern Classic must conflict
    // with a single-night show on EITHER night.
    assert.throws(
      () => resolveShowsAgainstSchedule(6, [
        { eventName: "Eastern Classic" },
        { eventName: "Show D" },
      ], week6Competitions),
      /one show per day/
    );

    // Alone (or with shows on other days) it resolves once, to its first night
    const resolved = resolveShowsAgainstSchedule(6, [
      { eventName: "Eastern Classic" },
      { eventName: "Show E" },
    ], week6Competitions);
    assert.deepEqual(resolved, [
      { eventName: "Eastern Classic", day: 41, date: "2026-08-01", location: "Allentown, PA" },
      { eventName: "Show E", day: 38, date: "2026-07-29", location: "Hershey, PA" },
    ]);
  });
});

// =============================================================================
// saveLineup / validateLineup — server-authoritative point costs
// =============================================================================

const NS = process.env.DATA_NAMESPACE;
const profilePath = (uid) => `artifacts/${NS}/users/${uid}/profile/data`;

const CAPTIONS = ["GE1", "GE2", "VP", "VA", "CG", "B", "MA", "P"];

/**
 * Minimal fake Firestore covering exactly what the lineup callables use:
 * db.doc().get()/.update()/.set(), db.collection().doc(), db.batch(), and
 * db.runTransaction() with transaction.get/set/update/delete. Records every
 * write for assertions.
 */
function makeFakeDb(docs = new Map()) {
  const writes = [];

  const makeRef = (path) => ({
    path,
    async get() {
      const data = docs.get(path);
      return { exists: data !== undefined, data: () => data };
    },
    update(data) {
      writes.push({ type: "update", path, data });
    },
    set(data) {
      docs.set(path, data);
      writes.push({ type: "set", path, data });
    },
  });

  const db = {
    doc: (path) => makeRef(path),
    collection: (path) => ({
      doc: (id) => makeRef(`${path}/${id}`),
    }),
    batch: () => ({
      set(ref, data, opts) {
        writes.push({ type: "batchSet", path: ref.path, data, opts });
      },
      async commit() {},
    }),
    async runTransaction(fn) {
      const transaction = {
        async get(ref) {
          const data = docs.get(ref.path);
          return { exists: data !== undefined, data: () => data };
        },
        update(ref, data) {
          writes.push({ type: "update", path: ref.path, data });
        },
        set(ref, data) {
          writes.push({ type: "set", path: ref.path, data });
        },
        delete(ref) {
          writes.push({ type: "delete", path: ref.path });
        },
      };
      return fn(transaction);
    },
  };

  return { db, writes };
}

function authedRequest(uid, data = {}) {
  return { data, auth: { uid, token: {} } };
}

// Season registry: 8 elite corps at 25 points (8 x 25 = 200, over the 150
// worldClass cap) and 8 budget corps at 15 points (8 x 15 = 120, under it).
const corpsValues = [];
for (let i = 1; i <= 8; i++) {
  corpsValues.push({ corpsName: `Elite ${i}`, sourceYear: "2025", points: 25 });
  corpsValues.push({ corpsName: `Budget ${i}`, sourceYear: "2025", points: 15 });
}

/** Build an 8-caption lineup of `${prefix} 1..8` selection strings. */
function buildLineup(prefix, pointsSegment) {
  const lineup = {};
  CAPTIONS.forEach((caption, i) => {
    const base = `${prefix} ${i + 1}|2025`;
    lineup[caption] = pointsSegment === undefined ? base : `${base}|${pointsSegment}`;
  });
  return lineup;
}

function makeLineupDocs(profileCorps) {
  return new Map([
    ["game-settings/season", { seasonUid: "season-1", dataDocId: "dd-1" }],
    ["dci-data/dd-1", { corpsValues }],
    [profilePath("u1"), { corps: profileCorps }],
  ]);
}

after(() => setDbForTesting(null));

describe("saveLineup point-cap enforcement", () => {
  beforeEach(() => setDbForTesting(null));

  test("rejects tampered client points that understate an over-cap lineup", async () => {
    // True registry cost is 8 x 25 = 200 (> 150 cap) but the client claims
    // every corps costs 1 point. Must be rejected, with nothing written.
    const docs = makeLineupDocs({ worldClass: { lineup: {} } });
    const { db, writes } = makeFakeDb(docs);
    setDbForTesting(db);

    await assert.rejects(
      saveLineup.run(authedRequest("u1", {
        lineup: buildLineup("Elite", 1),
        corpsClass: "worldClass",
      })),
      /does not match this season's cost/
    );
    assert.equal(writes.length, 0);
  });

  test("computes the cap total from the registry when the points segment is omitted", async () => {
    const docs = makeLineupDocs({ worldClass: { lineup: {} } });
    const { db, writes } = makeFakeDb(docs);
    setDbForTesting(db);

    await assert.rejects(
      saveLineup.run(authedRequest("u1", {
        lineup: buildLineup("Elite"),
        corpsClass: "worldClass",
      })),
      /exceeds 150 point limit for worldClass. Total: 200/
    );
    assert.equal(writes.length, 0);
  });

  test("rejects a corps that is not in this season's registry", async () => {
    const docs = makeLineupDocs({ worldClass: { lineup: {} } });
    const { db, writes } = makeFakeDb(docs);
    setDbForTesting(db);

    const lineup = buildLineup("Budget", 15);
    lineup.GE1 = "Phantom Corps|1999|1";
    await assert.rejects(
      saveLineup.run(authedRequest("u1", { lineup, corpsClass: "worldClass" })),
      /not available this season/
    );
    assert.equal(writes.length, 0);
  });

  test("saves an honest lineup under the cap", async () => {
    // 8 x 15 = 120 <= 150, with points segments matching the registry.
    const docs = makeLineupDocs({ worldClass: { lineup: {} } });
    const { db, writes } = makeFakeDb(docs);
    setDbForTesting(db);

    const lineup = buildLineup("Budget", 15);
    const result = await saveLineup.run(
      authedRequest("u1", { lineup, corpsClass: "worldClass" })
    );

    assert.equal(result.success, true);

    // The active-lineup claim and the profile update both landed
    const claim = writes.find((w) => w.type === "set" && w.path.startsWith("activeLineups/"));
    assert.equal(claim.data.uid, "u1");
    const update = writes.find((w) => w.type === "update" && w.path === profilePath("u1"));
    assert.deepEqual(update.data["corps.worldClass.lineup"], lineup);
  });
});

describe("validateLineup registry pricing", () => {
  beforeEach(() => setDbForTesting(null));

  test("flags a stored lineup whose points segments disagree with the registry", async () => {
    const docs = makeLineupDocs({
      worldClass: { lineup: buildLineup("Elite", 1) },
    });
    const { db, writes } = makeFakeDb(docs);
    setDbForTesting(db);

    const result = await validateLineup.run(
      authedRequest("u1", { corpsClass: "worldClass" })
    );

    assert.equal(result.isValid, false);
    assert.equal(result.requiresUpdate, true);
    assert.equal(result.invalidSelections.length, 8);

    // Profile is marked so the UI can force a lineup update
    const update = writes.find((w) => w.type === "update" && w.path === profilePath("u1"));
    assert.equal(update.data["corps.worldClass.lineupNeedsUpdate"], true);
  });

  test("flags a lineup whose registry cost exceeds the class cap", async () => {
    // Points segments all match the registry, but 8 x 25 = 200 > 150.
    const docs = makeLineupDocs({
      worldClass: { lineup: buildLineup("Elite", 25) },
    });
    const { db } = makeFakeDb(docs);
    setDbForTesting(db);

    const result = await validateLineup.run(
      authedRequest("u1", { corpsClass: "worldClass" })
    );

    assert.equal(result.isValid, false);
    assert.equal(result.requiresUpdate, true);
    assert.deepEqual(result.invalidSelections, []);
  });

  test("passes an honest lineup priced from the registry", async () => {
    const docs = makeLineupDocs({
      worldClass: { lineup: buildLineup("Budget", 15) },
    });
    const { db, writes } = makeFakeDb(docs);
    setDbForTesting(db);

    const result = await validateLineup.run(
      authedRequest("u1", { corpsClass: "worldClass" })
    );

    assert.equal(result.isValid, true);
    assert.equal(result.requiresUpdate, false);
    assert.deepEqual(result.invalidSelections, []);
    assert.equal(writes.length, 0);
  });
});

// =============================================================================
// selectUserShows — schedule-resolved, whitelisted storage
// =============================================================================

describe("selectUserShows schedule enforcement", () => {
  beforeEach(() => setDbForTesting(null));

  const competitions = [
    { name: "Show A", day: 9, date: "2026-07-01", location: "Anytown, USA" },
    { name: "Show B", day: 9, date: "2026-07-01", location: "Elsewhere, USA" },
    { name: "Show C", day: 12, date: "2026-07-04", location: "Somewhere, USA" },
  ];

  function makeShowDocs() {
    // No schedule.startDate on the season doc, so the past-week guard is
    // skipped (off-season style) and the schedule checks run in isolation.
    return new Map([
      ["game-settings/season", { seasonUid: "season-1" }],
      ["schedules/season-1", { competitions }],
      [profilePath("u1"), {
        username: "alice",
        corps: { worldClass: { corpsName: "Alice Corps", selectedShows: {} } },
      }],
    ]);
  }

  test("rejects a week that is not an integer in range", async () => {
    const { db } = makeFakeDb(makeShowDocs());
    setDbForTesting(db);

    for (const week of ["2", 0, 9, 2.5]) {
      await assert.rejects(
        selectUserShows.run(authedRequest("u1", {
          week, shows: [{ eventName: "Show A" }], corpsClass: "worldClass",
        })),
        /week number/
      );
    }
  });

  test("rejects an event that is not on the week's schedule", async () => {
    const { db, writes } = makeFakeDb(makeShowDocs());
    setDbForTesting(db);

    await assert.rejects(
      selectUserShows.run(authedRequest("u1", {
        week: 2, shows: [{ eventName: "Invented Show", day: 8 }], corpsClass: "worldClass",
      })),
      /not on the week 2 schedule/
    );
    assert.equal(writes.length, 0);
  });

  test("rejects two same-day shows even when the client omits/fakes day", async () => {
    const { db, writes } = makeFakeDb(makeShowDocs());
    setDbForTesting(db);

    // Shows A and B are both day 9 on the schedule; the client claims
    // different days to dodge the dedupe (scoring would score both, doubling
    // the day's total).
    await assert.rejects(
      selectUserShows.run(authedRequest("u1", {
        week: 2,
        shows: [
          { eventName: "Show A", day: 8 },
          { eventName: "Show B", day: 10 },
        ],
        corpsClass: "worldClass",
      })),
      /one show per day/
    );
    assert.equal(writes.length, 0);
  });

  test("stores only whitelisted fields derived from the schedule", async () => {
    const { db, writes } = makeFakeDb(makeShowDocs());
    setDbForTesting(db);

    const result = await selectUserShows.run(authedRequest("u1", {
      week: 2,
      shows: [
        // Client-supplied day/date/location/extras must all be discarded
        { eventName: "Show A", day: 999, date: "1999-01-01", location: "Faked", hax: true },
        { eventName: "Show C" },
      ],
      corpsClass: "worldClass",
    }));

    assert.equal(result.success, true);

    const update = writes.find((w) => w.type === "update" && w.path === profilePath("u1"));
    assert.deepEqual(update.data["corps.worldClass.selectedShows.week2"], [
      { eventName: "Show A", day: 9, date: "2026-07-01", location: "Anytown, USA" },
      { eventName: "Show C", day: 12, date: "2026-07-04", location: "Somewhere, USA" },
    ]);

    // The registration-index write-through keys on the schedule's date too
    const indexWrites = writes.filter((w) => w.type === "batchSet");
    assert.equal(indexWrites.length, 2);
    assert.equal(indexWrites[0].data.date, "2026-07-01");
  });

  test("clearing a week with an empty selection still works", async () => {
    const { db, writes } = makeFakeDb(makeShowDocs());
    setDbForTesting(db);

    const result = await selectUserShows.run(authedRequest("u1", {
      week: 2, shows: [], corpsClass: "worldClass",
    }));

    assert.equal(result.success, true);
    const update = writes.find((w) => w.type === "update" && w.path === profilePath("u1"));
    assert.deepEqual(update.data["corps.worldClass.selectedShows.week2"], []);
  });
});
