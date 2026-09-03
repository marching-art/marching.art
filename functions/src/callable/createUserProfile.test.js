// createUserProfile age-gate tests.
//
// The Terms and the Privacy policy promise no under-13 accounts. The sign-up
// form asks for a date of birth, but the Auth account exists before any server
// check runs, so the callable is the only place the promise can actually be
// enforced: a new profile MUST carry an attestation, while a retry for an
// already-created profile (whose client has since dropped the stashed date)
// still resolves as the idempotent no-op.
//
// Exercises the REAL onCall handler via the v2 `.run()` hook with a fake
// Firestore injected through config.setDbForTesting.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");

const { setDbForTesting } = require("../config");
const { createUserProfile } = require("./users");

const NS = process.env.DATA_NAMESPACE;
const profilePath = (uid) => `artifacts/${NS}/users/${uid}/profile/data`;
const privatePath = (uid) => `artifacts/${NS}/users/${uid}/private/data`;

/**
 * Fake Firestore covering what createUserProfile touches: the rate-budget
 * transaction (helpers/rateLimit) and the profile/username reservation
 * transaction, both through db.runTransaction with get/set/update.
 */
function makeFakeDb(docs = new Map()) {
  const writes = [];
  const makeRef = (path) => ({
    path,
    async get() {
      const data = docs.get(path);
      return { exists: data !== undefined, data: () => data };
    },
  });
  const db = {
    doc: (path) => makeRef(path),
    collection: (path) => ({ doc: (id) => makeRef(`${path}/${id}`) }),
    async runTransaction(fn) {
      const transaction = {
        async get(ref) {
          const data = docs.get(ref.path);
          return { exists: data !== undefined, data: () => data };
        },
        set(ref, data) {
          writes.push({ type: "set", path: ref.path, data });
          docs.set(ref.path, data);
        },
        update(ref, data) {
          writes.push({ type: "update", path: ref.path, data });
          docs.set(ref.path, { ...(docs.get(ref.path) || {}), ...data });
        },
      };
      return fn(transaction);
    },
  };
  return { db, writes };
}

const request = (uid, data) => ({ data, auth: { uid, token: { email: `${uid}@example.com` } } });

const ADULT = "1990-06-15";

after(() => setDbForTesting(null));

describe("createUserProfile age gate", () => {
  beforeEach(() => setDbForTesting(null));

  test("rejects a new profile with no date of birth (no account without attestation)", async () => {
    const { db, writes } = makeFakeDb();
    setDbForTesting(db);

    await assert.rejects(
      createUserProfile.run(request("u1", { username: "newdirector" })),
      (err) => {
        assert.equal(err.code, "failed-precondition");
        assert.deepEqual(err.details, { reason: "birth_date_required" });
        return true;
      }
    );
    assert.equal(
      writes.some((w) => w.path === profilePath("u1")),
      false,
      "no profile doc may be written without an attestation"
    );
  });

  test("treats an empty string the same as a missing date", async () => {
    const { db } = makeFakeDb();
    setDbForTesting(db);

    await assert.rejects(
      createUserProfile.run(request("u1", { username: "newdirector", birthDate: "" })),
      /date of birth/
    );
  });

  test("rejects an underage date before any write", async () => {
    const { db, writes } = makeFakeDb();
    setDbForTesting(db);

    const thisYear = new Date().getUTCFullYear();
    await assert.rejects(
      createUserProfile.run(request("u1", { username: "kid", birthDate: `${thisYear - 10}-01-01` })),
      (err) => {
        assert.equal(err.code, "failed-precondition");
        assert.match(err.message, /at least 13/);
        return true;
      }
    );
    assert.equal(
      writes.some((w) => w.path.startsWith(`artifacts/${NS}/users/`)),
      false,
      "only the rate-budget bookkeeping may be written"
    );
  });

  test("rejects an unparseable date as invalid-argument", async () => {
    const { db } = makeFakeDb();
    setDbForTesting(db);

    await assert.rejects(
      createUserProfile.run(request("u1", { username: "newdirector", birthDate: "not-a-date" })),
      (err) => {
        assert.equal(err.code, "invalid-argument");
        return true;
      }
    );
  });

  test("creates the profile and records the attestation on the private doc", async () => {
    const { db, writes } = makeFakeDb();
    setDbForTesting(db);

    const res = await createUserProfile.run(
      request("u1", { username: "NewDirector", displayName: "Pat", birthDate: ADULT })
    );
    assert.equal(res.success, true);
    assert.equal(res.alreadyExists, undefined);

    const profile = writes.find((w) => w.path === profilePath("u1"));
    assert.ok(profile, "profile doc written");
    assert.equal(profile.data.username, "NewDirector");
    assert.equal("ageAttestation" in profile.data, false, "DOB never reaches the public profile");

    const priv = writes.find((w) => w.path === privatePath("u1"));
    assert.ok(priv, "private doc written");
    assert.equal(priv.data.ageAttestation.birthDate, ADULT);
    assert.match(priv.data.ageAttestation.attestedAt, /^\d{4}-\d{2}-\d{2}T/);

    const reservation = writes.find((w) => w.path === "usernames/newdirector");
    assert.deepEqual(reservation.data, { uid: "u1" });
  });

  test("a retry for an existing profile without the date is still the idempotent no-op", async () => {
    const { db, writes } = makeFakeDb(
      new Map([[profilePath("u1"), { uid: "u1", username: "existing" }]])
    );
    setDbForTesting(db);

    const res = await createUserProfile.run(request("u1", { username: "existing" }));
    assert.equal(res.success, true);
    assert.equal(res.alreadyExists, true);
    assert.equal(
      writes.some((w) => w.path.startsWith(`artifacts/${NS}/users/`)),
      false,
      "nothing rewritten on the retry"
    );
  });
});
