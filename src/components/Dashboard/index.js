// src/components/Dashboard/index.js
// Export modal components used by Dashboard
export {
  ClassUnlockCongratsModal,
  CorpsRegistrationModal,
  DeleteConfirmModal,
  RetireConfirmModal,
  MoveCorpsModal,
  AchievementModal,
  UniformDesignModal,
} from './DashboardModals';

// Onboarding and quick start components
export { default as OnboardingTour } from './OnboardingTour';
export { default as QuickStartGuide, QuickStartButton } from './QuickStartGuide';

// SoundSport welcome component
export { default as SoundSportWelcome, SoundSportBanner } from './SoundSportWelcome';

// OPTIMIZATION #4: Dashboard section components extracted from Dashboard.jsx
// These reduce the main file from 1600+ lines to ~400 lines and isolate renders
export {
  ControlBar,
  ActiveLineupTable,
  SeasonScorecard,
  RecentResultsFeed,
  RivalsPanel,
  DailyChallenges,
  LineupSimulatorPanel,
  PredictionGamePanel,
  AchievementTrackerPanel,
  JourneyPanel,
  SeasonLadderPanel,
  SeasonProgressHub,
  DirectorsReport,
  // Constants
  CLASS_LABELS,
  CLASS_SHORT_LABELS,
  CAPTIONS,
  CLASS_UNLOCK_LEVELS,
  CLASS_UNLOCK_COSTS,
  CLASS_DISPLAY_NAMES,
  SOUNDSPORT_RATING_THRESHOLDS,
  getSoundSportRating,
} from './sections';
