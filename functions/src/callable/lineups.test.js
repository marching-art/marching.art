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
  getMaxShowsForWeek,
  saveLineup,
  validateLineup,
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
// saveLineup / validateLineup — server-authoritative point costs
// =============================================================================

const NS = process.env.DATA_NAMESPACE;
const profilePath = (uid) => `artifacts/${NS}/users/${uid}/profile/data`;

const CAPTIONS = ["GE1", "GE2", "VP", "VA", "CG", "B", "MA", "P"];

/**
 * Minimal fake Firestore covering exactly what the lineup callables use:
 * db.doc().get()/.update(), db.collection().doc(), and db.runTransaction()
 * with transaction.get/set/update/delete. Records every write for assertions.
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
  });

  const db = {
    doc: (path) => makeRef(path),
    collection: (path) => ({
      doc: (id) => makeRef(`${path}/${id}`),
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
