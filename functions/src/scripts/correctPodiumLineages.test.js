// correctPodiumLineages — the pure repair planner that puts every live Podium
// corps back on its own record (history follows the corps, 2026-10).
//
// Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { planLineageRepair } = require("./correctPodiumLineages");

describe("planLineageRepair", () => {
  test("a corps on its own record is left alone", () => {
    const careerData = {
      corpsName: "Cascade",
      seasonsPlayed: 2,
      division: "openClass",
      history: [{ seasonUid: "s1", corpsName: "Cascade" }, { seasonUid: "s2", corpsName: "cascade" }],
    };
    const state = { corpsName: "Cascade", division: "openClass" };
    assert.equal(planLineageRepair({ careerData, state, currentIndex: 3 }), null);
    const fresh = { corpsName: "New", seasonsPlayed: 0, history: [] };
    assert.equal(planLineageRepair({ careerData: fresh, state: { corpsName: "New", division: "aClass" }, currentIndex: 3 }), null);
  });

  test("a renamed corps banks the old record under the old name and restarts blank", () => {
    const careerData = {
      corpsName: "Rebrand",
      reputation: 40,
      seasonsPlayed: 2,
      lastSeasonUid: "s2",
      division: "openClass",
      history: [{ seasonUid: "s2", corpsName: "Original" }],
      retiredCareers: [],
    };
    const plan = planLineageRepair({
      careerData,
      state: { corpsName: "Rebrand", division: "openClass" },
      currentIndex: 3,
    });
    assert.equal(plan.kind, "renamed");
    assert.equal(plan.career.corpsName, "Rebrand");
    assert.equal(plan.career.reputation, 0);
    assert.equal(plan.career.division, "aClass");
    assert.equal(plan.career.history.length, 0);
    assert.equal(plan.career.retiredCareers[0].corpsName, "Original");
    assert.equal(plan.career.retiredCareers[0].reputation, 40);
    assert.equal(plan.career.retiredCareers[0].division, "openClass");
    assert.deepEqual(plan.state, { division: "aClass", reputation: 0, repTier: 1 });
  });

  test("a new corps that inherited its retired predecessor's season drops it", () => {
    const banked = { corpsName: "Original", lastSeasonUid: "s2", history: [{ seasonUid: "s2" }] };
    const careerData = {
      corpsName: "Fresh",
      seasonsPlayed: 1,
      reputation: 12,
      lastSeasonUid: "s2",
      history: [{ seasonUid: "s2", corpsName: "Original" }],
      retiredCareers: [banked],
    };
    const plan = planLineageRepair({ careerData, state: { corpsName: "Fresh" }, currentIndex: 3 });
    assert.equal(plan.kind, "contaminated");
    assert.equal(plan.career.reputation, 0);
    assert.equal(plan.career.seasonsPlayed, 0);
    assert.deepEqual(plan.career.retiredCareers, [banked]);
  });

  test("a new corps seated in its predecessor's class returns to A; the seat goes home", () => {
    const careerData = {
      corpsName: "Fresh",
      seasonsPlayed: 0,
      history: [],
      division: "openClass",
      retiredCareers: [{ corpsName: "Original", lastSeasonUid: "s2", division: "aClass" }],
    };
    const plan = planLineageRepair({
      careerData,
      state: { corpsName: "Fresh", division: "openClass" },
      currentIndex: 3,
    });
    assert.equal(plan.kind, "seated");
    assert.equal(plan.career.division, "aClass");
    assert.equal(plan.career.retiredCareers[0].division, "openClass");
    assert.deepEqual(plan.state, { division: "aClass" });
  });
});
