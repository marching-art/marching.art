// Tests for the per-show resolution the Podium processor uses to bucket each
// corps into its chosen show (design: Podium registers/scores per show).
// The full processPodiumDay is covered by the emulator suite; these pin the
// pure show-resolution logic. Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { resolveCorpsShow, planForDay } = require("./processor");
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

  test("championship days resolve to the shared fantasy-bracket event", () => {
    // One event per championship day, shared across divisions (the parallel
    // fantasy bracket): Open/A Prelims (45), Open/A Finals (46), then World
    // Prelims/Semifinals/Finals (47/48/49) for everyone who advances.
    assert.equal(resolveCorpsShow({}, 45, "aClass", dayShows).eventName, "Open and A Class Prelims");
    assert.equal(resolveCorpsShow({}, 46, "openClass", dayShows).eventName, "Open and A Class Finals");
    assert.equal(
      resolveCorpsShow({}, 47, "aClass", dayShows).eventName,
      "marching.art World Championship Prelims"
    );
    assert.equal(
      resolveCorpsShow({}, 48, "openClass", dayShows).eventName,
      "marching.art World Championship Semifinals"
    );
    assert.equal(
      resolveCorpsShow({}, 49, "worldClass", dayShows).eventName,
      "marching.art World Championship Finals"
    );
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

describe("planForDay (assistant-director plan by day type)", () => {
  const rehearsal = ["fullEnsemble", "brassSectionals"];
  const show = ["warmup", "fullEnsemble"];
  const spring = ["visualBasics", "brassSectionals", "percussionSectionals"];

  test("a rehearsal day runs the rehearsal plan", () => {
    const state = { planTemplate: rehearsal, showDayPlan: show, springTrainingPlan: spring };
    assert.deepEqual(planForDay(state, { isShowDay: false, isSpringTraining: false }), rehearsal);
  });

  test("a show day runs the show-day plan when one is set", () => {
    const state = { planTemplate: rehearsal, showDayPlan: show, springTrainingPlan: spring };
    assert.deepEqual(planForDay(state, { isShowDay: true, isSpringTraining: false }), show);
  });

  test("a spring-training day runs the spring plan, and takes precedence over show", () => {
    const state = { planTemplate: rehearsal, showDayPlan: show, springTrainingPlan: spring };
    assert.deepEqual(planForDay(state, { isShowDay: true, isSpringTraining: true }), spring);
  });

  test("show/spring days fall back to the rehearsal plan when their own is unset", () => {
    const state = { planTemplate: rehearsal };
    assert.deepEqual(planForDay(state, { isShowDay: true, isSpringTraining: false }), rehearsal);
    assert.deepEqual(planForDay(state, { isShowDay: false, isSpringTraining: true }), rehearsal);
  });

  test("an empty day-type plan falls back rather than autoplaying nothing", () => {
    const state = { planTemplate: rehearsal, showDayPlan: [] };
    assert.deepEqual(planForDay(state, { isShowDay: true, isSpringTraining: false }), rehearsal);
  });

  test("no plans at all yields an empty list (the day stays lost)", () => {
    assert.deepEqual(planForDay({}, { isShowDay: false, isSpringTraining: false }), []);
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

  // The World rounds (days 48/49) draw from the day-47 Prelims where EVERY
  // division marches — so the cut is over the whole combined field.
  const combinedPrelims = (counts) => ({
    shows: [
      {
        eventName: "marching.art World Championship Prelims",
        results: Object.entries(counts).flatMap(([division, count]) =>
          Array.from({ length: count }, (_, i) => ({
            uid: `${division}-${i}`,
            division,
            // interleave divisions so the top of the combined field is mixed
            totalScore: 90 - i - { worldClass: 0, openClass: 0.3, aClass: 0.6 }[division],
          }))
        ),
      },
    ],
  });

  test("non-advancement days apply no gating (null)", () => {
    assert.equal(store.advancingUids(recap("worldClass", 30), 47, cfg), null);
    assert.equal(store.advancingUids(recap("worldClass", 30), 44, cfg), null);
  });

  test("World semifinals advance the top 25 of the whole combined field", () => {
    const set = store.advancingUids(
      combinedPrelims({ worldClass: 15, openClass: 15, aClass: 15 }),
      48,
      cfg
    );
    assert.equal(set.size, 25); // top 25 across all three divisions
    assert.ok(set.has("worldClass-0")); // overall leader
    assert.ok(!set.has("aClass-14")); // tail of the field is cut
  });

  test("World finals advance the top 12 of the whole combined field", () => {
    const set = store.advancingUids(
      combinedPrelims({ worldClass: 10, openClass: 8, aClass: 6 }),
      49,
      cfg
    );
    assert.equal(set.size, 12);
    assert.ok(set.has("worldClass-0"));
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
