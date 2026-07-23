// Tests for the lineup-deadline reminders: when a lock counts as "tonight"
// (weekly Saturday closes, the end of the unlimited period, Championship
// Week daily closes), who still has changes to lose, and the push copy.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  getLineupLockContext,
  buildLineupLockPushes,
} = require("./lineupReminders");

const DAY_MS = 24 * 60 * 60 * 1000;
const SEASON_UID = "s26";

/**
 * A season whose competition day `day` is in progress, with `hoursLeft`
 * hours remaining until that day's boundary. startDate is UTC midnight
 * like the admin tool writes, so boundaries land at 8 PM EDT / 7 PM EST.
 */
function seasonAtDay(day, hoursLeft, extra = {}) {
  const now = new Date(Date.UTC(2026, 6, 20, 12, 0, 0)); // arbitrary fixed clock
  const dayEnds = new Date(now.getTime() + hoursLeft * 60 * 60 * 1000);
  const startDate = new Date(dayEnds.getTime() - day * DAY_MS);
  return {
    now,
    seasonData: {
      seasonUid: SEASON_UID,
      status: "off-season",
      schedule: { startDate: { toDate: () => startDate } },
      ...extra,
    },
  };
}

function corps(corpsName, weeklyTrades = null) {
  return { corpsName, lineup: { GE1: "A|2024" }, ...(weeklyTrades ? { weeklyTrades } : {}) };
}

describe("getLineupLockContext", () => {
  test("weekly lock night (day 21, 4h left): weekly context with the lock instant", () => {
    const { seasonData, now } = seasonAtDay(21, 4);
    const context = getLineupLockContext(seasonData, now);
    assert.equal(context.phase, "weekly");
    assert.equal(context.periodKey, 3);
    assert.equal(context.tradeLimit, 3);
    assert.equal(context.competingClasses, null);
    assert.equal(context.lockAt.getTime() - now.getTime(), 4 * 60 * 60 * 1000);
    assert.match(context.lockTimeLabel, /ET$/);
  });

  test("mid-week (day 18, lock 3+ days away): no reminder", () => {
    const { seasonData, now } = seasonAtDay(18, 4);
    assert.equal(getLineupLockContext(seasonData, now), null);
  });

  test("end of unlimited period (day 14): unlimited context", () => {
    const { seasonData, now } = seasonAtDay(14, 4);
    const context = getLineupLockContext(seasonData, now);
    assert.equal(context.phase, "unlimited");
  });

  test("day 7 overnight lock is deliberately skipped (changes still unlimited after)", () => {
    const { seasonData, now } = seasonAtDay(7, 4);
    assert.equal(getLineupLockContext(seasonData, now), null);
  });

  test("championship day: daily close with only that day's competing classes", () => {
    const { seasonData, now } = seasonAtDay(48, 4);
    const context = getLineupLockContext(seasonData, now);
    assert.equal(context.phase, "championship");
    assert.equal(context.periodKey, 48);
    assert.equal(context.tradeLimit, 2);
    assert.deepEqual(context.competingClasses, ["worldClass", "soundSport"]);
  });

  test("blackout day (43) and post-season: no reminder", () => {
    const d43 = seasonAtDay(43, 4);
    assert.equal(getLineupLockContext(d43.seasonData, d43.now), null);
    const d51 = seasonAtDay(51, 4);
    assert.equal(getLineupLockContext(d51.seasonData, d51.now), null);
  });

  test("live season offsets spring training", () => {
    // Competition day 21 = calendar day 42 with 21 spring-training days.
    const now = new Date(Date.UTC(2026, 6, 20, 12, 0, 0));
    const dayEnds = new Date(now.getTime() + 4 * 60 * 60 * 1000);
    const startDate = new Date(dayEnds.getTime() - 42 * DAY_MS);
    const seasonData = {
      seasonUid: SEASON_UID,
      status: "live-season",
      schedule: { startDate: { toDate: () => startDate }, springTrainingDays: 21 },
    };
    const context = getLineupLockContext(seasonData, now);
    assert.equal(context.phase, "weekly");
    assert.equal(context.periodKey, 3);
  });
});

describe("buildLineupLockPushes", () => {
  test("weekly: reminds only directors with changes left, with per-corps copy", () => {
    const { seasonData, now } = seasonAtDay(21, 4);
    const context = getLineupLockContext(seasonData, now);

    const profiles = [
      // 1 of 3 used this week -> 2 left.
      { uid: "u1", corps: { worldClass: corps("Aurora", { seasonUid: SEASON_UID, week: 3, used: 1 }) } },
      // All 3 used -> nothing to lose, no push.
      { uid: "u2", corps: { worldClass: corps("Iron", { seasonUid: SEASON_UID, week: 3, used: 3 }) } },
      // Counter from a previous week -> resets to 0 used.
      { uid: "u3", corps: { aClass: corps("Hawks", { seasonUid: SEASON_UID, week: 2, used: 3 }) } },
      // Changes left in two classes -> summary copy.
      { uid: "u4", corps: { worldClass: corps("North"), openClass: corps("North Cadets") } },
      // No corps -> no push.
      { uid: "u5", corps: {} },
    ];

    const pushes = buildLineupLockPushes(context, profiles, SEASON_UID);
    const byUid = new Map(pushes.map((p) => [p.uid, p]));

    assert.deepEqual([...byUid.keys()].sort(), ["u1", "u3", "u4"]);
    assert.match(byUid.get("u1").body, /Aurora has 2 caption changes left this week/);
    assert.match(byUid.get("u1").body, /lock tonight at .* ET/);
    assert.match(byUid.get("u3").body, /Hawks has 3 caption changes left/);
    assert.match(byUid.get("u4").body, /unspent caption changes in 2 classes this week/);
    assert.equal(byUid.get("u1").title, "Caption changes lock tonight ⏰");
    assert.equal(byUid.get("u1").url, "/dashboard");
  });

  test("unlimited: everyone with a corps is reminded the period ends", () => {
    const { seasonData, now } = seasonAtDay(14, 4);
    const context = getLineupLockContext(seasonData, now);
    const pushes = buildLineupLockPushes(
      context,
      [{ uid: "u1", corps: { worldClass: corps("Aurora") } }],
      SEASON_UID
    );
    assert.equal(pushes.length, 1);
    assert.match(pushes[0].body, /Unlimited caption changes end tonight/);
    assert.equal(pushes[0].title, "Last night of unlimited changes ⏰");
  });

  test("championship: non-competing classes are excluded", () => {
    const { seasonData, now } = seasonAtDay(48, 4); // worldClass + soundSport only
    const context = getLineupLockContext(seasonData, now);
    const pushes = buildLineupLockPushes(
      context,
      [
        { uid: "u1", corps: { aClass: corps("Hawks") } }, // done for the season
        { uid: "u2", corps: { worldClass: corps("Aurora") } },
      ],
      SEASON_UID
    );
    assert.equal(pushes.length, 1);
    assert.equal(pushes[0].uid, "u2");
    assert.match(pushes[0].body, /Finals week: Aurora has 2 caption changes left today/);
  });
});
