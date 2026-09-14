// Behavior tests for the searchDirectors callable: the director directory /
// username search. Exercises the REAL onCall handler via the v2 `.run()` hook
// with a fake Firestore injected through config.setDbForTesting. The fake
// models exactly what the callable relies on: an ordered document-id range
// over `usernames/{lower}` and a batched getAll over profile/public mirrors.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");

const { setDbForTesting } = require("../config");
const { paths } = require("../helpers/paths");
const { searchDirectors } = require("./users");

/**
 * @param {Array<[string, string]>} usernames [usernameKey, uid] pairs
 * @param {Map<string, object>} mirrors profile/public data by uid
 */
function makeFakeDb(usernames = [], mirrors = new Map()) {
  const budget = new Map();
  const sorted = [...usernames].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const calls = { limits: [] };

  const makeQuery = (bounds = {}) => ({
    orderBy() {
      return makeQuery(bounds);
    },
    startAt(v) {
      return makeQuery({ ...bounds, startAt: v, startAfter: undefined });
    },
    endAt(v) {
      return makeQuery({ ...bounds, endAt: v });
    },
    startAfter(v) {
      return makeQuery({ ...bounds, startAfter: v, startAt: undefined });
    },
    limit(n) {
      calls.limits.push(n);
      return makeQuery({ ...bounds, limit: n });
    },
    async get() {
      let rows = sorted;
      if (bounds.startAt !== undefined) rows = rows.filter(([k]) => k >= bounds.startAt);
      if (bounds.startAfter !== undefined) rows = rows.filter(([k]) => k > bounds.startAfter);
      if (bounds.endAt !== undefined) rows = rows.filter(([k]) => k <= bounds.endAt);
      if (bounds.limit !== undefined) rows = rows.slice(0, bounds.limit);
      return { docs: rows.map(([id, uid]) => ({ id, data: () => ({ uid }) })) };
    },
  });

  const db = {
    collection(name) {
      // `usernames` is the search index; `rate_*` is the budget bookkeeping.
      return { ...(name === "usernames" ? makeQuery() : {}), doc: (id) => ({ path: `${name}/${id}` }) };
    },
    doc(path) {
      return { path };
    },
    async getAll(...refs) {
      return refs.map((ref) => {
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
  return { db, budget, calls };
}

const authed = (uid, data = {}) => ({ data, auth: { uid, token: {} } });

const MIRRORS = new Map([
  ["u-alice", { username: "Alice", displayName: "Alice A.", xpLevel: 7, corps: { worldClass: { corpsName: "Blue Horizon", lineup: { GE1: "secret" } } } }],
  ["u-alina", { username: "alina_x", xpLevel: 2 }],
  ["u-bob", { username: "Bob", displayName: "Bob", xpLevel: 3 }],
  ["u-carol", { username: "Carol", xpLevel: 1 }],
]);
const USERNAMES = [
  ["alice", "u-alice"],
  ["alina_x", "u-alina"],
  ["bob", "u-bob"],
  ["carol", "u-carol"],
  ["ghost", "u-ghost"], // reservation with no mirror — must not surface
];

describe("searchDirectors", () => {
  beforeEach(() => setDbForTesting(null));
  after(() => setDbForTesting(null));

  test("requires a signed-in caller", async () => {
    setDbForTesting(makeFakeDb().db);
    await assert.rejects(searchDirectors.run({ data: {}, auth: null }), /logged in/);
  });

  test("rejects malformed input before touching the budget", async () => {
    const { db, budget } = makeFakeDb();
    setDbForTesting(db);
    await assert.rejects(searchDirectors.run(authed("me", { query: "a b" })), /letters, numbers/);
    await assert.rejects(searchDirectors.run(authed("me", { cursor: "Bad Cursor" })), /Invalid page cursor/);
    assert.equal(budget.size, 0);
  });

  test("browses the whole directory alphabetically, skipping ghost reservations, and never leaks lineups", async () => {
    const { db, budget } = makeFakeDb(USERNAMES, MIRRORS);
    setDbForTesting(db);
    const result = await searchDirectors.run(authed("me"));
    assert.deepEqual(
      result.directors.map((d) => d.username),
      ["Alice", "alina_x", "Bob", "Carol"]
    );
    assert.equal(result.nextCursor, null);
    assert.equal(budget.get("rate_directory/me")?.count, 1);
    const alice = result.directors[0];
    assert.deepEqual(alice.corps, [{ classKey: "worldClass", corpsName: "Blue Horizon" }]);
    assert.equal("lineup" in alice, false);
    assert.equal(Object.keys(alice).includes("xp"), false);
  });

  test("prefix search is case-insensitive and tolerates a leading @", async () => {
    setDbForTesting(makeFakeDb(USERNAMES, MIRRORS).db);
    const result = await searchDirectors.run(authed("me", { query: "@AL" }));
    assert.deepEqual(
      result.directors.map((d) => d.uid),
      ["u-alice", "u-alina"]
    );
    const none = await searchDirectors.run(authed("me", { query: "zz" }));
    assert.deepEqual(none.directors, []);
    assert.equal(none.nextCursor, null);
  });

  test("pages with a cursor and clamps the page size", async () => {
    const { db, calls } = makeFakeDb(USERNAMES, MIRRORS);
    setDbForTesting(db);
    const page1 = await searchDirectors.run(authed("me", { limit: 2 }));
    assert.deepEqual(page1.directors.map((d) => d.uid), ["u-alice", "u-alina"]);
    assert.equal(page1.nextCursor, "alina_x");
    assert.equal(calls.limits[0], 3); // pageSize + 1 to detect the next page

    const page2 = await searchDirectors.run(authed("me", { limit: 2, cursor: page1.nextCursor }));
    assert.deepEqual(page2.directors.map((d) => d.uid), ["u-bob", "u-carol"]);
    // A page whose trailing slot is a ghost still reports a cursor — the
    // client asks again and gets an empty page rather than a missing row.
    assert.equal(page2.nextCursor, "carol");

    const page3 = await searchDirectors.run(authed("me", { limit: 2, cursor: page2.nextCursor }));
    assert.deepEqual(page3.directors, []);
    assert.equal(page3.nextCursor, null);

    await searchDirectors.run(authed("me", { limit: 9999 }));
    assert.equal(calls.limits[calls.limits.length - 1], 51);
  });

  test("a prefix query combined with a cursor keeps the prefix bound", async () => {
    setDbForTesting(makeFakeDb(USERNAMES, MIRRORS).db);
    const page = await searchDirectors.run(authed("me", { query: "al", cursor: "alice" }));
    assert.deepEqual(page.directors.map((d) => d.uid), ["u-alina"]);
    assert.equal(page.nextCursor, null);
  });

  test("resolves mirrors at the public profile path", async () => {
    const { db } = makeFakeDb([["alice", "u-alice"]], MIRRORS);
    const seen = [];
    const original = db.getAll;
    db.getAll = (...refs) => {
      seen.push(...refs.map((r) => r.path));
      return original(...refs);
    };
    setDbForTesting(db);
    await searchDirectors.run(authed("me"));
    assert.deepEqual(seen, [paths.userProfilePublic("u-alice")]);
  });
});
