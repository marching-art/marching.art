// Image prompt builders for news generation: corps/performer avatars,
// user-article images, scene archetypes, and the per-article-type prompt
// builders. Extracted verbatim from newsGeneration.js. Pure string builders;
// the actual image call (generateImageWithImagen) stays in newsGeneration.js.

const {
  getUniformDetails,
  getFantasyUniformDetails,
  buildShowThemeContext,
} = require("./newsUniforms");

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

module.exports = {
  buildCorpsAvatarPrompt,
  buildPerformerAvatarPrompt,
  buildArticleImagePrompt,
  SCENE_ARCHETYPES,
  selectSceneArchetype,
  buildStandingsImagePrompt,
  buildCaptionsImagePrompt,
  buildFantasyPerformersImagePrompt,
  buildFantasyLeagueImagePrompt,
  buildAnalyticsImagePrompt,
  buildUnderdogImagePrompt,
  buildCorpsSpotlightImagePrompt,
};
