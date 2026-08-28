// =============================================================================
// FIGURE TAP OVERLAY — the doll is the menu
// =============================================================================
// Invisible hit regions over the canvas figure: tap the hat to edit headwear,
// tap a leg to edit legs (docs/UNIFORM_STUDIO.md §5.2's "tap a region to jump
// to its slot"). Rendered as a *sibling* SVG over UniformFigure — never inside
// it — so the figure itself stays pure, memoized, and export-safe.
//
// Regions are generous rectangles against the shared figure geometry
// (uniformFigureParts.tsx, viewBox "0 -84 240 560", mirror axis x=120). Paint
// order resolves overlaps: later regions win hit-testing, so the chest strip
// sits over the torso, and the arms over the torso's edges.

import React from 'react';
import { FIGURE_VIEWBOX } from './uniformFigureParts';
import type { StudioSectionId } from './studioSections';

interface Region {
  section: StudioSectionId;
  label: string;
  /** viewBox-space rectangles (x, y, w, h). */
  rects: Array<[number, number, number, number]>;
}

// Landmarks: plume tops out at y≈-84, hat/head y≈-84..88, shoulder line
// y≈88..112 (torso top edge + epaulets), torso x≈78..162 y≈112..218, waist
// band y≈218..262, sleeves x≈57..88 (mirrored 152..183) y≈103..244, legs
// y≈254..438, shoes y≈436..457.
const REGIONS: Region[] = [
  { section: 'torso', label: 'torso', rects: [[76, 112, 88, 106]] },
  { section: 'chest', label: 'chest', rects: [[96, 112, 48, 82]] },
  { section: 'waist', label: 'waist', rects: [[76, 218, 88, 44]] },
  { section: 'headwear', label: 'head and hat', rects: [[62, -84, 116, 172]] },
  { section: 'shoulders', label: 'shoulders and neck', rects: [[54, 88, 132, 24]] },
  {
    section: 'arms',
    label: 'arms',
    rects: [
      [40, 112, 46, 138],
      [154, 112, 46, 138],
    ],
  },
  { section: 'legs', label: 'legs', rects: [[68, 262, 104, 166]] },
  { section: 'feet', label: 'feet', rects: [[68, 428, 104, 48]] },
];

export interface FigureTapOverlayProps {
  onSelect: (section: StudioSectionId) => void;
  /** Currently edited section — its region gets a resting highlight. */
  activeSection?: string | null;
}

/**
 * Absolutely-positioned over a relatively-positioned wrapper that is sized by
 * the UniformFigure it covers; both share FIGURE_VIEWBOX, so viewBox
 * coordinates line up 1:1.
 */
export default function FigureTapOverlay({ onSelect, activeSection }: FigureTapOverlayProps) {
  return (
    <svg
      viewBox={FIGURE_VIEWBOX}
      className="absolute inset-0 w-full h-full"
      role="group"
      aria-label="Tap a part of the uniform to edit it"
    >
      {REGIONS.map((region) => {
        const active = activeSection === region.section;
        return (
          <g
            key={region.section}
            role="button"
            tabIndex={0}
            aria-label={`Edit ${region.label}`}
            onClick={() => onSelect(region.section)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(region.section);
              }
            }}
            className="cursor-pointer outline-none group"
          >
            {region.rects.map(([x, y, w, h], i) => (
              <rect
                key={i}
                x={x}
                y={y}
                width={w}
                height={h}
                rx={4}
                className={`transition-colors duration-150 ${
                  active
                    ? 'fill-white/[0.07] stroke-interactive/60'
                    : 'fill-transparent stroke-transparent group-hover:fill-white/[0.08] group-focus-visible:fill-white/[0.08] group-focus-visible:stroke-interactive/60'
                }`}
                strokeWidth={1.5}
                strokeDasharray="4 3"
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
}
