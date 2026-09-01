// Behavior tests for the Design Exchange callables — the opt-in uniform
// gallery. Exercises the REAL onCall handlers via the v2 `.run()` hook with a
// fake Firestore (same harness as legacy.test.js / shop.test.js).
//
// The Exchange moves currency (creator payouts) and writes world-readable
// docs, so the tests pin the leak paths: paying twice for one saver, paying
// past the daily cap, paying a self-save, publishing private aiHints, and
// counters that drift from their one-per-user markers.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");

const { setDbForTesting } = require("../config");
const {
  publishUniformDesign,
  unpublishUniformDesign,
  likeExchangeDesign,
  saveExchangeDesign,
  reportExchangeDesign,
  adminRemoveExchangeDesign,
  EXCHANGE_SAVE_REWARD,
  EXCHANGE_DAILY_CAP,
  EXCHANGE_MIN_SAVER_AGE_DAYS,
  MAX_PUBLISHED_PER_USER,
  saverAccountOldEnough,
} = require("./designExchange");

const NS = process.env.DATA_NAMESPACE;
const profilePath = (uid) => `artifacts/${NS}/users/${uid}/profile/data`;
const wardrobePath = (uid, id) => `artifacts/${NS}/users/${uid}/wardrobe/${id}`;
const entryPath = (id) => `artifacts/${NS}/design_exchange/${id}`;
const payoutPath = (uid) => `artifacts/${NS}/design_exchange_payouts/${uid}`;

const DESIGN = {
  schema: 2,
  name: "Finals Look",
  colorway: { primary: "#6d1a26", secondary: "#d9a41c", accent: "#ece2cc", metal: "gold" },
  figure: { skin: "#c9a074", jacket: "#6d1a26" },
  aiHints: { additionalNotes: "private prompt prose" },
};

const ENTRY = {
  design: {
    schema: 2,
    name: "Finals Look",
    colorway: DESIGN.colorway,
    figure: DESIGN.figure,
  },
  designName: "Finals Look",
  designId: "d1",
  creatorUid: "creator",
  creatorName: "MaestroMax",
  likes: 0,
  saves: 0,
  reports: 0,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

/**
 * Fake Firestore: docs is path -> data; writes records every mutation.
 * Supports the surface the Exchange callables touch: doc get/set/update,
 * where().count(), count(), transactions (incl. delete), recursiveDelete.
 * Top-level set/update also applies to `docs` so multi-step callables read
 * their own writes.
 */
function makeFakeDb(docs = new Map()) {
  const writes = [];
  const deletes = [];
  let autoId = 0;
  const makeDocRef = (path) => ({
    path,
    async get() {
      const data = docs.get(path);
      return { exists: data !== undefined, data: () => data, id: path.split("/").pop() };
    },
    async set(data) {
      writes.push({ type: "set", path, data });
      docs.set(path, data);
    },
    async update(data) {
      writes.push({ type: "update", path, data });
      docs.set(path, { ...(docs.get(path) || {}), ...data });
    },
    get id() {
      return path.split("/").pop();
    },
    collection(name) {
      return makeCollection(`${path}/${name}`);
    },
  });
  const makeCollection = (path) => ({
    doc(id) {
      return makeDocRef(`${path}/${id ?? `auto-${++autoId}`}`);
    },
    where(field, _op, value) {
      return {
        count() {
          return {
            async get() {
              let n = 0;
              for (const [p, d] of docs) {
                if (p.startsWith(`${path}/`) && !p.slice(path.length + 1).includes("/")) {
                  if (d && d[field] === value) n += 1;
                }
              }
              return { data: () => ({ count: n }) };
            },
          };
        },
      };
    },
    count() {
      return {
        async get() {
          let n = 0;
          for (const p of docs.keys()) {
            if (p.startsWith(`${path}/`) && !p.slice(path.length + 1).includes("/")) n += 1;
          }
          return { data: () => ({ count: n }) };
        },
      };
    },
  });
  const db = {
    doc(path) {
      return makeDocRef(path);
    },
    collection(path) {
      return makeCollection(path);
    },
    async recursiveDelete(ref) {
      deletes.push(ref.path);
      docs.delete(ref.path);
    },
    async runTransaction(fn) {
      const transaction = {
        async get(ref) {
          const data = docs.get(ref.path);
          return { exists: data !== undefined, data: () => data };
        },
        update(ref, data) {
          writes.push({ type: "update", path: ref.path, data });
          docs.set(ref.path, { ...(docs.get(ref.path) || {}), ...data });
        },
        set(ref, data, options) {
          writes.push({ type: "set", path: ref.path, data, options });
          docs.set(ref.path, data);
        },
        delete(ref) {
          writes.push({ type: "delete", path: ref.path });
          docs.delete(ref.path);
        },
      };
      return fn(transaction);
    },
  };
  return { db, writes, deletes, docs };
}

const authedRequest = (uid, data = {}) => ({ data, auth: { uid, token: {} } });
const adminRequest = (uid, data = {}) => ({ data, auth: { uid, token: { admin: true } } });

/** The recorded increment amount from a FieldValue.increment sentinel. */
const incrementOf = (sentinel) =>
  sentinel && typeof sentinel === "object" ? Number(sentinel.operand ?? NaN) : NaN;

after(() => setDbForTesting(null));

describe("publishUniformDesign", () => {
  beforeEach(() => setDbForTesting(null));

  test("publishes the sanitized snapshot without aiHints", async () => {
    const docs = new Map([
      [wardrobePath("creator", "d1"), { ...DESIGN }],
      [profilePath("creator"), { username: "MaestroMax" }],
    ]);
    const { db } = makeFakeDb(docs);
    setDbForTesting(db);

    const result = await publishUniformDesign.run(authedRequest("creator", { designId: "d1" }));
    assert.equal(result.entryId, "creator_d1");
    const entry = docs.get(entryPath("creator_d1"));
    assert.equal(entry.creatorUid, "creator");
    assert.equal(entry.creatorName, "MaestroMax");
    assert.equal(entry.designName, "Finals Look");
    assert.equal(entry.likes, 0);
    assert.deepEqual(Object.keys(entry.design).sort(), ["colorway", "figure", "name", "schema"]);
    assert.equal(entry.design.aiHints, undefined);
  });

  test("re-publish refreshes the snapshot but keeps counters and createdAt", async () => {
    const docs = new Map([
      [wardrobePath("creator", "d1"), { ...DESIGN, name: "Renamed Look" }],
      [profilePath("creator"), { username: "MaestroMax" }],
      [entryPath("creator_d1"), { ...ENTRY, likes: 7, saves: 3 }],
    ]);
    const { db } = makeFakeDb(docs);
    setDbForTesting(db);

    await publishUniformDesign.run(authedRequest("creator", { designId: "d1" }));
    const entry = docs.get(entryPath("creator_d1"));
    assert.equal(entry.designName, "Renamed Look");
    assert.equal(entry.likes, 7);
    assert.equal(entry.saves, 3);
    assert.equal(entry.createdAt, ENTRY.createdAt);
  });

  test("enforces the published-designs cap for new entries", async () => {
    const docs = new Map([
      [wardrobePath("creator", "dNew"), { ...DESIGN }],
      [profilePath("creator"), { username: "MaestroMax" }],
    ]);
    for (let i = 0; i < MAX_PUBLISHED_PER_USER; i++) {
      docs.set(entryPath(`creator_d${i}`), { ...ENTRY, designId: `d${i}` });
    }
    const { db } = makeFakeDb(docs);
    setDbForTesting(db);

    await assert.rejects(
      publishUniformDesign.run(authedRequest("creator", { designId: "dNew" })),
      /Unpublish one first/
    );
  });
});

describe("saveExchangeDesign", () => {
  beforeEach(() => setDbForTesting(null));

  test("first save copies with attribution, bumps the counter, pays the creator", async () => {
    const docs = new Map([
      [entryPath("creator_d1"), { ...ENTRY }],
      [profilePath("creator"), { username: "MaestroMax", corpsCoin: 100 }],
      [profilePath("saver"), { username: "NewFan" }],
    ]);
    const { db, writes } = makeFakeDb(docs);
    setDbForTesting(db);

    const result = await saveExchangeDesign.run(authedRequest("saver", { entryId: "creator_d1" }));
    assert.match(result.message, /design by MaestroMax/);

    const copy = [...docs.entries()].find(([p]) =>
      p.startsWith(`artifacts/${NS}/users/saver/wardrobe/`)
    );
    assert.ok(copy, "wardrobe copy written");
    assert.equal(copy[1].name, "Finals Look");
    assert.equal(copy[1].importedFrom.creatorName, "MaestroMax");
    assert.equal(copy[1].aiHints, undefined);

    const counterBump = writes.find(
      (w) => w.type === "update" && w.path === entryPath("creator_d1")
    );
    assert.equal(incrementOf(counterBump.data.saves), 1);

    const creatorUpdate = writes.find(
      (w) => w.type === "update" && w.path === profilePath("creator")
    );
    assert.equal(creatorUpdate.data.corpsCoin, 100 + EXCHANGE_SAVE_REWARD);
    const history = writes.find(
      (w) => w.type === "set" && w.path.includes("users/creator/corpsCoinHistory")
    );
    assert.equal(history.data.type, "design_exchange_save");
    assert.equal(history.data.amount, EXCHANGE_SAVE_REWARD);
    const ledger = docs.get(payoutPath("creator"));
    assert.equal(ledger.earned, EXCHANGE_SAVE_REWARD);
  });

  test("a repeat save copies again but never double-pays or double-counts", async () => {
    const docs = new Map([
      [entryPath("creator_d1"), { ...ENTRY, saves: 1 }],
      [`${entryPath("creator_d1")}/saves/saver`, { savedAt: "x" }],
      [profilePath("creator"), { username: "MaestroMax", corpsCoin: 100 }],
    ]);
    const { db, writes } = makeFakeDb(docs);
    setDbForTesting(db);

    await saveExchangeDesign.run(authedRequest("saver", { entryId: "creator_d1" }));
    const copy = [...docs.keys()].find((p) => p.startsWith(`artifacts/${NS}/users/saver/wardrobe/`));
    assert.ok(copy, "repeat save still gets a copy");
    assert.equal(
      writes.find((w) => w.type === "update" && w.path === profilePath("creator")),
      undefined
    );
    assert.equal(docs.get(entryPath("creator_d1")).saves, 1);
  });

  test("payout stops at the daily cap and never goes negative", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const docs = new Map([
      [entryPath("creator_d1"), { ...ENTRY }],
      [profilePath("creator"), { username: "MaestroMax", corpsCoin: 100 }],
      [payoutPath("creator"), { day: today, earned: EXCHANGE_DAILY_CAP }],
    ]);
    const { db, writes } = makeFakeDb(docs);
    setDbForTesting(db);

    await saveExchangeDesign.run(authedRequest("saver", { entryId: "creator_d1" }));
    assert.equal(
      writes.find((w) => w.type === "update" && w.path === profilePath("creator")),
      undefined,
      "no payout past the cap"
    );
    // the save itself still counts
    assert.equal(incrementOf(docs.get(entryPath("creator_d1")).saves), 1);
  });

  test("a stale ledger from yesterday resets and pays", async () => {
    const docs = new Map([
      [entryPath("creator_d1"), { ...ENTRY }],
      [profilePath("creator"), { username: "MaestroMax", corpsCoin: 0 }],
      [payoutPath("creator"), { day: "2000-01-01", earned: EXCHANGE_DAILY_CAP }],
    ]);
    const { db } = makeFakeDb(docs);
    setDbForTesting(db);

    await saveExchangeDesign.run(authedRequest("saver", { entryId: "creator_d1" }));
    assert.equal(docs.get(payoutPath("creator")).earned, EXCHANGE_SAVE_REWARD);
    assert.equal(docs.get(profilePath("creator")).corpsCoin, EXCHANGE_SAVE_REWARD);
  });

  test("copying a gated design requires its pack; owning it lets the copy through", async () => {
    const gatedEntry = {
      ...ENTRY,
      design: {
        ...ENTRY.design,
        figure: { ...ENTRY.design.figure, iridescent: true },
      },
    };
    const docs = new Map([
      [entryPath("creator_d1"), gatedEntry],
      [profilePath("creator"), { username: "MaestroMax", corpsCoin: 100 }],
      [profilePath("saver"), { username: "NewFan", cosmetics: { owned: [] } }],
    ]);
    const { db } = makeFakeDb(docs);
    setDbForTesting(db);

    await assert.rejects(
      saveExchangeDesign.run(authedRequest("saver", { entryId: "creator_d1" })),
      /Texture Atelier/
    );
    assert.equal(
      [...docs.keys()].find((p) => p.startsWith(`artifacts/${NS}/users/saver/wardrobe/`)),
      undefined,
      "no copy past the gate"
    );

    docs.set(profilePath("saver"), {
      username: "NewFan",
      cosmetics: { owned: ["pack_texture_atelier"] },
    });
    await saveExchangeDesign.run(authedRequest("saver", { entryId: "creator_d1" }));
    const copy = [...docs.entries()].find(([p]) =>
      p.startsWith(`artifacts/${NS}/users/saver/wardrobe/`)
    );
    assert.ok(copy, "owned pack unlocks the copy");
    assert.equal(copy[1].figure.iridescent, true);
  });

  test("a restricted account cannot save (no copy, no payout)", async () => {
    const docs = new Map([
      [entryPath("creator_d1"), { ...ENTRY }],
      [profilePath("creator"), { username: "MaestroMax", corpsCoin: 100 }],
      [profilePath("alt"), { username: "Alt", moderation: { restricted: true } }],
    ]);
    const { db, writes } = makeFakeDb(docs);
    setDbForTesting(db);

    await assert.rejects(
      saveExchangeDesign.run(authedRequest("alt", { entryId: "creator_d1" })),
      (err) => err.code === "permission-denied"
    );
    assert.equal(
      [...docs.keys()].find((p) => p.startsWith(`artifacts/${NS}/users/alt/wardrobe/`)),
      undefined
    );
    assert.equal(writes.find((w) => w.path === profilePath("creator")), undefined);
  });

  test("a brand-new account's save copies and counts but pays nothing", async () => {
    const docs = new Map([
      [entryPath("creator_d1"), { ...ENTRY }],
      [profilePath("creator"), { username: "MaestroMax", corpsCoin: 100 }],
      [profilePath("fresh"), { username: "Fresh", createdAt: new Date().toISOString() }],
    ]);
    const { db, writes } = makeFakeDb(docs);
    setDbForTesting(db);

    await saveExchangeDesign.run(authedRequest("fresh", { entryId: "creator_d1" }));
    assert.ok([...docs.keys()].find((p) => p.startsWith(`artifacts/${NS}/users/fresh/wardrobe/`)));
    assert.equal(incrementOf(docs.get(entryPath("creator_d1")).saves), 1);
    assert.equal(
      writes.find((w) => w.type === "update" && w.path === profilePath("creator")),
      undefined,
      "no payout for a save from a days-old account"
    );
  });

  test("an established account's save pays; missing createdAt counts as established", () => {
    const now = Date.parse("2026-09-01T12:00:00Z");
    const days = (n) => new Date(now - n * 24 * 60 * 60 * 1000).toISOString();
    assert.equal(saverAccountOldEnough({ createdAt: days(EXCHANGE_MIN_SAVER_AGE_DAYS + 1) }, now), true);
    assert.equal(saverAccountOldEnough({ createdAt: days(EXCHANGE_MIN_SAVER_AGE_DAYS - 1) }, now), false);
    assert.equal(saverAccountOldEnough({ createdAt: { seconds: (now - 30 * 86400000) / 1000 } }, now), true);
    assert.equal(saverAccountOldEnough({ createdAt: { toDate: () => new Date(now) } }, now), false);
    assert.equal(saverAccountOldEnough({}, now), true);
    assert.equal(saverAccountOldEnough(null, now), true);
    assert.equal(saverAccountOldEnough({ createdAt: "garbage" }, now), true);
  });

  test("saving your own entry copies but pays nothing", async () => {
    const docs = new Map([
      [entryPath("creator_d1"), { ...ENTRY }],
      [profilePath("creator"), { username: "MaestroMax", corpsCoin: 100 }],
    ]);
    const { db, writes } = makeFakeDb(docs);
    setDbForTesting(db);

    await saveExchangeDesign.run(authedRequest("creator", { entryId: "creator_d1" }));
    assert.equal(
      writes.find((w) => w.type === "set" && w.path.includes("corpsCoinHistory")),
      undefined
    );
    assert.equal(incrementOf(docs.get(entryPath("creator_d1")).saves), 1);
  });
});

describe("likeExchangeDesign", () => {
  beforeEach(() => setDbForTesting(null));

  test("like sets the marker and bumps the counter; unlike reverses it", async () => {
    const docs = new Map([[entryPath("creator_d1"), { ...ENTRY }]]);
    const { db } = makeFakeDb(docs);
    setDbForTesting(db);

    await likeExchangeDesign.run(authedRequest("fan", { entryId: "creator_d1", liked: true }));
    assert.ok(docs.get(`${entryPath("creator_d1")}/likes/fan`));
    assert.equal(incrementOf(docs.get(entryPath("creator_d1")).likes), 1);

    await likeExchangeDesign.run(authedRequest("fan", { entryId: "creator_d1", liked: false }));
    assert.equal(docs.get(`${entryPath("creator_d1")}/likes/fan`), undefined);
  });

  test("liking twice is a no-op, not a double count", async () => {
    const docs = new Map([
      [entryPath("creator_d1"), { ...ENTRY, likes: 1 }],
      [`${entryPath("creator_d1")}/likes/fan`, { likedAt: "x" }],
    ]);
    const { db, writes } = makeFakeDb(docs);
    setDbForTesting(db);

    await likeExchangeDesign.run(authedRequest("fan", { entryId: "creator_d1", liked: true }));
    assert.equal(
      writes.find((w) => w.type === "update" && w.path === entryPath("creator_d1")),
      undefined
    );
  });
});

describe("reportExchangeDesign", () => {
  beforeEach(() => setDbForTesting(null));

  test("one report per user; reasons are bounded", async () => {
    const docs = new Map([[entryPath("creator_d1"), { ...ENTRY }]]);
    const { db, writes } = makeFakeDb(docs);
    setDbForTesting(db);

    await reportExchangeDesign.run(
      authedRequest("fan", { entryId: "creator_d1", reason: "x".repeat(500) })
    );
    const report = docs.get(`${entryPath("creator_d1")}/reports/fan`);
    assert.equal(report.reason.length, 200);
    assert.equal(incrementOf(docs.get(entryPath("creator_d1")).reports), 1);

    const before = writes.length;
    await reportExchangeDesign.run(authedRequest("fan", { entryId: "creator_d1" }));
    const counterWrites = writes
      .slice(before)
      .filter((w) => w.type === "update" && w.path === entryPath("creator_d1"));
    assert.equal(counterWrites.length, 0);
  });
});

describe("unpublish + admin takedown", () => {
  beforeEach(() => setDbForTesting(null));

  test("only the creator can unpublish; delete is recursive", async () => {
    const docs = new Map([[entryPath("creator_d1"), { ...ENTRY }]]);
    const { db, deletes } = makeFakeDb(docs);
    setDbForTesting(db);

    await assert.rejects(
      unpublishUniformDesign.run(authedRequest("intruder", { entryId: "creator_d1" })),
      /your own designs/
    );
    await unpublishUniformDesign.run(authedRequest("creator", { entryId: "creator_d1" }));
    assert.deepEqual(deletes, [entryPath("creator_d1")]);
  });

  test("admin takedown requires the admin claim", async () => {
    const docs = new Map([[entryPath("creator_d1"), { ...ENTRY }]]);
    const { db, deletes } = makeFakeDb(docs);
    setDbForTesting(db);

    await assert.rejects(
      adminRemoveExchangeDesign.run(authedRequest("fan", { entryId: "creator_d1" })),
      /admin/
    );
    await adminRemoveExchangeDesign.run(adminRequest("mod", { entryId: "creator_d1" }));
    assert.deepEqual(deletes, [entryPath("creator_d1")]);
  });
});
