// =============================================================================
// UNIFORM FIGURE PARTS — Prism Forge pack (Lumen & Vane)
// =============================================================================
// The "light-cut" design house: a split-panel torso cut on a diagonal, the
// shatter crack print, the glowing light-streak slash, glowing cuff and hem
// fades, faceted knee plates, and angular leg seams. Kept in its own module
// (max-lines guardrail); the assembly, chest and torso builders call in here.
// Every piece is pure SVG with style attributes only, like the rest of the
// figure, so exports and the equip-preview rasterizer keep working.

import React from 'react';
import type { ArmConfig, LegConfig } from '../../types/uniform';
import { STREAK_CORE_DEFAULT } from '../../data/uniformRenderTheme';
import {
  darkenHex,
  resolvePrintPalettes,
  safeHex,
  type NormalizedFigure,
} from '../../utils/uniform';
import {
  LEG_D,
  LEG_FLARE_D,
  LEG_TATTER_D,
  fillOf,
  light,
  mirrored,
  p,
  shade,
  strokeP,
  type Node,
} from './uniformFigureParts';

/**
 * The diagonal every Prism Forge torso piece shares — the light streak's
 * centerline, running from the viewer-right shoulder to the viewer-left hip
 * (the same run as the modern swash). The split panel's edge IS this line, so
 * a streak laid over a split always sits exactly on the seam.
 */
const STREAK_LINE = 'M156,100 Q128,146 110,192 Q101,222 99,258';
/** The tapered halo blade around the centerline. */
const STREAK_BLADE =
  'M151,99 Q123,144 105,190 Q96,222 95,258 L103,258 Q106,222 115,194 Q133,148 161,102 Z';
/** Everything on the viewer-right of the diagonal (clipped to the torso). */
const SPLIT_PANEL_D = `${STREAK_LINE} L96,370 L200,370 L200,80 L160,80 Z`;

/** Whether any Prism Forge piece needs the shared glow filter defined. */
export function needsPrismGlow(cw: NormalizedFigure): boolean {
  return Boolean(
    cw.chest === 'streak' ||
    cw.armL.cuffGlow ||
    cw.armR.cuffGlow ||
    cw.legL.hemGlow ||
    cw.legR.hemGlow
  );
}

/**
 * Prism Forge defs: the shatter pattern (when referenced) and the glow
 * filter when a Prism piece needs it but the figure's own `glow` flag is off
 * (buildDefs only defines it for glow line-art) — never both, so the id is
 * unique.
 */
export function prismDefs(cw: NormalizedFigure, uid: string): Node {
  const wantsGlow = !cw.glow && needsPrismGlow(cw);
  if (!cw.shatter && !wantsGlow) return null;
  const sh = resolvePrintPalettes(cw).shatter;
  return (
    <defs key="prism-defs">
      {cw.shatter && (
        <pattern
          id={`${uid}-shatter`}
          width="24"
          height="24"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-14)"
        >
          <rect width="24" height="24" fill={sh.bg} />
          {/* lifted facets so the crack network reads as faceted glass */}
          <path d="M7,3 L13,8 L12,15 L4,17 L0,14 L0,6 Z" fill={sh.facet} opacity=".55" />
          <path d="M13,8 L20,4 L24,6 L24,14 L19,18 L12,15 Z" fill={sh.facet} opacity=".3" />
          <path
            d="M0,6 L7,3 L13,8 L20,4 L24,6 M7,3 L6,0 M20,4 L18,0 M13,8 L12,15 L4,17 L0,14 M12,15 L19,18 L24,14 M19,18 L18,24 M4,17 L6,24"
            fill="none"
            stroke={sh.line}
            strokeWidth=".8"
            strokeLinejoin="round"
          />
          <path
            d="M7,3 L13,8 M12,15 L19,18"
            fill="none"
            stroke={sh.line}
            strokeWidth=".4"
            opacity=".6"
            transform="translate(.6,.6)"
          />
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
 * Split-panel torso: a contrasting panel over one side of the torso, its edge
 * on the streak diagonal. Called from torso() between the base fill and the
 * shading so the panel takes the same folds as the rest of the garment.
 */
export function torsoSplit(cw: NormalizedFigure, uid: string): Node[] {
  const sp = cw.torsoSplit;
  if (!sp) return [];
  const nodes: Node[] = [
    p('tsp', SPLIT_PANEL_D, fillOf(sp.fill, uid, sp.color)),
    strokeP('tsp-e', STREAK_LINE, darkenHex(safeHex(sp.color), 0.45), 1.1, { opacity: '.55' }),
  ];
  return [
    <g key="tsp-g" clipPath={`url(#${uid}-tclip)`}>
      {sp.flip ? mirrored('tsp-f', nodes) : nodes}
    </g>,
  ];
}

/**
 * The light streak (chest 'streak'): a soft aura, a tapered halo blade in the
 * streak color (or the director's chest fade), and a hot near-white core, all
 * through the glow filter and clipped to the torso. chestReverse runs it over
 * the other shoulder like every diagonal treatment.
 */
export function lightStreak(cw: NormalizedFigure, uid: string): Node[] {
  const halo = cw.chestFade ? `url(#${uid}-fadeChest)` : safeHex(cw.streak);
  const aura = cw.chestFade ? safeHex(cw.chestFade[0]) : safeHex(cw.streak);
  const core = safeHex(cw.streakCore || STREAK_CORE_DEFAULT);
  const fx = { filter: `url(#${uid}-glow)` };
  const nodes: Node[] = [
    strokeP('stk-a', STREAK_LINE, aura, 10, { opacity: '.28', strokeLinecap: 'round' }),
    <path key="stk-b" d={STREAK_BLADE} fill={halo} opacity=".92" filter={fx.filter} />,
    strokeP('stk-c', STREAK_LINE, core, 1.6, { ...fx, strokeLinecap: 'round' }),
    strokeP('stk-h', 'M150,106 Q130,138 121,160', core, 0.8, { opacity: '.8' }),
  ];
  return [
    <g key="stk-g" clipPath={`url(#${uid}-tclip)`}>
      {cw.chestReverse ? mirrored('stk-r', nodes) : nodes}
    </g>,
  ];
}

/** A vertical two-stop glow gradient that fades in from transparent. */
function glowGradient(id: string, y1: number, y2: number, stops: [string, string]): Node {
  const [upper, end] = [safeHex(stops[0]), safeHex(stops[1])];
  return (
    <linearGradient
      key={`${id}-def`}
      id={id}
      gradientUnits="userSpaceOnUse"
      x1="0"
      y1={y1}
      x2="0"
      y2={y2}
    >
      <stop offset="0" stopColor={upper} stopOpacity="0" />
      <stop offset=".45" stopColor={upper} stopOpacity=".8" />
      <stop offset="1" stopColor={end} stopOpacity="1" />
    </linearGradient>
  );
}

/**
 * Glowing cuff fade up the forearm (arm-local coords, viewer-left; the right
 * side is mirrored by the caller). `sleeveD` is the sleeve fabric outline the
 * glow is clipped to; only full (or detached) sleeves reach the wrist, so
 * bare arms and half sleeves never draw one.
 */
export function cuffGlow(a: ArmConfig, sleeveD: string | null, uid: string, kp: string): Node[] {
  if (!a.cuffGlow || !sleeveD || a.type !== 'sleeve') return [];
  const gid = `${uid}-${kp}-cg`;
  const cid = `${uid}-${kp}-cgc`;
  return [
    glowGradient(gid, 176, 246, a.cuffGlow),
    <clipPath key={`${kp}-cgc`} id={cid}>
      <path d={sleeveD} />
    </clipPath>,
    <g key={`${kp}-cgg`} clipPath={`url(#${cid})`}>
      <rect x="50" y="176" width="40" height="72" fill={`url(#${gid})`} />
    </g>,
    strokeP(`${kp}-cgl`, 'M62,241 L82,243', safeHex(a.cuffGlow[1]), 2, {
      filter: `url(#${uid}-glow)`,
      strokeLinecap: 'round',
    }),
  ];
}

/** One leg's Prism Forge overlays (viewer-left coords). */
function legPrism(l: LegConfig, uid: string, kp: string): Node[] {
  const out: Node[] = [];
  const d = l.flare ? LEG_FLARE_D : l.tattered ? LEG_TATTER_D : LEG_D;
  const hemY = l.flare ? 444 : 436;
  if (l.seams) {
    const c = safeHex(l.seams);
    // Two seams converge on the knee, then split again to the hem — the
    // diamond plate (when set) sits exactly on the crossing.
    out.push(
      strokeP(
        `${kp}-sm`,
        `M92,262 L99,330 M113,262 L101,330 M100,360 L95,${hemY - 2} M100,360 L109,${hemY - 2}`,
        c,
        0.9,
        { opacity: '.85', strokeLinejoin: 'round' }
      ),
      strokeP(`${kp}-sm2`, 'M100,330 L100,360', c, 0.7, { opacity: '.5' })
    );
  }
  if (l.hemGlow) {
    const gid = `${uid}-${kp}-hg`;
    const cid = `${uid}-${kp}-hgc`;
    out.push(
      glowGradient(gid, 350, hemY, l.hemGlow),
      <clipPath key={`${kp}-hgc`} id={cid}>
        <path d={d} />
      </clipPath>,
      <g key={`${kp}-hgg`} clipPath={`url(#${cid})`}>
        <rect x="70" y="350" width="52" height="100" fill={`url(#${gid})`} />
      </g>,
      strokeP(
        `${kp}-hgl`,
        `M${l.flare ? 77 : 91},${hemY} L${l.flare ? 117 : 113},${hemY}`,
        safeHex(l.hemGlow[1]),
        2,
        {
          filter: `url(#${uid}-glow)`,
          strokeLinecap: 'round',
        }
      )
    );
  }
  if (l.kneePlate) {
    const c = safeHex(l.kneePlate);
    out.push(
      p(`${kp}-kp`, 'M100,329 L108,345 L100,361 L92,345 Z', c),
      light(`${kp}-kpl`, 'M100,329 L108,345 L100,345 Z', 0.4),
      shade(`${kp}-kps`, 'M100,345 L92,345 L100,361 Z', 0.25),
      strokeP(`${kp}-kpe`, 'M100,329 L108,345 L100,361 L92,345 Z', darkenHex(c, 0.4), 0.8)
    );
  }
  return out;
}

/** Both legs' Prism Forge overlays — drawn over the legs, under the torso. */
export function legsPrism(cw: NormalizedFigure, uid: string): Node[] {
  return [...legPrism(cw.legL, uid, 'lpL'), mirrored('lpR', legPrism(cw.legR, uid, 'lpR'))];
}
