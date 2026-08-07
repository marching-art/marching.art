// Tests for regionalTierForEventName — the name-match that stamps the branded
// marching.art majors (Southwestern / Southeastern / Eastern Classic) with
// eventTier: "regional" at live-season ingest, so live seasons mark them the
// same way the off-season generator's placeMajor does (design §5.11).
//
// Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { regionalTierForEventName, applyMultiNightMajors } = require("./seasonSchedule");
const { mergeScheduleRefresh, buildScrapedEventUrlIndex } = require("./scheduleRefresh");

describe("buildScrapedEventUrlIndex", () => {
  const LINEUP = [{ order: 1, corps: "Blue Devils" }];

  test("keeps { url, date } for competitive events, dropping those missing url/date", () => {
    const index = buildScrapedEventUrlIndex([
      { url: "https://www.dci.org/events/2026-dci-prelims/", date: "2026-08-06T00:00:00.000Z", lineup: LINEUP, eventName: "x" },
      { date: "2026-08-06T00:00:00.000Z", lineup: LINEUP }, // no url
      { url: "https://www.dci.org/events/2026-dci-semis/", lineup: LINEUP }, // no date
    ]);
    assert.deepEqual(index, [
      { url: "https://www.dci.org/events/2026-dci-prelims/", date: "2026-08-06T00:00:00.000Z" },
    ]);
  });

  test("excludes non-scoring events with no lineup (cinema/education showcases)", () => {
    const index = buildScrapedEventUrlIndex([
      { url: "https://www.dci.org/events/2026-dci-prelims/", date: "2026-08-06T00:00:00.000Z", lineup: LINEUP },
      // "Big, Loud & Live" cinema broadcast: real date + URL, but no lineup.
      { url: "https://www.dci.org/events/2026-dci-2026-big-loud-live/", date: "2026-08-06T00:00:00.000Z" },
      { url: "https://www.dci.org/events/2026-shining-a-light/", date: "2026-08-06T00:00:00.000Z", lineup: [] },
    ]);
    assert.deepEqual(index, [
      { url: "https://www.dci.org/events/2026-dci-prelims/", date: "2026-08-06T00:00:00.000Z" },
    ]);
  });

  test("dedupes by URL and tolerates empty/nullish input", () => {
    const index = buildScrapedEventUrlIndex([
      { url: "https://www.dci.org/events/2026-dci-x/", date: "2026-08-06T00:00:00.000Z", lineup: LINEUP },
      { url: "https://www.dci.org/events/2026-dci-x/", date: "2026-08-06T00:00:00.000Z", lineup: LINEUP },
    ]);
    assert.equal(index.length, 1);
    assert.deepEqual(buildScrapedEventUrlIndex([]), []);
    assert.deepEqual(buildScrapedEventUrlIndex(undefined), []);
  });

  test("captures championship-week events that never enter competitions[]", () => {
    // The whole point: prelims/semis/finals are dropped from competitions[]
    // (day > 44) but must still be reachable by URL for the score scraper.
    const index = buildScrapedEventUrlIndex([
      {
        url: "https://www.dci.org/events/2026-dci-world-championship-prelims/",
        date: "2026-08-06T00:00:00.000Z",
        lineup: LINEUP,
      },
    ]);
    assert.equal(index[0].url, "https://www.dci.org/events/2026-dci-world-championship-prelims/");
  });
});

describe("regionalTierForEventName", () => {
  test("tags the three branded majors as regional", () => {
    assert.equal(regionalTierForEventName("marching.art Southwestern Championship"), "regional");
    assert.equal(regionalTierForEventName("marching.art Southeastern Championship"), "regional");
    assert.equal(regionalTierForEventName("marching.art Eastern Classic"), "regional");
  });

  test("tags the real (unbranded) DCI major names too", () => {
    assert.equal(regionalTierForEventName("DCI Southwestern Championship"), "regional");
    assert.equal(regionalTierForEventName("DCI Eastern Classic"), "regional");
  });

  test("leaves ordinary pool shows untagged", () => {
    // The exact co-located shows that shared major days in the reported clutter.
    assert.equal(regionalTierForEventName("The Buccaneer Classic"), null);
    assert.equal(regionalTierForEventName("Midwestern Championship"), null);
    assert.equal(regionalTierForEventName("Music on the Mountain"), null);
    assert.equal(regionalTierForEventName("Bushwackers Invitational"), null);
    assert.equal(regionalTierForEventName("marching.art Houston"), null);
  });

  test("handles missing/blank names", () => {
    assert.equal(regionalTierForEventName(null), null);
    assert.equal(regionalTierForEventName(undefined), null);
    assert.equal(regionalTierForEventName(""), null);
  });
});

describe("mergeScheduleRefresh eventTier tagging", () => {
  const startDate = new Date("2026-06-01T00:00:00Z");
  const springTrainingDays = 21;
  // Competition day N falls on calendar day N + springTrainingDays.
  const dateForDay = (day) =>
    new Date(startDate.getTime() + (day + springTrainingDays - 1) * 86400000).toISOString();

  test("stamps eventTier on a newly appended major", () => {
    const { competitions } = mergeScheduleRefresh(
      [],
      [{ eventName: "marching.art Southeastern Championship", location: "Atlanta, GA", date: dateForDay(35) }],
      "live_2026-26",
      startDate,
      springTrainingDays
    );
    const major = competitions.find((c) => c.day === 35);
    assert.equal(major.eventTier, "regional");
  });

  test("backfills eventTier onto a major already on the schedule (in place)", () => {
    const existing = [
      {
        id: "live_2026-26_day35_0",
        name: "marching.art Southeastern Championship",
        location: "Atlanta, GA",
        date: dateForDay(35),
        day: 35,
        week: 5,
        type: "regular",
        mandatory: false,
        // No eventTier — generated before tagging existed.
      },
    ];
    const { competitions, enrichedCount } = mergeScheduleRefresh(
      existing,
      [{ eventName: "marching.art Southeastern Championship", location: "Atlanta, GA", date: dateForDay(35) }],
      "live_2026-26",
      startDate,
      springTrainingDays
    );
    assert.equal(enrichedCount, 1);
    assert.equal(competitions.find((c) => c.day === 35).eventTier, "regional");
  });

  test("does not tag ordinary co-located pool shows", () => {
    const { competitions } = mergeScheduleRefresh(
      [],
      [
        { eventName: "marching.art Southeastern Championship", location: "Atlanta, GA", date: dateForDay(35) },
        { eventName: "Midwestern Championship", location: "DeKalb, IL", date: dateForDay(35) },
      ],
      "live_2026-26",
      startDate,
      springTrainingDays
    );
    const midwest = competitions.find((c) => c.name === "Midwestern Championship");
    assert.equal(midwest.eventTier, undefined);
  });
});

describe("applyMultiNightMajors", () => {
  test("stamps both nights of a major that spans consecutive days", () => {
    const competitions = [
      { name: "marching.art Eastern Classic", day: 41 },
      { name: "marching.art Eastern Classic", day: 42 },
      { name: "Four Flags Spectacular", day: 42 },
    ];
    applyMultiNightMajors(competitions);
    assert.deepEqual(competitions[0].multiNight, { nights: [41, 42] });
    assert.deepEqual(competitions[1].multiNight, { nights: [41, 42] });
    // An ordinary show sharing night two is untouched.
    assert.equal(competitions[2].multiNight, undefined);
  });

  test("leaves a single-night major alone", () => {
    const competitions = [{ name: "marching.art Southeastern Championship", day: 35 }];
    applyMultiNightMajors(competitions);
    assert.equal(competitions[0].multiNight, undefined);
  });

  test("ignores a major name that repeats on non-consecutive days", () => {
    // Not one event over two nights — two separate shows that share a name.
    const competitions = [
      { name: "marching.art Eastern Classic", day: 20 },
      { name: "marching.art Eastern Classic", day: 41 },
    ];
    applyMultiNightMajors(competitions);
    assert.equal(competitions[0].multiNight, undefined);
    assert.equal(competitions[1].multiNight, undefined);
  });

  test("is idempotent", () => {
    const competitions = [
      { name: "marching.art Eastern Classic", day: 41 },
      { name: "marching.art Eastern Classic", day: 42 },
    ];
    applyMultiNightMajors(competitions);
    applyMultiNightMajors(competitions);
    assert.deepEqual(competitions[0].multiNight, { nights: [41, 42] });
  });
});

describe("mergeScheduleRefresh two-night majors", () => {
  const startDate = new Date("2026-06-01T00:00:00Z");
  const springTrainingDays = 21;
  const dateForDay = (day) =>
    new Date(startDate.getTime() + (day + springTrainingDays - 1) * 86400000).toISOString();
  const eastern = (day) => ({
    eventName: "marching.art Eastern Classic",
    location: "Allentown, PA",
    date: dateForDay(day),
  });

  test("keeps BOTH nights of a same-named major on their own days", () => {
    // The de-dup inside the merge is per-day; the two nights must survive it,
    // or day 42 has no Eastern Classic to score (the whole point of the
    // scraper's (name, date) de-dup key upstream).
    const { competitions, addedCount } = mergeScheduleRefresh(
      [], [eastern(41), eastern(42)], "live_2026-26", startDate, springTrainingDays
    );
    assert.equal(addedCount, 2);
    assert.deepEqual(competitions.map((c) => c.day), [41, 42]);
  });

  test("stamps multiNight across the merged schedule", () => {
    const { competitions } = mergeScheduleRefresh(
      [], [eastern(41), eastern(42)], "live_2026-26", startDate, springTrainingDays
    );
    for (const comp of competitions) {
      assert.deepEqual(comp.multiNight, { nights: [41, 42] });
    }
  });

  test("stamps night one in place when night two arrives on a later refresh", () => {
    // The scrape only lists UPCOMING events, so the second night can land on a
    // refresh after the first is already on the schedule.
    const first = mergeScheduleRefresh(
      [], [eastern(41)], "live_2026-26", startDate, springTrainingDays
    );
    assert.equal(first.competitions[0].multiNight, undefined);

    const second = mergeScheduleRefresh(
      first.competitions, [eastern(41), eastern(42)], "live_2026-26", startDate, springTrainingDays
    );
    assert.equal(second.addedCount, 1);
    assert.deepEqual(second.competitions.map((c) => c.multiNight), [
      { nights: [41, 42] },
      { nights: [41, 42] },
    ]);
  });

  test("still collapses a genuine duplicate of the same event on one day", () => {
    const { competitions, addedCount } = mergeScheduleRefresh(
      [], [eastern(41), eastern(41)], "live_2026-26", startDate, springTrainingDays
    );
    assert.equal(addedCount, 1);
    assert.equal(competitions.length, 1);
  });
});

// ---------------------------------------------------------------------------
// addShowToDay provenance: a player-hosted show must be distinguishable from a
// scraped DCI one, or the drop pipeline holds the night's scores open waiting
// for a dci.org recap that will never exist (helpers/dropPlanner.js).
// ---------------------------------------------------------------------------

const { isVirtualShow, owesDciRecap } = require("./dropPlanner");

/**
 * Run addShowToDay against an in-memory schedules/{id} doc. seasonSchedule.js
 * destructures getDb at require time, so the fake config has to be in the
 * module cache before it loads (same cache-swap idiom as
 * newsArticleShared.test.js); both entries are restored afterwards.
 */
async function addShowWithFakeDb(existing, dayNumber, show) {
  const stored = { competitions: [...existing] };
  const fakeDb = {
    doc: () => ({
      async get() { return { exists: true, data: () => stored }; },
      async set(data) { Object.assign(stored, data); },
    }),
  };

  const configPath = require.resolve("../config");
  const modulePath = require.resolve("./seasonSchedule");
  const realConfig = require.cache[configPath];
  const realModule = require.cache[modulePath];

  require.cache[configPath] = /** @type {*} */ ({
    id: configPath,
    filename: configPath,
    loaded: true,
    exports: { ...require("../config"), getDb: () => fakeDb },
  });
  delete require.cache[modulePath];
  try {
    const { addShowToDay } = require("./seasonSchedule");
    await addShowToDay("s26", dayNumber, show);
  } finally {
    if (realConfig) require.cache[configPath] = realConfig;
    else delete require.cache[configPath];
    if (realModule) require.cache[modulePath] = realModule;
    else delete require.cache[modulePath];
  }
  return stored.competitions;
}

describe("addShowToDay provenance", () => {
  test("persists eventTier and hostUid for a player-hosted show", async () => {
    const competitions = await addShowWithFakeDb([], 10, {
      eventName: "Rohn Invitational",
      location: "Denver, CO",
      eventTier: "hosted",
      hostUid: "user-1",
    });
    const added = competitions.find((c) => c.name === "Rohn Invitational");
    assert.equal(added.eventTier, "hosted");
    assert.equal(added.hostUid, "user-1");
    // The drop planner therefore treats it as virtual: no timing influence,
    // and not an owed DCI recap.
    assert.equal(isVirtualShow(added), true);
    assert.equal(owesDciRecap(added), false);
  });

  test("leaves a show with neither marker alone", async () => {
    const competitions = await addShowWithFakeDb([], 10, {
      eventName: "Some Show",
      location: "Boise, ID",
    });
    const added = competitions.find((c) => c.name === "Some Show");
    assert.equal(added.eventTier, undefined);
    assert.equal(added.hostUid, undefined);
  });
});
