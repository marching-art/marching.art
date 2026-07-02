/**
 * NewsFeed Component - Professional News Hub
 *
 * A top-tier news source experience for DCI recaps and fantasy analysis.
 * Features: Category tabs, breaking news badges, reading time, grid layout,
 * source attribution, and professional typography.
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame, Loader2, DollarSign, ArrowUpRight, ArrowDownRight, Zap } from 'lucide-react';
import { fetchNewsFeedHttp, getRecentNews, getArticleEngagement } from '../../api/functions';
import { useSeasonStore } from '../../store/seasonStore';

// =============================================================================
// NEWS FEED CACHE WITH STALE-WHILE-REVALIDATE
// Implements SWR pattern for instant perceived load times (news site style):
// 1. Show cached data immediately (even if stale)
// 2. Fetch fresh data in background
// 3. Update UI when fresh data arrives
//
// Cache TTLs are aligned with server-side caching for optimal performance:
// - Fresh: 2 minutes (matches browser Cache-Control max-age)
// - Stale: 30 minutes (matches stale-while-revalidate)
// =============================================================================

import { safeString, getUrgencyBadge } from './newsFeedUtils';
import { newsCache, prefetchCache } from './newsFeedCache';
import {
  NewsMasthead,
  HeroStory,
  TextStoryRow,
  LoadingState,
  ErrorState,
  EmptyState,
} from './NewsFeedCards';
import { TrendingBadge, FantasyValueBadge } from './NewsFeedBadges';

// =============================================================================
// REQUEST DEDUPLICATION
// Prevents multiple concurrent fetches for the same data
// =============================================================================

let pendingRequest = null;

// =============================================================================
// PREFETCH CACHE
// Stores prefetched next page data for instant pagination (like news sites)
// =============================================================================

// =============================================================================
// INTERSECTION OBSERVER HOOK FOR INFINITE SCROLL
// Triggers loading when user scrolls near the bottom (like standard news sites)
// Limited to a few auto-loads to prevent sidebar "racing" issue where users
// can never reach the "Full Standings" link at the bottom of the sidebar
// =============================================================================

const MAX_AUTO_LOADS = 2; // Only auto-load 2 times, then require manual click

function useIntersectionObserver(callback, enabled, options = {}) {
  const targetRef = useRef(null);

  useEffect(() => {
    // Don't observe if disabled (e.g., max auto-loads reached)
    if (!enabled) return;

    const target = targetRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          callback();
        }
      },
      { rootMargin: '200px', threshold: 0, ...options }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [callback, enabled, options]);

  return targetRef;
}

// =============================================================================
// IMAGE PRELOADING
// Preloads hero image for instant display when content renders
// =============================================================================

// =============================================================================
// SKELETON LOADING COMPONENTS
// Professional skeleton UI for perceived instant loading
// =============================================================================

// =============================================================================
// CATEGORY CONFIGURATION
// =============================================================================

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

/**
 * Share Button - Allows sharing article via Web Share API or clipboard
 */

/**
 * Professional Masthead - Category tabs and story count
 */

/**
 * Hero Story - Featured article with prominent display
 */

/**
 * News Card - Compact card for secondary stories (grid layout)
 * OPTIMIZATION #3: Memoized to prevent re-renders when sibling news items update
 */

/**
 * Compact News Row - For additional stories in a list format
 * OPTIMIZATION #3: Memoized to prevent re-renders when sibling news items update
 */

/**
 * Text Story Row - Headline + summary only, no thumbnail (classic newspaper style)
 * Only the hero story carries an image; everything below is text-only
 * OPTIMIZATION: Memoized to prevent re-renders when sibling news items update
 */

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function NewsFeed({ maxItems = 4 }) {
  const navigate = useNavigate();
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [engagement, setEngagement] = useState({}); // Map of articleId -> engagement data
  const [autoLoadCount, setAutoLoadCount] = useState(0); // Track auto-loads to prevent sidebar racing

  // Day-gating: prevent articles from spoiling scores before they appear on the scores page.
  // Scores are processed at 2 AM ET. Before 2 AM, only the previous day's scores are available.
  // When currentDay reaches the season maximum (49), the season is over or ending — lift the
  // gate after 2 AM so all season articles remain visible during the off-season.
  const currentDay = useSeasonStore((state) => state.currentDay);
  // The active season's UID matches the `seasonId` on its articles. Articles from
  // prior seasons carry a different seasonId and should never be day-gated, since
  // their scores are already fully revealed (e.g. last season's finals results).
  const seasonUid = useSeasonStore((state) => state.seasonUid);
  const effectiveDay = useMemo(() => {
    if (!currentDay) return null;
    const etHour = parseInt(
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour: '2-digit',
        hour12: false,
      }).format(new Date())
    );
    if (currentDay >= 49) {
      // Season complete: only gate in the midnight window; after 2 AM show everything
      return etHour < 2 ? Math.max(currentDay - 2, 1) : null;
    }
    const day = etHour < 2 ? currentDay - 2 : currentDay - 1;
    return day >= 1 ? day : null;
  }, [currentDay]);

  // Fetch engagement data for articles (used for load more, where we don't want to re-fetch all)
  const fetchEngagement = async (articleIds) => {
    if (!articleIds || articleIds.length === 0) return;

    try {
      const result = await getArticleEngagement({ articleIds });
      if (result.data?.success) {
        setEngagement((prev) => ({ ...prev, ...result.data.engagement }));
      }
    } catch (err) {
      console.error('Error fetching engagement:', err);
    }
  };

  /**
   * Fetch news with stale-while-revalidate pattern and request deduplication
   * - Fresh cache: Use immediately, no fetch
   * - Stale cache: Show immediately, fetch in background
   * - No cache: Show skeleton, fetch via fast HTTP endpoint
   *
   * OPTIMIZATIONS:
   * 1. Uses HTTP endpoint with CDN edge caching for 10x faster initial loads
   * 2. Request deduplication prevents concurrent duplicate fetches
   */
  const fetchNews = async (forceRefresh = false) => {
    // If cache is fresh and not forcing refresh, use it directly
    if (!forceRefresh && newsCache.isFresh(maxItems)) {
      const cached = newsCache.get();
      setNews(cached.news);
      setHasMore(cached.hasMore);
      setEngagement(cached.engagement || {});
      setLoading(false);
      return;
    }

    // If cache is stale, show it immediately while fetching fresh data in background
    // This is the key to instant perceived load times
    const isStale = newsCache.isStale(maxItems);
    if (isStale && !forceRefresh) {
      const cached = newsCache.get();
      setNews(cached.news);
      setHasMore(cached.hasMore);
      setEngagement(cached.engagement || {});
      setLoading(false); // Don't show loading - we have data to show
      // Continue to fetch fresh data in background (don't return)
    } else if (!newsCache.hasData(maxItems)) {
      // No cached data at all - show skeleton loading state
      setLoading(true);
    }

    setError(null);

    // Request deduplication: if there's already a pending request, reuse it
    if (pendingRequest && !forceRefresh) {
      try {
        const result = await pendingRequest;
        if (result?.success && result.news?.length > 0) {
          setNews(result.news);
          setHasMore(result.hasMore ?? true);
          setEngagement(result.engagement || {});
          newsCache.set(
            {
              news: result.news,
              hasMore: result.hasMore ?? true,
              engagement: result.engagement || {},
            },
            maxItems
          );
        }
      } catch (err) {
        // Error already handled by original request
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      // Use HTTP endpoint for CDN-cached fast fetches (10x faster than callable)
      // Falls back to callable automatically if HTTP fails
      pendingRequest = fetchNewsFeedHttp({
        limit: maxItems,
      });

      const result = await pendingRequest;

      if (result?.success && result.news?.length > 0) {
        const newsData = result.news;
        const hasMoreData = result.hasMore ?? true;
        const engagementData = result.engagement || {};

        setNews(newsData);
        setHasMore(hasMoreData);
        setEngagement(engagementData);

        // Preload hero image for instant display
        // Update cache with fresh data
        newsCache.set(
          { news: newsData, hasMore: hasMoreData, engagement: engagementData },
          maxItems
        );
      } else if (!isStale) {
        // API returned no articles and we have no cached data.
        // Show an honest empty state rather than fabricated content —
        // inventing scores/corps/ROI in a fallback would mislead visitors.
        setNews([]);
        setHasMore(false);
      }
    } catch (err) {
      console.error('Error fetching news:', err);
      // On fetch failure with no cached data, surface a real error state.
      // Do not backfill with invented articles.
      if (!isStale) {
        setNews([]);
        setHasMore(false);
        setError(err.message);
      }
    } finally {
      pendingRequest = null;
      setLoading(false);
    }
  };

  /**
   * Prefetch next page of news for instant pagination (like standard news sites)
   * Called when user scrolls near the end of current content
   */
  const prefetchNextPage = useCallback(async () => {
    if (!hasMore || news.length === 0) return;

    const lastArticle = news[news.length - 1];
    const cursor = lastArticle?.createdAt;

    // Skip if already prefetched for this cursor
    if (prefetchCache.get(cursor)) return;

    try {
      const result = await getRecentNews({
        limit: maxItems,
        startAfter: cursor,
        includeEngagement: true,
        feedOnly: true,
      });

      if (result.data?.success && result.data.news?.length > 0) {
        prefetchCache.set(result.data, cursor);
      }
    } catch (err) {
      // Silent fail for prefetch - not critical
      console.debug('Prefetch failed:', err);
    }
  }, [hasMore, news, maxItems]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || news.length === 0) return;

    setLoadingMore(true);

    try {
      // Get the last article's createdAt as the cursor
      const lastArticle = news[news.length - 1];
      const startAfter = lastArticle?.createdAt;

      // Check prefetch cache first for instant pagination (like news sites)
      const prefetched = prefetchCache.get(startAfter);
      let result;

      if (prefetched) {
        // Use prefetched data for instant response
        result = { data: prefetched };
        prefetchCache.clear();
      } else {
        // Fetch more news with engagement in a single request
        // Use feedOnly=true for optimized payload
        result = await getRecentNews({
          limit: maxItems,
          startAfter,
          includeEngagement: true,
          feedOnly: true,
        });
      }

      if (result.data?.success && result.data.news?.length > 0) {
        const newNews = [...news, ...result.data.news];
        const newHasMore = result.data.hasMore ?? false;
        const newEngagement = { ...engagement, ...result.data.engagement };

        setNews(newNews);
        setHasMore(newHasMore);
        setEngagement(newEngagement);

        // Track auto-loads for sidebar racing prevention
        setAutoLoadCount((prev) => prev + 1);

        // Update cache with expanded data so returning users see all loaded articles
        newsCache.set({ news: newNews, hasMore: newHasMore, engagement: newEngagement }, maxItems);

        // Start prefetching next page immediately after loading current page
        if (newHasMore) {
          setTimeout(() => prefetchNextPage(), 100);
        }
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Error loading more news:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, news, maxItems, engagement, prefetchNextPage]);

  // Intersection observer for infinite scroll (news site style)
  // Limited to MAX_AUTO_LOADS to prevent sidebar "racing" issue
  const autoLoadEnabled = autoLoadCount < MAX_AUTO_LOADS;
  const loadMoreRef = useIntersectionObserver(loadMore, autoLoadEnabled);

  useEffect(() => {
    fetchNews();
  }, [maxItems]);

  // Start prefetching next page once initial news is loaded (for instant pagination)
  useEffect(() => {
    if (news.length > 0 && hasMore && !loading) {
      // Delay prefetch slightly to prioritize initial render
      const timer = setTimeout(() => prefetchNextPage(), 1000);
      return () => clearTimeout(timer);
    }
  }, [news.length, hasMore, loading, prefetchNextPage]);

  // Filter news by category and day-gate to prevent spoiling scores
  const filteredNews = useMemo(() => {
    let filtered = news;

    // Day-gate: hide articles for days whose scores aren't visible yet.
    // Only the active season's articles can spoil scores; once we know the active
    // season's UID, articles from any other season are left untouched so previous
    // seasons' recaps (finals winners, etc.) stay readable the moment a new season
    // resets the day counter to 1.
    if (effectiveDay) {
      filtered = filtered.filter((story) => {
        const isPriorSeason = seasonUid && story.seasonId && story.seasonId !== seasonUid;
        if (isPriorSeason) return true;
        return !story.reportDay || story.reportDay <= effectiveDay;
      });
    }

    if (activeCategory !== 'all') {
      filtered = filtered.filter((story) => story.category === activeCategory);
    }

    return filtered;
  }, [news, activeCategory, effectiveDay, seasonUid]);

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
        engagement: engagement[story.id] || null,
      },
    });
  };

  if (loading && news.length === 0) {
    return <LoadingState />;
  }

  if (error && news.length === 0) {
    return <ErrorState onRetry={fetchNews} />;
  }

  const [heroStory, ...otherStories] = filteredNews;

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

          {/* More Stories - Text-only two-column list (classic newspaper style) */}
          {otherStories.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-[#0057B8]" />
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                  More Stories
                </h2>
                <div className="flex-1 h-px bg-[#333]" />
              </div>
              <div className="md:columns-2 md:gap-10 md:[column-rule:1px_solid_#33333399]">
                {otherStories.map((story) => (
                  <TextStoryRow
                    key={story.id}
                    story={story}
                    onClick={handleStoryClick}
                    engagement={engagement[story.id]}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Infinite Scroll Trigger + Load More Button */}
          {hasMore && (
            <div className="mt-6 text-center">
              {/* Intersection observer target - only active for first few loads to prevent sidebar racing */}
              {autoLoadEnabled && <div ref={loadMoreRef} className="h-1" aria-hidden="true" />}

              {/* Loading indicator - shown during fetch */}
              {loadingMore && (
                <div className="flex items-center justify-center gap-2 py-4 text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Loading more stories...</span>
                </div>
              )}

              {/* Manual load button - shown after auto-loads exhausted or as fallback */}
              {!loadingMore && !autoLoadEnabled && (
                <button
                  onClick={loadMore}
                  className="px-6 py-3 border border-[#333] text-gray-400 text-sm font-bold uppercase tracking-wider hover:border-[#444] hover:text-white transition-all press-feedback"
                >
                  Load More Stories
                </button>
              )}
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
  const latestWithImpact = news?.find((n) => n.fantasyImpact);

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
              <span className="text-[10px] text-green-400 uppercase font-bold">
                Top ROI This Week
              </span>
            </div>
            <div className="text-sm text-white font-semibold">
              {metrics.topROI.corps} {metrics.topROI.caption}
            </div>
            <div className="text-xs text-green-400">
              +{metrics.topROI.pointsGained.toFixed(1)} pts ({metrics.topROI.roiPercent.toFixed(1)}%
              ROI)
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
                <span
                  className={`${
                    item.riskLevel === 'high'
                      ? 'text-red-400'
                      : item.riskLevel === 'medium'
                        ? 'text-yellow-400'
                        : 'text-gray-400'
                  }`}
                >
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
                  <span
                    className={`flex items-center gap-1 text-xs ${
                      corp.direction === 'up'
                        ? 'text-green-500'
                        : corp.direction === 'down'
                          ? 'text-red-500'
                          : 'text-gray-500'
                    }`}
                  >
                    <TrendingBadge direction={corp.direction} />
                    {corp.weeklyChange !== undefined && (
                      <span>
                        {corp.weeklyChange >= 0 ? '+' : ''}
                        {corp.weeklyChange.toFixed(2)}
                      </span>
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
