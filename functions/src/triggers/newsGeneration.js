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
  generateNightlyRecap,
  generateFantasyRecap,
  getArticleImage,
} = require("../helpers/newsGeneration");
const { getCategoryFromType, NEWS_CATEGORIES } = require("../helpers/newsArticleShared");
const { checkAdminAuth } = require("./newsAdmin");

// Define Gemini API key secret for triggers that use news generation
const geminiApiKey = defineSecret("GOOGLE_GENERATIVE_AI_API_KEY");

// Define Cloudinary secrets for image uploads
const cloudinaryCloudName = defineSecret("CLOUDINARY_CLOUD_NAME");
const cloudinaryApiKey = defineSecret("CLOUDINARY_API_KEY");
const cloudinaryApiSecret = defineSecret("CLOUDINARY_API_SECRET");


// Pub/Sub topic for news generation requests
const NEWS_GENERATION_TOPIC = "news-generation-topic";


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
    // Generating 5 articles with Gemini image generation can take many minutes.
    // 540s is the max for gen2 event-driven functions; articles are also saved
    // incrementally so partial progress survives even if we still hit the ceiling.
    timeoutSeconds: 540,
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
    // Generate the 5 nightly articles with Imagen images. Persist each article the
    // moment it is generated so a slow image step / function timeout can't leave the
    // day with zero saved (and therefore invisible) articles.
    const result = await generateAllArticles({
      db,
      dataDocId,
      seasonId,
      currentDay,
      onArticleGenerated: (article, ctx) =>
        saveArticleDoc(db, { reportDay: ctx.reportDay, article, metadata: ctx.metadata, seasonId }),
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
 * Persist a single generated article to Firestore.
 * Path: /news_hub/{seasonId}/days/day_{reportDay}/articles/{type}
 *
 * Extracted so articles can be saved incrementally (one at a time, as each is
 * generated) rather than only in a final batch. Image generation is slow enough
 * that generating all five before the first write risks the caller's function
 * timing out with nothing persisted — leaving articles invisible on both the news
 * feed and the admin panel. Writing each article as it lands guarantees whatever
 * finished is durable and queryable regardless of a later timeout.
 */
async function saveArticleDoc(db, { reportDay, article, metadata, seasonId }) {
  const seasonPath = seasonId || "current_season";
  const articlePath = `news_hub/${seasonPath}/days/day_${reportDay}/articles/${article.type}`;

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
    captionInsights: article.captionInsights || null,
    topPerformers: article.topPerformers || null,
    leagueHighlights: article.leagueHighlights || null,
    insights: article.insights || null,
    trendingCorps: article.trendingCorps || null,
    recommendations: article.recommendations || null,
    fantasyImpact: article.fantasyImpact || null,

    // Image — only the fantasy-corps events article carries one (AI-generated,
    // quality model). The DCI-sourced articles ship imageUrl: null by design.
    imageUrl: article.imageUrl || null,
    imageIsPlaceholder: article.isPlaceholder || false,
    imagePrompt: article.imagePrompt || null,

    // Metadata
    metadata: {
      ...metadata,
      generatedBy: "gemini-2.5-flash",
      // Nano Banana Pro (paid tier) — stamped only when this article actually
      // generated an AI image (not null, not a stock placeholder).
      imageGeneratedBy: article.imageUrl && !article.isPlaceholder ? "gemini-3-pro-image" : null,
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

/**
 * Save daily news to the new path structure
 * Saves each of the 5 articles separately for the news feed
 * Path: /news_hub/{seasonId}/days/day_{reportDay}/articles/{type}
 *
 * Note: when generateAllArticles streams articles via an onArticleGenerated
 * callback, each article is already persisted by the time this runs. Re-saving
 * here is idempotent (merge) and additionally writes the day-index document.
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
      await saveArticleDoc(db, { reportDay, article, metadata, seasonId });
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
      // Only the fantasy-corps events article carries an image now, so take the
      // first article that actually has one rather than articles[0] (DCI Daily).
      primaryImageUrl: articles.find(a => a.imageUrl)?.imageUrl || null,
      metadata: {
        ...metadata,
        generatedBy: "gemini-2.5-flash",
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
      generatedBy: "gemini-2.5-flash",
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
    // Generating 5 articles with Gemini image generation can take many minutes.
    // 540s is the max for gen2 event-driven functions; articles are also saved
    // incrementally so partial progress survives even if we still hit the ceiling.
    timeoutSeconds: 540,
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
            // Persist each article as it is generated. Image generation can take
            // several minutes per article, so waiting to save all five at the end
            // risks this trigger timing out with nothing written to Firestore.
            onArticleGenerated: (article, ctx) =>
              saveArticleDoc(db, {
                reportDay: ctx.reportDay,
                article,
                metadata: ctx.metadata,
                seasonId: event.params.seasonId,
              }),
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
    // Full 5-article generation with Gemini image generation can take many minutes.
    // Articles are persisted incrementally as they generate, so even a timeout
    // leaves completed articles visible on the feed/admin.
    timeoutSeconds: 540,
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
        onArticleGenerated: (article, ctx) =>
          saveArticleDoc(db, { reportDay: ctx.reportDay, article, metadata: ctx.metadata, seasonId }),
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
      generatedBy: "gemini-2.5-flash",
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


// Re-exports: these callables moved to sibling modules; keep exporting them
// from here so functions/index.js (and deployed function names) are unchanged.
const newsFeed = require("./newsFeed");
exports.getDailyNews = newsFeed.getDailyNews;
exports.getRecentNews = newsFeed.getRecentNews;
exports.getNewsFeedHttp = newsFeed.getNewsFeedHttp;

const newsAdmin = require("./newsAdmin");
exports.listAllArticles = newsAdmin.listAllArticles;
exports.getArticleForEdit = newsAdmin.getArticleForEdit;
exports.updateArticle = newsAdmin.updateArticle;
exports.archiveArticle = newsAdmin.archiveArticle;
exports.deleteArticle = newsAdmin.deleteArticle;
exports.regenerateArticleImage = newsAdmin.regenerateArticleImage;

const newsSubmissions = require("./newsSubmissions");
exports.submitNewsForApproval = newsSubmissions.submitNewsForApproval;
exports.listPendingSubmissions = newsSubmissions.listPendingSubmissions;
exports.approveSubmission = newsSubmissions.approveSubmission;
exports.rejectSubmission = newsSubmissions.rejectSubmission;
