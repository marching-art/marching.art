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
  Silver: { bg: 'bg-charcoal-300', text: 'text-black', badge: 'bg-charcoal-300/20 text-secondary' },
  Bronze: { bg: 'bg-orange-400', text: 'text-black', badge: 'bg-orange-400/20 text-orange-400' },
  Participation: {
    bg: 'bg-charcoal-600',
    text: 'text-white',
    badge: 'bg-charcoal-600/20 text-muted',
  },
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
// RANK MOVEMENT — places gained/lost since the previous show (for the trend
// triangle on the standings sheets)
// =============================================================================

interface RankableEntry {
  uid?: string;
  corpsName?: string;
  rank?: number;
  score?: number;
  // Score history, most-recent first (scores[0] is the latest show).
  scores?: Array<{ score?: number }>;
}

const rankKey = (e: RankableEntry): string => e.uid || e.corpsName || '';

// A corps's total as of the PREVIOUS show — scores[1] — falling back to its
// current score so the previous ranking is a coherent total order.
const previousScore = (e: RankableEntry): number => {
  const s = e.scores;
  if (Array.isArray(s) && s.length > 1 && typeof s[1]?.score === 'number')
    return s[1].score as number;
  if (Array.isArray(s) && s.length > 0 && typeof s[0]?.score === 'number')
    return s[0].score as number;
  return typeof e.score === 'number' ? e.score : -Infinity;
};

/**
 * How many placements each corps moved since its previous show, keyed by
 * uid (or corpsName). Positive = moved up. A corps with only one show has no
 * prior standing, so its delta is null (renders as a neutral dash).
 *
 * Current rank comes from each entry's `rank`; the previous ranking is the same
 * field re-sorted by each corps's previous-show score. This is a per-sheet
 * approximation — good enough to drive the up/down triangle without threading a
 * historical standings snapshot through the client.
 */
export function computeRankDeltas(standings: RankableEntry[]): Map<string, number | null> {
  const deltas = new Map<string, number | null>();
  if (!Array.isArray(standings) || standings.length === 0) return deltas;

  const currentRank = new Map<string, number>();
  standings.forEach((entry, index) => {
    currentRank.set(rankKey(entry), typeof entry.rank === 'number' ? entry.rank : index + 1);
  });

  const prevOrder = [...standings].sort((a, b) => previousScore(b) - previousScore(a));
  const previousRank = new Map<string, number>();
  prevOrder.forEach((entry, index) => previousRank.set(rankKey(entry), index + 1));

  standings.forEach((entry) => {
    const key = rankKey(entry);
    const hasPrev = Array.isArray(entry.scores) && entry.scores.length > 1;
    const cur = currentRank.get(key);
    const prev = previousRank.get(key);
    deltas.set(key, hasPrev && cur != null && prev != null ? prev - cur : null);
  });
  return deltas;
}

// =============================================================================
// SHAREABLE TEXT — Discord-ready monospace sheets (parity with the Podium sheet)
// =============================================================================
// The Podium recap sheet already exports a monospace text block that pastes
// cleanly into Discord/group chats (see formatRecapAsText in PodiumRecapSheet).
// These mirror that format for the Fantasy box scores and standings so every
// sheet's Share button produces the same shape of text.

const fmt2 = (v: number | null | undefined): string => (typeof v === 'number' ? v.toFixed(2) : '—');
const fmt3 = (v: number | null | undefined): string => (typeof v === 'number' ? v.toFixed(3) : '—');
const pad = (v: string, n: number): string => v.padEnd(n).slice(0, n);

export interface ShareRow {
  place: number;
  corpsName: string;
  total: number | null | undefined;
  captions: CaptionBreakdown;
}

export interface ShareSheetMeta {
  title: string;
  location?: string | null;
  date?: string | null;
  subtitle?: string | null;
  seasonName?: string | null;
}

function shareLines(rows: ShareRow[]): string[] {
  return rows.map(
    (row) =>
      `${String(row.place).padStart(2)}. ${pad(row.corpsName || 'Unknown', 24)} ${fmt3(
        row.total
      ).padStart(8)}  (GE ${fmt2(row.captions?.ge)} · VIS ${fmt2(row.captions?.vis)} · MUS ${fmt2(
        row.captions?.mus
      )})`
  );
}

/** One show's box score as a Discord-ready code block. */
export function formatBoxScoreAsText(meta: ShareSheetMeta, rows: ShareRow[]): string {
  const head = [meta.title, meta.location, meta.date].filter(Boolean).join(' — ');
  const lines = [head, ''];
  lines.push(...shareLines(rows));
  lines.push('');
  lines.push(`marching.art${meta.seasonName ? ` · ${meta.seasonName}` : ''}`);
  return '```\n' + lines.join('\n') + '\n```';
}

/** A standings sheet (single class/section) as a Discord-ready code block. */
export function formatStandingsAsText(meta: ShareSheetMeta, rows: ShareRow[]): string {
  const lines = [meta.title];
  if (meta.subtitle) lines.push(meta.subtitle);
  lines.push('');
  lines.push(...shareLines(rows));
  lines.push('');
  lines.push(`marching.art${meta.seasonName ? ` · ${meta.seasonName}` : ''}`);
  return '```\n' + lines.join('\n') + '\n```';
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
