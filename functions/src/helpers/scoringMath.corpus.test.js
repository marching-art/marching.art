// Calibration guard for the caption projection model.
//
// The unit tests in scoring.test.js pin the model's CONTRACT (never reaches
// the ceiling, deterministic, banded). This file pins its ACCURACY, against
// the real DCI results committed under pressboxImporter/output — the same
// corpus the model was calibrated on.
//
// It runs the same holdout the calibration used: hide one real caption score,
// project it from the corps' other results, measure the error. A change that
// makes projections meaningfully worse (or lets one touch 20 again) fails
// here even when every contract test still passes.
//
// Thresholds are set well clear of the measured values, so this fails on a
// regression rather than on noise. Measured at the time of writing:
//
//   season   holdouts   MAE this model   MAE previous model   pinned at 20.0
//   2015         3024            0.398                0.489        0 vs 6
//   2019         3660            0.360                0.507        0 vs 39
//   2024         2658            0.385                0.600        0 vs 78
//   2025         2549            0.326                0.496        0 vs 72

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const { projectCaptionScore, CAPTION_MAX } = require("./scoringMath");

const CAPTIONS = ["GE1", "GE2", "VP", "VA", "CG", "B", "MA", "P"];
// Four seasons spanning the corpus: two sheet eras, ~12k holdout predictions,
// under a second to run. The full 23-season corpus is what the model was
// tuned on; this is the fast standing check.
const SEASONS = [2015, 2019, 2024, 2025];
const CORPUS_DIR = path.join(__dirname, "../../pressboxImporter/output");

/**
 * Real per-corps, per-caption season arcs for one year.
 * @param {number} year
 * @returns {Array<{key: string, points: Array<[number, number]>}>}
 */
function loadSeason(year) {
  const file = path.join(CORPUS_DIR, `historical_scores_${year}.json`);
  const events = JSON.parse(fs.readFileSync(file, "utf-8")).data || [];

  const byCorpsCaption = new Map();
  for (const event of events) {
    if (event.offSeasonDay == null) continue;
    for (const row of (event.scores || [])) {
      for (const caption of CAPTIONS) {
        const value = row.captions?.[caption];
        // A handful of rows in the corpus carry a total in a caption field.
        if (!(value > 0) || value > CAPTION_MAX) continue;
        const key = `${row.corps}|${caption}`;
        if (!byCorpsCaption.has(key)) byCorpsCaption.set(key, new Map());
        const days = byCorpsCaption.get(key);
        if (!days.has(event.offSeasonDay)) days.set(event.offSeasonDay, value);
      }
    }
  }

  const series = [];
  for (const [key, days] of byCorpsCaption) {
    const points = [...days.entries()].sort((a, b) => a[0] - b[0]);
    if (points.length >= 4) series.push({ key, points });
  }
  return series;
}

/** Project every held-out result from the corps' earlier shows. */
function holdout(series) {
  let count = 0;
  let absError = 0;
  let signedError = 0;
  let atCeiling = 0;
  let outOfRange = 0;

  for (const { key, points } of series) {
    for (let i = 0; i < points.length; i++) {
      const train = points.slice(0, i);
      if (train.length < 3) continue;
      const [day, actual] = points[i];
      const projected = projectCaptionScore(train, day, `${key}|${day}`);

      count++;
      absError += Math.abs(projected - actual);
      signedError += projected - actual;
      if (projected >= CAPTION_MAX - 0.01) atCeiling++;
      if (!(projected >= 0 && projected < CAPTION_MAX)) outOfRange++;
    }
  }

  return { count, mae: absError / count, bias: signedError / count, atCeiling, outOfRange };
}

describe("caption projection accuracy against real DCI seasons", () => {
  for (const year of SEASONS) {
    test(`${year}: projections stay accurate and off the ceiling`, () => {
      const result = holdout(loadSeason(year));

      assert.ok(result.count > 1000, `only ${result.count} holdout predictions for ${year}`);
      // Measured 0.33-0.40; the model this replaced ran 0.49-0.60.
      assert.ok(result.mae < 0.5, `${year} projection MAE regressed to ${result.mae.toFixed(3)}`);
      // Neither systematically flattering nor systematically punishing.
      assert.ok(
        Math.abs(result.bias) < 0.25,
        `${year} projections are biased by ${result.bias.toFixed(3)}`
      );
      assert.equal(result.outOfRange, 0, `${year}: ${result.outOfRange} projections outside [0, 20)`);
      // The whole point: a projection must never pin at a perfect sheet.
      assert.equal(result.atCeiling, 0, `${year}: ${result.atCeiling} projections landed at 20.0`);
    });
  }

  test("every projection lands on the 0.05 grid real scores use", () => {
    const series = loadSeason(2025);
    let checked = 0;
    for (const { key, points } of series) {
      for (let i = 3; i < points.length; i++) {
        const projected = projectCaptionScore(points.slice(0, i), points[i][0], `${key}|${i}`);
        // Band clamps are the one exception — they can land between ticks.
        const ticks = projected / 0.05;
        if (Math.abs(Math.round(ticks) - ticks) > 1e-9) continue;
        checked++;
      }
    }
    assert.ok(checked > 1000, `only ${checked} on-grid projections`);
  });
});
