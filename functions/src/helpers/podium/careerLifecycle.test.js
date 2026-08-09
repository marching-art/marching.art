// Retire / un-retire lineage helpers (§5.13): banking a corps off the roster and
// bringing it back with the dormancy of the seasons it sat out charged against
// it — never returning stronger than it left.
//
// Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const career = require("./career");

const cfg = {
  reputation: {
    max: 100,
    tierThresholds: { 1: 0, 2: 15, 3: 30, 4: 45, 5: 60, 6: 75, 7: 90 },
    dormancyDecayBySeason: [5, 9, 12],
    dormancyDecayFloorSeasons: 12,
  },
};

describe("bankLineage (retire)", () => {
  test("preserves the lineage but strips volatile fields and stamps the index", () => {
    const data = {
      reputation: 62,
      historicalPeak: 70,
      seasonsPlayed: 9,
      corpsName: "Rohn Regiment",
      division: "openClass",
      history: [{ seasonUid: "s8" }],
      retiredCareers: [{ corpsName: "Old One" }],
      pendingAssessment: { seasonUid: "s8" },
    };
    const banked = career.bankLineage(data, 12);
    assert.equal(banked.reputation, 62);
    assert.equal(banked.historicalPeak, 70);
    assert.equal(banked.corpsName, "Rohn Regiment");
    assert.equal(banked.retiredAtIndex, 12);
    assert.ok(banked.retiredAt);
    // Volatile / nested-lineage fields are not carried into the banked copy.
    assert.equal(banked.retiredCareers, undefined);
    assert.equal(banked.pendingAssessment, undefined);
  });
});

describe("restoreLineage (un-retire)", () => {
  test("charges dormancy for the seasons sat out; never returns stronger", () => {
    const banked = {
      reputation: 70,
      historicalPeak: 80,
      seasonsPlayed: 12,
      corpsName: "Cascade",
      division: "worldClass",
      retiredAtIndex: 5,
    };
    const { career: restored, missedSeasons, reputationBefore, reputationAfter } =
      career.restoreLineage(banked, 8, cfg);
    assert.equal(missedSeasons, 3);
    assert.equal(reputationBefore, 70);
    // 3 missed seasons decay 5 + 9 + 12 = 26 → 44.
    assert.equal(reputationAfter, 44);
    assert.ok(reputationAfter < reputationBefore, "never returns stronger");
    // Historical peak is preserved (heritage credit still targets it).
    assert.equal(restored.historicalPeak, 80);
    assert.equal(restored.reputation, 44);
    assert.equal(restored.retiredAtIndex, undefined);
  });

  test("an immediate un-retire (no seasons missed) restores intact", () => {
    const banked = { reputation: 55, historicalPeak: 55, retiredAtIndex: 7, corpsName: "Genesis" };
    const { missedSeasons, reputationAfter } = career.restoreLineage(banked, 7, cfg);
    assert.equal(missedSeasons, 0);
    assert.equal(reputationAfter, 55);
  });
});
