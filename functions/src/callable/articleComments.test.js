// Input-hardening tests for the article-comment callables:
//   - getArticleComments must server-clamp the client-supplied page `limit`
//     (parseInt, min 1, max 50, default 20) — an unbounded limit let one call
//     read an arbitrarily large result set — and reject non-string startAfter;
//   - reportArticleComment must cap the report reason at 500 chars.
//
// Exercises the REAL onCall handlers via the v2 `.run()` test hook with a
// fake Firestore injected through config.setDbForTesting — same pattern as
// economyCallables.test.js. Uses Node's built-in test runner (node:test).
// Run with `npm test` inside functions/.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");

const { setDbForTesting } = require("../config");
const { getArticleComments, reportArticleComment } = require("./articleComments");

/**
 * Minimal fake Firestore covering exactly what these callables use: a
 * chainable query builder (where/orderBy/limit/startAfter/count/get) that
 * records every limit() argument, plus collection().doc().get().
 */
function makeFakeDb() {
  const limits = [];

  function makeQuery() {
    return {
      where() { return this; },
      orderBy() { return this; },
      startAfter() { return this; },
      limit(n) {
        limits.push(n);
        return this;
      },
      count() {
        return { get: async () => ({ data: () => ({ count: 0 }) }) };
      },
      async get() {
        return { docs: [], empty: true };
      },
      doc: (id) => ({
        id,
        async get() {
          return { exists: false, data: () => undefined };
        },
      }),
    };
  }

  const db = { collection: () => makeQuery() };
  return { db, limits };
}

function authedRequest(uid, data = {}) {
  return { data, auth: { uid, token: {} } };
}

after(() => setDbForTesting(null));

describe("getArticleComments page-size clamp", () => {
  beforeEach(() => setDbForTesting(null));

  test("defaults to 20 when limit is missing or unparseable", async () => {
    for (const limit of [undefined, "abc", null, {}]) {
      const { db, limits } = makeFakeDb();
      setDbForTesting(db);
      const result = await getArticleComments.run(
        { data: { articleId: "a1", limit }, auth: null }
      );
      assert.equal(result.success, true);
      // Queries fetch pageSize + 1 to detect hasMore
      assert.deepEqual(limits, [21]);
    }
  });

  test("clamps an oversized limit to 50 and a tiny one to 1", async () => {
    let fake = makeFakeDb();
    setDbForTesting(fake.db);
    await getArticleComments.run({ data: { articleId: "a1", limit: 5000 }, auth: null });
    assert.deepEqual(fake.limits, [51]);

    fake = makeFakeDb();
    setDbForTesting(fake.db);
    await getArticleComments.run({ data: { articleId: "a1", limit: -7 }, auth: null });
    assert.deepEqual(fake.limits, [2]);
  });

  test("accepts a numeric-string limit within range", async () => {
    const { db, limits } = makeFakeDb();
    setDbForTesting(db);
    await getArticleComments.run({ data: { articleId: "a1", limit: "35" }, auth: null });
    assert.deepEqual(limits, [36]);
  });

  test("rejects a non-string startAfter", async () => {
    const { db } = makeFakeDb();
    setDbForTesting(db);
    await assert.rejects(
      getArticleComments.run(
        { data: { articleId: "a1", startAfter: { hax: true } }, auth: null }
      ),
      /startAfter/
    );
    await assert.rejects(
      getArticleComments.run({ data: { articleId: "a1", startAfter: 42 }, auth: null }),
      /startAfter/
    );
  });
});

describe("reportArticleComment reason cap", () => {
  beforeEach(() => setDbForTesting(null));

  test("rejects a reason over 500 characters", async () => {
    const { db } = makeFakeDb();
    setDbForTesting(db);
    await assert.rejects(
      reportArticleComment.run(
        authedRequest("u1", { commentId: "c1", reason: "r".repeat(501) })
      ),
      /too long/
    );
  });

  test("still rejects the existing too-short reason", async () => {
    const { db } = makeFakeDb();
    setDbForTesting(db);
    await assert.rejects(
      reportArticleComment.run(authedRequest("u1", { commentId: "c1", reason: "hi" })),
      /provide a reason/
    );
  });
});
