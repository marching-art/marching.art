/**
 * Class-capability registry — client wrapper (Phase 1.1).
 *
 * Derives the policy maps that used to be hand-mirrored literals
 * (captionPricing.js, Dashboard sections/constants.js) from the committed
 * registry JSON. Each export reproduces the exact historical shape so
 * migrating a call site is a pure refactor.
 *
 * The JSON is a byte-identical mirror of
 * functions/src/config/classRegistry.json — verified by
 * scripts/checkClassRegistrySync.js. Presentation (labels/colors) stays in
 * utils/corps.ts; this module is policy only.
 */

import registry from '../config/classRegistry.json';

const ALL_ENTRIES = Object.entries(registry.classes).sort((a, b) => a[1].order - b[1].order);
const ENABLED_ENTRIES = ALL_ENTRIES.filter(([, c]) => c.enabled);

/** Canonical ids of enabled classes, tier order. */
export const ENABLED_CLASSES = ENABLED_ENTRIES.map(([id]) => id);

/** Lineup point caps by canonical class id (historical CLASS_POINT_LIMITS). */
export const POINT_CAPS = Object.fromEntries(
  ENABLED_ENTRIES.filter(([, c]) => c.capabilities.hasLineup).map(([id, c]) => [id, c.pointCap])
);

/** XP-level unlock gate for every enabled class, including the free ones (0). */
export const UNLOCK_LEVELS_ALL = Object.fromEntries(
  ENABLED_ENTRIES.map(([id, c]) => [id, c.unlockLevel])
);

/** XP-level unlock gates for gated classes only (no 0-level entries). */
export const UNLOCK_LEVELS_GATED = Object.fromEntries(
  ENABLED_ENTRIES.filter(([, c]) => c.unlockLevel > 0).map(([id, c]) => [id, c.unlockLevel])
);

/** Raw XP thresholds behind the level gates (display use). */
export const UNLOCK_XP_THRESHOLDS = Object.fromEntries(
  ENABLED_ENTRIES.map(([id, c]) => [id, c.unlockXp])
);

/** Registration lock (weeks before season end) by canonical class id. */
export const REGISTRATION_LOCK_WEEKS = Object.fromEntries(
  ENABLED_ENTRIES.map(([id, c]) => [id, c.registrationLockWeeks])
);

/** CorpsCoin unlock costs, canonical keys, gated classes only. */
export const UNLOCK_COSTS = Object.fromEntries(
  ENABLED_ENTRIES.filter(([, c]) => c.unlockCost > 0).map(([id, c]) => [id, c.unlockCost])
);

/** Full registry entry for a class id (any alias), or null. */
export function getClass(classId) {
  for (const [id, c] of ALL_ENTRIES) {
    if (id === classId || c.aliases.includes(classId)) return { id, ...c };
  }
  return null;
}

/** True when the id/alias names an enabled class. */
export function isClassEnabled(classId) {
  const entry = getClass(classId);
  return Boolean(entry && entry.enabled);
}

export { registry };
