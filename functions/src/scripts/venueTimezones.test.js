const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  standardOffsetHours,
  resolveVenueTimezone,
  enrichVenuesWithTimezones,
} = require("./venueTimezones");
const { timezoneFor } = require("../helpers/podium/venues");

test("standardOffsetHours reports standard-time (not DST) offsets", () => {
  assert.equal(standardOffsetHours("America/New_York"), -5);
  assert.equal(standardOffsetHours("America/Chicago"), -6);
  assert.equal(standardOffsetHours("America/Denver"), -7);
  assert.equal(standardOffsetHours("America/Los_Angeles"), -8);
  // Arizona is Mountain-standard year-round.
  assert.equal(standardOffsetHours("America/Phoenix"), -7);
});

test("resolveVenueTimezone: coordinate zone matching the state verifies as geo", () => {
  const fakeLookup = () => "America/Denver";
  const r = resolveVenueTimezone({ lat: 31.76, lng: -106.49, region: "TX" }, fakeLookup);
  // El Paso: Mountain is a legitimate Texas zone -> verified.
  assert.equal(r.timezone, "America/Denver");
  assert.equal(r.tzSource, "geo");
});

test("resolveVenueTimezone: zone outside the state's expected set is flagged", () => {
  const fakeLookup = () => "America/Los_Angeles"; // Pacific in Texas is impossible
  const r = resolveVenueTimezone({ lat: 30, lng: -97, region: "TX" }, fakeLookup);
  assert.equal(r.tzSource, "needs-review");
  assert.match(r.note, /not in expected/);
});

test("resolveVenueTimezone: centroid-sourced geocodes are never auto-verified", () => {
  const fakeLookup = () => "America/New_York";
  const r = resolveVenueTimezone({ lat: 40, lng: -77, region: "PA", source: "centroid" }, fakeLookup);
  assert.equal(r.timezone, "America/New_York");
  assert.equal(r.tzSource, "needs-review");
  assert.match(r.note, /centroid/);
});

test("resolveVenueTimezone: unknown region is flagged", () => {
  const fakeLookup = () => "America/New_York";
  const r = resolveVenueTimezone({ lat: 40, lng: -77, region: "ZZ" }, fakeLookup);
  assert.equal(r.tzSource, "needs-review");
  assert.match(r.note, /no expected-offset entry/);
});

test("resolveVenueTimezone: missing coordinates -> unresolved", () => {
  const r = resolveVenueTimezone({ region: "PA" }, () => "America/New_York");
  assert.equal(r.timezone, null);
  assert.equal(r.tzSource, "needs-review");
});

test("enrichVenuesWithTimezones stamps every venue and tallies stats", () => {
  const gaz = {
    venues: {
      a: { lat: 40.71, lng: -74.0, region: "NY" },
      b: { lat: 34.05, lng: -118.24, region: "CA" },
    },
  };
  const fakeLookup = (lat) => (lat > 38 ? "America/New_York" : "America/Los_Angeles");
  const { stats } = enrichVenuesWithTimezones(gaz, fakeLookup);
  assert.equal(gaz.venues.a.timezone, "America/New_York");
  assert.equal(gaz.venues.b.timezone, "America/Los_Angeles");
  assert.equal(stats.geo, 2);
  assert.equal(stats.needsReview, 0);
});

test("committed gazetteer carries timezones consumed via timezoneFor()", () => {
  // Historical spelling and canonical "City, ST" both resolve.
  assert.equal(timezoneFor("El Paso, Texas"), "America/Denver"); // Mountain, split from Central TX
  assert.equal(timezoneFor("Indianapolis, Indiana"), "America/Indiana/Indianapolis");
  assert.equal(timezoneFor("Allentown, PA"), "America/New_York");
  assert.equal(timezoneFor("Denver, Colorado"), "America/Denver");
  assert.equal(timezoneFor("Nowhere, Nowhereland"), null);
});
