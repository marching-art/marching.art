// Tests for the route sheet's origin — the corps' current location (design
// §5.12). The route legs themselves are covered by the simulation harness;
// this is the pure display resolution the Upcoming Route module reads.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { buildCurrentLocation, buildRouteLegs } = require("./podiumRoute");
const venues = require("../helpers/podium/venues");
const store = require("../helpers/podium/store");

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

describe("buildRouteLegs — joint rehearsals never relocate the tour (design §5.12)", () => {
  // The corps is at Canton, OH. A joint on day 10 is hosted a long way off in
  // Dallas, TX (the frozen host city — set by the OTHER director's tour
  // position); a self-picked show follows on day 12 in Akron, OH, a day-trip
  // (25 mi) from Canton.
  const cantonState = () => ({
    seasonUid: "season-1",
    division: "worldClass",
    location: "Canton, Ohio",
    lastVenue: venues.venueFor("Canton, Ohio"),
  });
  const upcoming = [10, 12];
  const locations = { 12: "Akron, Ohio" };

  test("the accepting director (free joint) is not charged travel onward from the host city", () => {
    const jointByDay = {
      10: {
        day: 10,
        city: "Dallas, Texas",
        // The acceptor's copy carries no travel tier — they host, they pay
        // nothing to get to the joint.
        travelTier: null,
        partnerCorpsName: "Sun Devils",
        bonusMult: 1.25,
      },
    };
    const legs = buildRouteLegs(cantonState(), upcoming, { jointByDay, locations });
    assert.equal(legs.length, 2);

    const [jointLeg, showLeg] = legs;
    assert.equal(jointLeg.isJoint, true);
    assert.equal(jointLeg.coinCost, 0, "acceptor pays no coin for the joint");
    assert.equal(jointLeg.staminaCost, 0, "acceptor pays no stamina for the joint");

    // The bug: with the cursor relocated to Dallas, this show leg would be
    // priced Dallas→Akron (1222 mi, 15 stamina). It must be priced from the
    // corps' real position, Canton→Akron (25 mi, a free local day trip).
    assert.equal(showLeg.day, 12);
    assert.ok(!showLeg.isJoint);
    assert.equal(showLeg.miles, 25, "onward show is routed from Canton, not the joint's host city");
    assert.equal(showLeg.tier, "local");
    assert.equal(showLeg.staminaCost, 0, "no phantom onward-travel penalty from the joint");
  });

  test("even a priced (proposer) joint leg does not move the tour cursor", () => {
    // The proposer's copy carries the frozen day-trip tier — shown on the joint
    // leg — but the corps still rehearses and returns to its own position, so
    // the onward show is unaffected.
    const jointByDay = {
      10: {
        day: 10,
        city: "Dallas, Texas",
        travelTier: "crossCountry",
        partnerCorpsName: "Sun Devils",
        bonusMult: 1.25,
      },
    };
    const tierCfg = store.balance.travel.tiers.find((t) => t.key === "crossCountry");
    const legs = buildRouteLegs(cantonState(), upcoming, { jointByDay, locations });

    const [jointLeg, showLeg] = legs;
    assert.equal(jointLeg.staminaCost, tierCfg.staminaCost, "joint leg shows the frozen day-trip cost");
    // Onward show is still Canton→Akron, not Dallas→Akron.
    assert.equal(showLeg.miles, 25);
    assert.equal(showLeg.staminaCost, 0);
  });
});
