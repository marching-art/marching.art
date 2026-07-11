// Tests for the Podium staff catalog: the always-available hiring catalog,
// the yield-boost cap, and Tour Manager travel reduction.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { buildCatalog, staffYieldMultiplier, tourStaminaReduction, SPECIALTIES, HIRABLE_TIERS } =
  require("./staffMarket");
const balance = require("./balanceConfig.json");

describe("staff catalog", () => {
  test("offers every specialty at every entry tier, always available", () => {
    const catalog = buildCatalog(balance);
    for (const specialty of SPECIALTIES) {
      for (const tier of HIRABLE_TIERS) {
        const option = catalog.find((o) => o.specialty === specialty && o.tier === tier);
        assert.ok(option, `missing ${specialty} @ ${tier}`);
        assert.equal(option.salary, balance.staff.tiers[tier].salary);
        assert.equal(option.boost, balance.staff.tiers[tier].boost);
      }
    }
    assert.equal(catalog.length, SPECIALTIES.length * HIRABLE_TIERS.length);
  });

  test("never offers earned tiers (veteran and above) directly", () => {
    const catalog = buildCatalog(balance);
    for (const tier of ["veteran", "master", "legend"]) {
      assert.ok(!catalog.some((o) => o.tier === tier), `${tier} must be earned, not hired`);
    }
  });
});

describe("staff effects", () => {
  test("caption tech boosts blocks where their caption is primary", () => {
    const state = { staff: { B: { tier: "veteran", boost: 0.09 } } };
    assert.equal(staffYieldMultiplier(state, "brassSectionals", balance), 1.09);
    assert.equal(staffYieldMultiplier(state, "visualBasics", balance), 1);
  });

  test("program coordinator boosts full ensemble only", () => {
    const state = { staff: { programCoordinator: { tier: "master", boost: 0.12 } } };
    assert.equal(staffYieldMultiplier(state, "fullEnsemble", balance), 1.12);
    assert.equal(staffYieldMultiplier(state, "brassSectionals", balance), 1);
  });

  test("total boost is hard-capped at maxTotalBoost", () => {
    // Full Ensemble has GE1, GE2 and MA as primaries — three legends stack
    // past the cap and must clamp to +15%.
    const state = {
      staff: {
        GE1: { tier: "legend", boost: 0.15 },
        GE2: { tier: "legend", boost: 0.15 },
        MA: { tier: "legend", boost: 0.15 },
      },
    };
    assert.equal(staffYieldMultiplier(state, "fullEnsemble", balance), 1 + balance.staff.maxTotalBoost);
  });

  test("tour manager reduces travel stamina by tier percentage", () => {
    assert.equal(tourStaminaReduction({ staff: {} }, balance), 0);
    assert.equal(
      tourStaminaReduction({ staff: { tourManager: { tier: "legend" } } }, balance),
      0.3
    );
  });
});
