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

  // Stats
  lifetimeStats?: LifetimeStats;

  // Daily challenges (keyed by date string)
  challenges?: Record<string, DailyChallenge[]>;
  dailyChallenges?: DailyChallenges; // Legacy/alternative structure

  // Engagement tracking
  engagement?: EngagementData;

  // Achievements
  achievements?: Achievement[];

  // Settings
  settings?: UserSettings;
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
}

// =============================================================================
// CORPS TYPES
// =============================================================================

export type CorpsClass = 'soundSport' | 'aClass' | 'open' | 'world';

export interface CorpsData {
  corpsName: string;
  name?: string; // Legacy field
  location: string;
  showConcept: string;
  corpsClass: CorpsClass;
  createdAt: Timestamp;

  // Season stats
  totalSeasonScore: number;
  showsAttended: number;
  seasonHighScore: number;

  // Execution state
  readiness: number;
  morale: number;
  lastRehearsalDate?: string;
  rehearsalsToday: number;

  // Equipment
  equipment?: Equipment;

  // Staff assignments (caption -> staffId)
  assignedStaff?: Record<Caption, string>;

  // Show selections (keyed by week number)
  selectedShows?: Record<string, string[]>;

  // Lineup
  lineup?: Lineup;
}

export interface Equipment {
  brass: EquipmentItem;
  percussion: EquipmentItem;
  colorGuard: EquipmentItem;
}

export interface EquipmentItem {
  level: number;
  condition: number;
  maxCondition: number;
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
// STAFF TYPES
// =============================================================================

export type Caption =
  | 'GE1' | 'GE2'
  | 'VP' | 'VA' | 'CG'
  | 'B' | 'MA' | 'P';

export interface Staff {
  staffId: string;
  name: string;
  caption: Caption;
  rating: number;
  currentValue: number;
  originalValue: number;

  // Ownership
  ownerId?: string;
  ownerUsername?: string;

  // Assignment
  assignedCorpsClass?: CorpsClass;

  // Marketplace
  forSale?: boolean;
  auctionEndTime?: Timestamp;
  currentBid?: number;
  currentBidderId?: string;

  // Stats
  seasonStats?: StaffSeasonStats;
}

export interface StaffSeasonStats {
  showsWorked: number;
  averageRating: number;
  bonusesEarned: number;
}

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
  xpReward: number;
  coinReward?: number;
  requirement: string;
  progress?: number;
  target?: number;
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
  showConcept: string;
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
