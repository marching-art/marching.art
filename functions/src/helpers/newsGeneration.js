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
const { GoogleGenAI, Type } = require("@google/genai");
const { logger } = require("firebase-functions/v2");
const { defineSecret } = require("firebase-functions/params");
const { uploadFromUrl, getContextualPlaceholder } = require("./mediaService");

// Define Gemini API key secret
const geminiApiKey = defineSecret("GOOGLE_GENERATIVE_AI_API_KEY");

// Initialize client (lazy loaded) - single unified SDK for text and image generation
let genAI = null;

// Separate Vertex AI client for image generation (Imagen models require Vertex AI endpoint)
let genAIVertex = null;

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
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
}

/**
 * Initialize Vertex AI client for image generation
 * Imagen models require Vertex AI endpoint instead of public Gemini API
 */
function initializeVertexAI() {
  if (!genAIVertex) {
    genAIVertex = new GoogleGenAI({
      vertexai: true,
      project: "marching-art",
      location: "us-central1",
    });
  }
  return genAIVertex;
}

/**
 * Generate content with structured JSON output
 * Uses Gemini's native JSON mode for guaranteed valid JSON
 */
async function generateStructuredContent(prompt, schema) {
  const ai = initializeGemini();

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash-lite",
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
// IMAGE GENERATION
// =============================================================================

// Configuration: Set to true to use paid Imagen 3 ($0.02/image), false for free Gemini Flash
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
 * Generate an image using either free tier (Gemini Flash) or Imagen 4
 * Automatically prepends drum corps visual context to ensure accurate imagery.
 *
 * @param {string} prompt - Detailed image prompt
 * @param {Object} options - Optional configuration
 * @param {string} options.model - Override the default model (e.g., 'gemini-3-flash-preview')
 * @param {string} options.aspectRatio - Aspect ratio for paid tier (default: '16:9')
 * @returns {Promise<string>} Base64 image data or URL
 */
async function generateImageWithImagen(prompt, options = {}) {
  try {
    if (USE_PAID_IMAGE_GEN && !options.model) {
      // Paid tier: Imagen 3 via Vertex AI ($0.02/image)
      // Imagen models require Vertex AI endpoint, not public Gemini API
      const vertexAI = initializeVertexAI();
      const modelName = "imagen-3.0-generate-002";

      // For Imagen 3: Put specific prompt FIRST, then minimal context
      // This ensures corps-specific uniform details take priority over generic descriptions
      const imagen3Prompt = `${prompt}

---
CRITICAL RULES FOR THIS IMAGE:
- This is DCI drum corps on a football field, NOT a rock concert or orchestra
- Each performer holds ONLY ONE instrument type (brass OR drums OR flag - never multiple)
- Use the EXACT uniform colors and details specified above - do not substitute generic designs
${IMAGE_NEGATIVE_PROMPT}`;

      // Retry logic for quota limits (429 errors)
      const MAX_RETRIES = 3;
      const RETRY_DELAY_MS = 15000; // 15 seconds between retries

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const response = await vertexAI.models.generateImages({
            model: modelName,
            prompt: imagen3Prompt,
            config: {
              numberOfImages: 1,
              aspectRatio: options.aspectRatio || "16:9",
              outputMimeType: "image/jpeg",
            },
          });

          const generatedImage = response.generatedImages?.[0];
          if (generatedImage?.image?.imageBytes) {
            logger.info(`Image generated successfully using ${modelName} via Vertex AI`);
            return `data:image/jpeg;base64,${generatedImage.image.imageBytes}`;
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
    } else {
      // Free tier or custom model: Gemini with native image generation
      const ai = initializeGemini();
      const modelName = options.model || "gemini-3-pro-image-preview";

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
 * Supports two styles: 'logo' (team emblem) or 'performer' (section member)
 *
 * @param {string} corpsName - The fantasy corps name
 * @param {string} location - The corps home location
 * @param {object} uniformDesign - Director-provided uniform customization (optional)
 */
function buildCorpsAvatarPrompt(corpsName, location = null, uniformDesign = null) {
  const details = getFantasyUniformDetails(corpsName, location, uniformDesign);
  const avatarStyle = uniformDesign?.avatarStyle || "logo";
  const avatarSection = uniformDesign?.avatarSection || "hornline";

  // Extract colors with fallbacks
  const primaryColor = uniformDesign?.primaryColor || details.colors.split(" ")[0] || "blue";
  const secondaryColor = uniformDesign?.secondaryColor || details.colors.split(" with ")[1]?.split(" ")[0] || "silver";
  const accentColor = uniformDesign?.accentColor || null;
  const themeKeywords = uniformDesign?.themeKeywords || [];

  // Build mascot description
  const mascotDesc = uniformDesign?.mascotOrEmblem
    ? uniformDesign.mascotOrEmblem
    : `bold mascot or symbol inspired by "${corpsName}"`;

  // Location string
  const locationStr = location ? ` from ${location}` : "";

  // If performer style, generate a section member image
  if (avatarStyle === "performer") {
    return buildPerformerAvatarPrompt(corpsName, locationStr, uniformDesign, avatarSection, {
      primaryColor,
      secondaryColor,
      accentColor,
      themeKeywords,
    });
  }

  // ==========================================================================
  // MASTER LOGO AVATAR TEMPLATE - marching.art unified format
  // ==========================================================================
  return `Create a professional esports-style team logo/avatar for the fantasy marching arts ensemble "${corpsName}"${locationStr}.

CRITICAL FORMAT REQUIREMENTS:
- SQUARE format (1:1 aspect ratio)
- Full-bleed design that fills the entire canvas edge-to-edge
- NO circular badges with empty corners
- Background must extend to all edges (gradient, pattern, or textured fill)
- No empty/white space

DESIGN STYLE:
- Modern esports/gaming team aesthetic
- Bold, dynamic, high-contrast composition
- Angular shapes, sharp lines, or a mascot that extends to the edges
- Stylized illustration (NOT photorealistic)
- Must remain readable at small sizes (64x64)

COMPOSITION RULES:
- Centered or slightly off-center focal point
- Diagonal energy lines encouraged
- Asymmetric, dynamic layouts preferred over static symmetry

MASCOT / SYMBOL:
- Featured mascot/emblem: ${mascotDesc} — large, dominant, and filling the frame
- Integrate marching arts elements subtly into the silhouette or negative space (not as separate floating icons)
- Choose 1-2: brass bell silhouette, drumstick, mallet, guard silk, shako plume, drill chart lines
- Include corps name or bold initials as part of the composition

TYPOGRAPHY:
- Bold, blocky esports-style lettering
- Avoid script fonts
- Prioritize readability at small sizes

COLOR PALETTE:
- Primary: ${primaryColor}
- Secondary: ${secondaryColor}${accentColor ? `\n- Accent: ${accentColor}` : ""}
- Use gradients or textured fills to avoid flat/empty areas

THEME & MOOD:
- Keywords: ${themeKeywords.length > 0 ? themeKeywords.join(", ") : "competitive, elite, championship"}
- Tone: competitive, elite, championship-ready
- Dynamic angles, strong silhouettes, and full-frame energy

DO NOT INCLUDE:
- Circular badge frames or medallion shapes
- Mascots with realistic human faces
- Soft gradients that reduce contrast
- Floating/disconnected design elements
- Photorealistic rendering`;
}

/**
 * Build performer-style avatar prompt featuring a specific section member
 * Uses the same unified format structure as logo avatars
 */
function buildPerformerAvatarPrompt(corpsName, locationStr, uniformDesign, section, colors) {
  const { primaryColor, secondaryColor, accentColor, themeKeywords } = colors;

  const sectionDescriptions = {
    drumMajor: {
      title: "Drum Major",
      pose: "standing proud with mace/baton raised, commanding presence",
      instrument: "conducting baton or ceremonial mace",
      details: "leadership insignia, distinctive headwear, epaulettes",
    },
    hornline: {
      title: "Brass Performer",
      pose: "in playing position with horn raised, powerful stance",
      instrument: uniformDesign?.brassDescription || "polished brass horn with bell raised",
      details: "white gloves, determined expression, athletic posture",
    },
    drumline: {
      title: "Percussion Performer",
      pose: "with drums mounted, sticks ready, intense focus",
      instrument: uniformDesign?.percussionDescription || "snare drum with matching carrier",
      details: "drumsticks in motion, powerful stance, matching hardware",
    },
    colorGuard: {
      title: "Color Guard Performer",
      pose: "mid-movement with equipment, graceful and dynamic",
      instrument: "silk flag or rifle",
      details: uniformDesign?.guardDescription || "flowing costume, expressive movement, athletic grace",
    },
  };

  const sectionInfo = sectionDescriptions[section] || sectionDescriptions.hornline;
  const helmetDesc = uniformDesign?.helmetStyle === "none"
    ? "no headwear"
    : uniformDesign?.plumeDescription || `${uniformDesign?.helmetStyle || "modern"} style headwear`;

  // ==========================================================================
  // MASTER PERFORMER AVATAR TEMPLATE - marching.art unified format
  // ==========================================================================
  return `Create a stylized portrait avatar of a ${sectionInfo.title} from the fantasy marching arts ensemble "${corpsName}"${locationStr}.

CRITICAL FORMAT REQUIREMENTS:
- SQUARE format (1:1 aspect ratio)
- Full-bleed design that fills the entire canvas edge-to-edge
- Subject must FILL THE ENTIRE FRAME - tightly cropped, no empty space
- Background must extend to all edges (stadium blur, gradient, or team colors)
- No borders or margins around the subject

DESIGN STYLE:
- Modern esports/gaming avatar aesthetic
- Bold, dynamic, high-contrast composition
- Stylized illustration (NOT photorealistic)
- Must remain readable at small sizes (64x64)

COMPOSITION RULES:
- Subject centered or slightly off-center
- Diagonal energy lines in background encouraged
- Dynamic, action-oriented framing

SUBJECT:
- Single ${sectionInfo.title} performer, tightly cropped portrait
- Pose: ${sectionInfo.pose}
- Equipment: ${sectionInfo.instrument}
- Details: ${sectionInfo.details}
- Integrate marching arts identity into the silhouette (not floating icons)

UNIFORM & COLORS:
- Primary: ${primaryColor}
- Secondary: ${secondaryColor}${accentColor ? `\n- Accent: ${accentColor}` : ""}
- Style: ${uniformDesign?.style || "contemporary"} marching arts uniform
- Headwear: ${helmetDesc}
- White marching gloves
- Use team colors in background gradient

THEME & MOOD:
- Keywords: ${themeKeywords.length > 0 ? themeKeywords.join(", ") : "competitive, elite, championship"}
- Tone: competitive, elite, championship-ready
- Dramatic lighting, dynamic pose, full-frame energy

DO NOT INCLUDE:
- Realistic human facial features (stylize the face)
- Soft gradients that reduce contrast
- Empty space or borders around subject
- Static, passport-photo style poses
- Photorealistic rendering`;
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
    dci: `DCI Finals-style photography capturing the full spectacle of drum corps performance.

HEADLINE CONTEXT: "${headline}"
${corpsName ? `FEATURED CORPS: ${corpsName}` : ""}
${showTitle ? `SHOW: "${showTitle}"` : ""}

SHOT TYPE: Epic DCI Finals stadium photograph
- Wide/elevated angle from press box or sideline platform
- Full corps of 100-150 performers visible in formation across the football field
- Stadium bowl with 30,000+ crowd visible in background
- Professional stadium lighting creating dramatic atmosphere

COMPOSITION (choose most appropriate for headline):
- Massive company front of 80+ performers spanning sideline to sideline, bells raised
- Full corps in geometric formation filling the field, visible from elevated angle
- Corps-wide impact moment with all sections synchronized in dramatic pose
- Brass arc of 50+ performers with drumline and guard visible in their positions

${uniformSection}

CRITICAL: Show the FULL CORPS (100-150 performers), not small groups. This is an epic stadium shot.
${themeContext}

STADIUM ATMOSPHERE:
- DCI Finals night atmosphere with massive stadium floods
- Yard lines clearly visible on field
- Stadium architecture and lights prominent in frame
- Crowd visible in stands, scoreboard/LED screens adding to atmosphere

MOOD: Championship spectacle, epic scale, professional broadcast quality

TECHNICAL: Professional broadcast/sports photography, wide angle from elevated position, capturing the full scale and grandeur of DCI competition. High contrast, vivid colors, sharp across the entire formation.`,

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
  { angle: "press box level wide shot, 70-200mm lens from 50 yard line, capturing full corps in formation across the field", description: "epic wide view of entire ensemble with stadium lights blazing" },
  { angle: "elevated sideline platform, 24-70mm wide angle, showing 100+ performers spanning goal line to goal line", description: "sweeping stadium shot showing scale of corps" },
  { angle: "end zone tower camera, looking down the field at company front of 60+ performers approaching", description: "dramatic frontal view with stadium bowl visible behind" },
  { angle: "corner press box angle, wide shot capturing diagonal formation across yard lines with packed stands visible", description: "cinematic stadium atmosphere shot" },
  { angle: "high sideline scaffold, 16-35mm ultra-wide, capturing full field with stadium lights creating starburst effects", description: "epic DCI Finals atmosphere" },
  { angle: "broadcast camera position behind end zone, elevated 40 feet, showing geometric drill formation across entire field", description: "TV broadcast quality formation shot" },
  { angle: "50 yard line press level, telephoto compression showing dense brass arc of 40+ performers with crowd behind", description: "powerful wall of sound visual" },
  { angle: "aerial drone-style perspective, 80 feet up, looking down at symmetrical formation filling the field", description: "geometric precision from above" },
];

/**
 * Performer moments to capture
 */
const PERFORMER_MOMENTS = [
  { moment: "entire corps hitting the final chord, brass bells high, everyone frozen in impact pose", emotion: "triumphant climax" },
  { moment: "corps-wide company front advancing with 80+ performers in perfect step", emotion: "overwhelming power" },
  { moment: "full ensemble in dramatic pause before the big hit, stadium holding its breath", emotion: "electric anticipation" },
  { moment: "massive brass arc sustaining a chord while guard rifles spin overhead", emotion: "multi-dimensional spectacle" },
  { moment: "drumline feature with entire corps framing them in formation", emotion: "focused intensity" },
  { moment: "corps transition mid-drill, formations morphing across the field", emotion: "kinetic energy" },
  { moment: "emotional ballad moment with corps in scattered formation under soft lights", emotion: "intimate grandeur" },
  { moment: "opener impact with full corps exploding across the field", emotion: "explosive energy" },
];

/**
 * Lighting variations for different atmospheres
 */
const LIGHTING_VARIATIONS = [
  { lighting: "DCI Finals night atmosphere - massive stadium floods creating brilliant white light across the field, 50,000+ crowd visible in darkness", mood: "championship spectacle" },
  { lighting: "Lucas Oil Stadium indoor lighting - dramatic spotlights and LED boards illuminating corps with vivid color saturation", mood: "indoor finals intensity" },
  { lighting: "night competition with stadium lights creating starburst effects, performers brilliantly lit against dark sky", mood: "nighttime drama" },
  { lighting: "evening semifinals atmosphere - twilight sky fading to purple while stadium lights take over", mood: "magic hour competition" },
  { lighting: "full stadium floods with rim lighting from multiple angles, every uniform detail visible", mood: "broadcast quality illumination" },
  { lighting: "dramatic cross-lighting from stadium towers creating long shadows across yard lines", mood: "cinematic depth" },
  { lighting: "LED field panels and stadium screens adding colored accent lighting to the performance", mood: "modern visual technology" },
  { lighting: "championship night with pyrotechnic accents, stadium atmosphere electric with light", mood: "finals night energy" },
];

/**
 * Section formations for group shots
 */
const SECTION_FORMATIONS = [
  { formation: "massive company front of 80+ performers spanning sideline to sideline", visual: "overwhelming power and scale" },
  { formation: "double brass arc formation with 50+ performers creating waves of sound", visual: "dramatic visual impact" },
  { formation: "full corps in geometric block formation filling the field", visual: "military precision at scale" },
  { formation: "corps in spiraling drill pattern visible from elevated angle", visual: "artistic complexity" },
  { formation: "staggered columns of 100+ performers in parade formation", visual: "depth and grandeur" },
  { formation: "corps-wide scatter formation transitioning into unified shape", visual: "controlled chaos becoming order" },
  { formation: "brass, percussion, and guard in layered tiers across the field", visual: "full ensemble architecture" },
  { formation: "symmetrical formation with brass arc, drumline center, guard flanking", visual: "complete DCI spectacle" },
];

/**
 * Subject focus variations
 */
const SUBJECT_FOCUS = [
  { focus: "full corps formation", framing: "entire ensemble of 100-150 performers visible across the field, stadium atmosphere prominent" },
  { focus: "company front spectacle", framing: "60+ performers in horizontal line spanning field, brass bells raised, dramatic stadium lighting" },
  { focus: "brass arc formation", framing: "40-50 brass performers in sweeping arc formation, instruments gleaming under stadium lights" },
  { focus: "full field geometric pattern", framing: "corps in complex drill formation creating visual shapes, elevated angle showing precision" },
  { focus: "ensemble impact moment", framing: "entire corps in synchronized pose, big hit moment, crowd and stadium visible in background" },
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
 * @param {object} uniformDetails - Pre-fetched uniform details from Firestore (optional)
 */
function buildStandingsImagePrompt(topCorps, year, location, showName, showTitle = null, uniformDetails = null) {
  // Use provided uniform details (from Firestore) or fall back to hardcoded
  const details = uniformDetails || getUniformDetails(topCorps, year);
  const themeContext = buildShowThemeContext(showTitle);

  // Get random composition for variety
  const seed = `${topCorps}-${year}-standings`;
  const comp = getRandomComposition(seed);

  return `DCI Finals-style action photograph of ${topCorps} full corps performing (${year} season).

═══════════════════════════════════════════════════════════════
UNIFORM - THIS IS THE MOST IMPORTANT PART - MUST BE EXACT:
═══════════════════════════════════════════════════════════════
Corps: ${topCorps}
Uniform colors and style: ${details.uniform}
Headwear: ${details.helmet}
Brass instruments: ${details.brass}
Percussion: ${details.percussion}
Color guard: ${details.guard}

DO NOT USE: generic red plumes, generic white shakos, or any uniform that doesn't match the description above.
The uniform MUST match ${topCorps}'s distinctive colors and style.
═══════════════════════════════════════════════════════════════
${themeContext}
SHOT TYPE: Epic DCI Finals stadium photograph
- ${comp.camera.angle}
- ${comp.focus.framing}
- Full corps of 100-150 performers visible in formation across the football field
- Stadium bowl with 30,000+ crowd visible in background
- Professional stadium lighting creating dramatic atmosphere

FORMATION: ${comp.formation.formation}
- ${comp.formation.visual}

ENSEMBLE MOMENT: ${comp.moment.moment}
- ${comp.moment.emotion}
- Entire corps synchronized in dramatic pose
- Brass, percussion, and guard sections all visible in their positions

STADIUM ATMOSPHERE:
- ${comp.lighting.lighting}
- Mood: ${comp.lighting.mood}
- Yard lines clearly visible on field
- Stadium architecture and lights prominent in frame
- Scoreboard or LED screens visible adding to atmosphere

TECHNICAL: Professional broadcast/sports photography, wide angle from elevated position, capturing the full scale and spectacle of DCI competition. High contrast, vivid colors, sharp across the entire formation.

This is ${topCorps} from ${showName || "DCI Finals"}${location ? ` in ${location}` : ""}${showTitle ? `, performing "${showTitle}"` : ""} - an epic stadium moment showcasing the full corps.`;
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
 * @param {object} uniformDetails - Pre-fetched uniform details from Firestore (optional)
 */
function buildCaptionsImagePrompt(featuredCorps, year, captionType, location, showTitle = null, uniformDetails = null) {
  // Use provided uniform details (from Firestore) or fall back to hardcoded
  const details = uniformDetails || getUniformDetails(featuredCorps, year);
  const themeContext = buildShowThemeContext(showTitle);

  // Get random composition for variety
  const seed = `${featuredCorps}-${year}-${captionType}-captions`;
  const comp = getRandomComposition(seed);

  // Determine which section to feature based on caption
  let sectionFocus, sectionDetails, formationDescription, sectionNote;

  if (captionType.includes("Brass") || captionType.includes("B")) {
    sectionFocus = "brass section";
    sectionDetails = details.brass;
    formationDescription = "massive brass arc of 50+ performers with bells raised, full corps visible in stadium setting";
    sectionNote = "Emphasis on the brass section (40-50 performers) in prominent position, with drumline and guard visible in background positions.";
  } else if (captionType.includes("Percussion") || captionType.includes("P")) {
    sectionFocus = "drumline";
    sectionDetails = details.percussion;
    formationDescription = "drumline feature moment with 20+ percussion performers center stage, brass and guard framing them";
    sectionNote = "Emphasis on the drumline (snare, tenors, bass drums) in center formation, with brass arc and guard visible around them.";
  } else if (captionType.includes("Guard") || captionType.includes("CG")) {
    sectionFocus = "color guard";
    sectionDetails = details.guard;
    formationDescription = "color guard feature with 15+ performers executing dramatic choreography, corps providing backdrop";
    sectionNote = "Emphasis on guard members with silks/rifles in foreground, full brass and percussion ensemble visible behind.";
  } else if (captionType.includes("Visual") || captionType.includes("V")) {
    sectionFocus = "full corps drill";
    sectionDetails = details.uniform;
    formationDescription = "full corps in geometric drill formation showing precision spacing and body technique";
    sectionNote = "Emphasis on visual design with 100+ performers in complex formation, showcasing drill precision.";
  } else {
    // GE or general
    sectionFocus = "full ensemble";
    sectionDetails = details.uniform;
    formationDescription = "full corps in emotional performance moment, all sections unified in expression";
    sectionNote = "Full corps visible showing the emotional and artistic impact of the performance.";
  }

  return `DCI Finals-style photograph of ${featuredCorps} full corps performing (${year} season), highlighting ${sectionFocus} excellence.

═══════════════════════════════════════════════════════════════
UNIFORM - THIS IS THE MOST IMPORTANT PART - MUST BE EXACT:
═══════════════════════════════════════════════════════════════
Corps: ${featuredCorps}
Uniform colors and style: ${details.uniform}
Headwear: ${details.helmet}
Brass instruments: ${details.brass}
Percussion: ${details.percussion}
Color guard: ${details.guard}

DO NOT USE: generic red plumes, generic white shakos, or any uniform that doesn't match the description above.
The uniform MUST match ${featuredCorps}'s distinctive colors and style.
═══════════════════════════════════════════════════════════════
${themeContext}
SHOT TYPE: Epic stadium photograph showing ${formationDescription}
- ${comp.camera.angle}
- ${comp.focus.framing}
- Full corps of 100-150 performers visible across the football field
- Stadium bowl with crowd visible in background

SECTION EMPHASIS: ${sectionNote}

FORMATION: ${comp.formation.formation}
- ${comp.formation.visual}

ENSEMBLE MOMENT: ${comp.moment.moment}
- ${comp.moment.emotion}

STADIUM ATMOSPHERE:
- ${comp.lighting.lighting}
- Mood: ${comp.lighting.mood}
- Yard lines visible, stadium lights prominent

TECHNICAL: Professional broadcast photography capturing the full scale of DCI competition while showcasing ${captionType} excellence.

This is ${featuredCorps} from ${location || "DCI Finals"}${showTitle ? `, performing "${showTitle}"` : ""}, showcasing ${captionType} excellence in an epic stadium setting.`;
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
    ? "Modern indoor arena (like Lucas Oil Stadium) with dramatic LED lighting systems, 30,000+ crowd visible"
    : details.venuePreference === "outdoor"
      ? "Outdoor stadium under evening sky with dramatic stadium floods, packed stands visible"
      : "Professional marching arts competition stadium with dramatic lighting and enthusiastic crowd";

  return `DCI Finals-style photograph of the full fantasy marching arts ensemble "${topCorpsName}"${location ? ` from ${location}` : ""}.

UNIFORM DESIGN${details.matchedTheme === "director-custom" ? " (Director-Specified)" : ""}:
- Colors: ${details.colors}
- Uniform: ${details.uniform}
- Headwear: ${details.helmet}
- Brass: ${details.brass}
- Guard elements: ${details.guard}
${details.additionalNotes ? `- Special notes: ${details.additionalNotes}` : ""}

SHOT TYPE: Epic stadium photograph showing full ensemble
- ${comp.camera.angle}
- ${comp.focus.framing}
- Full corps of 100-150 performers visible in formation across the football field
- Stadium bowl with enthusiastic crowd visible in background

SCENE SETTING:
- ${venueDescription}
- ${theme || "Championship competition performance moment"}
- ${details.performanceStyle ? `Performance style: ${details.performanceStyle}` : "Professional DCI championship atmosphere"}

FORMATION: ${comp.formation.formation}
- ${comp.formation.visual}

ENSEMBLE MOMENT: ${comp.moment.moment}
- ${comp.moment.emotion}
- Full corps synchronized in dramatic pose
- Brass, percussion, and guard sections all visible in their positions

STADIUM ATMOSPHERE:
- ${comp.lighting.lighting}
- Mood: ${comp.lighting.mood}
- Yard lines clearly visible on field
- Stadium architecture and lights prominent in frame

PHOTOGRAPHY STYLE:
- Professional DCI broadcast photography, wide angle
- ${comp.focus.framing}
- High contrast, saturated colors matching corps theme

AUTHENTICITY:
- All 100-150 members visible with realistic instruments
- Uniform is creative but still clearly a marching arts uniform (not costume)
- White marching gloves, black marching shoes on all performers
- Professional posture and bearing across entire ensemble

This fantasy corps image should show ${comp.camera.description} - the full scale and spectacle of a championship-caliber ensemble.`;
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
 * @param {object} uniformDetails - Pre-fetched uniform details from Firestore (optional)
 */
function buildAnalyticsImagePrompt(featuredCorps, year, analysisType, showTitle = null, uniformDetails = null) {
  // Use provided uniform details (from Firestore) or fall back to hardcoded
  const details = uniformDetails || getUniformDetails(featuredCorps, year);
  const themeContext = buildShowThemeContext(showTitle);

  // Get random composition for variety
  const seed = `${featuredCorps}-${year}-${analysisType}-analytics`;
  const comp = getRandomComposition(seed);

  // Analytics-specific camera angles (elevated views for formation analysis)
  const analyticsAngles = [
    "press box level, 50 yards back, wide telephoto showing full 150-member corps in formation",
    "end zone tower, 40 feet up, looking down the length of the field at approaching company front",
    "corner tower shot, capturing diagonal depth of entire corps across yard lines",
    "sideline scaffold, elevated 25 feet, showing full corps in parallel formation",
    "drone-style overhead, 80 feet up, geometric pattern of entire ensemble visible",
  ];
  const selectedAngle = analyticsAngles[Math.abs(seed.split('').reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0)) % analyticsAngles.length];

  return `DCI Finals-style elevated photograph showing ${featuredCorps} full corps (${year}) in ${comp.formation.formation}${showTitle ? ` from their show "${showTitle}"` : ""}.

FORMATION FOCUS:
- Full corps of 100-150 performers displaying ${comp.formation.visual}
- Entire ensemble visible from elevated position
- Brass, percussion, and guard all visible in their formation positions
- Pattern and drill design clearly visible across the field

UNIFORM ACCURACY:
- Uniform: ${details.uniform}
- Headwear: ${details.helmet}
- Brass instruments: ${details.brass}
- Percussion: ${details.percussion}
- Guard: ${details.guard}
${themeContext}
COMPOSITION & CAMERA:
- Position: ${selectedAngle}
- Formation: ${comp.formation.formation}
- Wide shot capturing the ENTIRE corps (100-150 performers)
- Stadium bowl with crowd visible in background

STADIUM ATMOSPHERE:
- ${comp.lighting.lighting}
- Mood: ${comp.lighting.mood}
- Yard lines prominently visible for spatial reference
- Stadium lights creating dramatic illumination
- Professional broadcast quality feel

ANALYTICAL ELEMENTS:
- Full field visible showing drill design precision
- Formation geometry emphasized - the kind of image coaches study
- Clear sight lines showing spacing and coordination

PHOTOGRAPHY:
- Elevated angle optimized for full corps visibility
- Sharp focus across entire formation
- Professional DCI broadcast documentary style

This image captures the full scale and precision of ${featuredCorps}'s ${year} ${analysisType} - an epic stadium shot showing why their performance was analytically significant.`;
}

/**
 * Build image prompt for underdog story article
 * Shows determination and breakthrough moment
 *
 * @param {string} corps - Corps name
 * @param {number} year - Historical year
 * @param {string} location - Competition location
 * @param {string} showTitle - Corps' production title
 * @param {object} uniformDetails - Pre-fetched uniform details from Firestore (optional)
 */
function buildUnderdogImagePrompt(corps, year, location, showTitle = null, uniformDetails = null) {
  // Use provided uniform details (from Firestore) or fall back to hardcoded
  const details = uniformDetails || getUniformDetails(corps, year);
  const themeContext = buildShowThemeContext(showTitle);

  // Get random composition emphasizing triumph
  const seed = `${corps}-${year}-underdog`;
  const comp = getRandomComposition(seed);

  return `DCI Finals-style photograph capturing a triumphant breakthrough moment for ${corps} full corps (${year} season)${showTitle ? ` performing "${showTitle}"` : ""} at ${location || "DCI Finals"}.

SUBJECT: Full corps of ${corps} (100-150 performers) in ${comp.moment.moment}

UNIFORM ACCURACY:
- Uniform: ${details.uniform}
- Headwear: ${details.helmet}
- Brass instruments: ${details.brass}
- Percussion: ${details.percussion}
- Guard: ${details.guard}
${themeContext}
EMOTIONAL NARRATIVE:
- Full corps capturing the spirit of an underdog rising to the occasion
- The triumphant moment when an entire corps proves the doubters wrong
- ${comp.moment.emotion}

SHOT TYPE: Epic DCI Finals stadium photograph
- ${comp.camera.angle}
- ${comp.focus.framing}
- Full corps of 100-150 performers visible in triumphant formation
- Stadium bowl with 30,000+ crowd on their feet in background
- Championship atmosphere celebrating breakthrough achievement

FORMATION: ${comp.formation.formation}
- ${comp.formation.visual}

STADIUM ATMOSPHERE:
- ${comp.lighting.lighting}
- Mood: ${comp.lighting.mood} combined with underdog triumph
- Yard lines visible, stadium lights creating championship drama
- Crowd energy visible - the moment everyone recognizes greatness

PHOTOGRAPHY STYLE:
- Inspirational DCI broadcast photography
- Wide angle capturing the full scale of the achievement
- Professional championship moment documentation
- Colors true to ${corps} palette, vivid and triumphant

This epic stadium shot captures the essence of an underdog story - the full corps that exceeded expectations and proved the doubters wrong in front of a packed stadium.`;
}

/**
 * Build image prompt for corps spotlight article
 * Shows the corps' identity and character
 *
 * @param {string} corps - Corps name
 * @param {number} year - Historical year
 * @param {string} showTitle - Corps' production title
 * @param {object} uniformDetails - Pre-fetched uniform details from Firestore (optional)
 */
function buildCorpsSpotlightImagePrompt(corps, year, showTitle = null, uniformDetails = null) {
  // Use provided uniform details (from Firestore) or fall back to hardcoded
  const details = uniformDetails || getUniformDetails(corps, year);
  const themeContext = buildShowThemeContext(showTitle);

  // Get random composition for variety
  const seed = `${corps}-${year}-spotlight`;
  const comp = getRandomComposition(seed);

  return `DCI Finals-style photograph showcasing the identity and excellence of ${corps} full corps (${year} season)${showTitle ? ` performing "${showTitle}"` : ""}.

SUBJECT: Full corps of ${corps} (100-150 performers) in iconic formation showcasing the corps' distinctive identity.

UNIFORM IDENTITY (CRITICAL):
- Uniform: ${details.uniform}
- Headwear: ${details.helmet}
- Brass instruments: ${details.brass}
- Percussion: ${details.percussion}
- Guard: ${details.guard}
${themeContext}
SHOT TYPE: Epic DCI Finals stadium photograph
- ${comp.camera.angle}
- ${comp.focus.framing}
- Full corps of 100-150 performers visible in formation across the football field
- Stadium bowl with packed crowd visible in background
- Professional stadium lighting creating dramatic atmosphere

FORMATION: ${comp.formation.formation}
- ${comp.formation.visual}
- Capturing the pride, tradition, and iconic visual identity of ${corps}

CORPS CHARACTER:
- Showcasing what makes ${corps} unique at full scale
- Full ensemble in signature formation or iconic moment
- The visual identity that fans recognize instantly - now with all 150 members visible

STADIUM ATMOSPHERE:
- ${comp.lighting.lighting}
- Mood: Pride, excellence, tradition, championship atmosphere
- Yard lines visible, stadium architecture prominent
- The environment that creates legends

PHOTOGRAPHY STYLE:
- Professional DCI broadcast photography, wide angle
- Rich, saturated colors emphasizing corps palette
- Captures the full scale and grandeur of ${corps}

This epic stadium shot captures the essence of ${corps} - their tradition, their excellence, and what makes them special in the DCI world, with the full corps on display.`;
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

  // Base context elements - factual, not dramatic
  const contextElements = [];

  // Season phase affects FACTUAL framing (not emotional)
  switch (seasonPhase) {
    case "early":
      contextElements.push("Early season: scores may change significantly in coming weeks");
      contextElements.push("Reference how many shows remain");
      break;
    case "mid":
      contextElements.push("Mid-season: patterns are emerging");
      contextElements.push("Compare current scores to early-season scores where relevant");
      break;
    case "late":
      contextElements.push("Late season: fewer shows remaining");
      contextElements.push("Reference specific point gaps needed to change positions");
      break;
    case "championship":
      contextElements.push("Championship week: final results pending");
      contextElements.push("Reference specific scores needed for placement changes");
      break;
  }

  // Competitive scenario - factual descriptions
  switch (scenario) {
    case "tight_race":
      contextElements.push(`Top 2 separated by less than 0.3 points`);
      contextElements.push("Note the specific margin when discussing leaders");
      break;
    case "competitive":
      contextElements.push("Multiple corps within striking distance");
      contextElements.push("Note specific point gaps between positions");
      break;
    case "dominant_leader":
      contextElements.push("Leader has significant margin");
      contextElements.push("Focus analysis on battles for other positions");
      break;
    default:
      contextElements.push("Standard competitive field");
  }

  // Shakeups - factual
  if (hasShakeup) {
    contextElements.push("Position change(s) occurred today - note who moved and by how much");
  }

  // Position battles - factual
  if (positionBattleCount > 3) {
    contextElements.push(`${positionBattleCount} corps within 0.2 of the position ahead`);
  } else if (positionBattleCount > 0) {
    contextElements.push(`${positionBattleCount} close position battle(s) in the standings`);
  }

  // Article-specific notes
  if (articleType === "underdog_story") {
    contextElements.push("Focus on score improvement and specific caption gains");
  } else if (articleType === "corps_spotlight") {
    contextElements.push("Analyze their specific caption scores and trends");
  } else if (articleType === "deep_analytics") {
    contextElements.push("Lead with data, explain what the numbers show");
  }

  // Build the guidance string - focused on FACTS not FEELINGS
  return `
CONTEXT FOR THIS ARTICLE:
• Season Phase: ${seasonPhase}
• Competition Status: ${scenario.replace(/_/g, " ")}
${hasShakeup ? "• Notable: Position changes today\n" : ""}
Key Points to Address:
${contextElements.map(t => `• ${t}`).join("\n")}

TONE REMINDER: Write like a knowledgeable sports reporter, not a hype announcer. State facts clearly. Let the numbers speak.`;
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

    // Article 5: FANTASY RECAP - DCI Caption Stock Market Analysis for fantasy directors
    const fantasyRecapArticle = await generateFantasyRecapArticle({
      reportDay, dayScores, trendData, showContext, competitionContext, db
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

  const prompt = `You are a DCI.org staff writer covering tonight's competitions. Write in the authentic DCI.org editorial voice - professional sports journalism with deep knowledge of the marching arts activity.

═══════════════════════════════════════════════════════════════
DCI.ORG WRITING STYLE GUIDE
═══════════════════════════════════════════════════════════════
STUDY THESE REAL DCI.ORG EXAMPLES:
- "Boom." (punchy one-word opener)
- "INDIANAPOLIS — A mere 0.175-point gap separates first and second."
- "After trailing by 0.175 points Thursday, Bluecoats gained a lead of 0.188 points Friday."
- "Less than half a point separated The Cavaliers, Blue Stars, and Troopers — three corps who have been neck-and-neck throughout the season."

HEADLINES: Specific, action-driven (NOT generic drama)
✓ "Bluecoats slide into first as Finals race pulls into focus"
✓ "Boston Crusaders, Bluecoats separated by tenths at Prelims"
✓ "Record-breaking Boston leads loaded field in San Antonio"
✗ AVOID: "Dominant Performance!" "Thrilling Competition!" "Setting the Stage!"

SCORE LANGUAGE: Precise, clinical when needed
- "besting [Corps] by 0.087" / "edging past by three-tenths"
- "0.45 over Crown in Total Visual"
- "earned top marks in Color Guard, Brass, Percussion and Music Analysis"
- "a scant 0.2-point gap" NOT "a razor-thin margin"

CAPTION REFERENCES: Use official terminology
- General Effect (GE) - split into GE1 (Music Effect) and GE2 (Visual Effect)
- Visual: Visual Proficiency (VP), Visual Analysis (VA), Color Guard (CG)
- Music: Brass (B), Music Analysis (MA), Percussion (P)
- "swept every caption except Color Guard" / "took first in three of six captions"

CRITICAL - AVOID THESE OVERUSED PHRASES (the AI loves these, but readers hate them):
- "commanding lead" / "dominant victory" / "stellar performance"
- "setting the stage" / "the stage is set" / "setting the stage ablaze"
- "thrilling finish" / "thrilling season" / "thrilling chapter"
- "tune in tomorrow" / "stay tuned" / "don't miss"
- "the drama is just beginning" / "dynasty in the making"
- "echoes still resonate" / "etching their name in history"
- "proves their mettle" / "proving doubters wrong" / "proving their worth"
- "all eyes on" / "captivating audiences" / "captivated judges and fans alike"
- "a force to be reckoned with" / "formidable contender"
- "testament to" / "testament to the dedication"
- "heating up" / "heats up" / "as the season heats up"
- "mounting a serious challenge" / "emerging as a true contender"
- "within striking distance" / "closing the gap"
- "showcase of" / "battle of wills" / "arena of high-stakes"
- "poured their hearts into" / "leaving spectators on edge"
- "momentum is building" / "final showdown"
- "absolutely crucial" / "critical juncture"
- "maintain their dominance" / "maintain their momentum"
- NEVER start with "BREAKING NEWS" unless someone died
- NEVER use exclamation points in headlines

═══════════════════════════════════════════════════════════════
TODAY'S COMPETITIONS - Day ${reportDay}
═══════════════════════════════════════════════════════════════
Date: ${showContext.date}
${showContext.allShows?.length > 1 ? `
MULTIPLE SHOWS TODAY (${showContext.allShows.length} competitions):
${showContext.allShows.map(s => `• ${s.name} - ${s.location || 'Location TBD'}`).join('\n')}

IMPORTANT: Cover ALL shows in your article. Each show deserves mention.
` : `SINGLE SHOW TODAY:
• ${showContext.showName} - ${showContext.location}`}

═══════════════════════════════════════════════════════════════
COMPLETE RESULTS FROM ALL CORPS PERFORMING TODAY
═══════════════════════════════════════════════════════════════
${dayScores.map((s, i) => {
  const trend = trendData[s.corps];
  const change = trend?.dayChange || 0;
  const marginToNext = i > 0 ? (dayScores[i-1].total - s.total).toFixed(3) : "-";
  return `${i + 1}. ${s.corps} - ${s.total.toFixed(3)} (${change >= 0 ? '+' : ''}${change.toFixed(3)} from yesterday)${i > 0 ? ` [${marginToNext} behind]` : ' [LEADER]'}
   GE: ${s.subtotals?.ge?.toFixed(2) || 'N/A'} | Visual: ${s.subtotals?.visual?.toFixed(2) || 'N/A'} | Music: ${s.subtotals?.music?.toFixed(2) || 'N/A'}`;
}).join('\n')}

CAPTION WINNERS:
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

KEY DATA POINTS:
- Lead margin: ${topCorps?.corps} leads by ${gap} over ${secondCorps?.corps}
- Top 3 spread: ${top3Gap} points separate first from third
- Position battles: ${competitionContext.positionBattleCount} corps within 0.2 of position ahead
${(() => {
  const surging = Object.entries(trendData).filter(([_, t]) => t.dayChange > 0.3);
  const struggling = Object.entries(trendData).filter(([_, t]) => t.dayChange < -0.3);
  const lines = [];
  if (surging.length > 0) lines.push(`- Biggest gains: ${surging.map(([c, t]) => `${c} (+${t.dayChange.toFixed(3)})`).join(', ')}`);
  if (struggling.length > 0) lines.push(`- Score drops: ${struggling.map(([c, t]) => `${c} (${t.dayChange.toFixed(3)})`).join(', ')}`);
  return lines.join('\n');
})()}

${toneGuidance}

═══════════════════════════════════════════════════════════════
ARTICLE REQUIREMENTS
═══════════════════════════════════════════════════════════════
1. HEADLINE: Specific and factual (NOT generic hype)
   ✓ "${topCorps?.corps} tops ${topCorps?.total?.toFixed(2)} at ${showContext.showName}"
   ✓ "Less than ${gap} separates top two at ${showContext.showName}"
   ✗ AVOID: Exclamation points, "dominates", "stunning", "incredible"

2. SUMMARY: 2-3 factual sentences. State the winner, exact margin, and ONE specific storyline.

3. NARRATIVE: 600-900 word article. THIS IS CRITICAL - COVER ALL CORPS:

   OPENING: Punchy fact-based lead
   - Dateline format: "${showContext.location?.split(',')[0]?.toUpperCase() || 'OMAHA'} — ${topCorps?.corps} leads by ${gap}."

   PARAGRAPH 2: Winner ${topCorps?.corps}
   - Their score, which captions they won, margin over 2nd place

   PARAGRAPH 3: Second place ${secondCorps?.corps}
   - How close are they? Which captions did they win?

   PARAGRAPH 4: Third through sixth place battle
   - Name each corps, their score, and who they're battling

   PARAGRAPH 5: Seventh through tenth (or lower)
   - Don't ignore them! Name each corps and their position

   PARAGRAPH 6: Rest of field (if more corps competed)
   - Brief mention of all remaining corps

   PARAGRAPH 7: Day-over-day changes
   - Who improved most? Who dropped? Specific numbers.

   PARAGRAPH 8: Tomorrow's preview
   - Be specific about matchups, not generic "tune in!"

   ${showContext.allShows?.length > 1 ? `
   MULTI-SHOW REQUIREMENT: You MUST mention all ${showContext.allShows.length} shows by name.
   ` : ''}

Write like a veteran beat reporter - factual, comprehensive, covering the ENTIRE field.

═══════════════════════════════════════════════════════════════
STRICT REQUIREMENTS - YOUR ARTICLE WILL BE REJECTED IF:
═══════════════════════════════════════════════════════════════
1. The narrative is under 500 words (MUST be 600-800 words)
2. You only mention 2-3 corps (MUST mention ALL corps by name)
3. You use ANY of these banned words: dominant, commanding, heating up, besting, stunning, thrilling, incredible, captivating, testament, mettle
4. You end with generic phrases like "tune in tomorrow" or "stay tuned"
5. The headline contains exclamation points
6. You repeat the summary as the narrative

The narrative MUST be a complete 8-paragraph article. Not a summary.`;


  // Schema for structured output
  const schema = {
    type: Type.OBJECT,
    properties: {
      headline: { type: Type.STRING, description: "Factual headline with winner and score, NO exclamation points, NO 'dominates' or 'stunning'" },
      summary: { type: Type.STRING, description: "Exactly 2-3 sentences: winner name, exact score, margin over second place" },
      narrative: { type: Type.STRING, description: "FULL 600-800 word article with 8 paragraphs covering ALL corps. Must include: dateline opener, winner analysis, 2nd place, 3rd-6th place battle, 7th-10th, rest of field, day-over-day changes, tomorrow preview. NEVER use 'dominant', 'commanding', 'heating up', 'besting'" },
      standings: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            rank: { type: Type.INTEGER },
            corps: { type: Type.STRING },
            year: { type: Type.INTEGER },
            total: { type: Type.NUMBER },
            change: { type: Type.NUMBER },
            momentum: { type: Type.STRING, enum: ["rising", "falling", "steady"] },
          },
          required: ["rank", "corps", "year", "total", "change", "momentum"],
        },
      },
      scoreBreakdown: {
        type: Type.OBJECT,
        description: "Caption score breakdown for top corps",
        properties: {
          geWinner: { type: Type.STRING, description: "Corps that won GE caption" },
          geScore: { type: Type.NUMBER, description: "Winning GE score" },
          visualWinner: { type: Type.STRING, description: "Corps that won Visual caption" },
          visualScore: { type: Type.NUMBER, description: "Winning Visual score" },
          musicWinner: { type: Type.STRING, description: "Corps that won Music caption" },
          musicScore: { type: Type.NUMBER, description: "Winning Music score" },
        },
        required: ["geWinner", "geScore", "visualWinner", "visualScore", "musicWinner", "musicScore"],
      },
    },
    required: ["headline", "summary", "narrative", "standings", "scoreBreakdown"],
  };

  try {
    const content = await generateStructuredContent(prompt, schema);

    // Look up the corps' show title and uniform details from Firestore
    const showTitle = db ? await getShowTitleFromFirestore(db, topCorps.corps, topCorps.sourceYear) : null;
    const uniformDetails = db ? await getUniformDetailsFromFirestore(db, topCorps.corps, topCorps.sourceYear) : null;

    // Generate image featuring top corps with accurate historical uniform
    const imagePrompt = buildStandingsImagePrompt(
      topCorps.corps,
      topCorps.sourceYear,
      showContext.location,
      showContext.showName,
      showTitle,
      uniformDetails
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

  // Get show title and uniform details for this corps from Firestore
  const showTitle = db ? await getShowTitleFromFirestore(db, featureCorps.corps, featureCorps.sourceYear) : null;
  const uniformDetails = db ? await getUniformDetailsFromFirestore(db, featureCorps.corps, featureCorps.sourceYear) : null;

  // Calculate season progress data
  const seasonHigh = corpsTrend.seasonHigh || featureCorps.total;
  const seasonLow = corpsTrend.seasonLow || featureCorps.total;
  const improvement = corpsTrend.totalImprovement || 0;

  // Build show-by-show history for the last 5 shows
  const recentShowHistory = corpsTrend.recentScores || [];
  const showHistoryText = recentShowHistory
    .filter(s => s.total >= 60) // Ignore scores under 60
    .slice(-5)
    .map((s, i, arr) => {
      const prevScore = i > 0 ? arr[i-1].total : null;
      const change = prevScore ? (s.total - prevScore) : 0;
      const changeStr = prevScore ? ` (${change >= 0 ? '+' : ''}${change.toFixed(3)})` : '';
      return `Day ${s.day}: ${s.total.toFixed(3)}${changeStr}${s.showName ? ` at ${s.showName}` : ''}${s.location ? `, ${s.location}` : ''}
   GE: ${s.subtotals?.ge?.toFixed(2) || 'N/A'} | Visual: ${s.subtotals?.visual?.toFixed(2) || 'N/A'} | Music: ${s.subtotals?.music?.toFixed(2) || 'N/A'}`;
    }).join('\n') || 'Limited show history available';

  // Build caption trajectory analysis
  const captionTrajectory = {
    ge: corpsTrend.captionHistory?.ge || [],
    visual: corpsTrend.captionHistory?.visual || [],
    music: corpsTrend.captionHistory?.music || [],
  };

  const prompt = `You are a DCI.org feature writer profiling a corps' season journey. Focus on TOTAL SCORES and CAPTION SCORES across the ENTIRE SEASON. Document the show-by-show journey with specific numbers.

═══════════════════════════════════════════════════════════════
DCI.ORG CORPS FEATURE STYLE GUIDE
═══════════════════════════════════════════════════════════════
THIS ARTICLE IS ABOUT THE NUMBERS. It should be a "must read" for anyone wanting to understand this corps' season.

YOUR MISSION: Tell the story of ${featureCorps.corps}'s season through their scores.
- What were their struggles? (score drops, caption weaknesses)
- What were their triumphs? (score improvements, caption wins)
- What trajectory are they on? (improving, plateauing, declining)
- What should a fantasy director know about where they might score next?

HEADLINES: Specific, number-focused
✓ "${featureCorps.corps}'s Visual climbs 1.2 points over last 4 shows"
✓ "${featureCorps.corps} holds ${currentRank}${currentRank === 1 ? 'st' : currentRank === 2 ? 'nd' : currentRank === 3 ? 'rd' : 'th'} with ${featureCorps.total.toFixed(3)} - GE remains weakness"
✗ AVOID: "Corps Name: A Journey of Excellence" or generic praise headlines

CRITICAL - AVOID THESE CLICHÉS:
- "identity forged in" / "legacy of excellence" / "storied history"
- "tradition of" / "long been celebrated for" / "known for their"
- "proving doubters wrong" / "making a statement" / "force to be reckoned with"
- "passion and dedication" / "testament to" / "pushing the boundaries"
- "compelling visual storytelling" / "captivating experience" / "emotionally resonant"
- Generic history paragraphs - NO HISTORY, only THIS season's data

DATA QUALITY RULES:
- IGNORE total scores under 60 (these are incomplete/invalid)
- IGNORE caption scores of 0 (missing data)
- Only analyze valid, complete scores

═══════════════════════════════════════════════════════════════
FEATURED CORPS: ${featureCorps.corps}
═══════════════════════════════════════════════════════════════
Season: ${featureCorps.sourceYear}
${showTitle ? `Show Title: "${showTitle}"` : ''}
Current Standing: ${currentRank}${currentRank === 1 ? 'st' : currentRank === 2 ? 'nd' : currentRank === 3 ? 'rd' : 'th'} place
Today's Score: ${featureCorps.total.toFixed(3)}
Daily Change: ${corpsTrend.dayChange >= 0 ? '+' : ''}${corpsTrend.dayChange.toFixed(3)}

═══════════════════════════════════════════════════════════════
SHOW-BY-SHOW JOURNEY (Last 5 performances with valid scores):
═══════════════════════════════════════════════════════════════
${showHistoryText}

═══════════════════════════════════════════════════════════════
SEASON TOTALS & TRAJECTORY
═══════════════════════════════════════════════════════════════
• Season High: ${seasonHigh.toFixed(3)}
• Season Low: ${seasonLow >= 60 ? seasonLow.toFixed(3) : 'N/A (early season)'}
• 7-Day Average: ${corpsTrend.avgTotal?.toFixed(3) || featureCorps.total.toFixed(3)}
• Total Improvement Since Start: ${improvement >= 0 ? '+' : ''}${improvement.toFixed(3)}
• Momentum: ${corpsTrend.momentum || 'steady'}
${corpsTrend.atSeasonBest ? '★ AT SEASON HIGH TODAY' : ''}

═══════════════════════════════════════════════════════════════
TODAY'S CAPTION BREAKDOWN (with rankings vs field)
═══════════════════════════════════════════════════════════════
GENERAL EFFECT: ${featureCorps.subtotals?.ge?.toFixed(2) || 'N/A'} ${corpsTrend.captionTrends?.ge?.trending === "up" ? "↑" : corpsTrend.captionTrends?.ge?.trending === "down" ? "↓" : "→"}
  - GE1 (Music Effect): ${featureCorps.captions?.GE1?.toFixed(2) || 'N/A'}
  - GE2 (Visual Effect): ${featureCorps.captions?.GE2?.toFixed(2) || 'N/A'}

VISUAL: ${featureCorps.subtotals?.visual?.toFixed(2) || 'N/A'} ${corpsTrend.captionTrends?.visual?.trending === "up" ? "↑" : corpsTrend.captionTrends?.visual?.trending === "down" ? "↓" : "→"}
  - Visual Proficiency: ${featureCorps.captions?.VP?.toFixed(2) || 'N/A'}
  - Visual Analysis: ${featureCorps.captions?.VA?.toFixed(2) || 'N/A'}
  - Color Guard: ${featureCorps.captions?.CG?.toFixed(2) || 'N/A'}

MUSIC: ${featureCorps.subtotals?.music?.toFixed(2) || 'N/A'} ${corpsTrend.captionTrends?.music?.trending === "up" ? "↑" : corpsTrend.captionTrends?.music?.trending === "down" ? "↓" : "→"}
  - Brass: ${featureCorps.captions?.B?.toFixed(2) || 'N/A'}
  - Music Analysis: ${featureCorps.captions?.MA?.toFixed(2) || 'N/A'}
  - Percussion: ${featureCorps.captions?.P?.toFixed(2) || 'N/A'}

═══════════════════════════════════════════════════════════════
COMPETITIVE CONTEXT (Corps they're battling)
═══════════════════════════════════════════════════════════════
${dayScores.slice(Math.max(0, currentRank - 3), Math.min(dayScores.length, currentRank + 4)).map((s, i) => {
  const rank = Math.max(0, currentRank - 3) + i + 1;
  const gap = s.total - featureCorps.total;
  return `${rank}. ${s.corps}: ${s.total.toFixed(3)}${s.corps === featureCorps.corps ? ' ← FEATURED' : ` (${gap >= 0 ? '+' : ''}${gap.toFixed(3)})`}`;
}).join('\n')}

${toneGuidance}

═══════════════════════════════════════════════════════════════
WRITE A SEASON JOURNEY ARTICLE
═══════════════════════════════════════════════════════════════
1. HEADLINE: Include a specific number and trend
   ✓ "${featureCorps.corps} gains ${Math.abs(improvement).toFixed(2)} points - Visual caption leads the climb"
   ✓ "${featureCorps.corps} at ${currentRank}${currentRank === 1 ? 'st' : currentRank === 2 ? 'nd' : currentRank === 3 ? 'rd' : 'th'}: GE score of ${featureCorps.subtotals?.ge?.toFixed(2) || 'N/A'} keeps them in contention"

2. SUMMARY: 2-3 factual sentences with their score, rank, and key caption insight.

3. NARRATIVE: 700-900 word analytical season profile:

   PARAGRAPH 1: Current position and score
   - Where do they stand? What's their score? How far from the corps above/below?

   PARAGRAPH 2: Show-by-show journey
   - Walk through their last 4-5 shows with SPECIFIC SCORES at each
   - Note the locations where they performed
   - Highlight the biggest jumps or drops

   PARAGRAPH 3: Caption analysis - STRENGTHS
   - Which captions are they strongest in? Use specific scores.
   - How do those captions compare to corps around them?

   PARAGRAPH 4: Caption analysis - WEAKNESSES
   - Which captions are holding them back? Use specific scores.
   - How much are they losing in those captions vs competitors?

   PARAGRAPH 5: Trajectory analysis
   - Are they improving, steady, or declining?
   - What's the trend over the last 3-4 shows?

   PARAGRAPH 6: Fantasy outlook (IMPORTANT for readers)
   - Based on trends, where might they score in upcoming shows?
   - Are they a "buy" (improving), "hold" (steady), or "sell" (declining)?
   - Which specific captions should fantasy directors target?
   - DO NOT predict exact future scores - only analyze visible trends

Write like a sports statistician who loves the numbers. Every paragraph needs specific scores.

═══════════════════════════════════════════════════════════════
STRICT REQUIREMENTS - YOUR ARTICLE WILL BE REJECTED IF:
═══════════════════════════════════════════════════════════════
1. The narrative is under 600 words (MUST be 700-900 words)
2. You don't include specific scores from their show-by-show journey
3. You don't analyze at least 3 individual captions with numbers
4. You use ANY banned words: dominant, commanding, stunning, thrilling, incredible, testament, mettle, captivating
5. You don't include a clear buy/hold/sell recommendation
6. You repeat the summary as the narrative`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      headline: { type: Type.STRING, description: "Corps name with specific number and trend direction, NO 'dominates' or exclamation points" },
      summary: { type: Type.STRING, description: "Exactly 2-3 sentences: corps name, current score, rank, and one specific caption insight" },
      narrative: { type: Type.STRING, description: "FULL 700-900 word analytical profile with 6 paragraphs: current position, show-by-show journey with SPECIFIC SCORES, caption strengths, caption weaknesses, trajectory, buy/hold/sell recommendation. NEVER use 'dominant', 'commanding', 'stunning'" },
      corpsIdentity: {
        type: Type.OBJECT,
        properties: {
          tradition: { type: Type.STRING, description: "Corps' historical identity" },
          strength: { type: Type.STRING, description: "Primary competitive strength" },
          trajectory: { type: Type.STRING, description: "Season trajectory assessment" },
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
      showTitle,
      uniformDetails
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

  // Build comprehensive corps data for the entire field
  const allCorpsTrends = dayScores.map(corps => {
    const trend = trendData[corps.corps] || {};
    return {
      corps: corps.corps,
      total: corps.total,
      ge: corps.subtotals?.ge,
      visual: corps.subtotals?.visual,
      music: corps.subtotals?.music,
      momentum: trend.momentum || 'steady',
      dayChange: trend.dayChange || 0,
      geTrend: trend.captionTrends?.ge?.trending || 'stable',
      visualTrend: trend.captionTrends?.visual?.trending || 'stable',
      musicTrend: trend.captionTrends?.music?.trending || 'stable',
    };
  });

  const prompt = `You are a DCI.org recap analyst writing the DEFINITIVE weekly caption analysis. This article should be a "must read" for ANYONE wanting to understand DCI scores - not just fantasy players, but any drum corps fan who wants to dive deep into the numbers.

═══════════════════════════════════════════════════════════════
YOUR MISSION: THE BEST DCI SCORE ANALYSIS AVAILABLE
═══════════════════════════════════════════════════════════════
This article should answer:
- Who's leading each caption and by how much?
- Who's improving and who's declining in each caption?
- What do the numbers tell us about potential future results?
- Which corps should fantasy directors BUY, HOLD, or SELL?

Cover ALL corps, ALL captions, and provide data-driven insights that help readers understand the competitive landscape.

CRITICAL - AVOID THESE CLICHÉS:
- "battle for supremacy" / "race heats up" / "heating up"
- "stakes are high" / "every point matters" / "absolutely crucial"
- "thrilling" / "exciting" / "dramatic" / "intense"
- "setting the stage" / "poised to" / "poised for success"
- "the corps that can master" / "will have a significant advantage"

═══════════════════════════════════════════════════════════════
COMPLETE CAPTION DATA - ALL ${dayScores.length} CORPS
═══════════════════════════════════════════════════════════════
Week: Days ${reportDay - 6} through ${reportDay}
Date: ${showContext.date}

GENERAL EFFECT RANKINGS (40% of total score):
${geSorted.map((s, i) => {
  const trend = trendData[s.corps]?.captionTrends?.ge;
  const margin = i > 0 ? (geSorted[i-1].subtotals?.ge - s.subtotals?.ge).toFixed(2) : '-';
  return `${i + 1}. ${s.corps}: ${s.subtotals?.ge?.toFixed(2)} [GE1: ${s.captions?.GE1?.toFixed(2)}, GE2: ${s.captions?.GE2?.toFixed(2)}] ${trend?.trending === "up" ? "↑" : trend?.trending === "down" ? "↓" : "→"} (${margin} behind)`;
}).join('\n')}

VISUAL RANKINGS (30% of total score):
${visualSorted.map((s, i) => {
  const trend = trendData[s.corps]?.captionTrends?.visual;
  const margin = i > 0 ? (visualSorted[i-1].subtotals?.visual - s.subtotals?.visual).toFixed(2) : '-';
  return `${i + 1}. ${s.corps}: ${s.subtotals?.visual?.toFixed(2)} [VP: ${s.captions?.VP?.toFixed(2)}, VA: ${s.captions?.VA?.toFixed(2)}, CG: ${s.captions?.CG?.toFixed(2)}] ${trend?.trending === "up" ? "↑" : trend?.trending === "down" ? "↓" : "→"} (${margin} behind)`;
}).join('\n')}

MUSIC RANKINGS (30% of total score):
${musicSorted.map((s, i) => {
  const trend = trendData[s.corps]?.captionTrends?.music;
  const margin = i > 0 ? (musicSorted[i-1].subtotals?.music - s.subtotals?.music).toFixed(2) : '-';
  return `${i + 1}. ${s.corps}: ${s.subtotals?.music?.toFixed(2)} [B: ${s.captions?.B?.toFixed(2)}, MA: ${s.captions?.MA?.toFixed(2)}, P: ${s.captions?.P?.toFixed(2)}] ${trend?.trending === "up" ? "↑" : trend?.trending === "down" ? "↓" : "→"} (${margin} behind)`;
}).join('\n')}

═══════════════════════════════════════════════════════════════
TRAJECTORY ANALYSIS - MOMENTUM BY CORPS
═══════════════════════════════════════════════════════════════
${Object.entries(trendData).map(([corps, trend]) => {
  return `${corps}: ${trend.momentum || 'steady'} | Day change: ${trend.dayChange >= 0 ? '+' : ''}${trend.dayChange?.toFixed(3) || 'N/A'} | GE: ${trend.captionTrends?.ge?.trending || 'stable'} | Visual: ${trend.captionTrends?.visual?.trending || 'stable'} | Music: ${trend.captionTrends?.music?.trending || 'stable'}`;
}).join('\n')}

═══════════════════════════════════════════════════════════════
SUBCAPTION DEEP DIVE
═══════════════════════════════════════════════════════════════
GE1 (Music Effect) Leader: ${[...dayScores].sort((a, b) => (b.captions?.GE1 || 0) - (a.captions?.GE1 || 0))[0]?.corps} (${[...dayScores].sort((a, b) => (b.captions?.GE1 || 0) - (a.captions?.GE1 || 0))[0]?.captions?.GE1?.toFixed(2)})
GE2 (Visual Effect) Leader: ${[...dayScores].sort((a, b) => (b.captions?.GE2 || 0) - (a.captions?.GE2 || 0))[0]?.corps} (${[...dayScores].sort((a, b) => (b.captions?.GE2 || 0) - (a.captions?.GE2 || 0))[0]?.captions?.GE2?.toFixed(2)})
Visual Proficiency Leader: ${[...dayScores].sort((a, b) => (b.captions?.VP || 0) - (a.captions?.VP || 0))[0]?.corps} (${[...dayScores].sort((a, b) => (b.captions?.VP || 0) - (a.captions?.VP || 0))[0]?.captions?.VP?.toFixed(2)})
Visual Analysis Leader: ${[...dayScores].sort((a, b) => (b.captions?.VA || 0) - (a.captions?.VA || 0))[0]?.corps} (${[...dayScores].sort((a, b) => (b.captions?.VA || 0) - (a.captions?.VA || 0))[0]?.captions?.VA?.toFixed(2)})
Color Guard Leader: ${[...dayScores].sort((a, b) => (b.captions?.CG || 0) - (a.captions?.CG || 0))[0]?.corps} (${[...dayScores].sort((a, b) => (b.captions?.CG || 0) - (a.captions?.CG || 0))[0]?.captions?.CG?.toFixed(2)})
Brass Leader: ${[...dayScores].sort((a, b) => (b.captions?.B || 0) - (a.captions?.B || 0))[0]?.corps} (${[...dayScores].sort((a, b) => (b.captions?.B || 0) - (a.captions?.B || 0))[0]?.captions?.B?.toFixed(2)})
Music Analysis Leader: ${[...dayScores].sort((a, b) => (b.captions?.MA || 0) - (a.captions?.MA || 0))[0]?.corps} (${[...dayScores].sort((a, b) => (b.captions?.MA || 0) - (a.captions?.MA || 0))[0]?.captions?.MA?.toFixed(2)})
Percussion Leader: ${[...dayScores].sort((a, b) => (b.captions?.P || 0) - (a.captions?.P || 0))[0]?.corps} (${[...dayScores].sort((a, b) => (b.captions?.P || 0) - (a.captions?.P || 0))[0]?.captions?.P?.toFixed(2)})

${toneGuidance}

═══════════════════════════════════════════════════════════════
ARTICLE REQUIREMENTS
═══════════════════════════════════════════════════════════════
1. HEADLINE: Technical, number-focused
   ✓ "Recap Analysis: ${geSorted[0]?.corps} leads GE by ${((geSorted[0]?.subtotals?.ge || 0) - (geSorted[1]?.subtotals?.ge || 0)).toFixed(2)} as Visual tightens"
   ✗ AVOID: "battle narrows" / "heats up" / "intensifies"

2. SUMMARY: 2-3 factual sentences with key caption insights.

3. NARRATIVE: 900-1200 word comprehensive analysis (THIS MUST BE THOROUGH):

   **GENERAL EFFECT** (~250 words)
   - Who leads? ${geSorted[0]?.corps} at ${geSorted[0]?.subtotals?.ge?.toFixed(2)}
   - Gap to second: ${((geSorted[0]?.subtotals?.ge || 0) - (geSorted[1]?.subtotals?.ge || 0)).toFixed(2)}
   - Analyze GE1 vs GE2 - where is the gap coming from?
   - Which corps are trending UP in GE? DOWN?
   - Cover at least 5 corps in this section

   **VISUAL** (~250 words)
   - Who leads? ${visualSorted[0]?.corps} at ${visualSorted[0]?.subtotals?.visual?.toFixed(2)}
   - Break down VP, VA, CG leaders
   - Which subcaption is the tightest race?
   - Who's improving? Who's struggling?
   - Cover at least 5 corps in this section

   **MUSIC** (~250 words)
   - Who leads? ${musicSorted[0]?.corps} at ${musicSorted[0]?.subtotals?.music?.toFixed(2)}
   - Break down Brass, MA, Percussion leaders
   - Which corps have the strongest brass? Percussion?
   - Who's improving? Who's struggling?
   - Cover at least 5 corps in this section

   **TRAJECTORY & FUTURE OUTLOOK** (~200 words)
   - Based on trends, who is likely to improve?
   - Who appears to be plateauing?
   - What caption improvements could shift standings?
   - Provide SPECIFIC point gaps that need to close

   **FANTASY RECOMMENDATIONS** (~150 words)
   - BUY: 2-3 corps with evidence (which captions to target)
   - HOLD: 2-3 corps with evidence
   - SELL: 1-2 corps with evidence
   - Be specific about WHICH CAPTIONS to pick

Write like the lead DCI score analyst - comprehensive, authoritative, essential reading.

═══════════════════════════════════════════════════════════════
STRICT REQUIREMENTS - YOUR ARTICLE WILL BE REJECTED IF:
═══════════════════════════════════════════════════════════════
1. The narrative is under 800 words (MUST be 900-1200 words)
2. You don't cover at least 5 corps in each caption section (GE, Visual, Music)
3. You don't include specific point gaps and margins
4. You use ANY banned words: dominant, commanding, stunning, thrilling, heating up, captivating, testament
5. You don't include clear buy/hold/sell recommendations with evidence
6. You repeat the summary as the narrative`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      headline: { type: Type.STRING, description: "Technical headline with specific numbers and caption focus, NO 'heats up' or 'battle intensifies'" },
      summary: { type: Type.STRING, description: "Exactly 2-3 sentences with specific caption gaps and key insight" },
      narrative: { type: Type.STRING, description: "FULL 900-1200 word comprehensive analysis with 5 sections: GE analysis (250 words, 5+ corps), Visual analysis (250 words, 5+ corps), Music analysis (250 words, 5+ corps), Trajectory outlook (200 words), Fantasy buy/hold/sell (150 words). NEVER use 'dominant', 'heating up', 'captivating'" },
      captionBreakdown: {
        type: Type.OBJECT,
        properties: {
          geAnalysis: { type: Type.STRING, description: "General Effect analysis" },
          visualAnalysis: { type: Type.STRING, description: "Visual caption analysis" },
          musicAnalysis: { type: Type.STRING, description: "Music caption analysis" },
        },
        required: ["geAnalysis", "visualAnalysis", "musicAnalysis"],
      },
      recommendations: {
        type: Type.ARRAY,
        description: "Fantasy trade recommendations based on corps trends",
        items: {
          type: Type.OBJECT,
          properties: {
            corps: { type: Type.STRING, description: "Corps name" },
            action: { type: Type.STRING, enum: ["buy", "hold", "sell"], description: "Recommended action" },
            reasoning: { type: Type.STRING, description: "Why this corps is trending this way based on caption performance" },
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
    const uniformDetails = db ? await getUniformDetailsFromFirestore(db, featuredCorps.corps, featuredCorps.sourceYear) : null;

    const imagePrompt = buildCaptionsImagePrompt(
      featuredCorps.corps,
      featuredCorps.sourceYear,
      "General Effect",
      showContext.location,
      showTitle,
      uniformDetails
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

  // Separate competitive and SoundSport results
  const competitiveResults = allResults.filter(r => r.corpsClass !== 'soundSport');
  const soundSportResults = allResults
    .filter(r => r.corpsClass === 'soundSport')
    .sort((a, b) => b.totalScore - a.totalScore);

  // Get TOP 25 performers
  const topPerformers = competitiveResults
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 25);

  const avgScore = topPerformers.length > 0
    ? (topPerformers.reduce((sum, p) => sum + p.totalScore, 0) / topPerformers.length).toFixed(3)
    : "0.000";
  const topScore = topPerformers[0]?.totalScore?.toFixed(3) || "0.000";

  // SoundSport ratings based on scoring guidelines (NOT competitive scores)
  // SoundSport uses a rating system: Gold, Silver, Bronze, Participation
  // Scores are NEVER revealed - only the rating level
  // "Best in Show" is the highest scoring ensemble, NOT a rating level
  const getSoundSportRating = (score) => {
    if (!score || score <= 0) return null;
    // Thresholds based on SoundSport adjudication guidelines (from SoundSportTab.jsx)
    if (score >= 85) return "Gold";
    if (score >= 75) return "Silver";
    if (score >= 65) return "Bronze";
    return "Participation";
  };

  // Find "Best in Show" - the highest scoring SoundSport ensemble at this competition
  const soundSportBestInShow = soundSportResults.length > 0
    ? soundSportResults.reduce((best, current) =>
        (current.totalScore > (best?.totalScore || 0)) ? current : best, null)
    : null;

  // Categorize SoundSport results by rating (NO SCORES - only ratings)
  const soundSportByRating = {
    gold: soundSportResults.filter(r => getSoundSportRating(r.totalScore) === "Gold"),
    silver: soundSportResults.filter(r => getSoundSportRating(r.totalScore) === "Silver"),
    bronze: soundSportResults.filter(r => getSoundSportRating(r.totalScore) === "Bronze"),
    participation: soundSportResults.filter(r => getSoundSportRating(r.totalScore) === "Participation"),
  };

  const fantasyShowName = formatFantasyEventName(showContext.showName);

  const prompt = `You are a marching.art fantasy sports journalist. This article is your chance to make fantasy drum corps feel REAL and EXCITING through creative storytelling, fictitious quotes, and engaging narratives.

═══════════════════════════════════════════════════════════════
FANTASY SPORTS JOURNALISM - DAY ${reportDay}
═══════════════════════════════════════════════════════════════
IMPORTANT: These are FANTASY ensembles with FANTASY directors. Unlike DCI articles which must be factual, you CAN and SHOULD:
- Create fictitious quotes from fantasy directors
- Invent storylines and rivalries between fantasy ensembles
- Give personality to the fantasy competition
- Make it feel like a real sports broadcast

This is what makes fantasy sports fun - the narrative!

Date: ${showContext.date}
Competition: ${fantasyShowName}

═══════════════════════════════════════════════════════════════
TOP 25 FANTASY ENSEMBLES (complete results)
═══════════════════════════════════════════════════════════════
${topPerformers.map((r, i) => {
  const margin = i > 0 ? (topPerformers[i-1].totalScore - r.totalScore).toFixed(3) : "-";
  return `${i + 1}. "${r.corpsName}" (Director: ${r.displayName || 'Unknown'}) - ${r.totalScore.toFixed(3)} pts${i > 0 ? ` [${margin} behind]` : ' [WINNER]'}
   From: ${r.location || 'Unknown location'}`;
}).join('\n')}

${soundSportResults.length > 0 ? `
═══════════════════════════════════════════════════════════════
🎵 SOUNDSPORT RATINGS (Non-competitive adjudication)
═══════════════════════════════════════════════════════════════
IMPORTANT: SoundSport is NOT a competition - it's a ratings-based showcase.
Ensembles earn ratings (Gold, Silver, Bronze, Participation) based on their
performance quality, NOT competitive placement. DO NOT reveal scores.
"Best in Show" is awarded to the highest-scoring ensemble.

${soundSportBestInShow ? `⭐ BEST IN SHOW:
• "${soundSportBestInShow.corpsName}" (Director: ${soundSportBestInShow.displayName || 'Unknown'}) - From ${soundSportBestInShow.location || 'Unknown'}
` : ''}
${soundSportByRating.gold.length > 0 ? `🥇 GOLD RATING (${soundSportByRating.gold.length}):
${soundSportByRating.gold.map(r => `• "${r.corpsName}" (Director: ${r.displayName || 'Unknown'}) - From ${r.location || 'Unknown'}`).join('\n')}
` : ''}
${soundSportByRating.silver.length > 0 ? `🥈 SILVER RATING (${soundSportByRating.silver.length}):
${soundSportByRating.silver.map(r => `• "${r.corpsName}" (Director: ${r.displayName || 'Unknown'}) - From ${r.location || 'Unknown'}`).join('\n')}
` : ''}
${soundSportByRating.bronze.length > 0 ? `🥉 BRONZE RATING (${soundSportByRating.bronze.length}):
${soundSportByRating.bronze.map(r => `• "${r.corpsName}" (Director: ${r.displayName || 'Unknown'}) - From ${r.location || 'Unknown'}`).join('\n')}
` : ''}
${soundSportByRating.participation.length > 0 ? `📋 PARTICIPATION (${soundSportByRating.participation.length}):
${soundSportByRating.participation.map(r => `• "${r.corpsName}" (Director: ${r.displayName || 'Unknown'}) - From ${r.location || 'Unknown'}`).join('\n')}
` : ''}
` : ''}

═══════════════════════════════════════════════════════════════
STATISTICS
═══════════════════════════════════════════════════════════════
• Day ${reportDay} Winner: "${topPerformers[0]?.corpsName}" with ${topScore}
• Margin of Victory: ${topPerformers.length >= 2 ? (topPerformers[0].totalScore - topPerformers[1].totalScore).toFixed(3) : 'N/A'}
• Top 10 Average: ${avgScore}
• Top 25 Average: ${(topPerformers.reduce((sum, r) => sum + r.totalScore, 0) / topPerformers.length).toFixed(3)}
• Total Ensembles: ${competitiveResults.length}
• Score Spread (1st-25th): ${topPerformers.length >= 25 ? (topPerformers[0].totalScore - topPerformers[24].totalScore).toFixed(3) : 'N/A'}
${soundSportResults.length > 0 ? `• SoundSport Ensembles: ${soundSportResults.length} (${soundSportByRating.gold.length} Gold, ${soundSportByRating.silver.length} Silver, ${soundSportByRating.bronze.length} Bronze, ${soundSportByRating.participation.length} Participation)${soundSportBestInShow ? ` - Best in Show: "${soundSportBestInShow.corpsName}"` : ''}` : ''}

${toneGuidance}

═══════════════════════════════════════════════════════════════
CREATIVE WRITING GUIDELINES
═══════════════════════════════════════════════════════════════
CREATE FICTITIOUS QUOTES! Examples:
- "${topPerformers[0]?.displayName || 'Director'}, director of '${topPerformers[0]?.corpsName}', said after the victory: 'We've been working on our GE all week, and it paid off tonight.'"
- "'We knew ${topPerformers[0]?.corpsName} was going to be tough to beat,' admitted ${topPerformers[1]?.displayName || 'Director'} of '${topPerformers[1]?.corpsName}'. 'That 0.${Math.floor(Math.random() * 9)}${Math.floor(Math.random() * 9)} margin is nothing - we'll be back tomorrow.'"
- "A ${topPerformers[2]?.corpsName} section leader (who wished to remain anonymous) quipped: 'Third place today just means we have more room to climb.'"

These quotes make the fantasy competition feel ALIVE. Include 2-4 quotes throughout the article.

CREATE STORYLINES! Examples:
- Rivalry between two ensembles battling for the same position
- A comeback story for an ensemble that dropped but recovered
- The "underdog" rising through the ranks
- The "dynasty" trying to maintain their lead

AVOID THESE CLICHÉS:
- "dominates" / "stunning victory" / "sent shockwaves"
- "proves their mettle" / "showcased their prowess"
- "the drama is just beginning" / "tune in tomorrow"
- NEVER end with "Can [X] maintain their dominance?"

═══════════════════════════════════════════════════════════════
ARTICLE REQUIREMENTS
═══════════════════════════════════════════════════════════════
1. HEADLINE: Include the winner and score
   ✓ "${topPerformers[0]?.corpsName}" wins Day ${reportDay} with ${topScore}
   ✓ ${topPerformers[0]?.displayName || 'Director'}'s "${topPerformers[0]?.corpsName}" takes first at ${topScore}

2. SUMMARY: 2-3 sentences. Winner, score, and one storyline hook.

3. NARRATIVE: 600-800 word article with PERSONALITY:

   OPENING: State the winner with a fictitious quote from the director

   TOP 5 COVERAGE (~150 words):
   - Cover positions 1-5 with scores
   - Include at least 1 fictitious quote
   - Create a storyline (rivalry? comeback?)

   POSITIONS 6-15 (~150 words):
   - Cover the mid-pack battle
   - Who's bunched together? What margins?
   - Include a quote from someone in this range

   POSITIONS 16-25 (~100 words):
   - Don't ignore the rest of the field!
   - Mention notable names and scores

   ${soundSportResults.length > 0 ? `SOUNDSPORT RATINGS HIGHLIGHT (~75 words):
   - SoundSport is NOT competitive - it uses a ratings system
   - "Best in Show" goes to the highest scoring ensemble
   - Celebrate Gold, Silver, Bronze, and Participation ratings
   - NEVER mention scores - only rating levels
   - Include a fictitious quote from a SoundSport director about earning their rating` : ''}

   CLOSING (~100 words):
   - Interesting stat or observation
   - Set up tomorrow's storyline
   - End with energy, not a cliché question

Include at least 3 fictitious quotes throughout. Make it feel like ESPN coverage of fantasy sports!

NEVER reveal specific roster/lineup picks.

═══════════════════════════════════════════════════════════════
STRICT REQUIREMENTS - YOUR ARTICLE WILL BE REJECTED IF:
═══════════════════════════════════════════════════════════════
1. The narrative is under 500 words (MUST be 600-800 words)
2. You don't include at least 3 fictitious quotes
3. You only cover top 5 (MUST cover top 25 positions)
4. You use ANY banned words: dominant, commanding, stunning, heating up, sent shockwaves, proves their mettle
5. You end with "Can [X] maintain...?" or "tune in tomorrow"
6. You repeat the summary as the narrative

The narrative MUST include fictitious quotes from directors. This is FANTASY sports journalism!`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      headline: { type: Type.STRING, description: "Winner name and score, NO exclamation points, NO 'dominates'" },
      summary: { type: Type.STRING, description: "Exactly 2-3 sentences: winner, score, margin to 2nd, one storyline hook" },
      narrative: { type: Type.STRING, description: "FULL 600-800 word fantasy sports article with: opening quote from winner's director, top 5 coverage, positions 6-15, positions 16-25, closing stat. MUST include 3+ fictitious quotes. NEVER use 'dominant', 'commanding', 'stunning', 'heating up'" },
      topPerformers: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            rank: { type: Type.INTEGER },
            corpsName: { type: Type.STRING },
            director: { type: Type.STRING },
            score: { type: Type.NUMBER },
          },
          required: ["rank", "corpsName", "director", "score"],
        },
      },
      scoreBreakdown: {
        type: Type.OBJECT,
        description: "Score breakdown and statistics for today's competition",
        properties: {
          winningScore: { type: Type.NUMBER, description: "Top score of the day" },
          averageScore: { type: Type.NUMBER, description: "Average score among top performers" },
          spreadTop10: { type: Type.NUMBER, description: "Point spread between 1st and 10th" },
          totalEnsembles: { type: Type.INTEGER, description: "Number of ensembles competing" },
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
 * Article 5: DCI Caption Stock Market Analysis
 * Treats individual DCI captions (GE1, GE2, VP, VA, CG, B, MA, P) as stocks for fantasy investment
 * Written like a day trader's market analysis
 */
async function generateFantasyRecapArticle({ reportDay, dayScores, trendData, showContext, competitionContext, db }) {
  const toneGuidance = getToneGuidance(competitionContext, "fantasy_captions");

  // Build individual caption "stock" data for each corps
  const captionStocks = [];

  dayScores.forEach(score => {
    const trend = trendData[score.corps] || {};
    const captionTrends = trend.captionTrends || {};

    // Individual caption scores with trends
    const captions = [
      { name: 'GE1', fullName: 'GE1 (Music Effect)', score: score.captions?.GE1, trend: captionTrends.ge?.trending, weight: '~20%' },
      { name: 'GE2', fullName: 'GE2 (Visual Effect)', score: score.captions?.GE2, trend: captionTrends.ge?.trending, weight: '~20%' },
      { name: 'VP', fullName: 'Visual Proficiency', score: score.captions?.VP, trend: captionTrends.visual?.trending, weight: '~10%' },
      { name: 'VA', fullName: 'Visual Analysis', score: score.captions?.VA, trend: captionTrends.visual?.trending, weight: '~10%' },
      { name: 'CG', fullName: 'Color Guard', score: score.captions?.CG, trend: captionTrends.visual?.trending, weight: '~10%' },
      { name: 'B', fullName: 'Brass', score: score.captions?.B, trend: captionTrends.music?.trending, weight: '~10%' },
      { name: 'MA', fullName: 'Music Analysis', score: score.captions?.MA, trend: captionTrends.music?.trending, weight: '~10%' },
      { name: 'P', fullName: 'Percussion', score: score.captions?.P, trend: captionTrends.music?.trending, weight: '~10%' },
    ];

    captions.forEach(cap => {
      if (cap.score && cap.score > 0) {
        captionStocks.push({
          corps: score.corps,
          caption: cap.name,
          fullName: cap.fullName,
          score: cap.score,
          trend: cap.trend || 'steady',
          weight: cap.weight,
          dayChange: trend.dayChange || 0,
        });
      }
    });
  });

  // Sort by score within each caption type
  const captionTypes = ['GE1', 'GE2', 'VP', 'VA', 'CG', 'B', 'MA', 'P'];
  const stocksByCaption = {};
  captionTypes.forEach(cap => {
    stocksByCaption[cap] = captionStocks
      .filter(s => s.caption === cap)
      .sort((a, b) => b.score - a.score);
  });

  // Find trending stocks
  const trendingUp = captionStocks.filter(s => s.trend === 'up').sort((a, b) => b.score - a.score);
  const trendingDown = captionStocks.filter(s => s.trend === 'down').sort((a, b) => b.score - a.score);
  const steadyPerformers = captionStocks.filter(s => s.trend === 'steady').sort((a, b) => b.score - a.score);

  const prompt = `You are a fantasy drum corps analyst helping directors make smart caption picks. Analyze individual DCI caption performance (GE1, GE2, VP, VA, CG, B, MA, P) and give actionable buy/hold/sell recommendations.

═══════════════════════════════════════════════════════════════
📊 DCI CAPTION TRACKER - DAY ${reportDay}
═══════════════════════════════════════════════════════════════
Fantasy directors pick individual DCI corps captions for their lineups.
Your job: Help them find the best caption picks based on recent trends.

═══════════════════════════════════════════════════════════════
CAPTION BREAKDOWN - ALL 8 CATEGORIES
═══════════════════════════════════════════════════════════════

📊 GE1 (MUSIC EFFECT) - Worth ~20% of total score
${stocksByCaption.GE1?.slice(0, 5).map((s, i) =>
  `${i + 1}. ${s.corps}: ${s.score.toFixed(2)} ${s.trend === 'up' ? '↑' : s.trend === 'down' ? '↓' : '→'}`
).join('\n') || 'No data'}

📊 GE2 (VISUAL EFFECT) - Worth ~20% of total score
${stocksByCaption.GE2?.slice(0, 5).map((s, i) =>
  `${i + 1}. ${s.corps}: ${s.score.toFixed(2)} ${s.trend === 'up' ? '↑' : s.trend === 'down' ? '↓' : '→'}`
).join('\n') || 'No data'}

📊 VP (VISUAL PROFICIENCY) - Worth ~10% of total score
${stocksByCaption.VP?.slice(0, 5).map((s, i) =>
  `${i + 1}. ${s.corps}: ${s.score.toFixed(2)} ${s.trend === 'up' ? '↑' : s.trend === 'down' ? '↓' : '→'}`
).join('\n') || 'No data'}

📊 VA (VISUAL ANALYSIS) - Worth ~10% of total score
${stocksByCaption.VA?.slice(0, 5).map((s, i) =>
  `${i + 1}. ${s.corps}: ${s.score.toFixed(2)} ${s.trend === 'up' ? '↑' : s.trend === 'down' ? '↓' : '→'}`
).join('\n') || 'No data'}

📊 CG (COLOR GUARD) - Worth ~10% of total score
${stocksByCaption.CG?.slice(0, 5).map((s, i) =>
  `${i + 1}. ${s.corps}: ${s.score.toFixed(2)} ${s.trend === 'up' ? '↑' : s.trend === 'down' ? '↓' : '→'}`
).join('\n') || 'No data'}

📊 B (BRASS) - Worth ~10% of total score
${stocksByCaption.B?.slice(0, 5).map((s, i) =>
  `${i + 1}. ${s.corps}: ${s.score.toFixed(2)} ${s.trend === 'up' ? '↑' : s.trend === 'down' ? '↓' : '→'}`
).join('\n') || 'No data'}

📊 MA (MUSIC ANALYSIS) - Worth ~10% of total score
${stocksByCaption.MA?.slice(0, 5).map((s, i) =>
  `${i + 1}. ${s.corps}: ${s.score.toFixed(2)} ${s.trend === 'up' ? '↑' : s.trend === 'down' ? '↓' : '→'}`
).join('\n') || 'No data'}

📊 P (PERCUSSION) - Worth ~10% of total score
${stocksByCaption.P?.slice(0, 5).map((s, i) =>
  `${i + 1}. ${s.corps}: ${s.score.toFixed(2)} ${s.trend === 'up' ? '↑' : s.trend === 'down' ? '↓' : '→'}`
).join('\n') || 'No data'}

═══════════════════════════════════════════════════════════════
📈 TRENDING UP - ${trendingUp.length} captions on the rise
═══════════════════════════════════════════════════════════════
${trendingUp.slice(0, 8).map(s => `↑ ${s.corps} ${s.caption}: ${s.score.toFixed(2)}`).join('\n') || 'None identified'}

═══════════════════════════════════════════════════════════════
📉 TRENDING DOWN - ${trendingDown.length} captions slipping
═══════════════════════════════════════════════════════════════
${trendingDown.slice(0, 8).map(s => `↓ ${s.corps} ${s.caption}: ${s.score.toFixed(2)}`).join('\n') || 'None identified'}

═══════════════════════════════════════════════════════════════
→ HOLDING STEADY - ${steadyPerformers.length} reliable picks
═══════════════════════════════════════════════════════════════
${steadyPerformers.slice(0, 8).map(s => `→ ${s.corps} ${s.caption}: ${s.score.toFixed(2)}`).join('\n') || 'None identified'}

${toneGuidance}

═══════════════════════════════════════════════════════════════
WRITE A FUN, DATA-DRIVEN CAPTION ANALYSIS
═══════════════════════════════════════════════════════════════
Keep it engaging for drum corps fans who love diving into the numbers.
Use ↑↓→ symbols to show trends. Be specific with scores and margins.

1. HEADLINE: Specific caption insight with trend
   ✓ "${stocksByCaption.GE1?.[0]?.corps || 'Bluecoats'} GE1 ↑ climbs to ${stocksByCaption.GE1?.[0]?.score?.toFixed(2) || '17.50'}"
   ✓ "Caption Watch: ${trendingUp.length} rising, ${trendingDown.length} falling"
   ✓ "Brass battle tightens - top 3 separated by 0.40"

2. SUMMARY: 2-3 sentences highlighting the key caption movements of the day.

3. NARRATIVE: 700-900 word analysis with these sections:

   **THE BIG PICTURE** (~100 words)
   - How many captions trending up vs down?
   - Any surprising movers?
   - Overall competitiveness across captions

   **GENERAL EFFECT BREAKDOWN** (~150 words)
   - GE1 and GE2 leaders and gaps
   - Who's gaining ground? Who's losing it?
   - Use ↑↓→ symbols

   **VISUAL CAPTIONS** (~150 words)
   - VP, VA, Color Guard analysis
   - Which visual caption is the tightest race?
   - Any corps with standout guard/visual programs?

   **MUSIC CAPTIONS** (~150 words)
   - Brass, Music Analysis, Percussion breakdown
   - Brass vs Percussion - where's the value?
   - Which corps have underrated music scores?

   **CAPTION PICKS** (~200 words)
   Format your recommendations clearly:

   🟢 BUY (Add these to your lineup):
   - [Corps] [Caption] @ [Score] ↑ - [Why it's worth picking]
   - [Corps] [Caption] @ [Score] ↑ - [Why it's worth picking]

   🟡 HOLD (Keep if you have them):
   - [Corps] [Caption] @ [Score] → - [Why they're reliable]

   🔴 SELL (Consider dropping):
   - [Corps] [Caption] @ [Score] ↓ - [Why they're risky]

   **SLEEPER PICK** (~50 words)
   - One under-the-radar caption that could pay off

═══════════════════════════════════════════════════════════════
STRICT REQUIREMENTS:
═══════════════════════════════════════════════════════════════
1. The narrative MUST be 700-900 words (not a short summary)
2. Include ↑↓→ trend symbols throughout
3. Analyze INDIVIDUAL CAPTIONS (GE1, GE2, VP, VA, CG, B, MA, P), not corps overall
4. Include specific scores and margins
5. AVOID: dominant, heating up, intensifies, key area of focus, captivating

Keep it fun and informative - this is fantasy drum corps, not Wall Street!`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      headline: { type: Type.STRING, description: "Caption-focused headline with corps name, specific caption (GE1/B/CG etc), score, and ↑↓→ trend symbol" },
      summary: { type: Type.STRING, description: "2-3 sentences highlighting key caption movements and one clear recommendation" },
      narrative: { type: Type.STRING, description: "FULL 700-900 word analysis covering: Big Picture, GE Breakdown (GE1/GE2), Visual Captions (VP/VA/CG), Music Captions (B/MA/P), Caption Picks (BUY/HOLD/SELL with ↑↓→), Sleeper Pick. Fun but data-driven." },
      captionInsights: {
        type: Type.OBJECT,
        properties: {
          geInsight: { type: Type.STRING, description: "GE1 and GE2 analysis with specific scores" },
          visualInsight: { type: Type.STRING, description: "VP, VA, CG analysis with specific scores" },
          musicInsight: { type: Type.STRING, description: "B, MA, P analysis with specific scores" },
        },
        required: ["geInsight", "visualInsight", "musicInsight"],
      },
      recommendations: {
        type: Type.OBJECT,
        description: "Caption pick recommendations for fantasy directors",
        properties: {
          buy: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                corps: { type: Type.STRING },
                caption: { type: Type.STRING, description: "Specific caption: GE1, GE2, VP, VA, CG, B, MA, or P" },
                score: { type: Type.NUMBER },
                reason: { type: Type.STRING },
              },
              required: ["corps", "caption", "score", "reason"],
            },
          },
          hold: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                corps: { type: Type.STRING },
                caption: { type: Type.STRING, description: "Specific caption: GE1, GE2, VP, VA, CG, B, MA, or P" },
                score: { type: Type.NUMBER },
                reason: { type: Type.STRING },
              },
              required: ["corps", "caption", "score", "reason"],
            },
          },
          sell: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                corps: { type: Type.STRING },
                caption: { type: Type.STRING, description: "Specific caption: GE1, GE2, VP, VA, CG, B, MA, or P" },
                score: { type: Type.NUMBER },
                reason: { type: Type.STRING },
              },
              required: ["corps", "caption", "score", "reason"],
            },
          },
        },
        required: ["buy", "hold", "sell"],
      },
    },
    required: ["headline", "summary", "narrative", "captionInsights", "recommendations"],
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
    // Use filter to get ALL events on this day, not just the first one
    // Multiple shows can occur on the same day (e.g., DCI Ft. Wayne AND Music On The March)
    const dayEvents = yearEvents.filter(e => e.offSeasonDay === targetDay);
    if (dayEvents.length === 0) continue;

    // Search through all events on this day to find the corps's score
    let corpsScore = null;
    for (const dayEvent of dayEvents) {
      corpsScore = dayEvent.scores.find(s => s.corps === corpsName);
      if (corpsScore) break;
    }
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

    // Collect scores with caption breakdown and show info
    const scores = [];
    for (let day = reportDay - 6; day <= reportDay; day++) {
      // Use filter to get ALL events on this day, not just the first one
      // Multiple shows can occur on the same day
      const dayEvents = yearEvents.filter(e => e.offSeasonDay === day);
      if (dayEvents.length > 0) {
        // Search through all events on this day to find the corps's score
        let corpsScore = null;
        let matchingEvent = null;
        for (const dayEvent of dayEvents) {
          corpsScore = dayEvent.scores.find(s => s.corps === corpsName);
          if (corpsScore) {
            matchingEvent = dayEvent;
            break;
          }
        }
        if (corpsScore && matchingEvent) {
          const total = calculateTotal(corpsScore.captions);
          const subtotals = calculateCaptionSubtotals(corpsScore.captions);
          if (total > 0) {
            scores.push({
              day,
              total,
              captions: corpsScore.captions,
              subtotals,
              // Include show context for journey narrative
              showName: matchingEvent.eventName || matchingEvent.name || null,
              location: matchingEvent.location || null,
            });
          }
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
        // Full recent scores for corps feature show-by-show journey
        recentScores: sortedScores,
        // Season high/low for trajectory analysis
        seasonHigh: bestInWindow,
        seasonLow: worstInWindow,
        totalImprovement: sortedScores.length >= 2 ? sortedScores[sortedScores.length - 1].total - sortedScores[0].total : 0,
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
