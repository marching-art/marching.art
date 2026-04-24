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
    content.corpsIdentity?.tradition,
    content.corpsIdentity?.strength,
    content.corpsIdentity?.trajectory,
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

// Configuration: Set to true to use paid Imagen 4 Fast ($0.02/image), false for free Gemini 2.5 Flash Image (500 RPD free tier)
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
      // Paid tier: Imagen 4 Fast via Vertex AI ($0.02/image)
      // Better detail, prompt adherence, and 10x faster than Imagen 3
      const vertexAI = initializeVertexAI();
      const modelName = "imagen-4.0-fast-generate-001";

      // Put specific prompt FIRST, then critical constraints
      const imagenPrompt = `${prompt}

---
CRITICAL RULES FOR THIS IMAGE:
- This is DCI drum corps on a football field, NOT a rock concert or orchestra
- Each performer holds ONLY ONE instrument type (brass OR drums OR flag - never multiple)
- Use the EXACT uniform colors and details specified above - do not substitute generic designs
- CLOSE-UP ONLY: Show 2-6 performers maximum, filling the frame. Do NOT show the full corps or wide formation.
- FIELD-LEVEL CAMERA: Shoot from eye level on the field, NOT from elevated, aerial, or press box positions.
- SHALLOW DEPTH OF FIELD: Performers in sharp focus, background (stadium, crowd, field) as soft bokeh.
${IMAGE_NEGATIVE_PROMPT}`;

      // Retry logic for quota limits (429 errors)
      const MAX_RETRIES = 3;
      const RETRY_DELAY_MS = 15000; // 15 seconds between retries

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const response = await vertexAI.models.generateImages({
            model: modelName,
            prompt: imagenPrompt,
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
      // Free tier: Gemini 2.5 Flash Image (500 RPD free, no billing required)
      const ai = initializeGemini();
      const modelName = options.model || "gemini-2.5-flash-image";

      // Build system instruction with drum corps context
      const systemInstruction = `${DRUM_CORPS_VISUAL_CONTEXT}

${IMAGE_NEGATIVE_PROMPT}

You are an expert drum corps photojournalist. Generate intimate, close-up, field-level photographs of DCI drum corps performers as described above. Always use shallow depth of field, show only 2-6 performers filling the frame, and capture raw emotion and detail.`;

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
    dci: `Intimate field-level photojournalism of drum corps performance. Editorial close-up style.

HEADLINE CONTEXT: "${headline}"
${corpsName ? `FEATURED CORPS: ${corpsName}` : ""}
${showTitle ? `SHOW: "${showTitle}"` : ""}

SHOT TYPE: Close-up editorial photograph from field level
- Eye-level or low angle, as if standing on the field with performers
- Only 2-6 performers visible, filling the entire frame
- Shallow depth of field: performers tack-sharp, stadium and crowd as soft bokeh
- Individual faces, expressions, and uniform details clearly visible

COMPOSITION (choose most appropriate for headline):
- 2-3 brass players in tight frame, horns raised, faces showing intensity
- Guard member mid-toss with silk fabric caught in motion, athletic extension
- Drumline close-up with sticks mid-strike, fierce concentration
- Small group of performers in emotional peak moment, raw human expression

${uniformSection}
${themeContext}

ATMOSPHERE:
- Stadium lights rendered as soft bokeh orbs or starburst in background
- Grass and yard lines may be visible at performer's feet
- Crowd and stands blurred into atmospheric backdrop

MOOD: Intimate, emotionally powerful, human drama of competition

TECHNICAL: Editorial photojournalism, shallow depth of field (f/2.8 or wider), field-level camera. Like a Sports Illustrated or DCI.org feature photo. NOT a wide shot, NOT a broadcast angle.`,

    fantasy: `Intimate close-up photograph of fantasy marching arts performers. Editorial photojournalism style.

THEME: "${headline}"

VISUAL APPROACH:
- 2-4 performers in creative themed uniforms, captured in close-up
- Faces showing competitive intensity, joy, or dramatic expression
- Creative uniform details vivid and sharp: metallic accents, bold colors, themed elements
- Equipment (brass instruments, drums, flags) as foreground detail elements
- Championship or competition atmosphere as blurred background

STYLE REQUIREMENTS:
- Photojournalistic editorial quality, like sports magazine photography
- Bold, saturated colors with dramatic lighting
- Shallow depth of field with performers filling the frame
- Dynamic action or peak emotion captured close-up
- Marching arts equipment and uniform details prominent

AVOID: Cartoon characters, video game imagery, wide shots, distant views`,

    analysis: `Close-up editorial photograph of drum corps performers with analytical, observational quality.

TOPIC: "${headline}"

VISUAL APPROACH:
- 2-4 performers captured in precise, detailed close-up
- Emphasis on technique: hand positions, instrument angles, marching posture
- Clean, sharp detail showing the mechanics of performance
- Observational quality - as if studying the craft up close
- Stadium setting as soft, atmospheric backdrop

STYLE REQUIREMENTS:
- Modern editorial photography quality
- Clean lighting that reveals uniform and instrument detail
- Shallow depth of field isolating subjects from background
- Analytical, observational framing showing technique and precision
- Rich but controlled color palette

AVOID: Cluttered compositions, wide shots, distant views`,
  };

  const basePrompt = categoryPrompts[category] || categoryPrompts.dci;

  return `${basePrompt}

CONTEXT FROM ARTICLE:
"${summary?.substring(0, 200) || headline}"

Generate an image that would work as a professional news article header at 1200x630 pixels.`;
}

// =============================================================================
// COMPOSITION VARIETY - Scene archetypes for visually distinct images
// =============================================================================

/**
 * Complete scene archetypes - each defines a fundamentally different image concept.
 * Every archetype is a self-contained visual vision: subject, camera, lighting, and mood
 * designed as a cohesive whole rather than random combinations of similar elements.
 */
const SCENE_ARCHETYPES = [
  {
    id: "backlit_silhouette",
    scene: "performers backlit by stadium floods, dramatic rim light outlining their forms against glowing background. 2-3 performers in partial silhouette with bright edges, lens flare streaking across frame. Shot from field level, 85mm lens. Faces partially visible through the glow. Instruments catching brilliant edge light.",
    mood: "cinematic, dramatic, mysterious",
    sectionBias: null, // works for any section
  },
  {
    id: "guard_toss_freeze",
    scene: "color guard member frozen mid-equipment toss, rifle or sabre spinning 10 feet above, performer's eyes locked upward tracking it. Body in full athletic extension, costume fabric flowing with momentum. Shot from low angle looking up, guard member and spinning equipment both in frame against dark sky or stadium lights. 35mm lens, dramatic perspective.",
    mood: "athletic, breathtaking, suspended moment",
    sectionBias: "guard",
  },
  {
    id: "drummer_hands_macro",
    scene: "extreme close-up on a snare drummer's hands and sticks mid-stroke, frozen at the moment of impact on the drum head. Knuckles white with grip, wrist tape visible, stick blur trails showing speed. The drummer's face partially visible above, jaw clenched in concentration. Shot with 135mm macro-style framing, f/2 aperture, drum harness and uniform visible but secondary to the hands.",
    mood: "visceral, precise, raw power",
    sectionBias: "percussion",
  },
  {
    id: "head_on_approach",
    scene: "3-5 performers marching directly toward the camera in a company front, shot from field level at eye height. The center performer is sharpest, flanking performers fall to progressive bokeh. Instruments up, faces showing fierce determination, feet mid-stride on grass. 135mm lens compressing the depth between performers. The approaching wall of sound and color.",
    mood: "powerful, confrontational, unstoppable",
    sectionBias: null,
  },
  {
    id: "emotional_ballad_face",
    scene: "tight portrait close-up of a single performer during an emotional ballad moment. Instrument lowered or held gently, face showing raw vulnerability - eyes glistening, mouth slightly open, completely lost in the music. Shot at eye level with 200mm telephoto creating painterly background blur. Stadium lights as soft golden bokeh orbs behind. Every pore and bead of sweat visible.",
    mood: "intimate, vulnerable, deeply human",
    sectionBias: null,
  },
  {
    id: "low_hero_contra",
    scene: "shot from grass level looking up at a contra or tuba player, massive silver instrument dominating the upper frame, performer's face visible past the bell. Dramatic perspective distortion making the performer and instrument look monumental. 24mm wide angle very close. Stadium lights starburst behind. Other performers visible as blurred shapes at the edges.",
    mood: "monumental, powerful, larger than life",
    sectionBias: "brass",
  },
  {
    id: "behind_performer_pov",
    scene: "shot from directly behind 2-3 performers, looking past their shoulders and instruments toward the blurred field and stadium ahead. Uniform back details, harness straps, neck muscles, and sweat visible in sharp focus. The audience and far sideline rendered as a wash of color and light ahead of them. 50mm lens, immersive first-person perspective.",
    mood: "immersive, intimate, you-are-there",
    sectionBias: null,
  },
  {
    id: "guard_silk_motion",
    scene: "color guard performer with a 6-foot silk flag in full extension, fabric creating sweeping arc of color across the frame. Performer's body in dance pose, face showing artistic expression. The flowing silk dominates the composition with vibrant color. Shot from field level, 85mm lens, slight motion blur on silk edges while performer's face is sharp. Other performers as soft shapes behind.",
    mood: "artistic, flowing, vibrant color",
    sectionBias: "guard",
  },
  {
    id: "brass_bells_skyward",
    scene: "2-3 brass players from below, horns raised high for a big hit, bells catching stadium light and gleaming. Shot from low kneeling position looking up, 85mm lens. Performers' chins and open mouths visible past the instrument bells. The moment of maximum volume and effort. Dark sky or stadium structure behind with lights as starburst points.",
    mood: "triumphant, explosive, climactic",
    sectionBias: "brass",
  },
  {
    id: "section_mates_bond",
    scene: "two performers side by side in an intimate moment of connection - could be matching breath before an entrance, a shared glance, or synchronized playing. Both in profile or three-quarter view, nearly touching, instruments at matching angles. The pair fills the frame. Shot at eye level, 135mm lens, everything beyond them dissolved to creamy bokeh. The human bond within the ensemble.",
    mood: "connection, trust, shared purpose",
    sectionBias: null,
  },
  {
    id: "drumline_depth_row",
    scene: "the drumline in a tight row shot from the end, closest snare drum and player's hands tack-sharp in the left/right third of frame, the rest of the battery stretching away into progressive bokeh - tenors, then basses becoming soft shapes. Sticks frozen mid-air. Shot from field level kneeling position, 200mm telephoto compressing the line. Harness details and drum wraps vivid on the closest player.",
    mood: "precision, depth, focused intensity",
    sectionBias: "percussion",
  },
  {
    id: "golden_hour_profile",
    scene: "a performer in crisp profile, warm golden sunlight raking across their face and instrument from the side. Every detail of the uniform lit in warm amber - buttons, fabric texture, metallic accents glowing. Long shadow stretching across the grass. Shot at eye level, 135mm lens. The magic hour light turning a performer into a painting. Stadium lights not yet needed, natural warmth.",
    mood: "warm, golden, timeless",
    sectionBias: null,
  },
  {
    id: "drum_major_command",
    scene: "drum major in dramatic conducting pose on the podium or field, arms extended wide, backlit by stadium floods creating strong rim light. Shot from slightly below looking up, their figure commanding the frame. Uniform details sharp - gauntlets, sash, or insignia visible. The corps is implied but unseen - this is about the leader in their moment of total control.",
    mood: "authority, drama, leadership",
    sectionBias: null,
  },
  {
    id: "mixed_convergence",
    scene: "the rare moment when brass, guard, and percussion converge in the same tight frame during a drill transition. A trumpet player, a guard member with flag, and a tenor drummer visible together in close quarters, each holding their equipment. Shot from field level, 50mm lens capturing the diversity of the ensemble in one intimate frame. Their different uniforms and equipment creating visual contrast.",
    mood: "diverse, dynamic, ensemble unity",
    sectionBias: null,
  },
  {
    id: "sweat_and_grit",
    scene: "extreme close-up of a performer in peak physical effort. Sweat drops visible on forehead, veins on neck or arms, jaw clenched, eyes burning with competitive fire. Uniform soaked with exertion. The athletic reality of marching 8-12 minutes under stadium lights. Shot with 200mm telephoto at eye level, f/2, isolating the raw physicality. Only one performer, all emotion and effort.",
    mood: "raw, athletic, unfiltered reality",
    sectionBias: null,
  },
];

/**
 * Select a scene archetype for an image.
 * Uses reportDay + articleIndex to ensure each of the 5 daily articles gets a different archetype,
 * and the set rotates each day.
 *
 * @param {number} reportDay - Current day number (provides daily rotation)
 * @param {number} articleIndex - Index 0-4 among the daily articles (ensures diversity within a day)
 * @returns {object} A scene archetype
 */
function selectSceneArchetype(reportDay = 0, articleIndex = 0) {
  // Use reportDay to rotate which slice of archetypes this day's articles draw from
  // Each day starts at a different offset, and each article within the day steps forward
  const dayOffset = ((reportDay || 0) * 7) % SCENE_ARCHETYPES.length; // multiply by prime for better spread
  const index = (dayOffset + (articleIndex || 0)) % SCENE_ARCHETYPES.length;
  return SCENE_ARCHETYPES[index];
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
function buildStandingsImagePrompt(topCorps, year, location, showName, showTitle = null, uniformDetails = null, reportDay = 0, articleIndex = 0) {
  // Use provided uniform details (from Firestore) or fall back to hardcoded
  const details = uniformDetails || getUniformDetails(topCorps, year);
  const themeContext = buildShowThemeContext(showTitle);
  const scene = selectSceneArchetype(reportDay, articleIndex);

  return `Intimate field-level photograph of ${topCorps} performers during competition (${year} season). Photojournalistic editorial style.

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
SCENE CONCEPT: ${scene.scene}
Mood: ${scene.mood}

Adapt this scene concept to feature ${topCorps} performers wearing the exact uniform described above.

TECHNICAL: Editorial photojournalism, shallow depth of field (f/2.8 or wider), field-level camera position. Like a Sports Illustrated or DCI.org feature photo. Rich color, high detail on subjects, painterly background blur. NOT a wide shot, NOT a broadcast angle, NOT showing the full corps.

This is ${topCorps} from ${showName || "DCI Finals"}${location ? ` in ${location}` : ""}${showTitle ? `, performing "${showTitle}"` : ""} - an intimate, emotionally powerful close-up capturing the human drama of competition.`;
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
function buildCaptionsImagePrompt(featuredCorps, year, captionType, location, showTitle = null, uniformDetails = null, reportDay = 0, articleIndex = 0) {
  // Use provided uniform details (from Firestore) or fall back to hardcoded
  const details = uniformDetails || getUniformDetails(featuredCorps, year);
  const themeContext = buildShowThemeContext(showTitle);

  // Select a scene archetype, biased toward the relevant section when possible
  let scene = selectSceneArchetype(reportDay, articleIndex);

  // If the caption type strongly implies a section, try to find a matching archetype
  let sectionFocus;
  if (captionType.includes("Brass") || captionType.includes("B")) {
    sectionFocus = "brass";
    const brassScenes = SCENE_ARCHETYPES.filter(s => s.sectionBias === "brass" || s.sectionBias === null);
    scene = brassScenes[(reportDay + articleIndex) % brassScenes.length];
  } else if (captionType.includes("Percussion") || captionType.includes("P")) {
    sectionFocus = "percussion";
    const percScenes = SCENE_ARCHETYPES.filter(s => s.sectionBias === "percussion" || s.sectionBias === null);
    scene = percScenes[(reportDay + articleIndex) % percScenes.length];
  } else if (captionType.includes("Guard") || captionType.includes("CG")) {
    sectionFocus = "color guard";
    const guardScenes = SCENE_ARCHETYPES.filter(s => s.sectionBias === "guard" || s.sectionBias === null);
    scene = guardScenes[(reportDay + articleIndex) % guardScenes.length];
  } else {
    sectionFocus = captionType.includes("Visual") ? "visual technique" : "ensemble expression";
  }

  return `Intimate field-level close-up of ${featuredCorps} performers (${year} season), highlighting ${sectionFocus} excellence. Photojournalistic editorial style.

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
SCENE CONCEPT: ${scene.scene}
Mood: ${scene.mood}

Adapt this scene concept to feature ${featuredCorps} performers (${sectionFocus} section) wearing the exact uniform described above.

TECHNICAL: Editorial photojournalism with shallow depth of field, field-level camera. Capturing the human detail and technical mastery of ${captionType} performance in close-up. NOT a wide shot, NOT showing full corps.

This is ${featuredCorps} from ${location || "DCI Finals"}${showTitle ? `, performing "${showTitle}"` : ""} - an intimate close-up showcasing ${captionType} excellence through individual performer detail.`;
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
function buildFantasyPerformersImagePrompt(topCorpsName, theme, location = null, uniformDesign = null, reportDay = 0, articleIndex = 0) {
  const details = getFantasyUniformDetails(topCorpsName, location, uniformDesign);
  const scene = selectSceneArchetype(reportDay, articleIndex);

  return `Intimate field-level photograph of fantasy marching arts ensemble "${topCorpsName}"${location ? ` from ${location}` : ""} performers in close-up. Editorial photojournalism style.

UNIFORM DESIGN${details.matchedTheme === "director-custom" ? " (Director-Specified)" : ""}:
- Colors: ${details.colors}
- Uniform: ${details.uniform}
- Headwear: ${details.helmet}
- Brass: ${details.brass}
- Guard elements: ${details.guard}
${details.additionalNotes ? `- Special notes: ${details.additionalNotes}` : ""}

SCENE CONCEPT: ${scene.scene}
Mood: ${scene.mood}

Adapt this scene concept to feature "${topCorpsName}" performers wearing the exact uniform described above.
Context: ${theme || "Championship competition performance moment"}
${details.performanceStyle ? `Performance style: ${details.performanceStyle}` : ""}

AUTHENTICITY:
- Uniform is creative but still clearly a marching arts uniform (not costume)
- White marching gloves, black marching shoes visible on performers
- Realistic instruments with creative themed accents
- Professional posture and athletic bearing

TECHNICAL: Editorial photojournalism, shallow depth of field, field-level camera. High contrast, saturated colors matching corps theme. NOT a wide shot. NOT showing full ensemble.

This fantasy corps image captures the human intensity and creative artistry of a championship-caliber ensemble up close.`;
}

/**
 * Build image prompt for fantasy league recap article
 * Features the top-performing corps in intimate photojournalistic style
 *
 * @param {string} featuredCorps - Corps name to feature
 * @param {number} year - Year of the performance
 * @param {string} captionFocus - The caption category to emphasize (e.g., "Brass", "Percussion", "General Effect")
 * @param {object} uniformDetails - Pre-fetched uniform details from Firestore (optional)
 */
function buildFantasyLeagueImagePrompt(featuredCorps = null, year = null, captionFocus = null, uniformDetails = null, reportDay = 0, articleIndex = 0) {
  const scene = selectSceneArchetype(reportDay, articleIndex);

  // If we have a featured corps, generate a corps-specific photojournalistic image
  if (featuredCorps) {
    const details = uniformDetails || getUniformDetails(featuredCorps, year || 2024);

    return `Intimate field-level close-up of ${featuredCorps} performers (${year || "current"} season) in competition. Photojournalistic editorial style.

UNIFORM - MUST BE EXACT:
Corps: ${featuredCorps}
Uniform: ${details.uniform}
Headwear: ${details.helmet}
Brass: ${details.brass}
Percussion: ${details.percussion}
Guard: ${details.guard}

SCENE CONCEPT: ${scene.scene}
Mood: ${scene.mood}

Adapt this scene concept to feature ${featuredCorps} performers wearing the exact uniform described above.
${captionFocus ? `Section emphasis: ${captionFocus} performers.` : ""}

TECHNICAL: Editorial photojournalism, shallow depth of field, field-level camera. NOT a wide shot, NOT a ceremony, NOT a trophy presentation.

This intimate photograph captures ${featuredCorps} performers in the intensity of competition - raw emotion and technical mastery up close.`;
  }

  // Fallback: generic photojournalistic marching arts image (no specific corps data)
  return `Intimate field-level photograph of marching arts performers during competition. Photojournalistic editorial style.

SCENE CONCEPT: ${scene.scene}
Mood: ${scene.mood}

Show performers in modern athletic marching uniforms with this scene concept.

TECHNICAL: Editorial photojournalism, shallow depth of field, field-level. Intimate close-up of competitive marching arts. NOT a ceremony, NOT a trophy presentation, NOT a wide shot.`;
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
function buildAnalyticsImagePrompt(featuredCorps, year, analysisType, showTitle = null, uniformDetails = null, reportDay = 0, articleIndex = 0) {
  // Use provided uniform details (from Firestore) or fall back to hardcoded
  const details = uniformDetails || getUniformDetails(featuredCorps, year);
  const themeContext = buildShowThemeContext(showTitle);
  const scene = selectSceneArchetype(reportDay, articleIndex);

  return `Intimate close-up of ${featuredCorps} performers (${year}) showing technical precision and analytical detail${showTitle ? ` from their show "${showTitle}"` : ""}. Editorial photojournalism.

UNIFORM ACCURACY:
- Uniform: ${details.uniform}
- Headwear: ${details.helmet}
- Brass instruments: ${details.brass}
- Percussion: ${details.percussion}
- Guard: ${details.guard}
${themeContext}
SCENE CONCEPT: ${scene.scene}
Mood: ${scene.mood}

Adapt this scene concept to feature ${featuredCorps} performers wearing the exact uniform described above. Emphasize the technical precision and craft visible in close-up.

TECHNICAL: Editorial documentary photography, shallow depth of field, field-level. Sharp focus on technical detail and performer craft. NOT a wide shot, NOT an elevated formation view.

This intimate shot reveals the precision and technical mastery of ${featuredCorps}'s ${year} ${analysisType} - showing up close why their performance was analytically significant.`;
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
function buildUnderdogImagePrompt(corps, year, location, showTitle = null, uniformDetails = null, reportDay = 0, articleIndex = 0) {
  // Use provided uniform details (from Firestore) or fall back to hardcoded
  const details = uniformDetails || getUniformDetails(corps, year);
  const themeContext = buildShowThemeContext(showTitle);
  const scene = selectSceneArchetype(reportDay, articleIndex);

  return `Intimate close-up capturing a triumphant breakthrough moment for ${corps} performers (${year} season)${showTitle ? ` performing "${showTitle}"` : ""} at ${location || "DCI Finals"}. Photojournalistic editorial.

UNIFORM ACCURACY:
- Uniform: ${details.uniform}
- Headwear: ${details.helmet}
- Brass instruments: ${details.brass}
- Percussion: ${details.percussion}
- Guard: ${details.guard}
${themeContext}
SCENE CONCEPT: ${scene.scene}
Mood: ${scene.mood}

Adapt this scene concept to feature ${corps} performers wearing the exact uniform described above. Infuse the scene with the raw emotion of an underdog rising to the occasion - tears, gritted teeth, fierce determination, or pure joy of exceeding expectations.

TECHNICAL: Inspirational editorial photojournalism, shallow depth of field, field-level. The kind of iconic close-up photo that tells the story of a breakthrough. NOT a wide shot, NOT showing full corps.

This intimate photograph captures the essence of an underdog story - the faces, the emotion, the human triumph of performers who exceeded expectations.`;
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
function buildCorpsSpotlightImagePrompt(corps, year, showTitle = null, uniformDetails = null, reportDay = 0, articleIndex = 0) {
  // Use provided uniform details (from Firestore) or fall back to hardcoded
  const details = uniformDetails || getUniformDetails(corps, year);
  const themeContext = buildShowThemeContext(showTitle);
  const scene = selectSceneArchetype(reportDay, articleIndex);

  return `Intimate editorial portrait of ${corps} performers showcasing corps identity and character (${year} season)${showTitle ? ` performing "${showTitle}"` : ""}. Photojournalistic close-up.

UNIFORM IDENTITY (CRITICAL):
- Uniform: ${details.uniform}
- Headwear: ${details.helmet}
- Brass instruments: ${details.brass}
- Percussion: ${details.percussion}
- Guard: ${details.guard}
${themeContext}
SCENE CONCEPT: ${scene.scene}
Mood: ${scene.mood}

Adapt this scene concept to feature ${corps} performers wearing the exact uniform described above. Emphasize the distinctive visual identity of ${corps} - what makes them recognizable and unique as a corps, shown through individual performer detail.

TECHNICAL: Editorial portrait photography, shallow depth of field (f/2 to f/2.8), field-level. Like a DCI.org corps feature or magazine profile photo. Emphasis on uniform detail, performer expression, and corps identity in tight framing. NOT a wide shot, NOT showing full corps.

This intimate portrait captures the essence of ${corps} - their tradition, excellence, and identity shown through the faces and details of individual performers.`;
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
// WRITING VARIETY SYSTEM
// Rotates narrative approaches so articles don't read like filled-in templates
// =============================================================================

/**
 * Returns a narrative approach for a given article type and day.
 * Rotates through different angles, opening styles, and structural emphases
 * so that consecutive days feel distinct even with the same underlying data shape.
 */
function getWritingVariety(reportDay, articleType) {
  // DCI Daily: rotate opening style and story angle
  const dailyApproaches = [
    {
      opening: "Lead with the tightest positional battle in the field, then zoom out to the full picture.",
      angle: "Frame the night around which corps moved — who gained ground, who lost it, and what the margins actually mean.",
      structure: "Start with the most dramatic position change, work outward to the rest of the field, then circle back to what it means for the standings.",
    },
    {
      opening: "Open with a single striking number — a margin, a score, a day-over-day change — and build the story from there.",
      angle: "Focus on caption splits. Which corps are winning on the sheets in GE but losing in Visual? Where are the hidden mismatches?",
      structure: "Organize by storyline rather than placement order. Group corps by the battles they're in, not their rank.",
    },
    {
      opening: "Dateline opener with the headline result, then immediately pivot to the story beneath the score.",
      angle: "Tonight through the lens of what changed since yesterday. Treat it like a market report — who's up, who's down, and why.",
      structure: "Lead with the top, cover the middle as a single competitive cluster, then highlight individual movers at the bottom.",
    },
    {
      opening: "Start with the corps that had the biggest single-day move, whether up or down. Make their story the hook.",
      angle: "Mid-pack storytelling. The top is well-covered — spend extra attention on the 5th-through-12th place battles where margins are thinnest.",
      structure: "Weave between the top and the middle of the field, showing how the whole standings are interconnected.",
    },
    {
      opening: "Open with a caption stat that reveals something the overall scores don't — a corps winning GE but falling in Visual, for example.",
      angle: "Write it like a scouting report. What should a knowledgeable fan take away from tonight's sheets?",
      structure: "Alternate between big-picture standings and microscopic caption details throughout the piece.",
    },
  ];

  // DCI Feature: rotate the profile lens
  const featureApproaches = [
    {
      lens: "The trajectory story. Where they started, how far they've come, and what the arc looks like on paper.",
      focus: "Emphasize the show-by-show score progression. Let the numbers tell the story — narrate the ups, the dips, the recovery.",
      closingAngle: "Project forward: based on the trendline, what's realistic for this corps in the next few shows?",
    },
    {
      lens: "The caption portrait. Pick apart which captions are carrying this corps and which are holding them back.",
      focus: "Compare their caption profile to the corps directly around them in the standings. Where do they win head-to-head? Where do they lose?",
      closingAngle: "Identify the one caption that could move the needle most and explain why.",
    },
    {
      lens: "The competitive context story. Define this corps by the battles they're in — the corps above them, the corps below, the margins between.",
      focus: "Use the standings as the narrative spine. How close are the races they're in, and what would it take to break through?",
      closingAngle: "Frame the fantasy outlook around their positional volatility — are they locked in or could they move several spots?",
    },
    {
      lens: "The momentum read. Is this corps accelerating, coasting, or fading? Use recent scores to make the case.",
      focus: "Look at their last 3 performances as a micro-trend. Are gains consistent across captions or concentrated in one area?",
      closingAngle: "Close with what the momentum suggests is next — the show on the schedule most likely to test or confirm the trend, and the specific caption to watch there. Describe the outlook; leave fantasy picks to the Fantasy Market Report.",
    },
  ];

  // DCI Recap: rotate analytical emphasis
  // This is a pure caption deep-dive. It does NOT give fantasy buy/hold/sell picks —
  // that's the Fantasy Market Report's job. Keep the lens on what the judges rewarded
  // and where the real races inside the overall standings are hiding.
  const recapApproaches = [
    {
      emphasis: "Lead with the caption where the race is tightest. Which scoring category has the smallest gap between 1st and 5th?",
      thread: "Build the analysis around competitive density — where are the closest races in each caption?",
      closingAngle: "Close with which caption race is most likely to shift next week, and which corps sit right on the edge of moving. Describe the dynamics — do not prescribe fantasy actions.",
    },
    {
      emphasis: "Lead with the biggest mover in any caption — the corps that gained or lost the most ground this week.",
      thread: "Frame the week as a story of change. What shifted, what held, and what's quietly building?",
      closingAngle: "Close by identifying what the movement says about each corps' program identity — is the rise in GE about new effect moments, or execution catching up to design?",
    },
    {
      emphasis: "Lead with the overall standings implications. How did this week's caption performances reshape the race?",
      thread: "Connect caption-level details back to total score impact. A 0.3 GE gain matters more than a 0.3 Percussion gain — explain the math.",
      closingAngle: "Close by mapping where each corps' caption profile leaves them positioned for the rest of the season — strengths, gaps, and the captions that still have headroom.",
    },
  ];

  // Fantasy Daily: rotate narrative voice
  const fantasyApproaches = [
    {
      voice: "Write like a local sports beat reporter covering a high school football rivalry — earnest, detailed, community-focused.",
      quoteStyle: "Post-game interview quotes. Directors reflecting on what went right or wrong tonight.",
      storyEngine: "Frame the night around a rivalry between two ensembles jockeying for the same position.",
    },
    {
      voice: "Write like a fantasy sports podcast host — opinionated, direct, fun. Talk to the reader like they're in on the game.",
      quoteStyle: "Locker room quotes. Raw, immediate reactions — some triumphant, some frustrated.",
      storyEngine: "Frame the night around a surprise result — someone who jumped or fell unexpectedly.",
    },
    {
      voice: "Write like a longform sportswriter — find the human story in the numbers. Give the fantasy world some texture.",
      quoteStyle: "Mix of press conference quotes and overheard sideline comments. Vary the formality.",
      storyEngine: "Frame the night around the season narrative — who's peaking, who's building, who's fighting to stay relevant.",
    },
  ];

  // Fantasy Recap: rotate analytical framing
  // This is the FANTASY MARKET REPORT. It owns buy/hold/sell exclusively — the DCI
  // Recap is the pure caption deep-dive and will have already done the descriptive
  // analysis of what happened. Assume the reader has read it. Get to the picks fast
  // and lean into lineup mechanics, caption weighting, and scarcity.
  const fantasyRecapApproaches = [
    {
      framing: "Morning market report. Brisk, opinionated, actionable. Open with the single highest-conviction pick of the night and build out from there. Treat this as lineup advice, not caption analysis.",
      depthArea: "Go deepest on the GE captions since they drive ~40% of the score — those picks move lineups the most. Brief on the lower-weight captions.",
      pickStyle: "Confident and decisive. Strong opinions, loosely held. Name specific corps+caption combos; skip corps-only picks.",
    },
    {
      framing: "Research note with portfolio logic. Walk through the picks as a constructed lineup — how the GE, Visual, and Music holes fit together. Caption scarcity and substitution matter more than raw scores.",
      depthArea: "Balance the buys across caption families so a reader building a lineup from scratch has coverage across GE/Visual/Music. Explain the reasoning for each slot.",
      pickStyle: "Analytical and hedged. Explain the reasoning, acknowledge uncertainty, note which picks are robust vs. fragile.",
    },
    {
      framing: "Contrarian take. What is the consensus getting wrong? Which crowded picks are overvalued, and which overlooked captions offer the best value per point?",
      depthArea: "Focus on the captions where surface-level ranking and trend data disagree, and the corps whose recent momentum is under-priced by casual fantasy directors.",
      pickStyle: "Bold and counterintuitive. Challenge the obvious picks. Find the edges. Name specific corps+caption combos you'd fade.",
    },
  ];

  const pick = (arr) => arr[reportDay % arr.length];

  switch (articleType) {
    case "dci_daily": return pick(dailyApproaches);
    case "dci_feature": return pick(featureApproaches);
    case "dci_recap": return pick(recapApproaches);
    case "fantasy_daily": return pick(fantasyApproaches);
    case "fantasy_recap": return pick(fantasyRecapApproaches);
    default: return {};
  }
}

// =============================================================================
// EDITORIAL BRIEF
// -----------------------------------------------------------------------------
// Deterministic pre-pass: before any article is generated, compute per-article
// angle assignments so each of the five articles goes in knowing what story it
// owns. Complements the CoverageLedger — the brief proactively assigns hooks,
// the ledger reactively tracks what's been used. Together they force angle
// diversity without relying on Gemini to pick different stories on its own.
//
// Kept fully deterministic (no LLM call): the cost of another model round-trip
// doesn't beat the value of predictable, auditable assignments, and the pick
// logic is simple enough that a rule-based approach matches or beats an LLM's
// judgment at a fraction of the latency.
// =============================================================================

/**
 * Build the nightly editorial brief from today's data.
 *
 * Fields on the returned brief:
 *   lead         — DCI Daily's hook: biggest mover / tight race / field leader
 *   trajectory   — DCI Feature's subject: corps with clearest 7-day arc
 *                  (excluding the lead's subject, to diversify coverage)
 *   caption      — DCI Recap's angle: caption family with the tightest race
 *   market       — Fantasy Market Report's seed BUY: corps+caption with
 *                  highest upward-trending score
 *   fantasy      — Fantasy Daily's top ensemble and field context
 *
 * All assignments are optional — if the data doesn't support a clean pick,
 * that field is omitted and the generator falls back to its existing logic.
 */
function buildEditorialBrief({ dayScores, trendData, fantasyData, reportDay }) {
  const brief = { reportDay };

  if (!dayScores || dayScores.length === 0) return brief;

  // --- Lead story: what's the biggest news tonight? --------------------------
  // Priority: (1) a day-over-day swing ≥ 0.3, (2) a tight top margin < 0.2,
  // (3) the field leader as default.
  const changeCandidates = Object.entries(trendData || {})
    .filter(([name]) => dayScores.some(s => s.corps === name))
    .map(([name, t]) => ({ corps: name, change: t?.dayChange ?? 0 }))
    .filter(x => Number.isFinite(x.change))
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

  if (changeCandidates[0] && Math.abs(changeCandidates[0].change) >= 0.3) {
    const top = changeCandidates[0];
    brief.lead = {
      angle: top.change >= 0 ? "biggest gain of the night" : "biggest score drop of the night",
      subject: top.corps,
      metric: `${top.change >= 0 ? "+" : ""}${top.change.toFixed(3)} from yesterday`,
    };
  } else if (dayScores[1] && (dayScores[0].total - dayScores[1].total) < 0.2) {
    brief.lead = {
      angle: "tight race at the top",
      subject: `${dayScores[0].corps} over ${dayScores[1].corps}`,
      metric: `${(dayScores[0].total - dayScores[1].total).toFixed(3)}-point margin`,
    };
  } else {
    brief.lead = {
      angle: "field leader on the night",
      subject: dayScores[0].corps,
      metric: `top score ${dayScores[0].total.toFixed(3)}`,
    };
  }

  // --- Trajectory story: best arc to profile --------------------------------
  // Corps with the largest net improvement over the recent window that is NOT
  // the lead story's subject (since DCI Daily will already own that corps).
  const leadCorpsNames = new Set(
    (brief.lead?.subject || "").split(/\s+over\s+|\s+vs\s+/).map(s => s.trim()).filter(Boolean)
  );
  const improvementCandidates = Object.entries(trendData || {})
    .filter(([name]) =>
      !leadCorpsNames.has(name) &&
      dayScores.some(s => s.corps === name) &&
      Number.isFinite(trendData[name]?.totalImprovement)
    )
    .map(([name, t]) => ({ corps: name, improvement: t.totalImprovement, momentum: t.momentum }))
    .sort((a, b) => Math.abs(b.improvement) - Math.abs(a.improvement));

  if (improvementCandidates[0] && Math.abs(improvementCandidates[0].improvement) >= 0.5) {
    const top = improvementCandidates[0];
    brief.trajectory = {
      corps: top.corps,
      metric: `${top.improvement >= 0 ? "+" : ""}${top.improvement.toFixed(3)} net across the recent window`,
      momentum: top.momentum || "steady",
    };
  } else {
    // Fall back to the first corps not already claimed by the lead
    const fallback = dayScores.find(s => !leadCorpsNames.has(s.corps));
    if (fallback) {
      brief.trajectory = {
        corps: fallback.corps,
        metric: `field position ${dayScores.findIndex(s => s.corps === fallback.corps) + 1}, ${fallback.total.toFixed(3)} tonight`,
        momentum: trendData?.[fallback.corps]?.momentum || "steady",
      };
    }
  }

  // --- Caption story: tightest race or biggest mover in a caption family ----
  const captionFamilies = [
    { key: "ge", label: "General Effect" },
    { key: "visual", label: "Visual" },
    { key: "music", label: "Music" },
  ];
  const captionPicks = captionFamilies
    .map(({ key, label }) => {
      const sorted = [...dayScores]
        .filter(s => Number.isFinite(s.subtotals?.[key]))
        .sort((a, b) => (b.subtotals[key] || 0) - (a.subtotals[key] || 0));
      if (sorted.length < 2) return null;
      const n = Math.min(5, sorted.length);
      const gap = sorted[0].subtotals[key] - sorted[n - 1].subtotals[key];
      return { key, label, leader: sorted[0].corps, gap, depth: n };
    })
    .filter(Boolean)
    .sort((a, b) => a.gap - b.gap);

  if (captionPicks[0]) {
    const tightest = captionPicks[0];
    brief.caption = {
      family: tightest.label,
      leader: tightest.leader,
      metric: `${tightest.gap.toFixed(2)}-point spread from 1st through ${tightest.depth === dayScores.length ? "last" : tightest.depth + "th"}`,
    };
  }

  // --- Market story: highest upward-trending caption to anchor the top BUY --
  const marketCandidates = [];
  for (const s of dayScores) {
    const trend = trendData?.[s.corps];
    if (!trend?.captionTrends) continue;
    const pairs = [
      ["ge", "GE"],
      ["visual", "Visual"],
      ["music", "Music"],
    ];
    for (const [k, label] of pairs) {
      if (trend.captionTrends[k]?.trending === "up") {
        marketCandidates.push({
          corps: s.corps,
          family: label,
          score: s.subtotals?.[k] ?? 0,
        });
      }
    }
  }
  marketCandidates.sort((a, b) => b.score - a.score);
  if (marketCandidates[0]) {
    brief.market = {
      topBuy: `${marketCandidates[0].corps}'s ${marketCandidates[0].family}`,
      metric: `${marketCandidates[0].score.toFixed(2)}, trending upward`,
    };
  }

  // --- Fantasy story: top competitive ensemble ------------------------------
  const shows = fantasyData?.current?.shows || [];
  const competitive = shows.flatMap(s => (s.results || []).filter(r => r.corpsClass !== "soundSport"));
  if (competitive.length > 0) {
    const top = competitive.sort((a, b) => b.totalScore - a.totalScore)[0];
    brief.fantasy = {
      ensemble: top.corpsName,
      director: top.displayName || "Unknown",
      score: Number.isFinite(top.totalScore) ? top.totalScore.toFixed(3) : null,
      fieldSize: competitive.length,
    };
  }

  return brief;
}

/**
 * Render the brief into a prompt-ready "YOUR ASSIGNED ANGLE" block for a
 * given article type. Returns empty string when there's nothing to assign so
 * the prompt degrades cleanly instead of printing "undefined".
 */
function formatBriefForArticle(brief, articleType) {
  if (!brief) return "";

  switch (articleType) {
    case "dci_daily": {
      if (!brief.lead) return "";
      return `
YOUR ASSIGNED ANGLE (editorial brief — build your hook around this, not a different obvious story)
Lead story of the night: ${brief.lead.angle}
Subject: ${brief.lead.subject}
Why it's the lead: ${brief.lead.metric}
`;
    }
    case "dci_feature": {
      if (!brief.trajectory) return "";
      return `
YOUR ASSIGNED ANGLE (editorial brief — this is the corps to profile tonight)
Featured corps: ${brief.trajectory.corps}
Why them: ${brief.trajectory.metric}; momentum reading: ${brief.trajectory.momentum}
This corps was picked because DCI Daily is covering a different story tonight — your job is to make the case for this corps' trajectory, not to fight for the lead headline.
`;
    }
    case "dci_recap": {
      if (!brief.caption) return "";
      return `
YOUR ASSIGNED ANGLE (editorial brief — lead with this caption family)
Caption to lead with: ${brief.caption.family}
Why it's the story: ${brief.caption.metric} — ${brief.caption.leader} leads tonight
The other two caption families still get coverage in the body, but your opening paragraphs belong to ${brief.caption.family}.
`;
    }
    case "fantasy_recap": {
      if (!brief.market) return "";
      return `
YOUR ASSIGNED ANGLE (editorial brief — anchor your top BUY around this)
Seed BUY thesis: ${brief.market.topBuy}
Supporting metric: ${brief.market.metric}
You may adjust if the data supports a stronger pick, but this is the pre-computed top candidate — build around it unless you have a clearly better alternative.
`;
    }
    default:
      return "";
  }
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

    // Coverage ledger: records what earlier articles have already used so later
    // articles can be given explicit "negative space" instructions. Replaces the
    // previous Set-based exclusion that only covered articles 1–3.
    const ledger = createCoverageLedger();

    // Editorial brief: deterministic pre-pass that assigns each article a
    // pre-computed angle (lead / trajectory / caption / market / fantasy) so
    // the five articles don't all fight over the obvious hook.
    const brief = buildEditorialBrief({ dayScores, trendData, fantasyData, reportDay });
    logger.info(`Editorial brief for Day ${reportDay}: lead=${brief.lead?.subject || 'n/a'} | trajectory=${brief.trajectory?.corps || 'n/a'} | caption=${brief.caption?.family || 'n/a'} | market=${brief.market?.topBuy || 'n/a'}`);

    const articles = [];

    // Article 1: DCI DAILY - Today's competition results with score breakdown
    const dciDailyArticle = await generateDciDailyArticle({
      reportDay, dayScores, trendData, activeCorps, showContext, competitionContext, db, ledger, brief
    });
    articles.push(dciDailyArticle);
    ledger.record(dciDailyArticle);

    // Article 2: DCI FEATURE - Single corps season progress spotlight
    const dciFeatureArticle = await generateDciFeatureArticle({
      reportDay, dayScores, trendData, activeCorps, showContext, competitionContext, db, ledger, brief
    });
    articles.push(dciFeatureArticle);
    ledger.record(dciFeatureArticle);

    // Article 3: DCI RECAP - Pure caption deep-dive (GE, Visual, Music). Descriptive, not prescriptive.
    const dciRecapArticle = await generateDciRecapArticle({
      reportDay, dayScores, trendData, captionLeaders, activeCorps, showContext, competitionContext, db, ledger, brief
    });
    articles.push(dciRecapArticle);
    ledger.record(dciRecapArticle);

    // Article 4: FANTASY MARKET REPORT - Owns buy/hold/sell picks for the day (descriptive caption analysis already done in Article 3).
    const fantasyRecapArticle = await generateFantasyRecapArticle({
      reportDay, dayScores, trendData, showContext, competitionContext, db, ledger, brief
    });
    articles.push(fantasyRecapArticle);
    ledger.record(fantasyRecapArticle);

    // Article 5: FANTASY DAILY - Fantasy competition results with score breakdown (generated last to appear first in feed)
    const fantasyDailyArticle = await generateFantasyDailyArticle({
      reportDay, fantasyData, showContext, competitionContext, db, dataDocId, ledger
    });
    articles.push(fantasyDailyArticle);
    ledger.record(fantasyDailyArticle);

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
async function generateDciDailyArticle({ reportDay, dayScores, trendData, activeCorps, showContext, competitionContext, db, ledger, brief }) {
  const topCorps = dayScores[0];
  const secondCorps = dayScores[1];
  const thirdCorps = dayScores[2];
  const gap = topCorps && secondCorps ? (topCorps.total - secondCorps.total).toFixed(3) : "0.000";
  const top3Gap = topCorps && thirdCorps ? (topCorps.total - thirdCorps.total).toFixed(3) : "0.000";

  // Get dynamic tone guidance based on competition context
  const toneGuidance = getToneGuidance(competitionContext, "dci_scores");

  // Group today's corps by the show they actually competed at.
  // Some days have one show; others have multiple, and corps in different shows
  // did NOT compete head-to-head. The prompt must make that distinction clear.
  const scoresByShow = (() => {
    const groups = new Map();
    for (const s of dayScores) {
      const key = s.showName || showContext.showName || `Day ${reportDay} Competition`;
      if (!groups.has(key)) {
        groups.set(key, {
          name: key,
          location: s.location || showContext.location || null,
          scores: [],
        });
      }
      groups.get(key).scores.push(s);
    }
    return Array.from(groups.values()).map(g => ({
      ...g,
      scores: g.scores.sort((a, b) => b.total - a.total),
    }));
  })();

  const multiShow = scoresByShow.length > 1;

  const showBlocks = scoresByShow.map(group => {
    const header = `SHOW: ${group.name}${group.location ? ` — ${group.location}` : ''} (${group.scores.length} corps)`;
    const lines = group.scores.map((s, i) => {
      const trend = trendData[s.corps];
      const change = trend?.dayChange || 0;
      const marginToNext = i > 0 ? (group.scores[i - 1].total - s.total).toFixed(3) : "-";
      const changeStr = trend && Number.isFinite(change)
        ? ` (${change >= 0 ? '+' : ''}${change.toFixed(3)} from yesterday)`
        : '';
      const yearTag = s.sourceYear ? ` [${s.sourceYear}]` : '';
      return `${i + 1}. ${s.corps}${yearTag} - ${s.total.toFixed(3)}${changeStr}${i > 0 ? ` [${marginToNext} behind]` : ' [LEADER]'}
   GE: ${s.subtotals?.ge?.toFixed(2) || 'N/A'} | Visual: ${s.subtotals?.visual?.toFixed(2) || 'N/A'} | Music: ${s.subtotals?.music?.toFixed(2) || 'N/A'}`;
    }).join('\n');
    return `${header}\n${lines}`;
  }).join('\n\n');

  // Caption winners are computed per-show so we don't imply a head-to-head
  // caption race across corps that weren't on the same field.
  const captionWinnersByShow = scoresByShow.map(group => {
    const captions = ['ge', 'visual', 'music'];
    const winners = captions.map(cap => {
      const sorted = [...group.scores].sort((a, b) => (b.subtotals?.[cap] || 0) - (a.subtotals?.[cap] || 0));
      const top = sorted[0];
      if (!top) return null;
      const margin = sorted[1] ? (top.subtotals[cap] - sorted[1].subtotals[cap]).toFixed(2) : "N/A";
      return `• ${cap.toUpperCase()}: ${top.corps} (${top.subtotals[cap]?.toFixed(2)}) — ${margin} over ${sorted[1]?.corps || 'field'}`;
    }).filter(Boolean).join('\n');
    return `${group.name}:\n${winners}`;
  }).join('\n\n');

  // Day-over-day movers across the whole field (identity by corps name is fine;
  // a corps only competes at one show on a given day).
  const surgingLines = Object.entries(trendData).filter(([_, t]) => t.dayChange > 0.3);
  const strugglingLines = Object.entries(trendData).filter(([_, t]) => t.dayChange < -0.3);
  const moversBlock = [
    surgingLines.length > 0 ? `- Biggest gains: ${surgingLines.map(([c, t]) => `${c} (+${t.dayChange.toFixed(3)})`).join(', ')}` : null,
    strugglingLines.length > 0 ? `- Score drops: ${strugglingLines.map(([c, t]) => `${c} (${t.dayChange.toFixed(3)})`).join(', ')}` : null,
  ].filter(Boolean).join('\n');

  const corpsRoster = dayScores.map(s => s.corps).join(', ');

  // Get today's narrative variety to keep articles from feeling templated
  const variety = getWritingVariety(reportDay, "dci_daily");

  const prompt = `You are a DCI.org staff writer covering tonight's competitions. Write a genuine article — not a template with blanks filled in. Every night's story is different because every night's scores tell a different story. Find that story.

ACCURACY RULES (read first — violations ruin the article)
- Every corps name, score, caption number, show name, and location you write MUST come from the DATA block below. Do not invent corps, venues, cities, dates, or statistics.
- Only the corps listed in CORPS COMPETING TONIGHT exist in this article. Do not reference any corps not in that list.
- The field tonight has ${dayScores.length} corps — never state any other count, and never imply corps not listed were present.
${multiShow ? `- There are ${scoresByShow.length} separate competitions tonight at different venues. Corps at different shows did NOT compete against each other. Never imply a head-to-head result between corps that weren't at the same show. When you cite a score or placement, make the show clear from context.` : `- All corps tonight competed at a single show: ${scoresByShow[0]?.name}${scoresByShow[0]?.location ? ` in ${scoresByShow[0].location}` : ''}.`}
- Source-year disclosure: on each corps' FIRST mention in the narrative, include their source-year in parentheses — e.g., "Blue Stars (2019)" — so fantasy readers know which season's program material the corps is performing. Every corps in the DATA block has a listed sourceYear; use it. After the first mention, the year can be omitted.
- If a data point you want to reference isn't in the DATA block, leave it out. Do not fill gaps with plausible-sounding invention.

VOICE & STYLE
Study how DCI.org actually writes:
- "Boom." (punchy one-word opener)
- "INDIANAPOLIS — A mere 0.175-point gap separates first and second."
- "After trailing by 0.175 points Thursday, Bluecoats gained a lead of 0.188 points Friday."
- "Less than half a point separated The Cavaliers, Blue Stars, and Troopers — three corps who have been neck-and-neck throughout the season."

Lead with specific facts, stay concise, let the numbers carry the weight. No hype words. No exclamation points. The drama is in the data.

Score language should be precise: "edging past by 0.087" / "three-tenths back" / "a scant 0.2-point gap" / "swept every caption except Color Guard"
Caption terminology: GE (GE1 Music Effect + GE2 Visual Effect), Visual (VP, VA, CG), Music (B, MA, P)

BANNED PHRASES (AI tells): dominant, commanding, stellar, stunning, thrilling, incredible, captivating, testament, mettle, besting, heating up, setting the stage, all eyes on, force to be reckoned with, proves their mettle, tune in tomorrow, stay tuned, momentum is building, final showdown, critical juncture, dynasty in the making, echoes still resonate, poured their hearts into, leaving spectators on edge, within striking distance, absolutely crucial, emerging as a true contender

===== DATA =====
Day ${reportDay} — ${showContext.date}

CORPS COMPETING TONIGHT (${dayScores.length}): ${corpsRoster}

${multiShow ? `TONIGHT'S SHOWS (${scoresByShow.length}):` : `TONIGHT'S SHOW:`}
${scoresByShow.map(g => `- ${g.name}${g.location ? ` — ${g.location}` : ''} (${g.scores.length} corps)`).join('\n')}

RESULTS BY SHOW
${showBlocks}

CAPTION WINNERS (per show):
${captionWinnersByShow}

DAY-OVER-DAY MOVERS${moversBlock ? '' : ': none of note'}
${moversBlock}

POSITION BATTLES: ${competitionContext.positionBattleCount} corps within 0.2 of the position directly ahead of them.
===== END DATA =====

${toneGuidance}
${formatNegativeSpace(ledger)}
${formatBriefForArticle(brief, 'dci_daily')}
TONIGHT'S NARRATIVE APPROACH
Opening: ${variety.opening}
Angle: ${variety.angle}
Structure: ${variety.structure}

HOW TO WRITE THIS ARTICLE
- Headline: Specific and factual. No exclamation points. Reference an actual margin, score, or storyline from the data.
- Summary: 2-3 factual sentences — key result, the margin, and one specific storyline${multiShow ? '. If the night had multiple shows, make that clear in the summary' : ''}.
- Narrative: 600-900 words. Every scoring corps should appear by name at least once, but let significance drive the emphasis — don't pad coverage to hit a checklist, and don't march through rank order unless that's genuinely the best frame.
${multiShow ? `- Cover all ${scoresByShow.length} shows by name. For each score or placement you cite, make the show clear (via dateline, a phrase like "at [Show]", or section framing). Readers should never be confused about which corps competed where.` : `- This is a single-show night — ground the article in ${scoresByShow[0]?.name}${scoresByShow[0]?.location ? ` (${scoresByShow[0].location})` : ''} and treat the standings as one field.`}
- Weave day-over-day changes and caption details where they're relevant; don't break them out as obligatory sections.
- Close with a specific, grounded observation — a number, a trend, a question the next show will answer. No "tune in tomorrow" sign-offs.

Write like you've covered this beat for years. Let the scores drive the story.`;


  // Schema for structured output
  const schema = {
    type: Type.OBJECT,
    properties: {
      headline: { type: Type.STRING, description: "Factual headline grounded in tonight's actual results. No exclamation points, no 'dominates' or 'stunning', no invented facts." },
      summary: { type: Type.STRING, description: "2-3 factual sentences. When multiple shows occurred, make that clear. Only use corps, scores, and venues from the DATA block." },
      narrative: { type: Type.STRING, description: "600-900 word article. Every scoring corps appears by name at least once; emphasis follows significance, not checklist. When there are multiple shows, make the venue split clear for every score cited. Never invent corps, venues, or statistics. Never use 'dominant', 'commanding', 'heating up', 'besting'." },
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
    const content = await generateWithFactCheckGuard(prompt, schema, {
      articleType: "dci_daily",
      fieldCorpsNames: dayScores.map(s => s.corps),
    });

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
      uniformDetails,
      reportDay,
      0 // articleIndex 0: DCI Daily
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
async function generateDciFeatureArticle({ reportDay, dayScores, trendData, activeCorps, showContext, competitionContext, db, ledger, brief }) {
  // Derive the corps exclusion set from the coverage ledger so this article
  // doesn't repeat a spotlight subject from earlier in the batch.
  const excludeCorps = ledger?.dciCorps || new Set();
  const toneGuidance = getToneGuidance(competitionContext, "dci_corps_feature");

  // Corps selection priority:
  //   1. The editorial brief's trajectory pick (if it resolves to a corps in
  //      tonight's field and isn't already spotlit).
  //   2. Day-based rotation through the field (falls back if the brief either
  //      didn't produce a pick or picked a corps that's been excluded).
  let featureCorps = null;
  if (brief?.trajectory?.corps) {
    const briefPick = dayScores.find(s => s.corps === brief.trajectory.corps);
    if (briefPick && !excludeCorps.has(briefPick.corps)) {
      featureCorps = briefPick;
    }
  }
  if (!featureCorps) {
    let featureIndex = (reportDay - 1) % dayScores.length;
    featureCorps = dayScores[featureIndex];
    if (excludeCorps.has(featureCorps?.corps)) {
      for (let i = 1; i < dayScores.length; i++) {
        const nextIndex = (featureIndex + i) % dayScores.length;
        if (!excludeCorps.has(dayScores[nextIndex]?.corps)) {
          featureCorps = dayScores[nextIndex];
          break;
        }
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

  // Get today's narrative variety
  const variety = getWritingVariety(reportDay, "dci_feature");

  // Pre-compute seeded narrative hints so the featured corps gets deterministic
  // per-(corps, day) phrasing for their momentum, streak, and caption story.
  // Seeded by corps+day+articleType so the same corps on the same day produces
  // one set of hints inside DCI Feature, but a different set if the same corps
  // shows up as a pick in the Fantasy Market Report later in the batch.
  const narrativeSeed = `${featureCorps.corps}:${reportDay}:dci_feature`;
  const narrative = getTrendNarrative(corpsTrend, narrativeSeed);
  const narrativeHintsBlock = narrative ? [
    narrative.momentum ? `- Momentum framing: "${narrative.momentum}"` : null,
    narrative.streak ? `- Streak framing: "${narrative.streak}"` : null,
    narrative.caption ? `- Caption framing: "${narrative.caption}"` : null,
    narrative.performance ? `- Season-context framing: "${narrative.performance}"` : null,
    narrative.stability ? `- Stability framing: "${narrative.stability}"` : null,
  ].filter(Boolean).join('\n') : '';

  const tonightShow = featureCorps.showName || showContext.showName;
  const tonightLocation = featureCorps.location || showContext.location;

  const prompt = `You are a DCI.org feature writer profiling ${featureCorps.corps}'s season. This is a numbers-driven piece — the kind of article a knowledgeable fan reads to understand what the scores actually say about this corps. Not a puff piece. Not a history lesson. A season audit.

ACCURACY RULES (read first)
- Every score, caption number, show name, and location you write MUST come from the DATA block below. Do not invent venues, cities, dates, or scores.
- The featured corps is ${featureCorps.corps} competing with ${featureCorps.sourceYear} material. Do not reference seasons or material other than ${featureCorps.sourceYear} unless it appears in the data.
- Source-year disclosure: on the corps' FIRST mention in the narrative, render as "${featureCorps.corps} (${featureCorps.sourceYear})" so fantasy readers know which season's program they're reading about. After the first mention, omit the year unless you're explicitly contrasting seasons.
- If a fact isn't in the data, leave it out — do not fill gaps with plausible-sounding invention.

VOICE: Sports analyst who respects the reader's intelligence. Specific scores, real comparisons, honest assessments. No filler about tradition or history — only this season's data matters.

BANNED PHRASES: dominant, commanding, stunning, thrilling, incredible, captivating, testament, mettle, identity forged in, legacy of excellence, storied history, tradition of, proving doubters wrong, making a statement, force to be reckoned with, passion and dedication, pushing the boundaries, compelling visual storytelling, emotionally resonant

DATA RULES: Ignore total scores under 60 (incomplete). Ignore caption scores of 0 (missing).

===== DATA =====
FEATURED CORPS: ${featureCorps.corps}
Season material: ${featureCorps.sourceYear}${showTitle ? ` | Show title: "${showTitle}"` : ''}
Tonight's competition: ${tonightShow || 'N/A'}${tonightLocation ? ` — ${tonightLocation}` : ''}
Tonight's placement: ${currentRank}${currentRank === 1 ? 'st' : currentRank === 2 ? 'nd' : currentRank === 3 ? 'rd' : 'th'} of ${dayScores.length} at that show, ${featureCorps.total.toFixed(3)} (${corpsTrend.dayChange >= 0 ? '+' : ''}${corpsTrend.dayChange.toFixed(3)} from yesterday)
Season High: ${seasonHigh.toFixed(3)} | Season Low: ${seasonLow >= 60 ? seasonLow.toFixed(3) : 'N/A'} | Net improvement: ${improvement >= 0 ? '+' : ''}${improvement.toFixed(3)} | Momentum: ${corpsTrend.momentum || 'steady'}${corpsTrend.atSeasonBest ? ' | ★ AT SEASON HIGH' : ''}

SHOW-BY-SHOW (last 5 valid — use these exact show names and locations):
${showHistoryText}

CAPTIONS TONIGHT:
GE: ${featureCorps.subtotals?.ge?.toFixed(2) || 'N/A'} ${corpsTrend.captionTrends?.ge?.trending === "up" ? "↑" : corpsTrend.captionTrends?.ge?.trending === "down" ? "↓" : "→"} (GE1: ${featureCorps.captions?.GE1?.toFixed(2) || 'N/A'}, GE2: ${featureCorps.captions?.GE2?.toFixed(2) || 'N/A'})
Visual: ${featureCorps.subtotals?.visual?.toFixed(2) || 'N/A'} ${corpsTrend.captionTrends?.visual?.trending === "up" ? "↑" : corpsTrend.captionTrends?.visual?.trending === "down" ? "↓" : "→"} (VP: ${featureCorps.captions?.VP?.toFixed(2) || 'N/A'}, VA: ${featureCorps.captions?.VA?.toFixed(2) || 'N/A'}, CG: ${featureCorps.captions?.CG?.toFixed(2) || 'N/A'})
Music: ${featureCorps.subtotals?.music?.toFixed(2) || 'N/A'} ${corpsTrend.captionTrends?.music?.trending === "up" ? "↑" : corpsTrend.captionTrends?.music?.trending === "down" ? "↓" : "→"} (B: ${featureCorps.captions?.B?.toFixed(2) || 'N/A'}, MA: ${featureCorps.captions?.MA?.toFixed(2) || 'N/A'}, P: ${featureCorps.captions?.P?.toFixed(2) || 'N/A'})

COMPETITIVE NEIGHBORHOOD (corps ranked within a few spots of the feature at today's show):
${dayScores.slice(Math.max(0, currentRank - 3), Math.min(dayScores.length, currentRank + 4)).map((s, i) => {
  const rank = Math.max(0, currentRank - 3) + i + 1;
  const gap = s.total - featureCorps.total;
  const venueTag = s.showName && s.showName !== tonightShow ? ` @ ${s.showName}` : '';
  return `${rank}. ${s.corps}: ${s.total.toFixed(3)}${venueTag}${s.corps === featureCorps.corps ? ' ← FEATURED' : ` (${gap >= 0 ? '+' : ''}${gap.toFixed(3)})`}`;
}).join('\n')}
${narrativeHintsBlock ? `
NARRATIVE HINTS (you may use, paraphrase, or ignore these — do NOT use more than one verbatim in the same article, and do not daisy-chain them):
${narrativeHintsBlock}` : ''}
===== END DATA =====

${toneGuidance}
${formatNegativeSpace(ledger)}
${formatBriefForArticle(brief, 'dci_feature')}
TODAY'S APPROACH
Lens: ${variety.lens}
Focus: ${variety.focus}
Closing angle: ${variety.closingAngle}

ARTICLE REQUIREMENTS
- Headline: Include a real number (score, margin, trend). No exclamation points. No generic praise.
- Summary: 2-3 sentences — rank, score, and a specific caption insight. Reference the actual show name when natural.
- Narrative: 700-900 words. A season profile built on scores.
  Include: specific scores from their recent shows (use the exact show names from the data), analysis of at least 3 individual captions with numbers, a comparison to the corps around them tonight, and a reasoned outlook that follows the closing angle above.
  Sequence and emphasis are your call — if GE is the story, lead with GE; if trajectory is the story, lead with the arc. Don't walk through a checklist.
  Do NOT end with fantasy buy/hold/sell or lineup picks — that belongs to the Fantasy Market Report. Do NOT predict exact future scores — only analyze visible trends.`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      headline: { type: Type.STRING, description: "Corps name with a real number/trend from tonight. No 'dominates', no exclamation points, no invented facts." },
      summary: { type: Type.STRING, description: "2-3 sentences: corps name, current score, rank, and one specific caption insight grounded in the data." },
      narrative: { type: Type.STRING, description: "700-900 word analytical profile. Uses the exact show names and scores from the data block — no invented venues, dates, or statistics. Covers current position, show-by-show journey with specific scores, caption strengths, caption weaknesses, and trajectory, ending per the closing angle above. No fantasy buy/hold/sell picks — that belongs to the Fantasy Market Report. Structure follows what the data emphasizes, not a fixed checklist. Never uses 'dominant', 'commanding', 'stunning'." },
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
    const content = await generateWithFactCheckGuard(prompt, schema, {
      articleType: "dci_feature",
      fieldCorpsNames: dayScores.map(s => s.corps),
    });

    const imagePrompt = buildCorpsSpotlightImagePrompt(
      featureCorps.corps,
      featureCorps.sourceYear,
      showTitle,
      uniformDetails,
      reportDay,
      1 // articleIndex 1: DCI Feature
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
async function generateDciRecapArticle({ reportDay, dayScores, trendData, captionLeaders, activeCorps, showContext, competitionContext, db, ledger, brief }) {
  // Derive the corps exclusion set from the coverage ledger so the image subject
  // picker below doesn't land on a corps already spotlit in an earlier article.
  const excludeCorps = ledger?.dciCorps || new Set();
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

  // Get today's narrative variety
  const variety = getWritingVariety(reportDay, "dci_recap");

  // Distinct shows represented in today's field (for venue-aware phrasing)
  const uniqueShows = Array.from(new Set(dayScores.map(s => s.showName).filter(Boolean)));
  const multiShowToday = uniqueShows.length > 1;

  const prompt = `You are a DCI score analyst writing tonight's caption deep-dive. This is the piece a serious drum corps fan bookmarks — the one that explains what the judges are actually rewarding and where the real races are hiding inside the overall standings. It is PURE caption analysis and description — it is not a fantasy column.

SCOPE (read carefully)
- This article DESCRIBES the caption landscape. It does NOT give fantasy buy/hold/sell picks, lineup advice, or "which caption to pick tomorrow" recommendations — a separate Fantasy Market Report article covers that.
- You may describe trajectory, momentum, and what a corps' caption profile suggests about their program identity and direction. You may NOT frame any observation as a pick, trade, buy, sell, hold, target, fade, or fantasy action.
- Readers who want actionable picks will read the Fantasy Market Report. Your job is to leave them understanding the night, not telling them what to do with their lineup.

ACCURACY RULES
- Every corps name, score, caption number, and trend direction you write MUST come from the DATA block below. Do not invent corps, scores, or statistics.
- The field being analyzed is ${dayScores.length} corps (listed below). Never state any other count, and never reference corps not in this list.
${multiShowToday ? `- Tonight's caption numbers come from ${uniqueShows.length} different shows: ${uniqueShows.join(', ')}. Corps at different shows did NOT judge against each other tonight, so the caption rankings below are a composite across venues — frame cross-venue comparisons as such, not as a head-to-head caption duel.` : `- Tonight's caption numbers come from a single show, so the caption rankings below are a true head-to-head.`}
- Source-year disclosure: on each corps' FIRST mention in the narrative, include their source-year in parentheses — e.g., "Blue Stars (2019)" — so fantasy readers know which season's book is driving the caption scores. Every corps' year is listed in CORPS SOURCE YEARS below. After the first mention, the year can be omitted.
- If a fact isn't in the data, leave it out.

VOICE: Authoritative but readable. Not dumbed down, not written for judges. A knowledgeable fan should come away understanding the caption landscape better than they did before.

BANNED PHRASES: dominant, commanding, stunning, thrilling, heating up, captivating, testament, battle for supremacy, stakes are high, every point matters, absolutely crucial, setting the stage, poised to, poised for success, will have a significant advantage, buy, sell, hold, trade, pick up, drop, fade, target, stash, fantasy directors should, for fantasy purposes, in your lineup

===== DATA =====
${dayScores.length} CORPS | Week: Days ${reportDay - 6} through ${reportDay} | Date: ${showContext.date}
CORPS IN TONIGHT'S FIELD: ${dayScores.map(s => s.corps).join(', ')}
CORPS SOURCE YEARS: ${dayScores.map(s => `${s.corps} (${s.sourceYear || 'unknown'})`).join(', ')}

GENERAL EFFECT (40% of total):
${geSorted.map((s, i) => {
  const trend = trendData[s.corps]?.captionTrends?.ge;
  const margin = i > 0 ? (geSorted[i-1].subtotals?.ge - s.subtotals?.ge).toFixed(2) : '-';
  return `${i + 1}. ${s.corps}: ${s.subtotals?.ge?.toFixed(2)} [GE1: ${s.captions?.GE1?.toFixed(2)}, GE2: ${s.captions?.GE2?.toFixed(2)}] ${trend?.trending === "up" ? "↑" : trend?.trending === "down" ? "↓" : "→"} (${margin} behind)`;
}).join('\n')}

VISUAL (30% of total):
${visualSorted.map((s, i) => {
  const trend = trendData[s.corps]?.captionTrends?.visual;
  const margin = i > 0 ? (visualSorted[i-1].subtotals?.visual - s.subtotals?.visual).toFixed(2) : '-';
  return `${i + 1}. ${s.corps}: ${s.subtotals?.visual?.toFixed(2)} [VP: ${s.captions?.VP?.toFixed(2)}, VA: ${s.captions?.VA?.toFixed(2)}, CG: ${s.captions?.CG?.toFixed(2)}] ${trend?.trending === "up" ? "↑" : trend?.trending === "down" ? "↓" : "→"} (${margin} behind)`;
}).join('\n')}

MUSIC (30% of total):
${musicSorted.map((s, i) => {
  const trend = trendData[s.corps]?.captionTrends?.music;
  const margin = i > 0 ? (musicSorted[i-1].subtotals?.music - s.subtotals?.music).toFixed(2) : '-';
  return `${i + 1}. ${s.corps}: ${s.subtotals?.music?.toFixed(2)} [B: ${s.captions?.B?.toFixed(2)}, MA: ${s.captions?.MA?.toFixed(2)}, P: ${s.captions?.P?.toFixed(2)}] ${trend?.trending === "up" ? "↑" : trend?.trending === "down" ? "↓" : "→"} (${margin} behind)`;
}).join('\n')}

MOMENTUM BY CORPS:
${Object.entries(trendData).map(([corps, trend]) => {
  return `${corps}: ${trend.momentum || 'steady'} | Day: ${trend.dayChange >= 0 ? '+' : ''}${trend.dayChange?.toFixed(3) || 'N/A'} | GE: ${trend.captionTrends?.ge?.trending || 'stable'} | Vis: ${trend.captionTrends?.visual?.trending || 'stable'} | Mus: ${trend.captionTrends?.music?.trending || 'stable'}`;
}).join('\n')}

SUBCAPTION LEADERS:
GE1: ${[...dayScores].sort((a, b) => (b.captions?.GE1 || 0) - (a.captions?.GE1 || 0))[0]?.corps} (${[...dayScores].sort((a, b) => (b.captions?.GE1 || 0) - (a.captions?.GE1 || 0))[0]?.captions?.GE1?.toFixed(2)}) | GE2: ${[...dayScores].sort((a, b) => (b.captions?.GE2 || 0) - (a.captions?.GE2 || 0))[0]?.corps} (${[...dayScores].sort((a, b) => (b.captions?.GE2 || 0) - (a.captions?.GE2 || 0))[0]?.captions?.GE2?.toFixed(2)})
VP: ${[...dayScores].sort((a, b) => (b.captions?.VP || 0) - (a.captions?.VP || 0))[0]?.corps} (${[...dayScores].sort((a, b) => (b.captions?.VP || 0) - (a.captions?.VP || 0))[0]?.captions?.VP?.toFixed(2)}) | VA: ${[...dayScores].sort((a, b) => (b.captions?.VA || 0) - (a.captions?.VA || 0))[0]?.corps} (${[...dayScores].sort((a, b) => (b.captions?.VA || 0) - (a.captions?.VA || 0))[0]?.captions?.VA?.toFixed(2)}) | CG: ${[...dayScores].sort((a, b) => (b.captions?.CG || 0) - (a.captions?.CG || 0))[0]?.corps} (${[...dayScores].sort((a, b) => (b.captions?.CG || 0) - (a.captions?.CG || 0))[0]?.captions?.CG?.toFixed(2)})
B: ${[...dayScores].sort((a, b) => (b.captions?.B || 0) - (a.captions?.B || 0))[0]?.corps} (${[...dayScores].sort((a, b) => (b.captions?.B || 0) - (a.captions?.B || 0))[0]?.captions?.B?.toFixed(2)}) | MA: ${[...dayScores].sort((a, b) => (b.captions?.MA || 0) - (a.captions?.MA || 0))[0]?.corps} (${[...dayScores].sort((a, b) => (b.captions?.MA || 0) - (a.captions?.MA || 0))[0]?.captions?.MA?.toFixed(2)}) | P: ${[...dayScores].sort((a, b) => (b.captions?.P || 0) - (a.captions?.P || 0))[0]?.corps} (${[...dayScores].sort((a, b) => (b.captions?.P || 0) - (a.captions?.P || 0))[0]?.captions?.P?.toFixed(2)})
===== END DATA =====

${toneGuidance}
${formatNegativeSpace(ledger)}
${formatBriefForArticle(brief, 'dci_recap')}
TODAY'S ANALYTICAL APPROACH
Lead with: ${variety.emphasis}
Thread: ${variety.thread}
Closing angle: ${variety.closingAngle}

ARTICLE REQUIREMENTS
- Headline: Technical, number-focused. Reference a specific caption gap or trend. No hype words, no "buy/sell" framing.
- Summary: 2-3 factual sentences with key caption insights from tonight's data.
- Narrative: 900-1200 words of caption analysis covering GE, Visual, and Music. Describe what the judges rewarded, where the races are tight, how the sub-caption picture differs from the composite picture, and how the week's trajectory reshapes each corps' caption profile. Close per the closing angle above.
  Reference a meaningful cross-section of the field in each caption family — aim for ${Math.min(5, dayScores.length)} or more corps per family, but never pad by inventing. Cite specific point gaps from the data.
  Weight the sections by where the real story is tonight. If the Visual race is tight and GE is decided, Visual gets more ink.
  Do NOT end with buy/hold/sell, fantasy picks, or "who to target" — the Fantasy Market Report handles that. Your ending belongs to the closing angle above.`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      headline: { type: Type.STRING, description: "Technical headline grounded in a real caption gap or trend from tonight. No 'heats up', 'battle intensifies', 'buy/sell' framing, or invented facts." },
      summary: { type: Type.STRING, description: "2-3 sentences with specific caption gaps and a key insight from the data. Descriptive, not prescriptive — no fantasy picks." },
      narrative: { type: Type.STRING, description: "900-1200 word caption analysis covering GE, Visual, and Music: what the judges rewarded, where the tightest races are, and how the week's trajectory reshapes each corps' caption profile. Every corps, score, and trend must come from the data block. No fantasy buy/hold/sell picks — that is the Fantasy Market Report's job. Never uses 'dominant', 'heating up', 'captivating'." },
      captionBreakdown: {
        type: Type.OBJECT,
        properties: {
          geAnalysis: { type: Type.STRING, description: "General Effect analysis" },
          visualAnalysis: { type: Type.STRING, description: "Visual caption analysis" },
          musicAnalysis: { type: Type.STRING, description: "Music caption analysis" },
        },
        required: ["geAnalysis", "visualAnalysis", "musicAnalysis"],
      },
    },
    required: ["headline", "summary", "narrative", "captionBreakdown"],
  };

  try {
    const content = await generateWithFactCheckGuard(prompt, schema, {
      articleType: "dci_recap",
      fieldCorpsNames: dayScores.map(s => s.corps),
    });

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
      uniformDetails,
      reportDay,
      2 // articleIndex 2: DCI Recap
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
async function generateFantasyDailyArticle({ reportDay, fantasyData, showContext, competitionContext, db, dataDocId, ledger }) {
  if (!fantasyData?.current) {
    return createFallbackArticle(ARTICLE_TYPES.FANTASY_DAILY, reportDay);
  }

  const toneGuidance = getToneGuidance(competitionContext, "fantasy_results");

  const shows = fantasyData.current.shows || [];
  // Flatten while preserving which show each result came from — the article must
  // be able to attribute each ensemble to the correct competition.
  const allResults = shows.flatMap(s => (s.results || []).map(r => ({
    ...r,
    showEventName: r.showEventName || s.eventName || s.name || null,
    showLocation: r.showLocation || s.location || null,
  })));

  // Separate competitive and SoundSport results
  const competitiveResults = allResults.filter(r => r.corpsClass !== 'soundSport');
  const soundSportResults = allResults
    .filter(r => r.corpsClass === 'soundSport')
    .sort((a, b) => b.totalScore - a.totalScore);

  // Rank everyone who competed — no arbitrary 25-cap, so the article reflects the real field.
  const topPerformers = [...competitiveResults].sort((a, b) => b.totalScore - a.totalScore);
  const totalCompetitors = topPerformers.length;

  // Return a fallback if there is genuinely no content to write about tonight.
  // Only fire the fallback when BOTH the competitive field and the SoundSport
  // field are empty — a SoundSport-only evening still deserves its own piece.
  if (totalCompetitors === 0 && soundSportResults.length === 0) {
    return createFallbackArticle(ARTICLE_TYPES.FANTASY_DAILY, reportDay);
  }

  // Field-size mode drives voice, length, quote count, and framing so the
  // article matches the reality of tonight's field instead of padding a 1-
  // ensemble night into the same 5-paragraph shape as a 10-ensemble night.
  const fieldMode =
    totalCompetitors >= 6 ? 'full' :
    totalCompetitors >= 2 ? 'small' :
    totalCompetitors === 1 ? 'solo' :
    'soundsport';

  // Dynamic tiering so the prompt doesn't lie about how much of the field to cover.
  const detailCount = Math.min(5, totalCompetitors);
  const midTierEnd = Math.min(Math.max(detailCount + 5, Math.ceil(totalCompetitors / 2)), totalCompetitors);
  const tierDescription = totalCompetitors <= 5
    ? `all ${totalCompetitors} in detail`
    : totalCompetitors <= 10
      ? `top ${detailCount} in detail, the remaining ${totalCompetitors - detailCount} briefly`
      : `top ${detailCount} in detail, positions ${detailCount + 1}-${midTierEnd} as a group, and positions ${midTierEnd + 1}-${totalCompetitors} briefly`;

  const avgScore = topPerformers.length > 0
    ? (topPerformers.reduce((sum, p) => sum + p.totalScore, 0) / topPerformers.length).toFixed(3)
    : "0.000";
  const topScore = topPerformers[0]?.totalScore?.toFixed(3) || "0.000";

  // Group competitive results by fantasy show for venue-aware writing
  const competitiveByShow = (() => {
    const groups = new Map();
    for (const r of topPerformers) {
      const key = r.showEventName || 'Unspecified Competition';
      if (!groups.has(key)) {
        groups.set(key, {
          name: key,
          location: r.showLocation || null,
          results: [],
        });
      }
      groups.get(key).results.push(r);
    }
    return Array.from(groups.values()).map(g => ({
      ...g,
      results: g.results.sort((a, b) => b.totalScore - a.totalScore),
    }));
  })();
  const multiShow = competitiveByShow.length > 1;

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

  // Get today's narrative variety. Full and small fields use the voice rotation;
  // solo and soundsport modes override it with mode-specific framing because the
  // rotation is built for competitive rivalries that don't exist in those modes.
  const variety = getWritingVariety(reportDay, "fantasy_daily");

  const modeConfig = {
    full: {
      words: '600-800',
      minQuotes: Math.min(3, Math.max(1, Math.floor(totalCompetitors / 3))),
      voice: variety.voice,
      quoteStyle: variety.quoteStyle,
      storyEngine: variety.storyEngine,
      coverage: `Tiered coverage: ${tierDescription}.`,
      headlineGuidance: `Include the actual top ensemble's name and score. No exclamation points. No invented numbers.`,
      bodyNote: '',
    },
    small: {
      words: '450-600',
      minQuotes: totalCompetitors >= 3 ? 2 : 1,
      voice: `Intimate small-field night — ${totalCompetitors} competitive ensembles. Every ensemble gets real air time; no filler, no pad-to-length paragraphs.`,
      quoteStyle: `Up to ${totalCompetitors >= 3 ? 'two' : 'one'} short quote${totalCompetitors >= 3 ? 's' : ''}, only where they add character. A one-quote piece beats a three-quote piece that stretches to hit a quota.`,
      storyEngine: `Frame the night as a head-to-head (or three-way) among the ${totalCompetitors} competitors. The margins between them ARE the story.`,
      coverage: `Cover all ${totalCompetitors} competitive ensembles in detail.`,
      headlineGuidance: `Include the top ensemble's name and score. A margin-forward headline (e.g., "X Edges Y by 0.156") is welcome when the gap is tight. No exclamation points.`,
      bodyNote: `- Do not pad. If a paragraph has no real material, cut it.`,
    },
    solo: {
      words: '300-400',
      minQuotes: 0,
      voice: `Local beat reporter covering a quieter night. One ensemble in competition, performing solo. Honest, grounded, undramatic. Do NOT invent rivalries or opponents — there aren't any tonight.`,
      quoteStyle: `At most one short director/ensemble quote, and only if it genuinely adds character. A no-quote piece is the correct default.`,
      storyEngine: `Tonight is a solo showcase, not a competition. The story is this one ensemble's performance in context — their score, what their script suggests about the program, and where they sit in the arc of their season. SoundSport participants (if present) are the evening's surrounding ecosystem, not opponents.`,
      coverage: `Cover the one competitive ensemble as the sole feature. Reference SoundSport participants only for evening texture — never imply they competed against the featured ensemble.`,
      headlineGuidance: `Name the ensemble and their score plainly. Do NOT invent competitive framing. Factual phrasing like "Mendota DBC Posts 68.198 in Solo Competition" is correct; "Dominates Field" or "Claims Victory" is not.`,
      bodyNote: `- This is a small night. Short and honest beats padded and dramatic. If the data does not support another paragraph, stop writing. 300-400 words is the target, not a floor.`,
    },
    soundsport: {
      words: '250-350',
      minQuotes: 0,
      voice: `Feature writer covering a SoundSport-only showcase. Celebrate the participants and ratings; the focus is ensemble quality and growth, not standings.`,
      quoteStyle: `No invented quotes. Speak about the ensembles, not for them.`,
      storyEngine: `SoundSport is the whole story tonight. Lead with the Best in Show ensemble (if any), then group the remaining participants by rating level. Do NOT reveal SoundSport scores — SoundSport is a ratings-only format.`,
      coverage: `Feature the SoundSport participants by rating. Make the ratings-only nature of SoundSport clear so readers understand scores are intentionally not published.`,
      headlineGuidance: `Lead with a SoundSport ensemble name and rating, or frame as a showcase evening. No invented scores. No exclamation points.`,
      bodyNote: `- No competitive scores are reported tonight — this is a SoundSport-only evening. Do not invent or imply a competitive outcome.`,
    },
  };
  const mode = modeConfig[fieldMode];

  // Classify each director's displayName as either a "real-looking name" or a
  // "username-style handle" so the writer knows which attribution pattern to
  // use. A displayName reads as a handle if it's lowercase with no internal
  // space, or contains digits/underscores/dots — typical of web signups like
  // "elithecreature" or "snare_guy_22". When that's the case, attributing via
  // the ensemble ("Mendota DBC's director said...") reads better than "said
  // elithecreature," which is what today's published articles actually do.
  const looksLikeHandle = (name) => {
    if (!name || typeof name !== "string") return true;
    const trimmed = name.trim();
    if (trimmed.length === 0) return true;
    if (/[0-9_\.]/.test(trimmed)) return true;
    if (!trimmed.includes(" ") && trimmed === trimmed.toLowerCase()) return true;
    return false;
  };
  const directorClassBlock = competitiveResults.length > 0
    ? competitiveResults
        .map(r => `  • "${r.corpsName}" → director "${r.displayName || "Unknown"}" [${looksLikeHandle(r.displayName) ? "HANDLE — attribute via ensemble, not via name" : "NAME — direct attribution OK"}]`)
        .join("\n")
    : "";

  const resultsByShowBlock = competitiveByShow.map(group => {
    const header = `${group.name}${group.location ? ` — ${group.location}` : ''} (${group.results.length} ensemble${group.results.length === 1 ? '' : 's'})`;
    const lines = group.results.map((r, i) => {
      const margin = i > 0 ? (group.results[i - 1].totalScore - r.totalScore).toFixed(3) : "-";
      const director = r.displayName || 'Unknown';
      const hometown = r.location ? ` from ${r.location}` : '';
      return `  ${i + 1}. "${r.corpsName}"${hometown} (Director: ${director}) - ${r.totalScore.toFixed(3)}${i > 0 ? ` [${margin} behind]` : ' [SHOW WINNER]'}`;
    }).join('\n');
    return `SHOW: ${header}\n${lines}`;
  }).join('\n\n');

  const overallRankingBlock = topPerformers.map((r, i) => {
    const margin = i > 0 ? (topPerformers[i - 1].totalScore - r.totalScore).toFixed(3) : "-";
    const director = r.displayName || 'Unknown';
    const showTag = r.showEventName ? ` @ ${r.showEventName}` : '';
    return `${i + 1}. "${r.corpsName}" (${director}) - ${r.totalScore.toFixed(3)}${i > 0 ? ` [${margin} behind]` : ' [OVERALL HIGH]'}${showTag}`;
  }).join('\n');

  const prompt = `You are a marching.art fantasy sports journalist. These are FANTASY ensembles with FANTASY directors created by real users — the ONLY invented content allowed is personality, quotes, and storyline color for those directors and their ensembles. Everything factual — ensemble names, director names, scores, competition names, locations, counts — must match the DATA block exactly.

ACCURACY RULES (read first)
- The field is ${totalCompetitors} competitive ensemble${totalCompetitors === 1 ? '' : 's'} tonight${soundSportResults.length > 0 ? ` plus ${soundSportResults.length} SoundSport participant${soundSportResults.length === 1 ? '' : 's'}` : ''}. Never claim any other count — do not say "25 corps" or any number other than ${totalCompetitors}.
- Only reference ensembles, directors, scores, and venues that appear in the DATA block. Do not invent ensembles, directors, venues, or scores.
${fieldMode === 'soundsport' ? `- No competitive ensembles tonight; SoundSport is non-competitive, so do NOT describe anyone as "winning" against anyone else. Performances are appraised by rating level, not rank.` : multiShow ? `- There are ${competitiveByShow.length} separate fantasy shows tonight at different venues. Ensembles at different shows did NOT compete head-to-head. When you cite a placement or margin, make the show clear.` : fieldMode === 'solo' ? `- Only one competitive ensemble performed tonight: "${topPerformers[0].corpsName}" at ${competitiveByShow[0]?.name || fantasyShowName}${competitiveByShow[0]?.location ? ` (${competitiveByShow[0].location})` : ''}. There are no opponents to frame against — do not invent rivals, runners-up, or head-to-head narratives.` : `- All ensembles tonight competed at the same fantasy show: ${competitiveByShow[0]?.name || fantasyShowName}${competitiveByShow[0]?.location ? ` (${competitiveByShow[0].location})` : ''}.`}
- Invented content is limited to: director personalities, fictional quotes, fictional rivalries/backstory. Never invent competition results, scores, locations, or ensembles.
- Never reveal specific roster/lineup picks.
- Director names in the DATA block are whatever the user set as their displayName — some are real names ("Sarah Jones"), some are usernames ("elithecreature", "mike_42", "BluecoatsFan"). When attributing a quote or paraphrase, ALWAYS prefer an ensemble-based reference ("Mendota DBC's director said…", "the director behind Stellar Vista paused before…"). Only use the bare displayName as a noun if it reads like a real name with a capital letter and a space. Never write a bare-noun attribution that reads as awkward at a glance (e.g., do not produce "elithecreature said…" — write "Mendota DBC's director said…" instead). When you do quote the displayName verbatim, wrap it in the role ("director elithecreature") so the reader sees it as a screen name rather than a first name.

Date: ${showContext.date} | Day ${reportDay}
Field mode: ${fieldMode} (${totalCompetitors} competitive ensemble${totalCompetitors === 1 ? '' : 's'}${soundSportResults.length > 0 ? `, ${soundSportResults.length} SoundSport` : ''})

Voice: ${mode.voice}
Quote style: ${mode.quoteStyle}
Story engine: ${mode.storyEngine}

===== DATA =====
TOTAL COMPETITIVE ENSEMBLES: ${totalCompetitors}
${directorClassBlock ? `\nDIRECTOR ATTRIBUTION GUIDE (check this before writing any quote or paraphrase — "HANDLE" names should NEVER be used as bare-noun attribution):\n${directorClassBlock}\n` : ''}${totalCompetitors === 0 ? 'No competitive ensembles tonight — this is a SoundSport-only evening.' : multiShow ? `\nRESULTS BY SHOW\n${resultsByShowBlock}\n\nOVERALL RANKING (across all shows tonight — reference carefully; these ensembles did NOT all face each other):\n${overallRankingBlock}` : `\nRESULTS\n${resultsByShowBlock}`}

${soundSportResults.length > 0 ? `SOUNDSPORT RATINGS (non-competitive, ratings-only showcase — NEVER reveal SoundSport scores, only rating levels):
${soundSportBestInShow ? `Best in Show: "${soundSportBestInShow.corpsName}" (${soundSportBestInShow.displayName || 'Unknown'})` : ''}
${soundSportByRating.gold.length > 0 ? `Gold (${soundSportByRating.gold.length}): ${soundSportByRating.gold.map(r => `"${r.corpsName}"`).join(', ')}` : ''}
${soundSportByRating.silver.length > 0 ? `Silver (${soundSportByRating.silver.length}): ${soundSportByRating.silver.map(r => `"${r.corpsName}"`).join(', ')}` : ''}
${soundSportByRating.bronze.length > 0 ? `Bronze (${soundSportByRating.bronze.length}): ${soundSportByRating.bronze.map(r => `"${r.corpsName}"`).join(', ')}` : ''}
${soundSportByRating.participation.length > 0 ? `Participation (${soundSportByRating.participation.length}): ${soundSportByRating.participation.map(r => `"${r.corpsName}"`).join(', ')}` : ''}` : ''}

STATS: ${totalCompetitors === 0
  ? `No competitive ensembles | SoundSport participants: ${soundSportResults.length}`
  : `Top ensemble: "${topPerformers[0].corpsName}" at ${topScore}${topPerformers[0].showEventName ? ` (${topPerformers[0].showEventName})` : ''} | ${totalCompetitors >= 2 ? `1st-to-2nd margin: ${(topPerformers[0].totalScore - topPerformers[1].totalScore).toFixed(3)}` : 'Solo competitor'} | Competitive ensembles: ${totalCompetitors} | Field avg: ${avgScore}${soundSportResults.length > 0 ? ` | SoundSport: ${soundSportResults.length}` : ''}`
}
===== END DATA =====

${toneGuidance}
${formatNegativeSpace(ledger)}
BANNED PHRASES: dominant, commanding, stunning, heating up, sent shockwaves, proves their mettle, showcased their prowess, the drama is just beginning, tune in tomorrow, Can [X] maintain their dominance?

ARTICLE REQUIREMENTS
- Headline: ${mode.headlineGuidance}
- Summary: 2-3 sentences — top result, score, and one storyline hook${multiShow ? '. Make the multi-show night clear' : ''}.
- Narrative: ${mode.words} words. ${mode.coverage}${mode.minQuotes > 0 ? ` Include at least ${mode.minQuotes} fictitious director/ensemble quote${mode.minQuotes === 1 ? '' : 's'} with real personality — funny, frustrated, confident, self-deprecating — not "we worked hard" boilerplate.` : ''}
${mode.bodyNote ? `${mode.bodyNote}\n` : ''}${multiShow ? `- Cover all ${competitiveByShow.length} fantasy shows by name. When you cite a placement or score, make the show clear so readers know which ensembles actually faced each other.\n` : ''}${soundSportResults.length > 0 && fieldMode !== 'soundsport' ? `- Include a SoundSport highlight — celebrate the ratings without ever revealing SoundSport scores.\n` : ''}- End with a specific observation or stat from the data, not a rhetorical question or generic send-off.`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      headline: { type: Type.STRING, description: "Top ensemble name and score from the data. No exclamation points, no 'dominates', no invented numbers." },
      summary: { type: Type.STRING, description: "2-3 sentences grounded in tonight's real results: top ensemble, score, margin, one storyline hook. If multiple shows occurred, make that clear." },
      narrative: { type: Type.STRING, description: "600-800 word fantasy article. Uses the exact ensemble names, director names, scores, and show/location values from the DATA block — no invented facts. Coverage depth matches the field size (detail for the top tier, grouped coverage for the rest). Director personalities and quotes may be invented; results may not. Never uses 'dominant', 'commanding', 'stunning', 'heating up'." },
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
    const content = await generateWithFactCheckGuard(prompt, schema, { articleType: "fantasy_daily" });

    // Image subject: the top competitive ensemble when there is one; otherwise
    // the SoundSport Best in Show for soundsport-only nights so the image still
    // reflects the actual subject of the article rather than a generic placeholder.
    const topCorps = topPerformers[0] || soundSportBestInShow || null;

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
      fieldMode === 'soundsport' ? `SoundSport showcase on Day ${reportDay}` : `Performance finale on Day ${reportDay}`,
      corpsLocation,
      uniformDesign,
      reportDay,
      4 // articleIndex 4: Fantasy Daily
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
 * Article 4: Fantasy Market Report
 * Owns buy/hold/sell picks exclusively for the day. The DCI Recap (Article 3)
 * describes the caption landscape; this article translates it into actionable
 * lineup moves on individual DCI captions (GE1, GE2, VP, VA, CG, B, MA, P).
 */
async function generateFantasyRecapArticle({ reportDay, dayScores, trendData, showContext, competitionContext, db, ledger, brief }) {
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

  // Get today's narrative variety
  const variety = getWritingVariety(reportDay, "fantasy_recap");

  const fieldCorpsList = dayScores.map(s => s.corps).join(', ');
  const uniqueCaptionShows = Array.from(new Set(dayScores.map(s => s.showName).filter(Boolean)));
  const multiShowCaption = uniqueCaptionShows.length > 1;

  const prompt = `You are the Fantasy Market Report analyst for marching.art. Fantasy directors pick individual DCI captions (GE1, GE2, VP, VA, CG, B, MA, P) for their lineups — you tell them what to do about it. This is THE picks column; it is the only article in tonight's five that gives buy/hold/sell recommendations. Earlier in the batch a separate DCI Recap already described tonight's caption landscape in depth. Assume the reader has read it. Your job is to translate that landscape into action, not to redo the description.

ACCURACY RULES (read first)
- Every corps name, caption score, and trend arrow you cite MUST come from the DATA block below. Do not invent corps, captions, scores, or trend directions.
- The field tonight has ${dayScores.length} corps (listed below). Do not reference any corps not in this list.
${multiShowCaption ? `- The caption numbers below come from ${uniqueCaptionShows.length} separate shows tonight: ${uniqueCaptionShows.join(', ')}. Corps at different shows did NOT caption-judge against each other — the rankings are a composite across venues. Frame cross-venue picks as such.` : `- All caption numbers tonight come from a single show, so the rankings are a true head-to-head.`}
- Source-year disclosure: on each corps' first mention in the narrative, include their source-year in parentheses — e.g., "Blue Stars (2019)" — so fantasy directors know which season's book they're picking against. Every corps' year is listed in CORPS SOURCE YEARS below.
- If a caption shows "No data" in the DATA block, do not reference it. If a specific number isn't in the data, don't cite a number.

${variety.framing}
Depth: ${variety.depthArea}
Pick style: ${variety.pickStyle}

===== DATA =====
DAY ${reportDay} | FIELD (${dayScores.length}): ${fieldCorpsList}
CORPS SOURCE YEARS: ${dayScores.map(s => `${s.corps} (${s.sourceYear || 'unknown'})`).join(', ')}

CAPTION RANKINGS (top ${Math.min(5, dayScores.length)} per caption):
${captionTypes.map(cap => {
  const topN = stocksByCaption[cap]?.slice(0, 5) || [];
  const capInfo = topN.length > 0 ? topN.map((s, i) => `${i+1}. ${s.corps}: ${s.score.toFixed(2)} ${s.trend === 'up' ? '↑' : s.trend === 'down' ? '↓' : '→'}`).join(' | ') : 'No data';
  return `${cap}: ${capInfo}`;
}).join('\n')}

TRENDING: ↑ ${trendingUp.length} rising${trendingUp.length > 0 ? ` (${trendingUp.slice(0, 5).map(s => `${s.corps} ${s.caption} ${s.score.toFixed(2)}`).join(', ')})` : ''} | ↓ ${trendingDown.length} falling${trendingDown.length > 0 ? ` (${trendingDown.slice(0, 5).map(s => `${s.corps} ${s.caption} ${s.score.toFixed(2)}`).join(', ')})` : ''} | → ${steadyPerformers.length} steady
===== END DATA =====

${toneGuidance}
${formatNegativeSpace(ledger)}
${formatBriefForArticle(brief, 'fantasy_recap')}
BANNED PHRASES: dominant, heating up, intensifies, key area of focus, captivating, absolutely crucial, mid-season phase, upward trend (as a standalone phrase), trajectory (cap at 1 use)

ARTICLE REQUIREMENTS
- Headline: A pick-oriented thesis. Name a specific corps+caption and what to DO with it (e.g., a buy, hold, sell, or fade framing). Use ↑↓→ if it fits. No hype words, no invented numbers.
- Summary: 2-3 sentences that lead with tonight's single highest-conviction pick and one line of reasoning. Every other piece in tonight's batch is descriptive — this one is directive.
- Narrative: 600-800 words, weighted heavily toward the picks. Structure:
  1. Lead with the top BUY (specific corps+caption, the thesis, the score/trend that supports it, who it displaces in a typical lineup).
  2. Cover the remaining BUYs, then HOLDs, then SELLs — each named at the corps+caption level with brief reasoning.
  3. Include one or two lines on caption WEIGHT or SCARCITY where it matters (e.g., a 0.30 swing in a ~20%-weight caption like GE1 is worth roughly 2x the same swing in a ~10% caption like Percussion).
  4. Close with a SLEEPER — one under-the-radar corps+caption most fantasy directors will miss, with the reason it's mispriced.
  Cite specific scores and margins drawn only from the data. Do NOT re-narrate what the DCI Recap already covered — no paragraph-length caption-by-caption play-by-play. Every paragraph should end with a picks-actionable takeaway or be cut.
  Pick style (confident / analytical / contrarian) follows the framing above.`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      headline: { type: Type.STRING, description: "Caption-focused headline with a real corps, specific caption (GE1/B/CG etc), real score from the data, and ↑↓→ trend. No hype words, no invented numbers." },
      summary: { type: Type.STRING, description: "2-3 sentences highlighting tonight's actual caption movements and one clear recommendation drawn from the data." },
      narrative: { type: Type.STRING, description: "700-900 word caption-by-caption analysis. Every corps, caption score, and trend arrow must come from the data block. Section emphasis follows where the real story is. Fun but data-driven." },
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
    const content = await generateWithFactCheckGuard(prompt, schema, {
      articleType: "fantasy_recap",
      fieldCorpsNames: dayScores.map(s => s.corps),
    });

    // Feature the top-scoring corps with photojournalistic image
    const topCorpsForImage = dayScores[0];
    let recapUniformDetails = null;
    if (topCorpsForImage && db) {
      recapUniformDetails = await getUniformDetailsFromFirestore(db, topCorpsForImage.corps, topCorpsForImage.sourceYear);
    }
    // Determine which caption to emphasize based on trending data
    const topTrendingCaption = trendingUp[0]?.fullName || "General Effect";
    const imagePrompt = buildFantasyLeagueImagePrompt(
      topCorpsForImage?.corps,
      topCorpsForImage?.sourceYear,
      topTrendingCaption,
      recapUniformDetails,
      reportDay,
      3 // articleIndex 3: Fantasy Recap
    );

    const imageData = await generateImageWithImagen(imagePrompt);
    const imageResult = await processGeneratedImage(imageData, "fantasy_recap");

    // Headline subject for the coverage ledger. Prefer the corps named in the
    // top BUY recommendation since that's what the headline pitch is built on;
    // fall back to the top-scoring corps used for the image.
    const featuredCorps = content?.recommendations?.buy?.[0]?.corps || topCorpsForImage?.corps || null;

    return {
      type: ARTICLE_TYPES.FANTASY_RECAP,
      ...content,
      featuredCorps,
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
    // Multiple shows can occur on the same day (e.g., DCI Ft. Wayne AND Music On The March),
    // so search across all events and remember which event the corps actually competed at.
    const dayEvents = yearEvents.filter(e => e.offSeasonDay === targetDay);
    if (dayEvents.length === 0) continue;

    let corpsScore = null;
    let matchingEvent = null;
    for (const dayEvent of dayEvents) {
      corpsScore = dayEvent.scores.find(s => s.corps === corpsName);
      if (corpsScore) {
        matchingEvent = dayEvent;
        break;
      }
    }
    if (!corpsScore || !matchingEvent) continue;

    const total = calculateTotal(corpsScore.captions);
    if (total <= 0) continue;

    dayScores.push({
      corps: corpsName,
      sourceYear,
      captions: corpsScore.captions,
      total,
      subtotals: calculateCaptionSubtotals(corpsScore.captions),
      showName: matchingEvent.eventName || matchingEvent.name || null,
      location: matchingEvent.location || null,
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
// Phrase banks used by getTrendNarrative() to pre-compute seeded narrative hints
// per corps. Each list is ~10 variants so a given (corps, day, article) seed has
// meaningful variety across consecutive uses. Any phrase that appears on the
// HARD_BANNED_PATTERNS list must not appear here.
const TREND_NARRATIVES = {
  surging: [
    "on an absolute tear",
    "riding a scorching hot streak",
    "catching fire at exactly the right moment",
    "in the best run of their season",
    "stringing together nightly gains",
    "accelerating faster than the field",
    "compiling a run that reshuffles the power rankings",
    "posting one of the biggest weekly improvements in the field",
    "ahead of their season's trendline by a wide margin",
    "moving up the sheet every time they perform",
  ],
  hot: [
    "building real momentum",
    "on the rise with no sign of slowing",
    "trending upward on the weekly sheets",
    "landing night after night",
    "improving every show they perform",
    "gaining ground on the corps above them",
    "sharper than they were a week ago",
    "hitting form at the right point in the season",
    "carving a clear upward line in recent scores",
    "showing meaningful week-over-week progress",
  ],
  rising: [
    "continuing to climb",
    "making steady gains",
    "showing modest but real improvement",
    "picking up ground show by show",
    "inching upward on the scoresheet",
    "walking their scores up week by week",
    "showing a slow but clear upward pattern",
    "improving at the pace they need to",
    "beginning to close the gap on the tier above",
    "on a gentle incline through the recent slate",
  ],
  sliding: [
    "struggling to find their footing",
    "in an extended rough patch",
    "dealing with a concerning decline",
    "trying to stop the bleeding",
    "losing ground night after night",
    "on the wrong side of the week-over-week picture",
    "falling behind the pace they set earlier in the season",
    "hunting for answers on the field",
    "giving back points they earned in earlier weeks",
    "unable to arrest a multi-day drop",
  ],
  cold: [
    "going through a cold spell",
    "searching for answers",
    "in a frustrating slump",
    "battling inconsistency",
    "off the pace they established earlier",
    "struggling to replicate earlier results",
    "shaking off a bad stretch",
    "down from their recent high-water mark",
    "working through a visibly rough week",
    "below the line they had been tracking toward",
  ],
  cooling: [
    "cooling off slightly",
    "seeing some regression",
    "coming back to earth",
    "experiencing a minor setback",
    "off their recent pace",
    "showing small signs of slowing",
    "taking a modest step back from last week's peak",
    "slightly below their ceiling",
    "losing a little edge night over night",
    "moving sideways after a stronger stretch",
  ],
  steady: [
    "maintaining their form",
    "holding the line",
    "staying the course",
    "delivering reliable performances",
    "turning in the kind of numbers the field expects",
    "landing squarely where the pattern predicts",
    "keeping within their established range",
    "producing performances in the same neighborhood as last week",
    "neither climbing nor slipping",
    "giving the standings no reason to move",
  ],
  consistent: [
    "rock solid show to show",
    "remarkably stable on the sheets",
    "the picture of dependability",
    "executing with precision night after night",
    "a model of reliability",
    "landing within a tight score range week over week",
    "unshakeable in their output",
    "the kind of corps you can almost set a watch by",
    "repeating their performance with near-identical numbers",
    "a flat, reliable signal in a noisy field",
  ],
};

const STREAK_NARRATIVES = {
  up: {
    3: [
      "three straight days of improvement",
      "a three-day winning streak",
      "improvement for the third consecutive day",
      "gains three nights running",
      "a three-show climb",
    ],
    4: [
      "four days of continuous gains",
      "an impressive four-day climb",
      "gains every day this week",
      "four consecutive nights in the green",
      "a four-show upward arc",
    ],
    5: [
      "five straight days trending upward",
      "a remarkable five-day surge",
      "an entire week of improvement",
      "five shows of uninterrupted gains",
      "a full week's climb on the sheets",
    ],
  },
  down: {
    3: [
      "three consecutive days of decline",
      "a three-day skid",
      "dropping for the third day running",
      "losses three nights in a row",
      "three shows of regression",
    ],
    4: [
      "four straight days of regression",
      "a concerning four-day slide",
      "losses every day this week",
      "four consecutive nights in the red",
      "a four-show descent",
    ],
    5: [
      "five days of continuous decline",
      "a five-day freefall",
      "struggling all week",
      "five shows of uninterrupted losses",
      "a full week's slide on the sheets",
    ],
  },
};

const CAPTION_TREND_NARRATIVES = {
  ge: {
    up: [
      "GE scores climbing",
      "connecting better with judges on effect",
      "drawing a stronger emotional response",
      "general effect moments landing harder",
      "effect captions trending the right way",
      "adjudicators rewarding the effect package",
    ],
    down: [
      "GE scores dipping",
      "struggling to land the effect",
      "effect captions not quite hitting",
      "losing points where the book demands them",
      "GE not returning what it used to",
      "effect moments not cashing in on the sheets",
    ],
    stable: [
      "effect scores holding steady",
      "consistent GE output",
      "reliable effect numbers",
      "GE sitting right where it has been",
    ],
  },
  visual: {
    up: [
      "visual program clicking into place",
      "drill execution sharpening",
      "guard and visual coming together",
      "visual caption gaining traction",
      "field product reading cleaner",
      "visual performance matching the design",
    ],
    down: [
      "visual clarity suffering",
      "execution issues on the field",
      "visual program not quite clean",
      "drill losing its edge",
      "guard and visual not in sync",
      "visual captions giving back points",
    ],
    stable: [
      "visual program consistent",
      "reliable execution on the field",
      "drill holding its level",
      "visual numbers steady",
    ],
  },
  music: {
    up: [
      "brass and percussion sharpening",
      "musical program elevating",
      "hornline finding their voice",
      "ensemble sound gaining definition",
      "music captions trending upward",
      "audio product catching up to the book",
    ],
    down: [
      "musical scores slipping",
      "brass not quite as sharp",
      "intonation and balance issues",
      "hornline losing some of its edge",
      "ensemble sound not as tight",
      "music captions giving up ground",
    ],
    stable: [
      "musical program solid",
      "consistent brass and percussion output",
      "hornline holding its level",
      "music numbers stable",
    ],
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
