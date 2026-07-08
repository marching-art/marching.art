// =============================================================================
// ARTICLE & NEWS SUBMISSION ADMIN
// =============================================================================
// Typed wrappers for admin-facing article management, user news submissions
// and avatar generation. Split out of functions.ts to keep that file under the
// max-lines guardrail.

import { createCallable } from './callable';
import type { NewsCategory } from '../types';

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
