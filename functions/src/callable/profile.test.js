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
 * Fake Firestore covering what deleteAccount touches: db.doc().get()/.set(),
 * doc().collection(name).get() (empty subcollections), db.collection().doc()
 * (rate-limit bucket), and db.batch() with delete/update/set/commit. Records
 * every batch op so the index cleanup can be asserted.
 */
function makeFakeDb(docs = new Map()) {
  const batchOps = [];

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
    collection: (name) => ({
      async get() {
        return { docs: [] };
      },
      doc: (id) => makeRef(`${path}/${name}/${id}`),
    }),
  });

  const db = {
    doc: (path) => makeRef(path),
    collection: (path) => ({
      doc: (id) => makeRef(`${path}/${id}`),
    }),
    batch: () => ({
      delete(ref) {
        batchOps.push({ type: "delete", path: ref.path });
      },
      update(ref, data) {
        batchOps.push({ type: "update", path: ref.path, data });
      },
      set(ref, data, opts) {
        batchOps.push({ type: "set", path: ref.path, data, opts });
      },
      async commit() {},
    }),
  };

  return { db, batchOps };
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
