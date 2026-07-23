// @ts-nocheck -- grandfathered when functions checkJs landed (functions/tsconfig.json); remove when this file is typed or cleaned up
// Gemini client service for news generation: lazy client init, structured
// JSON content generation with parse safety, the banned-phrase/hallucination
// fact-check guard, and drum-corps-grounded image generation. Extracted
// verbatim from newsGeneration.js.

// @google/genai is required lazily inside the client init: every function in
// the deploy unit loads this module at cold start (index.js requires all
// modules), and only the news/avatar paths ever construct the client.
const { logger } = require("firebase-functions/v2");
const { defineSecret } = require("firebase-functions/params");
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
// GEMINI INITIALIZATION
// =============================================================================

function initializeGemini() {
  if (!genAI) {
    const apiKey = geminiApiKey.value();
    if (!apiKey) {
      throw new Error("GOOGLE_GENERATIVE_AI_API_KEY secret is not set");
    }
    const { GoogleGenAI } = require("@google/genai");
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
CRITICAL CONTEXT - DRUM AND BUGLE CORPS (NOT A CONCERT, NOT A SPORTS TEAM):

This is DCI (Drum Corps International) - competitive marching arts. Performers are
MUSICIANS, not athletes in sports gear. They perform on an American football field,
but that is only the venue: they are NOT football players, they wear NO football
helmets, shoulder pads, jerseys, or any sports/athletic protective helmet of any kind.

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
  When headwear IS worn it is marching-arts headwear ONLY - a shako (tall marching
  band hat), busby, Aussie/campaign hat, beret, or a sleek themed marching helmet
  worn with a plume. It is NEVER a football helmet, hockey helmet, motorcycle helmet,
  or any sports/protective helmet. If uniform details say "helmet," interpret it as a
  decorative marching-band helmet/shako, not athletic headgear.
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
- Football helmets, sports helmets, hockey/motorcycle/protective helmets of ANY kind
- Football players, shoulder pads, jerseys, or any American football / sports uniform
- Any hard athletic headgear with a face mask, chin strap, or ear holes
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
- This is DCI drum corps - marching MUSICIANS, NOT a rock concert, orchestra, or sports team
- Performers wear marching-arts uniforms and (if any) marching band headwear. NEVER football helmets, sports helmets, shoulder pads, or any athletic protective gear
- Each performer holds ONLY ONE instrument type (brass OR drums OR flag - never multiple)
- Use the EXACT uniform colors and details specified above - do not substitute generic designs
- CLOSE-UP ONLY: Show 2-6 performers maximum, filling the frame. Do NOT show the full corps or wide formation.
- FIELD-LEVEL CAMERA: Shoot from eye level on the field, NOT from elevated, aerial, or press box positions.
- SHALLOW DEPTH OF FIELD: Performers in sharp focus, background (stadium, crowd, field) as soft bokeh.
${referenceImages.length > 0 ? "- REFERENCE IMAGES: The attached photo(s) show this corps' actual uniform, colors, and instrumentation. Match the uniform design, marching headwear/plume, and instrument types in the reference exactly — the references define ground truth, not your priors." : ""}
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

module.exports = {
  initializeGemini,
  generateStructuredContent,
  generateWithFactCheckGuard,
  generateImageWithImagen,
  // Exported so callers can pin an explicit tier instead of relying on the
  // USE_PAID_IMAGE_GEN default: nightly fantasy-corps article images use
  // PAID_IMAGE_MODEL; profile uniform/logo avatars use FREE_IMAGE_MODEL.
  PAID_IMAGE_MODEL,
  FREE_IMAGE_MODEL,
  DRUM_CORPS_VISUAL_CONTEXT,
  IMAGE_NEGATIVE_PROMPT,
};
