import { describe, it, expect } from 'vitest';
import { foldMatchupRecaps, ordinal, resultCountsFor, type DayRecap } from './matchupDetailRecaps';

type Row = [uid: string, corpsClass: string, score: number];

/** One scored day: every row is a result at a single show on that day. */
const day = (offSeasonDay: number, rows: Row[]): DayRecap => ({
  offSeasonDay,
  shows: [
    {
      showId: `show-${offSeasonDay}`,
      eventName: `Show ${offSeasonDay}`,
      results: rows.map(([uid, corpsClass, score], i) => ({
        uid,
        corpsClass,
        totalScore: score,
        geScore: score * 0.4,
        visualScore: score * 0.3,
        musicScore: score * 0.3,
        placement: i + 1,
      })),
    },
  ],
});

describe('foldMatchupRecaps', () => {
  it('sums the matchup week per side and counts each show once', () => {
    const recaps = [
      day(8, [
        ['a', 'worldClass', 80],
        ['b', 'worldClass', 70],
      ]),
      day(9, [['a', 'worldClass', 82]]),
      // A different week: must not leak into the totals.
      day(3, [['a', 'worldClass', 99]]),
    ];
    const folded = foldMatchupRecaps(recaps, { user1: 'a', user2: 'b', week: 2 }, 'lg');
    expect(folded.scores).toEqual({ user1: 162, user2: 70 });
    expect(folded.showCounts).toEqual({ user1: 2, user2: 1 });
    expect(folded.breakdown.user1.shows).toHaveLength(2);
    expect(folded.breakdown.user1.geTotal).toBeCloseTo(162 * 0.4);
    expect(folded.battleBreakdown?.week).toBe(2);
    expect(folded.battleBreakdown?.matchupId).toBe('lg-w2');
  });

  it('scores each side of a cross-class matchup in its own class and skips the scoreboard', () => {
    const recaps = [
      day(1, [
        ['a', 'worldClass', 85],
        ['a', 'soundSport', 40],
        ['b', 'soundSport', 60],
      ]),
    ];
    const folded = foldMatchupRecaps(recaps, {
      user1: 'a',
      user2: 'b',
      week: 1,
      crossClass: true,
      classes: { a: 'worldClass', b: 'soundSport' },
    });
    expect(folded.scores).toEqual({ user1: 85, user2: 60 });
    expect(folded.showCounts).toEqual({ user1: 1, user2: 1 });
    expect(folded.battleBreakdown).toBeNull();
  });

  it('builds the head-to-head from the EARLIER weeks, one breakdown per week both scored', () => {
    const recaps = [
      day(1, [
        ['a', 'worldClass', 70],
        ['b', 'worldClass', 60],
      ]),
      day(8, [
        ['a', 'worldClass', 60],
        ['b', 'worldClass', 75],
      ]),
      // Week 3 is the matchup week itself — history stops before it.
      day(15, [
        ['a', 'worldClass', 90],
        ['b', 'worldClass', 50],
      ]),
    ];
    const folded = foldMatchupRecaps(recaps, { user1: 'a', user2: 'b', week: 3 });
    expect(folded.headToHead?.totalMatchups).toBe(2);
    expect(folded.headToHead?.user1Wins).toBe(1);
    expect(folded.headToHead?.user2Wins).toBe(1);
  });

  it('has no history and no scoreboard when nobody scored', () => {
    const folded = foldMatchupRecaps([day(1, [['c', 'worldClass', 50]])], {
      user1: 'a',
      user2: 'b',
      week: 1,
    });
    expect(folded.scores).toEqual({ user1: 0, user2: 0 });
    expect(folded.battleBreakdown).toBeNull();
    expect(folded.headToHead).toBeNull();
  });
});

describe('resultCountsFor', () => {
  it('only filters by class when the matchup pins one for that side', () => {
    const pinned = { user1: 'a', user2: 'b', classes: { a: 'worldClass' } };
    expect(resultCountsFor(pinned, { uid: 'a', corpsClass: 'worldClass' }, 'a')).toBe(true);
    expect(resultCountsFor(pinned, { uid: 'a', corpsClass: 'aClass' }, 'a')).toBe(false);
    expect(resultCountsFor(pinned, { uid: 'b', corpsClass: 'aClass' }, 'b')).toBe(true);
    expect(resultCountsFor(pinned, { uid: 'b' }, 'a')).toBe(false);
  });
});

describe('ordinal', () => {
  it('handles the teens and the 1/2/3 endings', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 100, 111].map(ordinal)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '11th',
      '12th',
      '13th',
      '21st',
      '22nd',
      '23rd',
      '100th',
      '111th',
    ]);
  });
});
