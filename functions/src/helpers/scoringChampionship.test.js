// World Championship week (days 47-49) is scored on real results only.
//
// Most of the field stops competing partway through it — 25 corps march
// Semifinals, 12 march Finals — so a projection on those nights would invent a
// championship sheet for a corps that had already packed up. Instead a corps
// with no result for the night carries the last score it really earned,
// verbatim.
//
// These tests drive the real off-season and live-season base-score strategies,
// so they exercise the decision the nightly run actually makes.

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  OFF_SEASON_STRATEGY,
  LIVE_SEASON_STRATEGY,
  CHAMPIONSHIP_CARRY_FORWARD_DAYS,
} = require("./scoring");
const { clearRegressionCache } = require("./scoringMath");

const PRELIMS = 47;
const SEMIFINALS = 48;
const FINALS = 49;

/** One historical_scores event. */
function event(day, name, scores) {
  return { offSeasonDay: day, eventName: name, scores };
}

/** A corps' row with a single caption, at whatever precision DCI published. */
function row(corps, ge1) {
  return { corps, captions: { GE1: ge1, GE2: ge1, VP: ge1, VA: ge1, CG: ge1, B: ge1, MA: ge1, P: ge1 } };
}

// A championship week where the field thins out exactly as DCI's does.
//   Blue Devils   marched all three nights
//   Colts         made Semifinals, missed the Finals cut (the "17th place" case)
//   Genesis       did not survive Prelims
const CHAMPIONSHIP_WEEK = {
  2025: [
    event(40, "Regional", [row("Blue Devils", 18.0), row("Colts", 16.0), row("Genesis", 14.0)]),
    event(PRELIMS, "World Championship Prelims", [
      row("Blue Devils", 19.1), row("Colts", 17.35), row("Genesis", 15.275),
    ]),
    event(SEMIFINALS, "World Championship Semifinals", [
      row("Blue Devils", 19.4), row("Colts", 17.625),
    ]),
    event(FINALS, "World Championship Finals", [row("Blue Devils", 19.65)]),
  ],
};

const offSeason = (scoredDay, historicalData, sources) =>
  OFF_SEASON_STRATEGY.baseScore({ scoredDay, historicalData, sources });

const liveSeason = (scoredDay, historicalData, sources, seasonYear = 2025) =>
  LIVE_SEASON_STRATEGY.baseScore({
    seasonData: { seasonYear }, scoredDay, historicalData, sources,
  });

describe("championship carry-forward days", () => {
  test("covers World Championship Prelims, Semifinals and Finals", () => {
    assert.deepEqual([...CHAMPIONSHIP_CARRY_FORWARD_DAYS].sort(), [47, 48, 49]);
  });
});

describe("off-season championship scoring", () => {
  test("a corps that marched the night keeps its own result", () => {
    clearRegressionCache();
    const score = offSeason(FINALS, CHAMPIONSHIP_WEEK)("Blue Devils", "2025", "GE1");
    assert.equal(score, 19.65);
  });

  // The case as specified: 17th place on Finals night scores its Semifinals
  // sheet, unmodified — not rounded to the projection grid, not jittered.
  test("a corps that missed the Finals cut carries its Semifinals score", () => {
    clearRegressionCache();
    const score = offSeason(FINALS, CHAMPIONSHIP_WEEK)("Colts", "2025", "GE1");
    assert.equal(score, 17.625);
  });

  test("a corps eliminated at Prelims carries it through Semifinals AND Finals", () => {
    clearRegressionCache();
    assert.equal(offSeason(SEMIFINALS, CHAMPIONSHIP_WEEK)("Genesis", "2025", "GE1"), 15.275);
    clearRegressionCache();
    assert.equal(offSeason(FINALS, CHAMPIONSHIP_WEEK)("Genesis", "2025", "GE1"), 15.275);
  });

  test("the carried score is never nudged, whatever its precision", () => {
    const odd = { 2025: [
      event(PRELIMS, "Prelims", [row("Colts", 17.637)]),
    ] };
    for (let i = 0; i < 10; i++) {
      clearRegressionCache();
      assert.equal(offSeason(FINALS, odd)("Colts", "2025", "GE1"), 17.637);
    }
  });

  test("carrying looks backwards only — never at a later night", () => {
    // On Semifinals night, Blue Devils' Finals result does not exist yet and
    // must not leak backwards even when the archive holds the whole season.
    clearRegressionCache();
    const noSemis = { 2025: [
      event(PRELIMS, "Prelims", [row("Blue Devils", 19.1)]),
      event(FINALS, "Finals", [row("Blue Devils", 19.65)]),
    ] };
    assert.equal(offSeason(SEMIFINALS, noSemis)("Blue Devils", "2025", "GE1"), 19.1);
  });

  test("an ordinary competition day still projects", () => {
    clearRegressionCache();
    const day44 = offSeason(44, CHAMPIONSHIP_WEEK)("Colts", "2025", "GE1");
    // Projected from the corps' one earlier result, so it is near it but is
    // not simply the last real number carried forward.
    assert.ok(day44 > 0, "expected a projected score");
    assert.notEqual(day44, 16.0);
  });

  test("counts carried captions separately from real and projected", () => {
    clearRegressionCache();
    const sources = { real: 0, projected: 0, carried: 0 };
    const base = offSeason(FINALS, CHAMPIONSHIP_WEEK, sources);
    base("Blue Devils", "2025", "GE1");  // marched Finals
    base("Colts", "2025", "GE1");        // carries Semifinals
    base("Genesis", "2025", "GE1");      // carries Prelims
    assert.deepEqual(sources, { real: 1, projected: 0, carried: 2 });
  });

  test("a corps with no result all season still falls back to a projection", () => {
    clearRegressionCache();
    const sources = { real: 0, projected: 0, carried: 0 };
    const score = offSeason(FINALS, CHAMPIONSHIP_WEEK, sources)("Nobody", "2025", "GE1");
    assert.equal(score, 0);
    assert.equal(sources.projected, 1);
    assert.equal(sources.carried, 0);
  });
});

describe("live-season championship scoring", () => {
  test("a corps that marched the night keeps its own result", () => {
    clearRegressionCache();
    const score = liveSeason(FINALS, CHAMPIONSHIP_WEEK)("Blue Devils", "2024", "GE1");
    assert.equal(score, 19.65);
  });

  test("a corps that missed the cut carries its most recent live score", () => {
    clearRegressionCache();
    assert.equal(liveSeason(FINALS, CHAMPIONSHIP_WEEK)("Colts", "2024", "GE1"), 17.625);
    clearRegressionCache();
    assert.equal(liveSeason(SEMIFINALS, CHAMPIONSHIP_WEEK)("Genesis", "2024", "GE1"), 15.275);
  });

  test("the live season is preferred over the corps' source year", () => {
    clearRegressionCache();
    const bothYears = {
      2025: [event(PRELIMS, "Prelims", [row("Colts", 17.35)])],
      2024: [event(FINALS, "Finals", [row("Colts", 18.9)])],
    };
    // Current-year Prelims wins over last year's Finals sheet.
    assert.equal(liveSeason(FINALS, bothYears)("Colts", "2024", "GE1"), 17.35);
  });

  test("falls back to the source year for a corps that did not tour", () => {
    clearRegressionCache();
    const didNotTour = {
      2025: [event(PRELIMS, "Prelims", [row("Blue Devils", 19.1)])],
      2024: [event(FINALS, "Finals", [row("Colts", 18.9)])],
    };
    assert.equal(liveSeason(FINALS, didNotTour)("Colts", "2024", "GE1"), 18.9);
  });
});
