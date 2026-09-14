// Behavior tests for the searchDirectors callable: the director directory.
// Exercises the REAL onCall handler via the v2 `.run()` hook with a fake
// Firestore injected through config.setDbForTesting. The fake models exactly
// what the callable relies on: listDocuments() over the users collection
// (every location, parent doc or not), a batched getAll over profile/public
// mirrors, and the rate-budget transaction.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");

const { setDbForTesting } = require("../config");
const { paths } = require("../helpers/paths");
const { resetDirectoryCacheForTesting } = require("../helpers/directorSearch");
const { searchDirectors } = require("./users");

/**
 * @param {string[]} uids every user location
 * @param {Map<string, object>} mirrors profile/public data by uid
 */
function makeFakeDb(uids = [], mirrors = new Map()) {
  const budget = new Map();
  const seen = { mirrorPaths: [] };
  const db = {
    collection(name) {
      return {
        async listDocuments() {
          assert.equal(name, paths.users());
          return uids.map((id) => ({ id, path: `${name}/${id}` }));
        },
        doc: (id) => ({ path: `${name}/${id}` }),
      };
    },
    doc(path) {
      return { path };
    },
    async getAll(...refs) {
      return refs.map((ref) => {
        seen.mirrorPaths.push(ref.path);
        const uid = ref.path.split("/users/")[1].split("/")[0];
        const data = mirrors.get(uid);
        return { exists: data !== undefined, data: () => data };
      });
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
  return { db, budget, seen };
}

const authed = (uid, data = {}) => ({ data, auth: { uid, token: {} } });

const MIRRORS = new Map([
  [
    "u-alice",
    {
      username: "Alice",
      displayName: "Alice A.",
      xpLevel: 7,
      corps: {
        worldClass: { corpsName: "Blue Horizon", lineup: { GE1: "secret" } },
        podiumClass: { corpsName: "Granite Line" },
      },
    },
  ],
  ["u-bob", { username: "Bob", displayName: "Bob", xpLevel: 3 }],
  ["u-carol", { username: "carol", xpLevel: 1 }],
]);
// Directory order must not depend on storage order, and a location without
// a mirror (u-ghost) must not surface.
const UIDS = ["u-carol", "u-ghost", "u-bob", "u-alice"];

describe("searchDirectors", () => {
  beforeEach(() => {
    setDbForTesting(null);
    resetDirectoryCacheForTesting();
  });
  after(() => setDbForTesting(null));

  test("requires a signed-in caller", async () => {
    setDbForTesting(makeFakeDb().db);
    await assert.rejects(searchDirectors.run({ data: {}, auth: null }), /logged in/);
  });

  test("returns every director with a mirror, sorted, projected, and charges the directory budget", async () => {
    const { db, budget, seen } = makeFakeDb(UIDS, MIRRORS);
    setDbForTesting(db);
    const result = await searchDirectors.run(authed("me"));
    assert.deepEqual(
      result.directors.map((d) => d.username),
      ["Alice", "Bob", "carol"]
    );
    assert.equal(result.total, 3);
    assert.equal(result.truncated, false);
    assert.equal(budget.get("rate_directory/me")?.count, 1);

    const alice = result.directors[0];
    assert.deepEqual(alice.corps, [
      { classKey: "worldClass", corpsName: "Blue Horizon" },
      { classKey: "podiumClass", corpsName: "Granite Line" },
    ]);
    assert.equal("lineup" in alice, false);
    assert.equal(Object.keys(alice).includes("xp"), false);
    assert.deepEqual(new Set(seen.mirrorPaths), new Set(UIDS.map((uid) => paths.userProfilePublic(uid))));
  });

  test("ignores any input the client sends", async () => {
    setDbForTesting(makeFakeDb(UIDS, MIRRORS).db);
    const result = await searchDirectors.run(authed("me", { query: "zz", cursor: "x", limit: 1 }));
    assert.equal(result.directors.length, 3);
  });

  test("serves repeat calls from the per-instance cache", async () => {
    const { db, seen } = makeFakeDb(UIDS, MIRRORS);
    setDbForTesting(db);
    await searchDirectors.run(authed("me"));
    const reads = seen.mirrorPaths.length;
    await searchDirectors.run(authed("someone-else"));
    assert.equal(seen.mirrorPaths.length, reads);
  });
});
