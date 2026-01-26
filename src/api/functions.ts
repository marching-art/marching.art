// =============================================================================
// FIREBASE CLOUD FUNCTIONS
// =============================================================================
// Typed wrappers for all Firebase Cloud Functions
// Usage: import { registerCorps, dailyRehearsal } from '@/api/functions';

import { httpsCallable, HttpsCallableResult } from 'firebase/functions';
import { functions } from './client';

// =============================================================================
// TYPE HELPERS
// =============================================================================

/**
 * Create a typed callable function wrapper
 */
function createCallable<TData = void, TResult = unknown>(name: string) {
  const callable = httpsCallable<TData, TResult>(functions, name);
  return async (data?: TData): Promise<HttpsCallableResult<TResult>> => {
    return callable(data as TData);
  };
}

// =============================================================================
// USER MANAGEMENT
// =============================================================================

export const checkUsername = createCallable<{ username: string }, { available: boolean }>('checkUsername');
export const createUserProfile = createCallable<{ username: string; displayName?: string }, void>('createUserProfile');
export const setUserRole = createCallable<{ uid: string; role: string }, void>('setUserRole');
export const getShowRegistrations = createCallable<{ showId: string }, unknown>('getShowRegistrations');
export const getUserRankings = createCallable<{ uid: string }, unknown>('getUserRankings');
// Renamed to avoid conflict with profile.ts updateProfile (local Firestore)
export const updateProfileCF = createCallable<{ displayName?: string; bio?: string }, void>('updateProfile');
export const getPublicProfile = createCallable<{ uid: string }, unknown>('getPublicProfile');

// =============================================================================
// CORPS & LINEUP
// =============================================================================

export interface RegisterCorpsData {
  corpsName: string;
  location: string;
  description?: string;
  class: 'soundSport' | 'aClass' | 'openClass' | 'worldClass';
}

export const registerCorps = createCallable<RegisterCorpsData, { success: boolean }>('registerCorps');
export const saveLineup = createCallable<{ corpsClass: string; lineup: Record<string, string>; forceUpdate?: boolean }, void>('saveLineup');
export const selectUserShows = createCallable<{ corpsClass: string; showIds: string[] }, void>('selectUserShows');
export const validateAndSaveLineup = createCallable<{ corpsClass: string; lineup: unknown }, { valid: boolean }>('validateAndSaveLineup');
export const saveShowConcept = createCallable<{ corpsClass: string; showConcept: string }, void>('saveShowConcept');

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

export const validateLineup = createCallable<{ corpsClass: string }, ValidateLineupResult>('validateLineup');

// =============================================================================
// CORPS MANAGEMENT
// =============================================================================

export interface RetireCorpsData {
  corpsClass: string;
  corpsName: string;
}

export const retireCorps = createCallable<RetireCorpsData, { success: boolean }>('retireCorps');
export const unretireCorps = createCallable<{ corpsClass: string }, { success: boolean }>('unretireCorps');

// =============================================================================
// ECONOMY
// =============================================================================

export const unlockClassWithCorpsCoin = createCallable<{ classToUnlock: string }, { success: boolean; classUnlocked: string; newBalance: number }>('unlockClassWithCorpsCoin');

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
export const repairEquipment = createCallable<{ corpsClass: string; equipmentType: string }, { success: boolean }>('repairEquipment');
export const upgradeEquipment = createCallable<{ corpsClass: string; equipmentType: string }, { success: boolean }>('upgradeEquipment');
export const setShowDifficulty = createCallable<{ corpsClass: string; difficulty: number }, void>('setShowDifficulty');
export const boostMorale = createCallable<{ corpsClass: string }, { success: boolean; newMorale: number }>('boostMorale');
export const getExecutionStatus = createCallable<{ corpsClass: string }, unknown>('getExecutionStatus');

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
  newLevel?: number;
  classUnlocked?: string;
}

export const claimDailyLogin = createCallable<void, ClaimDailyLoginResult>('claimDailyLogin');

// =============================================================================
// LEADERBOARDS
// =============================================================================

export const updateLifetimeLeaderboard = createCallable<void, { success: boolean }>('updateLifetimeLeaderboard');

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
export const createLeagueCF = createCallable<CreateLeagueData, { leagueId: string }>('createLeague');
export const joinLeagueCF = createCallable<{ leagueId: string } | { inviteCode: string }, { success: boolean }>('joinLeague');
export const leaveLeagueCF = createCallable<{ leagueId: string }, { success: boolean }>('leaveLeague');
export const generateMatchups = createCallable<{ leagueId: string }, { matchups: unknown[] }>('generateMatchups');
export const updateMatchupResults = createCallable<{ matchupId: string; results: unknown }, void>('updateMatchupResults');
export const postLeagueMessageCF = createCallable<{ leagueId: string; message: string }, { messageId: string }>('postLeagueMessage');
export const sendCommentNotification = createCallable<{ targetUid: string; commentId: string }, void>('sendCommentNotification');
export const deleteComment = createCallable<{ commentId: string }, { success: boolean }>('deleteComment');
export const reportComment = createCallable<{ commentId: string; reason: string }, { success: boolean }>('reportComment');

// =============================================================================
// ADMIN
// =============================================================================

export const startNewOffSeason = createCallable<{ seasonNumber: number }, { success: boolean }>('startNewOffSeason');
export const startNewLiveSeason = createCallable<{ year: number }, { success: boolean }>('startNewLiveSeason');
export const manualTrigger = createCallable<{ action: string; params?: unknown }, { success: boolean }>('manualTrigger');

// =============================================================================
// NEWS HUB
// =============================================================================

import type { NewsCategory, NewsEntry } from '../types';

export interface GetRecentNewsParams {
  limit?: number;
  category?: NewsCategory;
  startAfter?: string;
  includeEngagement?: boolean;  // Fetch engagement data in same request
  feedOnly?: boolean;           // Return minimal fields for feed display (no full content)
}

export interface GetRecentNewsResult {
  success: boolean;
  news: NewsEntry[];
  hasMore?: boolean;
  engagement?: Record<string, {
    commentCount: number;
    reactionCounts: Record<string, number>;
  }>;
  fromCache?: boolean;  // Indicates if response was served from server cache
  cacheAge?: number;    // Age of cached data in milliseconds
}

export const getRecentNews = createCallable<GetRecentNewsParams, GetRecentNewsResult>('getRecentNews');

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

  try {
    // Use the proxied endpoint via Firebase Hosting (enables CDN caching)
    const response = await fetch(`/api/news?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const data = await response.json();
    return data as GetRecentNewsResult;
  } catch (error) {
    // Fall back to callable function (works during local development)
    console.warn('HTTP news fetch failed, falling back to callable:', error);
    const result = await getRecentNews({ limit, category, feedOnly: true, includeEngagement: true });
    return result.data;
  }
}
export const triggerNewsGeneration = createCallable<{ type: 'dci' | 'fantasy'; data: unknown }, { success: boolean; result?: unknown }>('triggerNewsGeneration');

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

export const listAllArticles = createCallable<ListAllArticlesData | void, ListAllArticlesResult>('listAllArticles');
export const getArticleForEdit = createCallable<{ path: string }, GetArticleForEditResult>('getArticleForEdit');
export const updateArticle = createCallable<UpdateArticleData, { success: boolean; message: string }>('updateArticle');
export const archiveArticle = createCallable<ArchiveArticleData, { success: boolean; message: string }>('archiveArticle');
export const deleteArticle = createCallable<DeleteArticleData, { success: boolean; message: string }>('deleteArticle');

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

export const regenerateArticleImage = createCallable<RegenerateArticleImageData, RegenerateArticleImageResult>('regenerateArticleImage');

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

export const submitNewsForApproval = createCallable<SubmitNewsData, SubmitNewsResult>('submitNewsForApproval');

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

export const listPendingSubmissions = createCallable<ListPendingSubmissionsData, ListPendingSubmissionsResult>('listPendingSubmissions');

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

export const approveSubmission = createCallable<ApproveSubmissionData, ApproveSubmissionResult>('approveSubmission');

export interface RejectSubmissionData {
  submissionId: string;
  reason?: string;
}

export interface RejectSubmissionResult {
  success: boolean;
  message: string;
}

export const rejectSubmission = createCallable<RejectSubmissionData, RejectSubmissionResult>('rejectSubmission');

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

export const generateCorpsAvatar = createCallable<GenerateAvatarData, GenerateAvatarResult>('generateCorpsAvatar');

// =============================================================================
// ARTICLE REACTIONS
// =============================================================================

import type { ArticleReactionType, ArticleReactionCounts, ArticleComment, CommentStatus, ArticleEngagement } from '../types';

export interface ToggleArticleReactionData {
  articleId: string;
  emoji: ArticleReactionType;
}

export interface ToggleArticleReactionResult {
  success: boolean;
  action: 'added' | 'removed' | 'changed';
  emoji: ArticleReactionType | null;
}

export const toggleArticleReaction = createCallable<ToggleArticleReactionData, ToggleArticleReactionResult>('toggleArticleReaction');

export interface GetArticleReactionsData {
  articleId: string;
}

export interface GetArticleReactionsResult {
  success: boolean;
  counts: ArticleReactionCounts;
  userReaction: ArticleReactionType | null;
}

export const getArticleReactions = createCallable<GetArticleReactionsData, GetArticleReactionsResult>('getArticleReactions');

// =============================================================================
// ARTICLE COMMENTS
// =============================================================================

export interface AddArticleCommentData {
  articleId: string;
  content: string;
}

export interface AddArticleCommentResult {
  success: boolean;
  comment: ArticleComment;
  message: string;
}

export const addArticleComment = createCallable<AddArticleCommentData, AddArticleCommentResult>('addArticleComment');

export interface GetArticleCommentsData {
  articleId: string;
  status?: CommentStatus | 'all';
  limit?: number;
  startAfter?: string;
}

export interface GetArticleCommentsResult {
  success: boolean;
  comments: ArticleComment[];
  hasMore: boolean;
  total: number;
}

export const getArticleComments = createCallable<GetArticleCommentsData, GetArticleCommentsResult>('getArticleComments');

export interface EditArticleCommentData {
  commentId: string;
  content: string;
}

export interface EditArticleCommentResult {
  success: boolean;
  comment: ArticleComment;
  message: string;
}

export const editArticleComment = createCallable<EditArticleCommentData, EditArticleCommentResult>('editArticleComment');

export interface DeleteArticleCommentData {
  commentId: string;
}

export interface DeleteArticleCommentResult {
  success: boolean;
  message: string;
}

export const deleteArticleComment = createCallable<DeleteArticleCommentData, DeleteArticleCommentResult>('deleteArticleComment');

export interface ReportArticleCommentData {
  commentId: string;
  reason: string;
}

export interface ReportArticleCommentResult {
  success: boolean;
  message: string;
}

export const reportArticleComment = createCallable<ReportArticleCommentData, ReportArticleCommentResult>('reportArticleComment');

// =============================================================================
// ARTICLE ENGAGEMENT (Combined reactions + comments count)
// =============================================================================

export interface GetArticleEngagementData {
  articleIds: string[];
}

export interface GetArticleEngagementResult {
  success: boolean;
  engagement: Record<string, ArticleEngagement>;
}

export const getArticleEngagement = createCallable<GetArticleEngagementData, GetArticleEngagementResult>('getArticleEngagement');

// =============================================================================
// ADMIN COMMENT MODERATION
// =============================================================================

export interface ListCommentsForModerationData {
  status?: CommentStatus | 'all';
  limit?: number;
  startAfter?: string;
}

export interface ListCommentsForModerationResult {
  success: boolean;
  comments: (ArticleComment & { articleHeadline?: string })[];
  hasMore: boolean;
  counts: {
    pending: number;
    approved: number;
    rejected: number;
    hidden: number;
    total: number;
  };
}

export const listCommentsForModeration = createCallable<ListCommentsForModerationData, ListCommentsForModerationResult>('listCommentsForModeration');

export interface ModerateCommentData {
  commentId: string;
  action: 'approve' | 'reject' | 'hide';
  reason?: string;
}

export interface ModerateCommentResult {
  success: boolean;
  comment: ArticleComment;
  message: string;
}

export const moderateComment = createCallable<ModerateCommentData, ModerateCommentResult>('moderateComment');

export interface BulkModerateCommentsData {
  commentIds: string[];
  action: 'approve' | 'reject' | 'hide';
  reason?: string;
}

export interface BulkModerateCommentsResult {
  success: boolean;
  moderated: number;
  failed: number;
  message: string;
}

export const bulkModerateComments = createCallable<BulkModerateCommentsData, BulkModerateCommentsResult>('bulkModerateComments');
