// Tests for the per-show resolution the Podium processor uses to bucket each
// corps into its chosen show (design: Podium registers/scores per show).
// The full processPodiumDay is covered by the emulator suite; these pin the
// pure show-resolution logic. Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { resolveCorpsShow } = require("./processor");
const store = require("./store");

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
    // Fantasy-aligned finals week: A/Open Prelims day 45, Finals day 46;
    // World Prelims/Semifinals/Finals days 47/48/49.
    assert.equal(resolveCorpsShow({}, 45, "aClass", dayShows).eventName, "A Class Prelims");
    assert.equal(resolveCorpsShow({}, 46, "openClass", dayShows).eventName, "Open Class Finals");
    assert.equal(resolveCorpsShow({}, 47, "worldClass", dayShows).eventName, "World Class Prelims");
    assert.equal(resolveCorpsShow({}, 49, "worldClass", dayShows).eventName, "World Class Finals");
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

describe("championship advancement (store.advancingUids)", () => {
  const cfg = { championship: { advancement: { aClassFinals: 4, openClassFinals: 8, worldSemifinals: 25, worldFinals: 12 } } };
  // A prior-round recap: N corps of a division, ranked by descending total.
  const recap = (division, count, base = 90) => ({
    shows: [
      {
        eventName: `${division} Prelims`,
        results: Array.from({ length: count }, (_, i) => ({
          uid: `${division}-${i}`,
          division,
          totalScore: base - i,
        })),
      },
    ],
  });

  test("non-advancement days apply no gating (null)", () => {
    assert.equal(store.advancingUids(recap("worldClass", 30), 47, cfg), null);
    assert.equal(store.advancingUids(recap("worldClass", 30), 44, cfg), null);
  });

  test("World semifinals advance the top 25 from prelims", () => {
    const set = store.advancingUids(recap("worldClass", 30), 48, cfg);
    assert.equal(set.size, 25);
    assert.ok(set.has("worldClass-0")); // 1st
    assert.ok(set.has("worldClass-24")); // 25th
    assert.ok(!set.has("worldClass-25")); // 26th cut
  });

  test("World finals advance the top 12 from semifinals", () => {
    const set = store.advancingUids(recap("worldClass", 20), 49, cfg);
    assert.equal(set.size, 12);
    assert.ok(set.has("worldClass-11"));
    assert.ok(!set.has("worldClass-12"));
  });

  test("day 46 finals advance top 4 A and top 8 Open from their prelims", () => {
    const priorRecap = {
      shows: [
        recap("aClass", 10).shows[0],
        recap("openClass", 12).shows[0],
      ],
    };
    const set = store.advancingUids(priorRecap, 46, cfg);
    assert.equal(set.size, 12); // 4 A + 8 Open
    assert.ok(set.has("aClass-3") && !set.has("aClass-4"));
    assert.ok(set.has("openClass-7") && !set.has("openClass-8"));
  });

  test("ties at the cut line are inclusive", () => {
    const priorRecap = {
      shows: [
        {
          eventName: "A Class Prelims",
          results: [
            { uid: "a", division: "aClass", totalScore: 90 },
            { uid: "b", division: "aClass", totalScore: 88 },
            { uid: "c", division: "aClass", totalScore: 80 },
            { uid: "d", division: "aClass", totalScore: 80 },
            { uid: "e", division: "aClass", totalScore: 80 }, // tied at the 4th slot
            { uid: "f", division: "aClass", totalScore: 70 },
          ],
        },
      ],
    };
    const set = store.advancingUids(priorRecap, 46, cfg);
    assert.ok(["a", "b", "c", "d", "e"].every((u) => set.has(u)));
    assert.ok(!set.has("f"));
  });

  test("a missing/empty prior recap disables gating (whole field competes)", () => {
    assert.equal(store.advancingUids(null, 48, cfg), null);
    assert.equal(store.advancingUids({ shows: [] }, 48, cfg), null);
  });
});
