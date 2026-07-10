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
  fetchSeasonStats,
  buildSeasonContext,
  fetchShowContext,
  calculateTotal,
  calculateCaptionSubtotals,
  getScoresForDay,
  applyScheduleLocations,
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
    logger.info(`Show context for Day ${reportDay}: ${showContext.showName}${showContext.location ? ` at ${showContext.location}` : ''} on ${showContext.date}${showContext.allShows?.length > 1 ? ` (${showContext.allShows.length} shows total)` : ''}`);

    // Process data
    const dayScores = getScoresForDay(historicalData, reportDay, activeCorps);
    // Backfill each corps' show venue from the schedule (the authoritative source
    // of locations) when the score scrape didn't carry one, so every article —
    // not just the header — reports real venues instead of omitting them.
    applyScheduleLocations(dayScores, showContext);
    const hasDciScores = Array.isArray(dayScores) && dayScores.length > 0;

    // Fantasy results are produced independently of DCI scraping: the nightly
    // scorer processes fantasy competitions from existing/regressed data even on
    // nights DCI hasn't published (or held) real shows. So Articles 1–4 — which
    // are built entirely from this day's DCI scores — require dayScores, but the
    // fantasy RESULTS article (Article 5) only needs the processed fantasy recap.
    const hasFantasyResults = Boolean(
      fantasyData?.current &&
      (fantasyData.current.shows || []).some(s => (s.results || []).length > 0)
    );

    // Nothing to write about at all — no DCI field AND no fantasy results. Bail
    // cleanly and let the caller fall back to legacy generation instead of
    // crashing downstream on an undefined top/feature corps.
    if (!hasDciScores && !hasFantasyResults) {
      logger.warn(`No DCI scores or fantasy results for Day ${reportDay}; skipping article generation.`);
      return { success: false, error: `No scores for day ${reportDay}` };
    }
    if (!hasDciScores) {
      logger.warn(`No DCI scores for Day ${reportDay}; generating the fantasy-results article only (DCI-sourced articles 1–4 skipped).`);
    }

    // Trend/caption/brief data is derived entirely from the DCI day scores and is
    // only consumed by Articles 1–4; skip it when there are no DCI scores.
    const trendData = hasDciScores ? calculateTrendData(historicalData, reportDay, activeCorps) : {};
    const captionLeaders = hasDciScores ? identifyCaptionLeaders(dayScores, trendData) : {};

    // Field-relative season context (percentile strength per caption family vs
    // the whole field this season). One extra read; degrades to {} when the
    // dci-stats doc isn't present, so articles simply omit the season-context
    // block rather than failing.
    const seasonStats = hasDciScores ? await fetchSeasonStats(db, seasonId) : null;
    const seasonContext = hasDciScores ? buildSeasonContext(seasonStats, activeCorps) : {};
    if (hasDciScores) {
      logger.info(`Season context for Day ${reportDay}: ${Object.keys(seasonContext).length} corps with field-relative stats${seasonStats ? '' : ' (dci-stats unavailable — omitted)'}`);
    }

    // Analyze competition context for dynamic tone. With no DCI scores this
    // returns a safe "standard" default, which the fantasy-results article uses
    // only for tone guidance.
    const competitionContext = analyzeCompetitionContext(dayScores, trendData, reportDay);
    const toneDescriptor = getToneDescriptor(competitionContext);
    logger.info(`Competition context for Day ${reportDay}: ${toneDescriptor} (${competitionContext.scenario}, ${competitionContext.seasonPhase} season, lead margin: ${competitionContext.leadMargin})`);

    // Coverage ledger: records what earlier articles have already used so later
    // articles can be given explicit "negative space" instructions. Replaces the
    // previous Set-based exclusion that only covered articles 1–3.
    const ledger = createCoverageLedger();

    // Editorial brief: deterministic pre-pass that assigns each article a
    // pre-computed angle (lead / trajectory / caption / market / fantasy) so
    // the five articles don't all fight over the obvious hook. Only the DCI
    // articles consume it, so it's skipped when there are no DCI scores.
    const brief = hasDciScores ? buildEditorialBrief({ dayScores, trendData, fantasyData, reportDay }) : null;
    if (brief) {
      logger.info(`Editorial brief for Day ${reportDay}: lead=${brief.lead?.subject || 'n/a'} | trajectory=${brief.trajectory?.corps || 'n/a'} | caption=${brief.caption?.family || 'n/a'} | market=${brief.market?.topBuy || 'n/a'}`);
    }

    // Build metadata up front so each article can be persisted the moment it is
    // generated. Image generation is slow (Gemini 3 Pro Image can take minutes per
    // article), so producing all five before saving risks the caller's function
    // timing out with nothing written. Persisting incrementally guarantees that
    // whatever finished before a timeout is still visible on the news feed/admin.
    // Articles 1–4 are DCI-sourced; Article 5 is the fantasy-results piece.
    const expectedArticleCount = (hasDciScores ? 4 : 0) + (hasFantasyResults ? 1 : 0);
    const metadata = {
      reportDay,
      currentDay,
      corpsCount: hasDciScores ? dayScores.length : 0,
      showName: showContext.showName,
      location: showContext.location,
      date: showContext.date,
      allShows: showContext.allShows,
      articleCount: expectedArticleCount,
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

    // Articles 1–4 are sourced from this day's DCI scores. On nights DCI didn't
    // publish (or hold) shows, dayScores is empty and these are skipped entirely
    // so the fantasy-results article can still be written from processed recaps.
    if (hasDciScores) {
      // Article 1: DCI DAILY - Today's competition results with score breakdown
      await persist(await generateDciDailyArticle({
        reportDay, dayScores, trendData, seasonContext, activeCorps, showContext, competitionContext, db, ledger, brief, isLiveSeason
      }));

      // Article 2: DCI FEATURE - Single corps season progress spotlight
      await persist(await generateDciFeatureArticle({
        reportDay, dayScores, trendData, seasonContext, activeCorps, showContext, competitionContext, db, ledger, brief, isLiveSeason
      }));

      // Article 3: on Podium week boundaries the Podium Report power
      // rankings replace the DCI caption deep-dive (decision 31) — the
      // column is deterministic player-facing data, composed directly so
      // corps names and ranks can never be hallucinated. Every other night
      // stays the DCI recap.
      let podiumArticle = null;
      if (reportDay % 7 === 0) {
        try {
          const { generatePodiumReportArticle } = require("./newsPodiumArticle");
          const candidate = await generatePodiumReportArticle({
            db, seasonUid: seasonId, competitionDay: reportDay, reportDay,
          });
          if (candidate && candidate.podiumWeek === reportDay / 7) podiumArticle = candidate;
        } catch (podiumError) {
          logger.warn(`Podium Report article unavailable (falling back to DCI recap): ${podiumError.message}`);
        }
      }
      if (podiumArticle) {
        await persist(podiumArticle);
      } else {
        // DCI RECAP - Pure caption deep-dive (GE, Visual, Music). Descriptive, not prescriptive.
        await persist(await generateDciRecapArticle({
          reportDay, dayScores, trendData, seasonContext, captionLeaders, activeCorps, showContext, competitionContext, db, ledger, brief, isLiveSeason
        }));
      }

      // Article 4: FANTASY MARKET REPORT - Owns buy/hold/sell picks for the day (descriptive caption analysis already done in Article 3).
      await persist(await generateFantasyRecapArticle({
        reportDay, dayScores, trendData, seasonContext, activeCorps, showContext, competitionContext, db, ledger, brief, isLiveSeason
      }));
    }

    // Article 5: FANTASY DAILY - Fantasy competition results with score breakdown
    // (generated last to appear first in feed). Independent of DCI scores, so it
    // runs whenever the day's fantasy competitions actually produced results.
    if (hasFantasyResults) {
      await persist(await generateFantasyDailyArticle({
        reportDay, fantasyData, showContext, competitionContext, db, dataDocId, ledger
      }));
    }

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
