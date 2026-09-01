// One-Night Slate — the league format that decides a week on each director's
// BEST SINGLE SHOW instead of the week's sum. Design and resolution live in
// functions/src/helpers/oneNightSlate.js; this file only reads what it stored.

/**
 * What a commissioner pays to run One-Night Slate for ONE season, out of their
 * own balance. Mirrors ONE_NIGHT_SEASON_COST in
 * functions/src/helpers/oneNightSlate.js; oneNightSlate.test.ts imports that
 * module directly and fails the build if the two drift.
 */
export const ONE_NIGHT_SEASON_COST = 1500;

/** One side's best night, as stored on a resolved One-Night Slate matchup. */
export interface BestShowEntry {
  score?: number;
  showName?: string | null;
}

/** The `best` block the backend stores on a resolved matchup. */
export type BestBlock = Record<string, BestShowEntry | undefined>;

/** A side's best-show score, 0 when the block (or the side) is missing. */
export function bestScoreFor(best: BestBlock | undefined, uid: string): number {
  return Number(best?.[uid]?.score) || 0;
}
