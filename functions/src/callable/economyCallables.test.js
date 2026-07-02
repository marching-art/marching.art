// Behavior tests for the CorpsCoin economy callables — the money path.
//
// These exercise the REAL onCall handlers end-to-end via the v2 `.run()`
// test hook, with a fake Firestore injected through config.setDbForTesting.
// No emulator needed. Covers auth gating, input validation, insufficient
// funds, double-unlock protection, balance math, the audit-trail history
// write, legacy class-key canonicalization, and time-based unlock sync.
//
// Uses Node's built-in test runner (node:test). Run with `npm test` inside
// functions/.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");

const { setDbForTesting } = require("../config");
const {
  unlockClassWithCorpsCoin,
  syncClassUnlocks,
  CLASS_UNLOCK_COSTS,
  TRANSACTION_TYPES,
} = require("./economy");

const NS = process.env.DATA_NAMESPACE;
const profilePath = (uid) => `artifacts/${NS}/users/${uid}/profile/data`;

/**
 * Minimal fake Firestore covering exactly what the economy callables use:
 * db.doc(), db.collection().doc(), and db.runTransaction() with
 * transaction.get/update/set. Records every write for assertions.
 */
function makeFakeDb(docs = new Map()) {
  const writes = [];
  let historyCounter = 0;

  const db = {
    doc(path) {
      return { path };
    },
    collection(path) {
      return {
        doc: () => ({ path: `${path}/history-${++historyCounter}` }),
      };
    },
    async runTransaction(fn) {
      const transaction = {
        async get(ref) {
          const data = docs.get(ref.path);
          return {
            exists: data !== undefined,
            data: () => data,
          };
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

after(() => setDbForTesting(null));

// =============================================================================
// unlockClassWithCorpsCoin
// =============================================================================

describe("unlockClassWithCorpsCoin", () => {
  beforeEach(() => setDbForTesting(null));

  test("rejects unauthenticated callers before touching Firestore", async () => {
    // No fake db injected: any Firestore access would throw a different error.
    await assert.rejects(
      unlockClassWithCorpsCoin.run({ data: { classToUnlock: "aClass" }, auth: null }),
      /logged in/
    );
  });

  test("rejects an invalid class", async () => {
    const { db } = makeFakeDb();
    setDbForTesting(db);
    await assert.rejects(
      unlockClassWithCorpsCoin.run(authedRequest("u1", { classToUnlock: "soundSport" })),
      /Invalid class/
    );
    await assert.rejects(
      unlockClassWithCorpsCoin.run(authedRequest("u1", { classToUnlock: "notAClass" })),
      /Invalid class/
    );
  });

  test("rejects when the profile does not exist", async () => {
    const { db } = makeFakeDb();
    setDbForTesting(db);
    await assert.rejects(
      unlockClassWithCorpsCoin.run(authedRequest("u1", { classToUnlock: "aClass" })),
      /profile not found/i
    );
  });

  test("rejects when funds are insufficient, without writing", async () => {
    const docs = new Map([
      [profilePath("u1"), { corpsCoin: 999, unlockedClasses: ["soundSport"] }],
    ]);
    const { db, writes } = makeFakeDb(docs);
    setDbForTesting(db);

    await assert.rejects(
      unlockClassWithCorpsCoin.run(authedRequest("u1", { classToUnlock: "aClass" })),
      /Insufficient CorpsCoin. Need 1000, have 999/
    );
    assert.equal(writes.length, 0);
  });

  test("rejects a class that is already unlocked", async () => {
    const docs = new Map([
      [profilePath("u1"), { corpsCoin: 99999, unlockedClasses: ["soundSport", "aClass"] }],
    ]);
    const { db, writes } = makeFakeDb(docs);
    setDbForTesting(db);

    await assert.rejects(
      unlockClassWithCorpsCoin.run(authedRequest("u1", { classToUnlock: "aClass" })),
      /already unlocked/i
    );
    assert.equal(writes.length, 0);
  });

  test("treats legacy short keys as already unlocked ('open' vs 'openClass')", async () => {
    const docs = new Map([
      [profilePath("u1"), { corpsCoin: 99999, unlockedClasses: ["soundSport", "open"] }],
    ]);
    const { db } = makeFakeDb(docs);
    setDbForTesting(db);

    await assert.rejects(
      unlockClassWithCorpsCoin.run(authedRequest("u1", { classToUnlock: "openClass" })),
      /already unlocked/i
    );
  });

  test("unlocks a class: correct balance, canonical class list, audit entry", async () => {
    const docs = new Map([
      [profilePath("u1"), { corpsCoin: 3000, unlockedClasses: ["soundSport"] }],
    ]);
    const { db, writes } = makeFakeDb(docs);
    setDbForTesting(db);

    const result = await unlockClassWithCorpsCoin.run(
      authedRequest("u1", { classToUnlock: "openClass" })
    );

    assert.equal(result.success, true);
    assert.equal(result.classUnlocked, "openClass");
    assert.equal(result.newBalance, 3000 - CLASS_UNLOCK_COSTS.openClass);

    // Profile update: balance deducted, class appended canonically
    const update = writes.find((w) => w.type === "update");
    assert.equal(update.path, profilePath("u1"));
    assert.equal(update.data.corpsCoin, 500);
    assert.deepEqual(update.data.unlockedClasses, ["soundSport", "openClass"]);

    // Audit trail entry in the corpsCoinHistory subcollection
    const history = writes.find((w) => w.type === "set");
    assert.match(history.path, new RegExp(`users/u1/corpsCoinHistory/`));
    assert.equal(history.data.type, TRANSACTION_TYPES.CLASS_UNLOCK);
    assert.equal(history.data.amount, -CLASS_UNLOCK_COSTS.openClass);
    assert.equal(history.data.balance, 500);
  });

  test("accepts legacy short input keys and stores the canonical key", async () => {
    const docs = new Map([
      [profilePath("u1"), { corpsCoin: 10000, unlockedClasses: ["soundSport"] }],
    ]);
    const { db, writes } = makeFakeDb(docs);
    setDbForTesting(db);

    const result = await unlockClassWithCorpsCoin.run(
      authedRequest("u1", { classToUnlock: "world" })
    );

    assert.equal(result.classUnlocked, "worldClass");
    const update = writes.find((w) => w.type === "update");
    assert.deepEqual(update.data.unlockedClasses, ["soundSport", "worldClass"]);
    assert.equal(update.data.corpsCoin, 10000 - CLASS_UNLOCK_COSTS.worldClass);
  });
});

// =============================================================================
// syncClassUnlocks (time-based unlock sync; replaces the old client write)
// =============================================================================

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const weeksAgo = (n) => new Date(Date.now() - n * WEEK_MS);

describe("syncClassUnlocks", () => {
  beforeEach(() => setDbForTesting(null));

  test("rejects unauthenticated callers", async () => {
    await assert.rejects(syncClassUnlocks.run({ data: {}, auth: null }), /logged in/);
  });

  test("rejects when the profile does not exist", async () => {
    const { db } = makeFakeDb();
    setDbForTesting(db);
    await assert.rejects(syncClassUnlocks.run(authedRequest("u1")), /profile not found/i);
  });

  test("is a no-op for a fresh account with no pending unlocks", async () => {
    const docs = new Map([
      [profilePath("u1"), {
        xp: 0,
        createdAt: weeksAgo(1),
        unlockedClasses: ["soundSport"],
      }],
    ]);
    const { db, writes } = makeFakeDb(docs);
    setDbForTesting(db);

    const result = await syncClassUnlocks.run(authedRequest("u1"));
    assert.equal(result.success, true);
    assert.equal(result.classUnlocked, null);
    assert.deepEqual(result.unlockedClasses, ["soundSport"]);
    assert.equal(writes.length, 0);
  });

  test("grants time-based unlocks for an aged account (6 weeks -> aClass)", async () => {
    const docs = new Map([
      [profilePath("u1"), {
        xp: 0,
        createdAt: weeksAgo(6), // past the 5-week aClass threshold
        unlockedClasses: ["soundSport"],
      }],
    ]);
    const { db, writes } = makeFakeDb(docs);
    setDbForTesting(db);

    const result = await syncClassUnlocks.run(authedRequest("u1"));
    assert.equal(result.success, true);
    assert.ok(result.unlockedClasses.includes("aClass"));
    assert.ok(!result.unlockedClasses.includes("openClass"));

    const update = writes.find((w) => w.type === "update");
    assert.equal(update.path, profilePath("u1"));
    assert.deepEqual(Object.keys(update.data), ["unlockedClasses"]);
    assert.deepEqual(update.data.unlockedClasses, ["soundSport", "aClass"]);
  });

  test("grants all time-based unlocks for a very old account (20 weeks)", async () => {
    const docs = new Map([
      [profilePath("u1"), {
        xp: 0,
        createdAt: weeksAgo(20), // past aClass (5), open (12), and world (19)
        unlockedClasses: ["soundSport"],
      }],
    ]);
    const { db, writes } = makeFakeDb(docs);
    setDbForTesting(db);

    const result = await syncClassUnlocks.run(authedRequest("u1"));
    for (const cls of ["aClass", "openClass", "worldClass"]) {
      assert.ok(result.unlockedClasses.includes(cls), `missing ${cls}`);
    }
    assert.equal(writes.length, 1);
  });

  test("canonicalizes legacy short keys while syncing", async () => {
    const docs = new Map([
      [profilePath("u1"), {
        xp: 0,
        createdAt: weeksAgo(1),
        unlockedClasses: ["soundSport", "open", "world"], // legacy short keys
      }],
    ]);
    const { db, writes } = makeFakeDb(docs);
    setDbForTesting(db);

    const result = await syncClassUnlocks.run(authedRequest("u1"));
    assert.deepEqual(result.unlockedClasses, ["soundSport", "openClass", "worldClass"]);
    const update = writes.find((w) => w.type === "update");
    assert.deepEqual(update.data.unlockedClasses, ["soundSport", "openClass", "worldClass"]);
  });

  test("never writes XP or level fields (only unlockedClasses)", async () => {
    const docs = new Map([
      [profilePath("u1"), {
        xp: 4321,
        xpLevel: 5,
        createdAt: weeksAgo(6),
        unlockedClasses: ["soundSport"],
      }],
    ]);
    const { db, writes } = makeFakeDb(docs);
    setDbForTesting(db);

    await syncClassUnlocks.run(authedRequest("u1"));
    for (const w of writes) {
      assert.ok(!("xp" in w.data), "must not write xp");
      assert.ok(!("xpLevel" in w.data), "must not write xpLevel");
      assert.ok(!("corpsCoin" in w.data), "must not write corpsCoin");
    }
  });
});
