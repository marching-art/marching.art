// =============================================================================
// ARTICLE DETAIL MODAL - Full Article View with Reactions & Comments
// =============================================================================
// Displays the full article content with emoji reactions and comments system

import React, { useState, useEffect } from 'react';
import {
  X, Clock, Trophy, Flame, BookOpen, Newspaper,
  TrendingUp, TrendingDown, Minus, Share2, ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';
import Portal from '../Portal';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import ArticleReactions from '../Articles/ArticleReactions';
import ArticleComments from '../Articles/ArticleComments';

// Category configuration
function getCategoryConfig(category) {
  switch (category) {
    case 'dci':
      return {
        label: 'DCI RECAP',
        bgClass: 'bg-[#0057B8]',
        textClass: 'text-[#0057B8]',
        icon: Trophy,
      };
    case 'fantasy':
      return {
        label: 'FANTASY',
        bgClass: 'bg-orange-500',
        textClass: 'text-orange-400',
        icon: Flame,
      };
    case 'analysis':
      return {
        label: 'ANALYSIS',
        bgClass: 'bg-purple-500',
        textClass: 'text-purple-400',
        icon: BookOpen,
      };
    default:
      return {
        label: 'NEWS',
        bgClass: 'bg-gray-500',
        textClass: 'text-gray-400',
        icon: Newspaper,
      };
  }
}

// Format date for display
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Calculate reading time
function getReadingTime(story) {
  const text = `${story.headline} ${story.summary} ${story.fullStory || ''} ${story.narrative || ''} ${story.fantasyImpact || ''}`;
  const wordCount = text.split(/\s+/).length;
  const minutes = Math.max(1, Math.ceil(wordCount / 200));
  return `${minutes} min read`;
}

// Trending badge component
function TrendingBadge({ direction }) {
  if (direction === 'up') {
    return <TrendingUp className="w-4 h-4 text-green-500" />;
  }
  if (direction === 'down') {
    return <TrendingDown className="w-4 h-4 text-red-500" />;
  }
  return <Minus className="w-4 h-4 text-gray-500" />;
}

/**
 * ArticleDetailModal - Full article view with reactions and comments
 */
const ArticleDetailModal = ({ article, onClose, engagement: initialEngagement }) => {
  const [engagement, setEngagement] = useState(initialEngagement);

  useEscapeKey(onClose);

  if (!article) return null;

  const config = getCategoryConfig(article.category);
  const Icon = config.icon;
  const readingTime = getReadingTime(article);

  // Get the full content (backend uses 'narrative', user submissions use 'fullStory')
  const fullContent = article.fullStory || article.narrative || article.summary;

  const handleShare = async () => {
    const shareUrl = window.location.href;

    // Helper function to copy to clipboard
    const copyToClipboard = async () => {
      try {
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Link copied to clipboard');
      } catch (err) {
        toast.error('Failed to copy link');
      }
    };

    if (navigator.share) {
      try {
        await navigator.share({
          title: article.headline,
          text: article.summary,
          url: shareUrl,
        });
      } catch (err) {
        // If user cancelled (AbortError), do nothing
        // For other errors (blocked by enterprise, etc.), fall back to clipboard
        if (err.name !== 'AbortError') {
          await copyToClipboard();
        }
      }
    } else {
      await copyToClipboard();
    }
  };

  const handleCommentCountChange = (newCount) => {
    setEngagement(prev => prev ? { ...prev, commentCount: newCount } : null);
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[100] bg-black/90 flex items-start justify-center overflow-y-auto"
        onClick={onClose}
      >
        <div
          className="w-full max-w-3xl bg-[#0a0a0a] min-h-screen md:min-h-0 md:my-8 md:border md:border-[#333] md:rounded-sm"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 bg-[#1a1a1a] border-b border-[#333]">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <span className={`px-2 py-1 ${config.bgClass} text-white text-[10px] font-bold uppercase tracking-wider`}>
                  {config.label}
                </span>
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {readingTime}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleShare}
                  className="p-2 text-gray-500 hover:text-white transition-colors"
                  title="Share"
                >
                  <Share2 className="w-4 h-4" />
                </button>
                <button
                  onClick={onClose}
                  className="p-2 text-gray-500 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Hero Image */}
          {article.imageUrl && (
            <div className="aspect-[16/9] bg-[#111] relative">
              <img
                src={article.imageUrl}
                alt={article.headline}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent" />
            </div>
          )}

          {/* Content */}
          <div className="p-6 md:p-8">
            {/* Meta */}
            <div className="flex items-center gap-3 mb-4 text-xs text-gray-500">
              <span>{formatDate(article.createdAt)}</span>
              {article.metadata?.eventName && (
                <>
                  <span className="text-gray-600">•</span>
                  <span>{article.metadata.eventName}</span>
                </>
              )}
              {article.metadata?.location && (
                <>
                  <span className="text-gray-600">•</span>
                  <span>{article.metadata.location}</span>
                </>
              )}
            </div>

            {/* Headline */}
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-white leading-tight mb-4">
              {article.headline}
            </h1>

            {/* Summary */}
            <p className="text-lg text-gray-400 leading-relaxed mb-6">
              {article.summary}
            </p>

            {/* Reactions */}
            <div className="mb-6 pb-6 border-b border-[#333]">
              <ArticleReactions
                articleId={article.id}
                initialCounts={engagement?.reactionCounts}
                initialUserReaction={engagement?.userReaction}
              />
            </div>

            {/* Full Story */}
            <div className="prose prose-invert max-w-none mb-8">
              {fullContent.split('\n\n').map((paragraph, idx) => (
                <p key={idx} className="text-base text-gray-300 leading-relaxed mb-4">
                  {paragraph}
                </p>
              ))}
            </div>

            {/* Fantasy Impact */}
            {article.fantasyImpact && (
              <div className="bg-orange-500/10 border border-orange-500/20 p-4 mb-8">
                <div className="flex items-center gap-2 mb-2">
                  <Flame className="w-5 h-5 text-orange-400" />
                  <span className="text-sm font-bold text-orange-400 uppercase tracking-wider">
                    Fantasy Impact
                  </span>
                </div>
                <p className="text-sm text-orange-100/80 leading-relaxed">
                  {article.fantasyImpact}
                </p>
              </div>
            )}

            {/* Trending Corps */}
            {article.trendingCorps?.length > 0 && (
              <div className="bg-[#1a1a1a] border border-[#333] p-4 mb-8">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                  Trending Corps
                </h3>
                <div className="space-y-3">
                  {article.trendingCorps.map((corp, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <TrendingBadge direction={corp.direction} />
                      <div>
                        <span className="text-sm font-bold text-white">
                          {corp.corps}
                        </span>
                        {corp.reason && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {corp.reason}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Comments Section */}
            <div className="mt-8">
              <ArticleComments
                articleId={article.id}
                initialCount={engagement?.commentCount || 0}
                onCommentCountChange={handleCommentCountChange}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-[#333] px-6 py-4 bg-[#111]">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">
                marching.art
              </span>
              <button
                onClick={onClose}
                className="text-xs text-gray-500 hover:text-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default ArticleDetailModal;
