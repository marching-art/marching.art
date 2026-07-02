// Unit tests for the selected-shows reconciliation in scheduleAudit.js.
// Uses Node's built-in test runner (node:test) so no extra dependency is
// needed in the functions codebase. Run with `npm test` inside functions/.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { reconcileSelectedShows } = require("./scheduleAudit");

// A small schedule: current names are branded ("marching.art ...").
const competitions = [
  { id: "s_day3_0", name: "marching.art Innsbrook", day: 3, week: 1, location: "Richmond, VA", date: "2026-06-24" },
  {
    id: "s_day12_0", name: "marching.art Capital Classic", day: 12, week: 2,
    location: "El Dorado Hills, CA", date: "2026-07-03",
  },
  { id: "s_day16_0", name: "marching.art West", day: 16, week: 3, location: "Stanford, CA", date: "2026-07-07" },
  { id: "s_day20_0", name: "Show of Shows", day: 20, week: 3, location: "Rockford, IL", date: "2026-07-11" },
];

describe("reconcileSelectedShows", () => {
  test("renames pre-branding 'DCI' snapshots to the canonical schedule name", () => {
    const selected = {
      week2: [{ eventName: "DCI Capital Classic", day: 12, location: "", date: null }],
    };
    const { selectedShows, changed, stats } = reconcileSelectedShows(selected, competitions, 1);
    assert.equal(changed, true);
    assert.equal(stats.renamed, 1);
    assert.equal(selectedShows.week2.length, 1);
    assert.equal(selectedShows.week2[0].eventName, "marching.art Capital Classic");
    assert.equal(selectedShows.week2[0].location, "El Dorado Hills, CA");
    assert.equal(selectedShows.week2[0].day, 12);
  });

  test("removes current/future entries that match nothing, freeing slots", () => {
    const selected = {
      week2: [
        { eventName: "DCI Capital Classic", day: 12 },
        { eventName: "DCI Ghost Invitational", day: 9 },
        { eventName: "Another Vanished Show", day: 10 },
        { eventName: "Yet Another Gone", day: 11 },
      ],
    };
    const { selectedShows, stats } = reconcileSelectedShows(selected, competitions, 1);
    assert.equal(stats.removed, 3);
    assert.equal(selectedShows.week2.length, 1); // slots freed: was "maxed" at 4
    assert.equal(selectedShows.week2[0].eventName, "marching.art Capital Classic");
  });

  test("moves an entry to the correct week when the show's day changed", () => {
    const selected = {
      week2: [{ eventName: "DCI West", day: 13 }], // schedule now has it on day 16 (week 3)
    };
    const { selectedShows, stats } = reconcileSelectedShows(selected, competitions, 1);
    assert.equal(stats.moved, 1);
    assert.equal(selectedShows.week2.length, 0);
    assert.equal(selectedShows.week3.length, 1);
    assert.equal(selectedShows.week3[0].day, 16);
  });

  test("never removes past-week history, but safely renames same-day matches", () => {
    const selected = {
      week1: [
        { eventName: "DCI Innsbrook", day: 3 }, // renamable (same day)
        { eventName: "DCI Ghost Invitational", day: 5 }, // unmatched: kept as history
      ],
    };
    const { selectedShows, stats } = reconcileSelectedShows(selected, competitions, 4);
    assert.equal(stats.removed, 0);
    assert.equal(stats.renamed, 1);
    assert.equal(stats.kept, 1);
    assert.equal(selectedShows.week1.length, 2);
    assert.equal(selectedShows.week1[0].eventName, "marching.art Innsbrook");
    assert.equal(selectedShows.week1[1].eventName, "DCI Ghost Invitational");
  });

  test("dedupes repeat names and same-day pairs in editable weeks", () => {
    const selected = {
      week3: [
        { eventName: "marching.art West", day: 16 },
        { eventName: "DCI West", day: 16 }, // same show pre-branding: dup
        { eventName: "Show of Shows", day: 20 },
      ],
    };
    const { selectedShows, stats } = reconcileSelectedShows(selected, competitions, 1);
    assert.equal(selectedShows.week3.length, 2);
    assert.equal(stats.removed, 1);
  });

  test("is a no-op on already-canonical selections", () => {
    const selected = {
      week2: [{
        eventName: "marching.art Capital Classic", day: 12,
        location: "El Dorado Hills, CA", date: "2026-07-03",
      }],
    };
    const { changed, stats } = reconcileSelectedShows(selected, competitions, 1);
    assert.equal(changed, false);
    assert.equal(stats.kept, 1);
  });
});
