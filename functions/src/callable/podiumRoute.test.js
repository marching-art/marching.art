// Tests for the route sheet's origin — the corps' current location (design
// §5.12). The route legs themselves are covered by the simulation harness;
// this is the pure display resolution the Upcoming Route module reads.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { buildCurrentLocation } = require("./podiumRoute");

const UID = "director-1";
// A show the corps self-picked on day 12 — enough for isShowDayFor to agree
// the corps competed that night.
const baseState = {
  seasonUid: "season-1",
  division: "worldClass",
  location: "Allentown, Pennsylvania",
  selectedShows: { 12: { eventName: "A Show", location: "Allentown, PA" } },
};

describe("buildCurrentLocation", () => {
  test("before the first show the corps sits at its hometown", () => {
    const result = buildCurrentLocation(baseState, UID, 5, null);
    assert.equal(result.atHome, true);
    assert.equal(result.mapped, true);
    assert.equal(result.city, "Allentown, PA");
    assert.equal(result.sinceDay, null);
  });

  test("after a show it reports that venue and the day it moved there", () => {
    const state = {
      ...baseState,
      lastVenue: { venueId: "indianapolis-in", city: "Indianapolis", region: "IN" },
    };
    const result = buildCurrentLocation(state, UID, 14, null);
    assert.equal(result.atHome, false);
    assert.equal(result.city, "Indianapolis, IN");
    assert.equal(result.venueId, "indianapolis-in");
    assert.equal(result.sinceDay, 12);
  });

  test("an unmapped hometown keeps the raw text and flags itself unmapped", () => {
    const result = buildCurrentLocation({ ...baseState, location: "Atlantis, Ocean" }, UID, 5, null);
    assert.equal(result.mapped, false);
    assert.equal(result.city, "Atlantis, Ocean");
    assert.equal(result.venueId, null);
  });

  test("no hometown and no show leaves every field empty rather than guessing", () => {
    const result = buildCurrentLocation({ seasonUid: "season-1" }, UID, 3, null);
    assert.equal(result.mapped, false);
    assert.equal(result.city, null);
    assert.equal(result.stadium, null);
  });
});
