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
const { onCall, HttpsError } = require("firebase-functions/v2/https");
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
    secrets: [geminiApiKey],
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
 * Path: /news_hub/{seasonId}/day_{reportDay}/articles/{type}
 */
async function saveDailyNews(db, { reportDay, content, metadata, articles, seasonId }) {
  // Use seasonId for organization, fallback to "current_season" for legacy
  const seasonPath = seasonId || "current_season";
  const basePath = `news_hub/${seasonPath}/day_${reportDay}`;

  // If we have the new 5-article structure, save each separately
  if (articles && articles.length > 0) {
    logger.info(`Saving ${articles.length} articles for Day ${reportDay}`);

    for (const article of articles) {
      const articlePath = `${basePath}/articles/${article.type}`;

      const articleEntry = {
        type: article.type,
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
// FIRESTORE TRIGGER: Fantasy Recap Updated
// =============================================================================

/**
 * Firestore trigger: Generate news when fantasy_recaps are updated
 * This triggers after the daily scoring processor creates/updates recap data
 */
exports.onFantasyRecapUpdated = onDocumentWritten(
  {
    document: "fantasy_recaps/{seasonId}",
    timeoutSeconds: 180,
    memory: "1GiB",
    secrets: [geminiApiKey],
  },
  async (event) => {
    const db = getDb();

    try {
      const afterData = event.data?.after?.data();
      const beforeData = event.data?.before?.data();

      if (!afterData || !afterData.recaps) {
        logger.info("No recap data in document, skipping news generation");
        return;
      }

      // Find newly added recaps
      const beforeRecaps = beforeData?.recaps || [];
      const afterRecaps = afterData.recaps || [];

      const beforeDays = new Set(beforeRecaps.map(r => r.offSeasonDay));
      const newRecaps = afterRecaps.filter(r => !beforeDays.has(r.offSeasonDay));

      if (newRecaps.length === 0) {
        logger.info("No new recaps to process");
        return;
      }

      logger.info(`Processing ${newRecaps.length} new recap(s) for news generation`);

      // Get the season document to find dataDocId
      const seasonDoc = await db.doc(`seasons/${event.params.seasonId}`).get();
      const seasonData = seasonDoc.exists ? seasonDoc.data() : null;

      for (const recap of newRecaps) {
        try {
          const reportDay = recap.offSeasonDay;
          const currentDay = reportDay + 1; // News runs post-midnight, so currentDay is reportDay + 1

          if (seasonData?.dataDocId) {
            // Use new 5-article generator with Imagen
            const result = await generateAllArticles({
              db,
              dataDocId: seasonData.dataDocId,
              seasonId: event.params.seasonId,
              currentDay,
            });

            if (result.success && result.articles) {
              await saveDailyNews(db, {
                reportDay,
                content: result.articles[0] || {},
                metadata: result.metadata,
                articles: result.articles,
                seasonId: event.params.seasonId, // Use season name for organization
              });
            }
          } else {
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
          logger.error("Error processing individual recap:", recapError);
        }
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
    timeoutSeconds: 180,
    memory: "1GiB",
    secrets: [geminiApiKey],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "User must be authenticated");
    }

    const db = getDb();

    // Check if user is admin
    const userDoc = await db
      .collection("artifacts")
      .doc(process.env.DATA_NAMESPACE || "production")
      .collection("users")
      .doc(request.auth.uid)
      .collection("profile")
      .doc("data")
      .get();

    if (!userDoc.exists || userDoc.data().role !== "admin") {
      throw new HttpsError("permission-denied", "Only admins can trigger news generation");
    }

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
    timeoutSeconds: 30,
  },
  async (request) => {
    const db = getDb();
    const { day, seasonId } = request.data || {};

    if (!day) {
      throw new HttpsError("invalid-argument", "Missing required parameter: day");
    }

    try {
      // Use seasonId if provided, otherwise fall back to "current_season"
      const seasonPath = seasonId || "current_season";
      const docPath = `news_hub/${seasonPath}/day_${day}`;
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

/**
 * Fetch recent news entries for the frontend
 * Returns articles from the season-based structure: news_hub/{seasonId}/day_{n}/articles/{type}
 */
exports.getRecentNews = onCall(
  {
    timeoutSeconds: 30,
  },
  async (request) => {
    const db = getDb();
    const { limit = 10, category, seasonId } = request.data || {};

    try {
      // Get current season to find seasonId and currentDay if not provided
      let activeSeasonId = seasonId;
      let currentDay = null;

      if (!activeSeasonId) {
        // Find active season
        const seasonsSnapshot = await db.collection("seasons")
          .where("status", "==", "active")
          .limit(1)
          .get();

        if (!seasonsSnapshot.empty) {
          const seasonDoc = seasonsSnapshot.docs[0];
          activeSeasonId = seasonDoc.id;
          currentDay = seasonDoc.data().currentDay || 50;
        } else {
          // Fallback: try to find any season with articles
          activeSeasonId = "current_season";
          currentDay = 50;
        }
      }

      // If we still don't have currentDay, try to find the latest day with articles
      if (!currentDay) {
        const dayDocs = await db.collection(`news_hub/${activeSeasonId}`)
          .orderBy("reportDay", "desc")
          .limit(1)
          .get();

        if (!dayDocs.empty) {
          currentDay = dayDocs.docs[0].data().reportDay + 1;
        } else {
          currentDay = 50; // Default fallback
        }
      }

      const articles = [];
      const daysToFetch = Math.ceil(limit / 5) + 1; // 5 articles per day

      // Fetch articles from recent days
      for (let day = currentDay - 1; day > Math.max(0, currentDay - daysToFetch - 1); day--) {
        const dayPath = `news_hub/${activeSeasonId}/day_${day}`;

        // Check if day has articles
        const dayDoc = await db.doc(dayPath).get();
        if (!dayDoc.exists || !dayDoc.data().isPublished) continue;

        const dayData = dayDoc.data();
        const articleTypes = dayData.articleTypes || [
          "dci_standings", "dci_captions", "fantasy_performers", "fantasy_leagues", "deep_analytics"
        ];

        // Fetch each article for this day
        for (const articleType of articleTypes) {
          const articleDoc = await db.doc(`${dayPath}/articles/${articleType}`).get();

          if (articleDoc.exists) {
            const data = articleDoc.data();

            // Apply category filter if specified
            if (category) {
              const articleCategory =
                articleType.startsWith("dci_") ? "dci" :
                articleType.startsWith("fantasy_") ? "fantasy" :
                articleType === "deep_analytics" ? "analysis" : "dci";

              if (articleCategory !== category) continue;
            }

            articles.push({
              id: `${activeSeasonId}_day${day}_${articleType}`,
              seasonId: activeSeasonId,
              reportDay: day,
              articleType,
              category:
                articleType.startsWith("dci_") ? "dci" :
                articleType.startsWith("fantasy_") ? "fantasy" :
                articleType === "deep_analytics" ? "analysis" : "dci",
              ...data,
              createdAt: data.createdAt?.toDate?.()?.toISOString() || dayData.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
              updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.createdAt?.toDate?.()?.toISOString(),
            });
          }
        }

        // Stop if we have enough articles
        if (articles.length >= limit) break;
      }

      // Sort by createdAt descending and limit
      articles.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const limitedArticles = articles.slice(0, limit);

      return {
        success: true,
        news: limitedArticles,
        hasMore: articles.length > limit,
        seasonId: activeSeasonId,
        currentDay,
      };
    } catch (error) {
      logger.error("Error fetching recent news:", error);
      throw new HttpsError("internal", "Failed to fetch news");
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
    timeoutSeconds: 120,
    memory: "512MiB",
    secrets: [geminiApiKey],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "User must be authenticated");
    }

    const db = getDb();
    const userDoc = await db
      .collection("artifacts")
      .doc(process.env.DATA_NAMESPACE || "production")
      .collection("users")
      .doc(request.auth.uid)
      .collection("profile")
      .doc("data")
      .get();

    if (!userDoc.exists || userDoc.data().role !== "admin") {
      throw new HttpsError("permission-denied", "Only admins can trigger news generation");
    }

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
 * Returns articles from both current_season day structure and legacy collection
 */
exports.listAllArticles = onCall(
  {
    timeoutSeconds: 60,
  },
  async (request) => {
    const db = getDb();
    checkAdminAuth(request.auth);

    const { seasonId } = request.data || {};

    try {
      const articles = [];

      // Fetch from season-based structure (use provided seasonId or "current_season")
      const seasonPath = seasonId || "current_season";
      const seasonRef = db.collection(`news_hub/${seasonPath}`);
      const dayDocs = await seasonRef.listDocuments();

      for (const docRef of dayDocs) {
        const doc = await docRef.get();
        if (doc.exists) {
          const data = doc.data();
          articles.push({
            id: doc.id,
            path: `news_hub/${seasonPath}/${doc.id}`,
            source: seasonPath,
            reportDay: data.reportDay,
            headline: data.headline || "Untitled",
            summary: data.summary || "",
            isPublished: data.isPublished !== false,
            isArchived: data.isArchived || false,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
            updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
            imageUrl: data.imageUrl,
            category: data.category || "daily",
          });
        }
      }

      // Fetch from legacy flat collection
      const legacySnapshot = await db.collection("news_hub")
        .orderBy("createdAt", "desc")
        .limit(100)
        .get();

      legacySnapshot.docs.forEach((doc) => {
        const data = doc.data();
        articles.push({
          id: doc.id,
          path: `news_hub/${doc.id}`,
          source: "legacy",
          reportDay: data.metadata?.offSeasonDay,
          headline: data.headline || "Untitled",
          summary: data.summary || "",
          isPublished: data.isPublished !== false,
          isArchived: data.isArchived || false,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
          imageUrl: data.imageUrl,
          category: data.category || "dci",
        });
      });

      // Sort by createdAt descending
      articles.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0);
        const dateB = new Date(b.createdAt || 0);
        return dateB - dateA;
      });

      logger.info(`Listed ${articles.length} articles for admin`);

      return { success: true, articles };
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

// =============================================================================
// USER NEWS SUBMISSIONS
// =============================================================================

/**
 * Submit a news article for admin approval
 * Any authenticated user can submit articles
 */
exports.submitNewsForApproval = onCall(
  {
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
