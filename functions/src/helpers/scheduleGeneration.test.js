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
  getNextOffSeasonWindow,
  getLiveSeasonWindow,
  isLiveSeasonTime,
  resolveFinalsDateUTC,
} = require("./scheduleGeneration");

const DAY_MS = 24 * 60 * 60 * 1000;
const iso = (d) => d.toISOString().slice(0, 10);

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

// The season-window layout: six fixed 49-day off-seasons laid out backward from
// the next live season's start, with variable spring training absorbing the
// 364/371-day slack between consecutive finals. The load-bearing guarantees:
//   1. The first off-season (Overture) begins the day AFTER finals — no gap.
//   2. Competition day 49 always lands on the real DCI finals date.
//   3. isLiveSeasonTime and getNextOffSeasonWindow partition the year exactly.
describe("getNextOffSeasonWindow — backward layout, no post-finals gap", () => {
  // 3 AM ET on the day after the 2026 finals (Aug 8) — the transition happening
  // the night this fix ships.
  const dayAfter2026Finals = new Date("2026-08-09T07:00:00Z");

  test("first off-season begins the day after finals (no dead gap)", () => {
    const w = getNextOffSeasonWindow(dayAfter2026Finals);
    assert.equal(w.seasonType, "Overture");
    assert.equal(iso(w.startDate), "2026-08-09"); // finals (Aug 8) + 1
    assert.equal(iso(w.endDate), "2026-09-27"); // 49 days later
    assert.equal(w.finalsYear, 2027); // anchored on the NEXT live finals
  });

  test("six 49-day off-seasons run back-to-back to the live season start", () => {
    // Walk the full cycle by jumping to each window's end (the rollover instant).
    const seen = [];
    let now = dayAfter2026Finals;
    for (let i = 0; i < 6; i++) {
      const w = getNextOffSeasonWindow(now);
      assert.ok(w, `expected an off-season window at step ${i}`);
      // Exactly 49 days, and contiguous with the previous window.
      assert.equal(Math.round((w.endDate - w.startDate) / DAY_MS), 49);
      if (seen.length) assert.equal(iso(w.startDate), iso(seen[seen.length - 1].endDate));
      seen.push(w);
      now = new Date(w.endDate.getTime() + 7 * 3600 * 1000);
    }
    assert.deepEqual(
      seen.map((w) => w.seasonType),
      ["Overture", "Allegro", "Adagio", "Scherzo", "Crescendo", "Finale"]
    );
    // The sixth off-season ends exactly where the live season begins.
    assert.equal(iso(seen[5].endDate), iso(getLiveSeasonWindow(now).startDate));
    // ...and now (past the sixth off-season) is live-season time.
    assert.equal(getNextOffSeasonWindow(now), null);
    assert.equal(isLiveSeasonTime(now), true);
  });
});

describe("getLiveSeasonWindow — variable spring training", () => {
  test("2027 (371-day / 53-week year) uses 28 days of spring training", () => {
    // Any instant in the 2026-27 off-season resolves the upcoming 2027 live season.
    const w = getLiveSeasonWindow(new Date("2026-08-09T07:00:00Z"));
    assert.equal(w.finalsYear, 2027);
    assert.equal(iso(w.finalsDate), "2027-08-14");
    assert.equal(w.springTrainingDays, 28);
    // Competition day 1 is finals - 48; day 49 is finals.
    const day1 = new Date(w.startDate.getTime() + w.springTrainingDays * DAY_MS);
    assert.equal(Math.round((w.finalsDate - day1) / DAY_MS), 48);
  });

  test("2028 (364-day year, leap) uses 21 days of spring training", () => {
    // Resolve the 2028 live season from a point inside the 2027-28 off-season.
    const w = getLiveSeasonWindow(new Date("2027-08-15T07:00:00Z"));
    assert.equal(w.finalsYear, 2028);
    assert.equal(iso(w.finalsDate), "2028-08-12");
    assert.equal(w.springTrainingDays, 21); // 364-day gap even across Feb 29 2028
  });

  test("day 49 always lands on the real finals date, every year", () => {
    for (let year = 2026; year <= 2035; year++) {
      // Sample the off-season the December before that year's live season.
      const w = getLiveSeasonWindow(new Date(Date.UTC(year - 1, 11, 15)));
      assert.equal(w.finalsYear, year);
      const day49 = new Date(w.startDate.getTime() + (w.springTrainingDays + 48) * DAY_MS);
      assert.equal(iso(day49), iso(computeFinalsDateUTC(year)));
      assert.ok([21, 28].includes(w.springTrainingDays), `spring ${w.springTrainingDays} for ${year}`);
    }
  });
});

describe("resolveFinalsDateUTC — manual override safety valve", () => {
  test("with no override, returns the computed 2nd Saturday of August", () => {
    assert.equal(iso(resolveFinalsDateUTC(2027)), "2027-08-14");
    assert.equal(iso(resolveFinalsDateUTC(2027, {})), "2027-08-14");
  });

  test("a valid override wins over the computed date (string or number key)", () => {
    assert.equal(iso(resolveFinalsDateUTC(2029, { 2029: "2029-08-18" })), "2029-08-18");
    assert.equal(iso(resolveFinalsDateUTC(2029, { "2029": "2029-08-18" })), "2029-08-18");
  });

  test("a malformed or impossible override is ignored (falls back to computed)", () => {
    assert.equal(iso(resolveFinalsDateUTC(2029, { 2029: "not-a-date" })), iso(computeFinalsDateUTC(2029)));
    assert.equal(iso(resolveFinalsDateUTC(2029, { 2029: "2029-02-31" })), iso(computeFinalsDateUTC(2029)));
    assert.equal(iso(resolveFinalsDateUTC(2029, { 2028: "2028-08-12" })), iso(computeFinalsDateUTC(2029)));
  });

  test("an override reshapes spring training and pins day 49 to the override date", () => {
    // Move 2029 finals one week later than the 2nd Saturday (Aug 11 -> Aug 18).
    const overrides = { 2029: "2029-08-18" };
    const w = getLiveSeasonWindow(new Date(Date.UTC(2028, 11, 15)), overrides);
    assert.equal(iso(w.finalsDate), "2029-08-18");
    const day49 = new Date(w.startDate.getTime() + (w.springTrainingDays + 48) * DAY_MS);
    assert.equal(iso(day49), "2029-08-18");
    // A week later than the computed date lengthens the 2028->2029 gap by 7,
    // so spring training grows from 21 to 28 to absorb it; off-seasons stay 49.
    assert.equal(w.springTrainingDays, 28);
    // The off-seasons still pack in with no gap: the last one ends on live start.
    const finaleEnd = getNextOffSeasonWindow(new Date(Date.UTC(2029, 5, 1)), overrides);
    assert.ok(finaleEnd); // still off-season in early June under the later finals
  });
});

describe("isLiveSeasonTime partitions the year with getNextOffSeasonWindow", () => {
  test("exactly one of {off-season window, live time} holds every day for a year", () => {
    let now = new Date("2026-08-09T07:00:00Z");
    for (let d = 0; d < 366; d++) {
      const off = getNextOffSeasonWindow(now) !== null;
      const live = isLiveSeasonTime(now);
      assert.notEqual(off, live, `both or neither on ${iso(now)}`);
      now = new Date(now.getTime() + DAY_MS);
    }
  });
});
