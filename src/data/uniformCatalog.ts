// =============================================================================
// UNIFORM STUDIO — catalog: named colors, presets, option lists
// =============================================================================
// All uniform hex lives under src/data/ (design-census exempt). Presets are
// only saved configurations — loading one and swapping any piece is the core
// loop, and every piece cross-combines (no item families; see
// docs/UNIFORM_STUDIO.md §4.3). The eleven launch presets are the proposal
// prototype's colorways, ported field-for-field.

import type { FigureConfig, UniformColorway, UniformDesignV2 } from '../types/uniform';

// =============================================================================
// NAMED COLOR LIBRARY (silk-swatch names; the free quick-pick chips)
// =============================================================================

export interface NamedColor {
  name: string;
  hex: string;
}

/** Hardware metals rendered for the colorway's metal channel. */
export const METAL_HEX: Record<'gold' | 'silver', string> = {
  gold: '#d9a41c',
  silver: '#cfd4da',
};

export const NAMED_COLORS: NamedColor[] = [
  { name: 'Maroon', hex: '#6d1a26' },
  { name: 'Crimson', hex: '#b3121c' },
  { name: 'Scarlet', hex: '#c23a2a' },
  { name: 'Burnt Orange', hex: '#c2571f' },
  { name: 'Sunset', hex: '#e8641f' },
  { name: 'Marigold', hex: '#e8952f' },
  { name: 'Old Gold', hex: '#d9a41c' },
  { name: 'Brass', hex: '#b9893a' },
  { name: 'Champagne', hex: '#e8c25a' },
  { name: 'Cream', hex: '#ece2cc' },
  { name: 'Parchment', hex: '#efe3c8' },
  { name: 'Pearl', hex: '#f4f2ec' },
  { name: 'Arctic White', hex: '#f7f5f0' },
  { name: 'Silver', hex: '#cfd4da' },
  { name: 'Chrome', hex: '#d7dde2' },
  { name: 'Storm Gray', hex: '#9a9a94' },
  { name: 'Charcoal', hex: '#3d3d3d' },
  { name: 'Obsidian', hex: '#141414' },
  { name: 'Jet', hex: '#17171a' },
  { name: 'Midnight', hex: '#101c33' },
  { name: 'Deep Navy', hex: '#0e1630' },
  { name: 'Navy', hex: '#1d2f66' },
  { name: 'Regiment Blue', hex: '#22355c' },
  { name: 'Royal', hex: '#2b3fbf' },
  { name: 'Azure', hex: '#2f6fd0' },
  { name: 'Electric Blue', hex: '#4fc3ff' },
  { name: 'Glacier', hex: '#9fd8e8' },
  { name: 'Ice', hex: '#dfe6f2' },
  { name: 'Teal', hex: '#1f6e63' },
  { name: 'Ocean Teal', hex: '#3f9a8c' },
  { name: 'Mint', hex: '#cdeee0' },
  { name: 'Forest', hex: '#256b3a' },
  { name: 'Kelly', hex: '#2e8148' },
  { name: 'Emerald', hex: '#2e7d46' },
  { name: 'Dark Green', hex: '#1c4a2a' },
  { name: 'Khaki', hex: '#c9b287' },
  { name: 'Tan', hex: '#d9c6a4' },
  { name: 'Saddle', hex: '#8d7247' },
  { name: 'Umber', hex: '#4a3421' },
  { name: 'Espresso', hex: '#33261a' },
  { name: 'Plum', hex: '#6d1f3f' },
  { name: 'Royal Purple', hex: '#4b2a6b' },
  { name: 'Orchid', hex: '#8a4a8f' },
  { name: 'Rose', hex: '#c25a6e' },
  { name: 'Copper', hex: '#b06a3a' },
  { name: 'Bronze', hex: '#8f6d20' },
  { name: 'Foil Gold', hex: '#caa64e' },
  { name: 'Platinum', hex: '#e5e4e2' },
];

/**
 * Free-text color name → hex, used to migrate v1 prose designs
 * ("crimson red", "midnight blue") into structured channels. Keys are
 * lowercase; matching strips filler words first (see utils/uniform).
 */
export const COLOR_NAME_TO_HEX: Record<string, string> = {
  // v1 COLOR_SUGGESTIONS (uniformDesignOptions.ts), verbatim
  'crimson red': '#b3121c',
  'midnight blue': '#101c33',
  'emerald green': '#2e7d46',
  'royal purple': '#4b2a6b',
  'burnt orange': '#c2571f',
  'deep navy': '#0e1630',
  'forest green': '#256b3a',
  burgundy: '#6d1a26',
  'charcoal gray': '#3d3d3d',
  'pearl white': '#f4f2ec',
  gold: '#d9a41c',
  silver: '#cfd4da',
  bronze: '#8f6d20',
  copper: '#b06a3a',
  platinum: '#e5e4e2',
  'obsidian black': '#141414',
  'arctic white': '#f7f5f0',
  'sunset orange': '#e8641f',
  'ocean teal': '#3f9a8c',
  'storm gray': '#9a9a94',
  // common single words seen in free text
  red: '#b3121c',
  crimson: '#b3121c',
  scarlet: '#c23a2a',
  maroon: '#6d1a26',
  blue: '#1d2f66',
  navy: '#0e1630',
  royal: '#2b3fbf',
  azure: '#2f6fd0',
  teal: '#1f6e63',
  green: '#2e8148',
  emerald: '#2e7d46',
  forest: '#256b3a',
  purple: '#4b2a6b',
  plum: '#6d1f3f',
  orange: '#e8641f',
  yellow: '#e8c25a',
  cream: '#ece2cc',
  white: '#f7f5f0',
  black: '#141414',
  gray: '#9a9a94',
  grey: '#9a9a94',
  charcoal: '#3d3d3d',
  brown: '#4a3421',
  tan: '#d9c6a4',
  khaki: '#c9b287',
  pink: '#c25a6e',
  mint: '#cdeee0',
};

// =============================================================================
// OPTION LISTS (Studio controls)
// =============================================================================

export const HAT_TYPE_OPTIONS = [
  { value: null, label: 'None (bare head)' },
  { value: 'shako', label: 'Shako' },
  { value: 'pith', label: 'Pith helmet' },
  { value: 'campaign', label: 'Campaign hat' },
  { value: 'aussie', label: 'Aussie slouch' },
  { value: 'contour', label: 'Contour shako' },
  { value: 'busby', label: 'Busby' },
] as const;

/** Ornament shapes for the shako/pith front plate and the aussie side badge. */
export const HAT_ORNAMENT_OPTIONS = [
  { value: 'sunburst', label: 'Sunburst plate' },
  { value: 'star', label: 'Star' },
  { value: 'shield', label: 'Crest shield' },
  { value: 'chevron', label: 'Chevrons' },
  { value: 'disc', label: 'Disc' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'rect', label: 'Rectangle' },
  { value: 'none', label: 'Bare' },
] as const;

/** Badge shapes reuse the ornament shapes, minus the bare option. */
export const CHEST_BADGE_OPTIONS = [
  { value: null, label: 'None' },
  ...HAT_ORNAMENT_OPTIONS.filter((o) => o.value !== 'none'),
] as const;

/** Cut of the diagonal sash/baldric band. */
export const CHEST_SHAPE_OPTIONS = [
  { value: 'band', label: 'Classic band' },
  { value: 'triangles', label: 'Triangle blade' },
  { value: 'tapered', label: 'Tapered' },
] as const;

export const PLUME_TYPE_OPTIONS = [
  { value: null, label: 'No plume' },
  { value: 'upright', label: 'French upright' },
  { value: 'fountain', label: 'Fountain' },
  { value: 'sideFeather', label: 'Side feather' },
] as const;

export const TORSO_STYLE_OPTIONS = [
  { value: 'jacket', label: 'Jacket' },
  { value: 'tunic', label: 'Tunic (asymmetric drape)' },
] as const;

export const TORSO_PRINT_OPTIONS = [
  { value: null, label: 'Solid' },
  { value: 'sunburst', label: 'Radial burst print' },
  { value: 'opart', label: 'Op-art lattice print' },
  { value: 'pinstripe', label: 'Pinstripe print' },
] as const;

/** Editor labels for each procedural surface's color slots (see PrintColors). */
export const PRINT_COLOR_SLOTS: Record<import('../types/uniform').PrintColorKey, string[]> = {
  sunburst: ['Center', 'Mid', 'Outer'],
  opart: ['Base', 'Dot A', 'Dot B'],
  pinstripe: ['Base', 'Stripe'],
  plaid: ['Base', 'Band', 'Cross band'],
  foil: ['Foil tone', 'Highlight'],
};

export const CHEST_OPTIONS = [
  { value: 'none', label: 'Plain' },
  { value: 'braid', label: 'Braid rows' },
  { value: 'sash', label: 'Diagonal sash' },
  { value: 'baldric', label: 'Baldric' },
  { value: 'plastron', label: 'Plastron panel' },
  { value: 'buttons', label: 'Button columns' },
  { value: 'swash', label: 'Modern swash' },
  { value: 'vinylPanel', label: 'Vinyl panel' },
] as const;

export const NECK_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'collar', label: 'Standing collar' },
  { value: 'mock', label: 'Mock neck' },
  { value: 'cowl', label: 'Cowl scarf' },
  { value: 'crew', label: 'Crew neck' },
] as const;

export const ARM_TYPE_OPTIONS = [
  { value: 'sleeve', label: 'Full sleeve' },
  { value: 'half', label: 'Rolled half-sleeve' },
  { value: 'bare', label: 'Bare arm' },
] as const;

export const LEG_FILL_OPTIONS = [
  { value: null, label: 'Solid' },
  { value: 'opart', label: 'Op-art print' },
  { value: 'plaid', label: 'Plaid print' },
  { value: 'foil', label: 'Metallic foil' },
] as const;

// =============================================================================
// PRESETS — the eleven prototype colorways, ported field-for-field
// =============================================================================

export interface UniformPreset {
  id: string;
  label: string;
  era: 'classic' | 'modern';
  colorway: UniformColorway;
  figure: FigureConfig;
}

const classicCadet: FigureConfig = {
  skin: '#c9a074',
  hairShow: false,
  jacket: '#6d1a26',
  collar: '#6d1a26',
  collarTrim: '#d9a41c',
  chest: 'braid',
  braid: '#efe9dc',
  metal: '#d9a41c',
  epaulet: '#d9a41c',
  sleeve: '#6d1a26',
  gauntlet: '#f2ede2',
  glove: '#f5f2ea',
  belt: '#d9a41c',
  buckle: '#cfd4da',
  pants: '#ece2cc',
  stripe: '#6d1a26',
  shoe: '#141414',
  spats: true,
  hatType: 'shako',
  hat: { body: '#17171a', band: '#6d1a26' },
  plume: { type: 'upright', color: '#f4f1ea' },
};

const whiteRegiment: FigureConfig = {
  skin: '#8a5a3b',
  hairShow: false,
  jacket: '#f4f2ec',
  collar: '#f4f2ec',
  collarTrim: '#17171a',
  chest: 'baldric',
  baldric: '#17171a',
  baldricSequin: true,
  metal: '#cfd4da',
  gauntlet: '#17171a',
  gauntletSequin: true,
  glove: '#141416',
  belt: '#f4f2ec',
  buckle: '#cfd4da',
  pants: '#f4f2ec',
  shoe: '#f7f5f0',
  hatType: 'pith',
  hat: { body: '#f7f5f0', band: '#17171a' },
  plume: { type: 'fountain', color: '#1b1b1e' },
};

const greenSatin: FigureConfig = {
  skin: '#e0b48e',
  hairShow: false,
  jacket: '#2e8148',
  satin: true,
  collar: '#161618',
  chest: 'none',
  metal: '#d7dde2',
  glove: '#f5f2ea',
  belt: '#161618',
  buckle: '#d7dde2',
  pants: '#17181a',
  shoe: '#141414',
  hatType: 'aussie',
  hat: { body: '#f2f0ea', band: '#161618' },
};

const cavalry: FigureConfig = {
  skin: '#b98a5e',
  hairShow: false,
  jacket: '#c9b287',
  collar: '#c9b287',
  collarTrim: '#22355c',
  scarf: '#e3b23c',
  chest: 'buttons',
  metal: '#b9893a',
  epaulet: '#22355c',
  gauntlet: '#5a3f26',
  glove: '#d9c6a4',
  belt: '#4a3421',
  buckle: '#b9893a',
  pants: '#22355c',
  stripe: '#e3b23c',
  shoe: '#33261a',
  hatType: 'campaign',
  hat: { body: '#8d7247', band: '#4a3421' },
};

const modernSwash: FigureConfig = {
  skin: '#96674a',
  hairShow: true,
  hair: '#241b13',
  jacket: '#f0f2f5',
  crew: true,
  chest: 'swash',
  swash: '#2f6fd0',
  metal: '#cfd4da',
  pants: '#101c33',
  shoe: '#f0f2f5',
};

const ivoryBlade: FigureConfig = {
  skin: '#e0b48e',
  hairShow: false,
  jacket: '#ece2cc',
  collar: '#17171a',
  collarTrim: '#d9a41c',
  chest: 'baldric',
  chestShape: 'triangles',
  baldric: '#17171a',
  baldricCenter: '#ece2cc',
  metal: '#d9a41c',
  gauntlet: '#17171a',
  glove: '#f7f5f0',
  belt: '#17171a',
  buckle: '#d9a41c',
  pants: '#ece2cc',
  shoe: '#f7f5f0',
  hatType: 'shako',
  hat: { body: '#ece2cc', band: '#17171a', ornament: 'diamond' },
  plume: { type: 'fountain', color: '#f7f5f0' },
};

const millennium: FigureConfig = {
  skin: '#e0b48e',
  hairShow: false,
  jacket: '#101c33',
  crew: true,
  chest: 'swash',
  swash: '#d7dde2',
  swashSequin: false,
  swashLegColor: '#22355c',
  metal: '#cfd4da',
  glove: '#f7f5f0',
  pants: '#d7dde2',
  stripe: '#101c33',
  shoe: '#f7f5f0',
  hatType: 'contour',
  hat: { body: '#101c33', band: '#d7dde2', ornament: 'diamond', emblem: '#cfd4da' },
  plume: { type: 'upright', color: '#f7f5f0', accent: '#2f6fd0' },
};

const radialBurst: FigureConfig = {
  skin: '#a8764f',
  hairShow: true,
  hair: '#3a2a1a',
  torsoStyle: 'tunic',
  torsoFill: 'url:sun',
  print: 'sunburst',
  metal: '#cfd4da',
  fringe: '#e8c25a',
  grads: {
    ombre: [
      { o: '0', c: '#16161a' },
      { o: '0.55', c: '#7a1f3d' },
      { o: '1', c: '#e8c25a' },
    ],
  },
  armL: { type: 'bare' },
  armR: { type: 'sleeve', fill: 'url:ombre', detached: true },
  legL: { color: '#caa64e', foil: true, fill: 'url:foil' },
  legR: { color: '#17161c' },
  foilLeg: true,
  sneaker: true,
};

const opArt: FigureConfig = {
  skin: '#d8a97e',
  hairShow: true,
  hair: '#4a3013',
  torsoStyle: 'jumpsuit',
  torsoFill: 'url:opart',
  print: 'opart',
  metal: '#b9893a',
  mockNeck: 'url:opart',
  waistBand: '#1f6e63',
  waistBandEdge: '#e8c25a',
  armL: { type: 'sleeve', fill: 'url:opart' },
  armR: { type: 'sleeve', fill: 'url:opart' },
  legL: { fill: 'url:opart', flare: true },
  legR: { fill: 'url:opart', flare: true },
  shoe: '#241d14',
};

const streamline: FigureConfig = {
  skin: '#8a5a3b',
  hairShow: true,
  hair: '#17120c',
  jacket: '#2b3fbf',
  torsoSequin: true,
  cowl: '#1b2f8a',
  metal: '#cfd4da',
  grads: {
    mint: [
      { o: '0', c: '#cdeee0' },
      { o: '1', c: '#3f9a8c' },
    ],
  },
  waistBand: '#0e0e12',
  waistBandEdge: '#cfd4da',
  armL: { type: 'sleeve', fill: 'url:mint' },
  armR: { type: 'sleeve', fill: 'url:mint' },
  legL: { color: '#101014' },
  legR: { color: '#101014' },
  streamers: ['#2b3fbf', '#5fd0e8'],
  shoe: '#101014',
};

const goldRush: FigureConfig = {
  skin: '#8a5a3b',
  hairShow: true,
  hair: '#17120c',
  torsoFill: 'url:pinstripe',
  print: 'pinstripe',
  plaid: true,
  metal: '#b9893a',
  collar: '#efe3c8',
  collarTrim: '#8f5f10',
  suspenders: '#26221c',
  armL: { type: 'half', fill: 'url:pinstripe' },
  armR: { type: 'half', fill: 'url:pinstripe' },
  legL: { fill: 'url:plaid' },
  legR: { fill: 'url:plaid' },
  shoe: '#4a3421',
};

const neonCircuit: FigureConfig = {
  skin: '#b98a5e',
  hairShow: true,
  hair: '#101010',
  jacket: '#16283f',
  velvet: true,
  glow: true,
  glowArt: '#4fc3ff',
  mockNeck: '#16283f',
  tie: '#e8641f',
  metal: '#cfd4da',
  armL: { type: 'sleeve', color: '#16283f', glowLine: '#4fc3ff', glove: '#101014' },
  armR: { type: 'sleeve', color: '#16283f', glowLine: '#4fc3ff', glove: '#101014' },
  legL: { color: '#122236' },
  legR: { color: '#122236' },
  shoe: '#101013',
};

const patentRiot: FigureConfig = {
  skin: '#caa079',
  hairShow: true,
  hair: '#2b2119',
  jacket: '#141418',
  patent: true,
  chest: 'vinylPanel',
  panel: '#b3121c',
  panelTrim: '#0c0c0e',
  collar: '#141418',
  metal: '#c9ced6',
  armL: { type: 'sleeve', color: '#17171c', patent: true },
  armR: { type: 'sleeve', color: '#17171c', patent: true },
  legL: { color: '#b8161f', tattered: true },
  legR: { color: '#b8161f', tattered: true },
  shoe: '#101013',
};

export const UNIFORM_PRESETS: UniformPreset[] = [
  {
    id: 'classic-cadet',
    label: 'Classic Cadet',
    era: 'classic',
    colorway: { primary: '#6d1a26', secondary: '#d9a41c', accent: '#ece2cc', metal: 'gold' },
    figure: classicCadet,
  },
  {
    id: 'white-regiment',
    label: 'White Regiment',
    era: 'classic',
    colorway: { primary: '#f4f2ec', secondary: '#17171a', accent: '#cfd4da', metal: 'silver' },
    figure: whiteRegiment,
  },
  {
    id: 'green-satin',
    label: 'Green Satin',
    era: 'classic',
    colorway: { primary: '#2e8148', secondary: '#161618', accent: '#eef0ee', metal: 'silver' },
    figure: greenSatin,
  },
  {
    id: 'cavalry',
    label: 'Cavalry',
    era: 'classic',
    colorway: { primary: '#c9b287', secondary: '#22355c', accent: '#e3b23c', metal: 'gold' },
    figure: cavalry,
  },
  {
    id: 'modern-swash',
    label: 'Modern Swash',
    era: 'classic',
    colorway: { primary: '#f0f2f5', secondary: '#2f6fd0', accent: '#101c33', metal: 'silver' },
    figure: modernSwash,
  },
  {
    id: 'ivory-blade',
    label: 'Ivory Blade',
    era: 'classic',
    colorway: { primary: '#ece2cc', secondary: '#17171a', accent: '#d9a41c', metal: 'gold' },
    figure: ivoryBlade,
  },
  {
    id: 'millennium',
    label: 'Millennium',
    era: 'modern',
    colorway: { primary: '#101c33', secondary: '#d7dde2', accent: '#2f6fd0', metal: 'silver' },
    figure: millennium,
  },
  {
    id: 'radial-burst',
    label: 'Radial Burst',
    era: 'modern',
    colorway: { primary: '#c23a2a', secondary: '#e8c25a', accent: '#17161c', metal: 'silver' },
    figure: radialBurst,
  },
  {
    id: 'op-art',
    label: 'Op-Art',
    era: 'modern',
    colorway: { primary: '#e08a12', secondary: '#1f6e63', accent: '#f7cf3e', metal: 'gold' },
    figure: opArt,
  },
  {
    id: 'streamline',
    label: 'Streamline',
    era: 'modern',
    colorway: { primary: '#2b3fbf', secondary: '#cdeee0', accent: '#5fd0e8', metal: 'silver' },
    figure: streamline,
  },
  {
    id: 'gold-rush',
    label: 'Gold Rush',
    era: 'modern',
    colorway: { primary: '#d0951c', secondary: '#26221c', accent: '#efe3c8', metal: 'gold' },
    figure: goldRush,
  },
  {
    id: 'neon-circuit',
    label: 'Neon Circuit',
    era: 'modern',
    colorway: { primary: '#16283f', secondary: '#4fc3ff', accent: '#e8641f', metal: 'silver' },
    figure: neonCircuit,
  },
  {
    id: 'patent-riot',
    label: 'Patent Riot',
    era: 'modern',
    colorway: { primary: '#141418', secondary: '#b3121c', accent: '#c9ced6', metal: 'silver' },
    figure: patentRiot,
  },
];

export function getUniformPreset(id: string): UniformPreset | undefined {
  return UNIFORM_PRESETS.find((p) => p.id === id);
}

/** A complete starter design from a preset (deep-copied so edits don't
 *  mutate the catalog). */
export function designFromPreset(preset: UniformPreset, name?: string): UniformDesignV2 {
  return {
    schema: 2,
    name: name || preset.label,
    colorway: { ...preset.colorway },
    figure: JSON.parse(JSON.stringify(preset.figure)) as FigureConfig,
  };
}
