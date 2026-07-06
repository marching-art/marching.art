// =============================================================================
// FIREBASE CLOUD FUNCTIONS
// =============================================================================
// Typed wrappers for all Firebase Cloud Functions
// Usage: import { registerCorps, dailyRehearsal } from '@/api/functions';

import { createCallable } from './callable';

// Article reactions, comments, engagement and admin moderation wrappers live in
// a separate module to keep this file under the max-lines guardrail.
export * from './articleSocial';

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
export const saveShowConcept = createCallable<{ corpsClass: string; showConcept: string }, void>(
  'saveShowConcept'
);
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

// =============================================================================
// EXECUTION SYSTEM
// =============================================================================

export interface RehearsalData {
  corpsClass: string;
}

export interface RehearsalResult {
  success: boolean;
  readinessGain: number;
  moraleChange: number;
  newReadiness: number;
  newMorale: number;
}

export const dailyRehearsal = createCallable<RehearsalData, RehearsalResult>('dailyRehearsal');
export const repairEquipment = createCallable<
  { corpsClass: string; equipmentType: string },
  { success: boolean }
>('repairEquipment');
export const upgradeEquipment = createCallable<
  { corpsClass: string; equipmentType: string },
  { success: boolean }
>('upgradeEquipment');
export const setShowDifficulty = createCallable<{ corpsClass: string; difficulty: number }, void>(
  'setShowDifficulty'
);
export const boostMorale = createCallable<
  { corpsClass: string },
  { success: boolean; newMorale: number }
>('boostMorale');
export const getExecutionStatus = createCallable<{ corpsClass: string }, unknown>(
  'getExecutionStatus'
);

// =============================================================================
// DAILY OPERATIONS
// =============================================================================

export interface ClaimDailyLoginResult {
  success: boolean;
  message: string;
  loginStreak: number;
  alreadyClaimed?: boolean;
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

export const joinRookieLeague = createCallable<
  void,
  { success: boolean; leagueId: string; leagueName: string; alreadyMember: boolean; message: string }
>('joinRookieLeague');

export const purchaseStreakFreeze = createCallable<
  void,
  { success: boolean; message: string; freezeUntil: string; newBalance: number }
>('purchaseStreakFreeze');

export interface CompleteDailyChallengeResult {
  success: boolean;
  xpAwarded: number;
  alreadyCompleted?: boolean;
  notInRotation?: boolean;
  challenge?: { id: string; label: string; xp: number };
  completedToday?: number;
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
export const discoverAndQueueUrls = createCallable<void, { success?: boolean; message?: string }>(
  'discoverAndQueueUrls'
);
// 3 min timeout: generates the full day's AI articles in one call
export const triggerDailyNews = createCallable<
  { currentDay?: number; dataDocId?: string; seasonId?: string },
  { success: boolean }
>('triggerDailyNews', { timeout: 180000 });

// =============================================================================
// ARTICLE MANAGEMENT (Admin)
// =============================================================================

export interface ArticleListItem {
  id: string;
  path: string;
  source: 'current_season' | 'legacy';
  reportDay?: number;
  headline: string;
  summary: string;
  isPublished: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt?: string;
  imageUrl?: string;
  category: string;
}

export interface ListAllArticlesData {
  limit?: number;
  startAfter?: string | null;
}

export interface ListAllArticlesResult {
  success: boolean;
  articles: ArticleListItem[];
  hasMore: boolean;
  lastCreatedAt: string | null;
}

export interface ArticleForEdit {
  id: string;
  path: string;
  headline: string;
  summary: string;
  fullStory?: string;
  narrative?: string; // Backend stores generated article content in 'narrative' field
  fantasyImpact?: string;
  dciRecap?: {
    title: string;
    narrative: string;
    captionLeaders?: unknown[];
    standings?: unknown[];
  };
  fantasySpotlight?: {
    title: string;
    narrative: string;
    topEnsembles?: unknown[];
    leagueLeaders?: unknown[];
  };
  crossOverAnalysis?: {
    title: string;
    narrative: string;
    roiHighlights?: unknown[];
    buyLowOpportunities?: unknown[];
    sellHighWarnings?: unknown[];
  };
  trendingCorps?: Array<{
    corps: string;
    direction: 'up' | 'down' | 'stable';
    reason: string;
  }>;
  imageUrl?: string;
  isPublished: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface GetArticleForEditResult {
  success: boolean;
  article: ArticleForEdit;
}

export interface UpdateArticleData {
  path: string;
  updates: Partial<{
    headline: string;
    summary: string;
    fullStory: string;
    narrative: string;
    fantasyImpact: string;
    dciRecap: ArticleForEdit['dciRecap'];
    fantasySpotlight: ArticleForEdit['fantasySpotlight'];
    crossOverAnalysis: ArticleForEdit['crossOverAnalysis'];
    trendingCorps: ArticleForEdit['trendingCorps'];
    imageUrl: string;
    isPublished: boolean;
    isArchived: boolean;
  }>;
}

export interface ArchiveArticleData {
  path: string;
  archive: boolean;
}

export interface DeleteArticleData {
  path: string;
  confirmDelete: boolean;
}

export const listAllArticles = createCallable<ListAllArticlesData | void, ListAllArticlesResult>(
  'listAllArticles'
);
export const getArticleForEdit = createCallable<{ path: string }, GetArticleForEditResult>(
  'getArticleForEdit'
);
export const updateArticle = createCallable<
  UpdateArticleData,
  { success: boolean; message: string }
>('updateArticle');
export const archiveArticle = createCallable<
  ArchiveArticleData,
  { success: boolean; message: string }
>('archiveArticle');
export const deleteArticle = createCallable<
  DeleteArticleData,
  { success: boolean; message: string }
>('deleteArticle');

// Regenerate AI image for an article
export interface RegenerateArticleImageData {
  path: string;
  headline: string;
  category?: string;
}

export interface RegenerateArticleImageResult {
  success: boolean;
  message: string;
  imageUrl?: string;
}

export const regenerateArticleImage = createCallable<
  RegenerateArticleImageData,
  RegenerateArticleImageResult
>('regenerateArticleImage');

// =============================================================================
// NEWS SUBMISSIONS (User-submitted articles for admin approval)
// =============================================================================

export interface SubmitNewsData {
  headline: string;
  summary: string;
  fullStory: string;
  category: NewsCategory;
  imageUrl?: string | null;
}

export interface SubmitNewsResult {
  success: boolean;
  message: string;
  submissionId?: string;
}

export const submitNewsForApproval = createCallable<SubmitNewsData, SubmitNewsResult>(
  'submitNewsForApproval'
);

// =============================================================================
// ADMIN ARTICLE MANAGEMENT
// =============================================================================

export interface NewsSubmission {
  id: string;
  headline: string;
  summary: string;
  fullStory: string;
  category: NewsCategory;
  imageUrl: string | null;
  status: 'pending' | 'approved' | 'rejected';
  authorUid: string;
  authorName: string;
  authorEmail: string | null;
  createdAt: string;
  updatedAt: string;
  rejectionReason?: string;
  publishedPath?: string;
  publishedImageUrl?: string;
}

export interface ListPendingSubmissionsData {
  status?: 'pending' | 'approved' | 'rejected' | 'all';
  limit?: number;
}

export interface ListPendingSubmissionsResult {
  success: boolean;
  submissions: NewsSubmission[];
  count: number;
}

export const listPendingSubmissions = createCallable<
  ListPendingSubmissionsData,
  ListPendingSubmissionsResult
>('listPendingSubmissions');

export interface ApproveSubmissionData {
  submissionId: string;
  /** @deprecated Use imageOption instead */
  generateImage?: boolean;
  /** 'submitted' = use submitted image, 'generate' = create AI image, 'none' = no image */
  imageOption?: 'submitted' | 'generate' | 'none';
}

export interface ApproveSubmissionResult {
  success: boolean;
  message: string;
  articlePath?: string;
  imageUrl?: string | null;
}

export const approveSubmission = createCallable<ApproveSubmissionData, ApproveSubmissionResult>(
  'approveSubmission'
);

export interface RejectSubmissionData {
  submissionId: string;
  reason?: string;
}

export interface RejectSubmissionResult {
  success: boolean;
  message: string;
}

export const rejectSubmission = createCallable<RejectSubmissionData, RejectSubmissionResult>(
  'rejectSubmission'
);

// =============================================================================
// AVATAR GENERATION
// =============================================================================

export interface GenerateAvatarData {
  corpsClass: 'soundSport' | 'aClass' | 'open' | 'world';
}

export interface GenerateAvatarResult {
  success: boolean;
  avatarUrl?: string;
  message: string;
}

export const generateCorpsAvatar = createCallable<GenerateAvatarData, GenerateAvatarResult>(
  'generateCorpsAvatar'
);
