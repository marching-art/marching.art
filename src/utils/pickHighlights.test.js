import { describe, test, expect } from 'vitest';
import { buildShowHighlights, parsePick, highlightLabel } from './pickHighlights';

const pool = [
  { corpsName: 'Blue Devils', sourceYear: '2009', resultDays: [10, 12, 14] },
  { corpsName: 'Carolina Crown', sourceYear: '2012', resultDays: [11, 13] },
  { corpsName: 'Troopers', sourceYear: '2024', resultDays: [] }, // no results anywhere
  { corpsName: 'Live Corps', sourceYear: '2025' }, // no resultDays field (live-season shape)
];

// A running order (only corps present matter; day 12 is this show's offSeasonDay).
const show = {
  day: 12,
  lineup: [
    { order: 1, corps: 'Blue Devils' },
    { order: 2, corps: 'Carolina Crown' },
    { order: 3, corps: 'Troopers' },
    { order: 4, corps: 'Live Corps' },
    { order: 5, corps: 'Someone Else' },
  ],
};

describe('parsePick', () => {
  test('splits CorpsName|Year', () => {
    expect(parsePick('Blue Devils|2009')).toEqual({ corpsName: 'Blue Devils', sourceYear: '2009' });
    expect(parsePick('')).toEqual({ corpsName: '', sourceYear: null });
  });
});

describe('buildShowHighlights', () => {
  test('full when the pick had a real result on this day', () => {
    const map = buildShowHighlights({ show, lineup: { GE1: 'Blue Devils|2009' }, poolCorps: pool });
    expect(map.get('blue devils').tier).toBe('full'); // 12 is in [10,12,14]
  });

  test('dim when the brand is present but no real result this day', () => {
    // Crown 2012 competed days 11 & 13, not 12 -> interpolated today.
    const map = buildShowHighlights({
      show,
      lineup: { GE2: 'Carolina Crown|2012' },
      poolCorps: pool,
    });
    expect(map.get('carolina crown').tier).toBe('dim');
    // Troopers has an empty resultDays -> also dim on any day.
    const map2 = buildShowHighlights({ show, lineup: { VP: 'Troopers|2024' }, poolCorps: pool });
    expect(map2.get('troopers').tier).toBe('dim');
  });

  test('degrades to full when resultDays is unavailable (live season)', () => {
    const map = buildShowHighlights({ show, lineup: { B: 'Live Corps|2025' }, poolCorps: pool });
    expect(map.get('live corps').tier).toBe('full');
  });

  test('merges multiple captions for one corps and upgrades to full', () => {
    // Same brand, two years: one full (2009, day 12), one dim (a year w/o day 12).
    const poolTwo = [
      { corpsName: 'Blue Devils', sourceYear: '2009', resultDays: [12] },
      { corpsName: 'Blue Devils', sourceYear: '2019', resultDays: [5] },
    ];
    const map = buildShowHighlights({
      show,
      lineup: { GE1: 'Blue Devils|2019', GE2: 'Blue Devils|2009' },
      poolCorps: poolTwo,
    });
    const entry = map.get('blue devils');
    expect(entry.tier).toBe('full'); // any real-result pick upgrades the brand
    expect(entry.captions.length).toBe(2);
  });

  test('ignores empty picks', () => {
    const map = buildShowHighlights({ show, lineup: { GE1: '', GE2: null }, poolCorps: pool });
    expect(map.size).toBe(0);
  });
});

describe('highlightLabel', () => {
  test('names the captions, corps, and year; flags interpolation for dim', () => {
    expect(
      highlightLabel({
        corps: 'Blue Devils',
        sourceYear: '2009',
        tier: 'full',
        captions: ['General Effect 1'],
      })
    ).toBe('Your General Effect 1 — Blue Devils (2009)');
    expect(
      highlightLabel({
        corps: 'Carolina Crown',
        sourceYear: '2012',
        tier: 'dim',
        captions: ['Brass'],
      })
    ).toContain('interpolated form today');
  });
});
