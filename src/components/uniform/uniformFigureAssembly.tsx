// =============================================================================
// UNIFORM FIGURE ASSEMBLY — headwear parts + the layer stack
// =============================================================================
// Completes the renderer split (see UniformFigure.tsx): headwear builders and
// figureLayers(), which stacks every part in draw order. Kept apart from
// uniformFigureParts.tsx purely for the max-lines guardrail.

import React from 'react';
import type { ArmConfig, FigureConfig } from '../../types/uniform';
import {
  darkenHex,
  lightenHex,
  normalizeFigure,
  safeHex,
  type NormalizedFigure,
} from '../../utils/uniform';
import { FIGURE_INK } from '../../data/uniformRenderTheme';
import {
  BARE_ARM_D,
  SLEEVE_D,
  buildDefs,
  fillOf,
  mirrored,
  belt,
  chest,
  collar,
  cowlScarf,
  crewNeck,
  epaulets,
  fringeHip,
  glowArt,
  ground,
  hair,
  headNeck,
  legs,
  light,
  mockNeck,
  neckerchief,
  p,
  satinSheen,
  sequinField,
  shade,
  shoes,
  streamers,
  strokeP,
  suspenders,
  swashLeg,
  tieDrop,
  torso,
  velvetSheen,
  type Node,
} from './uniformFigureParts';

function armSide(a: ArmConfig, cw: NormalizedFigure, uid: string, kp: string): Node[] {
  if (a.type === 'none') return [];
  const bare = a.type === 'bare';
  const fill = bare ? safeHex(cw.skin) : fillOf(a.fill, uid, a.color || cw.jacket);
  let out: Node[] = [
    p(`${kp}`, bare ? BARE_ARM_D : SLEEVE_D, fill),
    shade(`${kp}-in`, 'M79,150 Q78,200 81,242 L82,244 L76,243 Q74,200 75,152 Z', 0.13),
    light(`${kp}-tl`, 'M66,116 Q60,140 59,170 L62,170 Q63,140 69,118 Z', 0.08),
  ];
  if (a.detached) {
    out = [
      p(`${kp}-sk`, BARE_ARM_D, safeHex(cw.skin)),
      shade(`${kp}-sks`, 'M80,150 Q79,200 82,242 L82,244 L76,243 Q74,200 76,152 Z', 0.1),
      p(
        `${kp}-sl`,
        'M64,132 Q58,166 60,200 Q61,228 64,244 L82,246 Q80,216 80,190 Q80,156 86,134 Q75,126 64,132 Z',
        fillOf(a.fill, uid, a.color)
      ),
      shade(`${kp}-sls`, 'M78,158 Q77,204 80,244 L82,246 L75,245 Q73,204 74,160 Z', 0.13),
      light(`${kp}-sll`, 'M66,140 Q61,172 62,206 L65,206 Q64,172 69,142 Z', 0.1),
      strokeP(`${kp}-edge`, 'M64,134 Q75,128 86,136', FIGURE_INK.visor, 1.6, { opacity: '.35' }),
    ];
  }
  if (a.type === 'half') {
    out = [
      p(`${kp}-sk`, BARE_ARM_D, safeHex(cw.skin)),
      shade(`${kp}-sks`, 'M80,150 Q79,200 82,242 L82,244 L76,243 Q74,200 76,152 Z', 0.1),
      p(
        `${kp}-up`,
        'M78,103 Q66,111 62,134 Q60,152 60,168 L82,170 Q80,146 88,118 Q85,107 78,103 Z',
        fillOf(a.fill, uid, a.color)
      ),
      strokeP(`${kp}-cf`, 'M60,166 L82,168', FIGURE_INK.visor, 2.4, { opacity: '.25' }),
      light(`${kp}-ul`, 'M66,114 Q61,136 60,158 L63,158 Q64,136 69,116 Z', 0.09),
    ];
  }
  if (a.glowLine) {
    out.push(
      strokeP(`${kp}-gl`, 'M68,120 Q60,165 62,215', safeHex(a.glowLine), 2.2, {
        filter: `url(#${uid}-glow)`,
        opacity: '.9',
      })
    );
  }
  if (a.patent) {
    out.push(light(`${kp}-pt`, 'M64,130 Q59,168 61,210 L64,210 Q62,168 67,132 Z', 0.24));
  }
  if (a.gauntlet) {
    const c = safeHex(a.gauntlet.color);
    // Bell opens toward the elbow, snug at the wrist (real gauntlets taper down).
    out.push(
      p(`${kp}-ga`, 'M54,210 L86,212 L83,248 Q71,253 61,247 Z', c),
      strokeP(`${kp}-gat`, 'M54,212 L86,214', darkenHex(c, 0.35), 2.2),
      shade(`${kp}-gas`, 'M80,213 L83,248 L77,251 L74,214 Z', 0.15)
    );
    if (a.gauntlet.sequin) out.push(...sequinField(`${kp}-gaq`, 70, 230, 24, 32, 3, 16));
  }
  const handC = a.glove ? safeHex(a.glove) : safeHex(cw.skin);
  out.push(
    p(`${kp}-hd`, 'M63,246 Q60,260 66,267 Q74,271 79,264 Q83,256 82,246 Q72,251 63,246 Z', handC),
    shade(`${kp}-hds`, 'M76,248 Q79,258 75,265 Q80,259 80,248 Z', 0.15)
  );
  return out;
}

export function arms(cw: NormalizedFigure, uid: string): Node[] {
  return [...armSide(cw.armL, cw, uid, 'arL'), mirrored('arR', armSide(cw.armR, cw, uid, 'arR'))];
}

// ---------------------------------------------------------------------------
// headwear
// ---------------------------------------------------------------------------

function shako(cw: NormalizedFigure): Node[] {
  const h = cw.hat;
  if (!h) return [];
  const body = safeHex(h.body);
  const m = safeHex(cw.metal);
  const out: Node[] = [
    p('sk', 'M99,58 L95,8 Q120,2 145,8 L141,58 Q120,65 99,58 Z', body),
    shade('sk-s', 'M132,6 Q140,7 145,8 L141,58 Q133,61 128,62 Q132,36 132,6 Z', 0.16),
    light('sk-l', 'M99,10 Q102,10 106,9 Q104,34 104,58 Q100,57 99,56 Z', 0.09),
    p('sk-t', 'M95,8 Q120,2 145,8 Q120,13 95,8 Z', lightenHex(body, 0.12)),
  ];
  if (h.band) {
    const band = safeHex(h.band);
    out.push(
      p('sk-b1', 'M95.6,8 Q120,3 144.4,8 L143.9,16 Q120,11 96.1,16 Z', band),
      p('sk-b2', 'M99.4,52 Q120,59 140.6,52 L141,58 Q120,65 99,58 Z', band)
    );
  }
  const rays: Node[] = [];
  for (let a = 0; a < 8; a++) {
    const th = (a * Math.PI) / 4;
    rays.push(
      <line
        key={`pl-ray${a}`}
        x1={+(120 + Math.cos(th) * 6).toFixed(1)}
        y1={+(34 + Math.sin(th) * 6).toFixed(1)}
        x2={+(120 + Math.cos(th) * 11).toFixed(1)}
        y2={+(34 + Math.sin(th) * 11).toFixed(1)}
        stroke={m}
        strokeWidth="2.2"
      />
    );
  }
  out.push(
    <g key="sk-plate">{rays}</g>,
    <circle key="sk-p1" cx="120" cy="34" r="6.5" fill={m} />,
    <circle key="sk-p2" cx="120" cy="34" r="3.4" fill={darkenHex(m, 0.55)} />,
    <circle key="sk-p3" cx="118" cy="32" r="1.2" fill={FIGURE_INK.white} opacity=".9" />,
    p('sk-v', 'M98,56 Q120,80 142,56 L142,61 Q120,86 98,61 Z', FIGURE_INK.visor),
    light('sk-vl', 'M100,58 Q120,78 140,58 Q120,74 100,58 Z', 0.12)
  );
  return out;
}

function pith(cw: NormalizedFigure): Node[] {
  const h = cw.hat;
  if (!h) return [];
  const body = safeHex(h.body);
  const out: Node[] = [
    p('pi', 'M97,52 Q96,16 120,14 Q144,16 143,52 Z', body),
    shade('pi-s', 'M130,17 Q141,24 142,50 L134,52 Q135,30 130,17 Z', 0.12),
    light('pi-l', 'M102,24 Q99,36 99,50 L104,51 Q104,32 107,22 Z', 0.1),
    <ellipse key="pi-br" cx="120" cy="53" rx="31" ry="7.5" fill={lightenHex(body, 0.06)} />,
    shade('pi-bs', 'M89,53 A31,7.5 0 0 0 151,53 A31,7.5 0 0 1 89,53 Z', 0.18),
  ];
  if (h.band) out.push(p('pi-b', 'M98,44 Q120,52 142,44 L142,51 Q120,58 98,51 Z', safeHex(h.band)));
  out.push(<circle key="pi-m" cx="120" cy="34" r="3.4" fill={safeHex(cw.metal)} />);
  return out;
}

function campaign(cw: NormalizedFigure): Node[] {
  const h = cw.hat;
  if (!h) return [];
  const body = safeHex(h.body);
  const out: Node[] = [
    <ellipse key="ca-br" cx="120" cy="39" rx="36" ry="8.5" fill={body} />,
    shade('ca-bs', 'M120,39 m-36,0 a36,8.5 0 0 0 72,0 a36,8.5 0 0 1 -72,0 Z', 0.2),
    p('ca-cr', 'M101,38 Q101,10 120,8 Q139,10 139,38 Z', lightenHex(body, 0.05)),
    strokeP('ca-d', 'M112,12 Q112,26 113,36 M128,12 Q128,26 127,36', darkenHex(body, 0.25), 2),
    shade('ca-s', 'M130,12 Q138,20 138,37 L132,38 Q133,22 130,12 Z', 0.12),
  ];
  if (h.band)
    out.push(p('ca-b', 'M101,32 Q120,40 139,32 L139,38 Q120,46 101,38 Z', safeHex(h.band)));
  return out;
}

function plume(cw: NormalizedFigure): Node[] {
  const pl = cw.plume;
  if (!pl) return [];
  const c = safeHex(pl.color);
  if (pl.type === 'upright') {
    const out: Node[] = [
      p('pu', 'M113,12 Q107,-34 118,-64 Q121,-70 124,-64 Q133,-32 127,12 Q120,16 113,12 Z', c),
      strokeP('pu-1', 'M117,8 Q114,-30 119,-58', lightenHex(c, 0.35), 1.1, { opacity: '.7' }),
      strokeP('pu-2', 'M122,8 Q121,-34 121,-60', lightenHex(c, 0.35), 1.1, { opacity: '.55' }),
      strokeP('pu-3', 'M125,6 Q127,-26 123,-56', darkenHex(c, 0.25), 1.1, { opacity: '.5' }),
      shade('pu-s', 'M124,-60 Q130,-30 126,10 L121,12 Q128,-28 122,-62 Z', 0.12),
    ];
    if (pl.mylar) out.push(...sequinField('pu-m', 120, -26, 12, 72, 13, 18));
    return out;
  }
  // fountain
  const arcs = [
    'M120,4 C114,-26 102,-26 94,-4',
    'M120,3 C116,-32 106,-34 100,-14',
    'M120,1 C118,-38 111,-40 108,-22',
    'M120,0 C120,-42 119,-42 117,-28',
    'M120,0 C121,-42 122,-42 124,-28',
    'M120,1 C123,-38 129,-40 133,-22',
    'M120,3 C125,-32 134,-34 141,-14',
    'M120,4 C127,-26 138,-26 147,-4',
    'M120,2 C117,-30 113,-32 112,-20',
    'M120,2 C123,-30 127,-32 128,-20',
  ];
  const out: Node[] = [];
  arcs.forEach((a, i) => {
    out.push(strokeP(`pf${i}`, a, c, 3.8));
    out.push(strokeP(`pf${i}-l`, a, lightenHex(c, 0.28), 1.2, { opacity: '.45' }));
  });
  out.push(<circle key="pf-m" cx="120" cy="6" r="4.5" fill={safeHex(cw.metal)} />);
  return out;
}

// ---------------------------------------------------------------------------
// assembly
// ---------------------------------------------------------------------------

export function figureLayers(raw: FigureConfig, uid: string): Node[] {
  const cw = normalizeFigure(raw);
  const flared = Boolean(cw.legL.flare || cw.legR.flare);
  const layers: Node[] = [buildDefs(cw, uid), ...ground()];
  if (flared) layers.push(<g key="shoes">{shoes(cw)}</g>);
  layers.push(<g key="legs">{legs(cw, uid)}</g>);
  layers.push(<g key="swl">{swashLeg(cw)}</g>);
  layers.push(<g key="stream">{streamers(cw)}</g>);
  if (!flared) layers.push(<g key="shoes">{shoes(cw)}</g>);
  layers.push(<g key="torso">{torso(cw, uid)}</g>);
  if (cw.satin) layers.push(<g key="satin">{satinSheen()}</g>);
  if (cw.velvet) layers.push(<g key="velvet">{velvetSheen()}</g>);
  layers.push(
    <g key="chest">{chest(cw, uid)}</g>,
    <g key="glowart">{glowArt(cw, uid)}</g>,
    <g key="susp">{suspenders(cw)}</g>,
    <g key="belt">{belt(cw)}</g>,
    <g key="tie">{tieDrop(cw)}</g>,
    <g key="fringe">{fringeHip(cw)}</g>,
    <g key="arms">{arms(cw, uid)}</g>,
    <g key="epau">{epaulets(cw)}</g>,
    <g key="head">{headNeck(cw)}</g>
  );
  if (cw.hairShow) layers.push(<g key="hair">{hair(cw)}</g>);
  layers.push(
    <g key="scarf">{neckerchief(cw)}</g>,
    <g key="collar">{collar(cw)}</g>,
    <g key="mock">{mockNeck(cw, uid)}</g>,
    <g key="cowl">{cowlScarf(cw)}</g>
  );
  if (cw.crew) layers.push(<g key="crew">{crewNeck(cw)}</g>);
  if (cw.plume) layers.push(<g key="plume">{plume(cw)}</g>);
  if (cw.hatType === 'shako') layers.push(<g key="hat">{shako(cw)}</g>);
  if (cw.hatType === 'pith') layers.push(<g key="hat">{pith(cw)}</g>);
  if (cw.hatType === 'campaign') layers.push(<g key="hat">{campaign(cw)}</g>);
  return layers;
}
