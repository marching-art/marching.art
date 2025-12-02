// API Index - Central export for all API modules
// This provides a clean interface for importing API functions throughout the app

// Re-export everything from client
export {
  // Firebase instances
  app,
  auth,
  db,
  functions,
  storage,
  DATA_NAMESPACE,

  // Auth API
  authApi,

  // Cloud function caller
  callFunction,

  // Path helpers
  paths,

  // Error handling
  ApiError,
  withErrorHandling,
} from './client';

// Re-export profile API
export {
  getProfile,
  subscribeToProfile,
  getCorps,
  createProfile,
  updateProfile,
  updateCorps,
  addXp,
  updateCorpsCoin,
  canAfford,
} from './profile';

// Re-export season API
export {
  getSeasonData,
  subscribeToSeason,
  getFantasyRecaps,
  getShowsByDay,
  getAllShows,
  calculateSeasonProgress,
  isRegistrationOpen,
  getSeasonTypeInfo,
  formatSeasonName,
  getGameDay,
  getGameDayDate,
} from './season';
export type { DayRecap, ShowWithResults } from './season';

// Re-export leagues API
export {
  getMyLeagues,
  getPublicLeagues,
  getLeague,
  subscribeToLeague,
  getLeagueStandings,
  subscribeToStandings,
  createLeague,
  joinLeague,
  leaveLeague,
  subscribeToChat,
  postChatMessage,
  subscribeToTrades,
  proposeStaffTrade,
  respondToTrade,
  PLACEMENT_POINTS,
  getPlacementPoints,
} from './leagues';
export type { ChatMessage, Trade } from './leagues';

// Re-export leaderboard API
export {
  getLeaderboard,
  getLifetimeLeaderboard,
  getUserRank,
  getUserContext,
  getLeaderboardStats,
  getRankDisplay,
  LIFETIME_VIEWS,
} from './leaderboard';
export type { LeaderboardStats, LifetimeViewId } from './leaderboard';

// Re-export types for convenience
export type {
  // User & Profile
  User,
  UserProfile,
  LifetimeStats,
  UserSettings,

  // Corps
  CorpsClass,
  CorpsData,
  Equipment,
  EquipmentItem,
  Lineup,
  LineupSlot,

  // Staff
  Caption,
  Staff,
  StaffSeasonStats,

  // Season
  SeasonType,
  SeasonData,
  SeasonSchedule,

  // Shows & Scores
  Show,
  ShowResult,
  CaptionScores,

  // Leagues
  League,
  LeagueSettings,
  LeagueStanding,

  // Leaderboard
  LeaderboardEntry,
  LeaderboardType,

  // Challenges & Achievements
  DailyChallenges,
  DailyChallenge,
  Achievement,

  // API
  ApiResponse,
  PaginatedResponse,

  // Forms
  CorpsRegistrationData,
  LeagueCreationData,

  // Utilities
  LoadingState,
  AsyncState,
  WithId,
  DeepPartial,
} from '../types';
