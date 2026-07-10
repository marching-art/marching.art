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
  SEASON_SUMMARY: "season_summary",   // Article 6: RARE season-to-date summary published on scored days (15–49) with no events to score
};

/**
 * Format event name for fantasy articles - replaces 'DCI' with 'marching.art'
 * This keeps branding consistent since fantasy competitions are on marching.art platform
 */
function formatFantasyEventName(name) {
  if (!name) return "";
  return name.replace(/\bDCI\b/g, "marching.art");
}

// Placeholder venue strings the scraper/importer write when they can't extract a
// real location (see scraping.js / scoreProcessing.js / pressboxImporter). They
// are truthy, so without normalizing them they slip through every `location || …`
// fallback and end up printed verbatim ("held at an Unknown Location"). Treat
// them as "no known location" so the articles omit the venue gracefully instead
// of surfacing a placeholder.
const PLACEHOLDER_LOCATIONS = new Set([
  "unknown location",
  "unknown",
  "competition venue",
  "location tbd",
  "venue tbd",
  "tbd",
  "tba",
  "n/a",
  "na",
  "-",
]);

/**
 * Normalize a location string: returns a trimmed real location, or null when the
 * value is empty or one of the known scraper placeholders. Use this everywhere a
 * venue enters the article/metadata pipeline so "Unknown Location" never reaches
 * a reader.
 */
function cleanLocation(loc) {
  if (loc == null || typeof loc !== "string") return null;
  const trimmed = loc.trim();
  if (!trimmed) return null;
  return PLACEHOLDER_LOCATIONS.has(trimmed.toLowerCase()) ? null : trimmed;
}

// =============================================================================
// INTEGRITY RULES
// -----------------------------------------------------------------------------
// The professionalism contract shared by every nightly article. Kept in one
// place so the five generators can't drift on the fundamentals: don't invent
// facts, don't fabricate quotes from real people, and quote the numbers exactly
// as the data provides them. Each generator interpolates this block near the top
// of its prompt and then adds only the rules specific to its own data shape.
// =============================================================================
const NEWS_INTEGRITY_RULES = `INTEGRITY RULES (non-negotiable — apply to the entire article)
- Facts come only from the DATA block. Every corps/ensemble name, score, caption number, margin, placement, date, show name, and location must match the data exactly. If a detail isn't in the data, leave it out — never fill a gap with plausible-sounding invention.
- No fabricated quotes or reactions. The corps, directors, and performers are real and you have not interviewed anyone. Never write or imply a direct quote, a paraphrased statement, or a private feeling ("X said…", "the staff were frustrated", "you could sense the relief"). Convey stakes through what the scores show, not through words put in a real person's mouth.
- Numbers verbatim. Cite scores exactly as written, and use the margins and gaps already computed in the DATA block as-is — do not recompute, re-derive, or re-round them, and never state a margin the data doesn't provide. Approximate prose ("about three-tenths back") is fine only when it matches a value that's actually in the data.`;

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
 * Create fallback article when generation fails.
 * Carries no image: the DCI articles never have imagery by design, and a
 * "check back shortly" stub gains nothing from an unrelated stock photo.
 */
function createFallbackArticle(type, reportDay) {
  return {
    type,
    headline: `Day ${reportDay} ${type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`,
    summary: "Analysis is being processed. Check back shortly.",
    narrative: "Full analysis will be available soon.",
    imageUrl: null,
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
  // The Podium Report (decision 31) is the weekly power-rankings column.
  if (articleType === "podium_report") return NEWS_CATEGORIES.ANALYSIS;
  // Season summary is a season-to-date analytical deep dive (Article 6).
  if (articleType === "season_summary") return NEWS_CATEGORIES.ANALYSIS;
  // DCI and Fantasy articles by prefix
  if (articleType.startsWith("dci_")) return NEWS_CATEGORIES.DCI_RECAP;
  if (articleType.startsWith("fantasy_")) return NEWS_CATEGORIES.FANTASY;
  return NEWS_CATEGORIES.DCI_RECAP; // Default to dci
}

module.exports = {
  NEWS_CATEGORIES,
  getCategoryFromType,
  ARTICLE_TYPES,
  NEWS_INTEGRITY_RULES,
  formatFantasyEventName,
  cleanLocation,
  createCoverageLedger,
  formatNegativeSpace,
  processGeneratedImage,
  createFallbackArticle,
};
