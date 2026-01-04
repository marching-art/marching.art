// =============================================================================
// HOOKS INDEX
// =============================================================================
// Centralized exports for all custom hooks

// Existing hooks
export * from './useProfile';
export * from './useLeaderboard';
export * from './useLeagues';
export * from './useLeagueStats';

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
  useSeasonSetup,
  type UseSeasonSetupReturn,
} from './useSeasonSetup';

export {
  useClassUnlock,
  type UseClassUnlockReturn,
} from './useClassUnlock';

export {
  useReducedMotion,
  useShouldReduceMotion,
  useIsMobile,
} from './useReducedMotion';
