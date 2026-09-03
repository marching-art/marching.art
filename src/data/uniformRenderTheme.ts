// =============================================================================
// UNIFORM FIGURE — render theme (census-exempt hex lives here)
// =============================================================================
// Like tourPosterTheme.ts, this module exists so the UniformFigure renderer
// can stay free of hex literals: src/data/ is allow-listed by the design
// census because "hex here describes uniforms/corps/avatars, not chrome"
// (scripts/designCensus.mjs). The figure SVG is style-attribute-only so it can
// be serialized and exported; nothing in it may reference Tailwind classes or
// CSS variables.

/** Neutral inks used by the shared shading/highlight overlay system. */
export const FIGURE_INK = {
  black: '#000000',
  white: '#ffffff',
  /** Patent visor + dark hardware strokes. */
  visor: '#0d0d0f',
  /** Default hair color when a bare-headed figure doesn't pick one. */
  defaultHair: '#2b2119',
  /** Fallback fill when a design carries an invalid color value. */
  fallback: '#888888',
  /** Spats + their button dots. */
  spats: '#f2efe6',
  spatButton: '#999999',
  /** Sneaker body / sole / lace detail. */
  sneakerBody: '#f4f4f2',
  sneakerSole: '#d8d8d3',
  sneakerLace: '#b9b9b4',
  /** Brass clip on suspenders. */
  brassClip: '#b9893a',
  /** Zipper tape/pull on vinyl panels. */
  zipper: '#c9ced6',
  /** Callout annotation strokes (anatomy diagram). */
  calloutLine: '#3d3d3d',
  calloutDot: '#60a5fa',
  calloutText: '#9a9a94',
} as const;

/**
 * Iridescent finish (Texture Atelier pack): the translucent hue-shift ramp
 * laid diagonally over the torso. Rendered at low opacity so the jacket color
 * stays the read; these are the "angle" colors that play across it.
 */
export const IRIDESCENT_STOPS = [
  { o: '0', c: '#7de8dc' },
  { o: '0.35', c: '#b48ae8' },
  { o: '0.7', c: '#e89ab4' },
  { o: '1', c: '#e8d27a' },
] as const;

/** Procedural print palettes (recolorable in later phases; fixed at launch). */
export const PRINT_PALETTES = {
  sunburst: {
    stops: [
      ['0', '#f7dd7a'],
      ['.18', '#e8952f'],
      ['.42', '#c23a2a'],
      ['.7', '#6d1f3f'],
      ['1', '#241021'],
    ] as Array<[string, string]>,
    ray: '#f7dd7a',
  },
  opart: {
    bg: '#e08a12',
    dotA: '#f7cf3e',
    dotB: '#8a3a12',
    wave: '#f9e8a0',
  },
  pinstripe: {
    bg: '#efe3c8',
    stripe: '#d3bd90',
  },
  plaid: {
    bg: '#d0951c',
    bandA: '#b57712',
    bandB: '#e8c25a',
    bandC: '#8f5f10',
  },
  foil: {
    stops: [
      ['0', '#b98c2e'],
      ['.35', '#f2df9a'],
      ['.6', '#caa03c'],
      ['1', '#8f6d20'],
    ] as Array<[string, string]>,
  },
} as const;

/** Skin tones offered for the previewed corps member (figure, not director). */
export const FIGURE_SKIN_TONES: string[] = [
  '#f1c9a5',
  '#e0b48e',
  '#caa079',
  '#b98a5e',
  '#a8764f',
  '#96674a',
  '#8a5a3b',
  '#5f3d28',
];

/** Default hair colors for bare-headed looks. */
export const FIGURE_HAIR_COLORS: string[] = [
  '#17120c',
  '#241b13',
  '#2b2119',
  '#3a2a1a',
  '#4a3013',
  '#6b4a23',
  '#8a6a3a',
  '#b7b4ad',
];

/**
 * Backdrop behind the rasterized equip preview (utils/uniformPreview): a
 * neutral mid-gray so both white and black garments read against it in the
 * reference image the AI image models receive.
 */
export const PREVIEW_BACKGROUND = '#d9d9d9';

/** Share-card ("field entrance") scene palette — see UniformShareCard.tsx. */
export const SHARE_CARD_THEME = {
  bg: '#0a0c12',
  sky: '#0d1020',
  stands: '#141824',
  standsRail: '#1e2432',
  field: '#0f1a14',
  fieldLine: '#f4f2ec',
  panelRule: '#2a3040',
  text: '#f4f2ec',
  muted: '#8b93a4',
  brand: '#d9a41c',
  lightBulb: '#f7edc8',
} as const;
