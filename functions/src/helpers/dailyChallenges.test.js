// Tests for the daily-challenge catalog and rotation. The fixed-date
// expectations here are PINNED to the same values as the client mirror's
// tests (src/utils/dailyChallenges.test.js) — if either side changes the
// pool or the hash, both test files must be updated together.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  CHALLENGE_POOL,
  CHALLENGES_PER_DAY,
  getGameDay,
  getChallengesForGameDay,
  pruneOldChallenges,
} = require("./dailyChallenges");

describe("getGameDay", () => {
  test("uses the ET calendar date after 2 AM ET", () => {
    // 3 AM ET on July 4 = 07:00 UTC (EDT)
    assert.equal(getGameDay(new Date("2026-07-04T07:00:00Z")), "Sat Jul 04 2026");
  });

  test("stays on the previous game day before 2 AM ET", () => {
    // 1 AM ET on July 4 = 05:00 UTC (EDT)
    assert.equal(getGameDay(new Date("2026-07-04T05:00:00Z")), "Fri Jul 03 2026");
  });

  test("handles the EST (winter) offset", () => {
    // 1:30 AM ET Jan 10 = 06:30 UTC (EST) — still Jan 9's game day
    assert.equal(getGameDay(new Date("2026-01-10T06:30:00Z")), "Fri Jan 09 2026");
  });
});

describe("getChallengesForGameDay", () => {
  test("returns three distinct challenges from the pool", () => {
    const picks = getChallengesForGameDay("Sat Jul 04 2026");
    assert.equal(picks.length, CHALLENGES_PER_DAY);
    assert.equal(new Set(picks.map((c) => c.id)).size, CHALLENGES_PER_DAY);
    for (const pick of picks) {
      assert.ok(CHALLENGE_POOL.some((c) => c.id === pick.id));
    }
  });

  test("is deterministic for the same day", () => {
    assert.deepEqual(
      getChallengesForGameDay("Sat Jul 04 2026"),
      getChallengesForGameDay("Sat Jul 04 2026")
    );
  });

  test("rotates across days", () => {
    const days = ["Sat Jul 04 2026", "Sun Jul 05 2026", "Mon Jul 06 2026", "Tue Jul 07 2026"];
    const signatures = days.map((d) =>
      getChallengesForGameDay(d)
        .map((c) => c.id)
        .join(",")
    );
    // At least two different line-ups across four days
    assert.ok(new Set(signatures).size >= 2, `no rotation: ${signatures.join(" | ")}`);
  });

  test("pinned rotation matches the client mirror (sync check)", () => {
    // Same expectation exists in src/utils/dailyChallenges.test.js
    assert.deepEqual(getChallengesForGameDay("Wed Jan 14 2026").map((c) => c.id), [
      "visit-guide",
      "read-news",
      "visit-schedule",
    ]);
  });
});

describe("pruneOldChallenges", () => {
  test("keeps the most recent 30 day-buckets", () => {
    const challenges = {};
    for (let i = 0; i < 40; i++) {
      const d = new Date(Date.UTC(2026, 0, 1 + i));
      challenges[d.toDateString()] = [{ id: "x", completed: true }];
    }
    const pruned = pruneOldChallenges(challenges);
    const keys = Object.keys(pruned);
    assert.equal(keys.length, 30);
    // Oldest 10 dropped
    assert.ok(!keys.includes(new Date(Date.UTC(2026, 0, 1)).toDateString()));
    assert.ok(keys.includes(new Date(Date.UTC(2026, 0, 40)).toDateString()));
  });

  test("leaves small maps untouched", () => {
    const challenges = { "Wed Jan 14 2026": [] };
    assert.equal(pruneOldChallenges(challenges), challenges);
  });
});
