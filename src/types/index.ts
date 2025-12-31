// Core type definitions for marching.art
// These types represent the data structures used throughout the application

import { Timestamp } from 'firebase/firestore';

// =============================================================================
// USER & PROFILE TYPES
// =============================================================================

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
}

export interface UserProfile {
  uid: string;
  username: string;
  displayName: string;
  email: string;
  createdAt: Timestamp;
  lastLogin: Timestamp;

  // XP & Progression
  xp: number;
  xpLevel: number;
  userTitle: string;

  // Currency
  corpsCoin: number;

  // Unlocks
  unlockedClasses: CorpsClass[];

  // Corps data (keyed by class)
  corps: Record<CorpsClass, CorpsData | undefined>;

  // Stats
  lifetimeStats?: LifetimeStats;

  // Daily challenges (keyed by date string)
  challenges?: Record<string, DailyChallenge[]>;
  dailyChallenges?: DailyChallenges; // Legacy/alternative structure

  // Engagement tracking
  engagement?: EngagementData;

  // Achievements
  achievements?: Achievement[];

  // Retired corps history
  retiredCorps?: RetiredCorps[];

  // Settings
  settings?: UserSettings;
}

export interface RetiredCorps {
  corpsName: string;
  corpsClass: CorpsClass;
  retiredAt: string;
  finalScore?: number;
  seasonsPlayed?: number;
}

export interface EngagementData {
  loginStreak: number;
  lastLogin: string | null;
  totalLogins: number;
  recentActivity: RecentActivity[];
  weeklyProgress?: Record<CorpsClass, WeeklyProgressData>;
}

export interface RecentActivity {
  type: string;
  description: string;
  timestamp: string;
  xp?: number;
}

export interface WeeklyProgressData {
  rehearsalsCompleted?: number;
  scoreImprovement?: number;
  rankChange?: number;
  previous?: {
    rehearsalsCompleted?: number;
    scoreImprovement?: number;
    rankChange?: number;
  };
}

export interface LifetimeStats {
  totalPoints: number;
  totalSeasons: number;
  totalShows: number;
  bestSeasonScore: number;
  leagueChampionships: number;
  totalCorpsRetired: number;
}

export interface UserSettings {
  theme: 'dark' | 'light';
  notifications: boolean;
  soundEffects: boolean;
  emailPreferences?: EmailPreferences;
  pushPreferences?: PushPreferences;
  fcmToken?: string;
}

export interface EmailPreferences {
  // Master toggle - if false, no emails are sent
  allEmails: boolean;
  // Individual email type preferences
  welcome?: boolean;
  streakAtRisk?: boolean;
  streakBroken?: boolean;
  weeklyDigest?: boolean;
  winBack?: boolean;
  lineupReminder?: boolean;
  leagueActivity?: boolean;
  milestoneAchieved?: boolean;
}

export type EmailType =
  | 'welcome'
  | 'streak_at_risk'
  | 'streak_broken'
  | 'weekly_digest'
  | 'win_back'
  | 'lineup_reminder'
  | 'league_activity'
  | 'milestone_achieved';

export interface PushPreferences {
  // Master toggle - if false, no push notifications are sent
  allPush: boolean;
  // Individual push notification type preferences
  streakAtRisk?: boolean;
  matchupStart?: boolean;
  matchupResult?: boolean;
  scoreUpdate?: boolean;
  leagueActivity?: boolean;
  tradeProposal?: boolean;
  showReminder?: boolean;
}

export type PushNotificationType =
  | 'streak_at_risk'
  | 'matchup_start'
  | 'matchup_result'
  | 'score_update'
  | 'league_activity'
  | 'trade_proposal'
  | 'show_reminder';

// =============================================================================
// CORPS TYPES
// =============================================================================

export type CorpsClass = 'soundSport' | 'aClass' | 'open' | 'world';

export interface CorpsData {
  corpsName: string;
  name?: string; // Legacy field
  location: string;
  showConcept: string;
  corpsClass: CorpsClass;
  createdAt: Timestamp;

  // Season stats
  totalSeasonScore: number;
  showsAttended: number;
  seasonHighScore: number;

  // Execution state (simplified - just for XP tracking)
  lastRehearsalDate?: string;
  rehearsalsToday: number;

  // Show selections (keyed by week number)
  selectedShows?: Record<string, string[]>;

  // Lineup
  lineup?: Lineup;
}

export interface Lineup {
  [caption: string]: LineupSlot;
}

export interface LineupSlot {
  staffId?: string;
  staffName?: string;
  rating?: number;
}

// =============================================================================
// CAPTION TYPE
// =============================================================================

export type Caption =
  | 'GE1' | 'GE2'
  | 'VP' | 'VA' | 'CG'
  | 'B' | 'MA' | 'P';

// =============================================================================
// SEASON TYPES
// =============================================================================

export type SeasonType = 'live' | 'off';

export interface SeasonData {
  seasonUid: string;
  seasonType: SeasonType;
  seasonNumber: number;
  year: number;

  // Schedule
  schedule: SeasonSchedule;

  // Current state
  currentWeek: number;
  currentDay: number;
  totalWeeks: number;

  // Registration
  registrationOpen: boolean;
  registrationDeadline?: Timestamp;
}

export interface SeasonSchedule {
  startDate: Timestamp;
  endDate: Timestamp;
  finalsDate?: Timestamp;
  weeksRemaining: number;
}

// =============================================================================
// SHOW & SCORE TYPES
// =============================================================================

export interface Show {
  showId: string;
  eventName: string;
  location: string;
  date: Timestamp;
  offSeasonDay: number;

  // Competition details
  classes: CorpsClass[];
  isFinals?: boolean;

  // Results (populated after scoring)
  results?: ShowResult[];
}

export interface ShowResult {
  uid: string;
  corpsName: string;
  corpsClass: CorpsClass;

  // Scores
  totalScore: number;
  geScore: number;
  visualScore: number;
  musicScore: number;

  // Detailed captions (if available)
  captions?: CaptionScores;

  // Placement
  placement?: number;
}

export interface CaptionScores {
  GE1?: number;
  GE2?: number;
  VP?: number;
  VA?: number;
  CG?: number;
  B?: number;
  MA?: number;
  P?: number;
}

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
  inviteCode: string;

  // Settings
  settings: LeagueSettings;
}

export interface LeagueSettings {
  enableStaffTrading: boolean;
  scoringFormat: 'circuit' | 'weekly' | 'total';
  finalsSize: number;
  prizePool: number;
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
  | 'matchup_result'      // Matchup results posted
  | 'standings_change'    // Someone passed you in standings
  | 'new_message'         // New message in league chat
  | 'trade_proposal'      // Trade proposal received
  | 'trade_response'      // Trade accepted/rejected
  | 'member_joined'       // New member joined league
  | 'rivalry_matchup';    // Matchup with a rival

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

// =============================================================================
// CHALLENGE & ACHIEVEMENT TYPES
// =============================================================================

export interface DailyChallenges {
  date: string;
  challenges: DailyChallenge[];
  completed: string[];
}

export interface DailyChallenge {
  id: string;
  title: string;
  description: string;
  xpReward?: number;
  coinReward?: number;
  requirement?: string;
  progress?: number;
  target?: number;
  // Extended properties used by hooks
  reward?: string;
  icon?: string;
  completed?: boolean;
  action?: () => void;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  earnedAt: string;
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

export interface ApiResponse<T = void> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  hasMore: boolean;
  lastDoc?: unknown;
  total?: number;
}

// =============================================================================
// FORM DATA TYPES
// =============================================================================

export interface CorpsRegistrationData {
  name: string;
  location: string;
  showConcept: string;
  class: CorpsClass;
}

export interface LeagueCreationData {
  name: string;
  description: string;
  isPublic: boolean;
  maxMembers: number;
  settings: LeagueSettings;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

// Helper type for Firestore documents
export type WithId<T> = T & { id: string };

// Helper for partial updates
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// =============================================================================
// NEWS HUB TYPES
// =============================================================================

export type NewsCategory = 'dci' | 'fantasy' | 'analysis';

export interface TrendingCorps {
  corps: string;
  direction: 'up' | 'down' | 'stable';
  reason: string;
}

export interface NewsEntry {
  id: string;
  category: NewsCategory;
  date: string;
  createdAt: string;
  headline: string;
  summary: string;
  fullStory: string;
  fantasyImpact: string;
  trendingCorps: TrendingCorps[];
  isPublished: boolean;
  imageUrl?: string;
  imageIsPlaceholder?: boolean;
  metadata?: {
    eventName?: string;
    location?: string;
    corpsCount?: number;
    year?: number;
    offSeasonDay?: number;
    showCount?: number;
    seasonId?: string;
    generatedBy?: string;
    imagePublicId?: string;
  };
}

export interface NewsHubResponse {
  success: boolean;
  news: NewsEntry[];
}
