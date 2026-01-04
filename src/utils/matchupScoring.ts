/**
 * Matchup Scoring Utilities
 *
 * Calculates battle points for head-to-head matchups using multiple dimensions:
 * - Caption Battles (8 pts): Win each caption = 1 pt
 * - Total Score Battle (1 pt): Higher weekly total
 * - High Single Battle (1 pt): Best individual show performance
 * - Momentum Battle (1 pt): Better week-over-week improvement
 *
 * Maximum possible: 11 battle points
 */

import { GAME_CONFIG } from '../config';
import type {
  Caption,
  CaptionScores,
  CaptionBattle,
  BattleResult,
  BattleType,
  WeeklyUserPerformance,
  MatchupBattleBreakdown,
  SeasonMatchupStats,
  CaptionWinRate,
  ExtendedHeadToHead,
} from '../types';

// =============================================================================
// CONSTANTS
// =============================================================================

/** All captions in order */
export const CAPTIONS: Caption[] = GAME_CONFIG.captions as unknown as Caption[];

/** Battle point thresholds */
export const BATTLE_THRESHOLDS = {
  /** Margin to be considered a clutch win */
  clutchMargin: 2,
  /** Margin to be considered a blowout */
  blowoutMargin: 5,
  /** Minimum caption battles won to claim "caption domination" */
  captionDominationThreshold: 5,
} as const;

/** Points awarded for each battle type */
export const BATTLE_POINTS = {
  caption: 1, // Per caption won
  total: 1,
  highSingle: 1,
  momentum: 1,
} as const;

/** Maximum possible battle points */
export const MAX_BATTLE_POINTS = (CAPTIONS.length * BATTLE_POINTS.caption)
  + BATTLE_POINTS.total
  + BATTLE_POINTS.highSingle
  + BATTLE_POINTS.momentum;

// =============================================================================
// CAPTION BATTLE CALCULATIONS
// =============================================================================

/**
 * Compare two users' caption scores and determine the winner of each caption battle
 */
export function calculateCaptionBattles(
  homeUserId: string,
  awayUserId: string,
  homeCaptions: CaptionScores,
  awayCaptions: CaptionScores
): CaptionBattle[] {
  return CAPTIONS.map(caption => {
    const homeScore = homeCaptions[caption] ?? 0;
    const awayScore = awayCaptions[caption] ?? 0;
    const differential = homeScore - awayScore;

    let winnerId: string | null = null;
    if (differential > 0) winnerId = homeUserId;
    else if (differential < 0) winnerId = awayUserId;

    return {
      caption,
      homeScore,
      awayScore,
      winnerId,
      differential,
    };
  });
}

/**
 * Count caption battle wins for each side
 */
export function countCaptionWins(captionBattles: CaptionBattle[]): { home: number; away: number } {
  return captionBattles.reduce(
    (acc, battle) => {
      if (battle.differential > 0) acc.home++;
      else if (battle.differential < 0) acc.away++;
      return acc;
    },
    { home: 0, away: 0 }
  );
}

// =============================================================================
// INDIVIDUAL BATTLE CALCULATIONS
// =============================================================================

/**
 * Create a battle result from a comparison
 */
function createBattleResult(
  type: BattleType,
  homeUserId: string,
  awayUserId: string,
  homeValue: number,
  awayValue: number,
  caption?: Caption
): BattleResult {
  const differential = homeValue - awayValue;
  let winnerId: string | null = null;

  if (differential > 0) winnerId = homeUserId;
  else if (differential < 0) winnerId = awayUserId;

  return {
    type,
    caption,
    homeValue,
    awayValue,
    winnerId,
    differential,
    pointsAwarded: type === 'caption' ? BATTLE_POINTS.caption : BATTLE_POINTS[type],
  };
}

/**
 * Calculate the total score battle
 */
export function calculateTotalScoreBattle(
  homeUserId: string,
  awayUserId: string,
  homePerformance: WeeklyUserPerformance,
  awayPerformance: WeeklyUserPerformance
): BattleResult {
  return createBattleResult(
    'total',
    homeUserId,
    awayUserId,
    homePerformance.totalScore,
    awayPerformance.totalScore
  );
}

/**
 * Calculate the high single score battle
 */
export function calculateHighSingleBattle(
  homeUserId: string,
  awayUserId: string,
  homePerformance: WeeklyUserPerformance,
  awayPerformance: WeeklyUserPerformance
): BattleResult {
  return createBattleResult(
    'highSingle',
    homeUserId,
    awayUserId,
    homePerformance.highSingleScore,
    awayPerformance.highSingleScore
  );
}

/**
 * Calculate the momentum battle (week-over-week improvement)
 */
export function calculateMomentumBattle(
  homeUserId: string,
  awayUserId: string,
  homePerformance: WeeklyUserPerformance,
  awayPerformance: WeeklyUserPerformance
): BattleResult {
  // Use score delta if available, otherwise use 0
  const homeDelta = homePerformance.scoreDelta ?? 0;
  const awayDelta = awayPerformance.scoreDelta ?? 0;

  return createBattleResult(
    'momentum',
    homeUserId,
    awayUserId,
    homeDelta,
    awayDelta
  );
}

// =============================================================================
// FULL MATCHUP CALCULATION
// =============================================================================

/**
 * Calculate complete battle breakdown for a matchup
 */
export function calculateMatchupBattles(
  matchupId: string,
  week: number,
  homeUserId: string,
  awayUserId: string,
  homePerformance: WeeklyUserPerformance,
  awayPerformance: WeeklyUserPerformance
): MatchupBattleBreakdown {
  // Calculate all caption battles
  const captionBattles = calculateCaptionBattles(
    homeUserId,
    awayUserId,
    homePerformance.captions,
    awayPerformance.captions
  );
  const captionBattlesWon = countCaptionWins(captionBattles);

  // Calculate other battles
  const totalScoreBattle = calculateTotalScoreBattle(
    homeUserId,
    awayUserId,
    homePerformance,
    awayPerformance
  );
  const highSingleBattle = calculateHighSingleBattle(
    homeUserId,
    awayUserId,
    homePerformance,
    awayPerformance
  );
  const momentumBattle = calculateMomentumBattle(
    homeUserId,
    awayUserId,
    homePerformance,
    awayPerformance
  );

  // Convert caption battles to BattleResult format for allBattles array
  const captionBattleResults: BattleResult[] = captionBattles.map(cb => ({
    type: 'caption' as BattleType,
    caption: cb.caption,
    homeValue: cb.homeScore,
    awayValue: cb.awayScore,
    winnerId: cb.winnerId,
    differential: cb.differential,
    pointsAwarded: BATTLE_POINTS.caption,
  }));

  const allBattles = [
    ...captionBattleResults,
    totalScoreBattle,
    highSingleBattle,
    momentumBattle,
  ];

  // Calculate total battle points
  let homeBattlePoints = captionBattlesWon.home;
  let awayBattlePoints = captionBattlesWon.away;

  if (totalScoreBattle.winnerId === homeUserId) homeBattlePoints += BATTLE_POINTS.total;
  else if (totalScoreBattle.winnerId === awayUserId) awayBattlePoints += BATTLE_POINTS.total;

  if (highSingleBattle.winnerId === homeUserId) homeBattlePoints += BATTLE_POINTS.highSingle;
  else if (highSingleBattle.winnerId === awayUserId) awayBattlePoints += BATTLE_POINTS.highSingle;

  if (momentumBattle.winnerId === homeUserId) homeBattlePoints += BATTLE_POINTS.momentum;
  else if (momentumBattle.winnerId === awayUserId) awayBattlePoints += BATTLE_POINTS.momentum;

  // Determine overall winner
  const margin = homeBattlePoints - awayBattlePoints;
  let winnerId: string | null = null;
  const isTie = margin === 0;

  if (margin > 0) winnerId = homeUserId;
  else if (margin < 0) winnerId = awayUserId;

  const absMargin = Math.abs(margin);
  const isClutch = !isTie && absMargin <= BATTLE_THRESHOLDS.clutchMargin;
  const isBlowout = absMargin >= BATTLE_THRESHOLDS.blowoutMargin;

  return {
    matchupId,
    week,
    homeUserId,
    awayUserId,
    homeBattlePoints,
    awayBattlePoints,
    captionBattles,
    captionBattlesWon,
    totalScoreBattle,
    highSingleBattle,
    momentumBattle,
    allBattles,
    winnerId,
    isTie,
    margin: absMargin,
    isClutch,
    isBlowout,
  };
}

// =============================================================================
// SEASON STATS CALCULATIONS
// =============================================================================

/**
 * Initialize empty caption win rates
 */
export function initializeCaptionWinRates(): Record<Caption, CaptionWinRate> {
  const rates = {} as Record<Caption, CaptionWinRate>;
  for (const caption of CAPTIONS) {
    rates[caption] = {
      caption,
      wins: 0,
      losses: 0,
      ties: 0,
      totalMatchups: 0,
      winRate: 0,
      avgDifferential: 0,
      dominanceRating: 0,
    };
  }
  return rates;
}

/**
 * Calculate season stats from a list of matchup breakdowns
 */
export function calculateSeasonStats(
  userId: string,
  seasonId: string,
  breakdowns: MatchupBattleBreakdown[]
): SeasonMatchupStats {
  const stats: SeasonMatchupStats = {
    userId,
    seasonId,
    wins: 0,
    losses: 0,
    ties: 0,
    winPercentage: 0,
    totalBattlePointsFor: 0,
    totalBattlePointsAgainst: 0,
    avgBattlePointsFor: 0,
    avgBattlePointsAgainst: 0,
    captionWinRates: initializeCaptionWinRates(),
    bestCaption: 'GE1',
    bestCaptionWinRate: 0,
    worstCaption: 'GE1',
    worstCaptionWinRate: 1,
    totalScoreBattlesWon: 0,
    highSingleBattlesWon: 0,
    momentumBattlesWon: 0,
    clutchWins: 0,
    blowoutWins: 0,
    comebackWins: 0,
    currentStreak: 0,
    currentStreakType: null,
    longestWinStreak: 0,
    longestLossStreak: 0,
    bestWeek: { week: 0, battlePoints: 0, opponent: '' },
    worstWeek: { week: 0, battlePoints: MAX_BATTLE_POINTS, opponent: '' },
    highestSingleScore: 0,
    highestSingleScoreWeek: 0,
  };

  if (breakdowns.length === 0) return stats;

  // Track streaks
  let currentStreak = 0;
  let currentStreakType: 'W' | 'L' | null = null;
  let longestWinStreak = 0;
  let longestLossStreak = 0;

  // Track caption differentials for average calculation
  const captionDifferentials: Record<Caption, number[]> = {} as Record<Caption, number[]>;
  for (const caption of CAPTIONS) {
    captionDifferentials[caption] = [];
  }

  // Process each matchup
  for (const breakdown of breakdowns) {
    const isHome = breakdown.homeUserId === userId;
    const myPoints = isHome ? breakdown.homeBattlePoints : breakdown.awayBattlePoints;
    const oppPoints = isHome ? breakdown.awayBattlePoints : breakdown.homeBattlePoints;
    const opponentId = isHome ? breakdown.awayUserId : breakdown.homeUserId;

    stats.totalBattlePointsFor += myPoints;
    stats.totalBattlePointsAgainst += oppPoints;

    // Win/loss/tie
    if (breakdown.winnerId === userId) {
      stats.wins++;
      if (breakdown.isClutch) stats.clutchWins++;
      if (breakdown.isBlowout) stats.blowoutWins++;

      // Check for comeback win (lost caption battles but won overall)
      const myCaptionWins = isHome
        ? breakdown.captionBattlesWon.home
        : breakdown.captionBattlesWon.away;
      const oppCaptionWins = isHome
        ? breakdown.captionBattlesWon.away
        : breakdown.captionBattlesWon.home;
      if (myCaptionWins < oppCaptionWins) stats.comebackWins++;

      // Streak tracking
      if (currentStreakType === 'W') {
        currentStreak++;
      } else {
        currentStreak = 1;
        currentStreakType = 'W';
      }
      longestWinStreak = Math.max(longestWinStreak, currentStreak);
    } else if (breakdown.winnerId === null) {
      stats.ties++;
      currentStreak = 0;
      currentStreakType = null;
    } else {
      stats.losses++;
      if (currentStreakType === 'L') {
        currentStreak++;
      } else {
        currentStreak = 1;
        currentStreakType = 'L';
      }
      longestLossStreak = Math.max(longestLossStreak, currentStreak);
    }

    // Best/worst week
    if (myPoints > stats.bestWeek.battlePoints) {
      stats.bestWeek = { week: breakdown.week, battlePoints: myPoints, opponent: opponentId };
    }
    if (myPoints < stats.worstWeek.battlePoints) {
      stats.worstWeek = { week: breakdown.week, battlePoints: myPoints, opponent: opponentId };
    }

    // Battle type wins
    if (breakdown.totalScoreBattle.winnerId === userId) stats.totalScoreBattlesWon++;
    if (breakdown.highSingleBattle.winnerId === userId) stats.highSingleBattlesWon++;
    if (breakdown.momentumBattle.winnerId === userId) stats.momentumBattlesWon++;

    // Caption stats
    for (const cb of breakdown.captionBattles) {
      const myScore = isHome ? cb.homeScore : cb.awayScore;
      const oppScore = isHome ? cb.awayScore : cb.homeScore;
      const diff = myScore - oppScore;

      captionDifferentials[cb.caption].push(diff);
      stats.captionWinRates[cb.caption].totalMatchups++;

      if (diff > 0) {
        stats.captionWinRates[cb.caption].wins++;
      } else if (diff < 0) {
        stats.captionWinRates[cb.caption].losses++;
      } else {
        stats.captionWinRates[cb.caption].ties++;
      }
    }
  }

  // Calculate final stats
  const totalMatchups = breakdowns.length;
  stats.winPercentage = totalMatchups > 0 ? stats.wins / totalMatchups : 0;
  stats.avgBattlePointsFor = totalMatchups > 0 ? stats.totalBattlePointsFor / totalMatchups : 0;
  stats.avgBattlePointsAgainst = totalMatchups > 0 ? stats.totalBattlePointsAgainst / totalMatchups : 0;

  stats.currentStreak = currentStreak;
  stats.currentStreakType = currentStreakType;
  stats.longestWinStreak = longestWinStreak;
  stats.longestLossStreak = longestLossStreak;

  // Calculate caption win rates and find best/worst
  for (const caption of CAPTIONS) {
    const cwr = stats.captionWinRates[caption];
    cwr.winRate = cwr.totalMatchups > 0 ? cwr.wins / cwr.totalMatchups : 0;

    const diffs = captionDifferentials[caption];
    cwr.avgDifferential = diffs.length > 0
      ? diffs.reduce((a, b) => a + b, 0) / diffs.length
      : 0;

    // Dominance rating: win rate * (1 + normalized avg differential)
    cwr.dominanceRating = cwr.winRate * (1 + Math.tanh(cwr.avgDifferential / 10));

    if (cwr.winRate > stats.bestCaptionWinRate) {
      stats.bestCaption = caption;
      stats.bestCaptionWinRate = cwr.winRate;
    }
    if (cwr.winRate < stats.worstCaptionWinRate) {
      stats.worstCaption = caption;
      stats.worstCaptionWinRate = cwr.winRate;
    }
  }

  return stats;
}

// =============================================================================
// HEAD-TO-HEAD CALCULATIONS
// =============================================================================

/**
 * Calculate extended head-to-head history between two users
 */
export function calculateHeadToHead(
  user1Id: string,
  user2Id: string,
  breakdowns: MatchupBattleBreakdown[]
): ExtendedHeadToHead {
  // Filter to only matchups between these two users
  const relevantMatchups = breakdowns.filter(
    b => (b.homeUserId === user1Id && b.awayUserId === user2Id)
      || (b.homeUserId === user2Id && b.awayUserId === user1Id)
  );

  const h2h: ExtendedHeadToHead = {
    user1Id,
    user2Id,
    user1Wins: 0,
    user2Wins: 0,
    ties: 0,
    totalMatchups: relevantMatchups.length,
    user1TotalBattlePoints: 0,
    user2TotalBattlePoints: 0,
    captionDomination: {} as Record<Caption, { user1Wins: number; user2Wins: number; dominantUserId: string | null }>,
    avgMargin: 0,
    currentStreak: null,
    matchupHistory: [],
  };

  // Initialize caption domination
  for (const caption of CAPTIONS) {
    h2h.captionDomination[caption] = { user1Wins: 0, user2Wins: 0, dominantUserId: null };
  }

  if (relevantMatchups.length === 0) return h2h;

  let totalMargin = 0;
  let lastWinnerId: string | null = null;
  let streakCount = 0;

  // Process each matchup (sorted by week)
  const sorted = [...relevantMatchups].sort((a, b) => a.week - b.week);

  for (const breakdown of sorted) {
    const user1IsHome = breakdown.homeUserId === user1Id;
    const user1Points = user1IsHome ? breakdown.homeBattlePoints : breakdown.awayBattlePoints;
    const user2Points = user1IsHome ? breakdown.awayBattlePoints : breakdown.homeBattlePoints;
    const user1Score = user1IsHome
      ? (breakdown.totalScoreBattle.homeValue ?? 0)
      : (breakdown.totalScoreBattle.awayValue ?? 0);
    const user2Score = user1IsHome
      ? (breakdown.totalScoreBattle.awayValue ?? 0)
      : (breakdown.totalScoreBattle.homeValue ?? 0);

    h2h.user1TotalBattlePoints += user1Points;
    h2h.user2TotalBattlePoints += user2Points;

    // Win tracking
    if (breakdown.winnerId === user1Id) {
      h2h.user1Wins++;
      totalMargin += user1Points - user2Points;
      if (lastWinnerId === user1Id) streakCount++;
      else { lastWinnerId = user1Id; streakCount = 1; }
    } else if (breakdown.winnerId === user2Id) {
      h2h.user2Wins++;
      totalMargin -= user1Points - user2Points;
      if (lastWinnerId === user2Id) streakCount++;
      else { lastWinnerId = user2Id; streakCount = 1; }
    } else {
      h2h.ties++;
      lastWinnerId = null;
      streakCount = 0;
    }

    // Caption domination
    for (const cb of breakdown.captionBattles) {
      const user1CaptionScore = user1IsHome ? cb.homeScore : cb.awayScore;
      const user2CaptionScore = user1IsHome ? cb.awayScore : cb.homeScore;

      if (user1CaptionScore > user2CaptionScore) {
        h2h.captionDomination[cb.caption].user1Wins++;
      } else if (user2CaptionScore > user1CaptionScore) {
        h2h.captionDomination[cb.caption].user2Wins++;
      }
    }

    // Add to history
    h2h.matchupHistory.push({
      week: breakdown.week,
      winnerId: breakdown.winnerId,
      user1BattlePoints: user1Points,
      user2BattlePoints: user2Points,
      user1Score,
      user2Score,
    });
  }

  // Calculate averages and determine domination
  h2h.avgMargin = relevantMatchups.length > 0 ? totalMargin / relevantMatchups.length : 0;

  if (lastWinnerId && streakCount > 0) {
    h2h.currentStreak = { userId: lastWinnerId, count: streakCount };
  }

  // Determine caption domination
  for (const caption of CAPTIONS) {
    const dom = h2h.captionDomination[caption];
    if (dom.user1Wins > dom.user2Wins) {
      dom.dominantUserId = user1Id;
    } else if (dom.user2Wins > dom.user1Wins) {
      dom.dominantUserId = user2Id;
    }
  }

  return h2h;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Format battle points as a string (e.g., "7-4")
 */
export function formatBattleScore(homePoints: number, awayPoints: number): string {
  return `${homePoints}-${awayPoints}`;
}

/**
 * Get a description of the matchup result
 */
export function getMatchupDescription(breakdown: MatchupBattleBreakdown): string {
  if (breakdown.isTie) return 'Tied';
  if (breakdown.isBlowout) return 'Blowout';
  if (breakdown.isClutch) return 'Clutch Win';
  return 'Win';
}

/**
 * Calculate win probability based on historical stats
 * Simple logistic regression based on battle point differential
 */
export function calculateWinProbability(
  userStats: SeasonMatchupStats,
  opponentStats: SeasonMatchupStats
): number {
  if (userStats.avgBattlePointsFor === 0 && opponentStats.avgBattlePointsFor === 0) {
    return 0.5; // No data
  }

  const userStrength = userStats.avgBattlePointsFor - userStats.avgBattlePointsAgainst;
  const oppStrength = opponentStats.avgBattlePointsFor - opponentStats.avgBattlePointsAgainst;
  const differential = userStrength - oppStrength;

  // Sigmoid function to convert differential to probability
  return 1 / (1 + Math.exp(-differential / 2));
}

/**
 * Get caption display name
 */
export function getCaptionDisplayName(caption: Caption): string {
  return GAME_CONFIG.captionNames[caption] || caption;
}

/**
 * Aggregate caption scores from multiple shows
 */
export function aggregateCaptionScores(shows: { captions?: CaptionScores }[]): CaptionScores {
  const totals: CaptionScores = {};

  for (const show of shows) {
    if (!show.captions) continue;
    for (const caption of CAPTIONS) {
      const score = show.captions[caption];
      if (score !== undefined) {
        totals[caption] = (totals[caption] ?? 0) + score;
      }
    }
  }

  return totals;
}

/**
 * Create weekly performance data from show results
 */
export function createWeeklyPerformance(
  userId: string,
  week: number,
  shows: {
    showId: string;
    showName: string;
    score: number;
    placement?: number;
    captions?: CaptionScores;
  }[],
  previousWeekScore?: number
): WeeklyUserPerformance {
  const totalScore = shows.reduce((sum, s) => sum + s.score, 0);
  const highSingle = shows.reduce(
    (best, s) => s.score > best.score ? { score: s.score, showId: s.showId } : best,
    { score: 0, showId: undefined as string | undefined }
  );

  return {
    userId,
    week,
    totalScore,
    showCount: shows.length,
    captions: aggregateCaptionScores(shows),
    shows,
    highSingleScore: highSingle.score,
    highSingleShowId: highSingle.showId,
    previousWeekScore,
    scoreDelta: previousWeekScore !== undefined ? totalScore - previousWeekScore : undefined,
  };
}
