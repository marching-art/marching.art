import { describe, it, expect } from 'vitest';

import {
  buildMatchupsByWeek,
  buildWeeklyResults,
  computeLeagueTables,
  computeMemberStandings,
  generateRoundRobinMatchups,
  type LeagueMatchupDoc,
  type LeagueRecapDay,
  buildWeeklyClassResults,
} from './leagueStats';

// A recap day with a single show, which is all the league table reads.
const day = (offSeasonDay: number, results: Array<[string, number]>): LeagueRecapDay => ({
  offSeasonDay,
  shows: [{ results: results.map(([uid, totalScore]) => ({ uid, totalScore })) }],
});

// A `week-N` matchup document with one worldClass pairing per entry.
const weekDoc = (week: number, pairs: Array<[string, string]>): LeagueMatchupDoc => ({
  id: `week-${week}`,
  worldClassMatchups: pairs.map((pair) => ({ pair })),
});

describe('buildWeeklyResults', () => {
  it('buckets days into weeks by ceil(day / 7)', () => {
    const results = buildWeeklyResults(
      [day(1, [['a', 80]]), day(7, [['a', 82]]), day(8, [['a', 90]])],
      ['a']
    );

    // Days 1-7 are week 1; day 8 opens week 2.
    expect(results[1].a).toBe(162);
    expect(results[2].a).toBe(90);
  });

  it('sums every show a member competed in that week and ignores non-members', () => {
    const results = buildWeeklyResults(
      [
        {
          offSeasonDay: 2,
          shows: [
            {
              results: [
                { uid: 'a', totalScore: 10 },
                { uid: 'stranger', totalScore: 99 },
              ],
            },
            { results: [{ uid: 'a', totalScore: 5 }] },
          ],
        },
      ],
      ['a', 'b']
    );

    expect(results[1]).toEqual({ a: 15 });
  });

  it('treats a missing totalScore as zero and still creates the week bucket', () => {
    const results = buildWeeklyResults(
      [{ offSeasonDay: 3 }, day(3, [['a', undefined as never]])],
      ['a']
    );

    expect(results[1]).toEqual({ a: 0 });
  });
});

describe('generateRoundRobinMatchups', () => {
  it('pairs every member once per week', () => {
    const matchups = generateRoundRobinMatchups(['a', 'b', 'c', 'd'], 2);

    expect(matchups[1]).toHaveLength(2);
    expect(matchups[2]).toHaveLength(2);
    const week1 = matchups[1].flatMap((m) => [m.user1, m.user2]).sort();
    expect(week1).toEqual(['a', 'b', 'c', 'd']);
  });

  it('rotates the pairings between weeks', () => {
    const matchups = generateRoundRobinMatchups(['a', 'b', 'c', 'd'], 2);
    expect(matchups[1]).not.toEqual(matchups[2]);
  });

  it('produces empty weeks for a league too small to pair (inherited behaviour)', () => {
    // Math.floor(1 / 2) is 0, so the offset modulo is NaN and the loop never
    // runs. A one-member league gets weeks, just no games.
    expect(generateRoundRobinMatchups(['a'], 2)).toEqual({ 1: [], 2: [] });
  });
});

describe('buildMatchupsByWeek', () => {
  it('flattens per-class arrays into one list per week, tagged with the class', () => {
    const docs: LeagueMatchupDoc[] = [
      {
        id: 'week-1',
        worldClassMatchups: [{ pair: ['a', 'b'], winner: 'a', completed: true }],
        aClassMatchups: [{ pair: ['c', 'd'] }],
      },
    ];

    const byWeek = buildMatchupsByWeek(docs, ['a', 'b', 'c', 'd'], 1);

    expect(byWeek[1]).toEqual([
      {
        user1: 'a',
        user2: 'b',
        winner: 'a',
        completed: true,
        scores: undefined,
        corpsClass: 'worldClass',
      },
      {
        user1: 'c',
        user2: 'd',
        winner: undefined,
        completed: undefined,
        scores: undefined,
        corpsClass: 'aClass',
      },
    ]);
  });

  it('skips documents that are not week-N and pairs that are incomplete', () => {
    const docs: LeagueMatchupDoc[] = [
      { id: 'metadata', worldClassMatchups: [{ pair: ['a', 'b'] }] },
      { id: 'week-2', worldClassMatchups: [{ pair: ['a', ''] }, { pair: ['a', 'b'] }, {}] },
    ];

    const byWeek = buildMatchupsByWeek(docs, ['a', 'b'], 2);

    expect(Object.keys(byWeek)).toEqual(['2']);
    expect(byWeek[2]).toHaveLength(1);
  });

  it('falls back to client-side round robin only when no week documents exist', () => {
    const byWeek = buildMatchupsByWeek([{ id: 'metadata' }], ['a', 'b'], 3);

    expect(Object.keys(byWeek)).toEqual(['1', '2', '3']);
    expect(byWeek[1]).toEqual([{ user1: 'a', user2: 'b' }]);
  });

  it('does not fall back when a week document exists but is empty', () => {
    const byWeek = buildMatchupsByWeek([{ id: 'week-1' }], ['a', 'b'], 3);
    expect(byWeek).toEqual({ 1: [] });
  });
});

describe('computeMemberStandings', () => {
  const matchups = {
    1: [{ user1: 'a', user2: 'b' }],
    2: [{ user1: 'a', user2: 'b' }],
    3: [{ user1: 'a', user2: 'b' }],
  };

  it('records wins, losses and total points from head-to-head scores', () => {
    const standings = computeMemberStandings(
      ['a', 'b'],
      { 1: { a: 90, b: 80 }, 2: { a: 70, b: 85 } },
      matchups
    );

    const a = standings.find((s) => s.uid === 'a')!;
    const b = standings.find((s) => s.uid === 'b')!;
    expect([a.wins, a.losses, a.totalPoints]).toEqual([1, 1, 160]);
    expect([b.wins, b.losses, b.totalPoints]).toEqual([1, 1, 165]);
  });

  it('ranks by wins, breaking ties on total points', () => {
    const standings = computeMemberStandings(
      ['a', 'b'],
      { 1: { a: 90, b: 80 }, 2: { a: 70, b: 85 } },
      matchups
    );

    // Both 1-1, so the higher point total takes rank 1.
    expect(standings.map((s) => s.uid)).toEqual(['b', 'a']);
    expect(standings.map((s) => s.currentRank)).toEqual([1, 2]);
  });

  it('counts the current streak back from the most recent week', () => {
    const standings = computeMemberStandings(
      ['a', 'b'],
      { 1: { a: 50, b: 90 }, 2: { a: 90, b: 50 }, 3: { a: 95, b: 60 } },
      matchups
    );

    const a = standings.find((s) => s.uid === 'a')!;
    expect(a.streakType).toBe('W');
    expect(a.streak).toBe(2);
  });

  it('scores a drawn week as neither win nor loss, but breaks a win streak', () => {
    const standings = computeMemberStandings(
      ['a', 'b'],
      { 1: { a: 90, b: 50 }, 2: { a: 70, b: 70 } },
      matchups
    );

    const a = standings.find((s) => s.uid === 'a')!;
    expect([a.wins, a.losses]).toEqual([1, 0]);
    // The streak walk classifies "did not win" as L, so the latest week is an
    // L of length 1 rather than a continuing W streak.
    expect([a.streakType, a.streak]).toEqual(['L', 1]);
  });

  it('derives trend from the three most recent scored weeks', () => {
    const fourWeeks = { ...matchups, 4: [{ user1: 'a', user2: 'b' }] };
    const standings = computeMemberStandings(
      ['a', 'b'],
      {
        1: { a: 99, b: 10 }, // ancient win, outside the 3-week window
        2: { a: 10, b: 99 },
        3: { a: 10, b: 99 },
        4: { a: 10, b: 99 },
      },
      fourWeeks
    );

    expect(standings.find((s) => s.uid === 'a')!.trend).toBe('down');
    expect(standings.find((s) => s.uid === 'b')!.trend).toBe('up');
  });

  it('leaves a member with no results at zero and trend "same"', () => {
    const standings = computeMemberStandings(['a', 'b', 'c'], { 1: { a: 90, b: 80 } }, matchups);

    const c = standings.find((s) => s.uid === 'c')!;
    expect(c).toMatchObject({
      wins: 0,
      losses: 0,
      totalPoints: 0,
      streak: 0,
      streakType: null,
      trend: 'same',
      currentRank: 3,
    });
  });

  it('ignores scores from weeks the member has no pairing in', () => {
    const standings = computeMemberStandings(['a', 'b'], { 9: { a: 90, b: 80 } }, matchups);

    const a = standings.find((s) => s.uid === 'a')!;
    // Points still accrue, but with no pairing there is no W/L.
    expect(a.totalPoints).toBe(90);
    expect([a.wins, a.losses, a.streak]).toEqual([0, 0, 0]);
  });
});

describe('computeLeagueTables', () => {
  it('returns null when the season has no recaps yet', () => {
    expect(
      computeLeagueTables({
        recaps: [],
        matchupDocs: [weekDoc(1, [['a', 'b']])],
        members: ['a', 'b'],
        currentWeek: 1,
      })
    ).toBeNull();
  });

  it('composes weekly results, matchups and standings end to end', () => {
    const tables = computeLeagueTables({
      recaps: [
        day(1, [
          ['a', 90],
          ['b', 80],
        ]),
        day(8, [
          ['a', 70],
          ['b', 95],
        ]),
      ],
      matchupDocs: [weekDoc(1, [['a', 'b']]), weekDoc(2, [['a', 'b']])],
      members: ['a', 'b'],
      currentWeek: 2,
    })!;

    expect(tables.weeklyResults).toEqual({ 1: { a: 90, b: 80 }, 2: { a: 70, b: 95 } });
    expect(tables.weeklyMatchups[2]).toHaveLength(1);
    expect(tables.standings.map((s) => s.uid)).toEqual(['b', 'a']);
    expect(tables.standings[0]).toMatchObject({ wins: 1, losses: 1, currentRank: 1 });
  });
});

// A director can field more than one corps class, which means more than one
// matchup per week. Both of these used to be wrong: weekly scores were summed
// across every class and compared in a class-scoped matchup, and only the
// FIRST matchup a member appeared in was visible to streaks and trend.
describe('multi-class members', () => {
  const classDay = (
    offSeasonDay: number,
    results: Array<[string, string, number]>
  ): LeagueRecapDay => ({
    offSeasonDay,
    shows: [
      {
        results: results.map(([uid, corpsClass, totalScore]) => ({
          uid,
          corpsClass,
          totalScore,
        })),
      },
    ],
  });

  const classWeekDoc = (
    week: number,
    world: Array<[string, string]>,
    sound: Array<[string, string]>
  ) => ({
    id: `week-${week}`,
    worldClassMatchups: world.map((pair) => ({ pair })),
    soundSportMatchups: sound.map((pair) => ({ pair })),
  });

  it('scores each matchup in the class it was contested in', () => {
    const recaps = [
      classDay(1, [
        ['a', 'worldClass', 90],
        ['a', 'soundSport', 40],
        ['b', 'worldClass', 85],
        ['c', 'soundSport', 60],
      ]),
    ];
    const members = ['a', 'b', 'c'];
    const results = buildWeeklyResults(recaps, members);
    const classResults = buildWeeklyClassResults(recaps, members);
    const matchups = buildMatchupsByWeek([classWeekDoc(1, [['a', 'b']], [['a', 'c']])], members, 1);

    const standings = computeMemberStandings(members, results, matchups, classResults);
    const byUid = Object.fromEntries(standings.map((s) => [s.uid, s]));

    // a's combined week is 130. Compared as a total, a beats c's 60 in
    // SoundSport on the strength of a World Class score.
    expect(byUid.a.wins).toBe(1); // beat b 90-85 in World Class
    expect(byUid.a.losses).toBe(1); // lost to c 40-60 in SoundSport
    expect(byUid.c.wins).toBe(1);
    expect(byUid.b.losses).toBe(1);
  });

  it('counts both of a week’s matchups toward the streak', () => {
    const recaps = [
      classDay(1, [
        ['a', 'worldClass', 90],
        ['a', 'soundSport', 70],
        ['b', 'worldClass', 85],
        ['c', 'soundSport', 60],
      ]),
    ];
    const members = ['a', 'b', 'c'];
    const standings = computeMemberStandings(
      members,
      buildWeeklyResults(recaps, members),
      buildMatchupsByWeek([classWeekDoc(1, [['a', 'b']], [['a', 'c']])], members, 1),
      buildWeeklyClassResults(recaps, members)
    );

    const a = standings.find((s) => s.uid === 'a')!;
    expect(a.streakType).toBe('W');
    expect(a.streak).toBe(2);
  });

  it('treats sitting a class out as a zero, not as the combined total', () => {
    const recaps = [
      classDay(1, [
        ['a', 'worldClass', 95],
        ['b', 'soundSport', 30],
      ]),
    ];
    const members = ['a', 'b'];
    const standings = computeMemberStandings(
      members,
      buildWeeklyResults(recaps, members),
      buildMatchupsByWeek([classWeekDoc(1, [], [['a', 'b']])], members, 1),
      buildWeeklyClassResults(recaps, members)
    );

    // a never fielded a SoundSport corps, so b wins the SoundSport matchup 30-0
    // rather than losing to a's 95-point World Class run.
    const byUid = Object.fromEntries(standings.map((s) => [s.uid, s]));
    expect(byUid.b.wins).toBe(1);
    expect(byUid.a.losses).toBe(1);
  });
});

describe('cross-class matchups', () => {
  const crossDay = (day: number, rows: Array<[string, string, number]>) => ({
    offSeasonDay: day,
    shows: [
      {
        results: rows.map(([uid, corpsClass, totalScore]) => ({ uid, corpsClass, totalScore })),
      },
    ],
  });

  it('trusts the settled winner over the raw score comparison', () => {
    // a's World Class 85 loses to b's SoundSport 60 because the server decided
    // the week on class percentiles. The provisional table must agree with the
    // server, not re-litigate it from raw points.
    const recaps = [
      crossDay(1, [
        ['a', 'worldClass', 85],
        ['b', 'soundSport', 60],
      ]),
    ];
    const members = ['a', 'b'];
    const weekDoc = {
      id: 'week-1',
      worldClassMatchups: [
        {
          pair: ['a', 'b'] as [string, string],
          classes: { a: 'worldClass', b: 'soundSport' },
          crossClass: true,
          completed: true,
          winner: 'b',
          scores: { a: 85, b: 60 },
        },
      ],
    };
    const standings = computeMemberStandings(
      members,
      buildWeeklyResults(recaps, members),
      buildMatchupsByWeek([weekDoc], members, 1),
      buildWeeklyClassResults(recaps, members)
    );

    const byUid = Object.fromEntries(standings.map((s) => [s.uid, s]));
    expect(byUid.b.wins).toBe(1);
    expect(byUid.a.losses).toBe(1);
    expect(byUid.b.streakType).toBe('W');
  });

  it('scores each side of a cross-class matchup in its OWN class', () => {
    // a fields two classes; only the worldClass run belongs to this matchup.
    const recaps = [
      crossDay(1, [
        ['a', 'worldClass', 85],
        ['a', 'soundSport', 40],
        ['b', 'soundSport', 60],
      ]),
    ];
    const members = ['a', 'b'];
    const weekDoc = {
      id: 'week-1',
      worldClassMatchups: [
        {
          pair: ['a', 'b'] as [string, string],
          classes: { a: 'worldClass', b: 'soundSport' },
          crossClass: true,
          completed: true,
          winner: 'b',
          scores: { a: 85, b: 60 },
        },
      ],
    };
    const matchups = buildMatchupsByWeek([weekDoc], members, 1);
    expect(matchups[1][0].classes).toEqual({ a: 'worldClass', b: 'soundSport' });
    expect(matchups[1][0].crossClass).toBe(true);
  });
});
