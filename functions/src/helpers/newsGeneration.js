/**
 * NewsGenerationService - Gemini AI Integration for Automated DCI Recaps
 *
 * Uses Google's Gemini 1.5 Flash model to generate engaging news content
 * from raw DCI score data, including fantasy-specific analysis.
 */

const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");
const { logger } = require("firebase-functions/v2");
const { getContextualPlaceholder, uploadFromUrl } = require("./mediaService");

// Initialize Gemini client (lazy loaded)
let genAI = null;
let model = null;

/**
 * Initialize the Gemini AI client
 * Uses GOOGLE_GENERATIVE_AI_API_KEY from environment variables
 * (Consistent with Vercel environment variable naming)
 */
function initializeGemini() {
  if (!genAI) {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_GENERATIVE_AI_API_KEY environment variable is not set");
    }
    genAI = new GoogleGenerativeAI(apiKey);

    // System instruction for the DCI journalist persona
    const systemInstruction = `You are an expert Drum Corps International journalist for marching.art, a fantasy drum corps platform. Write engaging, analytical recaps of DCI competitions.

Your writing style should be:
- Professional but accessible to both casual fans and hardcore enthusiasts
- Data-driven with specific score references
- Focused on storytelling around point movements and surprises
- Insightful about what score changes mean for the competitive landscape

Always include:
1. Highlight significant point jumps or drops (±0.3 or more is notable)
2. Note caption leaders (GE, Visual, Music) when relevant
3. Provide "Fantasy Impact" analysis for directors who have these corps in their lineups
4. Identify trending corps that fantasy directors should watch

Keep headlines punchy and attention-grabbing. Summaries should be 2-3 sentences max.
Full stories should be 3-4 paragraphs with concrete analysis.`;

    // Configure model with structured JSON output
    model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: systemInstruction,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            headline: {
              type: SchemaType.STRING,
              description: "Attention-grabbing headline (10 words max)",
            },
            summary: {
              type: SchemaType.STRING,
              description: "Brief 2-3 sentence summary of key developments",
            },
            fullStory: {
              type: SchemaType.STRING,
              description: "Full 3-4 paragraph recap with analysis",
            },
            fantasyImpact: {
              type: SchemaType.STRING,
              description: "2-3 sentences on how results affect fantasy lineups",
            },
            trendingCorps: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  corps: { type: SchemaType.STRING },
                  direction: { type: SchemaType.STRING, enum: ["up", "down", "stable"] },
                  reason: { type: SchemaType.STRING },
                },
                required: ["corps", "direction", "reason"],
              },
              description: "Array of corps with notable movement",
            },
          },
          required: ["headline", "summary", "fullStory", "fantasyImpact", "trendingCorps"],
        },
      },
    });
  }
  return model;
}

/**
 * Generate a nightly recap from DCI score data
 *
 * @param {Object} scoreData - Score data from DCI event
 * @param {string} scoreData.eventName - Name of the competition
 * @param {string} scoreData.eventDate - Date of the event
 * @param {string} scoreData.location - Event location
 * @param {Array} scoreData.scores - Array of corps scores with captions
 * @param {Array} [scoreData.previousScores] - Previous event scores for comparison
 * @returns {Promise<Object>} Generated news content
 */
async function generateNightlyRecap(scoreData) {
  try {
    const geminiModel = initializeGemini();

    // Format score data for the prompt
    const formattedScores = formatScoresForPrompt(scoreData);

    const prompt = `Generate a DCI competition recap based on this score data:

EVENT: ${scoreData.eventName}
DATE: ${scoreData.eventDate}
LOCATION: ${scoreData.location || "Unknown Location"}

CURRENT STANDINGS:
${formattedScores.current}

${scoreData.previousScores ? `PREVIOUS EVENT COMPARISON:
${formattedScores.previous}

POINT CHANGES:
${formattedScores.changes}` : "Note: No previous event data available for comparison."}

Generate an engaging recap that highlights the key storylines from this competition.`;

    logger.info("Generating nightly recap for event:", scoreData.eventName);

    const result = await geminiModel.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Parse the JSON response
    const generatedContent = JSON.parse(text);

    logger.info("Successfully generated recap:", {
      headline: generatedContent.headline,
      trendingCount: generatedContent.trendingCorps?.length || 0,
    });

    return {
      success: true,
      content: generatedContent,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error("Error generating nightly recap:", error);

    // Return fallback content if API fails
    return {
      success: false,
      error: error.message,
      content: generateFallbackContent(scoreData),
      generatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Format score data into a readable prompt format
 */
function formatScoresForPrompt(scoreData) {
  const { scores, previousScores } = scoreData;

  // Format current scores
  const current = scores
    .sort((a, b) => calculateTotal(b.captions) - calculateTotal(a.captions))
    .map((s, idx) => {
      const total = calculateTotal(s.captions);
      const ge = (s.captions.GE1 || 0) + (s.captions.GE2 || 0);
      const vis = ((s.captions.VP || 0) + (s.captions.VA || 0) + (s.captions.CG || 0)) / 2;
      const mus = ((s.captions.B || 0) + (s.captions.MA || 0) + (s.captions.P || 0)) / 2;
      return `${idx + 1}. ${s.corps}: ${total.toFixed(3)} (GE: ${ge.toFixed(2)}, VIS: ${vis.toFixed(2)}, MUS: ${mus.toFixed(2)})`;
    })
    .join("\n");

  let previous = "";
  let changes = "";

  if (previousScores && previousScores.length > 0) {
    // Create a map of previous scores
    const prevMap = new Map(
      previousScores.map(s => [s.corps, calculateTotal(s.captions)])
    );

    // Format previous scores
    previous = previousScores
      .sort((a, b) => calculateTotal(b.captions) - calculateTotal(a.captions))
      .map((s, idx) => `${idx + 1}. ${s.corps}: ${calculateTotal(s.captions).toFixed(3)}`)
      .join("\n");

    // Calculate changes
    changes = scores
      .map(s => {
        const currentTotal = calculateTotal(s.captions);
        const prevTotal = prevMap.get(s.corps);
        if (prevTotal !== undefined) {
          const change = currentTotal - prevTotal;
          const sign = change >= 0 ? "+" : "";
          return `${s.corps}: ${sign}${change.toFixed(3)}`;
        }
        return null;
      })
      .filter(Boolean)
      .join("\n");
  }

  return { current, previous, changes };
}

/**
 * Calculate total score from caption scores
 */
function calculateTotal(captions) {
  const ge = (captions.GE1 || 0) + (captions.GE2 || 0);
  const vis = ((captions.VP || 0) + (captions.VA || 0) + (captions.CG || 0)) / 2;
  const mus = ((captions.B || 0) + (captions.MA || 0) + (captions.P || 0)) / 2;
  return ge + vis + mus;
}

/**
 * Generate fallback content when API is unavailable
 */
function generateFallbackContent(scoreData) {
  const { scores, eventName } = scoreData;
  const sortedScores = scores.sort((a, b) =>
    calculateTotal(b.captions) - calculateTotal(a.captions)
  );

  const leader = sortedScores[0];
  const leaderTotal = calculateTotal(leader.captions).toFixed(3);

  return {
    headline: `${leader.corps} Leads at ${eventName}`,
    summary: `${leader.corps} topped the standings with a score of ${leaderTotal} at ${eventName}. Full recap and fantasy analysis coming soon.`,
    fullStory: `${leader.corps} claimed the top spot at ${eventName} with an impressive ${leaderTotal} total score.\n\nThe competition featured ${scores.length} corps vying for position in the standings.\n\nStay tuned for detailed analysis of tonight's performances.`,
    fantasyImpact: `Fantasy directors with ${leader.corps} in their lineups should feel confident about their selection. Check your captions to ensure optimal coverage.`,
    trendingCorps: sortedScores.slice(0, 3).map(s => ({
      corps: s.corps,
      direction: "stable",
      reason: `Scored ${calculateTotal(s.captions).toFixed(3)} at ${eventName}`,
    })),
  };
}

/**
 * Generate fantasy-specific content from recap data
 *
 * @param {Object} recapData - Fantasy recap data with user results
 * @returns {Promise<Object>} Fantasy-focused news content
 */
async function generateFantasyRecap(recapData) {
  try {
    const geminiModel = initializeGemini();

    const { shows, offSeasonDay } = recapData;

    // Aggregate results across all shows for the day
    const allResults = shows.flatMap(s => s.results || []);
    const topPerformers = allResults
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 10);

    const prompt = `Generate a fantasy drum corps analysis for Day ${offSeasonDay} results:

TOP FANTASY PERFORMANCES:
${topPerformers.map((r, idx) =>
  `${idx + 1}. ${r.corpsName} (${r.corpsClass}): ${r.totalScore.toFixed(3)} total (GE: ${r.geScore.toFixed(2)}, VIS: ${r.visualScore.toFixed(2)}, MUS: ${r.musicScore.toFixed(2)})`
).join("\n")}

SHOWS COMPLETED: ${shows.map(s => s.eventName).join(", ")}

Generate fantasy-specific insights focusing on lineup optimization and trending corps.`;

    const result = await geminiModel.generateContent(prompt);
    const response = result.response;
    const generatedContent = JSON.parse(response.text());

    return {
      success: true,
      content: generatedContent,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error("Error generating fantasy recap:", error);
    return {
      success: false,
      error: error.message,
      content: null,
    };
  }
}

/**
 * Get an optimized image URL for a news article
 * Uses contextual placeholders based on article content
 *
 * @param {Object} options - Image options
 * @param {string} options.headline - Article headline for context matching
 * @param {string} options.category - News category (dci, fantasy, analysis)
 * @param {string} options.imageUrl - Optional source image URL to upload
 * @returns {Promise<Object>} Image result with URL
 */
async function getArticleImage({ headline, category, imageUrl }) {
  try {
    // If a source image URL is provided, upload it to Cloudinary
    if (imageUrl) {
      logger.info("Uploading article image to Cloudinary", { imageUrl });

      const uploadResult = await uploadFromUrl(imageUrl, {
        folder: "marching-art/news",
        category,
        headline,
      });

      return {
        url: uploadResult.url,
        isPlaceholder: uploadResult.isPlaceholder,
        publicId: uploadResult.publicId || null,
      };
    }

    // No source image - return contextual placeholder
    logger.info("Using contextual placeholder for article image");
    const placeholderUrl = getContextualPlaceholder({
      newsCategory: category,
      headline,
    });

    return {
      url: placeholderUrl,
      isPlaceholder: true,
      publicId: null,
    };
  } catch (error) {
    logger.error("Error getting article image:", error);

    // Fallback to placeholder on any error
    return {
      url: getContextualPlaceholder({ newsCategory: category, headline }),
      isPlaceholder: true,
      publicId: null,
      error: error.message,
    };
  }
}

/**
 * Generate complete news article with image
 * Combines Gemini text generation with MediaService image handling
 *
 * @param {Object} scoreData - DCI score data
 * @param {Object} options - Additional options
 * @param {string} options.imageUrl - Optional source image URL
 * @returns {Promise<Object>} Complete article with text and image
 */
async function generateCompleteArticle(scoreData, options = {}) {
  try {
    // Generate text content
    const textResult = await generateNightlyRecap(scoreData);

    if (!textResult.success) {
      return textResult;
    }

    // Get article image
    const imageResult = await getArticleImage({
      headline: textResult.content.headline,
      category: "dci",
      imageUrl: options.imageUrl,
    });

    // Combine text and image
    return {
      success: true,
      content: {
        ...textResult.content,
        imageUrl: imageResult.url,
        imageIsPlaceholder: imageResult.isPlaceholder,
        imagePublicId: imageResult.publicId,
      },
      generatedAt: textResult.generatedAt,
    };
  } catch (error) {
    logger.error("Error generating complete article:", error);
    return {
      success: false,
      error: error.message,
      content: null,
    };
  }
}

module.exports = {
  generateNightlyRecap,
  generateFantasyRecap,
  generateCompleteArticle,
  getArticleImage,
  initializeGemini,
};
