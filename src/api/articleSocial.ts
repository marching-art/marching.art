// =============================================================================
// ARTICLE SOCIAL FUNCTIONS
// =============================================================================
// Typed wrappers for article reactions, comments, engagement and admin
// comment moderation Cloud Functions. Split out of functions.ts to keep that
// file under the max-lines guardrail.

import { createCallable } from './callable';
import type {
  ArticleReactionType,
  ArticleReactionCounts,
  ArticleComment,
  CommentStatus,
  ArticleEngagement,
} from '../types';

// =============================================================================
// ARTICLE REACTIONS
// =============================================================================

export interface ToggleArticleReactionData {
  articleId: string;
  emoji: ArticleReactionType;
}

export interface ToggleArticleReactionResult {
  success: boolean;
  action: 'added' | 'removed' | 'changed';
  emoji: ArticleReactionType | null;
}

export const toggleArticleReaction = createCallable<
  ToggleArticleReactionData,
  ToggleArticleReactionResult
>('toggleArticleReaction');

export interface GetArticleReactionsData {
  articleId: string;
}

export interface GetArticleReactionsResult {
  success: boolean;
  counts: ArticleReactionCounts;
  userReaction: ArticleReactionType | null;
}

export const getArticleReactions = createCallable<
  GetArticleReactionsData,
  GetArticleReactionsResult
>('getArticleReactions');

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

export const addArticleComment = createCallable<AddArticleCommentData, AddArticleCommentResult>(
  'addArticleComment'
);

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

export const getArticleComments = createCallable<GetArticleCommentsData, GetArticleCommentsResult>(
  'getArticleComments'
);

export interface EditArticleCommentData {
  commentId: string;
  content: string;
}

export interface EditArticleCommentResult {
  success: boolean;
  comment: ArticleComment;
  message: string;
}

export const editArticleComment = createCallable<EditArticleCommentData, EditArticleCommentResult>(
  'editArticleComment'
);

export interface DeleteArticleCommentData {
  commentId: string;
}

export interface DeleteArticleCommentResult {
  success: boolean;
  message: string;
}

export const deleteArticleComment = createCallable<
  DeleteArticleCommentData,
  DeleteArticleCommentResult
>('deleteArticleComment');

export interface ReportArticleCommentData {
  commentId: string;
  reason: string;
}

export interface ReportArticleCommentResult {
  success: boolean;
  message: string;
}

export const reportArticleComment = createCallable<
  ReportArticleCommentData,
  ReportArticleCommentResult
>('reportArticleComment');

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

export const getArticleEngagement = createCallable<
  GetArticleEngagementData,
  GetArticleEngagementResult
>('getArticleEngagement');

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

export const listCommentsForModeration = createCallable<
  ListCommentsForModerationData,
  ListCommentsForModerationResult
>('listCommentsForModeration');

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

export const moderateComment = createCallable<ModerateCommentData, ModerateCommentResult>(
  'moderateComment'
);

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

export const bulkModerateComments = createCallable<
  BulkModerateCommentsData,
  BulkModerateCommentsResult
>('bulkModerateComments');
