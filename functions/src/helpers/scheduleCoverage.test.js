// Tests for the schedule-coverage audit: which archived events are expected to
// have a running order, and the per-year matched/missing/scraped/learned/all-age
// tallies plus pool unmapped detection. Fake Firestore — no emulator.
//
// Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { isExpectedEvent, buildScheduleCoverageReport } = require("./scheduleCoverage");

const scored = (n) => Array.from({ length: n }, (_, i) => ({ corps: `C${i}`, score: 70 + i }));
// Compact fixture builders (keep lines under max-len).
const ev = (eventName, date, offSeasonDay) => ({ eventName, date, offSeasonDay, scores: scored(6) });
const se = (eventName, date, source) => ({ eventName, date, source, lineup: [{}] });

describe("isExpectedEvent", () => {
  test("true for a real, dated event with enough scored corps", () => {
    assert.equal(isExpectedEvent({ eventName: "DCI X", offSeasonDay: 10, scores: scored(5) }), true);
  });
  test("false for all-age, placeholder, undated, or tiny fields", () => {
    assert.equal(isExpectedEvent({ eventName: "All-Age Finals", offSeasonDay: 10, scores: scored(5) }), false);
    assert.equal(isExpectedEvent({ eventName: "DCI Competition - X", offSeasonDay: 10, scores: scored(5) }), false);
    assert.equal(isExpectedEvent({ eventName: "DCI X", offSeasonDay: null, scores: scored(5) }), false);
    assert.equal(isExpectedEvent({ eventName: "DCI X", offSeasonDay: 10, scores: scored(3) }), false);
  });
});

function makeDb(docs, collections) {
  return {
    doc: (p) => ({ get: async () => ({ exists: p in docs, data: () => docs[p] }) }),
    collection: (name) => ({
      listDocuments: async () => (collections[name] || []).map((id) => ({ id })),
    }),
  };
}

describe("buildScheduleCoverageReport", () => {
  test("tallies matched/scraped/learned, flags gaps, detects pool unmapped", async () => {
    const docs = {
      "historical_scores/2015": {
        data: [
          ev("DCI Capital Classic", "2015-07-01T00:00:00Z", 12),
          ev("DCI Southwestern", "2015-07-20T00:00:00Z", 30),
          ev("DCI Menomonie", "2015-07-05T00:00:00Z", 16), // expected, missing
          ev("DCI All-Age World Championship Finals", "2015-08-01T00:00:00Z", 44),
          ev("DCI Competition - Nowhere", "2015-07-02T00:00:00Z", 13),
        ],
      },
      "historical_schedules/2015": {
        data: [
          se("DCI Capital Classic", "2015-07-01T00:00:00Z", "scraped"),
          se("DCI Southwestern", "2015-07-20T00:00:00Z", "learned"),
        ],
      },
      "game-settings/season": { seasonUid: "off_2025-26" },
      "dci-data/off_2025-26": {
        corpsValues: [
          { corpsName: "Blue Devils", sourceYear: "2015", resultDays: [12, 30] },
          { corpsName: "Ghost Corps", sourceYear: "1999", resultDays: [] }, // unmapped
          { corpsName: "No Field", sourceYear: "2000" }, // no resultDays key -> unmapped
        ],
      },
    };
    const db = makeDb(docs, { historical_scores: ["2015"], historical_schedules: ["2015"] });

    const report = await buildScheduleCoverageReport(db);
    const row = report.years[0];
    assert.equal(row.year, "2015");
    assert.equal(row.expected, 3); // Capital, Southwestern, Menomonie (all-age + placeholder excluded)
    assert.equal(row.matched, 2);
    assert.equal(row.missingCount, 1);
    assert.deepEqual(row.missing, ["DCI Menomonie (2015-07-05)"]);
    assert.equal(row.scraped, 1);
    assert.equal(row.learned, 1);
    assert.equal(row.allAgeLeak, 0); // all-age not in schedules
    assert.equal(row.finalsOk, true); // all-age finals in scores but NOT in schedules

    assert.equal(report.totals.expected, 3);
    assert.equal(report.totals.matched, 2);
    assert.equal(report.pool.size, 3);
    assert.deepEqual(report.pool.unmapped, ["Ghost Corps (1999)", "No Field (2000)"]);
  });

  test("flags an all-age leak and a finals disambiguation failure", async () => {
    const docs = {
      "historical_scores/2019": {
        data: [
          ev("DCI World Championship Finals", "2019-08-10T00:00:00Z", 44),
          ev("DCI All-Age World Championship Finals", "2019-08-10T00:00:00Z", 44),
        ],
      },
      "historical_schedules/2019": {
        data: [
          se("DCI World Championship Finals", "2019-08-10T00:00:00Z", "scraped"),
          se("DCI All-Age World Championship Finals", "2019-08-10T00:00:00Z", "scraped"),
        ],
      },
      "game-settings/season": { seasonUid: "x" },
    };
    const db = makeDb(docs, { historical_scores: ["2019"], historical_schedules: ["2019"] });
    const report = await buildScheduleCoverageReport(db);
    const row = report.years[0];
    assert.equal(row.allAgeLeak, 1);
    assert.equal(row.finalsOk, false); // both finals in schedules -> disambiguation failed
  });
});
