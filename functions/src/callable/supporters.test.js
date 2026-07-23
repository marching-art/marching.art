// Behavior tests for linkBmacSupport's claim hardening.
//
// The contract: a claim of the caller's own verified login email links
// freely; a claim of any OTHER email is throttled per uid (knowledge of the
// donation email is the only proof in that flow, so unthrottled attempts
// would let an attacker enumerate emails and steal a donor's flair) and the
// resulting link is flagged claimEmailMatched:false for the audit trail.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const { setDbForTesting } = require("../config");
const { linkBmacSupport } = require("./supporters");

const NS = process.env.DATA_NAMESPACE;
const hash = (email) => crypto.createHash("sha256").update(email.trim().toLowerCase()).digest("hex");

const DONOR_EMAIL = "donor@example.com";
const DONOR_HASH = hash(DONOR_EMAIL);
const supporterPath = `artifacts/${NS}/supporters/${DONOR_HASH}`;
const profilePath = (uid) => `artifacts/${NS}/users/${uid}/profile/data`;

/**
 * Fake Firestore: docs in a Map keyed by full path; supports db.doc(),
 * db.collection().doc() (two-segment collections only, enough for the
 * attempt-budget docs), and runTransaction with get/set. collectionGroup is
 * absent on purpose — the admin fan-out wraps it in try/catch.
 */
function makeDb(initial = new Map()) {
  const docs = new Map(initial);
  const makeRef = (path) => ({
    path,
    async get() {
      return { exists: docs.has(path), data: () => docs.get(path) };
    },
    async set(data, options) {
      docs.set(path, options?.merge ? { ...(docs.get(path) || {}), ...data } : data);
    },
  });
  const db = {
    doc: (path) => makeRef(path),
    collection: (name) => ({ doc: (id) => makeRef(`${name}/${id}`) }),
    async runTransaction(fn) {
      return fn({
        get: async (ref) => ref.get(),
        set: (ref, data, options) => {
          docs.set(ref.path, options?.merge ? { ...(docs.get(ref.path) || {}), ...data } : data);
        },
      });
    },
  };
  return { db, docs };
}

const activeSupporter = () => ({
  active: true,
  tier: "section-leader",
  since: "2026-01-01",
  anonymous: false,
  message: null,
});

after(() => setDbForTesting(null));

describe("linkBmacSupport claim hardening", () => {
  beforeEach(() => setDbForTesting(null));

  test("caller's own verified email links freely and is flagged matched", async () => {
    const { db, docs } = makeDb(
      new Map([
        [supporterPath, activeSupporter()],
        [profilePath("u1"), { username: "alice", displayName: "Alice" }],
      ])
    );
    setDbForTesting(db);

    const result = await linkBmacSupport.run({
      data: { email: DONOR_EMAIL },
      auth: { uid: "u1", token: { email: DONOR_EMAIL, email_verified: true } },
    });

    assert.equal(result.success, true);
    assert.equal(docs.get(supporterPath).uid, "u1");
    assert.equal(docs.get(supporterPath).claimEmailMatched, true);
    assert.equal(docs.has("bmacLinkAttempts/u1"), false, "own-email claims spend no attempts");
  });

  test("a mismatched email still links but is flagged and consumes an attempt", async () => {
    const { db, docs } = makeDb(
      new Map([
        [supporterPath, activeSupporter()],
        [profilePath("u1"), { username: "alice" }],
      ])
    );
    setDbForTesting(db);

    const result = await linkBmacSupport.run({
      data: { email: DONOR_EMAIL },
      auth: { uid: "u1", token: { email: "other@example.com", email_verified: true } },
    });

    assert.equal(result.success, true);
    assert.equal(docs.get(supporterPath).claimEmailMatched, false);
    assert.equal(docs.get("bmacLinkAttempts/u1").count, 1);
  });

  test("an unverified login email counts as mismatched", async () => {
    const { db, docs } = makeDb(
      new Map([
        [supporterPath, activeSupporter()],
        [profilePath("u1"), { username: "alice" }],
      ])
    );
    setDbForTesting(db);

    await linkBmacSupport.run({
      data: { email: DONOR_EMAIL },
      auth: { uid: "u1", token: { email: DONOR_EMAIL, email_verified: false } },
    });

    assert.equal(docs.get(supporterPath).claimEmailMatched, false);
    assert.equal(docs.get("bmacLinkAttempts/u1").count, 1);
  });

  test("mismatched-email attempts are throttled after the hourly budget", async () => {
    const { db } = makeDb(
      new Map([
        [supporterPath, activeSupporter()],
        ["bmacLinkAttempts/u1", { windowStart: Date.now(), count: 5 }],
      ])
    );
    setDbForTesting(db);

    await assert.rejects(
      linkBmacSupport.run({
        data: { email: DONOR_EMAIL },
        auth: { uid: "u1", token: { email: "other@example.com", email_verified: true } },
      }),
      /Too many link attempts/
    );
  });

  test("the throttle also bounds failed guesses at unknown emails", async () => {
    const { db, docs } = makeDb(); // no supporter docs at all
    setDbForTesting(db);

    for (let i = 0; i < 5; i++) {
      await assert.rejects(
        linkBmacSupport.run({
          data: { email: `guess${i}@example.com` },
          auth: { uid: "u1", token: { email: "me@example.com", email_verified: true } },
        }),
        /couldn't find an active membership/
      );
    }
    assert.equal(docs.get("bmacLinkAttempts/u1").count, 5);

    await assert.rejects(
      linkBmacSupport.run({
        data: { email: "guess6@example.com" },
        auth: { uid: "u1", token: { email: "me@example.com", email_verified: true } },
      }),
      /Too many link attempts/
    );
  });

  test("a claim already linked to another account is rejected", async () => {
    const { db } = makeDb(
      new Map([[supporterPath, { ...activeSupporter(), uid: "someone-else" }]])
    );
    setDbForTesting(db);

    await assert.rejects(
      linkBmacSupport.run({
        data: { email: DONOR_EMAIL },
        auth: { uid: "u1", token: { email: DONOR_EMAIL, email_verified: true } },
      }),
      /already linked/
    );
  });
});
