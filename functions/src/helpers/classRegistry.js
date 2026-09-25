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

/**
 * Classes eligible for weekly league matchups (Phase 7.4): every enabled
 * class — matchups compare corps.{class}.totalSeasonScore head-to-head,
 * which every class (including Podium, whose display copy is written
 * nightly) maintains. Podium joins automatically when its registry entry
 * enables at launch; until then this equals the historical literal.
 */
const MATCHUP_CLASSES = ENABLED_CLASSES;

/**
 * FULL (finals-week) lineup point caps by canonical class id (enabled,
 * lineup-bearing only). The cap a director may spend in a given week is
 * `pointCapForWeek` — it opens below this and ramps up to it.
 */
const POINT_CAPS = Object.fromEntries(
  ENABLED_ENTRIES.filter(([, c]) => c.capabilities.hasLineup).map(([id, c]) => [id, c.pointCap])
);

/**
 * How many points below `pointCap` each lineup class opens the season at.
 * Zero (or a missing field) means the cap is flat all season.
 */
const POINT_CAP_RAMPS = Object.fromEntries(
  ENABLED_ENTRIES.filter(([, c]) => c.capabilities.hasLineup).map(([id, c]) => [
    id,
    Math.max(0, Number(c.pointCapRamp) || 0),
  ])
);

/** A season is 7 competition weeks (49 days) — mirrors showSelection/seasonProgress. */
const TOTAL_SEASON_WEEKS = 7;

/**
 * The lineup point cap a class is allowed to spend in a given competition
 * week. The budget opens `pointCapRamp` points below `pointCap` and rises by
 * one point per week over the season's last `pointCapRamp` weeks, so it is
 * exactly `pointCap` in the final week (150/5 over 7 weeks: 145, 145, 146,
 * 147, 148, 149, 150). The cap never falls within a season, so a lineup that
 * was legal when saved stays legal.
 *
 * The client mirrors this in src/utils/classRegistry.js `pointCapForWeek`;
 * keep the two identical so the budget the editor shows is exactly what
 * saveLineup enforces.
 *
 * @param {string} classId - Canonical id or alias of a lineup-bearing class.
 * @param {number|null|undefined} week - Competition week (1-7). Null, 0 or
 *   anything unusable is treated as week 1 (the opening budget) so an
 *   unknown week can only ever under-allow, never over-allow.
 * @param {number} [totalWeeks]
 * @returns {number|null} The cap for that week, or null for a class with no lineup.
 */
function pointCapForWeek(classId, week, totalWeeks = TOTAL_SEASON_WEEKS) {
  const entry = getClass(classId);
  if (!entry || !entry.enabled || !entry.capabilities.hasLineup || entry.pointCap == null) {
    return null;
  }
  const ramp = Math.max(0, Number(entry.pointCapRamp) || 0);
  const w = Number.isFinite(Number(week)) && Number(week) >= 1 ? Math.floor(Number(week)) : 1;
  const weeksToGo = Math.max(0, totalWeeks - w);
  return entry.pointCap - Math.min(ramp, weeksToGo);
}

/**
 * The week-by-week cap for a class — `[{week, cap}]` for weeks 1..totalWeeks —
 * or null for a class with no lineup.
 * @param {string} classId
 * @param {number} [totalWeeks]
 * @returns {Array<{week: number, cap: number}>|null}
 */
function pointCapSchedule(classId, totalWeeks = TOTAL_SEASON_WEEKS) {
  if (pointCapForWeek(classId, 1, totalWeeks) == null) return null;
  return Array.from({ length: totalWeeks }, (_, i) => ({
    week: i + 1,
    cap: /** @type {number} */ (pointCapForWeek(classId, i + 1, totalWeeks)),
  }));
}

/** Registration lock (weeks before season end) by canonical class id. */
const REGISTRATION_LOCK_WEEKS = Object.fromEntries(
  ENABLED_ENTRIES.map(([id, c]) => [id, c.registrationLockWeeks])
);

/**
 * CorpsCoin unlock costs keyed by EVERY accepted alias (canonical +
 * legacy short keys) — matches the historical economy.js literal, which
 * had no entry for free classes (soundSport).
 */
/** @type {Record<string, number>} */
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
/** @type {Record<string, number>} */
const SHOW_PARTICIPATION_REWARDS = {};
for (const [, c] of ENABLED_ENTRIES) {
  for (const alias of c.aliases) SHOW_PARTICIPATION_REWARDS[alias] = c.participationReward;
}

/** Full registry entry for a class id (any alias), or null. */
/** @param {string} classId */
function getClass(classId) {
  for (const [id, c] of ALL_ENTRIES) {
    if (id === classId || c.aliases.includes(classId)) return { id, ...c };
  }
  return null;
}

/** True when the id/alias names an enabled class. */
/** @param {string} classId */
function isClassEnabled(classId) {
  const entry = getClass(classId);
  return Boolean(entry && entry.enabled);
}

module.exports = {
  registry,
  ENABLED_CLASSES,
  FANTASY_CLASSES,
  RANKED_CLASSES,
  MATCHUP_CLASSES,
  POINT_CAPS,
  POINT_CAP_RAMPS,
  TOTAL_SEASON_WEEKS,
  pointCapForWeek,
  pointCapSchedule,
  REGISTRATION_LOCK_WEEKS,
  CLASS_UNLOCK_COSTS,
  CLASS_UNLOCK_LEVELS,
  SHOW_PARTICIPATION_REWARDS,
  getClass,
  isClassEnabled,
};
