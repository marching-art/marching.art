// Tests for the competition-day <-> calendar-date mapping used by the admin
// day-range score backfill. competitionDayToDateUTC must be the exact inverse of
// calculateOffSeasonDay so a day scraped for one maps back to the same day in the
// other — both anchor on the same finals date (2nd Saturday of August).
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  calculateOffSeasonDay,
  competitionDayToDateUTC,
  computeFinalsDateUTC,
} = require("./scheduleGeneration");

describe("competitionDayToDateUTC", () => {
  test("2026 finals is Saturday August 8 (competition day 49)", () => {
    const finals = computeFinalsDateUTC(2026);
    assert.equal(finals.toISOString().slice(0, 10), "2026-08-08");
    assert.equal(finals.getUTCDay(), 6); // Saturday
    assert.equal(competitionDayToDateUTC(49, 2026).toISOString().slice(0, 10), "2026-08-08");
  });

  test("day 1 is finals - 48 days", () => {
    assert.equal(competitionDayToDateUTC(1, 2026).toISOString().slice(0, 10), "2026-06-21");
  });

  test("season days 22-24 map to Jul 12-14, 2026", () => {
    assert.equal(competitionDayToDateUTC(22, 2026).toISOString().slice(0, 10), "2026-07-12");
    assert.equal(competitionDayToDateUTC(23, 2026).toISOString().slice(0, 10), "2026-07-13");
    assert.equal(competitionDayToDateUTC(24, 2026).toISOString().slice(0, 10), "2026-07-14");
  });

  test("is the exact inverse of calculateOffSeasonDay for every day, multiple years", () => {
    for (const year of [2023, 2024, 2025, 2026, 2027]) {
      for (let day = 1; day <= 49; day++) {
        const date = competitionDayToDateUTC(day, year);
        assert.ok(date, `day ${day} of ${year} should map to a date`);
        assert.equal(
          calculateOffSeasonDay(date, year),
          day,
          `round-trip failed for day ${day} of ${year}`
        );
      }
    }
  });

  test("returns null for out-of-range days", () => {
    assert.equal(competitionDayToDateUTC(0, 2026), null);
    assert.equal(competitionDayToDateUTC(50, 2026), null);
    assert.equal(competitionDayToDateUTC(-1, 2026), null);
    assert.equal(competitionDayToDateUTC(1.5, 2026), null);
  });
});
