// Unit tests for the CorpsCoin economy helpers and config in economy.js.
// Uses Node's built-in test runner (node:test) — no extra dependency needed.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  addCoinHistoryEntryToBatch,
  addCoinHistoryEntryToTransaction,
  SHOW_PARTICIPATION_REWARDS,
  CLASS_UNLOCK_COSTS,
  SEASON_FINISH_BONUSES,
  WEEKLY_LEAGUE_WIN_REWARD,
  TRANSACTION_TYPES,
} = require("./economy");

// A minimal Firestore double that records writes without touching the network.
function makeDb() {
  return {
    collection(path) {
      return { doc: () => ({ id: "generated-id", _path: path }) };
    },
  };
}

describe("addCoinHistoryEntryToBatch", () => {
  test("writes the entry to the user's corpsCoinHistory subcollection", () => {
    const writes = [];
    const batch = { set: (ref, data) => writes.push({ ref, data }) };
    addCoinHistoryEntryToBatch(batch, makeDb(), "user1", {
      type: TRANSACTION_TYPES.SHOW_PARTICIPATION,
      amount: 50,
    });

    assert.equal(writes.length, 1);
    assert.match(writes[0].ref._path, /\/users\/user1\/corpsCoinHistory$/);
    assert.equal(writes[0].data.type, "show_participation");
    assert.equal(writes[0].data.amount, 50);
    assert.ok(writes[0].data.timestamp !== undefined); // default timestamp injected
  });

  test("preserves an explicit timestamp when provided", () => {
    const writes = [];
    const batch = { set: (ref, data) => writes.push({ ref, data }) };
    addCoinHistoryEntryToBatch(batch, makeDb(), "user1", { amount: 10, timestamp: 12345 });
    assert.equal(writes[0].data.timestamp, 12345);
  });
});

describe("addCoinHistoryEntryToTransaction", () => {
  test("defaults the timestamp to a Date within a transaction", () => {
    const writes = [];
    const transaction = { set: (ref, data) => writes.push({ ref, data }) };
    addCoinHistoryEntryToTransaction(transaction, makeDb(), "user2", {
      type: TRANSACTION_TYPES.LEAGUE_WIN,
      amount: 100,
    });

    assert.equal(writes.length, 1);
    assert.ok(writes[0].data.timestamp instanceof Date);
    assert.equal(writes[0].data.amount, 100);
  });
});

describe("economy config", () => {
  test("show participation rewards increase with class tier", () => {
    assert.equal(SHOW_PARTICIPATION_REWARDS.soundSport, 50);
    assert.ok(SHOW_PARTICIPATION_REWARDS.soundSport < SHOW_PARTICIPATION_REWARDS.aClass);
    assert.ok(SHOW_PARTICIPATION_REWARDS.aClass < SHOW_PARTICIPATION_REWARDS.open);
    assert.ok(SHOW_PARTICIPATION_REWARDS.open < SHOW_PARTICIPATION_REWARDS.world);
  });

  test("class unlock costs accept both short and canonical keys with equal values", () => {
    assert.equal(CLASS_UNLOCK_COSTS.open, CLASS_UNLOCK_COSTS.openClass);
    assert.equal(CLASS_UNLOCK_COSTS.world, CLASS_UNLOCK_COSTS.worldClass);
    assert.ok(CLASS_UNLOCK_COSTS.aClass < CLASS_UNLOCK_COSTS.open);
    assert.ok(CLASS_UNLOCK_COSTS.open < CLASS_UNLOCK_COSTS.world);
  });

  test("season finish bonuses decrease down the standings", () => {
    assert.ok(SEASON_FINISH_BONUSES[1] > SEASON_FINISH_BONUSES[2]);
    assert.ok(SEASON_FINISH_BONUSES[2] > SEASON_FINISH_BONUSES[3]);
    assert.ok(SEASON_FINISH_BONUSES[3] > SEASON_FINISH_BONUSES.top10);
    assert.ok(SEASON_FINISH_BONUSES.top10 > SEASON_FINISH_BONUSES.top25);
  });

  test("weekly league win reward is a positive number", () => {
    assert.equal(typeof WEEKLY_LEAGUE_WIN_REWARD, "number");
    assert.ok(WEEKLY_LEAGUE_WIN_REWARD > 0);
  });

  test("transaction type values are unique", () => {
    const values = Object.values(TRANSACTION_TYPES);
    assert.equal(new Set(values).size, values.length);
  });
});
