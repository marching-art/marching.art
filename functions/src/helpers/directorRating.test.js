// Tests for the Director Rating (Phase 7.5): lifetime, placements-only,
// cross-class — DCI-style placement points summed across every archived
// season on the profile résumé; SoundSport never contributes.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { computeDirectorRating, PLACEMENT_POINT_BASE } = require("./directorRating");

const season = (placement) => ({ seasonId: `s${placement}`, placement });

describe("computeDirectorRating", () => {
  test("zero for empty or placement-free profiles", () => {
    assert.equal(computeDirectorRating({}), 0);
    assert.equal(computeDirectorRating({ corps: {} }), 0);
    assert.equal(
      computeDirectorRating({ corps: { worldClass: { seasonHistory: [{ seasonId: "x" }] } } }),
      0
    );
  });

  test("DCI-style points: 1st = 25, 25th = 1, deeper = 0", () => {
    const profile = (placement) => ({
      corps: { worldClass: { seasonHistory: [season(placement)] } },
    });
    assert.equal(computeDirectorRating(profile(1)), PLACEMENT_POINT_BASE - 1);
    assert.equal(computeDirectorRating(profile(25)), 1);
    assert.equal(computeDirectorRating(profile(26)), 0);
    assert.equal(computeDirectorRating(profile(80)), 0);
  });

  test("sums across classes and seasons — Podium counts, SoundSport never", () => {
    const rating = computeDirectorRating({
      corps: {
        worldClass: { seasonHistory: [season(3), season(1)] }, // 23 + 25
        podiumClass: { seasonHistory: [season(2)] }, // 24
        soundSport: { seasonHistory: [season(1)] }, // ratings-only: 0
      },
    });
    assert.equal(rating, 23 + 25 + 24);
  });

  test("placements are the ONLY input — riches and grind move nothing", () => {
    const base = { corps: { aClass: { seasonHistory: [season(5)] } } };
    const decorated = {
      ...base,
      xp: 999999,
      corpsCoin: 999999,
      stats: { leagueWins: 400 },
      lifetimeStats: { totalShows: 900 },
    };
    assert.equal(computeDirectorRating(decorated), computeDirectorRating(base));
  });

  test("ignores malformed rows", () => {
    const rating = computeDirectorRating({
      corps: {
        openClass: {
          seasonHistory: [null, { placement: "3" }, { placement: 0 }, { placement: -2 }, season(4)],
        },
      },
    });
    assert.equal(rating, PLACEMENT_POINT_BASE - 4);
  });
});
