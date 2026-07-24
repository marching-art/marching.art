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

  // The 8 PM ET–2 AM ET window is where the old raw-UTC week diverged from
  // the ET game-day clock: the UTC date flips at 8 PM EDT, but the game day
  // (and therefore the week) must not roll until 2 AM ET. Season starts
  // Monday 2026-06-29, so day 7 (Sunday) is 2026-07-05.
  test("week does NOT roll at the 8 PM ET UTC-date flip", () => {
    // Sunday 11:59 PM EDT (2026-07-06T03:59Z) — the matchup generator's cron
    // instant. UTC is already Monday; the active game day is still Sunday
    // (day 7), so this is still week 1. The old UTC math said week 2 here.
    assert.equal(
      getCurrentSeasonWeek(season("2026-06-29T00:00:00Z"), new Date("2026-07-06T03:59:00Z")),
      1
    );
    // 1:59 AM EDT Monday: one minute before the game-day reset, still week 1.
    assert.equal(
      getCurrentSeasonWeek(season("2026-06-29T00:00:00Z"), new Date("2026-07-06T05:59:00Z")),
      1
    );
  });

  test("week rolls exactly at 2 AM ET, matching the game-day boundary", () => {
    // 2:00 AM EDT Monday (2026-07-06T06:00Z): day 8 begins → week 2. The
    // Monday 8 AM push job therefore reads the week the generator wrote for.
    assert.equal(
      getCurrentSeasonWeek(season("2026-06-29T00:00:00Z"), new Date("2026-07-06T06:00:00Z")),
      2
    );
  });

  test("week boundary survives the spring-forward DST transition", () => {
    // Season starts Monday 2026-03-02; DST starts Sunday 2026-03-08 (2 AM EST
    // jumps to 3 AM EDT). 3:00 AM EDT Sunday (07:00Z) is day 7 → still week 1.
    assert.equal(
      getCurrentSeasonWeek(season("2026-03-02T00:00:00Z"), new Date("2026-03-08T07:00:00Z")),
      1
    );
    // 1:59 AM EDT Monday Mar 9 (05:59Z): still week 1; 2:00 AM EDT (06:00Z)
    // rolls to week 2.
    assert.equal(
      getCurrentSeasonWeek(season("2026-03-02T00:00:00Z"), new Date("2026-03-09T05:59:00Z")),
      1
    );
    assert.equal(
      getCurrentSeasonWeek(season("2026-03-02T00:00:00Z"), new Date("2026-03-09T06:00:00Z")),
      2
    );
  });

  test("week boundary survives the fall-back DST transition", () => {
    // Season starts Monday 2026-10-26; DST ends Sunday 2026-11-01 (1-2 AM
    // repeats). 1:30 AM EST Monday Nov 2 (06:30Z) is still day 7's week;
    // 2:00 AM EST (07:00Z) rolls to week 2.
    assert.equal(
      getCurrentSeasonWeek(season("2026-10-26T00:00:00Z"), new Date("2026-11-02T06:30:00Z")),
      1
    );
    assert.equal(
      getCurrentSeasonWeek(season("2026-10-26T00:00:00Z"), new Date("2026-11-02T07:00:00Z")),
      2
    );
  });
});

describe("getActivePodiumCalendarDay", () => {
  const { getActivePodiumCalendarDay, getActiveCalendarDay } = require("./gameDay");
  // Season starts 2026-06-01 (UTC midnight); July 1 is calendar day 31.
  const start = utcMidnight("2026-06-01");

  test("flag off: identical to the legacy 2 AM active day", () => {
    for (const iso of [
      "2026-07-02T01:00:00Z", // 9 PM EDT Jul 1
      "2026-07-02T05:00:00Z", // 1 AM EDT Jul 2
      "2026-07-01T16:00:00Z", // noon EDT Jul 1
    ]) {
      const now = new Date(iso);
      assert.equal(
        getActivePodiumCalendarDay(start, false, now),
        getActiveCalendarDay(start, now),
        iso
      );
    }
  });

  test("flag on: before 9 PM ET the active day is today (processing hasn't run)", () => {
    // Noon EDT on Jul 1 -> day 31.
    assert.equal(getActivePodiumCalendarDay(start, true, new Date("2026-07-01T16:00:00Z")), 31);
    // 8:59 PM EDT Jul 1 -> still day 31.
    assert.equal(getActivePodiumCalendarDay(start, true, new Date("2026-07-02T00:59:00Z")), 31);
  });

  test("flag on: at/after the 9 PM ET processing the active day rolls to tomorrow", () => {
    // 9:00 PM EDT Jul 1 -> day 32 (tonight's stage processes day 31).
    assert.equal(getActivePodiumCalendarDay(start, true, new Date("2026-07-02T01:00:00Z")), 32);
    // 11:30 PM EDT Jul 1 -> day 32. The legacy boundary would still say 31 —
    // the exact off-by-one that let a late verb rebuild a processed day.
    assert.equal(getActivePodiumCalendarDay(start, true, new Date("2026-07-02T03:30:00Z")), 32);
    // 1:30 AM EDT Jul 2 -> still day 32 (legacy would say 31 until its 2 AM
    // boundary; the 9 PM roll stays consistent through the night).
    assert.equal(getActivePodiumCalendarDay(start, true, new Date("2026-07-02T05:30:00Z")), 32);
  });

  test("flag on: agrees with the drop planner's processed day + 1 at 9 PM", () => {
    const { showCalendarDay } = require("./dropPlanner");
    const nightly = new Date("2026-07-02T01:00:00Z"); // 9 PM EDT Jul 1
    // podiumNightly processes showCalendarDay (31); verbs then act on 32.
    assert.equal(showCalendarDay(start, nightly), 31);
    assert.equal(getActivePodiumCalendarDay(start, true, nightly), 32);
  });

  test("flag on: tracks EST in winter (9 PM boundary follows the ET wall clock)", () => {
    const winterStart = utcMidnight("2026-11-01");
    // 8:30 PM EST Nov 10 (01:30Z Nov 11) -> day 10.
    assert.equal(
      getActivePodiumCalendarDay(winterStart, true, new Date("2026-11-11T01:30:00Z")),
      10
    );
    // 9:30 PM EST Nov 10 (02:30Z Nov 11) -> day 11.
    assert.equal(
      getActivePodiumCalendarDay(winterStart, true, new Date("2026-11-11T02:30:00Z")),
      11
    );
  });
});
