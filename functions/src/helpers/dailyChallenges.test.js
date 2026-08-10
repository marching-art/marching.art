// Tests for the daily-challenge catalog and rotation. The fixed-date
// expectations here are PINNED to the same values as the client mirror's
// tests (src/utils/dailyChallenges.test.js) — if either side changes the
// pool or the hash, both test files must be updated together.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  CHALLENGE_POOL,
  CHALLENGES_PER_DAY,
  WEEKLY_LOOP_MILESTONES,
  getGameDay,
  getWeekKey,
  advanceWeeklyLoop,
  getChallengesForGameDay,
  getRequiredChallengeIds,
  rotationNeedsPodiumContext,
  rotationNeedsLeaguePoolContext,
  hasLineupBearingCorps,
  pruneOldChallenges,
} = require("./dailyChallenges");

// A game day whose real rotation contains a given challenge id — lets the
// tests below assert `available`/required behavior against the actual hashed
// rotation rather than a hand-built one. Searches forward from a fixed anchor.
function findGameDayWith(id) {
  const anchor = new Date("2026-07-01T12:00:00Z");
  for (let i = 0; i < 60; i++) {
    const day = getGameDay(new Date(anchor.getTime() + i * 86400000));
    if (getChallengesForGameDay(day).some((c) => c.id === id)) return day;
  }
  throw new Error(`No game day found offering ${id}`);
}

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
  test("returns CHALLENGES_PER_DAY distinct challenges from the pool", () => {
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
      "join-league-pool",
      "check-lineup",
    ]);
  });
});

describe("hasLineupBearingCorps", () => {
  test("true for a fantasy director", () => {
    assert.equal(hasLineupBearingCorps({ corps: { worldClass: { corpsName: "A" } } }), true);
  });

  test("false for a Podium-only director", () => {
    // Podium is a director simulation with no caption lineup — the whole
    // reason its daily set had to change.
    assert.equal(hasLineupBearingCorps({ corps: { podiumClass: { corpsName: "P" } } }), false);
  });

  test("true when a director has both", () => {
    assert.equal(
      hasLineupBearingCorps({ corps: { podiumClass: { corpsName: "P" }, aClass: { corpsName: "A" } } }),
      true
    );
  });

  test("false for no corps at all", () => {
    assert.equal(hasLineupBearingCorps({}), false);
    assert.equal(hasLineupBearingCorps(null), false);
  });
});

describe("getRequiredChallengeIds", () => {
  test("drops check-lineup for a Podium-only director", () => {
    const day = findGameDayWith("check-lineup");
    const ids = getRequiredChallengeIds(day, { corps: { podiumClass: { corpsName: "P" } } });
    assert.ok(!ids.includes("check-lineup"), "check-lineup must not be required for podium-only");
  });

  test("keeps check-lineup for a fantasy director", () => {
    const day = findGameDayWith("check-lineup");
    const ids = getRequiredChallengeIds(day, { corps: { worldClass: { corpsName: "W" } } });
    assert.ok(ids.includes("check-lineup"));
  });

  test("drops make-prediction when predictions are unavailable", () => {
    const day = findGameDayWith("make-prediction");
    const ids = getRequiredChallengeIds(
      day,
      { corps: { worldClass: { corpsName: "W" } } },
      { predictionAvailable: false }
    );
    assert.ok(!ids.includes("make-prediction"));
  });

  test("keeps make-prediction when predictions are available", () => {
    const day = findGameDayWith("make-prediction");
    const ids = getRequiredChallengeIds(
      day,
      { corps: { worldClass: { corpsName: "W" } } },
      { predictionAvailable: true }
    );
    assert.ok(ids.includes("make-prediction"));
  });

  test("drops join-league-pool for a director with no league", () => {
    const day = findGameDayWith("join-league-pool");
    const ids = getRequiredChallengeIds(day, { corps: { worldClass: { corpsName: "W" } } });
    assert.ok(!ids.includes("join-league-pool"), "must not be required without a league");
  });

  test("keeps join-league-pool for a league member", () => {
    const day = findGameDayWith("join-league-pool");
    const ids = getRequiredChallengeIds(day, {
      corps: { worldClass: { corpsName: "W" } },
      leagueIds: ["L1"],
    });
    assert.ok(ids.includes("join-league-pool"));
  });
});

describe("join-league-pool verifier", () => {
  const bySlug = (id) => CHALLENGE_POOL.find((c) => c.id === id);

  test("verifies from today's league-pool entry off the profile", () => {
    const inLeague = { leagueIds: ["L1"] };
    assert.equal(bySlug("join-league-pool").verify(inLeague, "d", { leaguePool: { hasEntered: true } }), true);
    assert.equal(bySlug("join-league-pool").verify(inLeague, "d", { leaguePool: { hasEntered: false } }), false);
    // No context at all → not done (the profile alone can't show pool entry).
    assert.equal(bySlug("join-league-pool").verify(inLeague, "d"), false);
  });

  test("is available only to directors in at least one league", () => {
    assert.equal(bySlug("join-league-pool").available({ leagueIds: ["L1"] }), true);
    assert.equal(bySlug("join-league-pool").available({ leagueIds: [] }), false);
    assert.equal(bySlug("join-league-pool").available({}), false);
  });
});

describe("rotation context gates", () => {
  test("rotationNeedsLeaguePoolContext is true only when join-league-pool is offered", () => {
    assert.equal(rotationNeedsLeaguePoolContext(findGameDayWith("join-league-pool")), true);
    // A day whose rotation is check-lineup + make-prediction needs no pool read.
    const noPoolDay = findGameDayWith("check-lineup");
    if (!getChallengesForGameDay(noPoolDay).some((c) => c.id === "join-league-pool")) {
      assert.equal(rotationNeedsLeaguePoolContext(noPoolDay), false);
    }
  });

  test("rotationNeedsPodiumContext is false — no pooled challenge verifies off Podium now", () => {
    // register-show / set-show-concept were retired, so nothing in the pool
    // depends on Podium state. Kept as the callable's single gate regardless.
    assert.equal(rotationNeedsPodiumContext("Wed Jan 14 2026"), false);
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

  test("verify predicates read the state that proves a genuine same-day decision", () => {
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

    assert.equal(byId["join-league-pool"].verify({ leagueIds: ["L1"] }, gameDay), false);
    assert.equal(
      byId["join-league-pool"].verify({ leagueIds: ["L1"] }, gameDay, {
        leaguePool: { hasEntered: true },
      }),
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

  test("advanceWeeklyLoop pays each milestone once, on the day it is reached", () => {
    const week = [
      "Mon Jan 12 2026",
      "Tue Jan 13 2026",
      "Wed Jan 14 2026",
      "Thu Jan 15 2026",
      "Fri Jan 16 2026",
      "Sat Jan 17 2026",
      "Sun Jan 18 2026",
    ];
    let loop;
    const bonuses = [];
    for (const day of week) {
      const step = advanceWeeklyLoop(loop, day, true);
      bonuses.push(step.bonus);
      loop = step.weeklyLoop;
    }
    // Milestones at 3 / 5 / 7 days; nothing on the days between.
    assert.equal(bonuses[0], null);
    assert.equal(bonuses[1], null);
    assert.deepEqual(bonuses[2], { xp: 40, coin: 40, tiers: [3] });
    assert.equal(bonuses[3], null);
    assert.deepEqual(bonuses[4], { xp: 60, coin: 60, tiers: [5] });
    assert.equal(bonuses[5], null);
    assert.deepEqual(bonuses[6], { xp: 50, coin: 50, tiers: [7] });
    assert.deepEqual(loop.rewardedDays, [3, 5, 7]);
  });

  test("advanceWeeklyLoop resets for a new week", () => {
    const prior = {
      weekKey: "Mon Jan 12 2026",
      countedDays: ["Mon Jan 12 2026", "Tue Jan 13 2026", "Wed Jan 14 2026"],
      rewardedDays: [3],
    };
    const nextWeek = advanceWeeklyLoop(prior, "Mon Jan 19 2026", true);
    assert.equal(nextWeek.weeklyLoop.weekKey, "Mon Jan 19 2026");
    assert.deepEqual(nextWeek.weeklyLoop.countedDays, ["Mon Jan 19 2026"]);
    assert.deepEqual(nextWeek.weeklyLoop.rewardedDays, []);
  });

  test("migrates a legacy `rewarded: true` loop without re-paying 3/5, and still pays 7", () => {
    // Legacy state: the old single 5-day bonus already paid this week.
    const legacy = {
      weekKey: getWeekKey("Fri Jan 16 2026"),
      countedDays: [
        "Mon Jan 12 2026",
        "Tue Jan 13 2026",
        "Wed Jan 14 2026",
        "Thu Jan 15 2026",
        "Fri Jan 16 2026",
      ],
      rewarded: true,
    };
    const sixth = advanceWeeklyLoop(legacy, "Sat Jan 17 2026", true);
    assert.equal(sixth.bonus, null, "no re-pay of the 3/5-day tiers the legacy flag covered");
    assert.deepEqual(sixth.weeklyLoop.rewardedDays, [3, 5]);

    const seventh = advanceWeeklyLoop(sixth.weeklyLoop, "Sun Jan 18 2026", true);
    assert.deepEqual(seventh.bonus, { xp: 50, coin: 50, tiers: [7] });
    assert.deepEqual(seventh.weeklyLoop.rewardedDays, [3, 5, 7]);
  });

  test("a legacy partial week catches up multiple milestones in one summed payout", () => {
    // 4 counted days, never rewarded (never hit the old 5-day mark). The next
    // full-set day crosses both the 3- and 5-day milestones at once.
    const legacyPartial = {
      weekKey: getWeekKey("Fri Jan 16 2026"),
      countedDays: ["Mon Jan 12 2026", "Tue Jan 13 2026", "Wed Jan 14 2026", "Thu Jan 15 2026"],
      rewarded: false,
    };
    const fifth = advanceWeeklyLoop(legacyPartial, "Fri Jan 16 2026", true);
    assert.deepEqual(fifth.bonus, { xp: 100, coin: 100, tiers: [3, 5] });
    assert.deepEqual(fifth.weeklyLoop.rewardedDays, [3, 5]);
  });

  test("WEEKLY_LOOP_MILESTONES 5-day cumulative stays 100/100 (economy-neutral)", () => {
    const throughFive = WEEKLY_LOOP_MILESTONES.filter((m) => m.days <= 5);
    assert.equal(
      throughFive.reduce((s, m) => s + m.coin, 0),
      100
    );
    assert.equal(
      throughFive.reduce((s, m) => s + m.xp, 0),
      100
    );
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
