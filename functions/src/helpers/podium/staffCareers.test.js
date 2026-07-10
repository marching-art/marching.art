// Staff career economics (decision 28): tenure promotion + salary
// escalation, 30-season retirement, registry-driven market building, and
// the retrain learning-curve multiplier.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const staffMarket = require("./staffMarket");
const balance = require("./balanceConfig.json");

describe("staff careers (decision 28)", () => {
  test("tenure floors the tier and escalates the salary — year 20-30 is premium", () => {
    const rookie = staffMarket.salaryFor("apprentice", 0, balance);
    assert.equal(rookie, balance.staff.tiers.apprentice.salary);
    // Tenure promotes: an apprentice-talent person is a legend by year 22...
    assert.equal(staffMarket.tierForCareer("apprentice", 22, balance), "legend");
    assert.equal(staffMarket.tierForCareer("apprentice", 8, balance), "veteran");
    // ...and talent is never demoted by the floor.
    assert.equal(staffMarket.tierForCareer("legend", 0, balance), "legend");
    // Year-25 legend costs multiples of the base (320 -> 800 at 6%/season).
    const yr25 = staffMarket.salaryFor("legend", 25, balance);
    assert.ok(yr25 >= 700 && yr25 <= 900, `year-25 legend salary ${yr25}`);
    const yr29 = staffMarket.salaryFor("legend", 29, balance);
    assert.ok(yr29 > yr25, "salary keeps climbing to the end of the career");
  });

  test("a 30-season career ends in retirement; the pool refills with rookies", () => {
    const first = staffMarket.buildSeasonMarket(null, "season_one", 1, balance);
    assert.ok(first.staff.length > 0);
    const person = first.staff[0];
    // 30 seasons later the person has retired and is out of the market.
    const later = staffMarket.buildSeasonMarket(
      first.registry,
      "season_thirtyone",
      31,
      balance
    );
    assert.equal(later.registry.people[person.id].retired, true);
    assert.ok(!later.staff.some((p) => p.id === person.id), "retired staff never re-list");
    // The market still stocks every specialty (fresh rookies).
    for (const specialty of staffMarket.SPECIALTIES) {
      assert.ok(
        later.staff.some((p) => p.specialty === specialty),
        `specialty ${specialty} restocked after retirements`
      );
    }
  });

  test("veterans return to the next season's market with tenure priced in", () => {
    const first = staffMarket.buildSeasonMarket(null, "s1", 1, balance);
    const person = first.staff.find((p) => p.careerSeasons === 0);
    const second = staffMarket.buildSeasonMarket(first.registry, "s2", 2, balance);
    const returning = second.staff.find((p) => p.id === person.id);
    assert.ok(returning, "the person returns next season");
    assert.equal(returning.careerSeasons, 1);
    assert.ok(returning.salary >= person.salary, "tenure never lowers the price");
  });

  test("market build is deterministic for a seasonUid", () => {
    const a = staffMarket.buildSeasonMarket(null, "same_season", 5, balance);
    const b = staffMarket.buildSeasonMarket(null, "same_season", 5, balance);
    assert.deepEqual(
      a.staff.map((p) => [p.id, p.name, p.tier, p.salary]),
      b.staff.map((p) => [p.id, p.name, p.tier, p.salary])
    );
  });

  test("retraining halves the boost for the season it happened in, then recovers", () => {
    const member = {
      id: "x",
      boost: 0.12,
      retrain: { seasonUid: "s1", day: 20 },
    };
    const mkState = (seasonUid) => ({ seasonUid, staff: { B: member } });
    const during = staffMarket.staffYieldMultiplier(mkState("s1"), "brassSectionals", balance);
    const after = staffMarket.staffYieldMultiplier(mkState("s2"), "brassSectionals", balance);
    assert.ok(during < after, `retrain season ${during} < recovered ${after}`);
    assert.equal(after, 1.12);
    assert.equal(during, 1.06);
  });
});
