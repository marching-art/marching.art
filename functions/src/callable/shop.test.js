// Behavior tests for the seasonal rotation gate in purchaseShopItem (WS6.2)
// — seasonal items sell only while their named season type is running.
// Exercises the REAL onCall handler via the v2 `.run()` hook with a fake
// Firestore (same harness as prestige.test.js).
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");

const { setDbForTesting } = require("../config");
const { purchaseShopItem } = require("./shop");
const { getShopItem } = require("../helpers/shopCatalog");

const NS = process.env.DATA_NAMESPACE;
const profilePath = (uid) => `artifacts/${NS}/users/${uid}/profile/data`;
const SEASON_PATH = "game-settings/season";

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

after(() => setDbForTesting(null));

describe("purchaseShopItem seasonal gate", () => {
  beforeEach(() => setDbForTesting(null));

  const summerTour = getShopItem("theme_summer_tour");

  test("the catalog carries both rotation items with season tags", () => {
    assert.equal(summerTour.seasonal, "live-season");
    assert.equal(getShopItem("theme_off_circuit").seasonal, "off-season");
  });

  test("a seasonal item cannot be bought outside its season", async () => {
    const docs = new Map([
      [SEASON_PATH, { status: "off-season" }],
      [profilePath("u1"), { corpsCoin: 99999 }],
    ]);
    const { db, writes } = makeFakeDb(docs);
    setDbForTesting(db);
    await assert.rejects(
      purchaseShopItem.run(authedRequest("u1", { itemId: "theme_summer_tour" })),
      /seasonal exclusive/i
    );
    assert.equal(writes.length, 0);
  });

  test("a seasonal item sells during its season and debits normally", async () => {
    const docs = new Map([
      [SEASON_PATH, { status: "live-season" }],
      [profilePath("u1"), { corpsCoin: 5000, cosmetics: { owned: [] } }],
    ]);
    const { db, writes } = makeFakeDb(docs);
    setDbForTesting(db);

    const result = await purchaseShopItem.run(
      authedRequest("u1", { itemId: "theme_summer_tour" })
    );
    assert.equal(result.success, true);
    assert.equal(result.newBalance, 5000 - summerTour.price);

    const profileWrite = writes.find((w) => w.path === profilePath("u1"));
    assert.equal(profileWrite.data.corpsCoin, 5000 - summerTour.price);
  });

  test("non-seasonal items never read the season doc", async () => {
    // No season doc in the fake at all: an evergreen purchase must succeed,
    // proving the gate doesn't touch game-settings/season for it.
    const docs = new Map([
      [profilePath("u1"), { corpsCoin: 5000, cosmetics: { owned: [] } }],
    ]);
    const { db } = makeFakeDb(docs);
    setDbForTesting(db);
    const result = await purchaseShopItem.run(
      authedRequest("u1", { itemId: "theme_midnight" })
    );
    assert.equal(result.success, true);
  });

  test("no season doc at all keeps the register closed for seasonal items", async () => {
    const docs = new Map([[profilePath("u1"), { corpsCoin: 99999 }]]);
    const { db } = makeFakeDb(docs);
    setDbForTesting(db);
    await assert.rejects(
      purchaseShopItem.run(authedRequest("u1", { itemId: "theme_off_circuit" })),
      /seasonal exclusive/i
    );
  });
});
