// Server achievement catalog behavior: the reconciled entries that used to
// exist only as client-side display rows (first_show, league_join), the
// live-season show counting that keeps "first score" from waiting for
// archival, sweep idempotency, and the state-driven cosmetic grants.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  ACHIEVEMENT_CATALOG,
  sweepProfileAchievements,
  sweepCosmeticGrants,
} = require("./achievements");

describe("reconciled catalog entries", () => {
  test("first_show earns from live-season shows before archival ever runs", () => {
    const earned = sweepProfileAchievements({
      corps: { soundSport: { selectedShows: { 1: ["show-a"] } } },
      lifetimeStats: { totalShows: 0 },
    });
    assert.ok(earned.some((a) => a.id === "first_show"));
  });

  test("league_join earns from league membership", () => {
    const withLeague = sweepProfileAchievements({ leagueIds: ["league-1"] });
    assert.ok(withLeague.some((a) => a.id === "league_join"));

    const without = sweepProfileAchievements({});
    assert.ok(!without.some((a) => a.id === "league_join"));
  });

  test("sweep never re-awards an achievement already on the profile", () => {
    const profile = {
      leagueIds: ["league-1"],
      achievements: [{ id: "league_join" }],
    };
    const earned = sweepProfileAchievements(profile);
    assert.ok(!earned.some((a) => a.id === "league_join"));
  });

  test("every catalog entry has the shape the UI renders", () => {
    for (const a of ACHIEVEMENT_CATALOG) {
      assert.ok(a.id && a.title && a.description && a.icon && a.rarity, a.id);
      assert.equal(typeof a.ccReward, "number", `${a.id} needs a numeric ccReward`);
      assert.equal(typeof a.earned, "function");
    }
    const ids = ACHIEVEMENT_CATALOG.map((a) => a.id);
    assert.equal(new Set(ids).size, ids.length, "catalog ids must be unique");
  });
});

describe("sweepCosmeticGrants", () => {
  test("grants the earned-early title once for an XP-path unlock", () => {
    const profile = { classUnlockPaths: { aClass: "xp" } };
    assert.deepEqual(sweepCosmeticGrants(profile), ["title_earned_not_given"]);

    const alreadyOwned = {
      classUnlockPaths: { aClass: "xp" },
      cosmetics: { owned: ["title_earned_not_given"] },
    };
    assert.deepEqual(sweepCosmeticGrants(alreadyOwned), []);
  });

  test("seasons and backstop unlocks never receive the mark", () => {
    assert.deepEqual(
      sweepCosmeticGrants({ classUnlockPaths: { aClass: "seasons", openClass: "backstop" } }),
      []
    );
  });
});
