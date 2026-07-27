import { describe, expect, it } from 'vitest';

import { computeLeagueRecords, type RecordWeekDoc } from './leagueRecords';

const CLASSES = ['worldClass', 'soundSport'];

const decided = (
  p1: string,
  p2: string,
  s1: number,
  s2: number,
  normalized?: Record<string, number>
) => ({
  pair: [p1, p2] as [string, string],
  scores: { [p1]: s1, [p2]: s2 },
  normalized,
  winner: s1 === s2 ? 'tie' : s1 > s2 ? p1 : p2,
  completed: true,
});

const week = (
  n: number,
  worldClass: unknown[] = [],
  soundSport: unknown[] = []
): RecordWeekDoc => ({
  id: `week-${n}`,
  worldClassMatchups: worldClass,
  soundSportMatchups: soundSport,
});

describe('computeLeagueRecords', () => {
  it('returns an empty book for a league with nothing resolved', () => {
    const records = computeLeagueRecords([week(1, [{ pair: ['a', 'b'] }])], CLASSES);
    expect(records.weeksCounted).toBe(0);
    expect(records.highestWeek).toBeNull();
    expect(records.biggestBlowout).toBeNull();
  });

  it('finds the highest single week across every class', () => {
    const records = computeLeagueRecords(
      [week(1, [decided('a', 'b', 91.2, 88.4)], [decided('c', 'd', 64, 60)])],
      CLASSES
    );
    expect(records.highestWeek).toMatchObject({ uid: 'a', score: 91.2, week: 1 });
  });

  it('separates the biggest blowout from the closest call', () => {
    const records = computeLeagueRecords(
      [week(1, [decided('a', 'b', 95, 60)]), week(2, [decided('a', 'b', 90.2, 90.1)])],
      CLASSES
    );

    expect(records.biggestBlowout).toMatchObject({ winnerUid: 'a', week: 1 });
    expect(records.biggestBlowout!.margin).toBeCloseTo(35);
    expect(records.closestCall).toMatchObject({ week: 2 });
    expect(records.closestCall!.margin).toBeCloseTo(0.1);
  });

  // A matchup where nobody competed is a 0-0 that would otherwise masquerade
  // as the closest game ever played, and a forfeit is not a close game either.
  it('excludes uncontested matchups from the closest call', () => {
    const records = computeLeagueRecords(
      [week(1, [decided('a', 'b', 0, 0)]), week(2, [decided('c', 'd', 88, 0)])],
      CLASSES
    );

    expect(records.closestCall).toBeNull();
    // The forfeit is still a real result, so it stays eligible as a blowout.
    expect(records.biggestBlowout).toMatchObject({ winnerUid: 'c', margin: 88 });
  });

  it('tracks the longest run of consecutive wins', () => {
    const records = computeLeagueRecords(
      [
        week(1, [decided('a', 'b', 90, 80)]),
        week(2, [decided('a', 'b', 91, 80)]),
        week(3, [decided('a', 'b', 92, 80)]),
        week(4, [decided('a', 'b', 70, 80)]),
      ],
      CLASSES
    );

    expect(records.longestWinStreak).toMatchObject({ uid: 'a', length: 3, endedWeek: 3 });
  });

  it('a tie breaks a streak rather than extending it', () => {
    const records = computeLeagueRecords(
      [
        week(1, [decided('a', 'b', 90, 80)]),
        week(2, [decided('a', 'b', 85, 85)]),
        week(3, [decided('a', 'b', 90, 80)]),
      ],
      CLASSES
    );
    expect(records.longestWinStreak).toBeNull();
  });

  // A bye is not a performance, and letting a free win extend a streak is the
  // same unfairness the bye rotation exists to avoid.
  it('ignores byes entirely', () => {
    const records = computeLeagueRecords(
      [week(1, [{ pair: ['a', null], winner: 'a', completed: true, isBye: true }])],
      CLASSES
    );
    expect(records.weeksCounted).toBe(0);
    expect(records.longestWinStreak).toBeNull();
  });

  it('reports the best week measured against the director’s own class', () => {
    const records = computeLeagueRecords(
      [
        // Big raw score, middling against a strong World Class field.
        week(
          1,
          [decided('worldPro', 'worldFoe', 92, 88, { worldPro: 55, worldFoe: 20 })],
          // Small raw score, but the best in its own class that week.
          [decided('soundStar', 'soundFoe', 61, 55, { soundStar: 100, soundFoe: 15 })]
        ),
      ],
      CLASSES
    );

    expect(records.highestWeek!.uid).toBe('worldPro');
    expect(records.bestClassFinish).toMatchObject({ uid: 'soundStar', percentile: 100 });
  });

  it('ignores documents that are not week-N', () => {
    const records = computeLeagueRecords(
      [{ id: 'summary', worldClassMatchups: [decided('a', 'b', 90, 80)] }],
      CLASSES
    );
    expect(records.weeksCounted).toBe(0);
  });
});

// Rollover MOVES finished weeks to `{seasonUid}_week-N` so the live collection
// only ever holds the current season — leaving them in place made the generator
// skip every week of the next season. Both forms are real history.
describe('records across seasons', () => {
  const archived = (seasonUid: string, n: number, worldClass: unknown[]): RecordWeekDoc => ({
    id: `${seasonUid}_week-${n}`,
    worldClassMatchups: worldClass,
  });

  it('counts archived weeks alongside the live season', () => {
    const records = computeLeagueRecords(
      [archived('season-1', 7, [decided('a', 'b', 97, 60)]), week(1, [decided('a', 'b', 88, 80)])],
      CLASSES
    );

    expect(records.seasonsCounted).toBe(2);
    expect(records.weeksCounted).toBe(2);
    // The all-time high came from a finished season.
    expect(records.highestWeek).toMatchObject({ score: 97, seasonUid: 'season-1' });
  });

  it('does not merge the same week number from different seasons', () => {
    const records = computeLeagueRecords(
      [archived('season-1', 3, [decided('a', 'b', 90, 80)]), week(3, [decided('a', 'b', 91, 80)])],
      CLASSES
    );
    expect(records.weeksCounted).toBe(2);
  });

  it('walks a streak in the order it was played, across the rollover', () => {
    const records = computeLeagueRecords(
      [
        // Deliberately out of order in the input.
        week(1, [decided('a', 'b', 90, 80)]),
        archived('season-1', 6, [decided('a', 'b', 90, 80)]),
        archived('season-1', 7, [decided('a', 'b', 90, 80)]),
      ],
      CLASSES
    );

    // Three straight wins ending in the live season, not two runs of one.
    expect(records.longestWinStreak).toMatchObject({ uid: 'a', length: 3, seasonUid: null });
  });

  it('a live week marks its season as null, not as a uid', () => {
    const records = computeLeagueRecords([week(2, [decided('a', 'b', 90, 80)])], CLASSES);
    expect(records.highestWeek!.seasonUid).toBeNull();
    expect(records.seasonsCounted).toBe(1);
  });
});
