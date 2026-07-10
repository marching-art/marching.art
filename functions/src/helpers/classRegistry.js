/**
 * Class-capability registry — server wrapper (Phase 1.1).
 *
 * Derives every policy map that used to be a hand-mirrored literal from the
 * committed registry JSON. Every export reproduces the EXACT historical
 * shape (including legacy alias keys) so migrating a call site is a pure
 * refactor — classRegistry.test.js pins each shape to the pre-registry
 * literals as a zero-behavior-change proof.
 *
 * Disabled classes (podiumClass until launch) are excluded from every
 * derived list, so registering a class here is inert until it is enabled.
 */

const registry = require("../config/classRegistry.json");

const ALL_ENTRIES = Object.entries(registry.classes).sort((a, b) => a[1].order - b[1].order);
const ENABLED_ENTRIES = ALL_ENTRIES.filter(([, c]) => c.enabled);

/** Canonical ids of enabled classes, tier order (World -> ... -> SoundSport). */
const ENABLED_CLASSES = ENABLED_ENTRIES.map(([id]) => id);

/**
 * Enabled classes that field a caption lineup — the historical
 * `validClasses` literal used by lineup/corps/admin callables.
 */
const FANTASY_CLASSES = ENABLED_ENTRIES.filter(([, c]) => c.capabilities.hasLineup).map(
  ([id]) => id
);

/** Enabled classes ranked by the fantasy nightly ranking pass. */
const RANKED_CLASSES = ENABLED_ENTRIES.filter(([, c]) => c.capabilities.fantasyRanked).map(
  ([id]) => id
);

/** Lineup point caps by canonical class id (enabled, lineup-bearing only). */
const POINT_CAPS = Object.fromEntries(
  ENABLED_ENTRIES.filter(([, c]) => c.capabilities.hasLineup).map(([id, c]) => [id, c.pointCap])
);

/** Registration lock (weeks before season end) by canonical class id. */
const REGISTRATION_LOCK_WEEKS = Object.fromEntries(
  ENABLED_ENTRIES.map(([id, c]) => [id, c.registrationLockWeeks])
);

/**
 * CorpsCoin unlock costs keyed by EVERY accepted alias (canonical +
 * legacy short keys) — matches the historical economy.js literal, which
 * had no entry for free classes (soundSport).
 */
const CLASS_UNLOCK_COSTS = {};
for (const [, c] of ENABLED_ENTRIES) {
  if (c.unlockCost > 0) {
    for (const alias of c.aliases) CLASS_UNLOCK_COSTS[alias] = c.unlockCost;
  }
}

/** XP-level unlock gates by canonical id (gated classes only). */
const CLASS_UNLOCK_LEVELS = Object.fromEntries(
  ENABLED_ENTRIES.filter(([, c]) => c.unlockLevel > 0).map(([id, c]) => [id, c.unlockLevel])
);

/**
 * Show-participation CorpsCoin rewards keyed by every accepted alias —
 * matches the historical economy.js literal.
 */
const SHOW_PARTICIPATION_REWARDS = {};
for (const [, c] of ENABLED_ENTRIES) {
  for (const alias of c.aliases) SHOW_PARTICIPATION_REWARDS[alias] = c.participationReward;
}

/** Full registry entry for a class id (any alias), or null. */
function getClass(classId) {
  for (const [id, c] of ALL_ENTRIES) {
    if (id === classId || c.aliases.includes(classId)) return { id, ...c };
  }
  return null;
}

/** True when the id/alias names an enabled class. */
function isClassEnabled(classId) {
  const entry = getClass(classId);
  return Boolean(entry && entry.enabled);
}

module.exports = {
  registry,
  ENABLED_CLASSES,
  FANTASY_CLASSES,
  RANKED_CLASSES,
  POINT_CAPS,
  REGISTRATION_LOCK_WEEKS,
  CLASS_UNLOCK_COSTS,
  CLASS_UNLOCK_LEVELS,
  SHOW_PARTICIPATION_REWARDS,
  getClass,
  isClassEnabled,
};
