// =============================================================================
// STUDIO CANVAS — the live figure viewport
// =============================================================================
// One height-bounded stage for both form factors — the doll sizes to the
// viewport height, so the canvas never dictates page height:
//   - "compact" (mobile): vh-capped so the doll + actions + tab strip stack
//     above the section panel; the tool cluster overlays the corner
//     (map-control idiom).
//   - "full" (desktop): fills whatever height the canvas column gives it.
// The figure stands on a stage — a soft top spotlight and a floor shadow under
// the feet — instead of floating in flat card space. Both modes wrap the pure
// UniformFigure with the FigureTapOverlay sibling (the doll is the menu) and
// support zoom (the viewport becomes pannable) and the press-box strip. A
// ~160ms opacity pulse acknowledges every edit.

import React, { useEffect, useRef, useState } from 'react';
import type { FigureConfig } from '../../types/uniform';
import UniformFigure from './UniformFigure';
import FigureTapOverlay from './FigureTapOverlay';
import type { StudioSectionId } from './studioSections';

export interface StudioCanvasProps {
  mode: 'compact' | 'full';
  figure: FigureConfig;
  label: string;
  pressBox: boolean;
  zoom: number;
  activeSection?: string | null;
  onRegionSelect: (section: StudioSectionId) => void;
  /** The corner tool cluster (press-box, zoom, peek…). */
  tools?: React.ReactNode;
}

export default function StudioCanvas({
  mode,
  figure,
  label,
  pressBox,
  zoom,
  activeSection,
  onRegionSelect,
  tools,
}: StudioCanvasProps) {
  // Subtle acknowledge-the-edit pulse; skipped on first paint.
  const [pulsing, setPulsing] = useState(false);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setPulsing(true);
    const t = setTimeout(() => setPulsing(false), 160);
    return () => clearTimeout(t);
  }, [figure]);

  const pressStrip = (
    <div className="h-full w-full flex items-end justify-center gap-4 bg-surface-sunken border border-line p-4">
      {[0, 1, 2].map((i) => (
        <UniformFigure key={i} figure={figure} label="Press-box preview figure" width={34} />
      ))}
    </div>
  );

  // Height-driven doll: the wrapper takes 100% (× zoom) of the viewport and
  // the SVG sizes itself to that height, so the figure always fits the stage.
  const doll = (
    <div className="m-auto h-full flex-shrink-0" style={{ height: `${zoom * 100}%` }}>
      <div
        className="relative h-full"
        style={{ opacity: pulsing ? 0.85 : 1, transition: 'opacity 160ms ease-out' }}
      >
        {/* Floor shadow — grounds the figure. Feet sit ~3% above the viewBox
            bottom (uniformFigureParts landmarks), so the ellipse hugs them. */}
        <div
          aria-hidden="true"
          className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
          style={{
            bottom: '1.5%',
            width: '64%',
            height: '4%',
            background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.5), transparent 70%)',
          }}
        />
        <UniformFigure
          figure={figure}
          label={label}
          width="auto"
          style={{ height: '100%', display: 'block' }}
        />
        <FigureTapOverlay onSelect={onRegionSelect} activeSection={activeSection} />
      </div>
    </div>
  );

  return (
    <div
      className={`relative ${
        mode === 'compact' ? 'h-[34vh] min-h-[210px] max-h-[330px]' : 'h-full min-h-[220px]'
      }`}
      // Stage spotlight: a faint overhead pool of light behind the doll.
      style={
        pressBox
          ? undefined
          : {
              background:
                'radial-gradient(120% 85% at 50% 8%, rgba(255,255,255,0.05), transparent 55%)',
            }
      }
    >
      <div className="h-full overflow-auto overscroll-contain scroll-momentum flex">
        {pressBox ? pressStrip : doll}
      </div>
      {tools && <div className="absolute top-1 right-1 z-10 flex flex-col gap-1">{tools}</div>}
    </div>
  );
}
