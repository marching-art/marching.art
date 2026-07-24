// Tests for the season-standings materializer. These pin the contract the
// client (useScoresData) depends on: latest-show score as the season score,
// most-recent-first bounded history, per-class ranks and caption ranks,
// client-identical trend rules, and the SoundSport exclusions.

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { buildSeasonStandings } = require("./standingsMaterializer");

const result = (uid, corpsClass, corpsName, totalScore, extra = {}) => ({
  uid,
  corpsClass,
  corpsName,
  totalScore,
  geScore: totalScore * 0.4,
  visualScore: totalScore * 0.3,
  musicScore: totalScore * 0.3,
  ...extra,
});

const RECAPS = [
  {
    offSeasonDay: 1,
    shows: [
      {
        eventName: "Opener",
        results: [
          result("u1", "worldClass", "Crimson Cadence", 80),
          result("u2", "worldClass", "Golden Empire", 82),
          result("u3", "aClass", "Steel City Sound", 50),
          result("u4", "soundSport", "Bayou Brigade", 70),
        ],
      },
    ],
  },
  {
    offSeasonDay: 2,
    shows: [
      {
        eventName: "Night Two",
        results: [
          result("u1", "worldClass", "Crimson Cadence", 90),
          result("u2", "worldClass", "Golden Empire", 85),
        ],
      },
    ],
  },
];

describe("buildSeasonStandings", () => {
  const { summary, classes } = buildSeasonStandings(RECAPS);

  test("season score is the latest show's score, ranked per class", () => {
    const world = classes.worldClass;
    assert.equal(world.length, 2);
    assert.equal(world[0].corpsName, "Crimson Cadence"); // 90 beats 85 tonight
    assert.equal(world[0].rank, 1);
    assert.equal(world[0].totalScore, 90);
    assert.equal(world[1].corpsName, "Golden Empire");
    assert.equal(world[1].rank, 2);
  });

  test("history is most-recent-first and drives the rank delta contract", () => {
    const crimson = classes.worldClass[0];
    assert.equal(crimson.scores[0].score, 90);
    assert.equal(crimson.scores[1].score, 80);
    assert.equal(crimson.showCount, 2);
    // Golden Empire led on day 1 (82 vs 80): previous-order rank data must
    // be reconstructible from scores[1] exactly as the client does it.
    const golden = classes.worldClass[1];
    assert.equal(golden.scores[1].score, 82);
  });

  test("caption aggregates come from the latest show", () => {
    const crimson = classes.worldClass[0];
    assert.equal(crimson.GE_Total, 36); // 90 * 0.4
    assert.equal(crimson.Total_Score, 90);
    assert.equal(crimson.GE_Rank, 1);
  });

  test("trend uses the client's 2% thresholds with chronological values", () => {
    const crimson = classes.worldClass[0];
    assert.equal(crimson.trend.trend, "up"); // 80 -> 90
    assert.deepEqual(crimson.trend.values, [80, 90]);
    const steel = classes.aClass[0];
    assert.equal(steel.trend.trend, "stable"); // single show
  });

  test("SoundSport is excluded from classes and score stats but counted active", () => {
    assert.equal(classes.soundSport, undefined);
    assert.equal(summary.stats.corpsActive, 4); // includes Bayou Brigade
    assert.equal(summary.stats.topScore, "90.000"); // not affected by SS 70
  });

  test("summary carries scored days and show count", () => {
    assert.deepEqual(summary.scoredDays, [1, 2]);
    assert.equal(summary.lastScoredDay, 2);
    assert.equal(summary.stats.recentShows, 2);
    assert.equal(summary.classCounts.worldClass, 2);
    assert.equal(summary.classCounts.aClass, 1);
  });

  test("handles legacy score field and empty input", () => {
    const legacy = buildSeasonStandings([
      {
        offSeasonDay: 3,
        shows: [{ results: [{ uid: "u9", corpsClass: "openClass", corpsName: "X", score: 61.5 }] }],
      },
    ]);
    assert.equal(legacy.classes.openClass[0].totalScore, 61.5);

    const empty = buildSeasonStandings([]);
    assert.deepEqual(empty.summary.scoredDays, []);
    assert.equal(empty.summary.stats.topScore, "-");
    assert.deepEqual(empty.classes, {});
  });

  test("history is capped at six entries", () => {
    const manyDays = Array.from({ length: 10 }, (_, i) => ({
      offSeasonDay: i + 1,
      shows: [{ results: [result("u1", "worldClass", "CC", 70 + i)] }],
    }));
    const { classes: capped } = buildSeasonStandings(manyDays);
    assert.equal(capped.worldClass[0].scores.length, 6);
    assert.equal(capped.worldClass[0].showCount, 10);
    assert.equal(capped.worldClass[0].scores[0].score, 79); // newest kept
  });
});
