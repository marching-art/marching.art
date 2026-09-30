// Championship Week eve (days 43-44): no schedule builder places a show whose
// title reads as a championship or prelims round there — Championship Week's
// rounds (days 45-49) are marching.art's own. The off-season generator fills
// the day from the rest of the archive pool; live seasons leave the scraped
// event off the schedule entirely.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { setDbForTesting } = require("../config");

const stub = (path, exports) => ({ id: path, filename: path, loaded: true, exports });
const historicalPath = require.resolve("./historicalScores");
const seasonSchedulePath = require.resolve("./seasonSchedule");
const eventDetailsPath = require.resolve("./eventDetails");
const generationPath = require.resolve("./scheduleGeneration");
const real = {
  historical: require.cache[historicalPath],
  seasonSchedule: require.cache[seasonSchedulePath],
  eventDetails: require.cache[eventDetailsPath],
};

const row = (eventName, location, offSeasonDay) => ({
  eventName,
  location,
  offSeasonDay,
  date: "2015-08-01",
  scores: [],
});

/** Days 43-44 each carry barred titles alongside ordinary shows. */
const ARCHIVE = [
  row("DCI Open Class World Championship Prelims", "Michigan City, Indiana", 43),
  row("DCI Division II & III World Championship Prelims", "Madison, Wisconsin", 43),
  row("Drum Corps Midwest Championship", "Rockford, Illinois", 43),
  row("Summer Music Games of Southwest Virginia", "Salem, Virginia", 43),
  row("Music on the March", "Dubuque, Iowa", 43),
  row("DCI Division III Championships Preliminaries", "Erie, Pennsylvania", 44),
  row("Drums Across the Tri-State", "Buffalo, New York", 44),
  row("Lake Erie Fanfare", "Pittsburgh, Pennsylvania", 44),
  row("Tour of Champions", "Denver, Colorado", 44),
];

/** Scraped live events: day N falls on calendar day N + springTrainingDays. */
const START = new Date("2026-06-01T00:00:00Z");
const SPRING = 21;
const liveDate = (day) => new Date(START.getTime() + (day + SPRING - 1) * 86400000).toISOString();
const LIVE_EVENTS = [
  { eventName: "DCI Open Class World Championship Prelims", location: "Marion, IN", date: liveDate(43) },
  { eventName: "DCI Southern Indiana", location: "Evansville, IN", date: liveDate(43) },
  { eventName: "Midwest Championship", location: "Rockford, IL", date: liveDate(44) },
  { eventName: "DCI Chicagoland", location: "DeKalb, IL", date: liveDate(44) },
  { eventName: "DCI Tour Premiere Prelims", location: "Indianapolis, IN", date: liveDate(10) },
];

let generateOffSeasonSchedule;
let generateLiveSeasonSchedule;

before(() => {
  setDbForTesting({});
  require.cache[historicalPath] = /** @type {*} */ (
    stub(historicalPath, {
      ...(real.historical ? real.historical.exports : {}),
      loadAllHistoricalYears: async () => ({ 2015: ARCHIVE }),
    })
  );
  const seasonSchedule = require("./seasonSchedule");
  require.cache[seasonSchedulePath] = /** @type {*} */ (
    stub(seasonSchedulePath, {
      ...seasonSchedule,
      scrapeUpcomingDciEvents: async () => LIVE_EVENTS.map((e) => ({ ...e })),
    })
  );
  require.cache[eventDetailsPath] = /** @type {*} */ (
    stub(eventDetailsPath, {
      ...(real.eventDetails ? real.eventDetails.exports : require("./eventDetails")),
      enrichEventsWithDetails: async () => {},
    })
  );
  delete require.cache[generationPath];
  ({ generateOffSeasonSchedule, generateLiveSeasonSchedule } = require("./scheduleGeneration"));
});

after(() => {
  setDbForTesting(null);
  for (const [path, entry] of [
    [historicalPath, real.historical],
    [seasonSchedulePath, real.seasonSchedule],
    [eventDetailsPath, real.eventDetails],
  ]) {
    if (entry) require.cache[path] = entry;
    else delete require.cache[path];
  }
  delete require.cache[generationPath];
});

const namesOn = (schedule, day) =>
  schedule.find((d) => d.offSeasonDay === day).shows.map((s) => s.eventName);

describe("Championship Week eve — off-season generation", () => {
  test("days 43-44 never carry a championship- or prelims-titled archive show", async () => {
    for (let run = 0; run < 25; run++) {
      const schedule = await generateOffSeasonSchedule(49, 1);
      for (const day of [43, 44]) {
        const names = namesOn(schedule, day);
        assert.deepEqual(names.filter((n) => /championship|prelim/i.test(n)), [], `day ${day}: ${names}`);
      }
    }
  });

  test("the day fills from the other archive shows instead", async () => {
    const schedule = await generateOffSeasonSchedule(49, 1);
    for (const day of [43, 44]) {
      const names = namesOn(schedule, day);
      assert.ok(names.length >= 2, `day ${day} should still get 2-3 shows: ${names}`);
    }
  });

  test("championship week itself keeps its fixed rounds", async () => {
    const schedule = await generateOffSeasonSchedule(49, 1);
    assert.deepEqual(namesOn(schedule, 45), ["Open and A Class Prelims"]);
    assert.deepEqual(namesOn(schedule, 47), ["marching.art World Championship Prelims"]);
  });
});

describe("Championship Week eve — live-season generation", () => {
  test("championship/prelims-titled events on days 43-44 are left off the schedule", async () => {
    const schedule = await generateLiveSeasonSchedule(49, 1, 2026, START, null, SPRING);
    assert.deepEqual(namesOn(schedule, 43), ["marching.art Southern Indiana"]);
    assert.deepEqual(namesOn(schedule, 44), ["marching.art Chicagoland"]);
  });

  test("the same titles on any other day are scheduled as usual", async () => {
    const schedule = await generateLiveSeasonSchedule(49, 1, 2026, START, null, SPRING);
    assert.deepEqual(namesOn(schedule, 10), ["marching.art Tour Premiere Prelims"]);
  });
});
