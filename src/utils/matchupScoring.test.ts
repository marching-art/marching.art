// Tests for matchup scoring utilities — the pure, deterministic battle/matchup
// resolution logic that decides who wins head-to-head league matchups.
import { describe, it, expect } from 'vitest';
import type { CaptionScores, WeeklyUserPerformance, MatchupBattleBreakdown } from '../types';
import {
  CAPTIONS,
  MAX_BATTLE_POINTS,
  BATTLE_THRESHOLDS,
  BATTLE_POINTS,
  calculateCaptionBattles,
  countCaptionWins,
  calculateTotalScoreBattle,
  calculateHighSingleBattle,
  calculateMomentumBattle,
  calculateMatchupBattles,
  calculateSeasonStats,
  calculateHeadToHead,
  calculateWinProbability,
  formatBattleScore,
  getMatchupDescription,
  aggregateCaptionScores,
  createWeeklyPerformance,
} from './matchupScoring';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a CaptionScores object with the same value for every caption. */
function allCaptions(value: number): CaptionScores {
  const c: CaptionScores = {};
  for (const cap of CAPTIONS) c[cap] = value;
  return c;
}

/** Build a WeeklyUserPerformance with sensible defaults. */
function perf(over: Partial<WeeklyUserPerformance> = {}): WeeklyUserPerformance {
  return {
    userId: 'home',
    week: 1,
    totalScore: 0,
    showCount: 1,
    captions: {},
    shows: [],
    highSingleScore: 0,
    ...over,
  };
}

/** A performance that dominates every dimension. */
const dominantPerf = perf({
  captions: allCaptions(10),
  totalScore: 100,
  highSingleScore: 50,
  scoreDelta: 5,
});

/** A performance that loses every dimension. */
const weakPerf = perf({
  captions: allCaptions(1),
  totalScore: 10,
  highSingleScore: 5,
  scoreDelta: 0,
});

function build(
  week: number,
  homeId: string,
  awayId: string,
  home: WeeklyUserPerformance,
  away: WeeklyUserPerformance
): MatchupBattleBreakdown {
  return calculateMatchupBattles(`m${week}`, week, homeId, awayId, home, away);
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('constants', () => {
  it('has the 8 game captions', () => {
    expect(CAPTIONS).toHaveLength(8);
    expect(CAPTIONS).toEqual(['GE1', 'GE2', 'VP', 'VA', 'CG', 'B', 'MA', 'P']);
  });

  it('MAX_BATTLE_POINTS is 8 captions + total + highSingle + momentum = 11', () => {
    expect(MAX_BATTLE_POINTS).toBe(11);
  });

  it('exposes clutch/blowout thresholds', () => {
    expect(BATTLE_THRESHOLDS.clutchMargin).toBe(2);
    expect(BATTLE_THRESHOLDS.blowoutMargin).toBe(5);
    expect(BATTLE_POINTS.caption).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Caption battles
// ---------------------------------------------------------------------------

describe('calculateCaptionBattles', () => {
  it('assigns each caption to the higher scorer', () => {
    const home: CaptionScores = { ...allCaptions(5), GE1: 10 }; // home wins GE1
    const away: CaptionScores = { ...allCaptions(5), GE2: 10 }; // away wins GE2
    const battles = calculateCaptionBattles('H', 'A', home, away);

    expect(battles).toHaveLength(8);
    const ge1 = battles.find((b) => b.caption === 'GE1')!;
    const ge2 = battles.find((b) => b.caption === 'GE2')!;
    const vp = battles.find((b) => b.caption === 'VP')!;

    expect(ge1.winnerId).toBe('H');
    expect(ge1.differential).toBe(5);
    expect(ge2.winnerId).toBe('A');
    expect(ge2.differential).toBe(-5);
    expect(vp.winnerId).toBeNull(); // tie
    expect(vp.differential).toBe(0);
  });

  it('treats a missing caption as zero', () => {
    const home: CaptionScores = { GE1: 5 };
    const away: CaptionScores = {}; // no GE1 -> 0
    const battles = calculateCaptionBattles('H', 'A', home, away);
    const ge1 = battles.find((b) => b.caption === 'GE1')!;
    expect(ge1.homeScore).toBe(5);
    expect(ge1.awayScore).toBe(0);
    expect(ge1.winnerId).toBe('H');
  });
});

describe('countCaptionWins', () => {
  it('counts wins per side and ignores ties', () => {
    const home: CaptionScores = { ...allCaptions(5), GE1: 10, GE2: 10 }; // home wins 2
    const away: CaptionScores = { ...allCaptions(5), VP: 10 }; // away wins 1
    const battles = calculateCaptionBattles('H', 'A', home, away);
    expect(countCaptionWins(battles)).toEqual({ home: 2, away: 1 });
  });
});

// ---------------------------------------------------------------------------
// Individual battles
// ---------------------------------------------------------------------------

describe('individual battles', () => {
  it('total score battle awards the higher weekly total', () => {
    const r = calculateTotalScoreBattle('H', 'A', perf({ totalScore: 100 }), perf({ totalScore: 90 }));
    expect(r.winnerId).toBe('H');
    expect(r.differential).toBe(10);
    expect(r.pointsAwarded).toBe(1);
    expect(r.type).toBe('total');
  });

  it('high single battle awards the better single show', () => {
    const r = calculateHighSingleBattle('H', 'A', perf({ highSingleScore: 40 }), perf({ highSingleScore: 55 }));
    expect(r.winnerId).toBe('A');
  });

  it('momentum battle uses scoreDelta and treats undefined as zero', () => {
    const bothUndefined = calculateMomentumBattle('H', 'A', perf(), perf());
    expect(bothUndefined.winnerId).toBeNull(); // 0 vs 0

    const r = calculateMomentumBattle('H', 'A', perf({ scoreDelta: 5 }), perf({ scoreDelta: -3 }));
    expect(r.winnerId).toBe('H');
    expect(r.differential).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// Full matchup
// ---------------------------------------------------------------------------

describe('calculateMatchupBattles', () => {
  it('resolves a clutch win (margin <= 2)', () => {
    const home = perf({
      captions: { ...allCaptions(5), GE1: 10 }, // home wins GE1
      totalScore: 100,
      highSingleScore: 50,
      scoreDelta: 5,
    });
    const away = perf({
      captions: { ...allCaptions(5), GE2: 10 }, // away wins GE2
      totalScore: 90,
      highSingleScore: 50, // tie -> no highSingle point
      scoreDelta: 3,
    });
    const r = build(1, 'H', 'A', home, away);

    // home: 1 caption + total + momentum = 3; away: 1 caption = 1
    expect(r.homeBattlePoints).toBe(3);
    expect(r.awayBattlePoints).toBe(1);
    expect(r.captionBattlesWon).toEqual({ home: 1, away: 1 });
    expect(r.winnerId).toBe('H');
    expect(r.isTie).toBe(false);
    expect(r.margin).toBe(2);
    expect(r.isClutch).toBe(true);
    expect(r.isBlowout).toBe(false);
    expect(r.allBattles).toHaveLength(11); // 8 captions + 3 individual battles
  });

  it('resolves a blowout (margin >= 5)', () => {
    const r = build(1, 'H', 'A', dominantPerf, weakPerf);
    expect(r.homeBattlePoints).toBe(MAX_BATTLE_POINTS);
    expect(r.awayBattlePoints).toBe(0);
    expect(r.winnerId).toBe('H');
    expect(r.isBlowout).toBe(true);
    expect(r.margin).toBe(11);
  });

  it('resolves a tie when every dimension is equal', () => {
    const same = perf({ captions: allCaptions(5), totalScore: 50, highSingleScore: 25, scoreDelta: 0 });
    const r = build(1, 'H', 'A', same, { ...same });
    expect(r.homeBattlePoints).toBe(0);
    expect(r.awayBattlePoints).toBe(0);
    expect(r.winnerId).toBeNull();
    expect(r.isTie).toBe(true);
    expect(r.isClutch).toBe(false);
    expect(r.isBlowout).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Season stats
// ---------------------------------------------------------------------------

describe('calculateSeasonStats', () => {
  it('returns zeroed stats for an empty season', () => {
    const s = calculateSeasonStats('A', 'season-1', []);
    expect(s.wins).toBe(0);
    expect(s.losses).toBe(0);
    expect(s.ties).toBe(0);
    expect(s.winPercentage).toBe(0);
    expect(s.currentStreak).toBe(0);
    expect(s.currentStreakType).toBeNull();
  });

  it('tallies W/L, streaks and win percentage in order', () => {
    const breakdowns = [
      build(1, 'A', 'B', dominantPerf, weakPerf), // A win
      build(2, 'A', 'C', dominantPerf, weakPerf), // A win (streak 2)
      build(3, 'A', 'D', weakPerf, dominantPerf), // A loss
    ];
    const s = calculateSeasonStats('A', 'season-1', breakdowns);

    expect(s.wins).toBe(2);
    expect(s.losses).toBe(1);
    expect(s.ties).toBe(0);
    expect(s.winPercentage).toBeCloseTo(2 / 3, 5);
    expect(s.longestWinStreak).toBe(2);
    expect(s.longestLossStreak).toBe(1);
    expect(s.currentStreak).toBe(1);
    expect(s.currentStreakType).toBe('L');
    expect(s.blowoutWins).toBe(2);
    expect(s.totalBattlePointsFor).toBe(22); // 11 + 11 + 0
    expect(s.bestWeek.battlePoints).toBe(11);
  });

  it('counts a comeback win (lost the caption battles, won the matchup)', () => {
    // home wins only 3 captions but sweeps total/high/momentum -> wins 6-5.
    const home = perf({
      captions: { GE1: 10, GE2: 10, VP: 10, VA: 1, CG: 1, B: 1, MA: 1, P: 1 },
      totalScore: 100,
      highSingleScore: 50,
      scoreDelta: 5,
    });
    const away = perf({
      captions: { GE1: 1, GE2: 1, VP: 1, VA: 10, CG: 10, B: 10, MA: 10, P: 10 },
      totalScore: 10,
      highSingleScore: 5,
      scoreDelta: 0,
    });
    const breakdown = build(1, 'H', 'A', home, away);
    expect(breakdown.winnerId).toBe('H');
    expect(breakdown.captionBattlesWon).toEqual({ home: 3, away: 5 });

    const s = calculateSeasonStats('H', 'season-1', [breakdown]);
    expect(s.wins).toBe(1);
    expect(s.comebackWins).toBe(1);
    expect(s.clutchWins).toBe(1); // margin of 1
  });
});

// ---------------------------------------------------------------------------
// Head-to-head
// ---------------------------------------------------------------------------

describe('calculateHeadToHead', () => {
  it('returns an empty shell when the two never played', () => {
    const h = calculateHeadToHead('X', 'Y', []);
    expect(h.totalMatchups).toBe(0);
    expect(h.user1Wins).toBe(0);
    expect(h.user2Wins).toBe(0);
    expect(h.currentStreak).toBeNull();
    // caption domination initialized with no dominant user
    expect(h.captionDomination.GE1.dominantUserId).toBeNull();
  });

  it('filters to the pair and aggregates the rivalry', () => {
    const breakdowns = [
      build(1, 'X', 'Y', dominantPerf, weakPerf), // X win
      build(2, 'Y', 'X', dominantPerf, weakPerf), // Y win (Y is home)
      build(3, 'X', 'Y', dominantPerf, weakPerf), // X win
      build(4, 'X', 'Z', dominantPerf, weakPerf), // unrelated -> filtered out
    ];
    const h = calculateHeadToHead('X', 'Y', breakdowns);

    expect(h.totalMatchups).toBe(3);
    expect(h.user1Wins).toBe(2); // X
    expect(h.user2Wins).toBe(1); // Y
    expect(h.matchupHistory).toHaveLength(3);
    expect(h.matchupHistory[0].week).toBe(1); // sorted by week
    // X won GE1 twice, Y once -> X dominates the caption
    expect(h.captionDomination.GE1.dominantUserId).toBe('X');
    // most recent result (week 3) was an X win, immediately after a Y win
    expect(h.currentStreak).toEqual({ userId: 'X', count: 1 });
  });
});

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

describe('calculateWinProbability', () => {
  it('returns 0.5 with no data', () => {
    const base = calculateSeasonStats('A', 's', []);
    expect(calculateWinProbability(base, base)).toBe(0.5);
  });

  it('favors the stronger team and is symmetric', () => {
    const base = calculateSeasonStats('A', 's', []);
    const strong = { ...base, avgBattlePointsFor: 8, avgBattlePointsAgainst: 3 };
    const weak = { ...base, avgBattlePointsFor: 4, avgBattlePointsAgainst: 6 };

    const pStrong = calculateWinProbability(strong, weak);
    const pWeak = calculateWinProbability(weak, strong);

    expect(pStrong).toBeGreaterThan(0.5);
    expect(pWeak).toBeLessThan(0.5);
    expect(pStrong + pWeak).toBeCloseTo(1, 5);
  });

  it('returns 0.5 for evenly matched non-zero teams', () => {
    const base = calculateSeasonStats('A', 's', []);
    const even = { ...base, avgBattlePointsFor: 5, avgBattlePointsAgainst: 4 };
    expect(calculateWinProbability(even, { ...even })).toBeCloseTo(0.5, 5);
  });
});

describe('formatBattleScore & getMatchupDescription', () => {
  it('formats the score', () => {
    expect(formatBattleScore(7, 4)).toBe('7-4');
  });

  it('describes tie / blowout / clutch / win', () => {
    const same = perf({ captions: allCaptions(5), totalScore: 50, highSingleScore: 25 });
    expect(getMatchupDescription(build(1, 'H', 'A', same, { ...same }))).toBe('Tied');
    expect(getMatchupDescription(build(1, 'H', 'A', dominantPerf, weakPerf))).toBe('Blowout');

    // plain win: sweeps only total/high/momentum (margin 3), captions all tied
    const home = perf({ captions: allCaptions(5), totalScore: 100, highSingleScore: 50, scoreDelta: 5 });
    const away = perf({ captions: allCaptions(5), totalScore: 90, highSingleScore: 40, scoreDelta: 0 });
    const winBreakdown = build(1, 'H', 'A', home, away);
    expect(winBreakdown.margin).toBe(3);
    expect(getMatchupDescription(winBreakdown)).toBe('Win');
  });
});

describe('aggregateCaptionScores', () => {
  it('sums caption scores across shows and skips shows without captions', () => {
    const totals = aggregateCaptionScores([
      { captions: { GE1: 10, GE2: 5 } },
      { captions: { GE1: 5 } },
      {}, // no captions -> skipped
    ]);
    expect(totals.GE1).toBe(15);
    expect(totals.GE2).toBe(5);
    expect(totals.VP).toBeUndefined();
  });
});

describe('createWeeklyPerformance', () => {
  it('aggregates totals, high single and week-over-week delta', () => {
    const wp = createWeeklyPerformance(
      'A',
      2,
      [
        { showId: 's1', showName: 'Show 1', score: 80, captions: { GE1: 10 } },
        { showId: 's2', showName: 'Show 2', score: 90, captions: { GE1: 5 } },
      ],
      150
    );

    expect(wp.totalScore).toBe(170);
    expect(wp.showCount).toBe(2);
    expect(wp.highSingleScore).toBe(90);
    expect(wp.highSingleShowId).toBe('s2');
    expect(wp.captions.GE1).toBe(15);
    expect(wp.scoreDelta).toBe(20);
  });

  it('leaves scoreDelta undefined without a previous week', () => {
    const wp = createWeeklyPerformance('A', 1, [
      { showId: 's1', showName: 'Show 1', score: 80 },
    ]);
    expect(wp.scoreDelta).toBeUndefined();
  });
});
