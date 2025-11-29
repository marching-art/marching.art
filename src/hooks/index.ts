// =============================================================================
// HOOKS INDEX
// =============================================================================
// Centralized exports for all custom hooks

// Existing hooks
export * from './useProfile';
export * from './useLeaderboard';
export * from './useLeagues';

// New modular hooks (from useDashboardData refactor)
export {
  useCorpsSelection,
  getCorpsClassName,
  getCorpsClassColor,
  type UseCorpsSelectionReturn,
} from './useCorpsSelection';

export {
  useEngagement,
  type EngagementData,
  type ActivityItem,
  type WeeklyProgressData,
  type UseEngagementReturn,
} from './useEngagement';

export {
  useBattlePass,
  type BattlePassProgress,
  type BattlePassReward,
  type UseBattlePassReturn,
} from './useBattlePass';

export {
  useChallenges,
  type Challenge,
  type WeeklyProgress,
  type UseChallengesReturn,
} from './useChallenges';

export {
  useSeasonSetup,
  type UseSeasonSetupReturn,
} from './useSeasonSetup';

export {
  useClassUnlock,
  type UseClassUnlockReturn,
} from './useClassUnlock';
