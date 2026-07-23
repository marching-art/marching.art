// @ts-nocheck -- grandfathered when functions checkJs landed (functions/tsconfig.json); remove when this file is typed or cleaned up
// =============================================================================
// NEWS VALIDATION & JSON PARSING
// =============================================================================
// Pure helpers extracted from newsGeneration.js: AI-output JSON parsing/repair
// and the fact-check guards (banned phrases, hallucinated corps, unsourced
// numbers). Kept dependency-light so they are unit-testable.

const { logger } = require("firebase-functions/v2");

const HARD_BANNED_PATTERNS = [
  /\bmid-season phase\b/i,
  /\bupward trend\b/i,
  /\bdownward trend\b/i,
  /\bheating up\b/i,
  /\bcaptivating\b/i,
  /\btestament\b/i,
  /\bsetting the stage\b/i,
  /\babsolutely crucial\b/i,
  /\bforce to be reckoned with\b/i,
  /\bdynasty in the making\b/i,
  /\bstakes are high\b/i,
  /\bevery point matters\b/i,
  /\btune in tomorrow\b/i,
  /\bemerging as a true contender\b/i,
  /\bproves their mettle\b/i,
];

// Tolerance for number matching. 0.005 means "77.850" in the DATA block
// satisfies "77.85" in the article (typical 2-decimal rounding). Anything
// looser and hallucinated scores slip through; anything tighter and
// legitimate rounded citations get flagged.
const NUMBER_MATCH_TOLERANCE = 0.005;

// Canon of DCI World/Open Class corps that appear in historical data. Used
// to catch hallucinations: if an article names a corps from this list that
// isn't in tonight's dayScores, Gemini likely invented its inclusion from
// general DCI knowledge rather than the prompt's data block. Restricted to
// multi-word names to avoid false positives on common words ("colts", "gold"
// etc. could match innocuous text; "Jersey Surf" is unambiguous).
const DCI_CORPS_CANON = [
  "Blue Devils",
  "Blue Knights",
  "Blue Stars",
  "Bluecoats",
  "Boston Crusaders",
  "The Cadets",
  "The Cavaliers",
  "Carolina Crown",
  "Crossmen",
  "Jersey Surf",
  "Madison Scouts",
  "Music City",
  "Pacific Crest",
  "Phantom Regiment",
  "Santa Clara Vanguard",
  "Seattle Cascades",
  "Spirit of Atlanta",
  "The Academy",
  "Genesis",
  "Les Stentors",
  "Louisiana Stars",
  "River City Rhythm",
  "Vanguard Cadets",
];

/**
 * Collect every user-visible text field from a generated article into a
 * single corpus string. Shared by both validators so they see the same view
 * of the article.
 */
function collectArticleText(content) {
  if (!content || typeof content !== "object") return "";

  const fields = [
    content.headline,
    content.summary,
    content.narrative,
    content.fantasyImpact,
    content.captionInsights?.geInsight,
    content.captionInsights?.visualInsight,
    content.captionInsights?.musicInsight,
    content.captionBreakdown?.geAnalysis,
    content.captionBreakdown?.visualAnalysis,
    content.captionBreakdown?.musicAnalysis,
    ...(Array.isArray(content.insights)
      ? content.insights.flatMap(i => [i?.metric, i?.finding, i?.implication])
      : []),
    ...(Array.isArray(content.trendingCorps) ? content.trendingCorps.map(t => t?.reason) : []),
    ...(Array.isArray(content.recommendations) ? content.recommendations.map(r => r?.reasoning) : []),
    ...(content.recommendations?.buy?.map?.(r => r?.reason) || []),
    ...(content.recommendations?.hold?.map?.(r => r?.reason) || []),
    ...(content.recommendations?.sell?.map?.(r => r?.reason) || []),
  ];

  return fields.filter(Boolean).join("\n\n");
}

function detectBannedPhrases(content) {
  const corpus = collectArticleText(content);
  if (!corpus) return [];

  const hits = new Set();
  for (const pattern of HARD_BANNED_PATTERNS) {
    const match = corpus.match(pattern);
    if (match) hits.add(match[0]);
  }
  return Array.from(hits);
}

/**
 * Extract every decimal number inside the prompt's DATA block. Returns a Set
 * of numeric values. If no DATA markers are present (e.g., legacy prompts),
 * returns null, which the number validator reads as "skip this check".
 */
function extractDataBlockNumbers(prompt) {
  const dataMatch = prompt.match(/=====\s*DATA\s*=====([\s\S]*?)=====\s*END DATA\s*=====/);
  if (!dataMatch) return null;

  const decimals = dataMatch[1].match(/-?\d+\.\d+/g) || [];
  const nums = new Set();
  for (const raw of decimals) {
    const n = parseFloat(raw);
    if (Number.isFinite(n)) nums.add(n);
  }
  return nums;
}

/**
 * Flag any DCI_CORPS_CANON corps name that appears in the article but NOT
 * in tonight's field. Returns unique matched names. Case-insensitive match
 * but returns canonical casing. Skips the check when fieldCorpsNames isn't
 * provided (e.g., legacy callers).
 */
function detectHallucinatedCorps(content, fieldCorpsNames) {
  if (!fieldCorpsNames) return [];
  const corpus = collectArticleText(content);
  if (!corpus) return [];

  const fieldSet = new Set(fieldCorpsNames);
  const hallucinated = new Set();
  for (const canonCorps of DCI_CORPS_CANON) {
    if (fieldSet.has(canonCorps)) continue;
    // Whole-word / phrase match, case-insensitive, whitespace-flexible
    const escaped = canonCorps.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    const pattern = new RegExp(`\\b${escaped}\\b`, "i");
    if (pattern.test(corpus)) hallucinated.add(canonCorps);
  }
  return Array.from(hallucinated);
}

/**
 * Flag decimal numbers in the generated article that don't have a
 * corresponding value (within NUMBER_MATCH_TOLERANCE) in the DATA block.
 * Returns an array of unique unsourced number strings (as they appeared in
 * the article) so the retry prompt can quote them back verbatim.
 */
function detectUnsourcedNumbers(content, dataNumbers) {
  if (!dataNumbers) return [];
  const corpus = collectArticleText(content);
  if (!corpus) return [];

  const matches = corpus.match(/-?\d+\.\d+/g) || [];
  const dataArr = Array.from(dataNumbers);
  const unsourced = new Set();
  for (const raw of matches) {
    const n = parseFloat(raw);
    if (!Number.isFinite(n)) continue;
    const found = dataArr.some(d => Math.abs(d - n) <= NUMBER_MATCH_TOLERANCE);
    if (!found) unsourced.add(raw);
  }
  return Array.from(unsourced);
}

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
 * Repair common JSON issues from AI responses
 */
function repairJson(text) {
  let repaired = text;

  // Remove any leading/trailing whitespace
  repaired = repaired.trim();

  // Handle unescaped newlines within strings
  // This regex finds strings and replaces actual newlines with \n
  repaired = repaired.replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, (match) => {
    return match
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/\t/g, "\\t");
  });

  // Remove trailing commas before closing brackets/braces
  repaired = repaired.replace(/,\s*([\]}])/g, "$1");

  // Remove control characters (except those in escape sequences). The control
  // chars in this class are intentional — we are sanitizing raw AI output.
  // eslint-disable-next-line no-control-regex
  repaired = repaired.replace(/[\x00-\x1F\x7F]/g, (char) => {
    // Keep escaped versions
    if (char === "\n" || char === "\r" || char === "\t") {
      return char;
    }
    return "";
  });

  return repaired;
}

/**
 * Safely parse JSON from AI response with repair attempts
 */
function parseAiJson(text) {
  const cleaned = cleanJsonResponse(text);

  // First try: direct parse
  try {
    return JSON.parse(cleaned);
  } catch (firstError) {
    // Second try: repair and parse
    try {
      const repaired = repairJson(cleaned);
      return JSON.parse(repaired);
    } catch {
      // Third try: extract JSON object/array from text
      try {
        // Find the first { or [ and last } or ]
        const firstBrace = cleaned.indexOf("{");
        const firstBracket = cleaned.indexOf("[");
        const start = firstBrace >= 0 && (firstBracket < 0 || firstBrace < firstBracket)
          ? firstBrace
          : firstBracket;

        if (start >= 0) {
          const isObject = cleaned[start] === "{";
          const lastBrace = cleaned.lastIndexOf(isObject ? "}" : "]");
          if (lastBrace > start) {
            const extracted = cleaned.slice(start, lastBrace + 1);
            const repaired = repairJson(extracted);
            return JSON.parse(repaired);
          }
        }
      } catch {
        // Log the original text for debugging
        logger.error("JSON parse failed after all repair attempts. Original text:", {
          textLength: cleaned.length,
          textPreview: cleaned.substring(0, 500),
        });
      }

      // Re-throw the original error with more context
      const error = new Error(`JSON parse failed: ${firstError.message}`);
      error.originalText = cleaned.substring(0, 500);
      throw error;
    }
  }
}

module.exports = {
  HARD_BANNED_PATTERNS,
  NUMBER_MATCH_TOLERANCE,
  DCI_CORPS_CANON,
  collectArticleText,
  detectBannedPhrases,
  extractDataBlockNumbers,
  detectHallucinatedCorps,
  detectUnsourcedNumbers,
  cleanJsonResponse,
  repairJson,
  parseAiJson,
};
