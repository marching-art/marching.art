// Season-start assessment (§5.7 + §5.13): the three-axis evaluation a corps gets
// against last season's field — class (division), status (reputation tier), and
// the separate activity rating that never touches reputation.
//
// Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const assessment = require("./assessment");

const cfg = {
  reputation: {
    tierThresholds: { 1: 0, 2: 15, 3: 30, 4: 45, 5: 60, 6: 75, 7: 90 },
  },
  scoring: {
    // tierForReputation only reads reputation.tierThresholds; nothing here is used
    // by the assessment builder directly, but kept for parity with real cfg.
  },
  assessment: {
    activity: {
      weights: { activeDays: 1.0, restDays: 0.6, blocksAllocated: 0.12, showsAttended: 1.5 },
      autoRunPenalty: 0.5,
      tiers: [
        { key: "dormant", label: "Dormant", minPercentile: 0 },
        { key: "casual", label: "Casual", minPercentile: 20 },
        { key: "committed", label: "Committed", minPercentile: 45 },
        { key: "dedicated", label: "Dedicated", minPercentile: 72 },
        { key: "ironCorps", label: "Iron Corps", minPercentile: 90 },
      ],
      recognition: {
        ironCorps: { coin: 500, xp: 300 },
        dedicated: { coin: 200, xp: 120 },
      },
    },
  },
};

describe("activity score (§5.13 separate axis)", () => {
  test("an active director outscores an absent one", () => {
    const active = assessment.activityScore(
      { activeDays: 40, restDays: 6, blocksAllocated: 300, showsAttended: 12, autoRunDays: 3 },
      cfg
    );
    const absent = assessment.activityScore(
      { activeDays: 0, restDays: 0, blocksAllocated: 0, showsAttended: 0, autoRunDays: 45 },
      cfg
    );
    assert.ok(active > absent, `active ${active} > absent ${absent}`);
  });

  test("a fully-absent (all auto-run) corps floors at 0, never negative", () => {
    const score = assessment.activityScore({ autoRunDays: 49 }, cfg);
    assert.equal(score, 0);
  });

  test("leaning on the assistant is penalized vs. playing the same days", () => {
    const played = assessment.activityScore({ activeDays: 20, blocksAllocated: 100 }, cfg);
    const autopiloted = assessment.activityScore(
      { activeDays: 0, autoRunDays: 20, blocksAllocated: 100 },
      cfg
    );
    assert.ok(played > autopiloted);
  });
});

describe("field-relative activity ratings", () => {
  test("the busiest corps lands in the top tier, the idlest in the bottom", () => {
    const pool = [];
    for (let i = 0; i < 20; i++) {
      pool.push({ uid: `u${i}`, activity: { activeDays: i * 2, blocksAllocated: i * 10 } });
    }
    const ratings = assessment.buildActivityRatings(pool, cfg);
    assert.equal(ratings.get("u19").tier, "ironCorps");
    assert.equal(ratings.get("u19").recognition.coin, 500);
    assert.equal(ratings.get("u0").tier, "dormant");
    assert.equal(ratings.get("u0").recognition, null);
  });

  test("percentile rank places ties at half weight and rank is monotonic", () => {
    const pool = [
      { uid: "a", activity: { activeDays: 10 } },
      { uid: "b", activity: { activeDays: 10 } },
      { uid: "c", activity: { activeDays: 30 } },
      { uid: "d", activity: { activeDays: 0 } },
    ];
    const ratings = assessment.buildActivityRatings(pool, cfg);
    assert.ok(ratings.get("c").percentile > ratings.get("a").percentile);
    assert.ok(ratings.get("a").percentile > ratings.get("d").percentile);
    // a and b tie exactly.
    assert.equal(ratings.get("a").percentile, ratings.get("b").percentile);
  });

  test("a lone corps is top-rated (nobody to place it behind)", () => {
    const ratings = assessment.buildActivityRatings([{ uid: "solo", activity: { activeDays: 1 } }], cfg);
    assert.equal(ratings.get("solo").percentile, 100);
  });
});

describe("class + status change detection", () => {
  test("division change kind", () => {
    assert.equal(assessment.divisionChangeKind("aClass", "openClass"), "promoted");
    assert.equal(assessment.divisionChangeKind("worldClass", "openClass"), "relegated");
    assert.equal(assessment.divisionChangeKind("openClass", "openClass"), "held");
  });

  test("tier labels name the organizational level", () => {
    assert.equal(assessment.tierLabel(1), "Community Corps");
    assert.equal(assessment.tierLabel(7), "Champion Status");
  });

  test("peer percentile: rank 1 of N is 100, last is 0", () => {
    assert.equal(assessment.peerPercentileFromRank(1, 10), 100);
    assert.equal(assessment.peerPercentileFromRank(10, 10), 0);
    assert.equal(assessment.peerPercentileFromRank(null, 10), null);
  });
});

describe("buildAssessment: the unified object", () => {
  const state = {
    corpsName: "Rohn Regiment",
    lastTotal: 88.4,
    lastScoredDay: 49,
    seasonRank: 2,
    seasonRankOf: 16,
    medals: { silver: 1 },
    division: "openClass",
    seasonsPlayed: 4,
  };

  test("a promotion season reports class up, status up, and peer standing", () => {
    const result = assessment.buildAssessment(
      {
        seasonUid: "s5",
        seasonIndex: 5,
        assessedForSeasonUid: "s6",
        state,
        reputationBefore: 44, // tier 3
        reputationAfter: 52, // tier 4
        finalsPerformance: 96,
        previousDivision: "openClass",
        nextDivision: "worldClass",
        divisionCutoffs: { openClass: 80, worldClass: 90 },
        activityRating: { tier: "ironCorps", label: "Iron Corps", percentile: 94, recognition: { coin: 500, xp: 300 } },
        missedSeasons: 0,
        heritageApplied: false,
        decisions: ["continue", "retire", "startNew"],
      },
      cfg
    );

    assert.equal(result.competed, true);
    assert.equal(result.class.change, "promoted");
    assert.equal(result.class.nextLabel, "World Class");
    assert.equal(result.status.change, "promoted");
    assert.equal(result.status.previousLabel, "National Contender");
    assert.equal(result.status.nextLabel, "Finalist");
    assert.equal(result.status.reputationDelta, 8);
    assert.equal(result.performance.peerPercentile, assessment.peerPercentileFromRank(2, 16));
    assert.equal(result.activity.tier, "ironCorps");
    assert.deepEqual(result.decisions, ["continue", "retire", "startNew"]);
  });

  test("a registered-but-never-performed corps is marked did-not-compete", () => {
    const result = assessment.buildAssessment(
      {
        seasonUid: "s5",
        assessedForSeasonUid: "s6",
        state: { corpsName: "Ghost", lastTotal: null, division: "aClass" },
        reputationBefore: 10,
        reputationAfter: 10,
        finalsPerformance: null,
        previousDivision: "aClass",
        nextDivision: "aClass",
        decisions: ["continue", "retire", "startNew"],
      },
      cfg
    );
    assert.equal(result.competed, false);
    assert.equal(result.class.change, "held");
    assert.equal(result.status.change, "held");
    assert.equal(result.performance.peerPercentile, null);
    assert.equal(result.activity, null);
  });

  test("dormancy context surfaces when seasons were missed", () => {
    const result = assessment.buildAssessment(
      {
        seasonUid: "s9",
        assessedForSeasonUid: "s10",
        state: { ...state, division: "worldClass" },
        reputationBefore: 70,
        reputationAfter: 61,
        finalsPerformance: 50,
        previousDivision: "worldClass",
        nextDivision: "openClass",
        missedSeasons: 2,
        heritageApplied: true,
        decisions: ["continue", "retire", "startNew", "unretire"],
      },
      cfg
    );
    assert.equal(result.context.missedSeasons, 2);
    assert.equal(result.context.dormancyApplied, true);
    assert.equal(result.status.heritageApplied, true);
    assert.equal(result.class.change, "relegated");
  });
});
