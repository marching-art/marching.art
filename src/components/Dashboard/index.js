// src/components/Dashboard/index.js
// Export modal components used by Dashboard
export {
  ClassUnlockCongratsModal,
  CorpsRegistrationModal,
  EditCorpsModal,
  DeleteConfirmModal,
  RetireConfirmModal,
  MoveCorpsModal,
  AchievementModal,
  UniformDesignModal
} from './DashboardModals';

// Morning report component
export { default as MorningReport } from './MorningReport';

// Onboarding and quick start components
export { default as OnboardingTour } from './OnboardingTour';
export { default as QuickStartGuide, QuickStartButton } from './QuickStartGuide';

// SoundSport welcome component
export { default as SoundSportWelcome, SoundSportBanner } from './SoundSportWelcome';

// Dashboard panel sub-components (extracted for code splitting)
export { default as TeamSwitcher } from './TeamSwitcher';
export { default as LineupPanel } from './LineupPanel';
export { default as StandingsPanel } from './StandingsPanel';
export { default as SchedulePanel } from './SchedulePanel';
