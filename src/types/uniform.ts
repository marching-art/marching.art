// =============================================================================
// UNIFORM STUDIO — v2 design types
// =============================================================================
// The structured, renderable successor to the prose-based CorpsUniformDesign
// (v1, src/types/corps.ts). A v2 design is pure data: catalog option ids plus
// hex color channels. Nothing in it is free text that renders on another
// player's screen — the only prose fields live in `aiHints`, which is used
// exclusively to enrich AI image prompts and never displayed.
//
// The renderable core is `FigureConfig`, consumed by
// src/components/uniform/UniformFigure.tsx. Its shape deliberately matches the
// proposal prototype (docs/prototypes/uniform-figure.html) so the two stay
// directly comparable. See docs/UNIFORM_STUDIO.md §10.1.

/** A CSS hex color in #rrggbb form. Validated by isHexColor (utils/uniform). */
export type HexColor = string;

export type MetalColor = 'gold' | 'silver';

/** The corps colorway: the palette every channel defaults to. */
export interface UniformColorway {
  primary: HexColor;
  secondary: HexColor;
  accent: HexColor;
  metal: MetalColor;
}

/**
 * A fill spec for a garment region: either a hex color or a reference to a
 * procedural print/gradient defined by the figure ("url:sun", "url:opart",
 * "url:plaid", "url:pinstripe", "url:foil", or a key of `grads`).
 */
export type FillSpec = string;

/**
 * One stop of a named linear gradient: an `offset` in [0,1] as a string and
 * its color. Stored as an object rather than an `[offset, hex]` tuple because
 * Firestore rejects an array nested directly inside another array, so tuple
 * stops cannot be persisted (a saved design with tuple stops fails with a bare
 * 500). Keep this the single source of truth for the stop shape.
 */
export interface GradStop {
  /** Offset in [0,1] as a string, e.g. '0', '0.55', '1'. */
  o: string;
  /** The stop color. */
  c: HexColor;
}

export type ProceduralPrint = 'sunburst' | 'opart' | 'pinstripe';

/** Every procedural surface whose colors a director can override. */
export type PrintColorKey = ProceduralPrint | 'plaid' | 'foil';

/**
 * Director color overrides for the figure's procedural prints. Each surface
 * exposes its identity slots as a fixed-length hex list (lengths enforced
 * server-side): sunburst [center, mid, outer]; opart [base, dot A, dot B];
 * pinstripe [base, stripe]; plaid [base, band, cross band]; foil
 * [tone, highlight]. Derived shades (the burst's dark falloff, the op-art
 * wave, the plaid's thin band, the foil ramp) come from these in the
 * renderer. An absent surface renders with its stock palette
 * (PRINT_PALETTES in data/uniformRenderTheme).
 */
export type PrintColors = Partial<Record<PrintColorKey, HexColor[] | null>>;

export type TorsoStyle = 'jacket' | 'tunic' | 'jumpsuit';

export type ChestTreatment =
  'none' | 'braid' | 'sash' | 'baldric' | 'plastron' | 'buttons' | 'swash' | 'vinylPanel';

export type HatType = 'shako' | 'pith' | 'campaign' | 'aussie' | 'contour' | null;

export type PlumeType = 'upright' | 'fountain' | 'sideFeather';

/** Selectable front ornament for shako/pith (and the aussie's side badge). */
export type HatOrnament =
  'sunburst' | 'star' | 'shield' | 'chevron' | 'disc' | 'diamond' | 'rect' | 'none';

export interface HatConfig {
  body: HexColor;
  band?: HexColor | null;
  /** Front plate / cog color (shako sunburst, pith stud); null → metal. */
  emblem?: HexColor | null;
  /** Ornament shape; undefined keeps each hat's legacy default. */
  ornament?: HatOrnament;
  /** Mirror the hat (the aussie's lifted side + side feather swap sides). */
  flip?: boolean;
}

/**
 * A chest badge on the left breast: any ornament shape in its own colors,
 * independent of the hat (the SCV-style patch). `accent` overrides the
 * derived inner-detail shade for a true two-tone badge.
 */
export interface ChestBadge {
  shape: HatOrnament;
  color: HexColor;
  accent?: HexColor | null;
  /** Wear the badge on the other breast. */
  flip?: boolean;
}

/** Cut of the diagonal sash/baldric band. */
export type ChestShape = 'band' | 'triangles' | 'tapered';

export interface PlumeConfig {
  type: PlumeType;
  color: HexColor;
  /** Two-tone: dyes the upright's tip / the fountain's alternating sprays. */
  accent?: HexColor | null;
  /** Mylar sparkle strands (upright only). */
  mylar?: boolean;
}

/** Per-side arm configuration — left and right are independent (modern axis). */
export interface ArmConfig {
  type: 'sleeve' | 'bare' | 'half' | 'none';
  /** Solid hex or a print/gradient reference; ignored for `bare`. */
  fill?: FillSpec | null;
  color?: HexColor | null;
  /** Detached sleeve: bare shoulder, sleeve from above the elbow down. */
  detached?: boolean;
  /** Patent-vinyl gloss highlight on the sleeve. */
  patent?: boolean;
  /** Glow piping line down the sleeve (hex color); requires figure.glow. */
  glowLine?: HexColor | null;
  gauntlet?: { color: HexColor; sequin?: boolean } | null;
  /** Glove color; null/undefined renders a bare hand in the skin tone. */
  glove?: HexColor | null;
}

/** Per-side leg configuration — left and right are independent (modern axis). */
export interface LegConfig {
  /** Solid hex; ignored when `fill` is set. */
  color?: HexColor | null;
  /** Print/gradient reference (e.g. "url:opart", "url:plaid", "url:foil"). */
  fill?: FillSpec | null;
  stripe?: HexColor | null;
  flare?: boolean;
  tattered?: boolean;
  /** Metallic-foil treatment (sequins + sheen over the fill). */
  foil?: boolean;
  sequin?: boolean;
}

/**
 * The complete renderable figure. Field-for-field compatible with the
 * proposal prototype's colorway configs so designs render identically in both.
 */
export interface FigureConfig {
  /** Skin tone of the previewed corps member (figure, not the director). */
  skin: HexColor;
  hairShow?: boolean;
  hair?: HexColor | null;

  torsoStyle?: TorsoStyle;
  /** Torso fill override (print reference); defaults to `jacket`. */
  torsoFill?: FillSpec | null;
  jacket?: HexColor | null;
  /** Which procedural print this figure defines (fills reference it). */
  print?: ProceduralPrint | null;
  /** Color overrides for procedural prints; absent surfaces use stock hues. */
  printColors?: PrintColors | null;
  /** Define the plaid pattern (referenced as "url:plaid"). */
  plaid?: boolean;
  /** Named linear gradients, each a list of stops (see {@link GradStop}). */
  grads?: Record<string, GradStop[]> | null;
  /** Define the gold-foil leg gradient (referenced as "url:foil"). */
  foilLeg?: boolean;
  /** Define the glow filter (used by glowArt / arm glowLine). */
  glow?: boolean;
  /** Glow line-art color on the torso. */
  glowArt?: HexColor | null;
  /** Velvet sheen overlay on the torso. */
  velvet?: boolean;
  /** Patent-vinyl gloss highlights on the torso. */
  patent?: boolean;
  /** Satin sheen overlay on the torso. */
  satin?: boolean;
  /** Sequin field across the torso (clipped to the garment). */
  torsoSequin?: boolean;

  chest?: ChestTreatment;
  /** Badge patch on the left breast; independent of the chest treatment. */
  chestBadge?: ChestBadge | null;
  /** Cut of the sash/baldric band; undefined → the classic solid band. */
  chestShape?: ChestShape;
  /** Button color for braid rows and double-breasted buttons; null → metal. */
  buttonColor?: HexColor | null;
  /** Run the diagonal treatments (sash/baldric/swash) over the other shoulder. */
  chestReverse?: boolean;
  /** Fade the sash/baldric/swash band between two colors, top to bottom. */
  chestFade?: [HexColor, HexColor] | null;
  braid?: HexColor | null;
  sash?: HexColor | null;
  sashSequin?: boolean;
  baldric?: HexColor | null;
  /** Two-tone baldric: center-stripe color inside the band. */
  baldricCenter?: HexColor | null;
  baldricSequin?: boolean;
  panel?: HexColor | null;
  panelTrim?: HexColor | null;
  swash?: HexColor | null;
  /** Sequins on the modern swash (chest + leg band); ON unless false. */
  swashSequin?: boolean;
  /** The swash's torso part; ON unless false (leg band can stand alone). */
  swashTop?: boolean;
  /** The swash's leg band; ON unless false (torso part can stand alone). */
  swashBottom?: boolean;
  /** The swash's leg band color; null → matches the swash. */
  swashLegColor?: HexColor | null;

  metal?: HexColor | null;
  collar?: HexColor | null;
  collarTrim?: HexColor | null;
  mockNeck?: FillSpec | null;
  cowl?: HexColor | null;
  crew?: boolean;
  scarf?: HexColor | null;
  tie?: HexColor | null;

  epaulet?: HexColor | null;
  suspenders?: HexColor | null;

  belt?: HexColor | null;
  buckle?: HexColor | null;
  waistBand?: HexColor | null;
  waistBandEdge?: HexColor | null;
  fringe?: HexColor | null;
  streamers?: [HexColor, HexColor] | null;

  armL?: ArmConfig;
  armR?: ArmConfig;
  legL?: LegConfig;
  legR?: LegConfig;

  /** Legacy symmetric shorthands, expanded by normalizeFigure(). */
  sleeve?: HexColor | null;
  gauntlet?: HexColor | null;
  gauntletSequin?: boolean;
  glove?: HexColor | null;
  pants?: HexColor | null;
  stripe?: HexColor | null;

  shoe?: HexColor | null;
  sneaker?: boolean;
  spats?: boolean;

  hatType?: HatType;
  hat?: HatConfig | null;
  plume?: PlumeConfig | null;
}

/** Private, prompt-only prose retained for AI imagery. Never rendered. */
export interface UniformAiHints {
  mascotOrEmblem?: string;
  themeKeywords?: string[];
  additionalNotes?: string;
}

/** A saved wardrobe design (users/{uid}/wardrobe/{designId}). */
export interface UniformDesignV2 {
  schema: 2;
  /** Owner-visible label, e.g. "2026 Finals Look". */
  name: string;
  colorway: UniformColorway;
  figure: FigureConfig;
  aiHints?: UniformAiHints;
  /** ISO timestamps, set server-side by the wardrobe callables. */
  createdAt?: string;
  updatedAt?: string;
}

/**
 * The equipped snapshot embedded on the profile at corps.{class}.uniform —
 * a bounded copy so every surface can render the corps without an extra read.
 * Written only by the equipUniformDesign callable (server-only in rules).
 */
export interface EquippedUniform {
  designId: string;
  name: string;
  colorway: UniformColorway;
  figure: FigureConfig;
  equippedAt: string;
}
