// Off-season flutter: the tiny, deterministic per-caption variance that stops
// an off-season — a replay of a public archive — from being solved to the
// decimal before it starts. The live season never uses it.

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { flutterCaptionScore, OFF_SEASON_FLUTTER } = require("./scoringMath");
const { LIVE_SEASON_STRATEGY } = require("./scoring");

const SEED = "season-a|31|Blue Devils|2019|GE1";

describe("flutterCaptionScore", () => {
  test("is very minor: never more than the flutter, and rounded to 3 decimals", () => {
    // One grid step per caption: enough to re-order two lineups a caption
    // swap apart, never lineups a few tenths apart.
    assert.equal(OFF_SEASON_FLUTTER, 0.05);
    for (let i = 0; i < 500; i++) {
      const seed = `season|${i % 49}|Corps ${i}|2019|GE${i % 2 + 1}`;
      const score = 10 + (i % 90) / 10;
      const out = flutterCaptionScore(score, seed);
      assert.ok(Math.abs(out - score) <= OFF_SEASON_FLUTTER + 1e-9, `${out} strays from ${score}`);
      assert.equal(out, parseFloat(out.toFixed(3)));
    }
  });

  test("is deterministic for a seed, and different across seeds", () => {
    assert.equal(flutterCaptionScore(17.35, SEED), flutterCaptionScore(17.35, SEED));
    const nights = new Set();
    for (let day = 1; day <= 49; day++) {
      nights.add(flutterCaptionScore(17.35, `season-a|${day}|Blue Devils|2019|GE1`));
    }
    assert.ok(nights.size > 30, `expected the flutter to vary by night, got ${nights.size} values`);
    assert.notEqual(
      flutterCaptionScore(17.35, SEED),
      flutterCaptionScore(17.35, SEED.replace("season-a", "season-b"))
    );
  });

  test("is zero-mean: it does not systematically help or hurt a caption", () => {
    let sum = 0;
    const n = 5000;
    for (let i = 0; i < n; i++) sum += flutterCaptionScore(15, `s|${i}|c|2019|B`) - 15;
    assert.ok(Math.abs(sum / n) < OFF_SEASON_FLUTTER / 10, `mean offset ${sum / n}`);
  });

  test("can re-order two captions one grid step apart, never three", () => {
    // Real caption scores sit on a 0.05 grid. A one-step gap is inside the
    // flutter's reach — that is the surprise the off-season needs — while a
    // three-step gap (0.15) can never be closed by ±0.05 on each side.
    let flipped = 0;
    for (let i = 0; i < 200; i++) {
      const a = flutterCaptionScore(17.35, `s|${i}|A|2019|GE1`);
      const b = flutterCaptionScore(17.3, `s|${i}|B|2019|GE1`);
      if (b > a) flipped++;
      assert.ok(flutterCaptionScore(17.45, `s|${i}|A|2019|GE1`) > b);
    }
    assert.ok(flipped > 0 && flipped < 100, `flipped ${flipped}/200`);
  });

  test("leaves 'no data' alone and stays inside the caption range", () => {
    assert.equal(flutterCaptionScore(0, SEED), 0);
    assert.equal(flutterCaptionScore(-1, SEED), -1);
    assert.equal(flutterCaptionScore(NaN, SEED), NaN);
    for (let i = 0; i < 100; i++) {
      const top = flutterCaptionScore(20, `s|${i}|c|2019|GE1`);
      assert.ok(top <= 20 && top > 0);
      const bottom = flutterCaptionScore(0.005, `s|${i}|c|2019|GE1`);
      assert.ok(bottom > 0);
    }
  });

  test("an empty seed applies no flutter", () => {
    assert.equal(flutterCaptionScore(17.35, ""), 17.35);
  });
});

describe("the live season stays exact", () => {
  test("a live night scores exactly what DCI published, whatever the season", () => {
    const historicalData = { 2026: [
      { offSeasonDay: 31, eventName: "DCI Southwestern", scores: [
        { corps: "Blue Devils", captions: { GE1: 18.637 } },
      ] },
    ] };
    for (const seasonUid of ["live-2026", "live-2026-reprocess"]) {
      const base = LIVE_SEASON_STRATEGY.baseScore({
        seasonData: { seasonYear: 2026, seasonUid }, scoredDay: 31, historicalData,
      });
      assert.equal(base("Blue Devils", "2025", "GE1"), 18.637);
    }
  });
});
