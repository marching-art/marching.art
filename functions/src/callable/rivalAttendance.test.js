// Tests for indexing rivals' show picks onto the Schedule page's show keys.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { indexRivalAttendance } = require("./rivalAttendance");

describe("indexRivalAttendance", () => {
  const rivals = {
    worldClass: [
      { uid: "f1", corpsClass: "worldClass", corpsName: "Fantasy One", scoreDelta: 0.4 },
      { uid: "p1", corpsClass: "podiumClass", corpsName: "Podium Rival", scoreDelta: -1 },
    ],
    openClass: [
      { uid: "f1", corpsClass: "worldClass", corpsName: "Fantasy One", basis: "lastSeason" },
    ],
  };
  const profiles = new Map([
    [
      "f1",
      {
        corps: {
          worldClass: {
            selectedShows: { week2: [{ eventName: "Show A", day: 10 }], week3: [{ eventName: "Show B" }] },
          },
        },
      },
    ],
  ]);
  const podium = new Map([["p1", { selectedShows: { 10: { eventName: "Show A" }, 16: { eventName: "Show C" } } }]]);
  const out = indexRivalAttendance(rivals, profiles, podium);

  test("keys fantasy picks by week and podium picks by the day's week", () => {
    assert.deepEqual(Object.keys(out).sort(), ["2|Show A", "3|Show B", "3|Show C"]);
    assert.deepEqual(
      out["2|Show A"].map((r) => r.uid).sort(),
      ["f1", "p1"],
    );
    assert.equal(out["3|Show C"][0].day, 16);
  });

  test("a director who is a rival of two of my corps is listed once per show", () => {
    assert.equal(out["3|Show B"].length, 1);
    assert.equal(out["3|Show B"][0].versusClass, "worldClass");
  });

  test("rivals with no loaded profile/state contribute nothing", () => {
    const empty = indexRivalAttendance(rivals, new Map(), new Map());
    assert.deepEqual(empty, {});
  });
});
