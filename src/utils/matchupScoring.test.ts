// Tests for matchup scoring utilities — the pure, deterministic battle/matchup
// resolution logic that decides who wins head-to-head league matchups.
import { describe, it, expect } from 'vitest';
import type { CaptionGroupScores, WeeklyUserPerformance, MatchupBattleBreakdown } from '../types';
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

/** Build a caption-group score object with the same value for every group. */
function allCaptions(value: number): CaptionGroupScores {
  const c: CaptionGroupScores = {};
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
  // Three, not eight. Nothing records eight numbers per show — the stats
  // pipeline used to manufacture them by splitting each group evenly, which
  // made GE1 and GE2 always agree and turned three battles into eight.
  it('battles the three caption groups the scorer persists', () => {
    expect(CAPTIONS).toEqual(['ge', 'visual', 'music']);
  });

  it('MAX_BATTLE_POINTS is 3 groups + total + highSingle + momentum = 6', () => {
    expect(MAX_BATTLE_POINTS).toBe(6);
  });

  it('exposes clutch/blowout thresholds, rescaled to the new maximum', () => {
    expect(BATTLE_THRESHOLDS.clutchMargin).toBe(1);
    expect(BATTLE_THRESHOLDS.blowoutMargin).toBe(4);
    expect(BATTLE_POINTS.caption).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Caption battles
// ---------------------------------------------------------------------------

describe('calculateCaptionBattles', () => {
  it('assigns each group to the higher scorer', () => {
    const home: CaptionGroupScores = { ...allCaptions(5), ge: 10 };
    const away: CaptionGroupScores = { ...allCaptions(5), visual: 10 };
    const battles = calculateCaptionBattles('H', 'A', home, away);

    expect(battles).toHaveLength(3);
    const ge = battles.find((b) => b.caption === 'ge')!;
    const visual = battles.find((b) => b.caption === 'visual')!;
    const music = battles.find((b) => b.caption === 'music')!;

    expect(ge.winnerId).toBe('H');
    expect(ge.differential).toBe(5);
    expect(visual.winnerId).toBe('A');
    expect(visual.differential).toBe(-5);
    expect(music.winnerId).toBeNull(); // tie
    expect(music.differential).toBe(0);
  });

  it('treats a missing group as zero', () => {
    const home: CaptionGroupScores = { ge: 5 };
    const away: CaptionGroupScores = {}; // no ge -> 0
    const battles = calculateCaptionBattles('H', 'A', home, away);
    const ge = battles.find((b) => b.caption === 'ge')!;
    expect(ge.homeScore).toBe(5);
    expect(ge.awayScore).toBe(0);
    expect(ge.winnerId).toBe('H');
  });
});

describe('countCaptionWins', () => {
  it('counts wins per side and ignores ties', () => {
    const home: CaptionGroupScores = { ...allCaptions(5), ge: 10, visual: 10 };
    const away: CaptionGroupScores = { ...allCaptions(5), music: 10 };
    const battles = calculateCaptionBattles('H', 'A', home, away);
    expect(countCaptionWins(battles)).toEqual({ home: 2, away: 1 });
  });
});

// ---------------------------------------------------------------------------
// Individual battles
// ---------------------------------------------------------------------------

describe('individual battles', () => {
  it('total score battle awards the higher weekly total', () => {
    const r = calculateTotalScoreBattle(
      'H',
      'A',
      perf({ totalScore: 100 }),
      perf({ totalScore: 90 })
    );
    expect(r.winnerId).toBe('H');
    expect(r.differential).toBe(10);
    expect(r.pointsAwarded).toBe(1);
    expect(r.type).toBe('total');
  });

  it('high single battle awards the better single show', () => {
    const r = calculateHighSingleBattle(
      'H',
      'A',
      perf({ highSingleScore: 40 }),
      perf({ highSingleScore: 55 })
    );
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
  it('resolves a dead-even matchup as a tie', () => {
    const home = perf({
      captions: { ...allCaptions(5), ge: 10 }, // home takes GE
      totalScore: 100,
      highSingleScore: 50, // tie -> no highSingle point
      scoreDelta: 3,
    });
    const away = perf({
      captions: { ...allCaptions(5), visual: 10 }, // away takes Visual
      totalScore: 90,
      highSingleScore: 50,
      scoreDelta: 5,
    });
    const r = build(1, 'H', 'A', home, away);

    // home: GE + total = 2; away: Visual + momentum = 2. Dead even.
    expect(r.captionBattlesWon).toEqual({ home: 1, away: 1 });
    expect(r.homeBattlePoints).toBe(2); // GE + total
    expect(r.awayBattlePoints).toBe(2); // Visual + momentum
    expect(r.isTie).toBe(true);
  });

  it('counts three group battles plus the three bonus battles', () => {
    const home = perf({
      captions: { ...allCaptions(5), ge: 10 },
      totalScore: 100,
      highSingleScore: 50, // tie
      scoreDelta: 5,
    });
    const away = perf({
      captions: { ...allCaptions(5), visual: 10 },
      totalScore: 90,
      highSingleScore: 50,
      scoreDelta: 3,
    });
    const r = build(1, 'H', 'A', home, away);

    // home: GE + total + momentum = 3; away: Visual = 1.
    expect(r.homeBattlePoints).toBe(3);
    expect(r.awayBattlePoints).toBe(1);
    expect(r.winnerId).toBe('H');
    expect(r.margin).toBe(2);
    expect(r.isClutch).toBe(false); // clutch is a single point now
    expect(r.isBlowout).toBe(false);
    expect(r.allBattles).toHaveLength(6); // 3 groups + 3 individual battles
  });

  it('resolves a blowout (margin >= 4)', () => {
    const r = build(1, 'H', 'A', dominantPerf, weakPerf);
    expect(r.homeBattlePoints).toBe(MAX_BATTLE_POINTS);
    expect(r.awayBattlePoints).toBe(0);
    expect(r.winnerId).toBe('H');
    expect(r.isBlowout).toBe(true);
    expect(r.margin).toBe(6);
  });

  it('resolves a tie when every dimension is equal', () => {
    const same = perf({
      captions: allCaptions(5),
      totalScore: 50,
      highSingleScore: 25,
      scoreDelta: 0,
    });
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
    expect(s.totalBattlePointsFor).toBe(12); // 6 + 6 + 0
    expect(s.bestWeek.battlePoints).toBe(6);
  });

  it('counts a comeback win (lost the caption battles, won the matchup)', () => {
    // home takes only GE but sweeps total/high/momentum -> wins 4-2.
    const home = perf({
      captions: { ge: 10, visual: 1, music: 1 },
      totalScore: 100,
      highSingleScore: 50,
      scoreDelta: 5,
    });
    const away = perf({
      captions: { ge: 1, visual: 10, music: 10 },
      totalScore: 10,
      highSingleScore: 5,
      scoreDelta: 0,
    });
    const breakdown = build(1, 'H', 'A', home, away);
    expect(breakdown.winnerId).toBe('H');
    expect(breakdown.captionBattlesWon).toEqual({ home: 1, away: 2 });

    const s = calculateSeasonStats('H', 'season-1', [breakdown]);
    expect(s.wins).toBe(1);
    expect(s.comebackWins).toBe(1);
    expect(breakdown.margin).toBe(2); // 4-2, neither clutch nor a blowout
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
    expect(h.captionDomination.ge.dominantUserId).toBeNull();
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
    // X took GE twice, Y once -> X dominates the group
    expect(h.captionDomination.ge.dominantUserId).toBe('X');
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
    const home = perf({
      captions: allCaptions(5),
      totalScore: 100,
      highSingleScore: 50,
      scoreDelta: 5,
    });
    const away = perf({
      captions: allCaptions(5),
      totalScore: 90,
      highSingleScore: 40,
      scoreDelta: 0,
    });
    const winBreakdown = build(1, 'H', 'A', home, away);
    expect(winBreakdown.margin).toBe(3);
    expect(getMatchupDescription(winBreakdown)).toBe('Win');
  });
});

describe('aggregateCaptionScores', () => {
  it('sums caption scores across shows and skips shows without captions', () => {
    const totals = aggregateCaptionScores([
      { captions: { ge: 10, visual: 5 } },
      { captions: { ge: 5 } },
      {}, // no captions -> skipped
    ]);
    expect(totals.ge).toBe(15);
    expect(totals.visual).toBe(5);
    expect(totals.music).toBeUndefined();
  });
});

describe('createWeeklyPerformance', () => {
  it('aggregates totals, high single and week-over-week delta', () => {
    const wp = createWeeklyPerformance(
      'A',
      2,
      [
        { showId: 's1', showName: 'Show 1', score: 80, captions: { ge: 10 } },
        { showId: 's2', showName: 'Show 2', score: 90, captions: { ge: 5 } },
      ],
      150
    );

    expect(wp.totalScore).toBe(170);
    expect(wp.showCount).toBe(2);
    expect(wp.highSingleScore).toBe(90);
    expect(wp.highSingleShowId).toBe('s2');
    expect(wp.captions.ge).toBe(15);
    expect(wp.scoreDelta).toBe(20);
  });

  it('leaves scoreDelta undefined without a previous week', () => {
    const wp = createWeeklyPerformance('A', 1, [{ showId: 's1', showName: 'Show 1', score: 80 }]);
    expect(wp.scoreDelta).toBeUndefined();
  });
});
