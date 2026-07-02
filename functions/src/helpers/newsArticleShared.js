// Shared plumbing for the nightly article generators: article type ids,
// fantasy event-name branding, the cross-article coverage ledger, generated
// image upload/placeholder handling, and the data-error fallback article.
// Extracted verbatim from newsGeneration.js.

const { logger } = require("firebase-functions/v2");
const { uploadFromUrl, getContextualPlaceholder } = require("./mediaService");

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

/**
 * NewsHub Categories
 */
const NEWS_CATEGORIES = {
  DCI_RECAP: "dci",
  FANTASY: "fantasy",
  ANALYSIS: "analysis",
  DAILY: "daily", // New unified category
};

/**
 * Derives category from article type for consistent categorization
 * @param {string} articleType - The article type (e.g., "dci_recap", "fantasy_recap")
 * @returns {string} The category ("dci", "fantasy", or "analysis")
 */
function getCategoryFromType(articleType) {
  // Analysis articles - check specific types before prefix matching
  if (articleType === "dci_recap") return NEWS_CATEGORIES.ANALYSIS;
  if (articleType === "deep_analytics") return NEWS_CATEGORIES.ANALYSIS;
  // DCI and Fantasy articles by prefix
  if (articleType.startsWith("dci_")) return NEWS_CATEGORIES.DCI_RECAP;
  if (articleType.startsWith("fantasy_")) return NEWS_CATEGORIES.FANTASY;
  return NEWS_CATEGORIES.DCI_RECAP; // Default to dci
}

module.exports = {
  NEWS_CATEGORIES,
  getCategoryFromType,
  ARTICLE_TYPES,
  formatFantasyEventName,
  createCoverageLedger,
  formatNegativeSpace,
  processGeneratedImage,
  createFallbackArticle,
};
