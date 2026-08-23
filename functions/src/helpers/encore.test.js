// Tests for the cosmetic encore assignment: proximity default, the absolute
// 1-per-corps-per-season cap, host default, and the host-after-encore edge case.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { assignEncore, encoreKey } = require("./encore");

// Simple planar-ish coords are fine — milesBetween is monotonic in distance.
const VENUE = { lat: 40.0, lng: -75.0 };
const near = { lat: 40.1, lng: -75.1 }; // ~9 mi
const mid = { lat: 41.0, lng: -75.0 }; // ~69 mi
const far = { lat: 45.0, lng: -75.0 }; // ~345 mi

const reg = (uid, corpsName, homeGeo, corpsClass = "worldClass") => ({
  uid,
  corpsClass,
  corpsName,
  homeGeo,
});

describe("assignEncore", () => {
  test("picks the corps whose home is closest to the venue", () => {
    const e = assignEncore({
      registrations: [reg("u1", "Far", far), reg("u2", "Near", near), reg("u3", "Mid", mid)],
      venueGeo: VENUE,
      usedKeys: new Set(),
    });
    assert.equal(e.corps, "Near");
    assert.equal(e.reason, "proximity");
    assert.ok(e.miles >= 0 && e.miles < 20);
  });

  test("skips corps that already used their season encore (the cap)", () => {
    const used = new Set([encoreKey(reg("u2", "Near", near))]);
    const e = assignEncore({
      registrations: [reg("u1", "Far", far), reg("u2", "Near", near), reg("u3", "Mid", mid)],
      venueGeo: VENUE,
      usedKeys: used,
    });
    assert.equal(e.corps, "Mid"); // Near is used → next closest
  });

  test("host corps gets the encore at its own show", () => {
    const e = assignEncore({
      registrations: [reg("host", "Host Corps", far), reg("u2", "Near", near)],
      venueGeo: VENUE,
      usedKeys: new Set(),
      hostUid: "host",
    });
    assert.equal(e.corps, "Host Corps");
    assert.equal(e.reason, "host");
  });

  test("host-after-encore: a host who already encored yields to the next-closest", () => {
    const used = new Set([encoreKey(reg("host", "Host Corps", far))]);
    const e = assignEncore({
      registrations: [reg("host", "Host Corps", far), reg("u2", "Near", near)],
      venueGeo: VENUE,
      usedKeys: used,
      hostUid: "host",
    });
    assert.equal(e.corps, "Near");
    assert.equal(e.reason, "proximity");
  });

  test("a corps that declined (banked) here is skipped, next-closest gets it", () => {
    const near = { lat: 40.1, lng: -75.1 };
    const registrations = [
      { ...reg("u1", "Banker", near), encoreDeclined: true }, // closest, but banked
      reg("u2", "Taker", mid),
    ];
    const e = assignEncore({ registrations, venueGeo: VENUE, usedKeys: new Set() });
    assert.equal(e.corps, "Taker");
  });

  test("declining even applies to the host default", () => {
    const e = assignEncore({
      registrations: [
        { ...reg("host", "Host Corps", far), encoreDeclined: true },
        reg("u2", "Near", near),
      ],
      venueGeo: VENUE,
      usedKeys: new Set(),
      hostUid: "host",
    });
    assert.equal(e.corps, "Near"); // host banked theirs → proximity fallback
  });

  test("corps with no resolvable home are skipped for proximity", () => {
    const e = assignEncore({
      registrations: [reg("u1", "NoHome", null), reg("u2", "Near", near)],
      venueGeo: VENUE,
      usedKeys: new Set(),
    });
    assert.equal(e.corps, "Near");
  });

  test("returns null when nobody is eligible", () => {
    assert.equal(
      assignEncore({ registrations: [], venueGeo: VENUE, usedKeys: new Set() }),
      null
    );
    // Everyone used up.
    const used = new Set([encoreKey(reg("u1", "A", near))]);
    assert.equal(
      assignEncore({ registrations: [reg("u1", "A", near)], venueGeo: VENUE, usedKeys: used }),
      null
    );
  });

  test("no venue coords and no host → null (nothing to measure)", () => {
    assert.equal(
      assignEncore({ registrations: [reg("u1", "A", near)], venueGeo: null, usedKeys: new Set() }),
      null
    );
  });
});
