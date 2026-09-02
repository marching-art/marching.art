// Behavior tests for the checkUsername callable. It used to be an
// unauthenticated, unthrottled existence oracle over the username → uid map;
// it now requires a signed-in caller and draws from the shared profile
// budget. Exercises the REAL onCall handler via the v2 `.run()` hook with a
// fake Firestore injected through config.setDbForTesting.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");

const { setDbForTesting } = require("../config");
const { checkUsername } = require("./users");

/** Fake Firestore: doc().get() plus the rate-budget transaction. */
function makeFakeDb(docs = new Map()) {
  const budget = new Map();
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
    collection(name) {
      return {
        doc(id) {
          return { path: `${name}/${id}` };
        },
      };
    },
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
  return { db, budget };
}

const authedRequest = (uid, data = {}) => ({ data, auth: { uid, token: {} } });

describe("checkUsername", () => {
  beforeEach(() => setDbForTesting(null));
  after(() => setDbForTesting(null));

  test("rejects unauthenticated calls (no anonymous existence oracle)", async () => {
    setDbForTesting(makeFakeDb().db);
    await assert.rejects(
      checkUsername.run({ data: { username: "alice" }, auth: null }),
      /logged in/
    );
  });

  test("rejects a non-string or malformed username", async () => {
    setDbForTesting(makeFakeDb().db);
    await assert.rejects(checkUsername.run(authedRequest("u1", { username: 42 })), /between 3 and 15/);
    await assert.rejects(checkUsername.run(authedRequest("u1", { username: "a b" })), /letters, numbers/);
    await assert.rejects(checkUsername.run(authedRequest("u1", {})), /between 3 and 15/);
  });

  test("reports a taken username as already-exists", async () => {
    setDbForTesting(makeFakeDb(new Map([["usernames/alice", { uid: "someone" }]])).db);
    await assert.rejects(checkUsername.run(authedRequest("u1", { username: "Alice" })), /already taken/);
  });

  test("reports a free username as available and charges the profile budget", async () => {
    const { db, budget } = makeFakeDb();
    setDbForTesting(db);
    const result = await checkUsername.run(authedRequest("u1", { username: "newbie" }));
    assert.equal(result.success, true);
    assert.equal(budget.get("rate_profile/u1")?.count, 1);
  });

  test("denies once the shared profile budget is spent", async () => {
    const { db, budget } = makeFakeDb();
    budget.set("rate_profile/u1", { windowStart: Date.now(), count: 60 });
    setDbForTesting(db);
    await assert.rejects(checkUsername.run(authedRequest("u1", { username: "newbie" })), /Too many/);
  });
});
