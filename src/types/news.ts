// =============================================================================
// NEWS HUB TYPES
// =============================================================================

export type NewsCategory = 'dci' | 'fantasy' | 'analysis';

export interface TrendingCorps {
  corps: string;
  direction: 'up' | 'down' | 'stable';
  reason: string;
}

export interface NewsEntry {
  id: string;
  category: NewsCategory;
  date: string;
  createdAt: string;
  headline: string;
  summary: string;
  fullStory: string;
  fantasyImpact: string;
  trendingCorps: TrendingCorps[];
  isPublished: boolean;
  imageUrl?: string;
  imageIsPlaceholder?: boolean;
  // Author credit for community-submitted articles.
  authorUid?: string | null;
  authorName?: string | null;
  authorUsername?: string | null;
  authorLocation?: string | null;
  metadata?: {
    eventName?: string;
    location?: string;
    corpsCount?: number;
    year?: number;
    offSeasonDay?: number;
    showCount?: number;
    seasonId?: string;
    generatedBy?: string;
    imagePublicId?: string;
  };
}

export interface NewsHubResponse {
  success: boolean;
  news: NewsEntry[];
}

// =============================================================================
// ARTICLE REACTIONS & COMMENTS
// =============================================================================

/**
 * Available emoji reactions for articles
 */
export type ArticleReactionType = '👏' | '🔥' | '💯' | '🎺' | '❤️' | '🤔' | '🏳️' | '🥁';

/**
 * A single user's reaction to an article
 */
export interface ArticleReaction {
  id: string;
  articleId: string;
  userId: string;
  emoji: ArticleReactionType;
  createdAt: string;
}

/**
 * Aggregated reaction counts for an article
 */
export interface ArticleReactionCounts {
  '👏': number;
  '🔥': number;
  '💯': number;
  '🎺': number;
  '❤️': number;
  '🤔': number;
  '🏳️': number;
  '🥁': number;
  total: number;
}

/**
 * User's current reaction state for an article
 */
export interface UserArticleReaction {
  emoji: ArticleReactionType | null;
  reactionId: string | null;
}

/**
 * Comment status for moderation
 */
export type CommentStatus = 'pending' | 'approved' | 'rejected' | 'hidden';

/**
 * A comment on an article
 */
export interface ArticleComment {
  id: string;
  articleId: string;
  userId: string;
  userName: string;
  userTitle?: string;
  content: string;
  status: CommentStatus;
  createdAt: string;
  updatedAt?: string;
  editedAt?: string;
  isEdited?: boolean;
  // Moderation fields
  moderatedAt?: string;
  moderatedBy?: string;
  moderationReason?: string;
  // Report tracking
  reportCount?: number;
  reportReasons?: string[];
}

/**
 * Article engagement stats (for display on cards)
 */
export interface ArticleEngagement {
  reactionCounts: ArticleReactionCounts;
  commentCount: number;
  userReaction?: ArticleReactionType | null;
}
