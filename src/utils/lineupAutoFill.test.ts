import { describe, it, expect } from 'vitest';
import { autoFillLineup, type CorpsOption } from './lineupAutoFill';

const CAPTIONS = ['GE1', 'GE2', 'VP', 'VA', 'CG', 'B', 'MA', 'P'];
const LIMIT = 90;

function corps(name: string, points: number, year = 2024): CorpsOption {
  return { corpsName: name, sourceYear: year, points };
}

function lineupPoints(lineup: Record<string, string>): number {
  return Object.values(lineup).reduce((s, v) => s + (parseFloat(v.split('|')[2]) || 0), 0);
}

function lineupNames(lineup: Record<string, string>): string[] {
  return Object.values(lineup).map((v) => v.split('|')[0]);
}

describe('autoFillLineup', () => {
  it('fills all 8 captions and uses exactly 90 points when reachable', () => {
    // 25+20+15+10+8+5+4+3 = 90 exactly, plus decoys.
    const pool = [25, 20, 15, 10, 8, 5, 4, 3, 30, 12].map((p, i) => corps(`Corps${i}`, p));
    const result = autoFillLineup(pool, {}, CAPTIONS, LIMIT);

    expect(result.filledAll).toBe(true);
    expect(Object.keys(result.lineup)).toHaveLength(8);
    expect(result.totalPoints).toBe(90);
    expect(lineupPoints(result.lineup)).toBe(90);
  });

  it('fills all 8 captions where the greedy highest-first approach would fail', () => {
    // Greedy takes 50, then 40 (=90), then has 0 budget for 6 more captions.
    // The exact solution skips the big corps and fills all 8.
    const pool = [
      corps('Big1', 50),
      corps('Big2', 40),
      ...Array.from({ length: 8 }, (_, i) => corps(`Small${i}`, 10)),
    ];
    const result = autoFillLineup(pool, {}, CAPTIONS, LIMIT);

    expect(result.filledAll).toBe(true);
    expect(Object.keys(result.lineup)).toHaveLength(8);
    // Best full fill: 50 + 7x10 = 120 > 90 → 40 + 5x10... exact max is
    // 8 picks <= 90: e.g. 10x8=80, or Big2(40)+10x5=90? That's only 6 picks...
    // 8 picks: smallest 8 are 10x8=80; swapping a 10 for Big2 adds 30 (110>90).
    // So max for a full fill is 80 — and every caption is filled.
    expect(result.totalPoints).toBe(80);
  });

  it('maximizes points when exactly hitting the limit is impossible', () => {
    // All corps worth 12: 8 x 12 = 96 > 90, 7 x 12 = 84 -> can't fill 8 within 90.
    // Falls back to the most captions fillable (7) at max points (84).
    const pool = Array.from({ length: 10 }, (_, i) => corps(`C${i}`, 12));
    const result = autoFillLineup(pool, {}, CAPTIONS, LIMIT);

    expect(result.filledAll).toBe(false);
    expect(Object.keys(result.lineup)).toHaveLength(7);
    expect(result.totalPoints).toBe(84);
  });

  it('never uses the same corps twice, even across multiple source years', () => {
    const pool = [
      corps('Dup', 20, 2019),
      corps('Dup', 15, 2021), // same corps, different year — only one usable
      ...Array.from({ length: 9 }, (_, i) => corps(`U${i}`, 8)),
    ];
    const result = autoFillLineup(pool, {}, CAPTIONS, LIMIT);

    expect(result.filledAll).toBe(true);
    const names = lineupNames(result.lineup);
    expect(new Set(names).size).toBe(names.length);
  });

  it('preserves existing picks and fills only the empty captions', () => {
    const existing = { GE1: 'Kept|2020|30' };
    const pool = [
      corps('Kept', 30), // already used — must be excluded
      ...[15, 12, 10, 8, 6, 5, 4, 3].map((p, i) => corps(`N${i}`, p)),
    ];
    const result = autoFillLineup(pool, existing, CAPTIONS, LIMIT);

    expect(result.lineup.GE1).toBe('Kept|2020|30'); // untouched
    expect(result.filledAll).toBe(true);
    expect(lineupNames(result.lineup).filter((n) => n === 'Kept')).toHaveLength(1);
    // 30 existing + best 7 of the rest within 60: 15+12+10+8+6+5+4=60 -> exactly 90.
    expect(result.totalPoints).toBe(90);
    expect(lineupPoints(result.lineup)).toBeLessThanOrEqual(LIMIT);
  });

  it('respects the remaining budget left by existing picks', () => {
    const existing = { GE1: 'A|2020|50', GE2: 'B|2020|30' }; // 80 used, 10 left
    const pool = [corps('C', 10), corps('D', 11), corps('E', 2), corps('F', 3)];
    const result = autoFillLineup(pool, existing, CAPTIONS, LIMIT);

    // Only 6 captions remain but budget 10 allows at most C(10) or E+F(5)...
    // best 2 picks: E+F = 5; best with more slots impossible; C alone = 10.
    expect(result.filledAll).toBe(false);
    expect(lineupPoints(result.lineup)).toBeLessThanOrEqual(LIMIT);
  });

  it('is a no-op when the lineup is already complete', () => {
    const full = Object.fromEntries(CAPTIONS.map((c, i) => [c, `X${i}|2020|10`]));
    const result = autoFillLineup([corps('Y', 5)], full, CAPTIONS, LIMIT);
    expect(result.filledAll).toBe(true);
    expect(result.lineup).toEqual(full);
    expect(result.totalPoints).toBe(80);
  });

  it('handles an empty corps pool gracefully', () => {
    const result = autoFillLineup([], {}, CAPTIONS, LIMIT);
    expect(result.filledAll).toBe(false);
    expect(Object.keys(result.lineup)).toHaveLength(0);
    expect(result.totalPoints).toBe(0);
  });
});
