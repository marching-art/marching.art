// Uniform and show-theme knowledge base for news/image generation:
// hardcoded DCI uniform descriptions, fantasy corps theme database, and the
// lookup/interpretation helpers built on them. Extracted verbatim from
// newsGeneration.js.

const { logger } = require("firebase-functions/v2");

const { DCI_UNIFORMS } = require("./dciUniforms");
const { proseColorName } = require("./uniformValidation");
const { describeFigure } = require("./uniformProse");


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
 * Resolve the equipped Uniform Studio (v2) design that should drive a corps' AI
 * imagery from a raw corps entry (the `corps.{class}` object on a user profile).
 *
 * The equipped `uniform` snapshot — `{ colorway, figure, aiHints, name }` — is
 * the single source of truth for a corps' look (hornline, percussion, and drum
 * major all wear this identity). When the corps also has a distinct guard look
 * equipped (`uniformGuard` — the show's costume, which routinely differs from the
 * corps identity), it is bundled on as `.guard` so imagery can dress the color
 * guard in the show's own colors. Returns null when the corps has no equipped
 * design (a fresh corps that never visited the Studio), in which case callers
 * fall back to name/theme defaults.
 *
 * @param {object|null} corpsData - A raw corps entry (`corps.{class}`).
 * @returns {object|null} The equipped v2 design snapshot (optionally with a
 *   `.guard` sub-design), or null.
 */
function resolveCorpsUniform(corpsData) {
  if (!corpsData || typeof corpsData !== "object") return null;
  const snapshot = corpsData.uniform;
  if (!(snapshot && snapshot.colorway && typeof snapshot.colorway.primary === "string")) {
    return null;
  }
  const guard = corpsData.uniformGuard;
  const hasGuard = guard && guard.colorway && typeof guard.colorway.primary === "string";
  return hasGuard ? { ...snapshot, guard } : snapshot;
}

// Figure-shape → prose descriptors. These read the structured v2 `figure` the
// Uniform Studio renders and turn it into the natural-language cues the image
// models need, replacing the retired v1 prose fields.
const STYLE_DESCRIPTIONS = {
  traditional: "classic military-style with precise tailoring",
  contemporary: "modern athletic cut with clean lines",
  theatrical: "dramatic flowing design with stage presence",
  athletic: "performance-focused streamlined design",
  "avant-garde": "bold experimental design pushing boundaries",
};


/**
 * Classify a v2 figure into one of the five uniform "styles" — the same
 * heuristic the studio's own design language uses, so the prose cue matches what
 * the director actually built (prints/glow read avant-garde, streamers/fringe
 * read theatrical, and so on).
 * @param {object} fig - a v2 `figure` config
 * @returns {keyof typeof STYLE_DESCRIPTIONS}
 */
function styleFromFigure(fig) {
  if (fig.print || fig.glowArt || fig.foilLeg) return "avant-garde";
  if (
    fig.streamers ||
    fig.fringe ||
    fig.patent ||
    (fig.legL && fig.legL.tattered) ||
    (fig.legR && fig.legR.tattered)
  ) {
    return "theatrical";
  }
  if (fig.sneaker || fig.chest === "swash") return "athletic";
  if (fig.chest === "braid" || fig.chest === "buttons" || fig.chest === "plastron") {
    return "traditional";
  }
  return "contemporary";
}

/**
 * Describe a color-guard costume from the guard's OWN equipped design so the
 * guard is rendered in the show's colors, not the hornline's. The guard slot
 * (`corps.{class}.uniformGuard`) is a full v2 design in its own right; the
 * director dresses the guard to the season's production, which routinely differs
 * from the corps identity the brass and percussion wear. The one-line summary
 * here is what the legacy `guard` field carries; the exhaustive part-by-part
 * spec rides along as `guardSpec` on the details object.
 * @param {object} guard - an equipped v2 guard design snapshot.
 * @returns {string}
 */
function describeGuardCostume(guard) {
  const cw = guard.colorway || {};
  const p = proseColorName(cw.primary);
  const s = proseColorName(cw.secondary);
  const a = proseColorName(cw.accent);
  const named = (name, hex) => (typeof hex === "string" ? `${name} (${hex})` : name);
  const spec = describeFigure(guard);
  return `color guard in distinct show costumes — ${spec.summary} — in ${named(p, cw.primary)} and ${named(s, cw.secondary)} with ${named(a, cw.accent)} accents, carrying themed silks`;
}

/**
 * Build the image/prompt "details" object for a corps from its equipped Uniform
 * Studio (v2) design — the single source of truth. Consumes `{ colorway, figure,
 * aiHints }` and returns the same shape every image/avatar prompt builder reads
 * (colors, uniform, helmet, brass, guard, plus the color names, hex channels,
 * mascot, theme keywords, and derived style the builders reference). Each color
 * is named and pinned to its exact hex so the model targets the director's true
 * shade rather than a nearest-name approximation.
 *
 * When the design carries a separate guard look (`design.guard`), the guard is
 * described from that design so the color guard renders in the show's colors
 * rather than the hornline's. The hornline, percussion, and drum major always
 * wear the primary design.
 *
 * @param {object} design - an equipped v2 design snapshot (optionally with a
 *   `.guard` sub-design for the color guard's show look).
 * @param {string} corpsName - the fantasy corps name.
 * @param {string|null} [location] - the corps home location.
 * @returns {object} The uniform details.
 */
function getUniformDetailsFromDesign(design, corpsName, location = null) {
  const cw = design.colorway || {};
  const fig = design.figure || {};
  const hints = design.aiHints || {};

  const primaryName = proseColorName(cw.primary);
  const secondaryName = proseColorName(cw.secondary);
  const accentName = proseColorName(cw.accent);
  const metal = cw.metal === "silver" ? "silver" : "gold";

  const named = (name, hex) => (typeof hex === "string" ? `${name} (${hex})` : name);
  const colors = `${named(primaryName, cw.primary)} with ${named(secondaryName, cw.secondary)} and ${named(accentName, cw.accent)}`;

  const style = styleFromFigure(fig);
  const mascot = hints.mascotOrEmblem || null;
  const themeKeywords = Array.isArray(hints.themeKeywords) ? hints.themeKeywords : [];

  // The exhaustive part-by-part spec: every field the Studio renders, named
  // and hex-pinned (helpers/uniformProse). `uniform`/`helmet` stay as the
  // one-line cues older prompt slots read; `figureSpec` is the full block.
  const spec = describeFigure(design);

  const helmet = spec.hasHat ? `${spec.headwear}; plume: ${spec.plume}` : spec.headwear;

  // The guard wears its own equipped show look when the director set one;
  // otherwise it coordinates with the corps colors.
  const hasGuardLook = Boolean(
    design.guard && design.guard.colorway && typeof design.guard.colorway.primary === "string"
  );
  const guard = hasGuardLook
    ? describeGuardCostume(design.guard)
    : `coordinated ${primaryName} and ${secondaryName} costumes with themed silks`;

  return {
    colors,
    uniform: `${STYLE_DESCRIPTIONS[style]} uniform — ${spec.summary}${mascot ? `, featuring ${mascot} emblem` : ""}`,
    helmet,
    brass: `${secondaryName}-accented brass instruments with ${primaryName} valve caps and ${metal} hardware`,
    percussion: `${primaryName} drums with ${secondaryName} hardware and corps graphics`,
    guard,
    hasDistinctGuardLook: hasGuardLook,
    matchedTheme: "director-custom",
    additionalNotes: hints.additionalNotes || null,
    location,
    // Fields the avatar prompt builders reference directly.
    primaryColor: primaryName,
    secondaryColor: secondaryName,
    accentColor: accentName,
    primaryHex: cw.primary,
    secondaryHex: cw.secondary,
    accentHex: cw.accent,
    mascotOrEmblem: mascot,
    themeKeywords,
    style,
    // The full design, part by part — what the image prompts embed verbatim.
    figureSpec: spec.block,
    figureSpecLines: spec.lines,
    gloves: spec.gloves,
    footwear: spec.footwear,
    absent: spec.absent,
    symmetric: spec.symmetric,
    guardSpec: hasGuardLook ? describeFigure(design.guard).block : null,
    // Rendered Studio snapshots (set by equipUniformDesign when the client
    // could rasterize the figure) — attached to image calls as ground truth.
    previewUrl: typeof design.previewUrl === "string" ? design.previewUrl : null,
    guardPreviewUrl:
      hasGuardLook && typeof design.guard.previewUrl === "string" ? design.guard.previewUrl : null,
  };
}

/**
 * Get fantasy corps uniform based on director-provided design OR name analysis
 * Priority: Director's uniformDesign > Name-based theme matching > Default colors
 *
 * @param {string} corpsName - The fantasy corps name
 * @param {string} location - The corps home location (for regional themes)
 * @param {object} design - The equipped Uniform Studio (v2) design snapshot
 *   (`{ colorway, figure, aiHints }`), or null to fall back to name/theme cues.
 */
function getFantasyUniformDetails(corpsName, location = null, design = null) {
  // PRIORITY 1: the director's own equipped Uniform Studio design, when set.
  if (design && design.colorway && typeof design.colorway.primary === "string") {
    return getUniformDetailsFromDesign(design, corpsName, location);
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

module.exports = {
  DCI_UNIFORMS,
  FANTASY_THEMES,
  getUniformDetails,
  getUniformDetailsFromFirestore,
  getShowTitleFromFirestore,
  interpretShowTheme,
  buildShowThemeContext,
  getFantasyUniformDetails,
  getUniformDetailsFromDesign,
  resolveCorpsUniform,
};
