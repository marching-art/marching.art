// Tests for deleteAccount's show-registration cleanup: a deleted account must
// drop out of the materialized "who's attending" index for every upcoming show
// it was registered for, so it stops appearing on show pages before the nightly
// rebuild would otherwise self-heal it (see helpers/showRegistrations.js).
//
// Exercised via the v2 `.run()` hook with a fake Firestore injected through
// config.setDbForTesting and admin.auth() stubbed so no real app is needed.
// Uses Node's built-in test runner (node:test). Run with `npm test`.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");

const { setDbForTesting } = require("../config");
const {
  showRegistrationEventKey,
  registrationEntryKey,
} = require("../helpers/showRegistrations");

// Stub the `firebase-admin` module before deleteAccount lazily requires it, so
// the callable's `admin.auth().deleteUser` runs without an initialized app.
// (`admin.auth` is a non-writable accessor, so it can't be patched in place —
// we replace the whole module in require.cache.) The separate
// `firebase-admin/firestore` module stays real: FieldValue.delete() is a
// sentinel that needs no app.
let authDeletions = [];
const adminPath = require.resolve("firebase-admin");
require.cache[adminPath] = {
  id: adminPath,
  filename: adminPath,
  loaded: true,
  exports: {
    auth: () => ({
      deleteUser: async (uid) => {
        authDeletions.push(uid);
      },
    }),
  },
};

const { deleteAccount } = require("./profile");

const NS = process.env.DATA_NAMESPACE;
const profilePath = (uid) => `artifacts/${NS}/users/${uid}/profile/data`;
const eventPath = (seasonUid, eventKey) =>
  `artifacts/${NS}/show_registrations/${seasonUid}/events/${eventKey}`;

/**
 * Small in-memory Firestore covering what deleteAccount + the erasure sweep
 * touch: doc get/set/update/delete, collection().where().get(), listDocuments()
 * (including phantom parents of subcollection docs), nested subcollections, and
 * batches that actually APPLY so final document state can be asserted. Batch ops
 * are also recorded in `batchOps` for write-shape assertions.
 */
function makeFakeDb(docs = new Map()) {
  const batchOps = [];

  // Docs stored directly in a collection: path === `${collectionPath}/<id>`.
  const membersOf = (collectionPath) =>
    [...docs.keys()].filter(
      (p) => p.startsWith(`${collectionPath}/`) && !p.slice(collectionPath.length + 1).includes("/")
    );

  // Distinct first-segment ids under a collection, including ids that only exist
  // as parents of subcollection docs (Firestore listDocuments returns those).
  const childIdsOf = (collectionPath) => {
    const ids = new Set();
    for (const p of docs.keys()) {
      if (!p.startsWith(`${collectionPath}/`)) continue;
      ids.add(p.slice(collectionPath.length + 1).split("/")[0]);
    }
    return [...ids];
  };

  const makeRef = (path) => ({
    path,
    async get() {
      const data = docs.get(path);
      return { exists: data !== undefined, data: () => data };
    },
    set(data) {
      docs.set(path, data);
    },
    update(data) {
      docs.set(path, { ...(docs.get(path) || {}), ...data });
    },
    delete() {
      docs.delete(path);
    },
    collection: (name) => makeCollection(`${path}/${name}`),
  });

  const snapFor = (path) => ({
    ref: makeRef(path),
    id: path.split("/").pop(),
    exists: docs.get(path) !== undefined,
    data: () => docs.get(path),
  });

  function makeCollection(collectionPath) {
    return {
      doc: (id) => makeRef(`${collectionPath}/${id}`),
      async get() {
        return { docs: membersOf(collectionPath).map(snapFor) };
      },
      where(field, _op, value) {
        return {
          async get() {
            const matches = membersOf(collectionPath).filter(
              (p) => docs.get(p)?.[field] === value
            );
            return { docs: matches.map(snapFor) };
          },
        };
      },
      async listDocuments() {
        return childIdsOf(collectionPath).map((id) => makeRef(`${collectionPath}/${id}`));
      },
    };
  }

  const db = {
    doc: (path) => makeRef(path),
    collection: (path) => makeCollection(path),
    batch: () => ({
      delete(ref) {
        batchOps.push({ type: "delete", path: ref.path });
        docs.delete(ref.path);
      },
      update(ref, data) {
        batchOps.push({ type: "update", path: ref.path, data });
        docs.set(ref.path, { ...(docs.get(ref.path) || {}), ...data });
      },
      set(ref, data, opts) {
        batchOps.push({ type: "set", path: ref.path, data, opts });
        if (opts && opts.merge) {
          docs.set(ref.path, { ...(docs.get(ref.path) || {}), ...data });
        } else {
          docs.set(ref.path, data);
        }
      },
      async commit() {},
    }),
  };

  return { db, batchOps, docs };
}

function authedRequest(uid, data = {}) {
  return { data, auth: { uid, token: {} } };
}

describe("deleteAccount show-registration cleanup", () => {
  beforeEach(() => {
    authDeletions = [];
  });
  afterEach(() => setDbForTesting(null));

  test("removes the deleted user's entries from every upcoming show they joined", async () => {
    const seasonUid = "season-9";
    // Two classes register across three (week, event) slots; worldClass shares
    // one event with soundSport, so that event should lose two entries.
    const profile = {
      username: "gone",
      corps: {
        worldClass: {
          corpsName: "Blue Notes",
          selectedShows: {
            week2: [
              { eventName: "DCI Anytown", date: "2026-07-10", day: 9 },
              { eventName: "DCI Elsewhere", date: "2026-07-12", day: 11 },
            ],
          },
        },
        soundSport: {
          corpsName: "Green Machine",
          selectedShows: {
            week2: [{ eventName: "DCI Anytown", date: "2026-07-10", day: 9 }],
          },
        },
      },
    };

    const docs = new Map([
      [profilePath("u1"), profile],
      ["game-settings/season", { seasonUid }],
    ]);
    const { db, batchOps } = makeFakeDb(docs);
    setDbForTesting(db);

    const result = await deleteAccount.run(authedRequest("u1"));
    assert.equal(result.success, true);
    assert.deepEqual(authDeletions, ["u1"]);

    const anytownKey = showRegistrationEventKey(2, "DCI Anytown", "2026-07-10");
    const elsewhereKey = showRegistrationEventKey(2, "DCI Elsewhere", "2026-07-12");

    const indexWrites = batchOps.filter(
      (op) => op.type === "set" && op.path.includes("/show_registrations/")
    );
    // One merge-set per distinct event the user was on.
    assert.equal(indexWrites.length, 2);

    const anytown = indexWrites.find((w) => w.path === eventPath(seasonUid, anytownKey));
    assert.ok(anytown, "expected a cleanup write for the shared event");
    assert.equal(anytown.opts?.merge, true);
    // Both classes' entries are deleted from the shared event.
    assert.ok(registrationEntryKey("u1", "worldClass") in anytown.data.registrations);
    assert.ok(registrationEntryKey("u1", "soundSport") in anytown.data.registrations);

    const elsewhere = indexWrites.find((w) => w.path === eventPath(seasonUid, elsewhereKey));
    assert.ok(elsewhere, "expected a cleanup write for the single-class event");
    assert.ok(registrationEntryKey("u1", "worldClass") in elsewhere.data.registrations);
  });

  test("skips the index cleanup when the user had no show registrations", async () => {
    const docs = new Map([
      [profilePath("u2"), { username: "quiet", corps: { worldClass: { corpsName: "Idle" } } }],
      ["game-settings/season", { seasonUid: "season-9" }],
    ]);
    const { db, batchOps } = makeFakeDb(docs);
    setDbForTesting(db);

    const result = await deleteAccount.run(authedRequest("u2"));
    assert.equal(result.success, true);

    const indexWrites = batchOps.filter(
      (op) => op.path.includes("/show_registrations/")
    );
    assert.equal(indexWrites.length, 0);
    // The account is still deleted.
    assert.deepEqual(authDeletions, ["u2"]);
  });
});

describe("deleteAccount identity erasure", () => {
  beforeEach(() => {
    authDeletions = [];
  });
  afterEach(() => setDbForTesting(null));

  test("releases corps-name reservations, anonymizes comments/likes, and past results", async () => {
    const seasonUid = "season-9";
    const docs = new Map([
      [profilePath("u1"), { username: "gone", corps: {} }],
      ["game-settings/season", { seasonUid }],

      // Two corps-name reservations this account holds (any season), plus one
      // owned by someone else that must be left alone.
      ["corpsnames/season-9_blue notes", { uid: "u1", corpsName: "Blue Notes" }],
      ["corpsnames/season-8_old guard", { uid: "u1", corpsName: "Old Guard" }],
      ["corpsnames/season-9_someone else", { uid: "u2", corpsName: "Someone Else" }],

      // Comments authored by the account, and one by another user.
      ["article_comments/c1", { userId: "u1", userName: "gone", userTitle: "Rookie", content: "hi", articleId: "a1" }],
      ["article_comments/c2", { userId: "u2", userName: "other", content: "yo", articleId: "a1" }],
      // Per-user reactions (likes) + the aggregate count that must survive.
      ["article_user_reactions/a1_u1", { userId: "u1", emoji: "🔥", articleId: "a1" }],
      ["article_reactions/a1", { "🔥": 3, total: 3 }],

      // Past results across every surface.
      ["fantasy_recaps/season-9/days/9", { shows: [{ results: [
        { uid: "u1", displayName: "gone", corpsName: "Blue Notes", totalScore: 80 },
        { uid: "u2", displayName: "stays", corpsName: "Rivals", totalScore: 79 },
      ] }] }],
      ["podium-recaps/season-9/days/12", { shows: [{ results: [
        { uid: "u1", displayName: "gone", corpsName: "Blue Notes" },
      ] }] }],
      ["podium-recaps/season-9/standings/12", { standings: [
        { uid: "u1", displayName: "gone", lastTotal: 90 },
        { uid: "u2", displayName: "stays", lastTotal: 88 },
      ] }],
      // Materialized Fantasy standings the Scores page actually reads.
      ["fantasy_standings/season-9/classes/worldClass", { classKey: "worldClass", entries: [
        { uid: "u1", displayName: "gone", corpsName: "Blue Notes", score: 80 },
        { uid: "u2", displayName: "stays", corpsName: "Rivals", score: 79 },
      ] }],
      ["season_champions/season-8", { classes: { worldClass: [
        { uid: "u1", username: "gone", corpsName: "Blue Notes", score: 98 },
      ] } }],
    ]);
    const { db } = makeFakeDb(docs);
    setDbForTesting(db);

    const result = await deleteAccount.run(authedRequest("u1"));
    assert.equal(result.success, true);
    assert.deepEqual(authDeletions, ["u1"]);

    // Corps names released; the other director's reservation is untouched.
    assert.equal(docs.has("corpsnames/season-9_blue notes"), false);
    assert.equal(docs.has("corpsnames/season-8_old guard"), false);
    assert.equal(docs.has("corpsnames/season-9_someone else"), true);

    // Comment anonymized (kept, but no identity); other user's comment intact.
    const c1 = docs.get("article_comments/c1");
    assert.equal(c1.userId, null);
    assert.equal(c1.userName, "Former Director");
    assert.equal(c1.userTitle, null);
    assert.equal(c1.anonymized, true);
    assert.equal(c1.content, "hi");
    assert.equal(docs.get("article_comments/c2").userName, "other");

    // Like: per-user doc removed, aggregate count preserved.
    assert.equal(docs.has("article_user_reactions/a1_u1"), false);
    assert.deepEqual(docs.get("article_reactions/a1"), { "🔥": 3, total: 3 });

    // Recap: name stripped, row + scores + uid kept; rival untouched.
    const recap = docs.get("fantasy_recaps/season-9/days/9").shows[0].results;
    assert.equal(recap[0].displayName, null);
    assert.equal(recap[0].uid, "u1");
    assert.equal(recap[0].corpsName, "Blue Notes");
    assert.equal(recap[0].totalScore, 80);
    assert.equal(recap[1].displayName, "stays");

    // Podium recap + standings anonymized.
    assert.equal(docs.get("podium-recaps/season-9/days/12").shows[0].results[0].displayName, null);
    const standings = docs.get("podium-recaps/season-9/standings/12").standings;
    assert.equal(standings[0].displayName, null);
    assert.equal(standings[1].displayName, "stays");

    // Materialized Fantasy standings anonymized: name stripped, row + uid kept.
    const fantasyEntries = docs.get("fantasy_standings/season-9/classes/worldClass").entries;
    assert.equal(fantasyEntries[0].displayName, null);
    assert.equal(fantasyEntries[0].uid, "u1");
    assert.equal(fantasyEntries[0].corpsName, "Blue Notes");
    assert.equal(fantasyEntries[1].displayName, "stays");

    // Champions: uid + username nulled so no link and no name.
    const champ = docs.get("season_champions/season-8").classes.worldClass[0];
    assert.equal(champ.uid, null);
    assert.equal(champ.username, null);
    assert.equal(champ.corpsName, "Blue Notes");
  });
});
