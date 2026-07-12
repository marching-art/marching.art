// Admin article management callables: list/edit/update/archive/delete and
// image regeneration. Extracted verbatim from triggers/newsGeneration.js.

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const { defineSecret } = require("firebase-functions/params");
const { getDb } = require("../config");
const { invalidateNewsCache } = require("./newsFeed");
const { assertAdmin } = require("../helpers/callableGuards");

const geminiApiKey = defineSecret("GOOGLE_GENERATIVE_AI_API_KEY");
const cloudinaryCloudName = defineSecret("CLOUDINARY_CLOUD_NAME");
const cloudinaryApiKey = defineSecret("CLOUDINARY_API_KEY");
const cloudinaryApiSecret = defineSecret("CLOUDINARY_API_SECRET");

// =============================================================================
// ARTICLE MANAGEMENT (Admin)
// =============================================================================

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
    assertAdmin(request);

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
    assertAdmin(request);

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
    assertAdmin(request);

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
      await invalidateNewsCache(db);

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
    assertAdmin(request);

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
      await invalidateNewsCache(db);

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
    assertAdmin(request);

    const { path, confirmDelete } = request.data || {};

    if (!path) {
      throw new HttpsError("invalid-argument", "Article path is required");
    }

    if (confirmDelete !== true) {
      throw new HttpsError("invalid-argument", "Must confirm deletion");
    }

    try {
      await db.doc(path).delete();
      await invalidateNewsCache(db);

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
    assertAdmin(request);

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

module.exports = {
  listAllArticles: exports.listAllArticles,
  getArticleForEdit: exports.getArticleForEdit,
  updateArticle: exports.updateArticle,
  archiveArticle: exports.archiveArticle,
  deleteArticle: exports.deleteArticle,
  regenerateArticleImage: exports.regenerateArticleImage,
};
