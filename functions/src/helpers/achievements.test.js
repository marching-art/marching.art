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
  podiumSeasonsPlayed,
  podiumShowsAttended,
  reconciledTotalSeasons,
} = require("./achievements");

/** A profile whose only game is Podium, with N completed seasons on the résumé. */
function podiumOnlyProfile(seasons, extra = {}) {
  const seasonHistory = Array.from({ length: seasons }, (_, i) => ({
    seasonId: `s${i + 1}`,
    finalScore: 80 + i,
    showsAttended: 6,
  }));
  return { corps: { podiumClass: { seasonHistory, ...extra } } };
}

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

describe("Podium participation folds into the shared career milestones", () => {
  test("podiumSeasonsPlayed counts distinct scored résumé rows only", () => {
    const profile = {
      corps: {
        podiumClass: {
          seasonHistory: [
            { seasonId: "s1", finalScore: 82, showsAttended: 6 },
            { seasonId: "s1", finalScore: 82, showsAttended: 6 }, // dup seasonId
            { seasonId: "s2", finalScore: null }, // registered, never performed
            { seasonId: "s3", finalScore: 88, showsAttended: 4 },
          ],
        },
      },
    };
    assert.equal(podiumSeasonsPlayed(profile), 2); // s1 and s3
    assert.equal(podiumShowsAttended(profile), 16); // 6 + 6 + 0 + 4
  });

  test("reconciledTotalSeasons only ever raises, never lowers", () => {
    // Podium-only director stuck at zero is lifted to their Podium seasons.
    assert.equal(reconciledTotalSeasons(podiumOnlyProfile(3)), 3);
    // A both-games director whose stored count already covers the overlapping
    // seasons is never inflated past it (max, not sum).
    const both = podiumOnlyProfile(3);
    both.lifetimeStats = { totalSeasons: 5 };
    assert.equal(reconciledTotalSeasons(both), 5);
    // A fantasy-only director (no Podium résumé) is untouched.
    assert.equal(reconciledTotalSeasons({ lifetimeStats: { totalSeasons: 7 } }), 7);
  });

  test("a Podium-only director earns the season and show milestones", () => {
    // 5 Podium seasons, 6 shows each = 30 shows: seasons_1/_5 and the show
    // milestones up to shows_10 should all be reachable from Podium alone.
    const earned = sweepProfileAchievements(podiumOnlyProfile(5)).map((a) => a.id);
    assert.ok(earned.includes("seasons_1"));
    assert.ok(earned.includes("seasons_5"));
    assert.ok(earned.includes("first_show"));
    assert.ok(earned.includes("shows_10"));
    assert.ok(earned.includes("podium_debut"));
  });

  test("Podium division climb earns the director milestones", () => {
    const openEarned = sweepProfileAchievements(
      podiumOnlyProfile(2, { division: "openClass" })
    ).map((a) => a.id);
    assert.ok(openEarned.includes("podium_open"));
    assert.ok(!openEarned.includes("podium_world"));

    const worldEarned = sweepProfileAchievements(
      podiumOnlyProfile(4, { division: "worldClass" })
    ).map((a) => a.id);
    assert.ok(worldEarned.includes("podium_open")); // World implies Open passed
    assert.ok(worldEarned.includes("podium_world"));
  });

  test("a director with no Podium corps earns no Podium milestones", () => {
    const earned = sweepProfileAchievements({
      lifetimeStats: { totalSeasons: 3 },
    }).map((a) => a.id);
    assert.ok(!earned.includes("podium_debut"));
    assert.ok(!earned.includes("podium_open"));
    assert.ok(!earned.includes("podium_world"));
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
