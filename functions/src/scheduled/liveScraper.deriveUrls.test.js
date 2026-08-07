// Tests for deriveScheduleRecapEvents (scheduled/liveScraper.js). The live
// scraper folds recap URLs derived straight from the stored schedule into the
// candidate set, so it can find scores DCI has posted at /scores/recap/{slug}/
// but not yet linked on its /scores/ listing.

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { deriveScheduleRecapEvents } = require("./liveScraper");

// Minimal Firestore stub: db.doc(path).get() -> snapshot for a preloaded doc.
function makeDb(docsByPath) {
  return {
    doc(path) {
      return {
        async get() {
          const data = docsByPath[path];
          return { exists: data !== undefined, data: () => data };
        },
      };
    },
  };
}

const SEASON = { seasonUid: "live_2026" };

describe("deriveScheduleRecapEvents", () => {
  test("derives recap URLs for shows on the target night from their /events/ URLs", async () => {
    const db = makeDb({
      "schedules/live_2026": {
        competitions: [
          {
            url: "https://www.dci.org/events/2026-dci-world-championship-prelims/",
            date: "2026-08-06T00:00:00.000Z",
          },
          {
            url: "https://www.dci.org/events/2026-dci-world-championship-semifinals/",
            date: "2026-08-07T00:00:00.000Z",
          },
        ],
      },
    });

    const events = await deriveScheduleRecapEvents(db, SEASON, "2026-08-06");
    assert.deepEqual(events, [
      {
        recapUrl: "https://www.dci.org/scores/recap/2026-dci-world-championship-prelims/",
        dateKey: "2026-08-06",
      },
    ]);
  });

  test("skips shows with no /events/ URL (player-hosted) and no date", async () => {
    const db = makeDb({
      "schedules/live_2026": {
        competitions: [
          { name: "My Home Show", date: "2026-08-06T00:00:00.000Z" }, // hosted, no url
          { url: "https://www.dci.org/events/2026-dci-somewhere/" }, // no date
          {
            url: "https://www.dci.org/events/2026-dci-real/",
            date: "2026-08-06T00:00:00.000Z",
          },
        ],
      },
    });

    const events = await deriveScheduleRecapEvents(db, SEASON, "2026-08-06");
    assert.deepEqual(events, [
      { recapUrl: "https://www.dci.org/scores/recap/2026-dci-real/", dateKey: "2026-08-06" },
    ]);
  });

  test("dedupes repeated event URLs on the same night", async () => {
    const db = makeDb({
      "schedules/live_2026": {
        competitions: [
          { url: "https://www.dci.org/events/2026-dci-x/", date: "2026-08-06T00:00:00.000Z" },
          { url: "https://www.dci.org/events/2026-dci-x/", date: "2026-08-06T00:00:00.000Z" },
        ],
      },
    });

    const events = await deriveScheduleRecapEvents(db, SEASON, "2026-08-06");
    assert.equal(events.length, 1);
  });

  test("derives from scrapedEventUrls[] — championship week absent from competitions[]", async () => {
    const db = makeDb({
      "schedules/live_2026": {
        competitions: [], // championship week is never carried here
        scrapedEventUrls: [
          {
            url: "https://www.dci.org/events/2026-dci-world-championship-prelims/",
            date: "2026-08-06T00:00:00.000Z",
          },
          {
            url: "https://www.dci.org/events/2026-dci-world-championship-finals/",
            date: "2026-08-08T00:00:00.000Z",
          },
        ],
      },
    });

    const events = await deriveScheduleRecapEvents(db, SEASON, "2026-08-06");
    assert.deepEqual(events, [
      {
        recapUrl: "https://www.dci.org/scores/recap/2026-dci-world-championship-prelims/",
        dateKey: "2026-08-06",
      },
    ]);
  });

  test("unions competitions[] and scrapedEventUrls[], deduping shared URLs", async () => {
    const shared = "https://www.dci.org/events/2026-dci-regional/";
    const db = makeDb({
      "schedules/live_2026": {
        competitions: [{ url: shared, date: "2026-08-06T00:00:00.000Z" }],
        scrapedEventUrls: [
          { url: shared, date: "2026-08-06T00:00:00.000Z" }, // dupe of the competition
          { url: "https://www.dci.org/events/2026-dci-extra/", date: "2026-08-06T00:00:00.000Z" },
        ],
      },
    });

    const events = await deriveScheduleRecapEvents(db, SEASON, "2026-08-06");
    assert.deepEqual(events.map((e) => e.recapUrl).sort(), [
      "https://www.dci.org/scores/recap/2026-dci-extra/",
      "https://www.dci.org/scores/recap/2026-dci-regional/",
    ]);
  });

  test("returns [] when no season, no target date, or no schedule doc", async () => {
    const db = makeDb({});
    assert.deepEqual(await deriveScheduleRecapEvents(db, {}, "2026-08-06"), []);
    assert.deepEqual(await deriveScheduleRecapEvents(db, SEASON, null), []);
    assert.deepEqual(await deriveScheduleRecapEvents(db, SEASON, "2026-08-06"), []);
  });
});
