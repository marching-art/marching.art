// Unit tests for the pure aggregation/rivalry logic behind the Season Summary
// article (Article 6). The heavy Gemini/image imports in the module are not
// exercised here — only the deterministic season math is.

const { test, describe } = require("node:test");
const assert = require("node:assert");

const {
  aggregateSeason,
  detectRivalries,
  getSoundSportRating,
} = require("./newsSeasonSummary");

// Helpers to build recap fixtures shaped exactly like commitDailyScoring writes.
const show = (day, results) => ({
  offSeasonDay: day,
  shows: [{ eventName: `Show ${day}`, location: "Venue", results }],
});
const wc = (uid, name, total, ge, vis, mus) => ({
  uid, corpsName: name, displayName: `${uid}_dir`, corpsClass: "worldClass",
  location: "Town", totalScore: total, geScore: ge, visualScore: vis, musicScore: mus,
});
const ss = (uid, name, total) => ({
  uid, corpsName: name, displayName: `${uid}_dir`, corpsClass: "soundSport",
  location: "Town", totalScore: total,
});

const RECAPS = [
  show(15, [wc("u1", "Aurora", 80.1, 32, 24, 24), wc("u2", "Borealis", 79.9, 31, 24, 25), wc("u3", "Comet", 70.0, 28, 21, 21), ss("s1", "Sparks", 86), ss("s2", "Embers", 72)]),
  show(16, [wc("u1", "Aurora", 80.5, 32, 24, 24.5), wc("u2", "Borealis", 80.7, 32, 24, 24.7), wc("u3", "Comet", 71.0, 28, 21, 22), ss("s1", "Sparks", 88), ss("s2", "Embers", 74)]),
  show(17, [wc("u1", "Aurora", 81.2, 33, 24, 24.2), wc("u2", "Borealis", 81.0, 32, 25, 24), wc("u3", "Comet", 72.5, 29, 21, 22.5), ss("s2", "Embers", 76), ss("s1", "Sparks", 80)]),
  show(18, [wc("u1", "Aurora", 82.0, 33, 25, 24), wc("u2", "Borealis", 81.7, 33, 24, 24.7)]),
];

describe("getSoundSportRating", () => {
  test("maps scores to rating bands and rejects non-scores", () => {
    assert.strictEqual(getSoundSportRating(90), "Gold");
    assert.strictEqual(getSoundSportRating(85), "Gold");
    assert.strictEqual(getSoundSportRating(80), "Silver");
    assert.strictEqual(getSoundSportRating(70), "Bronze");
    assert.strictEqual(getSoundSportRating(50), "Participation");
    assert.strictEqual(getSoundSportRating(0), null);
    assert.strictEqual(getSoundSportRating(undefined), null);
  });
});

describe("aggregateSeason", () => {
  const corps = aggregateSeason(RECAPS);
  const byName = Object.fromEntries(corps.map((c) => [c.corpsName, c]));

  test("uses the latest score as the standing metric", () => {
    assert.strictEqual(byName.Aurora.latestTotal, 82.0);
    assert.strictEqual(byName.Borealis.latestTotal, 81.7);
  });

  test("computes combined-family season averages (never individual captions)", () => {
    // Aurora GE: (32+32+33+33)/4 = 32.5
    assert.ok(Math.abs(byName.Aurora.avgGE - 32.5) < 1e-9);
    assert.ok(Math.abs(byName.Aurora.avgVisual - 24.25) < 1e-9);
  });

  test("tallies competitive best-in-show (show wins)", () => {
    // Aurora wins days 15,17,18; Borealis wins day 16.
    assert.strictEqual(byName.Aurora.showWins, 3);
    assert.strictEqual(byName.Borealis.showWins, 1);
    assert.strictEqual(byName.Comet.showWins, 0);
  });

  test("tallies SoundSport best-in-show and best rating, without exposing scores", () => {
    // Sparks tops SoundSport all three days it appears.
    assert.strictEqual(byName.Sparks.soundSportBestInShow, 3);
    assert.strictEqual(byName.Embers.soundSportBestInShow, 0);
    assert.strictEqual(byName.Sparks.bestRating, "Gold");
    assert.strictEqual(byName.Embers.bestRating, "Silver");
    // Combined families are meaningless for SoundSport and stay zero.
    assert.strictEqual(byName.Sparks.avgGE, 0);
  });

  test("respects the caller-provided through-day filter upstream (no future leak)", () => {
    // aggregateSeason trusts pre-filtered recaps; every corps here has <= 4 shows.
    assert.ok(corps.every((c) => c.showsCount <= 4));
  });
});

describe("detectRivalries", () => {
  test("flags a lead that has flipped across shared shows", () => {
    const wcCorps = aggregateSeason(RECAPS).filter((c) => c.corpsClass === "worldClass");
    const rivalries = detectRivalries(wcCorps);
    assert.ok(rivalries.length >= 1);
    const top = rivalries[0];
    assert.deepStrictEqual(
      [top.corpsA, top.corpsB].sort(),
      ["Aurora", "Borealis"]
    );
    assert.strictEqual(top.flipped, true);
    assert.strictEqual(top.sharedDays, 4);
  });

  test("does not invent a rivalry with a distant, non-competitive corps", () => {
    const wcCorps = aggregateSeason(RECAPS).filter((c) => c.corpsClass === "worldClass");
    const rivalries = detectRivalries(wcCorps);
    const involvesComet = rivalries.some((r) => r.corpsA === "Comet" || r.corpsB === "Comet");
    assert.strictEqual(involvesComet, false);
  });
});
