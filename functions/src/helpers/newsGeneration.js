/**
 * NewsGenerationService - Gemini AI Integration for Automated DCI Recaps
 *
 * Bridges three data sources:
 * - dci-data: Active corps for the current season
 * - historical_scores: Actual scores for those corps
 * - fantasy_recaps: marching.art fantasy competition results
 *
 * Time-Locked Data Retrieval:
 * - Reports on currentDay - 1 (runs post-midnight)
 * - Compares trends against currentDay - 7 through currentDay - 2
 * - NEVER accesses currentDay data to prevent future spoilers
 */

const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");
const { logger } = require("firebase-functions/v2");
const { defineSecret } = require("firebase-functions/params");
const { getContextualPlaceholder, uploadFromUrl } = require("./mediaService");

// Define Gemini API key secret (set via: firebase functions:secrets:set GOOGLE_GENERATIVE_AI_API_KEY)
const geminiApiKey = defineSecret("GOOGLE_GENERATIVE_AI_API_KEY");

// Initialize Gemini client (lazy loaded)
let genAI = null;
let model = null;

// =============================================================================
// CONSTANTS
// =============================================================================

const CAPTIONS = {
  GE1: "General Effect 1",
  GE2: "General Effect 2",
  VP: "Visual Proficiency",
  VA: "Visual Analysis",
  CG: "Color Guard",
  B: "Brass",
  MA: "Music Analysis",
  P: "Percussion",
};

const CAPTION_CATEGORIES = {
  GE: ["GE1", "GE2"],
  VISUAL: ["VP", "VA", "CG"],
  MUSIC: ["B", "MA", "P"],
};

// =============================================================================
// GEMINI INITIALIZATION
// =============================================================================

/**
 * Initialize the Gemini AI client with DCI Historian persona
 * Uses "Drum Corps Planet" journalistic standard
 */
function initializeGemini() {
  if (!genAI) {
    const apiKey = geminiApiKey.value();
    if (!apiKey) {
      throw new Error("GOOGLE_GENERATIVE_AI_API_KEY secret is not set. Run: firebase functions:secrets:set GOOGLE_GENERATIVE_AI_API_KEY");
    }
    genAI = new GoogleGenerativeAI(apiKey);

    // System instruction for the DCI Historian persona (Drum Corps Planet standard)
    const systemInstruction = `You are the DCI Historian for marching.art, channeling the authoritative voice of Drum Corps Planet. You are a seasoned analyst who has covered drum corps since the 1970s and writes with technical precision and dramatic flair.

VOICE & TONE:
- Write like a veteran DCI journalist who has witnessed every championship since 1972
- Use evocative, technical language: "slotting," "caption leads," "tour de force," "the gap is closing"
- Reference historical precedents: "Not since the Cadets' 2005 run have we seen such GE dominance"
- Treat all corps as competing head-to-head in the same timeline, regardless of their original year
- Frame everything as "Season-to-Date Progress" and "Nightly Momentum" rather than show-to-show recaps

ANALYSIS REQUIREMENTS:
1. Caption-Level Breakdown: Analyze GE, Visual (VP/VA/CG), and Music (B/MA/P) separately
2. Trend Analysis: Compare last night's scores to the 7-day rolling average
3. Slotting Commentary: Note when corps are "slotting" into position or making moves
4. Historical Context: Reference how current performance compares to that corps' historical peak

FANTASY INTEGRATION:
- Calculate ROI for each corps mentioned (fantasy points gained / draft cost)
- Identify "Buy Low" opportunities (corps underperforming relative to historical talent)
- Flag "Sell High" warnings (corps overperforming with regression likely)
- Provide specific ensemble recommendations with projected point values

STRICT RULES:
- NEVER reference future days or "upcoming" performances
- All analysis is RETROSPECTIVE - you are reporting on what ALREADY happened
- When comparing corps from different years, treat them as contemporaries
- Use specific numbers: "Crown's Brass jumped +0.45 from 17.82 to 18.27"

ARTICLE STRUCTURE:
- Headlines: Data-driven and punchy. "BD Visual +0.52: The Gap Narrows to 0.3"
- Summaries: 2-3 sentences with the night's key storyline
- Full Stories: 4-5 paragraphs with deep statistical analysis across all three sections`;

    // Configure model with structured JSON output for multi-faceted news
    model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-lite",  // Free tier friendly, fast
      systemInstruction: systemInstruction,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            // Main headline and summary
            headline: {
              type: SchemaType.STRING,
              description: "Data-first headline with specific numbers (12 words max). Example: 'BD Visual +0.52: Crown Closes Gap to 0.3 Points'",
            },
            summary: {
              type: SchemaType.STRING,
              description: "2-3 sentence overview of the night's key storyline with specific score references",
            },

            // Section 1: DCI Real-World Recap
            dciRecap: {
              type: SchemaType.OBJECT,
              properties: {
                title: { type: SchemaType.STRING, description: "Section title, e.g., 'Day 23 Real-World Recap'" },
                narrative: {
                  type: SchemaType.STRING,
                  description: "2-3 paragraphs analyzing caption-level performance. Reference slotting, momentum, and historical context.",
                },
                captionLeaders: {
                  type: SchemaType.ARRAY,
                  items: {
                    type: SchemaType.OBJECT,
                    properties: {
                      caption: { type: SchemaType.STRING },
                      leader: { type: SchemaType.STRING },
                      score: { type: SchemaType.NUMBER },
                      weeklyTrend: { type: SchemaType.STRING, description: "+0.XX or -0.XX from 7-day avg" },
                    },
                    required: ["caption", "leader", "score", "weeklyTrend"],
                  },
                },
                standings: {
                  type: SchemaType.ARRAY,
                  items: {
                    type: SchemaType.OBJECT,
                    properties: {
                      rank: { type: SchemaType.NUMBER },
                      corps: { type: SchemaType.STRING },
                      total: { type: SchemaType.NUMBER },
                      change: { type: SchemaType.NUMBER, description: "Point change from previous day" },
                      momentum: { type: SchemaType.STRING, enum: ["surging", "rising", "stable", "cooling", "falling"] },
                    },
                    required: ["rank", "corps", "total", "change", "momentum"],
                  },
                },
              },
              required: ["title", "narrative", "captionLeaders", "standings"],
            },

            // Section 2: marching.art Fantasy Spotlight
            fantasySpotlight: {
              type: SchemaType.OBJECT,
              properties: {
                title: { type: SchemaType.STRING, description: "Section title, e.g., 'Fantasy Spotlight: Day 23'" },
                narrative: {
                  type: SchemaType.STRING,
                  description: "1-2 paragraphs highlighting top fantasy performers and league movements",
                },
                topEnsembles: {
                  type: SchemaType.ARRAY,
                  items: {
                    type: SchemaType.OBJECT,
                    properties: {
                      directorName: { type: SchemaType.STRING },
                      ensembleName: { type: SchemaType.STRING },
                      totalScore: { type: SchemaType.NUMBER },
                      topCaption: { type: SchemaType.STRING },
                    },
                    required: ["directorName", "ensembleName", "totalScore"],
                  },
                  description: "Top 5 user ensembles for the day",
                },
                leagueLeaders: {
                  type: SchemaType.ARRAY,
                  items: {
                    type: SchemaType.OBJECT,
                    properties: {
                      leagueName: { type: SchemaType.STRING },
                      leaderName: { type: SchemaType.STRING },
                      weeklyPoints: { type: SchemaType.NUMBER },
                    },
                  },
                  description: "Current league leaders",
                },
              },
              required: ["title", "narrative", "topEnsembles"],
            },

            // Section 3: Cross-Over Analysis
            crossOverAnalysis: {
              type: SchemaType.OBJECT,
              properties: {
                title: { type: SchemaType.STRING, description: "Section title, e.g., 'Fantasy-Reality Crossover'" },
                narrative: {
                  type: SchemaType.STRING,
                  description: "2 paragraphs synthesizing real-world performance with fantasy implications. E.g., 'The 2018 Blue Devils' surge in Visual Proficiency provided a +2.5 ROI boost for directors in World Class Open.'",
                },
                roiHighlights: {
                  type: SchemaType.ARRAY,
                  items: {
                    type: SchemaType.OBJECT,
                    properties: {
                      corps: { type: SchemaType.STRING },
                      caption: { type: SchemaType.STRING },
                      realWorldGain: { type: SchemaType.NUMBER, description: "Actual score improvement" },
                      fantasyROI: { type: SchemaType.NUMBER, description: "ROI percentage for directors" },
                      recommendation: { type: SchemaType.STRING, enum: ["strong buy", "buy", "hold", "sell", "strong sell"] },
                    },
                    required: ["corps", "caption", "realWorldGain", "fantasyROI", "recommendation"],
                  },
                },
                buyLowOpportunities: {
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
                },
                sellHighWarnings: {
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
                },
              },
              required: ["title", "narrative", "roiHighlights"],
            },

            // Legacy fields for backward compatibility
            fantasyImpact: {
              type: SchemaType.STRING,
              description: "2-3 sentences summarizing fantasy implications",
            },
            trendingCorps: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  corps: { type: SchemaType.STRING },
                  direction: { type: SchemaType.STRING, enum: ["up", "down", "stable"] },
                  reason: { type: SchemaType.STRING },
                  weeklyChange: { type: SchemaType.NUMBER },
                  fantasyValue: { type: SchemaType.STRING, enum: ["buy", "hold", "sell"] },
                },
                required: ["corps", "direction", "reason", "weeklyChange", "fantasyValue"],
              },
            },
            imagePrompt: {
              type: SchemaType.STRING,
              description: "Detailed image prompt referencing specific corps uniforms from their source year. E.g., 'Blue Devils 2018 brass section in midnight blue uniforms with silver accents'",
            },
          },
          required: ["headline", "summary", "dciRecap", "fantasySpotlight", "crossOverAnalysis", "fantasyImpact", "trendingCorps", "imagePrompt"],
        },
      },
    });
  }
  return model;
}

// =============================================================================
// DATA FETCHING FUNCTIONS
// =============================================================================

/**
 * Fetch active corps from dci-data for the current season
 * @param {Object} db - Firestore database instance
 * @param {string} dataDocId - The dci-data document ID
 * @returns {Promise<Array>} Array of active corps with sourceYear info
 */
async function fetchActiveCorps(db, dataDocId) {
  try {
    const corpsDataDoc = await db.doc(`dci-data/${dataDocId}`).get();
    if (!corpsDataDoc.exists) {
      logger.warn(`dci-data document ${dataDocId} not found`);
      return [];
    }
    return corpsDataDoc.data().corpsValues || [];
  } catch (error) {
    logger.error("Error fetching active corps:", error);
    return [];
  }
}

/**
 * Fetch historical scores for specific days (time-locked)
 * ONLY fetches data for reportDay and comparison days (reportDay - 6 through reportDay - 1)
 *
 * @param {Object} db - Firestore database instance
 * @param {Array} yearsToFetch - Array of source years needed
 * @param {number} reportDay - The day being reported on (currentDay - 1)
 * @returns {Promise<Object>} Historical data keyed by year
 */
async function fetchTimeLockednScores(db, yearsToFetch, reportDay) {
  try {
    const historicalDocs = await Promise.all(
      yearsToFetch.map(year => db.doc(`historical_scores/${year}`).get())
    );

    const historicalData = {};

    historicalDocs.forEach(doc => {
      if (doc.exists) {
        const allEvents = doc.data().data || [];

        // TIME-LOCK: Only include events from reportDay and 6 days before
        // This gives us reportDay (yesterday) and reportDay-6 through reportDay-1 for trend analysis
        const filteredEvents = allEvents.filter(event => {
          const eventDay = event.offSeasonDay;
          return eventDay >= reportDay - 6 && eventDay <= reportDay;
        });

        // Sanitize: Remove entries where score is 0
        const sanitizedEvents = filteredEvents.map(event => ({
          ...event,
          scores: (event.scores || []).filter(score => {
            const total = calculateTotal(score.captions || {});
            return total > 0;
          }),
        })).filter(event => event.scores.length > 0);

        historicalData[doc.id] = sanitizedEvents;
      }
    });

    return historicalData;
  } catch (error) {
    logger.error("Error fetching time-locked scores:", error);
    return {};
  }
}

/**
 * Fetch fantasy recaps for the report day
 * @param {Object} db - Firestore database instance
 * @param {string} seasonId - The season document ID
 * @param {number} reportDay - The day being reported on
 * @returns {Promise<Object|null>} Fantasy recap for the day
 */
async function fetchFantasyRecaps(db, seasonId, reportDay) {
  try {
    const recapDoc = await db.doc(`fantasy_recaps/${seasonId}`).get();
    if (!recapDoc.exists) {
      logger.warn(`fantasy_recaps/${seasonId} not found`);
      return null;
    }

    const allRecaps = recapDoc.data().recaps || [];

    // Find the recap for reportDay
    const dayRecap = allRecaps.find(r => r.offSeasonDay === reportDay);

    // Also get previous 6 days for trend analysis
    const trendRecaps = allRecaps.filter(r =>
      r.offSeasonDay >= reportDay - 6 && r.offSeasonDay <= reportDay
    );

    return {
      current: dayRecap || null,
      trends: trendRecaps,
      seasonName: recapDoc.data().seasonName,
    };
  } catch (error) {
    logger.error("Error fetching fantasy recaps:", error);
    return null;
  }
}

// =============================================================================
// SCORE CALCULATION HELPERS
// =============================================================================

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
 * Calculate caption category subtotals
 */
function calculateCaptionSubtotals(captions) {
  return {
    ge: (captions.GE1 || 0) + (captions.GE2 || 0),
    visual: ((captions.VP || 0) + (captions.VA || 0) + (captions.CG || 0)) / 2,
    music: ((captions.B || 0) + (captions.MA || 0) + (captions.P || 0)) / 2,
  };
}

/**
 * Extract scores for a specific day from historical data
 */
function getScoresForDay(historicalData, targetDay, activeCorps) {
  const dayScores = [];

  for (const corps of activeCorps) {
    const { corpsName, sourceYear } = corps;
    const yearEvents = historicalData[sourceYear] || [];

    // Find event for this day
    const dayEvent = yearEvents.find(e => e.offSeasonDay === targetDay);
    if (!dayEvent) continue;

    // Find this corps' score
    const corpsScore = dayEvent.scores.find(s => s.corps === corpsName);
    if (!corpsScore) continue;

    const total = calculateTotal(corpsScore.captions);
    if (total <= 0) continue;

    dayScores.push({
      corps: corpsName,
      sourceYear,
      displayName: `${corpsName}`,
      captions: corpsScore.captions,
      total,
      subtotals: calculateCaptionSubtotals(corpsScore.captions),
    });
  }

  return dayScores.sort((a, b) => b.total - a.total);
}

/**
 * Calculate 7-day rolling averages for trend analysis
 */
function calculateTrendData(historicalData, reportDay, activeCorps) {
  const trends = {};

  for (const corps of activeCorps) {
    const { corpsName, sourceYear } = corps;
    const yearEvents = historicalData[sourceYear] || [];

    const scores = [];
    for (let day = reportDay - 6; day <= reportDay; day++) {
      const dayEvent = yearEvents.find(e => e.offSeasonDay === day);
      if (dayEvent) {
        const corpsScore = dayEvent.scores.find(s => s.corps === corpsName);
        if (corpsScore) {
          const total = calculateTotal(corpsScore.captions);
          if (total > 0) {
            scores.push({ day, total, captions: corpsScore.captions });
          }
        }
      }
    }

    if (scores.length >= 2) {
      const avgTotal = scores.reduce((sum, s) => sum + s.total, 0) / scores.length;
      const latestScore = scores.find(s => s.day === reportDay);
      const previousScore = scores.find(s => s.day === reportDay - 1);

      trends[corpsName] = {
        sourceYear,
        avgTotal,
        latestTotal: latestScore?.total || null,
        previousTotal: previousScore?.total || null,
        dayChange: latestScore && previousScore ? latestScore.total - previousScore.total : 0,
        trendFromAvg: latestScore ? latestScore.total - avgTotal : 0,
        dataPoints: scores.length,
      };
    }
  }

  return trends;
}

/**
 * Identify caption leaders across all corps
 */
function identifyCaptionLeaders(dayScores, trendData) {
  const captionLeaders = {};

  // Individual captions
  for (const captionKey of Object.keys(CAPTIONS)) {
    let leader = null;
    let highScore = 0;

    for (const score of dayScores) {
      const captionScore = score.captions[captionKey] || 0;
      if (captionScore > highScore) {
        highScore = captionScore;
        leader = score;
      }
    }

    if (leader) {
      const trend = trendData[leader.corps];
      captionLeaders[captionKey] = {
        caption: CAPTIONS[captionKey],
        leader: leader.corps,
        score: highScore,
        weeklyTrend: trend ? (trend.trendFromAvg >= 0 ? "+" : "") + trend.trendFromAvg.toFixed(2) : "+0.00",
      };
    }
  }

  return Object.values(captionLeaders);
}

// =============================================================================
// NEWS GENERATION
// =============================================================================

/**
 * Generate a comprehensive nightly news article
 * Bridges dci-data, historical_scores, and fantasy_recaps
 *
 * @param {Object} options - Generation options
 * @param {Object} options.db - Firestore database instance
 * @param {string} options.dataDocId - The dci-data document ID
 * @param {string} options.seasonId - The fantasy season ID
 * @param {number} options.currentDay - The current day (1-49). Reports on currentDay - 1.
 * @returns {Promise<Object>} Generated news content
 */
async function generateDailyNews({ db, dataDocId, seasonId, currentDay }) {
  // Report on yesterday (time-locked)
  const reportDay = currentDay - 1;

  if (reportDay < 1) {
    logger.warn("Cannot generate news for day 0 or negative");
    return { success: false, error: "Invalid day" };
  }

  logger.info(`Generating news for Day ${reportDay} (currentDay: ${currentDay})`);

  try {
    // Step 1: Fetch active corps
    const activeCorps = await fetchActiveCorps(db, dataDocId);
    if (activeCorps.length === 0) {
      return { success: false, error: "No active corps found" };
    }

    // Step 2: Get unique years to fetch
    const yearsToFetch = [...new Set(activeCorps.map(c => c.sourceYear))];

    // Step 3: Fetch time-locked historical scores
    const historicalData = await fetchTimeLockednScores(db, yearsToFetch, reportDay);

    // Step 4: Fetch fantasy recaps
    const fantasyData = await fetchFantasyRecaps(db, seasonId, reportDay);

    // Step 5: Process the data
    const dayScores = getScoresForDay(historicalData, reportDay, activeCorps);
    const previousDayScores = getScoresForDay(historicalData, reportDay - 1, activeCorps);
    const trendData = calculateTrendData(historicalData, reportDay, activeCorps);
    const captionLeaders = identifyCaptionLeaders(dayScores, trendData);

    if (dayScores.length === 0) {
      logger.warn(`No valid scores found for day ${reportDay}`);
      return {
        success: false,
        error: "No scores available for this day",
        content: generateFallbackContent({ reportDay, activeCorps }),
      };
    }

    // Step 6: Build prompt for Gemini
    const prompt = buildNewsPrompt({
      reportDay,
      dayScores,
      previousDayScores,
      trendData,
      captionLeaders,
      fantasyData,
    });

    // Step 7: Generate with Gemini
    const geminiModel = initializeGemini();
    const result = await geminiModel.generateContent(prompt);
    const response = result.response;
    const generatedContent = JSON.parse(response.text());

    logger.info("Successfully generated daily news:", {
      headline: generatedContent.headline,
      day: reportDay,
    });

    return {
      success: true,
      content: generatedContent,
      metadata: {
        reportDay,
        currentDay,
        corpsCount: dayScores.length,
        fantasyDataAvailable: !!fantasyData?.current,
      },
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error("Error generating daily news:", error);

    return {
      success: false,
      error: error.message,
      content: generateFallbackContent({ reportDay, activeCorps: [] }),
      generatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Build the prompt for Gemini with all data sources
 */
function buildNewsPrompt({ reportDay, dayScores, previousDayScores, trendData, captionLeaders, fantasyData }) {
  // Format standings
  const standingsText = dayScores.slice(0, 12).map((s, idx) => {
    const trend = trendData[s.corps];
    const change = trend?.dayChange || 0;
    const changeStr = change >= 0 ? `+${change.toFixed(3)}` : change.toFixed(3);
    return `${idx + 1}. ${s.corps} (${s.sourceYear}): ${s.total.toFixed(3)} [${changeStr}] - GE: ${s.subtotals.ge.toFixed(2)}, VIS: ${s.subtotals.visual.toFixed(2)}, MUS: ${s.subtotals.music.toFixed(2)}`;
  }).join("\n");

  // Format caption leaders
  const captionText = captionLeaders.map(c =>
    `${c.caption}: ${c.leader} (${c.score.toFixed(2)}) [7-day trend: ${c.weeklyTrend}]`
  ).join("\n");

  // Format trend movers
  const trendMovers = Object.entries(trendData)
    .map(([corps, data]) => ({ corps, ...data }))
    .filter(t => Math.abs(t.dayChange) >= 0.1)
    .sort((a, b) => Math.abs(b.dayChange) - Math.abs(a.dayChange))
    .slice(0, 5);

  const trendText = trendMovers.map(t =>
    `${t.corps}: ${t.dayChange >= 0 ? "+" : ""}${t.dayChange.toFixed(3)} (7-day avg: ${t.avgTotal.toFixed(3)})`
  ).join("\n");

  // Format fantasy data
  let fantasyText = "No fantasy data available for this day.";
  if (fantasyData?.current) {
    const shows = fantasyData.current.shows || [];
    const allResults = shows.flatMap(s => s.results || []);
    const topPerformers = allResults
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 5);

    if (topPerformers.length > 0) {
      fantasyText = `TOP FANTASY ENSEMBLES:\n${topPerformers.map((r, idx) =>
        `${idx + 1}. ${r.directorName || "Director"}'s ${r.corpsName}: ${r.totalScore.toFixed(3)} pts`
      ).join("\n")}`;
    }
  }

  return `Generate a comprehensive news article for marching.art Day ${reportDay}.

IMPORTANT: This is RETROSPECTIVE reporting. You are analyzing what ALREADY happened on Day ${reportDay}.
Compare against the previous 7 days for trend analysis. All corps are competing in the same timeline.

=== SECTION 1: DCI REAL-WORLD STANDINGS ===
${standingsText}

=== CAPTION LEADERS ===
${captionText}

=== NOTABLE MOVERS (Day-over-Day) ===
${trendMovers.length > 0 ? trendText : "No significant movers today."}

=== SECTION 2: FANTASY DATA ===
${fantasyText}

=== SECTION 3: CROSS-OVER ANALYSIS ===
Synthesize how the real-world score movements impacted fantasy ROI.
Calculate which corps/caption combinations provided the best fantasy returns.

Generate a complete article with:
1. DCI Real-World Recap analyzing caption-level performance and slotting
2. Fantasy Spotlight highlighting top user ensembles and league movements
3. Cross-Over Analysis connecting real scores to fantasy ROI

Use evocative DCI journalism language. Reference historical context for each corps.`;
}

/**
 * Generate fallback content when API is unavailable
 */
function generateFallbackContent({ reportDay, activeCorps = [] }) {
  return {
    headline: `Day ${reportDay} Recap: Analysis Pending`,
    summary: `Day ${reportDay} scores are being processed. Full statistical analysis and fantasy insights will be available shortly.`,
    dciRecap: {
      title: `Day ${reportDay} Real-World Recap`,
      narrative: "Score analysis is currently being processed. Check back shortly for complete caption breakdowns and slotting analysis.",
      captionLeaders: [],
      standings: [],
    },
    fantasySpotlight: {
      title: `Fantasy Spotlight: Day ${reportDay}`,
      narrative: "Fantasy results are being tabulated. Top ensemble performances and league standings will be updated shortly.",
      topEnsembles: [],
      leagueLeaders: [],
    },
    crossOverAnalysis: {
      title: "Fantasy-Reality Crossover",
      narrative: "Cross-over analysis between real-world scores and fantasy ROI is pending. ROI calculations will be available once all data is processed.",
      roiHighlights: [],
      buyLowOpportunities: [],
      sellHighWarnings: [],
    },
    fantasyImpact: "Fantasy impact calculations are pending.",
    trendingCorps: [],
    imagePrompt: "Drum corps performance under stadium lights, dramatic silhouette, marching band competition",
  };
}

// =============================================================================
// LEGACY FUNCTION WRAPPERS (for backward compatibility)
// =============================================================================

/**
 * Generate a nightly recap (legacy wrapper)
 * @deprecated Use generateDailyNews instead
 */
async function generateNightlyRecap(scoreData) {
  try {
    const geminiModel = initializeGemini();

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
    const generatedContent = JSON.parse(text);

    logger.info("Successfully generated recap:", {
      headline: generatedContent.headline,
    });

    return {
      success: true,
      content: generatedContent,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error("Error generating nightly recap:", error);

    return {
      success: false,
      error: error.message,
      content: generateFallbackContent({ reportDay: 0 }),
      generatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Format score data into a readable prompt format (legacy)
 */
function formatScoresForPrompt(scoreData) {
  const { scores, previousScores } = scoreData;

  const current = scores
    .sort((a, b) => calculateTotal(b.captions) - calculateTotal(a.captions))
    .map((s, idx) => {
      const total = calculateTotal(s.captions);
      const subtotals = calculateCaptionSubtotals(s.captions);
      return `${idx + 1}. ${s.corps}: ${total.toFixed(3)} (GE: ${subtotals.ge.toFixed(2)}, VIS: ${subtotals.visual.toFixed(2)}, MUS: ${subtotals.music.toFixed(2)})`;
    })
    .join("\n");

  let previous = "";
  let changes = "";

  if (previousScores && previousScores.length > 0) {
    const prevMap = new Map(
      previousScores.map(s => [s.corps, calculateTotal(s.captions)])
    );

    previous = previousScores
      .sort((a, b) => calculateTotal(b.captions) - calculateTotal(a.captions))
      .map((s, idx) => `${idx + 1}. ${s.corps}: ${calculateTotal(s.captions).toFixed(3)}`)
      .join("\n");

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
 * Generate fantasy-specific content (legacy)
 */
async function generateFantasyRecap(recapData) {
  try {
    const geminiModel = initializeGemini();

    const { shows, offSeasonDay } = recapData;

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
 */
async function getArticleImage({ headline, category, imageUrl }) {
  try {
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

    return {
      url: getContextualPlaceholder({ newsCategory: category, headline }),
      isPlaceholder: true,
      publicId: null,
      error: error.message,
    };
  }
}

/**
 * Generate complete news article with image (legacy wrapper)
 */
async function generateCompleteArticle(scoreData, options = {}) {
  try {
    const textResult = await generateNightlyRecap(scoreData);

    if (!textResult.success) {
      return textResult;
    }

    const imageResult = await getArticleImage({
      headline: textResult.content.headline,
      category: "dci",
      imageUrl: options.imageUrl,
    });

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

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  // New unified function
  generateDailyNews,

  // Data fetching helpers (for external use)
  fetchActiveCorps,
  fetchTimeLockednScores,
  fetchFantasyRecaps,

  // Legacy exports (backward compatibility)
  generateNightlyRecap,
  generateFantasyRecap,
  generateCompleteArticle,
  getArticleImage,
  initializeGemini,

  // Utility exports
  calculateTotal,
  calculateCaptionSubtotals,
};
