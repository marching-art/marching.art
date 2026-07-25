// Behavior tests for makeLegacyEndowment — the recurring CorpsCoin sink.
// Exercises the REAL onCall handler via the v2 `.run()` hook with a fake
// Firestore (same harness as shop.test.js / prestige.test.js).
//
// This callable moves currency and grants titles, so the tests cover the ways
// it could leak value: charging without debiting, debiting twice, granting an
// honor that was not earned, or letting the entry list grow without bound.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");

const { setDbForTesting } = require("../config");
const { makeLegacyEndowment } = require("./legacy");
const { ENDOWMENT_TIERS, MAX_LEGACY_ENTRIES } = require("../helpers/legacyCatalog");

const NS = process.env.DATA_NAMESPACE;
const profilePath = (uid) => `artifacts/${NS}/users/${uid}/profile/data`;

const ENTRY = ENDOWMENT_TIERS.music_library; // 5,000 — first milestone exactly
const TOP = ENDOWMENT_TIERS.facility; // 100,000

function makeFakeDb(docs = new Map()) {
  const writes = [];
  let autoId = 0;
  const makeDocRef = (path) => ({
    path,
    async get() {
      const data = docs.get(path);
      return { exists: data !== undefined, data: () => data };
    },
    collection(name) {
      const subPath = `${path}/${name}`;
      return {
        doc(id) {
          return makeDocRef(`${subPath}/${id ?? `auto-${++autoId}`}`);
        },
      };
    },
  });
  const db = {
    doc(path) {
      return makeDocRef(path);
    },
    collection(path) {
      return {
        doc(id) {
          return makeDocRef(`${path}/${id ?? `auto-${++autoId}`}`);
        },
      };
    },
    async runTransaction(fn) {
      const transaction = {
        async get(ref) {
          const data = docs.get(ref.path);
          return { exists: data !== undefined, data: () => data };
        },
        update(ref, data) {
          writes.push({ type: "update", path: ref.path, data });
        },
        set(ref, data, options) {
          writes.push({ type: "set", path: ref.path, data, options });
        },
      };
      return fn(transaction);
    },
  };
  return { db, writes };
}

const authedRequest = (uid, data = {}) => ({ data, auth: { uid, token: {} } });

/** The profile update recorded by the transaction. */
const profileUpdate = (writes, uid) =>
  writes.find((w) => w.type === "update" && w.path === profilePath(uid))?.data;

/** The coin-history entry recorded by the transaction. */
const historyWrite = (writes) =>
  writes.find((w) => w.type === "set" && w.path.includes("corpsCoinHistory"))?.data;

after(() => setDbForTesting(null));

describe("makeLegacyEndowment", () => {
  beforeEach(() => setDbForTesting(null));

  test("debits the price and records the endowment", async () => {
    const docs = new Map([
      [profilePath("u1"), { corpsCoin: 20000, activeSeasonId: "adagio_2026-27" }],
    ]);
    const { db, writes } = makeFakeDb(docs);
    setDbForTesting(db);

    const result = await makeLegacyEndowment.run(
      authedRequest("u1", { tierId: "music_library" })
    );

    assert.equal(result.success, true);
    assert.equal(result.amount, ENTRY.price);
    assert.equal(result.newBalance, 20000 - ENTRY.price);
    assert.equal(result.legacyTotal, ENTRY.price);

    const update = profileUpdate(writes, "u1");
    assert.equal(update.corpsCoin, 20000 - ENTRY.price);
    assert.equal(update["legacy.total"], ENTRY.price);
    assert.equal(update["legacy.count"], 1);
    assert.equal(update["legacy.entries"].length, 1);
    assert.equal(update["legacy.entries"][0].tierId, "music_library");
    assert.equal(update["legacy.entries"][0].amount, ENTRY.price);
    // The season the gift was made in is what turns amounts into a timeline.
    assert.equal(update["legacy.entries"][0].seasonUid, "adagio_2026-27");
  });

  test("writes a negative coin-history entry so mint-vs-sink sees the drain", async () => {
    const docs = new Map([[profilePath("u1"), { corpsCoin: 20000 }]]);
    const { db, writes } = makeFakeDb(docs);
    setDbForTesting(db);

    await makeLegacyEndowment.run(authedRequest("u1", { tierId: "music_library" }));

    const history = historyWrite(writes);
    assert.ok(history, "expected a corpsCoinHistory entry");
    assert.equal(history.type, "legacy_endowment");
    assert.equal(history.amount, -ENTRY.price);
    assert.equal(history.balance, 20000 - ENTRY.price);
  });

  test("accumulates across endowments rather than replacing the total", async () => {
    const docs = new Map([
      [
        profilePath("u1"),
        {
          corpsCoin: 50000,
          legacy: { total: ENTRY.price, count: 1, entries: [{ tierId: "music_library" }] },
          cosmetics: { owned: ["title_legacy_patron"] },
        },
      ],
    ]);
    const { db, writes } = makeFakeDb(docs);
    setDbForTesting(db);

    const result = await makeLegacyEndowment.run(
      authedRequest("u1", { tierId: "instrument_fund" })
    );

    const expected = ENTRY.price + ENDOWMENT_TIERS.instrument_fund.price;
    assert.equal(result.legacyTotal, expected);

    const update = profileUpdate(writes, "u1");
    assert.equal(update["legacy.total"], expected);
    assert.equal(update["legacy.count"], 2);
    // Newest first.
    assert.equal(update["legacy.entries"][0].tierId, "instrument_fund");
    assert.equal(update["legacy.entries"][1].tierId, "music_library");
  });

  test("is repeatable — the same tier can be endowed again", async () => {
    // This is the whole point: unlike every other sink, an endowment is never
    // "already owned".
    const docs = new Map([
      [
        profilePath("u1"),
        {
          corpsCoin: 50000,
          legacy: { total: ENTRY.price, count: 1, entries: [{ tierId: "music_library" }] },
          cosmetics: { owned: ["title_legacy_patron"] },
        },
      ],
    ]);
    const { db, writes } = makeFakeDb(docs);
    setDbForTesting(db);

    const result = await makeLegacyEndowment.run(
      authedRequest("u1", { tierId: "music_library" })
    );
    assert.equal(result.success, true);
    assert.equal(profileUpdate(writes, "u1")["legacy.total"], ENTRY.price * 2);
  });

  test("grants the milestone title when a threshold is crossed", async () => {
    const docs = new Map([[profilePath("u1"), { corpsCoin: 20000, cosmetics: { owned: [] } }]]);
    const { db, writes } = makeFakeDb(docs);
    setDbForTesting(db);

    const result = await makeLegacyEndowment.run(
      authedRequest("u1", { tierId: "music_library" })
    );

    assert.deepEqual(
      result.earnedTitles.map((t) => t.itemId),
      ["title_legacy_patron"]
    );
    assert.match(result.message, /Patron/);
    // Granted through cosmetics.owned so the existing equip flow displays it.
    assert.ok(profileUpdate(writes, "u1")["cosmetics.owned"]);
  });

  test("grants every threshold crossed by one large endowment", async () => {
    const docs = new Map([[profilePath("u1"), { corpsCoin: 200000, cosmetics: { owned: [] } }]]);
    const { db } = makeFakeDb(docs);
    setDbForTesting(db);

    const result = await makeLegacyEndowment.run(authedRequest("u1", { tierId: "facility" }));

    assert.equal(result.legacyTotal, TOP.price);
    assert.deepEqual(
      result.earnedTitles.map((t) => t.name),
      ["Patron", "Benefactor", "Guarantor"]
    );
  });

  test("does not touch cosmetics when no new title is earned", async () => {
    const docs = new Map([
      [
        profilePath("u1"),
        {
          corpsCoin: 20000,
          legacy: { total: ENTRY.price, count: 1 },
          cosmetics: { owned: ["title_legacy_patron"] },
        },
      ],
    ]);
    const { db, writes } = makeFakeDb(docs);
    setDbForTesting(db);

    const result = await makeLegacyEndowment.run(
      authedRequest("u1", { tierId: "music_library" })
    );
    assert.deepEqual(result.earnedTitles, []);
    assert.equal(profileUpdate(writes, "u1")["cosmetics.owned"], undefined);
    assert.match(result.message, /part of your record/);
  });

  test("refuses an endowment the director cannot afford, writing nothing", async () => {
    const docs = new Map([[profilePath("u1"), { corpsCoin: ENTRY.price - 1 }]]);
    const { db, writes } = makeFakeDb(docs);
    setDbForTesting(db);

    await assert.rejects(
      makeLegacyEndowment.run(authedRequest("u1", { tierId: "music_library" })),
      /Not enough CorpsCoin/i
    );
    assert.equal(profileUpdate(writes, "u1"), undefined);
    assert.equal(historyWrite(writes), undefined);
  });

  test("allows an endowment that spends the balance exactly to zero", async () => {
    const docs = new Map([[profilePath("u1"), { corpsCoin: ENTRY.price }]]);
    const { db } = makeFakeDb(docs);
    setDbForTesting(db);

    const result = await makeLegacyEndowment.run(
      authedRequest("u1", { tierId: "music_library" })
    );
    assert.equal(result.newBalance, 0);
  });

  test("rejects an unknown tier", async () => {
    const docs = new Map([[profilePath("u1"), { corpsCoin: 999999 }]]);
    const { db, writes } = makeFakeDb(docs);
    setDbForTesting(db);

    await assert.rejects(
      makeLegacyEndowment.run(authedRequest("u1", { tierId: "free_stuff" })),
      /Unknown endowment tier/i
    );
    assert.equal(writes.length, 0);
  });

  test("rejects an inherited Object property as a tier", async () => {
    const docs = new Map([[profilePath("u1"), { corpsCoin: 999999 }]]);
    const { db } = makeFakeDb(docs);
    setDbForTesting(db);

    await assert.rejects(
      makeLegacyEndowment.run(authedRequest("u1", { tierId: "constructor" })),
      /Unknown endowment tier/i
    );
  });

  test("rejects a missing profile", async () => {
    const { db } = makeFakeDb(new Map());
    setDbForTesting(db);

    await assert.rejects(
      makeLegacyEndowment.run(authedRequest("ghost", { tierId: "music_library" })),
      /profile not found/i
    );
  });

  test("requires authentication", async () => {
    const { db } = makeFakeDb(new Map());
    setDbForTesting(db);

    await assert.rejects(
      makeLegacyEndowment.run({ data: { tierId: "music_library" }, auth: null })
    );
  });

  test("keeps a sanitized dedication and drops an unusable one", async () => {
    const docs = new Map([[profilePath("u1"), { corpsCoin: 999999 }]]);
    const { db, writes } = makeFakeDb(docs);
    setDbForTesting(db);

    await makeLegacyEndowment.run(
      authedRequest("u1", { tierId: "music_library", dedication: "  For the  2009 horns  " })
    );
    assert.equal(
      profileUpdate(writes, "u1")["legacy.entries"][0].dedication,
      "For the 2009 horns"
    );

    const { db: db2, writes: writes2 } = makeFakeDb(
      new Map([[profilePath("u2"), { corpsCoin: 999999 }]])
    );
    setDbForTesting(db2);
    await makeLegacyEndowment.run(
      authedRequest("u2", { tierId: "music_library", dedication: "x".repeat(500) })
    );
    // Oversized text is dropped, not rejected — the endowment is the point.
    assert.equal(
      "dedication" in profileUpdate(writes2, "u2")["legacy.entries"][0],
      false
    );
  });

  test("caps the stored entry list without losing the totals", async () => {
    // A decades-long career must not grow the profile doc the dashboard reads
    // on every visit. total/count are scalars, so trimming loses no aggregate.
    const existing = Array.from({ length: MAX_LEGACY_ENTRIES + 25 }, (_, i) => ({
      tierId: "music_library",
      amount: ENTRY.price,
      seq: i,
    }));
    const docs = new Map([
      [
        profilePath("u1"),
        {
          corpsCoin: 999999,
          legacy: { total: 500000, count: existing.length, entries: existing },
          cosmetics: { owned: [] },
        },
      ],
    ]);
    const { db, writes } = makeFakeDb(docs);
    setDbForTesting(db);

    await makeLegacyEndowment.run(authedRequest("u1", { tierId: "music_library" }));

    const update = profileUpdate(writes, "u1");
    assert.equal(update["legacy.entries"].length, MAX_LEGACY_ENTRIES);
    assert.equal(update["legacy.count"], existing.length + 1);
    assert.equal(update["legacy.total"], 500000 + ENTRY.price);
    // Newest survives the trim; the oldest is the one dropped.
    assert.equal(update["legacy.entries"][0].seq, undefined);
    assert.equal(update["legacy.entries"][1].seq, 0);
  });

  test("survives a corrupt legacy field rather than throwing", async () => {
    const docs = new Map([
      [
        profilePath("u1"),
        { corpsCoin: 20000, legacy: { total: "lots", count: null, entries: "nope" } },
      ],
    ]);
    const { db, writes } = makeFakeDb(docs);
    setDbForTesting(db);

    const result = await makeLegacyEndowment.run(
      authedRequest("u1", { tierId: "music_library" })
    );
    assert.equal(result.legacyTotal, ENTRY.price);
    assert.equal(profileUpdate(writes, "u1")["legacy.entries"].length, 1);
  });
});
