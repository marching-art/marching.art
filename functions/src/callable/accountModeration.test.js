// Behavior tests for setAccountRestriction — the admin moderation action that
// restricts an account from the zero-sum surfaces. Exercises the real onCall
// handler via the v2 `.run()` hook with a fake Firestore injected through
// config.setDbForTesting. node:test; run with `npm test` inside functions/.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");

const { setDbForTesting } = require("../config");
const { setAccountRestriction } = require("./accountModeration");

const NS = process.env.DATA_NAMESPACE;
const profilePath = (uid) => `artifacts/${NS}/users/${uid}/profile/data`;

/** Fake Firestore covering db.doc(path).get()/.set(). */
function makeFakeDb(docs = new Map()) {
  const writes = [];
  const db = {
    doc(path) {
      return {
        path,
        async get() {
          const data = docs.get(path);
          return { exists: data !== undefined, data: () => data };
        },
        async set(data, opts) {
          writes.push({ path, data, opts });
          docs.set(path, { ...(docs.get(path) || {}), ...data });
        },
      };
    },
  };
  return { db, writes, docs };
}

const adminReq = (data) => ({ data, auth: { uid: "admin1", token: { admin: true } } });
const userReq = (data) => ({ data, auth: { uid: "u1", token: {} } });

after(() => setDbForTesting(null));

describe("setAccountRestriction", () => {
  beforeEach(() => setDbForTesting(null));

  test("rejects a non-admin caller", async () => {
    setDbForTesting(makeFakeDb().db);
    await assert.rejects(
      setAccountRestriction.run(userReq({ uid: "target", restricted: true })),
      /admin/i
    );
  });

  test("rejects an unauthenticated caller", async () => {
    setDbForTesting(makeFakeDb().db);
    await assert.rejects(
      setAccountRestriction.run({ data: { uid: "target", restricted: true }, auth: null })
    );
  });

  test("rejects a malformed uid", async () => {
    setDbForTesting(makeFakeDb().db);
    await assert.rejects(
      setAccountRestriction.run(adminReq({ uid: "bad/id", restricted: true })),
      /uid/i
    );
  });

  test("404s when the target profile does not exist", async () => {
    setDbForTesting(makeFakeDb().db);
    await assert.rejects(
      setAccountRestriction.run(adminReq({ uid: "ghost", restricted: true })),
      /No such director/i
    );
  });

  test("restricts an existing account, stamping reason + admin + timestamp", async () => {
    const docs = new Map([[profilePath("target"), { username: "alt1" }]]);
    const { db, docs: store } = makeFakeDb(docs);
    setDbForTesting(db);

    const res = await setAccountRestriction.run(
      adminReq({ uid: "target", restricted: true, reason: "confirmed alt ring" })
    );
    assert.deepEqual(res, { success: true, uid: "target", restricted: true });

    const mod = store.get(profilePath("target")).moderation;
    assert.equal(mod.restricted, true);
    assert.equal(mod.reason, "confirmed alt ring");
    assert.equal(mod.by, "admin1");
    assert.ok(mod.at instanceof Date);
  });

  test("un-restricts, clearing the reason (fully reversible)", async () => {
    const docs = new Map([
      [profilePath("target"), { moderation: { restricted: true, reason: "x", by: "admin1" } }],
    ]);
    const { db, docs: store } = makeFakeDb(docs);
    setDbForTesting(db);

    const res = await setAccountRestriction.run(adminReq({ uid: "target", restricted: false }));
    assert.equal(res.restricted, false);
    const mod = store.get(profilePath("target")).moderation;
    assert.equal(mod.restricted, false);
    assert.equal(mod.reason, null);
  });

  test("clamps an overlong reason", async () => {
    const docs = new Map([[profilePath("target"), { username: "alt1" }]]);
    const { db, docs: store } = makeFakeDb(docs);
    setDbForTesting(db);

    await setAccountRestriction.run(
      adminReq({ uid: "target", restricted: true, reason: "z".repeat(2000) })
    );
    assert.equal(store.get(profilePath("target")).moderation.reason.length, 500);
  });
});
