// Tests for Podium careers (Phase 5): season archival gains, dormancy decay
// (the return-weaker invariant at the career layer), heritage credit, and
// the never-performed edge case.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { initCareer, applySeasonResult, applyDormancy, finalsPercentile } = require("./career");
const balance = require("./balanceConfig.json");
const curves = require("./curveData.json");

/** A finished-season state posting `total` at day 49. */
const finishedState = (total, name = "Test Corps") => ({
  corpsName: name,
  lastTotal: total,
  lastScoredDay: 49,
  seasonRank: 1,
  seasonRankOf: 10,
});

describe("career season archival", () => {
  test("a strong finals gains reputation; history records the season", () => {
    const p95 = curves.totalBands[48].p95;
    const updated = applySeasonResult(
      initCareer(),
      { seasonUid: "s1", seasonIndex: 1, state: finishedState(p95) },
      balance
    );
    assert.ok(updated.reputation > 0, `reputation ${updated.reputation} should be > 0`);
    assert.equal(updated.seasonsPlayed, 1);
    assert.equal(updated.lastPlayedIndex, 1);
    assert.equal(updated.history.length, 1);
    assert.equal(updated.historicalPeak, updated.reputation);
  });

  test("a registered-but-never-performed season neither gains nor loses", () => {
    const career = { ...initCareer(), reputation: 40, historicalPeak: 40 };
    const updated = applySeasonResult(
      career,
      { seasonUid: "s2", seasonIndex: 2, state: { corpsName: "Ghost", lastTotal: null, lastScoredDay: null } },
      balance
    );
    assert.equal(updated.reputation, 40);
    assert.equal(updated.seasonsPlayed, 1);
  });

  test("heritage credit accelerates the re-climb below the old peak", () => {
    const p95 = curves.totalBands[48].p95;
    const fresh = applySeasonResult(
      initCareer(),
      { seasonUid: "a", seasonIndex: 1, state: finishedState(p95) },
      balance
    );
    const comeback = applySeasonResult(
      { ...initCareer(), reputation: 10, historicalPeak: 80 },
      { seasonUid: "b", seasonIndex: 5, state: finishedState(p95) },
      balance
    );
    const freshGain = fresh.reputation - 0;
    const comebackGain = comeback.reputation - 10;
    assert.ok(
      comebackGain > freshGain,
      `heritage gain ${comebackGain} should beat fresh gain ${freshGain}`
    );
  });
});

describe("career dormancy", () => {
  test("return is strictly weaker, and longer absences decay more", () => {
    const start = { ...initCareer(), reputation: 90, historicalPeak: 90 };
    const one = applyDormancy(start, 1, balance);
    const three = applyDormancy(start, 3, balance);
    const six = applyDormancy(start, 6, balance);
    assert.ok(one.reputation < 90);
    assert.ok(three.reputation < one.reputation);
    assert.ok(six.reputation < three.reputation);
    assert.ok(six.reputation >= 0);
  });

  test("zero missed seasons is a no-op", () => {
    const start = { ...initCareer(), reputation: 55 };
    assert.equal(applyDormancy(start, 0, balance).reputation, 55);
  });
});

describe("finalsPercentile", () => {
  test("null for unscored corps; in 0-100 for scored", () => {
    assert.equal(finalsPercentile({ lastTotal: null, lastScoredDay: null }), null);
    const pct = finalsPercentile({ lastTotal: 92, lastScoredDay: 49 });
    assert.ok(pct > 0 && pct <= 100);
  });
});
