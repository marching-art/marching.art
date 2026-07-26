// Tests for parseRecapDateUTC — the recap page's date parse. The event date
// is the archive key (historical_scores merges by name+date), so the parse
// must be explicit-UTC (never TZ-dependent) and must FAIL on junk instead of
// falling back to scrape time, which silently mis-dated events by a day.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { parseRecapDateUTC } = require("./scraping");

describe("parseRecapDateUTC", () => {
  test("parses the recap page's 'Month D, YYYY' form at UTC midnight", () => {
    const date = parseRecapDateUTC("July 20, 2026");
    assert.equal(date.toISOString(), "2026-07-20T00:00:00.000Z");
  });

  test("accepts a missing comma and 3-letter month abbreviations", () => {
    assert.equal(parseRecapDateUTC("July 20 2026").toISOString(), "2026-07-20T00:00:00.000Z");
    assert.equal(parseRecapDateUTC("Jul 20, 2026").toISOString(), "2026-07-20T00:00:00.000Z");
    assert.equal(parseRecapDateUTC("Aug 8, 2026").toISOString(), "2026-08-08T00:00:00.000Z");
  });

  test("parses the listing's M/D/YYYY form at UTC midnight", () => {
    assert.equal(parseRecapDateUTC("7/4/2026").toISOString(), "2026-07-04T00:00:00.000Z");
    assert.equal(parseRecapDateUTC("12/31/2026").toISOString(), "2026-12-31T00:00:00.000Z");
  });

  test("is whitespace-tolerant", () => {
    assert.equal(parseRecapDateUTC("  July 20, 2026  ").toISOString(), "2026-07-20T00:00:00.000Z");
  });

  test("returns null for empty/absent date text (no scrape-time fallback)", () => {
    assert.equal(parseRecapDateUTC(""), null);
    assert.equal(parseRecapDateUTC(undefined), null);
    assert.equal(parseRecapDateUTC("   "), null);
  });

  test("returns null for unrecognizable text", () => {
    assert.equal(parseRecapDateUTC("Indianapolis, IN"), null); // a location, not a date
    assert.equal(parseRecapDateUTC("Coming soon"), null);
    assert.equal(parseRecapDateUTC("Julyish 20, 2026"), null); // unknown month
  });

  test("rejects overflowing calendar dates instead of rolling the month", () => {
    assert.equal(parseRecapDateUTC("June 31, 2026"), null);
    assert.equal(parseRecapDateUTC("13/1/2026"), null);
    assert.equal(parseRecapDateUTC("2/30/2026"), null);
  });

  test("the derived calendar date is TZ-independent (UTC, not local, midnight)", () => {
    // Under the old `new Date(dateText)` parse, a runtime west of UTC put
    // this instant on the previous UTC day — the exact one-day mis-date the
    // hard-fail was added to prevent.
    const date = parseRecapDateUTC("July 20, 2026");
    assert.equal(date.toISOString().slice(0, 10), "2026-07-20");
    assert.equal(date.getUTCHours(), 0);
  });
});
