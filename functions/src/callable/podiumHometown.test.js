// correctPodiumHometown — the one-time free hometown correction. Exercises the
// REAL onCall handler via the v2 `.run()` test hook with a fake Firestore
// injected through config.setDbForTesting (same pattern as corps.test.js).
// Run with `npm test` inside functions/.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");

const { setDbForTesting } = require("../config");
const { paths } = require("../helpers/paths");
const { correctPodiumHometown } = require("./podiumHometown");

const UID = "u1";
const SEASON = "live_2026-26";
const STATE = paths.userPodiumState(UID);
const PROFILE = paths.userProfile(UID);
const ROSTER = `podium-season/${SEASON}/corps/${UID}`;

/** Path-keyed fake Firestore: doc/collection reads + transactional writes. */
function makeFakeDb(seed) {
  const docs = new Map(Object.entries(seed));
  const writes = [];
  const ref = (path) => ({
    path,
    get: async () => ({ exists: docs.has(path), data: () => docs.get(path) }),
  });
  const db = {
    doc: (path) => ref(path),
    collection: (name) => ({ doc: (id) => ref(`${name}/${id}`) }),
    async runTransaction(fn) {
      return fn({
        get: async (r) => ({ exists: docs.has(r.path), data: () => docs.get(r.path) }),
        set: (r, data, opts) => {
          writes.push({ type: "set", path: r.path, data, opts });
          docs.set(r.path, opts && opts.merge ? { ...(docs.get(r.path) || {}), ...data } : data);
        },
        update: (r, data) => {
          writes.push({ type: "update", path: r.path, data });
          docs.set(r.path, { ...(docs.get(r.path) || {}), ...data });
        },
      });
    },
  };
  return { db, docs, writes };
}

const forcedHome = { venueId: "canton-oh", city: "Canton", region: "OH", lat: 40.8, lng: -81.38 };

function seed(state) {
  return {
    "game-settings/features": { podiumClass: true },
    "game-settings/season": {
      seasonUid: SEASON,
      status: "live-season",
      schedule: { startDate: { toDate: () => new Date("2026-06-01T00:00:00Z") } },
    },
    ...(state ? { [STATE]: state } : {}),
  };
}

const call = (location) =>
  correctPodiumHometown.run({ data: { location }, auth: { uid: UID, token: {} } });

after(() => setDbForTesting(null));

describe("correctPodiumHometown", () => {
  beforeEach(() => setDbForTesting(null));

  test("moves a forced home to any real town, free, and updates every copy", async () => {
    const { db, docs, writes } = makeFakeDb(
      seed({ seasonUid: SEASON, home: forcedHome, location: "Canton, OH" })
    );
    setDbForTesting(db);

    const result = await call("Brownsburg, Indiana");
    assert.deepEqual(
      { home: result.home, previous: result.previous, touring: result.touring },
      { home: "Brownsburg, IN", previous: "Canton, OH", touring: false }
    );
    const state = docs.get(STATE);
    assert.equal(state.location, "Brownsburg, IN");
    assert.equal(state.home.venueId, "brownsburg-in");
    assert.equal(state.home.anyTown, true);
    assert.equal(state.homeCorrectedFrom, "Canton, OH");
    assert.ok(state.homeCorrectedAt);
    const profileWrite = writes.find((w) => w.path === PROFILE);
    assert.equal(profileWrite.data.corps.podiumClass.location, "Brownsburg, IN");
    assert.equal(docs.get(ROSTER).location, "Brownsburg, IN");
    // No CorpsCoin moved.
    assert.ok(!writes.some((w) => /corpsCoin|coin-history/i.test(JSON.stringify(w))));
  });

  test("is one-time: a second correction is refused", async () => {
    const { db } = makeFakeDb(seed({ seasonUid: SEASON, home: forcedHome, location: "Canton, OH" }));
    setDbForTesting(db);
    await call("Brownsburg, IN");
    await assert.rejects(call("Carmel, IN"), /free hometown correction has been used/);
  });

  test("a home already chosen from the any-town picker can't use it", async () => {
    const { db } = makeFakeDb(seed({ seasonUid: SEASON, home: { ...forcedHome, anyTown: true } }));
    setDbForTesting(db);
    await assert.rejects(call("Brownsburg, IN"), /free hometown correction has been used/);
  });

  test("reports a touring corps (routes keep running from the last show)", async () => {
    const { db } = makeFakeDb(
      seed({ seasonUid: SEASON, home: forcedHome, lastVenue: { venueId: "akron-oh" } })
    );
    setDbForTesting(db);
    assert.equal((await call("Brownsburg, IN")).touring, true);
  });

  test("rejects text that names no real town, and corps not registered this season", async () => {
    const { db } = makeFakeDb(seed({ seasonUid: "old-season", home: forcedHome }));
    setDbForTesting(db);
    await assert.rejects(call("Atlantis, Ocean"), /couldn't place that hometown/);
    await assert.rejects(call("Brownsburg, IN"), /Register your corps/);
  });
});
