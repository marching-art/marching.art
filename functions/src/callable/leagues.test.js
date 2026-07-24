// Input-hardening tests for createLeague — name/description length caps,
// maxMembers bounds, and the settings whitelist (arbitrary client keys must
// never be spread into the stored league doc; entryFee/prizePool are always
// re-applied server-side because the pool is pure escrow).
//
// Also covers:
//   - invite-code placement: the code must NEVER be stored on the league doc
//     (firestore.rules leaves `list` over leagues open, so every field there
//     is enumerable by any signed-in user) — only in /leagueInvites/{code}
//     and the member-only leagues/{id}/meta/private doc;
//   - the joinLeague private-league guard (invitation-only);
//   - postLeagueMessage's length cap and per-user rate limit.
//
// Exercises the REAL onCall handler via the v2 `.run()` test hook with a fake
// Firestore injected through config.setDbForTesting — same pattern as
// economyCallables.test.js. Uses Node's built-in test runner (node:test).
// Run with `npm test` inside functions/.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");

const { setDbForTesting } = require("../config");
const { createLeague, joinLeague, postLeagueMessage } = require("./leagues");

const NS = process.env.DATA_NAMESPACE;

/**
 * Minimal fake Firestore covering exactly what the league callables use:
 * db.doc().get()/.set(), db.collection().doc() (auto-id),
 * ref.collection().doc(), and db.runTransaction() with
 * transaction.get/set/update. Records every write for assertions; plain
 * ref.set() also persists into the docs map so read-back flows (the chat
 * rate-limit budget doc) behave like real Firestore.
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
    async set(data) {
      docs.set(path, data);
      writes.push({ type: "set", path, data });
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

  test("never stores the invite code on the (listable) league doc", async () => {
    const { db, writes } = makeFakeDb(seasonDocs());
    setDbForTesting(db);

    const result = await createLeague.run(
      authedRequest("u1", { name: "Secret League", isPublic: false })
    );
    assert.equal(result.success, true);
    assert.ok(result.inviteCode);

    const leagueWrite = writes.find(
      (w) => w.type === "set" && w.path.startsWith(`artifacts/${NS}/leagues/`) &&
        !w.path.includes("/standings/") && !w.path.includes("/meta/")
    );
    assert.equal(leagueWrite.data.inviteCode, undefined);

    // The code lives ONLY in the backend-only mapping and the member-only
    // meta/private doc.
    const inviteWrite = writes.find(
      (w) => w.type === "set" && w.path === `leagueInvites/${result.inviteCode}`
    );
    assert.ok(inviteWrite);
    const metaWrite = writes.find(
      (w) => w.type === "set" && w.path.endsWith("/meta/private")
    );
    assert.equal(metaWrite.data.inviteCode, result.inviteCode);
  });
});

// =============================================================================
// joinLeague — private leagues are invitation-only
// =============================================================================

const leaguePath = (id) => `artifacts/${NS}/leagues/${id}`;
const profilePath = (uid) => `artifacts/${NS}/users/${uid}/profile/data`;
const invitationPath = (leagueId, uid) =>
  `artifacts/${NS}/leagueInvitations/${leagueId}_${uid}`;

function leagueDocs({ isPublic, invitationStatus } = {}) {
  const docs = new Map([
    [leaguePath("league-1"), {
      name: "The League",
      creatorId: "owner",
      members: ["owner"],
      maxMembers: 20,
      isPublic,
      settings: {},
    }],
    [profilePath("u1"), { username: "alice", leagueIds: [] }],
  ]);
  if (invitationStatus) {
    docs.set(invitationPath("league-1", "u1"), {
      leagueId: "league-1",
      inviteeUid: "u1",
      status: invitationStatus,
    });
  }
  return docs;
}

describe("joinLeague private-league guard", () => {
  beforeEach(() => setDbForTesting(null));

  test("rejects joining a private league without an invitation", async () => {
    const { db, writes } = makeFakeDb(leagueDocs({ isPublic: false }));
    setDbForTesting(db);

    await assert.rejects(
      joinLeague.run(authedRequest("u1", { leagueId: "league-1" })),
      /private/
    );
    // Only the write-budget's own bookkeeping doc may be written on rejection.
    assert.equal(writes.filter((w) => !w.path.startsWith("rate_")).length, 0);
  });

  test("rejects a non-pending invitation (declined/rescinded codes stay dead)", async () => {
    const { db, writes } = makeFakeDb(
      leagueDocs({ isPublic: false, invitationStatus: "declined" })
    );
    setDbForTesting(db);

    await assert.rejects(
      joinLeague.run(authedRequest("u1", { leagueId: "league-1" })),
      /private/
    );
    // Only the write-budget's own bookkeeping doc may be written on rejection.
    assert.equal(writes.filter((w) => !w.path.startsWith("rate_")).length, 0);
  });

  test("admits an invited director and consumes the invitation", async () => {
    const { db, writes } = makeFakeDb(
      leagueDocs({ isPublic: false, invitationStatus: "pending" })
    );
    setDbForTesting(db);

    const result = await joinLeague.run(authedRequest("u1", { leagueId: "league-1" }));
    assert.equal(result.success, true);

    const memberWrite = writes.find(
      (w) => w.type === "update" && w.path === leaguePath("league-1")
    );
    assert.ok(memberWrite);
    const invitationWrite = writes.find(
      (w) => w.type === "update" && w.path === invitationPath("league-1", "u1")
    );
    assert.equal(invitationWrite.data.status, "accepted");
  });

  test("a public league still admits anyone signed in", async () => {
    const { db, writes } = makeFakeDb(leagueDocs({ isPublic: true }));
    setDbForTesting(db);

    const result = await joinLeague.run(authedRequest("u1", { leagueId: "league-1" }));
    assert.equal(result.success, true);
    assert.ok(writes.find((w) => w.type === "update" && w.path === leaguePath("league-1")));
  });
});

// =============================================================================
// postLeagueMessage — length cap + per-user rate limit
// =============================================================================

describe("postLeagueMessage caps and throttle", () => {
  beforeEach(() => setDbForTesting(null));

  function chatDocs() {
    return new Map([
      [leaguePath("league-1"), {
        name: "The League",
        creatorId: "owner",
        members: ["owner", "u1"],
        maxMembers: 20,
        isPublic: true,
        settings: {},
      }],
    ]);
  }

  test("rejects a non-member, a non-string message, and an over-long message", async () => {
    const { db } = makeFakeDb(chatDocs());
    setDbForTesting(db);

    await assert.rejects(
      postLeagueMessage.run(authedRequest("stranger", { leagueId: "league-1", message: "hi" })),
      /league member/
    );
    await assert.rejects(
      postLeagueMessage.run(authedRequest("u1", { leagueId: "league-1", message: { hax: 1 } })),
      /required/
    );
    await assert.rejects(
      postLeagueMessage.run(
        authedRequest("u1", { leagueId: "league-1", message: "x".repeat(1001) })
      ),
      /too long/
    );
  });

  test("allows 10 messages per minute, then throttles the 11th", async () => {
    const { db, writes } = makeFakeDb(chatDocs());
    setDbForTesting(db);

    for (let i = 0; i < 10; i++) {
      const result = await postLeagueMessage.run(
        authedRequest("u1", { leagueId: "league-1", message: `message ${i}` })
      );
      assert.equal(result.success, true);
    }

    await assert.rejects(
      postLeagueMessage.run(
        authedRequest("u1", { leagueId: "league-1", message: "one too many" })
      ),
      /too quickly/
    );

    // Exactly 10 chat docs were written
    const chatWrites = writes.filter((w) => w.path.includes("/chat/"));
    assert.equal(chatWrites.length, 10);
  });
});
