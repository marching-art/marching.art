// Tests for regionalTierForEventName — the name-match that stamps the branded
// marching.art majors (Southwestern / Southeastern / Eastern Classic) with
// eventTier: "regional" at live-season ingest, so live seasons mark them the
// same way the off-season generator's placeMajor does (design §5.11).
//
// Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { regionalTierForEventName } = require("./seasonSchedule");
const { mergeScheduleRefresh } = require("./scheduleRefresh");

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
