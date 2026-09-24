// generateOffSeasonSchedule: Championship Week (days 45-49) and the majors
// always carry their canonical marching.art names, whatever the archive rows
// that seed them were titled. Before this pinned it, a 2000s archive year left
// "DCI Division I World Championship Quarterfinals" on day 47 — and the
// dashboard showed a director that instead of the World Championship Prelims.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { setDbForTesting } = require("../config");

const stub = (path, exports) => ({ id: path, filename: path, loaded: true, exports });
const historicalPath = require.resolve("./historicalScores");
const generationPath = require.resolve("./scheduleGeneration");
const realHistorical = require.cache[historicalPath];

/** A 2000s-era archive: the rounds are titled by division, not "Prelims". */
const ARCHIVE_2005 = [
  { eventName: "DCI Summer Music Games", location: "Denver, Colorado", offSeasonDay: 10, date: "2005-07-01", scores: [] },
  { eventName: "DCI Division I World Championship Quarterfinals", location: "Foxboro, Massachusetts", offSeasonDay: 47, date: "2005-08-11", scores: [] },
  { eventName: "DCI Division II & III World Championship Finals", location: "Foxboro, Massachusetts", offSeasonDay: 47, date: "2005-08-11", scores: [] },
  { eventName: "DCI Division I World Championship Semi-Finals", location: "Foxboro, Massachusetts", offSeasonDay: 48, date: "2005-08-12", scores: [] },
  { eventName: "DCI Division I World Championship Finals", location: "Foxboro, Massachusetts", offSeasonDay: 49, date: "2005-08-13", scores: [] },
];

let generateOffSeasonSchedule;

before(() => {
  setDbForTesting({});
  require.cache[historicalPath] = /** @type {*} */ (
    stub(historicalPath, {
      ...(realHistorical ? realHistorical.exports : {}),
      loadAllHistoricalYears: async () => ({ 2005: ARCHIVE_2005 }),
    })
  );
  delete require.cache[generationPath];
  ({ generateOffSeasonSchedule } = require("./scheduleGeneration"));
});

after(() => {
  setDbForTesting(null);
  if (realHistorical) require.cache[historicalPath] = realHistorical;
  else delete require.cache[historicalPath];
  delete require.cache[generationPath];
});

const dayShows = (schedule, day) => schedule.find((d) => d.offSeasonDay === day).shows;

describe("generateOffSeasonSchedule — fixed event names", () => {
  test("days 47-49 carry the canonical World Championship names, seeded from the archive's round", async () => {
    const schedule = await generateOffSeasonSchedule(49, 1);

    const [prelims] = dayShows(schedule, 47);
    assert.equal(prelims.eventName, "marching.art World Championship Prelims");
    assert.equal(prelims.date, "2005-08-11"); // seeded from the archive Quarterfinals row
    assert.equal(prelims.location, "Indianapolis, IN");
    assert.equal(prelims.isChampionship, true);
    assert.equal(dayShows(schedule, 47).length, 1);

    const [semis] = dayShows(schedule, 48);
    assert.equal(semis.eventName, "marching.art World Championship Semifinals");
    assert.equal(semis.date, "2005-08-12");

    const [finals, soundSport] = dayShows(schedule, 49);
    assert.equal(finals.eventName, "marching.art World Championship Finals");
    assert.equal(finals.date, "2005-08-13");
    assert.equal(soundSport.eventName, "SoundSport International Music & Food Festival");
  });

  test("days 45-46 and the majors are the fixed rows", async () => {
    const schedule = await generateOffSeasonSchedule(49, 1);
    assert.deepEqual(
      [45, 46].map((d) => dayShows(schedule, d).map((s) => s.eventName)),
      [["Open and A Class Prelims"], ["Open and A Class Finals"]]
    );
    assert.deepEqual(
      [28, 35, 41, 42].map((d) => dayShows(schedule, d).map((s) => s.eventName)),
      [
        ["marching.art Southwestern Championship"],
        ["marching.art Southeastern Championship"],
        ["marching.art Eastern Classic"],
        ["marching.art Eastern Classic"],
      ]
    );
  });

  test("no schedule row anywhere still carries a DCI-branded name", async () => {
    const schedule = await generateOffSeasonSchedule(49, 1);
    const names = schedule.flatMap((d) => d.shows.map((s) => s.eventName));
    assert.ok(names.length > 0);
    assert.deepEqual(names.filter((n) => /\bDCI\b/.test(n)), []);
  });
});
