// =============================================================================
// UNIFORM SHARE CARD — the "field entrance" export (docs/UNIFORM_STUDIO.md §7.2)
// =============================================================================
// A 1200×630 (OG-ratio) SVG: the corps in formation — a mixed-tone ensemble,
// per the proposal's "design for every body" reading — under stadium lights,
// with corps name, class, colorway, and the uniform code stamped in the
// corner so the card carries its own import mechanism. Style-attribute-only
// (posterExport rasterizes it in an isolated context; page CSS never follows).

import React, { forwardRef } from 'react';
import type { UniformDesignV2 } from '../../types/uniform';
import {
  FIGURE_INK,
  FIGURE_SKIN_TONES,
  SHARE_CARD_THEME as CARD,
} from '../../data/uniformRenderTheme';
import { METAL_HEX } from '../../data/uniformCatalog';
import { safeHex } from '../../utils/uniform';
import { figureLayers } from './uniformFigureAssembly';
import { sequinField } from './uniformFigureParts';

export interface UniformShareCardProps {
  design: UniformDesignV2;
  corpsName: string;
  classLabel: string;
  /** Minted uniform code; omitted → the stamp is left off. */
  code?: string | null;
}

// Formation: two back, two mid, one front-center — feet on the field lines.
// tx/ty map the figure's local space (x 0-240, feet at y≈466) into the card.
const FORMATION: Array<{ s: number; cx: number; feetY: number; tone: number }> = [
  { s: 0.42, cx: 200, feetY: 468, tone: 5 },
  { s: 0.42, cx: 424, feetY: 468, tone: 1 },
  { s: 0.53, cx: 116, feetY: 528, tone: 3 },
  { s: 0.53, cx: 506, feetY: 528, tone: 6 },
  { s: 0.68, cx: 308, feetY: 598, tone: 2 },
];

const SANS = "system-ui, -apple-system, 'Segoe UI', sans-serif";
const MONO = "ui-monospace, 'SF Mono', Menlo, monospace";

const UniformShareCard = forwardRef<SVGSVGElement, UniformShareCardProps>(function UniformShareCard(
  { design, corpsName, classLabel, code },
  ref
) {
  const cw = design.colorway;
  const swatches = [
    safeHex(cw.primary),
    safeHex(cw.secondary),
    safeHex(cw.accent),
    METAL_HEX[cw.metal] || METAL_HEX.gold,
  ];
  // The panel is ~490px wide; scale the name down so long corps names fit
  // (bold glyphs average ≈0.62em, the lighter design-name line ≈0.52em).
  const nameSize = Math.min(64, Math.floor(490 / (0.62 * Math.max(1, corpsName.length))));
  const designNameSize = Math.min(
    24,
    Math.floor(490 / (0.52 * Math.max(1, design.name.length + 2)))
  );
  return (
    <svg
      ref={ref}
      viewBox="0 0 1200 630"
      width="100%"
      role="img"
      aria-label={`${corpsName} uniform share card`}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* night sky + stadium bowl */}
      <rect width="1200" height="630" fill={CARD.bg} />
      <rect width="1200" height="340" fill={CARD.sky} />
      <rect y="300" width="1200" height="130" fill={CARD.stands} />
      <rect y="300" width="1200" height="4" fill={CARD.standsRail} />
      <rect y="426" width="1200" height="4" fill={CARD.standsRail} />
      {/* crowd shimmer + light towers */}
      <g opacity="0.5">{sequinField('crowd', 600, 365, 1150, 100, 7, 160)}</g>
      {[90, 1110].map((x) => (
        <g key={`lt${x}`}>
          <rect x={x - 3} y="180" width="6" height="120" fill={CARD.standsRail} />
          <rect x={x - 26} y="164" width="52" height="18" fill={CARD.standsRail} />
          {[-18, -6, 6, 18].map((dx) => (
            <circle key={`b${dx}`} cx={x + dx} cy="173" r="4" fill={CARD.lightBulb} opacity="0.9" />
          ))}
          <polygon
            points={`${x - 24},182 ${x + 24},182 ${x + 190 * (x < 600 ? 1 : -1) + 24},560 ${
              x + 190 * (x < 600 ? 1 : -1) - 120
            },560`}
            fill={FIGURE_INK.white}
            opacity="0.04"
          />
        </g>
      ))}
      {/* field with converging yard lines */}
      <rect y="430" width="1200" height="200" fill={CARD.field} />
      {[-340, -120, 90, 300, 520, 760, 1000].map((x0) => (
        <line
          key={`yd${x0}`}
          x1={300 + (x0 - 300) * 0.25}
          y1="430"
          x2={x0}
          y2="630"
          stroke={CARD.fieldLine}
          strokeWidth="2"
          opacity="0.1"
        />
      ))}
      <line
        x1="0"
        y1="470"
        x2="1200"
        y2="470"
        stroke={CARD.fieldLine}
        strokeWidth="1.5"
        opacity="0.08"
      />
      <line
        x1="0"
        y1="540"
        x2="1200"
        y2="540"
        stroke={CARD.fieldLine}
        strokeWidth="1.5"
        opacity="0.07"
      />

      {/* the corps takes the field — mixed-tone ensemble in the design */}
      {FORMATION.map((m, i) => {
        const tone = FIGURE_SKIN_TONES[m.tone % FIGURE_SKIN_TONES.length];
        const tx = m.cx - 120 * m.s;
        const ty = m.feetY - 466 * m.s;
        return (
          <g
            key={`member${i}`}
            transform={`translate(${tx.toFixed(1)},${ty.toFixed(1)}) scale(${m.s})`}
          >
            {figureLayers({ ...design.figure, skin: tone }, `sc${i}`)}
          </g>
        );
      })}

      {/* identity panel */}
      <g>
        <rect x="620" y="88" width="4" height="150" fill={swatches[0]} />
        <text
          x="652"
          y="132"
          style={{ font: `800 30px ${SANS}`, letterSpacing: '0.3em', fill: CARD.muted }}
        >
          {classLabel.toUpperCase()}
        </text>
        <text x="648" y="208" style={{ font: `900 ${nameSize}px ${SANS}`, fill: CARD.text }}>
          {corpsName}
        </text>
        <text x="652" y="252" style={{ font: `600 ${designNameSize}px ${SANS}`, fill: CARD.muted }}>
          “{design.name}”
        </text>
        {swatches.map((hex, i) => (
          <g key={`sw${i}`}>
            <rect x={652 + i * 64} y="292" width="48" height="48" fill={hex} />
            <rect
              x={652 + i * 64}
              y="292"
              width="48"
              height="48"
              fill="none"
              stroke={CARD.panelRule}
              strokeWidth="2"
            />
          </g>
        ))}
        {code && (
          <g>
            <rect
              x="652"
              y="392"
              width="330"
              height="64"
              fill="none"
              stroke={CARD.brand}
              strokeWidth="2"
            />
            <text
              x="668"
              y="416"
              style={{ font: `700 13px ${SANS}`, letterSpacing: '0.25em', fill: CARD.muted }}
            >
              UNIFORM CODE
            </text>
            <text x="668" y="444" style={{ font: `700 26px ${MONO}`, fill: CARD.brand }}>
              {code}
            </text>
          </g>
        )}
        <text
          x="652"
          y="586"
          style={{ font: `700 20px ${SANS}`, letterSpacing: '0.18em', fill: CARD.muted }}
        >
          MARCHING.ART <tspan style={{ fill: CARD.brand }}>/STUDIO</tspan>
        </text>
      </g>
    </svg>
  );
});

export default UniformShareCard;
