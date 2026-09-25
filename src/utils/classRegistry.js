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

/**
 * FULL (finals-week) lineup point caps by canonical class id (historical
 * CLASS_POINT_LIMITS). The cap a director may spend in a given week is
 * `pointCapForWeek` — it opens below this and ramps up to it.
 */
export const POINT_CAPS = Object.fromEntries(
  ENABLED_ENTRIES.filter(([, c]) => c.capabilities.hasLineup).map(([id, c]) => [id, c.pointCap])
);

/**
 * How many points below `pointCap` each lineup class opens the season at
 * (0 = flat cap all season).
 */
export const POINT_CAP_RAMPS = Object.fromEntries(
  ENABLED_ENTRIES.filter(([, c]) => c.capabilities.hasLineup).map(([id, c]) => [
    id,
    Math.max(0, Number(c.pointCapRamp) || 0),
  ])
);

/** A season is 7 competition weeks — same constant as utils/seasonProgress. */
const TOTAL_SEASON_WEEKS = 7;

/**
 * The lineup point cap a class may spend in a given competition week. The
 * budget opens `pointCapRamp` points below `pointCap` and rises one point per
 * week over the season's last `pointCapRamp` weeks, reaching `pointCap` in
 * the final week (150/5 over 7 weeks: 145, 145, 146, 147, 148, 149, 150). It
 * never falls within a season, so a saved lineup stays legal.
 *
 * Mirrors the server's `pointCapForWeek` in functions/src/helpers/classRegistry.js
 * exactly — the editor must show the budget saveLineup enforces.
 *
 * @param {string} classId - Canonical id or alias of a lineup-bearing class.
 * @param {number|null|undefined} week - Competition week (1-7). Null / 0 /
 *   unusable is treated as week 1 (the opening budget) so an un-hydrated
 *   season store can only under-allow, never over-allow.
 * @param {number} [totalWeeks]
 * @returns {number|null} The cap for that week, or null for a class with no lineup.
 */
export function pointCapForWeek(classId, week, totalWeeks = TOTAL_SEASON_WEEKS) {
  const entry = getClass(classId);
  if (!entry || !entry.enabled || !entry.capabilities?.hasLineup || entry.pointCap == null) {
    return null;
  }
  const ramp = Math.max(0, Number(entry.pointCapRamp) || 0);
  const w = Number.isFinite(Number(week)) && Number(week) >= 1 ? Math.floor(Number(week)) : 1;
  const weeksToGo = Math.max(0, totalWeeks - w);
  return entry.pointCap - Math.min(ramp, weeksToGo);
}

/**
 * Week-by-week caps for a class, `[{week, cap}]` for weeks 1..totalWeeks, or
 * null for a class with no lineup. Drives the budget-schedule UI.
 * @param {string} classId
 * @param {number} [totalWeeks]
 * @returns {Array<{week: number, cap: number}>|null}
 */
export function pointCapSchedule(classId, totalWeeks = TOTAL_SEASON_WEEKS) {
  if (pointCapForWeek(classId, 1, totalWeeks) == null) return null;
  return Array.from({ length: totalWeeks }, (_, i) => ({
    week: i + 1,
    cap: /** @type {number} */ (pointCapForWeek(classId, i + 1, totalWeeks)),
  }));
}

/**
 * The opening budget for a class (week 1) — `pointCap - pointCapRamp`.
 * @param {string} classId
 * @returns {number|null}
 */
export function openingPointCap(classId) {
  return pointCapForWeek(classId, 1);
}

/**
 * "145–150" for a ramped class, "90" for a flat one, "" for no lineup. For
 * class tables that describe the budget before a season is in view.
 * @param {string} classId
 */
export function formatPointCapRange(classId) {
  const entry = getClass(classId);
  const opening = openingPointCap(classId);
  if (!entry || opening == null) return '';
  return opening === entry.pointCap ? `${entry.pointCap}` : `${opening}\u2013${entry.pointCap}`;
}

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

/**
 * Full registry entry for a class id (any alias), or null.
 * @param {string} classId
 */
export function getClass(classId) {
  for (const [id, c] of ALL_ENTRIES) {
    if (id === classId || c.aliases.includes(classId)) return { id, ...c };
  }
  return null;
}

/**
 * Canonical class id for any spelling the schedule uses — a registry id
 * ("openClass"), an alias ("open"), or the display form ("Open Class",
 * "SoundSport") older/admin-authored `allowedClasses` rows carry. Null for
 * anything the registry doesn't know. Mirrors the server's
 * `showRegistrations.classIdOf`.
 * @param {unknown} value
 * @returns {string|null}
 */
export function classIdOf(value) {
  if (typeof value !== 'string' || !value) return null;
  const direct = getClass(value);
  if (direct) return direct.id;
  const camel = value
    .trim()
    .split(/\s+/)
    .map((w, i) => (i === 0 ? w.charAt(0).toLowerCase() + w.slice(1) : w))
    .join('');
  return getClass(camel)?.id ?? null;
}

/**
 * True when the class drafts an 8-caption lineup.
 *
 * Podium is the counter-example: it is a director simulation with a rehearsal
 * model instead of a draft, so it has no point cap and nothing to open a
 * caption editor onto. Surfaces that can route to the lineup editor — the
 * mobile nav's Lineup tab, `?panel=lineup` — must gate on this, or the editor
 * renders against an undefined budget.
 *
 * @param {string} classId
 */
export function classHasLineup(classId) {
  const entry = getClass(classId);
  return Boolean(entry?.enabled && entry.capabilities?.hasLineup);
}

/**
 * True when the id/alias names an enabled class.
 * @param {string} classId
 */
export function isClassEnabled(classId) {
  const entry = getClass(classId);
  return Boolean(entry && entry.enabled);
}

export { registry };
