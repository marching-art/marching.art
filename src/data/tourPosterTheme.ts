// =============================================================================
// TOUR POSTER — PALETTE & LAYOUT
// =============================================================================
// The tour poster is an SVG that leaves the app: it is serialized and rasterized
// for the "Save PNG" action, so it cannot inherit a single Tailwind class or CSS
// variable — every color has to be a literal baked into the markup.
//
// These values are the design tokens (tailwind.config.cjs / src/index.css)
// transcribed, NOT a second palette. Roles are unchanged:
//   charcoal ramp = surfaces, azure = the route (interaction/self),
//   gold = majors and championships (the reward tier), muted gray = structure.
// If a token moves, move it here too.

export const POSTER_COLORS = {
  // Surfaces (background → surface-elevated)
  background: '#0A0A0A',
  panel: '#111111',
  card: '#1A1A1A',
  raised: '#222222',

  // Structure (line-subtle → line-strong)
  lineSubtle: '#242424',
  lineMuted: '#2A2A2A',
  line: '#333333',
  lineStrong: '#444444',

  // Text
  white: '#FFFFFF',
  secondary: '#B3B3B3',
  muted: '#999999',

  // Interactive / self — the tour route and the corps' own markers
  route: '#60A5FA',
  routeDim: '#3B82F6',

  // Brand / reward — majors and championship week only
  brand: '#EAB308',
  brandStrong: '#CA8A04',
} as const;

/** Tier of a tour stop, which drives its marker and route treatment. */
export type StopKind = 'show' | 'major' | 'championship';

/** Marker + route treatment per stop tier. */
export const STOP_STYLES: Record<StopKind, { color: string; label: string }> = {
  show: { color: POSTER_COLORS.route, label: 'Show' },
  major: { color: POSTER_COLORS.brandStrong, label: 'Major' },
  championship: { color: POSTER_COLORS.brand, label: 'Championship' },
};

// Font stacks, not classes: the rasterized PNG renders outside the document, so
// the page's webfonts may not resolve. Generic fallbacks keep the export clean.
export const POSTER_FONTS = {
  sans: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif",
  mono: "'JetBrains Mono', ui-monospace, 'Roboto Mono', monospace",
} as const;

/**
 * Poster geometry. The map block is exactly the tourMapGeo canvas (960x600) so
 * the pre-projected paths drop in at 1:1 with no rescaling of stroke widths.
 */
export const POSTER = {
  width: 1368,
  height: 816,
  pad: 24,
  header: { y: 24, height: 88 },
  map: { x: 24, y: 124, width: 960, height: 600 },
  list: { x: 1000, y: 124, width: 344, height: 600 },
  footer: { y: 740, height: 52 },
} as const;
