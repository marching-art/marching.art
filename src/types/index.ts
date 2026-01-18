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
  photoURL?: string;
  location?: string;

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

  // Quick stats (aggregated)
  stats?: {
    seasonsPlayed?: number;
    championships?: number;
    topTenFinishes?: number;
    leagueWins?: number;
  };

  // Lifetime stats (detailed)
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

  // Season tracking
  activeSeasonId?: string;  // Current season the user is participating in
  initialSetupComplete?: string;  // Season ID when initial setup wizard was completed

  // Profile avatar selection - which corps uniform to display
  profileAvatarCorps?: CorpsClass;

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

/**
 * Corps Uniform Design - Director-customizable appearance for fantasy corps
 * Used by AI to generate accurate images for news articles
 */
export interface CorpsUniformDesign {
  // Core Colors
  primaryColor: string;        // e.g., "crimson red", "midnight blue", "emerald green"
  secondaryColor: string;      // e.g., "gold", "silver", "white"
  accentColor?: string;        // e.g., "black trim", "bronze highlights"

  // Uniform Style
  style: 'traditional' | 'contemporary' | 'theatrical' | 'athletic' | 'avant-garde';

  // Helmet/Headwear
  helmetStyle: 'shako' | 'aussie' | 'modern' | 'themed' | 'none';
  plumeDescription?: string;   // e.g., "tall white horsehair plume", "flame-shaped red and orange"

  // Section-Specific Details (optional - AI will fill in if blank)
  brassDescription?: string;   // e.g., "gold-lacquered with dragon engravings on bells"
  percussionDescription?: string; // e.g., "red drums with gold dragon scale graphics"
  guardDescription?: string;   // e.g., "flowing crimson gowns with wing-shaped capes"

  // Corps Identity
  mascotOrEmblem?: string;     // e.g., "dragon", "phoenix", "shield with crossed swords"
  themeKeywords?: string[];    // e.g., ["fire", "power", "ancient"], used for AI matching

  // Performance Context
  venuePreference?: 'outdoor' | 'indoor' | 'both';
  performanceStyle?: string;   // e.g., "high-energy explosive", "elegant and refined", "mysterious and dark"

  // Additional Visual Notes (free-form for anything not covered above)
  additionalNotes?: string;    // e.g., "LED elements in helmet", "capes that detach mid-show"

  // Avatar Generation Options
  avatarStyle?: 'logo' | 'performer';  // logo = team emblem, performer = section member image
  avatarSection?: 'drumMajor' | 'hornline' | 'drumline' | 'colorGuard';  // which section to feature in performer style
}

export interface CorpsData {
  corpsName: string;
  name?: string; // Legacy field
  location: string;
  description?: string;
  corpsClass: CorpsClass;
  createdAt: Timestamp;

  // Uniform Design (director-customizable)
  uniformDesign?: CorpsUniformDesign;

  // Corps Avatar (AI-generated based on uniform design)
  avatarUrl?: string;
  avatarGeneratedAt?: string; // ISO timestamp of when avatar was generated

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
  description?: string;
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
  captionDomination: Record<Caption, {
    user1Wins: number;
    user2Wins: number;
    dominantUserId: string | null;
  }>;

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

// =============================================================================
// ARTICLE REACTIONS & COMMENTS
// =============================================================================

/**
 * Available emoji reactions for articles
 */
export type ArticleReactionType = '👏' | '🔥' | '💯' | '🎺' | '❤️' | '🤔' | '🏳️' | '🥁';

/**
 * A single user's reaction to an article
 */
export interface ArticleReaction {
  id: string;
  articleId: string;
  userId: string;
  emoji: ArticleReactionType;
  createdAt: string;
}

/**
 * Aggregated reaction counts for an article
 */
export interface ArticleReactionCounts {
  '👏': number;
  '🔥': number;
  '💯': number;
  '🎺': number;
  '❤️': number;
  '🤔': number;
  '🏳️': number;
  '🥁': number;
  total: number;
}

/**
 * User's current reaction state for an article
 */
export interface UserArticleReaction {
  emoji: ArticleReactionType | null;
  reactionId: string | null;
}

/**
 * Comment status for moderation
 */
export type CommentStatus = 'pending' | 'approved' | 'rejected' | 'hidden';

/**
 * A comment on an article
 */
export interface ArticleComment {
  id: string;
  articleId: string;
  userId: string;
  userName: string;
  userTitle?: string;
  content: string;
  status: CommentStatus;
  createdAt: string;
  updatedAt?: string;
  editedAt?: string;
  isEdited?: boolean;
  // Moderation fields
  moderatedAt?: string;
  moderatedBy?: string;
  moderationReason?: string;
  // Report tracking
  reportCount?: number;
  reportReasons?: string[];
}

/**
 * Article engagement stats (for display on cards)
 */
export interface ArticleEngagement {
  reactionCounts: ArticleReactionCounts;
  commentCount: number;
  userReaction?: ArticleReactionType | null;
}
