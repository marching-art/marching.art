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

  test("REGISTRATION_LOCK_WEEKS matches registerCorps.js (+ always-open Podium)", () => {
    assert.deepEqual(reg.REGISTRATION_LOCK_WEEKS, {
      worldClass: 6,
      openClass: 5,
      aClass: 4,
      soundSport: 0,
      podiumClass: 0,
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

  test("SHOW_PARTICIPATION_REWARDS matches economy.js (alias-expanded, + Podium)", () => {
    assert.deepEqual(reg.SHOW_PARTICIPATION_REWARDS, {
      soundSport: 50,
      aClass: 100,
      open: 150,
      openClass: 150,
      world: 200,
      worldClass: 200,
      podium: 175,
      podiumClass: 175,
    });
  });

  test("CLASS_UNLOCK_LEVELS matches Dashboard constants", () => {
    assert.deepEqual(reg.CLASS_UNLOCK_LEVELS, { aClass: 3, openClass: 5, worldClass: 10 });
  });

  test("podiumClass is live: in shared lists, out of every lineup path", () => {
    const podium = reg.getClass("podiumClass");
    assert.ok(podium, "podiumClass must be registered");
    assert.equal(podium.enabled, true);
    assert.equal(reg.isClassEnabled("podiumClass"), true);
    // Shared-calendar/economy lists include it...
    assert.ok(reg.ENABLED_CLASSES.includes("podiumClass"));
    assert.ok(reg.MATCHUP_CLASSES.includes("podiumClass"));
    // ...but hasLineup:false keeps it out of every lineup/point-cap path,
    // and it is free and ungated (always-open, SoundSport model).
    assert.ok(!reg.FANTASY_CLASSES.includes("podiumClass"));
    assert.ok(!reg.RANKED_CLASSES.includes("podiumClass"));
    assert.ok(!("podiumClass" in reg.POINT_CAPS));
    assert.ok(!("podiumClass" in reg.CLASS_UNLOCK_COSTS));
    assert.ok(!("podiumClass" in reg.CLASS_UNLOCK_LEVELS));
  });

  test("alias lookup resolves legacy short keys", () => {
    assert.equal(reg.getClass("world").id, "worldClass");
    assert.equal(reg.getClass("open").id, "openClass");
    assert.equal(reg.getClass("podium").id, "podiumClass");
    assert.equal(reg.getClass("nonsense"), null);
  });
});

describe("pointCapForWeek — the weekly budget ramp", () => {
  test("World Class opens at 145 and climbs a point a week to 150", () => {
    assert.deepEqual(
      reg.pointCapSchedule("worldClass").map((r) => r.cap),
      [145, 145, 146, 147, 148, 149, 150]
    );
  });

  test("every lineup class ramps 5 below its full cap", () => {
    for (const classId of reg.FANTASY_CLASSES) {
      assert.equal(reg.POINT_CAP_RAMPS[classId], 5, classId);
      assert.equal(reg.pointCapForWeek(classId, 1), reg.POINT_CAPS[classId] - 5, classId);
      assert.equal(reg.pointCapForWeek(classId, 7), reg.POINT_CAPS[classId], classId);
    }
  });

  test("an unknown week is the opening budget, never more", () => {
    assert.equal(reg.pointCapForWeek("worldClass", null), 145);
    assert.equal(reg.pointCapForWeek("worldClass", undefined), 145);
    assert.equal(reg.pointCapForWeek("worldClass", 0), 145);
    assert.equal(reg.pointCapForWeek("worldClass", NaN), 145);
  });

  test("weeks past the season stay at the full cap; aliases resolve", () => {
    assert.equal(reg.pointCapForWeek("worldClass", 9), 150);
    assert.equal(reg.pointCapForWeek("world", 4), 147);
    assert.equal(reg.pointCapForWeek("open", 7), 120);
  });

  test("a class with no lineup has no cap", () => {
    assert.equal(reg.pointCapForWeek("podiumClass", 3), null);
    assert.equal(reg.pointCapSchedule("podiumClass"), null);
    assert.ok(!("podiumClass" in reg.POINT_CAP_RAMPS));
  });
});
