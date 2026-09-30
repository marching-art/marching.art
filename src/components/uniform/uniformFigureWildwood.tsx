// =============================================================================
// UNIFORM FIGURE PARTS — Wildwood pack (Alder & Moss)
// =============================================================================
// The "living forest" design house: a branching raised-metal vein network for
// the torso, sleeves and legs (optionally bioluminescent — every vein carries
// a soft glow in one color), the pleated gill fan chest inset, the sheer
// asymmetric drape, and the patina brocade print. Kept in its own module
// (max-lines guardrail); the assembly and chest builders call in here. Every
// piece is pure SVG with style attributes only, like the rest of the figure,
// so exports and the equip-preview rasterizer keep working.

import React from 'react';
import type { ArmConfig } from '../../types/uniform';
import {
  armShowsVeins,
  darkenHex,
  figureShowsVeins,
  lightenHex,
  resolvePrintPalettes,
  safeHex,
  type NormalizedFigure,
} from '../../utils/uniform';
import { FIGURE_INK } from '../../data/uniformRenderTheme';
import {
  LEG_D,
  LEG_FLARE_D,
  LEG_TATTER_D,
  mirrored,
  p,
  shade,
  strokeP,
  type Node,
} from './uniformFigureParts';
import { needsPrismGlow } from './uniformFigurePrism';

/** One vein tier: [path, stroke width]. Trunk → branches → twigs taper. */
type VeinTier = [string, number];

/**
 * Torso network (viewer-left rise): a trunk from the hip to the collar with
 * branches reaching both edges, plus a smaller shoot on the far hem so the
 * whole front reads as one living system.
 */
const TORSO_VEINS: VeinTier[] = [
  ['M96,262 Q100,230 108,206 Q116,184 114,160 Q112,140 122,120 Q128,110 138,104', 3.2],
  [
    'M108,206 Q96,194 90,176 M114,160 Q100,150 94,132 M122,120 Q112,112 104,104 M111,196 Q126,190 134,176 M116,172 Q130,166 140,150 M100,236 Q112,232 120,222 M146,262 Q142,240 146,220 Q150,204 146,190',
    2,
  ],
  [
    'M90,176 Q88,168 90,160 M90,176 Q84,172 82,164 M94,132 Q90,124 92,116 M94,132 Q88,130 84,124 M134,176 Q140,172 146,174 M134,176 Q136,168 134,160 M140,150 Q146,144 150,146 M140,150 Q140,140 144,134 M120,222 Q128,220 132,214 M120,222 Q122,214 118,208 M104,104 Q100,100 96,102 M138,104 Q146,102 152,106 M146,220 Q154,214 156,206 M146,236 Q138,230 134,222 M146,190 Q140,184 142,176',
    1.1,
  ],
];

/** Arm network (arm-local, viewer-left): shoulder → wrist → back of hand. */
const ARM_VEINS: VeinTier[] = [
  ['M76,110 Q67,138 67,168 Q68,198 71,226 Q72,244 71,258', 2.2],
  [
    'M67,146 Q74,154 79,166 M68,184 Q62,194 61,206 M70,212 Q77,220 80,232 M71,236 Q66,242 64,250',
    1.5,
  ],
  [
    'M79,166 Q82,172 81,178 M61,206 Q59,212 61,218 M80,232 Q82,238 81,244 M71,258 Q76,262 78,266 M71,258 Q67,263 66,267 M73,124 Q78,128 82,126',
    0.9,
  ],
];

/** Leg network (viewer-left): climbs from the hem up the outer leg. */
const LEG_VEINS: VeinTier[] = [
  ['M101,436 Q97,404 99,372 Q101,342 95,314 Q91,292 94,268', 2],
  [
    'M99,388 Q106,378 110,362 M98,352 Q105,342 109,326 M95,310 Q101,300 106,290 M100,414 Q93,406 90,394 M97,334 Q91,326 89,314',
    1.4,
  ],
  [
    'M110,362 Q113,356 112,350 M109,326 Q112,318 111,312 M106,290 Q110,284 110,278 M90,394 Q87,388 88,382',
    0.8,
  ],
];

/** The gill fan wedge: pivot at the center chest, rim along the shoulder. */
const GILL_PIVOT: [number, number] = [124, 160];
const GILL_D = 'M124,160 L121,100 Q142,95 162,104 L158,152 Z';
const GILL_RIM = 'M121,100 Q142,95 162,104 L158,152';

/** The sheer drape (viewer-left hip) and its double-layer fold. */
const DRAPE_D =
  'M90,236 Q84,270 78,306 Q70,352 62,404 L72,392 L76,428 L88,400 L98,446 L104,398 Q110,340 112,300 Q115,262 118,236 Z';
const DRAPE_FOLD_D =
  'M96,240 Q90,300 84,352 Q80,390 76,428 L88,400 Q94,340 100,290 Q104,262 106,240 Z';
const DRAPE_LINES = 'M100,240 Q94,320 88,400 M110,244 Q106,330 98,446 M92,250 Q80,330 72,392';

/** Whether the bioluminescent veins need the shared glow filter defined. */
export function needsWildwoodGlow(cw: NormalizedFigure): boolean {
  return Boolean(cw.veinGlow && figureShowsVeins(cw));
}

/**
 * Wildwood defs: the patina brocade pattern (when referenced) and the glow
 * filter when the veins glow but neither the figure's own `glow` flag nor a
 * Prism Forge piece already defines it — never twice, so the id is unique.
 */
export function wildwoodDefs(cw: NormalizedFigure, uid: string): Node {
  const wantsGlow = !cw.glow && !needsPrismGlow(cw) && needsWildwoodGlow(cw);
  if (!cw.brocade && !wantsGlow) return null;
  const br = resolvePrintPalettes(cw).brocade;
  return (
    <defs key="wild-defs">
      {cw.brocade && (
        <pattern id={`${uid}-brocade`} width="20" height="20" patternUnits="userSpaceOnUse">
          <rect width="20" height="20" fill={br.bg} />
          {/* patina mottle: sunken blots so the cloth reads as aged metal */}
          <path
            d="M0,13 Q4,10 8,14 Q5,18 0,17 Z M13,0 Q17,3 20,1 L20,6 Q15,6 13,0 Z"
            fill={br.mottle}
            opacity=".7"
          />
          {/* damask: a leaf-and-scroll ogee, quartered at the tile corners */}
          <path d="M10,3 C14,6 14,9 10,12 C6,9 6,6 10,3 Z" fill={br.motif} opacity=".75" />
          <path
            d="M10,12 C12.4,13.6 12.4,16 10,18 C7.6,16 7.6,13.6 10,12 Z"
            fill={br.motif}
            opacity=".45"
          />
          <path
            d="M0,0 C3,2 3,4 0,6 Z M20,0 C17,2 17,4 20,6 Z M0,20 C3,18 3,16 0,14 Z M20,20 C17,18 17,16 20,14 Z"
            fill={br.motif}
            opacity=".6"
          />
          <path
            d="M2,10 Q5,7 7,10 Q5,12 3.6,10.6 M18,10 Q15,7 13,10 Q15,12 16.4,10.6"
            fill="none"
            stroke={br.motif}
            strokeWidth=".7"
            strokeLinecap="round"
          />
          <circle cx="4.2" cy="4.4" r=".7" fill={br.fleck} />
          <circle cx="16" cy="6.8" r=".5" fill={br.fleck} />
          <circle cx="15.2" cy="15.6" r=".75" fill={br.fleck} />
          <circle cx="5.4" cy="16.2" r=".45" fill={br.fleck} />
          <circle cx="10" cy="7.6" r=".4" fill={br.fleck} opacity=".85" />
        </pattern>
      )}
      {wantsGlow && (
        <filter id={`${uid}-glow`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      )}
    </defs>
  );
}

/**
 * A tapered vein network in raised metal: a drop shadow, the metal body, and
 * a specular edge. When `glow` is set, a blurred halo in that color sits under
 * the metal and a faint lit core runs along it — the "concealed light".
 */
function veinNodes(
  kp: string,
  tiers: VeinTier[],
  color: string,
  glow: string | null,
  uid: string
): Node[] {
  const c = safeHex(color);
  const join = { strokeLinejoin: 'round' };
  const tier = (tag: string, stroke: string, widthOf: (w: number) => number) =>
    tiers.map(([d, w], i) => strokeP(`${kp}-${tag}${i}`, d, stroke, widthOf(w), join));
  const out: Node[] = [];
  if (glow) {
    out.push(
      <g key={`${kp}-gw`} filter={`url(#${uid}-glow)`} opacity=".85">
        {tier('gw', safeHex(glow), (w) => w + 2.4)}
      </g>
    );
  }
  out.push(
    <g key={`${kp}-sd`} transform="translate(.7,.8)" opacity=".45">
      {tier('sd', darkenHex(c, 0.6), (w) => w)}
    </g>,
    ...tier('bd', c, (w) => w),
    <g key={`${kp}-hl`} transform="translate(-.35,-.4)" opacity=".55">
      {tier('hl', lightenHex(c, 0.55), (w) => w * 0.35)}
    </g>
  );
  if (glow) {
    out.push(
      <g key={`${kp}-cr`} opacity=".5">
        {tier('cr', lightenHex(safeHex(glow), 0.45), (w) => w * 0.3)}
      </g>
    );
  }
  return out;
}

/** The torso vein network, clipped to the garment; `flip` mirrors it. */
export function torsoVeins(cw: NormalizedFigure, uid: string): Node[] {
  const v = cw.veins;
  if (!v) return [];
  const nodes = veinNodes('tvn', TORSO_VEINS, v.color, cw.veinGlow || null, uid);
  return [
    <g key="tvn-g" clipPath={`url(#${uid}-tclip)`}>
      {v.flip ? mirrored('tvn-f', nodes) : nodes}
    </g>,
  ];
}

/**
 * One arm's veins (arm-local, viewer-left; the right side is mirrored by the
 * caller). `surfaces` are the outlines of everything that covers the arm — the
 * sleeve cut, the gauntlet, the glove — unioned into the clip, so the network
 * runs from fabric onto leather and never across bare skin.
 */
export function armVeins(
  a: ArmConfig,
  surfaces: string[],
  cw: NormalizedFigure,
  uid: string,
  kp: string
): Node[] {
  if (!armShowsVeins(a) || !surfaces.length) return [];
  const cid = `${uid}-${kp}-vnc`;
  return [
    <clipPath key={`${kp}-vnc`} id={cid}>
      {surfaces.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </clipPath>,
    <g key={`${kp}-vn`} clipPath={`url(#${cid})`}>
      {veinNodes(`${kp}-vn`, ARM_VEINS, a.veins || '', cw.veinGlow || null, uid)}
    </g>,
  ];
}

/** Both legs' veins, clipped to each leg's cut — drawn over the legs. */
export function legsWildwood(cw: NormalizedFigure, uid: string): Node[] {
  const side = (kp: string, l: NormalizedFigure['legL']): Node[] => {
    if (!l.veins) return [];
    const cid = `${uid}-${kp}-vnc`;
    const d = l.flare ? LEG_FLARE_D : l.tattered ? LEG_TATTER_D : LEG_D;
    return [
      <clipPath key={`${kp}-vnc`} id={cid}>
        <path d={d} />
      </clipPath>,
      <g key={`${kp}-vn`} clipPath={`url(#${cid})`}>
        {veinNodes(`${kp}-vn`, LEG_VEINS, l.veins, cw.veinGlow || null, uid)}
      </g>,
    ];
  };
  return [...side('lwL', cw.legL), mirrored('lwR', side('lwR', cw.legR))];
}

/**
 * The gill fan (chest 'gill'): a pleated wedge of fine lamellae radiating
 * from a dark boss at the center chest up to the shoulder seam, clipped to
 * the torso. chestReverse sets it on the other shoulder.
 */
export function gillFan(cw: NormalizedFigure, uid: string): Node[] {
  const c = safeHex(cw.gill);
  const [px, py] = GILL_PIVOT;
  // rim points: along the shoulder curve, then down the side edge
  const rim: Array<[number, number]> = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const u = 1 - t;
    rim.push([
      u * u * 121 + 2 * u * t * 142 + t * t * 162,
      u * u * 100 + 2 * u * t * 95 + t * t * 104,
    ]);
  }
  for (let i = 1; i <= 6; i++) rim.push([162 - (4 * i) / 6, 104 + (48 * i) / 6]);
  const ray = (
    tag: string,
    i: number,
    tx: number,
    ty: number,
    stroke: string,
    w: number,
    o: string
  ) => {
    const len = Math.hypot(tx - px, ty - py);
    const sx = px + ((tx - px) * 6) / len;
    const sy = py + ((ty - py) * 6) / len;
    return strokeP(
      `gil-${tag}${i}`,
      `M${sx.toFixed(1)},${sy.toFixed(1)} L${tx.toFixed(1)},${ty.toFixed(1)}`,
      stroke,
      w,
      { opacity: o }
    );
  };
  const dark = darkenHex(c, 0.5);
  const lit = lightenHex(c, 0.4);
  const nodes: Node[] = [
    p('gil', GILL_D, c),
    shade('gil-s', `M${px},${py} L141,128 L158,152 Z`, 0.14),
    ...rim.map(([x, y], i) => ray('f', i, x, y, dark, 0.75, '.85')),
    // the lit ridge of each pleat sits between two furrows
    ...rim.slice(1).map(([x, y], i) => {
      const [x0, y0] = rim[i];
      return ray('r', i, (x + x0) / 2, (y + y0) / 2, lit, 0.45, '.55');
    }),
    strokeP('gil-rim', GILL_RIM, dark, 1.1, { strokeLinejoin: 'round' }),
    strokeP('gil-e', `M121,100 L${px},${py} L158,152`, darkenHex(c, 0.35), 0.8, {
      opacity: '.7',
      strokeLinejoin: 'round',
    }),
    <circle key="gil-b" cx={px} cy={py} r="3" fill={darkenHex(c, 0.65)} />,
    <circle key="gil-bh" cx={px - 0.9} cy={py - 1} r="1" fill={FIGURE_INK.white} opacity=".4" />,
  ];
  return [
    <g key="gil-g" clipPath={`url(#${uid}-tclip)`}>
      {cw.chestReverse ? mirrored('gil-m', nodes) : nodes}
    </g>,
  ];
}

/**
 * The sheer drape: a translucent chiffon panel from under the jacket at one
 * hip to a pointed hem past the knee. Drawn over the legs (they show through)
 * and under the torso (the jacket hem covers its top edge).
 */
export function drape(cw: NormalizedFigure): Node[] {
  const dr = cw.drape;
  if (!dr) return [];
  const c = safeHex(dr.color);
  const nodes: Node[] = [
    <path key="drp" d={DRAPE_D} fill={c} opacity=".34" />,
    <path key="drp-f" d={DRAPE_FOLD_D} fill={c} opacity=".2" />,
    strokeP('drp-l', DRAPE_LINES, lightenHex(c, 0.5), 0.6, { opacity: '.45' }),
    strokeP('drp-e', DRAPE_D, lightenHex(c, 0.35), 0.7, { opacity: '.6', strokeLinejoin: 'round' }),
  ];
  return [dr.flip ? mirrored('drp-m', nodes) : <g key="drp-g">{nodes}</g>];
}
