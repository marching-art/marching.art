// =============================================================================
// STUDIO CANVAS — the live figure viewport
// =============================================================================
// Two size modes off one implementation:
//   - "compact" (mobile): height-bounded so the doll + actions + tab strip fit
//     one pinned block; the figure sizes to the viewport height and the tool
//     cluster overlays the corner (map-control idiom).
//   - "full" (desktop): the classic width-bounded column canvas.
// Both wrap the pure UniformFigure with the FigureTapOverlay sibling (the doll
// is the menu) and support zoom (the viewport becomes scrollable) and the
// press-box strip. A ~160ms opacity pulse acknowledges every edit.

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
  /** Compact mode only: the corner tool cluster (press-box, zoom, peek…). */
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
    <div
      className={`${
        mode === 'compact' ? 'h-full w-full' : 'h-80'
      } flex items-end justify-center gap-4 bg-surface-sunken border border-line p-4`}
    >
      {[0, 1, 2].map((i) => (
        <UniformFigure key={i} figure={figure} label="Press-box preview figure" width={34} />
      ))}
    </div>
  );

  const doll = (wrapperStyle: React.CSSProperties, figureProps: { width: string }) => (
    <div
      className="relative"
      style={{
        ...wrapperStyle,
        opacity: pulsing ? 0.85 : 1,
        transition: 'opacity 160ms ease-out',
      }}
    >
      <UniformFigure
        figure={figure}
        label={label}
        width={figureProps.width}
        style={figureProps.width === 'auto' ? { height: '100%', display: 'block' } : undefined}
      />
      <FigureTapOverlay onSelect={onRegionSelect} activeSection={activeSection} />
    </div>
  );

  if (mode === 'compact') {
    return (
      <div className="relative">
        <div className="h-[34vh] min-h-[210px] max-h-[330px] overflow-auto scroll-momentum flex">
          {pressBox ? (
            pressStrip
          ) : (
            <div className="m-auto h-full flex-shrink-0" style={{ height: `${zoom * 100}%` }}>
              {doll({ height: '100%' }, { width: 'auto' })}
            </div>
          )}
        </div>
        {tools && <div className="absolute top-1 right-1 z-10 flex flex-col gap-1">{tools}</div>}
      </div>
    );
  }

  return (
    <div
      className={`mx-auto max-w-[280px] ${
        zoom > 1 && !pressBox ? 'overflow-auto max-h-[600px] scroll-momentum' : ''
      }`}
    >
      {pressBox ? pressStrip : doll({ width: `${zoom * 100}%` }, { width: '100%' })}
    </div>
  );
}
