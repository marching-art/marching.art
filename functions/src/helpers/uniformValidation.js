// =============================================================================
// UNIFORM STUDIO — server-side design validation + v1-compat derivation
// =============================================================================
// The single gate every wardrobe write passes through. A v2 design is pure
// structured data: catalog enums plus hex channels — no free text ever renders
// on another player's screen (the only prose lives in aiHints, which is
// prompt-only). Validation therefore whitelists every key, bounds every
// string, and re-builds the object from validated fields so unknown keys are
// stripped rather than stored. Mirrors the client-side shapes in
// src/types/uniform.ts and the limits in src/utils/uniform.ts.

const HEX_RE = /^#[0-9a-f]{6}$/i;
const GRAD_ID_RE = /^[a-z][a-z0-9]{0,11}$/i;
const DESIGN_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

const MAX_NAME = 60;
const MAX_DESIGN_BYTES = 8 * 1024;
const MAX_WARDROBE_DESIGNS = 24;

const METALS = new Set(["gold", "silver"]);
const TORSO_STYLES = new Set(["jacket", "tunic", "jumpsuit", "dress"]);
const CHESTS = new Set([
  "none",
  "braid",
  "sash",
  "baldric",
  "plastron",
  "buttons",
  "swash",
  "vinylPanel",
]);
const HATS = new Set(["shako", "pith", "campaign", "aussie", "contour", "busby"]);
const HAT_ORNAMENTS = new Set([
  "sunburst",
  "star",
  "shield",
  "chevron",
  "disc",
  "diamond",
  "rect",
  "none",
]);
const CHEST_SHAPES = new Set(["band", "triangles", "tapered"]);
const PLUMES = new Set(["upright", "fountain", "sideFeather"]);
const ARM_TYPES = new Set(["sleeve", "bare", "half", "none"]);
const PRINTS = new Set(["sunburst", "opart", "pinstripe"]);
// Editable color slots per procedural surface — mirrors PRINT_COLOR_SLOT_COUNTS
// in src/utils/uniform.ts; keep the two in sync.
const PRINT_COLOR_SLOT_COUNTS = {
  sunburst: 3,
  opart: 3,
  pinstripe: 2,
  plaid: 3,
  foil: 2,
};
const BUILTIN_FILL_REFS = new Set([
  "url:sun",
  "url:opart",
  "url:pinstripe",
  "url:plaid",
  "url:foil",
]);

/** @param {unknown} v */
function isHex(v) {
  return typeof v === "string" && HEX_RE.test(v);
}

/**
 * Compact [primary, secondary, accent] hex triple for score-sheet colorway
 * strips, from an equipped design's colorway. Null unless all three are valid
 * hex — recap/standings rows are world-readable, so nothing unvalidated rides
 * along.
 * @param {any} colorway
 * @returns {string[] | null}
 */
function colorwayStrip(colorway) {
  if (!colorway || typeof colorway !== "object") return null;
  const trio = [colorway.primary, colorway.secondary, colorway.accent];
  return trio.every(isHex) ? trio.map((h) => h.toLowerCase()) : null;
}

/**
 * A fill is a hex color or a reference to a procedural def: a builtin print
 * ref or a url:<gradId> naming a gradient declared in figure.grads.
 * @param {unknown} v
 * @param {Set<string>} gradRefs
 */
function isFill(v, gradRefs) {
  if (isHex(v)) return true;
  if (typeof v !== "string") return false;
  return BUILTIN_FILL_REFS.has(v) || gradRefs.has(v);
}

/** @param {unknown} v @param {number} max */
function isBoundedString(v, max) {
  return typeof v === "string" && v.length > 0 && v.length <= max;
}

/**
 * Read a gradient stop's offset+color from either the stored object shape
 * ({ o, c }) or a legacy [offset, hex] tuple. Stops are ALWAYS persisted as
 * objects — Firestore rejects an array nested directly inside another array,
 * so a tuple stop cannot be written (it surfaces to the client as a bare 500).
 * Accepting both here keeps saves working during a client/function co-deploy,
 * when an older cached client may still send tuples. Returns null for anything
 * that is neither shape.
 * @param {unknown} stop
 * @returns {{ o: unknown, c: unknown } | null}
 */
function readGradStop(stop) {
  if (Array.isArray(stop)) {
    return stop.length === 2 ? { o: stop[0], c: stop[1] } : null;
  }
  if (stop && typeof stop === "object") {
    return { o: /** @type {any} */ (stop).o, c: /** @type {any} */ (stop).c };
  }
  return null;
}

/**
 * Validate one arm config.
 * @param {any} a @param {Set<string>} gradRefs @param {string[]} errors @param {string} label
 */
function checkArm(a, gradRefs, errors, label) {
  if (a == null) return;
  if (typeof a !== "object" || Array.isArray(a)) {
    errors.push(`${label} must be an object`);
    return;
  }
  const allowed = new Set([
    "type",
    "fill",
    "color",
    "detached",
    "patent",
    "glowLine",
    "gauntlet",
    "glove",
  ]);
  for (const k of Object.keys(a)) {
    if (!allowed.has(k)) errors.push(`${label}.${k} is not a recognized field`);
  }
  if (!ARM_TYPES.has(a.type)) errors.push(`${label}.type is invalid`);
  if (a.fill != null && !isFill(a.fill, gradRefs)) errors.push(`${label}.fill is invalid`);
  if (a.color != null && !isHex(a.color)) errors.push(`${label}.color is invalid`);
  if (a.glowLine != null && !isHex(a.glowLine)) errors.push(`${label}.glowLine is invalid`);
  if (a.glove != null && !isHex(a.glove)) errors.push(`${label}.glove is invalid`);
  if (a.gauntlet != null) {
    if (typeof a.gauntlet !== "object" || !isHex(a.gauntlet.color)) {
      errors.push(`${label}.gauntlet is invalid`);
    }
  }
}

/**
 * Validate one leg config.
 * @param {any} l @param {Set<string>} gradRefs @param {string[]} errors @param {string} label
 */
function checkLeg(l, gradRefs, errors, label) {
  if (l == null) return;
  if (typeof l !== "object" || Array.isArray(l)) {
    errors.push(`${label} must be an object`);
    return;
  }
  const allowed = new Set(["color", "fill", "stripe", "flare", "tattered", "foil", "sequin"]);
  for (const k of Object.keys(l)) {
    if (!allowed.has(k)) errors.push(`${label}.${k} is not a recognized field`);
  }
  if (l.color != null && !isHex(l.color)) errors.push(`${label}.color is invalid`);
  if (l.fill != null && !isFill(l.fill, gradRefs)) errors.push(`${label}.fill is invalid`);
  if (l.stripe != null && !isHex(l.stripe)) errors.push(`${label}.stripe is invalid`);
}

// Per-key validators for the figure. `hex` = nullable hex; `bool` = boolean.
const FIGURE_FIELDS = {
  skin: "hexRequired",
  hairShow: "bool",
  hair: "hex",
  torsoStyle: "torsoStyle",
  torsoFill: "fill",
  jacket: "hex",
  print: "print",
  printColors: "printColors",
  plaid: "bool",
  grads: "grads",
  foilLeg: "bool",
  glow: "bool",
  glowArt: "hex",
  velvet: "bool",
  patent: "bool",
  satin: "bool",
  iridescent: "bool",
  lame: "bool",
  torsoSequin: "bool",
  chest: "chest",
  chestBadge: "chestBadge",
  chestShape: "chestShape",
  chestReverse: "bool",
  chestFade: "hexPair",
  buttonColor: "hex",
  braid: "hex",
  sash: "hex",
  sashSequin: "bool",
  baldric: "hex",
  baldricCenter: "hex",
  baldricSequin: "bool",
  panel: "hex",
  panelTrim: "hex",
  swash: "hex",
  swashSequin: "bool",
  swashTop: "bool",
  swashBottom: "bool",
  swashLegColor: "hex",
  metal: "hex",
  collar: "hex",
  collarTrim: "hex",
  mockNeck: "fill",
  cowl: "hex",
  crew: "bool",
  scarf: "hex",
  tie: "hex",
  epaulet: "hex",
  // drum-major regalia (prestige: saving requires the Drum Major title,
  // helpers/uniformEntitlements) — the cord color; tips take the metal
  aiguillette: "hex",
  suspenders: "hex",
  belt: "hex",
  buckle: "hex",
  waistBand: "hex",
  waistBandEdge: "hex",
  fringe: "hex",
  streamers: "streamers",
  armL: "arm",
  armR: "arm",
  legL: "leg",
  legR: "leg",
  sleeve: "hex",
  gauntlet: "hex",
  gauntletSequin: "bool",
  glove: "hex",
  pants: "hex",
  stripe: "hex",
  shoe: "hex",
  sneaker: "bool",
  spats: "bool",
  hatType: "hatType",
  hat: "hat",
  plume: "plume",
  cape: "cape",
};

/**
 * Validate a figure config. Returns error strings (empty = valid).
 * @param {any} figure
 * @returns {string[]}
 */
function validateFigure(figure) {
  /** @type {string[]} */
  const errors = [];
  if (figure == null || typeof figure !== "object" || Array.isArray(figure)) {
    return ["figure must be an object"];
  }
  // gradient refs declared by this figure
  const gradRefs = new Set();
  if (figure.grads != null) {
    if (typeof figure.grads !== "object" || Array.isArray(figure.grads)) {
      errors.push("figure.grads must be an object");
    } else {
      const entries = Object.entries(figure.grads);
      if (entries.length > 4) errors.push("figure.grads allows at most 4 gradients");
      for (const [id, stops] of entries) {
        if (!GRAD_ID_RE.test(id)) {
          errors.push(`figure.grads id "${id}" is invalid`);
          continue;
        }
        if (!Array.isArray(stops) || stops.length < 2 || stops.length > 6) {
          errors.push(`figure.grads.${id} needs 2-6 stops`);
          continue;
        }
        for (const stop of stops) {
          const s = readGradStop(stop);
          if (
            !s ||
            typeof s.o !== "string" ||
            s.o.length > 6 ||
            Number.isNaN(Number(s.o)) ||
            !isHex(s.c)
          ) {
            errors.push(`figure.grads.${id} has an invalid stop`);
            break;
          }
        }
        gradRefs.add(`url:${id}`);
      }
    }
  }

  for (const [key, value] of Object.entries(figure)) {
    const kind = FIGURE_FIELDS[/** @type {keyof typeof FIGURE_FIELDS} */ (key)];
    if (!kind) {
      errors.push(`figure.${key} is not a recognized field`);
      continue;
    }
    if (value == null) continue; // null clears any optional field
    switch (kind) {
      case "hexRequired":
      case "hex":
        if (!isHex(value)) errors.push(`figure.${key} must be a #rrggbb color`);
        break;
      case "bool":
        if (typeof value !== "boolean") errors.push(`figure.${key} must be a boolean`);
        break;
      case "fill":
        if (!isFill(value, gradRefs)) errors.push(`figure.${key} is invalid`);
        break;
      case "torsoStyle":
        if (!TORSO_STYLES.has(value)) errors.push(`figure.torsoStyle is invalid`);
        break;
      case "print":
        if (!PRINTS.has(value)) errors.push(`figure.print is invalid`);
        break;
      case "printColors":
        if (typeof value !== "object" || Array.isArray(value)) {
          errors.push("figure.printColors must be an object");
          break;
        }
        for (const [surface, colors] of Object.entries(value)) {
          const want =
            PRINT_COLOR_SLOT_COUNTS[/** @type {keyof typeof PRINT_COLOR_SLOT_COUNTS} */ (surface)];
          if (!want) {
            errors.push(`figure.printColors.${surface} is not a recognized print`);
            continue;
          }
          if (colors == null) continue; // null clears the override
          if (!Array.isArray(colors) || colors.length !== want || !colors.every(isHex)) {
            errors.push(`figure.printColors.${surface} must be ${want} #rrggbb colors`);
          }
        }
        break;
      case "chest":
        if (!CHESTS.has(value)) errors.push(`figure.chest is invalid`);
        break;
      case "chestBadge":
        if (
          typeof value !== "object" ||
          Array.isArray(value) ||
          !HAT_ORNAMENTS.has(value.shape) ||
          !isHex(value.color) ||
          (value.accent != null && !isHex(value.accent)) ||
          (value.flip != null && typeof value.flip !== "boolean") ||
          Object.keys(value).some((k) => !["shape", "color", "accent", "flip"].includes(k))
        ) {
          errors.push("figure.chestBadge is invalid");
        }
        break;
      case "chestShape":
        if (!CHEST_SHAPES.has(value)) errors.push(`figure.chestShape is invalid`);
        break;
      case "cape":
        if (
          typeof value !== "object" ||
          Array.isArray(value) ||
          !isHex(value.color) ||
          (value.lining != null && !isHex(value.lining)) ||
          (value.side != null && value.side !== "left" && value.side !== "right") ||
          Object.keys(value).some((k) => !["color", "lining", "side"].includes(k))
        ) {
          errors.push("figure.cape is invalid");
        }
        break;
      case "hatType":
        if (!HATS.has(value)) errors.push(`figure.hatType is invalid`);
        break;
      case "hat":
        if (
          typeof value !== "object" ||
          !isHex(value.body) ||
          (value.band != null && !isHex(value.band)) ||
          (value.emblem != null && !isHex(value.emblem)) ||
          (value.ornament != null && !HAT_ORNAMENTS.has(value.ornament)) ||
          (value.flip != null && typeof value.flip !== "boolean") ||
          Object.keys(value).some((k) => !["body", "band", "emblem", "ornament", "flip"].includes(k))
        ) {
          errors.push("figure.hat is invalid");
        }
        break;
      case "plume":
        if (
          typeof value !== "object" ||
          !PLUMES.has(value.type) ||
          !isHex(value.color) ||
          (value.accent != null && !isHex(value.accent)) ||
          (value.mylar != null && typeof value.mylar !== "boolean") ||
          Object.keys(value).some((k) => !["type", "color", "accent", "mylar"].includes(k))
        ) {
          errors.push("figure.plume is invalid");
        }
        break;
      case "streamers":
      case "hexPair":
        if (!Array.isArray(value) || value.length !== 2 || !value.every(isHex)) {
          errors.push(`figure.${key} must be two #rrggbb colors`);
        }
        break;
      case "arm":
        checkArm(value, gradRefs, errors, `figure.${key}`);
        break;
      case "leg":
        checkLeg(value, gradRefs, errors, `figure.${key}`);
        break;
      case "grads":
        break; // validated above, before the per-key loop
      default:
        errors.push(`figure.${key} could not be validated`);
    }
  }
  if (!isHex(figure.skin)) errors.push("figure.skin is required");
  return errors;
}

/**
 * Validate a full UniformDesignV2 payload. Returns error strings (empty =
 * valid). Callers store the SANITIZED copy from sanitizeDesign(), never the
 * raw payload.
 * @param {any} design
 * @returns {string[]}
 */
function validateDesign(design) {
  /** @type {string[]} */
  const errors = [];
  if (design == null || typeof design !== "object" || Array.isArray(design)) {
    return ["design must be an object"];
  }
  if (design.schema !== 2) errors.push("design.schema must be 2");
  if (!isBoundedString(design.name, MAX_NAME)) {
    errors.push(`design.name is required (max ${MAX_NAME} chars)`);
  }
  const cw = design.colorway;
  if (
    cw == null ||
    typeof cw !== "object" ||
    !isHex(cw.primary) ||
    !isHex(cw.secondary) ||
    !isHex(cw.accent) ||
    !METALS.has(cw.metal)
  ) {
    errors.push("design.colorway is invalid");
  }
  errors.push(...validateFigure(design.figure));
  const hints = design.aiHints;
  if (hints != null) {
    if (typeof hints !== "object" || Array.isArray(hints)) {
      errors.push("design.aiHints must be an object");
    } else {
      if (hints.mascotOrEmblem != null && !isBoundedString(hints.mascotOrEmblem, 50)) {
        errors.push("aiHints.mascotOrEmblem is too long");
      }
      if (hints.additionalNotes != null && !isBoundedString(hints.additionalNotes, 300)) {
        errors.push("aiHints.additionalNotes is too long");
      }
      if (hints.themeKeywords != null) {
        const kw = hints.themeKeywords;
        if (!Array.isArray(kw) || kw.length > 10 || !kw.every((k) => isBoundedString(k, 20))) {
          errors.push("aiHints.themeKeywords is invalid");
        }
      }
    }
  }
  try {
    if (JSON.stringify(design).length > MAX_DESIGN_BYTES) {
      errors.push(`design exceeds the ${MAX_DESIGN_BYTES}-byte limit`);
    }
  } catch {
    errors.push("design is not serializable");
  }
  return errors;
}

/**
 * Normalize a validated grads map to the stored object-stop shape ({ o, c }),
 * converting any legacy [offset, hex] tuples. Stops MUST be stored as objects:
 * Firestore forbids an array nested directly inside another array, so a tuple
 * stop cannot be persisted. Call only after validateFigure passed (every stop
 * is a readable pair here). null passes through (clears the field).
 * @param {any} grads
 * @returns {Record<string, Array<{o: unknown, c: unknown}>> | null}
 */
function normalizeGrads(grads) {
  if (grads == null) return null;
  /** @type {Record<string, Array<{o: unknown, c: unknown}>>} */
  const out = {};
  for (const [id, stops] of Object.entries(grads)) {
    out[id] = /** @type {any[]} */ (stops).map((stop) => {
      const s = readGradStop(stop);
      return { o: s.o, c: s.c };
    });
  }
  return out;
}

/**
 * Deep-copy exactly the validated fields (unknown keys stripped). Call only
 * after validateDesign() returned no errors.
 * @param {any} design
 */
function sanitizeDesign(design) {
  /** @type {Record<string, unknown>} */
  const figure = {};
  for (const key of Object.keys(FIGURE_FIELDS)) {
    if (design.figure[key] === undefined) continue;
    // grads stops must be stored as objects, never [offset, hex] tuples —
    // Firestore rejects an array nested directly in another array.
    figure[key] =
      key === "grads"
        ? normalizeGrads(design.figure.grads)
        : JSON.parse(JSON.stringify(design.figure[key]));
  }
  /** @type {Record<string, unknown>} */
  const out = {
    schema: 2,
    name: design.name,
    colorway: {
      primary: design.colorway.primary,
      secondary: design.colorway.secondary,
      accent: design.colorway.accent,
      metal: design.colorway.metal,
    },
    figure,
  };
  if (design.aiHints != null) {
    /** @type {Record<string, unknown>} */
    const hints = {};
    if (design.aiHints.mascotOrEmblem != null) hints.mascotOrEmblem = design.aiHints.mascotOrEmblem;
    if (design.aiHints.additionalNotes != null) hints.additionalNotes = design.aiHints.additionalNotes;
    if (design.aiHints.themeKeywords != null) hints.themeKeywords = design.aiHints.themeKeywords;
    if (Object.keys(hints).length > 0) out.aiHints = hints;
  }
  return out;
}

// =============================================================================
// V1-COMPAT DERIVATION — keeps the AI/news prompt pipeline working unchanged
// =============================================================================

// Compact named palette for hex -> prose (nearest by RGB distance).
const PROSE_COLORS = [
  ["maroon", 0x6d1a26],
  ["crimson red", 0xb3121c],
  ["scarlet", 0xc23a2a],
  ["burnt orange", 0xc2571f],
  ["sunset orange", 0xe8641f],
  ["marigold", 0xe8952f],
  ["gold", 0xd9a41c],
  ["champagne gold", 0xe8c25a],
  ["cream", 0xece2cc],
  ["pearl white", 0xf4f2ec],
  ["arctic white", 0xf7f5f0],
  ["silver", 0xcfd4da],
  ["storm gray", 0x9a9a94],
  ["charcoal gray", 0x3d3d3d],
  ["obsidian black", 0x141414],
  ["midnight blue", 0x101c33],
  ["deep navy", 0x0e1630],
  ["navy blue", 0x1d2f66],
  ["royal blue", 0x2b3fbf],
  ["azure blue", 0x2f6fd0],
  ["electric blue", 0x4fc3ff],
  ["ice blue", 0xdfe6f2],
  ["ocean teal", 0x3f9a8c],
  ["mint green", 0xcdeee0],
  ["forest green", 0x256b3a],
  ["emerald green", 0x2e8148],
  ["khaki tan", 0xc9b287],
  ["saddle brown", 0x4a3421],
  ["plum purple", 0x6d1f3f],
  ["royal purple", 0x4b2a6b],
  ["bronze", 0x8f6d20],
];

/**
 * Nearest prose color name for a hex value.
 * @param {string} hex
 */
function proseColorName(hex) {
  if (!isHex(hex)) return "blue";
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  let best = "blue";
  let bestD = Infinity;
  for (const [name, value] of PROSE_COLORS) {
    const num = /** @type {number} */ (value);
    const dr = r - ((num >> 16) & 255);
    const dg = g - ((num >> 8) & 255);
    const db = b - (num & 255);
    const d = dr * dr + dg * dg + db * db;
    if (d < bestD) {
      bestD = d;
      best = /** @type {string} */ (name);
    }
  }
  return best;
}

const HAT_TO_V1 = {
  shako: "shako",
  campaign: "aussie",
  aussie: "aussie",
  pith: "modern",
  contour: "modern",
};

/**
 * Derive the v1 prose fields from a v2 design so the existing AI avatar and
 * news-image prompt pipeline (newsUniforms.getFantasyUniformDetails) keeps
 * working without server changes. Merged over the corps' existing v1 design
 * so avatar preferences (avatarStyle/avatarSection) survive.
 * @param {any} design - a sanitized v2 design
 * @param {any} existingV1 - the corps' current uniformDesign (may be null)
 */
function deriveV1Compat(design, existingV1) {
  const fig = design.figure || {};
  /** @type {string} */
  let style = "contemporary";
  if (fig.print || fig.glowArt || fig.foilLeg) style = "avant-garde";
  else if (
    fig.streamers ||
    fig.fringe ||
    fig.patent ||
    (fig.legL && fig.legL.tattered) ||
    (fig.legR && fig.legR.tattered)
  ) {
    style = "theatrical";
  } else if (fig.sneaker || fig.chest === "swash") style = "athletic";
  else if (fig.chest === "braid" || fig.chest === "buttons" || fig.chest === "plastron") {
    style = "traditional";
  }

  const helmetStyle = fig.hatType
    ? HAT_TO_V1[/** @type {keyof typeof HAT_TO_V1} */ (fig.hatType)] || "themed"
    : "none";
  const plumeDescription = fig.plume
    ? `${fig.plume.type === "fountain" ? "fountain" : "tall upright"} plume in ${proseColorName(fig.plume.color)}`
    : "";

  return {
    ...(existingV1 || {}),
    primaryColor: proseColorName(design.colorway.primary),
    secondaryColor: proseColorName(design.colorway.secondary),
    accentColor: proseColorName(design.colorway.accent),
    style,
    helmetStyle,
    plumeDescription,
    ...(design.aiHints && design.aiHints.mascotOrEmblem
      ? { mascotOrEmblem: design.aiHints.mascotOrEmblem }
      : {}),
    ...(design.aiHints && design.aiHints.themeKeywords
      ? { themeKeywords: design.aiHints.themeKeywords }
      : {}),
    ...(design.aiHints && design.aiHints.additionalNotes
      ? { additionalNotes: design.aiHints.additionalNotes }
      : {}),
  };
}

// ---------------------------------------------------------------------------
// Uniform codes (§7.1): MA-XXXX-XX from an unambiguous charset (no 0/O/1/I/L)
// ---------------------------------------------------------------------------

const CODE_CHARSET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const UNIFORM_CODE_RE = /^MA-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{2}$/;

/**
 * Mint a share code. ~30^6 ≈ 729M combinations — collisions are handled by
 * the caller re-rolling against the codes collection.
 * @param {() => number} [rand] - Uniform [0,1) source, injectable for tests.
 * @returns {string}
 */
function generateUniformCode(rand = Math.random) {
  const pick = () => CODE_CHARSET[Math.floor(rand() * CODE_CHARSET.length)];
  const four = pick() + pick() + pick() + pick();
  return `MA-${four}-${pick()}${pick()}`;
}

module.exports = {
  DESIGN_ID_RE,
  MAX_WARDROBE_DESIGNS,
  UNIFORM_CODE_RE,
  generateUniformCode,
  validateDesign,
  sanitizeDesign,
  deriveV1Compat,
  proseColorName,
  colorwayStrip,
};
