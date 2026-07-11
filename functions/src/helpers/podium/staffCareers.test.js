// Staff careers: earn-it-by-retaining. Tenure promotion + salary escalation,
// minting a fresh hire, aging a retained staffer (tier growth, the contract
// salary lock, resume banking, 30-season retirement), and the retrain
// learning-curve multiplier.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const staffMarket = require("./staffMarket");
const balance = require("./balanceConfig.json");

/** Age a member `n` seasons, banking the same completed-season stub each time. */
function ageN(member, n, completed) {
  let m = member;
  for (let i = 0; i < n && m; i++) m = staffMarket.ageStaff(m, balance, completed);
  return m;
}

describe("staff careers — tenure math", () => {
  test("tenure floors the tier and escalates the salary — year 20-30 is premium", () => {
    assert.equal(staffMarket.salaryFor("apprentice", 0, balance), balance.staff.tiers.apprentice.salary);
    // Tenure promotes an apprentice hire: journeyman by yr 3, veteran by 8,
    // legend by 22...
    assert.equal(staffMarket.tierForCareer("apprentice", 3, balance), "journeyman");
    assert.equal(staffMarket.tierForCareer("apprentice", 8, balance), "veteran");
    assert.equal(staffMarket.tierForCareer("apprentice", 22, balance), "legend");
    // ...and a higher entry tier is never demoted by the floor.
    assert.equal(staffMarket.tierForCareer("journeyman", 0, balance), "journeyman");
    // Year-25 legend costs multiples of the base (320 -> 800 at 6%/season).
    const yr25 = staffMarket.salaryFor("legend", 25, balance);
    assert.ok(yr25 >= 700 && yr25 <= 900, `year-25 legend salary ${yr25}`);
    assert.ok(staffMarket.salaryFor("legend", 29, balance) > yr25, "salary climbs to the end");
  });
});

describe("staff careers — hire and retain", () => {
  test("mintStaff produces a fresh entry-tier instance", () => {
    const m = staffMarket.mintStaff(
      { id: "x", specialty: "B", tier: "apprentice", seasons: 2, day: 5 },
      balance
    );
    assert.equal(m.id, "x");
    assert.equal(m.specialty, "B");
    assert.equal(m.hiredTier, "apprentice");
    assert.equal(m.tier, "apprentice");
    assert.equal(m.careerSeasons, 0);
    assert.equal(m.salaryPerSeason, balance.staff.tiers.apprentice.salary);
    assert.equal(m.boost, balance.staff.tiers.apprentice.boost);
    assert.deepEqual(m.contract, { seasons: 2, remaining: 2 });
    assert.deepEqual(m.resume, []);
  });

  test("retaining a staffer ages them up: tier and boost grow with tenure", () => {
    const hire = staffMarket.mintStaff(
      { id: "x", specialty: "B", tier: "apprentice", seasons: 1, day: 0 },
      balance
    );
    const atEight = ageN(hire, 8);
    assert.equal(atEight.careerSeasons, 8);
    assert.equal(atEight.tier, "veteran");
    assert.equal(atEight.boost, balance.staff.tiers.veteran.boost);
    assert.equal(ageN(hire, 22).tier, "legend");
  });

  test("the contract locks salary, then it floats to the tenured rate", () => {
    // A 3-season lock on an apprentice hire holds 40/season while the tenure
    // (and thus the true rate) climbs underneath it.
    const hire = staffMarket.mintStaff(
      { id: "x", specialty: "B", tier: "apprentice", seasons: 3, day: 0 },
      balance
    );
    const y1 = staffMarket.ageStaff(hire, balance); // remaining 3 -> 2, locked
    assert.equal(y1.salaryPerSeason, 40);
    const y2 = staffMarket.ageStaff(y1, balance); // 2 -> 1, locked
    assert.equal(y2.salaryPerSeason, 40);
    const y3 = staffMarket.ageStaff(y2, balance); // 1 -> 0, lock lapses, floats
    assert.equal(y3.contract.remaining, 0);
    // careerSeasons is now 3 -> promoted to journeyman, salary floats up.
    assert.equal(y3.tier, "journeyman");
    assert.equal(y3.salaryPerSeason, staffMarket.salaryFor("journeyman", 3, balance));
    assert.ok(y3.salaryPerSeason > 40, "floated salary exceeds the expired lock");
  });

  test("each retained season banks the completed season on the resume", () => {
    const hire = staffMarket.mintStaff(
      { id: "x", specialty: "B", tier: "apprentice", seasons: 1, day: 0 },
      balance
    );
    const aged = staffMarket.ageStaff(hire, balance, {
      seasonUid: "s1",
      corpsName: "Blue Stars",
      placement: 3,
    });
    assert.equal(aged.resume.length, 1);
    assert.deepEqual(aged.resume[0], { seasonUid: "s1", corpsName: "Blue Stars", placement: 3 });
    const twice = staffMarket.ageStaff(aged, balance, {
      seasonUid: "s2",
      corpsName: "Blue Stars",
      placement: 1,
    });
    assert.equal(twice.resume.length, 2);
  });

  test("a 30-season career retires (ageStaff returns null)", () => {
    const almost = { specialty: "B", hiredTier: "apprentice", careerSeasons: 28, contract: { seasons: 1, remaining: 0 }, resume: [] };
    assert.ok(staffMarket.ageStaff(almost, balance), "year 29 still works");
    const last = { ...almost, careerSeasons: 29 };
    assert.equal(staffMarket.ageStaff(last, balance), null, "year 30 retires");
  });

  test("retraining halves the boost for the season it happened in, then recovers", () => {
    const member = { id: "x", boost: 0.12, retrain: { seasonUid: "s1", day: 20 } };
    const mkState = (seasonUid) => ({ seasonUid, staff: { B: member } });
    const during = staffMarket.staffYieldMultiplier(mkState("s1"), "brassSectionals", balance);
    const after = staffMarket.staffYieldMultiplier(mkState("s2"), "brassSectionals", balance);
    assert.ok(during < after, `retrain season ${during} < recovered ${after}`);
    assert.equal(after, 1.12);
    assert.equal(during, 1.06);
  });
});
