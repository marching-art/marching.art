// Tests for the recap-derived season participation index.
//
// The three regressions these pin down, all found by the championship-week
// rehearsal (functions/rehearsal):
//
//  1. Participation counted WEEKS a director had picks saved for, not shows
//     competed in. Selecting shows requires no lineup while scoring requires a
//     complete one, so a corps that never appeared in a recap could still be
//     paid the season finish bonus and credited a season.
//  2. `showsAttended` was that same week count, and fed lifetimeStats.totalShows.
//  3. `highestWeeklyScore` read `corps.weeklyScores`, which nothing writes — so
//     every archived season recorded a best week of zero.

process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  buildParticipationIndex,
  corpsSeason,
  participationKey,
} = require("./seasonParticipation");

/** A recap day document, shaped as helpers/scoring.js writes it. */
const day = (offSeasonDay, shows) => ({
  id: String(offSeasonDay),
  exists: true,
  data: () => ({ offSeasonDay, shows }),
});

/** One show with its result rows. */
const show = (eventName, results) => ({ eventName, results });

/** One corps' row in a show result. */
const result = (uid, corpsClass, totalScore) => ({
  uid,
  corpsClass,
  totalScore,
  geScore: totalScore * 0.4,
  visualScore: totalScore * 0.3,
  musicScore: totalScore * 0.3,
});

describe("buildParticipationIndex", () => {
  test("counts every show a corps competed in, not the weeks it entered", () => {
    // Two shows in week 1, one in week 2: three shows across two weeks.
    const index = buildParticipationIndex([
      day(2, [show("Week 1 Regional", [result("u1", "worldClass", 70)])]),
      day(6, [show("Week 1 Classic", [result("u1", "worldClass", 72)])]),
      day(9, [show("Week 2 Regional", [result("u1", "worldClass", 75)])]),
    ]);

    const entry = index.get(participationKey("u1", "worldClass"));
    assert.equal(entry.shows, 3);
  });

  test("best week is the week's TOTAL, so two shows beat one bigger show", () => {
    const index = buildParticipationIndex([
      // Week 1: two shows summing 142.
      day(2, [show("A", [result("u1", "worldClass", 70)])]),
      day(6, [show("B", [result("u1", "worldClass", 72)])]),
      // Week 2: one bigger single show, but a smaller week.
      day(9, [show("C", [result("u1", "worldClass", 90)])]),
    ]);

    assert.equal(index.get(participationKey("u1", "worldClass")).bestWeek, 142);
  });

  test("keeps each corps class separate for a multi-class director", () => {
    const index = buildParticipationIndex([
      day(2, [
        show("A", [result("u1", "worldClass", 70), result("u1", "openClass", 60)]),
      ]),
    ]);

    assert.equal(index.get(participationKey("u1", "worldClass")).shows, 1);
    assert.equal(index.get(participationKey("u1", "worldClass")).bestWeek, 70);
    assert.equal(index.get(participationKey("u1", "openClass")).bestWeek, 60);
  });

  test("a corps that never appears in a recap is absent from the index", () => {
    const index = buildParticipationIndex([
      day(2, [show("A", [result("u1", "worldClass", 70)])]),
    ]);

    assert.equal(index.get(participationKey("ghost", "worldClass")), undefined);
  });

  test("ignores missing and unreadable day documents", () => {
    const index = buildParticipationIndex([
      null,
      { id: "3", exists: false, data: () => ({}) },
      { id: "not-a-day", exists: true, data: () => ({ shows: [] }) },
      day(2, [show("A", [result("u1", "worldClass", 70)])]),
    ]);

    assert.equal(index.get(participationKey("u1", "worldClass")).shows, 1);
  });

  test("falls back to the document id when the recap omits its day number", () => {
    const index = buildParticipationIndex([
      { id: "5", exists: true, data: () => ({ shows: [show("A", [result("u1", "worldClass", 70)])] }) },
    ]);

    assert.equal(index.get(participationKey("u1", "worldClass")).shows, 1);
  });

  test("covers all seven weeks, including championship week", () => {
    // Day 49 is Finals — the last day of week 7, and the one a fold that
    // stopped at week 6 would silently drop.
    const index = buildParticipationIndex([
      day(49, [show("Finals", [result("u1", "worldClass", 98)])]),
    ]);

    assert.equal(index.get(participationKey("u1", "worldClass")).shows, 1);
    assert.equal(index.get(participationKey("u1", "worldClass")).bestWeek, 98);
  });
});

describe("corpsSeason", () => {
  const index = buildParticipationIndex([
    day(2, [show("A", [result("competed", "worldClass", 70)])]),
  ]);

  test("a corps in the recaps participated", () => {
    const season = corpsSeason(index, "competed", "worldClass", { totalSeasonScore: 70 });
    assert.equal(season.participated, true);
    assert.equal(season.shows, 1);
    assert.equal(season.bestWeek, 70);
  });

  test("picking shows without ever competing is NOT participation", () => {
    // The regression: this corps has picks for all seven weeks and an
    // incomplete lineup, so it was never scored and never appears in a recap.
    const season = corpsSeason(index, "never-scored", "worldClass", {
      selectedShows: { week1: [{}], week2: [{}], week3: [{}], week4: [{}], week5: [{}], week6: [{}], week7: [{}] },
      totalSeasonScore: 0,
    });

    assert.equal(season.participated, false);
    assert.equal(season.shows, 0);
    assert.equal(season.bestWeek, 0);
  });

  test("a score with no recaps still counts, so a lost recap cannot un-finish a season", () => {
    const season = corpsSeason(new Map(), "competed", "worldClass", { totalSeasonScore: 88 });
    assert.equal(season.participated, true);
    assert.equal(season.shows, 0);
  });

  test("no recaps and no score is not participation", () => {
    const season = corpsSeason(new Map(), "idle", "worldClass", {});
    assert.equal(season.participated, false);
  });
});
