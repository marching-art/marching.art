// Pure helpers for the Season Recap Ledger — the private, dashboard-only
// "running ledger of your stats, show to show" shared by Podium and the fantasy
// classes. Kept free of React (like sheetTokens beside it) so the presentational
// SeasonLedgerView can import these without dragging a component graph, and so
// the aggregation stays unit-testable on its own.

import { CAPTION_IDS } from '../../data/captions';

/** One scored outing, normalized to the shape SeasonLedgerView renders. */
export interface LedgerEntry {
  /** Stable React key for the row. */
  key: string;
  day: number;
  eventName?: string | null;
  location?: string | null;
  captions?: Record<string, number | undefined> | null;
  geScore?: number | null;
  visualScore?: number | null;
  musicScore?: number | null;
  totalScore?: number | null;
  /** Placement within the corps' own field that night (division/class). */
  place?: number | null;
  fieldSize?: number | null;
  /** Podium per-show medal, when the source provides one. */
  medal?: 'gold' | 'silver' | 'bronze' | null;
}

export interface LedgerSummary {
  outings: number;
  best: LedgerEntry;
  average: number | null;
  /** Highest value posted in each caption across the season (personal bests). */
  captionBests: Record<string, number | null>;
  medals: { gold: number; silver: number; bronze: number };
  medalCount: number;
}

/** Two-decimal score, or an em dash for missing values. */
export const fmtScore = (v: number | null | undefined): string =>
  typeof v === 'number' ? v.toFixed(2) : '—';

/**
 * Season aggregates over a ledger: outing count, the best/average total, the
 * best value posted in each caption (its "personal box-topper"), and a medal
 * tally. Returns null for an empty ledger so callers can render an empty state.
 */
export function summarizeLedger(
  ledger: LedgerEntry[] | null | undefined,
  captions: readonly string[] = CAPTION_IDS
): LedgerSummary | null {
  if (!ledger || ledger.length === 0) return null;

  const totals = ledger.map((e) => e.totalScore).filter((t): t is number => typeof t === 'number');
  const best = ledger.reduce((a, b) => ((b.totalScore ?? 0) > (a.totalScore ?? 0) ? b : a));

  const captionBests: Record<string, number | null> = {};
  for (const caption of captions) {
    let top: number | null = null;
    for (const entry of ledger) {
      const v = entry.captions?.[caption];
      if (typeof v === 'number' && (top === null || v > top)) top = v;
    }
    captionBests[caption] = top;
  }

  const medals = { gold: 0, silver: 0, bronze: 0 };
  for (const entry of ledger) {
    if (entry.medal && medals[entry.medal] != null) medals[entry.medal] += 1;
  }

  return {
    outings: ledger.length,
    best,
    average: totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : null,
    captionBests,
    medals,
    medalCount: medals.gold + medals.silver + medals.bronze,
  };
}
