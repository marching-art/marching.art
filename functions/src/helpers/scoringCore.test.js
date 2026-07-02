// Behavior tests for scoreShowsForDay — the shared scoring loop extracted
// from the off-season and live-season runs. Verifies attendance filtering,
// caption aggregation and caps, the coin-award list, the recap shape, and the
// diagnostic stats, using a synthetic profiles snapshot and a stubbed
// base-score strategy (so no historical data or regression is needed).
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { scoreShowsForDay } = require("./scoring");

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

    // KNOWN LATENT BUG (documented, not introduced by the dedup refactor):
    // SHOW_PARTICIPATION_REWARDS is keyed by short class names ('world',
    // 'open') while the scoring loop looks up the canonical corpsClass
    // ('worldClass'), so World- and Open-class corps currently earn ZERO
    // show-participation coins. This test pins the current behavior; see the
    // aClass test below for a class where the reward lookup does resolve.
    assert.deepEqual(result.coinAwards, []);
  });

  test("awards show-participation coins for a class whose key matches the reward table", () => {
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
    // openClass hits the same reward-key mismatch as worldClass, so no coins.
    assert.equal(result.coinAwards.length, 0);
  });
});
