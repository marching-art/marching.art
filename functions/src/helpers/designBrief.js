// =============================================================================
// THE DESIGN BRIEF — weekly auto-scored styling contest (UNIFORM_STUDIO.md §7.4)
// =============================================================================
// A themed brief rotates weekly (deterministically, from a hand-authored
// pool); a submitted design is scored 0-100 from what the design ALREADY IS —
// pure catalog/trait analysis, no subjective judging (the FMA veterans' rule:
// deterministic side game, cosmetic stakes). Every want the brief lists is
// reported back as matched or missed, so a score is always explainable and
// chaseable in the Studio.
//
// Everything here is pure (no Firestore, no clock reads — callers pass the
// date), so the rotation, trait analysis, and scoring pin down in unit tests.

/** Weekly participation token (first scored submission each week). */
const BRIEF_REWARD = 25;

const HEX_RE = /^#[0-9a-f]{6}$/i;

// -----------------------------------------------------------------------------
// WEEK ROTATION
// -----------------------------------------------------------------------------

/**
 * ISO-8601 week id in UTC, e.g. "2026-W35". Weeks start Monday, so the brief
 * flips Monday 00:00 UTC everywhere at once.
 * @param {Date} date
 */
function weekIdFor(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // Shift to the Thursday of this week; its year is the ISO year.
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Small stable string hash (fnv-ish) for the rotation. @param {string} s */
function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** @param {string} weekId */
function briefForWeek(weekId) {
  return BRIEF_POOL[hashString(weekId) % BRIEF_POOL.length];
}

// -----------------------------------------------------------------------------
// TRAIT ANALYSIS
// -----------------------------------------------------------------------------

/** @param {string} hex -> {r,g,b} in [0,1] */
function rgb(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16) / 255,
    g: parseInt(hex.slice(3, 5), 16) / 255,
    b: parseInt(hex.slice(5, 7), 16) / 255,
  };
}

/** Relative-luminance-ish lightness, saturation, and hue for one hex. */
function colorMetrics(hex) {
  const { r, g, b } = rgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const sat = max === 0 ? 0 : (max - min) / max;
  let hue = 0;
  if (max !== min) {
    if (max === r) hue = ((g - b) / (max - min)) % 6;
    else if (max === g) hue = (b - r) / (max - min) + 2;
    else hue = (r - g) / (max - min) + 4;
    hue = (hue * 60 + 360) % 360;
  }
  return { lum, sat, hue };
}

/**
 * Everything the scorer can see in a design, as a Set of trait tags.
 * Palette tags (dark/bright/warm/cool/bold/muted) come from the colorway;
 * the rest read the figure's own catalog fields — the Infinity Nikki trick:
 * infinitely repeatable content from items that already exist.
 *
 * @param {Object} design a validated UniformDesignV2 ({colorway, figure}).
 * @returns {Set<string>}
 */
function analyzeDesign(design) {
  const traits = new Set();
  const fig = design.figure || {};
  const cw = design.colorway || {};

  // --- palette, from the three colorway channels ---
  const hexes = [cw.primary, cw.secondary, cw.accent].filter(
    (h) => typeof h === "string" && HEX_RE.test(h)
  );
  if (hexes.length === 3) {
    const metrics = hexes.map(colorMetrics);
    const avgLum = metrics.reduce((s, m) => s + m.lum, 0) / 3;
    const avgSat = metrics.reduce((s, m) => s + m.sat, 0) / 3;
    if (avgLum < 0.28) traits.add("dark");
    if (avgLum > 0.55) traits.add("bright");
    if (avgSat > 0.45) traits.add("bold");
    if (avgSat < 0.18) traits.add("muted");
    const saturated = metrics.filter((m) => m.sat > 0.15);
    const warm = saturated.filter((m) => m.hue < 70 || m.hue > 320).length;
    const cool = saturated.filter((m) => m.hue >= 150 && m.hue <= 290).length;
    if (warm >= 2) traits.add("warm");
    if (cool >= 2) traits.add("cool");
  }
  if (cw.metal === "gold") traits.add("metalGold");
  if (cw.metal === "silver") traits.add("metalSilver");

  // --- headwear ---
  if (fig.hatType) traits.add(fig.hatType); // shako | pith | campaign | aussie | contour
  if (fig.plume) {
    traits.add("plume");
    if (fig.plume.type === "fountain") traits.add("fountain");
    if (fig.plume.type === "sideFeather") traits.add("sideFeather");
    if (fig.plume.accent) traits.add("twoTone");
  }

  // --- chest ---
  if (fig.chest && fig.chest !== "none") traits.add(fig.chest);
  if (fig.chestShape === "triangles") traits.add("triangles");
  if (fig.chestShape === "tapered") traits.add("tapered");
  if (fig.chestBadge && fig.chestBadge.shape && fig.chestBadge.shape !== "none") {
    traits.add("badge");
  }
  if (fig.baldricCenter) traits.add("twoTone");
  if (Array.isArray(fig.chestFade)) traits.add("fade");

  // --- finishes & fabrics ---
  const arms = [fig.armL, fig.armR].filter(Boolean);
  const legs = [fig.legL, fig.legR].filter(Boolean);
  if (
    fig.torsoSequin ||
    fig.sashSequin ||
    fig.baldricSequin ||
    fig.gauntletSequin ||
    (fig.chest === "swash" && fig.swashSequin !== false) ||
    arms.some((a) => a.gauntlet && a.gauntlet.sequin) ||
    legs.some((l) => l.sequin || l.foil)
  ) {
    traits.add("sequins");
  }
  if (fig.grads && Object.keys(fig.grads).length > 0) traits.add("fade");
  if (fig.print || fig.plaid || fig.foilLeg) traits.add("print");
  if (fig.glow || fig.glowArt || arms.some((a) => a.glowLine)) traits.add("glow");
  if (fig.velvet) traits.add("velvet");
  if (fig.patent || arms.some((a) => a.patent)) traits.add("patent");
  if (fig.satin) traits.add("satin");

  // --- extremities & extras ---
  if (fig.gauntlet || arms.some((a) => a.gauntlet)) traits.add("gauntlet");
  if (fig.spats) traits.add("spats");
  if (fig.sneaker) traits.add("sneakers");
  if (fig.crew) traits.add("crew");
  if (fig.streamers) traits.add("streamers");
  if (legs.some((l) => l.tattered)) traits.add("tattered");
  if (arms.some((a) => a.type === "bare" || a.detached)) traits.add("bareArms");

  // --- era lean: count the cues, majority wins (both possible on a tie) ---
  const classicCues = ["shako", "pith", "campaign", "aussie", "sash", "baldric", "braid", "plastron", "spats", "plume"];
  const modernCues = ["contour", "swash", "vinylPanel", "crew", "sneakers", "glow", "print", "bareArms", "patent"];
  const classicScore = classicCues.filter((t) => traits.has(t)).length;
  const modernScore = modernCues.filter((t) => traits.has(t)).length;
  if (classicScore >= modernScore && classicScore > 0) traits.add("classic");
  if (modernScore >= classicScore && modernScore > 0) traits.add("modern");

  return traits;
}

// -----------------------------------------------------------------------------
// THE POOL
// -----------------------------------------------------------------------------
// Each want: {tags, label, points} — matched when the design carries ANY of
// the listed tags. Points per brief total 100. Labels are player-facing (the
// score breakdown IS the design guidance), so they describe looks, not tags.

const BRIEF_POOL = [
  {
    id: "midnight-classic",
    title: "Midnight Classic",
    blurb: "The corps takes the field under the lights in something old-school and dark as the sky.",
    wants: [
      { tags: ["dark"], label: "A dark palette", points: 25 },
      { tags: ["classic"], label: "A classic-era silhouette", points: 25 },
      { tags: ["shako"], label: "A shako up top", points: 20 },
      { tags: ["plume"], label: "A plume", points: 15 },
      { tags: ["sash", "baldric"], label: "A diagonal sash or baldric", points: 15 },
    ],
  },
  {
    id: "toy-soldiers",
    title: "Toy Soldiers",
    blurb: "March straight out of the music box: crisp, buttoned, and bright.",
    wants: [
      { tags: ["bright"], label: "A bright palette", points: 15 },
      { tags: ["classic"], label: "A classic-era silhouette", points: 20 },
      { tags: ["shako"], label: "A shako up top", points: 20 },
      { tags: ["braid", "buttons", "plastron"], label: "Braid rows, buttons, or a plastron", points: 25 },
      { tags: ["spats"], label: "Spats on the feet", points: 20 },
    ],
  },
  {
    id: "thunderstorm",
    title: "Thunderstorm",
    blurb: "The sky goes green-black and the downpour hits mid-ballad.",
    wants: [
      { tags: ["dark"], label: "A dark palette", points: 25 },
      { tags: ["cool"], label: "Cool storm tones", points: 15 },
      { tags: ["fade"], label: "A color fade somewhere", points: 25 },
      { tags: ["glow"], label: "Glow piping or line art", points: 20 },
      { tags: ["modern"], label: "A modern silhouette", points: 15 },
    ],
  },
  {
    id: "frontier-parade",
    title: "Frontier Parade",
    blurb: "Sun-bleached hats and hometown main streets — the touring corps of another century.",
    wants: [
      { tags: ["aussie", "campaign"], label: "An aussie or campaign hat", points: 25 },
      { tags: ["classic"], label: "A classic-era silhouette", points: 25 },
      { tags: ["warm"], label: "Warm tones", points: 15 },
      { tags: ["twoTone"], label: "A two-tone treatment", points: 20 },
      { tags: ["gauntlet"], label: "Gauntlets at the wrist", points: 15 },
    ],
  },
  {
    id: "chrome-age",
    title: "Chrome Age",
    blurb: "The 2000s arrive: tall hats, silver everything, and seats full of glitter.",
    wants: [
      { tags: ["contour"], label: "A contour shako", points: 20 },
      { tags: ["modern"], label: "A modern silhouette", points: 25 },
      { tags: ["metalSilver"], label: "Silver hardware", points: 15 },
      { tags: ["sequins"], label: "Sequins that read from the box", points: 25 },
      { tags: ["bright"], label: "A bright palette", points: 15 },
    ],
  },
  {
    id: "garden-party",
    title: "Garden Party",
    blurb: "A summer lawn show: light on its feet, loud with pattern.",
    wants: [
      { tags: ["bright"], label: "A bright palette", points: 25 },
      { tags: ["warm"], label: "Warm tones", points: 20 },
      { tags: ["print"], label: "A procedural print", points: 25 },
      { tags: ["sneakers"], label: "Athletic sneakers", points: 15 },
      { tags: ["crew"], label: "A crew neck", points: 15 },
    ],
  },
  {
    id: "heraldry",
    title: "Heraldry",
    blurb: "Crests, badges, and a corps that looks like it guards a castle.",
    wants: [
      { tags: ["badge"], label: "A chest badge", points: 30 },
      { tags: ["baldric"], label: "A baldric", points: 20 },
      { tags: ["classic"], label: "A classic-era silhouette", points: 20 },
      { tags: ["metalGold"], label: "Gold hardware", points: 15 },
      { tags: ["dark"], label: "A dark palette", points: 15 },
    ],
  },
  {
    id: "starlight-blades",
    title: "Starlight Blades",
    blurb: "Cream satin, big triangles, horns to the box — 1993 forever.",
    wants: [
      { tags: ["triangles"], label: "The triangle-blade sash or baldric", points: 30 },
      { tags: ["bright"], label: "A bright palette", points: 20 },
      { tags: ["classic"], label: "A classic-era silhouette", points: 15 },
      { tags: ["plume"], label: "A plume", points: 20 },
      { tags: ["bold"], label: "Bold saturated color", points: 15 },
    ],
  },
  {
    id: "op-art-invasion",
    title: "Op-Art Invasion",
    blurb: "The field starts moving before the drill does.",
    wants: [
      { tags: ["print"], label: "A procedural print", points: 30 },
      { tags: ["modern"], label: "A modern silhouette", points: 25 },
      { tags: ["bold"], label: "Bold saturated color", points: 20 },
      { tags: ["bareArms"], label: "Bare or detached sleeves", points: 10 },
      { tags: ["dark"], label: "A dark palette", points: 15 },
    ],
  },
  {
    id: "arctic-formal",
    title: "Arctic Formal",
    blurb: "White tie at forty below: pale, precise, immaculate.",
    wants: [
      { tags: ["bright"], label: "A pale, bright palette", points: 30 },
      { tags: ["muted"], label: "Restrained saturation", points: 20 },
      { tags: ["classic"], label: "A classic-era silhouette", points: 20 },
      { tags: ["plume"], label: "A plume", points: 15 },
      { tags: ["spats"], label: "Spats on the feet", points: 15 },
    ],
  },
  {
    id: "brass-and-velvet",
    title: "Brass & Velvet",
    blurb: "A theater curtain that learned to march.",
    wants: [
      { tags: ["velvet"], label: "A velvet sheen", points: 30 },
      { tags: ["warm"], label: "Warm tones", points: 20 },
      { tags: ["classic"], label: "A classic-era silhouette", points: 20 },
      { tags: ["braid"], label: "Braid rows", points: 15 },
      { tags: ["metalGold"], label: "Gold hardware", points: 15 },
    ],
  },
  {
    id: "future-corps",
    title: "Future Corps",
    blurb: "Twenty years from now, the finals encore is played in this.",
    wants: [
      { tags: ["modern"], label: "A modern silhouette", points: 30 },
      { tags: ["glow"], label: "Glow piping or line art", points: 25 },
      { tags: ["cool"], label: "Cool tones", points: 20 },
      { tags: ["vinylPanel", "patent"], label: "Vinyl or patent gloss", points: 15 },
      { tags: ["sneakers"], label: "Athletic sneakers", points: 10 },
    ],
  },
  {
    id: "harvest-tour",
    title: "Harvest Tour",
    blurb: "Late-August corn country: dust, gold hours, and a hat brim against the sun.",
    wants: [
      { tags: ["warm"], label: "Warm tones", points: 30 },
      { tags: ["aussie"], label: "An aussie slouch hat", points: 20 },
      { tags: ["classic"], label: "A classic-era silhouette", points: 20 },
      { tags: ["muted"], label: "Restrained saturation", points: 15 },
      { tags: ["streamers"], label: "Streamers off the hip", points: 15 },
    ],
  },
  {
    id: "sequin-cathedral",
    title: "Sequin Cathedral",
    blurb: "Stained glass at 180 beats per minute.",
    wants: [
      { tags: ["sequins"], label: "Sequins that read from the box", points: 35 },
      { tags: ["dark"], label: "A dark palette", points: 20 },
      { tags: ["metalGold"], label: "Gold hardware", points: 15 },
      { tags: ["fade"], label: "A color fade somewhere", points: 15 },
      { tags: ["sash"], label: "A diagonal sash", points: 15 },
    ],
  },
  {
    id: "two-tone-thunder",
    title: "Two-Tone Thunder",
    blurb: "Every piece answers itself in a second color.",
    wants: [
      { tags: ["twoTone"], label: "A two-tone treatment", points: 30 },
      { tags: ["bold"], label: "Bold saturated color", points: 25 },
      { tags: ["sash", "baldric"], label: "A diagonal sash or baldric", points: 15 },
      { tags: ["plume"], label: "A plume", points: 15 },
      { tags: ["modern"], label: "A modern silhouette", points: 15 },
    ],
  },
  {
    id: "ghost-corps",
    title: "Ghost Corps",
    blurb: "The legend says they still march the old fairground on foggy nights.",
    wants: [
      { tags: ["muted"], label: "Restrained saturation", points: 25 },
      { tags: ["dark"], label: "A dark palette", points: 25 },
      { tags: ["tattered"], label: "A tattered edge", points: 20 },
      { tags: ["fountain"], label: "A fountain plume", points: 15 },
      { tags: ["glow"], label: "Glow piping or line art", points: 15 },
    ],
  },
];

// -----------------------------------------------------------------------------
// SCORING
// -----------------------------------------------------------------------------

/**
 * Score a design against a brief: sum of matched wants (the pool authors each
 * brief to 100). Returns the full matched/missed breakdown so the score is
 * always explainable.
 *
 * @param {Object} brief a BRIEF_POOL entry.
 * @param {Object} design a validated UniformDesignV2.
 * @returns {{score: number, matched: Array<{label: string, points: number}>,
 *   missed: Array<{label: string, points: number}>}}
 */
function scoreBrief(brief, design) {
  const traits = analyzeDesign(design);
  const matched = [];
  const missed = [];
  for (const want of brief.wants) {
    const hit = want.tags.some((tag) => traits.has(tag));
    (hit ? matched : missed).push({ label: want.label, points: want.points });
  }
  const score = Math.min(
    100,
    matched.reduce((sum, w) => sum + w.points, 0)
  );
  return { score, matched, missed };
}

module.exports = {
  BRIEF_REWARD,
  BRIEF_POOL,
  weekIdFor,
  briefForWeek,
  analyzeDesign,
  scoreBrief,
};
