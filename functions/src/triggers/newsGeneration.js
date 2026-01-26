/**
 * News Generation Triggers
 *
 * Automated content generation triggered by score processing.
 * Uses Gemini AI to create multi-faceted DCI recaps bridging:
 * - dci-data: Active corps for the season
 * - historical_scores: Actual DCI scores
 * - fantasy_recaps: marching.art fantasy results
 *
 * Storage: /news_hub/current_season/day_{currentDay}
 */

const { onMessagePublished } = require("firebase-functions/v2/pubsub");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const { defineSecret } = require("firebase-functions/params");
const { getDb } = require("../config");
const {
  generateAllArticles,
  generateDailyNews,
  generateNightlyRecap,
  generateFantasyRecap,
  getArticleImage,
  ARTICLE_TYPES,
} = require("../helpers/newsGeneration");

// Define Gemini API key secret for triggers that use news generation
const geminiApiKey = defineSecret("GOOGLE_GENERATIVE_AI_API_KEY");

// Define Cloudinary secrets for image uploads
const cloudinaryCloudName = defineSecret("CLOUDINARY_CLOUD_NAME");
const cloudinaryApiKey = defineSecret("CLOUDINARY_API_KEY");
const cloudinaryApiSecret = defineSecret("CLOUDINARY_API_SECRET");

// Pub/Sub topic for news generation requests
const NEWS_GENERATION_TOPIC = "news-generation-topic";

/**
 * NewsHub Categories
 */
const NEWS_CATEGORIES = {
  DCI_RECAP: "dci",
  FANTASY: "fantasy",
  ANALYSIS: "analysis",
  DAILY: "daily", // New unified category
};

/**
 * Derives category from article type for consistent categorization
 * @param {string} articleType - The article type (e.g., "dci_recap", "fantasy_recap")
 * @returns {string} The category ("dci", "fantasy", or "analysis")
 */
function getCategoryFromType(articleType) {
  // Analysis articles - check specific types before prefix matching
  if (articleType === "dci_recap") return NEWS_CATEGORIES.ANALYSIS;
  if (articleType === "deep_analytics") return NEWS_CATEGORIES.ANALYSIS;
  // DCI and Fantasy articles by prefix
  if (articleType.startsWith("dci_")) return NEWS_CATEGORIES.DCI_RECAP;
  if (articleType.startsWith("fantasy_")) return NEWS_CATEGORIES.FANTASY;
  return NEWS_CATEGORIES.DCI_RECAP; // Default to dci
}

// =============================================================================
// PRIMARY TRIGGER: Daily News Generation
// =============================================================================

/**
 * Process daily news generation requests from Pub/Sub
 * Triggered after nightly score processing completes
 *
 * Expected payload:
 * {
 *   type: "daily_news",
 *   currentDay: number (1-49),
 *   dataDocId: string,
 *   seasonId: string
 * }
 */
exports.processNewsGeneration = onMessagePublished(
  {
    topic: NEWS_GENERATION_TOPIC,
    timeoutSeconds: 180,
    memory: "1GiB",
    secrets: [geminiApiKey, cloudinaryCloudName, cloudinaryApiKey, cloudinaryApiSecret],
  },
  async (message) => {
    logger.info("Processing news generation request");

    try {
      const payloadBuffer = Buffer.from(message.data.message.data, "base64").toString("utf-8");
      const payload = JSON.parse(payloadBuffer);

      const { type, data } = payload;

      let result;
      switch (type) {
        case "daily_news":
          result = await handleDailyNewsGeneration(data);
          break;
        case "dci_scores":
          // Legacy handler
          result = await handleDciScoresNews(data);
          break;
        case "fantasy_recap":
          // Legacy handler
          result = await handleFantasyRecapNews(data);
          break;
        default:
          logger.warn("Unknown news generation type:", type);
          return;
      }

      if (result) {
        logger.info("News generation completed successfully:", {
          type,
          headline: result.headline,
        });
      }
    } catch (error) {
      logger.error("Error in news generation trigger:", error);
    }
  }
);

/**
 * Handle daily news generation using the new unified function
 * Bridges all three data sources with time-locked retrieval
 */
async function handleDailyNewsGeneration(data) {
  const db = getDb();
  const { currentDay, dataDocId, seasonId } = data;

  if (!currentDay || !dataDocId || !seasonId) {
    logger.error("Missing required parameters for daily news generation", { currentDay, dataDocId, seasonId });
    return null;
  }

  try {
    // Generate the 5 nightly articles with Imagen images
    const result = await generateAllArticles({
      db,
      dataDocId,
      seasonId,
      currentDay,
    });

    if (result.success && result.articles) {
      // Save all 5 articles to day-based path structure
      const reportDay = currentDay - 1;
      await saveDailyNews(db, {
        reportDay,
        content: result.articles[0] || {}, // Primary article for legacy compat
        metadata: result.metadata,
        articles: result.articles, // All 5 articles
        seasonId, // Use season name for organization
      });

      return result.articles[0]; // Return primary for logging
    }

    logger.warn("Daily news generation returned unsuccessful result", { error: result.error });
    return null;
  } catch (error) {
    logger.error("Error in daily news generation:", error);
    throw error;
  }
}

/**
 * Save daily news to the new path structure
 * Saves each of the 5 articles separately for the news feed
 * Path: /news_hub/{seasonId}/days/day_{reportDay}/articles/{type}
 */
async function saveDailyNews(db, { reportDay, content, metadata, articles, seasonId }) {
  // Use seasonId for organization, fallback to "current_season" for legacy
  const seasonPath = seasonId || "current_season";
  // Path must have even number of components for Firestore document
  // Structure: news_hub/{seasonId}/days/day_{reportDay} (4 components)
  const basePath = `news_hub/${seasonPath}/days/day_${reportDay}`;

  // If we have the new 5-article structure, save each separately
  if (articles && articles.length > 0) {
    logger.info(`Saving ${articles.length} articles for Day ${reportDay}`);

    for (const article of articles) {
      const articlePath = `${basePath}/articles/${article.type}`;

      const articleEntry = {
        type: article.type,
        category: getCategoryFromType(article.type), // For efficient filtering
        reportDay,
        createdAt: new Date(),
        updatedAt: new Date(),

        // Article content
        headline: article.headline || `Day ${reportDay} ${article.type}`,
        summary: article.summary || "",
        narrative: article.narrative || "",

        // Type-specific data
        standings: article.standings || null,
        captionBreakdown: article.captionBreakdown || null,
        topPerformers: article.topPerformers || null,
        leagueHighlights: article.leagueHighlights || null,
        insights: article.insights || null,
        recommendations: article.recommendations || null,

        // Image (from Imagen)
        imageUrl: article.imageUrl || null,
        imageIsPlaceholder: article.isPlaceholder || false,
        imagePrompt: article.imagePrompt || null,

        // Metadata
        metadata: {
          ...metadata,
          generatedBy: "gemini-2.0-flash-lite",
          imageGeneratedBy: "gemini-2.0-flash-exp", // Free tier
        },

        isPublished: true,
      };

      await db.doc(articlePath).set(articleEntry, { merge: true });

      logger.info("Saved article:", {
        path: articlePath,
        type: article.type,
        headline: article.headline,
      });
    }

    // Save day index document with references to all articles
    const dayIndex = {
      reportDay,
      currentDay: metadata.currentDay,
      createdAt: new Date(),
      updatedAt: new Date(),
      articleTypes: articles.map(a => a.type),
      articleCount: articles.length,
      primaryHeadline: articles[0]?.headline || `Day ${reportDay} Recap`,
      primaryImageUrl: articles[0]?.imageUrl || null,
      metadata: {
        ...metadata,
        generatedBy: "gemini-2.0-flash-lite",
      },
      isPublished: true,
    };

    await db.doc(basePath).set(dayIndex, { merge: true });

    logger.info(`Successfully saved ${articles.length} articles to ${basePath}`);
    return basePath;
  }

  // Legacy single-article save (backward compatibility)
  const imageResult = await getArticleImage({
    headline: content.headline,
    category: NEWS_CATEGORIES.DAILY,
  });

  const newsEntry = {
    reportDay,
    currentDay: metadata.currentDay,
    createdAt: new Date(),
    updatedAt: new Date(),
    headline: content.headline,
    summary: content.summary,
    dciRecap: content.dciRecap || null,
    fantasySpotlight: content.fantasySpotlight || null,
    crossOverAnalysis: content.crossOverAnalysis || null,
    fantasyImpact: content.fantasyImpact || "",
    trendingCorps: content.trendingCorps || [],
    imageUrl: imageResult.url,
    imageIsPlaceholder: imageResult.isPlaceholder,
    imagePrompt: content.imagePrompt || null,
    metadata: {
      ...metadata,
      generatedBy: "gemini-2.0-flash-lite",
      imagePublicId: imageResult.publicId || null,
    },
    isPublished: true,
  };

  await db.doc(basePath).set(newsEntry, { merge: true });

  logger.info("Saved daily news to path:", {
    path: basePath,
    headline: content.headline,
    reportDay,
  });

  await saveToNewsHubLegacy(db, {
    category: NEWS_CATEGORIES.DCI_RECAP,
    date: new Date(),
    offSeasonDay: reportDay,
    content,
    metadata,
    imageResult,
  });

  return basePath;
}

// =============================================================================
// FIRESTORE TRIGGER: Fantasy Recap Updated (Subcollection)
// =============================================================================

/**
 * Firestore trigger: Generate news when fantasy_recaps day documents are created/updated
 * This triggers after the daily scoring processor creates a day's recap
 * OPTIMIZATION: Now listens on subcollection (one doc per day) instead of parent document
 */
exports.onFantasyRecapUpdated = onDocumentWritten(
  {
    document: "fantasy_recaps/{seasonId}/days/{dayId}",
    timeoutSeconds: 180,
    memory: "1GiB",
    secrets: [geminiApiKey, cloudinaryCloudName, cloudinaryApiKey, cloudinaryApiSecret],
  },
  async (event) => {
    const db = getDb();

    try {
      const afterData = event.data?.after?.data();

      // Only process if document was created or updated (not deleted)
      if (!afterData) {
        logger.info("Document deleted, skipping news generation");
        return;
      }

      // Each day document IS the recap - no longer an array
      const recap = afterData;
      const reportDay = recap.offSeasonDay;

      if (!reportDay) {
        logger.info("No offSeasonDay in recap, skipping news generation");
        return;
      }

      logger.info(`Processing recap for day ${reportDay} for news generation`);

      // Get the season document to find dataDocId
      const seasonDoc = await db.doc(`seasons/${event.params.seasonId}`).get();
      const seasonData = seasonDoc.exists ? seasonDoc.data() : null;

      try {
          const currentDay = reportDay + 1; // News runs post-midnight, so currentDay is reportDay + 1

          // Use dataDocId from season, or fall back to seasonId (they are typically the same)
          const dataDocId = seasonData?.dataDocId || event.params.seasonId;

          // Always try to use new 5-article generator with Imagen
          logger.info("Generating 5 articles for news", {
            reportDay,
            currentDay,
            dataDocId,
            seasonId: event.params.seasonId,
          });

          const result = await generateAllArticles({
            db,
            dataDocId,
            seasonId: event.params.seasonId,
            currentDay,
          });

          if (result.success && result.articles) {
            logger.info(`Successfully generated ${result.articles.length} articles`);
            await saveDailyNews(db, {
              reportDay,
              content: result.articles[0] || {},
              metadata: result.metadata,
              articles: result.articles,
              seasonId: event.params.seasonId, // Use season name for organization
            });
          } else {
            logger.warn("Article generation failed or returned no articles, falling back to legacy", {
              error: result.error,
              articlesCount: result.articles?.length,
            });
            // Fallback to legacy fantasy-only generation
            const fantasyResult = await generateFantasyRecap(recap);

            if (fantasyResult.success && fantasyResult.content) {
              await saveToNewsHubLegacy(db, {
                category: NEWS_CATEGORIES.FANTASY,
                date: recap.date || new Date(),
                offSeasonDay: reportDay,
                content: fantasyResult.content,
                metadata: {
                  showCount: recap.shows?.length || 0,
                  seasonId: event.params.seasonId,
                },
              });
            }
          }
      } catch (recapError) {
        logger.error("Error processing recap:", recapError);
      }
    } catch (error) {
      logger.error("Error in fantasy recap trigger:", error);
    }
  }
);

// =============================================================================
// CALLABLE FUNCTIONS
// =============================================================================

/**
 * Callable function to manually trigger daily news generation (for admin use)
 */
exports.triggerDailyNews = onCall(
  {
    cors: true,
    timeoutSeconds: 180,
    memory: "1GiB",
    secrets: [geminiApiKey, cloudinaryCloudName, cloudinaryApiKey, cloudinaryApiSecret],
  },
  async (request) => {
    checkAdminAuth(request.auth);

    const db = getDb();

    const { currentDay, dataDocId, seasonId } = request.data;

    if (!currentDay || !dataDocId || !seasonId) {
      throw new HttpsError("invalid-argument", "Missing required parameters: currentDay, dataDocId, seasonId");
    }

    try {
      const result = await generateAllArticles({
        db,
        dataDocId,
        seasonId,
        currentDay,
      });

      if (result.success && result.articles) {
        const reportDay = currentDay - 1;
        await saveDailyNews(db, {
          reportDay,
          content: result.articles[0] || {},
          metadata: result.metadata,
          articles: result.articles,
          seasonId, // Use season name for organization
        });

        return {
          success: true,
          reportDay,
          articleCount: result.articles.length,
          headlines: result.articles.map(a => a.headline),
        };
      }

      return { success: false, error: result.error };
    } catch (error) {
      logger.error("Error in manual daily news generation:", error);
      throw new HttpsError("internal", error.message);
    }
  }
);

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
// =============================================================================

const NEWS_FEED_CACHE_TTL = 60 * 1000; // 1 minute server-side cache
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
          ? (reactionDoc.data().counts || defaultReactionCounts)
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
 * Cache behavior:
 * - CDN caches for 5 minutes (s-maxage=300)
 * - Browser caches for 1 minute (max-age=60)
 * - stale-while-revalidate allows serving stale content while fetching fresh
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
        // Set CDN and browser caching headers
        res.set("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
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

      // Set CDN and browser caching headers
      res.set("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
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

// =============================================================================
// LEGACY HANDLERS (for backward compatibility)
// =============================================================================

/**
 * Handle DCI scores news generation (legacy)
 */
async function handleDciScoresNews(scoreData) {
  const db = getDb();

  try {
    const previousScores = await fetchPreviousScores(db, scoreData.year);

    const enrichedData = {
      ...scoreData,
      previousScores,
    };

    const result = await generateNightlyRecap(enrichedData);

    if (result.success && result.content) {
      await saveToNewsHubLegacy(db, {
        category: NEWS_CATEGORIES.DCI_RECAP,
        date: new Date(scoreData.eventDate),
        content: result.content,
        metadata: {
          eventName: scoreData.eventName,
          location: scoreData.location,
          corpsCount: scoreData.scores?.length || 0,
          year: scoreData.year,
        },
      });

      return result.content;
    }

    return null;
  } catch (error) {
    logger.error("Error handling DCI scores news:", error);
    throw error;
  }
}

/**
 * Handle fantasy recap news generation (legacy)
 */
async function handleFantasyRecapNews(recapData) {
  const db = getDb();

  try {
    const result = await generateFantasyRecap(recapData);

    if (result.success && result.content) {
      await saveToNewsHubLegacy(db, {
        category: NEWS_CATEGORIES.FANTASY,
        date: new Date(),
        offSeasonDay: recapData.offSeasonDay,
        content: result.content,
        metadata: {
          showCount: recapData.shows?.length || 0,
        },
      });

      return result.content;
    }

    return null;
  } catch (error) {
    logger.error("Error handling fantasy recap news:", error);
    throw error;
  }
}

/**
 * Fetch previous event scores for comparison (legacy)
 */
async function fetchPreviousScores(db, year) {
  try {
    const yearDoc = await db.collection("historical_scores").doc(year.toString()).get();

    if (!yearDoc.exists) {
      return null;
    }

    const data = yearDoc.data().data || [];

    if (data.length < 2) {
      return null;
    }

    const sortedEvents = data.sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return sortedEvents[1]?.scores || null;
  } catch (error) {
    logger.error("Error fetching previous scores:", error);
    return null;
  }
}

/**
 * Save generated content to the legacy NewsHub collection
 */
async function saveToNewsHubLegacy(db, { category, date, content, metadata, offSeasonDay, imageResult }) {
  const newsHubRef = db.collection("news_hub");

  // Get image if not already provided
  const image = imageResult || await getArticleImage({
    headline: content.headline,
    category,
  });

  // Safely convert date - handles Firestore Timestamps, Date objects, and strings
  let safeDate;
  if (date instanceof Date) {
    safeDate = date;
  } else if (date && typeof date.toDate === "function") {
    // Firestore Timestamp
    safeDate = date.toDate();
  } else if (date) {
    safeDate = new Date(date);
  } else {
    safeDate = new Date();
  }

  // Ensure date is valid
  if (isNaN(safeDate.getTime())) {
    logger.warn("Invalid date provided, using current date");
    safeDate = new Date();
  }

  const newsEntry = {
    category,
    date: safeDate,
    createdAt: new Date(),
    headline: content.headline,
    summary: content.summary,

    // Full story (legacy) or narrative sections
    fullStory: content.fullStory || content.dciRecap?.narrative || "",

    // Multi-section content (if available)
    dciRecap: content.dciRecap || null,
    fantasySpotlight: content.fantasySpotlight || null,
    crossOverAnalysis: content.crossOverAnalysis || null,

    // Legacy fields
    fantasyImpact: content.fantasyImpact || "",
    fantasyMetrics: content.fantasyMetrics || null,
    captionBreakdown: content.captionBreakdown || content.dciRecap?.captionLeaders || [],
    trendingCorps: content.trendingCorps || [],

    // Image
    imageUrl: image.url,
    imageIsPlaceholder: image.isPlaceholder,
    imagePrompt: content.imagePrompt || null,

    // Metadata
    metadata: {
      ...metadata,
      offSeasonDay,
      generatedBy: "gemini-2.0-flash-lite",
      imagePublicId: image.publicId || null,
    },

    isPublished: true,
  };

  const docRef = await newsHubRef.add(newsEntry);

  logger.info("Saved news entry to NewsHub (legacy):", {
    docId: docRef.id,
    category,
    headline: content.headline,
  });

  // Cleanup old entries (keep last 50 per category)
  await cleanupOldNewsEntries(db, category);

  return docRef.id;
}

/**
 * Cleanup old news entries to manage storage
 */
async function cleanupOldNewsEntries(db, category) {
  try {
    const newsHubRef = db.collection("news_hub");
    const oldEntries = await newsHubRef
      .where("category", "==", category)
      .orderBy("createdAt", "desc")
      .offset(50)
      .limit(20)
      .get();

    if (oldEntries.empty) {
      return;
    }

    const batch = db.batch();
    oldEntries.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    logger.info(`Cleaned up ${oldEntries.size} old news entries for category: ${category}`);
  } catch (error) {
    logger.warn("Error cleaning up old news entries:", error);
  }
}

// =============================================================================
// LEGACY EXPORT: Manual trigger (kept for backward compatibility)
// =============================================================================

exports.triggerNewsGeneration = onCall(
  {
    cors: true,
    timeoutSeconds: 120,
    memory: "512MiB",
    secrets: [geminiApiKey, cloudinaryCloudName, cloudinaryApiKey, cloudinaryApiSecret],
  },
  async (request) => {
    checkAdminAuth(request.auth);

    const db = getDb();

    const { type, data } = request.data;

    try {
      let result;
      switch (type) {
        case "daily":
          result = await handleDailyNewsGeneration(data);
          break;
        case "dci":
          result = await handleDciScoresNews(data);
          break;
        case "fantasy":
          result = await handleFantasyRecapNews(data);
          break;
        default:
          throw new HttpsError("invalid-argument", "Invalid news type");
      }

      return { success: true, result };
    } catch (error) {
      logger.error("Error in manual news generation:", error);
      throw new HttpsError("internal", error.message);
    }
  }
);

// =============================================================================
// ARTICLE MANAGEMENT (Admin)
// =============================================================================

/**
 * Check if user is admin - helper function
 * Uses Firebase auth custom claims (consistent with other admin functions)
 */
function checkAdminAuth(auth) {
  if (!auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }

  if (!auth.token || !auth.token.admin) {
    throw new HttpsError("permission-denied", "Only admins can manage articles");
  }
}

/**
 * List all articles for admin management
 * Uses collection group query on 'articles' subcollection for efficient cross-season querying
 * Also includes legacy flat collection articles
 */
exports.listAllArticles = onCall(
  {
    cors: true,
    timeoutSeconds: 60,
  },
  async (request) => {
    const db = getDb();
    checkAdminAuth(request.auth);

    const { limit = 20, startAfter = null } = request.data || {};

    try {
      const articles = [];

      // Build the query with pagination
      let query = db.collectionGroup("articles")
        .orderBy("createdAt", "desc")
        .limit(limit + 1); // Fetch one extra to check if there are more

      // If we have a startAfter cursor, apply it
      if (startAfter) {
        const startAfterDate = new Date(startAfter);
        query = query.startAfter(startAfterDate);
      }

      const articlesSnapshot = await query.get();

      // Check if there are more articles beyond the requested limit
      const hasMore = articlesSnapshot.docs.length > limit;
      const docsToProcess = hasMore
        ? articlesSnapshot.docs.slice(0, limit)
        : articlesSnapshot.docs;

      for (const doc of docsToProcess) {
        const data = doc.data();
        const articleType = doc.id;

        // Extract seasonId and reportDay from document path
        // Path format: news_hub/{seasonId}/days/day_{n}/articles/{type}
        const pathParts = doc.ref.path.split("/");
        const seasonId = pathParts[1];
        const dayId = pathParts[3]; // e.g., "day_49"
        const reportDay = parseInt(dayId.replace("day_", ""), 10) || data.reportDay;

        // Determine category from article type
        const category =
          articleType === "dci_recap" ? "analysis" :
          articleType === "deep_analytics" ? "analysis" :
          articleType.startsWith("dci_") ? "dci" :
          articleType.startsWith("fantasy_") ? "fantasy" : "dci";

        articles.push({
          id: `${dayId}_${articleType}`,
          path: doc.ref.path,
          source: "current_season",
          seasonId,
          reportDay,
          articleType,
          headline: data.headline || "Untitled",
          summary: data.summary || "",
          isPublished: data.isPublished !== false,
          isArchived: data.isArchived || false,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
          imageUrl: data.imageUrl,
          category,
        });
      }

      // Get the last article's createdAt for the cursor
      const lastCreatedAt = articles.length > 0
        ? articles[articles.length - 1].createdAt
        : null;

      logger.info(`Listed ${articles.length} articles for admin (hasMore: ${hasMore})`);

      return {
        success: true,
        articles,
        hasMore,
        lastCreatedAt,
      };
    } catch (error) {
      logger.error("Error listing articles:", error);
      throw new HttpsError("internal", "Failed to list articles");
    }
  }
);

/**
 * Get a single article's full data for editing
 */
exports.getArticleForEdit = onCall(
  {
    cors: true,
    timeoutSeconds: 30,
  },
  async (request) => {
    const db = getDb();
    checkAdminAuth(request.auth);

    const { path } = request.data || {};

    if (!path) {
      throw new HttpsError("invalid-argument", "Article path is required");
    }

    try {
      const doc = await db.doc(path).get();

      if (!doc.exists) {
        throw new HttpsError("not-found", "Article not found");
      }

      const data = doc.data();

      return {
        success: true,
        article: {
          id: doc.id,
          path,
          ...data,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
          date: data.date?.toDate?.()?.toISOString() || data.date,
        },
      };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error("Error fetching article for edit:", error);
      throw new HttpsError("internal", "Failed to fetch article");
    }
  }
);

/**
 * Update an article's content
 */
exports.updateArticle = onCall(
  {
    cors: true,
    timeoutSeconds: 30,
  },
  async (request) => {
    const db = getDb();
    checkAdminAuth(request.auth);

    const { path, updates } = request.data || {};

    if (!path) {
      throw new HttpsError("invalid-argument", "Article path is required");
    }

    if (!updates || typeof updates !== "object") {
      throw new HttpsError("invalid-argument", "Updates object is required");
    }

    // Allowed fields for editing
    const allowedFields = [
      "headline",
      "summary",
      "fullStory",
      "narrative",
      "fantasyImpact",
      "dciRecap",
      "fantasySpotlight",
      "crossOverAnalysis",
      "trendingCorps",
      "imageUrl",
      "isPublished",
      "isArchived",
    ];

    // Filter to only allowed fields
    const sanitizedUpdates = {};
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        sanitizedUpdates[field] = updates[field];
      }
    }

    // Sync fullStory and narrative fields - when one is updated, update both
    // This ensures consistency since generated articles use 'narrative' while user submissions use 'fullStory'
    if (sanitizedUpdates.fullStory !== undefined && sanitizedUpdates.narrative === undefined) {
      sanitizedUpdates.narrative = sanitizedUpdates.fullStory;
    }
    if (sanitizedUpdates.narrative !== undefined && sanitizedUpdates.fullStory === undefined) {
      sanitizedUpdates.fullStory = sanitizedUpdates.narrative;
    }

    if (Object.keys(sanitizedUpdates).length === 0) {
      throw new HttpsError("invalid-argument", "No valid fields to update");
    }

    try {
      // Add updatedAt timestamp
      sanitizedUpdates.updatedAt = new Date();
      sanitizedUpdates.lastEditedBy = request.auth.uid;

      await db.doc(path).update(sanitizedUpdates);

      logger.info("Article updated:", { path, fields: Object.keys(sanitizedUpdates) });

      return { success: true, message: "Article updated successfully" };
    } catch (error) {
      logger.error("Error updating article:", error);
      throw new HttpsError("internal", "Failed to update article");
    }
  }
);

/**
 * Archive or unarchive an article
 * Archived articles have isPublished=false and isArchived=true
 */
exports.archiveArticle = onCall(
  {
    cors: true,
    timeoutSeconds: 30,
  },
  async (request) => {
    const db = getDb();
    checkAdminAuth(request.auth);

    const { path, archive = true } = request.data || {};

    if (!path) {
      throw new HttpsError("invalid-argument", "Article path is required");
    }

    try {
      await db.doc(path).update({
        isPublished: !archive,
        isArchived: archive,
        updatedAt: new Date(),
        lastEditedBy: request.auth.uid,
      });

      logger.info(`Article ${archive ? "archived" : "unarchived"}:`, { path });

      return {
        success: true,
        message: archive ? "Article archived successfully" : "Article restored successfully",
      };
    } catch (error) {
      logger.error("Error archiving article:", error);
      throw new HttpsError("internal", "Failed to archive article");
    }
  }
);

/**
 * Delete an article permanently (use with caution)
 */
exports.deleteArticle = onCall(
  {
    cors: true,
    timeoutSeconds: 30,
  },
  async (request) => {
    const db = getDb();
    checkAdminAuth(request.auth);

    const { path, confirmDelete } = request.data || {};

    if (!path) {
      throw new HttpsError("invalid-argument", "Article path is required");
    }

    if (confirmDelete !== true) {
      throw new HttpsError("invalid-argument", "Must confirm deletion");
    }

    try {
      await db.doc(path).delete();

      logger.info("Article deleted:", { path });

      return { success: true, message: "Article deleted permanently" };
    } catch (error) {
      logger.error("Error deleting article:", error);
      throw new HttpsError("internal", "Failed to delete article");
    }
  }
);

/**
 * Regenerate AI image for an existing article
 * Admin-only function to create a new image if the current one is not satisfactory
 */
exports.regenerateArticleImage = onCall(
  {
    cors: true,
    timeoutSeconds: 120, // Image generation can take time
    secrets: [geminiApiKey, cloudinaryCloudName, cloudinaryApiKey, cloudinaryApiSecret],
  },
  async (request) => {
    const db = getDb();
    checkAdminAuth(request.auth);

    const { path, headline, category } = request.data || {};

    if (!path) {
      throw new HttpsError("invalid-argument", "Article path is required");
    }

    if (!headline) {
      throw new HttpsError("invalid-argument", "Headline is required for image generation");
    }

    try {
      // Verify article exists
      const doc = await db.doc(path).get();
      if (!doc.exists) {
        throw new HttpsError("not-found", "Article not found");
      }

      const articleData = doc.data();
      const effectiveCategory = category || articleData.category || "dci";

      logger.info("Regenerating image for article:", { path, headline, category: effectiveCategory });

      // Generate new AI image
      const {
        generateImageWithImagen,
        buildArticleImagePrompt,
        buildStandingsImagePrompt,
        buildCaptionsImagePrompt,
        buildAnalyticsImagePrompt,
        buildUnderdogImagePrompt,
        buildCorpsSpotlightImagePrompt,
        buildFantasyPerformersImagePrompt,
        buildFantasyLeagueImagePrompt,
        getUniformDetailsFromFirestore,
        getShowTitleFromFirestore,
        ARTICLE_TYPES,
      } = require("../helpers/newsGeneration");
      const { uploadFromUrl } = require("../helpers/mediaService");

      // Always build a fresh prompt when regenerating
      // This ensures we use the latest prompt templates and uniform data
      let imagePrompt = null;

      // Build prompt based on article type
      const articleType = articleData.type;
      const metadata = articleData.metadata || {};

      if (articleType === ARTICLE_TYPES.DCI_STANDINGS && articleData.standings?.[0]) {
          const topCorps = articleData.standings[0];
          imagePrompt = buildStandingsImagePrompt(
            topCorps.corps,
            topCorps.sourceYear || new Date().getFullYear(),
            metadata.showLocation,
            metadata.showName,
            topCorps.showTitle
          );
        } else if (articleType === ARTICLE_TYPES.DCI_CAPTIONS && articleData.captionBreakdown) {
          const featured = articleData.standings?.[0] || { corps: "Blue Devils", sourceYear: 2024 };
          const topCaption = Object.keys(articleData.captionBreakdown || {})[0] || "General Effect";
          imagePrompt = buildCaptionsImagePrompt(
            featured.corps,
            featured.sourceYear || new Date().getFullYear(),
            topCaption,
            metadata.showLocation,
            featured.showTitle
          );
        } else if (articleType === ARTICLE_TYPES.FANTASY_PERFORMERS && articleData.topPerformers?.[0]) {
          const top = articleData.topPerformers[0];
          imagePrompt = buildFantasyPerformersImagePrompt(
            top.corpsName || "Champion Corps",
            "Victory celebration",
            top.location,
            top.uniformDesign
          );
        } else if (articleType === ARTICLE_TYPES.FANTASY_LEAGUES) {
          imagePrompt = buildFantasyLeagueImagePrompt();
        } else if (articleType === ARTICLE_TYPES.DEEP_ANALYTICS && articleData.featuredCorps) {
          imagePrompt = buildAnalyticsImagePrompt(
            articleData.featuredCorps,
            articleData.featuredYear || new Date().getFullYear(),
            "trajectory analysis",
            articleData.showTitle
          );
        } else if (articleType === ARTICLE_TYPES.UNDERDOG_STORY && articleData.featuredCorps) {
          imagePrompt = buildUnderdogImagePrompt(
            articleData.featuredCorps,
            articleData.featuredYear || new Date().getFullYear(),
            metadata.showLocation,
            articleData.showTitle
          );
        } else if (articleType === ARTICLE_TYPES.CORPS_SPOTLIGHT && articleData.featuredCorps) {
          imagePrompt = buildCorpsSpotlightImagePrompt(
            articleData.featuredCorps,
            articleData.featuredYear || new Date().getFullYear(),
            articleData.showTitle
          );
        } else {
          // Fallback: try to identify corps from article data and look up uniform details
          const corpsName = articleData.featuredCorps ||
            articleData.standings?.[0]?.corps ||
            articleData.topPerformers?.[0]?.corpsName ||
            null;

          const year = articleData.featuredYear ||
            articleData.standings?.[0]?.sourceYear ||
            new Date().getFullYear();

          let uniformDetails = null;
          let showTitle = articleData.showTitle || null;

          if (corpsName) {
            // Look up corps-specific uniform details from Firestore
            uniformDetails = await getUniformDetailsFromFirestore(db, corpsName, year);
            if (!showTitle) {
              showTitle = await getShowTitleFromFirestore(db, corpsName, year);
            }
            logger.info("Found corps uniform details for image generation:", {
              corpsName,
              year,
              hasUniformDetails: !!uniformDetails,
              showTitle
            });
          }

          imagePrompt = buildArticleImagePrompt(
            effectiveCategory,
            headline,
            articleData.summary || "",
            { corpsName, uniformDetails, showTitle }
          );
        }

      logger.info("Using freshly built image prompt:", {
        category: effectiveCategory,
        articleType: articleData.type,
        promptLength: imagePrompt?.length
      });

      // Generate the image
      const imageData = await generateImageWithImagen(imagePrompt);

      if (!imageData) {
        throw new HttpsError("internal", "Failed to generate image. Please try again.");
      }

      // Extract article ID from path for the public ID
      const pathParts = path.split("/");
      const articleId = pathParts[pathParts.length - 1];

      // Upload to Cloudinary
      const uploadResult = await uploadFromUrl(imageData, {
        folder: "marching-art/news",
        publicId: `regenerated_${articleId}_${Date.now()}`,
        category: effectiveCategory,
        headline,
      });

      if (!uploadResult.success) {
        throw new HttpsError("internal", "Failed to upload generated image");
      }

      // Update article with new image URL
      await db.doc(path).update({
        imageUrl: uploadResult.url,
        imageIsPlaceholder: false,
        imageRegeneratedAt: new Date(),
        imageRegeneratedBy: request.auth.uid,
        updatedAt: new Date(),
        lastEditedBy: request.auth.uid,
      });

      logger.info("Article image regenerated successfully:", {
        path,
        newImageUrl: uploadResult.url,
      });

      return {
        success: true,
        message: "Image regenerated successfully",
        imageUrl: uploadResult.url,
      };
    } catch (error) {
      logger.error("Error regenerating article image:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Failed to regenerate image");
    }
  }
);

// =============================================================================
// USER NEWS SUBMISSIONS
// =============================================================================

/**
 * Submit a news article for admin approval
 * Any authenticated user can submit articles
 */
exports.submitNewsForApproval = onCall(
  {
    cors: true,
    timeoutSeconds: 30,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be logged in to submit articles");
    }

    const db = getDb();
    const { headline, summary, fullStory, category, imageUrl } = request.data || {};

    // Validate required fields
    if (!headline || typeof headline !== "string" || headline.trim().length < 10) {
      throw new HttpsError("invalid-argument", "Headline must be at least 10 characters");
    }

    if (!summary || typeof summary !== "string" || summary.trim().length < 20) {
      throw new HttpsError("invalid-argument", "Summary must be at least 20 characters");
    }

    if (!fullStory || typeof fullStory !== "string" || fullStory.trim().length < 100) {
      throw new HttpsError("invalid-argument", "Full story must be at least 100 characters");
    }

    const validCategories = ["dci", "fantasy", "analysis"];
    if (!category || !validCategories.includes(category)) {
      throw new HttpsError("invalid-argument", "Invalid category");
    }

    // Validate image URL if provided
    if (imageUrl && typeof imageUrl === "string") {
      try {
        new URL(imageUrl);
      } catch {
        throw new HttpsError("invalid-argument", "Invalid image URL");
      }
    }

    try {
      // Get user profile for author info
      const userDoc = await db
        .collection("artifacts")
        .doc(process.env.DATA_NAMESPACE || "marching-art")
        .collection("users")
        .doc(request.auth.uid)
        .collection("profile")
        .doc("data")
        .get();

      const userData = userDoc.exists ? userDoc.data() : {};
      const authorName = userData.displayName || userData.username || "Anonymous";

      // Create the submission
      const submission = {
        headline: headline.trim(),
        summary: summary.trim(),
        fullStory: fullStory.trim(),
        category,
        imageUrl: imageUrl?.trim() || null,
        status: "pending", // pending, approved, rejected
        authorUid: request.auth.uid,
        authorName,
        authorEmail: request.auth.token.email || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const docRef = await db.collection("news_submissions").add(submission);

      logger.info("News submission received:", {
        submissionId: docRef.id,
        authorUid: request.auth.uid,
        headline: headline.substring(0, 50),
      });

      return {
        success: true,
        message: "Article submitted for review. An admin will review it shortly.",
        submissionId: docRef.id,
      };
    } catch (error) {
      logger.error("Error submitting news article:", error);
      throw new HttpsError("internal", "Failed to submit article. Please try again.");
    }
  }
);

// =============================================================================
// ADMIN ARTICLE MANAGEMENT
// =============================================================================

/**
 * List all pending article submissions for admin review
 */
exports.listPendingSubmissions = onCall(
  {
    cors: true,
    timeoutSeconds: 30,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be logged in");
    }

    if (!request.auth.token.admin) {
      throw new HttpsError("permission-denied", "Admin access required");
    }

    const db = getDb();
    const { status = "pending", limit = 50 } = request.data || {};

    try {
      let query = db.collection("news_submissions").orderBy("createdAt", "desc");

      if (status !== "all") {
        query = query.where("status", "==", status);
      }

      const snapshot = await query.limit(limit).get();

      const submissions = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || null,
      }));

      return {
        success: true,
        submissions,
        count: submissions.length,
      };
    } catch (error) {
      logger.error("Error listing submissions:", error);
      throw new HttpsError("internal", "Failed to list submissions");
    }
  }
);

/**
 * Approve an article submission and publish it
 * Admin can choose to use submitted image, generate AI image, or publish without image
 * imageOption: 'submitted' | 'generate' | 'none'
 */
exports.approveSubmission = onCall(
  {
    cors: true,
    timeoutSeconds: 120,
    memory: "1GiB",
    secrets: [geminiApiKey],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be logged in");
    }

    if (!request.auth.token.admin) {
      throw new HttpsError("permission-denied", "Admin access required");
    }

    const db = getDb();
    // Support both old 'generateImage' boolean and new 'imageOption' string
    const { submissionId, generateImage, imageOption } = request.data || {};

    if (!submissionId) {
      throw new HttpsError("invalid-argument", "Submission ID is required");
    }

    try {
      // Get the submission
      const submissionRef = db.collection("news_submissions").doc(submissionId);
      const submissionDoc = await submissionRef.get();

      if (!submissionDoc.exists) {
        throw new HttpsError("not-found", "Submission not found");
      }

      const submission = submissionDoc.data();

      if (submission.status === "approved") {
        throw new HttpsError("failed-precondition", "This submission has already been approved");
      }

      // Get current season info
      const seasonDoc = await db.doc("game-settings/season").get();
      const seasonData = seasonDoc.exists ? seasonDoc.data() : {};
      const seasonId = seasonData.seasonUid || "current_season";
      const currentDay = seasonData.currentDay || 1;

      let finalImageUrl = null;

      // Determine image handling based on imageOption or legacy generateImage flag
      // imageOption takes precedence if provided
      let effectiveOption = imageOption;
      if (!effectiveOption) {
        // Legacy support: convert boolean generateImage to imageOption
        if (generateImage === true) {
          effectiveOption = submission.imageUrl ? "submitted" : "generate";
        } else if (generateImage === false) {
          effectiveOption = "none";
        } else {
          // Default: use submitted image if available, otherwise generate
          effectiveOption = submission.imageUrl ? "submitted" : "generate";
        }
      }

      if (effectiveOption === "submitted" && submission.imageUrl) {
        // Use the submitted image
        finalImageUrl = submission.imageUrl;
        logger.info("Using submitted image:", { submissionId, imageUrl: finalImageUrl });
      } else if (effectiveOption === "generate") {
        // Generate a new AI image
        logger.info("Generating AI image for approved article:", { submissionId });

        const {
          generateImageWithImagen,
          buildArticleImagePrompt,
          buildCorpsSpotlightImagePrompt,
          buildAnalyticsImagePrompt,
          buildFantasyLeagueImagePrompt,
          buildFantasyPerformersImagePrompt,
          DCI_UNIFORMS,
        } = require("../helpers/newsGeneration");
        const { uploadFromUrl } = require("../helpers/mediaService");

        // Try to extract a corps name from the headline/summary for specialized prompts
        const knownCorps = Object.keys(DCI_UNIFORMS);
        const contentToSearch = `${submission.headline} ${submission.summary}`.toLowerCase();
        const extractedCorps = knownCorps.find(corps =>
          contentToSearch.includes(corps.toLowerCase())
        );
        const currentYear = new Date().getFullYear();

        // Build a contextual prompt based on article content
        // Use specialized prompt builders when possible for better image quality
        let imagePrompt;

        if (submission.category === "dci" && extractedCorps) {
          // Use corps spotlight prompt for DCI articles about specific corps
          imagePrompt = buildCorpsSpotlightImagePrompt(
            extractedCorps,
            currentYear,
            null // showTitle
          );
          logger.info("Using specialized corps spotlight prompt:", { extractedCorps });
        } else if (submission.category === "analysis" && extractedCorps) {
          // Use analytics prompt for analysis articles about specific corps
          imagePrompt = buildAnalyticsImagePrompt(
            extractedCorps,
            currentYear,
            "performance analysis",
            null // showTitle
          );
          logger.info("Using specialized analytics prompt:", { extractedCorps });
        } else if (submission.category === "fantasy") {
          // Use fantasy league prompt for fantasy articles
          if (extractedCorps) {
            imagePrompt = buildFantasyPerformersImagePrompt(
              extractedCorps,
              "Championship celebration",
              null, // location
              null  // uniformDesign
            );
            logger.info("Using specialized fantasy performers prompt:", { extractedCorps });
          } else {
            imagePrompt = buildFantasyLeagueImagePrompt();
            logger.info("Using specialized fantasy league prompt");
          }
        } else {
          // Fallback to generic prompt builder
          imagePrompt = buildArticleImagePrompt(
            submission.category,
            submission.headline,
            submission.summary
          );
          logger.info("Using generic article prompt:", { category: submission.category });
        }

        // Generate the image
        const imageData = await generateImageWithImagen(imagePrompt);

        if (imageData) {
          // Upload to Cloudinary
          const uploadResult = await uploadFromUrl(imageData, {
            folder: "marching-art/user-articles",
            publicId: `article_${submissionId}`,
            category: submission.category,
            headline: submission.headline,
          });

          if (uploadResult.success) {
            finalImageUrl = uploadResult.url;
            logger.info("Image generated and uploaded:", { url: finalImageUrl });
          }
        }
      }

      // Create the published article in news_hub
      // User submissions go to a "community" subcollection
      const articlePath = `news_hub/${seasonId}/community/article_${submissionId}`;

      const publishedArticle = {
        type: "community_submission",
        submissionId,
        reportDay: currentDay,
        createdAt: submission.createdAt,
        publishedAt: new Date(),
        updatedAt: new Date(),

        // Article content
        headline: submission.headline,
        summary: submission.summary,
        narrative: submission.fullStory,
        category: submission.category,

        // Image
        imageUrl: finalImageUrl,
        imageIsPlaceholder: !finalImageUrl,

        // Author info
        authorUid: submission.authorUid,
        authorName: submission.authorName,

        // Metadata
        metadata: {
          source: "community_submission",
          approvedBy: request.auth.uid,
          approvedAt: new Date(),
        },

        isPublished: true,
      };

      await db.doc(articlePath).set(publishedArticle);

      // Update submission status
      await submissionRef.update({
        status: "approved",
        publishedAt: new Date(),
        updatedAt: new Date(),
        approvedBy: request.auth.uid,
        publishedImageUrl: finalImageUrl,
        publishedPath: articlePath,
      });

      logger.info("Article approved and published:", {
        submissionId,
        articlePath,
        hasImage: !!finalImageUrl,
      });

      return {
        success: true,
        message: "Article approved and published successfully",
        articlePath,
        imageUrl: finalImageUrl,
      };
    } catch (error) {
      logger.error("Error approving submission:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Failed to approve submission");
    }
  }
);

/**
 * Reject an article submission
 */
exports.rejectSubmission = onCall(
  {
    cors: true,
    timeoutSeconds: 30,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be logged in");
    }

    if (!request.auth.token.admin) {
      throw new HttpsError("permission-denied", "Admin access required");
    }

    const db = getDb();
    const { submissionId, reason } = request.data || {};

    if (!submissionId) {
      throw new HttpsError("invalid-argument", "Submission ID is required");
    }

    try {
      const submissionRef = db.collection("news_submissions").doc(submissionId);
      const submissionDoc = await submissionRef.get();

      if (!submissionDoc.exists) {
        throw new HttpsError("not-found", "Submission not found");
      }

      const submission = submissionDoc.data();

      if (submission.status !== "pending") {
        throw new HttpsError("failed-precondition", "This submission has already been processed");
      }

      await submissionRef.update({
        status: "rejected",
        rejectionReason: reason || "Does not meet our content guidelines",
        rejectedBy: request.auth.uid,
        updatedAt: new Date(),
      });

      logger.info("Article rejected:", { submissionId, reason });

      return {
        success: true,
        message: "Submission rejected",
      };
    } catch (error) {
      logger.error("Error rejecting submission:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Failed to reject submission");
    }
  }
);
