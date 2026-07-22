// Input-hardening tests for createLeague — name/description length caps,
// maxMembers bounds, and the settings whitelist (arbitrary client keys must
// never be spread into the stored league doc; entryFee/prizePool are always
// re-applied server-side because the pool is pure escrow).
//
// Exercises the REAL onCall handler via the v2 `.run()` test hook with a fake
// Firestore injected through config.setDbForTesting — same pattern as
// economyCallables.test.js. Uses Node's built-in test runner (node:test).
// Run with `npm test` inside functions/.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");

const { setDbForTesting } = require("../config");
const { createLeague } = require("./leagues");

const NS = process.env.DATA_NAMESPACE;

/**
 * Minimal fake Firestore covering exactly what createLeague uses:
 * db.doc().get(), db.collection().doc() (auto-id), ref.collection().doc(),
 * and db.runTransaction() with transaction.get/set/update. Records every
 * write for assertions.
 */
function makeFakeDb(docs = new Map()) {
  const writes = [];
  let autoId = 0;

  const makeRef = (path) => ({
    path,
    id: path.split("/").pop(),
    async get() {
      const data = docs.get(path);
      return { exists: data !== undefined, data: () => data };
    },
    collection(sub) {
      return {
        doc: (id) => makeRef(`${path}/${sub}/${id !== undefined ? id : `auto-${++autoId}`}`),
      };
    },
  });

  const db = {
    doc: (path) => makeRef(path),
    collection: (path) => ({
      doc: (id) => makeRef(`${path}/${id !== undefined ? id : `auto-${++autoId}`}`),
    }),
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

const seasonDocs = () =>
  new Map([["game-settings/season", { seasonUid: "season-1" }]]);

after(() => setDbForTesting(null));

describe("createLeague input validation", () => {
  beforeEach(() => setDbForTesting(null));

  test("rejects unauthenticated callers", async () => {
    await assert.rejects(
      createLeague.run({ data: { name: "My League" }, auth: null }),
      /logged in/
    );
  });

  test("rejects a missing, non-string, or too-short name", async () => {
    const { db } = makeFakeDb(seasonDocs());
    setDbForTesting(db);
    await assert.rejects(
      createLeague.run(authedRequest("u1", {})),
      /at least 3 characters/
    );
    await assert.rejects(
      createLeague.run(authedRequest("u1", { name: 12345 })),
      /at least 3 characters/
    );
    await assert.rejects(
      createLeague.run(authedRequest("u1", { name: "  ab  " })),
      /at least 3 characters/
    );
  });

  test("rejects a name longer than 50 characters (trimmed)", async () => {
    const { db, writes } = makeFakeDb(seasonDocs());
    setDbForTesting(db);
    await assert.rejects(
      createLeague.run(authedRequest("u1", { name: "x".repeat(51) })),
      /50 characters or fewer/
    );
    // A 50-char name (after trimming) is fine
    await createLeague.run(authedRequest("u1", { name: `  ${"x".repeat(50)}  ` }));
    assert.ok(writes.length > 0);
  });

  test("rejects a non-string or over-long description", async () => {
    const { db } = makeFakeDb(seasonDocs());
    setDbForTesting(db);
    await assert.rejects(
      createLeague.run(authedRequest("u1", { name: "My League", description: { evil: true } })),
      /500 characters or fewer/
    );
    await assert.rejects(
      createLeague.run(authedRequest("u1", { name: "My League", description: "d".repeat(501) })),
      /500 characters or fewer/
    );
  });

  test("rejects out-of-range or non-integer maxMembers", async () => {
    const { db } = makeFakeDb(seasonDocs());
    setDbForTesting(db);
    for (const maxMembers of [1, 51, 0, -5, 10.5, "20"]) {
      await assert.rejects(
        createLeague.run(authedRequest("u1", { name: "My League", maxMembers })),
        /between 2 and 50/
      );
    }
  });

  test("rejects non-object settings", async () => {
    const { db } = makeFakeDb(seasonDocs());
    setDbForTesting(db);
    await assert.rejects(
      createLeague.run(authedRequest("u1", { name: "My League", settings: [1, 2] })),
      /settings must be an object/
    );
    await assert.rejects(
      createLeague.run(authedRequest("u1", { name: "My League", settings: "hax" })),
      /settings must be an object/
    );
  });

  test("rejects an invalid entry fee", async () => {
    const { db } = makeFakeDb(seasonDocs());
    setDbForTesting(db);
    await assert.rejects(
      createLeague.run(authedRequest("u1", { name: "My League", settings: { entryFee: -5 } })),
      /Entry fee/
    );
  });

  test("stores only whitelisted settings keys and never a client prizePool", async () => {
    const { db, writes } = makeFakeDb(seasonDocs());
    setDbForTesting(db);

    const result = await createLeague.run(
      authedRequest("u1", {
        name: "  Honest League  ",
        description: "A fine league",
        maxMembers: 12,
        settings: {
          matchupType: "h2h",
          finalsSize: 10,
          entryFee: 0,
          // Malicious/unknown keys that must NOT land in the stored doc:
          prizePool: 999999,
          isAdmin: true,
        },
      })
    );

    assert.equal(result.success, true);

    const leagueWrite = writes.find(
      (w) => w.type === "set" && w.path.startsWith(`artifacts/${NS}/leagues/`) &&
        !w.path.includes("/standings/")
    );
    assert.equal(leagueWrite.data.name, "Honest League");
    assert.equal(leagueWrite.data.description, "A fine league");
    assert.equal(leagueWrite.data.maxMembers, 12);
    assert.deepEqual(leagueWrite.data.settings, {
      matchupType: "h2h",
      playoffSize: 4,
      scoringFormat: "circuit",
      finalsSize: 10,
      // Escrow invariant: both always server-derived from the validated fee
      entryFee: 0,
      prizePool: 0,
    });
  });

  test("defaults maxMembers to 20 and seeds prizePool from the entry fee", async () => {
    const docs = seasonDocs();
    docs.set(`artifacts/${NS}/users/u1/profile/data`, { corpsCoin: 500 });
    const { db, writes } = makeFakeDb(docs);
    setDbForTesting(db);

    await createLeague.run(
      authedRequest("u1", { name: "Fee League", settings: { entryFee: 100 } })
    );

    const leagueWrite = writes.find(
      (w) => w.type === "set" && w.path.startsWith(`artifacts/${NS}/leagues/`) &&
        !w.path.includes("/standings/")
    );
    assert.equal(leagueWrite.data.maxMembers, 20);
    assert.equal(leagueWrite.data.settings.entryFee, 100);
    assert.equal(leagueWrite.data.settings.prizePool, 100);
  });
});
