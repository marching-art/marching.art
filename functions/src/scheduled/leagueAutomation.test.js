// triggerMatchupGeneration — the commissioner's manual "generate this week"
// button. Site review Q-H3/Q-H4: the module had no tests. Covers the guard
// chain (auth, commissioner-only, league exists, season active, not already
// generated, enough members) and one real generation, through the REAL
// onCall handler via `.run()` with a fake Firestore (config.setDbForTesting).
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");

const { setDbForTesting } = require("../config");
const { triggerMatchupGeneration } = require("./leagueAutomation");

const NS = process.env.DATA_NAMESPACE;
const leaguePath = (id) => `artifacts/${NS}/leagues/${id}`;
const profilePath = (uid) => `artifacts/${NS}/users/${uid}/profile/data`;

/**
 * Fake Firestore covering what the callable touches: doc get/set/update,
 * getAll with a field mask, an (empty) matchup-history collection, and the
 * rate-budget transaction (helpers/rateLimit.js).
 */
function makeFakeDb(docs = new Map()) {
  const writes = [];
  const makeRef = (path) => ({
    path,
    id: path.split("/").pop(),
    async get() {
      return { exists: docs.has(path), id: path.split("/").pop(), data: () => docs.get(path) };
    },
    async set(data, options) {
      writes.push({ type: "set", path, data, options });
      docs.set(path, options?.merge ? { ...(docs.get(path) || {}), ...data } : data);
    },
    async update(data) {
      writes.push({ type: "update", path, data });
      docs.set(path, { ...(docs.get(path) || {}), ...data });
    },
  });
  return {
    writes,
    doc: (path) => makeRef(path),
    collection: (path) => ({
      doc: (id) => makeRef(`${path}/${id}`),
      async get() {
        return { empty: true, docs: [], size: 0, forEach() {} };
      },
    }),
    async getAll(...args) {
      const refs = args.filter((a) => a && typeof a.path === "string");
      return refs.map((ref) => ({
        exists: docs.has(ref.path),
        id: ref.id,
        data: () => docs.get(ref.path),
      }));
    },
    async runTransaction(fn) {
      const tx = {
        async get(ref) {
          return { exists: docs.has(ref.path), data: () => docs.get(ref.path) };
        },
        set(ref, data) {
          docs.set(ref.path, data);
        },
        update(ref, data) {
          docs.set(ref.path, { ...(docs.get(ref.path) || {}), ...data });
        },
      };
      return fn(tx);
    },
  };
}

const request = (uid, data) => ({ data, auth: uid ? { uid, token: {} } : null });

const SEASON = "season-1";
const worldCorps = (name) => ({ corpsName: name, seasonUid: SEASON, lineup: { GE1: "x|2020" } });

function baseDocs() {
  return new Map([
    ["game-settings/season", { seasonUid: SEASON }],
    [
      leaguePath("lg1"),
      { name: "Test League", creatorId: "commish", members: ["commish", "bob"] },
    ],
    [profilePath("commish"), { corps: { worldClass: worldCorps("Commish Corps") } }],
    [profilePath("bob"), { corps: { worldClass: worldCorps("Bob Corps") } }],
  ]);
}

after(() => setDbForTesting(null));

describe("triggerMatchupGeneration guards", () => {
  beforeEach(() => setDbForTesting(null));

  test("anonymous callers are rejected", async () => {
    setDbForTesting(makeFakeDb(baseDocs()));
    await assert.rejects(triggerMatchupGeneration.run(request(null, { leagueId: "lg1" })), (e) => {
      assert.equal(e.code, "unauthenticated");
      return true;
    });
  });

  test("leagueId is required", async () => {
    setDbForTesting(makeFakeDb(baseDocs()));
    await assert.rejects(triggerMatchupGeneration.run(request("commish", {})), (e) => {
      assert.equal(e.code, "invalid-argument");
      return true;
    });
  });

  test("an unknown league is not-found", async () => {
    setDbForTesting(makeFakeDb(baseDocs()));
    await assert.rejects(
      triggerMatchupGeneration.run(request("commish", { leagueId: "nope", week: 2 })),
      (e) => {
        assert.equal(e.code, "not-found");
        return true;
      }
    );
  });

  test("only a commissioner may generate", async () => {
    const db = makeFakeDb(baseDocs());
    setDbForTesting(db);
    await assert.rejects(
      triggerMatchupGeneration.run(request("bob", { leagueId: "lg1", week: 2 })),
      (e) => {
        assert.equal(e.code, "permission-denied");
        return true;
      }
    );
    assert.equal(db.writes.some((w) => w.path.includes("/matchups/")), false);
  });

  test("a co-commissioner may generate", async () => {
    const docs = baseDocs();
    docs.get(leaguePath("lg1")).commissioners = ["bob"];
    const db = makeFakeDb(docs);
    setDbForTesting(db);
    const res = await triggerMatchupGeneration.run(request("bob", { leagueId: "lg1", week: 2 }));
    assert.equal(res.success, true);
  });

  test("no active season is a failed-precondition", async () => {
    const docs = baseDocs();
    docs.delete("game-settings/season");
    setDbForTesting(makeFakeDb(docs));
    await assert.rejects(
      triggerMatchupGeneration.run(request("commish", { leagueId: "lg1", week: 2 })),
      (e) => {
        assert.equal(e.code, "failed-precondition");
        return true;
      }
    );
  });

  test("an already-generated week is refused unless forceRegenerate", async () => {
    const docs = baseDocs();
    docs.set(`${leaguePath("lg1")}/matchups/week-2`, { week: 2, seasonUid: SEASON });
    setDbForTesting(makeFakeDb(docs));
    await assert.rejects(
      triggerMatchupGeneration.run(request("commish", { leagueId: "lg1", week: 2 })),
      (e) => {
        assert.equal(e.code, "already-exists");
        return true;
      }
    );
    const res = await triggerMatchupGeneration.run(
      request("commish", { leagueId: "lg1", week: 2, forceRegenerate: true })
    );
    assert.equal(res.success, true);
  });

  test("a week stamped with a previous season is not 'already generated'", async () => {
    const docs = baseDocs();
    docs.set(`${leaguePath("lg1")}/matchups/week-2`, { week: 2, seasonUid: "season-0" });
    setDbForTesting(makeFakeDb(docs));
    const res = await triggerMatchupGeneration.run(request("commish", { leagueId: "lg1", week: 2 }));
    assert.equal(res.success, true);
  });

  test("fewer than two members cannot be paired", async () => {
    const docs = baseDocs();
    docs.get(leaguePath("lg1")).members = ["commish"];
    setDbForTesting(makeFakeDb(docs));
    await assert.rejects(
      triggerMatchupGeneration.run(request("commish", { leagueId: "lg1", week: 2 })),
      (e) => {
        assert.equal(e.code, "failed-precondition");
        return true;
      }
    );
  });
});

describe("triggerMatchupGeneration generation", () => {
  test("pairs the two World Class members and stamps the week with the season", async () => {
    const db = makeFakeDb(baseDocs());
    setDbForTesting(db);

    const res = await triggerMatchupGeneration.run(request("commish", { leagueId: "lg1", week: 2 }));

    assert.equal(res.success, true);
    assert.equal(res.matchups.worldClass, 1);
    assert.equal(res.matchups.aClass, 0);

    const write = db.writes.find((w) => w.path === `${leaguePath("lg1")}/matchups/week-2`);
    assert.ok(write, "week-2 matchup doc written");
    assert.equal(write.data.week, 2);
    assert.equal(write.data.seasonUid, SEASON);
    assert.equal(write.data.autoGenerated, false);
    assert.equal(write.data.triggeredBy, "commish");
    const pair = write.data.worldClassMatchups[0].pair;
    assert.deepEqual([...pair].sort(), ["bob", "commish"]);

    const leagueUpdate = db.writes.find((w) => w.type === "update" && w.path === leaguePath("lg1"));
    assert.equal(leagueUpdate.data.matchupsGeneratedWeek, 2);
  });

  test("a member whose corps sat this season out is not paired", async () => {
    const docs = baseDocs();
    docs.get(profilePath("bob")).corps.worldClass.seasonUid = null;
    const db = makeFakeDb(docs);
    setDbForTesting(db);

    const res = await triggerMatchupGeneration.run(request("commish", { leagueId: "lg1", week: 2 }));
    assert.equal(res.success, true);
    const write = db.writes.find((w) => w.path === `${leaguePath("lg1")}/matchups/week-2`);
    const pairs = write.data.worldClassMatchups;
    // One active corps: at most a bye, never a pairing against the absent one.
    assert.equal(pairs.some((m) => m.pair?.includes("bob")), false);
  });
});
