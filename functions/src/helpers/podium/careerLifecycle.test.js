// Retire / un-retire lineage helpers (§5.13): banking a corps off the roster and
// bringing it back with the dormancy of the seasons it sat out charged against
// it — never returning stronger than it left.
//
// Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const career = require("./career");

const cfg = {
  reputation: {
    max: 100,
    tierThresholds: { 1: 0, 2: 15, 3: 30, 4: 45, 5: 60, 6: 75, 7: 90 },
    dormancyDecayBySeason: [5, 9, 12],
    dormancyDecayFloorSeasons: 12,
  },
  divisions: {
    demotionGraceSeasons: 1,
    reentryMinRepTier: { worldClass: 5, openClass: 3 },
  },
};

describe("bankLineage (retire)", () => {
  test("preserves the lineage but strips volatile fields and stamps the index", () => {
    const data = {
      reputation: 62,
      historicalPeak: 70,
      seasonsPlayed: 9,
      corpsName: "Rohn Regiment",
      division: "openClass",
      history: [{ seasonUid: "s8" }],
      retiredCareers: [{ corpsName: "Old One" }],
      pendingAssessment: { seasonUid: "s8" },
    };
    const banked = career.bankLineage(data, 12);
    assert.equal(banked.reputation, 62);
    assert.equal(banked.historicalPeak, 70);
    assert.equal(banked.corpsName, "Rohn Regiment");
    assert.equal(banked.retiredAtIndex, 12);
    assert.ok(banked.retiredAt);
    // Volatile / nested-lineage fields are not carried into the banked copy.
    assert.equal(banked.retiredCareers, undefined);
    assert.equal(banked.pendingAssessment, undefined);
  });
});

describe("restoreLineage (un-retire)", () => {
  test("projects the dormancy of every season since it last competed; never returns stronger", () => {
    const banked = {
      reputation: 70,
      historicalPeak: 80,
      seasonsPlayed: 12,
      corpsName: "Cascade",
      division: "worldClass",
      lastPlayedIndex: 4,
      retiredAtIndex: 5,
      identity: { avatarUrl: "https://x/logo.png" },
    };
    const restored = career.restoreLineage(banked, 8, cfg);
    // Seasons 5, 6 and 7 sat out.
    assert.equal(restored.missedSeasons, 3);
    assert.equal(restored.reputationBefore, 70);
    // 3 missed seasons decay 5 + 9 + 12 = 26 → 44.
    assert.equal(restored.reputationAfter, 44);
    assert.ok(restored.reputationAfter < restored.reputationBefore, "never returns stronger");
    // 44 supports Open Class (tier 3) but not World (tier 5).
    assert.equal(restored.division, "openClass");
    // The career itself is restored as banked — registration charges the time
    // away exactly once (see missedSeasonsFor), so it is not pre-decayed here.
    assert.equal(restored.career.reputation, 70);
    assert.equal(restored.career.historicalPeak, 80);
    assert.equal(restored.career.retiredAtIndex, undefined);
    assert.deepEqual(restored.identity, { avatarUrl: "https://x/logo.png" });
  });

  test("one season in retirement keeps the corps in its prior class", () => {
    const banked = { reputation: 40, division: "worldClass", lastPlayedIndex: 6, corpsName: "Genesis" };
    const restored = career.restoreLineage(banked, 8, cfg);
    assert.equal(restored.missedSeasons, 1);
    assert.equal(restored.division, "worldClass");
  });

  test("an immediate un-retire (no seasons missed) restores intact", () => {
    const banked = { reputation: 55, historicalPeak: 55, lastPlayedIndex: 6, retiredAtIndex: 7, corpsName: "Genesis" };
    const { missedSeasons, reputationAfter } = career.restoreLineage(banked, 7, cfg);
    assert.equal(missedSeasons, 0);
    assert.equal(reputationAfter, 55);
  });

  test("the un-retire projection and registration charge the same time away", () => {
    const banked = { reputation: 70, historicalPeak: 70, lastPlayedIndex: 4, division: "openClass" };
    const { career: restored, reputationAfter } = career.restoreLineage(banked, 8, cfg);
    const missed = career.missedSeasonsFor(restored, 8);
    assert.equal(career.applyDormancy(restored, missed, cfg).reputation, reputationAfter);
  });
});

describe("corps identity: a corps is its name", () => {
  test("isSameCorps ignores case and spacing, nothing else", () => {
    const c = { corpsName: "Rohn  Regiment" };
    assert.equal(career.isSameCorps(c, " rohn regiment "), true);
    assert.equal(career.isSameCorps(c, "Rohn Regiment II"), false);
    assert.equal(career.isSameCorps({ corpsName: null }, "Anything"), false);
  });

  test("hasActiveCorps is false for the blank slate a retire leaves", () => {
    assert.equal(career.hasActiveCorps(career.initCareer()), false);
    assert.equal(career.hasActiveCorps({ ...career.initCareer(), retiredCareers: [{ corpsName: "A" }] }), false);
    assert.equal(career.hasActiveCorps({ corpsName: "A", seasonsPlayed: 0 }), true);
  });

  test("captureIdentity banks the look and the corps' own home", () => {
    const identity = career.captureIdentity(
      { avatarUrl: "a.png", uniform: { designId: "d1" }, corpsName: "X", seasonHistory: [] },
      { home: { venueId: "v" }, location: "Town, ST", showConcept: "Show" }
    );
    assert.deepEqual(identity, {
      avatarUrl: "a.png",
      uniform: { designId: "d1" },
      home: { venueId: "v" },
      location: "Town, ST",
      showConcept: "Show",
    });
    assert.equal(career.captureIdentity({}, null), null);
  });
});

describe("history follows the corps", () => {
  const playedS4 = { corpsName: "Old Guard", lastSeasonUid: "s4", history: [{ seasonUid: "s4" }] };

  test("seasonOwner tells the live corps' seasons from a retired corps'", () => {
    assert.equal(career.seasonOwner(playedS4, "s4"), "active");
    const afterRetire = { ...career.initCareer(), retiredCareers: [playedS4] };
    assert.equal(career.seasonOwner(afterRetire, "s4"), "retired");
    assert.equal(career.retiredLineageIndexFor(afterRetire, "s4"), 0);
    assert.equal(career.seasonOwner(afterRetire, "s5"), "unarchived");
  });

  test("an unswept season lands on the corps that played it, matched by name", () => {
    const blank = { ...career.initCareer(), retiredCareers: [{ corpsName: "Other" }, { corpsName: "Old Guard" }] };
    assert.equal(career.lineageForUnsweptSeason(blank, { corpsName: "old guard" }), 1);
    // A revived corps is live, but the leftover season was its predecessor's.
    const revived = { corpsName: "Phoenix", seasonsPlayed: 3, retiredCareers: [{ corpsName: "Old Guard" }] };
    assert.equal(career.lineageForUnsweptSeason(revived, { corpsName: "Old Guard" }), 0);
    assert.equal(career.lineageForUnsweptSeason(revived, { corpsName: "Phoenix" }), "active");
  });

  test("archiving a retired corps' season never touches the new corps", () => {
    const state = { corpsName: "Old Guard", lastTotal: 80, lastScoredDay: 49, repTier: 1, division: "openClass" };
    const banked = { corpsName: "Old Guard", reputation: 20, historicalPeak: 20, seasonsPlayed: 2, history: [] };
    const blank = { ...career.initCareer(), retiredCareers: [banked] };
    const { career: next, target, lineageAfter } = career.archiveSeasonIntoCareer(
      blank,
      { seasonUid: "s4", seasonIndex: 4, state },
      { ...cfg, reputation: { ...cfg.reputation } }
    );
    assert.equal(target, 0);
    assert.equal(next.reputation, 0);
    assert.equal(next.seasonsPlayed, 0);
    assert.equal(next.corpsName, null);
    assert.equal(next.retiredCareers[0].seasonsPlayed, 3);
    assert.equal(lineageAfter.lastSeasonUid, "s4");
    assert.equal(career.seasonOwner(next, "s4"), "retired");
  });

  test("refund markers are found on any lineage, and patched onto the one that played", () => {
    const afterRetire = { ...career.initCareer(), retiredCareers: [{ ...playedS4, lastRefundedSeasonUid: "s4" }] };
    assert.equal(career.seasonRefunded(afterRetire, "s4"), true);
    assert.equal(career.seasonRefunded(afterRetire, "s5"), false);
    const patched = career.patchSeasonLineage(
      { ...career.initCareer(), retiredCareers: [playedS4] },
      "s4",
      { lastRefundedSeasonUid: "s4" }
    );
    assert.equal(patched.lastRefundedSeasonUid, undefined);
    assert.equal(patched.retiredCareers[0].lastRefundedSeasonUid, "s4");
  });
});
