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
    // A legend costs multiples of the base (200 -> 464 at 6%/season by 22)...
    const yr22 = staffMarket.salaryFor("legend", 22, balance);
    assert.equal(yr22, Math.round(200 * (1 + 0.06 * 22)));
    // ...and the premium holds from the legend threshold on: the price of a
    // career is a ceiling, never a treadmill to retirement.
    assert.equal(staffMarket.salaryFor("legend", 25, balance), yr22);
    assert.equal(staffMarket.salaryFor("legend", 29, balance), yr22);
  });

  test("tier bases are proportional to boost, so loyalty is not punished per point", () => {
    const perPoint = (tier) => balance.staff.tiers[tier].salary / balance.staff.tiers[tier].boost;
    const base = perPoint("apprentice");
    for (const tier of ["journeyman", "veteran", "master", "legend"]) {
      assert.ok(Math.abs(perPoint(tier) - base) < 1e-9, `${tier} costs ${perPoint(tier)}/pt vs ${base}`);
    }
    // Across a whole career the cost per boost point rises only by the
    // (capped) tenure premium — well under 3x, never the 4x+ of a runaway curve.
    const rookie = staffMarket.salaryFor("apprentice", 0, balance) / balance.staff.tiers.apprentice.boost;
    const legend = staffMarket.salaryFor("legend", 29, balance) / balance.staff.tiers.legend.boost;
    assert.ok(legend / rookie < 3, `career cost-per-point ratio ${legend / rookie}`);
  });

  test("earned-tier promotion raises are bounded, not cliffs", () => {
    // The season BEFORE each promotion vs. the promotion season itself. The
    // apprentice -> journeyman step doubles boost and price alike (40 -> 80
    // base, still the cheapest point on the curve); the earned tiers above it
    // must never jump more than 60% in one season.
    for (const [tier, at] of Object.entries(balance.staff.career.promotionSeasons)) {
      if (tier === "journeyman") continue;
      const before = staffMarket.salaryFor(staffMarket.tierForCareer("apprentice", at - 1, balance), at - 1, balance);
      const after = staffMarket.salaryFor(tier, at, balance);
      assert.ok(after / before <= 1.6, `${tier} raise ${before} -> ${after} is ${after / before}x`);
    }
  });

  test("nextPromotion names the next rung and how far off it is", () => {
    const hire = staffMarket.mintStaff(
      { id: "x", specialty: "B", tier: "apprentice", seasons: 1, day: 0 },
      balance
    );
    assert.deepEqual(staffMarket.nextPromotion(hire, balance), { tier: "journeyman", atSeason: 3, seasonsAway: 3 });
    const vet = ageN(hire, 9);
    assert.deepEqual(staffMarket.nextPromotion(vet, balance), { tier: "master", atSeason: 15, seasonsAway: 6 });
    // A journeyman hire skips the journeyman rung.
    const jm = staffMarket.mintStaff({ id: "y", specialty: "B", tier: "journeyman", seasons: 1, day: 0 }, balance);
    assert.equal(staffMarket.nextPromotion(jm, balance).tier, "veteran");
    assert.equal(staffMarket.nextPromotion(ageN(hire, 22), balance), null, "a legend has nowhere left to climb");
  });

  test("seasonsUntilRetirement counts down to the final season", () => {
    const rookie = { careerSeasons: 0 };
    assert.equal(staffMarket.seasonsUntilRetirement(rookie, balance), balance.staff.career.maxSeasons - 1);
    assert.equal(staffMarket.seasonsUntilRetirement({ careerSeasons: 29 }, balance), 0, "final season");
    assert.equal(staffMarket.seasonsUntilRetirement({ careerSeasons: 27 }, balance), 2);
  });
});

describe("staff careers — contracts bind both ways", () => {
  const signed = () =>
    staffMarket.mintStaff({ id: "x", specialty: "B", tier: "journeyman", seasons: 3, day: 0 }, balance);

  test("an in-season release buys out only the seasons beyond this one", () => {
    const m = signed(); // 3 seasons, this one already paid
    const premium = balance.staff.career.buyoutPremium;
    assert.equal(staffMarket.buyoutFor(m, balance), Math.round(m.salaryPerSeason * premium * 2));
    const y2 = staffMarket.ageStaff(m, balance); // remaining 2 -> one beyond this season
    assert.equal(staffMarket.buyoutFor(y2, balance), Math.round(y2.salaryPerSeason * premium));
    const y3 = staffMarket.ageStaff(y2, balance); // final locked season: nothing beyond it
    assert.equal(staffMarket.buyoutFor(y3, balance), 0);
  });

  test("a boundary release owes every remaining locked season", () => {
    const y2 = staffMarket.ageStaff(signed(), balance); // remaining 2, both unexpired at the boundary
    const premium = balance.staff.career.buyoutPremium;
    assert.equal(
      staffMarket.buyoutFor(y2, balance, { atBoundary: true }),
      Math.round(y2.salaryPerSeason * premium * 2)
    );
  });

  test("a lapsed lock has no buyout and a 1-season hire never does", () => {
    const one = staffMarket.mintStaff({ id: "x", specialty: "B", tier: "apprentice", seasons: 1, day: 0 }, balance);
    assert.equal(staffMarket.buyoutFor(one, balance), 0);
    assert.equal(staffMarket.buyoutFor(ageN(one, 4), balance, { atBoundary: true }), 0);
  });

  test("renewContract re-signs a lapsed lock at the current rate, never mid-lock", () => {
    const lapsed = ageN(signed(), 3); // lock ran out, salary floated
    assert.equal(lapsed.contract.remaining, 0);
    const renewed = staffMarket.renewContract(lapsed, 2, balance);
    assert.deepEqual(renewed.contract, { seasons: 2, remaining: 2 });
    assert.equal(renewed.salaryPerSeason, lapsed.salaryPerSeason, "frozen at today's floated rate");
    // The new lock holds through the promotion raise underneath it.
    const held = staffMarket.ageStaff(renewed, balance);
    assert.equal(held.salaryPerSeason, renewed.salaryPerSeason);
    assert.equal(held.contract.remaining, 1);
    // Still locked -> not renewable (a signed price can't roll forward forever).
    assert.equal(staffMarket.renewContract(staffMarket.ageStaff(signed(), balance), 3, balance), null);
    // Out-of-range lengths are refused.
    assert.equal(staffMarket.renewContract(lapsed, 0, balance), null);
    assert.equal(staffMarket.renewContract(lapsed, balance.staff.career.maxContractSeasons + 1, balance), null);
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
