// Tests for the shared game-day date math (helpers/gameDay.js) — the
// "yesterday in Eastern time with a 2 AM game-day reset" calculation used by
// both nightly processors and the admin manual trigger. The clock is
// injectable, so DST transitions and the 2 AM boundary can be pinned exactly.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { getCompletedGameDayET, getCompletedCalendarDay } = require("./gameDay");

// Season start dates are stored at UTC midnight (see getNextOffSeasonWindow).
const utcMidnight = (iso) => new Date(`${iso}T00:00:00Z`);

describe("getCompletedGameDayET", () => {
  test("returns a UTC-midnight date", () => {
    const day = getCompletedGameDayET(new Date("2026-07-05T06:00:00Z"));
    assert.equal(day.getUTCHours(), 0);
    assert.equal(day.getUTCMinutes(), 0);
    assert.equal(day.getUTCSeconds(), 0);
  });

  test("at 2 AM EDT the just-ended game day is yesterday", () => {
    // 2026-07-05T06:00Z = 2:00 AM EDT July 5 → game day July 4
    const day = getCompletedGameDayET(new Date("2026-07-05T06:00:00Z"));
    assert.equal(day.toISOString().slice(0, 10), "2026-07-04");
  });

  test("before the 2 AM reset the previous game day has not ended yet", () => {
    // 1:30 AM EDT July 5 is still July 4's game day, so the *completed* game
    // day is July 3.
    const day = getCompletedGameDayET(new Date("2026-07-05T05:30:00Z"));
    assert.equal(day.toISOString().slice(0, 10), "2026-07-03");
  });

  test("handles Eastern midnight (ICU hour-24 edge)", () => {
    // 2026-07-05T04:00Z = 00:00 EDT July 5 → still July 4's game day →
    // completed game day July 3.
    const day = getCompletedGameDayET(new Date("2026-07-05T04:00:00Z"));
    assert.equal(day.toISOString().slice(0, 10), "2026-07-03");
  });

  test("uses EST offset in winter", () => {
    // 2026-01-10T07:00Z = 2:00 AM EST Jan 10 → game day Jan 9
    const day = getCompletedGameDayET(new Date("2026-01-10T07:00:00Z"));
    assert.equal(day.toISOString().slice(0, 10), "2026-01-09");
  });

  test("handles the spring-forward DST transition", () => {
    // DST starts 2026-03-08: 2 AM EST jumps to 3 AM EDT, so the scheduler
    // fires at 07:00Z = 3:00 AM EDT. The just-ended game day is March 7.
    const day = getCompletedGameDayET(new Date("2026-03-08T07:00:00Z"));
    assert.equal(day.toISOString().slice(0, 10), "2026-03-07");
  });
});

describe("getCompletedCalendarDay", () => {
  test("first scoring run after day 1 yields calendar day 1", () => {
    // Season starts July 1; 2 AM EDT on July 2 scores day 1.
    const day = getCompletedCalendarDay(utcMidnight("2026-07-01"), new Date("2026-07-02T06:00:00Z"));
    assert.equal(day, 1);
  });

  test("counts days from the season start", () => {
    const day = getCompletedCalendarDay(utcMidnight("2026-07-01"), new Date("2026-07-05T06:00:00Z"));
    assert.equal(day, 4);
  });

  test("returns 0 before any game day has completed", () => {
    // 2 AM EDT on the start date itself: no game day has ended yet.
    const day = getCompletedCalendarDay(utcMidnight("2026-07-01"), new Date("2026-07-01T06:00:00Z"));
    assert.equal(day, 0);
  });

  test("does not shift a winter UTC-midnight start date (Semifinals/Finals regression)", () => {
    // A UTC-midnight start read via the ET calendar would land on the
    // previous evening (EST = UTC-5), inflating the day by one — the bug that
    // once labeled Semifinals (day 48) as Finals (day 49).
    const day = getCompletedCalendarDay(utcMidnight("2026-01-01"), new Date("2026-02-18T07:00:00Z"));
    assert.equal(day, 48);
  });

  test("day count is stable across the spring-forward transition", () => {
    // Start March 1; run at 3 AM EDT on March 8 (post-transition) → day 7.
    const day = getCompletedCalendarDay(utcMidnight("2026-03-01"), new Date("2026-03-08T07:00:00Z"));
    assert.equal(day, 7);
  });
});

describe("getCurrentSeasonWeek", () => {
  const { getCurrentSeasonWeek } = require("./gameDay");
  const season = (startIso, springTrainingDays) => ({
    schedule: {
      startDate: new Date(startIso),
      ...(springTrainingDays ? { springTrainingDays } : {}),
    },
  });

  test("off-season: day 1 is week 1, day 8 is week 2", () => {
    assert.equal(
      getCurrentSeasonWeek(season("2026-07-01T00:00:00Z"), new Date("2026-07-01T12:00:00Z")),
      1
    );
    assert.equal(
      getCurrentSeasonWeek(season("2026-07-01T00:00:00Z"), new Date("2026-07-08T12:00:00Z")),
      2
    );
  });

  test("live season: spring training days shift competition week 1", () => {
    // 21 days of spring training — 25 days in is competition day 4 → week 1
    assert.equal(
      getCurrentSeasonWeek(season("2026-06-01T00:00:00Z", 21), new Date("2026-06-25T12:00:00Z")),
      1
    );
  });

  test("clamps to week 1 during spring training and returns null without a start date", () => {
    assert.equal(
      getCurrentSeasonWeek(season("2026-06-01T00:00:00Z", 21), new Date("2026-06-05T12:00:00Z")),
      1
    );
    assert.equal(getCurrentSeasonWeek({}), null);
    assert.equal(getCurrentSeasonWeek(null), null);
  });

  test("accepts Firestore Timestamp-like start dates", () => {
    const ts = { toDate: () => new Date("2026-07-01T00:00:00Z") };
    assert.equal(
      getCurrentSeasonWeek({ schedule: { startDate: ts } }, new Date("2026-07-16T12:00:00Z")),
      3
    );
  });
});
