import { describe, expect, it } from 'vitest';

import {
  computeAllTimeTable,
  computeLeagueCareers,
  computeMemberCareer,
  formatRecord,
} from './leagueCareer';
import type { RecordWeekDoc } from './leagueRecords';

const CLASSES = ['worldClass', 'soundSport'];

const decided = (p1: string, p2: string, s1: number, s2: number) => ({
  pair: [p1, p2] as [string, string],
  scores: { [p1]: s1, [p2]: s2 },
  winner: s1 === s2 ? 'tie' : s1 > s2 ? p1 : p2,
  completed: true,
});

const bye = (uid: string) => ({
  pair: [uid, null] as [string, null],
  winner: uid,
  completed: true,
  isBye: true,
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

const archived = (seasonUid: string, n: number, worldClass: unknown[]): RecordWeekDoc => ({
  id: `${seasonUid}_week-${n}`,
  worldClassMatchups: worldClass,
});

describe('computeLeagueCareers', () => {
  it('is empty for a league with nothing resolved', () => {
    expect(computeLeagueCareers([week(1, [{ pair: ['a', 'b'] }])], CLASSES).size).toBe(0);
  });

  it('tallies a record and the points on both sides of it', () => {
    const careers = computeLeagueCareers(
      [week(1, [decided('a', 'b', 90, 80)]), week(2, [decided('a', 'b', 70, 85)])],
      CLASSES
    );

    const a = careers.get('a')!;
    expect(a.wins).toBe(1);
    expect(a.losses).toBe(1);
    expect(a.pointsFor).toBe(160);
    expect(a.pointsAgainst).toBe(165);
    expect(a.winPercentage).toBe(0.5);
  });

  // A bye is a non-game, the same convention the server standings use
  // (functions/src/helpers/leagueStandings.js): recorded, never a win.
  it('records a bye without counting it as a win, the way the standings do', () => {
    const careers = computeLeagueCareers([week(1, [bye('a')])], CLASSES);
    const a = careers.get('a')!;
    expect(a.wins).toBe(0);
    expect(a.byes).toBe(1);
    expect(a.losses).toBe(0);
    // A bye has no opponent, so it sets no head-to-head.
    expect(a.opponents).toEqual([]);
  });

  it('counts a tie as half a win, matching the standings comparator', () => {
    const careers = computeLeagueCareers([week(1, [decided('a', 'b', 85, 85)])], CLASSES);
    expect(careers.get('a')!.ties).toBe(1);
    expect(careers.get('a')!.winPercentage).toBe(0.5);
  });

  it('splits a career by season across the rollover', () => {
    const careers = computeLeagueCareers(
      [
        archived('season-1', 1, [decided('a', 'b', 90, 80)]),
        archived('season-1', 2, [decided('a', 'b', 90, 80)]),
        week(1, [decided('a', 'b', 70, 90)]),
      ],
      CLASSES
    );

    const a = careers.get('a')!;
    expect(a.seasonsPlayed).toBe(2);
    // Oldest first, live season last — it is the one still happening.
    expect(a.seasons.map((s) => s.seasonUid)).toEqual(['season-1', null]);
    expect(a.seasons[0]).toMatchObject({ wins: 2, losses: 0 });
    expect(a.seasons[1]).toMatchObject({ wins: 0, losses: 1 });
  });

  it('does not merge the same week number from two seasons', () => {
    const careers = computeLeagueCareers(
      [archived('season-1', 3, [decided('a', 'b', 90, 80)]), week(3, [decided('a', 'b', 90, 80)])],
      CLASSES
    );
    expect(careers.get('a')!.wins).toBe(2);
  });

  it('remembers the best single week', () => {
    const careers = computeLeagueCareers(
      [week(1, [decided('a', 'b', 91.5, 80)]), week(2, [decided('a', 'b', 88, 80)])],
      CLASSES
    );
    expect(careers.get('a')!.bestWeek).toMatchObject({ score: 91.5, week: 1, seasonUid: null });
  });

  it('scans every corps class, not just the first', () => {
    const careers = computeLeagueCareers(
      [week(1, [decided('a', 'b', 90, 80)], [decided('a', 'c', 40, 60)])],
      CLASSES
    );
    const a = careers.get('a')!;
    expect(a.wins).toBe(1);
    expect(a.losses).toBe(1);
    expect(a.opponents.map((o) => o.opponentUid).sort()).toEqual(['b', 'c']);
  });
});

describe('head-to-head', () => {
  it('records both sides of every meeting', () => {
    const careers = computeLeagueCareers(
      [
        week(1, [decided('a', 'b', 90, 80)]),
        week(2, [decided('a', 'b', 70, 85)]),
        week(3, [decided('a', 'b', 88, 88)]),
      ],
      CLASSES
    );

    expect(careers.get('a')!.opponents[0]).toMatchObject({
      opponentUid: 'b',
      wins: 1,
      losses: 1,
      ties: 1,
      meetings: 3,
      lastMetWeek: 3,
    });
    // The mirror image, from b's side.
    expect(careers.get('b')!.opponents[0]).toMatchObject({
      opponentUid: 'a',
      wins: 1,
      losses: 1,
      ties: 1,
    });
  });

  it('puts the opponent you keep drawing first', () => {
    const careers = computeLeagueCareers(
      [
        week(1, [decided('a', 'rival', 90, 80)]),
        week(2, [decided('a', 'rival', 90, 80)]),
        week(3, [decided('a', 'stranger', 90, 80)]),
      ],
      CLASSES
    );

    expect(careers.get('a')!.opponents.map((o) => o.opponentUid)).toEqual(['rival', 'stranger']);
  });

  // flattenResolved orders by season then week, so the most recent meeting is
  // the last one written — even when the input arrives out of order.
  it('tracks the most recent meeting across the rollover', () => {
    const careers = computeLeagueCareers(
      [week(1, [decided('a', 'b', 90, 80)]), archived('season-1', 7, [decided('a', 'b', 90, 80)])],
      CLASSES
    );

    expect(careers.get('a')!.opponents[0]).toMatchObject({
      lastMetWeek: 1,
      lastMetSeasonUid: null,
    });
  });
});

describe('titles', () => {
  const champions = [
    { seasonId: 'season-1', winnerId: 'a' },
    { seasonId: 'season-2', winnerId: 'a' },
    { seasonId: 'season-3', winnerId: 'b' },
  ];

  it('counts titles from the league record, not from the matchups', () => {
    const careers = computeLeagueCareers(
      [archived('season-1', 1, [decided('a', 'b', 90, 80)])],
      CLASSES,
      champions
    );

    expect(careers.get('a')!.titles).toBe(2);
    expect(careers.get('b')!.titles).toBe(1);
  });

  it('attributes a title to its season when that season has rows', () => {
    const careers = computeLeagueCareers(
      [archived('season-1', 1, [decided('a', 'b', 90, 80)])],
      CLASSES,
      champions
    );

    expect(careers.get('a')!.seasons[0]).toMatchObject({ seasonUid: 'season-1', titles: 1 });
  });

  // A champion of a season whose matchup weeks were never written still has the
  // title; they just have no season row to hang it on.
  it('keeps a title whose season left no matchups behind', () => {
    const careers = computeLeagueCareers([], CLASSES, champions);
    expect(careers.get('a')!.titles).toBe(2);
    expect(careers.get('a')!.seasons).toEqual([]);
  });
});

describe('computeMemberCareer', () => {
  it('returns an empty career for a member who has never played', () => {
    const career = computeMemberCareer([week(1, [decided('a', 'b', 90, 80)])], CLASSES, 'newcomer');
    expect(career).toMatchObject({ uid: 'newcomer', wins: 0, losses: 0, seasonsPlayed: 0 });
  });
});

describe('computeAllTimeTable', () => {
  const weeks = [
    archived('season-1', 1, [decided('champ', 'grinder', 90, 80)]),
    archived('season-1', 2, [decided('champ', 'grinder', 90, 80)]),
    week(1, [decided('grinder', 'champ', 95, 80)]),
    week(2, [decided('grinder', 'champ', 95, 80)]),
    week(3, [decided('grinder', 'champ', 95, 80)]),
  ];

  it('puts titles first — that is what a league argues about', () => {
    const table = computeAllTimeTable(weeks, CLASSES, [
      { seasonId: 'season-1', winnerId: 'champ' },
    ]);

    // grinder has the better record (3-2 against champ's 2-3) and still ranks
    // second, because champ has the only title.
    expect(table.map((r) => r.uid)).toEqual(['champ', 'grinder']);
    expect(table[0]).toMatchObject({ displayRank: 1, titles: 1 });
  });

  it('separates the untitled on how they played', () => {
    const table = computeAllTimeTable(weeks, CLASSES, []);
    expect(table[0].uid).toBe('grinder');
    expect(table[0].winPercentage).toBeCloseTo(0.6);
  });

  it('limits rows to the roster when one is given', () => {
    const table = computeAllTimeTable(weeks, CLASSES, [], ['grinder']);
    expect(table.map((r) => r.uid)).toEqual(['grinder']);
    expect(table[0].displayRank).toBe(1);
  });

  it('shows everyone who ever played when no roster is given', () => {
    expect(computeAllTimeTable(weeks, CLASSES, []).length).toBe(2);
  });

  it('is empty for a league with no history', () => {
    expect(computeAllTimeTable([], CLASSES, [])).toEqual([]);
  });
});

describe('formatRecord', () => {
  it('drops a tie count of zero rather than printing it', () => {
    expect(formatRecord({ wins: 12, losses: 4, ties: 0 })).toBe('12-4');
    expect(formatRecord({ wins: 12, losses: 4, ties: 1 })).toBe('12-4-1');
  });
});
