/**
 * News Generation Triggers
 *
 * Automated content generation triggered by score uploads and fantasy recaps.
 * Uses Gemini AI to create engaging DCI recaps and fantasy analysis.
 */

const { onMessagePublished } = require("firebase-functions/v2/pubsub");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
const { generateNightlyRecap, generateFantasyRecap } = require("../helpers/newsGeneration");

// Pub/Sub topic for news generation requests
const NEWS_GENERATION_TOPIC = "news-generation-topic";

/**
 * NewsHub Categories
 */
const NEWS_CATEGORIES = {
  DCI_RECAP: "dci",
  FANTASY: "fantasy",
  ANALYSIS: "analysis",
};

/**
 * Process news generation requests from Pub/Sub
 * Triggered when new scores are published to the news-generation-topic
 */
exports.processNewsGeneration = onMessagePublished(
  {
    topic: NEWS_GENERATION_TOPIC,
    timeoutSeconds: 120,
    memory: "512MiB",
  },
  async (message) => {
    logger.info("Processing news generation request");

    try {
      const payloadBuffer = Buffer.from(message.data.message.data, "base64").toString("utf-8");
      const payload = JSON.parse(payloadBuffer);

      const { type, data } = payload;

      let result;
      switch (type) {
        case "dci_scores":
          result = await handleDciScoresNews(data);
          break;
        case "fantasy_recap":
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
 * Firestore trigger: Generate news when fantasy_recaps are updated
 * This triggers after the daily scoring processor creates/updates recap data
 */
exports.onFantasyRecapUpdated = onDocumentWritten(
  {
    document: "fantasy_recaps/{seasonId}",
    timeoutSeconds: 120,
    memory: "512MiB",
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

      for (const recap of newRecaps) {
        try {
          // Generate fantasy-focused content
          const fantasyResult = await generateFantasyRecap(recap);

          if (fantasyResult.success && fantasyResult.content) {
            await saveToNewsHub(db, {
              category: NEWS_CATEGORIES.FANTASY,
              date: recap.date || new Date(),
              offSeasonDay: recap.offSeasonDay,
              content: fantasyResult.content,
              metadata: {
                showCount: recap.shows?.length || 0,
                seasonId: event.params.seasonId,
              },
            });
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

/**
 * Handle DCI scores news generation
 */
async function handleDciScoresNews(scoreData) {
  const db = getDb();

  try {
    // Fetch previous event scores for comparison
    const previousScores = await fetchPreviousScores(db, scoreData.year);

    const enrichedData = {
      ...scoreData,
      previousScores,
    };

    const result = await generateNightlyRecap(enrichedData);

    if (result.success && result.content) {
      await saveToNewsHub(db, {
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
 * Handle fantasy recap news generation
 */
async function handleFantasyRecapNews(recapData) {
  const db = getDb();

  try {
    const result = await generateFantasyRecap(recapData);

    if (result.success && result.content) {
      await saveToNewsHub(db, {
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
 * Fetch previous event scores for comparison
 */
async function fetchPreviousScores(db, year) {
  try {
    const yearDoc = await db.collection("historical_scores").doc(year.toString()).get();

    if (!yearDoc.exists) {
      return null;
    }

    const data = yearDoc.data().data || [];

    // Get the second most recent event (most recent is current)
    if (data.length < 2) {
      return null;
    }

    // Sort by date descending
    const sortedEvents = data.sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    // Return the second most recent event's scores
    return sortedEvents[1]?.scores || null;
  } catch (error) {
    logger.error("Error fetching previous scores:", error);
    return null;
  }
}

/**
 * Save generated content to the NewsHub collection
 */
async function saveToNewsHub(db, { category, date, content, metadata, offSeasonDay }) {
  const newsHubRef = db.collection("news_hub");

  const newsEntry = {
    category,
    date: date instanceof Date ? date : new Date(date),
    createdAt: new Date(),
    headline: content.headline,
    summary: content.summary,
    fullStory: content.fullStory,
    fantasyImpact: content.fantasyImpact,
    trendingCorps: content.trendingCorps || [],
    metadata: {
      ...metadata,
      offSeasonDay,
      generatedBy: "gemini-1.5-flash",
    },
    isPublished: true,
  };

  const docRef = await newsHubRef.add(newsEntry);

  logger.info("Saved news entry to NewsHub:", {
    docId: docRef.id,
    category,
    headline: content.headline,
  });

  // Cleanup old entries (keep last 50)
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

/**
 * Callable function to manually trigger news generation (for admin use)
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");

exports.triggerNewsGeneration = onCall(
  {
    timeoutSeconds: 120,
    memory: "512MiB",
  },
  async (request) => {
    // Check if user is admin
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

/**
 * Fetch recent news entries for the frontend
 */
exports.getRecentNews = onCall(
  {
    timeoutSeconds: 30,
  },
  async (request) => {
    const db = getDb();
    const { limit = 5, category } = request.data || {};

    try {
      let query = db.collection("news_hub")
        .where("isPublished", "==", true)
        .orderBy("createdAt", "desc")
        .limit(Math.min(limit, 20));

      if (category) {
        query = db.collection("news_hub")
          .where("isPublished", "==", true)
          .where("category", "==", category)
          .orderBy("createdAt", "desc")
          .limit(Math.min(limit, 20));
      }

      const snapshot = await query.get();

      const news = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate?.()?.toISOString() || doc.data().date,
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
      }));

      return { success: true, news };
    } catch (error) {
      logger.error("Error fetching recent news:", error);
      throw new HttpsError("internal", "Failed to fetch news");
    }
  }
);
