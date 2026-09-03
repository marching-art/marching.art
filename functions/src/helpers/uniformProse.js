// =============================================================================
// UNIFORM STUDIO — design → exhaustive image-prompt prose
// =============================================================================
// The Studio renders a design from ~80 structured fields (src/types/uniform.ts;
// the server whitelist is FIGURE_FIELDS in uniformValidation.js). The image
// models only see prose, so every one of those fields has to be spelled out
// here or it is silently lost: a director who put a two-tone baldric, a
// detached ombré sleeve, and a fountain plume with mylar on their corps must
// see all three in the generated image. This module walks the figure the same
// way the renderer (src/components/uniform/uniformFigureParts.tsx +
// uniformFigureAssembly.tsx) does and describes what it would draw, part by
// part, with every color named AND pinned to its exact hex.
//
// Sides are described from the VIEWER's perspective, facing the performer —
// the same frame the Studio canvas uses (armL/legL draw on the viewer's left).
// Every prompt that embeds the spec says so.
//
// Pure: no I/O, no logging. Only validated catalog enums and hex values flow
// through here, so nothing needs the «…» untrusted-field delimiters — the
// director's free-text aiHints are delimited by the prompt builders instead.

const { proseColorName } = require("./uniformValidation");

const HEX_RE = /^#[0-9a-f]{6}$/i;

/** Stock procedural-print palettes (mirror PRINT_PALETTES in
 *  src/data/uniformRenderTheme.ts — keep in sync). */
const STOCK_PRINT_COLORS = {
  sunburst: ["#f7dd7a", "#e8952f", "#c23a2a"],
  opart: ["#e08a12", "#f7cf3e", "#8a3a12"],
  pinstripe: ["#efe3c8", "#d3bd90"],
  plaid: ["#d0951c", "#b57712", "#e8c25a"],
  foil: ["#caa03c", "#f2df9a"],
};

/** Hardware metals (METAL_HEX in src/data/uniformCatalog.ts). */
const METAL_HEX = { gold: "#d9a41c", silver: "#cfd4da" };

/** Fixed renderer inks that read as garment detail (FIGURE_INK). */
const INK = {
  spats: "#f2efe6",
  sneaker: "#f4f4f2",
  zipper: "#c9ced6",
  visor: "#0d0d0f",
};

const TORSO_STYLE_PROSE = {
  jacket: "a fitted marching jacket",
  tunic: "an asymmetric draped tunic (one shoulder draped, hem cut on a diagonal)",
  jumpsuit: "a one-piece fitted jumpsuit / unitard (torso and legs one continuous garment)",
  dress:
    "a guard dress: fitted bodice into an A-line skirt with an asymmetric hem (low on the viewer's right, sweeping up on the left so the leggings show underneath)",
  longcoat:
    "a long coat: jacket top carried down into a mid-calf skirt with a center front vent (trousers visible through the split)",
};

const HAT_PROSE = {
  shako: "a tall cylindrical marching shako with a dark patent visor",
  pith: "a rounded pith helmet with a brim",
  campaign: "a campaign hat: tall creased crown with a wide flat brim",
  aussie: "an Aussie slouch hat: tall creased crown with a wide brim pinned up on one side",
  contour: "a contour shako: tall, tapered, modern silhouette with a swept angled top and no visor",
  busby: "a tall fur busby (cylindrical fur hat) with a colored cloth bag draped down one side and a metal chin chain across the front",
};

const ORNAMENT_PROSE = {
  sunburst: "a sunburst plate",
  star: "a star",
  shield: "a crest shield",
  chevron: "stacked chevrons",
  disc: "a round disc",
  diamond: "a diamond",
  rect: "a rectangular patch (an outer field with an inset panel)",
  none: null,
};

const PLUME_PROSE = {
  upright: "a tall French upright plume standing straight up from the crown",
  fountain: "a fountain plume: feathers rising from the crown and spilling outward and down",
  sideFeather: "a feather spray pinned to the side of the hat, sweeping up and out",
  fan: "a quill fan: straight quills spread in a half-circle from a metal boss at the crown",
  cascade: "a tall willow cascade plume: long strands climbing high then spilling down both sides",
};

/** @param {unknown} v */
function isHex(v) {
  return typeof v === "string" && HEX_RE.test(v);
}

/**
 * "forest green (#1f6b3a)" — every color is both named (so the model has a
 * vocabulary word) and pinned (so it targets the exact shade).
 * @param {unknown} hex
 * @returns {string}
 */
function named(hex) {
  if (!isHex(hex)) return "the primary color";
  return `${proseColorName(/** @type {string} */ (hex))} (${String(hex).toLowerCase()})`;
}

/**
 * The colorway's hardware metal as prose, honoring a figure-level override.
 * @param {object} fig
 * @param {object} cw
 */
function metalProse(fig, cw) {
  if (isHex(fig.metal)) {
    const name = proseColorName(fig.metal);
    return `${name} metal (${String(fig.metal).toLowerCase()})`;
  }
  const key = cw && cw.metal === "silver" ? "silver" : "gold";
  return `${key} metal (${METAL_HEX[key]})`;
}

/**
 * Read a gradient stop in either the stored {o, c} shape or a legacy tuple.
 * @param {unknown} stop
 * @returns {{o: string, c: string} | null}
 */
function readStop(stop) {
  if (Array.isArray(stop) && stop.length === 2 && isHex(stop[1])) {
    return { o: String(stop[0]), c: String(stop[1]) };
  }
  if (stop && typeof stop === "object" && isHex(/** @type {any} */ (stop).c)) {
    return { o: String(/** @type {any} */ (stop).o), c: String(/** @type {any} */ (stop).c) };
  }
  return null;
}

/**
 * Describe a director gradient ("url:<id>") from its stops.
 * @param {object} fig
 * @param {string} id
 * @param {string} axis - "top to bottom" / "shoulder to wrist"
 * @returns {string|null}
 */
function gradientProse(fig, id, axis) {
  const stops = fig.grads && fig.grads[id];
  if (!Array.isArray(stops)) return null;
  const parsed = stops.map(readStop).filter(Boolean);
  if (parsed.length < 2) return null;
  const chain = parsed.map((s) => named(s.c)).join(" → ");
  return `a smooth ${axis} gradient (ombré) fading ${chain}`;
}

/**
 * The director's colors for a procedural surface, or the stock palette.
 * @param {object} fig
 * @param {keyof typeof STOCK_PRINT_COLORS} key
 * @returns {string[]}
 */
function printColors(fig, key) {
  const override = fig.printColors && fig.printColors[key];
  const want = STOCK_PRINT_COLORS[key].length;
  if (Array.isArray(override) && override.length === want && override.every(isHex)) {
    return override.map((h) => String(h));
  }
  return STOCK_PRINT_COLORS[key];
}

/**
 * Prose for any fill spec: a hex, a builtin print ref, or a director gradient.
 * @param {object} fig
 * @param {unknown} fill
 * @param {string} axis - gradient direction wording for this surface
 * @returns {string|null}
 */
function fillProse(fig, fill, axis = "top to bottom") {
  if (isHex(fill)) return `solid ${named(fill)}`;
  if (typeof fill !== "string") return null;
  switch (fill) {
    case "url:sun": {
      const [center, mid, outer] = printColors(fig, "sunburst");
      return `a radial sunburst print: rays bursting from a ${named(center)} center through ${named(mid)} to a ${named(outer)} outer edge, darkening toward the hem`;
    }
    case "url:opart": {
      const [base, a, b] = printColors(fig, "opart");
      return `an op-art dot-lattice print: a ${named(base)} base covered in a tight grid of alternating ${named(a)} and ${named(b)} dots with a wavy interference band`;
    }
    case "url:pinstripe": {
      const [base, stripe] = printColors(fig, "pinstripe");
      return `a fine vertical pinstripe: ${named(base)} cloth with thin ${named(stripe)} stripes`;
    }
    case "url:plaid": {
      const [base, band, cross] = printColors(fig, "plaid");
      return `a plaid / tartan print: ${named(base)} ground with ${named(band)} bands and ${named(cross)} cross bands`;
    }
    case "url:foil": {
      const [tone, highlight] = printColors(fig, "foil");
      return `crinkled metallic foil in ${named(tone)} with ${named(highlight)} highlights, scattered with sequins`;
    }
    default:
      if (fill.startsWith("url:")) return gradientProse(fig, fill.slice(4), axis);
      return null;
  }
}

/**
 * A short label for a fill — the one-line summary's vocabulary ("solid maroon
 * (#6d1a26)", "a radial sunburst print", "an ombré gradient").
 * @param {object} fig
 * @param {unknown} fill
 * @param {unknown} fallbackHex
 */
function fillLabel(fig, fill, fallbackHex) {
  if (isHex(fill)) return `solid ${named(fill)}`;
  if (typeof fill === "string") {
    const labels = {
      "url:sun": "a radial sunburst print",
      "url:opart": "an op-art dot-lattice print",
      "url:pinstripe": "a pinstripe print",
      "url:plaid": "a plaid print",
      "url:foil": "metallic foil",
    };
    if (labels[fill]) return labels[fill];
    if (fill.startsWith("url:") && gradientProse(fig, fill.slice(4), "")) return "an ombré gradient";
  }
  return isHex(fallbackHex) ? `solid ${named(fallbackHex)}` : "the primary color";
}

/**
 * Expand the legacy symmetric shorthands (sleeve/gauntlet/glove/pants/stripe)
 * into per-side configs exactly like normalizeFigure() in src/utils/uniform.ts,
 * so a design saved before per-side editing describes both limbs.
 * @param {object} raw
 * @returns {object}
 */
function normalizeFigure(raw) {
  const fig = { torsoStyle: "jacket", ...(raw || {}) };
  let armL = fig.armL;
  let armR = fig.armR;
  if (!armL || !armR) {
    const base = armL ||
      armR || {
        type: "sleeve",
        color: fig.sleeve || fig.jacket || null,
        gauntlet: fig.gauntlet ? { color: fig.gauntlet, sequin: fig.gauntletSequin } : null,
        glove: fig.glove || null,
      };
    armL = armL || base;
    armR = armR || base;
  }
  let legL = fig.legL;
  let legR = fig.legR;
  if (!legL || !legR) {
    const base = legL || legR || { color: fig.pants || null, stripe: fig.stripe || null };
    legL = legL || base;
    legR = legR || base;
  }
  return { ...fig, armL, armR, legL, legR };
}

/**
 * Prose for one arm (viewer's side), or null when the arm draws nothing.
 * @param {object} fig
 * @param {object} arm
 * @param {string} torsoColor - fallback sleeve color prose
 */
function armProse(fig, arm, torsoColor) {
  if (!arm || arm.type === "none") return "no visible arm covering";
  const parts = [];
  if (arm.type === "bare") {
    parts.push("bare arm (no sleeve, skin showing from the shoulder down)");
  } else {
    const fill = fillProse(fig, arm.fill, "shoulder to wrist") || (isHex(arm.color) ? `solid ${named(arm.color)}` : torsoColor);
    parts.push(
      arm.type === "half"
        ? `a rolled half-sleeve ending above the elbow in ${fill}`
        : `a full-length sleeve in ${fill}`
    );
    if (arm.detached) {
      parts.push("the sleeve is DETACHED: bare shoulder and upper arm, the sleeve starting just above the elbow and running to the wrist");
    }
    if (arm.patent) parts.push("patent-vinyl gloss highlight on the sleeve");
    if (arm.glowLine && isHex(arm.glowLine)) {
      parts.push(`a glowing ${named(arm.glowLine)} light-piping line running down the sleeve`);
    }
  }
  if (arm.gauntlet && isHex(arm.gauntlet.color)) {
    parts.push(
      `a flared ${named(arm.gauntlet.color)} gauntlet cuff at the wrist (bell opening toward the elbow)${arm.gauntlet.sequin ? ", covered in sequins" : ""}`
    );
  } else {
    parts.push("no gauntlet cuff");
  }
  parts.push(isHex(arm.glove) ? `${named(arm.glove)} glove` : "BARE HAND (no glove)");
  return parts.join("; ");
}

/**
 * Prose for one leg (viewer's side).
 * @param {object} fig
 * @param {object} leg
 * @param {string} fallback
 */
function legProse(fig, leg, fallback) {
  const l = leg || {};
  const parts = [];
  const fill = fillProse(fig, l.fill, "hip to hem") || (isHex(l.color) ? `solid ${named(l.color)}` : fallback);
  parts.push(`trouser leg in ${fill}`);
  if (l.foil && !(typeof l.fill === "string" && l.fill === "url:foil")) {
    parts.push("metallic-foil treatment with sequins and sheen over the fill");
  }
  if (isHex(l.stripe)) parts.push(`a ${named(l.stripe)} side stripe running down the outer seam`);
  else parts.push("no side stripe");
  if (l.flare) parts.push("flared hem (bell bottom)");
  else if (l.tattered) parts.push("tattered, ragged hem (torn edge)");
  else parts.push("straight hem");
  if (l.sequin) parts.push("a sequin field across the leg");
  return parts.join("; ");
}

/**
 * Chest treatment prose, including every sub-field the renderer reads.
 * @param {object} fig
 * @param {string} metal
 * @returns {string}
 */
function chestProse(fig, metal) {
  const btn = isHex(fig.buttonColor) ? `${named(fig.buttonColor)} buttons` : `${metal} buttons`;
  const shape = fig.chestShape;
  const fade = Array.isArray(fig.chestFade) && fig.chestFade.length === 2 && fig.chestFade.every(isHex)
    ? ` — the band fades top to bottom from ${named(fig.chestFade[0])} to ${named(fig.chestFade[1])}`
    : "";
  const reverse = Boolean(fig.chestReverse);
  const sashRun = reverse
    ? "from the viewer's RIGHT shoulder down to the viewer's LEFT hip"
    : "from the viewer's LEFT shoulder down to the viewer's RIGHT hip";
  const baldricRun = reverse
    ? "from the viewer's LEFT shoulder down to the viewer's RIGHT hip"
    : "from the viewer's RIGHT shoulder down to the viewer's LEFT hip";

  switch (fig.chest) {
    case "braid":
      return `five horizontal rows of ${named(fig.braid)} braid / frog cording across the chest, each row widening toward the waist, with ${btn} at the center of every row`;
    case "sash": {
      const color = named(fig.sash);
      const sequin = fig.sashSequin ? ", covered in sequins" : "";
      if (shape === "triangles") {
        return `a curved TRIANGLE-BLADE sash in ${color}${fade}: a wide blade sweeping ${sashRun} to a point, with a nested darker inner triangle and a ${metal} trim edge${sequin}`;
      }
      if (shape === "tapered") {
        return `a TAPERED diagonal sash in ${color}${fade}, narrowing as it runs ${sashRun}${sequin}`;
      }
      return `a classic diagonal sash band in ${color}${fade}, running ${sashRun}, ending in a short fringe tail at the hip${sequin}`;
    }
    case "baldric": {
      const color = named(fig.baldric);
      const sequin = fig.baldricSequin ? ", covered in sequins" : "";
      const center = isHex(fig.baldricCenter) ? named(fig.baldricCenter) : null;
      if (shape === "triangles") {
        return `a curved TRIANGLE-BLADE baldric in ${color}${fade}: a wide blade sweeping ${baldricRun} to a point, with a nested inner triangle in ${center || "a darker shade of the same color"} and a ${metal} trim edge${sequin}`;
      }
      if (shape === "tapered") {
        return `a TAPERED baldric in ${color}${fade}, narrowing as it runs ${baldricRun}, pinned with a round ${metal} boss at the shoulder${sequin}`;
      }
      return `a classic baldric band in ${color}${fade} running ${baldricRun}${center ? `, with a ${center} center stripe inset along the band (two-tone)` : ""}, pinned with a round ${metal} boss at the shoulder${sequin}`;
    }
    case "plastron":
      return `a plastron chest panel in ${named(fig.panel)} (a broad front panel from the collar to the waist, widening downward) edged in ${named(fig.panelTrim)}, with two columns of four ${metal} buttons down its sides`;
    case "buttons":
      return `two vertical columns of five ${btn} down the chest (double-breasted)`;
    case "swash": {
      const top = fig.swashTop !== false;
      const bottom = fig.swashBottom !== false;
      const sequin = fig.swashSequin === false ? "without sequins" : "covered in sequins";
      const legColor = isHex(fig.swashLegColor) ? named(fig.swashLegColor) : `the same ${named(fig.swash)}`;
      const bits = [];
      if (top) {
        bits.push(
          `a broad curved modern SWASH in ${named(fig.swash)}${fade}, ${sequin}, sweeping ${reverse ? "from the viewer's LEFT shoulder across the chest down to the viewer's RIGHT hip" : "from the viewer's RIGHT shoulder across the chest down to the viewer's LEFT hip"}`
        );
      }
      if (bottom) {
        bits.push(`a matching diagonal swash band across the ${reverse ? "viewer's-right" : "viewer's-left"} upper leg in ${legColor}, ${sequin}`);
      }
      return bits.length ? bits.join("; plus ") : "plain front (no chest treatment)";
    }
    case "vinylPanel":
      return `a glossy vinyl front panel in ${named(fig.panel)} from the collar to the hips with a ${named(INK.zipper)} center zipper, edged in ${isHex(fig.panelTrim) ? named(fig.panelTrim) : named(INK.visor)}`;
    default:
      return "PLAIN front: no braid, no sash, no baldric, no buttons, no chest panel";
  }
}

/**
 * Neck treatment prose.
 * @param {object} fig
 */
function neckProse(fig) {
  const parts = [];
  if (isHex(fig.collar)) {
    parts.push(
      `a standing collar in ${named(fig.collar)}${isHex(fig.collarTrim) ? ` trimmed in ${named(fig.collarTrim)}` : ""}`
    );
  }
  if (fig.mockNeck != null) {
    const fill = fillProse(fig, fig.mockNeck) || "the torso color";
    parts.push(`a mock neck in ${fill}`);
  }
  if (isHex(fig.cowl)) {
    parts.push(`a chunky ${named(fig.cowl)} cowl scarf wrapped around the neck, draping over the upper chest with a tapered tail hanging on the viewer's right`);
  }
  if (fig.crew) parts.push("a plain crew neckline");
  if (isHex(fig.scarf)) parts.push(`a ${named(fig.scarf)} neckerchief knotted at the throat`);
  if (isHex(fig.tie)) parts.push(`a ${named(fig.tie)} tie hanging down the chest`);
  return parts.length ? parts.join("; ") : "open neckline with no collar, scarf, or tie";
}

/**
 * Shoulder regalia prose.
 * @param {object} fig
 * @param {string} metal
 */
function shoulderProse(fig, metal) {
  const parts = [];
  if (isHex(fig.epaulet)) parts.push(`${named(fig.epaulet)} epaulets on both shoulders`);
  else parts.push("no epaulets");
  if (isHex(fig.aiguillette)) {
    parts.push(
      `a drum-major aiguillette: a braided ${named(fig.aiguillette)} cord pinned at the viewer's-left shoulder seam, swinging in two nested loops under the arm and back up to a chest stud, with two ${metal} ferrule tips hanging below`
    );
  }
  if (isHex(fig.suspenders)) parts.push(`${named(fig.suspenders)} suspenders over the torso with brass clips`);
  if (fig.cape && isHex(fig.cape.color)) {
    const side = fig.cape.side === "right" ? "viewer's-right" : "viewer's-left";
    parts.push(
      `a one-shoulder cavalry cape in ${named(fig.cape.color)} draped from the ${side} shoulder over that arm, lining flashing ${isHex(fig.cape.lining) ? named(fig.cape.lining) : "a darker shade"} at the hem, clasped with ${metal} at the collarbone`
    );
  } else {
    parts.push("no cape");
  }
  return parts.join("; ");
}

/**
 * Waist prose.
 * @param {object} fig
 * @param {string} metal
 */
function waistProse(fig, metal) {
  const parts = [];
  if (isHex(fig.belt)) {
    parts.push(`a ${named(fig.belt)} belt with a ${isHex(fig.buckle) ? named(fig.buckle) : metal} buckle`);
  }
  if (isHex(fig.waistBand)) {
    parts.push(
      `a wide ${named(fig.waistBand)} waistband${isHex(fig.waistBandEdge) ? ` edged in ${named(fig.waistBandEdge)}` : ""}`
    );
  }
  if (isHex(fig.fringe)) parts.push(`${named(fig.fringe)} fringe hanging from the hips`);
  if (Array.isArray(fig.streamers) && fig.streamers.length === 2 && fig.streamers.every(isHex)) {
    parts.push(`two long ribbon streamers, ${named(fig.streamers[0])} and ${named(fig.streamers[1])}, hanging from the waist`);
  }
  return parts.length ? parts.join("; ") : "no belt, waistband, fringe, or streamers (clean waist)";
}

/**
 * Headwear + plume prose.
 * @param {object} fig
 * @param {string} metal
 * @returns {{ headwear: string, plume: string, hasHat: boolean, hasPlume: boolean }}
 */
function headProse(fig, metal) {
  const hat = fig.hat || {};
  const type = fig.hatType;
  if (!type || !HAT_PROSE[type]) {
    const hair = fig.hairShow
      ? `hair visible${isHex(fig.hair) ? ` in ${named(fig.hair)}` : ""}`
      : "hair slicked back / hidden";
    return {
      headwear: `NO HEADWEAR — bareheaded, ${hair}. Do not add a shako, helmet, hat, or plume.`,
      plume: "none",
      hasHat: false,
      hasPlume: false,
    };
  }
  const parts = [HAT_PROSE[type]];
  parts.push(`body in ${named(hat.body)}`);
  if (isHex(hat.band)) {
    parts.push(
      type === "busby"
        ? `the draped bag in ${named(hat.band)}`
        : `a ${named(hat.band)} band${type === "shako" ? " at the top and bottom of the shako" : ""}`
    );
  }
  const ornamentKey = hat.ornament != null ? hat.ornament : type === "shako" ? "sunburst" : type === "pith" ? "disc" : null;
  const ornament = ornamentKey ? ORNAMENT_PROSE[ornamentKey] : null;
  if (ornament) {
    const where = type === "aussie" ? "on the pinned-up side of the brim" : "on the front";
    parts.push(`${ornament} ${where} in ${isHex(hat.emblem) ? named(hat.emblem) : metal}`);
  } else {
    parts.push("no front plate or badge (bare face)");
  }
  if (type === "aussie") {
    parts.push(`brim pinned up on the ${hat.flip ? "viewer's LEFT" : "viewer's RIGHT"} side`);
  }
  if (type === "busby") parts.push(`${metal} chin chain`);

  const plume = fig.plume;
  let plumeText = "NO plume on the hat";
  let hasPlume = false;
  if (plume && PLUME_PROSE[plume.type] && isHex(plume.color)) {
    hasPlume = true;
    const bits = [`${PLUME_PROSE[plume.type]}, ${named(plume.color)}`];
    if (isHex(plume.accent)) {
      bits.push(
        plume.type === "upright"
          ? `with the upper tip dyed ${named(plume.accent)} (two-tone)`
          : `with alternating sprays dyed ${named(plume.accent)} (two-tone)`
      );
    }
    if (plume.mylar) bits.push("with sparkling mylar strands mixed into the feathers");
    plumeText = bits.join(", ");
  }
  return { headwear: parts.join(", "), plume: plumeText, hasHat: true, hasPlume };
}

/**
 * Torso surface + finish prose.
 * @param {object} fig
 * @param {object} cw - the colorway (primary is the torso fallback)
 * @returns {{ torso: string, torsoShort: string, finish: string, torsoColor: string }}
 */
function torsoProse(fig, cw) {
  const style = TORSO_STYLE_PROSE[fig.torsoStyle] || TORSO_STYLE_PROSE.jacket;
  const base = isHex(fig.jacket) ? fig.jacket : cw.primary;
  const fill = fillProse(fig, fig.torsoFill) || (isHex(base) ? `solid ${named(base)}` : "the primary color");
  const finishes = [];
  if (fig.velvet) finishes.push("velvet (deep matte nap with soft sheen)");
  if (fig.satin) finishes.push("satin (smooth glossy sheen)");
  if (fig.patent) finishes.push("patent vinyl (hard wet-look gloss highlights)");
  if (fig.iridescent) finishes.push("iridescent (color-shifting angle sheen: teal → violet → pink → gold)");
  if (fig.lame) finishes.push("lamé (dense woven-metal micro-shimmer)");
  if (fig.torsoSequin) finishes.push("a field of sequins across the whole torso");
  if (fig.glow && isHex(fig.glowArt)) {
    finishes.push(`glowing ${named(fig.glowArt)} line-art / light piping traced across the torso`);
  }
  return {
    torso: `${style} in ${fill}`,
    torsoShort: `${style.split(":")[0].split(" (")[0]} in ${fillLabel(fig, fig.torsoFill, base)}`,
    finish: finishes.length ? finishes.join("; ") : "matte fabric, no sheen, no sequins, no glow",
    torsoColor: fill,
  };
}

/**
 * Chest badge prose.
 * @param {object} fig
 */
function badgeProse(fig) {
  const b = fig.chestBadge;
  if (!b || !ORNAMENT_PROSE[b.shape] || !isHex(b.color)) return "no chest badge or patch";
  const where = b.flip ? "viewer's-left breast" : "viewer's-right breast";
  return `${ORNAMENT_PROSE[b.shape]} badge on the ${where} in ${named(b.color)}${isHex(b.accent) ? ` with ${named(b.accent)} inner detail (two-tone)` : ""}`;
}

/**
 * Feet prose.
 * @param {object} fig
 */
function feetProse(fig) {
  const parts = [];
  if (fig.sneaker) parts.push(`white athletic sneakers (${INK.sneaker}) with laces`);
  else parts.push(`${isHex(fig.shoe) ? named(fig.shoe) : "black (#141414)"} marching shoes`);
  if (fig.spats) parts.push(`white spats (${INK.spats}) buttoned over the shoes`);
  else parts.push("no spats");
  return parts.join("; ");
}

/**
 * Build the exhaustive part-by-part spec for a v2 design.
 *
 * @param {object} design - `{ colorway, figure }` (an equipped snapshot or a
 *   wardrobe design). Tolerates a missing/partial figure.
 * @returns {{
 *   lines: string[],
 *   block: string,
 *   summary: string,
 *   headwear: string,
 *   plume: string,
 *   gloves: string,
 *   footwear: string,
 *   chest: string,
 *   symmetric: boolean,
 *   hasHat: boolean,
 *   hasPlume: boolean,
 *   absent: string[],
 * }}
 */
function describeFigure(design) {
  const cw = (design && design.colorway) || {};
  const fig = normalizeFigure(design && design.figure);
  const metal = metalProse(fig, cw);

  const { torso, torsoShort, finish, torsoColor } = torsoProse(fig, cw);
  const chest = chestProse(fig, metal);
  const badge = badgeProse(fig);
  const neck = neckProse(fig);
  const shoulders = shoulderProse(fig, metal);
  const waist = waistProse(fig, metal);
  const head = headProse(fig, metal);
  const feet = feetProse(fig);

  const armL = armProse(fig, fig.armL, torsoColor);
  const armR = armProse(fig, fig.armR, torsoColor);
  const legL = legProse(fig, fig.legL, torsoColor);
  const legR = legProse(fig, fig.legR, torsoColor);
  const armsSame = armL === armR;
  const legsSame = legL === legR;

  const lines = [
    `COLORWAY: primary ${named(cw.primary)}, secondary ${named(cw.secondary)}, accent ${named(cw.accent)}; all hardware, buttons, and trim metal are ${metal}`,
    `TORSO: ${torso}`,
    `FABRIC FINISH: ${finish}`,
    `CHEST: ${chest}`,
    `CHEST BADGE: ${badge}`,
    `NECK: ${neck}`,
    `SHOULDERS: ${shoulders}`,
    `WAIST: ${waist}`,
    armsSame
      ? `ARMS (both identical): ${armL}`
      : `ARMS ARE ASYMMETRIC — viewer's LEFT arm: ${armL} || viewer's RIGHT arm: ${armR}`,
    legsSame
      ? `LEGS (both identical): ${legL}`
      : `LEGS ARE ASYMMETRIC — viewer's LEFT leg: ${legL} || viewer's RIGHT leg: ${legR}`,
    `FEET: ${feet}`,
    `HEADWEAR: ${head.headwear}`,
    `PLUME: ${head.plume}`,
  ];

  // Explicit absences: the details image models most often invent.
  const absent = [];
  if (!head.hasHat) absent.push("headwear of any kind");
  if (head.hasHat && !head.hasPlume) absent.push("plume");
  if (!isHex(fig.armL.glove) && !isHex(fig.armR.glove)) absent.push("gloves (hands are bare)");
  if (!fig.armL.gauntlet && !fig.armR.gauntlet) absent.push("gauntlet cuffs");
  if (!isHex(fig.epaulet)) absent.push("epaulets");
  if (!fig.cape) absent.push("cape");
  if (!fig.chest || fig.chest === "none") absent.push("sash, baldric, braid, or chest panel");
  if (!isHex(fig.belt)) absent.push("belt");
  if (!fig.spats) absent.push("spats");

  const gloves = (() => {
    const l = fig.armL.glove;
    const r = fig.armR.glove;
    if (!isHex(l) && !isHex(r)) return "bare hands — NO gloves";
    if (isHex(l) && isHex(r)) {
      if (l.toLowerCase() === r.toLowerCase()) return `${named(l)} gloves`;
      return `${named(l)} glove on the viewer's left hand, ${named(r)} glove on the viewer's right hand`;
    }
    return isHex(l)
      ? `${named(l)} glove on the viewer's left hand only; the viewer's right hand is BARE`
      : `${named(r)} glove on the viewer's right hand only; the viewer's left hand is BARE`;
  })();

  const chestLabels = {
    braid: "braid rows across the chest",
    sash: "a diagonal sash",
    baldric: "a baldric",
    plastron: "a plastron chest panel",
    buttons: "double-breasted button columns",
    swash: "a sequined modern swash",
    vinylPanel: "a zippered vinyl front panel",
  };
  const summary = [
    torsoShort,
    fig.chest && chestLabels[fig.chest] ? `with ${chestLabels[fig.chest]}` : null,
    head.hasHat ? `${HAT_PROSE[fig.hatType].split(":")[0].replace(/^an? /, "")} in ${named((fig.hat || {}).body)}` : "bareheaded",
    head.hasPlume ? `${(fig.plume || {}).type} plume in ${named((fig.plume || {}).color)}` : null,
    `${gloves}`,
    feet.split(";")[0],
  ]
    .filter(Boolean)
    .join(", ");

  return {
    lines,
    block: lines.map((l) => `- ${l}`).join("\n"),
    summary,
    headwear: head.headwear,
    plume: head.plume,
    gloves,
    footwear: feet,
    chest,
    symmetric: armsSame && legsSame,
    hasHat: head.hasHat,
    hasPlume: head.hasPlume,
    absent,
  };
}

module.exports = {
  describeFigure,
  normalizeFigure,
  fillProse,
  named,
  STOCK_PRINT_COLORS,
};
