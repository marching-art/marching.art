// Tests for eventUrlToRecapUrl (helpers/scraping.js). dci.org serves an event's
// per-caption recap at the identical slug moved from /events/ into /scores/recap/,
// which is what lets the live scraper probe scores DCI has posted but not yet
// linked on its /scores/ listing (scheduled/liveScraper.js deriveScheduleRecapEvents).

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { eventUrlToRecapUrl } = require("./scraping");

describe("eventUrlToRecapUrl", () => {
  test("moves an /events/ detail URL to its /scores/recap/ page at the same slug", () => {
    assert.equal(
      eventUrlToRecapUrl("https://www.dci.org/events/2026-dci-world-championship-prelims/"),
      "https://www.dci.org/scores/recap/2026-dci-world-championship-prelims/"
    );
  });

  test("preserves the host and trailing slash", () => {
    assert.equal(
      eventUrlToRecapUrl("https://www.dci.org/events/2024-dci-pittsburgh/"),
      "https://www.dci.org/scores/recap/2024-dci-pittsburgh/"
    );
  });

  test("only rewrites the /events/ path segment, not a slug that contains 'events'", () => {
    assert.equal(
      eventUrlToRecapUrl("https://www.dci.org/events/2025-drum-corps-events-showcase/"),
      "https://www.dci.org/scores/recap/2025-drum-corps-events-showcase/"
    );
  });

  test("returns null for a non-/events/ URL", () => {
    assert.equal(eventUrlToRecapUrl("https://www.dci.org/scores/2026-dci-prelims/"), null);
    assert.equal(eventUrlToRecapUrl("https://www.dci.org/"), null);
  });

  test("returns null for non-string input", () => {
    assert.equal(eventUrlToRecapUrl(null), null);
    assert.equal(eventUrlToRecapUrl(undefined), null);
    assert.equal(eventUrlToRecapUrl(42), null);
  });
});
