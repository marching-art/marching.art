// =============================================================================
// UNIFORM STUDIO — pure helpers: color math, normalization, v1 migration
// =============================================================================
// Everything here is deterministic and side-effect free so it can back both
// the renderer and unit tests. Server-side validation lives in
// functions/src/callable/uniformStudio.js and mirrors the bounds used here.

import type { CorpsUniformDesign } from '../types';
import type {
  ArmConfig,
  FigureConfig,
  LegConfig,
  PrintColorKey,
  UniformColorway,
  UniformDesignV2,
} from '../types/uniform';
import { COLOR_NAME_TO_HEX, METAL_HEX, UNIFORM_PRESETS } from '../data/uniformCatalog';
import { FIGURE_INK, PRINT_PALETTES } from '../data/uniformRenderTheme';

// =============================================================================
// COLOR MATH
// =============================================================================

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_RE.test(value);
}

/** Clamp any fill value to a renderable color (invalid input → neutral). */
export function safeHex(value: unknown): string {
  return isHexColor(value) ? value.toLowerCase() : FIGURE_INK.fallback;
}

function channel(hex: string, shift: (c: number) => number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, Math.round(shift((n >> 16) & 255))));
  const g = Math.min(255, Math.max(0, Math.round(shift((n >> 8) & 255))));
  const b = Math.min(255, Math.max(0, Math.round(shift(n & 255))));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export function darkenHex(hex: string, f: number): string {
  return channel(safeHex(hex), (c) => c * (1 - f));
}

export function lightenHex(hex: string, f: number): string {
  return channel(safeHex(hex), (c) => c + (255 - c) * f);
}

// =============================================================================
// FIGURE NORMALIZATION (legacy symmetric shorthands → per-side configs)
// =============================================================================

export interface NormalizedFigure extends FigureConfig {
  armL: ArmConfig;
  armR: ArmConfig;
  legL: LegConfig;
  legR: LegConfig;
}

export function normalizeFigure(raw: FigureConfig): NormalizedFigure {
  const c: FigureConfig = { torsoStyle: 'jacket', ...raw };
  let armL = c.armL;
  let armR = c.armR;
  if (!armL) {
    const base: ArmConfig = {
      type: 'sleeve',
      color: c.sleeve || c.jacket || null,
      gauntlet: c.gauntlet ? { color: c.gauntlet, sequin: c.gauntletSequin } : null,
      glove: c.glove || null,
    };
    armL = base;
    armR = armR || base;
  }
  let legL = c.legL;
  let legR = c.legR;
  if (!legL) {
    const base: LegConfig = { color: c.pants || null, stripe: c.stripe || null };
    legL = base;
    legR = legR || base;
  }
  return { ...c, armL, armR: armR as ArmConfig, legL, legR: legR as LegConfig };
}

// =============================================================================
// PRINT COLOR RESOLUTION
// =============================================================================

/** How many editable color slots each procedural surface exposes. */
export const PRINT_COLOR_SLOT_COUNTS: Record<PrintColorKey, number> = {
  sunburst: 3, // center, mid, outer
  opart: 3, // base, dot A, dot B
  pinstripe: 2, // base, stripe
  plaid: 3, // base, band, cross band
  foil: 2, // tone, highlight
};

/** The stock palette's editable slot values for one surface. */
export function printColorDefaults(key: PrintColorKey): string[] {
  const pal = PRINT_PALETTES;
  switch (key) {
    case 'sunburst':
      return [pal.sunburst.stops[0][1], pal.sunburst.stops[1][1], pal.sunburst.stops[2][1]];
    case 'opart':
      return [pal.opart.bg, pal.opart.dotA, pal.opart.dotB];
    case 'pinstripe':
      return [pal.pinstripe.bg, pal.pinstripe.stripe];
    case 'plaid':
      return [pal.plaid.bg, pal.plaid.bandA, pal.plaid.bandB];
    case 'foil':
      return [pal.foil.stops[2][1], pal.foil.stops[1][1]];
  }
}

/** The slot values the editor should show: overrides merged over defaults. */
export function printColorValues(figure: FigureConfig, key: PrintColorKey): string[] {
  const custom = figure.printColors?.[key];
  return printColorDefaults(key).map((d, i) => (isHexColor(custom?.[i]) ? safeHex(custom![i]) : d));
}

export interface ResolvedPrintPalettes {
  sunburst: { stops: Array<[string, string]>; ray: string };
  opart: { bg: string; dotA: string; dotB: string; wave: string };
  pinstripe: { bg: string; stripe: string };
  plaid: { bg: string; bandA: string; bandB: string; bandC: string };
  foil: { stops: Array<[string, string]> };
}

/**
 * Resolve the full render palettes for every procedural surface. Surfaces
 * without an override return the stock palette byte-for-byte; overridden ones
 * rebuild their derived shades (falloff stops, wave line, thin plaid band,
 * foil ramp) from the director's slot colors.
 */
export function resolvePrintPalettes(
  figure: Pick<FigureConfig, 'printColors'>
): ResolvedPrintPalettes {
  const pc = figure.printColors || {};
  const has = (key: PrintColorKey) => Array.isArray(pc[key]) && pc[key]!.length > 0;
  const slots = (key: PrintColorKey) => printColorValues(figure as FigureConfig, key);

  const sun = has('sunburst')
    ? (() => {
        const [center, mid, outer] = slots('sunburst');
        return {
          stops: [
            ['0', center],
            ['.18', mid],
            ['.42', outer],
            ['.7', darkenHex(outer, 0.5)],
            ['1', darkenHex(outer, 0.75)],
          ] as Array<[string, string]>,
          ray: center,
        };
      })()
    : { stops: [...PRINT_PALETTES.sunburst.stops], ray: PRINT_PALETTES.sunburst.ray };

  const op = has('opart')
    ? (() => {
        const [bg, dotA, dotB] = slots('opart');
        return { bg, dotA, dotB, wave: lightenHex(bg, 0.6) };
      })()
    : { ...PRINT_PALETTES.opart };

  const pin = has('pinstripe')
    ? (() => {
        const [bg, stripe] = slots('pinstripe');
        return { bg, stripe };
      })()
    : { ...PRINT_PALETTES.pinstripe };

  const plaid = has('plaid')
    ? (() => {
        const [bg, bandA, bandB] = slots('plaid');
        return { bg, bandA, bandB, bandC: darkenHex(bandA, 0.25) };
      })()
    : { ...PRINT_PALETTES.plaid };

  const foil = has('foil')
    ? (() => {
        const [tone, highlight] = slots('foil');
        return {
          stops: [
            ['0', darkenHex(tone, 0.1)],
            ['.35', highlight],
            ['.6', tone],
            ['1', darkenHex(tone, 0.35)],
          ] as Array<[string, string]>,
        };
      })()
    : { stops: [...PRINT_PALETTES.foil.stops] };

  return { sunburst: sun, opart: op, pinstripe: pin, plaid, foil };
}

// =============================================================================
// SLEEVE FADES (director-authored two-stop gradients)
// =============================================================================

/** Reserved gradient ids for director-authored sleeve fades, one per side. */
const ARM_FADE_IDS = { armL: 'fadeL', armR: 'fadeR' } as const;

/** The [top, bottom] fade colors on a side's sleeve, if that side wears one. */
export function armFadeStops(figure: FigureConfig, side: 'armL' | 'armR'): [string, string] | null {
  const arm = normalizeFigure(figure)[side];
  const fill = typeof arm.fill === 'string' ? arm.fill : '';
  const gid = fill.startsWith('url:') ? fill.slice(4) : null;
  if (gid !== ARM_FADE_IDS.armL && gid !== ARM_FADE_IDS.armR) return null;
  const stops = figure.grads?.[gid];
  if (!Array.isArray(stops) || stops.length < 2) return null;
  return [safeHex(stops[0][1]), safeHex(stops[stops.length - 1][1])];
}

/**
 * Set or clear a director-authored sleeve fade. Writes the per-side gradient
 * (grads.fadeL / grads.fadeR) and points that sleeve's fill at it; clearing
 * removes both without touching other gradients. Pure — run the result
 * through withDerivedFlags (the editor's setFigure does).
 */
export function withArmFade(
  figure: FigureConfig,
  side: 'armL' | 'armR',
  stops: [string, string] | null,
  linked: boolean
): FigureConfig {
  const n = normalizeFigure(figure);
  const sides: Array<'armL' | 'armR'> = linked ? ['armL', 'armR'] : [side];
  const grads = { ...(figure.grads || {}) };
  const next: FigureConfig = {
    ...figure,
    armL: n.armL,
    armR: n.armR,
    // per-side configs become authoritative, so clear the symmetric shorthands
    sleeve: undefined,
    gauntlet: undefined,
    gauntletSequin: undefined,
    glove: undefined,
  };
  for (const s of sides) {
    const gid = ARM_FADE_IDS[s];
    if (stops) {
      grads[gid] = [
        ['0', safeHex(stops[0])],
        ['1', safeHex(stops[1])],
      ];
      next[s] = { ...n[s], fill: `url:${gid}`, color: null };
    } else {
      delete grads[gid];
      next[s] = { ...n[s], fill: null };
    }
  }
  next.grads = Object.keys(grads).length > 0 ? grads : null;
  return next;
}

// =============================================================================
// COLORWAY APPLY
// =============================================================================

/**
 * Re-skin a figure from the corps colorway in one deterministic pass:
 * primary → base garments and identity bands, secondary → hardware/trim,
 * accent → gloves/gauntlets/plume/neck pieces, metal → buttons and buckles.
 * Pants and hat body take deep shades of primary so the silhouette keeps
 * contrast. Prints, finishes, and per-side layout are left untouched — the
 * apply is a starting move; every channel stays individually overridable.
 */
export function applyColorway(figure: FigureConfig, cw: UniformColorway): FigureConfig {
  const primary = safeHex(cw.primary);
  const secondary = safeHex(cw.secondary);
  const accent = safeHex(cw.accent);
  const metal = METAL_HEX[cw.metal] || METAL_HEX.gold;
  const deep = darkenHex(primary, 0.45);

  const recolorArm = (arm?: ArmConfig): ArmConfig | undefined =>
    arm && {
      ...arm,
      color: arm.type === 'bare' ? arm.color : arm.fill ? arm.color : primary,
      gauntlet: arm.gauntlet ? { ...arm.gauntlet, color: accent } : arm.gauntlet,
      glove: arm.glove ? accent : arm.glove,
      glowLine: arm.glowLine ? secondary : arm.glowLine,
    };
  const recolorLeg = (leg?: LegConfig): LegConfig | undefined =>
    leg && {
      ...leg,
      color: leg.fill ? leg.color : deep,
      stripe: leg.stripe ? secondary : leg.stripe,
    };

  const n = normalizeFigure(figure);
  return {
    ...figure,
    jacket: figure.torsoFill ? figure.jacket : primary,
    collar: figure.collar ? primary : figure.collar,
    collarTrim: figure.collarTrim ? secondary : figure.collarTrim,
    braid: figure.braid ? secondary : figure.braid,
    sash: figure.sash ? secondary : figure.sash,
    baldric: figure.baldric ? secondary : figure.baldric,
    baldricCenter: figure.baldricCenter ? darkenHex(secondary, 0.55) : figure.baldricCenter,
    chestFade: figure.chestFade
      ? ([secondary, darkenHex(secondary, 0.55)] as [string, string])
      : figure.chestFade,
    panel: figure.panel ? secondary : figure.panel,
    swash: figure.swash ? secondary : figure.swash,
    epaulet: figure.epaulet ? secondary : figure.epaulet,
    suspenders: figure.suspenders ? darkenHex(secondary, 0.3) : figure.suspenders,
    belt: figure.belt ? secondary : figure.belt,
    buckle: figure.buckle ? metal : figure.buckle,
    buttonColor: figure.buttonColor ? metal : figure.buttonColor,
    waistBand: figure.waistBand ? darkenHex(primary, 0.6) : figure.waistBand,
    waistBandEdge: figure.waistBandEdge ? metal : figure.waistBandEdge,
    fringe: figure.fringe ? secondary : figure.fringe,
    tie: figure.tie ? accent : figure.tie,
    scarf: figure.scarf ? accent : figure.scarf,
    cowl: figure.cowl ? darkenHex(primary, 0.25) : figure.cowl,
    mockNeck:
      figure.mockNeck && !String(figure.mockNeck).startsWith('url:') ? primary : figure.mockNeck,
    glowArt: figure.glowArt ? secondary : figure.glowArt,
    metal,
    streamers: figure.streamers ? [primary, accent] : figure.streamers,
    hat: figure.hat
      ? {
          ...figure.hat,
          body: darkenHex(primary, 0.55),
          band: figure.hat.band ? secondary : figure.hat.band,
          emblem: figure.hat.emblem ? metal : figure.hat.emblem,
        }
      : figure.hat,
    plume: figure.plume ? { ...figure.plume, color: accent } : figure.plume,
    armL: recolorArm(n.armL),
    armR: recolorArm(n.armR),
    legL: recolorLeg(n.legL),
    legR: recolorLeg(n.legR),
    // clear symmetric shorthands so the per-side configs are authoritative
    sleeve: undefined,
    gauntlet: undefined,
    glove: undefined,
    pants: undefined,
    stripe: undefined,
  };
}

// =============================================================================
// V1 → V2 MIGRATION (prose design → structured draft)
// =============================================================================

/** Resolve free-text prose like "deep crimson red trim" to a hex, best-effort. */
export function proseColorToHex(prose: string | undefined | null): string | null {
  if (!prose || typeof prose !== 'string') return null;
  const cleaned = prose
    .toLowerCase()
    .replace(/\b(trim|highlights?|accents?|deep|dark|light|bright|metallic)\b/g, ' ')
    .replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (COLOR_NAME_TO_HEX[cleaned]) return COLOR_NAME_TO_HEX[cleaned];
  // try each word, longest phrase first, then single words
  const words = cleaned.split(' ');
  for (let len = Math.min(words.length, 3); len >= 1; len--) {
    for (let i = 0; i + len <= words.length; i++) {
      const phrase = words.slice(i, i + len).join(' ');
      if (COLOR_NAME_TO_HEX[phrase]) return COLOR_NAME_TO_HEX[phrase];
    }
  }
  return null;
}

const V1_HELMET_TO_HAT: Record<string, FigureConfig['hatType']> = {
  shako: 'shako',
  aussie: 'aussie',
  modern: 'pith',
  themed: 'shako',
  none: null,
};

const V1_STYLE_TO_PRESET: Record<string, string> = {
  traditional: 'classic-cadet',
  contemporary: 'modern-swash',
  theatrical: 'streamline',
  athletic: 'modern-swash',
  'avant-garde': 'radial-burst',
};

/**
 * Build a v2 draft from a v1 prose design. Colors resolve through the name
 * map (unresolvable → the style preset's palette); the style enum picks the
 * starting silhouette; prose section descriptions are preserved privately as
 * AI hints. Existing avatars are untouched — migration never regenerates.
 */
export function migrateV1Design(
  v1: CorpsUniformDesign | undefined | null,
  corpsName?: string
): UniformDesignV2 {
  const presetId = V1_STYLE_TO_PRESET[v1?.style || ''] || 'classic-cadet';
  const preset = UNIFORM_PRESETS.find((p) => p.id === presetId) || UNIFORM_PRESETS[0];
  const figure: FigureConfig = JSON.parse(JSON.stringify(preset.figure));

  const primary = proseColorToHex(v1?.primaryColor) || preset.colorway.primary;
  const secondary = proseColorToHex(v1?.secondaryColor) || preset.colorway.secondary;
  const accent = proseColorToHex(v1?.accentColor) || preset.colorway.accent;
  const metalGuess: UniformColorway['metal'] = /silver|chrome|platinum/i.test(
    v1?.secondaryColor || ''
  )
    ? 'silver'
    : preset.colorway.metal;
  const colorway: UniformColorway = { primary, secondary, accent, metal: metalGuess };

  const hatType = v1?.helmetStyle ? V1_HELMET_TO_HAT[v1.helmetStyle] : figure.hatType;
  const recolored = applyColorway(figure, colorway);
  if (hatType !== undefined && hatType !== figure.hatType) {
    recolored.hatType = hatType;
    recolored.hat = hatType ? { body: darkenHex(primary, 0.55), band: secondary } : null;
    recolored.plume = hatType === 'shako' ? { type: 'upright', color: accent } : null;
    recolored.hairShow = hatType === null;
  }

  return {
    schema: 2,
    name: corpsName ? `${corpsName} identity` : 'Migrated design',
    colorway,
    figure: recolored,
    aiHints: {
      mascotOrEmblem: v1?.mascotOrEmblem || undefined,
      themeKeywords: v1?.themeKeywords?.length ? v1.themeKeywords : undefined,
      additionalNotes: v1?.additionalNotes || undefined,
    },
  };
}

// =============================================================================
// SIZE GUARD (client-side mirror of the callable's payload bounds)
// =============================================================================

export const WARDROBE_LIMITS = {
  maxDesigns: 24,
  maxNameLength: 60,
  /** Serialized design payload cap, well under the profile-doc budget. */
  maxDesignBytes: 8 * 1024,
} as const;

export function designWithinLimits(design: UniformDesignV2): boolean {
  if (!design.name || design.name.length > WARDROBE_LIMITS.maxNameLength) return false;
  try {
    return JSON.stringify(design).length <= WARDROBE_LIMITS.maxDesignBytes;
  } catch {
    return false;
  }
}

// =============================================================================
// DERIVED FIGURE FLAGS
// =============================================================================

function usesRef(figure: FigureConfig, ref: string): boolean {
  const n = normalizeFigure(figure);
  const fills = [
    figure.torsoFill,
    typeof figure.mockNeck === 'string' ? figure.mockNeck : null,
    n.armL.fill,
    n.armR.fill,
    n.legL.fill,
    n.legR.fill,
  ];
  return fills.some((f) => f === ref);
}

/**
 * Recompute def-defining figure flags (which procedural print is defined,
 * plaid/foil defs, the glow filter, hair visibility) from actual channel
 * usage, so a stored design never carries stale defs.
 */
export function withDerivedFlags(figure: FigureConfig): FigureConfig {
  const n = normalizeFigure(figure);
  const print = usesRef(figure, 'url:sun')
    ? ('sunburst' as const)
    : usesRef(figure, 'url:opart')
      ? ('opart' as const)
      : usesRef(figure, 'url:pinstripe')
        ? ('pinstripe' as const)
        : null;
  return {
    ...figure,
    print,
    plaid: usesRef(figure, 'url:plaid'),
    foilLeg: usesRef(figure, 'url:foil'),
    glow: Boolean(figure.glowArt || n.armL.glowLine || n.armR.glowLine),
    hairShow: !figure.hatType,
  };
}
