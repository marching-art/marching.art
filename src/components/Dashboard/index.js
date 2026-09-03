// src/components/Dashboard/index.js
// Modal components used by Dashboard (the celebration modals — class unlock,
// achievement — are gone: those moments are inbox rows plus a toast now).
export { default as CorpsRegistrationModal } from '../modals/CorpsRegistrationModal';
export { default as DeleteConfirmModal } from '../modals/DeleteCorpsModal';
export { default as RetireConfirmModal } from '../modals/RetireCorpsModal';
export { default as MoveCorpsModal } from '../modals/MoveCorpsModal';

// Onboarding and quick start components
export { default as OnboardingTour } from './OnboardingTour';
export { default as QuickStartGuide, QuickStartButton } from './QuickStartGuide';

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
  NextActionPanel,
  NoCorpsCard,
  ZoneTabs,
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
