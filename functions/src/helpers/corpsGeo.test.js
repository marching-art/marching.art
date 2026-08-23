// Tests for corps home geolocation. Uses the real venue gazetteer (a pure
// in-memory lookup), so a known DCI city resolves and gibberish doesn't.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { homeGeoFor, milesBetween } = require("./corpsGeo");

describe("homeGeoFor", () => {
  test("resolves a known venue city to coordinates + venueId", () => {
    const geo = homeGeoFor("Allentown, PA");
    assert.ok(geo, "Allentown should resolve");
    assert.ok(Number.isFinite(geo.lat) && Number.isFinite(geo.lng));
    assert.ok(typeof geo.venueId === "string" && geo.venueId.length > 0);
  });

  test("resolves a spelled-out region via standardization", () => {
    // The gazetteer/standardizer accept "City, State" spelled out too.
    const geo = homeGeoFor("Allentown, Pennsylvania");
    assert.ok(geo, "spelled-out state should still resolve");
  });

  test("unresolvable / empty text → null", () => {
    assert.equal(homeGeoFor("Nowheresville, ZZ"), null);
    assert.equal(homeGeoFor(""), null);
    assert.equal(homeGeoFor(null), null);
  });
});

describe("milesBetween", () => {
  test("is ~0 for the same point and positive for distinct points", () => {
    const a = homeGeoFor("Allentown, PA");
    assert.equal(Math.round(milesBetween(a, a)), 0);
    const b = homeGeoFor("San Antonio, TX");
    assert.ok(b && milesBetween(a, b) > 500);
  });

  test("null when either point is missing", () => {
    assert.equal(milesBetween(null, { lat: 1, lng: 2 }), null);
    assert.equal(milesBetween({ lat: 1, lng: 2 }, null), null);
  });
});
