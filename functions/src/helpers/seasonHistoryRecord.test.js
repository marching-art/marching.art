const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { HEAVY_FIELDS, seasonDetailId, splitSeasonRecord } = require("./seasonHistoryRecord");

// A full fantasy record shaped exactly as helpers/season.js archives it.
function fullRecord(overrides = {}) {
  return {
    seasonId: "adagio_2025-26",
    seasonName: "adagio_2025-26",
    corpsClass: "worldClass",
    corpsName: "The Cavaliers",
    location: "Rosemont, IL",
    showConcept: { theme: "Ascension", musicSource: "Holst", drillStyle: "Symmetric" },
    lineup: { GE1: "Blue Devils|2024", GE2: "Bluecoats|2023" },
    selectedShows: { week1: ["show-a"], week2: ["show-b"] },
    weeklyScores: {},
    totalSeasonScore: 95.7,
    showsAttended: 12,
    highestWeeklyScore: 45.2,
    placement: 1,
    archivedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("splitSeasonRecord", () => {
  test("heavy fields move to detail, everything else stays in the summary", () => {
    const { summary, detail } = splitSeasonRecord(fullRecord());

    for (const field of HEAVY_FIELDS) {
      assert.equal(summary[field], undefined, `${field} must not remain on the summary row`);
    }
    assert.deepEqual(detail.lineup, { GE1: "Blue Devils|2024", GE2: "Bluecoats|2023" });
    assert.deepEqual(detail.selectedShows, { week1: ["show-a"], week2: ["show-b"] });
    // weeklyScores was empty, so it is not carried into detail.
    assert.equal("weeklyScores" in detail, false);

    // Summary keeps everything the chart / rating / aggregates read.
    assert.equal(summary.seasonId, "adagio_2025-26");
    assert.equal(summary.placement, 1);
    assert.equal(summary.totalSeasonScore, 95.7);
    assert.equal(summary.showsAttended, 12);
    assert.equal(summary.highestWeeklyScore, 45.2);
    assert.deepEqual(summary.showConcept, fullRecord().showConcept);
  });

  test("summary carries a weeks count derived from weeklyScores", () => {
    const empty = splitSeasonRecord(fullRecord());
    assert.equal(empty.summary.weeks, 0);

    const populated = splitSeasonRecord(
      fullRecord({ weeklyScores: { week1: 40, week2: 41, week3: 42 } })
    );
    assert.equal(populated.summary.weeks, 3);
    assert.deepEqual(populated.detail.weeklyScores, { week1: 40, week2: 41, week3: 42 });
  });

  test("a record with no heavy content produces a null detail (Podium-style row)", () => {
    const { summary, detail } = splitSeasonRecord({
      seasonId: "s10",
      corpsClass: "podiumClass",
      corpsName: "Podium Corps",
      placement: 2,
      finalScore: 88.1,
      medals: { gold: 3 },
    });
    assert.equal(detail, null);
    assert.equal(summary.corpsClass, "podiumClass");
    assert.deepEqual(summary.medals, { gold: 3 });
    assert.equal(summary.weeks, 0);
  });

  test("empty heavy objects are dropped, not carried as empty detail", () => {
    const { detail } = splitSeasonRecord(
      fullRecord({ lineup: {}, selectedShows: {}, weeklyScores: {} })
    );
    assert.equal(detail, null);
  });

  test("splitting is idempotent — re-splitting a slimmed summary changes nothing", () => {
    const once = splitSeasonRecord(fullRecord());
    const twice = splitSeasonRecord(once.summary);
    assert.equal(twice.detail, null);
    assert.deepEqual(twice.summary, once.summary);
  });

  test("re-splitting preserves a weeks count after weeklyScores has moved to detail", () => {
    // First pass: weeklyScores present → weeks computed, map extracted.
    const once = splitSeasonRecord(fullRecord({ weeklyScores: { w1: 1, w2: 2, w3: 3 } }));
    assert.equal(once.summary.weeks, 3);
    assert.equal("weeklyScores" in once.summary, false);
    // Second pass over the slimmed row: no weeklyScores, but weeks survives.
    const twice = splitSeasonRecord(once.summary);
    assert.equal(twice.summary.weeks, 3);
    assert.equal(twice.detail, null);
  });
});

describe("seasonDetailId", () => {
  test("keys by season and competed class", () => {
    assert.equal(seasonDetailId("adagio_2025-26", "worldClass"), "adagio_2025-26__worldClass");
  });

  test("same season, different classes are distinct docs", () => {
    assert.notEqual(
      seasonDetailId("s5", "worldClass"),
      seasonDetailId("s5", "aClass")
    );
  });
});
