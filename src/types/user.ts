import { Timestamp } from 'firebase/firestore';

import type { CorpsClass, CorpsData } from './corps';
import type { Achievement, DailyChallenge, DailyChallenges } from './challenges';

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

export interface DirectorSocialLinks {
  website?: string;
  twitter?: string;
  instagram?: string;
  youtube?: string;
  tiktok?: string;
  facebook?: string;
  discord?: string;
}

export interface DirectorProfileInfo {
  // Director bio - about the person directing
  bio?: string; // Short bio / directing philosophy
  yearsDirecting?: number; // Real-world years as a director/instructor
  specialties?: string[]; // e.g., ["General Effect", "Visual", "Music", "Color Guard"]
  credentials?: string; // Education, certifications, background

  // Public contact / social
  socialLinks?: DirectorSocialLinks;

  // Community settings
  acceptingLeagueInvites?: boolean; // Open to league invitations
  profileVisibility?: 'public' | 'members';
}

export interface EnsembleProfileInfo {
  // Ensemble identity (per-corps, preserved across seasons)
  tagline?: string; // Short one-liner
  mission?: string; // Mission statement / purpose
  history?: string; // Ensemble history / backstory
  foundedYear?: number; // Year the fantasy ensemble was founded
  homeVenue?: string; // Home field / rehearsal site
  motto?: string; // Motto or tagline

  // Notable past shows and achievements (director-authored)
  notableShows?: string[]; // e.g., ["Metamorphosis (2024)", "Rebirth (2023)"]
}

export interface UserProfile {
  uid: string;
  username: string;
  displayName: string;
  email: string;
  createdAt: Timestamp;
  lastLogin: Timestamp;
  photoURL?: string;
  location?: string;

  // Director-level profile info (community-facing)
  directorInfo?: DirectorProfileInfo;

  // XP & Progression
  xp: number;
  xpLevel: number;
  userTitle: string;
  /** Highest level already paid the level-up CC stipend (server-only) */
  lastRewardedLevel?: number;
  /** XP total at season start — season ladder baseline (server-only) */
  xpAtSeasonStart?: number;
  /** Season reward ladder claims (server-only) */
  seasonLadder?: { seasonUid: string; claimed: number[] } | null;

  // Currency
  corpsCoin: number;

  // Corps Identity Shop cosmetics (server-only field; purchased with CC)
  cosmetics?: {
    owned?: string[];
    equipped?: Record<string, string | null>;
  };

  // Unlocks
  unlockedClasses: CorpsClass[];

  // Corps data (keyed by class)
  corps: Record<CorpsClass, CorpsData | undefined>;

  // Quick stats (aggregated)
  stats?: {
    seasonsPlayed?: number;
    championships?: number;
    topTenFinishes?: number;
    leagueWins?: number;
  };

  // Lifetime stats (detailed)
  lifetimeStats?: LifetimeStats;

  // Daily challenges (keyed by date string)
  challenges?: Record<string, DailyChallenge[]>;
  dailyChallenges?: DailyChallenges; // Legacy/alternative structure

  // Engagement tracking
  engagement?: EngagementData;

  // Achievements
  achievements?: Achievement[];

  // Retired corps history
  retiredCorps?: RetiredCorps[];

  // Season tracking
  activeSeasonId?: string; // Current season the user is participating in
  initialSetupComplete?: string; // Season ID when initial setup wizard was completed

  // Profile avatar selection - which corps uniform to display
  profileAvatarCorps?: CorpsClass;

  // Settings
  settings?: UserSettings;
}

export interface RetiredCorps {
  corpsName: string;
  corpsClass: CorpsClass;
  retiredAt: string;
  finalScore?: number;
  seasonsPlayed?: number;
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
  emailPreferences?: EmailPreferences;
  pushPreferences?: PushPreferences;
  fcmToken?: string;
}

export interface EmailPreferences {
  // Master toggle - if false, no emails are sent
  allEmails: boolean;
  // Individual email type preferences
  welcome?: boolean;
  streakBroken?: boolean;
  weeklyDigest?: boolean;
  winBack?: boolean;
  lineupReminder?: boolean;
  leagueActivity?: boolean;
  milestoneAchieved?: boolean;
}

export type EmailType =
  | 'welcome'
  | 'streak_broken'
  | 'weekly_digest'
  | 'win_back'
  | 'lineup_reminder'
  | 'league_activity'
  | 'milestone_achieved';

export interface PushPreferences {
  // Master toggle - if false, no push notifications are sent
  allPush: boolean;
  // Individual push notification type preferences
  matchupStart?: boolean;
  matchupResult?: boolean;
  scoreUpdate?: boolean;
  leagueActivity?: boolean;
  tradeProposal?: boolean;
  showReminder?: boolean;
}

export type PushNotificationType =
  | 'matchup_start'
  | 'matchup_result'
  | 'score_update'
  | 'league_activity'
  | 'trade_proposal'
  | 'show_reminder';
