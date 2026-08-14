// Regression tests for venueFor resolution, focused on the state-code
// standardized location form. Schedules now store "City, ST" (locations pass
// through helpers/locationFormat.standardizeLocation before storage), so the
// Podium travel/heat/timezone math — which all funnels through venueFor — must
// resolve that form to the same venue the raw historical spelling did.
//
// Uses Node's built-in test runner (node:test). Run with `npm test` in functions/.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const venues = require("./venues");
const { standardizeLocation } = require("../locationFormat");
const gazetteer = require("./venueGazetteer.json");

describe("venueFor — standardized location resolution", () => {
  test("resolves the code form to the same venue as the full-name form", () => {
    const full = venues.venueFor("Dallas, Texas");
    const code = venues.venueFor("Dallas, TX");
    assert.ok(full, "full-name form should resolve");
    assert.ok(code, "code form should resolve");
    assert.equal(code.venueId, full.venueId);
  });

  test("every historical location still resolves after standardization", () => {
    const failures = [];
    const mismatches = [];
    for (const [key, venue] of Object.entries(gazetteer.venues)) {
      const variants = venue.rawVariants && venue.rawVariants.length
        ? venue.rawVariants
        : [key];
      for (const raw of variants) {
        const resolved = venues.venueFor(standardizeLocation(raw));
        if (!resolved) {
          failures.push(raw);
        } else if (resolved.venueId !== venue.venueId) {
          mismatches.push(`${raw} -> ${resolved.venueId} (want ${venue.venueId})`);
        }
      }
    }
    assert.deepEqual(failures, [], `standardized locations that no longer resolve: ${failures.join(", ")}`);
    assert.deepEqual(mismatches, [], `standardized locations resolving to the wrong venue: ${mismatches.join(", ")}`);
  });

  test("resolves a standardized form even when the gazetteer corrected the city", () => {
    // "Severieville, Tennessee" is a source typo the gazetteer geocoded to
    // Sevierville, TN. Its standardized form keeps the typo ("Severieville, TN")
    // and must still resolve via the raw-variant fallback index.
    const std = standardizeLocation("Severieville, Tennessee");
    assert.equal(std, "Severieville, TN");
    const resolved = venues.venueFor(std);
    assert.ok(resolved, "typo'd standardized form should resolve");
    assert.equal(resolved.city, "Sevierville");
    assert.equal(resolved.region, "TN");
  });

  test("timezoneFor resolves through the standardized form", () => {
    // Indianapolis is stored as "Indianapolis, IN"; its timezone must resolve
    // (the furthest-west score-drop rule depends on it).
    assert.equal(venues.timezoneFor("Indianapolis, IN"), venues.timezoneFor("Indianapolis, Indiana"));
  });
});

describe("relocationFee — the home-move sink (design §5.3)", () => {
  const cfg = { home: { milesPerCoin: 2 } };

  test("same home (or unknown endpoint) is free", () => {
    const dallas = venues.venueFor("Dallas, Texas");
    assert.deepEqual(venues.relocationFee(dallas, dallas, cfg), { miles: 0, fee: 0 });
    assert.deepEqual(venues.relocationFee(null, dallas, cfg), { miles: 0, fee: 0 });
    assert.deepEqual(venues.relocationFee(dallas, null, cfg), { miles: 0, fee: 0 });
  });

  test("charges 1 CorpsCoin per 2 miles of great-circle distance", () => {
    const dallas = venues.venueFor("Dallas, Texas");
    const atlanta = venues.venueFor("Atlanta, Georgia");
    const expectMiles = Math.round(venues.haversineMiles(dallas, atlanta));
    const { miles, fee } = venues.relocationFee(dallas, atlanta, cfg);
    assert.equal(miles, expectMiles);
    // Dallas↔Atlanta is ~720 mi straight-line → ~360 CC.
    assert.equal(fee, Math.ceil(venues.haversineMiles(dallas, atlanta) / 2));
    assert.ok(fee > 300 && fee < 400, `unexpected fee ${fee}`);
  });

  test("falls back to a 2-mile rate when balance omits the home section", () => {
    const dallas = venues.venueFor("Dallas, Texas");
    const atlanta = venues.venueFor("Atlanta, Georgia");
    assert.deepEqual(
      venues.relocationFee(dallas, atlanta, {}),
      venues.relocationFee(dallas, atlanta, cfg)
    );
  });
});
