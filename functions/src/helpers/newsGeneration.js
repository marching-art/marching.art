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
 * Clean JSON response from AI - strips markdown code blocks
 */
function cleanJsonResponse(text) {
  let cleaned = text.trim();
  // Remove markdown code blocks
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}

/**
 * Safely parse JSON from AI response
 */
function parseAiJson(text) {
  const cleaned = cleanJsonResponse(text);
  return JSON.parse(cleaned);
}

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

    // Fetch show context (event name, location, date)
    const showContext = await fetchShowContext(db, seasonId, historicalData, reportDay);
    logger.info(`Show context for Day ${reportDay}: ${showContext.showName} at ${showContext.location} on ${showContext.date}`);

    // Process data
    const dayScores = getScoresForDay(historicalData, reportDay, activeCorps);
    const trendData = calculateTrendData(historicalData, reportDay, activeCorps);
    const captionLeaders = identifyCaptionLeaders(dayScores, trendData);

    // Generate all 5 articles in parallel, passing show context to each
    const articles = await Promise.all([
      generateDciStandingsArticle({ reportDay, dayScores, trendData, activeCorps, showContext }),
      generateDciCaptionsArticle({ reportDay, dayScores, captionLeaders, activeCorps, showContext }),
      generateFantasyPerformersArticle({ reportDay, fantasyData, showContext }),
      generateFantasyLeaguesArticle({ reportDay, fantasyData, showContext }),
      generateDeepAnalyticsArticle({ reportDay, dayScores, trendData, fantasyData, captionLeaders, showContext }),
    ]);

    return {
      success: true,
      articles,
      metadata: {
        reportDay,
        currentDay,
        corpsCount: dayScores.length,
        showName: showContext.showName,
        location: showContext.location,
        date: showContext.date,
      },
    };
  } catch (error) {
    logger.error("Error generating articles:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Article 1: DCI Standings
 */
async function generateDciStandingsArticle({ reportDay, dayScores, trendData, activeCorps, showContext }) {
  const { textModel } = initializeGemini();

  const topCorps = dayScores[0];
  const secondCorps = dayScores[1];
  const gap = topCorps && secondCorps ? (topCorps.total - secondCorps.total).toFixed(3) : "0.000";

  const prompt = `You are a veteran DCI (Drum Corps International) journalist writing for marching.art, the premier fantasy platform for competitive drum corps.

CONTEXT: DCI is the premier competitive marching music organization in the world. Corps compete in shows judged on General Effect (GE), Visual, and Music captions. Scores range from 0-100, with top corps typically scoring 85-99. Every 0.001 point matters in these razor-thin competitions.

═══════════════════════════════════════════════════════════════
EVENT INFORMATION
═══════════════════════════════════════════════════════════════
• Show Name: ${showContext.showName}
• Location: ${showContext.location}
• Date: ${showContext.date}
• Season Day: ${reportDay}
═══════════════════════════════════════════════════════════════

TODAY'S COMPETITION RESULTS from ${showContext.showName} in ${showContext.location}:

STANDINGS (Corps Name | Historical Season Year | Total Score | Daily Change):
${dayScores.slice(0, 12).map((s, i) => {
  const trend = trendData[s.corps];
  const change = trend?.dayChange || 0;
  return `${i + 1}. ${s.corps} (${s.sourceYear} season): ${s.total.toFixed(3)} pts [${change >= 0 ? '+' : ''}${change.toFixed(3)} from yesterday]`;
}).join('\n')}

KEY STATISTICS:
- Lead margin: ${topCorps?.corps || 'N/A'} leads by ${gap} points
- Biggest gainer today: ${Object.entries(trendData).sort((a,b) => b[1].dayChange - a[1].dayChange)[0]?.[0] || 'N/A'}
- Corps count: ${dayScores.length} corps competing

WRITE A PROFESSIONAL SPORTS ARTICLE covering today's standings. Your article should:

1. HEADLINE: Create an attention-grabbing headline like ESPN or Sports Illustrated would write. Reference the leading corps and the competitive narrative. Examples of good headlines: "Blue Devils Extend Dynasty with 0.425 Surge", "Crown Closes Gap: 0.15 Separates Top Three"

2. SUMMARY: 2-3 punchy sentences capturing the day's biggest story - who's leading, who's surging, who's falling.

3. NARRATIVE: A 3-4 paragraph article that:
   - Opens with the leader and their margin (make it dramatic)
   - Discusses position battles (who moved up/down and why it matters)
   - Analyzes momentum (which corps are trending hot or cold)
   - Closes with what to watch tomorrow

TONE: Professional sports journalism. Authoritative but accessible. Use specific numbers. Create drama from the competition without being hyperbolic. Reference that these are real historical DCI performances.

Return ONLY valid JSON with this EXACT structure:
{
  "headline": "string",
  "summary": "string",
  "narrative": "string",
  "standings": [{"rank": 1, "corps": "string", "year": 2024, "total": 95.123, "change": 0.123, "momentum": "rising/falling/steady"}]
}`;

  try {
    const result = await textModel.generateContent(prompt);
    const content = parseAiJson(result.response.text());

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
async function generateDciCaptionsArticle({ reportDay, dayScores, captionLeaders, activeCorps, showContext }) {
  const { textModel } = initializeGemini();

  const prompt = `You are a DCI caption analyst and technical expert writing for marching.art. You specialize in breaking down the scoring categories that determine DCI competition results.

CONTEXT: DCI scoring has three main categories:
- GENERAL EFFECT (GE): 40% of total - Measures overall entertainment value, emotional impact, and design excellence. Split into GE1 (Music Effect) and GE2 (Visual Effect).
- VISUAL: 30% of total - Measures marching technique, body movement, and color guard excellence. Includes Visual Proficiency (VP), Visual Analysis (VA), and Color Guard (CG).
- MUSIC: 30% of total - Measures musical performance quality. Includes Brass (B), Music Analysis (MA), and Percussion (P).

═══════════════════════════════════════════════════════════════
EVENT INFORMATION
═══════════════════════════════════════════════════════════════
• Show Name: ${showContext.showName}
• Location: ${showContext.location}
• Date: ${showContext.date}
• Season Day: ${reportDay}
═══════════════════════════════════════════════════════════════

CAPTION BREAKDOWN from ${showContext.showName} in ${showContext.location}:

CAPTION LEADERS BY CATEGORY:
${captionLeaders.map(c => `${c.caption}: ${c.leader} scores ${c.score.toFixed(2)} [7-day trend: ${c.weeklyTrend}]`).join('\n')}

SUBCATEGORY TOTALS (Top 5 Corps):
General Effect: ${dayScores.slice(0, 5).map(s => `${s.corps}: ${s.subtotals.ge.toFixed(2)}`).join(' | ')}
Visual Total: ${dayScores.slice(0, 5).map(s => `${s.corps}: ${s.subtotals.visual.toFixed(2)}`).join(' | ')}
Music Total: ${dayScores.slice(0, 5).map(s => `${s.corps}: ${s.subtotals.music.toFixed(2)}`).join(' | ')}

WRITE A TECHNICAL ANALYSIS ARTICLE that breaks down today's caption performances:

1. HEADLINE: Focus on the most interesting caption story. Examples: "Crown Brass Posts Season-High 19.2: Inside the Hornline's Breakthrough", "Blue Devils GE Dominance: How Design Excellence Creates Separation"

2. SUMMARY: 2-3 sentences highlighting which corps dominated which captions and what it means for the competition.

3. NARRATIVE: A detailed 3-4 paragraph analysis that:
   - Identifies which corps is winning the "caption battle" in each major area
   - Explains WHY certain corps excel in specific captions (brass technique, guard excellence, visual clarity)
   - Discusses any caption trends (corps improving in brass, guard scores rising across the board)
   - Provides insight into how caption strengths/weaknesses affect total scores

4. CAPTION BREAKDOWN: Provide analysis for each major category with the leader and what makes them stand out.

TONE: Technical but accessible. Like a color commentator who knows the activity inside and out. Use specific scores. Reference real DCI judging criteria.

Return ONLY valid JSON:
{
  "headline": "string",
  "summary": "string",
  "narrative": "string",
  "captionBreakdown": [{"category": "General Effect/Visual/Music/Brass/Percussion/Guard", "leader": "Corps Name", "analysis": "2-3 sentence analysis"}]
}`;

  try {
    const result = await textModel.generateContent(prompt);
    const content = parseAiJson(result.response.text());

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
async function generateFantasyPerformersArticle({ reportDay, fantasyData, showContext }) {
  const { textModel } = initializeGemini();

  if (!fantasyData?.current) {
    return createFallbackArticle(ARTICLE_TYPES.FANTASY_PERFORMERS, reportDay);
  }

  const shows = fantasyData.current.shows || [];
  const allResults = shows.flatMap(s => s.results || []);
  const topPerformers = allResults.sort((a, b) => b.totalScore - a.totalScore).slice(0, 10);

  // Calculate some stats
  const avgScore = topPerformers.length > 0
    ? (topPerformers.reduce((sum, p) => sum + p.totalScore, 0) / topPerformers.length).toFixed(3)
    : "0.000";
  const topScore = topPerformers[0]?.totalScore?.toFixed(3) || "0.000";

  const prompt = `You are a fantasy sports analyst writing for marching.art, covering our DCI fantasy competition like ESPN covers fantasy football.

CONTEXT: marching.art Fantasy is a fantasy sports game where users ("Directors") create their own fantasy ensembles. Directors draft real DCI corps to fill caption positions (Brass, Percussion, Guard, etc.) and earn points based on how those corps perform in actual DCI competitions. Think fantasy football, but for drum corps.

═══════════════════════════════════════════════════════════════
DATE & CONTEXT
═══════════════════════════════════════════════════════════════
• Date: ${showContext.date}
• Season Day: ${reportDay}
• DCI Show Today: ${showContext.showName} in ${showContext.location}
═══════════════════════════════════════════════════════════════

FANTASY LEADERBOARD for ${showContext.date} (Day ${reportDay}):

TOP 10 FANTASY ENSEMBLES:
${topPerformers.map((r, i) =>
  `${i + 1}. "${r.corpsName}" (Director: ${r.directorName || 'Anonymous'}) - ${r.totalScore.toFixed(3)} fantasy points`
).join('\n')}

STATISTICS:
- Top Score: ${topScore} points
- Top 10 Average: ${avgScore} points
- Total ensembles competing: ${allResults.length}

WRITE A FANTASY SPORTS CELEBRATION ARTICLE:

1. HEADLINE: Exciting fantasy sports headline celebrating the top performers. Examples: "The Crimson Guard Dominates Day ${reportDay} with ${topScore}-Point Explosion", "Anonymous Director's 'Blue Thunder' Claims Fantasy Crown"

2. SUMMARY: 2-3 sentences about who dominated today's fantasy competition. Make it exciting!

3. NARRATIVE: A 3-4 paragraph article that:
   - Celebrates the top Director's achievement with enthusiasm
   - Highlights impressive performances in the top 5
   - Notes the competition level (how close were the scores?)
   - Teases tomorrow's competition

CRITICAL RULES:
- This is FANTASY SPORTS like fantasy football - NOT a role-playing game or video game
- The "corps names" are creative team names chosen by users, not real DCI corps
- NEVER mention specific lineup picks or roster choices - these are confidential strategy
- Focus ONLY on total scores and rankings
- Write like ESPN fantasy coverage - celebratory, fun, competitive

Return ONLY valid JSON:
{
  "headline": "string",
  "summary": "string",
  "narrative": "string",
  "topPerformers": [{"rank": 1, "director": "Name or Anonymous", "corpsName": "Fantasy Team Name", "score": 95.123, "highlight": "One sentence about their achievement"}]
}`;

  try {
    const result = await textModel.generateContent(prompt);
    const content = parseAiJson(result.response.text());

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
async function generateFantasyLeaguesArticle({ reportDay, fantasyData, showContext }) {
  const { textModel } = initializeGemini();

  // Get show/league data
  const shows = fantasyData?.current?.shows || [];
  const showSummaries = shows.map(show => {
    const results = show.results || [];
    const top3 = results.sort((a, b) => b.totalScore - a.totalScore).slice(0, 3);
    return {
      name: show.showName || show.showId || 'Competition',
      entrants: results.length,
      topScorer: top3[0]?.corpsName || 'N/A',
      topScore: top3[0]?.totalScore?.toFixed(3) || '0.000',
    };
  });

  const prompt = `You are a fantasy sports league analyst for marching.art, writing league updates like ESPN's fantasy football league coverage.

CONTEXT: marching.art Fantasy organizes competitions into "shows" (like fantasy football leagues). Directors compete in these shows with their fantasy ensembles. Points are earned based on real DCI corps performances.

═══════════════════════════════════════════════════════════════
DATE & CONTEXT
═══════════════════════════════════════════════════════════════
• Date: ${showContext.date}
• Season Day: ${reportDay}
• DCI Show Today: ${showContext.showName} in ${showContext.location}
═══════════════════════════════════════════════════════════════

LEAGUE/SHOW ACTIVITY for ${showContext.date} (Day ${reportDay}):

ACTIVE COMPETITIONS:
${showSummaries.length > 0 ? showSummaries.map((s, i) =>
  `${i + 1}. "${s.name}" - ${s.entrants} ensembles competing | Leader: "${s.topScorer}" (${s.topScore} pts)`
).join('\n') : 'No active shows today - check back tomorrow!'}

Total Shows Active: ${shows.length}
Total Directors Competing: ${shows.reduce((sum, s) => sum + (s.results?.length || 0), 0)}

WRITE A LEAGUE ROUNDUP ARTICLE:

1. HEADLINE: League-focused headline about competition across shows. Examples: "Championship Show Heats Up: Three Directors Within 0.5 Points", "Day ${reportDay} League Roundup: Underdogs Make Their Move"

2. SUMMARY: 2-3 sentences summarizing league activity across all shows.

3. NARRATIVE: A 3-4 paragraph article that:
   - Provides an overview of competition across shows
   - Highlights tight races and dominant performances
   - Discusses what's at stake as the season progresses
   - Previews upcoming competition days

4. LEAGUE HIGHLIGHTS: Key storylines from each active show/league.

CRITICAL RULES:
- This is FANTASY SPORTS coverage - NOT RPG/video games
- Focus on league/show competition, not individual roster decisions
- NEVER reveal or speculate about specific lineup choices
- Write like ESPN fantasy league coverage

Return ONLY valid JSON:
{
  "headline": "string",
  "summary": "string",
  "narrative": "string",
  "leagueHighlights": [{"league": "Show/League Name", "leader": "Top Ensemble Name", "story": "1-2 sentence storyline"}]
}`;

  try {
    const result = await textModel.generateContent(prompt);
    const content = parseAiJson(result.response.text());

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
async function generateDeepAnalyticsArticle({ reportDay, dayScores, trendData, fantasyData, captionLeaders, showContext }) {
  const { textModel } = initializeGemini();

  // Calculate advanced statistics
  const bigGainers = Object.entries(trendData)
    .filter(([, t]) => t.dayChange > 0.1)
    .sort((a, b) => b[1].dayChange - a[1].dayChange)
    .slice(0, 5);

  const bigLosers = Object.entries(trendData)
    .filter(([, t]) => t.dayChange < -0.1)
    .sort((a, b) => a[1].dayChange - b[1].dayChange)
    .slice(0, 5);

  const trendLeaders = Object.entries(trendData)
    .sort((a, b) => b[1].trendFromAvg - a[1].trendFromAvg)
    .slice(0, 5);

  const trendLaggers = Object.entries(trendData)
    .sort((a, b) => a[1].trendFromAvg - b[1].trendFromAvg)
    .slice(0, 5);

  // Calculate score distribution
  const totalScores = dayScores.map(s => s.total);
  const avgScore = totalScores.length > 0
    ? (totalScores.reduce((sum, s) => sum + s, 0) / totalScores.length).toFixed(3)
    : "0.000";
  const scoreSpread = totalScores.length > 0
    ? (Math.max(...totalScores) - Math.min(...totalScores)).toFixed(3)
    : "0.000";

  const prompt = `You are a senior data analyst and statistician for marching.art, writing advanced analytical content like FiveThirtyEight or The Athletic's deep dives.

CONTEXT: DCI scoring uses a 100-point scale. Top corps score 90-99+. Every 0.001 point represents real competitive separation. The season builds toward championships, so trajectory matters as much as current standings.

═══════════════════════════════════════════════════════════════
EVENT INFORMATION
═══════════════════════════════════════════════════════════════
• Show Name: ${showContext.showName}
• Location: ${showContext.location}
• Date: ${showContext.date}
• Season Day: ${reportDay}
═══════════════════════════════════════════════════════════════

STATISTICAL ANALYSIS from ${showContext.showName} on ${showContext.date}:

═══════════════════════════════════════════════════════════════
MOMENTUM INDICATORS (Single-Day Movement)
═══════════════════════════════════════════════════════════════
SURGING (>0.1 point gain from yesterday):
${bigGainers.length > 0 ? bigGainers.map(([c, t]) => `• ${c}: +${t.dayChange.toFixed(3)} (latest: ${t.latestTotal?.toFixed(3) || 'N/A'})`).join('\n') : '• No corps gained >0.1 points today'}

COOLING OFF (>0.1 point drop from yesterday):
${bigLosers.length > 0 ? bigLosers.map(([c, t]) => `• ${c}: ${t.dayChange.toFixed(3)} (latest: ${t.latestTotal?.toFixed(3) || 'N/A'})`).join('\n') : '• No corps dropped >0.1 points today'}

═══════════════════════════════════════════════════════════════
7-DAY TREND ANALYSIS (Performance vs. Weekly Average)
═══════════════════════════════════════════════════════════════
OUTPERFORMING THEIR AVERAGE:
${trendLeaders.map(([c, t]) => `• ${c}: +${t.trendFromAvg.toFixed(3)} above 7-day avg (avg: ${t.avgTotal.toFixed(3)})`).join('\n')}

UNDERPERFORMING THEIR AVERAGE:
${trendLaggers.map(([c, t]) => `• ${c}: ${t.trendFromAvg.toFixed(3)} below 7-day avg (avg: ${t.avgTotal.toFixed(3)})`).join('\n')}

═══════════════════════════════════════════════════════════════
FIELD STATISTICS
═══════════════════════════════════════════════════════════════
• Total corps in standings: ${dayScores.length}
• Average score: ${avgScore}
• Score spread (1st to last): ${scoreSpread} points
• Top score: ${totalScores.length > 0 ? Math.max(...totalScores).toFixed(3) : 'N/A'}
• Median score: ${totalScores.length > 0 ? totalScores.sort((a, b) => a - b)[Math.floor(totalScores.length / 2)].toFixed(3) : 'N/A'}

═══════════════════════════════════════════════════════════════
CAPTION EXCELLENCE BY CATEGORY
═══════════════════════════════════════════════════════════════
${captionLeaders.slice(0, 6).map(c => `• ${c.caption}: ${c.leader} (${c.score.toFixed(2)}) [trend: ${c.weeklyTrend}]`).join('\n')}

WRITE A DATA-DRIVEN ANALYTICAL ARTICLE:

1. HEADLINE: Statistical insight headline. Examples: "Momentum Math: Crown's 7-Day Trend Points to Finals Surge", "By The Numbers: Score Compression Signals Tighter Championships", "Analytics Deep Dive: Which Corps Are Peaking at the Right Time?"

2. SUMMARY: 2-3 sentences with the most important statistical finding of the day. Lead with data.

3. NARRATIVE: A 4-5 paragraph deep analysis that:
   - Opens with the key statistical story (momentum shift, trend reversal, or trajectory confirmation)
   - Provides regression analysis: Are top corps maintaining trajectory? Are mid-pack corps closing the gap?
   - Analyzes caption-specific trends: Which captions are separating corps? Where are the battles closest?
   - Discusses fantasy implications: Which DCI corps are trending in ways that affect fantasy value?
   - Concludes with predictive insights: Based on current trajectories, what should we expect?

4. INSIGHTS: 3-5 specific statistical findings with their implications.

5. RECOMMENDATIONS: Fantasy strategy tips based on corps trends (NOT specific lineup picks - those are confidential).

CRITICAL RULES:
- This is STATISTICAL ANALYSIS, not opinion - lead with numbers
- Reference specific corps and their trajectories
- Explain WHY trends matter (e.g., "Crown's +0.35 over 7 days suggests design changes are being absorbed")
- Fantasy recommendations should focus on which DCI CORPS are valuable, NOT individual director strategies
- NEVER reveal or speculate about any director's specific caption picks
- Write like FiveThirtyEight or The Athletic - data-first journalism

Return ONLY valid JSON:
{
  "headline": "string",
  "summary": "string",
  "narrative": "string",
  "insights": [{"metric": "What was measured", "finding": "What the data shows", "implication": "What it means for the competition"}],
  "recommendations": [{"corps": "DCI Corps Name", "action": "buy/hold/sell", "reasoning": "Data-backed reasoning"}]
}`;

  try {
    const result = await textModel.generateContent(prompt);
    const content = parseAiJson(result.response.text());

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

/**
 * Fetch show context (event name, location, actual date) for articles
 * Pulls from historical_scores and season schedule to get full context
 */
async function fetchShowContext(db, seasonId, historicalData, reportDay) {
  try {
    // 1. Try to get event info from historical_scores first (most accurate)
    let showName = null;
    let location = null;
    let eventDate = null;

    for (const yearKey of Object.keys(historicalData)) {
      const yearEvents = historicalData[yearKey] || [];
      const dayEvent = yearEvents.find(e => e.offSeasonDay === reportDay);
      if (dayEvent) {
        showName = dayEvent.eventName || showName;
        location = dayEvent.location || location;
        eventDate = dayEvent.date || dayEvent.eventDate || eventDate;
        if (showName && location) break;
      }
    }

    // 2. Try to get from season schedule if not found
    if (!showName || !location) {
      try {
        const scheduleDoc = await db.doc(`seasons/${seasonId}/schedule/day_${reportDay}`).get();
        if (scheduleDoc.exists) {
          const scheduleData = scheduleDoc.data();
          const shows = scheduleData.shows || [];
          if (shows.length > 0) {
            showName = showName || shows[0].eventName || shows[0].name;
            location = location || shows[0].location;
            eventDate = eventDate || shows[0].date;
          }
        }
      } catch (scheduleError) {
        logger.warn("Could not fetch schedule:", scheduleError.message);
      }
    }

    // 3. Calculate actual date from season start + day number
    let actualDate = null;
    try {
      const seasonDoc = await db.doc(`seasons/${seasonId}`).get();
      if (seasonDoc.exists) {
        const seasonData = seasonDoc.data();
        const startDate = seasonData.startDate?.toDate?.() || seasonData.startDate;
        if (startDate) {
          actualDate = new Date(startDate);
          actualDate.setDate(actualDate.getDate() + reportDay - 1);
        }
      }
    } catch (seasonError) {
      logger.warn("Could not fetch season for date calculation:", seasonError.message);
    }

    // Format the actual date nicely
    const formattedDate = actualDate
      ? actualDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
      : eventDate
        ? new Date(eventDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
        : `Day ${reportDay}`;

    return {
      showName: showName || `Day ${reportDay} Competition`,
      location: location || "Competition Venue",
      date: formattedDate,
      rawDate: actualDate || (eventDate ? new Date(eventDate) : null),
      reportDay,
    };
  } catch (error) {
    logger.error("Error fetching show context:", error);
    return {
      showName: `Day ${reportDay} Competition`,
      location: "Competition Venue",
      date: `Day ${reportDay}`,
      rawDate: null,
      reportDay,
    };
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

    const prompt = `You are a sports journalist for marching.art, a FANTASY SPORTS platform for DCI (Drum Corps International) marching band competitions.

This is like fantasy football, but for drum corps. Users create fantasy ensembles by drafting real DCI corps to earn points based on actual competition scores.

Write a Day ${offSeasonDay} fantasy sports recap article for these top-performing user ensembles:

TOP FANTASY ENSEMBLES (user-created teams):
${topPerformers.map((r, i) => `${i + 1}. "${r.corpsName}" (Director: ${r.directorName || 'Anonymous'}): ${r.totalScore.toFixed(3)} fantasy points`).join('\n')}

Write like ESPN fantasy sports coverage. Focus on:
- Which fantasy ensembles scored the most points
- Celebrate the top directors' success
- General strategy tips (without revealing specific lineup picks)

IMPORTANT: Do NOT mention RPGs, video games, or fictional fantasy worlds. This is SPORTS fantasy like fantasy football.
All "corps" names above are user-created fantasy team names, not real DCI corps.

Return JSON with these EXACT string fields:
{
  "headline": "string - exciting sports headline about Day ${offSeasonDay} fantasy results",
  "summary": "string - 2-3 sentence summary of fantasy sports results",
  "narrative": "string - full article text about fantasy sports performance",
  "fantasyImpact": "string - brief tip for fantasy players",
  "trendingCorps": ["string array of top 3 performing fantasy team names"]
}`;

    const result = await textModel.generateContent(prompt);
    return { success: true, content: parseAiJson(result.response.text()) };
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
