// getRecentNews pagination hardening: the cursor used to go straight into
// `query.startAfter(new Date(startAfter))`, so garbage threw an `internal`
// error, and every cursored call bypassed the shared cache with no budget.
// node:test; run with `npm test` inside functions/.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");

const { setDbForTesting } = require("../config");
const { getRecentNews } = require("./newsFeed");

/** Fake Firestore: an empty articles group, a cache doc, and the budget tx. */
function makeFakeDb() {
  const budget = new Map();
  const cursors = [];
  const query = {
    where: () => query,
    orderBy: () => query,
    limit: () => query,
    startAfter(value) {
      cursors.push(value);
      return query;
    },
    async get() {
      return { docs: [] };
    },
  };
  const db = {
    collection(name) {
      return {
        doc(id) {
          return {
            path: `${name}/${id}`,
            async get() {
              return { exists: false, data: () => undefined };
            },
            async set() {},
          };
        },
      };
    },
    collectionGroup: () => query,
    async runTransaction(fn) {
      return fn({
        async get(ref) {
          const data = budget.get(ref.path);
          return { exists: data !== undefined, data: () => data };
        },
        set(ref, data) {
          budget.set(ref.path, data);
        },
      });
    },
  };
  return { db, budget, cursors };
}

const anonRequest = (data, ip = "203.0.113.9") => ({ data, auth: null, rawRequest: { ip } });

describe("getRecentNews pagination", () => {
  beforeEach(() => setDbForTesting(null));
  after(() => setDbForTesting(null));

  test("rejects an unparseable cursor as invalid-argument (not internal)", async () => {
    setDbForTesting(makeFakeDb().db);
    await assert.rejects(getRecentNews.run(anonRequest({ startAfter: "garbage" })), (error) => {
      assert.equal(error.code, "invalid-argument");
      return true;
    });
    await assert.rejects(getRecentNews.run(anonRequest({ startAfter: { $gt: 1 } })), (error) => {
      assert.equal(error.code, "invalid-argument");
      return true;
    });
  });

  test("passes a valid ISO cursor through as a Date and charges the per-IP budget", async () => {
    const { db, budget, cursors } = makeFakeDb();
    setDbForTesting(db);
    const result = await getRecentNews.run(anonRequest({ startAfter: "2026-08-01T00:00:00.000Z" }));
    assert.equal(result.success, true);
    assert.equal(result.fromCache, false);
    assert.equal(cursors.length, 1);
    assert.ok(cursors[0] instanceof Date);
    assert.equal(cursors[0].toISOString(), "2026-08-01T00:00:00.000Z");
    assert.equal(budget.get("rate_newsPaged/ip_203.0.113.9")?.count, 1);
  });

  test("keys the budget by uid when the caller is signed in", async () => {
    const { db, budget } = makeFakeDb();
    setDbForTesting(db);
    await getRecentNews.run({
      data: { startAfter: "2026-08-01T00:00:00.000Z" },
      auth: { uid: "u1", token: {} },
      rawRequest: { ip: "203.0.113.9" },
    });
    assert.equal(budget.get("rate_newsPaged/uid_u1")?.count, 1);
  });

  test("denies a cursored read once the caller's budget is spent", async () => {
    const { db, budget } = makeFakeDb();
    budget.set("rate_newsPaged/ip_203.0.113.9", { windowStart: Date.now(), count: 120 });
    setDbForTesting(db);
    await assert.rejects(
      getRecentNews.run(anonRequest({ startAfter: "2026-08-01T00:00:00.000Z" })),
      (error) => {
        assert.equal(error.code, "resource-exhausted");
        return true;
      }
    );
  });

  test("an uncursored read never touches the budget", async () => {
    const { db, budget } = makeFakeDb();
    setDbForTesting(db);
    await getRecentNews.run(anonRequest({}));
    assert.equal(budget.size, 0);
  });
});
