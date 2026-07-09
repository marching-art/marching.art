// =============================================================================
// CLASS UNLOCK UTILITIES
// =============================================================================
// Classes unlock three ways (any one is enough):
//   1. XP level — early, earned (Level 3/5/10)
//   2. Seasons actively completed — the standard "play = earning" path
//      (complete 1/2/3 seasons; lifetimeStats.totalSeasons)
//   3. CorpsCoin — the explicit skip lane (1,000/2,500/5,000 CC)
// The old calendar path (5/12/19 weeks since registration, granted whether or
// not you played) was removed per the owner-approved redesign
// (docs/PROGRESSION_ECONOMY_REDESIGN.md Decision 1). A distant, silent
// account-age backstop exists server-side only (functions xpCalculations.js).
//
// This module replaces utils/classUnlockTime.ts, keeping its canonical-key
// helpers, which are unlock-path-independent.

/** Seasons actively completed that unlock each class.
 * Accepts both short ('open') and canonical ('openClass') keys, mirroring
 * functions/src/helpers/xpCalculations.js XP_CONFIG.classUnlockSeasons.
 */
export const CLASS_UNLOCK_SEASONS: Record<string, number> = {
  aClass: 1,
  open: 2,
  openClass: 2,
  world: 3,
  worldClass: 3,
};

/**
 * Map legacy/short unlock keys to the canonical profile key used everywhere
 * else (matches CORPS_CLASS_ORDER). All writes into `unlockedClasses` must
 * use canonical keys so checks like `unlockedClasses.includes('openClass')`
 * succeed.
 */
const CANONICAL_CLASS_KEY: Record<string, string> = {
  soundSport: 'soundSport',
  aClass: 'aClass',
  open: 'openClass',
  openClass: 'openClass',
  world: 'worldClass',
  worldClass: 'worldClass',
};

export function toCanonicalClassKey(key: string): string {
  return CANONICAL_CLASS_KEY[key] || key;
}

/**
 * Normalize an `unlockedClasses` array to canonical keys, de-duplicating and
 * preserving order. Returns the normalized array and a flag indicating whether
 * any change was made (so callers can decide whether to persist the fix).
 */
export function normalizeUnlockedClasses(arr: string[] | undefined | null): {
  normalized: string[];
  changed: boolean;
} {
  const input = arr || ['soundSport'];
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const key of input) {
    const canonical = toCanonicalClassKey(key);
    if (!seen.has(canonical)) {
      seen.add(canonical);
      normalized.push(canonical);
    }
  }
  const changed = normalized.length !== input.length || normalized.some((c, i) => c !== input[i]);
  return { normalized, changed };
}

/**
 * Seasons still to complete before a class unlocks on the standard path.
 * Returns 0 if already eligible, null if the class key is invalid.
 *
 * @param totalSeasons - lifetimeStats.totalSeasons (seasons actively
 *   completed — competed in ≥1 show in a season that archived)
 */
export function getSeasonsUntilUnlock(
  totalSeasons: number | undefined | null,
  classKey: string
): number | null {
  const requiredSeasons = CLASS_UNLOCK_SEASONS[classKey];
  if (requiredSeasons === undefined) return null;
  return Math.max(0, requiredSeasons - (totalSeasons || 0));
}
