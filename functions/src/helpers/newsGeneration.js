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
// Comprehensive uniform descriptions by corps and year for image generation
// Includes equipment details, helmet/shako styles, and section-specific elements
// =============================================================================

const DCI_UNIFORMS = {
  "Blue Devils": {
    default: {
      uniform: "navy blue military-style uniform with silver trim and white baldric",
      helmet: "silver shako with tall white horsehair plume",
      brass: "silver-plated King brass instruments with navy blue valve caps",
      percussion: "Pearl drums with navy blue shells, silver hardware, Zildjian cymbals",
      guard: "navy and silver unitards with flowing silver capes",
    },
    2018: {
      uniform: "deep midnight blue uniforms with metallic silver geometric accents, asymmetrical chest design with flowing navy capes",
      helmet: "chrome-finished helmet with fiber optic lighting elements and white plume",
      brass: "Dynasty brass with silver finish, illuminated bell covers during ballad",
      percussion: "Pearl Championship drums, navy shells with LED rim lighting",
      guard: "midnight blue with silver holographic fabric, 6-foot silk flags in navy and silver",
    },
    2019: {
      uniform: "navy blue with geometric silver angular patterns, modern athletic cut with metallic chest plate",
      helmet: "streamlined chrome visor helmet with blue LED accents",
      brass: "polished silver brass, contoured ergonomic grips",
      percussion: "transparent blue acrylic shells on snares, navy tenors",
      guard: "geometric silver and blue costumes, angular equipment in chrome",
    },
    2014: {
      uniform: "classic navy blue with white chest baldric, silver braiding, polished brass buttons in double-breasted style",
      helmet: "traditional tall silver shako with blue and white ostrich plume",
      brass: "traditional silver brass instruments with white valve guards",
      percussion: "white Pearl drums with silver hardware, traditional concert bass drums",
      guard: "classical white and navy gowns, traditional rifle and sabre",
    },
  },
  "Carolina Crown": {
    default: {
      uniform: "deep maroon with ornate gold filigree chest plate, burgundy sash",
      helmet: "gold-trimmed shako with maroon and gold plume featuring crown emblem",
      brass: "gold-lacquered Yamaha brass with burgundy valve caps",
      percussion: "Mapex drums with wine-red shells, gold lugs, Sabian cymbals",
      guard: "flowing burgundy and gold Renaissance-inspired costumes",
    },
    2013: {
      uniform: "deep burgundy with elaborate gold filigree armor-style chest plate, Renaissance royalty aesthetic",
      helmet: "ornate gold crown-shaped headpiece with burgundy velvet accents",
      brass: "gold-lacquered brass with etched crown designs on bells",
      percussion: "burgundy drums with gold crown emblems, matching marimba frames",
      guard: "Renaissance court costumes in deep burgundy velvet with gold trim, ceremonial flags",
    },
    2019: {
      uniform: "maroon base with rose gold metallic overlay panels, modern athletic silhouette with illuminated crown logo",
      helmet: "rose gold metallic helmet with built-in LED crown halo",
      brass: "rose gold-finished brass with modern ergonomic design",
      percussion: "maroon shells with rose gold hardware, electronic trigger pads",
      guard: "rose gold and maroon athletic wear with flowing fabric extensions",
    },
  },
  "The Cadets": {
    default: {
      uniform: "classic maroon with cream trim, military precision with brass buttons",
      helmet: "tall maroon busby-style shako with cream plume",
      brass: "silver brass instruments with maroon valve guards, Cadets crest on bells",
      percussion: "Pearl drums with maroon shells, silver hardware",
      guard: "maroon and cream military-inspired uniforms with traditional equipment",
    },
    2011: {
      uniform: "burgundy with gold rope braiding across chest, Revolutionary War inspired double-breasted design",
      helmet: "tricorn-influenced shako in burgundy with gold trim and cream cockade",
      brass: "antiqued brass finish instruments evoking colonial era",
      percussion: "field drums styled after Revolutionary War with rope tension",
      guard: "colonial-era costumes with tricorn hats, period-accurate flags",
    },
  },
  "Santa Clara Vanguard": {
    default: {
      uniform: "scarlet red with white and gold trim, dramatic Spanish-influenced design with flowing capes",
      helmet: "traditional shako with tall red and white plume",
      brass: "gold-lacquered brass with red bell covers",
      percussion: "red Pearl drums with gold hardware, red-wrapped mallets",
      guard: "Spanish-inspired red and white costumes with dramatic capes and fans",
    },
    2018: {
      uniform: "rich scarlet with metallic gold trim, dramatic floor-length red capes with gold lining",
      helmet: "ornate gold-trimmed headpiece with cascading red plume",
      brass: "gold brass with red accents, Spanish-style bell decorations",
      percussion: "red shells with gold flake finish, traditional pit setup",
      guard: "flowing scarlet gowns with gold embroidery, Spanish fans and dramatic silks",
    },
  },
  "Bluecoats": {
    default: {
      uniform: "electric blue with white contemporary design, modern athletic cut",
      helmet: "chrome-finished modern helmet with blue accents",
      brass: "silver brass with blue LED accents during evening shows",
      percussion: "blue Mapex drums with chrome hardware, electronic integration",
      guard: "contemporary blue and white athletic wear with technology elements",
    },
    2016: {
      uniform: "electric blue with silver geometric circuit-board patterns, futuristic LED-integrated panels",
      helmet: "chrome visor helmet with programmable LED strip, no traditional plume",
      brass: "custom silver brass with blue LED rings around bells",
      percussion: "transparent blue acrylic drums with internal LED lighting",
      guard: "futuristic silver and blue bodysuits with fiber optic elements, LED props",
    },
  },
  "Phantom Regiment": {
    default: {
      uniform: "deep maroon and black with dramatic theatrical design, flowing opera capes",
      helmet: "black and maroon shako with skull regiment insignia",
      brass: "dark lacquered brass with phantom skull bell engravings",
      percussion: "black drums with maroon accents, dramatic cymbal work",
      guard: "theatrical black and maroon costumes with phantom masks and capes",
    },
    2008: {
      uniform: "deep burgundy with black velvet trim, full-length opera capes with burgundy lining",
      helmet: "black helmet with Spartan-inspired crest and regiment skull emblem",
      brass: "dark nickel-finished brass with dramatic bell flares",
      percussion: "black shells with burgundy flame graphics, orchestral percussion",
      guard: "operatic burgundy and black costumes with dramatic masks",
    },
  },
  "Cavaliers": {
    default: {
      uniform: "hunter green with white trim, cavalier-inspired design with plumed hats",
      helmet: "classic cavalier hat with sweeping white plume",
      brass: "silver brass with green valve guards",
      percussion: "green Pearl drums with silver hardware",
      guard: "Three Musketeers inspired green and white costumes with rapiers",
    },
    2002: {
      uniform: "forest green military coat with white lapels and gold buttons, cavalier sash",
      helmet: "authentic cavalier hat with dramatic white ostrich plumes",
      brass: "polished silver brass with traditional French horn section",
      percussion: "traditional green drums with white heads, field drum heritage",
      guard: "cavalier-era costumes with capes, swords, and period flags",
    },
  },
  "Madison Scouts": {
    default: {
      uniform: "kelly green with gold trim, scout-inspired military design",
      helmet: "green shako with gold trim and green plume",
      brass: "gold-lacquered brass with scout emblem on bells",
      percussion: "green drums with gold hardware",
      guard: "green and gold military-inspired uniforms",
    },
  },
  "Boston Crusaders": {
    default: {
      uniform: "crimson red with colonial white and blue accents, Revolutionary War heritage",
      helmet: "tricorn-influenced design with red, white, and blue",
      brass: "silver brass with patriotic bell engravings",
      percussion: "red and white drums with Revolutionary field drum heritage",
      guard: "colonial-era inspired costumes with American Revolution flags",
    },
  },
  "Blue Stars": {
    default: {
      uniform: "royal blue with cascading silver star patterns, patriotic elegance",
      helmet: "blue shako with silver star emblem and white plume",
      brass: "silver brass with star engravings on bells",
      percussion: "blue drums with silver star decals",
      guard: "celestial blue and silver costumes with star-themed silks",
    },
  },
  "Mandarins": {
    default: {
      uniform: "crimson red with gold dragon embroidery, Asian-inspired flowing design",
      helmet: "ornate gold and red headpiece with dragon motifs",
      brass: "gold-lacquered brass with dragon engraving on bells",
      percussion: "red drums with gold dragon graphics, Asian percussion elements",
      guard: "flowing Asian-inspired crimson and gold costumes with fans and ribbons",
    },
  },
  "Troopers": {
    default: {
      uniform: "tan and brown cavalry style, Western frontier with yellow trim",
      helmet: "cavalry campaign hat with crossed sabers insignia",
      brass: "traditional brass finish with Western engravings",
      percussion: "brown drums with cavalry yellow accents",
      guard: "cavalry uniforms with Western elements, American flags",
    },
  },
  "Colts": {
    default: {
      uniform: "deep purple with silver accents, equestrian elegance",
      helmet: "purple shako with flowing silver mane-like plume",
      brass: "silver brass with purple valve caps and colt emblems",
      percussion: "purple drums with silver horse motifs",
      guard: "purple and silver costumes with flowing horse-mane elements",
    },
  },
  "Spirit of Atlanta": {
    default: {
      uniform: "scarlet red with white and black accents, phoenix and Southern heritage",
      helmet: "red shako with phoenix emblem and white plume",
      brass: "gold-lacquered brass with phoenix bell art",
      percussion: "red drums with flame graphics and phoenix imagery",
      guard: "phoenix-inspired red and orange costumes with flame silks",
    },
  },
  "Blue Knights": {
    default: {
      uniform: "royal blue with chrome armor plating, medieval knight aesthetic",
      helmet: "knight-style helmet with chrome visor and blue plume",
      brass: "chrome-finished brass with knight crest engravings",
      percussion: "blue drums with chrome hardware, shield graphics",
      guard: "medieval knight-inspired blue and silver armor costumes",
    },
  },
  "Crossmen": {
    default: {
      uniform: "royal blue with bold white cross patterns, modern design",
      helmet: "blue and white helmet with cross emblem",
      brass: "silver brass with blue accents",
      percussion: "blue and white drums with cross graphics",
      guard: "contemporary blue and white with cross motifs",
    },
  },
  "Pacific Crest": {
    default: {
      uniform: "ocean teal with white mountain peak imagery, Pacific Northwest",
      helmet: "teal helmet with silver mountain crest",
      brass: "silver brass with ocean wave engravings",
      percussion: "teal drums with white evergreen graphics",
      guard: "teal and white costumes with mountain and wave elements",
    },
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

/**
 * Format event name for fantasy articles - replaces 'DCI' with 'marching.art'
 * This keeps branding consistent since fantasy competitions are on marching.art platform
 */
function formatFantasyEventName(name) {
  if (!name) return "";
  return name.replace(/\bDCI\b/g, "marching.art");
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
    genAI = new GoogleGenerativeAI(apiKey);
    textModel = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-lite",
    });
  }
  return { genAI, textModel };
}

/**
 * Generate content with structured JSON output
 * Uses Gemini's native JSON mode for guaranteed valid JSON
 */
async function generateStructuredContent(prompt, schema) {
  const { genAI: ai } = initializeGemini();

  const model = ai.getGenerativeModel({
    model: "gemini-2.0-flash-lite",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  });

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  // Even with structured output, still use parseAiJson for safety
  return parseAiJson(text);
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

  // Remove control characters (except those in escape sequences)
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
    } catch (secondError) {
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
      } catch (thirdError) {
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

// =============================================================================
// FANTASY CORPS UNIFORM THEMES
// Comprehensive theme database for generating creative but realistic uniforms
// =============================================================================

const FANTASY_THEMES = {
  // Elemental themes
  fire: {
    colors: "deep crimson red with orange flame accents and gold trim",
    uniform: "athletic modern cut with flame gradient patterns rising from hem, ember-glow metallic thread",
    helmet: "red and gold helmet with flickering flame-shaped plume in orange and red",
    brass: "gold-lacquered brass instruments with flame engravings on bells",
    percussion: "red drums with orange flame graphics wrapping around shells",
    guard: "flowing orange and red costumes with flame-shaped silk flags, fire poi props",
  },
  ice: {
    colors: "crystalline white with ice blue and silver frost accents",
    uniform: "sleek white bodysuit with ice crystal patterns, silver geometric frost designs",
    helmet: "white helmet with icicle-shaped silver plume and frost-etched visor",
    brass: "chrome-silver brass with ice blue valve accents, frosted bell finish",
    percussion: "white drums with ice blue frost patterns, crystal-clear cymbal stands",
    guard: "white and ice blue costumes with crystalline fabric, snowflake-shaped flags",
  },
  thunder: {
    colors: "storm grey with electric blue lightning and silver metallic accents",
    uniform: "dark charcoal grey with electric blue lightning bolt patterns, silver metallic trim",
    helmet: "gunmetal grey helmet with electric blue LED accents and storm cloud plume",
    brass: "silver brass with blue lightning bolt engravings, storm grey valve caps",
    percussion: "grey drums with electric blue lightning graphics, chrome hardware",
    guard: "storm grey and electric blue costumes with lightning bolt props, silver flags",
  },
  storm: {
    colors: "deep purple with silver cloud patterns and rain-streak design",
    uniform: "purple uniform with swirling silver storm patterns, iridescent rain-streak fabric",
    helmet: "purple helmet with cascading silver plume like falling rain",
    brass: "silver brass with purple storm cloud engravings on bells",
    percussion: "purple drums with silver raindrop graphics",
    guard: "flowing purple and silver costumes with umbrella props and rain silk flags",
  },
  // Nature themes
  phoenix: {
    colors: "orange, red, and gold gradient with rising flame design",
    uniform: "warm gradient from red at hem to gold at shoulders, phoenix wing patterns",
    helmet: "gold helmet with dramatic red-orange-gold feathered plume rising like flames",
    brass: "gold brass with phoenix engravings, red-tinted bells",
    percussion: "gold drums with phoenix rising graphics, flame-colored heads",
    guard: "phoenix-inspired orange and gold costumes with wing-shaped capes, flame flags",
  },
  dragon: {
    colors: "crimson red with gold scale patterns and black accents",
    uniform: "red uniform with gold scale-patterned chest plate, dragon claw shoulder guards",
    helmet: "red and gold helmet with dragon horn-shaped plume, reptilian scale texture",
    brass: "gold brass with dragon scale engravings, serpentine bell decorations",
    percussion: "red drums with gold dragon scale graphics, dragon head bass drum art",
    guard: "crimson and gold costumes with dragon wing capes, serpentine flags",
  },
  wolf: {
    colors: "silver grey with black accents and amber highlights",
    uniform: "grey athletic cut with black wolf silhouette patterns, amber eye accents",
    helmet: "silver-grey helmet with black fur-textured plume, wolf ear shapes",
    brass: "silver brass with wolf pack engravings, grey valve caps",
    percussion: "grey drums with wolf pack graphics, paw print accents",
    guard: "grey and black costumes with fur-textured capes, moon-shaped props",
  },
  eagle: {
    colors: "brown and gold with white accents, patriotic undertones",
    uniform: "brown uniform with gold eagle wing patterns across chest, white trim",
    helmet: "gold helmet with dramatic brown and white feathered plume",
    brass: "gold brass with eagle engravings, bronze-tinted finish",
    percussion: "brown drums with gold eagle graphics, feather patterns",
    guard: "brown and gold costumes with wing-shaped capes, patriotic flags",
  },
  // Cosmic themes
  star: {
    colors: "midnight blue with silver stars and cosmic purple accents",
    uniform: "deep blue uniform with scattered silver star patterns, nebula purple accents",
    helmet: "midnight blue helmet with silver star-topped plume, constellation patterns",
    brass: "silver brass with star engravings, cosmic blue valve caps",
    percussion: "dark blue drums with silver star graphics, galaxy patterns",
    guard: "cosmic blue and silver costumes with star-shaped props, nebula flags",
  },
  nova: {
    colors: "deep purple with explosive white and gold starburst patterns",
    uniform: "purple uniform with white starburst patterns radiating from center, gold trim",
    helmet: "purple helmet with exploding star-shaped white and gold plume",
    brass: "gold brass with nova explosion engravings, purple accents",
    percussion: "purple drums with gold starburst graphics",
    guard: "purple and white costumes with starburst props, explosive silk choreography",
  },
  comet: {
    colors: "ice blue with white trail and silver sparkle accents",
    uniform: "ice blue uniform with white comet trail patterns, silver sparkle fabric",
    helmet: "ice blue helmet with streaming white plume like a comet tail",
    brass: "silver brass with comet engravings, ice blue valve caps",
    percussion: "ice blue drums with white trail graphics",
    guard: "ice blue and white costumes with streaming ribbon props, comet tail silks",
  },
  // Military/Power themes
  knight: {
    colors: "silver and royal blue with medieval armor aesthetic",
    uniform: "silver armor-plated chest design over royal blue, medieval heraldry",
    helmet: "knight helmet with royal blue plume, chrome face guard accents",
    brass: "chrome brass with knight crest engravings, blue valve guards",
    percussion: "silver and blue drums with shield graphics, sword accents",
    guard: "medieval knight costumes with armor elements, sword and shield props",
  },
  titan: {
    colors: "bronze and black with ancient Greek warrior design",
    uniform: "bronze armor-inspired chest plate over black, Greek key patterns",
    helmet: "bronze Spartan-style helmet with tall black horsehair crest",
    brass: "bronze-finished brass with Titan engravings",
    percussion: "black drums with bronze Greek patterns, ancient percussion",
    guard: "Greek warrior costumes with bronze armor, shield and spear props",
  },
  shadow: {
    colors: "matte black with deep purple undertones and silver accents",
    uniform: "matte black uniform with subtle purple shimmer, silver thread accents",
    helmet: "black helmet with purple-black gradient plume, mysterious silhouette",
    brass: "dark nickel brass with shadow engravings, black valve caps",
    percussion: "matte black drums with purple shadow graphics",
    guard: "all-black costumes with purple accents, shadow manipulation choreography",
  },
  // Color-based themes
  crimson: {
    colors: "deep crimson red with black and gold accents",
    uniform: "rich crimson uniform with black trim and gold embroidery",
    helmet: "crimson helmet with black and gold plume",
    brass: "gold brass with crimson valve caps",
    percussion: "crimson drums with gold hardware",
    guard: "elegant crimson and black costumes with gold accents",
  },
  azure: {
    colors: "bright azure blue with white and silver accents",
    uniform: "vibrant azure blue uniform with white and silver trim",
    helmet: "azure helmet with white plume and silver accents",
    brass: "silver brass with azure valve caps",
    percussion: "azure drums with silver hardware",
    guard: "azure and white costumes with silver accents, sky-themed flags",
  },
  emerald: {
    colors: "rich emerald green with gold and black accents",
    uniform: "deep emerald green uniform with gold trim and black accents",
    helmet: "emerald helmet with gold-tipped plume",
    brass: "gold brass with emerald valve caps",
    percussion: "emerald drums with gold hardware",
    guard: "emerald and gold costumes with jewel-like props",
  },
};

/**
 * Get comprehensive uniform description for a corps and year
 * Returns an object with uniform, helmet, brass, percussion, guard details
 */
function getUniformDetails(corpsName, year) {
  const corps = DCI_UNIFORMS[corpsName];
  if (!corps) {
    // Generate a believable generic description
    return {
      uniform: "professional drum corps uniform with distinctive colors and military-inspired design",
      helmet: "traditional shako with tall plume in corps colors",
      brass: "professional-grade brass instruments with polished finish",
      percussion: "championship-quality drums with corps logo graphics",
      guard: "coordinated costumes with silk flags and equipment",
    };
  }

  // Check for year-specific uniform, fall back to default
  const yearData = corps[year] || corps.default;

  // Handle both old string format and new object format
  if (typeof yearData === "string") {
    return {
      uniform: yearData,
      helmet: "traditional shako with corps-colored plume",
      brass: "professional brass instruments",
      percussion: "championship drums in corps colors",
      guard: "coordinated costumes with silk equipment",
    };
  }

  return yearData;
}

/**
 * Get fantasy corps uniform based on director-provided design OR name analysis
 * Priority: Director's uniformDesign > Name-based theme matching > Default colors
 *
 * @param {string} corpsName - The fantasy corps name
 * @param {string} location - The corps home location (for regional themes)
 * @param {object} uniformDesign - Director-provided uniform customization (optional)
 */
function getFantasyUniformDetails(corpsName, location = null, uniformDesign = null) {
  // PRIORITY 1: Use director-provided uniform design if available
  if (uniformDesign && uniformDesign.primaryColor) {
    const styleDescriptions = {
      traditional: "classic military-style with precise tailoring",
      contemporary: "modern athletic cut with clean lines",
      theatrical: "dramatic flowing design with stage presence",
      athletic: "performance-focused streamlined design",
      "avant-garde": "bold experimental design pushing boundaries",
    };

    const helmetDescriptions = {
      shako: "traditional tall shako",
      aussie: "aussie-style campaign hat",
      modern: "contemporary streamlined helmet",
      themed: "custom themed headpiece",
      none: "no traditional headwear",
    };

    const colors = uniformDesign.accentColor
      ? `${uniformDesign.primaryColor} with ${uniformDesign.secondaryColor} and ${uniformDesign.accentColor}`
      : `${uniformDesign.primaryColor} with ${uniformDesign.secondaryColor}`;

    const plumeDesc = uniformDesign.plumeDescription
      ? ` with ${uniformDesign.plumeDescription}`
      : uniformDesign.helmetStyle !== "none" ? " with matching plume" : "";

    return {
      colors,
      uniform: `${styleDescriptions[uniformDesign.style] || "professional"} uniform in ${colors}${uniformDesign.mascotOrEmblem ? `, featuring ${uniformDesign.mascotOrEmblem} emblem` : ""}`,
      helmet: `${helmetDescriptions[uniformDesign.helmetStyle] || "traditional helmet"} in ${uniformDesign.primaryColor}${plumeDesc}`,
      brass: uniformDesign.brassDescription || `${uniformDesign.secondaryColor}-accented brass instruments with ${uniformDesign.primaryColor} valve caps`,
      percussion: uniformDesign.percussionDescription || `${uniformDesign.primaryColor} drums with ${uniformDesign.secondaryColor} hardware and corps graphics`,
      guard: uniformDesign.guardDescription || `coordinated ${uniformDesign.primaryColor} and ${uniformDesign.secondaryColor} costumes with themed silks`,
      matchedTheme: "director-custom",
      performanceStyle: uniformDesign.performanceStyle,
      venuePreference: uniformDesign.venuePreference,
      additionalNotes: uniformDesign.additionalNotes,
      location: location,
    };
  }

  // PRIORITY 2: Name-based theme matching
  const lowerName = corpsName.toLowerCase();

  // Check for direct theme matches
  for (const [theme, details] of Object.entries(FANTASY_THEMES)) {
    if (lowerName.includes(theme)) {
      return { ...details, matchedTheme: theme, location };
    }
  }

  // Check for partial matches and synonyms
  const synonymMap = {
    fire: ["flame", "blaze", "inferno", "ember", "burn", "heat", "solar", "sun"],
    ice: ["frost", "frozen", "glacier", "arctic", "winter", "snow", "cold", "freeze"],
    thunder: ["lightning", "electric", "shock", "bolt", "voltage", "spark"],
    storm: ["tempest", "hurricane", "cyclone", "tornado", "wind", "gale"],
    phoenix: ["reborn", "rise", "ascend"],
    dragon: ["serpent", "wyvern", "drake", "wyrm"],
    wolf: ["pack", "howl", "lunar", "moon"],
    eagle: ["hawk", "falcon", "raptor", "talon", "soar"],
    star: ["stellar", "astral", "celestial", "galaxy", "cosmic"],
    nova: ["supernova", "explosion", "burst"],
    comet: ["meteor", "asteroid", "shooting"],
    knight: ["armor", "sword", "shield", "crusade", "paladin", "warrior"],
    titan: ["giant", "colossus", "olymp", "god", "atlas"],
    shadow: ["dark", "night", "phantom", "specter", "ghost", "void"],
    crimson: ["red", "scarlet", "blood", "ruby"],
    azure: ["blue", "sky", "ocean", "sea", "wave"],
    emerald: ["green", "jade", "forest", "nature"],
  };

  for (const [theme, synonyms] of Object.entries(synonymMap)) {
    for (const syn of synonyms) {
      if (lowerName.includes(syn)) {
        return { ...FANTASY_THEMES[theme], matchedTheme: theme, location };
      }
    }
  }

  // PRIORITY 3: Location-based theme hints
  if (location) {
    const lowerLocation = location.toLowerCase();
    // Regional theme hints
    if (lowerLocation.includes("texas") || lowerLocation.includes("dallas") || lowerLocation.includes("houston")) {
      return { ...FANTASY_THEMES.star, matchedTheme: "star-regional", location };
    }
    if (lowerLocation.includes("colorado") || lowerLocation.includes("denver")) {
      return { ...FANTASY_THEMES.thunder, matchedTheme: "thunder-regional", location };
    }
    if (lowerLocation.includes("phoenix") || lowerLocation.includes("arizona")) {
      return { ...FANTASY_THEMES.phoenix, matchedTheme: "phoenix-regional", location };
    }
    if (lowerLocation.includes("seattle") || lowerLocation.includes("portland")) {
      return { ...FANTASY_THEMES.storm, matchedTheme: "storm-regional", location };
    }
  }

  // PRIORITY 4: Default based on first letter
  const firstWord = corpsName.split(/\s+/)[0].toLowerCase();
  const defaultColors = [
    { colors: "royal purple with gold accents", primary: "purple" },
    { colors: "deep teal with silver accents", primary: "teal" },
    { colors: "burnt orange with black accents", primary: "orange" },
    { colors: "forest green with bronze accents", primary: "green" },
  ];

  const colorIndex = firstWord.charCodeAt(0) % defaultColors.length;
  const colorScheme = defaultColors[colorIndex];

  return {
    colors: colorScheme.colors,
    uniform: `modern athletic uniform in ${colorScheme.colors}, contemporary design with team logo`,
    helmet: `${colorScheme.primary} helmet with contrasting plume and team crest`,
    brass: `polished brass instruments with ${colorScheme.primary} valve accents`,
    percussion: `${colorScheme.primary} drums with team logo graphics`,
    guard: `coordinated ${colorScheme.primary} costumes with team-themed flags`,
    matchedTheme: "custom",
    location,
  };
}

/**
 * Build image prompt for corps avatar/icon generation
 * Creates a distinctive, recognizable avatar for each fantasy corps
 *
 * @param {string} corpsName - The fantasy corps name
 * @param {string} location - The corps home location
 * @param {object} uniformDesign - Director-provided uniform customization (optional)
 */
function buildCorpsAvatarPrompt(corpsName, location = null, uniformDesign = null) {
  const details = getFantasyUniformDetails(corpsName, location, uniformDesign);

  return `Create a professional sports team logo/avatar for the fantasy marching arts ensemble "${corpsName}"${location ? ` from ${location}` : ""}.

DESIGN REQUIREMENTS:
- Style: Clean, bold sports logo suitable for jerseys, merchandise, and app icons
- Format: Circular or shield-shaped emblem that works at small sizes
- Colors: ${details.colors}

VISUAL ELEMENTS:
${uniformDesign?.mascotOrEmblem ? `- Featured mascot/emblem: ${uniformDesign.mascotOrEmblem}` : `- Suggest a mascot or symbol based on the corps name "${corpsName}"`}
- Include subtle marching arts elements (stylized brass bell, drumstick, or color guard silk)
- Corps name or initials incorporated into design

COLOR PALETTE:
- Primary: ${uniformDesign?.primaryColor || details.colors.split(" ")[0]}
- Secondary: ${uniformDesign?.secondaryColor || details.colors.split(" with ")[1]?.split(" ")[0] || "silver"}
${uniformDesign?.accentColor ? `- Accent: ${uniformDesign.accentColor}` : ""}

STYLE NOTES:
- Professional NFL/NBA/esports team quality
- Bold, recognizable at 64x64 pixels
- Modern but timeless design
- NO realistic photographs - stylized vector/illustration aesthetic
${uniformDesign?.themeKeywords?.length > 0 ? `- Theme keywords: ${uniformDesign.themeKeywords.join(", ")}` : ""}

This avatar will represent a competitive marching arts fantasy team. Make it distinctive, memorable, and worthy of a championship contender.`;
}

/**
 * Build image prompt for user-submitted articles based on category and content
 * Used when admin approves community submissions
 */
function buildArticleImagePrompt(category, headline, summary) {
  const categoryPrompts = {
    dci: `Photorealistic action photograph from a DCI (Drum Corps International) competition.

SCENE: Dramatic field-side moment capturing the essence of: "${headline}"

SUBJECT OPTIONS (choose most appropriate for headline):
- Brass section in synchronized formation, instruments raised
- Percussion section executing complex choreography
- Color guard members mid-toss with rifles or flags
- Full corps on the field in geometric formation
- Stadium atmosphere with crowd and dramatic lighting

TECHNICAL REQUIREMENTS:
- Style: Professional sports photography
- Camera: 70-200mm telephoto, shallow depth of field
- Lighting: Stadium lights creating dramatic rim lighting, evening atmosphere
- Quality: Sharp focus on subjects, artistically blurred background
- Colors: Rich, saturated, high contrast

AVOID: Close-up faces, identifiable individuals, text overlays, logos`,

    fantasy: `Creative digital illustration for fantasy marching arts sports coverage.

THEME: "${headline}"

VISUAL CONCEPTS:
- Trophy or championship imagery with marching arts elements
- Abstract representation of competition and strategy
- Stylized corps uniforms and equipment as design elements
- Leaderboard or scoreboard visualization
- Victory celebration concept

STYLE REQUIREMENTS:
- Modern sports graphics aesthetic (like ESPN fantasy sports)
- Bold colors with metallic accents (gold, silver, bronze)
- Clean, professional design suitable for news article header
- Dynamic composition suggesting competition and achievement
- Marching arts equipment subtly incorporated (brass instruments, drums, flags)

AVOID: Cartoon characters, video game imagery, realistic faces`,

    analysis: `Professional infographic-style illustration for marching arts analysis content.

TOPIC: "${headline}"

VISUAL APPROACH:
- Clean data visualization aesthetic
- Stadium or field diagram elements
- Performance metrics and trend representations
- Caption score breakdown visualization
- Strategic positioning concepts

STYLE REQUIREMENTS:
- Modern editorial/magazine quality
- Muted professional color palette with accent highlights
- Balanced composition with visual breathing room
- Sophisticated, analytical feel
- Subtle marching arts imagery integrated

AVOID: Cluttered visuals, excessive text, cartoon elements`,
  };

  const basePrompt = categoryPrompts[category] || categoryPrompts.dci;

  return `${basePrompt}

CONTEXT FROM ARTICLE:
"${summary?.substring(0, 200) || headline}"

Generate an image that would work as a professional news article header at 1200x630 pixels.`;
}

/**
 * Build comprehensive image prompt for DCI standings article
 * Features the leading corps with accurate historical uniform
 */
function buildStandingsImagePrompt(topCorps, year, location, showName) {
  const details = getUniformDetails(topCorps, year);

  return `Photorealistic field-side action photograph from ${showName || "a DCI competition"} ${location ? `in ${location}` : ""}.

SUBJECT: A brass performer from ${topCorps} (${year} season) executing a powerful sustained note during their show.

UNIFORM ACCURACY (CRITICAL):
- Uniform: ${details.uniform}
- Headwear: ${details.helmet}
- Instrument: ${details.brass}

SCENE DETAILS:
- Position: Field-side angle, 15 feet from performer, shooting upward slightly
- Background: Stadium crowd blurred, evening sky with stadium lights creating dramatic rim lighting
- Moment: Peak of musical phrase, performer's posture showing effort and precision

TECHNICAL REQUIREMENTS:
- Camera: Canon 1DX Mark III, 70-200mm f/2.8 lens at 135mm
- Settings: 1/1000 shutter, f/2.8, ISO 3200 for stadium lighting
- Style: Professional sports photography, shallow depth of field, high contrast
- Lighting: Dramatic stadium lights from above-left, warm golden hour sun from right

AUTHENTICITY MARKERS:
- Brass instrument must have realistic valve configurations and tubing
- Uniform must show proper fit and military-precise alignment
- White marching gloves, black marching shoes
- Visible concentration and athletic effort in performer's expression

This is a historic ${year} performance being recreated for the fantasy league - make it feel like an authentic DCI photograph.`;
}

/**
 * Build image prompt for DCI caption analysis article
 * Features the section that excelled in captions
 */
function buildCaptionsImagePrompt(featuredCorps, year, captionType, location) {
  const details = getUniformDetails(featuredCorps, year);

  // Determine which section to feature based on caption
  let sectionFocus, sectionDetails, sceneDescription;

  if (captionType.includes("Brass") || captionType.includes("B")) {
    sectionFocus = "hornline";
    sectionDetails = details.brass;
    sceneDescription = "the full hornline in a dramatic arc formation, bells raised in unison during a powerful chord";
  } else if (captionType.includes("Percussion") || captionType.includes("P")) {
    sectionFocus = "drumline";
    sectionDetails = details.percussion;
    sceneDescription = "the snare line in tight formation, sticks frozen mid-stroke in perfect unison";
  } else if (captionType.includes("Guard") || captionType.includes("CG")) {
    sectionFocus = "color guard";
    sectionDetails = details.guard;
    sceneDescription = "guard members with rifles at peak toss height, silks frozen in dramatic arc";
  } else if (captionType.includes("Visual") || captionType.includes("V")) {
    sectionFocus = "full corps";
    sectionDetails = details.uniform;
    sceneDescription = "the corps in a complex geometric formation, bodies creating perfect lines and curves";
  } else {
    // GE or general - show ensemble moment
    sectionFocus = "corps";
    sectionDetails = details.uniform;
    sceneDescription = "an emotional ensemble moment with all sections unified in the show's climax";
  }

  return `Photorealistic field-side photograph capturing ${featuredCorps}'s ${sectionFocus} excellence during their ${year} season.

SUBJECT: ${sceneDescription}

UNIFORM ACCURACY (CRITICAL):
- Primary: ${details.uniform}
- Headwear: ${details.helmet}
- Section equipment: ${sectionDetails}

SCENE COMPOSITION:
- Angle: Low angle from corner of field, emphasizing precision and scale
- Background: Stadium environment with scoreboard partially visible, crowd in stands
- Lighting: Stadium lights creating dramatic shadows, emphasizing body positions

TECHNICAL PHOTOGRAPHY:
- Wide enough to show 6-8 performers while maintaining detail
- Focus on center performers, edges slightly soft
- Motion blur on any moving equipment to show action
- High contrast, vibrant colors true to ${featuredCorps} palette

CAPTION EXCELLENCE MARKERS:
- Perfect body alignment showing visual precision
- Equipment positions showing technical mastery
- Unified expression showing ensemble cohesion

This photograph should capture why ${featuredCorps} excelled in ${captionType} during their historic ${year} campaign.`;
}

/**
 * Build image prompt for fantasy performers article
 * Features the top fantasy corps with creative themed uniform
 *
 * @param {string} topCorpsName - The fantasy corps name
 * @param {string} theme - Scene/moment description
 * @param {string} location - The corps home location (optional)
 * @param {object} uniformDesign - Director-provided uniform customization (optional)
 */
function buildFantasyPerformersImagePrompt(topCorpsName, theme, location = null, uniformDesign = null) {
  const details = getFantasyUniformDetails(topCorpsName, location, uniformDesign);

  // Determine venue based on director preference or default
  const venueDescription = details.venuePreference === "indoor"
    ? "Modern indoor arena with dramatic LED lighting systems"
    : details.venuePreference === "outdoor"
      ? "Outdoor stadium under evening sky with dramatic stadium lighting"
      : "Professional marching arts competition venue with dramatic lighting";

  return `Photorealistic field-side photograph of a performer from the fantasy marching arts ensemble "${topCorpsName}"${location ? ` from ${location}` : ""}.

UNIFORM DESIGN${details.matchedTheme === "director-custom" ? " (Director-Specified)" : ""}:
- Colors: ${details.colors}
- Uniform: ${details.uniform}
- Headwear: ${details.helmet}
- Brass: ${details.brass}
- Guard elements: ${details.guard}
${details.additionalNotes ? `- Special notes: ${details.additionalNotes}` : ""}

SCENE SETTING:
- ${venueDescription}
- ${theme || "Victory moment after an award-winning performance"}
- ${details.performanceStyle ? `Performance style: ${details.performanceStyle}` : "Professional marching arts competition atmosphere"}
- Crowd on their feet in background, celebration energy

PERFORMER DETAILS:
- Brass performer holding instrument triumphantly
- Expression of joy and accomplishment
- Uniform pristine and dramatically lit
- Stadium spotlights creating dramatic rim lighting

PHOTOGRAPHY STYLE:
- Sports photography, celebration moment
- Shallow depth of field isolating performer
- High contrast, saturated colors matching corps theme
- Lens flare from stadium lights adding drama

AUTHENTICITY:
- Instrument must be realistic (baritone, mellophone, or trumpet with correct valve/tubing)
- Uniform is creative but still clearly a marching arts uniform (not costume)
- White marching gloves, black marching shoes
- Professional posture and bearing

This is a fantasy corps created by a user${details.matchedTheme === "director-custom" ? " with custom uniform specifications" : ""}. The uniform should be distinctive and memorable while remaining authentic to competitive marching arts.`;
}

/**
 * Build image prompt for fantasy league recap article
 * Shows championship/competition atmosphere
 */
function buildFantasyLeagueImagePrompt() {
  return `Photorealistic photograph of a marching arts fantasy league championship ceremony.

SCENE:
- Indoor arena with dramatic purple and gold lighting
- Large LED screens showing "MARCHING.ART FANTASY CHAMPIONSHIP"
- Trophy presentation moment on elevated stage
- Multiple performers from different fantasy ensembles visible

DETAILS:
- Professional awards ceremony setup
- marching.art branding visible on backdrop and screens
- Confetti or streamers in the air
- Mixed ensemble uniforms visible showing variety of fantasy corps designs

ATMOSPHERE:
- Celebration energy
- Professional sports championship feel
- Dramatic spotlight on trophy/winners area
- Crowd visible in background, standing ovation

PHOTOGRAPHY:
- Wide shot capturing the spectacle
- Multiple light sources creating depth
- Sharp focus on center stage, soft background
- Rich, saturated colors

This should feel like a major esports or fantasy sports championship ceremony, but for marching arts.`;
}

/**
 * Build image prompt for deep analytics article
 * Shows data visualization or strategic analysis moment
 */
function buildAnalyticsImagePrompt(featuredCorps, year, analysisType) {
  const details = getUniformDetails(featuredCorps, year);

  return `Photorealistic aerial/elevated photograph showing ${featuredCorps} (${year}) in a complex drill formation.

FORMATION FOCUS:
- Corps in geometric formation viewed from press box/tower angle
- Pattern clearly visible: curved arc, diagonal lines, or company front
- Individual performers visible but formation structure is the focus

UNIFORM ACCURACY:
- Uniform: ${details.uniform}
- Headwear: ${details.helmet}
- Formation shows military precision and spacing

ANALYTICAL ELEMENTS:
- Yard lines visible for spatial reference
- Shadow patterns showing performer positions
- Formation geometry emphasized through lighting

PHOTOGRAPHY:
- Elevated angle (45-60 degrees from horizontal)
- Wide shot capturing 40+ performers
- Sharp focus throughout formation
- Stadium lights creating clear shadows
- Late afternoon/golden hour lighting

MOOD:
- Analytical, studying excellence
- Historic performance documentation
- The kind of image coaches would study

This image should feel like film study material - capturing the precision and design that made ${featuredCorps}'s ${year} performance analytically significant.`;
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
      generateFantasyPerformersArticle({ reportDay, fantasyData, showContext, db, dataDocId }),
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

TONE: Professional sports journalism. Authoritative but accessible. Use specific numbers. Create drama from the competition without being hyperbolic. Reference that these are real historical DCI performances.`;

  // Schema for structured output
  const schema = {
    type: SchemaType.OBJECT,
    properties: {
      headline: { type: SchemaType.STRING, description: "Attention-grabbing headline" },
      summary: { type: SchemaType.STRING, description: "2-3 sentence summary" },
      narrative: { type: SchemaType.STRING, description: "3-4 paragraph article" },
      standings: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            rank: { type: SchemaType.INTEGER },
            corps: { type: SchemaType.STRING },
            year: { type: SchemaType.INTEGER },
            total: { type: SchemaType.NUMBER },
            change: { type: SchemaType.NUMBER },
            momentum: { type: SchemaType.STRING, enum: ["rising", "falling", "steady"] },
          },
          required: ["rank", "corps", "year", "total", "change", "momentum"],
        },
      },
    },
    required: ["headline", "summary", "narrative", "standings"],
  };

  try {
    const content = await generateStructuredContent(prompt, schema);

    // Generate image featuring top corps with accurate historical uniform
    const imagePrompt = buildStandingsImagePrompt(
      topCorps.corps,
      topCorps.sourceYear,
      showContext.location,
      showContext.showName
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

TONE: Technical but accessible. Like a color commentator who knows the activity inside and out. Use specific scores. Reference real DCI judging criteria.`;

  // Schema for structured output
  const schema = {
    type: SchemaType.OBJECT,
    properties: {
      headline: { type: SchemaType.STRING, description: "Caption-focused headline" },
      summary: { type: SchemaType.STRING, description: "2-3 sentence summary" },
      narrative: { type: SchemaType.STRING, description: "3-4 paragraph analysis" },
      captionBreakdown: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            category: { type: SchemaType.STRING },
            leader: { type: SchemaType.STRING },
            analysis: { type: SchemaType.STRING },
          },
          required: ["category", "leader", "analysis"],
        },
      },
    },
    required: ["headline", "summary", "narrative", "captionBreakdown"],
  };

  try {
    const content = await generateStructuredContent(prompt, schema);

    // Feature the corps excelling in the top caption category
    const featuredCaption = captionLeaders[0];
    const featuredCorps = dayScores.find(s => s.corps === featuredCaption?.leader) || dayScores[0];

    // Use specialized caption image prompt with section-specific details
    const imagePrompt = buildCaptionsImagePrompt(
      featuredCorps.corps,
      featuredCorps.sourceYear,
      featuredCaption?.caption || "General Effect",
      showContext.location
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
async function generateFantasyPerformersArticle({ reportDay, fantasyData, showContext, db, dataDocId }) {
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

  // Use marching.art branding for fantasy articles
  const fantasyShowName = formatFantasyEventName(showContext.showName);
  const fantasyLocation = formatFantasyEventName(showContext.location);

  const prompt = `You are a fantasy sports analyst writing for marching.art, covering our marching.art fantasy competition like ESPN covers fantasy football.

CONTEXT: marching.art Fantasy is a fantasy sports game where users ("Directors") create their own fantasy ensembles. Directors draft real corps to fill caption positions (Brass, Percussion, Guard, etc.) and earn points based on how those corps perform in actual competitions. Think fantasy football, but for drum corps.

═══════════════════════════════════════════════════════════════
DATE & CONTEXT
═══════════════════════════════════════════════════════════════
• Date: ${showContext.date}
• Season Day: ${reportDay}
• Competition Today: ${fantasyShowName} in ${fantasyLocation}
═══════════════════════════════════════════════════════════════

FANTASY LEADERBOARD for ${showContext.date} (Day ${reportDay}):

TOP 10 FANTASY ENSEMBLES:
${topPerformers.map((r, i) =>
  `${i + 1}. "${r.corpsName}" (Director: ${r.displayName || 'Anonymous'}) - ${r.totalScore.toFixed(3)} fantasy points`
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
- Write like ESPN fantasy coverage - celebratory, fun, competitive`;

  // Schema for structured output
  const schema = {
    type: SchemaType.OBJECT,
    properties: {
      headline: { type: SchemaType.STRING, description: "Exciting fantasy sports headline" },
      summary: { type: SchemaType.STRING, description: "2-3 sentence summary" },
      narrative: { type: SchemaType.STRING, description: "3-4 paragraph celebration article" },
      topPerformers: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            rank: { type: SchemaType.INTEGER },
            director: { type: SchemaType.STRING },
            corpsName: { type: SchemaType.STRING },
            score: { type: SchemaType.NUMBER },
            highlight: { type: SchemaType.STRING },
          },
          required: ["rank", "director", "corpsName", "score", "highlight"],
        },
      },
    },
    required: ["headline", "summary", "narrative", "topPerformers"],
  };

  try {
    const content = await generateStructuredContent(prompt, schema);

    // Generate image for top fantasy corps with themed uniform based on corps name
    const topCorps = topPerformers[0];

    // Fetch the top performer's uniform design from their profile
    let uniformDesign = null;
    let corpsLocation = null;
    if (topCorps?.uid && topCorps?.corpsClass && db && dataDocId) {
      try {
        const profileDoc = await db.doc(`${dataDocId}/users/${topCorps.uid}/profile/data`).get();
        if (profileDoc.exists) {
          const profileData = profileDoc.data();
          const corpsData = profileData?.corps?.[topCorps.corpsClass];
          uniformDesign = corpsData?.uniformDesign || null;
          corpsLocation = corpsData?.location || null;
          if (uniformDesign) {
            logger.info(`Found uniform design for top performer ${topCorps.corpsName}`, {
              userId: topCorps.uid,
              corpsClass: topCorps.corpsClass,
              primaryColor: uniformDesign.primaryColor,
            });
          }
        }
      } catch (profileError) {
        logger.warn("Could not fetch top performer's uniform design:", profileError.message);
      }
    }

    const imagePrompt = buildFantasyPerformersImagePrompt(
      topCorps?.corpsName || "Champion Corps",
      "Victory celebration after dominating Day " + reportDay + " competition",
      corpsLocation,
      uniformDesign
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
  // Get show/league data - also format show names for fantasy branding
  const shows = fantasyData?.current?.shows || [];
  const showSummaries = shows.map(show => {
    const results = show.results || [];
    const top3 = results.sort((a, b) => b.totalScore - a.totalScore).slice(0, 3);
    return {
      name: formatFantasyEventName(show.showName || show.showId || 'Competition'),
      entrants: results.length,
      topScorer: top3[0]?.corpsName || 'N/A',
      topScore: top3[0]?.totalScore?.toFixed(3) || '0.000',
    };
  });

  // Use marching.art branding for fantasy articles
  const fantasyShowName = formatFantasyEventName(showContext.showName);
  const fantasyLocation = formatFantasyEventName(showContext.location);

  const prompt = `You are a fantasy sports league analyst for marching.art, writing league updates like ESPN's fantasy football league coverage.

CONTEXT: marching.art Fantasy organizes competitions into "shows" (like fantasy football leagues). Directors compete in these shows with their fantasy ensembles. Points are earned based on real corps performances.

═══════════════════════════════════════════════════════════════
DATE & CONTEXT
═══════════════════════════════════════════════════════════════
• Date: ${showContext.date}
• Season Day: ${reportDay}
• Competition Today: ${fantasyShowName} in ${fantasyLocation}
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
- Write like ESPN fantasy league coverage`;

  // Schema for structured output
  const schema = {
    type: SchemaType.OBJECT,
    properties: {
      headline: { type: SchemaType.STRING, description: "League-focused headline" },
      summary: { type: SchemaType.STRING, description: "2-3 sentence summary" },
      narrative: { type: SchemaType.STRING, description: "3-4 paragraph article" },
      leagueHighlights: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            league: { type: SchemaType.STRING },
            leader: { type: SchemaType.STRING },
            story: { type: SchemaType.STRING },
          },
          required: ["league", "leader", "story"],
        },
      },
    },
    required: ["headline", "summary", "narrative", "leagueHighlights"],
  };

  try {
    const content = await generateStructuredContent(prompt, schema);

    // Use specialized league championship ceremony prompt
    const imagePrompt = buildFantasyLeagueImagePrompt();

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
- Write like FiveThirtyEight or The Athletic - data-first journalism`;

  // Schema for structured output
  const schema = {
    type: SchemaType.OBJECT,
    properties: {
      headline: { type: SchemaType.STRING, description: "Statistical insight headline" },
      summary: { type: SchemaType.STRING, description: "2-3 sentence data-driven summary" },
      narrative: { type: SchemaType.STRING, description: "4-5 paragraph deep analysis" },
      insights: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            metric: { type: SchemaType.STRING },
            finding: { type: SchemaType.STRING },
            implication: { type: SchemaType.STRING },
          },
          required: ["metric", "finding", "implication"],
        },
      },
      recommendations: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            corps: { type: SchemaType.STRING },
            action: { type: SchemaType.STRING, enum: ["buy", "hold", "sell"] },
            reasoning: { type: SchemaType.STRING },
          },
          required: ["corps", "action", "reasoning"],
        },
      },
    },
    required: ["headline", "summary", "narrative", "insights", "recommendations"],
  };

  try {
    const content = await generateStructuredContent(prompt, schema);

    // Feature the top trending corps in an analytical aerial shot
    const topTrending = Object.entries(trendData).sort((a,b) => b[1].trendFromAvg - a[1].trendFromAvg)[0];
    const featuredCorps = dayScores.find(s => s.corps === topTrending?.[0]) || dayScores[0];

    // Use specialized analytics prompt showing drill formations from elevated angle
    const imagePrompt = buildAnalyticsImagePrompt(
      featuredCorps.corps,
      featuredCorps.sourceYear,
      "trajectory analysis"
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
  try {
    const { shows, offSeasonDay } = recapData;
    const allResults = shows.flatMap(s => s.results || []);
    const topPerformers = allResults.sort((a, b) => b.totalScore - a.totalScore).slice(0, 10);

    const prompt = `You are a sports journalist for marching.art, a FANTASY SPORTS platform for DCI (Drum Corps International) marching band competitions.

This is like fantasy football, but for drum corps. Users create fantasy ensembles by drafting real DCI corps to earn points based on actual competition scores.

Write a Day ${offSeasonDay} fantasy sports recap article for these top-performing user ensembles:

TOP FANTASY ENSEMBLES (user-created teams):
${topPerformers.map((r, i) => `${i + 1}. "${r.corpsName}" (Director: ${r.displayName || 'Anonymous'}): ${r.totalScore.toFixed(3)} fantasy points`).join('\n')}

Write like ESPN fantasy sports coverage. Focus on:
- Which fantasy ensembles scored the most points
- Celebrate the top directors' success
- General strategy tips (without revealing specific lineup picks)

IMPORTANT: Do NOT mention RPGs, video games, or fictional fantasy worlds. This is SPORTS fantasy like fantasy football.
All "corps" names above are user-created fantasy team names, not real DCI corps.`;

    // Schema for structured output
    const schema = {
      type: SchemaType.OBJECT,
      properties: {
        headline: { type: SchemaType.STRING, description: "Exciting sports headline" },
        summary: { type: SchemaType.STRING, description: "2-3 sentence summary" },
        narrative: { type: SchemaType.STRING, description: "Full article text" },
        fantasyImpact: { type: SchemaType.STRING, description: "Brief tip for fantasy players" },
        trendingCorps: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
          description: "Top 3 performing fantasy team names",
        },
      },
      required: ["headline", "summary", "narrative", "fantasyImpact", "trendingCorps"],
    };

    const content = await generateStructuredContent(prompt, schema);
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
  // New 5-article system
  generateAllArticles,
  generateDciStandingsArticle,
  generateDciCaptionsArticle,
  generateFantasyPerformersArticle,
  generateFantasyLeaguesArticle,
  generateDeepAnalyticsArticle,

  // Image generation - specialized prompts for each article type
  generateImageWithImagen,
  buildStandingsImagePrompt,
  buildCaptionsImagePrompt,
  buildFantasyPerformersImagePrompt,
  buildFantasyLeagueImagePrompt,
  buildAnalyticsImagePrompt,
  buildCorpsAvatarPrompt,  // Corps avatar/icon generation
  buildArticleImagePrompt, // User-submitted article images

  // Uniform/theme utilities
  getUniformDetails,
  getFantasyUniformDetails,
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
