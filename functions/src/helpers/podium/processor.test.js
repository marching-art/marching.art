// Tests for the per-show resolution the Podium processor uses to bucket each
// corps into its chosen show (design: Podium registers/scores per show).
// The full processPodiumDay is covered by the emulator suite; these pin the
// pure show-resolution logic. Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { resolveCorpsShow } = require("./processor");

describe("resolveCorpsShow", () => {
  const dayShows = [
    { eventName: "First Show of Day", location: "First City, ST" },
    { eventName: "Second Show", location: "Second City, ST" },
  ];

  test("a self-pick wins and carries its own location", () => {
    const state = { selectedShows: { 5: { eventName: "Second Show", location: "Second City, ST" } } };
    assert.deepEqual(resolveCorpsShow(state, 5, "aClass", dayShows), {
      eventName: "Second Show",
      location: "Second City, ST",
    });
  });

  test("a self-pick with no stored location falls back to the day's first show", () => {
    const state = { selectedShows: { 5: { eventName: "Second Show" } } };
    assert.deepEqual(resolveCorpsShow(state, 5, "aClass", dayShows), {
      eventName: "Second Show",
      location: "First City, ST",
    });
  });

  test("championship days resolve to the division-correct event", () => {
    assert.equal(resolveCorpsShow({}, 49, "worldClass", dayShows).eventName, "World Class Finals");
    assert.equal(resolveCorpsShow({}, 48, "openClass", dayShows).eventName, "Open Class Finals");
  });

  test("majors resolve to their branded event name", () => {
    assert.equal(
      resolveCorpsShow({}, 28, "aClass", dayShows).eventName,
      "marching.art Southwestern Championship"
    );
    assert.equal(resolveCorpsShow({}, 41, "aClass", dayShows).eventName, "marching.art Eastern Classic");
  });

  test("a plain day with no pick falls back to the first scheduled show", () => {
    assert.deepEqual(resolveCorpsShow({}, 3, "aClass", dayShows), {
      eventName: "First Show of Day",
      location: "First City, ST",
    });
  });

  test("an unscheduled day degrades to a Day-N label", () => {
    assert.deepEqual(resolveCorpsShow({}, 3, "aClass", []), { eventName: "Day 3", location: null });
  });
});
