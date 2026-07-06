// News feed callables: cached daily/recent news retrieval, engagement data,
// and the public HTTP feed endpoint. Extracted verbatim from
// triggers/newsGeneration.js.

const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
const { getCategoryFromType } = require("../helpers/newsArticleShared");

/**
 * Fetch daily news for a specific day
 */
exports.getDailyNews = onCall(
  {
    cors: true,
    timeoutSeconds: 30,
  },
  async (request) => {
    const db = getDb();
    const { day, seasonId } = request.data || {};

    if (!day) {
      throw new HttpsError("invalid-argument", "Missing required parameter: day");
    }

    try {
      // Find active season if not provided
      let activeSeasonId = seasonId;
      if (!activeSeasonId) {
        const seasonsSnapshot = await db.collection("seasons")
          .where("status", "==", "active")
          .limit(1)
          .get();

        if (!seasonsSnapshot.empty) {
          activeSeasonId = seasonsSnapshot.docs[0].id;
        } else {
          activeSeasonId = "current_season";
        }
      }

      // Correct path: news_hub/{seasonId}/days/day_{n}
      const docPath = `news_hub/${activeSeasonId}/days/day_${day}`;
      const doc = await db.doc(docPath).get();

      if (!doc.exists) {
        return { success: false, error: "No news found for this day" };
      }

      const data = doc.data();
      return {
        success: true,
        news: {
          ...data,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
        },
      };
    } catch (error) {
      logger.error("Error fetching daily news:", error);
      throw new HttpsError("internal", "Failed to fetch news");
    }
  }
);

// =============================================================================
// SERVER-SIDE CACHE CONFIGURATION
// Dramatically improves response times by caching news feed in Firestore
// This works alongside CDN caching for multi-layer performance (news site style)
// =============================================================================

const NEWS_FEED_CACHE_TTL = 5 * 60 * 1000; // 5 minutes server-side cache (matches CDN s-maxage/2)
const NEWS_FEED_CACHE_COLLECTION = "news_feed_cache";

/**
 * Generate cache key for news feed requests
 */
function getNewsCacheKey(category, limit) {
  return `feed_${category || "all"}_${limit}`;
}

/**
 * Get cached news feed if valid
 * @returns {Object|null} Cached data or null if expired/missing
 */
async function getCachedNewsFeed(db, cacheKey) {
  try {
    const cacheDoc = await db.collection(NEWS_FEED_CACHE_COLLECTION).doc(cacheKey).get();
    if (!cacheDoc.exists) return null;

    const cached = cacheDoc.data();
    const age = Date.now() - cached.timestamp;

    if (age < NEWS_FEED_CACHE_TTL) {
      logger.info(`News feed cache HIT for ${cacheKey}, age: ${age}ms`);
      return {
        ...cached,
        fromCache: true,
        cacheAge: age,
      };
    }

    logger.info(`News feed cache STALE for ${cacheKey}, age: ${age}ms`);
    return null;
  } catch (error) {
    logger.warn("Error reading news cache:", error);
    return null;
  }
}

/**
 * Save news feed to cache
 */
async function cacheNewsFeed(db, cacheKey, data) {
  try {
    await db.collection(NEWS_FEED_CACHE_COLLECTION).doc(cacheKey).set({
      ...data,
      timestamp: Date.now(),
      cachedAt: new Date().toISOString(),
    });
    logger.info(`News feed cached for ${cacheKey}`);
  } catch (error) {
    logger.warn("Error caching news feed:", error);
    // Don't throw - caching failure shouldn't break the request
  }
}

/**
 * Invalidate every entry of the server-side news feed cache.
 * Called after admin writes (delete/archive/update) so the public feed
 * stops serving the stale article. CDN/browser caches still expire on
 * their own TTLs; this just removes the server-origin cache layer.
 */
async function invalidateNewsCache(db) {
  try {
    const snapshot = await db.collection(NEWS_FEED_CACHE_COLLECTION).get();
    if (snapshot.empty) return;

    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    logger.info(`News feed cache invalidated (${snapshot.size} entries)`);
  } catch (error) {
    logger.warn("Error invalidating news cache:", error);
    // Swallow - cache invalidation failure must not break the admin action
  }
}

/**
 * Fetch recent news entries for the frontend
 * Uses collection group query on 'articles' subcollection for efficient cross-season querying
 * Returns articles ordered by createdAt (most recent first)
 *
 * PERFORMANCE OPTIMIZATIONS:
 * 1. Server-side Firestore cache (1 min TTL) - avoids cold query on every request
 * 2. feedOnly mode - returns minimal fields for feed display (no fullStory/narrative)
 * 3. Stale-while-revalidate support - returns cache age for client-side SWR
 */
exports.getRecentNews = onCall(
  {
    cors: true,
    timeoutSeconds: 30,
  },
  async (request) => {
    const db = getDb();
    const {
      limit = 10,
      category,
      startAfter,
      includeEngagement = false,
      feedOnly = false, // NEW: Only return display fields for feed (no full content)
    } = request.data || {};

    // For paginated requests (startAfter), skip cache - user is loading more
    const useCache = !startAfter;
    const cacheKey = getNewsCacheKey(category, limit);

    // Check server-side cache first (non-paginated requests only)
    if (useCache) {
      const cached = await getCachedNewsFeed(db, cacheKey);
      if (cached) {
        // If engagement is requested but not in cache, fetch it separately
        if (includeEngagement && !cached.engagement) {
          const engagement = await fetchEngagementData(db, cached.news.map(a => a.id));
          return {
            success: true,
            news: cached.news,
            hasMore: cached.hasMore,
            engagement,
            fromCache: true,
            cacheAge: cached.cacheAge,
          };
        }
        return {
          success: true,
          news: cached.news,
          hasMore: cached.hasMore,
          ...(includeEngagement && cached.engagement && { engagement: cached.engagement }),
          fromCache: true,
          cacheAge: cached.cacheAge,
        };
      }
    }

    // Helper to calculate reading time from content
    const calculateReadingTime = (data) => {
      const wordsPerMinute = 200;
      const text = [
        data.headline || "",
        data.summary || "",
        data.narrative || "",
        data.fullStory || "",
        data.fantasyImpact || "",
      ].join(" ");
      const wordCount = text.split(/\s+/).filter(Boolean).length;
      const minutes = Math.max(1, Math.ceil(wordCount / wordsPerMinute));
      return `${minutes} min read`;
    };

    try {
      // Use collection group query to fetch articles across all seasons
      // This is more efficient and doesn't depend on knowing the correct season ID
      let query = db.collectionGroup("articles")
        .where("isPublished", "==", true);

      // Apply category filter at database level for efficient filtering
      // Articles with the 'category' field will be filtered by Firestore directly
      if (category) {
        query = query.where("category", "==", category);
      }

      query = query.orderBy("createdAt", "desc");

      // Handle pagination cursor
      if (startAfter) {
        const startDate = new Date(startAfter);
        query = query.startAfter(startDate);
      }

      // Fetch exactly what we need - no more 3x over-fetch
      const fetchLimit = limit + 1;
      query = query.limit(fetchLimit);

      const snapshot = await query.get();

      const articles = [];
      for (const doc of snapshot.docs) {
        const data = doc.data();
        const articleType = doc.id;

        // Use stored category if available, otherwise derive from type (backward compatibility)
        const articleCategory = data.category || getCategoryFromType(articleType);

        // Extract seasonId and reportDay from document path
        // Path format: news_hub/{seasonId}/days/day_{n}/articles/{type}
        const pathParts = doc.ref.path.split("/");
        const seasonId = pathParts[1];
        const dayId = pathParts[3]; // e.g., "day_49"
        const reportDay = parseInt(dayId.replace("day_", ""), 10) || data.reportDay;

        // Build article object - feedOnly mode excludes heavy content fields
        const article = {
          id: `${seasonId}_${dayId}_${articleType}`,
          seasonId,
          reportDay,
          articleType,
          category: articleCategory,
          // Core display fields (always included)
          headline: data.headline || "",
          summary: data.summary || "",
          imageUrl: data.imageUrl || null,
          readingTime: calculateReadingTime(data),
          // Fantasy-specific fields (compact, needed for feed)
          fantasyImpact: data.fantasyImpact || null,
          fantasyMetrics: data.fantasyMetrics || null,
          trendingCorps: data.trendingCorps || null,
          // Timestamps
          createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.createdAt?.toDate?.()?.toISOString(),
        };

        // Only include full content when not in feedOnly mode
        // This reduces payload size by ~60-70% for feed requests
        if (!feedOnly) {
          article.narrative = data.narrative || "";
          article.fullStory = data.fullStory || "";
          article.standings = data.standings || null;
          article.topPerformers = data.topPerformers || null;
          article.recommendations = data.recommendations || null;
          article.insights = data.insights || null;
          article.seasonSummary = data.seasonSummary || null;
        }

        articles.push(article);

        // Stop once we have enough articles
        if (articles.length >= limit) break;
      }

      const resultArticles = articles.slice(0, limit);
      const hasMore = snapshot.docs.length > limit;

      // Fetch engagement data in parallel if requested (eliminates second round trip)
      const engagement = includeEngagement
        ? await fetchEngagementData(db, resultArticles.map(a => a.id))
        : null;

      // Cache the results for future requests (non-paginated only)
      if (useCache) {
        // Cache includes engagement if it was fetched
        await cacheNewsFeed(db, cacheKey, {
          news: resultArticles,
          hasMore,
          ...(engagement && { engagement }),
        });
      }

      return {
        success: true,
        news: resultArticles,
        hasMore,
        ...(engagement && { engagement }),
        fromCache: false,
      };
    } catch (error) {
      logger.error("Error fetching recent news:", error);
      throw new HttpsError("internal", "Failed to fetch news");
    }
  }
);

/**
 * Helper to fetch engagement data for articles (parallel queries)
 * Extracted to module level for reuse with cached data
 */
async function fetchEngagementData(db, articleIds) {
  if (!articleIds || articleIds.length === 0) return {};

  const defaultReactionCounts = { fire: 0, heart: 0, mindblown: 0, sad: 0, angry: 0 };

  try {
    const [commentCountResults, reactionDocs] = await Promise.all([
      // Run all comment count queries in parallel
      Promise.all(
        articleIds.map(articleId =>
          db.collection("article_comments")
            .where("articleId", "==", articleId)
            .where("status", "==", "approved")
            .count()
            .get()
            .then(result => ({ articleId, count: result.data().count }))
            .catch(() => ({ articleId, count: 0 }))
        )
      ),
      // Batch fetch all reaction documents
      db.getAll(
        ...articleIds.map(articleId =>
          db.collection("article_reactions").doc(articleId)
        )
      ).catch(() => [])
    ]);

    const engagement = {};
    const commentCountMap = new Map(
      commentCountResults.map(({ articleId, count }) => [articleId, count])
    );

    articleIds.forEach((articleId, index) => {
      const reactionDoc = reactionDocs[index];
      engagement[articleId] = {
        commentCount: commentCountMap.get(articleId) || 0,
        reactionCounts: reactionDoc?.exists
          ? reactionDoc.data()
          : defaultReactionCounts,
      };
    });

    return engagement;
  } catch (error) {
    logger.warn("Error fetching engagement data:", error);
    return {};
  }
}

// =============================================================================
// HTTP ENDPOINT FOR CDN CACHING
// Use this endpoint for maximum performance with edge caching
// =============================================================================

/**
 * HTTP endpoint for news feed with CDN caching headers
 * This endpoint allows Firebase Hosting CDN to cache responses at the edge,
 * resulting in sub-100ms response times for cached requests.
 *
 * Query params:
 * - limit: number of articles (default 10)
 * - category: filter by category (optional)
 *
 * Cache behavior (optimized for news site performance):
 * - CDN edge caches for 10 minutes (s-maxage=600)
 * - Browser caches for 2 minutes (max-age=120)
 * - stale-while-revalidate=1800 allows serving stale content for 30 min while fetching fresh
 * - stale-if-error=86400 serves cached content for 24h if backend errors occur
 *
 * This aggressive caching ensures:
 * - First-time visitors get edge-cached responses (~20-50ms)
 * - Returning visitors get browser-cached responses (~5-10ms)
 * - Even during backend issues, users see content (stale-if-error)
 */
exports.getNewsFeedHttp = onRequest(
  {
    cors: true,
    timeoutSeconds: 30,
  },
  async (req, res) => {
    const db = getDb();

    // Parse query parameters
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
    const category = req.query.category || null;

    const cacheKey = getNewsCacheKey(category, limit);

    // Helper to calculate reading time from content
    const calculateReadingTime = (data) => {
      const wordsPerMinute = 200;
      const text = [
        data.headline || "",
        data.summary || "",
        data.narrative || "",
        data.fullStory || "",
        data.fantasyImpact || "",
      ].join(" ");
      const wordCount = text.split(/\s+/).filter(Boolean).length;
      const minutes = Math.max(1, Math.ceil(wordCount / wordsPerMinute));
      return `${minutes} min read`;
    };

    try {
      // Check server-side cache first
      const cached = await getCachedNewsFeed(db, cacheKey);
      if (cached) {
        // Set aggressive CDN and browser caching headers (news site style)
        // - Browser: 2 min fresh, then revalidate
        // - CDN edge: 10 min fresh
        // - Stale-while-revalidate: serve stale for 30 min while fetching fresh in background
        // - Stale-if-error: serve stale for 24h if backend fails
        res.set("Cache-Control", "public, max-age=120, s-maxage=600, stale-while-revalidate=1800, stale-if-error=86400");
        res.set("X-Cache-Status", "HIT");
        res.set("X-Cache-Age", String(cached.cacheAge));

        return res.json({
          success: true,
          news: cached.news,
          hasMore: cached.hasMore,
          engagement: cached.engagement || null,
          fromCache: true,
          cacheAge: cached.cacheAge,
        });
      }

      // Cache miss - fetch from Firestore
      let query = db.collectionGroup("articles")
        .where("isPublished", "==", true);

      if (category) {
        query = query.where("category", "==", category);
      }

      query = query
        .orderBy("createdAt", "desc")
        .limit(limit + 1);

      const snapshot = await query.get();

      const articles = [];
      for (const doc of snapshot.docs) {
        const data = doc.data();
        const articleType = doc.id;
        const articleCategory = data.category || getCategoryFromType(articleType);

        const pathParts = doc.ref.path.split("/");
        const seasonId = pathParts[1];
        const dayId = pathParts[3];
        const reportDay = parseInt(dayId.replace("day_", ""), 10) || data.reportDay;

        // Feed-only fields for HTTP endpoint (optimized payload)
        articles.push({
          id: `${seasonId}_${dayId}_${articleType}`,
          seasonId,
          reportDay,
          articleType,
          category: articleCategory,
          headline: data.headline || "",
          summary: data.summary || "",
          imageUrl: data.imageUrl || null,
          readingTime: calculateReadingTime(data),
          fantasyImpact: data.fantasyImpact || null,
          fantasyMetrics: data.fantasyMetrics || null,
          trendingCorps: data.trendingCorps || null,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.createdAt?.toDate?.()?.toISOString(),
        });

        if (articles.length >= limit) break;
      }

      const resultArticles = articles.slice(0, limit);
      const hasMore = snapshot.docs.length > limit;

      // Fetch engagement data
      const engagement = await fetchEngagementData(db, resultArticles.map(a => a.id));

      // Cache for future requests
      await cacheNewsFeed(db, cacheKey, {
        news: resultArticles,
        hasMore,
        engagement,
      });

      // Set aggressive CDN and browser caching headers (news site style)
      res.set("Cache-Control", "public, max-age=120, s-maxage=600, stale-while-revalidate=1800, stale-if-error=86400");
      res.set("X-Cache-Status", "MISS");

      return res.json({
        success: true,
        news: resultArticles,
        hasMore,
        engagement,
        fromCache: false,
      });
    } catch (error) {
      logger.error("Error in getNewsFeedHttp:", error);

      // Don't cache errors
      res.set("Cache-Control", "no-store");

      return res.status(500).json({
        success: false,
        error: "Failed to fetch news feed",
      });
    }
  }
);

module.exports = {
  getDailyNews: exports.getDailyNews,
  getRecentNews: exports.getRecentNews,
  getNewsFeedHttp: exports.getNewsFeedHttp,
  invalidateNewsCache,
};
