import { Timestamp } from 'firebase/firestore';

import type { CorpsClass } from './corps';

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
