// =============================================================================
// UNIFORM FIGURE — deterministic layered-SVG corps figure renderer
// =============================================================================
// The Studio's product: a corps member rendered from a structured design in
// real time, with zero AI round-trips. Architecture (docs/UNIFORM_STUDIO.md
// §10.3–10.4): albedo garment parts whose fills come from colorway channels +
// a shared, colorway-independent shading/highlight overlay set + procedural
// finish effects (sequin fields, satin/velvet sheen, patent gloss, glow
// piping) and procedural prints (radial burst, op-art, plaid, pinstripe).
// Symmetric limbs are authored once and mirrored; per-side configs unlock the
// modern asymmetry axis.
//
// Like TourPoster, this SVG is style-attribute-only (no Tailwind classes, no
// CSS variables) so it can be serialized and exported via posterExport. All
// hex constants live in src/data/uniformRenderTheme.ts (design-census
// exempt); user-supplied colors pass through safeHex(). Geometry is ported
// field-for-field from the proposal prototype
// (docs/prototypes/uniform-figure.html) — keep the two in sync when adding
// parts (the part builders live in uniformFigureParts.tsx).

import React, { forwardRef, useId, useMemo } from 'react';
import type { FigureConfig } from '../../types/uniform';
import { FIGURE_VIEWBOX } from './uniformFigureParts';
import { figureLayers } from './uniformFigureAssembly';

export { FIGURE_VIEWBOX } from './uniformFigureParts';

export interface UniformFigureProps {
  figure: FigureConfig;
  /** Accessible description, e.g. "Blue Stars identity uniform". */
  label: string;
  /** CSS width; the figure scales via its viewBox. Pass 'auto' to size the
   *  figure from a style height instead (the width follows the viewBox
   *  aspect ratio; no width attribute is emitted — "auto" is not a valid
   *  SVG length). */
  width?: number | string;
  style?: React.CSSProperties;
}

/**
 * The renderable corps figure. Pure and deterministic: same design in, same
 * SVG out — safe to render at avatar size, editor size, or export size.
 */
const UniformFigure = forwardRef<SVGSVGElement, UniformFigureProps>(function UniformFigure(
  { figure, label, width = '100%', style },
  ref
) {
  const reactId = useId();
  // useId() emits colons, which are invalid inside url(#…) references.
  const uid = useMemo(() => `uf${reactId.replace(/[^a-zA-Z0-9]/g, '')}`, [reactId]);
  const layers = useMemo(() => figureLayers(figure, uid), [figure, uid]);
  return (
    <svg
      ref={ref}
      viewBox={FIGURE_VIEWBOX}
      width={width === 'auto' ? undefined : width}
      style={style}
      role="img"
      aria-label={label}
      xmlns="http://www.w3.org/2000/svg"
    >
      {layers}
    </svg>
  );
});

export default React.memo(UniformFigure);
