/**
 * NewsGenerationService - Gemini AI + Imagen Integration for DCI Recaps
 *
 * Generates 5 nightly articles with AI-generated images:
 * 1. DCI Standings - Corps rankings and momentum
 * 2. DCI Caption Analysis - Deep dive into caption performances
 * 3. Fantasy Top Performers - User ensemble highlights
 * 4. Fantasy League Recap - League standings and matchups
 * 5. Deep Analytics - Cross-data statistical analysis
 *
 * Uses historical DCI uniform data for accurate image generation.
 */

const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");
const { logger } = require("firebase-functions/v2");
const { defineSecret } = require("firebase-functions/params");
const { uploadFromUrl, getContextualPlaceholder } = require("./mediaService");

// Define Gemini API key secret
const geminiApiKey = defineSecret("GOOGLE_GENERATIVE_AI_API_KEY");

// Initialize clients (lazy loaded)
let genAI = null;
let textModel = null;

// =============================================================================
// DCI UNIFORM KNOWLEDGE BASE
// Accurate uniform descriptions by corps and year for image generation
// =============================================================================

const DCI_UNIFORMS = {
  "Blue Devils": {
    default: "navy blue uniforms with silver trim, white plumes, silver shakos",
    2018: "deep midnight blue uniforms with metallic silver accents, flowing capes, silver shako with white horsehair plume",
    2019: "navy blue with geometric silver patterns, asymmetrical chest design, chrome helmet accents",
    2014: "classic navy blue with white baldric, silver buttons, traditional shako with blue and white plume",
    2011: "dark blue military-style uniform with silver braiding, white gloves, tall silver shako",
  },
  "Carolina Crown": {
    default: "maroon and gold uniforms with gold trim, ornate chest plates",
    2013: "deep burgundy with elaborate gold filigree, Renaissance-inspired chest armor, golden crown emblems",
    2019: "maroon base with rose gold metallic overlay, modern athletic cut, illuminated crown logo",
    2016: "crimson red with gold accents, flowing burgundy sashes, ornate shako with golden plume",
  },
  "The Cadets": {
    default: "maroon and gold military-style uniforms, traditional design",
    2005: "classic maroon with cream trim, military brass buttons, tall busby-style shako",
    2011: "burgundy with gold rope braiding, Revolutionary War inspired, tri-corner influenced shako",
    2017: "deep maroon with metallic gold chest plate, modern streamlined design",
  },
  "Santa Clara Vanguard": {
    default: "red and white uniforms with ornate design, flowing capes",
    2018: "scarlet red with white and gold trim, dramatic flowing capes, traditional Spanish influence",
    2014: "crimson with white accents, ballet-inspired elements, red plumes",
    1989: "classic red and white with gold buttons, traditional military cut, white plumes",
  },
  "Bluecoats": {
    default: "blue and white contemporary uniforms, modern athletic design",
    2016: "electric blue with silver geometric patterns, futuristic LED-integrated elements, chrome visors",
    2019: "cobalt blue with white streaks, athletic cut, integrated technology elements",
    2014: "royal blue with white sash, clean modern lines, blue plumes",
  },
  "Phantom Regiment": {
    default: "maroon and black uniforms with dramatic capes, theatrical design",
    2008: "deep burgundy with black trim, flowing opera capes, skull regiment insignia",
    2011: "maroon with silver accents, Spartan-inspired chest plate, dramatic helmet",
    2003: "classic maroon and cream, military precision design, traditional shako",
  },
  "Blue Stars": {
    default: "royal blue with silver stars, patriotic design elements",
    2018: "deep blue with cascading silver stars, flowing sashes, celestial theme",
    2014: "navy blue with white star patterns, classic American design",
  },
  "Boston Crusaders": {
    default: "red, white, and blue Revolutionary War inspired uniforms",
    2018: "crimson red with colonial white accents, Revolutionary War era design, tricorn influenced",
    2019: "modern red with white geometric patterns, athletic streamlined design",
  },
  "Madison Scouts": {
    default: "green and gold uniforms, traditional scout design",
    2015: "forest green with gold trim, scout-inspired elements, green plumes",
    1995: "classic kelly green with gold buttons, traditional military style",
  },
  "Crossmen": {
    default: "blue and white with cross emblems, modern design",
    2018: "royal blue with white cross patterns, contemporary athletic cut",
  },
  "Colts": {
    default: "purple and silver uniforms, horse-inspired elements",
    2019: "deep purple with silver mane-like plumes, equestrian elegance",
  },
  "Mandarins": {
    default: "red and gold Asian-inspired design, ornate embroidery",
    2019: "crimson with gold dragon embroidery, flowing Asian-inspired silhouettes",
  },
  "Spirit of Atlanta": {
    default: "red, white, and black Southern design elements",
    2018: "scarlet red with white accents, phoenix imagery, Southern flair",
  },
  "Troopers": {
    default: "tan and brown cavalry uniforms, Western frontier design",
    2019: "dusty brown with cavalry yellow trim, cowboy-inspired elements, wide-brimmed influences",
  },
  "Pacific Crest": {
    default: "teal and white with mountain imagery",
    2019: "ocean teal with white peaks, Pacific Northwest inspired",
  },
  "Blue Knights": {
    default: "royal blue with silver knight armor elements",
    2018: "deep blue with chrome armor plating, medieval knight influence",
  },
  "Cavaliers": {
    default: "green and white with cavalier hat elements",
    2002: "forest green with white plumes, Three Musketeers inspired, classic cavalier hats",
    2006: "hunter green with gold accents, refined military precision",
  },
};

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

const ARTICLE_TYPES = {
  DCI_STANDINGS: "dci_standings",
  DCI_CAPTIONS: "dci_captions",
  FANTASY_PERFORMERS: "fantasy_performers",
  FANTASY_LEAGUES: "fantasy_leagues",
  DEEP_ANALYTICS: "deep_analytics",
};

// =============================================================================
// GEMINI INITIALIZATION
// =============================================================================

function initializeGemini() {
  if (!genAI) {
    const apiKey = geminiApiKey.value();
    if (!apiKey) {
      throw new Error("GOOGLE_GENERATIVE_AI_API_KEY secret is not set");
    }
    genAI = new GoogleGenerativeAI(apiKey);
    textModel = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-lite",
    });
  }
  return { genAI, textModel };
}

// =============================================================================
// IMAGE GENERATION (Free Tier / Imagen)
// =============================================================================

// Configuration: Set to true to use paid Imagen 4, false for free tier
const USE_IMAGEN_4 = false;

/**
 * Generate an image using either free tier (Gemini Flash) or Imagen 4
 * @param {string} prompt - Detailed image prompt
 * @returns {Promise<string>} Base64 image data or URL
 */
async function generateImageWithImagen(prompt) {
  const { genAI: ai } = initializeGemini();

  try {
    // Choose model based on configuration
    const modelName = USE_IMAGEN_4
      ? "imagen-4.0-fast-generate-001"  // Paid: $0.02/image
      : "gemini-2.0-flash-exp";          // Free tier: 500/day

    const imageModel = ai.getGenerativeModel({
      model: modelName,
    });

    const result = await imageModel.generateContent({
      contents: [{ role: "user", parts: [{ text: `Generate an image: ${prompt}` }] }],
      generationConfig: {
        responseModalities: ["image", "text"],
      },
    });

    const response = result.response;
    const imagePart = response.candidates?.[0]?.content?.parts?.find(
      part => part.inlineData?.mimeType?.startsWith("image/")
    );

    if (imagePart?.inlineData) {
      logger.info(`Image generated successfully using ${modelName}`);
      return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
    }

    logger.warn("No image generated, using placeholder");
    return null;
  } catch (error) {
    logger.error("Image generation failed:", error);
    return null;
  }
}

/**
 * Get uniform description for a corps and year
 */
function getUniformDescription(corpsName, year) {
  const corps = DCI_UNIFORMS[corpsName];
  if (!corps) {
    return `professional drum corps uniform in distinctive colors, polished brass instruments, precise military styling`;
  }
  return corps[year] || corps.default;
}

/**
 * Build image prompt for DCI article
 */
function buildDciImagePrompt(corpsName, year, context) {
  const uniform = getUniformDescription(corpsName, year);

  return `Photorealistic field-side photograph of a drum corps performer from ${corpsName} (${year}).
The performer is wearing ${uniform}.
Scene: ${context}
Style: Professional sports photography, dramatic stadium lighting, shallow depth of field,
high contrast, action shot frozen in motion.
The image captures the intensity and precision of competitive drum corps.
IMPORTANT: Accurate uniform details, professional marching arts equipment,
realistic brass instruments with authentic valve configurations.`;
}

/**
 * Build image prompt for fantasy corps article
 */
function buildFantasyImagePrompt(corpsName, theme) {
  // Generate creative uniform based on corps name theme
  const themePrompts = {
    dragons: "crimson and gold scales pattern, dragon-wing shoulder epaulettes, flame-inspired plumes",
    knights: "silver armor-plated chest design, royal blue capes, medieval crown emblems",
    thunder: "electric blue with lightning bolt patterns, storm grey accents, metallic silver trim",
    phoenix: "orange and red gradient flames, golden feather details, rising bird emblem",
    storm: "deep purple with silver cloud patterns, rain-streak design elements",
    wolves: "grey and silver fur-inspired textures, amber accents, wolf pack insignia",
    stars: "midnight blue with constellation patterns, silver star embroidery, cosmic theme",
    fire: "orange and red flame gradients, ember-like sparkle accents, heat shimmer effects",
    ice: "crystalline white with ice blue accents, frost patterns, winter elegance",
    shadow: "matte black with subtle purple undertones, mysterious silhouette design",
  };

  // Extract theme from corps name
  const lowerName = corpsName.toLowerCase();
  let uniformTheme = "distinctive custom design with team colors, modern athletic cut";

  for (const [key, desc] of Object.entries(themePrompts)) {
    if (lowerName.includes(key)) {
      uniformTheme = desc;
      break;
    }
  }

  return `Photorealistic field-side photograph of a fantasy drum corps performer from "${corpsName}".
The performer is wearing a custom uniform featuring ${uniformTheme}.
Scene: ${theme || "performing under dramatic stadium lights, crowd in background"}
Style: Professional sports photography, dramatic lighting, shallow depth of field.
The image captures the creativity and spirit of marching arts fantasy competition.
IMPORTANT: Creative but realistic uniform design, professional marching arts equipment.`;
}

// =============================================================================
// ARTICLE GENERATION
// =============================================================================

/**
 * Generate all 5 nightly articles
 */
async function generateAllArticles({ db, dataDocId, seasonId, currentDay }) {
  const reportDay = currentDay - 1;

  if (reportDay < 1) {
    return { success: false, error: "Invalid day" };
  }

  logger.info(`Generating 5 articles for Day ${reportDay}`);

  try {
    // Fetch all data
    const activeCorps = await fetchActiveCorps(db, dataDocId);
    const yearsToFetch = [...new Set(activeCorps.map(c => c.sourceYear))];
    const historicalData = await fetchTimeLockednScores(db, yearsToFetch, reportDay);
    const fantasyData = await fetchFantasyRecaps(db, seasonId, reportDay);

    // Process data
    const dayScores = getScoresForDay(historicalData, reportDay, activeCorps);
    const trendData = calculateTrendData(historicalData, reportDay, activeCorps);
    const captionLeaders = identifyCaptionLeaders(dayScores, trendData);

    // Generate all 5 articles in parallel
    const articles = await Promise.all([
      generateDciStandingsArticle({ reportDay, dayScores, trendData, activeCorps }),
      generateDciCaptionsArticle({ reportDay, dayScores, captionLeaders, activeCorps }),
      generateFantasyPerformersArticle({ reportDay, fantasyData }),
      generateFantasyLeaguesArticle({ reportDay, fantasyData }),
      generateDeepAnalyticsArticle({ reportDay, dayScores, trendData, fantasyData, captionLeaders }),
    ]);

    return {
      success: true,
      articles,
      metadata: { reportDay, currentDay, corpsCount: dayScores.length },
    };
  } catch (error) {
    logger.error("Error generating articles:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Article 1: DCI Standings
 */
async function generateDciStandingsArticle({ reportDay, dayScores, trendData, activeCorps }) {
  const { textModel } = initializeGemini();

  const topCorps = dayScores[0];
  const prompt = `Write a compelling DCI standings article for Day ${reportDay}.

TOP 12 STANDINGS:
${dayScores.slice(0, 12).map((s, i) => {
  const trend = trendData[s.corps];
  return `${i + 1}. ${s.corps} (${s.sourceYear}): ${s.total.toFixed(3)} [${trend?.dayChange >= 0 ? '+' : ''}${(trend?.dayChange || 0).toFixed(3)}]`;
}).join('\n')}

Write like a veteran DCI journalist. Focus on:
- Who is leading and by how much
- Major position changes
- Momentum narratives
- Gap analysis between top corps

Return JSON: { headline, summary, narrative, standings: [{rank, corps, year, total, change, momentum}] }`;

  try {
    const result = await textModel.generateContent(prompt);
    const content = JSON.parse(result.response.text());

    // Generate image featuring top corps
    const imagePrompt = buildDciImagePrompt(
      topCorps.corps,
      topCorps.sourceYear,
      "brass section performing powerful sustained note, stadium crowd blurred in background, golden hour lighting"
    );

    const imageData = await generateImageWithImagen(imagePrompt);
    const imageResult = await processGeneratedImage(imageData, "dci_standings");

    return {
      type: ARTICLE_TYPES.DCI_STANDINGS,
      ...content,
      imageUrl: imageResult.url,
      imagePrompt,
      reportDay,
    };
  } catch (error) {
    logger.error("DCI Standings article failed:", error);
    return createFallbackArticle(ARTICLE_TYPES.DCI_STANDINGS, reportDay);
  }
}

/**
 * Article 2: DCI Caption Analysis
 */
async function generateDciCaptionsArticle({ reportDay, dayScores, captionLeaders, activeCorps }) {
  const { textModel } = initializeGemini();

  const prompt = `Write a deep-dive caption analysis for Day ${reportDay}.

CAPTION LEADERS:
${captionLeaders.map(c => `${c.caption}: ${c.leader} (${c.score.toFixed(2)}) [trend: ${c.weeklyTrend}]`).join('\n')}

TOP SCORES BY CATEGORY:
GE Leaders: ${dayScores.slice(0, 5).map(s => `${s.corps}: ${s.subtotals.ge.toFixed(2)}`).join(', ')}
Visual Leaders: ${dayScores.slice(0, 5).map(s => `${s.corps}: ${s.subtotals.visual.toFixed(2)}`).join(', ')}
Music Leaders: ${dayScores.slice(0, 5).map(s => `${s.corps}: ${s.subtotals.music.toFixed(2)}`).join(', ')}

Analyze each caption category in depth. Discuss technique, execution, and trends.

Return JSON: { headline, summary, narrative, captionBreakdown: [{category, leader, analysis}] }`;

  try {
    const result = await textModel.generateContent(prompt);
    const content = JSON.parse(result.response.text());

    // Feature a corps excelling in a specific caption
    const featuredCaption = captionLeaders[0];
    const featuredCorps = dayScores.find(s => s.corps === featuredCaption?.leader) || dayScores[0];

    const section = featuredCaption?.caption?.toLowerCase().includes("brass") ? "brass section" :
                    featuredCaption?.caption?.toLowerCase().includes("percussion") ? "drumline" :
                    featuredCaption?.caption?.toLowerCase().includes("guard") ? "color guard" : "full corps";

    const imagePrompt = buildDciImagePrompt(
      featuredCorps.corps,
      featuredCorps.sourceYear,
      `${section} in perfect formation, capturing technical excellence, dramatic side angle`
    );

    const imageData = await generateImageWithImagen(imagePrompt);
    const imageResult = await processGeneratedImage(imageData, "dci_captions");

    return {
      type: ARTICLE_TYPES.DCI_CAPTIONS,
      ...content,
      imageUrl: imageResult.url,
      imagePrompt,
      reportDay,
    };
  } catch (error) {
    logger.error("DCI Captions article failed:", error);
    return createFallbackArticle(ARTICLE_TYPES.DCI_CAPTIONS, reportDay);
  }
}

/**
 * Article 3: Fantasy Top Performers
 */
async function generateFantasyPerformersArticle({ reportDay, fantasyData }) {
  const { textModel } = initializeGemini();

  if (!fantasyData?.current) {
    return createFallbackArticle(ARTICLE_TYPES.FANTASY_PERFORMERS, reportDay);
  }

  const shows = fantasyData.current.shows || [];
  const allResults = shows.flatMap(s => s.results || []);
  const topPerformers = allResults.sort((a, b) => b.totalScore - a.totalScore).slice(0, 10);

  const prompt = `Write a fantasy drum corps performer spotlight for Day ${reportDay}.

TOP FANTASY ENSEMBLES:
${topPerformers.map((r, i) =>
  `${i + 1}. ${r.directorName || 'Director'}'s "${r.corpsName}": ${r.totalScore.toFixed(3)} pts`
).join('\n')}

Celebrate the top performers. Focus on their overall scores and standings.
IMPORTANT: Do NOT speculate about or mention specific caption picks or lineup choices.
Directors' caption selections are confidential strategy. Only discuss total scores and rankings.
Make it engaging and exciting for fantasy players.

Return JSON: { headline, summary, narrative, topPerformers: [{rank, director, corpsName, score, highlight}] }`;

  try {
    const result = await textModel.generateContent(prompt);
    const content = JSON.parse(result.response.text());

    // Generate image for top fantasy corps
    const topCorps = topPerformers[0];
    const imagePrompt = buildFantasyImagePrompt(
      topCorps?.corpsName || "Champion Corps",
      "celebrating victory, confetti falling, triumphant pose under spotlights"
    );

    const imageData = await generateImageWithImagen(imagePrompt);
    const imageResult = await processGeneratedImage(imageData, "fantasy_performers");

    return {
      type: ARTICLE_TYPES.FANTASY_PERFORMERS,
      ...content,
      imageUrl: imageResult.url,
      imagePrompt,
      reportDay,
    };
  } catch (error) {
    logger.error("Fantasy Performers article failed:", error);
    return createFallbackArticle(ARTICLE_TYPES.FANTASY_PERFORMERS, reportDay);
  }
}

/**
 * Article 4: Fantasy League Recap
 */
async function generateFantasyLeaguesArticle({ reportDay, fantasyData }) {
  const { textModel } = initializeGemini();

  // This would need actual league data - using placeholder structure
  const prompt = `Write a fantasy league standings update for Day ${reportDay}.

Focus on:
- League standings changes
- Head-to-head matchup results
- Playoff implications
- Waiver wire recommendations

Make it feel like ESPN fantasy sports coverage.

Return JSON: { headline, summary, narrative, leagueHighlights: [{league, leader, story}] }`;

  try {
    const result = await textModel.generateContent(prompt);
    const content = JSON.parse(result.response.text());

    const imagePrompt = buildFantasyImagePrompt(
      "League Champions",
      "trophy presentation ceremony, golden confetti, championship moment"
    );

    const imageData = await generateImageWithImagen(imagePrompt);
    const imageResult = await processGeneratedImage(imageData, "fantasy_leagues");

    return {
      type: ARTICLE_TYPES.FANTASY_LEAGUES,
      ...content,
      imageUrl: imageResult.url,
      imagePrompt,
      reportDay,
    };
  } catch (error) {
    logger.error("Fantasy Leagues article failed:", error);
    return createFallbackArticle(ARTICLE_TYPES.FANTASY_LEAGUES, reportDay);
  }
}

/**
 * Article 5: Deep Analytics
 */
async function generateDeepAnalyticsArticle({ reportDay, dayScores, trendData, fantasyData, captionLeaders }) {
  const { textModel } = initializeGemini();

  const prompt = `Write a deep statistical analysis for Day ${reportDay}.

STATISTICAL DATA:
- Corps with biggest gains: ${Object.entries(trendData).filter(([,t]) => t.dayChange > 0.1).map(([c,t]) => `${c}: +${t.dayChange.toFixed(3)}`).join(', ') || 'None significant'}
- Corps cooling off: ${Object.entries(trendData).filter(([,t]) => t.dayChange < -0.1).map(([c,t]) => `${c}: ${t.dayChange.toFixed(3)}`).join(', ') || 'None significant'}
- 7-day trend leaders: ${Object.entries(trendData).sort((a,b) => b[1].trendFromAvg - a[1].trendFromAvg).slice(0,3).map(([c,t]) => `${c}: +${t.trendFromAvg.toFixed(3)}`).join(', ')}

Provide deep statistical insights:
- Regression analysis on DCI corps performance
- Momentum indicators for corps trajectories
- General fantasy value observations (which DCI corps are trending)
- Strategic recommendations for fantasy players

IMPORTANT: Do NOT reveal or speculate about any individual director's caption picks or lineup choices.
Caption selections are confidential. Only discuss overall DCI corps trends and general fantasy value.

Return JSON: { headline, summary, narrative, insights: [{metric, finding, implication}], recommendations: [{corps, action, reasoning}] }`;

  try {
    const result = await textModel.generateContent(prompt);
    const content = JSON.parse(result.response.text());

    // Analytical/data visualization style image
    const topTrending = Object.entries(trendData).sort((a,b) => b[1].trendFromAvg - a[1].trendFromAvg)[0];
    const featuredCorps = dayScores.find(s => s.corps === topTrending?.[0]) || dayScores[0];

    const imagePrompt = buildDciImagePrompt(
      featuredCorps.corps,
      featuredCorps.sourceYear,
      "wide shot of full corps in complex drill formation, geometric patterns visible from elevated angle, dramatic shadows"
    );

    const imageData = await generateImageWithImagen(imagePrompt);
    const imageResult = await processGeneratedImage(imageData, "deep_analytics");

    return {
      type: ARTICLE_TYPES.DEEP_ANALYTICS,
      ...content,
      imageUrl: imageResult.url,
      imagePrompt,
      reportDay,
    };
  } catch (error) {
    logger.error("Deep Analytics article failed:", error);
    return createFallbackArticle(ARTICLE_TYPES.DEEP_ANALYTICS, reportDay);
  }
}

/**
 * Process generated image - upload to Cloudinary or use placeholder
 */
async function processGeneratedImage(imageData, category) {
  if (imageData) {
    try {
      const result = await uploadFromUrl(imageData, {
        folder: "marching-art/news",
        category,
      });
      return { url: result.url, isPlaceholder: false };
    } catch (error) {
      logger.error("Image upload failed:", error);
    }
  }

  return {
    url: getContextualPlaceholder({ newsCategory: category }),
    isPlaceholder: true,
  };
}

/**
 * Create fallback article when generation fails
 */
function createFallbackArticle(type, reportDay) {
  return {
    type,
    headline: `Day ${reportDay} ${type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`,
    summary: "Analysis is being processed. Check back shortly.",
    narrative: "Full analysis will be available soon.",
    imageUrl: getContextualPlaceholder({ newsCategory: type }),
    isPlaceholder: true,
    reportDay,
  };
}

// =============================================================================
// DATA FETCHING (unchanged from original)
// =============================================================================

async function fetchActiveCorps(db, dataDocId) {
  try {
    const corpsDataDoc = await db.doc(`dci-data/${dataDocId}`).get();
    if (!corpsDataDoc.exists) return [];
    return corpsDataDoc.data().corpsValues || [];
  } catch (error) {
    logger.error("Error fetching active corps:", error);
    return [];
  }
}

async function fetchTimeLockednScores(db, yearsToFetch, reportDay) {
  try {
    const historicalDocs = await Promise.all(
      yearsToFetch.map(year => db.doc(`historical_scores/${year}`).get())
    );

    const historicalData = {};
    historicalDocs.forEach(doc => {
      if (doc.exists) {
        const allEvents = doc.data().data || [];
        const filteredEvents = allEvents.filter(event => {
          const eventDay = event.offSeasonDay;
          return eventDay >= reportDay - 6 && eventDay <= reportDay;
        });

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
    logger.error("Error fetching scores:", error);
    return {};
  }
}

async function fetchFantasyRecaps(db, seasonId, reportDay) {
  try {
    const recapDoc = await db.doc(`fantasy_recaps/${seasonId}`).get();
    if (!recapDoc.exists) return null;

    const allRecaps = recapDoc.data().recaps || [];
    const dayRecap = allRecaps.find(r => r.offSeasonDay === reportDay);
    const trendRecaps = allRecaps.filter(r =>
      r.offSeasonDay >= reportDay - 6 && r.offSeasonDay <= reportDay
    );

    return { current: dayRecap || null, trends: trendRecaps };
  } catch (error) {
    logger.error("Error fetching fantasy recaps:", error);
    return null;
  }
}

// =============================================================================
// SCORE CALCULATIONS (unchanged from original)
// =============================================================================

function calculateTotal(captions) {
  const ge = (captions.GE1 || 0) + (captions.GE2 || 0);
  const vis = ((captions.VP || 0) + (captions.VA || 0) + (captions.CG || 0)) / 2;
  const mus = ((captions.B || 0) + (captions.MA || 0) + (captions.P || 0)) / 2;
  return ge + vis + mus;
}

function calculateCaptionSubtotals(captions) {
  return {
    ge: (captions.GE1 || 0) + (captions.GE2 || 0),
    visual: ((captions.VP || 0) + (captions.VA || 0) + (captions.CG || 0)) / 2,
    music: ((captions.B || 0) + (captions.MA || 0) + (captions.P || 0)) / 2,
  };
}

function getScoresForDay(historicalData, targetDay, activeCorps) {
  const dayScores = [];

  for (const corps of activeCorps) {
    const { corpsName, sourceYear } = corps;
    const yearEvents = historicalData[sourceYear] || [];
    const dayEvent = yearEvents.find(e => e.offSeasonDay === targetDay);
    if (!dayEvent) continue;

    const corpsScore = dayEvent.scores.find(s => s.corps === corpsName);
    if (!corpsScore) continue;

    const total = calculateTotal(corpsScore.captions);
    if (total <= 0) continue;

    dayScores.push({
      corps: corpsName,
      sourceYear,
      captions: corpsScore.captions,
      total,
      subtotals: calculateCaptionSubtotals(corpsScore.captions),
    });
  }

  return dayScores.sort((a, b) => b.total - a.total);
}

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
          if (total > 0) scores.push({ day, total });
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
        dayChange: latestScore && previousScore ? latestScore.total - previousScore.total : 0,
        trendFromAvg: latestScore ? latestScore.total - avgTotal : 0,
      };
    }
  }

  return trends;
}

function identifyCaptionLeaders(dayScores, trendData) {
  const leaders = [];

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
      leaders.push({
        caption: CAPTIONS[captionKey],
        leader: leader.corps,
        score: highScore,
        weeklyTrend: trend ? (trend.trendFromAvg >= 0 ? "+" : "") + trend.trendFromAvg.toFixed(2) : "+0.00",
      });
    }
  }

  return leaders;
}

// =============================================================================
// LEGACY EXPORTS (for backward compatibility)
// =============================================================================

async function generateDailyNews(options) {
  // Wrapper for old API - generates single combined article
  const result = await generateAllArticles(options);
  if (!result.success) return result;

  // Combine into legacy format
  const [standings, captions, performers, leagues, analytics] = result.articles;

  return {
    success: true,
    content: {
      headline: standings.headline,
      summary: standings.summary,
      dciRecap: {
        title: captions.headline,
        narrative: captions.narrative,
        captionLeaders: captions.captionBreakdown || [],
        standings: standings.standings || [],
      },
      fantasySpotlight: {
        title: performers.headline,
        narrative: performers.narrative,
        topEnsembles: performers.topPerformers || [],
      },
      crossOverAnalysis: {
        title: analytics.headline,
        narrative: analytics.narrative,
        roiHighlights: analytics.recommendations || [],
      },
      imageUrl: standings.imageUrl,
    },
    articles: result.articles,
    metadata: result.metadata,
  };
}

async function generateNightlyRecap(scoreData) {
  // Legacy wrapper
  return generateDailyNews(scoreData);
}

async function generateFantasyRecap(recapData) {
  const { textModel } = initializeGemini();

  try {
    const { shows, offSeasonDay } = recapData;
    const allResults = shows.flatMap(s => s.results || []);
    const topPerformers = allResults.sort((a, b) => b.totalScore - a.totalScore).slice(0, 10);

    const prompt = `Generate fantasy analysis for Day ${offSeasonDay}:
${topPerformers.map((r, i) => `${i + 1}. ${r.corpsName}: ${r.totalScore.toFixed(3)}`).join('\n')}
Return JSON: { headline, summary, narrative, fantasyImpact, trendingCorps: [] }`;

    const result = await textModel.generateContent(prompt);
    return { success: true, content: JSON.parse(result.response.text()) };
  } catch (error) {
    logger.error("Fantasy recap failed:", error);
    return { success: false, error: error.message };
  }
}

async function getArticleImage({ headline, category }) {
  return {
    url: getContextualPlaceholder({ newsCategory: category, headline }),
    isPlaceholder: true,
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  // New 5-article system
  generateAllArticles,
  generateDciStandingsArticle,
  generateDciCaptionsArticle,
  generateFantasyPerformersArticle,
  generateFantasyLeaguesArticle,
  generateDeepAnalyticsArticle,

  // Imagen utilities
  generateImageWithImagen,
  buildDciImagePrompt,
  buildFantasyImagePrompt,
  getUniformDescription,
  DCI_UNIFORMS,

  // Legacy exports
  generateDailyNews,
  generateNightlyRecap,
  generateFantasyRecap,
  getArticleImage,
  initializeGemini,

  // Data helpers
  fetchActiveCorps,
  fetchTimeLockednScores,
  fetchFantasyRecaps,
  calculateTotal,
  calculateCaptionSubtotals,

  // Constants
  ARTICLE_TYPES,
  CAPTIONS,
};
