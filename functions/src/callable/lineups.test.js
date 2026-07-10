// Tests for the pure show-selection validator behind selectUserShows —
// weekly caps, the one-show-per-day rule, and the Phase 6.1 counts-as-one
// rule for multi-night events (the Eastern Classic appears on days 41 AND
// 42; selecting both entries would silently burn a weekly slot for a second
// registration scoring already treats as the same event).
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { validateShowSelection, getMaxShowsForWeek } = require("./lineups");

describe("getMaxShowsForWeek", () => {
  test("4 in regular weeks, 7 in the final week", () => {
    assert.equal(getMaxShowsForWeek(1), 4);
    assert.equal(getMaxShowsForWeek(6), 4);
    assert.equal(getMaxShowsForWeek(7), 7);
  });
});

describe("validateShowSelection", () => {
  test("accepts a normal week of distinct shows", () => {
    assert.doesNotThrow(() =>
      validateShowSelection(2, [
        { eventName: "Show A", day: 8 },
        { eventName: "Show B", day: 10 },
        { eventName: "Show C", day: 13 },
      ], 4)
    );
  });

  test("rejects a missing week, non-array shows, and over-cap selections", () => {
    assert.throws(() => validateShowSelection(0, [], 4), /week number/);
    assert.throws(() => validateShowSelection(2, null, 4), /week number/);
    assert.throws(
      () => validateShowSelection(2, [{}, {}, {}, {}, {}], 4),
      /maximum of 4/
    );
  });

  test("rejects two shows on the same day", () => {
    assert.throws(
      () =>
        validateShowSelection(2, [
          { eventName: "Show A", day: 9 },
          { eventName: "Show B", day: 9 },
        ], 4),
      /one show per day/
    );
  });

  test("multi-night events count as one: the same event on two days is rejected", () => {
    // The Eastern Classic is one event scheduled on both day 41 and day 42 —
    // the per-day check alone cannot catch a double-registration.
    assert.throws(
      () =>
        validateShowSelection(6, [
          { eventName: "marching.art Eastern Classic", day: 41 },
          { eventName: "marching.art Eastern Classic", day: 42 },
        ], 4),
      /count as one show/
    );
  });

  test("registering the Eastern Classic once alongside other shows is fine", () => {
    assert.doesNotThrow(() =>
      validateShowSelection(6, [
        { eventName: "marching.art Eastern Classic", day: 41 },
        { eventName: "Show B", day: 37 },
        { eventName: "Show C", day: 39 },
      ], 4)
    );
  });
});
