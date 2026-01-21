// =============================================================================
// API INDEX - Central export for all API modules
// =============================================================================
// This provides a clean interface for importing API functions throughout the app
// Usage: import { db, authApi, analytics, retireCorps } from '@/api';

// Re-export everything from client
export {
  // Firebase instances
  app,
  auth,
  db,
  functions,
  storage, // Note: null until getStorageInstance() is called
  getStorageInstance, // Lazy-loads Firebase Storage (~30KB deferred)
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

  // Backwards-compatible helpers
  adminHelpers,
  authHelpers,
} from './client';

// Backwards-compatible alias for dataNamespace
export { DATA_NAMESPACE as dataNamespace } from './client';

// Re-export analytics
export { analytics, analytics as analyticsHelpers } from './analytics';

// Re-export all cloud functions
export * from './functions';

// Re-export configuration
export {
  APP_CONFIG,
  DATA_CONFIG,
  AUTH_CONFIG,
  FIREBASE_CONFIG,
  GAME_CONFIG,
  FEATURE_FLAGS,
  DEV_CONFIG,
} from '../config';

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
  formatSeasonDisplayName,
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
  PLACEMENT_POINTS,
  getPlacementPoints,
} from './leagues';
export type { ChatMessage } from './leagues';

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
