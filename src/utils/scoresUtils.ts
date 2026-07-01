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
  aClass: 'Class A',
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
 */
export function seededShuffle<T>(array: readonly T[], seed: string): T[] {
  const shuffled = [...array];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash = hash & hash;
  }
  for (let i = shuffled.length - 1; i > 0; i--) {
    hash = (hash * 1103515245 + 12345) & 0x7fffffff;
    const j = hash % (i + 1);
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
