// Tests for registerCorps' activeSeasonId handling.
//
// activeSeasonId is what league participation keys off
// (helpers/leagueActivity.js) and what the season-setup wizard uses to decide
// whether a returning director still owes continue/retire decisions. This
// endpoint has to advance it without stepping on the wizard.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");

const { setDbForTesting } = require("../config");
const { registerCorps } = require("./registerCorps");

const NS = process.env.DATA_NAMESPACE;
const profilePath = (uid) => `artifacts/${NS}/users/${uid}/profile/data`;

/**
 * Fake Firestore covering what registerCorps touches: db.doc().get(), a batch
 * of update/set, and the collection().where().limit().get() duplicate-name
 * scan. Everything not seeded reads as missing.
 */
function makeFakeDb(docs = new Map(), { commitError = null } = {}) {
  const writes = [];

  const makeRef = (path) => ({
    path,
    id: path.split("/").pop(),
    async get() {
      const data = docs.get(path);
      return { exists: data !== undefined, data: () => data };
    },
  });

  const emptyQuery = {
    where() {
      return emptyQuery;
    },
    limit() {
      return emptyQuery;
    },
    async get() {
      return { empty: true, size: 0, docs: [] };
    },
  };

  return {
    writes,
    db: {
      doc: (path) => makeRef(path),
      collection: (path) => ({ ...emptyQuery, doc: (id) => makeRef(`${path}/${id}`) }),
      collectionGroup: () => emptyQuery,
      batch() {
        return {
          update(ref, data) {
            writes.push({ type: "update", path: ref.path, data });
          },
          set(ref, data) {
            writes.push({ type: "set", path: ref.path, data });
          },
          create(ref, data) {
            writes.push({ type: "create", path: ref.path, data });
          },
          async commit() {
            if (commitError) throw commitError;
          },
        };
      },
    },
  };
}

const authedRequest = (uid, data) => ({ data, auth: { uid, token: {} } });

// The callable takes the class as `class`, not `corpsClass`.
const registerData = (overrides = {}) => ({
  corpsName: "Cavaliers",
  location: "Rosemont, IL",
  class: "soundSport",
  ...overrides,
});

/** The profile write registerCorps makes. */
const profileUpdate = (writes, uid = "u1") =>
  writes.find((w) => w.type === "update" && w.path === profilePath(uid))?.data;

function seed(profile, opts = {}) {
  const docs = new Map([
    ["game-settings/season", { seasonUid: "season-2" }],
    [profilePath("u1"), profile],
  ]);
  return makeFakeDb(docs, opts);
}

describe("registerCorps activeSeasonId", () => {
  beforeEach(() => setDbForTesting(null));
  after(() => setDbForTesting(null));

  test("sets activeSeasonId for a brand-new director", async () => {
    const { db, writes } = seed({ corps: {}, unlockedClasses: ["soundSport"] });
    setDbForTesting(db);

    await registerCorps.run(authedRequest("u1", registerData()));

    assert.equal(profileUpdate(writes).activeSeasonId, "season-2");
  });

  test("advances a STALE activeSeasonId when the director holds no other corps", async () => {
    // The hole this closes: a returning director who retired everything last
    // season has a stale activeSeasonId and no corps, so the wizard sends them
    // straight to registration — processCorpsDecisions, the other writer of
    // this field, never runs. They used to end up fielding a corps while their
    // profile still claimed the previous season, which reads as "not playing"
    // to league participation.
    const { db, writes } = seed({
      activeSeasonId: "season-1",
      corps: {},
      unlockedClasses: ["soundSport"],
    });
    setDbForTesting(db);

    await registerCorps.run(authedRequest("u1", registerData()));

    assert.equal(profileUpdate(writes).activeSeasonId, "season-2");
  });

  test("leaves a stale activeSeasonId alone while other corps await decisions", async () => {
    // The season mismatch is exactly what makes the wizard show its corps
    // verification step. A director still holding last season's corps must
    // keep that mismatch until they work through continue/retire.
    const { db, writes } = seed({
      activeSeasonId: "season-1",
      corps: { worldClass: { corpsName: "Blue Devils" } },
      unlockedClasses: ["soundSport", "worldClass"],
    });
    setDbForTesting(db);

    await registerCorps.run(authedRequest("u1", registerData()));

    assert.equal(
      profileUpdate(writes).activeSeasonId,
      undefined,
      "advancing here would skip the wizard's corps verification step"
    );
  });

  test("does not rewrite an activeSeasonId that already matches", async () => {
    const { db, writes } = seed({
      activeSeasonId: "season-2",
      corps: {},
      unlockedClasses: ["soundSport"],
    });
    setDbForTesting(db);

    await registerCorps.run(authedRequest("u1", registerData()));

    assert.equal(profileUpdate(writes).activeSeasonId, undefined);
  });
});

describe("registerCorps name reservation race", () => {
  beforeEach(() => setDbForTesting(null));
  after(() => setDbForTesting(null));

  test("reserves the corpsnames doc with create(), not set()", async () => {
    // set() would silently overwrite a rival registration that committed
    // between our pre-check read and our commit; create() makes the commit
    // itself fail atomically for the loser.
    const { db, writes } = seed({ corps: {}, unlockedClasses: ["soundSport"] });
    setDbForTesting(db);

    await registerCorps.run(authedRequest("u1", registerData()));

    const reservation = writes.find((w) => w.path.startsWith("corpsnames/"));
    assert.equal(reservation.type, "create");
    assert.equal(reservation.path, "corpsnames/season-2_cavaliers");
    assert.equal(reservation.data.uid, "u1");
  });

  test("losing the create() race surfaces the same friendly already-exists error", async () => {
    // gRPC ALREADY_EXISTS from a concurrent duplicate registration.
    const commitError = Object.assign(new Error("6 ALREADY_EXISTS: Document already exists"), { code: 6 });
    const { db } = seed({ corps: {}, unlockedClasses: ["soundSport"] }, { commitError });
    setDbForTesting(db);

    await assert.rejects(
      registerCorps.run(authedRequest("u1", registerData())),
      (err) => err.code === "already-exists" && /already taken/.test(err.message)
    );
  });

  test("a non-race commit failure is not mislabeled as a name conflict", async () => {
    const commitError = Object.assign(new Error("13 INTERNAL: write failed"), { code: 13 });
    const { db } = seed({ corps: {}, unlockedClasses: ["soundSport"] }, { commitError });
    setDbForTesting(db);

    await assert.rejects(
      registerCorps.run(authedRequest("u1", registerData())),
      (err) => err.code === "internal"
    );
  });
});
