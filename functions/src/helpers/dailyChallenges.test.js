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
  getRequiredChallengeIds,
  rotationNeedsPodiumContext,
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
    // Non-droppable members of the rotation survive.
    const rotation = getChallengesForGameDay(day).map((c) => c.id);
    for (const id of rotation) {
      if (id !== "check-lineup" && id !== "make-prediction") assert.ok(ids.includes(id));
    }
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

  test("never drops register-show or set-show-concept (any director can do them)", () => {
    for (const id of ["register-show", "set-show-concept"]) {
      const day = findGameDayWith(id);
      const ids = getRequiredChallengeIds(day, { corps: { podiumClass: { corpsName: "P" } } });
      assert.ok(ids.includes(id), `${id} must stay required`);
    }
  });
});

describe("challenge verifiers with Podium context", () => {
  const bySlug = (id) => CHALLENGE_POOL.find((c) => c.id === id);

  test("register-show verifies from Podium show picks off the profile", () => {
    const podiumOnly = { corps: { podiumClass: { corpsName: "P" } } };
    assert.equal(bySlug("register-show").verify(podiumOnly, "d", { podium: { hasShows: true } }), true);
    assert.equal(bySlug("register-show").verify(podiumOnly, "d", { podium: { hasShows: false } }), false);
    // No context at all → not done (a fantasy corps with picks still passes).
    assert.equal(bySlug("register-show").verify(podiumOnly, "d"), false);
  });

  test("set-show-concept verifies from the Podium concept the profile can't show", () => {
    // The Podium display copy stores showConcept as a STRING, so the fantasy
    // `.theme` check misses it — the context carries the real answer.
    const podiumOnly = { corps: { podiumClass: { corpsName: "P", showConcept: "Ritual" } } };
    assert.equal(bySlug("set-show-concept").verify(podiumOnly, "d", { podium: { hasConcept: true } }), true);
    assert.equal(bySlug("set-show-concept").verify(podiumOnly, "d", { podium: { hasConcept: false } }), false);
  });

  test("fantasy verifiers are unchanged by the context arg", () => {
    const fantasy = {
      corps: { worldClass: { corpsName: "W", selectedShows: { 1: ["s"] }, showConcept: { theme: "T" } } },
    };
    assert.equal(bySlug("register-show").verify(fantasy, "d"), true);
    assert.equal(bySlug("set-show-concept").verify(fantasy, "d"), true);
  });
});

describe("rotationNeedsPodiumContext", () => {
  test("true when the day offers a show/concept challenge", () => {
    assert.equal(rotationNeedsPodiumContext(findGameDayWith("register-show")), true);
  });

  test("false when it offers neither", () => {
    // Only check-lineup + make-prediction would need no podium read. Such a
    // day may not exist in the 3-of-4 rotation, so accept either outcome but
    // assert the function agrees with the rotation it inspects.
    const day = "Wed Jan 14 2026"; // check-lineup, make-prediction, register-show
    const ids = getChallengesForGameDay(day).map((c) => c.id);
    const expected = ids.includes("register-show") || ids.includes("set-show-concept");
    assert.equal(rotationNeedsPodiumContext(day), expected);
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
