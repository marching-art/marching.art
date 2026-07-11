// Store loaders that back the Podium API. Currently pins loadScheduleLocations,
// the {day -> location} preload joint-rehearsal acceptance uses to resolve each
// corps' tour position (helpers/podium/joint.corpsVenueOnDay). A missing/renamed
// export here previously crashed every accept with an internal error, so this
// guards the exact contract that path depends on.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const store = require("./store");

// Minimal Firestore stub: only db.doc(path).get() is exercised.
function fakeDb(competitions) {
  return {
    doc: () => ({
      get: async () => ({ exists: true, data: () => ({ competitions }) }),
    }),
  };
}

describe("loadScheduleLocations", () => {
  test("maps each schedule day to its location string", async () => {
    const db = fakeDb([
      { day: 5, name: "DCI Tour Premiere", location: "Akron, Ohio" },
      { day: 12, name: "DCI Southeastern", location: "Atlanta, Georgia" },
    ]);
    const locations = await store.loadScheduleLocations(db, { dataDocId: "sched-1" });
    assert.equal(locations[5], "Akron, Ohio");
    assert.equal(locations[12], "Atlanta, Georgia");
  });

  test("keeps the first non-empty location when a day has several shows", async () => {
    const db = fakeDb([
      { day: 8, name: "Placeholder", location: "" },
      { day: 8, name: "DCI Mideast", location: "Massillon, Ohio" },
    ]);
    const locations = await store.loadScheduleLocations(db, { dataDocId: "sched-1" });
    assert.equal(locations[8], "Massillon, Ohio");
  });

  test("returns an empty map when the schedule doc is missing", async () => {
    const db = { doc: () => ({ get: async () => ({ exists: false }) }) };
    const locations = await store.loadScheduleLocations(db, { dataDocId: "sched-1" });
    assert.deepEqual(locations, {});
  });
});
