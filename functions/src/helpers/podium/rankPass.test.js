// The nightly rank pass: season rank + medal counter for every corps in the
// standings, and a Corps Budget purse for tonight's medal winners (§5.4).
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const store = require("./store");
const { runRankPass } = require("./rankPass");

/** A fake Firestore that records every batched set as { path, data, options }. */
function fakeDb() {
  /** @type {Array<{path: string, data: any, options: any}>} */
  const writes = [];
  return {
    writes,
    doc: (/** @type {string} */ path) => ({ path }),
    batch: () => ({
      set: (/** @type {{path: string}} */ ref, /** @type {any} */ data, /** @type {any} */ options) =>
        writes.push({ path: ref.path, data, options }),
      commit: async () => {},
    }),
  };
}

describe("runRankPass", () => {
  test("ranks every corps, counts tonight's medal, and pays its purse", async () => {
    const db = fakeDb();
    const winner = { budget: store.initBudget() };
    const stateDataByUid = new Map([
      ["gold", winner],
      ["fourth", { budget: store.initBudget() }],
    ]);
    const { pursesPaid } = await runRankPass(/** @type {any} */ (db), {
      standings: [
        { uid: "gold", lastTotal: 88, medals: { gold: 2 }, division: "worldClass" },
        { uid: "fourth", lastTotal: 80, medals: {}, division: "worldClass" },
      ],
      medalByUid: { gold: "gold" },
      stateDataByUid,
      competitionDay: 24,
    });

    assert.equal(pursesPaid, 1);
    assert.equal(winner.budget.balance, store.medalPurseFor("gold"));
    const goldState = db.writes.find((w) => w.path === store.stateRef(/** @type {any} */ (db), "gold").path);
    assert.ok(goldState);
    assert.deepEqual(goldState.data.medals, { gold: 3 });
    assert.equal(goldState.data.seasonRank, 1);
    assert.equal(goldState.data.budget.balance, store.medalPurseFor("gold"));
    assert.equal(goldState.options.merge, true);

    const fourthState = db.writes.find(
      (w) => w.path === store.stateRef(/** @type {any} */ (db), "fourth").path
    );
    assert.ok(fourthState);
    assert.equal(fourthState.data.seasonRank, 2);
    assert.equal("budget" in fourthState.data, false, "no medal, no budget write");
    // Profile display copies for both.
    assert.equal(db.writes.length, 4);
  });
});
