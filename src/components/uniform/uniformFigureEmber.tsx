// =============================================================================
// UNIFORM FIGURE PARTS — Ember Glass pack (Kiln & Lantern)
// =============================================================================
// The "lit stained-glass" design house: the ember-glass print (flame-tongue
// panes that glow gold at their hearts, set in heavy black lead came), the
// swept yoke chest treatment (a contrasting shoulder yoke cut on a flame-like
// curve and edged with a piping band), and the printed front panel on the
// shako, contour and pith. Kept in its own module (max-lines guardrail); the
// assembly and chest builders call in here. Pure SVG with style attributes
// only, like the rest of the figure, so exports and the equip-preview
// rasterizer keep working.

import React from 'react';
import {
  darkenHex,
  hatShowsPanel,
  lightenHex,
  resolvePrintPalettes,
  safeHex,
  type NormalizedFigure,
} from '../../utils/uniform';
import { fillOf, light, mirrored, p, shade, strokeP, type Node } from './uniformFigureParts';

/** The ember-glass tile (user-space units). */
const TILE_W = 44;
const TILE_H = 60;

/**
 * The lead came: two full-height S-curves (each leaves the tile's bottom at
 * the x and tangent it entered the top, so the tile repeats seamlessly) and
 * the arched cross-cames that cut each column into flame-tongue panes. The
 * cross-came endpoints sit exactly on the S-curves.
 */
const CAME_MAIN = ['M7,0 C17,15 -3,38 7,60', 'M29,0 C19,18 39,40 29,60'];
const CAME_CROSS = [
  'M9.5,15.4 C12.9,-2.4 18.1,0.6 26.6,6.6',
  'M4.1,46.8 C13.4,28.7 21.4,34.7 30.7,36.7',
  'M27.6,23.1 C31,13.1 37.8,25.5 50.3,30.5',
  'M31.2,53.9 C37,46.9 42.9,55.3 50.7,59.3',
];
/** Thin flame-lick curls inside the panes (the swirl in the glass). */
const LICKS = [
  'M10,38 Q13,27 19,22 Q23,19 22,15',
  'M12,8 Q16,1 22,-3',
  'M33,49 Q35,40 41,35 Q45,32 44,28',
  'M34,19 Q38,12 44,10',
];
/** Glow hearts: one per pane, [cx, cy, rx, ry]. */
const HEARTS: Array<[number, number, number, number]> = [
  [17, 24, 10, 13],
  [17, 54, 10, 14],
  [40, 40, 10, 13],
  [40, 9, 10, 14],
];
/** The 3×3 neighborhood the motif is stamped at, so spill-over tiles. */
const STAMPS: Array<[number, number]> = [-1, 0, 1].flatMap((i) =>
  [-1, 0, 1].map((j) => [i * TILE_W, j * TILE_H] as [number, number])
);

/** One tile's motif (may spill past the edges; the stamps make it periodic). */
function emberMotif(uid: string, em: ReturnType<typeof resolvePrintPalettes>['ember']): Node[] {
  return [
    ...HEARTS.map(([cx, cy, rx, ry], i) => (
      <ellipse key={`h${i}`} cx={cx} cy={cy} rx={rx} ry={ry} fill={`url(#${uid}-emberHeart)`} />
    )),
    // scorched glass along every came, so each pane darkens toward its lead
    ...[...CAME_MAIN, ...CAME_CROSS].map((d, i) =>
      strokeP(`s${i}`, d, em.deep, 5, { opacity: '.55' })
    ),
    ...LICKS.map((d, i) => strokeP(`l${i}`, d, em.lead, 1.1, { opacity: '.8' })),
    ...[...CAME_MAIN, ...CAME_CROSS].map((d, i) => strokeP(`c${i}`, d, em.lead, 2.3)),
    // a cold glint on the glass beside two cames
    strokeP('g0', 'M11,21 Q14,16 18,14', '#ffffff', 0.7, { opacity: '.3' }),
    strokeP('g1', 'M33,30 Q36,26 40,25', '#ffffff', 0.7, { opacity: '.3' }),
  ];
}

/**
 * Ember Glass defs: the pane-heart gradient and two scales of the print — the
 * garment scale (`ember`) and a finer one for the hat panel (`emberSm`) so a
 * shako face still reads as several panes. Only emitted while something on
 * the figure references the print (the derived `ember` flag).
 */
export function emberDefs(cw: NormalizedFigure, uid: string): Node {
  if (!cw.ember) return null;
  const em = resolvePrintPalettes(cw).ember;
  const tile = (id: string, transform: string) => (
    <pattern
      key={id}
      id={`${uid}-${id}`}
      width={TILE_W}
      height={TILE_H}
      patternUnits="userSpaceOnUse"
      patternTransform={transform}
    >
      <rect width={TILE_W} height={TILE_H} fill={em.flame} />
      {STAMPS.map(([dx, dy]) => (
        <g key={`${dx},${dy}`} transform={`translate(${dx},${dy})`}>
          {emberMotif(uid, em)}
        </g>
      ))}
    </pattern>
  );
  return (
    <defs key="ember-defs">
      <radialGradient id={`${uid}-emberHeart`} cx=".45" cy=".58" r=".55">
        <stop offset="0" stopColor={lightenHex(em.core, 0.25)} />
        <stop offset=".35" stopColor={em.core} />
        <stop offset=".7" stopColor={em.mid} stopOpacity=".75" />
        <stop offset="1" stopColor={em.flame} stopOpacity="0" />
      </radialGradient>
      {tile('ember', 'rotate(-8) scale(1.35)')}
      {tile('emberSm', 'rotate(-8) scale(.62)')}
    </defs>
  );
}

/**
 * The yoke's sweep: from the collar down across the chest to the viewer-left
 * side seam, with a flame-like S in the middle. The yoke fills everything
 * outside it (the shoulder and upper side); the piping rides on it.
 */
const YOKE_SWEEP = 'M116,95 C112,122 94,134 98,160 C101,180 92,198 82,214';
const YOKE_D = `${YOKE_SWEEP} L60,214 L60,88 L116,88 Z`;

/**
 * Swept yoke (chest 'yoke'): a contrasting shoulder yoke cut on the sweep
 * and edged with a piping band, clipped to the torso. chestReverse sweeps the
 * other shoulder like every one-sided chest treatment.
 */
export function sweptYoke(cw: NormalizedFigure, uid: string): Node[] {
  const c = safeHex(cw.yoke);
  const nodes: Node[] = [
    p('yk', YOKE_D, c),
    light('yk-l', 'M84,106 Q82,140 84,180 L88,180 Q86,140 89,108 Z', 0.07),
  ];
  if (cw.yokePiping) {
    const pipe = safeHex(cw.yokePiping);
    nodes.push(
      strokeP('yk-ps', YOKE_SWEEP, darkenHex(pipe, 0.55), 6, { opacity: '.45' }),
      strokeP('yk-p', YOKE_SWEEP, pipe, 4.2),
      strokeP('yk-pl', YOKE_SWEEP, lightenHex(pipe, 0.5), 1, {
        opacity: '.55',
        transform: 'translate(-.8,-.4)',
      })
    );
  } else {
    nodes.push(strokeP('yk-e', YOKE_SWEEP, darkenHex(c, 0.45), 1.1, { opacity: '.5' }));
  }
  return [
    <g key="yk-g" clipPath={`url(#${uid}-tclip)`}>
      {cw.chestReverse ? mirrored('yk-r', nodes) : nodes}
    </g>,
  ];
}

/** Each panel hat's front face (inside the body's silhouette). */
const HAT_PANEL_D: Record<string, string> = {
  shako: 'M101.2,13 Q120,8.2 138.8,13 L136.7,50.5 Q120,56.5 103.3,50.5 Z',
  contour: 'M105.4,15 L132.6,21.8 L136.2,52 Q120,58.6 103.8,52 Z',
  pith: 'M103.5,46.5 Q103,25 120,21.5 Q137,25 136.5,46.5 Q120,51.5 103.5,46.5 Z',
};

/**
 * The hat's front panel (Ember Glass): the panel fill framed by a fine edge in
 * a deep shade of the hat body, with the hat's own roundness shading laid
 * back over it. Drawn after the hat body and before the band and ornament,
 * so both still sit on top. The ember print takes its finer hat scale.
 */
export function hatPanel(cw: NormalizedFigure, uid: string): Node[] {
  if (!hatShowsPanel(cw) || !cw.hat || !cw.hatType) return [];
  const d = HAT_PANEL_D[cw.hatType];
  const spec = cw.hat.panel === 'url:ember' ? 'url:emberSm' : cw.hat.panel;
  const clip = `${uid}-hpc`;
  return [
    <clipPath key="hp-c" id={clip}>
      <path d={d} />
    </clipPath>,
    p('hp', d, fillOf(spec, uid, cw.hat.body)),
    // the hat's roundness over the panel: shaded right flank, lit left edge
    <g key="hp-g" clipPath={`url(#${clip})`}>
      {shade('hp-s', 'M128,0 L150,0 L150,60 L127,60 Q131,30 128,0 Z', 0.15)}
      {light('hp-l', 'M90,0 L108,0 Q105,30 107,60 L90,60 Z', 0.08)}
    </g>,
    <path
      key="hp-e"
      d={d}
      fill="none"
      stroke={darkenHex(safeHex(cw.hat.body), 0.4)}
      strokeWidth="1.2"
      strokeLinejoin="round"
    />,
  ];
}
