import { Timestamp } from 'firebase/firestore';

import type { CorpsClass } from './corps';
import type { CaptionScores } from './season';
import type { LifetimeStats } from './user';

// =============================================================================
// LEAGUE TYPES
// =============================================================================

export interface League {
  id: string;
  name: string;
  description: string;
  creatorId: string;
  createdAt: Timestamp;

  // Membership
  members: string[];
  maxMembers: number;
  isPublic: boolean;
  /** Legacy only — new leagues keep the code in meta/private (see useLeagueInviteCode). */
  inviteCode?: string;

  // Settings
  settings: LeagueSettings;
}

export interface LeagueSettings {
  scoringFormat: 'circuit' | 'weekly' | 'total';
  finalsSize: number;
  prizePool: number;
  /** CorpsCoin fee charged to every joiner (creator included), paid into the prize pool */
  entryFee?: number;
}

export interface LeagueStanding {
  uid: string;
  displayName: string;
  corpsName: string;
  corpsClass: CorpsClass;

  // Points
  circuitPoints: number;
  totalSeasonScore: number;

  // Medals
  medals: {
    gold: number;
    silver: number;
    bronze: number;
  };

  // Stats
  tourStops: number;
  seasonHighScore: number;
  averagePlacement: number;
}

// =============================================================================
// MATCHUP TYPES
// =============================================================================

export type MatchupStatus = 'scheduled' | 'live' | 'completed';

export interface Matchup {
  id: string;
  leagueId: string;
  week: number;
  seasonId: string;

  // Participants
  homeUserId: string;
  awayUserId: string;

  // Status
  status: MatchupStatus;
  startTime?: Timestamp;
  endTime?: Timestamp;

  // Scores (updated during/after week)
  homeScore: number;
  awayScore: number;

  // Caption breakdowns
  homeCaptions?: CaptionScores;
  awayCaptions?: CaptionScores;

  // Result (after completion)
  winnerId?: string;
  margin?: number;

  // Metadata
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export interface MatchupResult {
  matchupId: string;
  week: number;

  // User info
  homeUser: {
    uid: string;
    displayName: string;
    corpsName: string;
  };
  awayUser: {
    uid: string;
    displayName: string;
    corpsName: string;
  };

  // Final scores
  homeScore: number;
  awayScore: number;

  // Caption breakdown
  homeCaptions: CaptionScores;
  awayCaptions: CaptionScores;

  // Winner
  winnerId: string;
  winnerName: string;
  margin: number;
}

export interface HeadToHeadRecord {
  user1Id: string;
  user2Id: string;
  user1Wins: number;
  user2Wins: number;
  ties: number;
  totalMatchups: number;
  lastMatchup?: MatchupResult;
}

export interface MatchupNotification {
  id: string;
  matchupId: string;
  userId: string;
  type: 'score_update' | 'matchup_start' | 'matchup_end' | 'opponent_lead';
  message: string;
  read: boolean;
  createdAt: Timestamp;
}

// =============================================================================
// LEAGUE NOTIFICATION TYPES
// =============================================================================

export type LeagueNotificationType =
  | 'matchup_result' // Matchup results posted
  | 'standings_change' // Someone passed you in standings
  | 'new_message' // New message in league chat
  | 'trade_proposal' // Trade proposal received
  | 'trade_response' // Trade accepted/rejected
  | 'member_joined' // New member joined league
  | 'rivalry_matchup'; // Matchup with a rival

export interface LeagueNotification {
  id: string;
  leagueId: string;
  leagueName: string;
  userId: string;
  type: LeagueNotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: Timestamp;

  // Optional contextual data
  metadata?: {
    // For matchup results
    matchupId?: string;
    week?: number;
    opponentId?: string;
    opponentName?: string;
    userScore?: number;
    opponentScore?: number;
    won?: boolean;

    // For standings changes
    previousRank?: number;
    newRank?: number;
    passedBy?: string;

    // For trades
    tradeId?: string;
    tradingWith?: string;

    // For rivalry
    isRival?: boolean;
    rivalryRecord?: string;
  };
}

export interface LeagueActivity {
  id: string;
  leagueId: string;
  type: LeagueNotificationType | 'show_result' | 'week_start' | 'week_end';
  timestamp: Timestamp;
  actorId?: string;
  actorName?: string;
  title: string;
  description: string;

  // Contextual data
  metadata?: Record<string, unknown>;
}

export interface RivalryData {
  rivalId: string;
  rivalName: string;
  matchupCount: number;
  userWins: number;
  rivalWins: number;
  ties: number;
  lastMatchupWeek?: number;
  streak?: {
    count: number;
    type: 'W' | 'L';
  };
}

// =============================================================================
// LEADERBOARD TYPES
// =============================================================================

export interface LeaderboardEntry {
  id: string;
  rank: number;
  uid: string;
  username: string;
  userTitle?: string;
  corpsName?: string;
  corpsClass?: CorpsClass;
  score: number;
  trophies?: number;
  lifetimeStats?: LifetimeStats;
}

export type LeaderboardType = 'overall' | 'weekly' | 'monthly' | 'lifetime';
