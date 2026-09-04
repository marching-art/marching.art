// Gate and input-validation tests for the admin callables — the highest
// blast-radius writes in the backend (season rollover, manual job triggers,
// score backfills). Site review Q-H3: this file had no tests at all.
//
// Exercises the REAL onCall handlers via the v2 `.run()` hook with a fake
// Firestore injected through config.setDbForTesting, like leagues.test.js.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");

const { setDbForTesting } = require("../config");
// The live-score scrape callables live in adminLiveScores.js (split for the
// max-lines gate) but are gated and validated as one admin surface here.
const adminCallables = { ...require("./admin"), ...require("./adminLiveScores") };

const ADMIN_CALLABLES = [
  "startNewOffSeason",
  "startNewLiveSeason",
  "manualTrigger",
  "scrapeLiveScoresNow",
  "backfillLiveScoresForDayRange",
  "sendTestEmail",
];

/** Fake Firestore: docs map for reads, records writes. */
function makeFakeDb(docs = new Map()) {
  const writes = [];
  const makeRef = (path) => ({
    path,
    async get() {
      return { exists: docs.has(path), data: () => docs.get(path) };
    },
    async set(data, options) {
      writes.push({ path, data, options });
    },
    async update(data) {
      writes.push({ path, data, update: true });
    },
  });
  return {
    writes,
    doc: (path) => makeRef(path),
    collection: (path) => ({
      doc: (id) => makeRef(`${path}/${id}`),
      async get() {
        return { empty: true, docs: [], size: 0, forEach() {} };
      },
    }),
  };
}

const anonymous = (data = {}) => ({ data, auth: null });
const director = (data = {}) => ({ data, auth: { uid: "u1", token: {} } });
const admin = (data = {}, token = {}) => ({
  data,
  auth: { uid: "admin1", token: { admin: true, ...token } },
});

after(() => setDbForTesting(null));

describe("admin callables are admin-gated", () => {
  beforeEach(() => setDbForTesting(makeFakeDb()));

  for (const name of ADMIN_CALLABLES) {
    test(`${name} rejects an anonymous caller as unauthenticated`, async () => {
      await assert.rejects(adminCallables[name].run(anonymous({ jobName: "x" })), (err) => {
        assert.equal(err.code, "unauthenticated");
        return true;
      });
    });

    test(`${name} rejects a signed-in non-admin as permission-denied`, async () => {
      await assert.rejects(adminCallables[name].run(director({ jobName: "x" })), (err) => {
        assert.equal(err.code, "permission-denied");
        return true;
      });
    });
  }

  test("the gate reads the custom claim, not a data flag", async () => {
    await assert.rejects(
      adminCallables.manualTrigger.run({
        data: { jobName: "x", admin: true },
        auth: { uid: "u1", token: { admin: "true" } },
      }),
      (err) => {
        assert.equal(err.code, "permission-denied");
        return true;
      }
    );
  });
});

describe("manualTrigger", () => {
  test("an unknown job name is not-found and touches nothing", async () => {
    const db = makeFakeDb();
    setDbForTesting(db);
    await assert.rejects(
      adminCallables.manualTrigger.run(admin({ jobName: "dropAllTables" })),
      (err) => {
        assert.equal(err.code, "not-found");
        assert.match(err.message, /dropAllTables/);
        return true;
      }
    );
    assert.equal(db.writes.length, 0);
  });

  test("refreshLeagueActivity refuses to run with no active season", async () => {
    const db = makeFakeDb(); // no game-settings/season doc
    setDbForTesting(db);
    await assert.rejects(
      adminCallables.manualTrigger.run(admin({ jobName: "refreshLeagueActivity" })),
      (err) => {
        assert.equal(err.code, "failed-precondition");
        return true;
      }
    );
    assert.equal(db.writes.length, 0);
  });
});

describe("backfillLiveScoresForDayRange input validation", () => {
  beforeEach(() => setDbForTesting(makeFakeDb()));

  const bad = [
    { startDay: 0, endDay: 5 },
    { startDay: 3, endDay: 50 },
    { startDay: 10, endDay: 9 },
    { startDay: "a", endDay: 5 },
    { startDay: 1.5, endDay: 5 },
    {},
  ];
  for (const data of bad) {
    test(`rejects ${JSON.stringify(data)}`, async () => {
      await assert.rejects(
        adminCallables.backfillLiveScoresForDayRange.run(admin(data)),
        (err) => {
          assert.equal(err.code, "invalid-argument");
          return true;
        }
      );
    });
  }
});

describe("sendTestEmail", () => {
  beforeEach(() => setDbForTesting(makeFakeDb()));

  test("needs an address from the payload or the auth token", async () => {
    await assert.rejects(adminCallables.sendTestEmail.run(admin({})), (err) => {
      assert.equal(err.code, "invalid-argument");
      return true;
    });
  });

  test("a send failure surfaces as internal, never as success", async () => {
    // No Brevo key is configured in tests, so the send path returns false.
    await assert.rejects(
      adminCallables.sendTestEmail.run(admin({}, { email: "admin@example.com" })),
      (err) => {
        assert.equal(err.code, "internal");
        return true;
      }
    );
  });
});
