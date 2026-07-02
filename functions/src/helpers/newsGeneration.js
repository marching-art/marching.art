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
const { Type } = require("@google/genai");
const { logger } = require("firebase-functions/v2");
const { getContextualPlaceholder } = require("./mediaService");
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
  getToneDescriptor,
  buildEditorialBrief,
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
  initializeGemini,
  generateWithFactCheckGuard,
  generateImageWithImagen,
} = require("./geminiService");
const {
  ARTICLE_TYPES,
  createCoverageLedger,
} = require("./newsArticleShared");
const {
  generateDciDailyArticle,
  generateDciFeatureArticle,
  generateDciRecapArticle,
} = require("./newsDciArticles");
const {
  generateFantasyDailyArticle,
  generateFantasyRecapArticle,
} = require("./newsFantasyArticles");







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
