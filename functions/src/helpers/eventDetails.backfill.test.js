// Backfill parsing tests for eventDetails: parseEventDate / parseEventName /
// parseEventLocation / parseEventDetail run against REAL dci.org event pages saved
// as compact fixtures (hero + lineup-times-section + event-location) for four
// seasons spanning the archive: 2019, 2021, 2024, 2026.
//
// These guard against dci.org markup drift silently dropping the running order or
// mis-dating past events. Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  parseEventDate,
  parseEventName,
  parseEventLocation,
  parseEventDetail,
} = require("./eventDetails");

function loadFixture(year) {
  return fs.readFileSync(path.join(__dirname, "__fixtures__", `event-${year}.html`), "utf-8");
}

// Expected shape for each fixture year. Times are checked as the local wall-clock
// string (stable) plus a spot-check on the absolute performsAt instant.
const CASES = {
  2019: {
    name: "DCI World Championship Finals",
    date: "2019-08-10",
    location: "Indianapolis, IN",
    timezone: "America/Indiana/Indianapolis",
    firstCorps: "INpact Band",
    minLineup: 10,
  },
  2021: {
    name: "DCI Celebration - Indianapolis",
    date: "2021-08-13",
    location: "Indianapolis, IN",
    timezone: "America/Indiana/Indianapolis",
    firstCorps: "Cincinnati Tradition",
    minLineup: 20,
  },
  2024: {
    name: "DCI Capital Classic",
    date: "2024-07-07",
    location: "Sacramento, CA",
    timezone: "America/Los_Angeles",
    firstCorps: "Sacramento Freelancers Alumni Corps",
    minLineup: 10,
  },
  2026: {
    name: "DCI Capital Classic",
    date: "2026-07-03",
    location: "El Dorado Hills, CA",
    timezone: "America/Los_Angeles",
    firstCorps: "Sparta Ignite",
    minLineup: 8,
  },
};

describe("eventDetails backfill parsing (real dci.org fixtures)", () => {
  for (const [year, expected] of Object.entries(CASES)) {
    describe(`${year} — ${expected.name}`, () => {
      const html = loadFixture(year);

      test("parses the real (unbranded) DCI event name", () => {
        assert.equal(parseEventName(html), expected.name);
      });

      test("parses the event date at UTC midnight", () => {
        const iso = parseEventDate(html);
        assert.ok(iso, "expected a date");
        assert.equal(iso.slice(0, 10), expected.date);
        assert.ok(iso.endsWith("T00:00:00.000Z"), "date should be UTC midnight");
      });

      test("parses a clean City, ST location", () => {
        assert.equal(parseEventLocation(html), expected.location);
      });

      test("resolves the venue timezone from the address", () => {
        const date = parseEventDate(html);
        const location = parseEventLocation(html);
        const detail = parseEventDetail(html, { date, location });
        assert.equal(detail.timezone, expected.timezone);
      });

      test("extracts the running order with corps + performance times", () => {
        const date = parseEventDate(html);
        const location = parseEventLocation(html);
        const detail = parseEventDetail(html, { date, location });

        assert.ok(
          detail.lineup.length >= expected.minLineup,
          `expected >= ${expected.minLineup} corps, got ${detail.lineup.length}`
        );
        assert.equal(detail.lineup[0].corps, expected.firstCorps);

        // Every performing entry carries a wall-clock time, a resolved absolute
        // instant, and a monotonically increasing running order.
        detail.lineup.forEach((entry, i) => {
          assert.match(entry.performanceTime, /\d{1,2}:\d{2}\s*[AP]M/i, `row ${i} time`);
          assert.ok(entry.performsAt, `row ${i} performsAt`);
          assert.equal(entry.order, i + 1, `row ${i} order`);
        });

        // startsAt is set (first timed ceremony/performance row).
        assert.ok(detail.startsAt, "expected a startsAt");
      });

      test("never emits ceremony/logistics rows as corps", () => {
        const date = parseEventDate(html);
        const detail = parseEventDetail(html, { date, location: expected.location });
        const bad = detail.lineup.find((e) =>
          /gates? open|scores? announced|intermission|national anthem|^welcome/i.test(e.corps)
        );
        assert.equal(bad, undefined, `unexpected non-corps row: ${bad && bad.corps}`);
      });
    });
  }
});
