// Unit tests for the news data layer's playable-pool filtering. A pool corps'
// `points` is its fantasy caption value: 1–25 for playable World Class corps,
// and 99 for a corps that is inactive that season or is Open Class. The DCI
// articles cover only the playable World Class field, so the 99-value corps must
// be dropped before the field is built.

const { test, describe } = require("node:test");
const assert = require("node:assert");

const {
  isPlayablePoolCorps,
  filterPlayablePool,
} = require("./newsData");

describe("isPlayablePoolCorps", () => {
  test("keeps playable World Class corps (points 1–25)", () => {
    assert.strictEqual(isPlayablePoolCorps({ corpsName: "Blue Devils", points: 25 }), true);
    assert.strictEqual(isPlayablePoolCorps({ corpsName: "Troopers", points: 1 }), true);
    assert.strictEqual(isPlayablePoolCorps({ corpsName: "Mid", points: 13 }), true);
  });

  test("drops the inactive / Open Class sentinel (points 99)", () => {
    assert.strictEqual(isPlayablePoolCorps({ corpsName: "Inactive", points: 99 }), false);
    // Firestore could hand back a stringified number — coerce before comparing.
    assert.strictEqual(isPlayablePoolCorps({ corpsName: "Inactive", points: "99" }), false);
  });

  test("keeps corps with missing/unknown points rather than guessing", () => {
    assert.strictEqual(isPlayablePoolCorps({ corpsName: "NoPoints" }), true);
    assert.strictEqual(isPlayablePoolCorps({ corpsName: "NullPoints", points: null }), true);
  });
});

describe("filterPlayablePool", () => {
  test("removes every 99-value corps and preserves the rest in order", () => {
    const pool = [
      { corpsName: "Blue Devils", points: 25 },
      { corpsName: "Legends", points: 99 },       // Open Class / inactive
      { corpsName: "Bluecoats", points: 24 },
      { corpsName: "Gold", points: 99 },           // Open Class / inactive
      { corpsName: "Troopers", points: 8 },
    ];
    assert.deepStrictEqual(
      filterPlayablePool(pool).map((c) => c.corpsName),
      ["Blue Devils", "Bluecoats", "Troopers"]
    );
  });

  test("returns an empty pool when every corps is a 99-value corps", () => {
    const pool = [
      { corpsName: "Legends", points: 99 },
      { corpsName: "Gold", points: 99 },
    ];
    assert.deepStrictEqual(filterPlayablePool(pool), []);
  });

  test("tolerates a null/undefined pool", () => {
    assert.deepStrictEqual(filterPlayablePool(null), []);
    assert.deepStrictEqual(filterPlayablePool(undefined), []);
  });
});
