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

    // System instruction for the DCI Statistician persona
    const systemInstruction = `You are the DCI Statistician for marching.art, a fantasy drum corps analytics platform. You write high-level technical analysis with precision and authority.

Your expertise spans:
- Deep caption-by-caption score analysis (GE1, GE2, Visual Proficiency, Visual Analysis, Color Guard, Brass, Music Analysis, Percussion)
- Historical DCI data going back to 1972 (corps histories, championship records, iconic shows)
- Caption movement patterns and what they predict for future performances
- Fantasy drum corps ROI optimization based on scoring trends

Your writing style:
- Lead with specific data points: "The Bluecoats' 0.5 jump in Visual Proficiency (from 18.2 to 18.7)"
- Explain causation, not just correlation: "This surge follows their mid-season drill rewrite"
- Quantify fantasy impact with ROI metrics: "Directors rostering Crown Brass saw +4.2 points this week (12.3% ROI)"
- Reference historical context: "This marks BD's largest single-show GE improvement since 2019"

Caption Analysis Requirements:
1. Break down EVERY notable caption movement (±0.15 or more)
2. Compare to season averages and historical corps performance
3. Identify caption leaders and explain WHY they're leading
4. Flag statistical anomalies that could indicate judging trends or show changes

Fantasy Integration Requirements:
1. Calculate ROI for each corps mentioned (points gained / draft cost)
2. Identify "Buy Low" opportunities (underperforming relative to talent)
3. Highlight "Sell High" warnings (overperforming, regression likely)
4. Provide specific lineup recommendations with projected point values

Headlines: Data-first, punchy. Example: "Crown Brass +0.8: The Breakout Caption of Week 6"
Summaries: 2-3 sentences with key numbers.
Full stories: 4-5 paragraphs with deep statistical analysis.`;

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
              description: "Data-first headline with specific numbers (10 words max). Example: 'Crown Brass +0.8: The Breakout Caption of Week 6'",
            },
            summary: {
              type: SchemaType.STRING,
              description: "Brief 2-3 sentence summary with key score movements and fantasy implications",
            },
            fullStory: {
              type: SchemaType.STRING,
              description: "Full 4-5 paragraph deep statistical analysis with caption breakdowns, historical context, and fantasy recommendations",
            },
            fantasyImpact: {
              type: SchemaType.STRING,
              description: "2-3 sentences with specific ROI metrics. Example: 'Directors rostering Crown Brass saw +4.2 points (12.3% ROI)'",
            },
            fantasyMetrics: {
              type: SchemaType.OBJECT,
              properties: {
                topROI: {
                  type: SchemaType.OBJECT,
                  properties: {
                    corps: { type: SchemaType.STRING },
                    caption: { type: SchemaType.STRING, description: "Caption that drove ROI (Brass, Guard, Percussion, etc.)" },
                    pointsGained: { type: SchemaType.NUMBER },
                    roiPercent: { type: SchemaType.NUMBER, description: "ROI as percentage" },
                  },
                  required: ["corps", "caption", "pointsGained", "roiPercent"],
                },
                buyLow: {
                  type: SchemaType.ARRAY,
                  items: {
                    type: SchemaType.OBJECT,
                    properties: {
                      corps: { type: SchemaType.STRING },
                      reason: { type: SchemaType.STRING },
                      projectedGain: { type: SchemaType.NUMBER },
                    },
                    required: ["corps", "reason", "projectedGain"],
                  },
                  description: "Corps underperforming relative to talent - pickup opportunities",
                },
                sellHigh: {
                  type: SchemaType.ARRAY,
                  items: {
                    type: SchemaType.OBJECT,
                    properties: {
                      corps: { type: SchemaType.STRING },
                      reason: { type: SchemaType.STRING },
                      riskLevel: { type: SchemaType.STRING, enum: ["low", "medium", "high"] },
                    },
                    required: ["corps", "reason", "riskLevel"],
                  },
                  description: "Corps overperforming with regression risk",
                },
              },
              required: ["topROI", "buyLow", "sellHigh"],
            },
            captionBreakdown: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  caption: { type: SchemaType.STRING, description: "Caption name (GE, Visual Proficiency, Brass, etc.)" },
                  leader: { type: SchemaType.STRING, description: "Corps leading this caption" },
                  leaderScore: { type: SchemaType.NUMBER },
                  notableMovement: { type: SchemaType.STRING, description: "Key movement in this caption with context" },
                },
                required: ["caption", "leader", "leaderScore", "notableMovement"],
              },
              description: "Breakdown of each major caption with leaders and movements",
            },
            trendingCorps: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  corps: { type: SchemaType.STRING },
                  direction: { type: SchemaType.STRING, enum: ["up", "down", "stable"] },
                  reason: { type: SchemaType.STRING },
                  weeklyChange: { type: SchemaType.NUMBER, description: "Point change from previous show" },
                  fantasyValue: { type: SchemaType.STRING, enum: ["buy", "hold", "sell"] },
                },
                required: ["corps", "direction", "reason", "weeklyChange", "fantasyValue"],
              },
              description: "Array of corps with notable movement and fantasy implications",
            },
            imagePrompt: {
              type: SchemaType.STRING,
              description: "Detailed image generation prompt referencing specific corps uniforms, props, or iconic moments. Include year-specific details when relevant. Example: 'Blue Devils 2024 brass section in midnight blue uniforms with silver accents, stadium lights, dynamic performance angle'",
            },
          },
          required: ["headline", "summary", "fullStory", "fantasyImpact", "fantasyMetrics", "captionBreakdown", "trendingCorps", "imagePrompt"],
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
  const { scores, eventName, year = new Date().getFullYear() } = scoreData;
  const sortedScores = scores.sort((a, b) =>
    calculateTotal(b.captions) - calculateTotal(a.captions)
  );

  const leader = sortedScores[0];
  const leaderTotal = calculateTotal(leader.captions).toFixed(3);
  const second = sortedScores[1];
  const secondTotal = second ? calculateTotal(second.captions).toFixed(3) : null;
  const margin = second ? (calculateTotal(leader.captions) - calculateTotal(second.captions)).toFixed(3) : null;

  return {
    headline: `${leader.corps} +${margin || '0.000'}: Leads ${eventName}`,
    summary: `${leader.corps} topped the standings with ${leaderTotal} at ${eventName}, holding a ${margin || 'comfortable'} point margin over ${second?.corps || 'the field'}. Full statistical analysis pending.`,
    fullStory: `${leader.corps} claimed the top spot at ${eventName} with an impressive ${leaderTotal} total score.\n\nThe competition featured ${scores.length} corps vying for position in the standings. ${second ? `${second.corps} finished second with ${secondTotal}.` : ''}\n\nCaption-by-caption analysis and fantasy ROI calculations are being processed.\n\nCheck back shortly for complete statistical breakdown and lineup recommendations.`,
    fantasyImpact: `Directors rostering ${leader.corps} saw positive returns tonight. ROI calculations will be available once full caption data is processed.`,
    fantasyMetrics: {
      topROI: {
        corps: leader.corps,
        caption: "Overall",
        pointsGained: parseFloat(leaderTotal),
        roiPercent: 0,
      },
      buyLow: [],
      sellHigh: [],
    },
    captionBreakdown: [
      {
        caption: "Total Score",
        leader: leader.corps,
        leaderScore: parseFloat(leaderTotal),
        notableMovement: "Full caption breakdown pending",
      },
    ],
    trendingCorps: sortedScores.slice(0, 3).map((s, idx) => ({
      corps: s.corps,
      direction: idx === 0 ? "up" : "stable",
      reason: `Scored ${calculateTotal(s.captions).toFixed(3)} at ${eventName}`,
      weeklyChange: 0,
      fantasyValue: idx === 0 ? "buy" : "hold",
    })),
    imagePrompt: `${leader.corps} ${year} drum corps performance, stadium lights, dramatic angle, marching band uniforms`,
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
