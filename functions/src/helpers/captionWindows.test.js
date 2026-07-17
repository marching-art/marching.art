const { test } = require("node:test");
const assert = require("node:assert");
const {
  getCaptionChangeWindow,
  isDayScoresProcessed,
} = require("./captionWindows");

// Season starting at UTC midnight, the shape the admin UI writes.
// Day boundaries land at 8:00 PM EDT: day 1 = June 21, day 14 ends
// 2026-07-05T00:00:00Z = Saturday July 4, 8:00 PM EDT.
const START = new Date("2026-06-21T00:00:00Z");
const season = (springTrainingDays) => ({
  status: "off-season",
  seasonUid: "test-season",
  schedule: {
    startDate: { toDate: () => START },
    ...(springTrainingDays ? { springTrainingDays } : {}),
  },
});

const at = (iso) => new Date(iso);
const win = (nowIso, springDays) => getCaptionChangeWindow(season(springDays), at(nowIso));
const winClass = (nowIso, corpsClass) =>
  getCaptionChangeWindow(season(), at(nowIso), corpsClass);

test("days 1-14 are unlimited, ending at the day-14 boundary (Sat 8 PM ET)", () => {
  const w = win("2026-06-23T12:00:00Z"); // day 3
  assert.equal(w.phase, "unlimited");
  assert.equal(w.status, "open");
  assert.equal(w.tradeLimit, Infinity);
  assert.equal(w.unlimitedEndsAt.toISOString(), "2026-07-05T00:00:00.000Z");
});

test("Saturday 8 PM ET locks changes even during the unlimited weeks", () => {
  // Day 8 begins 2026-06-28T00:00:00Z (Sat June 27, 8 PM EDT); 8:30 PM EDT:
  const w = win("2026-06-28T00:30:00Z");
  assert.equal(w.day, 8);
  assert.equal(w.status, "locked");
  // Off-season: reopens at the same-evening 9 PM ET score drop — a one-hour lock.
  assert.equal(w.reopensAt.toISOString(), "2026-06-28T01:00:00.000Z");
});

test("live season keeps the overnight 2 AM ET reopen", () => {
  const liveSeason = {
    ...season(),
    status: "live-season",
  };
  // Same Saturday-night instant, live-season status: still locked at 9 PM EDT
  // and not reopening until the 2 AM ET run.
  const w = getCaptionChangeWindow(liveSeason, at("2026-06-28T01:00:00Z"));
  assert.equal(w.day, 8);
  assert.equal(w.status, "locked");
  assert.equal(w.reopensAt.toISOString(), "2026-06-28T06:00:00.000Z");
});

test("reopens after the 9 PM ET drop with the previous day's scores pending", () => {
  const w = win("2026-06-28T01:30:00Z"); // 9:30 PM EDT Saturday, day 8
  assert.equal(w.status, "open");
  assert.equal(w.pendingScoresDay, 7);
});

test("days 15-42 allow 3 changes per week", () => {
  const w = win("2026-07-06T12:00:00Z"); // day 16
  assert.equal(w.phase, "weekly");
  assert.equal(w.status, "open");
  assert.equal(w.tradeLimit, 3);
  assert.equal(w.week, 3);
  // Next Saturday close: end of day 21 = start + 21d
  assert.equal(w.locksAt.toISOString(), "2026-07-12T00:00:00.000Z");
});

test("week-start days are locked until the 9 PM ET drop (off-season)", () => {
  // Day 22 begins 2026-07-12T00:00:00Z (Sat 8 PM EDT); 8:30 PM EDT:
  const w = win("2026-07-12T00:30:00Z");
  assert.equal(w.day, 22);
  assert.equal(w.status, "locked");
  assert.equal(w.reopensAt.toISOString(), "2026-07-12T01:00:00.000Z");
});

test("days 43-44 are fully closed", () => {
  const w = win("2026-08-02T12:00:00Z"); // day 43
  assert.equal(w.phase, "blackout");
  assert.equal(w.status, "closed");
  assert.equal(w.tradeLimit, 0);
  // Championship changes open after day 45 begins + the 9 PM ET drop
  assert.equal(w.reopensAt.toISOString(), "2026-08-04T01:00:00.000Z");
});

test("championship days give 2 changes per day and lock nightly at the 8 PM ET boundary", () => {
  // Day 45 begins 2026-08-04T00:00:00Z (Mon 8 PM EDT). Before the 9 PM ET
  // drop: locked.
  const lockedW = win("2026-08-04T00:30:00Z");
  assert.equal(lockedW.phase, "championship");
  assert.equal(lockedW.status, "locked");
  assert.equal(lockedW.reopensAt.toISOString(), "2026-08-04T01:00:00.000Z");

  // Tuesday afternoon: open, 2-change limit, closes at the next day boundary.
  // periodKey is the competition day, so the allotment resets each day.
  const openW = win("2026-08-04T18:00:00Z");
  assert.equal(openW.status, "open");
  assert.equal(openW.tradeLimit, 2);
  assert.equal(openW.week, 7);
  assert.equal(openW.periodKey, 45);
  assert.equal(openW.locksAt.toISOString(), "2026-08-05T00:00:00.000Z");
  assert.equal(openW.pendingScoresDay, 44);

  // Next day (46) keys on a new period, so the 2-change limit is fresh.
  assert.equal(win("2026-08-05T18:00:00Z").periodKey, 46);
});

test("championship per-day bracket gates which classes may change", () => {
  // Days 45-46: only Open Class and A Class compete.
  const day45Open = winClass("2026-08-04T18:00:00Z", "openClass");
  assert.equal(day45Open.status, "open");
  assert.equal(day45Open.tradeLimit, 2);
  const day45World = winClass("2026-08-04T18:00:00Z", "worldClass");
  assert.equal(day45World.status, "closed");
  assert.equal(day45World.tradeLimit, 0);
  assert.equal(winClass("2026-08-04T18:00:00Z", "soundSport").status, "closed");

  // Day 47: all classes compete.
  assert.equal(winClass("2026-08-06T18:00:00Z", "worldClass").status, "open");
  assert.equal(winClass("2026-08-06T18:00:00Z", "openClass").status, "open");
  assert.equal(winClass("2026-08-06T18:00:00Z", "soundSport").status, "open");

  // Days 48-49 (Finals): only World Class and SoundSport compete.
  assert.equal(winClass("2026-08-07T18:00:00Z", "worldClass").status, "open");
  assert.equal(winClass("2026-08-07T18:00:00Z", "soundSport").status, "open");
  assert.equal(winClass("2026-08-07T18:00:00Z", "openClass").status, "closed");
  assert.equal(winClass("2026-08-08T18:00:00Z", "aClass").status, "closed");
  assert.equal(winClass("2026-08-08T18:00:00Z", "worldClass").status, "open");

  // Class-agnostic call (no corpsClass) reports the general open window.
  assert.equal(win("2026-08-07T18:00:00Z").status, "open");
});

test("after day 49 the season is complete and changes are closed", () => {
  const w = win("2026-08-09T12:00:00Z"); // day 50
  assert.equal(w.phase, "complete");
  assert.equal(w.status, "closed");
  assert.equal(w.tradeLimit, 0);
});

test("spring-training days shift competition day 1 (live seasons)", () => {
  // 21 spring-training days: 10 calendar days in is still pre-competition
  const w = win("2026-07-01T00:00:00Z", 21);
  assert.equal(w.phase, "unlimited");
  assert.equal(w.status, "open");
  // Unlimited ends at start + (21 + 14) days
  assert.equal(w.unlimitedEndsAt.toISOString(), "2026-07-26T00:00:00.000Z");
});

test("returns null without a start date", () => {
  assert.equal(getCaptionChangeWindow({ schedule: {} }, new Date()), null);
  assert.equal(getCaptionChangeWindow(null, new Date()), null);
});

test("isDayScoresProcessed passes when the recap exists", async () => {
  const db = {
    doc: (path) => ({
      get: async () => ({
        exists: path.startsWith("fantasy_recaps/"),
        data: () => ({}),
      }),
    }),
  };
  assert.equal(await isDayScoresProcessed(db, { seasonUid: "s1" }, 14), true);
});

test("isDayScoresProcessed blocks when the day had events but no recap yet", async () => {
  const db = {
    doc: (path) => ({
      get: async () => {
        if (path.startsWith("fantasy_recaps/")) return { exists: false };
        return {
          exists: true,
          data: () => ({ competitions: [{ day: 14, name: "Show" }] }),
        };
      },
    }),
  };
  assert.equal(await isDayScoresProcessed(db, { seasonUid: "s1" }, 14), false);
  // A day with no events reopens at 2 AM ET without waiting on a recap.
  assert.equal(await isDayScoresProcessed(db, { seasonUid: "s1" }, 13), true);
});
