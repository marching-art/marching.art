// Tests for the hosted-show map boundary (helpers/podium/hostingArea.js).
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  PROJECTION,
  MAP_WIDTH,
  MAP_HEIGHT,
  HOSTABLE_REGIONS,
  isHostableArea,
} = require("./hostingArea");
const venues = require("./venues");

const hostable = (location) => isHostableArea(venues.venueFor(location));

describe("hostingArea", () => {
  test("projection is pinned to the Tour Map poster artifact", () => {
    const geo = JSON.parse(
      fs.readFileSync(path.join(__dirname, "../../../../src/data/tourMapGeo.json"), "utf8")
    );
    assert.deepEqual(
      { ...PROJECTION },
      {
        parallels: geo.meta.projection.parallels,
        rotateLng: geo.meta.projection.rotateLng,
        scale: geo.meta.projection.scale,
        translate: geo.meta.projection.translate,
      }
    );
    assert.equal(MAP_WIDTH, geo.meta.width);
    assert.equal(MAP_HEIGHT, geo.meta.height);
  });

  test("client mirror carries the same regions and projection", () => {
    const client = fs.readFileSync(
      path.join(__dirname, "../../../../src/utils/hostingArea.ts"),
      "utf8"
    );
    for (const region of HOSTABLE_REGIONS) assert.match(client, new RegExp(`'${region}'`));
    assert.match(client, new RegExp(String(PROJECTION.scale).replace(".", "\\.")));
    assert.match(client, new RegExp(String(PROJECTION.translate[1]).replace(".", "\\.")));
  });

  test("every lower-48 corner and the southern-Canada / northern-Mexico bands are on the map", () => {
    for (const town of [
      "Key West, FL",
      "San Diego, CA",
      "Brownsville, TX",
      "Bellingham, WA",
      "Eastport, ME",
      "International Falls, MN",
      "Washington, DC",
      "Vancouver, BC",
      "Winnipeg, MB",
      "Toronto, ON",
      "Montreal, QC",
      "Quebec, QC",
      "Monterrey, NLE",
      "Tijuana, BCN",
      "Hermosillo, SON",
    ]) {
      assert.equal(hostable(town), true, town);
    }
  });

  test("Alaska, Hawaii, the Maritimes and the far north are off the map", () => {
    for (const town of [
      "Anchorage, AK",
      "Honolulu, HI",
      "Halifax, NS",
      "St. John's, NL",
      "Charlottetown, PE",
      "Edmonton, AB",
      "Fort McMurray, AB",
    ]) {
      assert.ok(venues.venueFor(town), `${town} should resolve`);
      assert.equal(hostable(town), false, town);
    }
  });

  test("unresolved or coordinate-less venues are refused", () => {
    assert.equal(isHostableArea(null), false);
    assert.equal(isHostableArea({ region: "OH" }), false);
    assert.equal(isHostableArea({ region: "XX", lat: 40, lng: -82 }), false);
  });
});
