// News feed presentational cards + state views. Extracted from NewsFeed.jsx.

import { memo, useState } from 'react';
import { Newspaper, Clock, BookOpen, Flame, ChevronRight, AlertCircle } from 'lucide-react';
import { EngagementSummary } from '../Articles';
import {
  CATEGORIES,
  getCategoryConfig,
  getUrgencyBadge,
  getReadingTime,
  formatTimestamp,
  safeString,
} from './newsFeedUtils';
import {
  UrgencyBadge,
  FantasyROIBadge,
  TrendingBadge,
  FantasyValueBadge,
  ShareButton,
} from './NewsFeedBadges';
import { NewsFeedSkeleton } from './NewsFeedSkeletons';

function NewsMasthead({ activeCategory, onCategoryChange, storyCount, isLive }) {
  return (
    <div className="mb-6">
      {/* Masthead Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Newspaper className="w-6 h-6 text-interactive" />
            <h1 className="text-lg font-black text-white uppercase tracking-wide">News Hub</h1>
          </div>
          {isLive && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-red-500/20 border border-red-500/30">
              <div className="w-1.5 h-1.5 bg-red-500 rounded-none animate-pulse" />
              <span className="text-[10px] font-bold text-red-400 uppercase">Live</span>
            </div>
          )}
        </div>
        <span className="text-[10px] text-muted font-data tabular-nums uppercase">
          {storyCount} {storyCount === 1 ? 'story' : 'stories'}
        </span>
      </div>

      {/* Category Tabs - Segmented Control */}
      <div className="flex items-center gap-1 p-1 bg-surface-sunken border border-line overflow-x-auto">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => onCategoryChange(cat.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-interactive text-white'
                  : 'text-muted hover:text-secondary hover:bg-white/5'
              }`}
            >
              <Icon className="w-3 h-3" />
              <span className="hidden sm:inline">{cat.label}</span>
              <span className="sm:hidden">
                {cat.id === 'all' ? 'All' : cat.label.split(' ')[0]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function HeroStory({ story, onClick, storyNumber, engagement }) {
  const config = getCategoryConfig(story.category);
  const Icon = config.icon;
  const urgency = getUrgencyBadge(story.createdAt);
  const readingTime = getReadingTime(story);

  // Fall back to the category-icon placeholder if the image URL fails to load
  // (e.g. an upload that landed on a placeholder host) rather than showing the
  // browser's broken-image glyph.
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = story.imageUrl && !imageFailed;

  return (
    <article
      className="mb-6 bg-surface-card border border-line overflow-hidden cursor-pointer hover:border-line-strong transition-colors group"
      onClick={() => onClick?.(story)}
    >
      {/* Hero Image */}
      <div className="aspect-[21/9] bg-background relative overflow-hidden">
        {showImage ? (
          <img
            src={story.imageUrl}
            alt={story.headline}
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
            loading="eager"
            fetchpriority="high"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-interactive/10 to-transparent">
            <Icon className="w-20 h-20 text-interactive/30" />
          </div>
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a] via-[#1a1a1a]/20 to-transparent" />

        {/* Story number badge */}
        {storyNumber && (
          <div className="absolute top-4 left-4 w-8 h-8 bg-interactive flex items-center justify-center">
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
          <span
            className={`px-2 py-1 ${config.bgClass} text-white text-[10px] font-bold uppercase tracking-wider`}
          >
            {config.label}
          </span>
          <div className="flex items-center gap-3 text-xs text-muted">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatTimestamp(story.createdAt)}
            </span>
            <span className="hidden sm:flex items-center gap-1">
              <BookOpen className="w-3 h-3" />
              {readingTime}
            </span>
            {(story.authorUsername || story.authorName) && (
              <span className="flex items-center gap-1 text-muted">
                By {story.authorUsername || story.authorName}
              </span>
            )}
          </div>
        </div>

        {/* Headline */}
        <h1 className="text-2xl lg:text-3xl xl:text-4xl font-black text-white leading-[1.1] mb-4 group-hover:text-main transition-colors">
          {safeString(story.headline)}
        </h1>

        {/* Summary */}
        <p className="text-base lg:text-lg text-muted leading-relaxed mb-5">
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
              <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">
                Fantasy Impact
              </span>
            </div>
            <p className="text-sm text-orange-100/80 leading-relaxed">
              {safeString(story.fantasyImpact)}
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-line/50">
          <div className="flex items-center gap-3 flex-wrap">
            {story.trendingCorps?.slice(0, 2).map((corp, idx) => (
              <span key={idx} className="flex items-center gap-1.5 text-xs text-muted">
                <TrendingBadge direction={corp.direction} />
                <span className="text-white font-medium">{corp.corps}</span>
                {corp.weeklyChange !== undefined && (
                  <span className={corp.weeklyChange >= 0 ? 'text-green-400' : 'text-red-400'}>
                    {corp.weeklyChange >= 0 ? '+' : ''}
                    {corp.weeklyChange.toFixed(2)}
                  </span>
                )}
                {corp.fantasyValue && <FantasyValueBadge value={corp.fantasyValue} />}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-4">
            {/* Engagement stats - Facebook style */}
            {engagement && (
              <EngagementSummary
                reactionCounts={engagement.reactionCounts}
                userReaction={engagement.userReaction}
                commentCount={engagement.commentCount}
              />
            )}
            {/* Share button */}
            <ShareButton story={story} />
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted uppercase">marching.art</span>
              <ChevronRight className="w-4 h-4 text-interactive group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

const TextStoryRow = memo(({ story, onClick, engagement }) => {
  const config = getCategoryConfig(story.category);
  const urgency = getUrgencyBadge(story.createdAt);

  return (
    <article
      className="py-4 border-b border-line/60 break-inside-avoid cursor-pointer group"
      onClick={() => onClick?.(story)}
    >
      {/* Kicker: category + urgency */}
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`text-[10px] font-bold uppercase tracking-widest ${config.textClass}`}>
          {config.label}
        </span>
        {urgency && <UrgencyBadge urgency={urgency} />}
      </div>

      {/* Headline */}
      <h2 className="text-lg font-bold text-white leading-snug mb-1.5 group-hover:underline decoration-gray-500 decoration-1 underline-offset-[3px]">
        {safeString(story.headline)}
      </h2>

      {/* Summary line */}
      <p className="text-sm text-muted leading-relaxed line-clamp-2 mb-2">
        {safeString(story.summary)}
      </p>

      {/* Meta */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted uppercase tracking-wide">
          {formatTimestamp(story.createdAt)}
          {(story.authorUsername || story.authorName) && (
            <span className="text-muted"> · By {story.authorUsername || story.authorName}</span>
          )}
        </span>
        {engagement && (
          <EngagementSummary
            reactionCounts={engagement.reactionCounts}
            userReaction={engagement.userReaction}
            commentCount={engagement.commentCount}
          />
        )}
      </div>
    </article>
  );
});

function LoadingState() {
  // Use skeleton loading for professional perceived performance
  return <NewsFeedSkeleton />;
}

function ErrorState({ onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted">
      <AlertCircle className="w-8 h-8 mb-3 text-red-400" />
      <p className="text-sm mb-4">Unable to load news feed</p>
      <button
        onClick={onRetry}
        className="px-4 py-2 text-sm font-bold text-interactive border border-interactive hover:bg-interactive/10 transition-colors"
      >
        Try Again
      </button>
    </div>
  );
}

function EmptyState({ category }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted">
      <Newspaper className="w-12 h-12 mb-3 text-muted" />
      <p className="text-sm font-medium mb-1">
        {category === 'all' ? 'No articles yet' : `No ${category} stories available`}
      </p>
      <p className="text-xs text-muted text-center max-w-xs">
        {category === 'all'
          ? 'New recaps and analysis post after each DCI competition day.'
          : 'Try another category or check back after the next competition day.'}
      </p>
    </div>
  );
}

export { NewsMasthead, HeroStory, TextStoryRow, LoadingState, ErrorState, EmptyState };
