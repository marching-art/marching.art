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

// Consolidated to single @google/genai SDK (removes duplicate @google/generative-ai)
// Type replaces SchemaType for JSON schema definitions
const { GoogleGenAI, Type } = require("@google/genai");
const { logger } = require("firebase-functions/v2");
const { defineSecret } = require("firebase-functions/params");
const { uploadFromUrl, getContextualPlaceholder } = require("./mediaService");
const {
  DCI_UNIFORMS,
  FANTASY_THEMES,
  getUniformDetails,
  getUniformDetailsFromFirestore,
  getShowTitleFromFirestore,
  interpretShowTheme,
  buildShowThemeContext,
  getFantasyUniformDetails,
} = require("./newsUniforms");
const { getTrendNarrative } = require("./newsNarratives");
const {
  buildCorpsAvatarPrompt,
  buildArticleImagePrompt,
  buildStandingsImagePrompt,
  buildCaptionsImagePrompt,
  buildFantasyPerformersImagePrompt,
  buildFantasyLeagueImagePrompt,
  buildAnalyticsImagePrompt,
  buildUnderdogImagePrompt,
  buildCorpsSpotlightImagePrompt,
} = require("./newsImagePrompts");
const {
  analyzeCompetitionContext,
  getToneGuidance,
  getToneDescriptor,
  getWritingVariety,
  buildEditorialBrief,
  formatBriefForArticle,
} = require("./newsEditorial");
const {
  CAPTIONS,
  fetchActiveCorps,
  fetchTimeLockednScores,
  fetchFantasyRecaps,
  fetchShowContext,
  calculateTotal,
  calculateCaptionSubtotals,
  getScoresForDay,
  calculateTrendData,
  identifyCaptionLeaders,
} = require("./newsData");
const {
  parseAiJson,
  detectBannedPhrases,
  detectHallucinatedCorps,
  detectUnsourcedNumbers,
  extractDataBlockNumbers,
} = require("./newsValidation");

// Define Gemini API key secret
const geminiApiKey = defineSecret("GOOGLE_GENERATIVE_AI_API_KEY");

// Initialize client (lazy loaded) - single unified SDK for text and image generation
let genAI = null;


// =============================================================================
// CONSTANTS
// =============================================================================

const ARTICLE_TYPES = {
  // The 5 daily articles - aligned with DCI.org style
  DCI_DAILY: "dci_daily",             // Article 1: DCI scores analysis from the day (with score breakdown)
  DCI_FEATURE: "dci_feature",         // Article 2: DCI feature on a single corps and their season progress
  DCI_RECAP: "dci_recap",             // Article 3: DCI caption deep-dive (GE, Visual, Music) — descriptive, not prescriptive
  FANTASY_DAILY: "fantasy_daily",     // Article 5: marching.art results from the day (generated last → top of feed)
  FANTASY_RECAP: "fantasy_recap",     // Article 4: Fantasy Market Report — owns buy/hold/sell picks exclusively
};

/**
 * Format event name for fantasy articles - replaces 'DCI' with 'marching.art'
 * This keeps branding consistent since fantasy competitions are on marching.art platform
 */
function formatFantasyEventName(name) {
  if (!name) return "";
  return name.replace(/\bDCI\b/g, "marching.art");
}

// =============================================================================
// COVERAGE LEDGER
// -----------------------------------------------------------------------------
// Tracks what subjects, numbers, and hooks have already been used across tonight's
// five-article batch so later articles can be given "negative space" — an explicit
// instruction to find a different angle from what's already been published that
// evening. Without this, every article tends to lead with the same top corps and
// the same highlighted numbers, making the batch feel like five framings of one
// story rather than five distinct stories.
// =============================================================================

/**
 * Create an empty ledger. Pass this into each generator, then call record() after
 * each article is generated so subsequent articles see what came before.
 */
function createCoverageLedger() {
  return {
    spotlitSubjects: new Set(),  // Corps and fantasy-ensemble names that headlined prior articles
    dciCorps: new Set(),         // Subset of spotlitSubjects limited to real DCI corps (used for image-selection fallback)
    featuredNumbers: new Set(),  // Numeric strings (e.g., "77.850", "1.900") extracted from prior headlines + summaries
    priorHeadlines: [],          // [{ type, headline, featuredCorps }]

    record(article) {
      if (!article) return;
      const subject = article.featuredCorps || article.featuredPerformer || null;
      if (subject) {
        this.spotlitSubjects.add(subject);
        if (article.featuredCorps) this.dciCorps.add(article.featuredCorps);
      }
      const text = `${article.headline || ""} ${article.summary || ""}`;
      const numMatches = text.match(/-?\d+\.\d{2,3}/g) || [];
      numMatches.forEach(n => this.featuredNumbers.add(n));
      this.priorHeadlines.push({
        type: article.type,
        headline: article.headline || "",
        featuredCorps: subject,
      });
    },
  };
}

/**
 * Render the ledger into a prompt-ready "negative space" block. Callers inject the
 * returned string into the Gemini prompt for each article after the first. Returns
 * empty string on an empty ledger so Article 1 gets no special instruction.
 *
 * The phrasing is a strong recommendation, not a hard rule: on small-field days
 * a later article may legitimately need to reference a corps already spotlit, in
 * which case it should find a genuinely different facet rather than re-pitching
 * the same hook.
 */
function formatNegativeSpace(ledger) {
  if (!ledger || ledger.priorHeadlines.length === 0) return "";

  const subjects = Array.from(ledger.spotlitSubjects);
  const numbers = Array.from(ledger.featuredNumbers);
  const headlinesList = ledger.priorHeadlines
    .map(h => `  • [${h.type}] "${h.headline}"`)
    .join("\n");

  return `
NEGATIVE SPACE — already covered earlier in tonight's 5-article batch
The articles listed below have already been published tonight. Your piece is part
of the same batch, so readers will see all of them together. Your job is to add a
NEW story, not a new framing of an existing one.

Subjects already headlined: ${subjects.length > 0 ? subjects.join(", ") : "(none)"}
Numbers already featured in prior headlines or summaries: ${numbers.length > 0 ? numbers.join(", ") : "(none)"}
Prior headlines tonight:
${headlinesList}

RULES
- Your headline and summary must not be about the same subject, number, or hook as any prior article. Pick a different angle.
- You may reference the subjects or numbers above in the body where it serves the analysis, but they must not be your lead.
- If the field is so small that you must discuss a subject already spotlit, find a genuinely different facet of them — a sub-caption detail, a week-over-week trajectory, a supporting role in a different corps' story — not the same moment that already ran.
- The five articles together should feel like five distinct stories about tonight, not five retellings of one story.
`;
}

// =============================================================================
// GEMINI INITIALIZATION
// =============================================================================

function initializeGemini() {
  if (!genAI) {
    const apiKey = geminiApiKey.value();
    if (!apiKey) {
      throw new Error("GOOGLE_GENERATIVE_AI_API_KEY secret is not set");
    }
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
}

/**
 * Generate content with structured JSON output
 * Uses Gemini's native JSON mode for guaranteed valid JSON
 */
async function generateStructuredContent(prompt, schema) {
  const ai = initializeGemini();

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  });

  const text = response.text;

  // Even with structured output, still use parseAiJson for safety
  return parseAiJson(text);
}

// =============================================================================
// POST-GEN FACT CHECK & STYLE GUARD
// -----------------------------------------------------------------------------
// After generation, scan the article for two categories of issues and retry
// once if any appear:
//
//   1. BANNED PHRASES — clichéd AI-sportswriter idioms ("mid-season phase",
//      "upward trend", "heating up", "captivating", "testament"...) that
//      Gemini produces despite soft prompt-level banned-phrase lists.
//
//   2. UNSOURCED NUMBERS — every decimal number in the article must appear
//      (within ±0.005) in the prompt's DATA block. Catches hallucinated
//      scores, invented margins, and bogus averages.
//
// Both checks feed into one combined retry with an intensified constraint
// block; after the retry the article ships regardless — the cost of a second
// retry doesn't beat the marginal quality lift, and a flagged article is
// still better than a fallback. Failures log at warn level so they're
// visible in the function logs without crashing the batch.
// =============================================================================


/**
 * Wraps generateStructuredContent with banned-phrase + number-source checks
 * and a single combined retry on any issue. Ships after the retry regardless;
 * never throws on validator failure.
 */
async function generateWithFactCheckGuard(prompt, schema, options = {}) {
  const { articleType = "unknown", fieldCorpsNames = null } = options;
  const dataNumbers = extractDataBlockNumbers(prompt);

  const firstAttempt = await generateStructuredContent(prompt, schema);
  const firstBanned = detectBannedPhrases(firstAttempt);
  const firstUnsourced = detectUnsourcedNumbers(firstAttempt, dataNumbers);
  const firstHallucinated = detectHallucinatedCorps(firstAttempt, fieldCorpsNames);

  if (firstBanned.length === 0 && firstUnsourced.length === 0 && firstHallucinated.length === 0) {
    return firstAttempt;
  }

  const issues = [];
  if (firstBanned.length > 0) issues.push(`banned phrases: ${firstBanned.join(", ")}`);
  if (firstUnsourced.length > 0) issues.push(`unsourced numbers: ${firstUnsourced.join(", ")}`);
  if (firstHallucinated.length > 0) issues.push(`hallucinated corps: ${firstHallucinated.join(", ")}`);
  logger.warn(`[${articleType}] fact-check issues on first attempt — ${issues.join(" | ")} — retrying once`);

  const retryInstructions = [
    firstBanned.length > 0
      ? `BANNED PHRASES that appeared in your previous draft: ${firstBanned.map(h => `"${h}"`).join(", ")}. Rewrite without any of those phrases or their obvious synonyms.`
      : null,
    firstUnsourced.length > 0
      ? `UNSOURCED NUMBERS that appeared in your previous draft: ${firstUnsourced.map(n => `"${n}"`).join(", ")}. These numbers do not appear in the DATA block. Every decimal number you cite MUST come from the DATA block, either verbatim or as a rounding of a value that's there (e.g., DATA shows 77.850 — you may cite 77.85 or 77.9 but not 78.2). Do NOT compute averages. Do NOT invent scores, margins, or deltas. Do NOT cite a number you cannot point to in the DATA block.`
      : null,
    firstHallucinated.length > 0
      ? `HALLUCINATED CORPS that appeared in your previous draft: ${firstHallucinated.map(c => `"${c}"`).join(", ")}. These corps are not in tonight's field. Only reference corps that appear in the DATA block for this article; never pull in corps from general DCI knowledge that aren't competing tonight.`
      : null,
  ].filter(Boolean).join("\n\n");

  const stricterPrompt = `${prompt}

YOUR PREVIOUS DRAFT HAS ISSUES AND MUST BE REWRITTEN.

${retryInstructions}

Rewrite the entire article. Every other requirement in this prompt still applies.`;

  const secondAttempt = await generateStructuredContent(stricterPrompt, schema);
  const secondBanned = detectBannedPhrases(secondAttempt);
  const secondUnsourced = detectUnsourcedNumbers(secondAttempt, dataNumbers);
  const secondHallucinated = detectHallucinatedCorps(secondAttempt, fieldCorpsNames);
  if (secondBanned.length > 0 || secondUnsourced.length > 0 || secondHallucinated.length > 0) {
    const remaining = [];
    if (secondBanned.length > 0) remaining.push(`banned phrases: ${secondBanned.join(", ")}`);
    if (secondUnsourced.length > 0) remaining.push(`unsourced numbers: ${secondUnsourced.join(", ")}`);
    if (secondHallucinated.length > 0) remaining.push(`hallucinated corps: ${secondHallucinated.join(", ")}`);
    logger.warn(`[${articleType}] issues leaked through retry — ${remaining.join(" | ")} — shipping anyway`);
  }
  return secondAttempt;
}

// =============================================================================
// IMAGE GENERATION
// =============================================================================

// Configuration: when true use the paid, highest-fidelity image model; when
// false fall back to the free Gemini 2.5 Flash Image model (500 RPD free tier).
const USE_PAID_IMAGE_GEN = true;

// Image model ids (both are Gemini image models driven through generateContent).
// PAID: Gemini 3 Pro Image ("Nano Banana Pro") — Google's SOTA image model
//   (~$0.134/image). Unlike Imagen it accepts reference images as input, which we
//   will use to ground corps uniforms/instrumentation in real photos.
// FREE: Gemini 2.5 Flash Image ("Nano Banana") — free-tier fallback.
const PAID_IMAGE_MODEL = "gemini-3-pro-image";
const FREE_IMAGE_MODEL = "gemini-2.5-flash-image";

// =============================================================================
// DRUM CORPS VISUAL IDENTITY - System context for accurate image generation
// This ensures AI models understand what drum corps looks like vs concerts
// =============================================================================

/**
 * Comprehensive visual definition of drum and bugle corps for AI image generation.
 * This context helps distinguish DCI/drum corps from rock concerts, marching bands, etc.
 */
const DRUM_CORPS_VISUAL_CONTEXT = `
CRITICAL CONTEXT - DRUM AND BUGLE CORPS (NOT A CONCERT):

This is DCI (Drum Corps International) - competitive marching arts performed on football fields.

CRITICAL RULE - ONE INSTRUMENT PER PERFORMER:
Each performer carries ONLY ONE type of equipment. A performer is EITHER:
- A BRASS player (holding a brass instrument like trumpet, mellophone, baritone, or contra) - OR -
- A PERCUSSIONIST (wearing a drum on a harness - snare, tenors, or bass drum) - OR -
- A COLOR GUARD member (holding a flag, rifle, or sabre)
NEVER show a performer with multiple equipment types. A brass player does NOT have drums.
A drummer does NOT hold a brass instrument. This is physically impossible.

WHAT MODERN DCI PERFORMERS LOOK LIKE:
- UNIFORMS: Modern athletic uniforms, NOT traditional military style. Contemporary designs with:
  - Bold colors, geometric patterns, flame designs, sparkles, metallic accents
  - Fitted athletic cut, often asymmetric or avant-garde styling
  - Corps-specific colors and design themes matching their show
- HEADWEAR: Most modern corps have NO headwear or minimal headwear.
  Traditional shakos with plumes are rare. Some corps use modern caps or helmets.
  Only include headwear if specifically described in the uniform details.
- GLOVES: White marching gloves on all performers.
- BRASS PLAYERS: Hold brass instruments (mellophones, baritones, contras, trumpets).
  Silver instruments are most common. NO woodwinds, NO electric guitars.
- PERCUSSIONISTS: Wear drums on body harnesses (snare drums, tenor drums/quads, bass drums).
  Drums often have colorful wraps matching corps colors. They hold drumsticks, NOT brass.
- COLOR GUARD: Athletic costumes (not uniforms), 6-foot silk flags, rifles, sabres.

PHOTOGRAPHY STYLE:
- Intimate, close-up photojournalism shot from field level or low angle
- 2-8 performers in tight framing, filling the entire frame
- Shallow depth of field: sharp focus on performers, stadium and crowd blurred into soft bokeh behind
- Eye-level or slightly below eye-level camera position, as if standing ON the field with performers
- Captures raw emotion: intense facial expressions, open mouths playing/singing, sweat, passion
- Uniform textures, sequins, metallic accents, and instrument details clearly visible
- Dynamic action frozen mid-performance: horns snapping up, flags mid-toss, sticks mid-strike
- Stadium lights visible as soft bokeh orbs or starburst effects in blurred background
- Editorial photojournalism quality, like a Sports Illustrated or DCI.org feature photograph

THIS IS NOT:
- A rock concert, pop concert, or music festival
- Musicians in casual clothes, t-shirts, or concert black
- An orchestra or symphony
- A parade marching band with traditional military uniforms
`;

/**
 * Negative prompt elements to explicitly exclude concert/rock imagery
 */
const IMAGE_NEGATIVE_PROMPT = `

MUST AVOID (these will make the image incorrect):
- Performers holding multiple instruments (a drummer cannot also play trumpet)
- Brass players with drums attached - this is physically impossible
- Traditional military band uniforms with brass buttons and epaulettes (unless specified)
- Tall shakos with feather plumes (unless specifically described in uniform details)
- Old-fashioned marching band aesthetics
- Concert stages, rock concerts, pop concerts, music festivals
- Mosh pits, crowd surfing, standing concert crowds
- Stage lighting rigs, concert spotlights pointed at a stage
- Electric guitars, drum kits on stage, microphone stands
- Casual clothing, t-shirts, jeans on performers
- Indoor concert venues, clubs, bars
- Smoke machines, laser shows (unless specifically requested)
- Orchestra pits, symphony halls
- Wide-angle shots showing 50+ performers or the full corps
- Aerial, drone, or press box perspectives
- Broadcast-style coverage angles
- Full-field formation views
- Distant shots where faces are not visible
`;


/**
 * Generate an image using the Gemini image models (Nano Banana family).
 * Paid tier uses Gemini 3 Pro Image (Nano Banana Pro); free tier uses
 * Gemini 2.5 Flash Image. Automatically prepends drum corps visual context to
 * ensure accurate imagery, and can ground the result in real reference photos.
 *
 * @param {string} prompt - Detailed image prompt
 * @param {Object} options - Optional configuration
 * @param {string} options.model - Override the default model id
 * @param {string} options.aspectRatio - Output aspect ratio (default: '16:9')
 * @param {Array<{data: string, mimeType: string}>} options.referenceImages -
 *   Optional reference images (base64 data without the data: prefix) used to
 *   ground uniform/instrumentation in real photos.
 * @returns {Promise<string>} Base64 data URL of the generated image, or null
 */
async function generateImageWithImagen(prompt, options = {}) {
  try {
    // Both tiers now run through the Gemini image models (Nano Banana family) via
    // generateContent. Unlike the previous Imagen/Vertex path, these models accept
    // reference images as input — pass options.referenceImages (array of
    // { data: <base64 without data: prefix>, mimeType }) to ground the uniform and
    // instrumentation in real photos. Caller can still override the model id via
    // options.model.
    const ai = initializeGemini();
    const modelName = options.model || (USE_PAID_IMAGE_GEN ? PAID_IMAGE_MODEL : FREE_IMAGE_MODEL);

    const referenceImages = (options.referenceImages || []).filter(
      (ref) => ref && ref.data && ref.mimeType
    );

    // Critical per-image constraints, appended after the specific prompt. Retained
    // from the prior Imagen path so the model still gets the hard rules up front.
    const fullPrompt = `${prompt}

---
CRITICAL RULES FOR THIS IMAGE:
- This is DCI drum corps on a football field, NOT a rock concert or orchestra
- Each performer holds ONLY ONE instrument type (brass OR drums OR flag - never multiple)
- Use the EXACT uniform colors and details specified above - do not substitute generic designs
- CLOSE-UP ONLY: Show 2-6 performers maximum, filling the frame. Do NOT show the full corps or wide formation.
- FIELD-LEVEL CAMERA: Shoot from eye level on the field, NOT from elevated, aerial, or press box positions.
- SHALLOW DEPTH OF FIELD: Performers in sharp focus, background (stadium, crowd, field) as soft bokeh.
${referenceImages.length > 0 ? "- REFERENCE IMAGES: The attached photo(s) show this corps' actual uniform, colors, and instrumentation. Match the uniform design, helmet/plume, and instrument types in the reference exactly — the references define ground truth, not your priors." : ""}
${IMAGE_NEGATIVE_PROMPT}`;

    // Build system instruction with drum corps context
    const systemInstruction = `${DRUM_CORPS_VISUAL_CONTEXT}

${IMAGE_NEGATIVE_PROMPT}

You are an expert drum corps photojournalist. Generate intimate, close-up, field-level photographs of DCI drum corps performers as described above. Always use shallow depth of field, show only 2-6 performers filling the frame, and capture raw emotion and detail.`;

    // Multimodal request: prompt text plus any reference images.
    const parts = [{ text: fullPrompt }];
    for (const ref of referenceImages) {
      parts.push({ inlineData: { mimeType: ref.mimeType, data: ref.data } });
    }

    // Retry logic for quota limits (429 errors)
    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 15000; // 15 seconds between retries

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [{ role: "user", parts }],
          config: {
            responseModalities: ["image", "text"],
            systemInstruction,
            imageConfig: {
              aspectRatio: options.aspectRatio || "16:9",
            },
          },
        });

        // Extract image from response parts
        const responseParts = response.candidates?.[0]?.content?.parts || [];
        for (const part of responseParts) {
          if (part.inlineData?.data) {
            const mimeType = part.inlineData.mimeType || "image/png";
            logger.info(`Image generated successfully using ${modelName}${referenceImages.length > 0 ? ` (${referenceImages.length} reference image(s))` : ""}`);
            return `data:${mimeType};base64,${part.inlineData.data}`;
          }
        }
        break; // No image but no error, exit retry loop
      } catch (error) {
        // Check if it's a quota error (429 RESOURCE_EXHAUSTED)
        if (error.status === 429 && attempt < MAX_RETRIES) {
          logger.warn(
            `Quota limit hit (429). Waiting ${RETRY_DELAY_MS / 1000}s before retry ${attempt}/${MAX_RETRIES}...`
          );
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        } else {
          // Not a quota error or max retries reached, re-throw
          throw error;
        }
      }
    }

    logger.warn("No image generated, using placeholder");
    return null;
  } catch (error) {
    logger.error("Image generation failed:", error);
    return null;
  }
}




// =============================================================================
// ARTICLE GENERATION
// =============================================================================

/**
 * Generate 5 nightly articles aligned with DCI.org editorial style
 *
 * The 5 daily articles:
 * 1. DCI Scores Analysis - Competition results with DCI.org-style score breakdown
 * 2. DCI Corps Feature - In-depth feature on one corps' season progress
 * 3. DCI Weekly Recap - Deep dive on GE, Visual, and Music trends over the last week
 * 4. marching.art Results - Fantasy competition results from the day
 * 5. marching.art Caption Analysis - Fantasy caption trends in GE, Visual, Music
 */
async function generateAllArticles({ db, dataDocId, seasonId, currentDay, onArticleGenerated }) {
  const reportDay = currentDay - 1;

  if (reportDay < 1) {
    return { success: false, error: "Invalid day" };
  }

  // LIVE vs OFF-SEASON sourcing.
  // Off-season corps are drawn from many different prior years (each carries its
  // own sourceYear), so articles disclose that program material and read scores
  // from historical_scores/{sourceYear}.
  // A LIVE season is different: the roster is seeded from last year's final
  // rankings (every corps therefore carries sourceYear = previousYear), but the
  // actual competition is the REAL, current-year DCI season — scraped nightly
  // into historical_scores/{currentYear}. Articles must report those
  // current-year events and scores, not the prior year the roster was picked
  // from, so we resolve every corps against the current competition year.
  // Live season ids are minted as `live_YYYY-YY` (see startNewLiveSeason);
  // off-season ids use thematic names (e.g. `spring_2025-26`).
  const isLiveSeason = typeof seasonId === "string" && seasonId.startsWith("live_");
  const currentSeasonYear = String(new Date().getFullYear());

  logger.info(`Generating 5 daily articles for Day ${reportDay} (DCI.org style)${isLiveSeason ? ` [LIVE — sourcing ${currentSeasonYear} scores]` : ""}`);

  try {
    // Fetch all data
    const rawActiveCorps = await fetchActiveCorps(db, dataDocId);
    // In a live season every roster corps competes with current-year material,
    // so override their prior-year sourceYear to the current year. This makes the
    // downstream score/trend/caption/show-context lookups read the scraped
    // current-year data instead of the prior season the roster was selected from.
    const activeCorps = isLiveSeason
      ? rawActiveCorps.map(c => ({ ...c, sourceYear: currentSeasonYear }))
      : rawActiveCorps;
    const yearsToFetch = [...new Set(activeCorps.map(c => c.sourceYear))];
    const historicalData = await fetchTimeLockednScores(db, yearsToFetch, reportDay);
    const fantasyData = await fetchFantasyRecaps(db, seasonId, reportDay);

    // Fetch show context (event name, location, date) - now includes all shows
    const showContext = await fetchShowContext(db, seasonId, historicalData, reportDay);
    logger.info(`Show context for Day ${reportDay}: ${showContext.showName} at ${showContext.location} on ${showContext.date}${showContext.allShows?.length > 1 ? ` (${showContext.allShows.length} shows total)` : ''}`);

    // Process data
    const dayScores = getScoresForDay(historicalData, reportDay, activeCorps);

    // No DCI scores for this day (e.g. a dark night, or scraping hasn't run/landed
    // yet). The DCI-style articles are built entirely from this day's scores, so
    // there's nothing to write — bail cleanly and let the caller fall back to
    // legacy generation instead of crashing on an undefined top/feature corps.
    if (!dayScores || dayScores.length === 0) {
      logger.warn(`No DCI scores found for Day ${reportDay}; skipping DCI-style articles and falling back to legacy.`);
      return { success: false, error: `No DCI scores for day ${reportDay}` };
    }

    const trendData = calculateTrendData(historicalData, reportDay, activeCorps);
    const captionLeaders = identifyCaptionLeaders(dayScores, trendData);

    // Analyze competition context for dynamic tone
    const competitionContext = analyzeCompetitionContext(dayScores, trendData, reportDay);
    const toneDescriptor = getToneDescriptor(competitionContext);
    logger.info(`Competition context for Day ${reportDay}: ${toneDescriptor} (${competitionContext.scenario}, ${competitionContext.seasonPhase} season, lead margin: ${competitionContext.leadMargin})`);

    // Coverage ledger: records what earlier articles have already used so later
    // articles can be given explicit "negative space" instructions. Replaces the
    // previous Set-based exclusion that only covered articles 1–3.
    const ledger = createCoverageLedger();

    // Editorial brief: deterministic pre-pass that assigns each article a
    // pre-computed angle (lead / trajectory / caption / market / fantasy) so
    // the five articles don't all fight over the obvious hook.
    const brief = buildEditorialBrief({ dayScores, trendData, fantasyData, reportDay });
    logger.info(`Editorial brief for Day ${reportDay}: lead=${brief.lead?.subject || 'n/a'} | trajectory=${brief.trajectory?.corps || 'n/a'} | caption=${brief.caption?.family || 'n/a'} | market=${brief.market?.topBuy || 'n/a'}`);

    // Build metadata up front so each article can be persisted the moment it is
    // generated. Image generation is slow (Gemini 3 Pro Image can take minutes per
    // article), so producing all five before saving risks the caller's function
    // timing out with nothing written. Persisting incrementally guarantees that
    // whatever finished before a timeout is still visible on the news feed/admin.
    const metadata = {
      reportDay,
      currentDay,
      corpsCount: dayScores.length,
      showName: showContext.showName,
      location: showContext.location,
      date: showContext.date,
      allShows: showContext.allShows,
      articleCount: 5,
      competitionContext: {
        scenario: competitionContext.scenario,
        seasonPhase: competitionContext.seasonPhase,
        intensity: competitionContext.intensity,
        toneDescriptor,
      },
    };

    const articles = [];

    // Persist an article as soon as it is generated. A save failure is logged but
    // never aborts generation of the remaining articles.
    const persist = async (article) => {
      articles.push(article);
      ledger.record(article);
      if (typeof onArticleGenerated === "function") {
        try {
          await onArticleGenerated(article, { reportDay, currentDay, metadata });
        } catch (saveError) {
          logger.error(`Failed to persist article ${article?.type} for Day ${reportDay}:`, saveError);
        }
      }
    };

    // Article 1: DCI DAILY - Today's competition results with score breakdown
    await persist(await generateDciDailyArticle({
      reportDay, dayScores, trendData, activeCorps, showContext, competitionContext, db, ledger, brief, isLiveSeason
    }));

    // Article 2: DCI FEATURE - Single corps season progress spotlight
    await persist(await generateDciFeatureArticle({
      reportDay, dayScores, trendData, activeCorps, showContext, competitionContext, db, ledger, brief, isLiveSeason
    }));

    // Article 3: DCI RECAP - Pure caption deep-dive (GE, Visual, Music). Descriptive, not prescriptive.
    await persist(await generateDciRecapArticle({
      reportDay, dayScores, trendData, captionLeaders, activeCorps, showContext, competitionContext, db, ledger, brief, isLiveSeason
    }));

    // Article 4: FANTASY MARKET REPORT - Owns buy/hold/sell picks for the day (descriptive caption analysis already done in Article 3).
    await persist(await generateFantasyRecapArticle({
      reportDay, dayScores, trendData, showContext, competitionContext, db, ledger, brief, isLiveSeason
    }));

    // Article 5: FANTASY DAILY - Fantasy competition results with score breakdown (generated last to appear first in feed)
    await persist(await generateFantasyDailyArticle({
      reportDay, fantasyData, showContext, competitionContext, db, dataDocId, ledger
    }));

    return {
      success: true,
      articles,
      metadata: {
        ...metadata,
        articleCount: articles.length,
      },
    };
  } catch (error) {
    logger.error("Error generating articles:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Article 1: DCI Scores Analysis
 * Daily competition results in DCI.org editorial style
 */
async function generateDciDailyArticle({ reportDay, dayScores, trendData, showContext, competitionContext, db, ledger, brief, isLiveSeason }) {
  const topCorps = dayScores[0];

  // Get dynamic tone guidance based on competition context
  const toneGuidance = getToneGuidance(competitionContext, "dci_scores");

  // Group today's corps by the show they actually competed at.
  // Some days have one show; others have multiple, and corps in different shows
  // did NOT compete head-to-head. The prompt must make that distinction clear.
  const scoresByShow = (() => {
    const groups = new Map();
    for (const s of dayScores) {
      const key = s.showName || showContext.showName || `Day ${reportDay} Competition`;
      if (!groups.has(key)) {
        groups.set(key, {
          name: key,
          location: s.location || showContext.location || null,
          scores: [],
        });
      }
      groups.get(key).scores.push(s);
    }
    return Array.from(groups.values()).map(g => ({
      ...g,
      scores: g.scores.sort((a, b) => b.total - a.total),
    }));
  })();

  const multiShow = scoresByShow.length > 1;

  const showBlocks = scoresByShow.map(group => {
    const header = `SHOW: ${group.name}${group.location ? ` — ${group.location}` : ''} (${group.scores.length} corps)`;
    const lines = group.scores.map((s, i) => {
      const trend = trendData[s.corps];
      const change = trend?.dayChange || 0;
      const marginToNext = i > 0 ? (group.scores[i - 1].total - s.total).toFixed(3) : "-";
      const changeStr = trend && Number.isFinite(change)
        ? ` (${change >= 0 ? '+' : ''}${change.toFixed(3)} from yesterday)`
        : '';
      // In a live season every corps performs current-year material, so the
      // source-year tag is meaningless noise — only annotate the year off-season.
      const yearTag = !isLiveSeason && s.sourceYear ? ` [${s.sourceYear}]` : '';
      return `${i + 1}. ${s.corps}${yearTag} - ${s.total.toFixed(3)}${changeStr}${i > 0 ? ` [${marginToNext} behind]` : ' [LEADER]'}
   GE: ${s.subtotals?.ge?.toFixed(2) || 'N/A'} | Visual: ${s.subtotals?.visual?.toFixed(2) || 'N/A'} | Music: ${s.subtotals?.music?.toFixed(2) || 'N/A'}`;
    }).join('\n');
    return `${header}\n${lines}`;
  }).join('\n\n');

  // Caption winners are computed per-show so we don't imply a head-to-head
  // caption race across corps that weren't on the same field.
  const captionWinnersByShow = scoresByShow.map(group => {
    const captions = ['ge', 'visual', 'music'];
    const winners = captions.map(cap => {
      const sorted = [...group.scores].sort((a, b) => (b.subtotals?.[cap] || 0) - (a.subtotals?.[cap] || 0));
      const top = sorted[0];
      if (!top) return null;
      const margin = sorted[1] ? (top.subtotals[cap] - sorted[1].subtotals[cap]).toFixed(2) : "N/A";
      return `• ${cap.toUpperCase()}: ${top.corps} (${top.subtotals[cap]?.toFixed(2)}) — ${margin} over ${sorted[1]?.corps || 'field'}`;
    }).filter(Boolean).join('\n');
    return `${group.name}:\n${winners}`;
  }).join('\n\n');

  // Day-over-day movers across the whole field (identity by corps name is fine;
  // a corps only competes at one show on a given day).
  const surgingLines = Object.entries(trendData).filter(([_, t]) => t.dayChange > 0.3);
  const strugglingLines = Object.entries(trendData).filter(([_, t]) => t.dayChange < -0.3);
  const moversBlock = [
    surgingLines.length > 0 ? `- Biggest gains: ${surgingLines.map(([c, t]) => `${c} (+${t.dayChange.toFixed(3)})`).join(', ')}` : null,
    strugglingLines.length > 0 ? `- Score drops: ${strugglingLines.map(([c, t]) => `${c} (${t.dayChange.toFixed(3)})`).join(', ')}` : null,
  ].filter(Boolean).join('\n');

  const corpsRoster = dayScores.map(s => s.corps).join(', ');

  // Get today's narrative variety to keep articles from feeling templated
  const variety = getWritingVariety(reportDay, "dci_daily");

  // In a live season every corps' sourceYear has been resolved to the current
  // competition year upstream, so it doubles as the season label for the prompt.
  const liveSeasonYear = isLiveSeason
    ? (dayScores.find(s => s.sourceYear)?.sourceYear || String(new Date().getFullYear()))
    : null;

  const prompt = `You are a DCI.org staff writer covering tonight's competitions. Write a genuine article — not a template with blanks filled in. Every night's story is different because every night's scores tell a different story. Find that story.

ACCURACY RULES (read first — violations ruin the article)
- Every corps name, score, caption number, show name, and location you write MUST come from the DATA block below. Do not invent corps, venues, cities, dates, or statistics.
- Only the corps listed in CORPS COMPETING TONIGHT exist in this article. Do not reference any corps not in that list.
- The field tonight has ${dayScores.length} corps — never state any other count, and never imply corps not listed were present.
${multiShow ? `- There are ${scoresByShow.length} separate competitions tonight at different venues. Corps at different shows did NOT compete against each other. Never imply a head-to-head result between corps that weren't at the same show. When you cite a score or placement, make the show clear from context.` : `- All corps tonight competed at a single show: ${scoresByShow[0]?.name}${scoresByShow[0]?.location ? ` in ${scoresByShow[0].location}` : ''}.`}
${isLiveSeason
  ? `- This is the ${liveSeasonYear} live DCI season. Write about THIS season's competitions and scores as they happen now — do NOT reference a prior year's program material or tag corps with a past season year.`
  : `- Source-year disclosure: on each corps' FIRST mention in the narrative, include their source-year in parentheses — e.g., "Blue Stars (2019)" — so fantasy readers know which season's program material the corps is performing. Every corps in the DATA block has a listed sourceYear; use it. After the first mention, the year can be omitted.`}
- If a data point you want to reference isn't in the DATA block, leave it out. Do not fill gaps with plausible-sounding invention.

VOICE & STYLE
Study how DCI.org actually writes:
- "Boom." (punchy one-word opener)
- "INDIANAPOLIS — A mere 0.175-point gap separates first and second."
- "After trailing by 0.175 points Thursday, Bluecoats gained a lead of 0.188 points Friday."
- "Less than half a point separated The Cavaliers, Blue Stars, and Troopers — three corps who have been neck-and-neck throughout the season."

Lead with specific facts, stay concise, let the numbers carry the weight. No hype words. No exclamation points. The drama is in the data.

Score language should be precise: "edging past by 0.087" / "three-tenths back" / "a scant 0.2-point gap" / "swept every caption except Color Guard"
Caption terminology: GE (GE1 Music Effect + GE2 Visual Effect), Visual (VP, VA, CG), Music (B, MA, P)

BANNED PHRASES (AI tells): dominant, commanding, stellar, stunning, thrilling, incredible, captivating, testament, mettle, besting, heating up, setting the stage, all eyes on, force to be reckoned with, proves their mettle, tune in tomorrow, stay tuned, momentum is building, final showdown, critical juncture, dynasty in the making, echoes still resonate, poured their hearts into, leaving spectators on edge, within striking distance, absolutely crucial, emerging as a true contender

===== DATA =====
Day ${reportDay} — ${showContext.date}

CORPS COMPETING TONIGHT (${dayScores.length}): ${corpsRoster}

${multiShow ? `TONIGHT'S SHOWS (${scoresByShow.length}):` : `TONIGHT'S SHOW:`}
${scoresByShow.map(g => `- ${g.name}${g.location ? ` — ${g.location}` : ''} (${g.scores.length} corps)`).join('\n')}

RESULTS BY SHOW
${showBlocks}

CAPTION WINNERS (per show):
${captionWinnersByShow}

DAY-OVER-DAY MOVERS${moversBlock ? '' : ': none of note'}
${moversBlock}

POSITION BATTLES: ${competitionContext.positionBattleCount} corps within 0.2 of the position directly ahead of them.
===== END DATA =====

${toneGuidance}
${formatNegativeSpace(ledger)}
${formatBriefForArticle(brief, 'dci_daily')}
TONIGHT'S NARRATIVE APPROACH
Opening: ${variety.opening}
Angle: ${variety.angle}
Structure: ${variety.structure}

HOW TO WRITE THIS ARTICLE
- Headline: Specific and factual. No exclamation points. Reference an actual margin, score, or storyline from the data.
- Summary: 2-3 factual sentences — key result, the margin, and one specific storyline${multiShow ? '. If the night had multiple shows, make that clear in the summary' : ''}.
- Narrative: 600-900 words. Every scoring corps should appear by name at least once, but let significance drive the emphasis — don't pad coverage to hit a checklist, and don't march through rank order unless that's genuinely the best frame.
${multiShow ? `- Cover all ${scoresByShow.length} shows by name. For each score or placement you cite, make the show clear (via dateline, a phrase like "at [Show]", or section framing). Readers should never be confused about which corps competed where.` : `- This is a single-show night — ground the article in ${scoresByShow[0]?.name}${scoresByShow[0]?.location ? ` (${scoresByShow[0].location})` : ''} and treat the standings as one field.`}
- Weave day-over-day changes and caption details where they're relevant; don't break them out as obligatory sections.
- Close with a specific, grounded observation — a number, a trend, a question the next show will answer. No "tune in tomorrow" sign-offs.

Write like you've covered this beat for years. Let the scores drive the story.`;


  // Schema for structured output
  const schema = {
    type: Type.OBJECT,
    properties: {
      headline: { type: Type.STRING, description: "Factual headline grounded in tonight's actual results. No exclamation points, no 'dominates' or 'stunning', no invented facts." },
      summary: { type: Type.STRING, description: "2-3 factual sentences. When multiple shows occurred, make that clear. Only use corps, scores, and venues from the DATA block." },
      narrative: { type: Type.STRING, description: "600-900 word article. Every scoring corps appears by name at least once; emphasis follows significance, not checklist. When there are multiple shows, make the venue split clear for every score cited. Never invent corps, venues, or statistics. Never use 'dominant', 'commanding', 'heating up', 'besting'." },
      standings: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            rank: { type: Type.INTEGER },
            corps: { type: Type.STRING },
            year: { type: Type.INTEGER },
            total: { type: Type.NUMBER },
            change: { type: Type.NUMBER },
            momentum: { type: Type.STRING, enum: ["rising", "falling", "steady"] },
          },
          required: ["rank", "corps", "year", "total", "change", "momentum"],
        },
      },
      scoreBreakdown: {
        type: Type.OBJECT,
        description: "Caption score breakdown for top corps",
        properties: {
          geWinner: { type: Type.STRING, description: "Corps that won GE caption" },
          geScore: { type: Type.NUMBER, description: "Winning GE score" },
          visualWinner: { type: Type.STRING, description: "Corps that won Visual caption" },
          visualScore: { type: Type.NUMBER, description: "Winning Visual score" },
          musicWinner: { type: Type.STRING, description: "Corps that won Music caption" },
          musicScore: { type: Type.NUMBER, description: "Winning Music score" },
        },
        required: ["geWinner", "geScore", "visualWinner", "visualScore", "musicWinner", "musicScore"],
      },
    },
    required: ["headline", "summary", "narrative", "standings", "scoreBreakdown"],
  };

  try {
    const content = await generateWithFactCheckGuard(prompt, schema, {
      articleType: "dci_daily",
      fieldCorpsNames: dayScores.map(s => s.corps),
    });

    // Look up the corps' show title and uniform details from Firestore
    const showTitle = db ? await getShowTitleFromFirestore(db, topCorps.corps, topCorps.sourceYear) : null;
    const uniformDetails = db ? await getUniformDetailsFromFirestore(db, topCorps.corps, topCorps.sourceYear) : null;

    // Generate image featuring top corps with accurate historical uniform
    const imagePrompt = buildStandingsImagePrompt(
      topCorps.corps,
      topCorps.sourceYear,
      showContext.location,
      showContext.showName,
      showTitle,
      uniformDetails,
      reportDay,
      0 // articleIndex 0: DCI Daily
    );

    const imageData = await generateImageWithImagen(imagePrompt);
    const imageResult = await processGeneratedImage(imageData, "dci_daily");

    return {
      type: ARTICLE_TYPES.DCI_DAILY,
      ...content,
      featuredCorps: topCorps.corps, // Track which corps was featured for diversity
      imageUrl: imageResult.url,
      imagePrompt,
      reportDay,
    };
  } catch (error) {
    logger.error("DCI Scores article failed:", error);
    return createFallbackArticle(ARTICLE_TYPES.DCI_DAILY, reportDay);
  }
}

/**
 * Article 2: DCI Corps Feature
 * In-depth feature on a single corps and their progress across the season
 * Written in DCI.org editorial style
 */
async function generateDciFeatureArticle({ reportDay, dayScores, trendData, showContext, competitionContext, db, ledger, brief, isLiveSeason }) {
  // Derive the corps exclusion set from the coverage ledger so this article
  // doesn't repeat a spotlight subject from earlier in the batch.
  const excludeCorps = ledger?.dciCorps || new Set();
  const toneGuidance = getToneGuidance(competitionContext, "dci_corps_feature");

  // Corps selection priority:
  //   1. The editorial brief's trajectory pick (if it resolves to a corps in
  //      tonight's field and isn't already spotlit).
  //   2. Day-based rotation through the field (falls back if the brief either
  //      didn't produce a pick or picked a corps that's been excluded).
  let featureCorps = null;
  if (brief?.trajectory?.corps) {
    const briefPick = dayScores.find(s => s.corps === brief.trajectory.corps);
    if (briefPick && !excludeCorps.has(briefPick.corps)) {
      featureCorps = briefPick;
    }
  }
  if (!featureCorps) {
    let featureIndex = (reportDay - 1) % dayScores.length;
    featureCorps = dayScores[featureIndex];
    if (excludeCorps.has(featureCorps?.corps)) {
      for (let i = 1; i < dayScores.length; i++) {
        const nextIndex = (featureIndex + i) % dayScores.length;
        if (!excludeCorps.has(dayScores[nextIndex]?.corps)) {
          featureCorps = dayScores[nextIndex];
          break;
        }
      }
    }
  }

  const currentRank = dayScores.findIndex(s => s.corps === featureCorps.corps) + 1;
  const corpsTrend = trendData[featureCorps.corps] || { dayChange: 0, trendFromAvg: 0, avgTotal: featureCorps.total };

  // Get show title and uniform details for this corps from Firestore
  const showTitle = db ? await getShowTitleFromFirestore(db, featureCorps.corps, featureCorps.sourceYear) : null;
  const uniformDetails = db ? await getUniformDetailsFromFirestore(db, featureCorps.corps, featureCorps.sourceYear) : null;

  // Calculate season progress data
  const seasonHigh = corpsTrend.seasonHigh || featureCorps.total;
  const seasonLow = corpsTrend.seasonLow || featureCorps.total;
  const improvement = corpsTrend.totalImprovement || 0;

  // Build show-by-show history for the last 5 shows
  const recentShowHistory = corpsTrend.recentScores || [];
  const showHistoryText = recentShowHistory
    .filter(s => s.total >= 60) // Ignore scores under 60
    .slice(-5)
    .map((s, i, arr) => {
      const prevScore = i > 0 ? arr[i-1].total : null;
      const change = prevScore ? (s.total - prevScore) : 0;
      const changeStr = prevScore ? ` (${change >= 0 ? '+' : ''}${change.toFixed(3)})` : '';
      return `Day ${s.day}: ${s.total.toFixed(3)}${changeStr}${s.showName ? ` at ${s.showName}` : ''}${s.location ? `, ${s.location}` : ''}
   GE: ${s.subtotals?.ge?.toFixed(2) || 'N/A'} | Visual: ${s.subtotals?.visual?.toFixed(2) || 'N/A'} | Music: ${s.subtotals?.music?.toFixed(2) || 'N/A'}`;
    }).join('\n') || 'Limited show history available';

  // Build caption trajectory analysis
  const _captionTrajectory = {
    ge: corpsTrend.captionHistory?.ge || [],
    visual: corpsTrend.captionHistory?.visual || [],
    music: corpsTrend.captionHistory?.music || [],
  };

  // Get today's narrative variety
  const variety = getWritingVariety(reportDay, "dci_feature");

  // Pre-compute seeded narrative hints so the featured corps gets deterministic
  // per-(corps, day) phrasing for their momentum, streak, and caption story.
  // Seeded by corps+day+articleType so the same corps on the same day produces
  // one set of hints inside DCI Feature, but a different set if the same corps
  // shows up as a pick in the Fantasy Market Report later in the batch.
  const narrativeSeed = `${featureCorps.corps}:${reportDay}:dci_feature`;
  const narrative = getTrendNarrative(corpsTrend, narrativeSeed);
  const narrativeHintsBlock = narrative ? [
    narrative.momentum ? `- Momentum framing: "${narrative.momentum}"` : null,
    narrative.streak ? `- Streak framing: "${narrative.streak}"` : null,
    narrative.caption ? `- Caption framing: "${narrative.caption}"` : null,
    narrative.performance ? `- Season-context framing: "${narrative.performance}"` : null,
    narrative.stability ? `- Stability framing: "${narrative.stability}"` : null,
  ].filter(Boolean).join('\n') : '';

  const tonightShow = featureCorps.showName || showContext.showName;
  const tonightLocation = featureCorps.location || showContext.location;

  const prompt = `You are a DCI.org feature writer profiling ${featureCorps.corps}'s season. This is a numbers-driven piece — the kind of article a knowledgeable fan reads to understand what the scores actually say about this corps. Not a puff piece. Not a history lesson. A season audit.

ACCURACY RULES (read first)
- Every score, caption number, show name, and location you write MUST come from the DATA block below. Do not invent venues, cities, dates, or scores.
${isLiveSeason
  ? `- This is the ${featureCorps.sourceYear} live DCI season. ${featureCorps.corps} is competing with their current ${featureCorps.sourceYear} program — write about this season's performances and scores, and do NOT reference or tag a prior year's program material.`
  : `- The featured corps is ${featureCorps.corps} competing with ${featureCorps.sourceYear} material. Do not reference seasons or material other than ${featureCorps.sourceYear} unless it appears in the data.
- Source-year disclosure: on the corps' FIRST mention in the narrative, render as "${featureCorps.corps} (${featureCorps.sourceYear})" so fantasy readers know which season's program they're reading about. After the first mention, omit the year unless you're explicitly contrasting seasons.`}
- If a fact isn't in the data, leave it out — do not fill gaps with plausible-sounding invention.

VOICE: Sports analyst who respects the reader's intelligence. Specific scores, real comparisons, honest assessments. No filler about tradition or history — only this season's data matters.

BANNED PHRASES: dominant, commanding, stunning, thrilling, incredible, captivating, testament, mettle, identity forged in, legacy of excellence, storied history, tradition of, proving doubters wrong, making a statement, force to be reckoned with, passion and dedication, pushing the boundaries, compelling visual storytelling, emotionally resonant

DATA RULES: Ignore total scores under 60 (incomplete). Ignore caption scores of 0 (missing).

===== DATA =====
FEATURED CORPS: ${featureCorps.corps}
${isLiveSeason ? 'Live season' : 'Season material'}: ${featureCorps.sourceYear}${showTitle ? ` | Show title: "${showTitle}"` : ''}
Tonight's competition: ${tonightShow || 'N/A'}${tonightLocation ? ` — ${tonightLocation}` : ''}
Tonight's placement: ${currentRank}${currentRank === 1 ? 'st' : currentRank === 2 ? 'nd' : currentRank === 3 ? 'rd' : 'th'} of ${dayScores.length} at that show, ${featureCorps.total.toFixed(3)} (${corpsTrend.dayChange >= 0 ? '+' : ''}${corpsTrend.dayChange.toFixed(3)} from yesterday)
Season High: ${seasonHigh.toFixed(3)} | Season Low: ${seasonLow >= 60 ? seasonLow.toFixed(3) : 'N/A'} | Net improvement: ${improvement >= 0 ? '+' : ''}${improvement.toFixed(3)} | Momentum: ${corpsTrend.momentum || 'steady'}${corpsTrend.atSeasonBest ? ' | ★ AT SEASON HIGH' : ''}

SHOW-BY-SHOW (last 5 valid — use these exact show names and locations):
${showHistoryText}

CAPTIONS TONIGHT:
GE: ${featureCorps.subtotals?.ge?.toFixed(2) || 'N/A'} ${corpsTrend.captionTrends?.ge?.trending === "up" ? "↑" : corpsTrend.captionTrends?.ge?.trending === "down" ? "↓" : "→"} (GE1: ${featureCorps.captions?.GE1?.toFixed(2) || 'N/A'}, GE2: ${featureCorps.captions?.GE2?.toFixed(2) || 'N/A'})
Visual: ${featureCorps.subtotals?.visual?.toFixed(2) || 'N/A'} ${corpsTrend.captionTrends?.visual?.trending === "up" ? "↑" : corpsTrend.captionTrends?.visual?.trending === "down" ? "↓" : "→"} (VP: ${featureCorps.captions?.VP?.toFixed(2) || 'N/A'}, VA: ${featureCorps.captions?.VA?.toFixed(2) || 'N/A'}, CG: ${featureCorps.captions?.CG?.toFixed(2) || 'N/A'})
Music: ${featureCorps.subtotals?.music?.toFixed(2) || 'N/A'} ${corpsTrend.captionTrends?.music?.trending === "up" ? "↑" : corpsTrend.captionTrends?.music?.trending === "down" ? "↓" : "→"} (B: ${featureCorps.captions?.B?.toFixed(2) || 'N/A'}, MA: ${featureCorps.captions?.MA?.toFixed(2) || 'N/A'}, P: ${featureCorps.captions?.P?.toFixed(2) || 'N/A'})

COMPETITIVE NEIGHBORHOOD (corps ranked within a few spots of the feature at today's show):
${dayScores.slice(Math.max(0, currentRank - 3), Math.min(dayScores.length, currentRank + 4)).map((s, i) => {
  const rank = Math.max(0, currentRank - 3) + i + 1;
  const gap = s.total - featureCorps.total;
  const venueTag = s.showName && s.showName !== tonightShow ? ` @ ${s.showName}` : '';
  return `${rank}. ${s.corps}: ${s.total.toFixed(3)}${venueTag}${s.corps === featureCorps.corps ? ' ← FEATURED' : ` (${gap >= 0 ? '+' : ''}${gap.toFixed(3)})`}`;
}).join('\n')}
${narrativeHintsBlock ? `
NARRATIVE HINTS (you may use, paraphrase, or ignore these — do NOT use more than one verbatim in the same article, and do not daisy-chain them):
${narrativeHintsBlock}` : ''}
===== END DATA =====

${toneGuidance}
${formatNegativeSpace(ledger)}
${formatBriefForArticle(brief, 'dci_feature')}
TODAY'S APPROACH
Lens: ${variety.lens}
Focus: ${variety.focus}
Closing angle: ${variety.closingAngle}

ARTICLE REQUIREMENTS
- Headline: Include a real number (score, margin, trend). No exclamation points. No generic praise.
- Summary: 2-3 sentences — rank, score, and a specific caption insight. Reference the actual show name when natural.
- Narrative: 700-900 words. A season profile built on scores.
  Include: specific scores from their recent shows (use the exact show names from the data), analysis of at least 3 individual captions with numbers, a comparison to the corps around them tonight, and a reasoned outlook that follows the closing angle above.
  Sequence and emphasis are your call — if GE is the story, lead with GE; if trajectory is the story, lead with the arc. Don't walk through a checklist.
  Do NOT end with fantasy buy/hold/sell or lineup picks — that belongs to the Fantasy Market Report. Do NOT predict exact future scores — only analyze visible trends.`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      headline: { type: Type.STRING, description: "Corps name with a real number/trend from tonight. No 'dominates', no exclamation points, no invented facts." },
      summary: { type: Type.STRING, description: "2-3 sentences: corps name, current score, rank, and one specific caption insight grounded in the data." },
      narrative: { type: Type.STRING, description: "700-900 word analytical profile. Uses the exact show names and scores from the data block — no invented venues, dates, or statistics. Covers current position, show-by-show journey with specific scores, caption strengths, caption weaknesses, and trajectory, ending per the closing angle above. No fantasy buy/hold/sell picks — that belongs to the Fantasy Market Report. Structure follows what the data emphasizes, not a fixed checklist. Never uses 'dominant', 'commanding', 'stunning'." },
      corpsIdentity: {
        type: Type.OBJECT,
        properties: {
          tradition: { type: Type.STRING, description: "Corps' historical identity" },
          strength: { type: Type.STRING, description: "Primary competitive strength" },
          trajectory: { type: Type.STRING, description: "Season trajectory assessment" },
        },
        required: ["tradition", "strength", "trajectory"],
      },
    },
    required: ["headline", "summary", "narrative", "corpsIdentity"],
  };

  try {
    const content = await generateWithFactCheckGuard(prompt, schema, {
      articleType: "dci_feature",
      fieldCorpsNames: dayScores.map(s => s.corps),
    });

    const imagePrompt = buildCorpsSpotlightImagePrompt(
      featureCorps.corps,
      featureCorps.sourceYear,
      showTitle,
      uniformDetails,
      reportDay,
      1 // articleIndex 1: DCI Feature
    );

    const imageData = await generateImageWithImagen(imagePrompt);
    const imageResult = await processGeneratedImage(imageData, "dci_feature");

    return {
      type: ARTICLE_TYPES.DCI_FEATURE,
      ...content,
      featuredCorps: featureCorps.corps,
      featuredYear: featureCorps.sourceYear,
      showTitle,
      imageUrl: imageResult.url,
      imagePrompt,
      reportDay,
    };
  } catch (error) {
    logger.error("DCI Corps Feature article failed:", error);
    return createFallbackArticle(ARTICLE_TYPES.DCI_FEATURE, reportDay);
  }
}

/**
 * Article 3: DCI Weekly Recap
 * Deep dive on General Effect, Visual, and Music trends over the last week
 * Written in DCI.org recap analysis style
 */
async function generateDciRecapArticle({ reportDay, dayScores, trendData, showContext, competitionContext, db, ledger, brief, isLiveSeason }) {
  // Derive the corps exclusion set from the coverage ledger so the image subject
  // picker below doesn't land on a corps already spotlit in an earlier article.
  const excludeCorps = ledger?.dciCorps || new Set();
  const toneGuidance = getToneGuidance(competitionContext, "dci_weekly_recap");

  // Build comprehensive caption trend analysis
  const captionTrends = {
    ge: { leaders: [], trending: [], analysis: "" },
    visual: { leaders: [], trending: [], analysis: "" },
    music: { leaders: [], trending: [], analysis: "" },
  };

  // Analyze each corps' caption trends over the week
  dayScores.slice(0, 10).forEach(corps => {
    const trend = trendData[corps.corps];
    if (trend?.captionTrends) {
      if (trend.captionTrends.ge?.trending === "up") {
        captionTrends.ge.trending.push({ corps: corps.corps, change: trend.captionTrends.ge.weekChange || 0 });
      }
      if (trend.captionTrends.visual?.trending === "up") {
        captionTrends.visual.trending.push({ corps: corps.corps, change: trend.captionTrends.visual.weekChange || 0 });
      }
      if (trend.captionTrends.music?.trending === "up") {
        captionTrends.music.trending.push({ corps: corps.corps, change: trend.captionTrends.music.weekChange || 0 });
      }
    }
  });

  // Find caption leaders
  const geSorted = [...dayScores].sort((a, b) => (b.subtotals?.ge || 0) - (a.subtotals?.ge || 0));
  const visualSorted = [...dayScores].sort((a, b) => (b.subtotals?.visual || 0) - (a.subtotals?.visual || 0));
  const musicSorted = [...dayScores].sort((a, b) => (b.subtotals?.music || 0) - (a.subtotals?.music || 0));

  // Build comprehensive corps data for the entire field
  const _allCorpsTrends = dayScores.map(corps => {
    const trend = trendData[corps.corps] || {};
    return {
      corps: corps.corps,
      total: corps.total,
      ge: corps.subtotals?.ge,
      visual: corps.subtotals?.visual,
      music: corps.subtotals?.music,
      momentum: trend.momentum || 'steady',
      dayChange: trend.dayChange || 0,
      geTrend: trend.captionTrends?.ge?.trending || 'stable',
      visualTrend: trend.captionTrends?.visual?.trending || 'stable',
      musicTrend: trend.captionTrends?.music?.trending || 'stable',
    };
  });

  // Get today's narrative variety
  const variety = getWritingVariety(reportDay, "dci_recap");

  // Distinct shows represented in today's field (for venue-aware phrasing)
  const uniqueShows = Array.from(new Set(dayScores.map(s => s.showName).filter(Boolean)));
  const multiShowToday = uniqueShows.length > 1;

  const prompt = `You are a DCI score analyst writing tonight's caption deep-dive. This is the piece a serious drum corps fan bookmarks — the one that explains what the judges are actually rewarding and where the real races are hiding inside the overall standings. It is PURE caption analysis and description — it is not a fantasy column.

SCOPE (read carefully)
- This article DESCRIBES the caption landscape. It does NOT give fantasy buy/hold/sell picks, lineup advice, or "which caption to pick tomorrow" recommendations — a separate Fantasy Market Report article covers that.
- You may describe trajectory, momentum, and what a corps' caption profile suggests about their program identity and direction. You may NOT frame any observation as a pick, trade, buy, sell, hold, target, fade, or fantasy action.
- Readers who want actionable picks will read the Fantasy Market Report. Your job is to leave them understanding the night, not telling them what to do with their lineup.

ACCURACY RULES
- Every corps name, score, caption number, and trend direction you write MUST come from the DATA block below. Do not invent corps, scores, or statistics.
- The field being analyzed is ${dayScores.length} corps (listed below). Never state any other count, and never reference corps not in this list.
${multiShowToday ? `- Tonight's caption numbers come from ${uniqueShows.length} different shows: ${uniqueShows.join(', ')}. Corps at different shows did NOT judge against each other tonight, so the caption rankings below are a composite across venues — frame cross-venue comparisons as such, not as a head-to-head caption duel.` : `- Tonight's caption numbers come from a single show, so the caption rankings below are a true head-to-head.`}
${isLiveSeason
  ? `- This is the ${dayScores.find(s => s.sourceYear)?.sourceYear || String(new Date().getFullYear())} live DCI season — the caption scores below are from this season's competitions. Do NOT reference a prior year's book or tag corps with a past season year.`
  : `- Source-year disclosure: on each corps' FIRST mention in the narrative, include their source-year in parentheses — e.g., "Blue Stars (2019)" — so fantasy readers know which season's book is driving the caption scores. Every corps' year is listed in CORPS SOURCE YEARS below. After the first mention, the year can be omitted.`}
- If a fact isn't in the data, leave it out.

VOICE: Authoritative but readable. Not dumbed down, not written for judges. A knowledgeable fan should come away understanding the caption landscape better than they did before.

BANNED PHRASES: dominant, commanding, stunning, thrilling, heating up, captivating, testament, battle for supremacy, stakes are high, every point matters, absolutely crucial, setting the stage, poised to, poised for success, will have a significant advantage, buy, sell, hold, trade, pick up, drop, fade, target, stash, fantasy directors should, for fantasy purposes, in your lineup

===== DATA =====
${dayScores.length} CORPS | Week: Days ${reportDay - 6} through ${reportDay} | Date: ${showContext.date}
CORPS IN TONIGHT'S FIELD: ${dayScores.map(s => s.corps).join(', ')}
${isLiveSeason ? '' : `CORPS SOURCE YEARS: ${dayScores.map(s => `${s.corps} (${s.sourceYear || 'unknown'})`).join(', ')}
`}
GENERAL EFFECT (40% of total):
${geSorted.map((s, i) => {
  const trend = trendData[s.corps]?.captionTrends?.ge;
  const margin = i > 0 ? (geSorted[i-1].subtotals?.ge - s.subtotals?.ge).toFixed(2) : '-';
  return `${i + 1}. ${s.corps}: ${s.subtotals?.ge?.toFixed(2)} [GE1: ${s.captions?.GE1?.toFixed(2)}, GE2: ${s.captions?.GE2?.toFixed(2)}] ${trend?.trending === "up" ? "↑" : trend?.trending === "down" ? "↓" : "→"} (${margin} behind)`;
}).join('\n')}

VISUAL (30% of total):
${visualSorted.map((s, i) => {
  const trend = trendData[s.corps]?.captionTrends?.visual;
  const margin = i > 0 ? (visualSorted[i-1].subtotals?.visual - s.subtotals?.visual).toFixed(2) : '-';
  return `${i + 1}. ${s.corps}: ${s.subtotals?.visual?.toFixed(2)} [VP: ${s.captions?.VP?.toFixed(2)}, VA: ${s.captions?.VA?.toFixed(2)}, CG: ${s.captions?.CG?.toFixed(2)}] ${trend?.trending === "up" ? "↑" : trend?.trending === "down" ? "↓" : "→"} (${margin} behind)`;
}).join('\n')}

MUSIC (30% of total):
${musicSorted.map((s, i) => {
  const trend = trendData[s.corps]?.captionTrends?.music;
  const margin = i > 0 ? (musicSorted[i-1].subtotals?.music - s.subtotals?.music).toFixed(2) : '-';
  return `${i + 1}. ${s.corps}: ${s.subtotals?.music?.toFixed(2)} [B: ${s.captions?.B?.toFixed(2)}, MA: ${s.captions?.MA?.toFixed(2)}, P: ${s.captions?.P?.toFixed(2)}] ${trend?.trending === "up" ? "↑" : trend?.trending === "down" ? "↓" : "→"} (${margin} behind)`;
}).join('\n')}

MOMENTUM BY CORPS:
${Object.entries(trendData).map(([corps, trend]) => {
  return `${corps}: ${trend.momentum || 'steady'} | Day: ${trend.dayChange >= 0 ? '+' : ''}${trend.dayChange?.toFixed(3) || 'N/A'} | GE: ${trend.captionTrends?.ge?.trending || 'stable'} | Vis: ${trend.captionTrends?.visual?.trending || 'stable'} | Mus: ${trend.captionTrends?.music?.trending || 'stable'}`;
}).join('\n')}

SUBCAPTION LEADERS:
GE1: ${[...dayScores].sort((a, b) => (b.captions?.GE1 || 0) - (a.captions?.GE1 || 0))[0]?.corps} (${[...dayScores].sort((a, b) => (b.captions?.GE1 || 0) - (a.captions?.GE1 || 0))[0]?.captions?.GE1?.toFixed(2)}) | GE2: ${[...dayScores].sort((a, b) => (b.captions?.GE2 || 0) - (a.captions?.GE2 || 0))[0]?.corps} (${[...dayScores].sort((a, b) => (b.captions?.GE2 || 0) - (a.captions?.GE2 || 0))[0]?.captions?.GE2?.toFixed(2)})
VP: ${[...dayScores].sort((a, b) => (b.captions?.VP || 0) - (a.captions?.VP || 0))[0]?.corps} (${[...dayScores].sort((a, b) => (b.captions?.VP || 0) - (a.captions?.VP || 0))[0]?.captions?.VP?.toFixed(2)}) | VA: ${[...dayScores].sort((a, b) => (b.captions?.VA || 0) - (a.captions?.VA || 0))[0]?.corps} (${[...dayScores].sort((a, b) => (b.captions?.VA || 0) - (a.captions?.VA || 0))[0]?.captions?.VA?.toFixed(2)}) | CG: ${[...dayScores].sort((a, b) => (b.captions?.CG || 0) - (a.captions?.CG || 0))[0]?.corps} (${[...dayScores].sort((a, b) => (b.captions?.CG || 0) - (a.captions?.CG || 0))[0]?.captions?.CG?.toFixed(2)})
B: ${[...dayScores].sort((a, b) => (b.captions?.B || 0) - (a.captions?.B || 0))[0]?.corps} (${[...dayScores].sort((a, b) => (b.captions?.B || 0) - (a.captions?.B || 0))[0]?.captions?.B?.toFixed(2)}) | MA: ${[...dayScores].sort((a, b) => (b.captions?.MA || 0) - (a.captions?.MA || 0))[0]?.corps} (${[...dayScores].sort((a, b) => (b.captions?.MA || 0) - (a.captions?.MA || 0))[0]?.captions?.MA?.toFixed(2)}) | P: ${[...dayScores].sort((a, b) => (b.captions?.P || 0) - (a.captions?.P || 0))[0]?.corps} (${[...dayScores].sort((a, b) => (b.captions?.P || 0) - (a.captions?.P || 0))[0]?.captions?.P?.toFixed(2)})
===== END DATA =====

${toneGuidance}
${formatNegativeSpace(ledger)}
${formatBriefForArticle(brief, 'dci_recap')}
TODAY'S ANALYTICAL APPROACH
Lead with: ${variety.emphasis}
Thread: ${variety.thread}
Closing angle: ${variety.closingAngle}

ARTICLE REQUIREMENTS
- Headline: Technical, number-focused. Reference a specific caption gap or trend. No hype words, no "buy/sell" framing.
- Summary: 2-3 factual sentences with key caption insights from tonight's data.
- Narrative: 900-1200 words of caption analysis covering GE, Visual, and Music. Describe what the judges rewarded, where the races are tight, how the sub-caption picture differs from the composite picture, and how the week's trajectory reshapes each corps' caption profile. Close per the closing angle above.
  Reference a meaningful cross-section of the field in each caption family — aim for ${Math.min(5, dayScores.length)} or more corps per family, but never pad by inventing. Cite specific point gaps from the data.
  Weight the sections by where the real story is tonight. If the Visual race is tight and GE is decided, Visual gets more ink.
  Do NOT end with buy/hold/sell, fantasy picks, or "who to target" — the Fantasy Market Report handles that. Your ending belongs to the closing angle above.`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      headline: { type: Type.STRING, description: "Technical headline grounded in a real caption gap or trend from tonight. No 'heats up', 'battle intensifies', 'buy/sell' framing, or invented facts." },
      summary: { type: Type.STRING, description: "2-3 sentences with specific caption gaps and a key insight from the data. Descriptive, not prescriptive — no fantasy picks." },
      narrative: { type: Type.STRING, description: "900-1200 word caption analysis covering GE, Visual, and Music: what the judges rewarded, where the tightest races are, and how the week's trajectory reshapes each corps' caption profile. Every corps, score, and trend must come from the data block. No fantasy buy/hold/sell picks — that is the Fantasy Market Report's job. Never uses 'dominant', 'heating up', 'captivating'." },
      captionBreakdown: {
        type: Type.OBJECT,
        properties: {
          geAnalysis: { type: Type.STRING, description: "General Effect analysis" },
          visualAnalysis: { type: Type.STRING, description: "Visual caption analysis" },
          musicAnalysis: { type: Type.STRING, description: "Music caption analysis" },
        },
        required: ["geAnalysis", "visualAnalysis", "musicAnalysis"],
      },
    },
    required: ["headline", "summary", "narrative", "captionBreakdown"],
  };

  try {
    const content = await generateWithFactCheckGuard(prompt, schema, {
      articleType: "dci_recap",
      fieldCorpsNames: dayScores.map(s => s.corps),
    });

    // Feature the GE leader for the image (or next available if excluded)
    let featuredCorps = geSorted.find(s => !excludeCorps.has(s.corps)) || geSorted[0];
    const showTitle = db ? await getShowTitleFromFirestore(db, featuredCorps.corps, featuredCorps.sourceYear) : null;
    const uniformDetails = db ? await getUniformDetailsFromFirestore(db, featuredCorps.corps, featuredCorps.sourceYear) : null;

    const imagePrompt = buildCaptionsImagePrompt(
      featuredCorps.corps,
      featuredCorps.sourceYear,
      "General Effect",
      showContext.location,
      showTitle,
      uniformDetails,
      reportDay,
      2 // articleIndex 2: DCI Recap
    );

    const imageData = await generateImageWithImagen(imagePrompt);
    const imageResult = await processGeneratedImage(imageData, "dci_recap");

    return {
      type: ARTICLE_TYPES.DCI_RECAP,
      ...content,
      featuredCorps: featuredCorps.corps,
      imageUrl: imageResult.url,
      imagePrompt,
      reportDay,
    };
  } catch (error) {
    logger.error("DCI Weekly Recap article failed:", error);
    return createFallbackArticle(ARTICLE_TYPES.DCI_RECAP, reportDay);
  }
}

/**
 * Article 4: marching.art Fantasy Results
 * Daily fantasy competition results
 */
async function generateFantasyDailyArticle({ reportDay, fantasyData, showContext, competitionContext, db, dataDocId, ledger }) {
  if (!fantasyData?.current) {
    return createFallbackArticle(ARTICLE_TYPES.FANTASY_DAILY, reportDay);
  }

  const toneGuidance = getToneGuidance(competitionContext, "fantasy_results");

  const shows = fantasyData.current.shows || [];
  // Flatten while preserving which show each result came from — the article must
  // be able to attribute each ensemble to the correct competition.
  const allResults = shows.flatMap(s => (s.results || []).map(r => ({
    ...r,
    showEventName: r.showEventName || s.eventName || s.name || null,
    showLocation: r.showLocation || s.location || null,
  })));

  // Separate competitive and SoundSport results
  const competitiveResults = allResults.filter(r => r.corpsClass !== 'soundSport');
  const soundSportResults = allResults
    .filter(r => r.corpsClass === 'soundSport')
    .sort((a, b) => b.totalScore - a.totalScore);

  // Rank everyone who competed — no arbitrary 25-cap, so the article reflects the real field.
  const topPerformers = [...competitiveResults].sort((a, b) => b.totalScore - a.totalScore);
  const totalCompetitors = topPerformers.length;

  // Return a fallback if there is genuinely no content to write about tonight.
  // Only fire the fallback when BOTH the competitive field and the SoundSport
  // field are empty — a SoundSport-only evening still deserves its own piece.
  if (totalCompetitors === 0 && soundSportResults.length === 0) {
    return createFallbackArticle(ARTICLE_TYPES.FANTASY_DAILY, reportDay);
  }

  // Field-size mode drives voice, length, quote count, and framing so the
  // article matches the reality of tonight's field instead of padding a 1-
  // ensemble night into the same 5-paragraph shape as a 10-ensemble night.
  const fieldMode =
    totalCompetitors >= 6 ? 'full' :
    totalCompetitors >= 2 ? 'small' :
    totalCompetitors === 1 ? 'solo' :
    'soundsport';

  // Dynamic tiering so the prompt doesn't lie about how much of the field to cover.
  const detailCount = Math.min(5, totalCompetitors);
  const midTierEnd = Math.min(Math.max(detailCount + 5, Math.ceil(totalCompetitors / 2)), totalCompetitors);
  const tierDescription = totalCompetitors <= 5
    ? `all ${totalCompetitors} in detail`
    : totalCompetitors <= 10
      ? `top ${detailCount} in detail, the remaining ${totalCompetitors - detailCount} briefly`
      : `top ${detailCount} in detail, positions ${detailCount + 1}-${midTierEnd} as a group, and positions ${midTierEnd + 1}-${totalCompetitors} briefly`;

  const avgScore = topPerformers.length > 0
    ? (topPerformers.reduce((sum, p) => sum + p.totalScore, 0) / topPerformers.length).toFixed(3)
    : "0.000";
  const topScore = topPerformers[0]?.totalScore?.toFixed(3) || "0.000";

  // Group competitive results by fantasy show for venue-aware writing
  const competitiveByShow = (() => {
    const groups = new Map();
    for (const r of topPerformers) {
      const key = r.showEventName || 'Unspecified Competition';
      if (!groups.has(key)) {
        groups.set(key, {
          name: key,
          location: r.showLocation || null,
          results: [],
        });
      }
      groups.get(key).results.push(r);
    }
    return Array.from(groups.values()).map(g => ({
      ...g,
      results: g.results.sort((a, b) => b.totalScore - a.totalScore),
    }));
  })();
  const multiShow = competitiveByShow.length > 1;

  // SoundSport ratings based on scoring guidelines (NOT competitive scores)
  // SoundSport uses a rating system: Gold, Silver, Bronze, Participation
  // Scores are NEVER revealed - only the rating level
  // "Best in Show" is the highest scoring ensemble, NOT a rating level
  const getSoundSportRating = (score) => {
    if (!score || score <= 0) return null;
    // Thresholds based on SoundSport adjudication guidelines (from SoundSportTab.jsx)
    if (score >= 85) return "Gold";
    if (score >= 75) return "Silver";
    if (score >= 65) return "Bronze";
    return "Participation";
  };

  // Find "Best in Show" - the highest scoring SoundSport ensemble at this competition
  const soundSportBestInShow = soundSportResults.length > 0
    ? soundSportResults.reduce((best, current) =>
        (current.totalScore > (best?.totalScore || 0)) ? current : best, null)
    : null;

  // Categorize SoundSport results by rating (NO SCORES - only ratings)
  const soundSportByRating = {
    gold: soundSportResults.filter(r => getSoundSportRating(r.totalScore) === "Gold"),
    silver: soundSportResults.filter(r => getSoundSportRating(r.totalScore) === "Silver"),
    bronze: soundSportResults.filter(r => getSoundSportRating(r.totalScore) === "Bronze"),
    participation: soundSportResults.filter(r => getSoundSportRating(r.totalScore) === "Participation"),
  };

  const fantasyShowName = formatFantasyEventName(showContext.showName);

  // Get today's narrative variety. Full and small fields use the voice rotation;
  // solo and soundsport modes override it with mode-specific framing because the
  // rotation is built for competitive rivalries that don't exist in those modes.
  const variety = getWritingVariety(reportDay, "fantasy_daily");

  const modeConfig = {
    full: {
      words: '600-800',
      minQuotes: Math.min(3, Math.max(1, Math.floor(totalCompetitors / 3))),
      voice: variety.voice,
      quoteStyle: variety.quoteStyle,
      storyEngine: variety.storyEngine,
      coverage: `Tiered coverage: ${tierDescription}.`,
      headlineGuidance: `Include the actual top ensemble's name and score. No exclamation points. No invented numbers.`,
      bodyNote: '',
    },
    small: {
      words: '450-600',
      minQuotes: totalCompetitors >= 3 ? 2 : 1,
      voice: `Intimate small-field night — ${totalCompetitors} competitive ensembles. Every ensemble gets real air time; no filler, no pad-to-length paragraphs.`,
      quoteStyle: `Up to ${totalCompetitors >= 3 ? 'two' : 'one'} short quote${totalCompetitors >= 3 ? 's' : ''}, only where they add character. A one-quote piece beats a three-quote piece that stretches to hit a quota.`,
      storyEngine: `Frame the night as a head-to-head (or three-way) among the ${totalCompetitors} competitors. The margins between them ARE the story.`,
      coverage: `Cover all ${totalCompetitors} competitive ensembles in detail.`,
      headlineGuidance: `Include the top ensemble's name and score. A margin-forward headline (e.g., "X Edges Y by 0.156") is welcome when the gap is tight. No exclamation points.`,
      bodyNote: `- Do not pad. If a paragraph has no real material, cut it.`,
    },
    solo: {
      words: '300-400',
      minQuotes: 0,
      voice: `Local beat reporter covering a quieter night. One ensemble in competition, performing solo. Honest, grounded, undramatic. Do NOT invent rivalries or opponents — there aren't any tonight.`,
      quoteStyle: `At most one short director/ensemble quote, and only if it genuinely adds character. A no-quote piece is the correct default.`,
      storyEngine: `Tonight is a solo showcase, not a competition. The story is this one ensemble's performance in context — their score, what their script suggests about the program, and where they sit in the arc of their season. SoundSport participants (if present) are the evening's surrounding ecosystem, not opponents.`,
      coverage: `Cover the one competitive ensemble as the sole feature. Reference SoundSport participants only for evening texture — never imply they competed against the featured ensemble.`,
      headlineGuidance: `Name the ensemble and their score plainly. Do NOT invent competitive framing. Factual phrasing like "Mendota DBC Posts 68.198 in Solo Competition" is correct; "Dominates Field" or "Claims Victory" is not.`,
      bodyNote: `- This is a small night. Short and honest beats padded and dramatic. If the data does not support another paragraph, stop writing. 300-400 words is the target, not a floor.`,
    },
    soundsport: {
      words: '250-350',
      minQuotes: 0,
      voice: `Feature writer covering a SoundSport-only showcase. Celebrate the participants and ratings; the focus is ensemble quality and growth, not standings.`,
      quoteStyle: `No invented quotes. Speak about the ensembles, not for them.`,
      storyEngine: `SoundSport is the whole story tonight. Lead with the Best in Show ensemble (if any), then group the remaining participants by rating level. Do NOT reveal SoundSport scores — SoundSport is a ratings-only format.`,
      coverage: `Feature the SoundSport participants by rating. Make the ratings-only nature of SoundSport clear so readers understand scores are intentionally not published.`,
      headlineGuidance: `Lead with a SoundSport ensemble name and rating, or frame as a showcase evening. No invented scores. No exclamation points.`,
      bodyNote: `- No competitive scores are reported tonight — this is a SoundSport-only evening. Do not invent or imply a competitive outcome.`,
    },
  };
  const mode = modeConfig[fieldMode];

  // Classify each director's displayName as either a "real-looking name" or a
  // "username-style handle" so the writer knows which attribution pattern to
  // use. A displayName reads as a handle if it's lowercase with no internal
  // space, or contains digits/underscores/dots — typical of web signups like
  // "elithecreature" or "snare_guy_22". When that's the case, attributing via
  // the ensemble ("Mendota DBC's director said...") reads better than "said
  // elithecreature," which is what today's published articles actually do.
  const looksLikeHandle = (name) => {
    if (!name || typeof name !== "string") return true;
    const trimmed = name.trim();
    if (trimmed.length === 0) return true;
    if (/[0-9_.]/.test(trimmed)) return true;
    if (!trimmed.includes(" ") && trimmed === trimmed.toLowerCase()) return true;
    return false;
  };
  const directorClassBlock = competitiveResults.length > 0
    ? competitiveResults
        .map(r => `  • "${r.corpsName}" → director "${r.displayName || "Unknown"}" [${looksLikeHandle(r.displayName) ? "HANDLE — attribute via ensemble, not via name" : "NAME — direct attribution OK"}]`)
        .join("\n")
    : "";

  const resultsByShowBlock = competitiveByShow.map(group => {
    const header = `${group.name}${group.location ? ` — ${group.location}` : ''} (${group.results.length} ensemble${group.results.length === 1 ? '' : 's'})`;
    const lines = group.results.map((r, i) => {
      const margin = i > 0 ? (group.results[i - 1].totalScore - r.totalScore).toFixed(3) : "-";
      const director = r.displayName || 'Unknown';
      const hometown = r.location ? ` from ${r.location}` : '';
      return `  ${i + 1}. "${r.corpsName}"${hometown} (Director: ${director}) - ${r.totalScore.toFixed(3)}${i > 0 ? ` [${margin} behind]` : ' [SHOW WINNER]'}`;
    }).join('\n');
    return `SHOW: ${header}\n${lines}`;
  }).join('\n\n');

  const overallRankingBlock = topPerformers.map((r, i) => {
    const margin = i > 0 ? (topPerformers[i - 1].totalScore - r.totalScore).toFixed(3) : "-";
    const director = r.displayName || 'Unknown';
    const showTag = r.showEventName ? ` @ ${r.showEventName}` : '';
    return `${i + 1}. "${r.corpsName}" (${director}) - ${r.totalScore.toFixed(3)}${i > 0 ? ` [${margin} behind]` : ' [OVERALL HIGH]'}${showTag}`;
  }).join('\n');

  const prompt = `You are a marching.art fantasy sports journalist. These are FANTASY ensembles with FANTASY directors created by real users — the ONLY invented content allowed is personality, quotes, and storyline color for those directors and their ensembles. Everything factual — ensemble names, director names, scores, competition names, locations, counts — must match the DATA block exactly.

ACCURACY RULES (read first)
- The field is ${totalCompetitors} competitive ensemble${totalCompetitors === 1 ? '' : 's'} tonight${soundSportResults.length > 0 ? ` plus ${soundSportResults.length} SoundSport participant${soundSportResults.length === 1 ? '' : 's'}` : ''}. Never claim any other count — do not say "25 corps" or any number other than ${totalCompetitors}.
- Only reference ensembles, directors, scores, and venues that appear in the DATA block. Do not invent ensembles, directors, venues, or scores.
${fieldMode === 'soundsport' ? `- No competitive ensembles tonight; SoundSport is non-competitive, so do NOT describe anyone as "winning" against anyone else. Performances are appraised by rating level, not rank.` : multiShow ? `- There are ${competitiveByShow.length} separate fantasy shows tonight at different venues. Ensembles at different shows did NOT compete head-to-head. When you cite a placement or margin, make the show clear.` : fieldMode === 'solo' ? `- Only one competitive ensemble performed tonight: "${topPerformers[0].corpsName}" at ${competitiveByShow[0]?.name || fantasyShowName}${competitiveByShow[0]?.location ? ` (${competitiveByShow[0].location})` : ''}. There are no opponents to frame against — do not invent rivals, runners-up, or head-to-head narratives.` : `- All ensembles tonight competed at the same fantasy show: ${competitiveByShow[0]?.name || fantasyShowName}${competitiveByShow[0]?.location ? ` (${competitiveByShow[0].location})` : ''}.`}
- Invented content is limited to: director personalities, fictional quotes, fictional rivalries/backstory. Never invent competition results, scores, locations, or ensembles.
- Never reveal specific roster/lineup picks.
- Director names in the DATA block are whatever the user set as their displayName — some are real names ("Sarah Jones"), some are usernames ("elithecreature", "mike_42", "BluecoatsFan"). When attributing a quote or paraphrase, ALWAYS prefer an ensemble-based reference ("Mendota DBC's director said…", "the director behind Stellar Vista paused before…"). Only use the bare displayName as a noun if it reads like a real name with a capital letter and a space. Never write a bare-noun attribution that reads as awkward at a glance (e.g., do not produce "elithecreature said…" — write "Mendota DBC's director said…" instead). When you do quote the displayName verbatim, wrap it in the role ("director elithecreature") so the reader sees it as a screen name rather than a first name.

Date: ${showContext.date} | Day ${reportDay}
Field mode: ${fieldMode} (${totalCompetitors} competitive ensemble${totalCompetitors === 1 ? '' : 's'}${soundSportResults.length > 0 ? `, ${soundSportResults.length} SoundSport` : ''})

Voice: ${mode.voice}
Quote style: ${mode.quoteStyle}
Story engine: ${mode.storyEngine}

===== DATA =====
TOTAL COMPETITIVE ENSEMBLES: ${totalCompetitors}
${directorClassBlock ? `\nDIRECTOR ATTRIBUTION GUIDE (check this before writing any quote or paraphrase — "HANDLE" names should NEVER be used as bare-noun attribution):\n${directorClassBlock}\n` : ''}${totalCompetitors === 0 ? 'No competitive ensembles tonight — this is a SoundSport-only evening.' : multiShow ? `\nRESULTS BY SHOW\n${resultsByShowBlock}\n\nOVERALL RANKING (across all shows tonight — reference carefully; these ensembles did NOT all face each other):\n${overallRankingBlock}` : `\nRESULTS\n${resultsByShowBlock}`}

${soundSportResults.length > 0 ? `SOUNDSPORT RATINGS (non-competitive, ratings-only showcase — NEVER reveal SoundSport scores, only rating levels):
${soundSportBestInShow ? `Best in Show: "${soundSportBestInShow.corpsName}" (${soundSportBestInShow.displayName || 'Unknown'})` : ''}
${soundSportByRating.gold.length > 0 ? `Gold (${soundSportByRating.gold.length}): ${soundSportByRating.gold.map(r => `"${r.corpsName}"`).join(', ')}` : ''}
${soundSportByRating.silver.length > 0 ? `Silver (${soundSportByRating.silver.length}): ${soundSportByRating.silver.map(r => `"${r.corpsName}"`).join(', ')}` : ''}
${soundSportByRating.bronze.length > 0 ? `Bronze (${soundSportByRating.bronze.length}): ${soundSportByRating.bronze.map(r => `"${r.corpsName}"`).join(', ')}` : ''}
${soundSportByRating.participation.length > 0 ? `Participation (${soundSportByRating.participation.length}): ${soundSportByRating.participation.map(r => `"${r.corpsName}"`).join(', ')}` : ''}` : ''}

STATS: ${totalCompetitors === 0
  ? `No competitive ensembles | SoundSport participants: ${soundSportResults.length}`
  : `Top ensemble: "${topPerformers[0].corpsName}" at ${topScore}${topPerformers[0].showEventName ? ` (${topPerformers[0].showEventName})` : ''} | ${totalCompetitors >= 2 ? `1st-to-2nd margin: ${(topPerformers[0].totalScore - topPerformers[1].totalScore).toFixed(3)}` : 'Solo competitor'} | Competitive ensembles: ${totalCompetitors} | Field avg: ${avgScore}${soundSportResults.length > 0 ? ` | SoundSport: ${soundSportResults.length}` : ''}`
}
===== END DATA =====

${toneGuidance}
${formatNegativeSpace(ledger)}
BANNED PHRASES: dominant, commanding, stunning, heating up, sent shockwaves, proves their mettle, showcased their prowess, the drama is just beginning, tune in tomorrow, Can [X] maintain their dominance?

ARTICLE REQUIREMENTS
- Headline: ${mode.headlineGuidance}
- Summary: 2-3 sentences — top result, score, and one storyline hook${multiShow ? '. Make the multi-show night clear' : ''}.
- Narrative: ${mode.words} words. ${mode.coverage}${mode.minQuotes > 0 ? ` Include at least ${mode.minQuotes} fictitious director/ensemble quote${mode.minQuotes === 1 ? '' : 's'} with real personality — funny, frustrated, confident, self-deprecating — not "we worked hard" boilerplate.` : ''}
${mode.bodyNote ? `${mode.bodyNote}\n` : ''}${multiShow ? `- Cover all ${competitiveByShow.length} fantasy shows by name. When you cite a placement or score, make the show clear so readers know which ensembles actually faced each other.\n` : ''}${soundSportResults.length > 0 && fieldMode !== 'soundsport' ? `- Include a SoundSport highlight — celebrate the ratings without ever revealing SoundSport scores.\n` : ''}- End with a specific observation or stat from the data, not a rhetorical question or generic send-off.`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      headline: { type: Type.STRING, description: "Top ensemble name and score from the data. No exclamation points, no 'dominates', no invented numbers." },
      summary: { type: Type.STRING, description: "2-3 sentences grounded in tonight's real results: top ensemble, score, margin, one storyline hook. If multiple shows occurred, make that clear." },
      narrative: { type: Type.STRING, description: "600-800 word fantasy article. Uses the exact ensemble names, director names, scores, and show/location values from the DATA block — no invented facts. Coverage depth matches the field size (detail for the top tier, grouped coverage for the rest). Director personalities and quotes may be invented; results may not. Never uses 'dominant', 'commanding', 'stunning', 'heating up'." },
      topPerformers: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            rank: { type: Type.INTEGER },
            corpsName: { type: Type.STRING },
            director: { type: Type.STRING },
            score: { type: Type.NUMBER },
          },
          required: ["rank", "corpsName", "director", "score"],
        },
      },
      scoreBreakdown: {
        type: Type.OBJECT,
        description: "Score breakdown and statistics for today's competition",
        properties: {
          winningScore: { type: Type.NUMBER, description: "Top score of the day" },
          averageScore: { type: Type.NUMBER, description: "Average score among top performers" },
          spreadTop10: { type: Type.NUMBER, description: "Point spread between 1st and 10th" },
          totalEnsembles: { type: Type.INTEGER, description: "Number of ensembles competing" },
        },
        required: ["winningScore", "averageScore", "totalEnsembles"],
      },
    },
    required: ["headline", "summary", "narrative", "topPerformers", "scoreBreakdown"],
  };

  try {
    const content = await generateWithFactCheckGuard(prompt, schema, { articleType: "fantasy_daily" });

    // Image subject: the top competitive ensemble when there is one; otherwise
    // the SoundSport Best in Show for soundsport-only nights so the image still
    // reflects the actual subject of the article rather than a generic placeholder.
    const topCorps = topPerformers[0] || soundSportBestInShow || null;

    // Fetch uniform design if available
    let uniformDesign = null;
    let corpsLocation = null;
    if (topCorps?.uid && topCorps?.corpsClass && db && dataDocId) {
      try {
        const profileDoc = await db.doc(`artifacts/${dataDocId}/users/${topCorps.uid}/profile/data`).get();
        if (profileDoc.exists) {
          const profileData = profileDoc.data();
          const corpsData = profileData?.corps?.[topCorps.corpsClass];
          uniformDesign = corpsData?.uniformDesign || null;
          corpsLocation = corpsData?.location || null;
        }
      } catch (profileError) {
        logger.warn("Could not fetch top performer's uniform design:", profileError.message);
      }
    }

    const imagePrompt = buildFantasyPerformersImagePrompt(
      topCorps?.corpsName || "Champion Corps",
      fieldMode === 'soundsport' ? `SoundSport showcase on Day ${reportDay}` : `Performance finale on Day ${reportDay}`,
      corpsLocation,
      uniformDesign,
      reportDay,
      4 // articleIndex 4: Fantasy Daily
    );

    const imageData = await generateImageWithImagen(imagePrompt);
    const imageResult = await processGeneratedImage(imageData, "fantasy_daily");

    return {
      type: ARTICLE_TYPES.FANTASY_DAILY,
      ...content,
      featuredPerformer: topCorps?.corpsName,
      imageUrl: imageResult.url,
      imagePrompt,
      reportDay,
    };
  } catch (error) {
    logger.error("Fantasy Results article failed:", error);
    return createFallbackArticle(ARTICLE_TYPES.FANTASY_DAILY, reportDay);
  }
}

/**
 * Article 4: Fantasy Market Report
 * Owns buy/hold/sell picks exclusively for the day. The DCI Recap (Article 3)
 * describes the caption landscape; this article translates it into actionable
 * lineup moves on individual DCI captions (GE1, GE2, VP, VA, CG, B, MA, P).
 */
async function generateFantasyRecapArticle({ reportDay, dayScores, trendData, competitionContext, db, ledger, brief, isLiveSeason }) {
  const toneGuidance = getToneGuidance(competitionContext, "fantasy_captions");

  // Build individual caption "stock" data for each corps
  const captionStocks = [];

  dayScores.forEach(score => {
    const trend = trendData[score.corps] || {};
    const captionTrends = trend.captionTrends || {};

    // Individual caption scores with trends
    const captions = [
      { name: 'GE1', fullName: 'GE1 (Music Effect)', score: score.captions?.GE1, trend: captionTrends.ge?.trending, weight: '~20%' },
      { name: 'GE2', fullName: 'GE2 (Visual Effect)', score: score.captions?.GE2, trend: captionTrends.ge?.trending, weight: '~20%' },
      { name: 'VP', fullName: 'Visual Proficiency', score: score.captions?.VP, trend: captionTrends.visual?.trending, weight: '~10%' },
      { name: 'VA', fullName: 'Visual Analysis', score: score.captions?.VA, trend: captionTrends.visual?.trending, weight: '~10%' },
      { name: 'CG', fullName: 'Color Guard', score: score.captions?.CG, trend: captionTrends.visual?.trending, weight: '~10%' },
      { name: 'B', fullName: 'Brass', score: score.captions?.B, trend: captionTrends.music?.trending, weight: '~10%' },
      { name: 'MA', fullName: 'Music Analysis', score: score.captions?.MA, trend: captionTrends.music?.trending, weight: '~10%' },
      { name: 'P', fullName: 'Percussion', score: score.captions?.P, trend: captionTrends.music?.trending, weight: '~10%' },
    ];

    captions.forEach(cap => {
      if (cap.score && cap.score > 0) {
        captionStocks.push({
          corps: score.corps,
          caption: cap.name,
          fullName: cap.fullName,
          score: cap.score,
          trend: cap.trend || 'steady',
          weight: cap.weight,
          dayChange: trend.dayChange || 0,
        });
      }
    });
  });

  // Sort by score within each caption type
  const captionTypes = ['GE1', 'GE2', 'VP', 'VA', 'CG', 'B', 'MA', 'P'];
  const stocksByCaption = {};
  captionTypes.forEach(cap => {
    stocksByCaption[cap] = captionStocks
      .filter(s => s.caption === cap)
      .sort((a, b) => b.score - a.score);
  });

  // Find trending stocks
  const trendingUp = captionStocks.filter(s => s.trend === 'up').sort((a, b) => b.score - a.score);
  const trendingDown = captionStocks.filter(s => s.trend === 'down').sort((a, b) => b.score - a.score);
  const steadyPerformers = captionStocks.filter(s => s.trend === 'steady').sort((a, b) => b.score - a.score);

  // Get today's narrative variety
  const variety = getWritingVariety(reportDay, "fantasy_recap");

  const fieldCorpsList = dayScores.map(s => s.corps).join(', ');
  const uniqueCaptionShows = Array.from(new Set(dayScores.map(s => s.showName).filter(Boolean)));
  const multiShowCaption = uniqueCaptionShows.length > 1;

  const prompt = `You are the Fantasy Market Report analyst for marching.art. Fantasy directors pick individual DCI captions (GE1, GE2, VP, VA, CG, B, MA, P) for their lineups — you tell them what to do about it. This is THE picks column; it is the only article in tonight's five that gives buy/hold/sell recommendations. Earlier in the batch a separate DCI Recap already described tonight's caption landscape in depth. Assume the reader has read it. Your job is to translate that landscape into action, not to redo the description.

ACCURACY RULES (read first)
- Every corps name, caption score, and trend arrow you cite MUST come from the DATA block below. Do not invent corps, captions, scores, or trend directions.
- The field tonight has ${dayScores.length} corps (listed below). Do not reference any corps not in this list.
${multiShowCaption ? `- The caption numbers below come from ${uniqueCaptionShows.length} separate shows tonight: ${uniqueCaptionShows.join(', ')}. Corps at different shows did NOT caption-judge against each other — the rankings are a composite across venues. Frame cross-venue picks as such.` : `- All caption numbers tonight come from a single show, so the rankings are a true head-to-head.`}
${isLiveSeason
  ? `- This is the ${dayScores.find(s => s.sourceYear)?.sourceYear || String(new Date().getFullYear())} live DCI season — the caption scores below come from this season's real competitions. Do NOT reference a prior year's book or tag corps with a past season year.`
  : `- Source-year disclosure: on each corps' first mention in the narrative, include their source-year in parentheses — e.g., "Blue Stars (2019)" — so fantasy directors know which season's book they're picking against. Every corps' year is listed in CORPS SOURCE YEARS below.`}
- If a caption shows "No data" in the DATA block, do not reference it. If a specific number isn't in the data, don't cite a number.

${variety.framing}
Depth: ${variety.depthArea}
Pick style: ${variety.pickStyle}

===== DATA =====
DAY ${reportDay} | FIELD (${dayScores.length}): ${fieldCorpsList}
${isLiveSeason ? '' : `CORPS SOURCE YEARS: ${dayScores.map(s => `${s.corps} (${s.sourceYear || 'unknown'})`).join(', ')}
`}
CAPTION RANKINGS (top ${Math.min(5, dayScores.length)} per caption):
${captionTypes.map(cap => {
  const topN = stocksByCaption[cap]?.slice(0, 5) || [];
  const capInfo = topN.length > 0 ? topN.map((s, i) => `${i+1}. ${s.corps}: ${s.score.toFixed(2)} ${s.trend === 'up' ? '↑' : s.trend === 'down' ? '↓' : '→'}`).join(' | ') : 'No data';
  return `${cap}: ${capInfo}`;
}).join('\n')}

TRENDING: ↑ ${trendingUp.length} rising${trendingUp.length > 0 ? ` (${trendingUp.slice(0, 5).map(s => `${s.corps} ${s.caption} ${s.score.toFixed(2)}`).join(', ')})` : ''} | ↓ ${trendingDown.length} falling${trendingDown.length > 0 ? ` (${trendingDown.slice(0, 5).map(s => `${s.corps} ${s.caption} ${s.score.toFixed(2)}`).join(', ')})` : ''} | → ${steadyPerformers.length} steady
===== END DATA =====

${toneGuidance}
${formatNegativeSpace(ledger)}
${formatBriefForArticle(brief, 'fantasy_recap')}
BANNED PHRASES: dominant, heating up, intensifies, key area of focus, captivating, absolutely crucial, mid-season phase, upward trend (as a standalone phrase), trajectory (cap at 1 use)

ARTICLE REQUIREMENTS
- Headline: A pick-oriented thesis. Name a specific corps+caption and what to DO with it (e.g., a buy, hold, sell, or fade framing). Use ↑↓→ if it fits. No hype words, no invented numbers.
- Summary: 2-3 sentences that lead with tonight's single highest-conviction pick and one line of reasoning. Every other piece in tonight's batch is descriptive — this one is directive.
- Narrative: 600-800 words, weighted heavily toward the picks. Structure:
  1. Lead with the top BUY (specific corps+caption, the thesis, the score/trend that supports it, who it displaces in a typical lineup).
  2. Cover the remaining BUYs, then HOLDs, then SELLs — each named at the corps+caption level with brief reasoning.
  3. Include one or two lines on caption WEIGHT or SCARCITY where it matters (e.g., a 0.30 swing in a ~20%-weight caption like GE1 is worth roughly 2x the same swing in a ~10% caption like Percussion).
  4. Close with a SLEEPER — one under-the-radar corps+caption most fantasy directors will miss, with the reason it's mispriced.
  Cite specific scores and margins drawn only from the data. Do NOT re-narrate what the DCI Recap already covered — no paragraph-length caption-by-caption play-by-play. Every paragraph should end with a picks-actionable takeaway or be cut.
  Pick style (confident / analytical / contrarian) follows the framing above.`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      headline: { type: Type.STRING, description: "Caption-focused headline with a real corps, specific caption (GE1/B/CG etc), real score from the data, and ↑↓→ trend. No hype words, no invented numbers." },
      summary: { type: Type.STRING, description: "2-3 sentences highlighting tonight's actual caption movements and one clear recommendation drawn from the data." },
      narrative: { type: Type.STRING, description: "700-900 word caption-by-caption analysis. Every corps, caption score, and trend arrow must come from the data block. Section emphasis follows where the real story is. Fun but data-driven." },
      captionInsights: {
        type: Type.OBJECT,
        properties: {
          geInsight: { type: Type.STRING, description: "GE1 and GE2 analysis with specific scores" },
          visualInsight: { type: Type.STRING, description: "VP, VA, CG analysis with specific scores" },
          musicInsight: { type: Type.STRING, description: "B, MA, P analysis with specific scores" },
        },
        required: ["geInsight", "visualInsight", "musicInsight"],
      },
      recommendations: {
        type: Type.OBJECT,
        description: "Caption pick recommendations for fantasy directors",
        properties: {
          buy: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                corps: { type: Type.STRING },
                caption: { type: Type.STRING, description: "Specific caption: GE1, GE2, VP, VA, CG, B, MA, or P" },
                score: { type: Type.NUMBER },
                reason: { type: Type.STRING },
              },
              required: ["corps", "caption", "score", "reason"],
            },
          },
          hold: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                corps: { type: Type.STRING },
                caption: { type: Type.STRING, description: "Specific caption: GE1, GE2, VP, VA, CG, B, MA, or P" },
                score: { type: Type.NUMBER },
                reason: { type: Type.STRING },
              },
              required: ["corps", "caption", "score", "reason"],
            },
          },
          sell: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                corps: { type: Type.STRING },
                caption: { type: Type.STRING, description: "Specific caption: GE1, GE2, VP, VA, CG, B, MA, or P" },
                score: { type: Type.NUMBER },
                reason: { type: Type.STRING },
              },
              required: ["corps", "caption", "score", "reason"],
            },
          },
        },
        required: ["buy", "hold", "sell"],
      },
    },
    required: ["headline", "summary", "narrative", "captionInsights", "recommendations"],
  };

  try {
    const content = await generateWithFactCheckGuard(prompt, schema, {
      articleType: "fantasy_recap",
      fieldCorpsNames: dayScores.map(s => s.corps),
    });

    // Feature the top-scoring corps with photojournalistic image
    const topCorpsForImage = dayScores[0];
    let recapUniformDetails = null;
    if (topCorpsForImage && db) {
      recapUniformDetails = await getUniformDetailsFromFirestore(db, topCorpsForImage.corps, topCorpsForImage.sourceYear);
    }
    // Determine which caption to emphasize based on trending data
    const topTrendingCaption = trendingUp[0]?.fullName || "General Effect";
    const imagePrompt = buildFantasyLeagueImagePrompt(
      topCorpsForImage?.corps,
      topCorpsForImage?.sourceYear,
      topTrendingCaption,
      recapUniformDetails,
      reportDay,
      3 // articleIndex 3: Fantasy Recap
    );

    const imageData = await generateImageWithImagen(imagePrompt);
    const imageResult = await processGeneratedImage(imageData, "fantasy_recap");

    // Headline subject for the coverage ledger. Prefer the corps named in the
    // top BUY recommendation since that's what the headline pitch is built on;
    // fall back to the top-scoring corps used for the image.
    const featuredCorps = content?.recommendations?.buy?.[0]?.corps || topCorpsForImage?.corps || null;

    return {
      type: ARTICLE_TYPES.FANTASY_RECAP,
      ...content,
      featuredCorps,
      imageUrl: imageResult.url,
      imagePrompt,
      reportDay,
    };
  } catch (error) {
    logger.error("Fantasy Captions article failed:", error);
    return createFallbackArticle(ARTICLE_TYPES.FANTASY_RECAP, reportDay);
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
      // Check if upload actually succeeded
      if (result.success) {
        return { url: result.url, isPlaceholder: false };
      }
      // Upload returned a placeholder due to failure
      logger.warn("Image upload returned placeholder:", result.error);
      return { url: result.url, isPlaceholder: true };
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
// LEGACY EXPORTS (for backward compatibility)
// =============================================================================

async function generateDailyNews(options) {
  // Wrapper for old API - generates single combined article
  const result = await generateAllArticles(options);
  if (!result.success) return result;

  // Combine into legacy format
  const [standings, captions, performers, , analytics] = result.articles;

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
  try {
    const { shows, offSeasonDay } = recapData;
    const allResults = shows.flatMap(s => s.results || []);
    const topPerformers = allResults.sort((a, b) => b.totalScore - a.totalScore).slice(0, 10);

    const prompt = `You are a sports journalist for marching.art, a FANTASY SPORTS platform for DCI (Drum Corps International) marching band competitions.

This is like fantasy football, but for drum corps. Users create fantasy ensembles by drafting real DCI corps to earn points based on actual competition scores.

Write a Day ${offSeasonDay} fantasy sports recap article for these top-performing user ensembles:

TOP FANTASY ENSEMBLES (user-created teams):
${topPerformers.map((r, i) => `${i + 1}. "${r.corpsName}" from ${r.location || 'Unknown'} (Director: ${r.displayName || 'Unknown'}): ${r.totalScore.toFixed(3)} fantasy points`).join('\n')}

Write like ESPN fantasy sports coverage. Focus on:
- Which fantasy ensembles scored the most points
- Celebrate the top directors' success
- General strategy tips (without revealing specific lineup picks)

IMPORTANT: Do NOT mention RPGs, video games, or fictional fantasy worlds. This is SPORTS fantasy like fantasy football.
All "corps" names above are user-created fantasy team names, not real DCI corps.`;

    // Schema for structured output
    const schema = {
      type: Type.OBJECT,
      properties: {
        headline: { type: Type.STRING, description: "Exciting sports headline" },
        summary: { type: Type.STRING, description: "2-3 sentence summary" },
        narrative: { type: Type.STRING, description: "Full article text" },
        fantasyImpact: { type: Type.STRING, description: "Brief tip for fantasy players" },
        trendingCorps: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Top 3 performing fantasy team names",
        },
      },
      required: ["headline", "summary", "narrative", "fantasyImpact", "trendingCorps"],
    };

    const content = await generateWithFactCheckGuard(prompt, schema, { articleType: "fantasy_recap_legacy" });
    return { success: true, content };
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
  // Article generation
  generateAllArticles,
  generateDciDailyArticle,
  generateDciFeatureArticle,
  generateDciRecapArticle,
  generateFantasyDailyArticle,
  generateFantasyRecapArticle,

  // Image generation - specialized prompts for each article type
  generateImageWithImagen,
  buildStandingsImagePrompt,
  buildCaptionsImagePrompt,
  buildFantasyPerformersImagePrompt,
  buildFantasyLeagueImagePrompt,
  buildAnalyticsImagePrompt,
  buildUnderdogImagePrompt,
  buildCorpsSpotlightImagePrompt,
  buildCorpsAvatarPrompt,  // Corps avatar/icon generation
  buildArticleImagePrompt, // User-submitted article images

  // Uniform/theme utilities
  getUniformDetails,
  getUniformDetailsFromFirestore,
  getShowTitleFromFirestore,
  getFantasyUniformDetails,
  interpretShowTheme,
  buildShowThemeContext,
  DCI_UNIFORMS,
  FANTASY_THEMES,

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
