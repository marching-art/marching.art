// Behavior tests for the submitPrediction + resolvePredictions callables — the
// daily-prediction persistence and bonus path. Exercises the REAL onCall
// handlers via the v2 `.run()` test hook with a fake Firestore injected through
// config.setDbForTesting (same harness as dailyChallenges.test.js, extended
// with a collection/query stub so resolvePredictions can read recaps).
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");

const { setDbForTesting } = require("../config");
const { submitPrediction, resolvePredictions } = require("./dailyOps");
const { getGameDay } = require("../helpers/dailyChallenges");

const NS = process.env.DATA_NAMESPACE;
const profilePath = (uid) => `artifacts/${NS}/users/${uid}/profile/data`;
const gameDay = getGameDay();

// A fake Firestore that supports doc().get(), collection().orderBy().limit().get(),
// runTransaction(), and collection().doc() for coin-history writes. `recaps` is
// the array returned for the fantasy_recaps/{season}/days query.
function makeFakeDb(docs = new Map(), recaps = []) {
  const writes = [];
  const db = {
    doc(path) {
      return {
        path,
        async get() {
          const data = docs.get(path);
          return { exists: data !== undefined, data: () => data };
        },
      };
    },
    collection(path) {
      // Query builder for the recaps days collection; also used for the
      // coin-history subcollection (only .doc() is exercised there).
      const query = {
        _path: path,
        orderBy() {
          return query;
        },
        limit() {
          return query;
        },
        async get() {
          if (path.startsWith("fantasy_recaps/")) {
            return {
              empty: recaps.length === 0,
              docs: recaps.map((r) => ({ data: () => r })),
            };
          }
          return { empty: true, docs: [] };
        },
        doc() {
          return { path: `${path}/auto-id` };
        },
      };
      return query;
    },
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
      };
      return fn(transaction);
    },
  };
  return { db, writes };
}

function authedRequest(uid, data = {}) {
  return { data, auth: { uid, token: {} } };
}

const baseProfile = (overrides = {}) => ({
  uid: "u1",
  xp: 100,
  xpLevel: 1,
  corpsCoin: 500,
  unlockedClasses: ["soundSport", "worldClass"],
  activeSeasonId: "season-1",
  ...overrides,
});

// A recap day with a single show where u1's worldClass corps scored `score`
// at placement `placement`.
const recapDay = (day, eventName, score, placement) => ({
  offSeasonDay: day,
  shows: [
    {
      eventName,
      results: [{ uid: "u1", corpsClass: "worldClass", totalScore: score, placement }],
    },
  ],
});

after(() => setDbForTesting(null));

describe("submitPrediction", () => {
  beforeEach(() => setDbForTesting(null));

  test("rejects unauthenticated calls", async () => {
    await assert.rejects(
      submitPrediction.run({ data: { questionId: "over-under", pick: "Over", corpsClass: "worldClass" }, auth: null }),
      /logged in/
    );
  });

  test("rejects an unknown question", async () => {
    await assert.rejects(
      submitPrediction.run(authedRequest("u1", { questionId: "hack", pick: "Over", corpsClass: "worldClass" })),
      /Unknown prediction/i
    );
  });

  test("rejects SoundSport predictions", async () => {
    await assert.rejects(
      submitPrediction.run(authedRequest("u1", { questionId: "over-under", pick: "Over", corpsClass: "soundSport" })),
      /SoundSport/i
    );
  });

  // Two recent results: scores [73, 72] newest-first → over-under line
  // round(avg*10)/10 = 72.5, beat-prev canonical = 73, snapshot "Show B".
  const twoResultRecaps = () => [
    recapDay(2, "Show B", 73, 2),
    recapDay(1, "Show A", 72, 3),
  ];

  test("saves a pick with the SERVER-derived threshold and snapshot", async () => {
    const docs = new Map([[profilePath("u1"), baseProfile()]]);
    const { db, writes } = makeFakeDb(docs, twoResultRecaps());
    setDbForTesting(db);

    const result = await submitPrediction.run(
      authedRequest("u1", {
        questionId: "over-under",
        pick: "Over",
        threshold: 72.5, // matches the canonical line
        corpsClass: "worldClass",
        snapshotEvent: "Client Claims Something Else",
      })
    );

    assert.equal(result.success, true);
    assert.equal(result.picked, "over-under");
    assert.equal(writes.length, 1);
    const bucket = writes[0].data.predictions[gameDay];
    assert.equal(bucket.corpsClass, "worldClass");
    // snapshotEvent comes from the recaps, never from the client — a forged
    // null/stale snapshot would disable resolveBucket's freshness guard.
    assert.equal(bucket.snapshotEvent, "Show B");
    assert.equal(bucket.resolved, false);
    assert.deepEqual(bucket.picks["over-under"], { pick: "Over", threshold: 72.5 });
  });

  test("accepts a pick without a client threshold and stores the canonical one", async () => {
    const docs = new Map([[profilePath("u1"), baseProfile()]]);
    const { db, writes } = makeFakeDb(docs, twoResultRecaps());
    setDbForTesting(db);

    const result = await submitPrediction.run(
      authedRequest("u1", { questionId: "beat-prev", pick: "Yes", corpsClass: "worldClass" })
    );
    assert.equal(result.success, true);
    const bucket = writes[0].data.predictions[gameDay];
    assert.deepEqual(bucket.picks["beat-prev"], { pick: "Yes", threshold: 73 });
  });

  test("rejects a forged threshold (the 'Over -1' guaranteed win)", async () => {
    const docs = new Map([[profilePath("u1"), baseProfile()]]);
    const { db, writes } = makeFakeDb(docs, twoResultRecaps());
    setDbForTesting(db);

    await assert.rejects(
      submitPrediction.run(
        authedRequest("u1", {
          questionId: "over-under",
          pick: "Over",
          threshold: -1,
          corpsClass: "worldClass",
        })
      ),
      /out of date/i
    );
    assert.equal(writes.length, 0);
  });

  test("rejects picks when the director has fewer than two scored results", async () => {
    const docs = new Map([[profilePath("u1"), baseProfile()]]);
    // Only one result — buildQuestions would show nothing on the client.
    const { db, writes } = makeFakeDb(docs, [recapDay(1, "Show A", 72, 3)]);
    setDbForTesting(db);

    await assert.rejects(
      submitPrediction.run(
        authedRequest("u1", { questionId: "over-under", pick: "Over", corpsClass: "worldClass" })
      ),
      /isn't available yet/i
    );
    assert.equal(writes.length, 0);
  });

  test("does not overwrite an already-answered question", async () => {
    const docs = new Map([
      [
        profilePath("u1"),
        baseProfile({
          predictions: {
            [gameDay]: {
              picks: { "over-under": { pick: "Over", threshold: 72.5 } },
              corpsClass: "worldClass",
              snapshotEvent: "Opening Show",
              resolved: false,
            },
          },
        }),
      ],
    ]);
    const { db, writes } = makeFakeDb(docs);
    setDbForTesting(db);

    const result = await submitPrediction.run(
      authedRequest("u1", { questionId: "over-under", pick: "Under", corpsClass: "worldClass" })
    );
    assert.equal(result.alreadyPicked, true);
    assert.equal(writes.length, 0);
  });

  test("refuses picks once the day is resolved", async () => {
    const docs = new Map([
      [
        profilePath("u1"),
        baseProfile({
          predictions: {
            [gameDay]: { picks: {}, corpsClass: "worldClass", resolved: true },
          },
        }),
      ],
    ]);
    const { db, writes } = makeFakeDb(docs);
    setDbForTesting(db);

    const result = await submitPrediction.run(
      authedRequest("u1", { questionId: "beat-prev", pick: "Yes", corpsClass: "worldClass" })
    );
    assert.equal(result.locked, true);
    assert.equal(writes.length, 0);
  });
});

describe("resolvePredictions", () => {
  beforeEach(() => setDbForTesting(null));

  const pendingProfile = () =>
    baseProfile({
      predictions: {
        [gameDay]: {
          picks: {
            "over-under": { pick: "Over", threshold: 70 },
            "beat-prev": { pick: "No", threshold: 75 },
            podium: { pick: "Yes", threshold: 3 },
          },
          corpsClass: "worldClass",
          snapshotEvent: "Opening Show",
          resolved: false,
        },
      },
    });

  test("is a no-op when no newer result exists", async () => {
    const docs = new Map([[profilePath("u1"), pendingProfile()]]);
    // Latest event still matches the snapshot -> nothing new scored.
    const { db, writes } = makeFakeDb(docs, [recapDay(5, "Opening Show", 80, 1)]);
    setDbForTesting(db);

    const result = await resolvePredictions.run(authedRequest("u1"));
    assert.equal(result.resolvedDays, 0);
    assert.equal(writes.length, 0);
  });

  test("scores picks against the authoritative recap and awards bonuses", async () => {
    const docs = new Map([[profilePath("u1"), pendingProfile()]]);
    // New show scored 80 at 2nd place: over 70 (Over ✓), 80 > 75 so "beat"
    // resolves Yes but the pick was No (✗), placement 2 <= 3 so podium Yes (✓).
    const { db, writes } = makeFakeDb(docs, [recapDay(6, "Show Two", 80, 2)]);
    setDbForTesting(db);

    const result = await resolvePredictions.run(authedRequest("u1"));

    assert.equal(result.resolvedDays, 1);
    assert.equal(result.correct, 2);
    assert.equal(result.total, 3);
    assert.equal(result.xpAwarded, 30); // 2 correct * 15
    assert.equal(result.coinAwarded, 20); // 2 correct * 10, no perfect bonus

    const profileWrite = writes.find((w) => w.path === profilePath("u1"));
    const update = profileWrite.data;
    assert.equal(update.xp, 130); // 100 + 30
    assert.deepEqual(update.predictionStats, { correct: 2, total: 3 });
    const bucket = update.predictions[gameDay];
    assert.equal(bucket.resolved, true);
    assert.equal(bucket.resolvedEvent, "Show Two");
    assert.equal(bucket.results["over-under"].isCorrect, true);
    assert.equal(bucket.results["beat-prev"].isCorrect, false);
    assert.equal(bucket.results.podium.isCorrect, true);

    // A coin-history entry is written for the bonus.
    const historyWrite = writes.find((w) => w.type === "set");
    assert.ok(historyWrite);
    assert.equal(historyWrite.data.type, "prediction_bonus");
    assert.equal(historyWrite.data.amount, 20);
  });

  test("adds the perfect-day bonus when every pick is correct", async () => {
    const docs = new Map([
      [
        profilePath("u1"),
        baseProfile({
          predictions: {
            [gameDay]: {
              picks: {
                "over-under": { pick: "Over", threshold: 70 },
                podium: { pick: "Yes", threshold: 3 },
              },
              corpsClass: "worldClass",
              snapshotEvent: "Opening Show",
              resolved: false,
            },
          },
        }),
      ],
    ]);
    const { db } = makeFakeDb(docs, [recapDay(6, "Show Two", 80, 1)]);
    setDbForTesting(db);

    const result = await resolvePredictions.run(authedRequest("u1"));
    assert.equal(result.correct, 2);
    assert.equal(result.total, 2);
    assert.equal(result.xpAwarded, 30);
    assert.equal(result.coinAwarded, 45); // 2*10 + 25 perfect bonus
  });

  test("does not re-resolve an already-resolved day", async () => {
    const docs = new Map([
      [
        profilePath("u1"),
        baseProfile({
          predictions: {
            [gameDay]: {
              picks: { "over-under": { pick: "Over", threshold: 70 } },
              corpsClass: "worldClass",
              snapshotEvent: "Opening Show",
              resolved: true,
            },
          },
        }),
      ],
    ]);
    const { db, writes } = makeFakeDb(docs, [recapDay(6, "Show Two", 80, 1)]);
    setDbForTesting(db);

    const result = await resolvePredictions.run(authedRequest("u1"));
    assert.equal(result.resolvedDays, 0);
    assert.equal(writes.length, 0);
  });
});
