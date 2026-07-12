// Division re-seat rules (design §5.7, decision 26): the A -> Open -> World
// climb, published percentile cutoffs, one-step promotion, grace-then-drop
// demotion, and the absence re-entry.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const divisions = require("./divisions");

const cfg = {
  divisions: {
    cutoffPercentiles: { openClass: 34, worldClass: 67 },
    minPoolForOpen: 6,
    minPoolForWorld: 12,
    demotionGraceSeasons: 1,
    reentryMinRepTier: { worldClass: 5, openClass: 3 },
  },
  reputation: {
    tierThresholds: { 1: 0, 2: 15, 3: 30, 4: 45, 5: 60, 6: 75, 7: 90 },
  },
};

/** A pool of n A-Class corps with evenly spread finals totals 60..60+n-1. */
function aClassPool(n) {
  return Array.from({ length: n }, (_, i) => ({
    uid: `u${i}`,
    division: "aClass",
    finalsTotal: 60 + i,
    underCutoffSeasons: 0,
  }));
}

describe("division assessment (§5.7)", () => {
  test("inaugural pool: top third rises to Open, nobody skips to World", () => {
    const { cutoffs, next, counts } = divisions.assessDivisions(aClassPool(12), cfg);
    assert.ok(cutoffs.openClass != null, "open cutoff published");
    assert.ok(cutoffs.worldClass != null, "world cutoff published (pool >= 12)");
    // One-step rule: even corps above the World cutoff only reach Open from A.
    assert.equal(counts.worldClass, 0);
    assert.ok(counts.openClass >= 4, `top third promotes (${counts.openClass})`);
    assert.equal(counts.aClass + counts.openClass, 12);
    // The very best corps rose exactly one division.
    assert.equal(next.u11.division, "openClass");
  });

  test("small pools never form higher divisions", () => {
    const { cutoffs, counts } = divisions.assessDivisions(aClassPool(4), cfg);
    assert.equal(cutoffs.openClass, null);
    assert.equal(cutoffs.worldClass, null);
    assert.equal(counts.aClass, 4);
  });

  test("Open corps above the World cutoff rises to World", () => {
    const pool = aClassPool(12);
    pool[11] = { ...pool[11], division: "openClass", finalsTotal: 95 };
    const { next } = divisions.assessDivisions(pool, cfg);
    assert.equal(next.u11.division, "worldClass");
  });

  test("grace then drop: below-cutoff World corps survives one season, falls after two", () => {
    const pool = aClassPool(12);
    // A World corps posting a bottom-of-the-pool score.
    pool[0] = { uid: "champ", division: "worldClass", finalsTotal: 60, underCutoffSeasons: 0 };
    const first = divisions.assessDivisions(pool, cfg);
    assert.equal(first.next.champ.division, "worldClass", "grace season keeps the seat");
    assert.equal(first.next.champ.underCutoffSeasons, 1);

    pool[0] = { ...pool[0], underCutoffSeasons: 1 };
    const second = divisions.assessDivisions(pool, cfg);
    assert.equal(second.next.champ.division, "openClass", "second straight miss drops ONE division");
    assert.equal(second.next.champ.underCutoffSeasons, 0);
  });

  test("hitting the cutoff again resets the demotion clock", () => {
    const pool = aClassPool(12);
    pool[0] = { uid: "champ", division: "worldClass", finalsTotal: 99, underCutoffSeasons: 1 };
    const { next } = divisions.assessDivisions(pool, cfg);
    assert.equal(next.champ.division, "worldClass");
    assert.equal(next.champ.underCutoffSeasons, 0);
  });

  test("registered-but-never-scored counts toward the drop, never promotes", () => {
    const pool = aClassPool(12);
    pool[0] = { uid: "ghost", division: "openClass", finalsTotal: null, underCutoffSeasons: 1 };
    const { next } = divisions.assessDivisions(pool, cfg);
    assert.equal(next.ghost.division, "aClass");
  });

  test("divisionForReputation maps decayed reputation to a re-entry seat", () => {
    assert.equal(divisions.divisionForReputation(90, cfg), "worldClass", "champion rep -> World");
    assert.equal(divisions.divisionForReputation(60, cfg), "worldClass", "tier-5 -> World");
    assert.equal(divisions.divisionForReputation(55, cfg), "openClass", "just below tier-5 -> Open");
    assert.equal(divisions.divisionForReputation(30, cfg), "openClass", "tier-3 -> Open");
    assert.equal(divisions.divisionForReputation(20, cfg), "aClass", "below tier-3 -> A");
  });

  test("registration seat: grace kept, then gradual reputation-driven erosion (not a hard reset)", () => {
    const champ = { division: "worldClass" };
    // Active / within grace: seat kept regardless of reputation.
    assert.equal(divisions.divisionForRegistration(champ, 0, cfg, 90), "worldClass");
    assert.equal(divisions.divisionForRegistration(champ, 1, cfg, 85), "worldClass", "one missed season is grace");
    // Beyond grace: seat follows decayed reputation, eroding gradually.
    assert.equal(
      divisions.divisionForRegistration(champ, 3, cfg, 64),
      "worldClass",
      "a champion a few seasons off is still World (rep only decayed to tier 5)"
    );
    assert.equal(
      divisions.divisionForRegistration(champ, 4, cfg, 52),
      "openClass",
      "a longer absence erodes World -> Open"
    );
    assert.equal(
      divisions.divisionForRegistration(champ, 6, cfg, 25),
      "aClass",
      "only a long absence, reputation decayed all the way down, re-enters at A"
    );
    // Never placed ABOVE the last-held seat, even with high reputation.
    assert.equal(divisions.divisionForRegistration({ division: "openClass" }, 4, cfg, 90), "openClass");
    // New corps / junk seat still start in A.
    assert.equal(divisions.divisionForRegistration(null, 0, cfg, 0), "aClass", "new corps start in A");
    assert.equal(divisions.divisionForRegistration({ division: "junk" }, 0, cfg, 0), "aClass");
  });
});
