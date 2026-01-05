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
      uniform: "maroon with silver metallic accents, 10-year anniversary design with modern athletic fit",
      helmet: "chrome and maroon helmet with anniversary crest",
      brass: "silver brass with commemorative engravings",
      percussion: "maroon shells with silver anniversary graphics",
      guard: "maroon and silver contemporary costumes celebrating corps history",
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
      uniform: "rich scarlet with metallic gold trim, dramatic floor-length red capes with gold lining",
      helmet: "ornate gold-trimmed headpiece with cascading red plume",
      brass: "gold brass with red accents, Spanish-style bell decorations",
      percussion: "red shells with gold flake finish, traditional pit setup",
      guard: "flowing scarlet gowns with gold embroidery, Spanish fans and dramatic silks",
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
      uniform: "electric blue with tilted geometric white patterns, asymmetrical modern design",
      helmet: "white helmet with blue angular accents, no traditional plume",
      brass: "silver brass with blue geometric patterns on bells",
      percussion: "blue drums with white tilted stripe graphics",
      guard: "asymmetrical blue and white athletic costumes with angular silks",
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
      uniform: "forest green with silver modern accents, updated cavalier-inspired athletic design",
      helmet: "modern green helmet with white flowing plume",
      brass: "silver brass with contemporary green accents",
      percussion: "green drums with silver hardware",
      guard: "modern cavalier green and white costumes",
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
      uniform: "crimson and white with maritime SOS theme, signal flag inspired patterns",
      helmet: "white helmet with red signal stripe and plume",
      brass: "silver brass with maritime signal engravings",
      percussion: "red and white drums with SOS patterns",
      guard: "maritime-inspired red and white costumes with signal flag silks",
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

Drum and bugle corps (DCI - Drum Corps International) is a competitive marching arts activity
performed by uniformed musicians on American FOOTBALL FIELDS, not concert stages.

VISUAL CHARACTERISTICS THAT DEFINE DRUM CORPS:
- VENUE: Outdoor football stadium with natural grass or synthetic turf, white yard line markings,
  end zones, hash marks, and stadium seating. Events occur at dusk/night under stadium lights.
- PERFORMERS: 150+ young adults (ages 16-22) in MATCHING MILITARY-STYLE UNIFORMS, not concert attire.
  They march in precise geometric formations while playing brass instruments and drums.
- UNIFORMS: Athletic military-style uniforms with shakos/plumed helmets, white gloves, and
  marching shoes. NOT casual clothes, NOT rock band outfits, NOT concert black.
- INSTRUMENTS: Brass only (no woodwinds): contrabass bugles, mellophones, baritones, trumpets,
  and French horns. All silver or gold lacquered with corps colors on valve caps.
- PERCUSSION: Marching snare drums, tenor drums (quints/quads), bass drums worn on harnesses,
  and a front ensemble (pit) with marimbas/vibraphones on the sideline.
- COLOR GUARD: Performers with 6-foot tall silk flags, rifles, and sabres doing choreography.
- FORMATIONS: Performers arranged in geometric shapes (arcs, blocks, spirals, company fronts)
  on the football field, all facing the press box/audience.

THIS IS NOT:
- A rock concert with stage lighting and mosh pits
- An indoor concert hall performance
- A parade or street marching band
- A high school marching band at a football game halftime
- A symphony orchestra
- Musicians in casual clothes or concert black

The aesthetic is: competitive athletics meets musical performance meets military precision.
Think Olympic ceremony + marching band + Cirque du Soleil, performed on a football field.
`;

/**
 * Negative prompt elements to explicitly exclude concert/rock imagery
 */
const IMAGE_NEGATIVE_PROMPT = `

MUST AVOID (these will make the image incorrect):
- Concert stages, rock concerts, pop concerts, music festivals
- Mosh pits, crowd surfing, standing concert crowds
- Stage lighting rigs, concert spotlights pointed at a stage
- Electric guitars, drum kits on stage, microphone stands
- Casual clothing, t-shirts, jeans on performers
- Indoor concert venues, clubs, bars
- Smoke machines, laser shows (unless specifically requested)
- Single performers or small bands
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
 * @returns {Promise<string>} Base64 image data or URL
 */
async function generateImageWithImagen(prompt) {
  const { genAI: ai } = initializeGemini();

  try {
    // Choose model based on configuration
    // imagen-3.0-generate-001 is the free tier image generation model
    // imagen-4.0-fast-generate-001 is the paid tier ($0.02/image)
    const modelName = USE_IMAGEN_4
      ? "imagen-4.0-fast-generate-001"  // Paid: $0.02/image
      : "imagen-3.0-generate-001";       // Free tier: Imagen 3

    const imageModel = ai.getGenerativeModel({
      model: modelName,
    });

    // Build enhanced prompt with drum corps context to avoid concert imagery
    const enhancedPrompt = `${DRUM_CORPS_VISUAL_CONTEXT}

--- IMAGE REQUEST ---

${prompt}

${IMAGE_NEGATIVE_PROMPT}`;

    // Imagen models use a different API structure than text models
    const result = await imageModel.generateImages({
      prompt: enhancedPrompt,
      config: {
        numberOfImages: 1,
        aspectRatio: "16:9",
        outputMimeType: "image/jpeg",
      },
    });

    // Extract generated image from result
    const generatedImage = result.generatedImages?.[0];
    if (generatedImage?.image?.imageBytes) {
      logger.info(`Image generated successfully using ${modelName}`);
      return `data:image/jpeg;base64,${generatedImage.image.imageBytes}`;
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

// =============================================================================
// COMPOSITION VARIETY - Random elements for unique images
// =============================================================================

/**
 * Camera angles for variety in image composition
 */
const CAMERA_ANGLES = [
  { angle: "field-side, 15 feet from performer, shooting upward slightly", description: "low angle emphasizing power" },
  { angle: "press box level, 50 yards back, telephoto compression", description: "classic broadcast perspective" },
  { angle: "end zone corner, ground level, wide angle", description: "dramatic perspective distortion" },
  { angle: "sideline at the 40, eye level with performers", description: "intimate connection" },
  { angle: "tower shot, 30 feet up, looking down at 45 degrees", description: "formation emphasis" },
  { angle: "behind home plate/backstage area, shooting through the arc", description: "unique backstage angle" },
  { angle: "pit area looking outward toward hornline", description: "front ensemble perspective" },
  { angle: "directly beside performer, profile shot", description: "intimate profile" },
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
  { focus: "single featured performer isolated", framing: "tight crop on individual, background heavily blurred" },
  { focus: "pair of performers in sync", framing: "two performers perfectly matched, medium shot" },
  { focus: "small section of 4-6 performers", framing: "mini-ensemble showing unity" },
  { focus: "full section (12-20 performers)", framing: "wide enough to show section identity" },
  { focus: "interaction between sections", framing: "brass and guard overlap moment" },
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

  return `Photorealistic action photograph from ${showName || "a DCI competition"} ${location ? `in ${location}` : ""}.

SUBJECT: A brass performer from ${topCorps} (${year} season) - ${comp.moment.moment}${showTitle ? ` during their show "${showTitle}"` : ""}.

UNIFORM ACCURACY (CRITICAL):
- Uniform: ${details.uniform}
- Headwear: ${details.helmet}
- Instrument: ${details.brass}
${themeContext}
COMPOSITION & CAMERA:
- Position: ${comp.camera.angle}
- Focus: ${comp.focus.focus} - ${comp.focus.framing}
- Capturing: ${comp.moment.emotion}

LIGHTING & ATMOSPHERE:
- ${comp.lighting.lighting}
- Mood: ${comp.lighting.mood}
- Background: Stadium environment, crowd appropriately blurred for depth

TECHNICAL REQUIREMENTS:
- Camera: Professional sports photography setup (Canon 1DX or Sony A1)
- Style: Editorial sports photography, shallow depth of field where appropriate
- High dynamic range to capture stadium lighting

AUTHENTICITY MARKERS:
- Brass instrument must have realistic valve configurations and tubing
- Uniform must show proper fit and military-precise alignment
- White marching gloves, black marching shoes
- Visible concentration and athletic effort in performer's expression

This is a historic ${year} performance - make it feel like an authentic DCI photograph capturing ${comp.camera.description}.`;
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
  let sectionFocus, sectionDetails, sceneDescription;

  if (captionType.includes("Brass") || captionType.includes("B")) {
    sectionFocus = "hornline";
    sectionDetails = details.brass;
    sceneDescription = `the hornline in ${comp.formation.formation}, bells raised during a powerful moment`;
  } else if (captionType.includes("Percussion") || captionType.includes("P")) {
    sectionFocus = "drumline";
    sectionDetails = details.percussion;
    sceneDescription = `the battery in ${comp.formation.formation}, capturing ${comp.moment.emotion}`;
  } else if (captionType.includes("Guard") || captionType.includes("CG")) {
    sectionFocus = "color guard";
    sectionDetails = details.guard;
    sceneDescription = `guard members in ${comp.formation.formation}, equipment frozen mid-movement`;
  } else if (captionType.includes("Visual") || captionType.includes("V")) {
    sectionFocus = "full corps";
    sectionDetails = details.uniform;
    sceneDescription = `the corps in ${comp.formation.formation}, bodies showing ${comp.formation.visual}`;
  } else {
    // GE or general - show ensemble moment
    sectionFocus = "corps";
    sectionDetails = details.uniform;
    sceneDescription = `an emotional ensemble moment - ${comp.moment.moment}`;
  }

  return `Photorealistic photograph capturing ${featuredCorps}'s ${sectionFocus} excellence during their ${year} season${showTitle ? ` performing "${showTitle}"` : ""}.

SUBJECT: ${sceneDescription}

UNIFORM ACCURACY (CRITICAL):
- Primary: ${details.uniform}
- Headwear: ${details.helmet}
- Section equipment: ${sectionDetails}
${themeContext}
COMPOSITION & CAMERA:
- Position: ${comp.camera.angle}
- Formation: ${comp.formation.formation} - ${comp.formation.visual}
- Background: Stadium environment with crowd, ${location ? `${location} venue` : "competition atmosphere"}

LIGHTING & ATMOSPHERE:
- ${comp.lighting.lighting}
- Mood: ${comp.lighting.mood}
- Shadows and highlights emphasizing body positions and precision

TECHNICAL PHOTOGRAPHY:
- ${comp.focus.framing}
- Motion blur on moving equipment to show action
- High contrast, vibrant colors true to ${featuredCorps} palette

CAPTION EXCELLENCE MARKERS:
- Perfect body alignment showing visual precision
- Equipment positions showing technical mastery
- Unified expression showing ensemble cohesion
- ${comp.moment.emotion}

This photograph should capture why ${featuredCorps} excelled in ${captionType} - showing ${comp.camera.description}.`;
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

    // Generate all 5 articles in parallel, passing show context and db to each
    const articles = await Promise.all([
      generateDciStandingsArticle({ reportDay, dayScores, trendData, activeCorps, showContext, db }),
      generateDciCaptionsArticle({ reportDay, dayScores, captionLeaders, activeCorps, showContext, db }),
      generateFantasyPerformersArticle({ reportDay, fantasyData, showContext, db, dataDocId }),
      generateFantasyLeaguesArticle({ reportDay, fantasyData, showContext }),
      generateDeepAnalyticsArticle({ reportDay, dayScores, trendData, fantasyData, captionLeaders, showContext, db }),
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
async function generateDciStandingsArticle({ reportDay, dayScores, trendData, activeCorps, showContext, db }) {
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

3. NARRATIVE: A 600-800 word article (3-4 paragraphs) that:
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
async function generateDciCaptionsArticle({ reportDay, dayScores, captionLeaders, activeCorps, showContext, db }) {
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

3. NARRATIVE: A detailed 600-800 word analysis (3-4 paragraphs) that:
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

    // Feature the corps excelling in the top caption category
    const featuredCaption = captionLeaders[0];
    const featuredCorps = dayScores.find(s => s.corps === featuredCaption?.leader) || dayScores[0];

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
  `${i + 1}. "${r.corpsName}" (Director: ${r.displayName || 'Anonymous'}) - ${r.totalScore.toFixed(3)} fantasy points`
).join('\n')}

STATISTICS:
- Top Score: ${topScore} points
- Top 10 Average: ${avgScore} points
- Total ensembles competing: ${allResults.length}

WRITE A FANTASY SPORTS CELEBRATION ARTICLE:

1. HEADLINE: Exciting fantasy sports headline celebrating the top performers. Examples: "The Crimson Guard Dominates Day ${reportDay} with ${topScore}-Point Explosion", "Anonymous Director's 'Blue Thunder' Claims Fantasy Crown"

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
    // Filter out SoundSport corps - SoundSport is non-competitive and scores should not be published
    const competitiveResults = results.filter(r => r.corpsClass !== 'soundSport');
    const top3 = competitiveResults.sort((a, b) => b.totalScore - a.totalScore).slice(0, 3);
    return {
      name: formatFantasyEventName(show.showName || show.showId || 'Competition'),
      entrants: competitiveResults.length,
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
async function generateDeepAnalyticsArticle({ reportDay, dayScores, trendData, fantasyData, captionLeaders, showContext, db }) {
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

    // Feature the top trending corps in an analytical aerial shot
    const topTrending = Object.entries(trendData).sort((a,b) => b[1].trendFromAvg - a[1].trendFromAvg)[0];
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
