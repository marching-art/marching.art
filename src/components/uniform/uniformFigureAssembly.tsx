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
  iridescentSheen,
  lameField,
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

/**
 * The selectable ornament, centered at (120,34) — the shako/pith front, the
 * aussie's fold badge, and (scaled + translated) the chest badge. `m` is the
 * resolved primary color; `inner` overrides the derived dark detail (the
 * chest badge's two-tone accent). 'sunburst' emits the exact legacy plate
 * nodes so stored designs are stable.
 */
function hatOrnamentNodes(orn: string | undefined, m: string, kp: string, inner?: string): Node[] {
  const o = orn || 'sunburst';
  const dark = (f: number) => inner ?? darkenHex(m, f);
  if (o === 'none') return [];
  if (o === 'sunburst') {
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
    return [
      <g key={`${kp}-plate`}>{rays}</g>,
      <circle key={`${kp}-p1`} cx="120" cy="34" r="6.5" fill={m} />,
      <circle key={`${kp}-p2`} cx="120" cy="34" r="3.4" fill={dark(0.55)} />,
      <circle key={`${kp}-p3`} cx="118" cy="32" r="1.2" fill={FIGURE_INK.white} opacity=".9" />,
    ];
  }
  if (o === 'star') {
    const pts: string[] = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 9 : 3.8;
      const th = -Math.PI / 2 + (i * Math.PI) / 5;
      pts.push(`${(120 + Math.cos(th) * r).toFixed(1)},${(34 + Math.sin(th) * r).toFixed(1)}`);
    }
    return [
      <polygon key={`${kp}-star`} points={pts.join(' ')} fill={m} />,
      <circle key={`${kp}-starc`} cx="120" cy="34.8" r="2" fill={dark(0.5)} />,
      <circle
        key={`${kp}-starg`}
        cx="118.6"
        cy="33.2"
        r="1"
        fill={FIGURE_INK.white}
        opacity=".9"
      />,
    ];
  }
  if (o === 'shield') {
    return [
      p(`${kp}-sh`, 'M112,26 L128,26 L128,36 Q128,43 120,46 Q112,43 112,36 Z', m),
      p(`${kp}-shv`, 'M112,30.5 L128,30.5 L128,34 L112,34 Z', dark(0.5)),
      <circle key={`${kp}-shg`} cx="117" cy="28.4" r="1" fill={FIGURE_INK.white} opacity=".9" />,
    ];
  }
  if (o === 'chevron') {
    return [
      strokeP(`${kp}-c1`, 'M112,32 L120,26 L128,32', m, 2.6),
      strokeP(`${kp}-c2`, 'M112,39 L120,33 L128,39', m, 2.6),
      strokeP(`${kp}-c3`, 'M112,46 L120,40 L128,46', dark(0.35), 2.2),
    ];
  }
  if (o === 'disc') {
    return [
      <circle key={`${kp}-d1`} cx="120" cy="34" r="6.5" fill={m} />,
      <circle key={`${kp}-d2`} cx="120" cy="34" r="3.4" fill={dark(0.55)} />,
      <circle key={`${kp}-d3`} cx="118" cy="32" r="1.2" fill={FIGURE_INK.white} opacity=".9" />,
    ];
  }
  if (o === 'rect') {
    // badge rectangle: an outer field with an inset panel (the classic
    // rectangle-in-rectangle corps patch)
    return [
      <rect key={`${kp}-r1`} x="112" y="25" width="16" height="18" fill={m} />,
      <rect key={`${kp}-r2`} x="115" y="28" width="10" height="12" fill={dark(0.5)} />,
      <circle key={`${kp}-rg`} cx="114" cy="27" r="0.9" fill={FIGURE_INK.white} opacity=".9" />,
    ];
  }
  // diamond
  return [
    <polygon key={`${kp}-di`} points="120,25.5 127.5,34 120,42.5 112.5,34" fill={m} />,
    <polygon key={`${kp}-di2`} points="120,29.5 123.7,34 120,38.5 116.3,34" fill={dark(0.5)} />,
    <circle key={`${kp}-dig`} cx="118.2" cy="30.8" r="1" fill={FIGURE_INK.white} opacity=".9" />,
  ];
}

function shako(cw: NormalizedFigure): Node[] {
  const h = cw.hat;
  if (!h) return [];
  const body = safeHex(h.body);
  // The front plate ("cog") takes its own color when set; hardware metal otherwise.
  const m = h.emblem ? safeHex(h.emblem) : safeHex(cw.metal);
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
  out.push(
    ...hatOrnamentNodes(h.ornament, m, 'sk'),
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
  if (h.ornament) {
    out.push(...hatOrnamentNodes(h.ornament, safeHex(h.emblem || cw.metal), 'pi'));
  } else {
    // legacy pith stud (designs saved before ornaments were selectable)
    out.push(<circle key="pi-m" cx="120" cy="34" r="3.4" fill={safeHex(h.emblem || cw.metal)} />);
  }
  return out;
}

/**
 * Aussie slouch hat: a tall flat-top crown with the lengthwise crease, and a
 * wide brim that sweeps up as a diagonal blade into the pinned side — the
 * silhouette the classic corps aussies cut from the stands.
 */
function aussie(cw: NormalizedFigure): Node[] {
  const h = cw.hat;
  if (!h) return [];
  const body = safeHex(h.body);
  const out: Node[] = [
    // tall tapered crown, flat top, single lengthwise crease
    p('au-cr', 'M102,44 L108,5 Q120,-1,132,5 L138,44 Z', body),
    strokeP('au-d', 'M120,2 Q118,22,119,42', darkenHex(body, 0.3), 2.2),
    shade('au-s', 'M129,4 Q135,22,137,42 L131,43 Q131,22,128,5 Z', 0.12),
    light('au-l', 'M110,5 Q106,24,104,42 L108,43 Q109,22,113,4 Z', 0.09),
  ];
  if (h.band)
    out.push(p('au-b', 'M102.9,35 L137.1,35 L138,43.4 Q120,49,102.2,43.4 Z', safeHex(h.band)));
  out.push(
    // the brim: one bold diagonal blade, low over the open side, rising to the
    // pin — rotated a touch flatter so the open side doesn't droop
    <g key="au-brg" transform="rotate(8 103.5 31)">
      {p('au-br', 'M66,38 Q102,31,137,16 L141,23 Q106,39,70,46 Z', darkenHex(body, 0.05))}
      {shade('au-brs', 'M70,42 Q104,37,139,21 L141,23 Q106,39,70,46 Z', 0.22)}
    </g>,
    // the fold: the brim's continuation, pinned up beside the crown
    p('au-up', 'M131,0 Q153,5,150,32 Q142,36,136,25 Q138,9,131,0 Z', lightenHex(body, 0.12)),
    strokeP('au-ue', 'M131,0 Q153,5,150,32', darkenHex(body, 0.32), 1.8),
    shade('au-us', 'M145,10 Q150,20,149,31 L150,32 Q153,8,137,2 Z', 0.14)
  );
  // badge rides the pinned-up side (translate maps ornament center 120,34 → 142,26)
  const orn = hatOrnamentNodes(h.ornament, safeHex(h.emblem || cw.metal), 'au');
  if (orn.length > 0) {
    out.push(
      <g key="au-badge" transform="translate(70,-2.4) scale(0.6)">
        {orn}
      </g>
    );
  }
  // lift the other side instead: mirror the whole hat across the centerline
  return h.flip ? [mirrored('au-flip', out)] : out;
}

/**
 * Contour shako: the tall modern taper with a swept, angled top and no visor
 * (an archetype of the 2010s contemporary silhouette, not any corps' replica).
 * The ornament defaults to bare — the clean face IS the look — and the plume
 * stays optional through the standard plume system.
 */
function contour(cw: NormalizedFigure): Node[] {
  const h = cw.hat;
  if (!h) return [];
  const body = safeHex(h.body);
  const out: Node[] = [
    p('co', 'M101,60 L103,8 L135,16 L139,60 Q120,68 101,60 Z', body),
    // swept top face
    p('co-t', 'M103,8 L135,16 L133,20 L105,12 Z', lightenHex(body, 0.14)),
    shade('co-s', 'M128,14 L135,16 L139,60 Q131,63 127,64 Q130,38 128,14 Z', 0.14),
    light('co-l', 'M104,12 L109,13 Q106,36 106,60 Q103,59 102,58 Z', 0.09),
  ];
  if (h.band) {
    out.push(p('co-b', 'M101.4,52 Q120,60 138.6,52 L139,58 Q120,66 101,58 Z', safeHex(h.band)));
  }
  out.push(...hatOrnamentNodes(h.ornament || 'none', safeHex(h.emblem || cw.metal), 'co'));
  return out;
}

/**
 * Busby (Military Outfitters pack): the tall fur cylinder with the colored
 * bag draped down one side. Fur reads through vertical broken strokes; the
 * bag takes the hat's band channel. The ornament system stays available for
 * a front badge, and the standard plume rides above.
 */
function busby(cw: NormalizedFigure): Node[] {
  const h = cw.hat;
  if (!h) return [];
  const body = safeHex(h.body);
  const dk = darkenHex(body, 0.28);
  const lt = lightenHex(body, 0.14);
  const out: Node[] = [
    p('bu', 'M97,58 L95,-8 Q120,-18 145,-8 L143,58 Q120,66 97,58 Z', body),
    // fur: broken vertical strands, dark then light, across the face
    strokeP(
      'bu-f1',
      'M103,-6 Q101,20 102,50 M111,-10 Q109,22 110,54 M120,-12 Q119,24 120,56 M129,-10 Q128,22 129,54 M137,-6 Q136,20 137,50',
      dk,
      1.4,
      { opacity: '.5', strokeDasharray: '5 3' }
    ),
    strokeP(
      'bu-f2',
      'M107,-8 Q105,20 106,52 M115,-11 Q114,24 115,55 M124,-11 Q123,24 124,55 M133,-8 Q131,20 132,52',
      lt,
      1.1,
      { opacity: '.45', strokeDasharray: '4 4' }
    ),
    shade('bu-s', 'M134,-9 Q140,-6 143,-4 L141,58 Q134,61 130,62 Q133,26 134,-9 Z', 0.16),
  ];
  if (h.band) {
    const bag = safeHex(h.band);
    // the bag: drapes from the crown down the viewer-right side
    out.push(
      p('bu-bag', 'M128,-16 Q150,-12 148,14 Q142,30 134,34 Q140,12 130,-8 Z', bag),
      shade('bu-bags', 'M140,-10 Q148,-2 146,14 Q142,26 136,31 Q143,10 137,-8 Z', 0.2),
      <circle key="bu-bagt" cx="135" cy="33" r="2.6" fill={darkenHex(bag, 0.3)} />
    );
  }
  out.push(...hatOrnamentNodes(h.ornament || 'none', safeHex(h.emblem || cw.metal), 'bu'));
  // chin chain: small metal links across the front bottom
  for (let i = 0; i < 5; i++) {
    out.push(
      <circle
        key={`bu-ch${i}`}
        cx={102 + i * 9}
        cy={60 + Math.sin((i / 4) * Math.PI) * 4}
        r="1.4"
        fill={safeHex(cw.metal)}
      />
    );
  }
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
  // Two-tone plumes: the accent dyes the upper reach (upright) or alternating
  // sprays (fountain) — the dyed-tip look of real feather plumes.
  const tip = pl.accent ? safeHex(pl.accent) : null;
  if (pl.type === 'upright') {
    const out: Node[] = [
      p('pu', 'M113,12 Q107,-34 118,-64 Q121,-70 124,-64 Q133,-32 127,12 Q120,16 113,12 Z', c),
      strokeP('pu-1', 'M117,8 Q114,-30 119,-58', lightenHex(c, 0.35), 1.1, { opacity: '.7' }),
      strokeP('pu-2', 'M122,8 Q121,-34 121,-60', lightenHex(c, 0.35), 1.1, { opacity: '.55' }),
      strokeP('pu-3', 'M125,6 Q127,-26 123,-56', darkenHex(c, 0.25), 1.1, { opacity: '.5' }),
    ];
    if (tip) {
      out.push(
        p(
          'pu-a',
          'M114.5,-26 Q110,-48 118,-64 Q121,-70 124,-64 Q130,-44 125.5,-24 Q120,-20 114.5,-26 Z',
          tip
        ),
        strokeP('pu-a1', 'M118,-28 Q117,-46 120,-60', lightenHex(tip, 0.3), 1.1, {
          opacity: '.6',
        })
      );
    }
    out.push(shade('pu-s', 'M124,-60 Q130,-30 126,10 L121,12 Q128,-28 122,-62 Z', 0.12));
    if (pl.mylar) out.push(...sequinField('pu-m', 120, -26, 12, 72, 13, 18));
    return out;
  }
  if (pl.type === 'sideFeather') {
    // A feather spray off the hat's pinned side (the classic corps-aussie
    // look): layered blades sweeping up and out, tips dyed by the accent.
    const blades: Array<[string, number]> = [
      ['M140,16 C144,-12,154,-30,168,-40', 4.2],
      ['M140,16 C150,-8,164,-20,180,-24', 3.8],
      ['M140,16 C141,-16,147,-38,156,-50', 3.6],
      ['M140,16 C154,-4,172,-10,184,-6', 3.2],
      ['M140,16 C146,-20,158,-36,172,-46', 2.6],
    ];
    const out: Node[] = [];
    blades.forEach(([d, w], i) => {
      out.push(strokeP(`ps${i}`, d, c, w));
      out.push(strokeP(`ps${i}-l`, d, lightenHex(c, 0.3), 1.2, { opacity: '.5' }));
    });
    if (tip) {
      const tips = [
        'M160,-34 C164,-38,168,-40,172,-41',
        'M170,-20 C175,-22,180,-23,183,-24',
        'M151,-41 C153,-45,155,-48,157,-51',
        'M174,-10 C178,-9,182,-8,185,-7',
        'M163,-39 C167,-42,170,-44,173,-46',
      ];
      tips.forEach((d, i) => out.push(strokeP(`ps-t${i}`, d, tip, 4)));
    }
    // the feather follows the hat's lifted side
    return cw.hat?.flip ? [mirrored('ps-flip', out)] : out;
  }
  if (pl.type === 'fan') {
    // Plumassier fan (Casa Roldán): straight quills spread in a half-circle
    // from a metal boss at the crown, alternating dyed when two-tone.
    const out: Node[] = [];
    const N = 9;
    for (let i = 0; i < N; i++) {
      const angle = (Math.PI * (28 + (i * 124) / (N - 1))) / 180;
      const x = 120 + Math.cos(angle) * 54;
      const y = 6 - Math.sin(angle) * 56;
      const quill = tip && i % 2 === 1 ? tip : c;
      out.push(strokeP(`pq${i}`, `M120,6 L${x.toFixed(1)},${y.toFixed(1)}`, quill, 3.4));
      out.push(
        strokeP(
          `pq${i}-l`,
          `M120,6 L${x.toFixed(1)},${y.toFixed(1)}`,
          lightenHex(quill, 0.3),
          1.1,
          {
            opacity: '.5',
          }
        )
      );
      out.push(
        <circle
          key={`pq${i}-t`}
          cx={x.toFixed(1)}
          cy={y.toFixed(1)}
          r="2.6"
          fill={darkenHex(quill, 0.2)}
        />
      );
    }
    out.push(<circle key="pq-b" cx="120" cy="8" r="5" fill={safeHex(cw.metal)} />);
    return out;
  }
  if (pl.type === 'cascade') {
    // Plumassier cascade (Casa Roldán): the tall willow plume — long strands
    // climbing well past the upright's reach, then spilling down both sides.
    const strands: string[] = [
      'M118,6 C110,-44 98,-60 84,-30',
      'M119,4 C113,-54 103,-70 92,-46',
      'M120,2 C119,-58 118,-78 112,-66',
      'M120,2 C121,-58 123,-78 129,-66',
      'M121,4 C127,-54 137,-70 148,-46',
      'M122,6 C130,-44 142,-60 156,-30',
      'M120,4 C118,-48 112,-64 102,-50',
      'M120,4 C122,-48 128,-64 138,-50',
    ];
    const out: Node[] = [];
    strands.forEach((d, i) => {
      const strand = tip && i % 2 === 1 ? tip : c;
      out.push(strokeP(`pc${i}`, d, strand, 3));
      out.push(strokeP(`pc${i}-l`, d, lightenHex(strand, 0.3), 1.1, { opacity: '.5' }));
    });
    out.push(<circle key="pc-b" cx="120" cy="7" r="4.5" fill={safeHex(cw.metal)} />);
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
    const arcColor = tip && i % 2 === 1 ? tip : c;
    out.push(strokeP(`pf${i}`, a, arcColor, 3.8));
    out.push(strokeP(`pf${i}-l`, a, lightenHex(arcColor, 0.28), 1.2, { opacity: '.45' }));
  });
  out.push(<circle key="pf-m" cx="120" cy="6" r="4.5" fill={safeHex(cw.metal)} />);
  return out;
}

/**
 * The left-breast badge patch (the SCV-style corps badge): any ornament shape
 * in its own colors via the shared builder, scaled down from its (120,34) hat
 * anchor onto the chest at ≈(137,130).
 */
function chestBadge(cw: NormalizedFigure): Node[] {
  const b = cw.chestBadge;
  if (!b || b.shape === 'none') return [];
  const out: Node[] = [
    <g key="cb-g" transform="translate(71,111.3) scale(0.55)">
      {hatOrnamentNodes(b.shape, safeHex(b.color), 'cb', b.accent ? safeHex(b.accent) : undefined)}
    </g>,
  ];
  return b.flip ? [mirrored('cb-flip', out)] : out;
}

/**
 * One-shoulder cavalry cape (Military Outfitters pack): drapes from the
 * viewer-left shoulder over the arm, lining flashing at the hem, metal clasp
 * at the collarbone. side:'right' mirrors it.
 */
function cape(cw: NormalizedFigure): Node[] {
  const cp = cw.cape;
  if (!cp) return [];
  const c = safeHex(cp.color);
  const lining = cp.lining ? safeHex(cp.lining) : darkenHex(c, 0.4);
  const out: Node[] = [
    p('cp', 'M114,97 Q90,100 82,110 L58,242 Q80,258 100,250 Q100,180 106,122 Z', c),
    p('cp-l', 'M58,242 Q80,258 100,250 L98,234 Q80,244 62,230 Z', lining),
    shade('cp-s', 'M108,100 Q98,104 94,112 L74,238 Q80,243 86,244 L102,124 Z', 0.14),
    light('cp-h', 'M88,104 Q84,108 82,114 L60,238 Q63,241 67,243 L88,112 Z', 0.1),
    <circle key="cp-c" cx="112" cy="102" r="3.2" fill={safeHex(cw.metal)} />,
    <circle key="cp-cl" cx="111" cy="101" r="1" fill={FIGURE_INK.white} opacity=".8" />,
  ];
  return cp.side === 'right' ? [mirrored('cp-r', out)] : out;
}

/**
 * Drum-major aiguillette (prestige regalia): a braided cord pinned at the
 * viewer-left shoulder seam, swinging in two nested loops under the arm and
 * back up to a chest stud, with two metal ferrule tips hanging below it. The
 * braid reads through a lighter dashed overlay on each loop.
 */
function aiguillette(cw: NormalizedFigure): Node[] {
  if (!cw.aiguillette) return [];
  const c = safeHex(cw.aiguillette);
  const dk = darkenHex(c, 0.35);
  const lt = lightenHex(c, 0.3);
  const m = safeHex(cw.metal);
  const loops = [
    'M88,106 Q74,138 84,156 Q97,167 108,148 Q112,136 111,125',
    'M89,109 Q79,135 87,149 Q96,157 104,143 Q108,134 108,126',
  ];
  const out: Node[] = [];
  loops.forEach((d, i) => {
    out.push(strokeP(`ag${i}-u`, d, dk, i === 0 ? 4 : 3.2));
    out.push(strokeP(`ag${i}`, d, c, i === 0 ? 2.8 : 2.2));
    out.push(strokeP(`ag${i}-b`, d, lt, 1.1, { strokeDasharray: '2.2 2.6', opacity: '.75' }));
  });
  out.push(
    // shoulder pin + chest stud
    <circle key="ag-p" cx="88" cy="106" r="2.4" fill={m} />,
    <circle key="ag-st" cx="110" cy="124" r="2.6" fill={m} />,
    <circle key="ag-stl" cx="109.2" cy="123.2" r="0.9" fill={FIGURE_INK.white} opacity=".8" />,
    // hanging ferrule tips
    strokeP('ag-t1c', 'M110,126 Q111,132 111.5,137', c, 1.6),
    strokeP('ag-t2c', 'M108,127 Q107,133 106.5,138', c, 1.6),
    <rect key="ag-t1" x="110.2" y="136" width="2.6" height="9" rx="1" fill={m} />,
    <rect key="ag-t2" x="105.2" y="137" width="2.6" height="9" rx="1" fill={m} />,
    <rect
      key="ag-t1l"
      x="110.6"
      y="136.8"
      width="0.9"
      height="7"
      fill={FIGURE_INK.white}
      opacity=".5"
    />,
    <rect
      key="ag-t2l"
      x="105.6"
      y="137.8"
      width="0.9"
      height="7"
      fill={FIGURE_INK.white}
      opacity=".5"
    />
  );
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
  if (cw.iridescent) layers.push(<g key="irid">{iridescentSheen(uid)}</g>);
  if (cw.lame) layers.push(<g key="lame">{lameField()}</g>);
  layers.push(
    <g key="chest">{chest(cw, uid)}</g>,
    <g key="chestBadge">{chestBadge(cw)}</g>,
    <g key="glowart">{glowArt(cw, uid)}</g>,
    <g key="susp">{suspenders(cw)}</g>,
    <g key="belt">{belt(cw)}</g>,
    <g key="tie">{tieDrop(cw)}</g>,
    <g key="fringe">{fringeHip(cw)}</g>,
    <g key="arms">{arms(cw, uid)}</g>,
    <g key="epau">{epaulets(cw)}</g>,
    <g key="cape">{cape(cw)}</g>,
    <g key="aig">{aiguillette(cw)}</g>,
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
  if (cw.hatType === 'aussie') layers.push(<g key="hat">{aussie(cw)}</g>);
  if (cw.hatType === 'contour') layers.push(<g key="hat">{contour(cw)}</g>);
  if (cw.hatType === 'busby') layers.push(<g key="hat">{busby(cw)}</g>);
  return layers;
}
