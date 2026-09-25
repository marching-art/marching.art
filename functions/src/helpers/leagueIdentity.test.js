// League identity — game mode and roleplay level.
//
// Game mode is the one identity field with teeth: it decides which classes the
// weekly generator pairs, so the class split is pinned against the registry.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { MATCHUP_CLASSES } = require("./classRegistry");
const {
  gameModeOfClass,
  leagueGameMode,
  leagueMatchupClasses,
  leagueRoleplayLevel,
  parseLeagueIdentity,
} = require("./leagueIdentity");

describe("game mode", () => {
  test("Podium is the lineup-less class; every lineup class is Fantasy", () => {
    assert.equal(gameModeOfClass("podiumClass"), "podium");
    for (const c of ["worldClass", "openClass", "aClass", "soundSport"]) {
      assert.equal(gameModeOfClass(c), "fantasy");
    }
  });

  test("a league without a mode plays both, as every league did before the field", () => {
    assert.equal(leagueGameMode({}), "both");
    assert.equal(leagueGameMode({ settings: { gameMode: "bogus" } }), "both");
    assert.deepEqual(leagueMatchupClasses({}), MATCHUP_CLASSES);
  });

  test("a single-game league pairs only that game's classes", () => {
    const fantasy = leagueMatchupClasses({ settings: { gameMode: "fantasy" } });
    const podium = leagueMatchupClasses({ settings: { gameMode: "podium" } });
    assert.ok(!fantasy.includes("podiumClass"));
    assert.ok(fantasy.includes("worldClass"));
    assert.deepEqual(podium, MATCHUP_CLASSES.includes("podiumClass") ? ["podiumClass"] : []);
    // Together they are exactly the full list: no class belongs to neither.
    assert.deepEqual([...fantasy, ...podium].sort(), [...MATCHUP_CLASSES].sort());
  });
});

describe("roleplay level", () => {
  test("an explicit level wins; the retired tag reads as encouraged", () => {
    assert.equal(leagueRoleplayLevel({ roleplay: { level: "none" }, tag: "roleplay" }), "none");
    assert.equal(leagueRoleplayLevel({ tag: "roleplay" }), "encouraged");
    assert.equal(leagueRoleplayLevel({ tag: "casual" }), null);
  });
});

describe("parseLeagueIdentity", () => {
  test("skips keys the patch did not send", () => {
    assert.deepEqual(parseLeagueIdentity({}), {});
  });

  test("null clears the roleplay block", () => {
    assert.deepEqual(parseLeagueIdentity({ roleplay: null }), { roleplay: null });
  });

  test("defaults missing expectations to empty text", () => {
    assert.deepEqual(parseLeagueIdentity({ roleplay: { level: "optional" } }), {
      roleplay: { level: "optional", expectations: "" },
    });
  });

  test("rejects non-object roleplay and non-text lore", () => {
    assert.throws(() => parseLeagueIdentity({ roleplay: "yes" }), /object/);
    assert.throws(() => parseLeagueIdentity({ roleplay: ["optional"] }), /object/);
    assert.throws(() => parseLeagueIdentity({ lore: 5 }), /lore/);
  });
});
