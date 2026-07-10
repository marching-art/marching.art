// =============================================================================
// SCORES PAGE UTILITIES
// =============================================================================
// Pure helpers and display config extracted from Scores.jsx for testability.

export interface RatingStyle {
  bg: string;
  text: string;
  badge: string;
}

export type SoundSportRating = 'Gold' | 'Silver' | 'Bronze' | 'Participation';

export const RATING_CONFIG: Record<SoundSportRating, RatingStyle> = {
  Gold: { bg: 'bg-yellow-500', text: 'text-black', badge: 'bg-yellow-500/20 text-yellow-500' },
  Silver: { bg: 'bg-gray-300', text: 'text-black', badge: 'bg-gray-300/20 text-gray-300' },
  Bronze: { bg: 'bg-orange-400', text: 'text-black', badge: 'bg-orange-400/20 text-orange-400' },
  Participation: { bg: 'bg-gray-600', text: 'text-white', badge: 'bg-gray-600/20 text-gray-400' },
};

export const CLASS_LABELS: Record<string, string> = {
  worldClass: 'World Class',
  openClass: 'Open Class',
  aClass: 'A Class',
  soundSport: 'SoundSport',
};

/** Map a SoundSport score to its medal tier. */
export function getSoundSportRating(score: number): SoundSportRating {
  if (score >= 85) return 'Gold';
  if (score >= 75) return 'Silver';
  if (score >= 65) return 'Bronze';
  return 'Participation';
}

/**
 * Deterministic Fisher-Yates shuffle seeded by a string, so a given show always
 * renders its entries in the same order.
 *
 * Uses an xmur3 string hash to seed a mulberry32 PRNG, drawing each swap index
 * from the generator's high bits via a float in [0, 1). An earlier version
 * seeded a raw LCG and took `hash % (i + 1)`; because an LCG's low bits are
 * barely random, that reliably swapped index 0 into the last slot for even-
 * sized groups — which, since scores arrive sorted descending, parked the
 * best-in-show entry at the bottom of every show. Drawing from the high bits
 * removes that bias and produces a uniformly distributed order.
 */
export function seededShuffle<T>(array: readonly T[], seed: string): T[] {
  const shuffled = [...array];

  // xmur3: derive a well-mixed 32-bit seed from the string.
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let state = (Math.imul(h ^ (h >>> 16), 2246822507) ^ h) >>> 0;

  // mulberry32: fast PRNG with well-distributed high bits.
  const nextFloat = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(nextFloat() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export interface CaptionBreakdown {
  ge: number | null;
  vis: number | null;
  mus: number | null;
}

export interface ExistingCaptions {
  geScore?: number;
  visualScore?: number;
  musicScore?: number;
}

/**
 * Return the GE/Visual/Music breakdown from real caption data only — never
 * synthesizes values. If any of the three scores is missing, all are null.
 */
export function getCaptionBreakdown(existingCaptions?: ExistingCaptions): CaptionBreakdown {
  if (existingCaptions?.geScore && existingCaptions?.visualScore && existingCaptions?.musicScore) {
    return {
      ge: existingCaptions.geScore,
      vis: existingCaptions.visualScore,
      mus: existingCaptions.musicScore,
    };
  }
  return { ge: null, vis: null, mus: null };
}

// =============================================================================
// TWO-NIGHT EVENT COMBINED STANDINGS (Eastern Classic, days 41-42 — §5.11)
// =============================================================================

export const TWO_NIGHT_DAYS: readonly [number, number] = [41, 42];

interface RecapScore {
  corpsClass?: string;
  score?: number;
  totalScore?: number;
  [key: string]: unknown;
}

interface RecapShow {
  eventName: string;
  location?: string | null;
  date?: string;
  offSeasonDay: number;
  scores: RecapScore[];
}

export interface TwoNightSection {
  corpsClass: string;
  label: string;
  rows: Array<RecapScore & { night: 1 | 2 }>;
}

export interface TwoNightCombined {
  eventName: string;
  location: string | null;
  dateRange: string;
  sections: TwoNightSection[];
}

/**
 * Merge a two-night event's recaps (same eventName on days 41 and 42) into a
 * combined standings view: rows tagged Night 1/Night 2, grouped per class and
 * ranked within each class — placements across classes are meaningless, but
 * the full-field per-class look is the point of the Eastern Classic.
 *
 * Returns null until BOTH nights have scored (the combined view appears once
 * Saturday processes; before that each night's own recap stands alone).
 * SoundSport rows are excluded: it is ratings-only and its numeric scores are
 * never surfaced in placement views.
 */
export function mergeTwoNightShows(shows: RecapShow[]): TwoNightCombined | null {
  if (!shows || shows.length === 0) return null;
  const [nightA, nightB] = TWO_NIGHT_DAYS;
  const firstNight = shows.find((s) => s.offSeasonDay === nightA);
  if (!firstNight) return null;
  const secondNight = shows.find(
    (s) => s.offSeasonDay === nightB && s.eventName === firstNight.eventName
  );
  if (!secondNight) return null;

  const merged: Array<RecapScore & { night: 1 | 2 }> = [];
  for (const [night, show] of [
    [1, firstNight],
    [2, secondNight],
  ] as Array<[1 | 2, RecapShow]>) {
    for (const score of show.scores || []) {
      if (score.corpsClass === 'soundSport') continue;
      merged.push({ ...score, night });
    }
  }
  if (merged.length === 0) return null;

  const classOrder = ['worldClass', 'openClass', 'aClass'];
  const sections = classOrder
    .map((corpsClass) => ({
      corpsClass,
      label: CLASS_LABELS[corpsClass] || corpsClass,
      rows: merged
        .filter((row) => row.corpsClass === corpsClass)
        .sort((a, b) => (b.score ?? b.totalScore ?? 0) - (a.score ?? a.totalScore ?? 0)),
    }))
    .filter((section) => section.rows.length > 0);
  if (sections.length === 0) return null;

  return {
    eventName: firstNight.eventName,
    location: firstNight.location || null,
    dateRange:
      firstNight.date && secondNight.date && firstNight.date !== secondNight.date
        ? `${firstNight.date} – ${secondNight.date}`
        : firstNight.date || '',
    sections,
  };
}
