// Behavior tests for the completeDailyChallenge callable — the challenge XP
// path. Exercises the REAL onCall handler via the v2 `.run()` test hook with
// a fake Firestore injected through config.setDbForTesting (same harness as
// economyCallables.test.js). Covers auth gating, input validation, rotation
// enforcement, double-completion protection, the XP award, and bucket shape.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");

const { setDbForTesting } = require("../config");
const { completeDailyChallenge } = require("./dailyOps");
const { getGameDay, getChallengesForGameDay } = require("../helpers/dailyChallenges");

const NS = process.env.DATA_NAMESPACE;
const profilePath = (uid) => `artifacts/${NS}/users/${uid}/profile/data`;

// Today's real rotation — the callable uses the real clock, so tests pick
// challenge ids relative to the actual current game day.
const gameDay = getGameDay();
const todaysChallenges = getChallengesForGameDay(gameDay);
const offeredToday = todaysChallenges[0];
const notOfferedToday = [
  "check-lineup",
  "make-prediction",
  "register-show",
  "set-show-concept",
].find((id) => !todaysChallenges.some((c) => c.id === id));

function makeFakeDb(docs = new Map()) {
  const writes = [];
  let autoId = 0;
  const db = {
    doc(path) {
      return { path };
    },
    collection(path) {
      return {
        doc(id) {
          return { path: `${path}/${id ?? `auto-${++autoId}`}` };
        },
      };
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

// Satisfies EVERY challenge's verify predicate (lineup, registered show,
// show concept, and a saved prediction pick), so tests can complete any of
// today's rotation.
const baseProfile = () => ({
  uid: "u1",
  xp: 100,
  xpLevel: 1,
  unlockedClasses: ["soundSport"],
  corps: {
    soundSport: {
      lineup: { GE1: "Blue Devils|2024" },
      selectedShows: { 1: ["show-a"] },
      showConcept: { theme: "Space" },
    },
  },
  predictions: { [gameDay]: { picks: { podium: { pick: "Yes" } } } },
});

after(() => setDbForTesting(null));

describe("completeDailyChallenge", () => {
  beforeEach(() => setDbForTesting(null));

  test("rejects unauthenticated calls", async () => {
    await assert.rejects(
      completeDailyChallenge.run({ data: { challengeId: offeredToday.id }, auth: null }),
      /logged in/
    );
  });

  test("rejects a missing challengeId", async () => {
    await assert.rejects(completeDailyChallenge.run(authedRequest("u1", {})), /challengeId/i);
  });

  test("rejects an unknown challengeId", async () => {
    await assert.rejects(
      completeDailyChallenge.run(authedRequest("u1", { challengeId: "hack-the-planet" })),
      /Unknown challenge/i
    );
  });

  test("soft-fails for a real challenge not in today's rotation", async () => {
    const docs = new Map([[profilePath("u1"), baseProfile()]]);
    const { db, writes } = makeFakeDb(docs);
    setDbForTesting(db);

    const result = await completeDailyChallenge.run(
      authedRequest("u1", { challengeId: notOfferedToday })
    );
    assert.equal(result.success, false);
    assert.equal(result.notInRotation, true);
    assert.equal(writes.length, 0);
  });

  test("awards catalog XP and records the completion", async () => {
    const docs = new Map([[profilePath("u1"), baseProfile()]]);
    const { db, writes } = makeFakeDb(docs);
    setDbForTesting(db);

    const result = await completeDailyChallenge.run(
      authedRequest("u1", { challengeId: offeredToday.id })
    );

    assert.equal(result.success, true);
    assert.equal(result.xpAwarded, offeredToday.xp);
    assert.equal(writes.length, 1);
    const write = writes[0].data;
    assert.equal(write.xp, 100 + offeredToday.xp);
    const bucket = write.challenges[gameDay];
    assert.equal(bucket.length, 1);
    assert.equal(bucket[0].id, offeredToday.id);
    assert.equal(bucket[0].completed, true);
    assert.equal(bucket[0].xp, offeredToday.xp);
  });

  test("does not double-award a completed challenge", async () => {
    const docs = new Map([
      [
        profilePath("u1"),
        {
          ...baseProfile(),
          challenges: { [gameDay]: [{ id: offeredToday.id, completed: true }] },
        },
      ],
    ]);
    const { db, writes } = makeFakeDb(docs);
    setDbForTesting(db);

    const result = await completeDailyChallenge.run(
      authedRequest("u1", { challengeId: offeredToday.id })
    );
    assert.equal(result.success, true);
    assert.equal(result.alreadyCompleted, true);
    assert.equal(result.xpAwarded, 0);
    assert.equal(writes.length, 0);
  });

  test("preserves other completions in today's bucket", async () => {
    const other = todaysChallenges[1];
    const docs = new Map([
      [
        profilePath("u1"),
        {
          ...baseProfile(),
          challenges: { [gameDay]: [{ id: other.id, completed: true, xp: other.xp }] },
        },
      ],
    ]);
    const { db, writes } = makeFakeDb(docs);
    setDbForTesting(db);

    const result = await completeDailyChallenge.run(
      authedRequest("u1", { challengeId: offeredToday.id })
    );
    assert.equal(result.success, true);
    assert.equal(result.completedToday, 2);
    const bucket = writes[0].data.challenges[gameDay];
    assert.deepEqual(bucket.map((c) => c.id).sort(), [offeredToday.id, other.id].sort());
  });

  test("errors when the profile is missing", async () => {
    const { db } = makeFakeDb(new Map());
    setDbForTesting(db);
    await assert.rejects(
      completeDailyChallenge.run(authedRequest("ghost", { challengeId: offeredToday.id })),
      /profile not found/i
    );
  });

  test("soft-fails when the decision was not actually made (server verification)", async () => {
    // A bare profile satisfies no verify predicate — claiming any of today's
    // challenges must pay nothing.
    const docs = new Map([
      [profilePath("u1"), { uid: "u1", xp: 100, xpLevel: 1, unlockedClasses: ["soundSport"] }],
    ]);
    const { db, writes } = makeFakeDb(docs);
    setDbForTesting(db);

    const result = await completeDailyChallenge.run(
      authedRequest("u1", { challengeId: offeredToday.id })
    );
    assert.equal(result.success, false);
    assert.equal(result.notDoneYet, true);
    assert.equal(writes.length, 0, "an unverified claim must write nothing");
  });

  test("counts a full-set day toward the weekly arc", async () => {
    // Two of today's three already complete — completing the last one
    // finishes the set and counts today.
    const [a, b] = [todaysChallenges[1], todaysChallenges[2]];
    const docs = new Map([
      [
        profilePath("u1"),
        {
          ...baseProfile(),
          challenges: {
            [gameDay]: [
              { id: a.id, completed: true },
              { id: b.id, completed: true },
            ],
          },
        },
      ],
    ]);
    const { db, writes } = makeFakeDb(docs);
    setDbForTesting(db);

    const result = await completeDailyChallenge.run(
      authedRequest("u1", { challengeId: offeredToday.id })
    );
    assert.equal(result.success, true);
    assert.equal(result.weeklyArcDays, 1);
    assert.equal(result.weeklyArcBonus, null);
    const loop = writes[0].data["engagement.weeklyLoop"];
    assert.deepEqual(loop.countedDays, [gameDay]);
  });

  test("pays the weekly-arc bonus exactly when the 5th full-set day lands", async () => {
    const [a, b] = [todaysChallenges[1], todaysChallenges[2]];
    const priorDays = ["d1", "d2", "d3", "d4"]; // 4 counted days this week
    const docs = new Map([
      [
        profilePath("u1"),
        {
          ...baseProfile(),
          engagement: {
            weeklyLoop: {
              // Same week as today by construction
              weekKey: require("../helpers/dailyChallenges").getWeekKey(gameDay),
              countedDays: priorDays,
              rewarded: false,
            },
          },
          challenges: {
            [gameDay]: [
              { id: a.id, completed: true },
              { id: b.id, completed: true },
            ],
          },
        },
      ],
    ]);
    const { db, writes } = makeFakeDb(docs);
    setDbForTesting(db);

    const result = await completeDailyChallenge.run(
      authedRequest("u1", { challengeId: offeredToday.id })
    );
    assert.equal(result.weeklyArcDays, 5);
    assert.ok(result.weeklyArcBonus, "the 5th day must pay the bonus");
    // Challenge XP + bonus XP land together; bonus CC is an increment plus
    // a coin-history entry
    assert.equal(result.xpAwarded, offeredToday.xp + result.weeklyArcBonus.xp);
    const profileWrite = writes.find((w) => w.path === profilePath("u1"));
    assert.ok(profileWrite.data.corpsCoin, "bonus CC increment expected");
    const history = writes.find((w) => w.data?.type === "weekly_arc");
    assert.ok(history, "weekly_arc coin-history entry expected");
    assert.equal(history.data.amount, result.weeklyArcBonus.coin);
  });
});
