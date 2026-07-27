// Caption Wars — the league format that decides a week as a best-of-three
// across GE, Visual and Music. Design in docs/CAPTION_WARS_SPEC.md; the
// resolution itself lives in functions/src/helpers/captionWars.js and this file
// only reads what it stored.
//
// Three categories, permanently. The eight lineup captions are never persisted
// per show, because publishing them would let an opponent read a director's
// lineup straight off the recap. These three aggregate 2, 3 and 3 of them.

/** The three categories, in the order they are shown and stored. */
export const CAPTION_CATEGORIES = [
  { key: 'ge', label: 'General Effect', short: 'GE' },
  { key: 'visual', label: 'Visual', short: 'VIS' },
  { key: 'music', label: 'Music', short: 'MUS' },
] as const;

export type CaptionKey = (typeof CAPTION_CATEGORIES)[number]['key'];

/** One category's result, as stored on a resolved matchup. */
export interface CaptionResult {
  scores?: Record<string, number>;
  /** A uid, or 'tie' for the one case where neither director can be awarded it. */
  winner?: string;
}

export interface CaptionsBlock {
  ge?: CaptionResult;
  visual?: CaptionResult;
  music?: CaptionResult;
  tally?: Record<string, number>;
}

/** Categories this director took and dropped in one matchup. */
export function captionsWonBy(
  captions: CaptionsBlock | undefined,
  uid: string
): { won: number; lost: number } {
  const won = Number(captions?.tally?.[uid]) || 0;
  const contested = CAPTION_CATEGORIES.filter(({ key }) => {
    const winner = captions?.[key]?.winner;
    return !!winner && winner !== 'tie';
  }).length;
  return { won, lost: Math.max(0, contested - won) };
}

/** `3–0`, `2–1`. An en dash, matching the W-L record beside it. */
export function formatTally(captions: CaptionsBlock | undefined, uid: string): string {
  const { won, lost } = captionsWonBy(captions, uid);
  return `${won}–${lost}`;
}

/** A sweep — every contested category to one director. */
export function isSweep(captions: CaptionsBlock | undefined, uid: string): boolean {
  const { won, lost } = captionsWonBy(captions, uid);
  return won === CAPTION_CATEGORIES.length && lost === 0;
}

/**
 * Does this league's table have a category record worth showing?
 *
 * Data-driven rather than read off the league's settings, for the same reason
 * the class column is: the column should appear exactly when it has something
 * in it. A league that bought the format but has not resolved a week yet has an
 * empty column, and a league that played a Caption Wars season keeps its column
 * while it is looking at that season's table.
 */
export function hasCaptionRecords(
  rows: Array<{ captionsWon?: number; captionsLost?: number }>
): boolean {
  return rows.some((row) => (row.captionsWon || 0) > 0 || (row.captionsLost || 0) > 0);
}
