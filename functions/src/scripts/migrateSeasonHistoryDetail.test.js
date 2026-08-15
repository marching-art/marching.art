const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { planProfile } = require("./migrateSeasonHistoryDetail");

function heavyRow(overrides = {}) {
  return {
    seasonId: "adagio_2025-26",
    seasonName: "adagio_2025-26",
    corpsClass: "worldClass",
    corpsName: "The Cavaliers",
    placement: 3,
    totalSeasonScore: 92.1,
    showsAttended: 10,
    lineup: { GE1: "Blue Devils|2024", GE2: "Bluecoats|2023" },
    selectedShows: { week1: ["show-a"] },
    weeklyScores: {},
    archivedAt: { seconds: 1700000000 },
    ...overrides,
  };
}

describe("planProfile", () => {
  test("extracts heavy fields into detail docs and slims the summary rows", () => {
    const plan = planProfile({ corps: { worldClass: { seasonHistory: [heavyRow()] } } });

    assert.equal(plan.changed, true);
    assert.equal(plan.rowCount, 1);

    const slimmed = plan.profileUpdate["corps.worldClass.seasonHistory"];
    assert.ok(Array.isArray(slimmed));
    assert.equal(slimmed[0].lineup, undefined);
    assert.equal(slimmed[0].selectedShows, undefined);
    assert.equal(slimmed[0].weeklyScores, undefined);
    assert.equal(slimmed[0].placement, 3); // summary field preserved
    assert.equal(slimmed[0].weeks, 0);

    assert.equal(plan.detailDocs.length, 1);
    assert.equal(plan.detailDocs[0].id, "adagio_2025-26__worldClass");
    assert.deepEqual(plan.detailDocs[0].data.lineup, heavyRow().lineup);
    assert.equal(plan.detailDocs[0].data.corpsClass, "worldClass");
  });

  test("is a no-op for an already-slim profile (idempotent)", () => {
    // Run once, then feed the slimmed rows back in as a fresh profile.
    const first = planProfile({ corps: { worldClass: { seasonHistory: [heavyRow()] } } });
    const slimmed = first.profileUpdate["corps.worldClass.seasonHistory"];

    const second = planProfile({ corps: { worldClass: { seasonHistory: slimmed } } });
    assert.equal(second.changed, false);
    assert.deepEqual(second.profileUpdate, {});
    assert.equal(second.detailDocs.length, 0);
  });

  test("keys detail docs by the class the corps competed in, not its current slot", () => {
    // A climbed corps sits in worldClass but carries an aClass row.
    const plan = planProfile({
      corps: {
        worldClass: {
          seasonHistory: [heavyRow({ corpsClass: "aClass", seasonId: "s1" })],
        },
      },
    });
    assert.equal(plan.detailDocs[0].id, "s1__aClass");
    assert.equal(plan.detailDocs[0].data.corpsClass, "aClass");
  });

  test("leaves a heavy row inline when it has no season id to key on", () => {
    const plan = planProfile({
      corps: {
        worldClass: {
          seasonHistory: [heavyRow({ seasonId: undefined, seasonName: undefined })],
        },
      },
    });
    // No detail doc could be keyed, so the lineup stays where it was.
    assert.equal(plan.detailDocs.length, 0);
  });

  test("classes without history are ignored", () => {
    const plan = planProfile({
      corps: {
        worldClass: { corpsName: "No History Yet", seasonHistory: [] },
        soundSport: { corpsName: "Also None" },
      },
    });
    assert.equal(plan.changed, false);
    assert.equal(plan.rowCount, 0);
  });
});
