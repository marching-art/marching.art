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
    2024: {
      uniform: "dark forest green fitted uniform with gold yellow accents, modern athletic design with traditional elements",
      helmet: "black Aussie-style hat, classic Madison Scouts headwear",
      brass: "silver brass instruments",
      percussion: "green uniforms with gold accents matching brass section",
      guard: "colorful mosaic-inspired costumes with purple, pink, and multi-colored elements",
      showName: "Mosaic",
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
    2025: {
      uniform: "bold neon yellow lime green with red and black horizontal stripes, surreal dreamlike design",
      helmet: "no traditional helmet, modern look with colorful aesthetic",
      brass: "silver brass instruments contrasting against bright neon uniforms",
      percussion: "black drums, neon yellow and red striped uniforms matching brass section",
      guard: "pink fitted costumes, dreamlike surreal aesthetic contrasting with corps colors",
      showName: "In Restless Dreams",
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
    2019: {
      uniform: "vibrant magenta pink fitted uniform with orange accents, neon underground aesthetic",
      helmet: "no traditional helmet, modern athletic look",
      brass: "silver brass instruments",
      percussion: "pink magenta drums matching corps uniform colors",
      guard: "neon pink and orange costumes with underground theme",
      showName: "Neon Underground",
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
      showName: "The Fall and Rise",
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
  // The 5 daily articles - aligned with DCI.org style
  DCI_DAILY: "dci_daily",             // Article 1: DCI scores analysis from the day (with score breakdown)
  DCI_FEATURE: "dci_feature",         // Article 2: DCI feature on a single corps and their season progress
  DCI_RECAP: "dci_recap",             // Article 3: DCI weekly recap with GE, Visual, Music trends + trade recommendations
  FANTASY_DAILY: "fantasy_daily",     // Article 4: marching.art results from the day (with score breakdown)
  FANTASY_RECAP: "fantasy_recap",     // Article 5: marching.art weekly caption analysis (GE, Visual, Music trends)
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
const USE_PAID_IMAGE_GEN = false;

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
      // Free tier: Gemini 3 Pro with native image generation
      const modelName = "gemini-3-pro-image-preview";

      // Build system instruction with drum corps context
      const systemInstruction = `${DRUM_CORPS_VISUAL_CONTEXT}

${IMAGE_NEGATIVE_PROMPT}

You are an expert drum corps photographer. Generate images that accurately depict DCI drum corps as described above.`;

      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseModalities: ["image", "text"],
          systemInstruction: systemInstruction,
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
        let uniform = { ...corpsEntry.defaultUniform };

        // If year specified, try to get show data from Firestore
        if (year && corpsEntry.id) {
          const showsDoc = await db.doc(`dci-reference/shows-${corpsEntry.id}`).get();
          if (showsDoc.exists) {
            const showData = showsDoc.data().shows?.[year];
            if (showData) {
              // Use year-specific uniform if available, otherwise keep default
              if (showData.uniform) {
                uniform = { ...showData.uniform };
              }
              // Add show title
              if (showData.title) {
                uniform.showName = showData.title;
              }
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
 * @param {string} category - Article category (dci, fantasy, analysis)
 * @param {string} headline - Article headline
 * @param {string} summary - Article summary
 * @param {object} options - Optional parameters
 * @param {string} options.corpsName - Name of featured corps
 * @param {object} options.uniformDetails - Corps uniform details from getUniformDetails
 * @param {string} options.showTitle - Show title for thematic context
 */
function buildArticleImagePrompt(category, headline, summary, options = {}) {
  const { corpsName, uniformDetails, showTitle } = options;

  // Build uniform section if we have corps-specific details
  let uniformSection = `UNIFORMS: Modern athletic cut uniforms with contemporary designs
- Bold colors, geometric patterns, metallic accents
- Fitted athletic styling, often asymmetric or avant-garde
- NO traditional military shakos or plumed helmets (most modern corps have minimal or no headwear)
- White marching gloves on all performers`;

  if (uniformDetails && corpsName) {
    uniformSection = `UNIFORM - ${corpsName.toUpperCase()} - MUST MATCH EXACTLY:
- BODY: ${uniformDetails.uniform}
- HEADWEAR: ${uniformDetails.helmet}
- BRASS INSTRUMENTS: ${uniformDetails.brass}
- DRUMS: ${uniformDetails.percussion}
- COLOR GUARD: ${uniformDetails.guard}
- White marching gloves on all performers

CRITICAL: These uniform details are EXACT. Do not substitute generic uniforms.`;
  }

  // Build show theme context if available
  const themeContext = showTitle ? buildShowThemeContext(showTitle) : "";

  const categoryPrompts = {
    dci: `DCI (Drum Corps International) action photography on a football field.

HEADLINE CONTEXT: "${headline}"
${corpsName ? `FEATURED CORPS: ${corpsName}` : ""}
${showTitle ? `SHOW: "${showTitle}"` : ""}

SHOT TYPE: Dynamic action photograph
- Group of 3-6 performers in athletic formation
- Football field with yard lines visible
- Stadium setting at dusk or night
- Wide to medium shot capturing movement and energy

SUBJECT (choose most appropriate for headline):
- Brass section with horns raised in unison, bells catching stadium lights
- Drumline in synchronized motion, sticks frozen mid-stroke
- Color guard with 6-foot silk flags in dramatic poses
- Mixed section showing the scale of the performance

${uniformSection}

CRITICAL: Each performer holds ONLY ONE type of equipment. Brass players do NOT have drums. Drummers do NOT hold brass.
${themeContext}

LIGHTING: Stadium lights creating dramatic rim lighting, evening atmosphere
MOOD: Athletic energy, precision, competitive intensity

TECHNICAL: Professional sports action photography, sharp subjects with motion blur suggesting movement`,

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
  { angle: "wide shot from sideline, 70-200mm lens, capturing 4-6 performers in formation", description: "dynamic group formation on the field" },
  { angle: "medium shot at field level, low angle shooting upward at brass section", description: "heroic view of horn line with stadium lights behind" },
  { angle: "diagonal view across yard lines, 3-5 performers in athletic stance", description: "dramatic perspective showing field and formation" },
  { angle: "behind the drumline, 24-70mm lens, capturing front ensemble beyond", description: "layered depth showing multiple sections" },
  { angle: "corner endzone view, wide shot of company front approaching", description: "full formation moving toward camera" },
  { angle: "press box angle, high wide shot showing field pattern and formations", description: "aerial perspective of drill formation" },
  { angle: "pit-level shot, ground perspective with performers towering above", description: "dramatic low angle emphasizing scale" },
  { angle: "50 yard line sideline, telephoto compression of brass arc", description: "compressed view showing uniform colors in arc" },
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
 * Generate 5 nightly articles aligned with DCI.org editorial style
 *
 * The 5 daily articles:
 * 1. DCI Scores Analysis - Competition results with DCI.org-style score breakdown
 * 2. DCI Corps Feature - In-depth feature on one corps' season progress
 * 3. DCI Weekly Recap - Deep dive on GE, Visual, and Music trends over the last week
 * 4. marching.art Results - Fantasy competition results from the day
 * 5. marching.art Caption Analysis - Fantasy caption trends in GE, Visual, Music
 */
async function generateAllArticles({ db, dataDocId, seasonId, currentDay }) {
  const reportDay = currentDay - 1;

  if (reportDay < 1) {
    return { success: false, error: "Invalid day" };
  }

  logger.info(`Generating 5 daily articles for Day ${reportDay} (DCI.org style)`);

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

    // Generate articles sequentially to track featured corps and ensure diversity
    const articles = [];

    // Article 1: DCI DAILY - Today's competition results with score breakdown
    const dciDailyArticle = await generateDciDailyArticle({
      reportDay, dayScores, trendData, activeCorps, showContext, competitionContext, db
    });
    articles.push(dciDailyArticle);
    if (dciDailyArticle.featuredCorps) {
      featuredCorps.add(dciDailyArticle.featuredCorps);
    }

    // Article 2: DCI FEATURE - Single corps season progress spotlight
    const dciFeatureArticle = await generateDciFeatureArticle({
      reportDay, dayScores, trendData, activeCorps, showContext, competitionContext, db,
      excludeCorps: featuredCorps
    });
    articles.push(dciFeatureArticle);
    if (dciFeatureArticle.featuredCorps) {
      featuredCorps.add(dciFeatureArticle.featuredCorps);
    }

    // Article 3: DCI RECAP - Deep dive on GE, Visual, Music trends + trade recommendations
    const dciRecapArticle = await generateDciRecapArticle({
      reportDay, dayScores, trendData, captionLeaders, activeCorps, showContext, competitionContext, db,
      excludeCorps: featuredCorps
    });
    articles.push(dciRecapArticle);
    if (dciRecapArticle.featuredCorps) {
      featuredCorps.add(dciRecapArticle.featuredCorps);
    }

    // Article 4: FANTASY DAILY - Fantasy competition results with score breakdown
    const fantasyDailyArticle = await generateFantasyDailyArticle({
      reportDay, fantasyData, showContext, competitionContext, db, dataDocId
    });
    articles.push(fantasyDailyArticle);

    // Article 5: FANTASY RECAP - Fantasy GE/Visual/Music caption trends
    const fantasyRecapArticle = await generateFantasyRecapArticle({
      reportDay, fantasyData, showContext, competitionContext, db
    });
    articles.push(fantasyRecapArticle);

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
 * Article 1: DCI Scores Analysis
 * Daily competition results in DCI.org editorial style
 */
async function generateDciDailyArticle({ reportDay, dayScores, trendData, activeCorps, showContext, competitionContext, db }) {
  const topCorps = dayScores[0];
  const secondCorps = dayScores[1];
  const thirdCorps = dayScores[2];
  const gap = topCorps && secondCorps ? (topCorps.total - secondCorps.total).toFixed(3) : "0.000";
  const top3Gap = topCorps && thirdCorps ? (topCorps.total - thirdCorps.total).toFixed(3) : "0.000";

  // Get dynamic tone guidance based on competition context
  const toneGuidance = getToneGuidance(competitionContext, "dci_scores");

  // Build list of all shows happening today for comprehensive coverage
  const allShowsText = showContext.allShows?.length > 1
    ? showContext.allShows.map(s => `• ${s.name}${s.location ? ` (${s.location})` : ''}`).join('\n')
    : `• ${showContext.showName}${showContext.location ? ` (${showContext.location})` : ''}`;

  const prompt = `You are a DCI.org staff writer covering tonight's competition. Write in the authentic DCI.org editorial voice - professional sports journalism with deep knowledge of the marching arts activity.

═══════════════════════════════════════════════════════════════
DCI.ORG WRITING STYLE GUIDE
═══════════════════════════════════════════════════════════════
DCI.org articles follow these conventions:

HEADLINES: Action-oriented, specific score references when dramatic
- "Bluecoats set new record as streak continues through San Antonio"
- "Less than a point separates top three as Finals race pulls into focus"
- "Carolina Crown captures brass caption with 19.45 finish"
- "Blue Devils top 98 mark for first time this season"

SCORE LANGUAGE: Precise, professional terminology
- "besting [Corps] by 0.087" / "edging past by three-tenths"
- "0.45 over Crown in Total Visual"
- "winning GE by 0.15" / "took first in the General Effect caption"
- "increased their score by 0.625 from yesterday"
- "a scant 0.2-point gap" / "razor-thin margin of 0.125"

CAPTION REFERENCES: Use official terminology
- General Effect (GE) - split into GE1 (Music Effect) and GE2 (Visual Effect)
- Visual: Visual Proficiency (VP), Visual Analysis (VA), Color Guard (CG)
- Music: Brass (B), Music Analysis (MA), Percussion (P)
- "swept every caption except Color Guard" / "took first in three of six captions"

NARRATIVE FRAMING:
- Lead with the winner and their margin
- Emphasize battles for position ("the race for fourth remains unsettled")
- Reference historical context ("their highest score since 2019")
- Championship implications ("with Finals just days away")

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

TONIGHT'S OFFICIAL RESULTS${showContext.allShows?.length > 1 ? ' across all shows' : ` from ${showContext.showName}`}:

FINAL STANDINGS:
${dayScores.slice(0, 12).map((s, i) => {
  const trend = trendData[s.corps];
  const change = trend?.dayChange || 0;
  const marginToNext = i > 0 ? (dayScores[i-1].total - s.total).toFixed(3) : "-";
  return `${i + 1}. ${s.corps} - ${s.total.toFixed(3)} (${change >= 0 ? '+' : ''}${change.toFixed(3)} from yesterday)${i > 0 ? ` [${marginToNext} behind ${dayScores[i-1].corps}]` : ' [LEADER]'}
   GE: ${s.subtotals?.ge?.toFixed(2) || 'N/A'} | Visual: ${s.subtotals?.visual?.toFixed(2) || 'N/A'} | Music: ${s.subtotals?.music?.toFixed(2) || 'N/A'}`;
}).join('\n')}

CAPTION WINNERS TONIGHT:
${(() => {
  const captionWinners = {};
  const captions = ['ge', 'visual', 'music'];
  captions.forEach(cap => {
    const sorted = [...dayScores].sort((a, b) => (b.subtotals?.[cap] || 0) - (a.subtotals?.[cap] || 0));
    if (sorted[0]) {
      const margin = sorted[1] ? (sorted[0].subtotals[cap] - sorted[1].subtotals[cap]).toFixed(2) : "N/A";
      captionWinners[cap] = { corps: sorted[0].corps, score: sorted[0].subtotals[cap]?.toFixed(2), margin, second: sorted[1]?.corps };
    }
  });
  return Object.entries(captionWinners).map(([cap, data]) =>
    `• ${cap.toUpperCase()}: ${data.corps} (${data.score}) - ${data.margin} over ${data.second || 'field'}`
  ).join('\n');
})()}

KEY STORYLINES:
- Lead margin: ${topCorps?.corps} leads by ${gap} over ${secondCorps?.corps}
- Top 3 spread: ${top3Gap} points separate first from third
- ${competitionContext.positionBattleCount > 0 ? `Position battles: ${competitionContext.positionBattleCount} corps within 0.2 of position ahead` : "Clear separation in standings tonight"}
${(() => {
  const surging = Object.entries(trendData).filter(([_, t]) => t.dayChange > 0.3);
  const struggling = Object.entries(trendData).filter(([_, t]) => t.dayChange < -0.3);
  const lines = [];
  if (surging.length > 0) lines.push(`- Big gains: ${surging.map(([c, t]) => `${c} (+${t.dayChange.toFixed(3)})`).join(', ')}`);
  if (struggling.length > 0) lines.push(`- Setbacks: ${struggling.map(([c, t]) => `${c} (${t.dayChange.toFixed(3)})`).join(', ')}`);
  return lines.join('\n');
})()}

${toneGuidance}

WRITE A DCI.ORG-STYLE RECAP ARTICLE:

1. HEADLINE: DCI.org style - action verb, specific score reference or dramatic narrative
   Examples: "${topCorps?.corps} tops ${topCorps?.total?.toFixed(2)} mark at ${showContext.showName}", "Less than ${gap} separates top two after ${showContext.showName}"

2. SUMMARY: 2-3 sentences in DCI.org voice - state the winner, the margin, and the night's biggest storyline.

3. NARRATIVE: 500-700 word article in authentic DCI.org editorial voice:
   - Open with the winner, their score, and margin of victory
   - Detail caption performance ("${topCorps?.corps} won GE by X over ${secondCorps?.corps}")
   - Discuss the battle for positions behind the leader
   - Reference score changes from previous competition
   - Close with championship implications or tomorrow's preview

Use precise score language. Reference specific captions. Write like a DCI.org staff journalist.`;

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
      scoreBreakdown: {
        type: SchemaType.OBJECT,
        description: "Caption score breakdown for top corps",
        properties: {
          geWinner: { type: SchemaType.STRING, description: "Corps that won GE caption" },
          geScore: { type: SchemaType.NUMBER, description: "Winning GE score" },
          visualWinner: { type: SchemaType.STRING, description: "Corps that won Visual caption" },
          visualScore: { type: SchemaType.NUMBER, description: "Winning Visual score" },
          musicWinner: { type: SchemaType.STRING, description: "Corps that won Music caption" },
          musicScore: { type: SchemaType.NUMBER, description: "Winning Music score" },
        },
        required: ["geWinner", "geScore", "visualWinner", "visualScore", "musicWinner", "musicScore"],
      },
    },
    required: ["headline", "summary", "narrative", "standings", "scoreBreakdown"],
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
async function generateDciFeatureArticle({ reportDay, dayScores, trendData, activeCorps, showContext, competitionContext, db, excludeCorps = new Set() }) {
  const toneGuidance = getToneGuidance(competitionContext, "dci_corps_feature");

  // Select a corps to feature - rotate through the field, excluding already-featured corps
  let featureIndex = (reportDay - 1) % dayScores.length;
  let featureCorps = dayScores[featureIndex];

  // If the rotated corps has already been featured, find the next available
  if (excludeCorps.has(featureCorps?.corps)) {
    for (let i = 1; i < dayScores.length; i++) {
      const nextIndex = (featureIndex + i) % dayScores.length;
      if (!excludeCorps.has(dayScores[nextIndex]?.corps)) {
        featureIndex = nextIndex;
        featureCorps = dayScores[nextIndex];
        break;
      }
    }
  }

  const currentRank = dayScores.findIndex(s => s.corps === featureCorps.corps) + 1;
  const corpsTrend = trendData[featureCorps.corps] || { dayChange: 0, trendFromAvg: 0, avgTotal: featureCorps.total };

  // Get show title for this corps
  const showTitle = db ? await getShowTitleFromFirestore(db, featureCorps.corps, featureCorps.sourceYear) : null;

  // Calculate season progress data
  const seasonHigh = corpsTrend.seasonHigh || featureCorps.total;
  const seasonLow = corpsTrend.seasonLow || featureCorps.total;
  const improvement = corpsTrend.totalImprovement || 0;

  const prompt = `You are a DCI.org feature writer profiling a corps' season journey. Write in the authentic DCI.org editorial voice - respectful, knowledgeable, celebrating the corps while providing analytical insight.

═══════════════════════════════════════════════════════════════
DCI.ORG CORPS FEATURE STYLE GUIDE
═══════════════════════════════════════════════════════════════
DCI.org corps features follow these conventions:

HEADLINES: Corps name + season narrative or achievement
- "Carolina Crown: Brass excellence meets design innovation in 2024"
- "Blue Devils' journey to 98: Inside the pursuit of perfection"
- "The Cadets' resurgence: How tradition fuels a comeback season"

NARRATIVE STRUCTURE:
- Open with what defines this corps' identity and tradition
- Discuss their current show concept and design choices
- Analyze their competitive trajectory this season
- Highlight specific caption strengths with score references
- Contextualize within their historical legacy
- Close with season outlook and championship potential

SCORE LANGUAGE:
- "posting a season-high 96.875" / "their fifth consecutive score above 95"
- "improved 1.25 points since the season opener"
- "their brass caption averaging 19.2 over the last four shows"
- "ranking first in Visual Proficiency for three straight competitions"

TONE: Celebratory but analytical. Like a Drum Corps World feature meets ESPN profile.

═══════════════════════════════════════════════════════════════
FEATURED CORPS: ${featureCorps.corps}
═══════════════════════════════════════════════════════════════
• Historical Season Being Relived: ${featureCorps.sourceYear}
${showTitle ? `• Show Title: "${showTitle}"` : ''}
• Current Standing: ${currentRank}${currentRank === 1 ? 'st' : currentRank === 2 ? 'nd' : currentRank === 3 ? 'rd' : 'th'} place
• Today's Score: ${featureCorps.total.toFixed(3)}
• Daily Movement: ${corpsTrend.dayChange >= 0 ? '+' : ''}${corpsTrend.dayChange.toFixed(3)}

SEASON TRAJECTORY:
• Season High: ${seasonHigh.toFixed(3)}
• Season Low: ${seasonLow.toFixed(3)}
• 7-Day Average: ${corpsTrend.avgTotal?.toFixed(3) || featureCorps.total.toFixed(3)}
• Total Improvement: ${improvement >= 0 ? '+' : ''}${improvement.toFixed(3)} since season start
${corpsTrend.atSeasonBest ? '★ AT SEASON HIGH TODAY - Peaking performance!' : ''}

CAPTION BREAKDOWN (Today):
• General Effect: ${featureCorps.subtotals?.ge?.toFixed(2) || 'N/A'}${corpsTrend.captionTrends?.ge?.trending === "up" ? " (trending up)" : corpsTrend.captionTrends?.ge?.trending === "down" ? " (trending down)" : ""}
  - GE1 (Music): ${featureCorps.captions?.GE1?.toFixed(2) || 'N/A'}
  - GE2 (Visual): ${featureCorps.captions?.GE2?.toFixed(2) || 'N/A'}
• Visual Total: ${featureCorps.subtotals?.visual?.toFixed(2) || 'N/A'}${corpsTrend.captionTrends?.visual?.trending === "up" ? " (trending up)" : corpsTrend.captionTrends?.visual?.trending === "down" ? " (trending down)" : ""}
  - VP: ${featureCorps.captions?.VP?.toFixed(2) || 'N/A'}
  - VA: ${featureCorps.captions?.VA?.toFixed(2) || 'N/A'}
  - CG: ${featureCorps.captions?.CG?.toFixed(2) || 'N/A'}
• Music Total: ${featureCorps.subtotals?.music?.toFixed(2) || 'N/A'}${corpsTrend.captionTrends?.music?.trending === "up" ? " (trending up)" : corpsTrend.captionTrends?.music?.trending === "down" ? " (trending down)" : ""}
  - Brass: ${featureCorps.captions?.B?.toFixed(2) || 'N/A'}
  - MA: ${featureCorps.captions?.MA?.toFixed(2) || 'N/A'}
  - Percussion: ${featureCorps.captions?.P?.toFixed(2) || 'N/A'}

COMPETITIVE CONTEXT:
${dayScores.slice(Math.max(0, currentRank - 2), Math.min(dayScores.length, currentRank + 3)).map((s, i) => {
  const rank = Math.max(0, currentRank - 2) + i + 1;
  const gap = s.total - featureCorps.total;
  return `${rank}. ${s.corps}: ${s.total.toFixed(3)}${s.corps === featureCorps.corps ? ' ← FEATURED' : ` (${gap >= 0 ? '+' : ''}${gap.toFixed(3)})`}`;
}).join('\n')}

${toneGuidance}

WRITE A DCI.ORG-STYLE CORPS FEATURE:

1. HEADLINE: "${featureCorps.corps}: [Season narrative or defining achievement]"
   Focus on their journey, improvement, or signature strength.

2. SUMMARY: 2-3 sentences introducing this corps and what makes their ${featureCorps.sourceYear} season compelling.

3. NARRATIVE: 600-800 word feature profile:
   - Open with what defines ${featureCorps.corps}' identity and tradition
   ${showTitle ? `- Discuss their show "${showTitle}" and its artistic concept` : '- Analyze their performance style and competitive approach'}
   - Detail their season trajectory with specific score references
   - Highlight their strongest captions (use exact scores)
   - Contextualize within their historical legacy
   - Close with outlook for the championship stretch

Write like a DCI.org or Drum Corps World feature journalist.`;

  const schema = {
    type: SchemaType.OBJECT,
    properties: {
      headline: { type: SchemaType.STRING, description: "Corps-focused feature headline" },
      summary: { type: SchemaType.STRING, description: "2-3 sentence introduction" },
      narrative: { type: SchemaType.STRING, description: "600-800 word corps profile" },
      corpsIdentity: {
        type: SchemaType.OBJECT,
        properties: {
          tradition: { type: SchemaType.STRING, description: "Corps' historical identity" },
          strength: { type: SchemaType.STRING, description: "Primary competitive strength" },
          trajectory: { type: SchemaType.STRING, description: "Season trajectory assessment" },
        },
        required: ["tradition", "strength", "trajectory"],
      },
    },
    required: ["headline", "summary", "narrative", "corpsIdentity"],
  };

  try {
    const content = await generateStructuredContent(prompt, schema);

    const imagePrompt = buildCorpsSpotlightImagePrompt(
      featureCorps.corps,
      featureCorps.sourceYear,
      showTitle
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
async function generateDciRecapArticle({ reportDay, dayScores, trendData, captionLeaders, activeCorps, showContext, competitionContext, db, excludeCorps = new Set() }) {
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

  const prompt = `You are a DCI.org recap analyst specializing in caption analysis. Write in the authentic DCI.org "Recap Analysis" style - detailed, technical, but accessible to fans who want to understand what's driving the scores.

═══════════════════════════════════════════════════════════════
DCI.ORG RECAP ANALYSIS STYLE GUIDE
═══════════════════════════════════════════════════════════════
DCI.org recap articles (like "Recap Analysis: World Class Finals") follow these conventions:

HEADLINES: Caption-focused with competitive angle
- "Recap Analysis: General Effect battle tightens heading into Finals"
- "Visual caption trends: Which corps are peaking at the right time?"
- "Music Analysis: Brass scores surge as season enters final stretch"

CAPTION BREAKDOWN STRUCTURE:
1. GENERAL EFFECT (40% of total score)
   - GE1 (Music Effect): How the music design affects the audience
   - GE2 (Visual Effect): How the visual design affects the audience
   - "The corps' spread over [Rival] in GE was 0.15"
   - "Winning GE by 0.20 accounted for most of the 0.35 total margin"

2. VISUAL (30% of total score)
   - Visual Proficiency (VP): Marching technique, body movement
   - Visual Analysis (VA): Design, staging, visual composition
   - Color Guard (CG): Equipment work, dance, performance quality
   - "0.45 over Crown in Total Visual" / "took 2nd in Color Guard, just 0.1 down"

3. MUSIC (30% of total score)
   - Brass (B): Brass section performance quality
   - Music Analysis (MA): Music design, arrangement
   - Percussion (P): Battery and pit performance
   - "Won the Percussion caption by 0.05 over Santa Clara Vanguard"

TREND ANALYSIS LANGUAGE:
- "improved their GE score by 0.35 over the last week"
- "Visual has been their growth area, climbing 0.40 since Day 35"
- "Brass consistency remains a strength - averaging 19.3 over four shows"
- "The corps that shows the most GE improvement typically has design changes clicking"

═══════════════════════════════════════════════════════════════
WEEKLY CAPTION ANALYSIS (Last 7 Days)
═══════════════════════════════════════════════════════════════
Week: Days ${reportDay - 6} through ${reportDay}
Current Date: ${showContext.date}

GENERAL EFFECT ANALYSIS:
Leader: ${geSorted[0]?.corps} (${geSorted[0]?.subtotals?.ge?.toFixed(2)})
Second: ${geSorted[1]?.corps} (${geSorted[1]?.subtotals?.ge?.toFixed(2)}) - ${((geSorted[0]?.subtotals?.ge || 0) - (geSorted[1]?.subtotals?.ge || 0)).toFixed(2)} behind
Third: ${geSorted[2]?.corps} (${geSorted[2]?.subtotals?.ge?.toFixed(2)})
GE Trending Up: ${captionTrends.ge.trending.length > 0 ? captionTrends.ge.trending.map(t => t.corps).join(', ') : 'No significant movers'}

Top 5 GE Scores Today:
${geSorted.slice(0, 5).map((s, i) => {
  const trend = trendData[s.corps]?.captionTrends?.ge;
  return `${i + 1}. ${s.corps}: ${s.subtotals?.ge?.toFixed(2)} [GE1: ${s.captions?.GE1?.toFixed(2)}, GE2: ${s.captions?.GE2?.toFixed(2)}]${trend?.trending === "up" ? " ↑" : trend?.trending === "down" ? " ↓" : ""}`;
}).join('\n')}

VISUAL ANALYSIS:
Leader: ${visualSorted[0]?.corps} (${visualSorted[0]?.subtotals?.visual?.toFixed(2)})
Second: ${visualSorted[1]?.corps} (${visualSorted[1]?.subtotals?.visual?.toFixed(2)}) - ${((visualSorted[0]?.subtotals?.visual || 0) - (visualSorted[1]?.subtotals?.visual || 0)).toFixed(2)} behind
Third: ${visualSorted[2]?.corps} (${visualSorted[2]?.subtotals?.visual?.toFixed(2)})
Visual Trending Up: ${captionTrends.visual.trending.length > 0 ? captionTrends.visual.trending.map(t => t.corps).join(', ') : 'No significant movers'}

Top 5 Visual Scores Today:
${visualSorted.slice(0, 5).map((s, i) => {
  const trend = trendData[s.corps]?.captionTrends?.visual;
  return `${i + 1}. ${s.corps}: ${s.subtotals?.visual?.toFixed(2)} [VP: ${s.captions?.VP?.toFixed(2)}, VA: ${s.captions?.VA?.toFixed(2)}, CG: ${s.captions?.CG?.toFixed(2)}]${trend?.trending === "up" ? " ↑" : trend?.trending === "down" ? " ↓" : ""}`;
}).join('\n')}

MUSIC ANALYSIS:
Leader: ${musicSorted[0]?.corps} (${musicSorted[0]?.subtotals?.music?.toFixed(2)})
Second: ${musicSorted[1]?.corps} (${musicSorted[1]?.subtotals?.music?.toFixed(2)}) - ${((musicSorted[0]?.subtotals?.music || 0) - (musicSorted[1]?.subtotals?.music || 0)).toFixed(2)} behind
Third: ${musicSorted[2]?.corps} (${musicSorted[2]?.subtotals?.music?.toFixed(2)})
Music Trending Up: ${captionTrends.music.trending.length > 0 ? captionTrends.music.trending.map(t => t.corps).join(', ') : 'No significant movers'}

Top 5 Music Scores Today:
${musicSorted.slice(0, 5).map((s, i) => {
  const trend = trendData[s.corps]?.captionTrends?.music;
  return `${i + 1}. ${s.corps}: ${s.subtotals?.music?.toFixed(2)} [B: ${s.captions?.B?.toFixed(2)}, MA: ${s.captions?.MA?.toFixed(2)}, P: ${s.captions?.P?.toFixed(2)}]${trend?.trending === "up" ? " ↑" : trend?.trending === "down" ? " ↓" : ""}`;
}).join('\n')}

WEEK-OVER-WEEK NOTABLE MOVEMENTS:
${(() => {
  const movements = [];
  Object.entries(trendData).forEach(([corps, trend]) => {
    if (trend.weeklyChange && Math.abs(trend.weeklyChange) > 0.3) {
      movements.push(`• ${corps}: ${trend.weeklyChange >= 0 ? '+' : ''}${trend.weeklyChange.toFixed(3)} over the week`);
    }
  });
  return movements.length > 0 ? movements.slice(0, 5).join('\n') : '• No dramatic week-over-week changes';
})()}

${toneGuidance}

WRITE A DCI.ORG-STYLE WEEKLY RECAP ANALYSIS:

1. HEADLINE: Caption-focused weekly analysis headline
   Example: "Recap Analysis: GE battle narrows as ${geSorted[0]?.corps} maintains slim lead"

2. SUMMARY: 2-3 sentences summarizing the week's most significant caption trends.

3. NARRATIVE: 700-900 word deep dive analysis:
   - GENERAL EFFECT section: Who's winning GE and why? What design elements are connecting?
   - VISUAL section: Analyze VP, VA, and CG trends. Who's improving? Who's plateauing?
   - MUSIC section: Break down Brass, MA, and Percussion. Which hornlines are hot?
   - Championship implications: Which caption trends will decide Finals placement?

4. TRADE RECOMMENDATIONS: Fantasy strategy insights based on caption trends:
   - Which DCI corps are trending UP and worth acquiring in fantasy drafts?
   - Which corps are trending DOWN and may be overvalued?
   - Which corps are STEADY and reliable picks?
   - Focus on which CORPS are valuable based on their caption performance - NOT specific lineup picks

Include specific score comparisons. Use DCI.org recap terminology. Write for fans who want to understand the numbers.`;

  const schema = {
    type: SchemaType.OBJECT,
    properties: {
      headline: { type: SchemaType.STRING, description: "Caption-focused recap headline" },
      summary: { type: SchemaType.STRING, description: "2-3 sentence summary of weekly trends" },
      narrative: { type: SchemaType.STRING, description: "700-900 word caption analysis" },
      captionBreakdown: {
        type: SchemaType.OBJECT,
        properties: {
          geAnalysis: { type: SchemaType.STRING, description: "General Effect analysis" },
          visualAnalysis: { type: SchemaType.STRING, description: "Visual caption analysis" },
          musicAnalysis: { type: SchemaType.STRING, description: "Music caption analysis" },
        },
        required: ["geAnalysis", "visualAnalysis", "musicAnalysis"],
      },
      recommendations: {
        type: SchemaType.ARRAY,
        description: "Fantasy trade recommendations based on corps trends",
        items: {
          type: SchemaType.OBJECT,
          properties: {
            corps: { type: SchemaType.STRING, description: "Corps name" },
            action: { type: SchemaType.STRING, enum: ["buy", "hold", "sell"], description: "Recommended action" },
            reasoning: { type: SchemaType.STRING, description: "Why this corps is trending this way based on caption performance" },
          },
          required: ["corps", "action", "reasoning"],
        },
      },
    },
    required: ["headline", "summary", "narrative", "captionBreakdown", "recommendations"],
  };

  try {
    const content = await generateStructuredContent(prompt, schema);

    // Feature the GE leader for the image (or next available if excluded)
    let featuredCorps = geSorted.find(s => !excludeCorps.has(s.corps)) || geSorted[0];
    const showTitle = db ? await getShowTitleFromFirestore(db, featuredCorps.corps, featuredCorps.sourceYear) : null;

    const imagePrompt = buildCaptionsImagePrompt(
      featuredCorps.corps,
      featuredCorps.sourceYear,
      "General Effect",
      showContext.location,
      showTitle
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
async function generateFantasyDailyArticle({ reportDay, fantasyData, showContext, competitionContext, db, dataDocId }) {
  if (!fantasyData?.current) {
    return createFallbackArticle(ARTICLE_TYPES.FANTASY_DAILY, reportDay);
  }

  const toneGuidance = getToneGuidance(competitionContext, "fantasy_results");

  const shows = fantasyData.current.shows || [];
  const allResults = shows.flatMap(s => s.results || []);

  // Filter out SoundSport corps
  const competitiveResults = allResults.filter(r => r.corpsClass !== 'soundSport');
  const topPerformers = competitiveResults.sort((a, b) => b.totalScore - a.totalScore).slice(0, 10);

  const avgScore = topPerformers.length > 0
    ? (topPerformers.reduce((sum, p) => sum + p.totalScore, 0) / topPerformers.length).toFixed(3)
    : "0.000";
  const topScore = topPerformers[0]?.totalScore?.toFixed(3) || "0.000";

  const fantasyShowName = formatFantasyEventName(showContext.showName);

  const prompt = `You are a marching.art fantasy sports analyst. Write exciting coverage of today's fantasy competition results, celebrating the top directors and their ensembles.

═══════════════════════════════════════════════════════════════
MARCHING.ART FANTASY RESULTS
═══════════════════════════════════════════════════════════════
Date: ${showContext.date}
Season Day: ${reportDay}
Competition: ${fantasyShowName}

TOP 10 FANTASY ENSEMBLES TODAY:
${topPerformers.map((r, i) => {
  const margin = i > 0 ? (topPerformers[i-1].totalScore - r.totalScore).toFixed(3) : "-";
  return `${i + 1}. "${r.corpsName}" (Director: ${r.displayName || 'Unknown'}) - ${r.totalScore.toFixed(3)} pts${i > 0 ? ` [${margin} behind]` : ' [WINNER]'}
   From: ${r.location || 'Unknown location'}`;
}).join('\n')}

STATISTICS:
• Winning Score: ${topScore}
• Top 10 Average: ${avgScore}
• Total Ensembles: ${competitiveResults.length}
• Score Spread (1st-10th): ${topPerformers.length >= 10 ? (topPerformers[0].totalScore - topPerformers[9].totalScore).toFixed(3) : 'N/A'}

${toneGuidance}

WRITE A FANTASY SPORTS RESULTS ARTICLE:

1. HEADLINE: Celebrate the winner with their score and ensemble name
   Example: "\"${topPerformers[0]?.corpsName}\" dominates Day ${reportDay} with ${topScore}-point performance"

2. SUMMARY: 2-3 exciting sentences about who won and the competition level.

3. NARRATIVE: 500-700 word celebration article:
   - Lead with the winner's achievement
   - Highlight the top 3-5 performers
   - Discuss the competition intensity
   - Preview tomorrow's competition

This is fantasy sports coverage - fun, competitive, celebratory. NEVER reveal specific roster picks.`;

  const schema = {
    type: SchemaType.OBJECT,
    properties: {
      headline: { type: SchemaType.STRING, description: "Winner-focused headline" },
      summary: { type: SchemaType.STRING, description: "2-3 sentence summary" },
      narrative: { type: SchemaType.STRING, description: "500-700 word results article" },
      topPerformers: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            rank: { type: SchemaType.INTEGER },
            corpsName: { type: SchemaType.STRING },
            director: { type: SchemaType.STRING },
            score: { type: SchemaType.NUMBER },
          },
          required: ["rank", "corpsName", "director", "score"],
        },
      },
      scoreBreakdown: {
        type: SchemaType.OBJECT,
        description: "Score breakdown and statistics for today's competition",
        properties: {
          winningScore: { type: SchemaType.NUMBER, description: "Top score of the day" },
          averageScore: { type: SchemaType.NUMBER, description: "Average score among top performers" },
          spreadTop10: { type: SchemaType.NUMBER, description: "Point spread between 1st and 10th" },
          totalEnsembles: { type: SchemaType.INTEGER, description: "Number of ensembles competing" },
        },
        required: ["winningScore", "averageScore", "totalEnsembles"],
      },
    },
    required: ["headline", "summary", "narrative", "topPerformers", "scoreBreakdown"],
  };

  try {
    const content = await generateStructuredContent(prompt, schema);

    const topCorps = topPerformers[0];

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
      "Victory celebration after dominating Day " + reportDay,
      corpsLocation,
      uniformDesign
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
 * Article 5: marching.art Caption Analysis
 * Fantasy caption trends focusing on General Effect, Visual, and Music over the last week
 */
async function generateFantasyRecapArticle({ reportDay, fantasyData, showContext, competitionContext, db }) {
  const toneGuidance = getToneGuidance(competitionContext, "fantasy_captions");

  const shows = fantasyData?.current?.shows || [];
  const allResults = shows.flatMap(s => s.results || []);
  const competitiveResults = allResults.filter(r => r.corpsClass !== 'soundSport');

  // Get trend data from previous days
  const trendRecaps = fantasyData?.trends || [];

  // Analyze caption performance across the week
  const captionPerformance = {
    ge: [],
    visual: [],
    music: [],
  };

  // Group by caption performance if available
  competitiveResults.forEach(result => {
    if (result.captionScores) {
      captionPerformance.ge.push({ name: result.corpsName, score: result.captionScores.ge || 0 });
      captionPerformance.visual.push({ name: result.corpsName, score: result.captionScores.visual || 0 });
      captionPerformance.music.push({ name: result.corpsName, score: result.captionScores.music || 0 });
    }
  });

  // Sort by caption scores
  captionPerformance.ge.sort((a, b) => b.score - a.score);
  captionPerformance.visual.sort((a, b) => b.score - a.score);
  captionPerformance.music.sort((a, b) => b.score - a.score);

  const fantasyShowName = formatFantasyEventName(showContext.showName);

  const prompt = `You are a marching.art fantasy analyst specializing in caption performance trends. Help directors understand which captions are driving fantasy success.

═══════════════════════════════════════════════════════════════
MARCHING.ART CAPTION ANALYSIS
═══════════════════════════════════════════════════════════════
Date: ${showContext.date}
Season Day: ${reportDay}
Analysis Period: Days ${reportDay - 6} through ${reportDay}

CAPTION SCORING REMINDER:
In marching.art fantasy, points come from three caption categories:
• GENERAL EFFECT (GE) - 40% weight: Design excellence, entertainment value
• VISUAL - 30% weight: Marching technique, color guard, staging
• MUSIC - 30% weight: Brass, percussion, music design

WEEKLY FANTASY TRENDS:
${(() => {
  if (trendRecaps.length < 2) return "Insufficient data for weekly trends - early season.";

  // Calculate average scores across the week
  const weeklyAvg = trendRecaps.reduce((acc, recap) => {
    const results = (recap.shows || []).flatMap(s => s.results || []).filter(r => r.corpsClass !== 'soundSport');
    const avg = results.length > 0
      ? results.reduce((sum, r) => sum + r.totalScore, 0) / results.length
      : 0;
    return acc + avg;
  }, 0) / trendRecaps.length;

  return `• Average top ensemble score this week: ${weeklyAvg.toFixed(3)}
• Competitions this week: ${trendRecaps.length}
• Total fantasy points distributed: ${trendRecaps.reduce((sum, r) => sum + ((r.shows || []).flatMap(s => s.results || []).length), 0)} performances`;
})()}

TODAY'S TOP PERFORMERS BY CATEGORY:
${(() => {
  if (captionPerformance.ge.length === 0) {
    // Fallback to total scores if no caption breakdown
    const sorted = [...competitiveResults].sort((a, b) => b.totalScore - a.totalScore).slice(0, 5);
    return `TOP 5 OVERALL:
${sorted.map((r, i) => `${i + 1}. "${r.corpsName}" - ${r.totalScore.toFixed(3)} total`).join('\n')}`;
  }

  return `GENERAL EFFECT LEADERS:
${captionPerformance.ge.slice(0, 3).map((r, i) => `${i + 1}. "${r.name}" - ${r.score.toFixed(2)}`).join('\n')}

VISUAL LEADERS:
${captionPerformance.visual.slice(0, 3).map((r, i) => `${i + 1}. "${r.name}" - ${r.score.toFixed(2)}`).join('\n')}

MUSIC LEADERS:
${captionPerformance.music.slice(0, 3).map((r, i) => `${i + 1}. "${r.name}" - ${r.score.toFixed(2)}`).join('\n')}`;
})()}

${toneGuidance}

WRITE A MARCHING.ART CAPTION ANALYSIS ARTICLE:

1. HEADLINE: Caption trend focus
   Example: "Caption Analysis: GE performance drives fantasy success as season heats up"

2. SUMMARY: 2-3 sentences about which captions are making the biggest impact this week.

3. NARRATIVE: 500-700 word analysis:
   - Analyze General Effect trends and what's driving high GE scores
   - Break down Visual performance - which ensembles excel in visual captions?
   - Examine Music trends - brass vs percussion impact
   - Strategic insights for directors (without revealing specific picks)
   - Week-over-week trend observations

Help directors understand the caption dynamics. Educational but engaging.`;

  const schema = {
    type: SchemaType.OBJECT,
    properties: {
      headline: { type: SchemaType.STRING, description: "Caption-focused headline" },
      summary: { type: SchemaType.STRING, description: "2-3 sentence summary" },
      narrative: { type: SchemaType.STRING, description: "500-700 word caption analysis" },
      captionInsights: {
        type: SchemaType.OBJECT,
        properties: {
          geInsight: { type: SchemaType.STRING, description: "General Effect insight" },
          visualInsight: { type: SchemaType.STRING, description: "Visual caption insight" },
          musicInsight: { type: SchemaType.STRING, description: "Music caption insight" },
        },
        required: ["geInsight", "visualInsight", "musicInsight"],
      },
    },
    required: ["headline", "summary", "narrative", "captionInsights"],
  };

  try {
    const content = await generateStructuredContent(prompt, schema);

    // Use fantasy league championship image
    const imagePrompt = buildFantasyLeagueImagePrompt();

    const imageData = await generateImageWithImagen(imagePrompt);
    const imageResult = await processGeneratedImage(imageData, "fantasy_recap");

    return {
      type: ARTICLE_TYPES.FANTASY_RECAP,
      ...content,
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
    // OPTIMIZATION: Read from subcollection instead of single large document
    const recapsSnapshot = await db.collection(`fantasy_recaps/${seasonId}/days`).get();
    if (recapsSnapshot.empty) return null;

    const allRecaps = recapsSnapshot.docs.map(doc => doc.data());
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
