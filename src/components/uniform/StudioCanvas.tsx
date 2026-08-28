// =============================================================================
// STUDIO CANVAS — the live figure viewport
// =============================================================================
// One height-bounded stage for both form factors — the doll sizes to the
// viewport height, so the canvas never dictates page height:
//   - "compact" (mobile): vh-capped so the doll + actions + tab strip stack
//     above the section panel, with a FRAMING CAMERA: the viewport frames the
//     figure region belonging to the active editor section (edit the hat, see
//     the hat big), easing between frames like a character-creator camera.
//     Tool clusters overlay the corners (map-control idiom).
//   - "full" (desktop): fills whatever height the canvas column gives it,
//     always full-body.
// The figure stands on a stage — a soft top spotlight and a floor shadow under
// the feet — instead of floating in flat card space. Both modes wrap the pure
// UniformFigure with the FigureTapOverlay sibling (the doll is the menu) and
// support zoom (manual zoom suspends the camera and the viewport becomes
// pannable) and the press-box strip. A ~160ms opacity pulse acknowledges every
// edit.

import React, { useEffect, useRef, useState } from 'react';
import type { FigureConfig } from '../../types/uniform';
import UniformFigure from './UniformFigure';
import FigureTapOverlay from './FigureTapOverlay';
import type { StudioSectionId } from './studioSections';

// Camera frames per editor section: [top, bottom] in viewBox y-units
// (FIGURE_VIEWBOX is "0 -84 240 560" — see the landmark map in
// FigureTapOverlay). Frames are deliberately generous (~240 units ≈ 2.2×
// zoom) so neighbouring parts stay in shot for context; sections without an
// entry (presets, colorway, wardrobe) frame the full figure.
const VIEWBOX_TOP = -84;
const VIEWBOX_HEIGHT = 560;
const CAMERA_FRAMES: Partial<Record<string, [number, number]>> = {
  headwear: [-84, 150],
  torso: [40, 280],
  chest: [30, 270],
  shoulders: [-20, 220],
  waist: [120, 360],
  arms: [50, 300],
  legs: [210, 470],
  feet: [220, 476],
};

export interface StudioCanvasProps {
  mode: 'compact' | 'full';
  figure: FigureConfig;
  label: string;
  pressBox: boolean;
  zoom: number;
  activeSection?: string | null;
  onRegionSelect: (section: StudioSectionId) => void;
  /** The top-right corner tool cluster (press-box, zoom, peek…). */
  tools?: React.ReactNode;
  /** The top-left corner tool cluster (undo/redo on mobile). */
  toolsLeft?: React.ReactNode;
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
  toolsLeft,
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

  // Height-driven doll body: sized by whichever wrapper it lands in, with the
  // floor shadow (feet sit ~3% above the viewBox bottom) and the tap overlay.
  const dollBody = (
    <div
      className="relative h-full"
      style={{ opacity: pulsing ? 0.85 : 1, transition: 'opacity 160ms ease-out' }}
    >
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
  );

  // The framing camera (compact, unzoomed): the doll is absolutely positioned
  // and oversized so the active section's frame fills the stage; top/height
  // ease between sections. No frame → the same element at height 100%, so the
  // camera animates back out to full body.
  const frame =
    mode === 'compact' && !pressBox && zoom === 1
      ? (activeSection && CAMERA_FRAMES[activeSection]) || [
          VIEWBOX_TOP,
          VIEWBOX_TOP + VIEWBOX_HEIGHT,
        ]
      : null;

  let viewport: React.ReactNode;
  if (frame) {
    const scale = VIEWBOX_HEIGHT / (frame[1] - frame[0]);
    const heightPct = scale * 100;
    const topPct = (-(frame[0] - VIEWBOX_TOP) / VIEWBOX_HEIGHT) * heightPct;
    viewport = (
      <div className="relative h-full overflow-hidden">
        <div
          className="absolute left-1/2 -translate-x-1/2 motion-safe:transition-[top,height] motion-safe:duration-300 motion-safe:ease-out"
          style={{ height: `${heightPct}%`, top: `${topPct}%` }}
        >
          {dollBody}
        </div>
      </div>
    );
  } else {
    viewport = (
      <div className="h-full overflow-auto overscroll-contain scroll-momentum scrollbar-thin flex">
        {pressBox ? (
          pressStrip
        ) : (
          <div className="m-auto h-full flex-shrink-0" style={{ height: `${zoom * 100}%` }}>
            {dollBody}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`relative ${
        mode === 'compact' ? 'h-[28vh] min-h-[190px] max-h-[300px]' : 'h-full min-h-[220px]'
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
      {viewport}
      {tools && <div className="absolute top-1 right-1 z-10 flex flex-col gap-1">{tools}</div>}
      {toolsLeft && (
        <div className="absolute top-1 left-1 z-10 flex flex-col gap-1">{toolsLeft}</div>
      )}
    </div>
  );
}
