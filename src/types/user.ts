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
  yearsDirecting?: number; // Years spent fantasy directing on marching.art
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

  // Buy Me a Coffee supporter flair (server-only; granted by the BMAC webhook /
  // linkBmacSupport callable after payment is verified). Cosmetic recognition
  // only — never a competitive advantage.
  supporter?: {
    // 'friend' = a temporary one-time-donation recognition; the rest are the
    // recurring paid tiers.
    tier: 'friend' | 'rookie' | 'veteran' | 'staff' | 'corps_angel';
    source: 'bmac';
    emailHash: string;
    since?: Timestamp | null;
    anonymous?: boolean;
    message?: string | null;
    /** When one-time 'friend' recognition expires (null for recurring tiers). */
    until?: Timestamp | null;
  } | null;

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

  // Competition trophies — server-awarded nightly by scoringAwards.js
  trophies?: ProfileTrophies;

  // Lifetime per-caption mastery points — banked nightly by the scoring run
  captionStats?: CaptionStats;

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
  /** Purchased memorial plaque (purchaseRetirementPlaque callable) */
  plaque?: { tier: 'bronze' | 'silver' | 'gold'; purchasedAt: string };
}

/**
 * Lifetime per-caption mastery points (GE1..P), banked nightly by the
 * scoring run. Server-only; tiers derive from src/utils/captionMastery.js.
 */
export type CaptionStats = Record<string, number>;

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

/** One server-awarded competition trophy (written by scoringAwards.js) */
export interface CompetitionTrophy {
  type: string;
  corpsClass?: CorpsClass | string;
  // Class-final trophies store the class under `classType`; keep both spellings.
  classType?: CorpsClass | string;
  metal?: 'gold' | 'silver' | 'bronze';
  seasonName?: string;
  eventName?: string;
  score?: number;
  rank?: number;
}

/** The profile's trophy case, grouped by competition tier */
export interface ProfileTrophies {
  regionals?: CompetitionTrophy[];
  classChampionships?: CompetitionTrophy[];
  championships?: CompetitionTrophy[];
  finalistMedals?: CompetitionTrophy[];
  // SoundSport awards — International Festival (Day 49) + Regional Best in Show.
  soundSportAwards?: CompetitionTrophy[];
}

export interface LifetimeStats {
  totalPoints: number;
  totalSeasons: number;
  totalShows: number;
  bestSeasonScore: number;
  leagueChampionships: number;
  totalCorpsRetired: number;
  /** Director Rating (Phase 7.5): lifetime, placements-only, cross-class —
   * derived nightly by the leaderboard job, never stored on profiles. */
  directorRating?: number;
}

export interface UserSettings {
  theme: 'dark' | 'light';
  notifications: boolean;
  soundEffects: boolean;
  emailPreferences?: EmailPreferences;
  pushPreferences?: PushPreferences;
  /** @deprecated Legacy location only — profile/data is world-readable, so
   * the FCM token now lives on users/{uid}/private/data (saveFcmToken).
   * Backend readers fall back to this field for tokens saved pre-move. */
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
