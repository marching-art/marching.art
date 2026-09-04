// Per-show ranking and medals are decided within a division — the same field
// the recap sheet numbers and the ledger's "place" reads against. These pin
// that the medal a row carries always agrees with the place beside it.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { medalForPlace, rankShowResults } = require("./showRanking");
const balance = require("./balanceConfig.json");

const MIN = balance.medals.minFieldSize;

describe("medalForPlace", () => {
  test("top three of a full-size field medal, in order", () => {
    assert.equal(medalForPlace(1, MIN, MIN), "gold");
    assert.equal(medalForPlace(2, MIN, MIN), "silver");
    assert.equal(medalForPlace(3, MIN, MIN), "bronze");
    assert.equal(medalForPlace(4, MIN, MIN), null);
  });

  test("a field under the minimum is not a podium", () => {
    assert.equal(medalForPlace(1, MIN - 1, MIN), null);
    assert.equal(medalForPlace(1, 1, MIN), null);
  });

  test("a missing or malformed placement never medals", () => {
    assert.equal(medalForPlace(null, 10, MIN), null);
    assert.equal(medalForPlace(0, 10, MIN), null);
    assert.equal(medalForPlace(1.5, 10, MIN), null);
    assert.equal(medalForPlace(1, undefined, MIN), null);
  });
});

describe("rankShowResults", () => {
  const row = (uid, division, totalScore) => ({ uid, division, totalScore });

  test("places and medals are decided within each division, not the mixed field", () => {
    const results = [
      row("w1", "worldClass", 90),
      row("a1", "aClass", 61),
      row("w2", "worldClass", 89),
      row("a2", "aClass", 60),
      row("w3", "worldClass", 88),
      row("a3", "aClass", 59),
      row("w4", "worldClass", 87),
      row("a4", "aClass", 58),
      row("w5", "worldClass", 86),
    ];
    const { results: ranked, medalByUid } = rankShowResults(results, { minFieldSize: MIN });

    // The array keeps the score order every reader expects…
    assert.deepEqual(
      ranked.map((r) => r.uid),
      ["w1", "w2", "w3", "w4", "w5", "a1", "a2", "a3", "a4"]
    );
    // …while each division numbers its own field.
    const byUid = Object.fromEntries(ranked.map((r) => [r.uid, r]));
    assert.equal(byUid.a1.place, 1);
    assert.equal(byUid.a1.fieldSize, 4);
    assert.equal(byUid.a1.medal, "gold");
    assert.equal(byUid.a3.place, 3);
    assert.equal(byUid.a3.medal, "bronze");
    assert.equal(byUid.a4.place, 4);
    assert.equal(byUid.a4.medal, null);
    assert.equal(byUid.w4.place, 4);
    assert.equal(byUid.w4.fieldSize, 5);
    assert.equal(byUid.w4.medal, null);
    // The A Class winner would have been sixth in the mixed field — it still
    // takes the gold its own division awards.
    assert.deepEqual(medalByUid, {
      w1: "gold",
      w2: "silver",
      w3: "bronze",
      a1: "gold",
      a2: "silver",
      a3: "bronze",
    });
  });

  test("a division below the minimum field places but does not medal", () => {
    const results = [
      row("o1", "openClass", 80),
      row("o2", "openClass", 79),
      row("o3", "openClass", 78),
      row("a1", "aClass", 70),
    ];
    const { results: ranked, medalByUid } = rankShowResults(results, { minFieldSize: MIN });
    const byUid = Object.fromEntries(ranked.map((r) => [r.uid, r]));
    assert.equal(byUid.o1.place, 1);
    assert.equal(byUid.o1.fieldSize, 3);
    assert.equal(byUid.o1.medal, null);
    assert.equal(byUid.a1.place, 1);
    assert.equal(byUid.a1.fieldSize, 1);
    assert.equal(byUid.a1.medal, null);
    assert.deepEqual(medalByUid, {});
  });

  test("the medal on every row agrees with the place beside it", () => {
    const results = [];
    for (const division of ["worldClass", "openClass", "aClass"]) {
      for (let i = 0; i < 6; i++) results.push(row(`${division}-${i}`, division, 100 - i * 3));
    }
    const { results: ranked } = rankShowResults(results, { minFieldSize: MIN });
    for (const r of ranked) {
      assert.equal(r.medal, medalForPlace(r.place, r.fieldSize, MIN), r.uid);
    }
  });

  test("an unknown division is folded into A Class, the way every reader does", () => {
    const results = [row("x", undefined, 50), row("y", "aClass", 49), row("z", "bogus", 48)];
    const { results: ranked } = rankShowResults(results, { minFieldSize: 3 });
    assert.deepEqual(
      ranked.map((r) => [r.place, r.fieldSize, r.medal]),
      [
        [1, 3, "gold"],
        [2, 3, "silver"],
        [3, 3, "bronze"],
      ]
    );
  });

  test("re-ranking an already-ranked show is a no-op", () => {
    const results = [row("a", "aClass", 70), row("b", "aClass", 71)];
    rankShowResults(results, { minFieldSize: 2 });
    const first = JSON.stringify(results);
    rankShowResults(results, { minFieldSize: 2 });
    assert.equal(JSON.stringify(results), first);
  });
});
