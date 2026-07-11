// Tests for hosted-event validation (Phase 6.2). Payout flow is covered by
// the E2E smoke; this pins the pure request validation.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { validateHostRequest, scheduledVenueIds } = require("./hostedEvents");
const venues = require("./venues");

const good = {
  eventName: "The Rohn Invitational",
  venueTier: "collegeBowl",
  day: 20,
  location: "Canton, Ohio",
};

describe("validateHostRequest", () => {
  test("accepts a valid request and resolves the venue", () => {
    const result = validateHostRequest(good, 10);
    assert.equal(result.day, 20);
    assert.equal(result.venue.city, "Canton");
    assert.equal(result.tier.capacity, 30);
  });

  test("rejects unknown tiers, bad names, and unknown cities", () => {
    assert.throws(() => validateHostRequest({ ...good, venueTier: "colosseum" }, 10));
    assert.throws(() => validateHostRequest({ ...good, eventName: "ab" }, 10));
    assert.throws(() => validateHostRequest({ ...good, location: "Atlantis, Ocean" }, 10));
  });

  test("rejects the majors' exclusive days and too-soon/too-late dates", () => {
    assert.throws(() => validateHostRequest({ ...good, day: 28 }, 10)); // Southwestern
    assert.throws(() => validateHostRequest({ ...good, day: 41 }, 10)); // Eastern N1
    assert.throws(() => validateHostRequest({ ...good, day: 11 }, 10)); // < 2 days ahead
    assert.throws(() => validateHostRequest({ ...good, day: 45 }, 10)); // champ week
  });
});

describe("scheduledVenueIds", () => {
  test("resolves scheduled locations to venueIds, ignoring unknown ones", () => {
    const canton = venues.venueFor("Canton, Ohio");
    const allentown = venues.venueFor("Allentown, Pennsylvania");
    const taken = scheduledVenueIds([
      { location: "Canton, OH" }, // abbreviation still resolves
      { location: "Allentown, Pennsylvania" },
      { location: "Atlantis, Ocean" }, // unknown -> skipped
      { location: "" }, // empty -> skipped
      {}, // no location -> skipped
    ]);
    assert.ok(taken.has(canton.venueId));
    assert.ok(taken.has(allentown.venueId));
    assert.equal(taken.size, 2);
  });

  test("handles empty/undefined input", () => {
    assert.equal(scheduledVenueIds([]).size, 0);
    assert.equal(scheduledVenueIds(undefined).size, 0);
  });
});
