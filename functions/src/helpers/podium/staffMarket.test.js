// Tests for the Podium staff market (Phase 4.3-4.6): deterministic
// generation, the yield-boost cap, and Tour Manager travel reduction.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { generateMarket, staffYieldMultiplier, tourStaminaReduction, SPECIALTIES } =
  require("./staffMarket");
const balance = require("./balanceConfig.json");

describe("staff market generation", () => {
  test("deterministic per season", () => {
    assert.deepEqual(generateMarket("season_a"), generateMarket("season_a"));
  });

  test("different seasons produce different markets", () => {
    const a = JSON.stringify(generateMarket("season_a"));
    const b = JSON.stringify(generateMarket("season_b"));
    assert.notEqual(a, b);
  });

  test("covers every specialty with unsigned staff and valid tiers", () => {
    const market = generateMarket("season_c");
    for (const specialty of SPECIALTIES) {
      const pool = market.filter((person) => person.specialty === specialty);
      assert.ok(pool.length >= 5, `${specialty} pool too small (${pool.length})`);
      for (const person of pool) {
        assert.equal(person.signedBy, null);
        assert.ok(balance.staff.tiers[person.tier], `unknown tier ${person.tier}`);
        assert.equal(person.salary, balance.staff.tiers[person.tier].salary);
      }
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
