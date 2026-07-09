// Behavior tests for the joinLeaguePool callable — buy-in escrow, carry
// fold-in, membership/balance gating, and double-join protection. Exercises
// the REAL onCall handler via the v2 `.run()` hook with a fake Firestore
// (same harness as dailyChallenges.test.js).
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");

const { setDbForTesting } = require("../config");
const { joinLeaguePool } = require("./leaguePools");
const { POOL_ANTE } = require("../helpers/leaguePools");
const { getGameDay } = require("../helpers/dailyChallenges");

const NS = process.env.DATA_NAMESPACE;
const profilePath = (uid) => `artifacts/${NS}/users/${uid}/profile/data`;
const leaguePath = (id) => `artifacts/${NS}/leagues/${id}`;
const gameDay = getGameDay();
const poolPath = (id) => `${leaguePath(id)}/pools/${gameDay}`;

function makeFakeDb(docs = new Map()) {
  const writes = [];
  let autoId = 0;
  const makeDocRef = (path) => ({
    path,
    collection(name) {
      const subPath = `${path}/${name}`;
      return {
        doc(id) {
          return makeDocRef(`${subPath}/${id ?? `auto-${++autoId}`}`);
        },
      };
    },
  });
  const db = {
    doc(path) {
      return makeDocRef(path);
    },
    collection(path) {
      return {
        doc(id) {
          return makeDocRef(`${path}/${id ?? `auto-${++autoId}`}`);
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
        set(ref, data, options) {
          writes.push({ type: "set", path: ref.path, data, options });
        },
      };
      return fn(transaction);
    },
  };
  return { db, writes };
}

const authedRequest = (uid, data = {}) => ({ data, auth: { uid, token: {} } });

after(() => setDbForTesting(null));

describe("joinLeaguePool", () => {
  beforeEach(() => setDbForTesting(null));

  test("rejects unauthenticated calls", async () => {
    await assert.rejects(joinLeaguePool.run({ data: { leagueId: "l1" }, auth: null }), /logged in/);
  });

  test("rejects non-members", async () => {
    const docs = new Map([
      [leaguePath("l1"), { name: "L", members: ["someone-else"] }],
      [profilePath("u1"), { corpsCoin: 1000 }],
    ]);
    const { db } = makeFakeDb(docs);
    setDbForTesting(db);
    await assert.rejects(
      joinLeaguePool.run(authedRequest("u1", { leagueId: "l1" })),
      /league member/i
    );
  });

  test("rejects an insufficient balance", async () => {
    const docs = new Map([
      [leaguePath("l1"), { name: "L", members: ["u1"] }],
      [profilePath("u1"), { corpsCoin: POOL_ANTE - 1 }],
    ]);
    const { db } = makeFakeDb(docs);
    setDbForTesting(db);
    await assert.rejects(
      joinLeaguePool.run(authedRequest("u1", { leagueId: "l1" })),
      /Not enough CorpsCoin/i
    );
  });

  test("first buy-in creates the pool, folds in the carried pot, and escrows the ante", async () => {
    const docs = new Map([
      [leaguePath("l1"), { name: "L", members: ["u1"], poolCarry: 50 }],
      [profilePath("u1"), { corpsCoin: 1000 }],
    ]);
    const { db, writes } = makeFakeDb(docs);
    setDbForTesting(db);

    const result = await joinLeaguePool.run(authedRequest("u1", { leagueId: "l1" }));
    assert.equal(result.success, true);
    assert.equal(result.pot, 50 + POOL_ANTE);

    const poolWrite = writes.find((w) => w.path === poolPath("l1"));
    assert.equal(poolWrite.data.pot, 50 + POOL_ANTE);
    assert.equal(poolWrite.data.entrants.u1, true);
    assert.equal(poolWrite.data.carriedIn, 50);

    const carryClear = writes.find((w) => w.path === leaguePath("l1"));
    assert.equal(carryClear.data.poolCarry, 0);

    const debit = writes.find((w) => w.path === profilePath("u1"));
    assert.ok(debit.data.corpsCoin, "the ante should be debited");

    const history = writes.find((w) =>
      w.path.startsWith(`artifacts/${NS}/users/u1/corpsCoinHistory/`)
    );
    assert.equal(history.data.type, "league_pool_entry");
    assert.equal(history.data.amount, -POOL_ANTE);
  });

  test("a second member grows the existing pot without re-folding the carry", async () => {
    const docs = new Map([
      [leaguePath("l1"), { name: "L", members: ["u1", "u2"], poolCarry: 999 }],
      [poolPath("l1"), { gameDay, pot: 75, entrants: { u1: true }, resolved: false }],
      [profilePath("u2"), { corpsCoin: 100 }],
    ]);
    const { db, writes } = makeFakeDb(docs);
    setDbForTesting(db);

    const result = await joinLeaguePool.run(authedRequest("u2", { leagueId: "l1" }));
    assert.equal(result.pot, 75 + POOL_ANTE);
    const poolWrite = writes.find((w) => w.path === poolPath("l1"));
    assert.deepEqual(Object.keys(poolWrite.data.entrants).sort(), ["u1", "u2"]);
    // Carry only folds in when a pool is first created
    assert.equal(
      writes.find((w) => w.path === leaguePath("l1")),
      undefined
    );
  });

  test("double buy-in is a friendly no-op", async () => {
    const docs = new Map([
      [leaguePath("l1"), { name: "L", members: ["u1"] }],
      [poolPath("l1"), { gameDay, pot: 25, entrants: { u1: true }, resolved: false }],
      [profilePath("u1"), { corpsCoin: 100 }],
    ]);
    const { db, writes } = makeFakeDb(docs);
    setDbForTesting(db);

    const result = await joinLeaguePool.run(authedRequest("u1", { leagueId: "l1" }));
    assert.equal(result.alreadyIn, true);
    assert.equal(writes.length, 0);
  });

  test("a settled pool cannot be entered", async () => {
    const docs = new Map([
      [leaguePath("l1"), { name: "L", members: ["u1"] }],
      [poolPath("l1"), { gameDay, pot: 25, entrants: {}, resolved: true }],
      [profilePath("u1"), { corpsCoin: 100 }],
    ]);
    const { db } = makeFakeDb(docs);
    setDbForTesting(db);
    await assert.rejects(
      joinLeaguePool.run(authedRequest("u1", { leagueId: "l1" })),
      /already settled/i
    );
  });
});
