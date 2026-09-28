// Podium hometown rules: the structured home record, which homes the old
// show-city-only rule forced, and who may use the one-time free correction.
// Run with `npm test` inside functions/.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { homeRecordFor, homeWasForced, canCorrectHome } = require("./hometown");

const forcedHome = { venueId: "canton-oh", city: "Canton", region: "OH", lat: 40.8, lng: -81.38 };

describe("homeRecordFor", () => {
  test("keeps the venue identity + coordinates and stamps anyTown", () => {
    const record = homeRecordFor({ ...forcedHome, timezone: "America/New_York", source: "place" });
    assert.deepEqual(record, { ...forcedHome, anyTown: true });
  });
});

describe("homeWasForced", () => {
  test("a home without anyTown was picked under the show-city-only rule", () => {
    assert.equal(homeWasForced({ home: forcedHome }), true);
  });
  test("a legacy corps with only free text never chose a mapped home either", () => {
    assert.equal(homeWasForced({ location: "Somewhere, OH" }), true);
  });
  test("a home chosen from the any-town picker, or already corrected, is not", () => {
    assert.equal(homeWasForced({ home: { ...forcedHome, anyTown: true } }), false);
    assert.equal(homeWasForced({ home: forcedHome, homeCorrectedAt: "2026-09-28T00:00:00Z" }), false);
    assert.equal(homeWasForced(null), false);
  });
});

describe("canCorrectHome", () => {
  test("open only for a forced home in the active season", () => {
    assert.equal(canCorrectHome({ seasonUid: "s1", home: forcedHome }, "s1"), true);
    assert.equal(canCorrectHome({ seasonUid: "s0", home: forcedHome }, "s1"), false);
    assert.equal(canCorrectHome({ seasonUid: "s1", home: { ...forcedHome, anyTown: true } }, "s1"), false);
    assert.equal(canCorrectHome(undefined, "s1"), false);
  });
});
