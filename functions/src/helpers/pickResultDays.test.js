// Tests for collectResultDays — the per-pick "which days did this corps really
// compete" index that drives the two-tier highlight.
//
// Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { collectResultDays } = require("./pickResultDays");

const yearData = [
  { offSeasonDay: 5, scores: [{ corps: "Blue Devils", score: 70 }, { corps: "Bluecoats", score: 68 }] },
  { offSeasonDay: 12, scores: [{ corps: "Blue Devils", score: 80 }] },
  { offSeasonDay: 12, scores: [{ corps: "Bluecoats", score: 79 }] }, // BD absent this event
  { offSeasonDay: 20, scores: [{ corps: "blue   devils", score: 90 }] }, // name spacing variant
  { offSeasonDay: null, scores: [{ corps: "Blue Devils", score: 60 }] }, // pre-season, ignored
  { offSeasonDay: 30, scores: [{ corps: "Blue Devils", score: 0 }] }, // no real score, ignored
];

describe("collectResultDays", () => {
  test("returns the sorted, de-duped days a corps had a real (>0) result", () => {
    assert.deepEqual(collectResultDays(yearData, "Blue Devils"), [5, 12, 20]);
  });

  test("matches case/space-insensitively", () => {
    assert.deepEqual(collectResultDays(yearData, "  BLUE DEVILS "), [5, 12, 20]);
  });

  test("only counts days the corps actually competed", () => {
    assert.deepEqual(collectResultDays(yearData, "Bluecoats"), [5, 12]);
  });

  test("returns [] for an unknown corps (name-map gap signal)", () => {
    assert.deepEqual(collectResultDays(yearData, "Phantom Regiment"), []);
    assert.deepEqual(collectResultDays([], "Blue Devils"), []);
  });
});
