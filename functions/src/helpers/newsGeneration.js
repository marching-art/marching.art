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
const { GoogleGenAI } = require("@google/genai");
const { logger } = require("firebase-functions/v2");
const { defineSecret } = require("firebase-functions/params");
const { uploadFromUrl, getContextualPlaceholder } = require("./mediaService");

// Define Gemini API key secret
const geminiApiKey = defineSecret("GOOGLE_GENERATIVE_AI_API_KEY");

// Initialize clients (lazy loaded)
let genAI = null;
let textModel = null;
let imageGenAI = null; // New SDK for image generation

// =============================================================================
// DCI UNIFORM KNOWLEDGE BASE
// Comprehensive uniform descriptions by corps and year for image generation
// Includes equipment details, helmet/shako styles, and section-specific elements
// =============================================================================

const DCI_UNIFORMS = {
  // ==========================================================================
  // WORLD CLASS - TOP 12 CORPS
  // ==========================================================================

  "Blue Devils": {
    default: {
      uniform: "navy blue military-style uniform with silver trim and white baldric",
      helmet: "silver shako with tall white horsehair plume",
      brass: "silver-plated King brass instruments with navy blue valve caps",
      percussion: "Pearl drums with navy blue shells, silver hardware, Zildjian cymbals",
      guard: "navy and silver unitards with flowing silver capes",
    },
    2014: {
      uniform: "classic navy blue with white chest baldric, silver braiding, polished brass buttons in double-breasted style",
      helmet: "traditional tall silver shako with blue and white ostrich plume",
      brass: "traditional silver brass instruments with white valve guards",
      percussion: "white Pearl drums with silver hardware, traditional concert bass drums",
      guard: "classical white and navy gowns, traditional rifle and sabre",
      showName: "Felliniesque",
    },
    2017: {
      uniform: "midnight blue with iridescent butterfly-wing patterns, metamorphosis theme with color-shifting fabric",
      helmet: "sleek chrome helmet with fiber optic butterfly antennae elements",
      brass: "silver brass with holographic blue finish on bells",
      percussion: "navy shells with morphing color graphics, LED-lit pit",
      guard: "iridescent blue costumes transforming through show, butterfly wing silks",
      showName: "Metamorph",
    },
    2018: {
      uniform: "deep midnight blue uniforms with metallic silver geometric accents, asymmetrical chest design with flowing navy capes",
      helmet: "chrome-finished helmet with fiber optic lighting elements and white plume",
      brass: "Dynasty brass with silver finish, illuminated bell covers during ballad",
      percussion: "Pearl Championship drums, navy shells with LED rim lighting",
      guard: "midnight blue with silver holographic fabric, 6-foot silk flags in navy and silver",
      showName: "Dreams and Nighthawks",
    },
    2019: {
      uniform: "navy blue with geometric silver angular patterns, modern athletic cut with metallic chest plate",
      helmet: "streamlined chrome visor helmet with blue LED accents",
      brass: "polished silver brass, contoured ergonomic grips",
      percussion: "transparent blue acrylic shells on snares, navy tenors",
      guard: "geometric silver and blue costumes, angular equipment in chrome",
      showName: "Ghostlight",
    },
    2023: {
      uniform: "deep navy with silver Art Deco geometric patterns, 1920s jazz age elegance",
      helmet: "chrome helmet with navy plume and Art Deco crest",
      brass: "silver brass with jazz-era styling, muted brass sections",
      percussion: "navy shells with silver geometric inlays, vintage-inspired pit setup",
      guard: "Art Deco navy and silver gowns, fan props and vintage silks",
      showName: "The Cut-Outs",
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
      showName: "E=MC²",
    },
    2015: {
      uniform: "fiery orange-red with gold flame patterns, inferno theme with heat-shimmer metallic fabric",
      helmet: "gold helmet with flame-shaped orange plume rising upward",
      brass: "gold brass with orange-red flame graphics on bells",
      percussion: "orange-red shells with gold fire graphics, flame-colored mallets",
      guard: "flame-inspired orange, red, and gold costumes with fire silks",
      showName: "Inferno",
    },
    2017: {
      uniform: "dark navy blue fitted modern uniform with sleek athletic cut, clean contemporary design",
      helmet: "no traditional shako, modern minimalist look with natural hair",
      brass: "silver brass instruments with clean contemporary appearance",
      percussion: "navy blue uniforms matching brass section, silver drum hardware",
      guard: "silver metallic fitted costumes with flowing elements, additional green costume pieces for visual contrast",
      showName: "It Is",
    },
    2019: {
      uniform: "maroon base with rose gold metallic overlay panels, modern athletic silhouette with illuminated crown logo",
      helmet: "rose gold metallic helmet with built-in LED crown halo",
      brass: "rose gold-finished brass with modern ergonomic design",
      percussion: "maroon shells with rose gold hardware, electronic trigger pads",
      guard: "rose gold and maroon athletic wear with flowing fabric extensions",
      showName: "Beneath the Surface",
    },
    2022: {
      uniform: "burgundy with cascading gold water-like patterns, reflective metallic threads",
      helmet: "gold helmet with flowing burgundy plume suggesting movement",
      brass: "gold brass with wave-pattern engravings",
      percussion: "burgundy shells with gold ripple graphics",
      guard: "flowing burgundy and gold costumes with water-themed movement silks",
      showName: "Right Here Right Now",
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
    2005: {
      uniform: "maroon with black and silver geometric zones, avant-garde angular design",
      helmet: "angular maroon and silver helmet with geometric plume",
      brass: "silver brass with zone-inspired geometric graphics",
      percussion: "maroon drums with silver angular patterns",
      guard: "geometric maroon, black, and silver costumes with angular props",
      showName: "The Zone",
    },
    2011: {
      uniform: "burgundy with gold rope braiding across chest, Revolutionary War inspired double-breasted design",
      helmet: "tricorn-influenced shako in burgundy with gold trim and cream cockade",
      brass: "antiqued brass finish instruments evoking colonial era",
      percussion: "field drums styled after Revolutionary War with rope tension",
      guard: "colonial-era costumes with tricorn hats, period-accurate flags",
      showName: "Between Angels and Demons",
    },
    2015: {
      uniform: "black fitted uniform with white West Point-style military chest braiding, traditional frogging pattern design, thin white sash with silver buckle",
      helmet: "no traditional helmet, modern look with natural appearance",
      brass: "silver brass instruments contrasting against black uniforms",
      percussion: "black uniforms with white military braiding matching brass section",
      guard: "black base costumes with colorful flowing silks in yellow, purple, and pink",
      showName: "The Power of 10",
    },
    2023: {
      uniform: "deep maroon with copper metallic accents, steampunk-inspired gears and clockwork patterns",
      helmet: "copper-accented helmet with gear-shaped crest",
      brass: "copper-tinted brass with clockwork engravings",
      percussion: "maroon drums with copper gear graphics",
      guard: "steampunk-inspired maroon and copper costumes with gear props",
      showName: "Atlas Rising",
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
    2014: {
      uniform: "rich jewel-toned red with gold Arabian patterns, Scheherazade-inspired flowing fabrics",
      helmet: "ornate gold headpiece with red jewels and flowing red plume",
      brass: "gold brass with Arabian geometric engravings",
      percussion: "red drums with gold Arabian patterns, Middle Eastern percussion accents",
      guard: "Arabian Nights-inspired red and gold costumes with veils and flowing silks",
      showName: "Scheherazade",
    },
    2018: {
      uniform: "cream ivory fitted bodysuit with distinctive V-shaped chest design, sleek modern athletic cut with subtle textured fabric",
      helmet: "no traditional helmet, clean modern look with natural hair or minimal headwear",
      brass: "silver brass instruments contrasting against cream uniforms",
      percussion: "cream ivory uniforms matching brass section, silver Pearl drums with chrome hardware",
      guard: "contrasting coral red fitted uniforms with modern athletic design, dramatic movement-focused costumes",
      showName: "Babylon",
    },
    2019: {
      uniform: "deep scarlet with revolutionary voice theme, dramatic transformation aesthetic",
      helmet: "gold and red headpiece with revolutionary imagery",
      brass: "gold brass with dramatic voice-inspired engravings",
      percussion: "red and gold drums with revolutionary imagery",
      guard: "revolutionary-inspired red and gold costumes with dramatic silks",
      showName: "Vox Eversio",
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
    2014: {
      uniform: "traditional navy blue military-style uniform with white trim and accents, classic formal cut",
      helmet: "white shako with large fluffy white plume, traditional military style",
      brass: "silver brass instruments with traditional appearance",
      percussion: "navy blue uniforms matching brass section, white shako helmets with white plumes",
      guard: "bright orange fitted costumes, striking contrast against navy blue corps members",
      showName: "Tilt",
    },
    2016: {
      uniform: "electric blue with silver geometric circuit-board patterns, futuristic LED-integrated panels",
      helmet: "chrome visor helmet with programmable LED strip, no traditional plume",
      brass: "custom silver brass with blue LED rings around bells",
      percussion: "transparent blue acrylic drums with internal LED lighting",
      guard: "futuristic silver and blue bodysuits with fiber optic elements, LED props",
      showName: "Down Side Up",
    },
    2017: {
      uniform: "electric blue with white jagged patterns, rock concert-inspired modern athletic design",
      helmet: "chrome helmet with blue LED strip, concert-style headset mics",
      brass: "silver brass with blue electric bolt graphics",
      percussion: "blue drums with white lightning patterns, electronic integration",
      guard: "rock-inspired blue and white costumes with electric guitar props",
      showName: "Jagged Line",
    },
    2019: {
      uniform: "deep navy blue with silver thread patterns, vintage jazz club aesthetic",
      helmet: "vintage-style chrome helmet with blue accents",
      brass: "silver brass with vintage jazz styling",
      percussion: "navy drums with silver accents, jazz-era pit setup",
      guard: "1940s jazz club-inspired navy and silver costumes",
      showName: "The Bluecoats",
    },
    2022: {
      uniform: "electric blue with yellow warning stripe accents, industrial caution tape aesthetic",
      helmet: "yellow and blue industrial-style helmet",
      brass: "silver brass with blue and yellow caution graphics",
      percussion: "blue drums with yellow warning stripe patterns",
      guard: "industrial blue and yellow costumes with caution tape props",
      showName: "Riffs & Revelations",
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
    2003: {
      uniform: "burgundy with gold harmonic wave patterns, orchestral elegance with flowing capes",
      helmet: "gold-trimmed black helmet with burgundy plume",
      brass: "gold brass with musical notation engravings",
      percussion: "burgundy drums with gold orchestral graphics",
      guard: "burgundy and gold orchestral costumes with conductor-inspired elements",
      showName: "Harmonic Journey",
    },
    2008: {
      uniform: "deep burgundy with black velvet trim, full-length opera capes with burgundy lining",
      helmet: "black helmet with Spartan-inspired crest and regiment skull emblem",
      brass: "dark nickel-finished brass with dramatic bell flares",
      percussion: "black shells with burgundy flame graphics, orchestral percussion",
      guard: "operatic burgundy and black costumes with dramatic masks",
      showName: "Spartacus",
    },
    2010: {
      uniform: "deep maroon with silver theatrical accents, Into the Light redemption theme",
      helmet: "silver and maroon helmet with light-ray crest",
      brass: "silver brass with ray-of-light engravings",
      percussion: "maroon drums with silver light-beam graphics",
      guard: "transitioning maroon to silver costumes suggesting emergence into light",
      showName: "Into the Light",
    },
    2023: {
      uniform: "black and burgundy with silver threads, modern theatrical athletic design",
      helmet: "black helmet with burgundy plume and silver skull crest",
      brass: "dark nickel brass with silver accents",
      percussion: "black drums with burgundy and silver graphics",
      guard: "contemporary theatrical black and burgundy costumes",
      showName: "Exogenesis",
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
      showName: "Frameworks",
    },
    2006: {
      uniform: "dark green with silver machine-like geometric patterns, mechanical precision design",
      helmet: "silver-green mechanical helmet with gear-like plume",
      brass: "chrome brass with machine-part engravings",
      percussion: "green drums with silver mechanical graphics, precise visual design",
      guard: "machine-inspired green and silver costumes with mechanical props",
      showName: "Machine",
    },
    2023: {
      uniform: "black fitted uniform with bright kelly green accents and panels, modern athletic design",
      helmet: "white helmet with white flowing plume, classic cavalier style",
      brass: "silver brass instruments with black and green uniform backdrop",
      percussion: "natural wood tan colored drums, black and green uniforms matching brass section",
      guard: "green and black modern costumes with flowing elements",
      showName: "...Where You'll Find Me",
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
    2013: {
      uniform: "deep green with shadowy black accents, mysterious dancing shadows theme",
      helmet: "black and green helmet with shadow-like plume",
      brass: "dark green lacquered brass with shadow graphics",
      percussion: "green drums with black shadow patterns",
      guard: "green and black shadow-inspired costumes with mysterious silks",
      showName: "Dancing Shadows",
    },
    2023: {
      uniform: "kelly green with gold modern accents, refreshed scout tradition design",
      helmet: "green helmet with gold trim and traditional plume",
      brass: "gold brass with scout emblem",
      percussion: "green drums with gold accents",
      guard: "green and gold contemporary scout costumes",
      showName: "The Return",
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
    2017: {
      uniform: "black with crimson red accents, Wicked Games dark theatrical design",
      helmet: "black helmet with red plume and wicked styling",
      brass: "dark lacquered brass with red accents",
      percussion: "black drums with crimson graphics",
      guard: "dark theatrical black and red costumes with dramatic props",
      showName: "Wicked Games",
    },
    2018: {
      uniform: "magenta purple fitted uniform with bright neon green accents, tropical island survival theme",
      helmet: "no traditional helmet, modern athletic look",
      brass: "silver brass instruments with magenta and green uniform backdrop",
      percussion: "magenta purple uniforms with green accents matching brass section",
      guard: "orange and tan tropical island-inspired costumes, beach survival aesthetic",
      showName: "S.O.S.",
    },
    2019: {
      uniform: "crimson red with gold accents, bold contemporary athletic design",
      helmet: "gold and red helmet with modern plume",
      brass: "gold brass with crimson accents",
      percussion: "red drums with gold hardware",
      guard: "crimson and gold contemporary athletic costumes",
      showName: "Goliath",
    },
    2022: {
      uniform: "crimson with purple and gold paradise-inspired patterns, tropical elegance",
      helmet: "gold helmet with crimson and purple plume",
      brass: "gold brass with paradise engravings",
      percussion: "crimson drums with tropical gold and purple graphics",
      guard: "paradise-inspired crimson, purple, and gold flowing costumes",
      showName: "Paradise Lost",
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
    2019: {
      uniform: "royal blue with silver celestial Romeo and Juliet star-crossed theme",
      helmet: "silver helmet with blue star accents and flowing plume",
      brass: "silver brass with star and moon engravings",
      percussion: "blue drums with silver star graphics",
      guard: "romantic blue and silver costumes with celestial silks",
      showName: "STAR Crossed",
    },
    2022: {
      uniform: "dark charcoal grey fitted uniform with purple magenta accents, modern athletic design",
      helmet: "no traditional helmet, modern minimalist look",
      brass: "silver brass instruments contrasting against grey and purple uniforms",
      percussion: "charcoal grey uniforms with purple accents matching brass section",
      guard: "colorful vibrant costumes with orange, blue, and multi-colored silks",
      showName: "Of War and Peace",
    },
    2023: {
      uniform: "royal blue with silver constellation patterns, updated celestial design",
      helmet: "blue helmet with silver star crest",
      brass: "silver brass with constellation engravings",
      percussion: "blue drums with silver star patterns",
      guard: "blue and silver celestial costumes",
      showName: "Beneath the Blue",
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
    2019: {
      uniform: "crimson and gold with phoenix rising theme, dramatic transformation design",
      helmet: "gold phoenix-shaped headpiece with red plume",
      brass: "gold brass with phoenix engravings",
      percussion: "red drums with gold phoenix graphics",
      guard: "phoenix-inspired crimson and gold costumes with fire silks",
      showName: "Inside the Ink",
    },
    2022: {
      uniform: "crimson red with gold kintsugi-inspired golden crack patterns, beautiful imperfection theme",
      helmet: "gold and red helmet with kintsugi design",
      brass: "gold brass with golden crack patterns",
      percussion: "red drums with gold kintsugi graphics",
      guard: "crimson costumes with gold kintsugi accents and flowing silks",
      showName: "Kintsugi",
    },
    2023: {
      uniform: "all-red fitted modern uniform, sleek monochromatic athletic design",
      helmet: "red beret cap, modern minimalist headwear",
      brass: "silver brass instruments contrasting against all-red uniforms",
      percussion: "red drums with black accents, matching red uniforms",
      guard: "red fitted costumes matching corps aesthetic, dramatic angular props",
      showName: "Sinnerman",
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
    2023: {
      uniform: "tan with gold and brown Western accents, modern cavalry athletic design",
      helmet: "updated cavalry hat with gold trim",
      brass: "gold brass with cavalry engravings",
      percussion: "tan drums with gold cavalry graphics",
      guard: "modern cavalry tan and gold costumes",
      showName: "The Sky Is Not the Limit",
    },
    2025: {
      uniform: "rust burnt orange and black Western cavalry uniform, traditional frontier style with modern fit",
      helmet: "black cavalry cowboy hat with decorative band",
      brass: "silver brass instruments with rust and black uniform backdrop",
      percussion: "natural tan wood colored drums, rust orange and black uniforms matching brass section",
      guard: "yellow gold and white flowing costumes, sunset-inspired color palette",
      showName: "The Final Sunset",
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
    2023: {
      uniform: "deep purple with silver modern accents, updated equestrian athletic design",
      helmet: "purple helmet with silver mane plume",
      brass: "silver brass with purple accents",
      percussion: "purple drums with silver horse graphics",
      guard: "purple and silver flowing costumes",
      showName: "Heartland",
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
    2023: {
      uniform: "scarlet red with gold phoenix patterns, modern Southern pride design",
      helmet: "gold and red helmet with phoenix crest",
      brass: "gold brass with phoenix engravings",
      percussion: "red drums with gold phoenix graphics",
      guard: "red and gold phoenix costumes with fire silks",
      showName: "Coming Home",
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
    2018: {
      uniform: "purple and black horizontal striped fitted uniform, bold modern athletic design with teal accents",
      helmet: "no traditional helmet, modern minimalist look",
      brass: "silver brass instruments contrasting against purple striped uniforms",
      percussion: "natural wood tan colored drums, purple and black striped uniforms matching brass section",
      guard: "purple and black costumes with teal accent pieces",
      showName: "The Sands of Time",
    },
    2022: {
      uniform: "royal blue with silver knight armor accents, modern crusader design",
      helmet: "chrome knight helmet with blue plume",
      brass: "chrome brass with shield engravings",
      percussion: "blue drums with silver shield graphics",
      guard: "knight-inspired blue and silver athletic costumes",
      showName: "The Count of Monte Cristo",
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
    2023: {
      uniform: "royal blue with silver cross patterns, updated modern athletic design",
      helmet: "blue helmet with white cross crest",
      brass: "silver brass with cross engravings",
      percussion: "blue drums with white cross graphics",
      guard: "blue and white contemporary cross-themed costumes",
      showName: "The Grass Is Always Greener",
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
    2023: {
      uniform: "teal with silver mountain and wave patterns, Pacific pride design",
      helmet: "silver and teal helmet with mountain crest",
      brass: "silver brass with wave engravings",
      percussion: "teal drums with silver mountain graphics",
      guard: "teal and silver Pacific-themed costumes",
      showName: "Wonder",
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
  // New article types for variety
  UNDERDOG_STORY: "underdog_story",
  CORPS_SPOTLIGHT: "corps_spotlight",
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
// IMAGE GENERATION
// =============================================================================

// Configuration: Set to true to use paid Imagen 4 ($0.02/image), false for free Gemini Flash
const USE_PAID_IMAGE_GEN = true;

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
- Action shots showing performers marching and playing
- Groups of 3-8 performers in formation, not isolated single portraits
- Football stadium setting with grass field and yard lines visible
- Stadium lighting at dusk or night
- Captures motion and athletic energy

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
`;

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
 * Initialize the new Google GenAI SDK for image generation
 * @returns {GoogleGenAI} The initialized image generation client
 */
function initializeImageGenAI() {
  if (!imageGenAI) {
    const apiKey = geminiApiKey.value();
    if (!apiKey) {
      throw new Error("GOOGLE_GENERATIVE_AI_API_KEY secret is not set");
    }
    imageGenAI = new GoogleGenAI({ apiKey });
  }
  return imageGenAI;
}

/**
 * Generate an image using either free tier (Gemini Flash) or Imagen 4
 * Automatically prepends drum corps visual context to ensure accurate imagery.
 *
 * @param {string} prompt - Detailed image prompt
 * @returns {Promise<string>} Base64 image data or URL
 */
async function generateImageWithImagen(prompt) {
  try {
    const ai = initializeImageGenAI();

    // Build enhanced prompt with drum corps context to avoid concert imagery
    const enhancedPrompt = `${DRUM_CORPS_VISUAL_CONTEXT}

--- IMAGE REQUEST ---

${prompt}

${IMAGE_NEGATIVE_PROMPT}`;

    if (USE_PAID_IMAGE_GEN) {
      // Paid tier: Imagen 4 Fast ($0.02/image)
      const modelName = "imagen-4.0-fast-generate-001";
      const response = await ai.models.generateImages({
        model: modelName,
        prompt: enhancedPrompt,
        config: {
          numberOfImages: 1,
          aspectRatio: "16:9",
          outputMimeType: "image/jpeg",
        },
      });

      const generatedImage = response.generatedImages?.[0];
      if (generatedImage?.image?.imageBytes) {
        logger.info(`Image generated successfully using ${modelName}`);
        return `data:image/jpeg;base64,${generatedImage.image.imageBytes}`;
      }
    } else {
      // Free tier: Gemini 2.5 Flash with native image generation
      const modelName = "gemini-2.5-flash-preview-image-generation";
      const response = await ai.models.generateContent({
        model: modelName,
        contents: enhancedPrompt,
        config: {
          responseModalities: ["image", "text"],
        },
      });

      // Extract image from response parts
      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData?.data) {
          const mimeType = part.inlineData.mimeType || "image/png";
          logger.info(`Image generated successfully using ${modelName}`);
          return `data:${mimeType};base64,${part.inlineData.data}`;
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
 * Fetches uniform details from Firestore dci-reference collection.
 * Falls back to hardcoded DCI_UNIFORMS if Firestore data not available.
 *
 * @param {object} db - Firestore database instance
 * @param {string} corpsName - Name of the corps
 * @param {number} year - Optional year for show-specific details
 * @returns {Promise<object>} Uniform details object
 */
async function getUniformDetailsFromFirestore(db, corpsName, year = null) {
  try {
    // Try to fetch from Firestore first
    const corpsDoc = await db.doc("dci-reference/corps").get();

    if (corpsDoc.exists) {
      const corpsData = corpsDoc.data();
      const corpsEntry = Object.values(corpsData.corps || {}).find(
        c => c.name === corpsName || c.name.toLowerCase() === corpsName.toLowerCase()
      );

      if (corpsEntry && corpsEntry.defaultUniform) {
        const uniform = { ...corpsEntry.defaultUniform };

        // If year specified, try to get show title from Firestore
        if (year && corpsEntry.id) {
          const showsDoc = await db.doc(`dci-reference/shows-${corpsEntry.id}`).get();
          if (showsDoc.exists) {
            const showData = showsDoc.data().shows?.[year];
            if (showData?.title) {
              uniform.showName = showData.title;
            }
          }
        }

        return uniform;
      }
    }
  } catch (error) {
    logger.warn(`Firestore lookup failed for ${corpsName}, using hardcoded data:`, error.message);
  }

  // Fall back to hardcoded data
  return getUniformDetails(corpsName, year);
}

/**
 * Gets show title for a corps and year from Firestore.
 * Falls back to hardcoded DCI_UNIFORMS showName if available.
 *
 * @param {object} db - Firestore database instance
 * @param {string} corpsName - Name of the corps
 * @param {number} year - Year of the show
 * @returns {Promise<string|null>} Show title or null
 */
async function getShowTitleFromFirestore(db, corpsName, year) {
  try {
    // Try to get corps ID first
    const corpsDoc = await db.doc("dci-reference/corps").get();

    if (corpsDoc.exists) {
      const corpsData = corpsDoc.data();
      const corpsEntry = Object.values(corpsData.corps || {}).find(
        c => c.name === corpsName || c.name.toLowerCase() === corpsName.toLowerCase()
      );

      if (corpsEntry?.id) {
        const showsDoc = await db.doc(`dci-reference/shows-${corpsEntry.id}`).get();
        if (showsDoc.exists) {
          const showData = showsDoc.data().shows?.[year];
          if (showData?.title) {
            return showData.title;
          }
        }
      }
    }
  } catch (error) {
    logger.warn(`Firestore show lookup failed for ${corpsName} ${year}:`, error.message);
  }

  // Fall back to hardcoded data
  const corps = DCI_UNIFORMS[corpsName];
  if (corps?.[year]?.showName) {
    return corps[year].showName;
  }

  return null;
}

/**
 * Interprets a show title into visual thematic elements for image generation.
 * Uses keyword analysis to suggest mood, lighting, colors, and atmosphere.
 *
 * @param {string} showTitle - The corps' show title (e.g., "Ghostlight", "Kinetic Noise")
 * @returns {object} Thematic elements for image generation
 */
function interpretShowTheme(showTitle) {
  if (!showTitle) {
    return null;
  }

  const titleLower = showTitle.toLowerCase();
  const theme = {
    title: showTitle,
    mood: "dramatic",
    lighting: "stadium lights",
    atmosphere: "competitive",
    visualElements: [],
  };

  // Theatrical/stage themes
  if (/ghost|phantom|spirit|haunt|shadow|spectr/i.test(titleLower)) {
    theme.mood = "ethereal and haunting";
    theme.lighting = "dramatic backlighting with haze, ghostly spotlight beams";
    theme.atmosphere = "theatrical, mysterious";
    theme.visualElements.push("fog/haze effects", "dramatic silhouettes");
  }

  // Light/illumination themes
  if (/light|glow|shine|bright|radiant|lumina|aurora/i.test(titleLower)) {
    theme.mood = "radiant and uplifting";
    theme.lighting = "warm golden spotlights, lens flares, dynamic light beams";
    theme.atmosphere = "hopeful, transcendent";
    theme.visualElements.push("light beam effects", "golden hour warmth");
  }

  // Dark/night themes
  if (/dark|night|shadow|eclipse|noir|black/i.test(titleLower)) {
    theme.mood = "intense and dramatic";
    theme.lighting = "high contrast, deep shadows with rim lighting";
    theme.atmosphere = "mysterious, powerful";
    theme.visualElements.push("dramatic shadows", "silhouette moments");
  }

  // Fire/heat themes
  if (/fire|flame|burn|inferno|heat|phoenix|blaze/i.test(titleLower)) {
    theme.mood = "intense and passionate";
    theme.lighting = "warm orange and red undertones, flickering quality";
    theme.atmosphere = "energetic, fierce";
    theme.visualElements.push("warm color palette", "dynamic motion");
  }

  // Water/ocean themes
  if (/water|ocean|sea|wave|tide|storm|rain|aqua/i.test(titleLower)) {
    theme.mood = "flowing and powerful";
    theme.lighting = "cool blue undertones, fluid light patterns";
    theme.atmosphere = "dynamic, elemental";
    theme.visualElements.push("cool color palette", "flowing movement");
  }

  // Space/cosmic themes
  if (/star|space|cosmic|galaxy|planet|universe|infinity|stellar/i.test(titleLower)) {
    theme.mood = "vast and awe-inspiring";
    theme.lighting = "deep blue and purple hues, starfield effects";
    theme.atmosphere = "expansive, otherworldly";
    theme.visualElements.push("cosmic color palette", "scale and grandeur");
  }

  // Music/sound themes
  if (/music|sound|noise|rhythm|melody|symphony|jazz|rock/i.test(titleLower)) {
    theme.mood = "energetic and rhythmic";
    theme.lighting = "dynamic concert-style lighting, color washes";
    theme.atmosphere = "musical, expressive";
    theme.visualElements.push("musical energy", "rhythmic motion");
  }

  // Art/creative themes
  if (/art|paint|canvas|color|cut-out|collage|ink|sketch/i.test(titleLower)) {
    theme.mood = "creative and artistic";
    theme.lighting = "gallery-quality, even illumination with dramatic accents";
    theme.atmosphere = "artistic, refined";
    theme.visualElements.push("artistic composition", "creative framing");
  }

  // Nature themes
  if (/nature|earth|forest|garden|bloom|spring|season/i.test(titleLower)) {
    theme.mood = "organic and natural";
    theme.lighting = "natural sunlight quality, golden hour warmth";
    theme.atmosphere = "serene, grounded";
    theme.visualElements.push("natural warmth", "organic flow");
  }

  // Machine/technology themes
  if (/machine|metal|steel|techno|cyber|kinetic|robot|engine/i.test(titleLower)) {
    theme.mood = "precise and mechanical";
    theme.lighting = "industrial lighting, metallic reflections";
    theme.atmosphere = "powerful, engineered";
    theme.visualElements.push("mechanical precision", "angular forms");
  }

  // Revolution/change themes
  if (/revolution|rebel|rise|break|shatter|transform|evolve/i.test(titleLower)) {
    theme.mood = "powerful and transformative";
    theme.lighting = "dynamic, high contrast with movement";
    theme.atmosphere = "intense, breakthrough moment";
    theme.visualElements.push("dynamic tension", "pivotal moment");
  }

  // Classical/mythology themes
  if (/myth|legend|epic|hero|god|ancient|greek|roman|zeus|atlas/i.test(titleLower)) {
    theme.mood = "epic and timeless";
    theme.lighting = "classical painting quality, chiaroscuro";
    theme.atmosphere = "legendary, monumental";
    theme.visualElements.push("heroic scale", "classical grandeur");
  }

  // Dreams/imagination themes
  if (/dream|imagine|fantasy|vision|wonder|magic|illusion/i.test(titleLower)) {
    theme.mood = "dreamlike and surreal";
    theme.lighting = "soft, diffused with ethereal quality";
    theme.atmosphere = "whimsical, imaginative";
    theme.visualElements.push("soft focus edges", "dreamlike quality");
  }

  return theme;
}

/**
 * Builds a thematic context string for image prompts based on show title.
 *
 * @param {string} showTitle - The corps' show title
 * @returns {string} Thematic context for the image prompt
 */
function buildShowThemeContext(showTitle) {
  const theme = interpretShowTheme(showTitle);

  if (!theme) {
    return "";
  }

  let context = `\nSHOW THEME CONTEXT - "${theme.title}":`;
  context += `\n- Mood: ${theme.mood}`;
  context += `\n- Lighting suggestion: ${theme.lighting}`;
  context += `\n- Atmosphere: ${theme.atmosphere}`;

  if (theme.visualElements.length > 0) {
    context += `\n- Visual elements: ${theme.visualElements.join(", ")}`;
  }

  context += `\n\nIncorporate this show's thematic elements naturally into the image while maintaining DCI authenticity.`;

  return context;
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
    dci: `CLOSEUP PORTRAIT of a DCI (Drum Corps International) performer.

HEADLINE CONTEXT: "${headline}"

SHOT TYPE: Intimate closeup portrait photograph
- Single performer fills most of the frame
- Waist-up or chest-up framing
- Stadium/field is heavily blurred in background
- 85-200mm telephoto lens, f/2.8, shallow depth of field

SUBJECT (choose most appropriate for headline):
- Brass player with horn raised, bell catching stadium lights
- Snare drummer mid-stroke, focused expression
- Guard member with rifle or flag, equipment visible
- Mellophone or baritone player in powerful moment

UNIFORM: Military-style marching uniform with shako or plumed helmet, white gloves

LIGHTING: Stadium lights creating dramatic rim lighting, evening atmosphere
MOOD: Intensity, determination, athletic performance

TECHNICAL: Professional sports portrait photography, performer sharply isolated from blurred background`,

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

// =============================================================================
// COMPOSITION VARIETY - Random elements for unique images
// =============================================================================

/**
 * Camera angles for variety in image composition
 */
const CAMERA_ANGLES = [
  { angle: "tight portrait, 6 feet from performer, 85mm lens, shallow depth of field", description: "intimate closeup showing uniform and expression" },
  { angle: "medium closeup, 10 feet away, shooting slightly upward at performer", description: "heroic low angle emphasizing power" },
  { angle: "profile closeup, 8 feet beside performer, capturing helmet/shako detail", description: "dramatic side view showing headwear" },
  { angle: "three-quarter portrait, 12 feet at 45-degree angle, waist-up framing", description: "classic portrait showing uniform colors" },
  { angle: "tight chest-up shot, 8 feet away, telephoto compression f/2.8", description: "upper body detail with creamy bokeh background" },
  { angle: "dramatic low angle closeup, 5 feet away shooting upward", description: "powerful hero shot against stadium lights" },
  { angle: "eye-level intimate portrait, 7 feet from performer", description: "emotional connection showing face and uniform" },
  { angle: "over-shoulder closeup, 6 feet behind performer, instrument visible", description: "showing instrument and uniform detail" },
];

/**
 * Performer moments to capture
 */
const PERFORMER_MOMENTS = [
  { moment: "peak of a sustained high note, body extended, bell high", emotion: "triumph and power" },
  { moment: "mid-phrase during a technical run, fingers flying", emotion: "intense concentration" },
  { moment: "dramatic pause before the hit, frozen anticipation", emotion: "tension and focus" },
  { moment: "recovery breath between phrases, human moment", emotion: "vulnerability and determination" },
  { moment: "marching at full stride during a company front", emotion: "unified precision" },
  { moment: "pivot turn with bell swing, athletic move", emotion: "dynamic athleticism" },
  { moment: "soft ballad moment, intimate expression", emotion: "emotional depth" },
  { moment: "final chord sustain, everything given", emotion: "exhaustion and satisfaction" },
];

/**
 * Lighting variations for different atmospheres
 */
const LIGHTING_VARIATIONS = [
  { lighting: "golden hour sunlight from stadium west side, warm rim lighting on performers", mood: "warm and triumphant" },
  { lighting: "stadium lights from above creating harsh shadows, night competition feel", mood: "intense competition" },
  { lighting: "overcast diffused light, even illumination across field", mood: "documentary realism" },
  { lighting: "dramatic backlighting from scoreboard, silhouette edges", mood: "dramatic and artistic" },
  { lighting: "mixed stadium lights and sunset, purple-orange sky", mood: "twilight magic" },
  { lighting: "full night with stadium floods, high contrast pools of light", mood: "nighttime spectacle" },
  { lighting: "early afternoon harsh sun, strong shadows", mood: "raw and unfiltered" },
  { lighting: "rain delay clearing, wet field reflecting lights", mood: "atmospheric drama" },
];

/**
 * Section formations for group shots
 */
const SECTION_FORMATIONS = [
  { formation: "tight block formation, shoulder to shoulder", visual: "unity and precision" },
  { formation: "curved arc sweeping across the 35 to 45 yard lines", visual: "graceful power" },
  { formation: "diagonal line from front sideline to back hash", visual: "dynamic movement" },
  { formation: "scattered cluster transitioning to form", visual: "organized chaos" },
  { formation: "company front spanning goal line to goal line", visual: "overwhelming scale" },
  { formation: "pinwheel rotation mid-transition", visual: "kinetic energy" },
  { formation: "layered depth with front, mid, and back rows", visual: "dimensional depth" },
];

/**
 * Subject focus variations
 */
const SUBJECT_FOCUS = [
  { focus: "single performer portrait", framing: "tight crop on one performer, face and upper body, background completely blurred" },
  { focus: "single performer with instrument detail", framing: "one performer showing instrument and uniform clearly, shallow DOF" },
  { focus: "single performer profile", framing: "side view of one performer, helmet/shako prominent, blurred field behind" },
  { focus: "single performer action shot", framing: "one performer mid-movement, uniform colors prominent, isolated from group" },
  { focus: "pair of performers closeup", framing: "two performers in tight frame, showing uniform detail and synchronization" },
];

/**
 * Randomly select an item from an array
 * Uses article seed for reproducibility within same article
 */
function randomSelect(array, seed = null) {
  if (seed) {
    // Simple seeded random for reproducibility
    const hash = seed.split('').reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0);
    return array[Math.abs(hash) % array.length];
  }
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Get a unique composition set for an image
 * Returns camera angle, moment, lighting, and formation
 */
function getRandomComposition(seed = null) {
  return {
    camera: randomSelect(CAMERA_ANGLES, seed),
    moment: randomSelect(PERFORMER_MOMENTS, seed ? seed + "moment" : null),
    lighting: randomSelect(LIGHTING_VARIATIONS, seed ? seed + "light" : null),
    formation: randomSelect(SECTION_FORMATIONS, seed ? seed + "form" : null),
    focus: randomSelect(SUBJECT_FOCUS, seed ? seed + "focus" : null),
  };
}

/**
 * Build comprehensive image prompt for DCI standings article
 * Features the leading corps with accurate historical uniform
 *
 * @param {string} topCorps - Corps name
 * @param {number} year - Year of the performance
 * @param {string} location - Competition location
 * @param {string} showName - Competition/show name (e.g., "DCI Finals")
 * @param {string} showTitle - Corps' production title (e.g., "Ghostlight", "Kinetic Noise")
 */
function buildStandingsImagePrompt(topCorps, year, location, showName, showTitle = null) {
  const details = getUniformDetails(topCorps, year);
  const themeContext = buildShowThemeContext(showTitle);

  // Get random composition for variety
  const seed = `${topCorps}-${year}-standings`;
  const comp = getRandomComposition(seed);

  return `Action photograph of ${topCorps} brass section performing (${year} season).

═══════════════════════════════════════════════════════════════
UNIFORM - THIS IS THE MOST IMPORTANT PART - MUST BE EXACT:
═══════════════════════════════════════════════════════════════
Corps: ${topCorps}
Uniform colors and style: ${details.uniform}
Headwear: ${details.helmet}
Instruments: ${details.brass}

DO NOT USE: generic red plumes, generic white shakos, or any uniform that doesn't match the description above.
The uniform MUST match ${topCorps}'s distinctive colors and style.
IMPORTANT: Show ONLY brass players with brass instruments. No drums in this shot.
═══════════════════════════════════════════════════════════════
${themeContext}
SHOT TYPE: Sports action photograph
- 4-6 brass players marching in formation, playing their instruments
- Mid-range shot showing full uniforms and instruments clearly
- Football field with yard lines visible in background
- Stadium seating or lights visible but not dominant

PERFORMERS: ${comp.moment.moment}
- Athletic, powerful stances while marching and playing
- White marching gloves visible
- Uniform details clearly visible
- All performers holding brass instruments (mellophones, baritones, trumpets)

LIGHTING: ${comp.lighting.lighting}
- Mood: ${comp.lighting.mood}

TECHNICAL: Professional sports photography, 70-200mm lens, f/4, action shot with slight motion blur on marching feet, sharp on faces and instruments.

This is ${topCorps} from ${showName || "a DCI competition"}${location ? ` in ${location}` : ""}${showTitle ? `, performing "${showTitle}"` : ""}.`;
}

/**
 * Build image prompt for DCI caption analysis article
 * Features the section that excelled in captions
 *
 * @param {string} featuredCorps - Corps name
 * @param {number} year - Year of the performance
 * @param {string} captionType - Caption category (e.g., "Brass", "Percussion")
 * @param {string} location - Competition location
 * @param {string} showTitle - Corps' production title (e.g., "Ghostlight")
 */
function buildCaptionsImagePrompt(featuredCorps, year, captionType, location, showTitle = null) {
  const details = getUniformDetails(featuredCorps, year);
  const themeContext = buildShowThemeContext(showTitle);

  // Get random composition for variety
  const seed = `${featuredCorps}-${year}-${captionType}-captions`;
  const comp = getRandomComposition(seed);

  // Determine which section to feature based on caption
  let sectionFocus, sectionDetails, groupDescription, instrumentNote;

  if (captionType.includes("Brass") || captionType.includes("B")) {
    sectionFocus = "brass section";
    sectionDetails = details.brass;
    groupDescription = "4-6 brass players marching in formation, horns raised, bells catching the light";
    instrumentNote = "All performers holding brass instruments (mellophones, baritones, trumpets). NO drums.";
  } else if (captionType.includes("Percussion") || captionType.includes("P")) {
    sectionFocus = "drumline";
    sectionDetails = details.percussion;
    groupDescription = "4-6 drummers (snare line or tenor line) marching in tight formation, sticks in motion";
    instrumentNote = "All performers wearing drums on harnesses (snares or tenors). NO brass instruments.";
  } else if (captionType.includes("Guard") || captionType.includes("CG")) {
    sectionFocus = "color guard";
    sectionDetails = details.guard;
    groupDescription = "3-5 guard members in athletic costumes with flags or rifles mid-toss";
    instrumentNote = "Guard members with silks, rifles, or sabres. NO instruments.";
  } else if (captionType.includes("Visual") || captionType.includes("V")) {
    sectionFocus = "brass section";
    sectionDetails = details.uniform;
    groupDescription = "4-6 performers showing perfect body technique and marching form";
    instrumentNote = "All performers holding brass instruments with excellent posture and technique.";
  } else {
    // GE or general
    sectionFocus = "brass section";
    sectionDetails = details.uniform;
    groupDescription = "4-6 performers in an emotional, expressive moment";
    instrumentNote = "All performers holding brass instruments.";
  }

  return `Action photograph of ${featuredCorps} ${sectionFocus} performing (${year} season).

═══════════════════════════════════════════════════════════════
UNIFORM - THIS IS THE MOST IMPORTANT PART - MUST BE EXACT:
═══════════════════════════════════════════════════════════════
Corps: ${featuredCorps}
Uniform colors and style: ${details.uniform}
Headwear: ${details.helmet}
Section equipment: ${sectionDetails}

DO NOT USE: generic red plumes, generic white shakos, or any uniform that doesn't match the description above.
The uniform MUST match ${featuredCorps}'s distinctive colors and style.
IMPORTANT: ${instrumentNote}
═══════════════════════════════════════════════════════════════
${themeContext}
SHOT TYPE: Sports action photograph of ${groupDescription}
- Mid-range shot showing full uniforms and equipment clearly
- Football field with yard lines visible in background
- Stadium seating or lights visible but not dominant

PERFORMERS: ${comp.moment.moment}
- Athletic, powerful stances while performing
- White marching gloves visible
- Uniform details clearly visible

LIGHTING: ${comp.lighting.lighting}
- Mood: ${comp.lighting.mood}

TECHNICAL: Professional sports photography, 70-200mm lens, f/4, action shot capturing motion and energy.

This is ${featuredCorps} from ${location || "a DCI competition"}${showTitle ? `, performing "${showTitle}"` : ""}, showcasing ${captionType} excellence.`;
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

  // Get random composition for variety
  const seed = `${topCorpsName}-${location || "fantasy"}-performers`;
  const comp = getRandomComposition(seed);

  // Determine venue based on director preference or default
  const venueDescription = details.venuePreference === "indoor"
    ? "Modern indoor arena with dramatic LED lighting systems"
    : details.venuePreference === "outdoor"
      ? "Outdoor stadium under evening sky with dramatic stadium lighting"
      : "Professional marching arts competition venue with dramatic lighting";

  return `Photorealistic photograph of a performer from the fantasy marching arts ensemble "${topCorpsName}"${location ? ` from ${location}` : ""}.

UNIFORM DESIGN${details.matchedTheme === "director-custom" ? " (Director-Specified)" : ""}:
- Colors: ${details.colors}
- Uniform: ${details.uniform}
- Headwear: ${details.helmet}
- Brass: ${details.brass}
- Guard elements: ${details.guard}
${details.additionalNotes ? `- Special notes: ${details.additionalNotes}` : ""}

COMPOSITION & CAMERA:
- Position: ${comp.camera.angle}
- Focus: ${comp.focus.focus} - ${comp.focus.framing}
- Moment: ${comp.moment.moment}
- Capturing: ${comp.moment.emotion}

SCENE SETTING:
- ${venueDescription}
- ${theme || "Competition performance moment"}
- ${details.performanceStyle ? `Performance style: ${details.performanceStyle}` : "Professional marching arts competition atmosphere"}

LIGHTING & ATMOSPHERE:
- ${comp.lighting.lighting}
- Mood: ${comp.lighting.mood}
- Stadium/arena environment enhancing the drama

PERFORMER DETAILS:
- Expression showing ${comp.moment.emotion}
- Uniform pristine and dramatically lit
- Athletic, professional bearing

PHOTOGRAPHY STYLE:
- Professional sports photography
- ${comp.focus.framing}
- High contrast, saturated colors matching corps theme

AUTHENTICITY:
- Instrument must be realistic (baritone, mellophone, or trumpet with correct valve/tubing)
- Uniform is creative but still clearly a marching arts uniform (not costume)
- White marching gloves, black marching shoes
- Professional posture and bearing

This fantasy corps image should show ${comp.camera.description} - distinctive and memorable while authentic to competitive marching arts.`;
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
 *
 * @param {string} featuredCorps - Corps name
 * @param {number} year - Year of the performance
 * @param {string} analysisType - Type of analysis (e.g., "trajectory analysis")
 * @param {string} showTitle - Corps' production title (e.g., "Ghostlight")
 */
function buildAnalyticsImagePrompt(featuredCorps, year, analysisType, showTitle = null) {
  const details = getUniformDetails(featuredCorps, year);
  const themeContext = buildShowThemeContext(showTitle);

  // Get random composition for variety
  const seed = `${featuredCorps}-${year}-${analysisType}-analytics`;
  const comp = getRandomComposition(seed);

  // Analytics-specific camera angles (elevated views for formation analysis)
  const analyticsAngles = [
    "press box level, 50 yards back, wide telephoto showing full formation",
    "end zone tower, 40 feet up, looking down the length of the field",
    "corner tower shot, capturing diagonal depth of formation",
    "sideline scaffold, elevated 25 feet, parallel to company front",
    "drone-style overhead, 60 feet up, geometric pattern emphasis",
  ];
  const selectedAngle = analyticsAngles[Math.abs(seed.split('').reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0)) % analyticsAngles.length];

  return `Photorealistic elevated photograph showing ${featuredCorps} (${year}) in ${comp.formation.formation}${showTitle ? ` from their show "${showTitle}"` : ""}.

FORMATION FOCUS:
- Corps displaying ${comp.formation.visual}
- Pattern clearly visible from elevated position
- Individual performers visible but formation structure is the focus

UNIFORM ACCURACY:
- Uniform: ${details.uniform}
- Headwear: ${details.helmet}
- Formation shows military precision and spacing
${themeContext}
COMPOSITION & CAMERA:
- Position: ${selectedAngle}
- Formation: ${comp.formation.formation}
- Wide shot capturing 30-50+ performers

LIGHTING & ATMOSPHERE:
- ${comp.lighting.lighting}
- Mood: ${comp.lighting.mood}
- Shadow patterns showing performer positions clearly

ANALYTICAL ELEMENTS:
- Yard lines visible for spatial reference
- Formation geometry emphasized through lighting
- Clear sight lines showing drill design precision

PHOTOGRAPHY:
- Elevated angle optimized for formation visibility
- Sharp focus throughout formation
- Professional documentary style

MOOD:
- Analytical, studying excellence
- Historic performance documentation
- The kind of image coaches would study for drill design

This image should feel like film study material - capturing ${comp.formation.visual} and the precision that made ${featuredCorps}'s ${year} ${analysisType} analytically significant.`;
}

/**
 * Build image prompt for underdog story article
 * Shows determination and breakthrough moment
 *
 * @param {string} corps - Corps name
 * @param {number} year - Historical year
 * @param {string} location - Competition location
 * @param {string} showTitle - Corps' production title
 */
function buildUnderdogImagePrompt(corps, year, location, showTitle = null) {
  const details = getUniformDetails(corps, year);
  const themeContext = buildShowThemeContext(showTitle);

  // Get random composition emphasizing triumph
  const seed = `${corps}-${year}-underdog`;
  const comp = getRandomComposition(seed);

  return `Action photograph capturing a breakthrough moment for ${corps} brass section (${year} season)${showTitle ? ` performing "${showTitle}"` : ""} at ${location || "a DCI competition"}.

SUBJECT: 4-6 brass players from ${corps} in a moment of triumph and determination - ${comp.moment.moment}

UNIFORM ACCURACY:
- Uniform: ${details.uniform}
- Headwear: ${details.helmet}
- Instruments: ${details.brass}
IMPORTANT: Show ONLY brass players with brass instruments. NO drums in this shot.
${themeContext}
EMOTIONAL NARRATIVE:
- Capturing the spirit of an underdog rising to the occasion
- Expressions showing fierce determination and joy
- The moment when hard work pays off
- ${comp.moment.emotion}

COMPOSITION:
- Mid-range action shot showing 4-6 brass players marching in formation
- Football field with yard lines visible in background
- Background suggests the magnitude of the achievement

LIGHTING & ATMOSPHERE:
- ${comp.lighting.lighting}
- Mood: ${comp.lighting.mood}
- Stadium environment enhancing the triumphant moment

PHOTOGRAPHY STYLE:
- Inspirational sports photography, 70-200mm lens
- High emotional impact action shot
- Professional sports documentary feel
- Colors true to ${corps} palette, vivid and proud

This image should capture the essence of an underdog story - the corps that exceeded expectations and proved the doubters wrong.`;
}

/**
 * Build image prompt for corps spotlight article
 * Shows the corps' identity and character
 *
 * @param {string} corps - Corps name
 * @param {number} year - Historical year
 * @param {string} showTitle - Corps' production title
 */
function buildCorpsSpotlightImagePrompt(corps, year, showTitle = null) {
  const details = getUniformDetails(corps, year);
  const themeContext = buildShowThemeContext(showTitle);

  // Get random composition for variety
  const seed = `${corps}-${year}-spotlight`;
  const comp = getRandomComposition(seed);

  return `Action photograph showcasing the identity and excellence of ${corps} brass section (${year} season)${showTitle ? ` performing "${showTitle}"` : ""}.

SUBJECT: 4-6 brass players from ${corps} marching in formation, showcasing the corps' distinctive identity.

UNIFORM IDENTITY (CRITICAL):
- Uniform: ${details.uniform}
- Headwear: ${details.helmet}
- Instruments: ${details.brass}
IMPORTANT: Show ONLY brass players with brass instruments. NO drums in this shot.
${themeContext}
COMPOSITION:
- ${comp.formation.formation} arrangement of brass performers
- Mid-range action shot showing full uniforms and instruments clearly
- Football field with yard lines visible in background
- Capturing the pride and tradition of ${corps}

LIGHTING & ATMOSPHERE:
- ${comp.lighting.lighting}
- Mood: Pride, excellence, tradition
- Stadium environment suggesting legacy and history

CORPS CHARACTER:
- Showcasing what makes ${corps} unique
- Modern athletic uniforms meeting high-level performance
- The visual identity that fans recognize instantly

PHOTOGRAPHY STYLE:
- Professional sports action photography, 70-200mm lens
- Rich, saturated colors emphasizing corps palette
- Captures motion and athletic energy

This should be an iconic image that captures the essence of ${corps} - their tradition, their excellence, and what makes them special in the DCI world.`;
}

// =============================================================================
// DYNAMIC TONE SYSTEM - Contextual writing style
// =============================================================================

/**
 * Analyze competition context to determine appropriate article tone
 * @param {Array} dayScores - Current day's scores
 * @param {Object} trendData - Trend data for all corps
 * @param {number} reportDay - Current season day
 * @returns {Object} Competition context analysis
 */
function analyzeCompetitionContext(dayScores, trendData, reportDay) {
  if (!dayScores || dayScores.length === 0) {
    return { scenario: "standard", intensity: "moderate" };
  }

  const topCorps = dayScores[0];
  const secondCorps = dayScores[1];
  const thirdCorps = dayScores[2];

  // Calculate key metrics
  const leadMargin = topCorps && secondCorps ? topCorps.total - secondCorps.total : 0;
  const top3Spread = topCorps && thirdCorps ? topCorps.total - thirdCorps.total : 0;

  // Find biggest daily movers
  const dailyChanges = Object.entries(trendData).map(([corps, data]) => ({
    corps,
    change: data.dayChange || 0,
    trend: data.trendFromAvg || 0,
  }));
  const biggestGainer = dailyChanges.sort((a, b) => b.change - a.change)[0];
  const biggestLoser = dailyChanges.sort((a, b) => a.change - b.change)[0];

  // Determine season phase
  let seasonPhase;
  if (reportDay <= 10) {
    seasonPhase = "early"; // Opening shows, everything is new
  } else if (reportDay <= 25) {
    seasonPhase = "mid"; // Regional competitions, patterns emerging
  } else if (reportDay <= 35) {
    seasonPhase = "late"; // Approaching finals, stakes are high
  } else {
    seasonPhase = "championship"; // Finals week
  }

  // Determine competitive scenario
  let scenario;
  let intensity;

  if (leadMargin < 0.3) {
    scenario = "tight_race"; // Less than 0.3 points - anyone's game
    intensity = "high";
  } else if (leadMargin < 0.8) {
    scenario = "competitive"; // Close but leader has edge
    intensity = "moderate-high";
  } else if (leadMargin > 2.0) {
    scenario = "dominant_leader"; // Clear frontrunner
    intensity = "moderate";
  } else {
    scenario = "standard"; // Normal competitive spread
    intensity = "moderate";
  }

  // Check for dramatic movements
  const hasBigMover = biggestGainer && biggestGainer.change > 0.5;
  const hasBigDrop = biggestLoser && biggestLoser.change < -0.5;
  const hasShakeup = hasBigMover || hasBigDrop;

  // Check for position battles (corps within 0.2 of each other)
  const positionBattles = [];
  for (let i = 0; i < dayScores.length - 1; i++) {
    const gap = dayScores[i].total - dayScores[i + 1].total;
    if (gap < 0.2) {
      positionBattles.push({
        position: i + 1,
        corps1: dayScores[i].corps,
        corps2: dayScores[i + 1].corps,
        gap: gap.toFixed(3),
      });
    }
  }

  return {
    scenario,
    intensity,
    seasonPhase,
    leadMargin: leadMargin.toFixed(3),
    top3Spread: top3Spread.toFixed(3),
    hasShakeup,
    biggestGainer: biggestGainer?.corps || null,
    biggestGainerChange: biggestGainer?.change?.toFixed(3) || "0.000",
    biggestLoser: biggestLoser?.corps || null,
    biggestLoserChange: biggestLoser?.change?.toFixed(3) || "0.000",
    positionBattles,
    positionBattleCount: positionBattles.length,
  };
}

/**
 * Generate dynamic tone guidance based on competition context
 * @param {Object} context - Competition context from analyzeCompetitionContext
 * @param {string} articleType - Type of article being generated
 * @returns {string} Tone guidance for the AI prompt
 */
function getToneGuidance(context, articleType) {
  const { scenario, seasonPhase, hasShakeup, positionBattleCount, intensity } = context;

  // Base tone elements
  const toneElements = [];

  // Season phase affects overall framing
  switch (seasonPhase) {
    case "early":
      toneElements.push("Frame as season-opening excitement");
      toneElements.push("Acknowledge early-season variability");
      toneElements.push("Emphasize potential and trajectory over final standings");
      break;
    case "mid":
      toneElements.push("Note emerging patterns and trends");
      toneElements.push("Compare to early-season expectations");
      toneElements.push("Build narrative momentum toward finals");
      break;
    case "late":
      toneElements.push("Emphasize high stakes as finals approach");
      toneElements.push("Every tenth matters now");
      toneElements.push("Championship implications in every score");
      break;
    case "championship":
      toneElements.push("Finals week intensity - this is what they've worked for");
      toneElements.push("Legacy and history on the line");
      toneElements.push("Maximum drama and stakes");
      break;
  }

  // Competitive scenario affects urgency
  switch (scenario) {
    case "tight_race":
      toneElements.push("URGENT: Race is razor-close, convey tension and uncertainty");
      toneElements.push("Every performance could decide the outcome");
      toneElements.push("Use phrases like 'dead heat', 'too close to call', 'margin of error'");
      break;
    case "competitive":
      toneElements.push("Competitive but not desperate");
      toneElements.push("Leader has work to do to hold off challengers");
      toneElements.push("Focus on what challengers need to close the gap");
      break;
    case "dominant_leader":
      toneElements.push("Acknowledge dominance without removing drama from other battles");
      toneElements.push("Focus on battles for 2nd-5th, underdog stories");
      toneElements.push("Dynasty/legacy narrative for the leader");
      break;
    default:
      toneElements.push("Professional sports journalism tone");
      toneElements.push("Balanced analysis of the competitive field");
  }

  // Shakeups add excitement
  if (hasShakeup) {
    toneElements.push("BREAKING NEWS energy - something significant happened today");
    toneElements.push("Lead with the surprise/upset angle");
    toneElements.push("Use language of shock, breakthrough, or collapse as appropriate");
  }

  // Position battles add tension
  if (positionBattleCount > 3) {
    toneElements.push("Emphasize the chaotic middle of the pack");
    toneElements.push("Multiple corps are one performance away from moving");
  } else if (positionBattleCount > 0) {
    toneElements.push("Highlight specific position battles that could flip tomorrow");
  }

  // Article-specific tone adjustments
  if (articleType === "underdog_story") {
    toneElements.push("Inspirational underdog narrative - the corps that exceeded expectations");
    toneElements.push("Emotional resonance: determination, breakthrough, proving doubters wrong");
  } else if (articleType === "corps_spotlight") {
    toneElements.push("Celebratory profile tone - what makes this corps special");
    toneElements.push("Historical appreciation and current season analysis");
  } else if (articleType === "deep_analytics") {
    toneElements.push("Data-driven but accessible");
    toneElements.push("Numbers tell a story - find the narrative in the statistics");
  }

  // Build the tone guidance string
  return `
DYNAMIC TONE GUIDANCE (based on current competitive context):
Competition Scenario: ${scenario.replace(/_/g, " ").toUpperCase()} (${intensity} intensity)
Season Phase: ${seasonPhase.toUpperCase()} SEASON
${hasShakeup ? "⚡ SIGNIFICANT MOVEMENT TODAY - lead with this energy\n" : ""}
Writing Directives:
${toneElements.map(t => `• ${t}`).join("\n")}

Remember: Match your energy to the stakes. ${intensity === "high" ? "This is a pivotal moment - write like it matters." : intensity === "moderate-high" ? "Competition is heating up - convey the building tension." : "Maintain professional analysis while finding the compelling narratives."}`;
}

/**
 * Get a short tone descriptor for logging
 */
function getToneDescriptor(context) {
  const descriptors = [];
  if (context.scenario === "tight_race") descriptors.push("TENSE");
  if (context.hasShakeup) descriptors.push("BREAKING");
  if (context.seasonPhase === "championship") descriptors.push("FINALS");
  if (context.positionBattleCount > 3) descriptors.push("CHAOTIC");
  return descriptors.length > 0 ? descriptors.join("/") : "STANDARD";
}

// =============================================================================
// ARTICLE GENERATION
// =============================================================================

/**
 * Determine which 5th article to generate based on the day
 * Rotation schedule for variety:
 * - Underdog Story: Every 6th day (days 6, 12, 18, 24, 30, 36...)
 * - Deep Analytics: Even days (not underdog days)
 * - Corps Spotlight: Odd days (not underdog days)
 *
 * This gives readers variety while limiting underdog stories to ~once per week
 */
function getFifthArticleType(reportDay) {
  // Underdog story every 6 days (roughly once a week, but not too predictable)
  if (reportDay % 6 === 0) {
    return "underdog_story";
  }

  // Alternate between deep analytics and corps spotlight on other days
  if (reportDay % 2 === 0) {
    return "deep_analytics";
  }

  return "corps_spotlight";
}

/**
 * Generate 5 nightly articles with rotating variety
 *
 * Core articles (always generated):
 * 1. DCI Standings - Daily competition results
 * 2. DCI Captions - Caption analysis breakdown
 * 3. Fantasy Performers - Top fantasy ensemble results
 * 4. Fantasy Leagues - League standings and recaps
 *
 * Rotating 5th article (for variety):
 * - Deep Analytics (even days)
 * - Corps Spotlight (odd days)
 * - Underdog Story (every 6th day)
 */
async function generateAllArticles({ db, dataDocId, seasonId, currentDay }) {
  const reportDay = currentDay - 1;

  if (reportDay < 1) {
    return { success: false, error: "Invalid day" };
  }

  // Determine which rotating article to generate today
  const fifthArticleType = getFifthArticleType(reportDay);
  logger.info(`Generating 5 articles for Day ${reportDay} (5th article: ${fifthArticleType})`);

  try {
    // Fetch all data
    const activeCorps = await fetchActiveCorps(db, dataDocId);
    const yearsToFetch = [...new Set(activeCorps.map(c => c.sourceYear))];
    const historicalData = await fetchTimeLockednScores(db, yearsToFetch, reportDay);
    const fantasyData = await fetchFantasyRecaps(db, seasonId, reportDay);

    // Fetch show context (event name, location, date) - now includes all shows
    const showContext = await fetchShowContext(db, seasonId, historicalData, reportDay);
    logger.info(`Show context for Day ${reportDay}: ${showContext.showName} at ${showContext.location} on ${showContext.date}${showContext.allShows?.length > 1 ? ` (${showContext.allShows.length} shows total)` : ''}`);

    // Process data
    const dayScores = getScoresForDay(historicalData, reportDay, activeCorps);
    const trendData = calculateTrendData(historicalData, reportDay, activeCorps);
    const captionLeaders = identifyCaptionLeaders(dayScores, trendData);

    // Analyze competition context for dynamic tone
    const competitionContext = analyzeCompetitionContext(dayScores, trendData, reportDay);
    const toneDescriptor = getToneDescriptor(competitionContext);
    logger.info(`Competition context for Day ${reportDay}: ${toneDescriptor} (${competitionContext.scenario}, ${competitionContext.seasonPhase} season, lead margin: ${competitionContext.leadMargin})`);

    // Track which corps have been featured to ensure diversity across articles
    const featuredCorps = new Set();
    const featuredFantasyPerformers = new Set();

    // Generate articles sequentially to track featured corps and ensure diversity
    const articles = [];

    // Article 1: DCI Standings - features top corps
    const standingsArticle = await generateDciStandingsArticle({
      reportDay, dayScores, trendData, activeCorps, showContext, competitionContext, db
    });
    articles.push(standingsArticle);
    if (standingsArticle.featuredCorps) {
      featuredCorps.add(standingsArticle.featuredCorps);
    }

    // Article 2: DCI Captions - must feature a DIFFERENT corps than standings
    const captionsArticle = await generateDciCaptionsArticle({
      reportDay, dayScores, captionLeaders, activeCorps, showContext, competitionContext, trendData, db,
      excludeCorps: featuredCorps
    });
    articles.push(captionsArticle);
    if (captionsArticle.featuredCorps) {
      featuredCorps.add(captionsArticle.featuredCorps);
    }

    // Article 3: Fantasy Performers - features top fantasy performer
    const fantasyPerformersArticle = await generateFantasyPerformersArticle({
      reportDay, fantasyData, showContext, competitionContext, db, dataDocId
    });
    articles.push(fantasyPerformersArticle);
    if (fantasyPerformersArticle.featuredPerformer) {
      featuredFantasyPerformers.add(fantasyPerformersArticle.featuredPerformer);
    }

    // Article 4: Fantasy Leagues - must feature DIFFERENT performers than Fantasy Performers
    const fantasyLeaguesArticle = await generateFantasyLeaguesArticle({
      reportDay, fantasyData, showContext, competitionContext,
      excludePerformers: featuredFantasyPerformers
    });
    articles.push(fantasyLeaguesArticle);

    // Article 5: Rotating article - must feature a DIFFERENT corps than previous DCI articles
    let fifthArticle;
    switch (fifthArticleType) {
      case "underdog_story":
        fifthArticle = await generateUnderdogStoryArticle({
          reportDay, dayScores, trendData, activeCorps, showContext, competitionContext, db,
          excludeCorps: featuredCorps
        });
        break;
      case "corps_spotlight":
        fifthArticle = await generateCorpsSpotlightArticle({
          reportDay, dayScores, trendData, activeCorps, showContext, competitionContext, db,
          excludeCorps: featuredCorps
        });
        break;
      case "deep_analytics":
      default:
        fifthArticle = await generateDeepAnalyticsArticle({
          reportDay, dayScores, trendData, fantasyData, captionLeaders, showContext, competitionContext, db,
          excludeCorps: featuredCorps
        });
        break;
    }
    articles.push(fifthArticle);

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
        allShows: showContext.allShows,
        articleCount: articles.length,
        fifthArticleType,
        competitionContext: {
          scenario: competitionContext.scenario,
          seasonPhase: competitionContext.seasonPhase,
          intensity: competitionContext.intensity,
          toneDescriptor,
        },
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
async function generateDciStandingsArticle({ reportDay, dayScores, trendData, activeCorps, showContext, competitionContext, db }) {
  const topCorps = dayScores[0];
  const secondCorps = dayScores[1];
  const gap = topCorps && secondCorps ? (topCorps.total - secondCorps.total).toFixed(3) : "0.000";

  // Get dynamic tone guidance based on competition context
  const toneGuidance = getToneGuidance(competitionContext, "dci_standings");

  // Build list of all shows happening today for comprehensive coverage
  const allShowsText = showContext.allShows?.length > 1
    ? showContext.allShows.map(s => `• ${s.name}${s.location ? ` (${s.location})` : ''}`).join('\n')
    : `• ${showContext.showName}${showContext.location ? ` (${showContext.location})` : ''}`;

  const prompt = `You are a veteran DCI (Drum Corps International) journalist writing for marching.art, the premier fantasy platform for competitive drum corps.

CONTEXT: DCI is the premier competitive marching music organization in the world. Corps compete in shows judged on General Effect (GE), Visual, and Music captions. Scores range from 0-100, with top corps typically scoring 85-99. Every 0.001 point matters in these razor-thin competitions.

═══════════════════════════════════════════════════════════════
EVENT INFORMATION
═══════════════════════════════════════════════════════════════
• Date: ${showContext.date}
• Season Day: ${reportDay}
${showContext.allShows?.length > 1 ? `
ALL SHOWS TODAY (${showContext.allShows.length} competitions):
${allShowsText}
` : `• Show Name: ${showContext.showName}
• Location: ${showContext.location}`}
═══════════════════════════════════════════════════════════════

TODAY'S COMPETITION RESULTS${showContext.allShows?.length > 1 ? ' across all shows' : ` from ${showContext.showName} in ${showContext.location}`}:

STANDINGS WITH MOMENTUM ANALYSIS (Corps | Season | Score | Momentum):
${dayScores.slice(0, 12).map((s, i) => {
  const trend = trendData[s.corps];
  const change = trend?.dayChange || 0;
  const narrative = getTrendNarrative(trend, s.corps + reportDay);
  const momentumDesc = narrative?.full || "maintaining form";
  const captionNote = trend?.captionTrends ?
    Object.entries(trend.captionTrends).filter(([_, v]) => v.trending !== "stable").map(([k, v]) => `${k.toUpperCase()} ${v.trending}`).join(", ") : "";
  return `${i + 1}. ${s.corps} (${s.sourceYear}): ${s.total.toFixed(3)} pts [${change >= 0 ? '+' : ''}${change.toFixed(3)}]
   → ${momentumDesc}${trend?.streak >= 3 ? ` (${trend.streak}-day streak)` : ""}${captionNote ? ` | ${captionNote}` : ""}`;
}).join('\n')}

TREND HIGHLIGHTS:
${(() => {
  const surging = Object.entries(trendData).filter(([_, t]) => t.momentum === "surging" || t.momentum === "hot");
  const sliding = Object.entries(trendData).filter(([_, t]) => t.momentum === "sliding" || t.momentum === "cold");
  const atBest = Object.entries(trendData).filter(([_, t]) => t.atSeasonBest);
  const atWorst = Object.entries(trendData).filter(([_, t]) => t.atSeasonWorst);

  const highlights = [];
  if (surging.length > 0) highlights.push(`🔥 HOT: ${surging.map(([c]) => c).join(", ")}`);
  if (sliding.length > 0) highlights.push(`❄️ COLD: ${sliding.map(([c]) => c).join(", ")}`);
  if (atBest.length > 0) highlights.push(`📈 SEASON BEST: ${atBest.map(([c]) => c).join(", ")}`);
  if (atWorst.length > 0) highlights.push(`📉 SEASON LOW: ${atWorst.map(([c]) => c).join(", ")}`);
  return highlights.length > 0 ? highlights.join('\n') : "No significant trend changes today";
})()}

KEY STATISTICS:
- Lead margin: ${topCorps?.corps || 'N/A'} leads by ${gap} points
- Biggest gainer today: ${Object.entries(trendData).sort((a,b) => b[1].dayChange - a[1].dayChange)[0]?.[0] || 'N/A'}
- Corps count: ${dayScores.length} corps competing
${competitionContext.positionBattleCount > 0 ? `- Position battles: ${competitionContext.positionBattleCount} corps within 0.2 points of the position ahead` : ""}

${toneGuidance}

WRITE A PROFESSIONAL SPORTS ARTICLE covering today's standings. Your article should:

1. HEADLINE: Create an attention-grabbing headline like ESPN or Sports Illustrated would write. Reference the leading corps and the competitive narrative. Examples of good headlines: "Blue Devils Extend Dynasty with 0.425 Surge", "Crown Closes Gap: 0.15 Separates Top Three"

2. SUMMARY: 2-3 punchy sentences capturing the day's biggest story - who's leading, who's surging, who's falling.

3. NARRATIVE: A 600-800 word article (3-4 paragraphs) that:
   - Opens with the leader and their margin (make it dramatic)
   - Discusses position battles (who moved up/down and why it matters)
   - Analyzes momentum (which corps are trending hot or cold)
   - Closes with what to watch tomorrow

Reference that these are real historical DCI performances being relived through the fantasy platform.`;

  // Schema for structured output
  const schema = {
    type: SchemaType.OBJECT,
    properties: {
      headline: { type: SchemaType.STRING, description: "Attention-grabbing headline" },
      summary: { type: SchemaType.STRING, description: "2-3 sentence summary" },
      narrative: { type: SchemaType.STRING, description: "600-800 word article" },
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

    // Look up the corps' show title for thematic context
    const showTitle = db ? await getShowTitleFromFirestore(db, topCorps.corps, topCorps.sourceYear) : null;

    // Generate image featuring top corps with accurate historical uniform
    const imagePrompt = buildStandingsImagePrompt(
      topCorps.corps,
      topCorps.sourceYear,
      showContext.location,
      showContext.showName,
      showTitle
    );

    const imageData = await generateImageWithImagen(imagePrompt);
    const imageResult = await processGeneratedImage(imageData, "dci_standings");

    return {
      type: ARTICLE_TYPES.DCI_STANDINGS,
      ...content,
      featuredCorps: topCorps.corps, // Track which corps was featured for diversity
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
async function generateDciCaptionsArticle({ reportDay, dayScores, captionLeaders, activeCorps, showContext, competitionContext, trendData, db, excludeCorps = new Set() }) {
  // Get dynamic tone guidance
  const toneGuidance = getToneGuidance(competitionContext, "dci_captions");

  // Build list of all shows happening today for comprehensive coverage
  const allShowsText = showContext.allShows?.length > 1
    ? showContext.allShows.map(s => `• ${s.name}${s.location ? ` (${s.location})` : ''}`).join('\n')
    : `• ${showContext.showName}${showContext.location ? ` (${showContext.location})` : ''}`;

  const prompt = `You are a DCI caption analyst and technical expert writing for marching.art. You specialize in breaking down the scoring categories that determine DCI competition results.

CONTEXT: DCI scoring has three main categories:
- GENERAL EFFECT (GE): 40% of total - Measures overall entertainment value, emotional impact, and design excellence. Split into GE1 (Music Effect) and GE2 (Visual Effect).
- VISUAL: 30% of total - Measures marching technique, body movement, and color guard excellence. Includes Visual Proficiency (VP), Visual Analysis (VA), and Color Guard (CG).
- MUSIC: 30% of total - Measures musical performance quality. Includes Brass (B), Music Analysis (MA), and Percussion (P).

═══════════════════════════════════════════════════════════════
EVENT INFORMATION
═══════════════════════════════════════════════════════════════
• Date: ${showContext.date}
• Season Day: ${reportDay}
${showContext.allShows?.length > 1 ? `
ALL SHOWS TODAY (${showContext.allShows.length} competitions):
${allShowsText}
` : `• Show Name: ${showContext.showName}
• Location: ${showContext.location}`}
═══════════════════════════════════════════════════════════════

CAPTION BREAKDOWN${showContext.allShows?.length > 1 ? ' across all shows today' : ` from ${showContext.showName} in ${showContext.location}`}:

CAPTION LEADERS BY CATEGORY:
${captionLeaders.map(c => `${c.caption}: ${c.leader} scores ${c.score.toFixed(2)} [7-day trend: ${c.weeklyTrend}]`).join('\n')}

SUBCATEGORY TOTALS (Top 5 Corps):
General Effect: ${dayScores.slice(0, 5).map(s => `${s.corps}: ${s.subtotals.ge.toFixed(2)}`).join(' | ')}
Visual Total: ${dayScores.slice(0, 5).map(s => `${s.corps}: ${s.subtotals.visual.toFixed(2)}`).join(' | ')}
Music Total: ${dayScores.slice(0, 5).map(s => `${s.corps}: ${s.subtotals.music.toFixed(2)}`).join(' | ')}

CAPTION TREND ANALYSIS (Corps with notable caption movement):
${(() => {
  const captionMovers = dayScores.slice(0, 8).map(s => {
    const trend = trendData[s.corps];
    const captionTrends = trend?.captionTrends;
    const narrativeParts = [];

    if (captionTrends) {
      if (captionTrends.ge.trending === "up") narrativeParts.push("GE climbing");
      if (captionTrends.ge.trending === "down") narrativeParts.push("GE dipping");
      if (captionTrends.visual.trending === "up") narrativeParts.push("visual sharpening");
      if (captionTrends.visual.trending === "down") narrativeParts.push("visual slipping");
      if (captionTrends.music.trending === "up") narrativeParts.push("music heating up");
      if (captionTrends.music.trending === "down") narrativeParts.push("music cooling");
    }

    const trendNote = narrativeParts.length > 0 ? ` → ${narrativeParts.join(", ")}` : " → stable across all captions";
    return `• ${s.corps}: GE ${s.subtotals.ge.toFixed(2)} | Vis ${s.subtotals.visual.toFixed(2)} | Mus ${s.subtotals.music.toFixed(2)}${trendNote}`;
  });
  return captionMovers.join('\n');
})()}

${toneGuidance}

WRITE A TECHNICAL ANALYSIS ARTICLE that breaks down today's caption performances:

1. HEADLINE: Focus on the most interesting caption story. Examples: "Crown Brass Posts Season-High 19.2: Inside the Hornline's Breakthrough", "Blue Devils GE Dominance: How Design Excellence Creates Separation"

2. SUMMARY: 2-3 sentences highlighting which corps dominated which captions and what it means for the competition.

3. NARRATIVE: A detailed 600-800 word analysis (3-4 paragraphs) that:
   - Identifies which corps is winning the "caption battle" in each major area
   - Explains WHY certain corps excel in specific captions (brass technique, guard excellence, visual clarity)
   - Discusses any caption trends (corps improving in brass, guard scores rising across the board)
   - Provides insight into how caption strengths/weaknesses affect total scores

4. CAPTION BREAKDOWN: Provide analysis for each major category with the leader and what makes them stand out.

Technical but accessible. Like a color commentator who knows the activity inside and out. Use specific scores. Reference real DCI judging criteria.`;

  // Schema for structured output
  const schema = {
    type: SchemaType.OBJECT,
    properties: {
      headline: { type: SchemaType.STRING, description: "Caption-focused headline" },
      summary: { type: SchemaType.STRING, description: "2-3 sentence summary" },
      narrative: { type: SchemaType.STRING, description: "600-800 word analysis" },
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

    // Feature a corps excelling in a caption category - but NOT one already featured in another article
    // Find the first caption leader whose corps hasn't been featured yet
    let featuredCaption = null;
    let featuredCorps = null;

    for (const caption of captionLeaders) {
      if (!excludeCorps.has(caption.leader)) {
        featuredCaption = caption;
        featuredCorps = dayScores.find(s => s.corps === caption.leader);
        break;
      }
    }

    // Fallback: if all caption leaders are excluded, find the highest-ranked corps not yet featured
    if (!featuredCorps) {
      featuredCorps = dayScores.find(s => !excludeCorps.has(s.corps)) || dayScores[1] || dayScores[0];
      // Find which caption this corps leads in (if any)
      featuredCaption = captionLeaders.find(c => c.leader === featuredCorps?.corps) || captionLeaders[1] || captionLeaders[0];
    }

    // Look up the corps' show title for thematic context
    const showTitle = db ? await getShowTitleFromFirestore(db, featuredCorps.corps, featuredCorps.sourceYear) : null;

    // Use specialized caption image prompt with section-specific details
    const imagePrompt = buildCaptionsImagePrompt(
      featuredCorps.corps,
      featuredCorps.sourceYear,
      featuredCaption?.caption || "General Effect",
      showContext.location,
      showTitle
    );

    const imageData = await generateImageWithImagen(imagePrompt);
    const imageResult = await processGeneratedImage(imageData, "dci_captions");

    return {
      type: ARTICLE_TYPES.DCI_CAPTIONS,
      ...content,
      featuredCorps: featuredCorps.corps, // Track which corps was featured for diversity
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
async function generateFantasyPerformersArticle({ reportDay, fantasyData, showContext, competitionContext, db, dataDocId }) {
  if (!fantasyData?.current) {
    return createFallbackArticle(ARTICLE_TYPES.FANTASY_PERFORMERS, reportDay);
  }

  // Get dynamic tone guidance
  const toneGuidance = getToneGuidance(competitionContext, "fantasy_performers");

  const shows = fantasyData.current.shows || [];
  const allResults = shows.flatMap(s => s.results || []);

  // Filter out SoundSport corps - SoundSport is non-competitive and scores should not be published
  // per SoundSport rules (celebration of participation, not rankings)
  const competitiveResults = allResults.filter(r => r.corpsClass !== 'soundSport');
  const topPerformers = competitiveResults.sort((a, b) => b.totalScore - a.totalScore).slice(0, 10);

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
  `${i + 1}. "${r.corpsName}" from ${r.location || 'Unknown'} (Director: ${r.displayName || 'Unknown'}) - ${r.totalScore.toFixed(3)} fantasy points`
).join('\n')}

STATISTICS:
- Top Score: ${topScore} points
- Top 10 Average: ${avgScore} points
- Total ensembles competing: ${allResults.length}

WRITE A FANTASY SPORTS CELEBRATION ARTICLE:

1. HEADLINE: Exciting fantasy sports headline celebrating the top performers. Include the director's name and/or location when relevant. Examples: "The Crimson Guard Dominates Day ${reportDay} with ${topScore}-Point Explosion", "Director Smith's 'Blue Thunder' from Chicago Claims Fantasy Crown"

2. SUMMARY: 2-3 sentences about who dominated today's fantasy competition. Make it exciting!

3. NARRATIVE: A 600-800 word article (3-4 paragraphs) that:
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
      narrative: { type: SchemaType.STRING, description: "600-800 word celebration article" },
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
        const profileDoc = await db.doc(`artifacts/${dataDocId}/users/${topCorps.uid}/profile/data`).get();
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
      featuredPerformer: topCorps?.corpsName, // Track which performer was featured for diversity
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
async function generateFantasyLeaguesArticle({ reportDay, fantasyData, showContext, competitionContext, excludePerformers = new Set() }) {
  // Get dynamic tone guidance
  const toneGuidance = getToneGuidance(competitionContext, "fantasy_leagues");

  // Get show/league data - also format show names for fantasy branding
  const shows = fantasyData?.current?.shows || [];
  const showSummaries = shows.map(show => {
    const results = show.results || [];
    // Filter out SoundSport corps - SoundSport is non-competitive and scores should not be published
    const competitiveResults = results.filter(r => r.corpsClass !== 'soundSport');
    const sortedResults = competitiveResults.sort((a, b) => b.totalScore - a.totalScore);

    // For the featured performer in this show, try to pick someone NOT already featured
    // This ensures Fantasy Leagues highlights different performers than Fantasy Performers article
    let featuredPerformer = sortedResults[0];
    for (const performer of sortedResults.slice(0, 5)) {
      if (!excludePerformers.has(performer.corpsName)) {
        featuredPerformer = performer;
        break;
      }
    }

    return {
      name: formatFantasyEventName(show.showName || show.showId || 'Competition'),
      entrants: competitiveResults.length,
      topScorer: featuredPerformer?.corpsName || 'N/A',
      topScore: featuredPerformer?.totalScore?.toFixed(3) || '0.000',
      // Also include actual leader for reference if different
      actualLeader: sortedResults[0]?.corpsName !== featuredPerformer?.corpsName ? sortedResults[0]?.corpsName : null,
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

3. NARRATIVE: A 600-800 word article (3-4 paragraphs) that:
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
      narrative: { type: SchemaType.STRING, description: "600-800 word article" },
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
async function generateDeepAnalyticsArticle({ reportDay, dayScores, trendData, fantasyData, captionLeaders, showContext, competitionContext, db, excludeCorps = new Set() }) {
  // Get dynamic tone guidance
  const toneGuidance = getToneGuidance(competitionContext, "deep_analytics");

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

  // Build list of all shows happening today for comprehensive coverage
  const allShowsText = showContext.allShows?.length > 1
    ? showContext.allShows.map(s => `• ${s.name}${s.location ? ` (${s.location})` : ''}`).join('\n')
    : `• ${showContext.showName}${showContext.location ? ` (${showContext.location})` : ''}`;

  const prompt = `You are a senior data analyst and statistician for marching.art, writing advanced analytical content like FiveThirtyEight or The Athletic's deep dives.

CONTEXT: DCI scoring uses a 100-point scale. Top corps score 90-99+. Every 0.001 point represents real competitive separation. The season builds toward championships, so trajectory matters as much as current standings.

═══════════════════════════════════════════════════════════════
EVENT INFORMATION
═══════════════════════════════════════════════════════════════
• Date: ${showContext.date}
• Season Day: ${reportDay}
${showContext.allShows?.length > 1 ? `
ALL SHOWS TODAY (${showContext.allShows.length} competitions):
${allShowsText}

IMPORTANT: This analysis covers results from ALL ${showContext.allShows.length} shows happening today. Aggregate data represents combined performances across all competitions.
` : `• Show Name: ${showContext.showName}
• Location: ${showContext.location}`}
═══════════════════════════════════════════════════════════════

STATISTICAL ANALYSIS${showContext.allShows?.length > 1 ? ` across all ${showContext.allShows.length} shows` : ` from ${showContext.showName}`} on ${showContext.date}:

═══════════════════════════════════════════════════════════════
MOMENTUM CLASSIFICATIONS (Extended Analysis)
═══════════════════════════════════════════════════════════════
${(() => {
  const classifications = {
    surging: Object.entries(trendData).filter(([, t]) => t.momentum === "surging"),
    hot: Object.entries(trendData).filter(([, t]) => t.momentum === "hot"),
    rising: Object.entries(trendData).filter(([, t]) => t.momentum === "rising"),
    steady: Object.entries(trendData).filter(([, t]) => t.momentum === "steady" || t.momentum === "consistent"),
    cooling: Object.entries(trendData).filter(([, t]) => t.momentum === "cooling"),
    cold: Object.entries(trendData).filter(([, t]) => t.momentum === "cold"),
    sliding: Object.entries(trendData).filter(([, t]) => t.momentum === "sliding"),
  };

  const output = [];
  if (classifications.surging.length > 0) {
    output.push(`🔥 SURGING (3+ day winning streak): ${classifications.surging.map(([c, t]) => {
      const narrative = getTrendNarrative(t, c);
      return `${c} (${t.streak}-day streak, ${narrative?.momentum || ""})`;
    }).join(", ")}`);
  }
  if (classifications.hot.length > 0) {
    output.push(`🌡️ HOT (strong upward momentum): ${classifications.hot.map(([c]) => c).join(", ")}`);
  }
  if (classifications.rising.length > 0) {
    output.push(`📈 RISING (positive trajectory): ${classifications.rising.map(([c]) => c).join(", ")}`);
  }
  if (classifications.cooling.length > 0) {
    output.push(`📉 COOLING (slight regression): ${classifications.cooling.map(([c]) => c).join(", ")}`);
  }
  if (classifications.cold.length > 0) {
    output.push(`❄️ COLD (downward momentum): ${classifications.cold.map(([c]) => c).join(", ")}`);
  }
  if (classifications.sliding.length > 0) {
    output.push(`⬇️ SLIDING (3+ day losing streak): ${classifications.sliding.map(([c, t]) => {
      return `${c} (${t.streak}-day decline)`;
    }).join(", ")}`);
  }
  return output.length > 0 ? output.join('\n') : "All corps relatively steady today";
})()}

═══════════════════════════════════════════════════════════════
SINGLE-DAY MOVEMENT
═══════════════════════════════════════════════════════════════
BIGGEST GAINERS (>0.1 point gain):
${bigGainers.length > 0 ? bigGainers.map(([c, t]) => {
  const narrative = getTrendNarrative(t, c);
  return `• ${c}: +${t.dayChange.toFixed(3)} → ${narrative?.full || "improving"}`;
}).join('\n') : '• No corps gained >0.1 points today'}

BIGGEST DROPS (>0.1 point loss):
${bigLosers.length > 0 ? bigLosers.map(([c, t]) => {
  const narrative = getTrendNarrative(t, c);
  return `• ${c}: ${t.dayChange.toFixed(3)} → ${narrative?.full || "regressing"}`;
}).join('\n') : '• No corps dropped >0.1 points today'}

═══════════════════════════════════════════════════════════════
VOLATILITY & CONSISTENCY ANALYSIS
═══════════════════════════════════════════════════════════════
${(() => {
  const byVolatility = Object.entries(trendData).sort((a, b) => b[1].volatility - a[1].volatility);
  const highVol = byVolatility.slice(0, 3).filter(([, t]) => t.volatility > 0.15);
  const lowVol = byVolatility.slice(-3).filter(([, t]) => t.volatility < 0.15);

  const output = [];
  if (highVol.length > 0) {
    output.push(`HIGH VOLATILITY (unpredictable):\n${highVol.map(([c, t]) => `• ${c}: σ=${t.volatility.toFixed(3)} - inconsistent but capable of big swings`).join('\n')}`);
  }
  if (lowVol.length > 0) {
    output.push(`LOW VOLATILITY (predictable):\n${lowVol.map(([c, t]) => `• ${c}: σ=${t.volatility.toFixed(3)} - consistent, reliable performances`).join('\n')}`);
  }
  return output.join('\n\n') || "Volatility data not available";
})()}

═══════════════════════════════════════════════════════════════
SEASON PERFORMANCE MARKERS
═══════════════════════════════════════════════════════════════
${(() => {
  const atBest = Object.entries(trendData).filter(([, t]) => t.atSeasonBest);
  const atWorst = Object.entries(trendData).filter(([, t]) => t.atSeasonWorst);

  const output = [];
  if (atBest.length > 0) {
    output.push(`AT SEASON HIGH: ${atBest.map(([c, t]) => `${c} (${t.latestTotal?.toFixed(3)})`).join(", ")}`);
  }
  if (atWorst.length > 0) {
    output.push(`AT SEASON LOW: ${atWorst.map(([c, t]) => `${c} (${t.latestTotal?.toFixed(3)})`).join(", ")}`);
  }
  return output.length > 0 ? output.join('\n') : "No corps at season extremes today";
})()}

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

${toneGuidance}

WRITE A DATA-DRIVEN ANALYTICAL ARTICLE:

1. HEADLINE: Statistical insight headline. Examples: "Momentum Math: Crown's 7-Day Trend Points to Finals Surge", "By The Numbers: Score Compression Signals Tighter Championships", "Analytics Deep Dive: Which Corps Are Peaking at the Right Time?"

2. SUMMARY: 2-3 sentences with the most important statistical finding of the day. Lead with data.

3. NARRATIVE: An 800-1200 word deep analysis (4-5 paragraphs) that:
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
      narrative: { type: SchemaType.STRING, description: "800-1200 word deep analysis" },
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

    // Feature a trending corps in an analytical aerial shot - but NOT one already featured
    // Sort by trend and find the first corps not in excludeCorps
    const sortedByTrend = Object.entries(trendData).sort((a,b) => b[1].trendFromAvg - a[1].trendFromAvg);
    let topTrending = sortedByTrend.find(([corps]) => !excludeCorps.has(corps));

    // Fallback to the best trending corps if all are excluded
    if (!topTrending) {
      topTrending = sortedByTrend[0];
    }

    const featuredCorps = dayScores.find(s => s.corps === topTrending?.[0]) || dayScores[0];

    // Look up the corps' show title for thematic context
    const showTitle = db ? await getShowTitleFromFirestore(db, featuredCorps.corps, featuredCorps.sourceYear) : null;

    // Use specialized analytics prompt showing drill formations from elevated angle
    const imagePrompt = buildAnalyticsImagePrompt(
      featuredCorps.corps,
      featuredCorps.sourceYear,
      "trajectory analysis",
      showTitle
    );

    const imageData = await generateImageWithImagen(imagePrompt);
    const imageResult = await processGeneratedImage(imageData, "deep_analytics");

    return {
      type: ARTICLE_TYPES.DEEP_ANALYTICS,
      ...content,
      featuredCorps: featuredCorps.corps, // Track which corps was featured for diversity
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
 * Article 6: Underdog Story
 * Features a corps that's significantly outperforming expectations
 */
async function generateUnderdogStoryArticle({ reportDay, dayScores, trendData, activeCorps, showContext, competitionContext, db, excludeCorps = new Set() }) {
  // Get dynamic tone guidance
  const toneGuidance = getToneGuidance(competitionContext, "underdog_story");

  // Find the biggest overperformer relative to their ranking
  // Look for corps in positions 6-15 that are trending strongly upward
  // Also exclude corps that have already been featured in other articles
  const underdogCandidates = dayScores
    .slice(5, 15) // Focus on mid-pack corps (positions 6-15)
    .filter(s => !excludeCorps.has(s.corps)) // Exclude already-featured corps
    .map(s => ({
      ...s,
      trend: trendData[s.corps] || { dayChange: 0, trendFromAvg: 0 },
    }))
    .filter(s => s.trend.dayChange > 0 || s.trend.trendFromAvg > 0) // Must be trending up
    .sort((a, b) => {
      // Score by combination of daily gain and trend from average
      const aScore = a.trend.dayChange * 2 + a.trend.trendFromAvg;
      const bScore = b.trend.dayChange * 2 + b.trend.trendFromAvg;
      return bScore - aScore;
    });

  if (underdogCandidates.length === 0) {
    // Fallback to the corps with biggest single-day gain that's not already featured
    const biggestGainer = Object.entries(trendData)
      .filter(([corps]) => !excludeCorps.has(corps))
      .sort((a, b) => b[1].dayChange - a[1].dayChange)[0];
    if (biggestGainer) {
      const gainerCorps = dayScores.find(s => s.corps === biggestGainer[0]);
      if (gainerCorps) {
        underdogCandidates.push({
          ...gainerCorps,
          trend: biggestGainer[1],
        });
      }
    }
  }

  // Find the first unfeatured underdog, or fallback to 6th place
  const featuredUnderdog = underdogCandidates[0] ||
    dayScores.find(s => !excludeCorps.has(s.corps)) ||
    dayScores[5]; // Fallback to 6th place
  const currentRank = dayScores.findIndex(s => s.corps === featuredUnderdog.corps) + 1;

  const prompt = `You are an inspirational sports writer for marching.art, crafting a compelling underdog narrative like ESPN's "30 for 30" or Sports Illustrated's feature stories.

CONTEXT: Every DCI season has breakthrough corps - ensembles that exceed expectations and capture the imagination of fans. Today you're profiling one such corps whose performance is turning heads.

═══════════════════════════════════════════════════════════════
EVENT INFORMATION
═══════════════════════════════════════════════════════════════
• Show Name: ${showContext.showName}
• Location: ${showContext.location}
• Date: ${showContext.date}
• Season Day: ${reportDay}
═══════════════════════════════════════════════════════════════

FEATURED CORPS: ${featuredUnderdog.corps}
═══════════════════════════════════════════════════════════════
• Historical Season: ${featuredUnderdog.sourceYear}
• Current Standing: ${currentRank}${currentRank === 1 ? 'st' : currentRank === 2 ? 'nd' : currentRank === 3 ? 'rd' : 'th'} place
• Today's Score: ${featuredUnderdog.total.toFixed(3)}
• Daily Change: ${featuredUnderdog.trend?.dayChange >= 0 ? '+' : ''}${(featuredUnderdog.trend?.dayChange || 0).toFixed(3)}
• 7-Day Trend: ${featuredUnderdog.trend?.trendFromAvg >= 0 ? '+' : ''}${(featuredUnderdog.trend?.trendFromAvg || 0).toFixed(3)} vs average

MOMENTUM NARRATIVE:
${(() => {
  const narrative = getTrendNarrative(featuredUnderdog.trend, featuredUnderdog.corps + reportDay);
  const parts = [];
  if (narrative?.momentum) parts.push(`This corps is ${narrative.momentum}`);
  if (narrative?.streak) parts.push(`with ${narrative.streak}`);
  if (narrative?.caption) parts.push(`and ${narrative.caption}`);
  if (narrative?.performance) parts.push(`— ${narrative.performance}`);
  if (featuredUnderdog.trend?.streak >= 3) {
    parts.push(`(${featuredUnderdog.trend.streak}-day winning streak)`);
  }
  return parts.length > 0 ? parts.join(" ") : "Building momentum steadily";
})()}

CAPTION BREAKDOWN:
• General Effect: ${featuredUnderdog.subtotals?.ge?.toFixed(2) || 'N/A'}${featuredUnderdog.trend?.captionTrends?.ge?.trending === "up" ? " 📈" : featuredUnderdog.trend?.captionTrends?.ge?.trending === "down" ? " 📉" : ""}
• Visual: ${featuredUnderdog.subtotals?.visual?.toFixed(2) || 'N/A'}${featuredUnderdog.trend?.captionTrends?.visual?.trending === "up" ? " 📈" : featuredUnderdog.trend?.captionTrends?.visual?.trending === "down" ? " 📉" : ""}
• Music: ${featuredUnderdog.subtotals?.music?.toFixed(2) || 'N/A'}${featuredUnderdog.trend?.captionTrends?.music?.trending === "up" ? " 📈" : featuredUnderdog.trend?.captionTrends?.music?.trending === "down" ? " 📉" : ""}
${featuredUnderdog.trend?.atSeasonBest ? "★ AT SEASON HIGH - Peaking at the perfect time!" : ""}

COMPETITIVE CONTEXT:
${dayScores.slice(Math.max(0, currentRank - 3), currentRank + 2).map((s, i) => {
  const rank = Math.max(0, currentRank - 3) + i + 1;
  const corpsTrend = trendData[s.corps];
  const momentum = corpsTrend?.momentum || "steady";
  return `${rank}. ${s.corps}: ${s.total.toFixed(3)}${s.corps === featuredUnderdog.corps ? ' ← FEATURED' : ''} [${momentum}]`;
}).join('\n')}

${toneGuidance}

WRITE AN INSPIRATIONAL FEATURE ARTICLE about this corps' rise:

1. HEADLINE: Compelling underdog narrative headline. Examples: "Rising Thunder: How [Corps] Silenced the Doubters", "[Corps] Announces Arrival with Season-Defining Performance", "The Dark Horse Emerges: [Corps]' Stunning Surge"

2. SUMMARY: 2-3 sentences capturing why this corps' performance matters and what makes their story compelling.

3. NARRATIVE: A 600-800 word inspirational feature that:
   - Opens with a dramatic moment from their performance today
   - Explores what's driving their improvement (musical excellence, visual precision, design choices)
   - Puts their achievement in historical context
   - Includes quotes-style observations about their performance
   - Builds to an emotional conclusion about what this means for the corps and their fans
   - Ends with a forward-looking statement about their potential

Inspirational, emotionally resonant, but grounded in real performance data. Think underdog sports movie meets analytical journalism.`;

  const schema = {
    type: SchemaType.OBJECT,
    properties: {
      headline: { type: SchemaType.STRING, description: "Compelling underdog narrative headline" },
      summary: { type: SchemaType.STRING, description: "2-3 sentence summary of the underdog story" },
      narrative: { type: SchemaType.STRING, description: "600-800 word inspirational feature" },
      keyStats: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            stat: { type: SchemaType.STRING },
            value: { type: SchemaType.STRING },
            significance: { type: SchemaType.STRING },
          },
          required: ["stat", "value", "significance"],
        },
      },
    },
    required: ["headline", "summary", "narrative", "keyStats"],
  };

  try {
    const content = await generateStructuredContent(prompt, schema);

    // Look up show title for image
    const showTitle = db ? await getShowTitleFromFirestore(db, featuredUnderdog.corps, featuredUnderdog.sourceYear) : null;

    const imagePrompt = buildUnderdogImagePrompt(
      featuredUnderdog.corps,
      featuredUnderdog.sourceYear,
      showContext.location,
      showTitle
    );

    const imageData = await generateImageWithImagen(imagePrompt);
    const imageResult = await processGeneratedImage(imageData, "underdog_story");

    return {
      type: ARTICLE_TYPES.UNDERDOG_STORY,
      ...content,
      featuredCorps: featuredUnderdog.corps,
      featuredYear: featuredUnderdog.sourceYear,
      imageUrl: imageResult.url,
      imagePrompt,
      reportDay,
    };
  } catch (error) {
    logger.error("Underdog Story article failed:", error);
    return createFallbackArticle(ARTICLE_TYPES.UNDERDOG_STORY, reportDay);
  }
}

/**
 * Article 7: Corps Spotlight
 * Deep dive into a specific corps' identity and season journey
 */
async function generateCorpsSpotlightArticle({ reportDay, dayScores, trendData, activeCorps, showContext, competitionContext, db, excludeCorps = new Set() }) {
  // Get dynamic tone guidance
  const toneGuidance = getToneGuidance(competitionContext, "corps_spotlight");

  // Select a corps to spotlight - rotate through the field
  // Use reportDay to ensure different corps each day, but avoid already-featured corps
  let spotlightIndex = (reportDay - 1) % dayScores.length;
  let spotlightCorps = dayScores[spotlightIndex];

  // If the rotated corps has already been featured, find the next available corps
  if (excludeCorps.has(spotlightCorps?.corps)) {
    // Try subsequent positions until we find one not excluded
    for (let i = 1; i < dayScores.length; i++) {
      const nextIndex = (spotlightIndex + i) % dayScores.length;
      if (!excludeCorps.has(dayScores[nextIndex]?.corps)) {
        spotlightIndex = nextIndex;
        spotlightCorps = dayScores[nextIndex];
        break;
      }
    }
  }

  const currentRank = spotlightIndex + 1;
  const corpsTrend = trendData[spotlightCorps.corps] || { dayChange: 0, trendFromAvg: 0, avgTotal: spotlightCorps.total };

  // Get show title for this corps
  const showTitle = db ? await getShowTitleFromFirestore(db, spotlightCorps.corps, spotlightCorps.sourceYear) : null;

  const prompt = `You are a veteran DCI journalist writing an in-depth corps profile for marching.art, similar to profiles in Drum Corps World or the DCI website's feature content.

CONTEXT: Each DCI corps has a unique identity, history, and culture. Fans connect deeply with "their" corps. This spotlight profile celebrates what makes this corps special while analyzing their current season performance.

═══════════════════════════════════════════════════════════════
EVENT INFORMATION
═══════════════════════════════════════════════════════════════
• Show Name: ${showContext.showName}
• Location: ${showContext.location}
• Date: ${showContext.date}
• Season Day: ${reportDay}
═══════════════════════════════════════════════════════════════

FEATURED CORPS: ${spotlightCorps.corps}
═══════════════════════════════════════════════════════════════
• Historical Season: ${spotlightCorps.sourceYear}
${showTitle ? `• Show Title: "${showTitle}"` : ''}
• Current Standing: ${currentRank}${currentRank === 1 ? 'st' : currentRank === 2 ? 'nd' : currentRank === 3 ? 'rd' : 'th'} place
• Today's Score: ${spotlightCorps.total.toFixed(3)}
• Daily Movement: ${corpsTrend.dayChange >= 0 ? '+' : ''}${corpsTrend.dayChange.toFixed(3)}
• 7-Day Average: ${corpsTrend.avgTotal.toFixed(3)}
• Trend vs Average: ${corpsTrend.trendFromAvg >= 0 ? '+' : ''}${corpsTrend.trendFromAvg.toFixed(3)}

CURRENT MOMENTUM:
${(() => {
  const narrative = getTrendNarrative(corpsTrend, spotlightCorps.corps + reportDay);
  const lines = [];
  lines.push(`• Status: ${narrative?.momentum || "maintaining steady form"}`);
  if (corpsTrend.streak >= 2) {
    lines.push(`• Streak: ${corpsTrend.streak} consecutive days ${corpsTrend.streakDirection === "up" ? "improving" : "declining"}`);
  }
  if (narrative?.caption) {
    lines.push(`• Caption Trend: ${narrative.caption}`);
  }
  if (corpsTrend.atSeasonBest) {
    lines.push(`★ AT SEASON HIGH - This is their best performance yet!`);
  } else if (corpsTrend.atSeasonWorst) {
    lines.push(`⚠️ AT SEASON LOW - A challenging night`);
  }
  if (corpsTrend.volatility !== undefined) {
    if (corpsTrend.volatility > 0.2) {
      lines.push(`• Volatility: High (unpredictable, capable of big swings)`);
    } else if (corpsTrend.volatility < 0.08) {
      lines.push(`• Volatility: Low (remarkably consistent performer)`);
    }
  }
  return lines.join('\n');
})()}

DETAILED CAPTION SCORES:
• General Effect: ${spotlightCorps.subtotals?.ge?.toFixed(2) || 'N/A'}
  - GE1 (Music): ${spotlightCorps.captions?.GE1?.toFixed(2) || 'N/A'}
  - GE2 (Visual): ${spotlightCorps.captions?.GE2?.toFixed(2) || 'N/A'}
• Visual Total: ${spotlightCorps.subtotals?.visual?.toFixed(2) || 'N/A'}
  - VP: ${spotlightCorps.captions?.VP?.toFixed(2) || 'N/A'}
  - VA: ${spotlightCorps.captions?.VA?.toFixed(2) || 'N/A'}
  - CG: ${spotlightCorps.captions?.CG?.toFixed(2) || 'N/A'}
• Music Total: ${spotlightCorps.subtotals?.music?.toFixed(2) || 'N/A'}
  - Brass: ${spotlightCorps.captions?.B?.toFixed(2) || 'N/A'}
  - MA: ${spotlightCorps.captions?.MA?.toFixed(2) || 'N/A'}
  - Percussion: ${spotlightCorps.captions?.P?.toFixed(2) || 'N/A'}

SURROUNDING COMPETITION:
${dayScores.slice(Math.max(0, currentRank - 2), Math.min(dayScores.length, currentRank + 3)).map((s, i) => {
  const rank = Math.max(0, currentRank - 2) + i + 1;
  const gap = s.total - spotlightCorps.total;
  const rivalTrend = trendData[s.corps];
  const rivalMomentum = rivalTrend?.momentum || "steady";
  return `${rank}. ${s.corps}: ${s.total.toFixed(3)}${s.corps === spotlightCorps.corps ? ' ← SPOTLIGHT' : ` (${gap >= 0 ? '+' : ''}${gap.toFixed(3)})`} [${rivalMomentum}]`;
}).join('\n')}

${(() => {
  // Find the most interesting nearby rivalry based on momentum
  const nearbyCorps = dayScores.slice(Math.max(0, currentRank - 2), Math.min(dayScores.length, currentRank + 3))
    .filter(s => s.corps !== spotlightCorps.corps);

  for (const rival of nearbyCorps) {
    const rivalTrend = trendData[rival.corps];
    if (rivalTrend && corpsTrend) {
      const comparison = getComparativeTrendNarrative(spotlightCorps.corps, corpsTrend, rival.corps, rivalTrend);
      if (comparison) return `RIVALRY WATCH: ${comparison}`;
    }
  }
  return "";
})()}

${toneGuidance}

WRITE A COMPREHENSIVE CORPS PROFILE:

1. HEADLINE: A headline that captures the corps' identity and current story. Examples: "Blue Devils: The Dynasty Continues", "Carolina Crown: Brass Excellence Meets Design Innovation", "[Corps]: [Defining Characteristic]"

2. SUMMARY: 2-3 sentences introducing this corps and what makes their ${spotlightCorps.sourceYear} season notable.

3. NARRATIVE: A 700-900 word profile that:
   - Opens with what makes this corps distinctive in the DCI landscape
   - ${showTitle ? `Explores their ${spotlightCorps.sourceYear} production "${showTitle}" and its design concept` : 'Discusses their performance style and identity'}
   - Analyzes their competitive position and what's working well
   - Identifies their strongest captions and areas of excellence
   - Includes historical context about the corps' traditions
   - Concludes with their outlook for the rest of the season

Respectful, knowledgeable, like talking to a passionate fan who knows the corps' history. Celebratory but analytical.`;

  const schema = {
    type: SchemaType.OBJECT,
    properties: {
      headline: { type: SchemaType.STRING, description: "Corps identity headline" },
      summary: { type: SchemaType.STRING, description: "2-3 sentence corps introduction" },
      narrative: { type: SchemaType.STRING, description: "700-900 word corps profile" },
      corpsIdentity: {
        type: SchemaType.OBJECT,
        properties: {
          knownFor: { type: SchemaType.STRING, description: "What this corps is known for" },
          strength: { type: SchemaType.STRING, description: "Primary competitive strength" },
          fanbase: { type: SchemaType.STRING, description: "Description of fanbase/culture" },
        },
        required: ["knownFor", "strength", "fanbase"],
      },
      captionHighlights: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            caption: { type: SchemaType.STRING },
            assessment: { type: SchemaType.STRING },
          },
          required: ["caption", "assessment"],
        },
      },
    },
    required: ["headline", "summary", "narrative", "corpsIdentity", "captionHighlights"],
  };

  try {
    const content = await generateStructuredContent(prompt, schema);

    const imagePrompt = buildCorpsSpotlightImagePrompt(
      spotlightCorps.corps,
      spotlightCorps.sourceYear,
      showTitle
    );

    const imageData = await generateImageWithImagen(imagePrompt);
    const imageResult = await processGeneratedImage(imageData, "corps_spotlight");

    return {
      type: ARTICLE_TYPES.CORPS_SPOTLIGHT,
      ...content,
      featuredCorps: spotlightCorps.corps,
      featuredYear: spotlightCorps.sourceYear,
      showTitle,
      imageUrl: imageResult.url,
      imagePrompt,
      reportDay,
    };
  } catch (error) {
    logger.error("Corps Spotlight article failed:", error);
    return createFallbackArticle(ARTICLE_TYPES.CORPS_SPOTLIGHT, reportDay);
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
    // Collect ALL shows from this day for comprehensive coverage
    const allShows = [];
    const seenShowNames = new Set();

    // 1. Try to get event info from historical_scores first (most accurate)
    let showName = null;
    let location = null;
    let eventDate = null;

    for (const yearKey of Object.keys(historicalData)) {
      const yearEvents = historicalData[yearKey] || [];
      // Find ALL events for this day, not just the first one
      const dayEvents = yearEvents.filter(e => e.offSeasonDay === reportDay);
      for (const dayEvent of dayEvents) {
        const eventName = dayEvent.eventName;
        const eventLocation = dayEvent.location;
        if (eventName && !seenShowNames.has(eventName)) {
          seenShowNames.add(eventName);
          allShows.push({
            name: eventName,
            location: eventLocation,
            date: dayEvent.date || dayEvent.eventDate,
          });
        }
        // Use first found for primary show context
        if (!showName) {
          showName = eventName;
          location = eventLocation;
          eventDate = dayEvent.date || dayEvent.eventDate;
        }
      }
    }

    // 2. Try to get from season schedule if not found or to add more shows
    try {
      const scheduleDoc = await db.doc(`seasons/${seasonId}/schedule/day_${reportDay}`).get();
      if (scheduleDoc.exists) {
        const scheduleData = scheduleDoc.data();
        const shows = scheduleData.shows || [];
        for (const show of shows) {
          const scheduleName = show.eventName || show.name;
          if (scheduleName && !seenShowNames.has(scheduleName)) {
            seenShowNames.add(scheduleName);
            allShows.push({
              name: scheduleName,
              location: show.location,
              date: show.date,
            });
          }
        }
        // Use first show for primary context if not already set
        if (!showName && shows.length > 0) {
          showName = shows[0].eventName || shows[0].name;
          location = shows[0].location;
          eventDate = shows[0].date;
        }
      }
    } catch (scheduleError) {
      logger.warn("Could not fetch schedule:", scheduleError.message);
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
      // Include all shows so articles can reference multiple competitions
      allShows: allShows.length > 0 ? allShows : [{ name: showName || `Day ${reportDay} Competition`, location: location || "Competition Venue" }],
    };
  } catch (error) {
    logger.error("Error fetching show context:", error);
    return {
      showName: `Day ${reportDay} Competition`,
      location: "Competition Venue",
      date: `Day ${reportDay}`,
      rawDate: null,
      reportDay,
      allShows: [{ name: `Day ${reportDay} Competition`, location: "Competition Venue" }],
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

    // Collect scores with caption breakdown
    const scores = [];
    for (let day = reportDay - 6; day <= reportDay; day++) {
      const dayEvent = yearEvents.find(e => e.offSeasonDay === day);
      if (dayEvent) {
        const corpsScore = dayEvent.scores.find(s => s.corps === corpsName);
        if (corpsScore) {
          const total = calculateTotal(corpsScore.captions);
          const subtotals = calculateCaptionSubtotals(corpsScore.captions);
          if (total > 0) scores.push({ day, total, captions: corpsScore.captions, subtotals });
        }
      }
    }

    if (scores.length >= 2) {
      const sortedScores = [...scores].sort((a, b) => a.day - b.day);
      const avgTotal = scores.reduce((sum, s) => sum + s.total, 0) / scores.length;
      const latestScore = sortedScores.find(s => s.day === reportDay);
      const previousScore = sortedScores.find(s => s.day === reportDay - 1);
      const dayChange = latestScore && previousScore ? latestScore.total - previousScore.total : 0;
      const trendFromAvg = latestScore ? latestScore.total - avgTotal : 0;

      // Calculate streak (consecutive days of improvement/decline)
      let streak = 0;
      let streakDirection = null; // "up", "down", or null
      for (let i = sortedScores.length - 1; i > 0; i--) {
        const diff = sortedScores[i].total - sortedScores[i - 1].total;
        if (i === sortedScores.length - 1) {
          streakDirection = diff > 0.01 ? "up" : diff < -0.01 ? "down" : null;
          if (streakDirection) streak = 1;
        } else if (streakDirection === "up" && diff > 0.01) {
          streak++;
        } else if (streakDirection === "down" && diff < -0.01) {
          streak++;
        } else {
          break;
        }
      }

      // Determine momentum classification
      let momentum = "steady";
      if (streak >= 3 && streakDirection === "up") {
        momentum = "surging";
      } else if (streak >= 2 && streakDirection === "up" && trendFromAvg > 0.1) {
        momentum = "hot";
      } else if (dayChange > 0.15 || trendFromAvg > 0.15) {
        momentum = "rising";
      } else if (streak >= 3 && streakDirection === "down") {
        momentum = "sliding";
      } else if (streak >= 2 && streakDirection === "down" && trendFromAvg < -0.1) {
        momentum = "cold";
      } else if (dayChange < -0.15 || trendFromAvg < -0.15) {
        momentum = "cooling";
      } else if (Math.abs(trendFromAvg) < 0.05) {
        momentum = "consistent";
      }

      // Find best and worst in window
      const bestInWindow = Math.max(...scores.map(s => s.total));
      const worstInWindow = Math.min(...scores.map(s => s.total));
      const atSeasonBest = latestScore && Math.abs(latestScore.total - bestInWindow) < 0.01;
      const atSeasonWorst = latestScore && Math.abs(latestScore.total - worstInWindow) < 0.01;

      // Caption-specific trends (compare today to 7-day caption averages)
      let captionTrends = null;
      if (latestScore && scores.length >= 3) {
        const avgGE = scores.reduce((s, d) => s + d.subtotals.ge, 0) / scores.length;
        const avgVisual = scores.reduce((s, d) => s + d.subtotals.visual, 0) / scores.length;
        const avgMusic = scores.reduce((s, d) => s + d.subtotals.music, 0) / scores.length;

        captionTrends = {
          ge: {
            current: latestScore.subtotals.ge,
            avg: avgGE,
            diff: latestScore.subtotals.ge - avgGE,
            trending: latestScore.subtotals.ge - avgGE > 0.05 ? "up" : latestScore.subtotals.ge - avgGE < -0.05 ? "down" : "stable",
          },
          visual: {
            current: latestScore.subtotals.visual,
            avg: avgVisual,
            diff: latestScore.subtotals.visual - avgVisual,
            trending: latestScore.subtotals.visual - avgVisual > 0.03 ? "up" : latestScore.subtotals.visual - avgVisual < -0.03 ? "down" : "stable",
          },
          music: {
            current: latestScore.subtotals.music,
            avg: avgMusic,
            diff: latestScore.subtotals.music - avgMusic,
            trending: latestScore.subtotals.music - avgMusic > 0.03 ? "up" : latestScore.subtotals.music - avgMusic < -0.03 ? "down" : "stable",
          },
        };
      }

      // Calculate volatility (standard deviation)
      const volatility = Math.sqrt(
        scores.reduce((sum, s) => sum + Math.pow(s.total - avgTotal, 2), 0) / scores.length
      );

      trends[corpsName] = {
        sourceYear,
        avgTotal,
        latestTotal: latestScore?.total || null,
        dayChange,
        trendFromAvg,
        // Enhanced trend data
        streak,
        streakDirection,
        momentum,
        bestInWindow,
        worstInWindow,
        atSeasonBest,
        atSeasonWorst,
        captionTrends,
        volatility,
        dataPoints: scores.length,
      };
    }
  }

  return trends;
}

/**
 * Generate narrative phrases for trend descriptions
 * Provides variety in how trends are described across articles
 */
const TREND_NARRATIVES = {
  surging: [
    "on an absolute tear",
    "riding a scorching hot streak",
    "surging with unstoppable momentum",
    "catching fire at exactly the right moment",
    "in the midst of a remarkable run",
  ],
  hot: [
    "building serious momentum",
    "heating up nicely",
    "showing impressive upward trajectory",
    "on the rise and showing no signs of slowing",
    "trending in exactly the right direction",
  ],
  rising: [
    "continuing to climb",
    "making steady gains",
    "showing improvement",
    "moving in the right direction",
    "picking up steam",
  ],
  sliding: [
    "struggling to find their footing",
    "in an extended rough patch",
    "dealing with a concerning downward trend",
    "fighting against unfavorable momentum",
    "trying to stop the bleeding",
  ],
  cold: [
    "going through a cold spell",
    "searching for answers",
    "hitting some turbulence",
    "in a frustrating slump",
    "battling inconsistency",
  ],
  cooling: [
    "cooling off slightly",
    "seeing some regression",
    "coming back to earth",
    "experiencing a minor setback",
    "taking a small step back",
  ],
  steady: [
    "maintaining their form",
    "holding steady",
    "staying the course",
    "keeping things consistent",
    "delivering reliable performances",
  ],
  consistent: [
    "rock solid in their consistency",
    "remarkably stable",
    "the picture of dependability",
    "executing with precision night after night",
    "a model of consistency",
  ],
};

const STREAK_NARRATIVES = {
  up: {
    3: ["three straight days of improvement", "a three-day winning streak", "improvement for the third consecutive day"],
    4: ["four days of continuous gains", "an impressive four-day climb", "gains every day this week"],
    5: ["five straight days trending upward", "a remarkable five-day surge", "an entire week of improvement"],
  },
  down: {
    3: ["three consecutive days of decline", "a three-day skid", "dropping for the third day running"],
    4: ["four straight days of regression", "a concerning four-day slide", "losses every day this week"],
    5: ["five days of continuous decline", "a five-day freefall", "struggling all week"],
  },
};

const CAPTION_TREND_NARRATIVES = {
  ge: {
    up: ["GE scores climbing", "connecting better with judges on effect", "drawing stronger emotional response"],
    down: ["GE scores dipping", "struggling to land the effect", "effect captions not quite hitting"],
    stable: ["effect scores holding steady", "consistent GE output"],
  },
  visual: {
    up: ["visual program clicking into place", "drill execution sharpening", "guard and visual coming together"],
    down: ["visual clarity suffering", "some execution issues on the field", "visual program not quite clean"],
    stable: ["visual program consistent", "reliable execution on the field"],
  },
  music: {
    up: ["brass and percussion heating up", "musical program elevating", "hornline finding their voice"],
    down: ["musical scores slipping", "brass not quite as sharp", "some intonation and balance issues"],
    stable: ["musical program solid", "consistent brass and percussion output"],
  },
};

/**
 * Get a narrative description for a corps' trend
 * @param {Object} trend - Trend data for a corps
 * @param {string} seed - Optional seed for consistent randomization
 * @returns {Object} Narrative components
 */
function getTrendNarrative(trend, seed = null) {
  if (!trend) return null;

  const selectPhrase = (arr) => {
    if (!arr || arr.length === 0) return "";
    if (seed) {
      const hash = seed.split('').reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0);
      return arr[Math.abs(hash) % arr.length];
    }
    return arr[Math.floor(Math.random() * arr.length)];
  };

  // Main momentum phrase
  const momentumPhrase = selectPhrase(TREND_NARRATIVES[trend.momentum] || TREND_NARRATIVES.steady);

  // Streak phrase (if applicable)
  let streakPhrase = null;
  if (trend.streak >= 3 && trend.streakDirection) {
    const streakLevel = Math.min(trend.streak, 5);
    const options = STREAK_NARRATIVES[trend.streakDirection]?.[streakLevel];
    if (options) streakPhrase = selectPhrase(options);
  }

  // Caption highlights (pick the most notable)
  let captionHighlight = null;
  if (trend.captionTrends) {
    const captionChanges = [
      { caption: "ge", ...trend.captionTrends.ge },
      { caption: "visual", ...trend.captionTrends.visual },
      { caption: "music", ...trend.captionTrends.music },
    ].filter(c => c.trending !== "stable")
     .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

    if (captionChanges.length > 0) {
      const top = captionChanges[0];
      const phrases = CAPTION_TREND_NARRATIVES[top.caption]?.[top.trending];
      if (phrases) captionHighlight = selectPhrase(phrases);
    }
  }

  // Season best/worst note
  let performanceNote = null;
  if (trend.atSeasonBest) {
    performanceNote = selectPhrase([
      "hitting their season high",
      "at their best score of the year",
      "peaking at the right time",
    ]);
  } else if (trend.atSeasonWorst) {
    performanceNote = selectPhrase([
      "at their lowest point this season",
      "hitting a season-low score",
      "at rock bottom—nowhere to go but up",
    ]);
  }

  // Volatility note
  let stabilityNote = null;
  if (trend.volatility > 0.3) {
    stabilityNote = selectPhrase([
      "highly unpredictable night to night",
      "volatile performances making them hard to read",
      "inconsistent but capable of big nights",
    ]);
  } else if (trend.volatility < 0.1) {
    stabilityNote = selectPhrase([
      "remarkably consistent show to show",
      "predictable in the best way",
      "you know exactly what you're going to get",
    ]);
  }

  return {
    momentum: momentumPhrase,
    streak: streakPhrase,
    caption: captionHighlight,
    performance: performanceNote,
    stability: stabilityNote,
    // Full narrative combining key elements
    full: buildFullNarrative(momentumPhrase, streakPhrase, captionHighlight, performanceNote),
  };
}

/**
 * Build a complete narrative sentence from components
 */
function buildFullNarrative(momentum, streak, caption, performance) {
  const parts = [];

  if (streak) {
    parts.push(streak);
  }

  if (momentum) {
    if (parts.length > 0) {
      parts.push(`and ${momentum}`);
    } else {
      parts.push(momentum);
    }
  }

  if (caption && parts.length < 2) {
    if (parts.length > 0) {
      parts.push(`with ${caption}`);
    } else {
      parts.push(caption);
    }
  }

  if (performance && parts.length < 2) {
    parts.push(performance);
  }

  return parts.join(", ");
}

/**
 * Get comparative narrative between two corps' trends
 * @param {Object} trend1 - First corps trend
 * @param {Object} trend2 - Second corps trend
 * @returns {string} Comparative narrative
 */
function getComparativeTrendNarrative(corps1Name, trend1, corps2Name, trend2) {
  if (!trend1 || !trend2) return null;

  const momentum1 = TREND_NARRATIVES[trend1.momentum]?.[0] || "steady";
  const momentum2 = TREND_NARRATIVES[trend2.momentum]?.[0] || "steady";

  // Corps moving in opposite directions
  if ((trend1.momentum === "surging" || trend1.momentum === "hot") &&
      (trend2.momentum === "sliding" || trend2.momentum === "cold")) {
    return `${corps1Name} and ${corps2Name} are moving in opposite directions—${corps1Name} ${momentum1} while ${corps2Name} is ${momentum2}`;
  }

  // Both surging (collision course)
  if ((trend1.momentum === "surging" || trend1.momentum === "hot") &&
      (trend2.momentum === "surging" || trend2.momentum === "hot")) {
    return `Both ${corps1Name} and ${corps2Name} are ${momentum1}—a collision course that should produce fireworks`;
  }

  // Both struggling
  if ((trend1.momentum === "sliding" || trend1.momentum === "cold") &&
      (trend2.momentum === "sliding" || trend2.momentum === "cold")) {
    return `Neither ${corps1Name} nor ${corps2Name} can find momentum right now, both ${momentum1}`;
  }

  // One steady, one moving
  if (trend1.momentum === "steady" || trend1.momentum === "consistent") {
    return `${corps1Name} remains ${momentum1} while ${corps2Name} is ${momentum2}`;
  }

  return `${corps1Name} is ${momentum1}; ${corps2Name} is ${momentum2}`;
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
${topPerformers.map((r, i) => `${i + 1}. "${r.corpsName}" from ${r.location || 'Unknown'} (Director: ${r.displayName || 'Unknown'}): ${r.totalScore.toFixed(3)} fantasy points`).join('\n')}

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
