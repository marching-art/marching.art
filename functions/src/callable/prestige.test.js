// Behavior tests for the prestige sinks — retirement plaques and the Hall
// of Champions banner. Exercises the REAL onCall handlers via the v2 `.run()`
// hook with a fake Firestore (same harness as leaguePools.test.js).
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");

const { setDbForTesting } = require("../config");
const { purchaseRetirementPlaque, purchaseHallBanner } = require("./prestige");
const { PLAQUE_TIERS, HALL_BANNER_PRICE } = require("../helpers/prestigeCatalog");

const NS = process.env.DATA_NAMESPACE;
const profilePath = (uid) => `artifacts/${NS}/users/${uid}/profile/data`;
const championsPath = (seasonId) => `season_champions/${seasonId}`;

function makeFakeDb(docs = new Map()) {
  const writes = [];
  let autoId = 0;
  const makeDocRef = (path) => ({
    path,
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

const retiredEntry = (overrides = {}) => ({
  corpsClass: "worldClass",
  corpsName: "Star of the North",
  totalSeasons: 4,
  bestSeasonScore: 91.2,
  ...overrides,
});

after(() => setDbForTesting(null));

describe("purchaseRetirementPlaque", () => {
  beforeEach(() => setDbForTesting(null));

  test("rejects unauthenticated calls", async () => {
    await assert.rejects(
      purchaseRetirementPlaque.run({ data: {}, auth: null }),
      /logged in/
    );
  });

  test("rejects an unknown tier", async () => {
    await assert.rejects(
      purchaseRetirementPlaque.run(
        authedRequest("u1", { retiredIndex: 0, corpsName: "X", tier: "platinum" })
      ),
      /plaque tier/i
    );
  });

  test("rejects a corps-name mismatch (index-shift guard)", async () => {
    const docs = new Map([
      [profilePath("u1"), { corpsCoin: 99999, retiredCorps: [retiredEntry()] }],
    ]);
    const { db } = makeFakeDb(docs);
    setDbForTesting(db);
    await assert.rejects(
      purchaseRetirementPlaque.run(
        authedRequest("u1", { retiredIndex: 0, corpsName: "Someone Else", tier: "bronze" })
      ),
      /could not be found/i
    );
  });

  test("rejects an insufficient balance", async () => {
    const docs = new Map([
      [
        profilePath("u1"),
        { corpsCoin: PLAQUE_TIERS.gold.price - 1, retiredCorps: [retiredEntry()] },
      ],
    ]);
    const { db } = makeFakeDb(docs);
    setDbForTesting(db);
    await assert.rejects(
      purchaseRetirementPlaque.run(
        authedRequest("u1", { retiredIndex: 0, corpsName: "Star of the North", tier: "gold" })
      ),
      /Not enough CorpsCoin/i
    );
  });

  test("commissions a plaque: writes it on the right entry, debits, logs history", async () => {
    const other = retiredEntry({ corpsName: "Second Corps" });
    const docs = new Map([
      [profilePath("u1"), { corpsCoin: 10000, retiredCorps: [retiredEntry(), other] }],
    ]);
    const { db, writes } = makeFakeDb(docs);
    setDbForTesting(db);

    const result = await purchaseRetirementPlaque.run(
      authedRequest("u1", { retiredIndex: 0, corpsName: "Star of the North", tier: "silver" })
    );
    assert.equal(result.success, true);
    assert.equal(result.newBalance, 10000 - PLAQUE_TIERS.silver.price);

    const profileWrite = writes.find((w) => w.path === profilePath("u1"));
    assert.equal(profileWrite.data.corpsCoin, 10000 - PLAQUE_TIERS.silver.price);
    assert.equal(profileWrite.data.retiredCorps[0].plaque.tier, "silver");
    assert.ok(profileWrite.data.retiredCorps[0].plaque.purchasedAt);
    assert.equal(profileWrite.data.retiredCorps[1].plaque, undefined);

    const history = writes.find((w) =>
      w.path.startsWith(`artifacts/${NS}/users/u1/corpsCoinHistory/`)
    );
    assert.equal(history.data.type, "prestige");
    assert.equal(history.data.amount, -PLAQUE_TIERS.silver.price);
  });

  test("upgrades pay the full new-tier price; downgrades and repeats are rejected", async () => {
    const withBronze = retiredEntry({ plaque: { tier: "bronze", purchasedAt: "2026-01-01" } });
    const docs = new Map([
      [profilePath("u1"), { corpsCoin: 50000, retiredCorps: [withBronze] }],
    ]);
    const { db, writes } = makeFakeDb(docs);
    setDbForTesting(db);

    // Repeat of the same tier is refused
    await assert.rejects(
      purchaseRetirementPlaque.run(
        authedRequest("u1", { retiredIndex: 0, corpsName: "Star of the North", tier: "bronze" })
      ),
      /equal or finer/i
    );

    // Upgrade to gold works and pays gold's full price
    const result = await purchaseRetirementPlaque.run(
      authedRequest("u1", { retiredIndex: 0, corpsName: "Star of the North", tier: "gold" })
    );
    assert.equal(result.newBalance, 50000 - PLAQUE_TIERS.gold.price);
    const profileWrite = writes.find((w) => w.path === profilePath("u1"));
    assert.equal(profileWrite.data.retiredCorps[0].plaque.tier, "gold");
  });
});

describe("purchaseHallBanner", () => {
  beforeEach(() => setDbForTesting(null));

  const championsDoc = () => ({
    seasonName: "live_2026",
    classes: {
      worldClass: [
        { rank: 1, uid: "champ", username: "alice", corpsName: "Blue Devils", score: 98.2 },
        { rank: 2, uid: "runner", username: "bob", corpsName: "Bluecoats", score: 97.5 },
      ],
    },
  });

  test("rejects unauthenticated calls", async () => {
    await assert.rejects(purchaseHallBanner.run({ data: {}, auth: null }), /logged in/);
  });

  test("rejects an invalid class and a bad season id", async () => {
    await assert.rejects(
      purchaseHallBanner.run(
        authedRequest("champ", { seasonId: "s1", corpsClass: "megaClass", message: "hi" })
      ),
      /corps class/i
    );
    await assert.rejects(
      purchaseHallBanner.run(
        authedRequest("champ", { seasonId: "a/b", corpsClass: "worldClass", message: "hi" })
      ),
      /season/i
    );
  });

  test("rejects empty, oversized, and profane messages", async () => {
    for (const message of ["", "   ", "x".repeat(61), "well damn"]) {
      await assert.rejects(
        purchaseHallBanner.run(
          authedRequest("champ", { seasonId: "s1", corpsClass: "worldClass", message })
        ),
        /banner/i
      );
    }
  });

  test("only the rank-1 champion may buy", async () => {
    const docs = new Map([
      [championsPath("s1"), championsDoc()],
      [profilePath("runner"), { corpsCoin: 99999 }],
    ]);
    const { db } = makeFakeDb(docs);
    setDbForTesting(db);
    await assert.rejects(
      purchaseHallBanner.run(
        authedRequest("runner", { seasonId: "s1", corpsClass: "worldClass", message: "We came close" })
      ),
      /champion/i
    );
  });

  test("rejects a second banner on the same championship", async () => {
    const doc = championsDoc();
    doc.classes.worldClass[0].banner = { message: "Old glory", purchasedAt: "2026-01-01" };
    const docs = new Map([
      [championsPath("s1"), doc],
      [profilePath("champ"), { corpsCoin: 99999 }],
    ]);
    const { db } = makeFakeDb(docs);
    setDbForTesting(db);
    await assert.rejects(
      purchaseHallBanner.run(
        authedRequest("champ", { seasonId: "s1", corpsClass: "worldClass", message: "Again!" })
      ),
      /already hangs/i
    );
  });

  test("rejects an insufficient balance", async () => {
    const docs = new Map([
      [championsPath("s1"), championsDoc()],
      [profilePath("champ"), { corpsCoin: HALL_BANNER_PRICE - 1 }],
    ]);
    const { db } = makeFakeDb(docs);
    setDbForTesting(db);
    await assert.rejects(
      purchaseHallBanner.run(
        authedRequest("champ", { seasonId: "s1", corpsClass: "worldClass", message: "So close" })
      ),
      /Not enough CorpsCoin/i
    );
  });

  test("hangs the banner on the champion's entry, sanitized, and debits the price", async () => {
    const docs = new Map([
      [championsPath("s1"), championsDoc()],
      [profilePath("champ"), { corpsCoin: 25000 }],
    ]);
    const { db, writes } = makeFakeDb(docs);
    setDbForTesting(db);

    const result = await purchaseHallBanner.run(
      authedRequest("champ", {
        seasonId: "s1",
        corpsClass: "worldClass",
        message: "  Ours is  the\tvictory  ",
      })
    );
    assert.equal(result.success, true);
    assert.equal(result.newBalance, 25000 - HALL_BANNER_PRICE);

    const championsWrite = writes.find((w) => w.path === championsPath("s1"));
    const entries = championsWrite.data["classes.worldClass"];
    assert.equal(entries[0].banner.message, "Ours is the victory");
    assert.ok(entries[0].banner.purchasedAt);
    assert.equal(entries[1].banner, undefined);

    const debit = writes.find((w) => w.path === profilePath("champ"));
    assert.equal(debit.data.corpsCoin, 25000 - HALL_BANNER_PRICE);

    const history = writes.find((w) =>
      w.path.startsWith(`artifacts/${NS}/users/champ/corpsCoinHistory/`)
    );
    assert.equal(history.data.type, "prestige");
    assert.equal(history.data.amount, -HALL_BANNER_PRICE);
  });
});
