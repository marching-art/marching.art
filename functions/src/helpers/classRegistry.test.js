// Zero-behavior-change proof for the class-capability registry (Phase 1.1).
// Every derived map is pinned to the exact literal it replaced. If a registry
// edit changes any of these shapes, this test — not a player — catches it.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const reg = require("./classRegistry");

describe("classRegistry derived shapes match the historical literals", () => {
  test("FANTASY_CLASSES matches the validClasses literal", () => {
    assert.deepEqual(reg.FANTASY_CLASSES, ["worldClass", "openClass", "aClass", "soundSport"]);
  });

  test("RANKED_CLASSES matches scoring.js", () => {
    assert.deepEqual(reg.RANKED_CLASSES, ["worldClass", "openClass", "aClass"]);
  });

  test("POINT_CAPS matches lineups.js", () => {
    assert.deepEqual(reg.POINT_CAPS, {
      worldClass: 150,
      openClass: 120,
      aClass: 60,
      soundSport: 90,
    });
  });

  test("REGISTRATION_LOCK_WEEKS matches registerCorps.js", () => {
    assert.deepEqual(reg.REGISTRATION_LOCK_WEEKS, {
      worldClass: 6,
      openClass: 5,
      aClass: 4,
      soundSport: 0,
    });
  });

  test("CLASS_UNLOCK_COSTS matches economy.js (alias-expanded, no free classes)", () => {
    assert.deepEqual(reg.CLASS_UNLOCK_COSTS, {
      aClass: 1000,
      open: 2500,
      openClass: 2500,
      world: 5000,
      worldClass: 5000,
    });
  });

  test("SHOW_PARTICIPATION_REWARDS matches economy.js (alias-expanded)", () => {
    assert.deepEqual(reg.SHOW_PARTICIPATION_REWARDS, {
      soundSport: 50,
      aClass: 100,
      open: 150,
      openClass: 150,
      world: 200,
      worldClass: 200,
    });
  });

  test("CLASS_UNLOCK_LEVELS matches Dashboard constants", () => {
    assert.deepEqual(reg.CLASS_UNLOCK_LEVELS, { aClass: 3, openClass: 5, worldClass: 10 });
  });

  test("podiumClass is registered but inert while disabled", () => {
    const podium = reg.getClass("podiumClass");
    assert.ok(podium, "podiumClass must be registered");
    assert.equal(podium.enabled, false);
    assert.equal(reg.isClassEnabled("podiumClass"), false);
    assert.ok(!reg.FANTASY_CLASSES.includes("podiumClass"));
    assert.ok(!reg.RANKED_CLASSES.includes("podiumClass"));
    assert.ok(!("podiumClass" in reg.SHOW_PARTICIPATION_REWARDS));
    assert.ok(!("podiumClass" in reg.CLASS_UNLOCK_COSTS));
  });

  test("alias lookup resolves legacy short keys", () => {
    assert.equal(reg.getClass("world").id, "worldClass");
    assert.equal(reg.getClass("open").id, "openClass");
    assert.equal(reg.getClass("podium").id, "podiumClass");
    assert.equal(reg.getClass("nonsense"), null);
  });
});
