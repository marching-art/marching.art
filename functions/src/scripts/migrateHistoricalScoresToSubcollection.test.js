// Unit tests for the historical_scores sharding migration planner (pure).
// Run with `npm test` from functions/.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { planYear } = require("./migrateHistoricalScoresToSubcollection");
const { eventDocId } = require("../helpers/historicalScores");

const event = (overrides = {}) => ({
  eventName: "Regional",
  date: "2024-07-15",
  location: "Anywhere",
  scores: [{ corps: "Blue Devils", captions: { GE1: 18 } }],
  offSeasonDay: 20,
  ...overrides,
});

describe("planYear", () => {
  test("plans every legacy event when the subcollection is empty", () => {
    const parentData = { data: [event({ eventName: "A" }), event({ eventName: "B" })] };
    const plan = planYear(parentData, new Set());
    assert.equal(plan.changed, true);
    assert.equal(plan.eventsToWrite.length, 2);
    assert.equal(plan.alreadySharded, 0);
    // Each planned write is keyed by the canonical event doc id.
    assert.equal(plan.eventsToWrite[0].id, eventDocId("A", "2024-07-15"));
  });

  test("skips events already present in the subcollection (sharded wins)", () => {
    const a = event({ eventName: "A" });
    const b = event({ eventName: "B" });
    const existing = new Set([eventDocId("A", "2024-07-15")]);
    const plan = planYear({ data: [a, b] }, existing);
    assert.equal(plan.eventsToWrite.length, 1);
    assert.equal(plan.eventsToWrite[0].id, eventDocId("B", "2024-07-15"));
    assert.equal(plan.alreadySharded, 1);
    // Still clears the array — a year with any legacy data must be flushed.
    assert.equal(plan.changed, true);
  });

  test("no-op for an already-migrated year (empty/absent legacy array)", () => {
    assert.equal(planYear({ sharded: true }, new Set()).changed, false);
    assert.equal(planYear({ data: [] }, new Set()).changed, false);
    assert.equal(planYear(undefined, new Set()).changed, false);
  });

  test("all-already-sharded year still clears its legacy array", () => {
    const a = event({ eventName: "A" });
    const plan = planYear({ data: [a] }, new Set([eventDocId("A", "2024-07-15")]));
    assert.equal(plan.eventsToWrite.length, 0);
    assert.equal(plan.alreadySharded, 1);
    assert.equal(plan.changed, true); // legacy array will be cleared
  });

  test("ignores malformed rows in the legacy array", () => {
    const plan = planYear({ data: [null, "junk", event({ eventName: "Real" })] }, new Set());
    assert.equal(plan.eventsToWrite.length, 1);
    assert.equal(plan.eventsToWrite[0].id, eventDocId("Real", "2024-07-15"));
  });
});
