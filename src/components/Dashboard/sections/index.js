// Dashboard section components
// OPTIMIZATION #4: Extracted from monolithic Dashboard.jsx to enable code-splitting
// and isolate renders for better performance

export { default as ControlBar } from './ControlBar';
export { default as ActiveLineupTable } from './ActiveLineupTable';
export { default as SeasonScorecard } from './SeasonScorecard';
export { default as RecentResultsFeed } from './RecentResultsFeed';
export { default as RivalsPanel } from './RivalsPanel';
export { default as DailyChallenges } from './DailyChallenges';
export { default as LineupSimulatorPanel } from './LineupSimulatorPanel';
export { default as PredictionGamePanel } from './PredictionGamePanel';
export { default as AchievementTrackerPanel } from './AchievementTrackerPanel';
export { default as JourneyPanel } from './JourneyPanel';
export { default as SeasonLadderPanel } from './SeasonLadderPanel';
export { default as SeasonProgressHub } from './SeasonProgressHub';
export { default as DirectorsReport } from './DirectorsReport';

// Re-export constants for convenience
export * from './constants';
