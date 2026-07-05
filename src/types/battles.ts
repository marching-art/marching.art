import { Timestamp } from 'firebase/firestore';

import type { Caption } from './corps';
import type { Matchup } from './league';
import type { CaptionScores } from './season';

// =============================================================================
// HEAD-TO-HEAD BATTLE SYSTEM TYPES
// =============================================================================

/**
 * Battle types for head-to-head matchups
 * Each battle awards points toward the weekly matchup score
 */
export type BattleType = 'caption' | 'total' | 'highSingle' | 'momentum';

/**
 * Result of a single caption battle
 */
export interface CaptionBattle {
  caption: Caption;
  homeScore: number;
  awayScore: number;
  winnerId: string | null; // null = tie
  differential: number; // positive = home won
}

/**
 * Result of a single battle (any type)
 */
export interface BattleResult {
  type: BattleType;
  caption?: Caption; // Only for caption battles
  homeValue: number;
  awayValue: number;
  winnerId: string | null;
  differential: number;
  pointsAwarded: number; // Usually 1, but could vary
}

/**
 * Weekly performance data for a user (used in calculations)
 */
export interface WeeklyUserPerformance {
  userId: string;
  week: number;

  // Aggregated scores
  totalScore: number;
  showCount: number;

  // Caption totals for the week
  captions: CaptionScores;

  // Individual show performances
  shows: {
    showId: string;
    showName: string;
    score: number;
    placement?: number;
    captions?: CaptionScores;
  }[];

  // Best single show score
  highSingleScore: number;
  highSingleShowId?: string;

  // Week-over-week change (if previous week data exists)
  previousWeekScore?: number;
  scoreDelta?: number; // This week - last week
}

/**
 * Complete breakdown of all battles in a matchup
 */
export interface MatchupBattleBreakdown {
  matchupId: string;
  week: number;

  // Participants
  homeUserId: string;
  awayUserId: string;

  // Battle points (the main score)
  homeBattlePoints: number;
  awayBattlePoints: number;

  // Caption battles (8 total)
  captionBattles: CaptionBattle[];
  captionBattlesWon: {
    home: number;
    away: number;
  };

  // Total score battle
  totalScoreBattle: BattleResult;

  // High single performance battle
  highSingleBattle: BattleResult;

  // Momentum battle (week-over-week improvement)
  momentumBattle: BattleResult;

  // All battles combined for easy iteration
  allBattles: BattleResult[];

  // Overall result
  winnerId: string | null;
  isTie: boolean;
  margin: number; // Battle point margin

  // Close match indicator (decided by 1-2 battle points)
  isClutch: boolean;

  // Blowout indicator (won by 5+ battle points)
  isBlowout: boolean;
}

/**
 * Extended matchup result including battle breakdown
 */
export interface MatchupWithBattles extends Matchup {
  battleBreakdown?: MatchupBattleBreakdown;
  homePerformance?: WeeklyUserPerformance;
  awayPerformance?: WeeklyUserPerformance;
}

/**
 * Season-long stats for a user in head-to-head play
 */
export interface SeasonMatchupStats {
  userId: string;
  seasonId: string;

  // Overall record
  wins: number;
  losses: number;
  ties: number;
  winPercentage: number;

  // Battle point stats
  totalBattlePointsFor: number;
  totalBattlePointsAgainst: number;
  avgBattlePointsFor: number;
  avgBattlePointsAgainst: number;

  // Caption win rates (key = caption name)
  captionWinRates: Record<Caption, CaptionWinRate>;

  // Best caption (highest win rate)
  bestCaption: Caption;
  bestCaptionWinRate: number;

  // Worst caption (lowest win rate)
  worstCaption: Caption;
  worstCaptionWinRate: number;

  // Performance stats
  totalScoreBattlesWon: number;
  highSingleBattlesWon: number;
  momentumBattlesWon: number;

  // Notable achievements
  clutchWins: number; // Won by 1-2 battle points
  blowoutWins: number; // Won by 5+ battle points
  comebackWins: number; // Trailed in caption battles but won overall

  // Streaks
  currentStreak: number;
  currentStreakType: 'W' | 'L' | null;
  longestWinStreak: number;
  longestLossStreak: number;

  // Best/worst performances
  bestWeek: {
    week: number;
    battlePoints: number;
    opponent: string;
  };
  worstWeek: {
    week: number;
    battlePoints: number;
    opponent: string;
  };
  highestSingleScore: number;
  highestSingleScoreWeek: number;
}

/**
 * Win rate data for a specific caption
 */
export interface CaptionWinRate {
  caption: Caption;
  wins: number;
  losses: number;
  ties: number;
  totalMatchups: number;
  winRate: number; // 0-1
  avgDifferential: number; // Average point spread when competing
  dominanceRating: number; // Composite rating of how dominant in this caption
}

/**
 * Head-to-head history between two users (extended)
 */
export interface ExtendedHeadToHead {
  user1Id: string;
  user2Id: string;

  // Overall record
  user1Wins: number;
  user2Wins: number;
  ties: number;
  totalMatchups: number;

  // Battle point totals
  user1TotalBattlePoints: number;
  user2TotalBattlePoints: number;

  // Caption domination map (which user wins each caption more often)
  captionDomination: Record<
    Caption,
    {
      user1Wins: number;
      user2Wins: number;
      dominantUserId: string | null;
    }
  >;

  // Average margin
  avgMargin: number;

  // Streak info
  currentStreak: {
    userId: string;
    count: number;
  } | null;

  // All matchups history
  matchupHistory: {
    week: number;
    winnerId: string | null;
    user1BattlePoints: number;
    user2BattlePoints: number;
    user1Score: number;
    user2Score: number;
  }[];
}

/**
 * League-wide leaderboard for a specific stat category
 */
export interface MatchupLeaderboard {
  category: MatchupLeaderboardCategory;
  entries: MatchupLeaderboardEntry[];
  lastUpdated: Timestamp;
}

export type MatchupLeaderboardCategory =
  | 'wins'
  | 'battlePoints'
  | 'captionWinRate'
  | 'highSingleScore'
  | 'avgMargin'
  | 'clutchWins'
  | 'blowoutWins'
  | 'longestStreak'
  | 'bestCaption_GE1'
  | 'bestCaption_GE2'
  | 'bestCaption_VP'
  | 'bestCaption_VA'
  | 'bestCaption_CG'
  | 'bestCaption_B'
  | 'bestCaption_MA'
  | 'bestCaption_P';

export interface MatchupLeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  value: number;
  secondaryValue?: number; // For context (e.g., total matchups for win rate)
}
