// Caption-validity guard for the Fantasy scores generator.
//
// A caption value only counts as a real result when it is strictly positive
// and within the 20-point ceiling. Two kinds of junk must be ignored, never
// used:
//   - 0: the caption was NOT scored that night. Reduced (5-judge) panels,
//     common on 2008-2019 early-season shows, leave whole captions at 0.
//   - > 20: a parse artifact — a handful of archived rows carry a total or
//     subtotal in a caption field (MA=143.3, GE1=115.3, CG=147, ...).
//
// Before this guard the runtime accepted any value > 0: an out-of-range value
// was returned as the corps' "real" score, then flattened by scoring.js's
// Math.min(20, ...) to a fake-perfect 20.000, and it poisoned the corps'
// projection fit. This pins the guard on both synthetic inputs and the real
// committed corpus.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const {
  isValidCaptionScore,
  getScoreForDay,
  getMostRecentScoreBeforeDay,
  countDataPointsForCorps,
  CAPTION_MAX,
} = require("./scoringMath");

const CAPTIONS = ["GE1", "GE2", "VP", "VA", "CG", "B", "MA", "P"];
const CORPUS_DIR = path.join(__dirname, "../../pressboxImporter/output");
const SEASONS = [2012, 2015, 2019, 2024]; // reduced-panel eras + a clean year

describe("isValidCaptionScore", () => {
  test("accepts strictly positive values up to the ceiling", () => {
    for (const v of [0.05, 1, 13.6, 19.95, CAPTION_MAX]) {
      assert.equal(isValidCaptionScore(v), true, `${v} should be valid`);
    }
  });

  test("rejects zero, negatives, over-ceiling, and non-finite/non-number", () => {
    for (const v of [0, -1, CAPTION_MAX + 0.001, 24.5, 147, NaN, Infinity, -Infinity, null, undefined, "15"]) {
      assert.equal(isValidCaptionScore(v), false, `${String(v)} should be invalid`);
    }
  });
});

describe("out-of-range caption values are never returned as real scores", () => {
  const year = "2019";

  test("getScoreForDay skips an out-of-range value (would have been capped to 20.000)", () => {
    // A single reduced/parse-error row: the only GE1 on the day is 147.
    const historicalData = {
      [year]: [{ offSeasonDay: 9, scores: [{ corps: "Test Corps", captions: { GE1: 147 } }] }],
    };
    assert.equal(getScoreForDay(9, "Test Corps", year, "GE1", historicalData), null);
  });

  test("getScoreForDay still returns a legitimate in-range value", () => {
    const historicalData = {
      [year]: [{ offSeasonDay: 9, scores: [{ corps: "Test Corps", captions: { GE1: 16.1 } }] }],
    };
    assert.equal(getScoreForDay(9, "Test Corps", year, "GE1", historicalData), 16.1);
  });

  test("a valid row on the same day is preferred over an out-of-range one", () => {
    const historicalData = {
      [year]: [
        { offSeasonDay: 9, scores: [{ corps: "Test Corps", captions: { GE1: 147 } }] },
        { offSeasonDay: 9, scores: [{ corps: "Test Corps", captions: { GE1: 15.4 } }] },
      ],
    };
    assert.equal(getScoreForDay(9, "Test Corps", year, "GE1", historicalData), 15.4);
  });

  test("carry-forward and data-point count ignore out-of-range and zero values", () => {
    const historicalData = {
      [year]: [
        { offSeasonDay: 5, scores: [{ corps: "Test Corps", captions: { CG: 147 } }] }, // parse artifact
        { offSeasonDay: 6, scores: [{ corps: "Test Corps", captions: { CG: 0 } }] }, // not scored
        { offSeasonDay: 7, scores: [{ corps: "Test Corps", captions: { CG: 14.2 } }] }, // real
      ],
    };
    assert.equal(getMostRecentScoreBeforeDay(9, "Test Corps", year, "CG", historicalData), 14.2);
    assert.equal(countDataPointsForCorps("Test Corps", year, "CG", historicalData), 1);
  });
});

describe("real corpus never yields an out-of-range real score", () => {
  for (const year of SEASONS) {
    test(`${year}: getScoreForDay returns only null or an in-range value`, () => {
      const file = path.join(CORPUS_DIR, `historical_scores_${year}.json`);
      const events = JSON.parse(fs.readFileSync(file, "utf-8")).data || [];
      const historicalData = { [String(year)]: events };

      let checked = 0;
      for (const event of events) {
        const day = event.offSeasonDay;
        if (day == null) continue;
        for (const row of event.scores || []) {
          if (!row.captions) continue;
          for (const caption of CAPTIONS) {
            const resolved = getScoreForDay(day, row.corps, year, caption, historicalData);
            checked++;
            assert.ok(
              resolved === null || (resolved > 0 && resolved <= CAPTION_MAX),
              `${year} d${day} ${row.corps} ${caption} resolved to ${resolved}`
            );
          }
        }
      }
      assert.ok(checked > 500, `only ${checked} lookups for ${year}`);
    });
  }

  test("the corpus really does carry out-of-range values for the guard to catch", () => {
    // Prove the guard is load-bearing, not decorative: at least one archived
    // caption cell across the corpus holds a value above the ceiling, and none
    // of them ever escape getScoreForDay as a real score.
    let outOfRangeInData = 0;
    let escaped = 0;
    for (const file of fs.readdirSync(CORPUS_DIR)) {
      const m = file.match(/^historical_scores_(\d{4})\.json$/);
      if (!m) continue;
      const year = m[1];
      const events = JSON.parse(fs.readFileSync(path.join(CORPUS_DIR, file), "utf-8")).data || [];
      const historicalData = { [year]: events };
      for (const event of events) {
        const day = event.offSeasonDay;
        if (day == null) continue;
        for (const row of event.scores || []) {
          if (!row.captions) continue;
          for (const caption of CAPTIONS) {
            const raw = row.captions[caption];
            if (typeof raw === "number" && raw > CAPTION_MAX) {
              outOfRangeInData++;
              const resolved = getScoreForDay(day, row.corps, year, caption, historicalData);
              if (resolved !== null && resolved > CAPTION_MAX) escaped++;
            }
          }
        }
      }
    }
    assert.ok(outOfRangeInData > 0, "corpus should contain out-of-range caption values");
    assert.equal(escaped, 0, `${escaped} out-of-range value(s) escaped as a real score`);
  });
});
