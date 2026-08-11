import { describe, it, expect } from 'vitest';
import {
  writerScore,
  getWriterTier,
  nextWriterTier,
  WRITER_TIERS,
  APPROVED_WEIGHT,
  PRESS_WEIGHT,
} from './writerTier';

describe('writerScore', () => {
  it('weights approved articles above press releases', () => {
    expect(writerScore({ approvedCount: 1, pressReleaseCount: 0 })).toBe(APPROVED_WEIGHT);
    expect(writerScore({ approvedCount: 0, pressReleaseCount: 1 })).toBe(PRESS_WEIGHT);
    expect(writerScore({ approvedCount: 2, pressReleaseCount: 3 })).toBe(
      2 * APPROVED_WEIGHT + 3 * PRESS_WEIGHT
    );
  });

  it('treats missing/negative/fractional counts as clean non-negative integers', () => {
    expect(writerScore(undefined)).toBe(0);
    expect(writerScore(null)).toBe(0);
    expect(writerScore({})).toBe(0);
    expect(writerScore({ approvedCount: -5 })).toBe(0);
    expect(writerScore({ pressReleaseCount: 2.9 })).toBe(2 * PRESS_WEIGHT);
  });
});

describe('getWriterTier', () => {
  it('returns null below the first threshold', () => {
    expect(getWriterTier({ pressReleaseCount: 2 })).toBeNull();
    expect(getWriterTier(undefined)).toBeNull();
  });

  it('awards Contributor at a single approved article', () => {
    expect(getWriterTier({ approvedCount: 1 })?.id).toBe('contributor');
  });

  it('awards Contributor from press releases alone at the threshold', () => {
    expect(getWriterTier({ pressReleaseCount: 3 })?.id).toBe('contributor');
  });

  it('climbs to Correspondent and Staff Writer as contribution grows', () => {
    expect(getWriterTier({ approvedCount: 4 })?.id).toBe('correspondent');
    expect(getWriterTier({ approvedCount: 10 })?.id).toBe('staff_writer');
  });

  it("can't reach the top tier on press releases alone as easily as on articles", () => {
    // 10 approved articles (30) reaches Staff Writer; 10 press releases (10) does not.
    expect(getWriterTier({ approvedCount: 10 })?.id).toBe('staff_writer');
    expect(getWriterTier({ pressReleaseCount: 10 })?.id).toBe('contributor');
  });

  it('never exceeds the defined tiers', () => {
    const top = getWriterTier({ approvedCount: 1000 });
    expect(top?.id).toBe(WRITER_TIERS[WRITER_TIERS.length - 1].id);
  });
});

describe('nextWriterTier', () => {
  it('points at the first tier when unranked', () => {
    expect(nextWriterTier(undefined)?.id).toBe('contributor');
  });

  it('points at the next rung mid-ladder', () => {
    expect(nextWriterTier({ approvedCount: 1 })?.id).toBe('correspondent');
  });

  it('is null at the top', () => {
    expect(nextWriterTier({ approvedCount: 100 })).toBeNull();
  });
});
