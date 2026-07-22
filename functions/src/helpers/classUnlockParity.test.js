/**
 * Backend-only consistency gate for the class-unlock triplication.
 *
 * The same unlock policy lives in three backend places, each with a
 * "keep in sync" expectation but (before this test) no enforcement:
 *   - xpCalculations.js XP_CONFIG.classUnlocks   (short alias keys, levels)
 *   - classRegistry.js  CLASS_UNLOCK_LEVELS      (canonical keys, derived
 *     from config/classRegistry.json unlockLevel)
 *   - config/classRegistry.json                  (unlockLevel per class)
 *
 * The cross-runtime comparisons (client classUnlocks.ts CLASS_UNLOCK_SEASONS
 * and the client classRegistry.json mirror) live in the vitest spec
 * src/utils/clockParity.test.js, which can load both runtimes.
 */

const { test } = require("node:test");
const assert = require("node:assert");
const { XP_CONFIG } = require("./xpCalculations");
const { CLASS_UNLOCK_LEVELS, getClass } = require("./classRegistry");
const registry = require("../config/classRegistry.json");

// Short alias -> canonical id used by the registry.
const ALIAS_TO_CANONICAL = { aClass: "aClass", open: "openClass", world: "worldClass" };

test("XP_CONFIG.classUnlocks agrees with registry-derived CLASS_UNLOCK_LEVELS", () => {
  assert.deepStrictEqual(
    Object.keys(XP_CONFIG.classUnlocks).sort(),
    Object.keys(ALIAS_TO_CANONICAL).sort(),
    "classUnlocks keys changed — update this test's alias map and the registry"
  );
  for (const [alias, canonical] of Object.entries(ALIAS_TO_CANONICAL)) {
    assert.strictEqual(
      XP_CONFIG.classUnlocks[alias],
      CLASS_UNLOCK_LEVELS[canonical],
      `unlock level for ${alias}/${canonical}`
    );
  }
  // No extra gated classes on either side.
  assert.deepStrictEqual(
    Object.keys(CLASS_UNLOCK_LEVELS).sort(),
    Object.values(ALIAS_TO_CANONICAL).sort()
  );
});

test("registry JSON unlockLevel fields are what CLASS_UNLOCK_LEVELS derives", () => {
  for (const [id, entry] of Object.entries(registry.classes)) {
    const derived = CLASS_UNLOCK_LEVELS[id] ?? 0;
    // Disabled classes are excluded from derived maps; enabled zero-gate
    // classes (soundSport, podiumClass) must be absent, not zero.
    const expected = entry.enabled ? entry.unlockLevel : 0;
    assert.strictEqual(derived, expected, `unlockLevel for ${id}`);
  }
});

test("classUnlocks levels resolve through registry aliases too", () => {
  for (const [alias, canonical] of Object.entries(ALIAS_TO_CANONICAL)) {
    const entry = getClass(alias);
    assert.ok(entry, `alias ${alias} resolves`);
    assert.strictEqual(entry.id, canonical);
    assert.strictEqual(entry.unlockLevel, XP_CONFIG.classUnlocks[alias]);
  }
});

test("pins the current unlock gates: levels 3/5/10, seasons 1/2/3", () => {
  assert.deepStrictEqual(XP_CONFIG.classUnlocks, { aClass: 3, open: 5, world: 10 });
  assert.deepStrictEqual(XP_CONFIG.classUnlockSeasons, { aClass: 1, open: 2, world: 3 });
});
