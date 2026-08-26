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
// The join-league-pool challenge verifies off leagues/{id}/pools/{gameDay}, so
// a director who has "entered today's pool" needs that doc in the fake db.
const leaguePoolPath = (leagueId, day) => `artifacts/${NS}/leagues/${leagueId}/pools/${day}`;

// Today's real rotation — the callable uses the real clock, so tests pick
// challenge ids relative to the actual current game day.
const gameDay = getGameDay();
const todaysChallenges = getChallengesForGameDay(gameDay);
const offeredToday = todaysChallenges[0];
// A valid pool member that is NOT in today's rotation (pool of 3, 2 offered),
// used to exercise the "valid challenge, not offered today" soft no-op.
const notOfferedToday = ["check-lineup", "make-prediction", "join-league-pool"].find(
  (id) => !todaysChallenges.some((c) => c.id === id)
);

function makeFakeDb(docs = new Map(), recaps = []) {
  const writes = [];
  let autoId = 0;
  const db = {
    doc(path) {
      return {
        path,
        // completeDailyChallenge pre-reads the profile (and possibly recaps)
        // outside the transaction for the prediction-availability check.
        async get() {
          const data = docs.get(path);
          return { exists: data !== undefined, data: () => data };
        },
      };
    },
    collection(path) {
      const query = {
        orderBy() {
          return query;
        },
        limit() {
          return query;
        },
        async get() {
          if (path.startsWith("fantasy_recaps/")) {
            return { empty: recaps.length === 0, docs: recaps.map((r) => ({ data: () => r })) };
          }
          return { empty: true, docs: [] };
        },
        doc(id) {
          return { path: `${path}/${id ?? `auto-${++autoId}`}` };
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

// Satisfies EVERY current challenge: a fielded lineup (check-lineup), a saved
// prediction pick (make-prediction), and league membership (join-league-pool's
// availability). The matching entered-pool doc lives in `u1Docs` so the
// challenge also verifies. worldClass carries a corpsName so check-lineup is
// AVAILABLE (hasLineupBearingCorps), not just verifiable.
const baseProfile = () => ({
  uid: "u1",
  xp: 100,
  xpLevel: 1,
  activeSeasonId: "s1",
  unlockedClasses: ["worldClass"],
  leagueIds: ["L1"],
  corps: {
    worldClass: { corpsName: "Blue Coats", lineup: { GE1: "Blue Devils|2024" } },
  },
  predictions: { [gameDay]: { picks: { podium: { pick: "Yes" } } } },
});

// Today's pool doc for u1's league, marking them entered — so join-league-pool
// verifies whenever it is part of today's rotation.
const enteredPoolDoc = () => ({ gameDay, entrants: { u1: true } });

// The docs map for a u1 test: the profile plus the entered-pool doc, with
// optional profile overrides merged in.
const u1Docs = (overrides = {}) =>
  new Map([
    [profilePath("u1"), { ...baseProfile(), ...overrides }],
    [leaguePoolPath("L1", gameDay), enteredPoolDoc()],
  ]);

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

  test("soft-fails for an unknown challengeId without throwing or writing", async () => {
    // A retired challenge id still auto-claimed by a stale client bundle (e.g.
    // the old "visit-scores") must be a benign no-op, NOT a thrown 400 — that
    // is what flooded the completeDailyChallenge logs with warnings. No db is
    // needed because the guard returns before any read.
    const result = await completeDailyChallenge.run(
      authedRequest("u1", { challengeId: "hack-the-planet" })
    );
    assert.equal(result.success, false);
    assert.equal(result.unknownChallenge, true);
    assert.equal(result.xpAwarded, 0);
  });

  test("soft-fails for a real challenge not in today's rotation", async () => {
    const docs = u1Docs();
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
    const docs = u1Docs();
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
    const docs = u1Docs({
      challenges: { [gameDay]: [{ id: offeredToday.id, completed: true }] },
    });
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
    const docs = u1Docs({
      challenges: { [gameDay]: [{ id: other.id, completed: true, xp: other.xp }] },
    });
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
    // The full set is CHALLENGES_PER_DAY (2). With the other member already
    // complete, completing offeredToday finishes the set and counts today.
    // baseProfile is a full fantasy+league director, so every offered
    // challenge is available and counts toward the required set.
    const other = todaysChallenges[1];
    const docs = u1Docs({
      challenges: { [gameDay]: [{ id: other.id, completed: true }] },
    });
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

  test("a new director with no prediction questions can still complete the day's set", async () => {
    // A brand-new director has fewer than two scored results, so
    // make-prediction is impossible (buildQuestions returns nothing and
    // submitPrediction rejects). The weekly arc must not require it: with
    // every OTHER challenge in today's rotation done, the day counts.
    const withPrediction = todaysChallenges.some((c) => c.id === "make-prediction");
    const others = todaysChallenges.filter((c) => c.id !== "make-prediction");
    if (!withPrediction || others.length === 0) {
      // Rotation without make-prediction today — nothing to excuse.
      return;
    }
    const last = others[others.length - 1];
    const docs = u1Docs({
      predictions: {}, // no picks — and no recaps exist (empty fake recaps)
      challenges: {
        [gameDay]: others.slice(0, -1).map((c) => ({ id: c.id, completed: true })),
      },
    });
    const { db, writes } = makeFakeDb(docs, []); // no recap results at all
    setDbForTesting(db);

    const result = await completeDailyChallenge.run(
      authedRequest("u1", { challengeId: last.id })
    );
    assert.equal(result.success, true);
    assert.equal(result.weeklyArcDays, 1, "the day must count without make-prediction");
    const loop = writes[0].data["engagement.weeklyLoop"];
    assert.deepEqual(loop.countedDays, [gameDay]);
  });

  test("join-league-pool verifies off today's entered pool doc", async () => {
    // The pool entry lives at leagues/{id}/pools/{gameDay}, not on the profile;
    // it can only be claimed on a day the rotation actually offers it.
    const target = todaysChallenges.find((c) => c.id === "join-league-pool");
    if (!target) return; // today's rotation doesn't offer it — nothing to prove
    const { db, writes } = makeFakeDb(u1Docs());
    setDbForTesting(db);

    const result = await completeDailyChallenge.run(authedRequest("u1", { challengeId: target.id }));
    assert.equal(result.success, true, "an entered pool must verify off the league doc");
    assert.equal(result.xpAwarded, target.xp);
    assert.equal(writes[0].data.challenges[gameDay].some((c) => c.id === target.id), true);
  });

  test("join-league-pool soft-fails when the director has not entered any pool", async () => {
    const target = todaysChallenges.find((c) => c.id === "join-league-pool");
    if (!target) return;
    // Profile is in a league, but no entered-pool doc exists for today.
    const docs = new Map([[profilePath("u1"), baseProfile()]]);
    const { db, writes } = makeFakeDb(docs);
    setDbForTesting(db);

    const result = await completeDailyChallenge.run(authedRequest("u1", { challengeId: target.id }));
    assert.equal(result.success, false);
    assert.equal(result.notDoneYet, true);
    assert.equal(writes.length, 0);
  });

  test("pays the weekly-arc bonus exactly when the 5th full-set day lands", async () => {
    const other = todaysChallenges[1];
    const priorDays = ["d1", "d2", "d3", "d4"]; // 4 counted days this week
    const docs = u1Docs({
      engagement: {
        weeklyLoop: {
          // Same week as today by construction
          weekKey: require("../helpers/dailyChallenges").getWeekKey(gameDay),
          countedDays: priorDays,
          rewarded: false,
        },
      },
      challenges: { [gameDay]: [{ id: other.id, completed: true }] },
    });
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
