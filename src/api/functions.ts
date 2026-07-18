// =============================================================================
// FIREBASE CLOUD FUNCTIONS
// =============================================================================
// Typed wrappers for all Firebase Cloud Functions
// Usage: import { registerCorps, claimDailyLogin } from '@/api/functions';

import { createCallable } from './callable';

// Article reactions, comments, engagement and admin moderation wrappers live in
// a separate module to keep this file under the max-lines guardrail.
export * from './articleSocial';
// Admin article management, user news submissions and avatar generation
// wrappers likewise live in their own module for the same reason.
export * from './articleAdmin';
// Podium Class callables (Phase 2).
export * from './podium';

// =============================================================================
// USER MANAGEMENT
// =============================================================================

export const checkUsername = createCallable<{ username: string }, { available: boolean }>(
  'checkUsername'
);
export const createUserProfile = createCallable<{ username: string; displayName?: string }, void>(
  'createUserProfile'
);
export const setUserRole = createCallable<
  { email: string; makeAdmin: boolean },
  { message: string }
>('setUserRole');
export const getShowRegistrations = createCallable<{ showId: string }, unknown>(
  'getShowRegistrations'
);
export const getUserRankings = createCallable<{ uid: string }, unknown>('getUserRankings');
// Renamed to avoid conflict with profile.ts updateProfile (local Firestore)
export const updateProfileCF = createCallable<{ displayName?: string; bio?: string }, void>(
  'updateProfile'
);
export const getPublicProfile = createCallable<{ uid: string }, unknown>('getPublicProfile');
export const updateUsername = createCallable<{ username: string }, { success: boolean }>(
  'updateUsername'
);
export const updateEmail = createCallable<{ email: string }, { success: boolean }>('updateEmail');
export const deleteAccount = createCallable<void, { success: boolean }>('deleteAccount');

// =============================================================================
// CORPS & LINEUP
// =============================================================================

export interface RegisterCorpsData {
  corpsName: string;
  location: string;
  description?: string;
  class: 'soundSport' | 'aClass' | 'openClass' | 'worldClass';
}

export const registerCorps = createCallable<RegisterCorpsData, { success: boolean }>(
  'registerCorps'
);
export const saveLineup = createCallable<
  { corpsClass: string; lineup: Record<string, string>; forceUpdate?: boolean },
  void
>('saveLineup');
export const selectUserShows = createCallable<
  { week: number; shows: unknown[]; corpsClass: string },
  void
>('selectUserShows');
export const saveShowConcept = createCallable<
  {
    corpsClass: string;
    showConcept: { showName?: string; theme: string; musicSource: string; drillStyle: string };
  },
  { success: boolean; message: string }
>('saveShowConcept');
export const getHotCorps = createCallable<void, { hotCorps: Record<string, unknown> }>(
  'getHotCorps'
);
export const getActiveLineupKeys = createCallable<{ corpsClass: string }, { lineupKeys: string[] }>(
  'getActiveLineupKeys'
);
export const processCorpsDecisions = createCallable<
  { decisions: unknown[] },
  { corpsNeedingSetup?: unknown[] }
>('processCorpsDecisions');

// Lineup validation
export interface InvalidLineupSelection {
  caption: string;
  corpsName: string;
  sourceYear: string;
  fullSelection: string;
}

export interface ValidateLineupResult {
  success: boolean;
  isValid: boolean;
  invalidSelections: InvalidLineupSelection[];
  requiresUpdate: boolean;
}

export const validateLineup = createCallable<{ corpsClass: string }, ValidateLineupResult>(
  'validateLineup'
);

// =============================================================================
// CORPS MANAGEMENT
// =============================================================================

export interface RetireCorpsData {
  corpsClass: string;
  checkOnly?: boolean;
}

export const retireCorps = createCallable<RetireCorpsData, { success: boolean; message?: string }>(
  'retireCorps'
);
export const unretireCorps = createCallable<
  { corpsClass: string; retiredIndex: number },
  { success: boolean }
>('unretireCorps');

export interface TransferCorpsData {
  fromClass: string;
  toClass: string;
}

export interface TransferCorpsResult {
  success: boolean;
  message: string;
  vacatedClass: string;
  corpsName: string;
}

export const transferCorps = createCallable<TransferCorpsData, TransferCorpsResult>(
  'transferCorps'
);

export interface DuplicateCorpsConflict {
  winnerUid: string;
  winnerCorpsClass: string;
  winnerCorpsName: string;
}

export interface DuplicateCorpsEntry {
  corpsClass: string;
  corpsName: string;
  conflictsWith: DuplicateCorpsConflict | null;
}

export const detectMyDuplicateCorps = createCallable<void, { duplicates: DuplicateCorpsEntry[] }>(
  'detectMyDuplicateCorps'
);

export const renameCorps = createCallable<
  { corpsClass: string; newName: string },
  { success: boolean; oldName: string; newName: string }
>('renameCorps');

export interface SweepDuplicateCorpsResult {
  success: boolean;
  scanned: number;
  flagged: number;
  cleared: number;
  directorsAffected: number;
  losers: Array<{
    uid: string;
    corpsClass: string;
    corpsName: string;
    winner: { uid: string; corpsClass: string; corpsName: string };
  }>;
}

export const sweepDuplicateCorps = createCallable<void, SweepDuplicateCorpsResult>(
  'sweepDuplicateCorps'
);

// =============================================================================
// ECONOMY
// =============================================================================

export const unlockClassWithCorpsCoin = createCallable<
  { classToUnlock: string },
  { success: boolean; classUnlocked: string; newBalance: number }
>('unlockClassWithCorpsCoin');

export interface CorpsCoinTransaction {
  id: string;
  type: string;
  amount: number;
  balance?: number;
  description: string;
  corpsClass?: string;
  timestamp?: { _seconds: number; _nanoseconds: number } | string | null;
}

export const getCorpsCoinHistory = createCallable<
  { limit?: number } | void,
  { success: boolean; balance: number; history: CorpsCoinTransaction[] }
>('getCorpsCoinHistory');

export interface EarningOpportunity {
  title: string;
  description: string;
  reward?: number;
  rewards?: Record<string, number>;
}

export interface SpendingOption {
  title: string;
  description: string;
  costs?: Record<string, number>;
  note?: string;
}

export const getEarningOpportunities = createCallable<
  void,
  {
    success: boolean;
    opportunities: Record<string, EarningOpportunity>;
    spending: Record<string, SpendingOption>;
  }
>('getEarningOpportunities');

// NOTE: the "execution system" client stubs (dailyRehearsal, repairEquipment,
// upgradeEquipment, setShowDifficulty, boostMorale, getExecutionStatus) were
// removed — the backend was intentionally cut (see GAMIFICATION.md, "Removed / out of scope") and none of
// the stubs had a server function or a component caller.

// =============================================================================
// DAILY OPERATIONS
// =============================================================================

export interface ClaimDailyLoginResult {
  success: boolean;
  message: string;
  loginStreak: number;
  alreadyClaimed?: boolean;
  streakBroken?: boolean;
  xpAwarded?: number;
  coinAwarded?: number;
  milestoneReached?: {
    days: number;
    title: string;
    xp: number;
    coin: number;
    freeFreeze?: boolean;
  };
  newAchievements?: Array<{
    id: string;
    title: string;
    description: string;
    icon: string;
    rarity: string;
    ccReward: number;
    earnedAt: string;
  }>;
  levelsGained?: number;
  newLevel?: number;
  classUnlocked?: string;
}

export const claimDailyLogin = createCallable<void, ClaimDailyLoginResult>('claimDailyLogin');

export interface StreakStatusResult {
  success: boolean;
  streak: number;
  lastLogin: string | null;
  hasActiveFreeze: boolean;
  freezeExpiresAt: string | null;
  canPurchaseFreeze: boolean;
  freezeCooldownDays: number;
  freezeCost: number;
  isAtRisk: boolean;
  hoursUntilAtRisk: number | null;
  nextMilestone: {
    days: number;
    rewards: { xp: number; coin: number; title: string; freeFreeze?: boolean };
    daysRemaining: number;
  } | null;
}

export const getStreakStatus = createCallable<void, StreakStatusResult>('getStreakStatus');

export interface CompleteJourneyStepResult {
  success: boolean;
  alreadyCompleted?: boolean;
  step?: { id: string; title: string };
  xpAwarded: number;
  coinAwarded: number;
  newLevel?: number;
  classUnlocked?: string | null;
}

export const completeJourneyStep = createCallable<{ stepId: string }, CompleteJourneyStepResult>(
  'completeJourneyStep'
);

export const purchaseShopItem = createCallable<
  { itemId: string },
  { success: boolean; itemId: string; name: string; newBalance: number; message: string }
>('purchaseShopItem');

export const equipShopItem = createCallable<
  { itemId: string | null; slot?: string },
  { success: boolean; slot: string; itemId: string | null; message: string }
>('equipShopItem');

export const claimLadderTier = createCallable<
  { tier: number },
  {
    success: boolean;
    alreadyClaimed?: boolean;
    tier?: number;
    coinAwarded: number;
    grantItem?: string | null;
  }
>('claimLadderTier');

export const purchaseRetirementPlaque = createCallable<
  { retiredIndex: number; corpsName: string; tier: string },
  { success: boolean; tier: string; newBalance: number; message: string }
>('purchaseRetirementPlaque');

export const purchaseHallBanner = createCallable<
  { seasonId: string; corpsClass: string; message: string },
  { success: boolean; newBalance: number; message: string }
>('purchaseHallBanner');

export const joinRookieLeague = createCallable<
  void,
  {
    success: boolean;
    leagueId: string;
    leagueName: string;
    alreadyMember: boolean;
    message: string;
  }
>('joinRookieLeague');

export const joinLeaguePool = createCallable<
  { leagueId: string },
  { success: boolean; pot: number; ante?: number; alreadyIn?: boolean }
>('joinLeaguePool');

export const purchaseStreakFreeze = createCallable<
  void,
  { success: boolean; message: string; freezeUntil: string; newBalance: number }
>('purchaseStreakFreeze');

export interface CompleteDailyChallengeResult {
  success: boolean;
  xpAwarded: number;
  alreadyCompleted?: boolean;
  notInRotation?: boolean;
  notDoneYet?: boolean;
  challenge?: { id: string; label: string; xp: number };
  completedToday?: number;
  weeklyArcDays?: number;
  weeklyArcBonus?: { xp: number; coin: number } | null;
  newLevel?: number;
  classUnlocked?: string | null;
}

export const completeDailyChallenge = createCallable<
  { challengeId: string },
  CompleteDailyChallengeResult
>('completeDailyChallenge');

export interface SubmitPredictionData {
  questionId: string;
  pick: string;
  threshold?: number | null;
  corpsClass: string;
  snapshotEvent?: string | null;
}

export interface SubmitPredictionResult {
  success: boolean;
  picked?: string;
  alreadyPicked?: boolean;
  locked?: boolean;
}

export const submitPrediction = createCallable<SubmitPredictionData, SubmitPredictionResult>(
  'submitPrediction'
);

export interface ResolvePredictionsResult {
  success: boolean;
  resolvedDays: number;
  xpAwarded?: number;
  coinAwarded?: number;
  correct?: number;
  total?: number;
  newLevel?: number;
  classUnlocked?: string | null;
}

export const resolvePredictions = createCallable<void, ResolvePredictionsResult>(
  'resolvePredictions'
);

// =============================================================================
// LEADERBOARDS
// =============================================================================

export const updateLifetimeLeaderboard = createCallable<void, { success: boolean }>(
  'updateLifetimeLeaderboard'
);

// =============================================================================
// SOCIAL & LEAGUES
// =============================================================================

export interface CreateLeagueData {
  name: string;
  description: string;
  isPublic: boolean;
  maxMembers: number;
}

// Note: createLeague, joinLeague, leaveLeague are in leagues.ts with higher-level wrappers
// These raw CF exports are available with CF suffix if needed
export const createLeagueCF = createCallable<CreateLeagueData, { leagueId: string }>(
  'createLeague'
);
export const joinLeagueCF = createCallable<
  { leagueId: string } | { inviteCode: string },
  { success: boolean }
>('joinLeague');
export const leaveLeagueCF = createCallable<{ leagueId: string }, { success: boolean }>(
  'leaveLeague'
);
export const generateMatchups = createCallable<
  { leagueId: string; week: number },
  { success: boolean; matchups?: unknown[]; message?: string }
>('generateMatchups');
export const updateMatchupResults = createCallable<{ matchupId: string; results: unknown }, void>(
  'updateMatchupResults'
);
export const postLeagueMessageCF = createCallable<
  { leagueId: string; message: string },
  { messageId: string }
>('postLeagueMessage');
export const inviteDirectorToLeague = createCallable<
  { leagueId: string; inviteeUid: string; message?: string },
  { success: boolean }
>('inviteDirectorToLeague');
export const respondToLeagueInvitation = createCallable<
  { leagueId: string; accept: boolean },
  { success: boolean }
>('respondToLeagueInvitation');
export const sendCommentNotification = createCallable<
  { targetUid: string; commentId: string },
  void
>('sendCommentNotification');
export const deleteComment = createCallable<{ commentId: string }, { success: boolean }>(
  'deleteComment'
);
export const reportComment = createCallable<
  { commentId: string; reason: string },
  { success: boolean }
>('reportComment');

// =============================================================================
// ADMIN
// =============================================================================

export const startNewOffSeason = createCallable<{ seasonNumber: number }, { success: boolean }>(
  'startNewOffSeason'
);
export const startNewLiveSeason = createCallable<{ year: number }, { success: boolean }>(
  'startNewLiveSeason'
);
export const manualTrigger = createCallable<
  { action: string; params?: unknown },
  { success: boolean }
>('manualTrigger');

// =============================================================================
// NEWS HUB
// =============================================================================

import type { NewsCategory, NewsEntry } from '../types';

export interface GetRecentNewsParams {
  limit?: number;
  category?: NewsCategory;
  startAfter?: string;
  includeEngagement?: boolean; // Fetch engagement data in same request
  feedOnly?: boolean; // Return minimal fields for feed display (no full content)
}

export interface GetRecentNewsResult {
  success: boolean;
  news: NewsEntry[];
  hasMore?: boolean;
  engagement?: Record<
    string,
    {
      commentCount: number;
      reactionCounts: Record<string, number>;
    }
  >;
  fromCache?: boolean; // Indicates if response was served from server cache
  cacheAge?: number; // Age of cached data in milliseconds
}

export const getRecentNews = createCallable<GetRecentNewsParams, GetRecentNewsResult>(
  'getRecentNews'
);

// =============================================================================
// OPTIMIZED NEWS FETCH VIA HTTP ENDPOINT
// Uses Firebase Hosting CDN for edge caching - much faster than callable
// =============================================================================

/**
 * Fetch news via HTTP endpoint with CDN edge caching
 * This is significantly faster than the callable function for initial loads:
 * - Edge cached responses: ~20-50ms
 * - Fresh responses: ~200-400ms (vs ~500-1500ms for callable with cold start)
 *
 * Falls back to callable if HTTP fails (e.g., during local development)
 */
export async function fetchNewsFeedHttp(params: {
  limit?: number;
  category?: NewsCategory;
}): Promise<GetRecentNewsResult> {
  const { limit = 10, category } = params;

  // Build query string
  const queryParams = new URLSearchParams();
  queryParams.set('limit', String(limit));
  if (category) {
    queryParams.set('category', category);
  }

  // Firebase Hosting rewrites only work in production; skip HTTP path in dev
  if (!import.meta.env.PROD) {
    const result = await getRecentNews({
      limit,
      category,
      feedOnly: true,
      includeEngagement: true,
    });
    return result.data;
  }

  try {
    // Use the proxied endpoint via Firebase Hosting (enables CDN caching)
    const response = await fetch(`/api/news?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    // Guard against the SPA catch-all returning index.html instead of JSON
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error(`Unexpected content-type: ${contentType}`);
    }

    const data = await response.json();
    return data as GetRecentNewsResult;
  } catch {
    // Fall back to callable function
    const result = await getRecentNews({
      limit,
      category,
      feedOnly: true,
      includeEngagement: true,
    });
    return result.data;
  }
}
export const triggerNewsGeneration = createCallable<
  { type: 'dci' | 'fantasy'; data: unknown },
  { success: boolean; result?: unknown }
>('triggerNewsGeneration');
export const fixProfileFields = createCallable<void, { message: string }>('fixProfileFields');
export const scrapeLiveScoresNow = createCallable<void, { success?: boolean; message?: string }>(
  'scrapeLiveScoresNow'
);
export const backfillLiveScoresForDayRange = createCallable<
  { startDay: number; endDay: number; overwrite?: boolean },
  { success?: boolean; message?: string; count?: number; eventCount?: number }
>('backfillLiveScoresForDayRange');
export const discoverAndQueueUrls = createCallable<void, { success?: boolean; message?: string }>(
  'discoverAndQueueUrls'
);
export const discoverAndQueueEventUrls = createCallable<
  void,
  { success?: boolean; message?: string }
>('discoverAndQueueEventUrls');
export const buildLearnedSchedules = createCallable<
  void,
  { success?: boolean; message?: string; built?: number; scrapedKept?: number; skipped?: number }
>('buildLearnedSchedules');
export const getScheduleCoverage = createCallable<
  void,
  {
    success?: boolean;
    years?: Array<Record<string, unknown>>;
    totals?: Record<string, number>;
    pool?: { seasonId: string | null; size: number; unmapped: string[] };
  }
>('getScheduleCoverage');
// 3 min timeout: generates the full day's AI articles in one call
export const triggerDailyNews = createCallable<
  { currentDay?: number; dataDocId?: string; seasonId?: string },
  { success: boolean }
>('triggerDailyNews', { timeout: 180000 });

// Manually generate/backfill the season-summary article (Article 6) for a day.
// Bypasses the scoring run-guard, so it works for dark days that were already
// scored (which the automatic Pub/Sub trigger will not revisit).
export const triggerSeasonSummary = createCallable<
  { seasonId: string; dataDocId?: string; throughDay: number },
  { success: boolean; throughDay?: number; headline?: string; hasImage?: boolean; error?: string }
>('triggerSeasonSummary', { timeout: 300000 });

// =============================================================================
// BUY ME A COFFEE SUPPORTERS
// =============================================================================
// Link the email a supporter paid BMAC with to their account, then grant flair.
export const linkBmacSupport = createCallable<
  { email: string },
  { success: boolean; tier: string }
>('linkBmacSupport');
// Opt out of (or back into) being named on the public Supporters wall.
export const setSupporterVisibility = createCallable<
  { anonymous: boolean },
  { success: boolean; anonymous: boolean }
>('setSupporterVisibility');
// Set the short message shown beside a Corps Angel on the wall.
export const setSupporterMessage = createCallable<{ message: string }, { success: boolean }>(
  'setSupporterMessage'
);
export interface SupportersWallEntry {
  uid: string;
  tier: string;
  displayName: string;
  username: string | null;
  message: string | null;
}
export const getSupportersWall = createCallable<
  void,
  {
    supporters: SupportersWallEntry[];
    anonymousCount: number;
    tiers: Array<{ id: string; name: string; minAmount: number }>;
  }
>('getSupportersWall');
