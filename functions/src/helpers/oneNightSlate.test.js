// One-Night Slate: the week decided by each director's best single show.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { resolveOneNight, ONE_NIGHT_SEASON_COST } = require("./oneNightSlate");
const { SCORING_FORMATS, activeScoringFormat } = require("./captionWars");
const { buildWeeklyScoreIndex, decideHeadToHead } = require("./leagueScoring");

const day = (results) => ({ exists: true, data: () => ({ shows: [{ results }] }) });

describe("resolveOneNight", () => {
  const entry = (best, score, bestShowName = null) => ({ best, score, bestShowName });

  test("the higher single show wins, whatever the totals say", () => {
    // The grinder summed 162 over two shows; the one-night director peaked at 85.
    const result = resolveOneNight("grinder", "peak", entry(82, 162), entry(85, 85));
    assert.equal(result.winner, "peak");
  });

  test("equal peaks fall to the weekly total — the fuller week takes it", () => {
    const result = resolveOneNight("a", "b", entry(85, 165), entry(85, 85));
    assert.equal(result.winner, "a");
  });

  test("equal peaks and equal totals tie", () => {
    const result = resolveOneNight("a", "b", entry(85, 85), entry(85, 85));
    assert.equal(result.winner, "tie");
  });

  test("sitting the week out is a forfeit here too", () => {
    const result = resolveOneNight("showed", "ghost", entry(60, 120), entry(0, 0));
    assert.equal(result.winner, "showed");
  });

  test("two forfeits tie", () => {
    assert.equal(resolveOneNight("a", "b", entry(0, 0), entry(0, 0)).winner, "tie");
  });

  test("the stored best block names each side's night", () => {
    const { best } = resolveOneNight(
      "a",
      "b",
      entry(85, 165, "DCI Southwestern"),
      entry(80, 80, "Show of Shows")
    );
    assert.deepEqual(best.a, { score: 85, showName: "DCI Southwestern" });
    assert.deepEqual(best.b, { score: 80, showName: "Show of Shows" });
  });

  test("the season cost is a positive recurring sink", () => {
    assert.ok(ONE_NIGHT_SEASON_COST > 0);
  });
});

describe("weekly index best-show tracking", () => {
  test("tracks the peak and its show name alongside the sum", () => {
    const { index } = buildWeeklyScoreIndex([
      {
        exists: true,
        data: () => ({
          shows: [
            {
              eventName: "Tuesday Invitational",
              results: [{ uid: "a", corpsClass: "worldClass", totalScore: 80 }],
            },
          ],
        }),
      },
      {
        exists: true,
        data: () => ({
          shows: [
            {
              eventName: "Saturday Regional",
              results: [{ uid: "a", corpsClass: "worldClass", totalScore: 84.5 }],
            },
          ],
        }),
      },
    ]);
    const a = index.get("a_worldClass");
    assert.equal(a.score, 164.5);
    assert.equal(a.best, 84.5);
    assert.equal(a.bestShowName, "Saturday Regional");
  });
});

describe("activeScoringFormat", () => {
  const league = (scoringFormat, scoringFormatSeasonUid) => ({
    settings: { scoringFormat, scoringFormatSeasonUid },
  });

  test("returns the bought format for the season it was bought for", () => {
    assert.equal(activeScoringFormat(league("oneNight", "s1"), "s1"), SCORING_FORMATS.ONE_NIGHT);
    assert.equal(
      activeScoringFormat(league("captionWars", "s1"), "s1"),
      SCORING_FORMATS.CAPTION_WARS
    );
  });

  test("a stale season pin fails back to totals", () => {
    assert.equal(activeScoringFormat(league("oneNight", "s0"), "s1"), SCORING_FORMATS.TOTAL);
  });

  test("an unknown stored value fails back to totals", () => {
    assert.equal(activeScoringFormat(league("survivor", "s1"), "s1"), SCORING_FORMATS.TOTAL);
  });

  test("no settings at all is the default", () => {
    assert.equal(activeScoringFormat({}, "s1"), SCORING_FORMATS.TOTAL);
    assert.equal(activeScoringFormat(null, "s1"), SCORING_FORMATS.TOTAL);
  });
});

describe("decideHeadToHead with formats", () => {
  // grinder plays twice (82 + 80 = 162, peak 82); peak plays once at 85.
  const index = () =>
    buildWeeklyScoreIndex([
      day([
        { uid: "grinder", corpsClass: "worldClass", totalScore: 82 },
        { uid: "peak", corpsClass: "worldClass", totalScore: 85 },
      ]),
      day([{ uid: "grinder", corpsClass: "worldClass", totalScore: 80 }]),
    ]).index;

  test("oneNight decides on the peak, totals decide by default", () => {
    const matchup = { pair: ["grinder", "peak"] };
    const byTotals = decideHeadToHead(matchup, "worldClass", index());
    assert.equal(byTotals.winner, "grinder"); // 162 > 85
    const byPeak = decideHeadToHead(matchup, "worldClass", index(), SCORING_FORMATS.ONE_NIGHT);
    assert.equal(byPeak.winner, "peak"); // 85 > 82
    assert.deepEqual(byPeak.best.peak, { score: 85, showName: null });
  });

  test("a cross-class matchup resolves on percentile under every format", () => {
    const crossIndex = buildWeeklyScoreIndex([
      day([
        { uid: "wc", corpsClass: "worldClass", totalScore: 85 },
        { uid: "wc2", corpsClass: "worldClass", totalScore: 90 },
        { uid: "ss", corpsClass: "soundSport", totalScore: 62 },
      ]),
    ]).index;
    const matchup = { pair: ["wc", "ss"], classes: { wc: "worldClass", ss: "soundSport" } };
    for (const format of Object.values(SCORING_FORMATS)) {
      const decided = decideHeadToHead(matchup, "worldClass", crossIndex, format);
      assert.equal(decided.winner, "ss", `format ${format}`);
      assert.equal(decided.captions, null, `format ${format}`);
      assert.equal(decided.best, null, `format ${format}`);
    }
  });

  test("captionWars still returns its captions block through the shared rule", () => {
    const cwIndex = buildWeeklyScoreIndex([
      day([
        { uid: "a", corpsClass: "worldClass", totalScore: 90, geScore: 38, visualScore: 26, musicScore: 26 },
        { uid: "b", corpsClass: "worldClass", totalScore: 88, geScore: 30, visualScore: 29, musicScore: 29 },
      ]),
    ]).index;
    const decided = decideHeadToHead(
      { pair: ["a", "b"] },
      "worldClass",
      cwIndex,
      SCORING_FORMATS.CAPTION_WARS
    );
    // b takes Visual and Music 2-1 despite the lower total.
    assert.equal(decided.winner, "b");
    assert.ok(decided.captions);
    assert.equal(decided.captions.tally.b, 2);
  });
});
