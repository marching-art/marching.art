// Tests for the daily-challenge catalog and rotation. The fixed-date
// expectations here are PINNED to the same values as the client mirror's
// tests (src/utils/dailyChallenges.test.js) — if either side changes the
// pool or the hash, both test files must be updated together.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  CHALLENGE_POOL,
  CHALLENGES_PER_DAY,
  WEEKLY_LOOP_BONUS,
  getGameDay,
  getWeekKey,
  advanceWeeklyLoop,
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

  test("off-season: a new game day opens at the 9 PM ET score drop", () => {
    // 9:30 PM EDT July 4 — the drop just ran, so the ACTIVE day is July 5.
    assert.equal(getGameDay(new Date("2026-07-05T01:30:00Z"), "off-season"), "Sun Jul 05 2026");
    // 8:30 PM EDT July 4 — still July 4's game day.
    assert.equal(getGameDay(new Date("2026-07-05T00:30:00Z"), "off-season"), "Sat Jul 04 2026");
    // The following morning still belongs to the day opened at 9 PM.
    assert.equal(getGameDay(new Date("2026-07-05T14:00:00Z"), "off-season"), "Sun Jul 05 2026");
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
      "check-lineup",
      "make-prediction",
      "register-show",
    ]);
  });

  test("every challenge is a verifiable decision", () => {
    for (const challenge of CHALLENGE_POOL) {
      assert.equal(
        typeof challenge.verify,
        "function",
        `${challenge.id} must be server-verifiable — 'visit page X' busywork is retired`
      );
    }
  });

  test("verify predicates read the profile state that proves the decision", () => {
    const gameDay = "Wed Jan 14 2026";
    const byId = Object.fromEntries(CHALLENGE_POOL.map((c) => [c.id, c]));

    assert.equal(byId["check-lineup"].verify({}, gameDay), false);
    assert.equal(
      byId["check-lineup"].verify({ corps: { aClass: { lineup: { GE1: "x" } } } }, gameDay),
      true
    );

    assert.equal(byId["make-prediction"].verify({}, gameDay), false);
    assert.equal(
      byId["make-prediction"].verify(
        { predictions: { [gameDay]: { picks: { podium: { pick: "Yes" } } } } },
        gameDay
      ),
      true
    );

    assert.equal(byId["register-show"].verify({}, gameDay), false);
    assert.equal(
      byId["register-show"].verify(
        { corps: { soundSport: { selectedShows: { 1: ["show-a"] } } } },
        gameDay
      ),
      true
    );

    assert.equal(byId["set-show-concept"].verify({}, gameDay), false);
    assert.equal(
      byId["set-show-concept"].verify(
        { corps: { aClass: { showConcept: { theme: "Space" } } } },
        gameDay
      ),
      true
    );
  });
});

describe("weekly arc helpers", () => {
  test("getWeekKey groups game days by their ET Monday", () => {
    // Wed Jan 14 2026 and Sun Jan 18 2026 share the week of Mon Jan 12
    assert.equal(getWeekKey("Wed Jan 14 2026"), getWeekKey("Sun Jan 18 2026"));
    assert.equal(getWeekKey("Wed Jan 14 2026"), "Mon Jan 12 2026");
    // The next Monday starts a new week
    assert.notEqual(getWeekKey("Mon Jan 19 2026"), getWeekKey("Sun Jan 18 2026"));
  });

  test("advanceWeeklyLoop counts a full-set day exactly once", () => {
    const day = "Wed Jan 14 2026";
    const first = advanceWeeklyLoop(undefined, day, true);
    assert.deepEqual(first.weeklyLoop.countedDays, [day]);
    assert.equal(first.bonus, null);

    // Same day again (another challenge completed later) — no double count
    const again = advanceWeeklyLoop(first.weeklyLoop, day, true);
    assert.deepEqual(again.weeklyLoop.countedDays, [day]);
    assert.equal(again.bonus, null);

    // Incomplete set never counts
    const incomplete = advanceWeeklyLoop(undefined, day, false);
    assert.deepEqual(incomplete.weeklyLoop.countedDays, []);
  });

  test("advanceWeeklyLoop pays the bonus once at the 5th day, then never again", () => {
    const week = ["Mon Jan 12 2026", "Tue Jan 13 2026", "Wed Jan 14 2026", "Thu Jan 15 2026"];
    let loop;
    for (const day of week) {
      const step = advanceWeeklyLoop(loop, day, true);
      assert.equal(step.bonus, null, `no bonus before day 5 (${day})`);
      loop = step.weeklyLoop;
    }

    const fifth = advanceWeeklyLoop(loop, "Fri Jan 16 2026", true);
    assert.deepEqual(fifth.bonus, WEEKLY_LOOP_BONUS);
    assert.equal(fifth.weeklyLoop.rewarded, true);

    // A 6th day counts but never re-pays
    const sixth = advanceWeeklyLoop(fifth.weeklyLoop, "Sat Jan 17 2026", true);
    assert.equal(sixth.bonus, null);
    assert.equal(sixth.weeklyLoop.countedDays.length, 6);
  });

  test("advanceWeeklyLoop resets for a new week", () => {
    const prior = {
      weekKey: "Mon Jan 12 2026",
      countedDays: ["Mon Jan 12 2026", "Tue Jan 13 2026"],
      rewarded: true,
    };
    const nextWeek = advanceWeeklyLoop(prior, "Mon Jan 19 2026", true);
    assert.equal(nextWeek.weeklyLoop.weekKey, "Mon Jan 19 2026");
    assert.deepEqual(nextWeek.weeklyLoop.countedDays, ["Mon Jan 19 2026"]);
    assert.equal(nextWeek.weeklyLoop.rewarded, false);
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
