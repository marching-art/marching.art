// Season names shown to humans. Must stay in lockstep with the client's
// formatSeasonName (src/utils/season.ts) — a director should never see a
// season called one thing in Discord and another in the app.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { formatSeasonName, seasonDisplayName } = require("./seasonDisplay");

describe("formatSeasonName", () => {
  test("a live season collapses to its single competition year", () => {
    // Stored with a two-year suffix to match the off-season scheme, but a live
    // season never spans the new year.
    assert.equal(formatSeasonName("live_2026-26"), "LIVE 2026");
    assert.equal(formatSeasonName("live_2027-27"), "LIVE 2027");
    assert.equal(formatSeasonName("LIVE_2026-26"), "LIVE 2026");
  });

  test("an off-season keeps its span and gains a capitalized name", () => {
    assert.equal(formatSeasonName("finale_2026-27"), "Finale 2026-27");
    assert.equal(formatSeasonName("overture_2025-26"), "Overture 2025-26");
    assert.equal(formatSeasonName("crescendo_2030-31"), "Crescendo 2030-31");
    // Legacy multi-word names still read correctly.
    assert.equal(formatSeasonName("off_season_2024"), "Off Season 2024");
  });

  test("an already-formatted name survives a second pass", () => {
    assert.equal(formatSeasonName("Offseason IX"), "Offseason IX");
    assert.equal(formatSeasonName("LIVE 2026"), "LIVE 2026");
  });

  test("nothing to show reads as a season, not as blank", () => {
    assert.equal(formatSeasonName(null), "New Season");
    assert.equal(formatSeasonName(undefined), "New Season");
    assert.equal(formatSeasonName(""), "New Season");
  });
});

describe("seasonDisplayName", () => {
  test("prefers name, falls back to seasonUid", () => {
    assert.equal(
      seasonDisplayName({ name: "live_2026-26", seasonUid: "live_2026-26" }),
      "LIVE 2026"
    );
    assert.equal(seasonDisplayName({ seasonUid: "finale_2026-27" }), "Finale 2026-27");
    assert.equal(seasonDisplayName(null), "New Season");
  });
});
