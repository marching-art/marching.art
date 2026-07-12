// Tests for the current-season ranking snapshot helpers. These pin the
// score/sort/rank math that getUserRankings used to do inline, so the
// materialized snapshot produces identical ranks to the old per-call scan.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { sumSeasonScore, computeSeasonRankings } = require("./seasonRankings");

describe("sumSeasonScore", () => {
  test("sums totalSeasonScore across all corps classes", () => {
    const profile = {
      corps: {
        worldClass: { totalSeasonScore: 90 },
        openClass: { totalSeasonScore: 45.5 },
        soundSport: { totalSeasonScore: 10 },
      },
    };
    assert.equal(sumSeasonScore(profile), 145.5);
  });

  test("returns 0 for a profile with no corps", () => {
    assert.equal(sumSeasonScore({}), 0);
    assert.equal(sumSeasonScore({ corps: {} }), 0);
  });

  test("treats a missing per-corps score as 0", () => {
    const profile = {
      corps: { worldClass: { totalSeasonScore: 50 }, aClass: {} },
    };
    assert.equal(sumSeasonScore(profile), 50);
  });

  test("legacy fallback: top-level corpsName without worldClass corps", () => {
    const profile = { corpsName: "Legacy Corps", totalSeasonScore: 77 };
    assert.equal(sumSeasonScore(profile), 77);
  });

  test("does not double-count when worldClass corps already exists", () => {
    const profile = {
      corpsName: "Has Both",
      totalSeasonScore: 999,
      corps: { worldClass: { totalSeasonScore: 60 } },
    };
    assert.equal(sumSeasonScore(profile), 60);
  });
});

describe("computeSeasonRankings", () => {
  test("ranks by descending score, 1-based", () => {
    const { ranks, totalPlayers } = computeSeasonRankings([
      { uid: "a", totalScore: 30 },
      { uid: "b", totalScore: 90 },
      { uid: "c", totalScore: 60 },
    ]);
    assert.equal(totalPlayers, 3);
    assert.equal(ranks.b.rank, 1);
    assert.equal(ranks.c.rank, 2);
    assert.equal(ranks.a.rank, 3);
    assert.equal(ranks.b.totalScore, 90);
  });

  test("ties share the same rank (findIndex semantics)", () => {
    const { ranks } = computeSeasonRankings([
      { uid: "a", totalScore: 50 },
      { uid: "b", totalScore: 50 },
      { uid: "c", totalScore: 20 },
    ]);
    assert.equal(ranks.a.rank, 1);
    assert.equal(ranks.b.rank, 1);
    assert.equal(ranks.c.rank, 3);
  });

  test("empty input yields no ranks and zero players", () => {
    const { ranks, totalPlayers } = computeSeasonRankings([]);
    assert.deepEqual(ranks, {});
    assert.equal(totalPlayers, 0);
  });

  test("matches the old scan: rank = index of first equal score + 1", () => {
    const entries = [
      { uid: "x", totalScore: 12 },
      { uid: "y", totalScore: 100 },
      { uid: "z", totalScore: 100 },
      { uid: "w", totalScore: 0 },
    ];
    const { ranks } = computeSeasonRankings(entries);
    // Reference implementation (the previous inline logic).
    const sorted = entries.map((e) => e.totalScore).sort((a, b) => b - a);
    for (const e of entries) {
      const expected = sorted.findIndex((s) => s === e.totalScore) + 1;
      assert.equal(ranks[e.uid].rank, expected);
    }
  });
});
