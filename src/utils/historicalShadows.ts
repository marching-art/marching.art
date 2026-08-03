/**
 * Historical shadows — the cast of real DCI arcs the Podium trajectory chart
 * draws behind a director's own score line (design §6, decision 29).
 *
 * The committed pool (src/data/historicalShadows.json, built by
 * functions/src/scripts/buildHistoricalShadows.js) holds eight World Class
 * season arcs in each of eight finals bands spanning 70-98. This module draws
 * ONE arc per band, so the chart the director sees has three guarantees:
 *
 *   1. It rotates. The draw is seeded by seasonUid, so every season reset
 *      hands out a different cast — the old build baked one fixed set of eight
 *      corps into the client and every director saw those same ghosts forever.
 *   2. No corps and no year repeats inside a cast. Two Cadets lines, or two
 *      2013 arcs, read as a data bug and waste one of the eight slots.
 *   3. The finals spread stays balanced: exactly one arc from each band means
 *      the ghosts always ladder from ~70 to ~98, so there is something to
 *      chase whether the corps is fighting for a finals berth or a medal.
 *
 * Selection is a deterministic backtracking search — the same seasonUid always
 * yields the same cast, on every client and on every render, with no server
 * round-trip. Backtracking (rather than a straight greedy pass) is what makes
 * guarantee 2 hold: a band whose every candidate collides with an already-used
 * year can send the search back to revise an earlier band instead of giving up
 * and drawing a duplicate.
 */

import shadowData from '../data/historicalShadows.json';

/** One real corps season, normalized to competition days 1-49. */
export interface ShadowArc {
  corps: string;
  year: number;
  /** Index into meta.bands — 0 is the lowest finals band. */
  band: number;
  observedDays: number;
  finals: number;
  totals: number[];
}

export interface ShadowPool {
  meta: { bands: number[]; perBand: number; [key: string]: unknown };
  pool: ShadowArc[];
}

const DEFAULT_POOL = shadowData as unknown as ShadowPool;

/**
 * Deterministic 32-bit string hash normalized to [0,1) — the same mixing
 * function the Podium scoring engine seeds with (functions/src/helpers/podium/
 * engine.js seededUnit), so seeded draws behave identically on both sides.
 */
function seededUnit(seed: string): number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^= h >>> 16) >>> 0) / 4294967295;
}

/** Candidates for one band, shuffled into this season's deterministic order. */
function bandOrder(pool: ShadowArc[], band: number, seed: string): ShadowArc[] {
  return pool
    .filter((arc) => arc.band === band)
    .map((arc) => ({ arc, key: seededUnit(`${seed}|${arc.corps}|${arc.year}`) }))
    .sort((a, b) => a.key - b.key || a.arc.corps.localeCompare(b.arc.corps))
    .map((entry) => entry.arc);
}

/**
 * One arc per band, no repeated corps and no repeated year. Returns null only
 * if the pool genuinely cannot satisfy the constraints (a band with no
 * candidates at all, or a corpus too narrow to fill every band cleanly).
 */
function search(
  byBand: ShadowArc[][],
  index: number,
  usedCorps: Set<string>,
  usedYears: Set<number>,
  picked: ShadowArc[]
): ShadowArc[] | null {
  if (index >= byBand.length) return [...picked];
  for (const arc of byBand[index]) {
    if (usedCorps.has(arc.corps) || usedYears.has(arc.year)) continue;
    usedCorps.add(arc.corps);
    usedYears.add(arc.year);
    picked.push(arc);
    const solved = search(byBand, index + 1, usedCorps, usedYears, picked);
    if (solved) return solved;
    picked.pop();
    usedCorps.delete(arc.corps);
    usedYears.delete(arc.year);
  }
  return null;
}

/**
 * The cast of shadow arcs for one season, highest finals first.
 *
 * @param seasonUid identifies the season; a new uid (i.e. a season reset)
 *   redraws the cast. Falsy uids fall back to a fixed seed so the chart is
 *   still stable and balanced before a corps has a season attached.
 */
export function selectSeasonShadows(
  seasonUid?: string | null,
  data: ShadowPool = DEFAULT_POOL
): ShadowArc[] {
  const pool = data?.pool || [];
  if (pool.length === 0) return [];
  const seed = `shadows|${seasonUid || 'preseason'}`;
  const bandCount = Math.max(...pool.map((arc) => arc.band)) + 1;
  const byBand = Array.from({ length: bandCount }, (_, band) => bandOrder(pool, band, seed)).filter(
    (candidates) => candidates.length > 0
  );

  const solved = search(byBand, 0, new Set(), new Set(), []);
  // Fallback for a pool too thin to dedupe both ways: keep corps unique (a
  // repeated corps is the worse artifact) and accept a repeated year.
  const cast =
    solved ??
    byBand.reduce<ShadowArc[]>((acc, candidates) => {
      const next = candidates.find((arc) => !acc.some((a) => a.corps === arc.corps));
      if (next) acc.push(next);
      return acc;
    }, []);

  return cast.sort((a, b) => b.finals - a.finals);
}
