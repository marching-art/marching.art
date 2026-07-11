// Tests for the Podium staff catalog: the always-available hiring catalog,
// the yield-boost cap, and Tour Manager travel reduction.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  buildCatalog,
  staffYieldMultiplier,
  tourStaminaReduction,
  projectRetention,
  mintStaff,
  ageStaff,
  SPECIALTIES,
  HIRABLE_TIERS,
} = require("./staffMarket");
const balance = require("./balanceConfig.json");

// A carried staffer with a given tenure and lapsed salary lock (remaining 0),
// so its NEXT-season salary is the floated tenured rate — the realistic input
// to a between-seasons retention projection.
function carried(specialty, careerSeasons) {
  const hire = mintStaff(
    { id: `${specialty}_x`, specialty, tier: "journeyman", seasons: 1, day: 0 },
    balance
  );
  let m = hire;
  for (let i = 0; i < careerSeasons; i++) m = ageStaff(m, balance);
  return m;
}

// What `carried(specialty, n)` will cost NEXT season (one more aging step).
function nextSalaryOf(member) {
  return ageStaff(member, balance).salaryPerSeason;
}

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

describe("projectRetention — the CC-vs-payroll funding preview", () => {
  test("a budget that covers everyone keeps the whole roster", () => {
    const roster = { B: carried("B", 4), CG: carried("CG", 1) };
    const payroll = nextSalaryOf(roster.B) + nextSalaryOf(roster.CG);
    const plan = projectRetention(roster, payroll, balance);
    assert.equal(plan.payroll, payroll);
    assert.equal(plan.affordable, true);
    assert.deepEqual(plan.lapsed, []);
    assert.equal(plan.kept.length, 2);
  });

  test("a shortfall flags unaffordable and lapses the director's low-priority pick", () => {
    const roster = { B: carried("B", 6), CG: carried("CG", 1) };
    const brass = nextSalaryOf(roster.B);
    const guard = nextSalaryOf(roster.CG);
    assert.ok(brass > guard, "tenured brass should out-cost the rookie guard");

    // Budget covers only the cheaper staffer. Priority = keep brass first.
    const keepBrass = projectRetention(roster, brass, balance, ["B", "CG"]);
    assert.equal(keepBrass.affordable, false);
    assert.deepEqual(keepBrass.kept, ["B"]);
    assert.deepEqual(keepBrass.lapsed, ["CG"]);
    assert.equal(keepBrass.staff.find((s) => s.specialty === "CG").lapseReason, "unaffordable");

    // Same budget, reversed priority — the director keeps the guard instead.
    const keepGuard = projectRetention(roster, guard, balance, ["CG", "B"]);
    assert.deepEqual(keepGuard.kept, ["CG"]);
    assert.deepEqual(keepGuard.lapsed, ["B"]);
  });

  test("omitting a staffer from keepOrder releases them even when affordable", () => {
    const roster = { B: carried("B", 4), CG: carried("CG", 1) };
    const fullPayroll = nextSalaryOf(roster.B) + nextSalaryOf(roster.CG);
    // Plenty of budget, but the director chooses to keep only brass.
    const plan = projectRetention(roster, fullPayroll, balance, ["B"]);
    assert.deepEqual(plan.kept, ["B"]);
    assert.deepEqual(plan.lapsed, ["CG"]);
    assert.equal(plan.staff.find((s) => s.specialty === "CG").lapseReason, "released");
    // Payroll still reports the full roster cost so the UI can show the total.
    assert.equal(plan.payroll, fullPayroll);
  });

  test("a 30-season career retires: drops off at zero cost, not a chosen loss", () => {
    const retiring = carried("MA", balance.staff.career.maxSeasons - 1);
    const roster = { MA: retiring, VP: carried("VP", 1) };
    const plan = projectRetention(roster, 0, balance, ["MA", "VP"]);
    const ma = plan.staff.find((s) => s.specialty === "MA");
    assert.equal(ma.retiring, true);
    assert.equal(ma.nextSalary, 0);
    assert.equal(ma.lapseReason, "retired");
    assert.ok(!plan.kept.includes("MA") && !plan.lapsed.includes("MA"));
    // Payroll counts only the still-active staffer.
    assert.equal(plan.payroll, nextSalaryOf(roster.VP));
  });

  test("with no keepOrder a shortfall sheds the cheapest staffer first", () => {
    const roster = { B: carried("B", 6), CG: carried("CG", 1) };
    const brass = nextSalaryOf(roster.B);
    const plan = projectRetention(roster, brass, balance); // covers brass alone
    assert.deepEqual(plan.kept, ["B"]);
    assert.deepEqual(plan.lapsed, ["CG"]);
  });

  test("an empty roster is trivially affordable", () => {
    const plan = projectRetention({}, 0, balance);
    assert.deepEqual(plan.staff, []);
    assert.equal(plan.payroll, 0);
    assert.equal(plan.affordable, true);
  });
});
