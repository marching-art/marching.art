// Shared plumbing for the nightly article generators: article type ids,
// fantasy event-name branding, the cross-article coverage ledger, generated
// image upload/placeholder handling, and the data-error fallback article.
// Extracted verbatim from newsGeneration.js.

const { logger } = require("firebase-functions/v2");
const { uploadFromUrl, getContextualPlaceholder } = require("./mediaService");

// =============================================================================
// CONSTANTS
// =============================================================================

// Mirror of @google/genai's Type enum (plain strings, verified by a unit
// test against the real SDK). The article schema literals reference these
// dozens of times at module load; importing the enum from the SDK pulled the
// entire @google/genai package into EVERY function's cold start, since
// index.js loads all modules. Only the generation calls need the SDK itself
// (required lazily in geminiService).
const Type = {
  TYPE_UNSPECIFIED: "TYPE_UNSPECIFIED",
  STRING: "STRING",
  NUMBER: "NUMBER",
  INTEGER: "INTEGER",
  BOOLEAN: "BOOLEAN",
  ARRAY: "ARRAY",
  OBJECT: "OBJECT",
  NULL: "NULL",
};

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
// LONG-FORM MAGAZINE VOICE
// -----------------------------------------------------------------------------
// The house voice for every LLM-written article. The site's articles are written
// as long-form narrative features (The Atlantic / ESPN The Magazine / Texas
// Monthly / Grantland), not wire recaps or box scores. This block sets the
// register, the craft rules, and an expanded ban on generic-AI phrasing. It is
// deliberately paired in every prompt with NEWS_INTEGRITY_RULES: the drama is
// built ENTIRELY from the real data — nothing is fictional. "Dramatize the
// scores" never means "invent a scene."
// =============================================================================
const MAGAZINE_STYLE = `VOICE — LONG-FORM MAGAZINE FEATURE
Write this as narrative nonfiction — a long-form magazine feature in the tradition of The Atlantic, Texas Monthly, ESPN The Magazine, and Grantland — not a wire recap, a box score, or an Axios-style brief. You are a seasoned writer who has covered this competition for years. The prose is confident, unhurried, and observational. No hype, no marketing language, no inspirational filler.

Build the piece as a STORY:
- Open on a specific, concrete detail drawn from the real results — a margin, a number that argues with itself, a corps arriving from nowhere — never a throat-clearing "through Day N…" or "the stage is set" summary.
- Give it a dramatic arc: establish the stakes, build tension through the middle, move toward the results as a climax, and land the close on a resonant, concrete beat (a real number, a real question the next show answers).
- Treat the competitors as characters, drawing their motivation, history, and stakes from what the data shows — a corps chasing its first lead, a favorite losing ground it can't afford to lose, a program whose whole week has bent toward tonight. A competitive persona built from real results is character. Never put invented words, private feelings, or actions in a real person's mouth (the corps, directors, and performers are real people you have not interviewed) — a competitor's stakes reach the page through what the scores show.
- Make the judging a source of tension. The scoring captions are contested ground and the margins are the drama: show where the night was won or lost on the sheets, not just who placed where.
- Control the pace — slow down for the decisive moments, move quickly through connective material — and vary sentence length and rhythm so short lines land after long ones.
- Write in flowing paragraphs. NO bullet points, NO numbered lists inside the prose, NO summary boxes, no clipped teaser sign-offs. (Structured data fields you also fill are separate from the narrative and do not count against this.)

KILL GENERIC-AI PHRASING. On top of the BANNED PHRASES listed below, never use: unveils, showcases, showcasing, delves, delve into, explores, exploring, in the realm of, realm, landscape, dynamic, intricate, nuanced, journey, underscores, at the heart of, tapestry, testament, weaves, weaving, boasts, elevates, dazzling, mesmerizing, a symphony of, ever-evolving, notably, moreover, furthermore. Replace every abstraction with a concrete specific and a strong verb. If a sentence could sit unchanged in a generic AI article, sharpen it or cut it.`;

// Strict grounding for the real-DCI pieces (daily / feature / recap). These cover
// real drum corps and real historical scores, so they carry the tightest rule the
// site enforces: dramatize the scores, invent NOTHING. The magazine voice sets the
// register; this keeps the register honest.
const DCI_GROUNDING = `GROUNDING (real corps, real scores — dramatize the numbers, invent nothing)
This piece is about real drum corps and their real scores, and it must be 100% factual. Build all of the drama out of the competitive facts in the DATA block — the margins, the caption battles, the day-over-day swings, the season arcs, the shape of the standings. Do NOT invent weather, crowd noise, stadium detail, backstage moments, dialogue, private feelings, or any venue color the data doesn't name. Your "scenes" are the results themselves, rendered precisely. If a detail is not in the DATA block, it does not go in the article.`;

// Fantasy-world scene grounding. Added only to the articles about the game's own
// ensembles (fantasy results, season summary, podium) — NOT the real-DCI pieces,
// which carry the stricter DCI_GROUNDING above. These pieces may frame the night
// as a scene, and the strongest atmosphere is REAL atmosphere: the venue/city and
// date come from the DATA block, the season/time-of-year follows from that real
// date (an off-season winter show genuinely reads differently from a July night),
// and a SETTING/ENVIRONMENT line — when present — carries real weather to draw on.
// The hard facts (scores, margins, counts, roster picks) and real people (the
// directors) stay governed by NEWS_INTEGRITY_RULES; this only opens the scene.
const FANTASY_SETTING_GUIDANCE = `SETTING (build the scene on real facts first)
This is the game's own competition, so you may frame the night as a scene rather than a bare recap. Reach for the real details first — they are the good stuff:
- Place the night at the actual venue/city named in the data and situate it on its real calendar date. Let the time of year do real work: a show on a cold off-season date carries a different weight than a midsummer evening, and drawing that contrast is fair because it is true.
- When a SETTING/ENVIRONMENT line supplies real weather or conditions, build the atmosphere from it. When it doesn't, you may still set a spare, plausible scene, but never present an invented specific — an exact temperature, a named landmark, a crowd count — as though it were reported.
- The ensembles are your characters, drawn from their real results; their directors are real people. Never quote a director, paraphrase them, or assign them a feeling or an action. A director's stakes reach the page only through what their ensemble did on the field.`;

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
    url: getContextualPlaceholder({ newsCategory: category, headline: "" }),
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
  PODIUM: "podium", // The daily Podium Report power-rankings column
  DAILY: "daily", // New unified category
  // Director-authored press releases about their OWN organization — instant,
  // un-reviewed community content. Distinct from admin-reviewed news
  // submissions (which cover the shared world: competition, rivalries, circuit).
  PRESS: "press",
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
  // The Podium Report (decision 31) is the daily Podium Class power-rankings
  // column; it gets its own category rather than riding under Analysis.
  if (articleType === "podium_report") return NEWS_CATEGORIES.PODIUM;
  // Season summary is a season-to-date analytical deep dive (Article 6).
  if (articleType === "season_summary") return NEWS_CATEGORIES.ANALYSIS;
  // Director press releases (press_<id>) carry their own category.
  if (articleType.startsWith("press_")) return NEWS_CATEGORIES.PRESS;
  // DCI and Fantasy articles by prefix
  if (articleType.startsWith("dci_")) return NEWS_CATEGORIES.DCI_RECAP;
  if (articleType.startsWith("fantasy_")) return NEWS_CATEGORIES.FANTASY;
  return NEWS_CATEGORIES.DCI_RECAP; // Default to dci
}

module.exports = {
  NEWS_CATEGORIES,
  getCategoryFromType,
  Type,
  ARTICLE_TYPES,
  NEWS_INTEGRITY_RULES,
  MAGAZINE_STYLE,
  DCI_GROUNDING,
  FANTASY_SETTING_GUIDANCE,
  formatFantasyEventName,
  cleanLocation,
  createCoverageLedger,
  formatNegativeSpace,
  processGeneratedImage,
  createFallbackArticle,
};
