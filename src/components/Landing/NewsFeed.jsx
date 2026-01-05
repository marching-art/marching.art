/**
 * NewsFeed Component - Professional News Hub
 *
 * A top-tier news source experience for DCI recaps and fantasy analysis.
 * Features: Category tabs, breaking news badges, reading time, grid layout,
 * source attribution, and professional typography.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Trophy, Flame, Clock, ChevronRight, TrendingUp, TrendingDown,
  Minus, AlertCircle, Newspaper, Loader2, DollarSign, ArrowUpRight,
  ArrowDownRight, Zap, Radio, BookOpen, MessageSquare
} from 'lucide-react';
import { getRecentNews, getArticleEngagement } from '../../api/functions';
import { ReactionSummary } from '../Articles';

// =============================================================================
// LAZY-LOADED FALLBACK DATA
// Fallback news is loaded dynamically only when API is unavailable
// This saves ~5KB from initial bundle for users whose API calls succeed
// =============================================================================

const loadFallbackNews = async () => {
  const { FALLBACK_NEWS } = await import('./fallbackNewsData');
  return FALLBACK_NEWS;
};

// =============================================================================
// CATEGORY CONFIGURATION
// =============================================================================

const CATEGORIES = [
  { id: 'all', label: 'All Stories', icon: Newspaper },
  { id: 'dci', label: 'DCI Recaps', icon: Trophy },
  { id: 'fantasy', label: 'Fantasy', icon: Flame },
  { id: 'analysis', label: 'Analysis', icon: BookOpen },
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Safely converts a value to a string for rendering
 * Handles cases where AI might return objects instead of strings
 */
function safeString(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  // If it's an object, try to extract a meaningful string or return empty
  if (typeof value === 'object') {
    // Check for common string-like properties
    if (value.text) return String(value.text);
    if (value.content) return String(value.content);
    if (value.message) return String(value.message);
    // Don't render objects - return empty string
    console.warn('NewsFeed: Unexpected object in text field:', value);
    return '';
  }
  return String(value);
}

/**
 * Formats timestamp in a professional news style
 * Shows relative time for recent, absolute for older
 */
function formatTimestamp(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now - date;
  const diffInMins = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));

  // Less than 1 hour - show minutes
  if (diffInMins < 60) {
    return `${diffInMins}m ago`;
  }

  // Same day - show time
  if (date.toDateString() === now.toDateString()) {
    return `Today, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
  }

  // Yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
  }

  // Older - show date
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/**
 * Calculates estimated reading time based on content
 */
function getReadingTime(story) {
  const wordsPerMinute = 200;
  // Include both fullStory and narrative fields (backend uses narrative, user submissions use fullStory)
  const text = `${story.headline} ${story.summary} ${story.fullStory || ''} ${story.narrative || ''} ${story.fantasyImpact || ''}`;
  const wordCount = text.split(/\s+/).length;
  const minutes = Math.max(1, Math.ceil(wordCount / wordsPerMinute));
  return `${minutes} min read`;
}

/**
 * Determines if story should show "Breaking" or "Just In" badge
 */
function getUrgencyBadge(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now - date;
  const diffInMins = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));

  if (diffInMins < 60) {
    return { label: 'BREAKING', type: 'breaking' };
  }
  if (diffInHours < 6) {
    return { label: 'JUST IN', type: 'new' };
  }
  return null;
}

function getCategoryConfig(category) {
  switch (category) {
    case 'dci':
      return {
        label: 'DCI RECAP',
        bgClass: 'bg-[#0057B8]',
        textClass: 'text-[#0057B8]',
        bgLightClass: 'bg-[#0057B8]/20',
        icon: Trophy,
      };
    case 'fantasy':
      return {
        label: 'FANTASY',
        bgClass: 'bg-orange-500',
        textClass: 'text-orange-400',
        bgLightClass: 'bg-orange-500/20',
        icon: Flame,
      };
    case 'analysis':
      return {
        label: 'ANALYSIS',
        bgClass: 'bg-purple-500',
        textClass: 'text-purple-400',
        bgLightClass: 'bg-purple-500/20',
        icon: BookOpen,
      };
    default:
      return {
        label: 'NEWS',
        bgClass: 'bg-gray-500',
        textClass: 'text-gray-400',
        bgLightClass: 'bg-gray-500/20',
        icon: Newspaper,
      };
  }
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function TrendingBadge({ direction }) {
  if (direction === 'up') {
    return <TrendingUp className="w-3 h-3 text-green-500" />;
  }
  if (direction === 'down') {
    return <TrendingDown className="w-3 h-3 text-red-500" />;
  }
  return <Minus className="w-3 h-3 text-gray-500" />;
}

function FantasyValueBadge({ value }) {
  const config = {
    buy: { label: 'BUY', bgClass: 'bg-green-500/20', textClass: 'text-green-400', icon: ArrowUpRight },
    sell: { label: 'SELL', bgClass: 'bg-red-500/20', textClass: 'text-red-400', icon: ArrowDownRight },
    hold: { label: 'HOLD', bgClass: 'bg-yellow-500/20', textClass: 'text-yellow-400', icon: Minus },
  };
  const { label, bgClass, textClass, icon: Icon } = config[value] || config.hold;

  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold ${bgClass} ${textClass}`}>
      <Icon className="w-2.5 h-2.5" />
      {label}
    </span>
  );
}

function UrgencyBadge({ urgency }) {
  if (!urgency) return null;

  const isBreaking = urgency.type === 'breaking';

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
      isBreaking
        ? 'bg-red-500 text-white animate-pulse'
        : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
    }`}>
      {isBreaking && <Radio className="w-2.5 h-2.5" />}
      {urgency.label}
    </span>
  );
}

function FantasyROIBadge({ metrics }) {
  if (!metrics?.topROI) return null;

  const { corps, caption, pointsGained, roiPercent } = metrics.topROI;
  const isPositive = roiPercent >= 0;

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20">
      <DollarSign className="w-4 h-4 text-green-400" />
      <div className="flex flex-col">
        <span className="text-[10px] text-green-400/80 uppercase tracking-wider font-medium">Top ROI</span>
        <span className="text-xs text-white font-bold">
          {corps} {caption}: <span className={`font-data tabular-nums ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {isPositive ? '+' : ''}{pointsGained.toFixed(1)} pts ({roiPercent.toFixed(1)}%)
          </span>
        </span>
      </div>
    </div>
  );
}

/**
 * Professional Masthead - Category tabs and story count
 */
function NewsMasthead({ activeCategory, onCategoryChange, storyCount, isLive }) {
  return (
    <div className="mb-6">
      {/* Masthead Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Newspaper className="w-6 h-6 text-[#0057B8]" />
            <h1 className="text-lg font-black text-white uppercase tracking-wide">
              News Hub
            </h1>
          </div>
          {isLive && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-red-500/20 border border-red-500/30">
              <div className="w-1.5 h-1.5 bg-red-500 rounded-sm animate-pulse" />
              <span className="text-[10px] font-bold text-red-400 uppercase">Live</span>
            </div>
          )}
        </div>
        <span className="text-[10px] text-gray-500 font-data tabular-nums uppercase">
          {storyCount} {storyCount === 1 ? 'story' : 'stories'}
        </span>
      </div>

      {/* Category Tabs - Segmented Control */}
      <div className="flex items-center gap-1 p-1 bg-[#111] border border-[#333] overflow-x-auto">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => onCategoryChange(cat.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-[#0057B8] text-white'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
              }`}
            >
              <Icon className="w-3 h-3" />
              <span className="hidden sm:inline">{cat.label}</span>
              <span className="sm:hidden">{cat.id === 'all' ? 'All' : cat.label.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Hero Story - Featured article with prominent display
 */
function HeroStory({ story, onClick, storyNumber, engagement }) {
  const config = getCategoryConfig(story.category);
  const Icon = config.icon;
  const urgency = getUrgencyBadge(story.createdAt);
  const readingTime = getReadingTime(story);

  return (
    <article
      className="mb-6 bg-[#1a1a1a] border border-[#333] overflow-hidden cursor-pointer hover:border-[#444] transition-colors group"
      onClick={() => onClick?.(story)}
    >
      {/* Hero Image */}
      <div className="aspect-[21/9] bg-[#0a0a0a] relative overflow-hidden">
        {story.imageUrl ? (
          <img
            src={story.imageUrl}
            alt={story.headline}
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
            loading="eager"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#0057B8]/10 to-transparent">
            <Icon className="w-20 h-20 text-[#0057B8]/30" />
          </div>
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a] via-[#1a1a1a]/20 to-transparent" />

        {/* Story number badge */}
        {storyNumber && (
          <div className="absolute top-4 left-4 w-8 h-8 bg-[#0057B8] flex items-center justify-center">
            <span className="text-sm font-black text-white">{storyNumber}</span>
          </div>
        )}

        {/* Urgency badge */}
        {urgency && (
          <div className="absolute top-4 right-4">
            <UrgencyBadge urgency={urgency} />
          </div>
        )}
      </div>

      {/* Hero Content */}
      <div className="p-5 lg:p-6">
        {/* Meta row */}
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <span className={`px-2 py-1 ${config.bgClass} text-white text-[10px] font-bold uppercase tracking-wider`}>
            {config.label}
          </span>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatTimestamp(story.createdAt)}
            </span>
            <span className="hidden sm:flex items-center gap-1">
              <BookOpen className="w-3 h-3" />
              {readingTime}
            </span>
          </div>
        </div>

        {/* Headline */}
        <h1 className="text-2xl lg:text-3xl xl:text-4xl font-black text-white leading-[1.1] mb-4 group-hover:text-gray-100 transition-colors">
          {safeString(story.headline)}
        </h1>

        {/* Summary */}
        <p className="text-base lg:text-lg text-gray-400 leading-relaxed mb-5">
          {safeString(story.summary)}
        </p>

        {/* Fantasy ROI Badge */}
        {story.fantasyMetrics && (
          <div className="mb-5">
            <FantasyROIBadge metrics={story.fantasyMetrics} />
          </div>
        )}

        {/* Fantasy Impact */}
        {story.fantasyImpact && typeof story.fantasyImpact === 'string' && (
          <div className="p-4 bg-orange-500/10 border border-orange-500/20 mb-5">
            <div className="flex items-center gap-2 mb-2">
              <Flame className="w-4 h-4 text-orange-400" />
              <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">Fantasy Impact</span>
            </div>
            <p className="text-sm text-orange-100/80 leading-relaxed">{safeString(story.fantasyImpact)}</p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-[#333]/50">
          <div className="flex items-center gap-3 flex-wrap">
            {story.trendingCorps?.slice(0, 2).map((corp, idx) => (
              <span key={idx} className="flex items-center gap-1.5 text-xs text-gray-400">
                <TrendingBadge direction={corp.direction} />
                <span className="text-white font-medium">{corp.corps}</span>
                {corp.weeklyChange !== undefined && (
                  <span className={corp.weeklyChange >= 0 ? 'text-green-400' : 'text-red-400'}>
                    {corp.weeklyChange >= 0 ? '+' : ''}{corp.weeklyChange.toFixed(2)}
                  </span>
                )}
                {corp.fantasyValue && <FantasyValueBadge value={corp.fantasyValue} />}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-4">
            {/* Engagement stats */}
            {engagement && (
              <div className="flex items-center gap-3">
                {engagement.reactionCounts?.total > 0 && (
                  <ReactionSummary
                    counts={engagement.reactionCounts}
                    userReaction={engagement.userReaction}
                  />
                )}
                {engagement.commentCount > 0 && (
                  <div className="flex items-center gap-1 text-gray-500">
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span className="text-[11px] font-data tabular-nums">{engagement.commentCount}</span>
                  </div>
                )}
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-600 uppercase">marching.art</span>
              <ChevronRight className="w-4 h-4 text-[#0057B8] group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

/**
 * News Card - Compact card for secondary stories (grid layout)
 */
function NewsCard({ story, onClick, storyNumber, engagement }) {
  const config = getCategoryConfig(story.category);
  const Icon = config.icon;
  const urgency = getUrgencyBadge(story.createdAt);
  const readingTime = getReadingTime(story);
  const isFantasy = story.category === 'fantasy';

  return (
    <article
      className="bg-[#1a1a1a] border border-[#333] overflow-hidden hover:border-[#444] transition-colors cursor-pointer group h-full flex flex-col"
      onClick={() => onClick?.(story)}
    >
      {/* Card Header with Category Color Bar */}
      <div className={`h-1 ${config.bgClass}`} />

      <div className="p-4 flex-1 flex flex-col">
        {/* Meta row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {storyNumber && (
              <span className="w-5 h-5 bg-[#222] border border-[#333] flex items-center justify-center text-[10px] font-bold text-gray-400 tabular-nums">
                {storyNumber}
              </span>
            )}
            <span className={`px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${config.bgLightClass} ${config.textClass}`}>
              {config.label}
            </span>
            {urgency && <UrgencyBadge urgency={urgency} />}
          </div>
          <Icon className={`w-4 h-4 ${isFantasy ? 'text-orange-500/40' : 'text-[#0057B8]/40'}`} />
        </div>

        {/* Headline */}
        <h2 className={`text-base font-bold leading-snug mb-2 flex-1 ${isFantasy ? 'text-orange-50' : 'text-white'} group-hover:text-gray-100 transition-colors line-clamp-3`}>
          {safeString(story.headline)}
        </h2>

        {/* Summary */}
        <p className="text-sm text-gray-500 line-clamp-2 mb-3">
          {safeString(story.summary)}
        </p>

        {/* Fantasy ROI (compact) */}
        {story.fantasyMetrics?.topROI && (
          <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-green-500/10 border border-green-500/20 mb-3 self-start">
            <DollarSign className="w-3 h-3 text-green-400" />
            <span className="text-[11px] text-green-400 font-semibold">
              {story.fantasyMetrics.topROI.corps}: +{story.fantasyMetrics.topROI.roiPercent.toFixed(1)}% ROI
            </span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-[#333]/50 mt-auto">
          <div className="flex items-center gap-2 text-[11px] text-gray-500">
            <Clock className="w-3 h-3" />
            <span>{formatTimestamp(story.createdAt)}</span>
            <span className="text-gray-600">·</span>
            <span>{readingTime}</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Engagement stats */}
            {engagement && (engagement.reactionCounts?.total > 0 || engagement.commentCount > 0) && (
              <div className="flex items-center gap-2">
                {engagement.reactionCounts?.total > 0 && (
                  <ReactionSummary
                    counts={engagement.reactionCounts}
                    userReaction={engagement.userReaction}
                  />
                )}
                {engagement.commentCount > 0 && (
                  <div className="flex items-center gap-1 text-gray-500">
                    <MessageSquare className="w-3 h-3" />
                    <span className="text-[10px] font-data tabular-nums">{engagement.commentCount}</span>
                  </div>
                )}
              </div>
            )}
            {story.trendingCorps?.[0] && (
              <span className="flex items-center gap-1 text-xs">
                <TrendingBadge direction={story.trendingCorps[0].direction} />
                <span className="text-gray-400">{story.trendingCorps[0].corps}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

/**
 * Compact News Row - For additional stories in a list format
 */
function NewsRow({ story, onClick, storyNumber, engagement }) {
  const config = getCategoryConfig(story.category);
  const urgency = getUrgencyBadge(story.createdAt);

  return (
    <article
      className="flex items-start gap-3 py-3 border-b border-[#333]/50 last:border-b-0 cursor-pointer hover:bg-white/[0.02] transition-colors group px-1"
      onClick={() => onClick?.(story)}
    >
      {/* Story number */}
      <span className="w-6 h-6 bg-[#222] border border-[#333] flex items-center justify-center text-xs font-bold text-gray-500 tabular-nums flex-shrink-0 mt-0.5">
        {storyNumber}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase ${config.bgLightClass} ${config.textClass}`}>
            {config.label}
          </span>
          {urgency && <UrgencyBadge urgency={urgency} />}
          <span className="text-[10px] text-gray-600">{formatTimestamp(story.createdAt)}</span>
          {/* Engagement stats */}
          {engagement && (engagement.reactionCounts?.total > 0 || engagement.commentCount > 0) && (
            <div className="flex items-center gap-2 ml-auto">
              {engagement.reactionCounts?.total > 0 && (
                <ReactionSummary
                  counts={engagement.reactionCounts}
                  userReaction={engagement.userReaction}
                />
              )}
              {engagement.commentCount > 0 && (
                <div className="flex items-center gap-0.5 text-gray-500">
                  <MessageSquare className="w-3 h-3" />
                  <span className="text-[10px] font-data tabular-nums">{engagement.commentCount}</span>
                </div>
              )}
            </div>
          )}
        </div>
        <h3 className="text-sm font-bold text-white leading-snug group-hover:text-gray-100 transition-colors line-clamp-2">
          {safeString(story.headline)}
        </h3>
      </div>

      <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-[#0057B8] transition-colors flex-shrink-0 mt-1" />
    </article>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-500">
      <Loader2 className="w-8 h-8 animate-spin mb-3" />
      <p className="text-sm font-medium">Loading latest stories...</p>
    </div>
  );
}

function ErrorState({ onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-500">
      <AlertCircle className="w-8 h-8 mb-3 text-red-400" />
      <p className="text-sm mb-4">Unable to load news feed</p>
      <button
        onClick={onRetry}
        className="px-4 py-2 text-sm font-bold text-[#0057B8] border border-[#0057B8] hover:bg-[#0057B8]/10 transition-colors"
      >
        Try Again
      </button>
    </div>
  );
}

function EmptyState({ category }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-500">
      <Newspaper className="w-12 h-12 mb-3 text-gray-600" />
      <p className="text-sm font-medium mb-1">No stories found</p>
      <p className="text-xs text-gray-600">
        {category === 'all' ? 'Check back soon for updates' : `No ${category} stories available`}
      </p>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function NewsFeed({ maxItems = 5 }) {
  const navigate = useNavigate();
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [engagement, setEngagement] = useState({}); // Map of articleId -> engagement data

  // Fetch engagement data for articles
  const fetchEngagement = async (articleIds) => {
    if (!articleIds || articleIds.length === 0) return;

    try {
      const result = await getArticleEngagement({ articleIds });
      if (result.data?.success) {
        setEngagement(prev => ({ ...prev, ...result.data.engagement }));
      }
    } catch (err) {
      console.error('Error fetching engagement:', err);
    }
  };

  const fetchNews = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getRecentNews({ limit: maxItems });

      if (result.data?.success && result.data.news?.length > 0) {
        setNews(result.data.news);
        setHasMore(result.data.hasMore ?? true);
        // Fetch engagement data for these articles
        const articleIds = result.data.news.map(n => n.id);
        fetchEngagement(articleIds);
      } else {
        // Lazy-load fallback data only when API returns no results
        const fallbackNews = await loadFallbackNews();
        setNews(fallbackNews);
        setHasMore(false);
      }
    } catch (err) {
      console.error('Error fetching news:', err);
      // Lazy-load fallback data only when API fails
      const fallbackNews = await loadFallbackNews();
      setNews(fallbackNews);
      setHasMore(false);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore || news.length === 0) return;

    // Don't load more if we're showing fallback data
    if (news[0]?.id?.startsWith('fallback-')) return;

    setLoadingMore(true);

    try {
      // Get the last article's createdAt as the cursor
      const lastArticle = news[news.length - 1];
      const startAfter = lastArticle?.createdAt;

      const result = await getRecentNews({
        limit: maxItems,
        startAfter,
      });

      if (result.data?.success && result.data.news?.length > 0) {
        setNews(prev => [...prev, ...result.data.news]);
        setHasMore(result.data.hasMore ?? false);
        // Fetch engagement for new articles
        const articleIds = result.data.news.map(n => n.id);
        fetchEngagement(articleIds);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Error loading more news:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, [maxItems]);

  // Filter news by category
  const filteredNews = useMemo(() => {
    if (activeCategory === 'all') return news;
    return news.filter((story) => story.category === activeCategory);
  }, [news, activeCategory]);

  // Check if any story is "breaking" (under 1 hour old)
  const hasBreakingNews = useMemo(() => {
    return news.some((story) => {
      const urgency = getUrgencyBadge(story.createdAt);
      return urgency?.type === 'breaking';
    });
  }, [news]);

  const handleStoryClick = (story) => {
    // Navigate to full article page with article data in state
    navigate(`/article/${story.id}`, {
      state: {
        article: story,
        engagement: engagement[story.id] || null
      }
    });
  };

  if (loading && news.length === 0) {
    return <LoadingState />;
  }

  if (error && news.length === 0) {
    return <ErrorState onRetry={fetchNews} />;
  }

  const [heroStory, ...otherStories] = filteredNews;
  const gridStories = otherStories.slice(0, 4);
  const listStories = otherStories.slice(4);

  return (
    <div>
      {/* Professional Masthead */}
      <NewsMasthead
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
        storyCount={filteredNews.length}
        isLive={hasBreakingNews}
      />

      {filteredNews.length === 0 ? (
        <EmptyState category={activeCategory} />
      ) : (
        <>
          {/* Hero Story */}
          {heroStory && (
            <HeroStory
              story={heroStory}
              onClick={handleStoryClick}
              storyNumber={1}
              engagement={engagement[heroStory.id]}
            />
          )}

          {/* Secondary Stories - 2 Column Grid */}
          {gridStories.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-4 h-4 text-[#0057B8]" />
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                  Top Stories
                </h2>
                <div className="flex-1 h-px bg-[#333]" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {gridStories.map((story, idx) => (
                  <NewsCard
                    key={story.id}
                    story={story}
                    onClick={handleStoryClick}
                    storyNumber={idx + 2}
                    engagement={engagement[story.id]}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Additional Stories - Compact List */}
          {listStories.length > 0 && (
            <div className="bg-[#1a1a1a] border border-[#333]">
              <div className="bg-[#222] px-4 py-3 border-b border-[#333]">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                  More Stories
                </h2>
              </div>
              <div className="p-3">
                {listStories.map((story, idx) => (
                  <NewsRow
                    key={story.id}
                    story={story}
                    onClick={handleStoryClick}
                    storyNumber={gridStories.length + idx + 2}
                    engagement={engagement[story.id]}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Load More */}
          {hasMore && !news[0]?.id?.startsWith('fallback-') && (
            <div className="mt-6 text-center">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="px-6 py-3 border border-[#333] text-gray-400 text-sm font-bold uppercase tracking-wider hover:border-[#444] hover:text-white transition-all press-feedback disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingMore ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading...
                  </span>
                ) : (
                  'Load More Stories'
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// =============================================================================
// FANTASY IMPACT WIDGET (Standalone for sidebar use)
// =============================================================================

export function FantasyImpactWidget({ news }) {
  const latestWithImpact = news?.find(n => n.fantasyImpact);

  if (!latestWithImpact) {
    return null;
  }

  const metrics = latestWithImpact.fantasyMetrics;

  return (
    <div className="bg-[#1a1a1a] border border-[#333]">
      {/* Header */}
      <div className="bg-[#222] px-3 py-2.5 border-b border-[#333] flex items-center justify-between">
        <h3 className="text-xs font-bold text-orange-400 uppercase tracking-wider flex items-center gap-2">
          <Flame className="w-3.5 h-3.5" />
          Fantasy Impact
        </h3>
        <span className="text-xs text-gray-500">Latest</span>
      </div>

      {/* Content */}
      <div className="p-3">
        {/* Top ROI Highlight */}
        {metrics?.topROI && (
          <div className="mb-3 p-2 bg-green-500/10 border border-green-500/20">
            <div className="flex items-center gap-1.5 mb-1">
              <DollarSign className="w-3 h-3 text-green-400" />
              <span className="text-[10px] text-green-400 uppercase font-bold">Top ROI This Week</span>
            </div>
            <div className="text-sm text-white font-semibold">
              {metrics.topROI.corps} {metrics.topROI.caption}
            </div>
            <div className="text-xs text-green-400">
              +{metrics.topROI.pointsGained.toFixed(1)} pts ({metrics.topROI.roiPercent.toFixed(1)}% ROI)
            </div>
          </div>
        )}

        <p className="text-sm text-gray-300 leading-relaxed mb-3">
          {safeString(latestWithImpact.fantasyImpact)}
        </p>

        {/* Buy Low Opportunities */}
        {metrics?.buyLow?.length > 0 && (
          <div className="mb-3">
            <div className="text-[10px] text-green-400 uppercase font-bold mb-1.5 flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3" />
              Buy Low
            </div>
            {metrics.buyLow.slice(0, 2).map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs mb-1">
                <span className="text-white">{item.corps}</span>
                <span className="text-green-400">+{item.projectedGain.toFixed(1)} proj</span>
              </div>
            ))}
          </div>
        )}

        {/* Sell High Warnings */}
        {metrics?.sellHigh?.length > 0 && (
          <div className="mb-3">
            <div className="text-[10px] text-red-400 uppercase font-bold mb-1.5 flex items-center gap-1">
              <ArrowDownRight className="w-3 h-3" />
              Sell High
            </div>
            {metrics.sellHigh.slice(0, 2).map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs mb-1">
                <span className="text-white">{item.corps}</span>
                <span className={`${
                  item.riskLevel === 'high' ? 'text-red-400' :
                  item.riskLevel === 'medium' ? 'text-yellow-400' : 'text-gray-400'
                }`}>
                  {item.riskLevel} risk
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Trending Corps */}
        {latestWithImpact.trendingCorps?.length > 0 && (
          <div className="pt-3 border-t border-[#333]/50">
            <div className="text-xs text-gray-500 uppercase mb-2">Trending Corps</div>
            <div className="space-y-1.5">
              {latestWithImpact.trendingCorps.slice(0, 3).map((corp, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white">{corp.corps}</span>
                    {corp.fantasyValue && <FantasyValueBadge value={corp.fantasyValue} />}
                  </div>
                  <span className={`flex items-center gap-1 text-xs ${
                    corp.direction === 'up' ? 'text-green-500' :
                    corp.direction === 'down' ? 'text-red-500' : 'text-gray-500'
                  }`}>
                    <TrendingBadge direction={corp.direction} />
                    {corp.weeklyChange !== undefined && (
                      <span>{corp.weeklyChange >= 0 ? '+' : ''}{corp.weeklyChange.toFixed(2)}</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
