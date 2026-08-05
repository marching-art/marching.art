// Style tokens + pure helpers for the shared score sheets. Kept separate from
// SheetPrimitives.tsx (which exports the React components) so each file exports
// a single kind of thing — this keeps React Fast Refresh happy and gives the
// non-component constants a stable, dependency-free home.

// The Podium recap sheet is the visual reference: a #1a1a1a card on a #333
// border, gold (#c9a227) box-toppers/accents, blue for the viewer's own corps.
export const SHEET_CARD = 'bg-surface-card border border-line rounded-none p-3 md:p-4';
export const GOLD = 'text-brand';

// Fixed numeric-column widths so caption values line up across every row and
// card while the corps column flexes and truncates — the key to a box-score
// look that never forces horizontal scroll on mobile.
export const CAP_W = 'w-[42px]';
export const TOTAL_W = 'w-[52px]';
// Trailing movement column — wide enough for a triangle + a two-digit
// placement count (e.g. "▲12") without wrapping.
export const TREND_W = 'w-8';

export interface SortOption {
  id: string;
  label: string;
}

// Caption Leaders sorting (§5.4): the fantasy classes sort by the CONDENSED
// captions only (GE/VIS/MUS) — per-caption detail stays Podium-exclusive so
// lineups can't be harvested from the sheet.
export const STANDINGS_SORTS: SortOption[] = [
  { id: 'total', label: 'Score' },
  { id: 'GE', label: 'GE' },
  { id: 'VIS', label: 'VIS' },
  { id: 'MUS', label: 'MUS' },
];

// Section order every sheet shows its classes in: World → Open → A. Both boards
// section the same way — the fantasy recaps split a show's field by
// `corpsClass`, the Podium sheets split theirs by `division` (§5.7: every
// division crowns its own) — so the grouping itself lives here.
export const CLASS_SECTION_ORDER = ['worldClass', 'openClass', 'aClass'];

export interface ClassSection<T> {
  cls: string | null | undefined;
  rows: T[];
}

/**
 * Group rows into class sections: the known classes first in World → Open → A
 * order, then any unrecognized class in encounter order — an unexpected value
 * is still shown rather than dropped. Empty classes produce no section.
 */
export function groupByClass<T>(
  rows: readonly T[],
  classOf: (row: T) => string | null | undefined
): Array<ClassSection<T>> {
  const byClass = new Map<string | null | undefined, T[]>();
  for (const row of rows) {
    const cls = classOf(row);
    const bucket = byClass.get(cls);
    if (bucket) bucket.push(row);
    else byClass.set(cls, [row]);
  }
  const known = CLASS_SECTION_ORDER.filter((cls) => byClass.has(cls));
  const rest = [...byClass.keys()].filter(
    (cls) => typeof cls !== 'string' || !CLASS_SECTION_ORDER.includes(cls)
  );
  return [...known, ...rest].map((cls) => ({ cls, rows: byClass.get(cls) as T[] }));
}

export interface CaptionTriple {
  ge: number | null;
  vis: number | null;
  mus: number | null;
}

// Highest GE/VIS/MUS across a set of caption breakdowns (box-toppers).
export const captionTops = (
  list: Array<Partial<CaptionTriple> | null | undefined>
): CaptionTriple => {
  const tops: CaptionTriple = { ge: null, vis: null, mus: null };
  for (const caps of list) {
    if (!caps) continue;
    for (const key of ['ge', 'vis', 'mus'] as const) {
      const value = caps[key];
      const current = tops[key];
      if (value != null && (current == null || value > current)) {
        tops[key] = value;
      }
    }
  }
  return tops;
};
