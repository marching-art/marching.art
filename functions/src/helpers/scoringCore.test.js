// Behavior tests for scoreShowsForDay — the shared scoring loop extracted
// from the off-season and live-season runs. Verifies attendance filtering,
// caption aggregation and caps, the coin-award list, the recap shape, and the
// diagnostic stats, using a synthetic profiles snapshot and a stubbed
// base-score strategy (so no historical data or regression is needed).
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  scoreShowsForDay,
  hasCompleteLineup,
  computeSeasonRankings,
  diffSeasonRankings,
} = require("./scoring");

// A user profile document as produced by the collectionGroup("profile") query,
// with the ref.parent.parent.id shape the loop reads the uid from.
function profileDoc(uid, data) {
  return {
    data: () => data,
    ref: { parent: { parent: { id: uid } } },
  };
}

const CAPTIONS = ["GE1", "GE2", "VP", "VA", "CG", "B", "MA", "P"];

// A complete 8-caption lineup, every slot pointing at the same corps/year.
function fullLineup(corpsName = "Blue Devils", year = "2023") {
  const lineup = {};
  for (const c of CAPTIONS) lineup[c] = `${corpsName}|${year}`;
  return lineup;
}

describe("hasCompleteLineup", () => {
  test("accepts a full 8-caption lineup", () => {
    assert.equal(hasCompleteLineup(fullLineup()), true);
  });

  test("rejects an empty lineup", () => {
    assert.equal(hasCompleteLineup({}), false);
  });

  test("rejects a missing lineup", () => {
    assert.equal(hasCompleteLineup(undefined), false);
    assert.equal(hasCompleteLineup(null), false);
  });

  test("rejects a lineup missing any caption", () => {
    const partial = fullLineup();
    delete partial.GE1;
    assert.equal(hasCompleteLineup(partial), false);
  });

  test("rejects a lineup with an empty-string caption", () => {
    const blank = fullLineup();
    blank.MA = "";
    assert.equal(hasCompleteLineup(blank), false);
  });
});

describe("scoreShowsForDay", () => {
  test("scores a corps registered for a regular show and caps totals", () => {
    const profilesSnapshot = {
      docs: [
        profileDoc("u1", {
          username: "director1",
          corps: {
            worldClass: {
              corpsName: "Aurora",
              location: "TX",
              lineup: fullLineup(),
              showConcept: {},
              selectedShows: { week1: [{ eventName: "Season Opener" }] },
            },
          },
        }),
      ],
    };

    const dailyRecap = { shows: [] };
    // Base score of 25 per caption: after the 20-per-caption cap each caption
    // contributes 20. GE = 40, visual = (20*3)/2 = 30, music = (20*3)/2 = 30 =>
    // 100, which is exactly the overall cap.
    const result = scoreShowsForDay({
      dayEventData: { shows: [{ eventName: "Season Opener", location: "TX" }] },
      profilesSnapshot,
      week: 1,
      scoredDay: 1,
      championshipConfig: null,
      dailyRecap,
      getBaseCaptionScore: () => 25,
    });

    assert.equal(dailyRecap.shows.length, 1);
    const entry = dailyRecap.shows[0].results[0];
    assert.equal(entry.uid, "u1");
    assert.equal(entry.corpsClass, "worldClass");
    assert.equal(entry.geScore, 40);
    assert.equal(entry.visualScore, 30);
    assert.equal(entry.musicScore, 30);
    assert.equal(entry.totalScore, 100);

    assert.equal(result.dailyScores.get("u1_worldClass"), 100);
    assert.equal(result.stats.corpsScored, 1);
    assert.equal(result.stats.corpsProcessed, 1);

    // Regression guard: SHOW_PARTICIPATION_REWARDS was once keyed only by
    // short class names ('world', 'open') while the scoring loop looks up
    // the canonical corps-map key ('worldClass'), silently paying World and
    // Open class corps ZERO show-participation coins. The table now carries
    // canonical keys, so every class must earn its reward.
    assert.deepEqual(result.coinAwards, [
      { uid: "u1", corpsClass: "worldClass", showName: "Season Opener", amount: 200 },
    ]);
  });

  test("awards class-tiered show-participation coins (aClass)", () => {
    const profilesSnapshot = {
      docs: [
        profileDoc("u1", {
          corps: {
            aClass: {
              corpsName: "Coiners",
              lineup: fullLineup(),
              selectedShows: { week1: [{ eventName: "Season Opener" }] },
            },
          },
        }),
      ],
    };
    const dailyRecap = { shows: [] };
    const result = scoreShowsForDay({
      dayEventData: { shows: [{ eventName: "Season Opener" }] },
      profilesSnapshot,
      week: 1,
      scoredDay: 1,
      championshipConfig: null,
      dailyRecap,
      getBaseCaptionScore: () => 10,
    });
    assert.deepEqual(result.coinAwards, [
      { uid: "u1", corpsClass: "aClass", showName: "Season Opener", amount: 100 },
    ]);
  });

  test("skips a corps that did not register for the show", () => {
    const profilesSnapshot = {
      docs: [
        profileDoc("u1", {
          corps: {
            aClass: {
              corpsName: "Skippers",
              lineup: fullLineup(),
              selectedShows: { week1: [{ eventName: "Some Other Show" }] },
            },
          },
        }),
      ],
    };
    const dailyRecap = { shows: [] };
    const result = scoreShowsForDay({
      dayEventData: { shows: [{ eventName: "Season Opener" }] },
      profilesSnapshot,
      week: 1,
      scoredDay: 1,
      championshipConfig: null,
      dailyRecap,
      getBaseCaptionScore: () => 10,
    });

    assert.equal(dailyRecap.shows[0].results.length, 0);
    assert.equal(result.dailyScores.size, 0);
    assert.equal(result.stats.corpsScored, 0);
    assert.equal(result.stats.corpsProcessed, 1);
    assert.equal(result.stats.corpsWithNoShowsSelected, 0);
  });

  test("counts corps with no selected shows in the diagnostics", () => {
    const profilesSnapshot = {
      docs: [
        profileDoc("u1", {
          corps: { soundSport: { corpsName: "Idle", lineup: fullLineup(), selectedShows: {} } },
        }),
      ],
    };
    const dailyRecap = { shows: [] };
    const result = scoreShowsForDay({
      dayEventData: { shows: [{ eventName: "Season Opener" }] },
      profilesSnapshot,
      week: 1,
      scoredDay: 1,
      championshipConfig: null,
      dailyRecap,
      getBaseCaptionScore: () => 10,
    });

    assert.equal(result.stats.corpsWithNoShowsSelected, 1);
    assert.equal(result.stats.corpsScored, 0);
  });

  test("ignores corps without a name or lineup", () => {
    const profilesSnapshot = {
      docs: [
        profileDoc("u1", {
          corps: {
            worldClass: { corpsName: "No Lineup", selectedShows: { week1: [{ eventName: "S" }] } },
            openClass: { lineup: fullLineup(), selectedShows: { week1: [{ eventName: "S" }] } },
          },
        }),
      ],
    };
    const dailyRecap = { shows: [] };
    const result = scoreShowsForDay({
      dayEventData: { shows: [{ eventName: "S" }] },
      profilesSnapshot,
      week: 1,
      scoredDay: 1,
      championshipConfig: null,
      dailyRecap,
      getBaseCaptionScore: () => 10,
    });
    assert.equal(result.stats.corpsScored, 0);
    assert.equal(dailyRecap.shows[0].results.length, 0);
  });

  test("does not score a corps registered for a show but with no captions selected", () => {
    const profilesSnapshot = {
      docs: [
        profileDoc("u1", {
          corps: {
            aClass: {
              corpsName: "Unselected",
              // Newly registered corps start with an empty lineup object.
              lineup: {},
              selectedShows: { week1: [{ eventName: "Season Opener" }] },
            },
          },
        }),
      ],
    };
    const dailyRecap = { shows: [] };
    const result = scoreShowsForDay({
      dayEventData: { shows: [{ eventName: "Season Opener" }] },
      profilesSnapshot,
      week: 1,
      scoredDay: 1,
      championshipConfig: null,
      dailyRecap,
      getBaseCaptionScore: () => 10,
    });

    // The corps registered for the show but never picked captions, so it must
    // not appear in the recap, earn a score, or receive participation coins.
    assert.equal(dailyRecap.shows[0].results.length, 0);
    assert.equal(result.dailyScores.size, 0);
    assert.equal(result.stats.corpsScored, 0);
    assert.deepEqual(result.coinAwards, []);
  });

  test("does not score a corps with a partially-filled lineup", () => {
    const partial = fullLineup();
    delete partial.P; // one caption missing => incomplete
    const profilesSnapshot = {
      docs: [
        profileDoc("u1", {
          corps: {
            aClass: {
              corpsName: "HalfLineup",
              lineup: partial,
              selectedShows: { week1: [{ eventName: "Season Opener" }] },
            },
          },
        }),
      ],
    };
    const dailyRecap = { shows: [] };
    const result = scoreShowsForDay({
      dayEventData: { shows: [{ eventName: "Season Opener" }] },
      profilesSnapshot,
      week: 1,
      scoredDay: 1,
      championshipConfig: null,
      dailyRecap,
      getBaseCaptionScore: () => 10,
    });

    assert.equal(dailyRecap.shows[0].results.length, 0);
    assert.equal(result.stats.corpsScored, 0);
  });

  test("championship config gates classes and non-advancing participants", () => {
    const profilesSnapshot = {
      docs: [
        profileDoc("u1", { corps: { worldClass: { corpsName: "Advancer", lineup: fullLineup() } } }),
        profileDoc("u2", { corps: { worldClass: { corpsName: "Eliminated", lineup: fullLineup() } } }),
        profileDoc("u3", { corps: { aClass: { corpsName: "WrongClass", lineup: fullLineup() } } }),
      ],
    };
    const dailyRecap = { shows: [] };
    const championshipConfig = {
      "World Championship Finals": {
        classFilter: ["worldClass"],
        participants: [{ uid: "u1", corpsClass: "worldClass" }],
      },
    };
    const result = scoreShowsForDay({
      dayEventData: { shows: [{ eventName: "World Championship Finals" }] },
      profilesSnapshot,
      week: 7,
      scoredDay: 49,
      championshipConfig,
      dailyRecap,
      getBaseCaptionScore: () => 10,
    });

    // Only u1 advances; u2 didn't advance, u3 is the wrong class.
    const results = dailyRecap.shows[0].results;
    assert.equal(results.length, 1);
    assert.equal(results[0].uid, "u1");
    // Championship shows do not increment the regular-registration diagnostics.
    assert.equal(result.stats.corpsProcessed, 0);
    assert.equal(result.stats.corpsScored, 1);
  });

  test("accumulates lifetime caption points per uid across corps and shows", () => {
    const profilesSnapshot = {
      docs: [
        profileDoc("u1", {
          corps: {
            worldClass: {
              corpsName: "TwoClasses A",
              lineup: fullLineup(),
              selectedShows: { week1: [{ eventName: "Show A" }] },
            },
            aClass: {
              corpsName: "TwoClasses B",
              lineup: fullLineup(),
              selectedShows: { week1: [{ eventName: "Show A" }] },
            },
          },
        }),
        profileDoc("u2", {
          corps: {
            openClass: {
              corpsName: "Bystander",
              lineup: fullLineup(),
              selectedShows: { week1: [{ eventName: "Elsewhere" }] },
            },
          },
        }),
      ],
    };
    const dailyRecap = { shows: [] };
    // Base 25 => capped at 20 per caption. u1 fields two corps in the same
    // show, so each caption banks 20 + 20 = 40 tonight.
    const result = scoreShowsForDay({
      dayEventData: { shows: [{ eventName: "Show A" }] },
      profilesSnapshot,
      week: 1,
      scoredDay: 1,
      championshipConfig: null,
      dailyRecap,
      getBaseCaptionScore: () => 25,
    });

    const u1 = result.captionPoints.get("u1");
    for (const caption of CAPTIONS) {
      assert.equal(u1[caption], 40, `${caption} should bank capped points from both corps`);
    }
    // A corps that didn't attend banks nothing.
    assert.equal(result.captionPoints.has("u2"), false);
  });

  test("computeSeasonRankings ranks by effective score and skips SoundSport", () => {
    const profilesSnapshot = {
      docs: [
        profileDoc("u1", {
          corps: {
            worldClass: { corpsName: "Leader", totalSeasonScore: 80 },
            soundSport: { corpsName: "Fun Corps", totalSeasonScore: 95 },
          },
        }),
        profileDoc("u2", {
          corps: { worldClass: { corpsName: "Chaser", totalSeasonScore: 85 } },
        }),
        profileDoc("u3", {
          // Never scored — must stay unranked, not #last.
          corps: { worldClass: { corpsName: "Fresh", totalSeasonScore: 0 } },
        }),
        profileDoc("u4", {
          corps: { aClass: { corpsName: "Solo A", totalSeasonScore: 60 } },
        }),
      ],
    };
    // Tonight u1 scored 90: their EFFECTIVE score beats u2's stored 85.
    const dailyScores = new Map([["u1_worldClass", 90]]);

    const rankings = computeSeasonRankings(profilesSnapshot, dailyScores);
    assert.deepEqual(rankings.get("u1_worldClass"), { rank: 1, of: 2 });
    assert.deepEqual(rankings.get("u2_worldClass"), { rank: 2, of: 2 });
    assert.equal(rankings.has("u3_worldClass"), false);
    // Classes rank independently.
    assert.deepEqual(rankings.get("u4_aClass"), { rank: 1, of: 1 });
    // SoundSport is ratings-only — never ranked, whatever it scores.
    assert.equal(rankings.has("u1_soundSport"), false);
  });

  test("diffSeasonRankings writes only the corps whose stored rank moved", () => {
    const profilesSnapshot = {
      docs: [
        profileDoc("u1", {
          // Stored rank already matches tonight's computation — no write.
          corps: { worldClass: { corpsName: "Steady", totalSeasonScore: 90, seasonRank: 1, seasonRankOf: 3 } },
        }),
        profileDoc("u2", {
          // Rank changed (was 3, now 2) — must write.
          corps: { worldClass: { corpsName: "Mover", totalSeasonScore: 80, seasonRank: 3, seasonRankOf: 3 } },
        }),
        profileDoc("u3", {
          // Same rank but the field count ("of") changed — must write.
          corps: { worldClass: { corpsName: "Held", totalSeasonScore: 70, seasonRank: 3, seasonRankOf: 4 } },
        }),
        profileDoc("u4", {
          // Never had a stored rank — must write.
          corps: { aClass: { corpsName: "Fresh", totalSeasonScore: 60 } },
        }),
      ],
    };
    const rankings = computeSeasonRankings(profilesSnapshot, new Map());
    const changed = diffSeasonRankings(rankings, profilesSnapshot);

    assert.equal(changed.has("u1_worldClass"), false, "unchanged rank is skipped");
    assert.deepEqual(changed.get("u2_worldClass"), { rank: 2, of: 3 });
    assert.deepEqual(changed.get("u3_worldClass"), { rank: 3, of: 3 });
    assert.deepEqual(changed.get("u4_aClass"), { rank: 1, of: 1 });
  });

  test("day 41: a resolved easternNightSet gates who scores at the two-night show", () => {
    const easternShow = {
      eventName: "marching.art Eastern Classic",
      multiNight: { nights: [41, 42] },
    };
    const enrolled = (uid) =>
      profileDoc(uid, {
        corps: {
          worldClass: {
            corpsName: `Corps ${uid}`,
            lineup: fullLineup(),
            selectedShows: { week6: [{ eventName: easternShow.eventName, day: 41 }] },
          },
        },
      });
    const profilesSnapshot = { docs: [enrolled("friday"), enrolled("saturday")] };
    const dailyRecap = { shows: [] };

    const result = scoreShowsForDay({
      dayEventData: { shows: [easternShow] },
      profilesSnapshot,
      week: 6,
      scoredDay: 41,
      championshipConfig: null,
      dailyRecap,
      getBaseCaptionScore: () => 10,
      easternNightSet: new Set(["friday_worldClass"]),
    });

    // Only the assigned night performs, even though both corps registered.
    assert.deepEqual(
      dailyRecap.shows[0].results.map((r) => r.uid),
      ["friday"]
    );
    assert.equal(result.dailyScores.has("saturday_worldClass"), false);
  });

  test("day 41/42 without a resolved set falls back to the legacy in-loop split", () => {
    const enrolled = (uid) =>
      profileDoc(uid, {
        corps: {
          worldClass: {
            corpsName: `Corps ${uid}`,
            lineup: fullLineup(),
            selectedShows: { week6: [{ eventName: "DCI Eastern Classic", day: 41 }] },
          },
        },
      });
    const profilesSnapshot = { docs: [enrolled("alpha"), enrolled("beta")] };

    const scoreNight = (scoredDay) => {
      const dailyRecap = { shows: [] };
      scoreShowsForDay({
        dayEventData: { shows: [{ eventName: "DCI Eastern Classic" }] },
        profilesSnapshot,
        week: 6,
        scoredDay,
        championshipConfig: null,
        dailyRecap,
        getBaseCaptionScore: () => 10,
      });
      return dailyRecap.shows[0].results.map((r) => r.uid);
    };

    const night41 = scoreNight(41);
    const night42 = scoreNight(42);
    // Legacy alphabetical split: each corps performs exactly one night.
    assert.deepEqual([...night41, ...night42].sort(), ["alpha", "beta"]);
    assert.equal(night41.length, 1);
    assert.equal(night42.length, 1);
  });

  test("sums scores across multiple shows for the same corps", () => {
    const profilesSnapshot = {
      docs: [
        profileDoc("u1", {
          corps: {
            openClass: {
              corpsName: "TwoShows",
              lineup: fullLineup(),
              selectedShows: { week1: [{ eventName: "Show A" }, { eventName: "Show B" }] },
            },
          },
        }),
      ],
    };
    const dailyRecap = { shows: [] };
    // Base 4 per caption => GE 8, visual (4*3)/2=6, music 6 => 20 per show.
    const result = scoreShowsForDay({
      dayEventData: { shows: [{ eventName: "Show A" }, { eventName: "Show B" }] },
      profilesSnapshot,
      week: 1,
      scoredDay: 1,
      championshipConfig: null,
      dailyRecap,
      getBaseCaptionScore: () => 4,
    });

    assert.equal(result.dailyScores.get("u1_openClass"), 40); // 20 + 20
    // One participation award per show attended, at the openClass rate.
    assert.deepEqual(result.coinAwards, [
      { uid: "u1", corpsClass: "openClass", showName: "Show A", amount: 150 },
      { uid: "u1", corpsClass: "openClass", showName: "Show B", amount: 150 },
    ]);
  });
});
