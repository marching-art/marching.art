// Tests for the evening streak-at-risk nudge: who gets it (alive streak,
// unclaimed today, no live freeze) and what it says. node:test.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { isStreakAtRisk, buildStreakAtRiskPushes, STREAK_PANEL_URL } = require("./streakReminders");
const { getGameDay } = require("./dailyChallenges");

const DAY_MS = 24 * 60 * 60 * 1000;
// 7 PM ET on a summer evening (23:00Z) — when the job runs.
const NOW = new Date("2026-07-20T23:00:00Z");
const yesterdayEvening = new Date(NOW.getTime() - DAY_MS);
const twoDaysAgo = new Date(NOW.getTime() - 2 * DAY_MS);
const thisMorning = new Date("2026-07-20T14:00:00Z"); // 10 AM ET, same game day

const profile = (streak, lastLogin, extra = {}) => ({
  uid: `u${streak}`,
  engagement: { loginStreak: streak, lastLogin, ...extra },
});

describe("isStreakAtRisk", () => {
  test("alive streak, claimed yesterday, not today → at risk", () => {
    assert.equal(getGameDay(yesterdayEvening) !== getGameDay(NOW), true, "fixture sanity");
    assert.equal(isStreakAtRisk(profile(12, yesterdayEvening), NOW), true);
  });

  test("already claimed today → not at risk", () => {
    assert.equal(isStreakAtRisk(profile(12, thisMorning), NOW), false);
  });

  test("last claim two days ago → streak already broken, not at risk", () => {
    assert.equal(isStreakAtRisk(profile(12, twoDaysAgo), NOW), false);
  });

  test("short streaks are not worth the interruption", () => {
    assert.equal(isStreakAtRisk(profile(2, yesterdayEvening), NOW), false);
    assert.equal(isStreakAtRisk(profile(3, yesterdayEvening), NOW), true);
  });

  test("a live freeze already protects tonight → not at risk", () => {
    const freezeUntil = new Date(NOW.getTime() + 6 * 60 * 60 * 1000);
    assert.equal(isStreakAtRisk(profile(12, yesterdayEvening, { streakFreezeUntil: freezeUntil }), NOW), false);
    const expired = new Date(NOW.getTime() - 60 * 60 * 1000);
    assert.equal(isStreakAtRisk(profile(12, yesterdayEvening, { streakFreezeUntil: expired }), NOW), true);
  });

  test("tolerates Timestamp-like and string lastLogin, and missing fields", () => {
    const ts = { toDate: () => yesterdayEvening };
    assert.equal(isStreakAtRisk(profile(5, ts), NOW), true);
    assert.equal(isStreakAtRisk(profile(5, yesterdayEvening.toISOString()), NOW), true);
    assert.equal(isStreakAtRisk({ uid: "x" }, NOW), false);
    assert.equal(isStreakAtRisk(profile(5, "garbage"), NOW), false);
  });
});

describe("buildStreakAtRiskPushes", () => {
  test("one push per at-risk director, deep-linked to the streak panel, deduped per day", () => {
    const pushes = buildStreakAtRiskPushes(
      [profile(12, yesterdayEvening), profile(4, thisMorning), profile(30, yesterdayEvening), { engagement: {} }],
      NOW
    );
    assert.deepEqual(
      pushes.map((p) => p.uid),
      ["u12", "u30"]
    );
    assert.equal(pushes[0].title, "Your 12-day streak ends tonight");
    assert.match(pushes[0].body, /Streak Freeze/);
    assert.doesNotMatch(pushes[0].body, /\d+ ?CC/, "no price in the copy");
    assert.equal(pushes[0].url, STREAK_PANEL_URL);
    assert.equal(pushes[0].dedupeKey, pushes[1].dedupeKey);
    assert.match(pushes[0].dedupeKey, /^streak_at_risk_/);
  });
});
