// Accuracy guards for the Podium curve miner (buildPodiumCurves.js). These run
// the REAL builder over the committed historical archive and assert the three
// properties the curves depend on:
//
//   1. Every completed season 2000-2025 present in the archive is accounted
//      for (no year silently dropped).
//   2. Zero caption scores are ignored — a 0 is "caption not scored that day",
//      not a real score, and must never pull the low percentiles toward 0.
//   3. The generated bands are internally accurate: percentiles are ordered
//      and every value sits inside its caption's valid range.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe, before } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { buildCurves, CAPTIONS, SEASON_DAYS } = require("./buildPodiumCurves");

const LOCAL_DATA_DIR = path.join(__dirname, "../../pressboxImporter/output");
const BAND_KEYS = ["p5", "p25", "p50", "p75", "p95", "max"];

// Which local seasons SHOULD feed the envelope: every historical_scores_YYYY
// file that reaches championship week (max offSeasonDay >= 45). Derived from
// the same archive the builder reads, so this stays honest as data is added.
function expectedCompletedYears() {
  const years = [];
  for (const file of fs.readdirSync(LOCAL_DATA_DIR)) {
    const m = file.match(/^historical_scores_(\d{4})\.json$/);
    if (!m) continue;
    const parsed = JSON.parse(fs.readFileSync(path.join(LOCAL_DATA_DIR, file), "utf8"));
    const maxDay = Math.max(0, ...(parsed.data || []).map((e) => e.offSeasonDay || 0));
    if (maxDay >= 45) years.push(m[1]);
  }
  return years.sort();
}

describe("buildPodiumCurves accuracy", () => {
  let out;
  before(async () => {
    // Local (non-Firestore) build over the committed pressboxImporter archive.
    out = await buildCurves(false);
  });

  test("accounts for every completed season 2000-2025 in the archive", () => {
    const expected = expectedCompletedYears();
    assert.ok(expected.length >= 20, `archive should carry 20+ completed seasons, saw ${expected.length}`);
    for (const year of expected) {
      assert.ok(out.meta.years.includes(year), `year ${year} completed but missing from curves`);
      assert.ok(Number(year) >= 2000 && Number(year) <= 2025, `year ${year} outside 2000-2025`);
    }
    // No duplicates, and nothing beyond the completed archive slipped in.
    assert.equal(new Set(out.meta.years).size, out.meta.years.length, "duplicate year in meta.years");
    assert.deepEqual(out.meta.years.slice().sort(), expected, "curve years must equal completed archive years");
  });

  test("ignores zero caption scores (low percentiles never collapse to 0)", () => {
    // VP/CG/B/P carry ~1.5k literal 0s across 2008-2018 (un-broken-out
    // sub-captions). If those were counted, early-season p5 would sit at ~0;
    // ignoring them keeps a realistic floor. Guard every caption's opening day.
    for (const caption of CAPTIONS) {
      const day1 = out.bands[caption][0];
      assert.ok(day1.p5 > 2, `${caption} day-1 p5 ${day1.p5} collapsed — zeros not ignored`);
      assert.ok(day1.p50 > 8, `${caption} day-1 p50 ${day1.p50} depressed — zeros not ignored`);
    }
  });

  test("caption bands are ordered and within the 0-20 range every day", () => {
    for (const caption of CAPTIONS) {
      const band = out.bands[caption];
      assert.equal(band.length, SEASON_DAYS, `${caption} band must span ${SEASON_DAYS} days`);
      band.forEach((entry, i) => {
        for (const key of BAND_KEYS) {
          assert.ok(
            Number.isFinite(entry[key]) && entry[key] >= 0 && entry[key] <= 20.5,
            `${caption} day ${i + 1} ${key}=${entry[key]} out of 0-20 range`
          );
        }
        for (let j = 1; j < BAND_KEYS.length; j++) {
          assert.ok(
            entry[BAND_KEYS[j]] >= entry[BAND_KEYS[j - 1]] - 1e-6,
            `${caption} day ${i + 1}: ${BAND_KEYS[j]} < ${BAND_KEYS[j - 1]}`
          );
        }
      });
    }
  });

  test("total bands are ordered and within the 0-100 range every day", () => {
    assert.equal(out.totalBands.length, SEASON_DAYS, "total band must span the full season");
    out.totalBands.forEach((entry, i) => {
      for (const key of BAND_KEYS) {
        assert.ok(
          Number.isFinite(entry[key]) && entry[key] >= 0 && entry[key] <= 100,
          `total day ${i + 1} ${key}=${entry[key]} out of 0-100 range`
        );
      }
      for (let j = 1; j < BAND_KEYS.length; j++) {
        assert.ok(
          entry[BAND_KEYS[j]] >= entry[BAND_KEYS[j - 1]] - 1e-6,
          `total day ${i + 1}: ${BAND_KEYS[j]} < ${BAND_KEYS[j - 1]}`
        );
      }
    });
  });

  test("every caption has delta distributions and growth archetypes", () => {
    for (const caption of CAPTIONS) {
      assert.ok(out.deltas[caption], `${caption} missing delta distributions`);
      assert.ok(
        Array.isArray(out.archetypes[caption]) && out.archetypes[caption].length > 0,
        `${caption} missing growth archetypes`
      );
    }
  });
});
