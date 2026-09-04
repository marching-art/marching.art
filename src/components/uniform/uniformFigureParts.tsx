// =============================================================================
// UNIFORM FIGURE PARTS — geometry, procedural defs, and layer builders
// =============================================================================
// The pure half of the figure renderer: shared geometry paths, procedural
// print/gradient defs, every garment part builder, and figureLayers().
// Split from UniformFigure.tsx so the component file stays component-only
// (react-refresh) and under the max-lines guardrail. See UniformFigure.tsx
// for the architecture notes.

import React from 'react';
import {
  darkenHex,
  lightenHex,
  resolvePrintPalettes,
  safeHex,
  type NormalizedFigure,
} from '../../utils/uniform';
import type { LegConfig } from '../../types/uniform';
import { FIGURE_INK, IRIDESCENT_STOPS } from '../../data/uniformRenderTheme';

export const FIGURE_VIEWBOX = '0 -84 240 560';

// ---------------------------------------------------------------------------
// low-level building blocks
// ---------------------------------------------------------------------------

export type Node = React.ReactNode;

export const p = (key: string, d: string, fill: string): Node => (
  <path key={key} d={d} fill={fill} />
);
export const shade = (key: string, d: string, o: number): Node => (
  <path key={key} d={d} fill={FIGURE_INK.black} opacity={o} />
);
export const light = (key: string, d: string, o: number): Node => (
  <path key={key} d={d} fill={FIGURE_INK.white} opacity={o} />
);
export const strokeP = (
  key: string,
  d: string,
  color: string,
  width: number,
  extra: Record<string, string | number> = {}
): Node => (
  <path
    key={key}
    d={d}
    fill="none"
    stroke={color}
    strokeWidth={width}
    strokeLinecap="round"
    {...extra}
  />
);
export const mirrored = (key: string, children: Node): Node => (
  <g key={key} transform="translate(240,0) scale(-1,1)">
    {children}
  </g>
);

/** Deterministic sparkle field (same LCG as the prototype). */
export function sequinField(
  keyPrefix: string,
  cx: number,
  cy: number,
  w: number,
  h: number,
  seed: number,
  n: number
): Node[] {
  let s = seed;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const out: Node[] = [];
  for (let i = 0; i < n; i++) {
    const x = cx - w / 2 + rnd() * w;
    const y = cy - h / 2 + rnd() * h;
    const r = 0.5 + rnd() * 0.9;
    const o = 0.25 + rnd() * 0.55;
    out.push(
      <circle
        key={`${keyPrefix}${i}`}
        cx={+x.toFixed(1)}
        cy={+y.toFixed(1)}
        r={+r.toFixed(1)}
        fill={FIGURE_INK.white}
        opacity={+o.toFixed(2)}
      />
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// shared geometry (ported verbatim from the prototype)
// ---------------------------------------------------------------------------

const TORSO_D =
  'M78,104 Q120,93 162,104 L158,150 Q153,200 153,248 L155,260 Q120,269 85,260 L87,248 Q87,200 82,150 Z';
const TUNIC_D =
  'M78,104 Q120,93 162,104 L158,150 Q154,196 154,224 L151,270 Q143,292 131,296 L121,266 Q102,262 88,254 L87,246 Q87,198 82,150 Z';
// Guard dress (the show-look silhouette): fitted bodice into an A-line skirt
// with an asymmetric hem — low on the viewer-right, sweeping up on the left
// so the leggings read underneath.
const DRESS_D =
  'M78,104 Q120,93 162,104 L158,150 Q154,200 156,240 Q163,288 172,326 Q138,352 108,344 Q86,338 72,318 Q81,282 84,240 Q87,200 82,150 Z';
// Long coat (Tailors' Cut premium silhouette): the jacket top carried down to
// a mid-calf skirt with a center vent — the inverted-V notch at the hem lets
// the trousers read through.
const LONGCOAT_D =
  'M78,104 Q120,93 162,104 L158,150 Q154,200 156,246 Q158,300 164,344 L130,352 L120,306 L110,352 L76,344 Q82,300 84,246 Q87,200 82,150 Z';

/** The active torso outline for fills and the print clip. */
export function torsoPathOf(cw: NormalizedFigure): string {
  return cw.torsoStyle === 'tunic'
    ? TUNIC_D
    : cw.torsoStyle === 'dress'
      ? DRESS_D
      : cw.torsoStyle === 'longcoat'
        ? LONGCOAT_D
        : TORSO_D;
}
const LEG_D =
  'M90,254 L85,308 Q83,360 91,438 L114,438 Q112,384 113,336 Q113,306 116,284 Q119,276 120,272 L120,254 Z';
const LEG_FLARE_D =
  'M90,254 L85,308 Q83,360 83,406 Q81,428 75,446 L118,446 Q114,390 114,336 Q113,306 116,284 Q119,276 120,272 L120,254 Z';
const LEG_TATTER_D =
  'M90,254 L85,308 Q83,360 88,422 L87,442 L92,427 L96,444 L101,428 L105,443 L109,427 L112,441 L114,422 Q113,380 113,336 Q113,306 116,284 Q119,276 120,272 L120,254 Z';
export const SLEEVE_D =
  'M78,103 Q66,111 62,134 Q57,165 59,197 Q60,223 63,242 L82,244 Q79,214 79,186 Q79,148 88,118 Q85,107 78,103 Z';
export const BARE_ARM_D =
  'M80,110 Q68,120 63,142 Q58,168 60,198 Q61,224 64,242 L82,244 Q80,214 80,188 Q80,152 86,122 Q85,114 80,110 Z';

// ---------------------------------------------------------------------------
// fills
// ---------------------------------------------------------------------------

export function fillOf(
  spec: string | null | undefined,
  uid: string,
  fallback?: string | null
): string {
  if (spec && spec.startsWith('url:')) return `url(#${uid}-${spec.slice(4)})`;
  if (spec) return safeHex(spec);
  return safeHex(fallback);
}

// ---------------------------------------------------------------------------
// defs: clip paths, procedural prints, gradients, glow filter
// ---------------------------------------------------------------------------

export function buildDefs(cw: NormalizedFigure, uid: string): React.ReactElement {
  // Stock palettes, or the director's printColors overrides when set.
  const { sunburst: sun, opart: op, pinstripe: pin, plaid: pl, foil } = resolvePrintPalettes(cw);
  return (
    <defs key="defs">
      <clipPath id={`${uid}-tclip`}>
        <path d={torsoPathOf(cw)} />
      </clipPath>
      {cw.print === 'sunburst' && (
        <radialGradient id={`${uid}-sun`} gradientUnits="userSpaceOnUse" cx="98" cy="252" r="220">
          {sun.stops.map(([off, col]) => (
            <stop key={off} offset={off} stopColor={col} />
          ))}
        </radialGradient>
      )}
      {cw.print === 'opart' && (
        <pattern
          id={`${uid}-opart`}
          width="14"
          height="14"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(8)"
        >
          <rect width="14" height="14" fill={op.bg} />
          <circle cx="3.5" cy="3.5" r="2.6" fill={op.dotA} />
          <circle cx="10.5" cy="10.5" r="2.6" fill={op.dotB} />
          <path
            d="M-2,10 Q3.5,6 7,10 T16,10"
            stroke={op.wave}
            strokeWidth="1"
            fill="none"
            opacity=".55"
          />
        </pattern>
      )}
      {cw.print === 'pinstripe' && (
        <pattern id={`${uid}-pinstripe`} width="7" height="7" patternUnits="userSpaceOnUse">
          <rect width="7" height="7" fill={pin.bg} />
          <path d="M3.5,0 V7" stroke={pin.stripe} strokeWidth="1.1" />
        </pattern>
      )}
      {cw.plaid && (
        <pattern id={`${uid}-plaid`} width="13" height="13" patternUnits="userSpaceOnUse">
          <rect width="13" height="13" fill={pl.bg} />
          <path d="M0,4.5 H13" stroke={pl.bandA} strokeWidth="3" />
          <path d="M4.5,0 V13" stroke={pl.bandB} strokeWidth="2.2" opacity=".85" />
          <path d="M0,10.5 H13" stroke={pl.bandC} strokeWidth="1.2" />
        </pattern>
      )}
      {cw.grads &&
        Object.entries(cw.grads).map(([id, stops]) => (
          <linearGradient
            key={id}
            id={`${uid}-${id}`}
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1="104"
            x2="0"
            y2="250"
          >
            {(Array.isArray(stops) ? stops : []).map((stop, i) => (
              <stop key={i} offset={stop?.o} stopColor={safeHex(stop?.c)} />
            ))}
          </linearGradient>
        ))}
      {cw.iridescent && (
        <linearGradient
          id={`${uid}-irid`}
          gradientUnits="userSpaceOnUse"
          x1="90"
          y1="108"
          x2="152"
          y2="248"
        >
          {IRIDESCENT_STOPS.map((stop) => (
            <stop key={stop.o} offset={stop.o} stopColor={stop.c} />
          ))}
        </linearGradient>
      )}
      {cw.chestFade && (
        <linearGradient
          id={`${uid}-fadeChest`}
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="104"
          x2="0"
          y2="250"
        >
          <stop offset="0" stopColor={safeHex(cw.chestFade[0])} />
          <stop offset="1" stopColor={safeHex(cw.chestFade[1])} />
        </linearGradient>
      )}
      {cw.foilLeg && (
        <linearGradient
          id={`${uid}-foil`}
          gradientUnits="userSpaceOnUse"
          x1="80"
          y1="260"
          x2="130"
          y2="440"
        >
          {foil.stops.map(([off, col]) => (
            <stop key={off} offset={off} stopColor={col} />
          ))}
        </linearGradient>
      )}
      {cw.glow && (
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

// ---------------------------------------------------------------------------
// body parts (each returns an array of nodes; right limbs mirror the left)
// ---------------------------------------------------------------------------

export function ground(): Node[] {
  return [
    <ellipse key="gnd" cx="120" cy="466" rx="54" ry="8" fill={FIGURE_INK.black} opacity="0.4" />,
  ];
}

export function headNeck(cw: NormalizedFigure): Node[] {
  const s = safeHex(cw.skin);
  return [
    p('nk', 'M110,74 L110,96 Q120,103 130,96 L130,74 Z', s),
    shade('nk-s', 'M110,76 Q120,86 130,76 L130,74 L110,74 Z', 0.22),
    p(
      'hd',
      'M103,46 Q103,26 120,26 Q137,26 137,46 Q137,62 130,72 Q125,78 120,78 Q115,78 110,72 Q103,62 103,46 Z',
      s
    ),
    p('er-l', 'M101,50 Q97,52 99,58 Q101,62 104,60 Z', s),
    p('er-r', 'M139,50 Q143,52 141,58 Q139,62 136,60 Z', s),
    shade('hd-s', 'M128,29 Q136,38 135,52 Q134,64 128,71 Q132,58 131,44 Q130,34 128,29 Z', 0.12),
    light('hd-l', 'M107,40 Q106,52 111,62 Q107,50 109,40 Z', 0.1),
  ];
}

export function hair(cw: NormalizedFigure): Node[] {
  const c = safeHex(cw.hair || FIGURE_INK.defaultHair);
  return [
    p(
      'hr',
      'M103,44 Q102,26 120,25 Q138,26 137,44 Q136,38 132,34 Q126,30 120,30 Q114,30 108,34 Q104,38 103,44 Z',
      c
    ),
    shade('hr-s', 'M124,27 Q134,30 136,42 Q133,33 124,29 Z', 0.25),
  ];
}

function legSide(l: LegConfig, uid: string, keyPrefix: string): Node[] {
  const fill = fillOf(l.fill, uid, l.color);
  const d = l.flare ? LEG_FLARE_D : l.tattered ? LEG_TATTER_D : LEG_D;
  const out: Node[] = [
    p(`${keyPrefix}`, d, fill),
    shade(`${keyPrefix}-in`, 'M113,300 Q112,370 113,436 L108,436 Q108,370 110,300 Z', 0.12),
    light(`${keyPrefix}-cr`, 'M100,290 Q98,360 100,432 L103,432 Q101,360 103,290 Z', 0.07),
  ];
  if (l.stripe) {
    out.push(
      p(
        `${keyPrefix}-st`,
        'M90,258 L86,308 Q84,360 92,436 L98,436 Q90,360 92,308 L96,258 Z',
        safeHex(l.stripe)
      )
    );
  }
  if (l.foil) {
    out.push(...sequinField(`${keyPrefix}-fo`, 100, 350, 26, 170, 17, 40));
    out.push(light(`${keyPrefix}-fl`, 'M96,270 Q93,350 97,430 L101,430 Q97,350 100,272 Z', 0.18));
  }
  if (l.sequin) out.push(...sequinField(`${keyPrefix}-sq`, 100, 350, 24, 170, 19, 34));
  return out;
}

export function legs(cw: NormalizedFigure, uid: string): Node[] {
  return [
    ...legSide(cw.legL, uid, 'lgL'),
    mirrored('lgR', legSide(cw.legR, uid, 'lgR')),
    shade('lg-cr', 'M115,270 Q120,264 125,270 Q122,284 120,296 Q118,284 115,270 Z', 0.12),
    shade(
      'lg-hip',
      'M88,254 L152,254 L151,268 Q120,274 89,268 Z',
      cw.torsoStyle === 'jumpsuit' ? 0.08 : 0.2
    ),
  ];
}

export function swashLeg(cw: NormalizedFigure): Node[] {
  if (cw.chest !== 'swash' || cw.swashBottom === false) return [];
  // The leg band takes its own color when set; otherwise it matches the swash.
  const c = safeHex(cw.swashLegColor || cw.swash);
  return [
    p('swl', 'M89,256 Q86,320 93,436 L104,436 Q95,330 100,256 Z', c),
    ...(cw.swashSequin === false ? [] : sequinField('swl-s', 96, 340, 12, 170, 7, 26)),
  ];
}

export function streamers(cw: NormalizedFigure): Node[] {
  if (!cw.streamers) return [];
  const c1 = safeHex(cw.streamers[0]);
  const c2 = safeHex(cw.streamers[1]);
  const side = (kp: string): Node[] => [
    p(
      `${kp}-a`,
      'M88,258 Q70,330 66,400 Q64,428 68,446 L78,444 Q74,420 78,380 Q82,320 96,262 Z',
      c1
    ),
    <path
      key={`${kp}-b`}
      d="M92,262 Q80,330 78,398 Q77,420 80,440 L87,438 Q84,410 88,368 Q92,314 101,264 Z"
      fill={c2}
      opacity=".8"
    />,
    light(`${kp}-l`, 'M88,262 Q76,330 72,400 L75,400 Q78,330 92,264 Z', 0.16),
  ];
  return [...side('smL'), mirrored('smR', side('smR'))];
}

export function shoes(cw: NormalizedFigure): Node[] {
  if (cw.sneaker) {
    const body = 'M89,432 Q86,446 90,450 L115,450 Q117,443 114,432 Z';
    const sole = 'M87,448 L117,448 Q118,454 115,456 L89,456 Q86,453 87,448 Z';
    const one = (kp: string): Node[] => [
      p(`${kp}-b`, body, FIGURE_INK.sneakerBody),
      p(`${kp}-s`, sole, FIGURE_INK.sneakerSole),
      shade(`${kp}-sh`, 'M89,446 L115,446 L115,449 L89,449 Z', 0.12),
      strokeP(`${kp}-lc`, 'M93,436 L100,433 M96,440 L104,436', FIGURE_INK.sneakerLace, 1.4),
    ];
    return [...one('snL'), mirrored('snR', one('snR'))];
  }
  const c = safeHex(cw.shoe);
  const shoeD = 'M89,436 Q85,452 91,457 L114,457 Q117,450 114,436 Z';
  const one = (kp: string): Node[] => [
    p(`${kp}`, shoeD, c),
    shade(`${kp}-s`, 'M89,452 Q100,457 114,455 L114,457 L91,457 Q87,455 89,452 Z', 0.4),
  ];
  const out: Node[] = [
    ...one('shL'),
    mirrored('shR', one('shR')),
    light('sh-l', 'M92,438 L112,438 L112,441 L92,441 Z', 0.1),
  ];
  if (cw.spats) {
    const sp = 'M91,436 Q88,448 93,452 L112,452 Q114,446 112,436 Z';
    const spat = (kp: string): Node[] => [
      p(`${kp}`, sp, FIGURE_INK.spats),
      <circle key={`${kp}-b1`} cx="96" cy="443" r="1.2" fill={FIGURE_INK.spatButton} />,
      <circle key={`${kp}-b2`} cx="96" cy="448" r="1.2" fill={FIGURE_INK.spatButton} />,
    ];
    out.push(...spat('spL'), mirrored('spR', spat('spR')));
  }
  return out;
}

export function torso(cw: NormalizedFigure, uid: string): Node[] {
  const d = torsoPathOf(cw);
  const fill = fillOf(cw.torsoFill, uid, cw.jacket);
  const out: Node[] = [p('to', d, fill)];
  if (cw.print === 'sunburst') {
    const ends: Array<[number, number]> = [
      [210, 120],
      [200, 80],
      [180, 50],
      [156, 30],
      [130, 22],
      [104, 26],
      [86, 44],
      [78, 70],
    ];
    const ray = resolvePrintPalettes(cw).sunburst.ray;
    out.push(
      <g key="to-rays" clipPath={`url(#${uid}-tclip)`}>
        {ends.map(([x, y], i) =>
          strokeP(`ray${i}`, `M98,252 L${x},${y}`, ray, 2.4, {
            opacity: '.3',
          })
        )}
      </g>
    );
  }
  out.push(
    shade(
      'to-s',
      'M140,99 Q149,180 148,260 L155,260 L153,248 Q153,175 158,116 L162,104 Q152,100 140,99 Z',
      0.16
    ),
    light('to-l', 'M87,107 Q85,170 90,250 L95,252 Q90,176 95,111 Z', 0.09),
    shade('to-c', 'M104,96 Q120,106 136,96 Q120,112 104,96 Z', 0.18)
  );
  if (cw.torsoStyle === 'dress') {
    // skirt: fold shadows fanning from the waist, hem shade on the low side
    out.push(
      shade('to-df1', 'M100,250 Q99,296 96,336 L104,338 Q104,298 106,252 Z', 0.1),
      shade('to-df2', 'M130,252 Q134,296 140,340 L148,336 Q140,296 137,252 Z', 0.1),
      shade('to-dh', 'M150,300 Q162,314 172,326 Q152,340 128,346 Q146,330 150,300 Z', 0.14),
      light('to-dl', 'M84,254 Q80,290 74,316 Q80,326 88,332 Q88,292 92,256 Z', 0.08)
    );
  }
  if (cw.torsoStyle === 'longcoat') {
    // coat skirt: the front-opening seam down to the vent, panel-edge
    // shadows, and a shade inside the vent so the split reads as depth
    out.push(
      strokeP('to-cv', 'M120,252 L120,306', darkenHex(safeHex(cw.jacket), 0.35), 1.6, {
        opacity: '.6',
      }),
      shade('to-cvs', 'M120,306 L130,352 L124,352 L118,312 Z', 0.2),
      shade('to-cp1', 'M148,250 Q151,300 156,342 L163,344 Q157,298 155,248 Z', 0.14),
      light('to-cp2', 'M90,252 Q86,300 80,340 L86,342 Q91,298 96,254 Z', 0.08)
    );
  }
  if (cw.torsoSequin) {
    out.push(
      <g key="to-sq" clipPath={`url(#${uid}-tclip)`}>
        {sequinField('tsq', 120, 170, 80, 130, 23, 90)}
      </g>
    );
  }
  if (cw.patent) {
    out.push(
      light('to-p1', 'M94,112 Q92,170 95,242 L103,244 Q99,175 102,116 Z', 0.22),
      light('to-p2', 'M132,108 Q136,160 134,230 L138,230 Q140,160 136,110 Z', 0.1)
    );
  }
  return out;
}

export function satinSheen(): Node[] {
  return [
    light('sat1', 'M92,124 Q124,110 152,138 Q124,128 94,142 Z', 0.1),
    light('sat2', 'M90,176 Q122,162 150,190 Q122,180 92,196 Z', 0.06),
    light('sat3', 'M96,116 Q95,180 98,244 L102,244 Q99,180 101,118 Z', 0.05),
  ];
}

export function velvetSheen(): Node[] {
  return [
    light('vel1', 'M90,130 Q120,118 150,140 Q120,132 92,148 Z', 0.05),
    light('vel2', 'M92,196 Q120,186 148,204 Q120,196 94,212 Z', 0.04),
  ];
}

/**
 * Iridescent finish (Texture Atelier): the hue-shift ramp over the torso at
 * low opacity, plus a hot diagonal "angle" band so the shift reads as light,
 * not as a print.
 */
export function iridescentSheen(uid: string): Node[] {
  return [
    <path
      key="irid"
      d="M96,104 Q120,96 144,104 L150,244 Q120,254 90,244 Z"
      fill={`url(#${uid}-irid)`}
      opacity=".32"
    />,
    light('irid-b', 'M92,150 Q124,132 150,158 Q122,150 94,168 Z', 0.16),
  ];
}

/**
 * Lamé finish (Texture Atelier): a dense micro-glint field — finer and far
 * denser than sequins — with two sheen bands so the cloth reads as woven
 * metal rather than applied sparkle.
 */
export function lameField(): Node[] {
  return [
    ...sequinField('lam-a', 120, 150, 50, 88, 17, 70),
    ...sequinField('lam-b', 120, 214, 54, 64, 29, 50),
    light('lam-s1', 'M94,128 Q122,112 148,134 Q120,126 96,144 Z', 0.14),
    light('lam-s2', 'M92,206 Q120,192 148,212 Q120,204 94,222 Z', 0.1),
  ];
}

export function glowArt(cw: NormalizedFigure, uid: string): Node[] {
  if (!cw.glowArt) return [];
  const c = safeHex(cw.glowArt);
  const fx = { filter: `url(#${uid}-glow)` };
  return [
    strokeP(
      'ga1',
      'M120,118 Q98,140 104,166 Q112,190 120,196 Q128,190 136,166 Q142,140 120,118 Z',
      c,
      2.2,
      { ...fx, opacity: '.95' }
    ),
    strokeP(
      'ga2',
      'M120,132 Q108,150 112,170 Q116,184 120,188 Q124,184 128,170 Q132,150 120,132 Z',
      c,
      1.6,
      { ...fx, opacity: '.8' }
    ),
    strokeP('ga3', 'M94,112 Q104,128 102,146 M146,112 Q136,128 138,146', c, 1.8, {
      ...fx,
      opacity: '.8',
    }),
    strokeP('ga4', 'M104,206 Q120,214 136,206', c, 1.8, { ...fx, opacity: '.7' }),
  ];
}

export function suspenders(cw: NormalizedFigure): Node[] {
  if (!cw.suspenders) return [];
  const c = safeHex(cw.suspenders);
  const strap = (kp: string): Node[] => [
    p(`${kp}`, 'M100,105 Q96,170 98,248 L107,248 Q104,170 107,107 Z', c),
    shade(`${kp}-s`, 'M104,110 Q102,175 105,246 L107,248 L104,248 Q101,175 102,110 Z', 0.2),
    <rect
      key={`${kp}-c`}
      x="98.5"
      y="238"
      width="8"
      height="6"
      rx="1"
      fill={FIGURE_INK.brassClip}
    />,
  ];
  return [...strap('suL'), mirrored('suR', strap('suR'))];
}

export function tieDrop(cw: NormalizedFigure): Node[] {
  if (!cw.tie) return [];
  const c = safeHex(cw.tie);
  return [
    p('tie', 'M113,100 L127,100 L124,150 Q120,158 116,150 Z', c),
    ...sequinField('tie-s', 120, 126, 10, 50, 27, 22),
    shade('tie-sh', 'M123,102 L127,100 L124,150 Q122,155 120,156 Q123,130 123,102 Z', 0.18),
  ];
}

export function fringeHip(cw: NormalizedFigure): Node[] {
  if (!cw.fringe) return [];
  const c = safeHex(cw.fringe);
  const out: Node[] = [];
  for (let i = 0; i < 9; i++) {
    const x = 92 + i * 5.2;
    const len = 34 + ((i * 13) % 19);
    out.push(
      strokeP(
        `fr${i}`,
        `M${x},${256 + (i % 3) * 3} Q${x - 2},${266 + len / 2} ${x - 1},${256 + len + (i % 3) * 3}`,
        c,
        2,
        { opacity: '.92' }
      )
    );
  }
  return out;
}

export function collar(cw: NormalizedFigure): Node[] {
  if (!cw.collar) return [];
  const out: Node[] = [
    p('co', 'M106,92 L106,105 Q120,111 134,105 L134,92 Q120,99 106,92 Z', safeHex(cw.collar)),
    shade('co-s', 'M106,92 L106,96 Q120,103 134,96 L134,92 Q120,99 106,92 Z', 0.25),
  ];
  if (cw.collarTrim) {
    out.push(strokeP('co-t', 'M106,105 Q120,111 134,105', safeHex(cw.collarTrim), 1.6));
  }
  return out;
}

export function mockNeck(cw: NormalizedFigure, uid: string): Node[] {
  if (!cw.mockNeck) return [];
  const fill = fillOf(cw.mockNeck, uid);
  return [
    p('mn', 'M106,86 L106,104 Q120,110 134,104 L134,86 Q120,93 106,86 Z', fill),
    shade('mn-s', 'M106,86 L106,90 Q120,97 134,90 L134,86 Q120,93 106,86 Z', 0.22),
    strokeP('mn-r', 'M108,92 Q120,98 132,92 M108,97 Q120,103 132,97', FIGURE_INK.black, 1, {
      opacity: '.18',
    }),
  ];
}

/**
 * Cowl scarf: a chunky wrap that hugs the neck (top edge follows the chin
 * curve — the neck runs x110–130 / y74–96, headNeck), drapes over the upper
 * chest in a center-dipping fold, and hangs a tapered tail on the right.
 * Paint order: drape → roll shadow → tail (emerges from under the roll) →
 * roll → highlight/fold lines.
 */
export function cowlScarf(cw: NormalizedFigure): Node[] {
  if (!cw.cowl) return [];
  const c = safeHex(cw.cowl);
  return [
    // lower drape, dipping to a soft V over the chest
    p(
      'cw-d',
      'M100,100 Q120,112 140,100 Q144,106 141,113 Q120,130 99,113 Q96,106 100,100 Z',
      lightenHex(c, 0.06)
    ),
    strokeP('cw-hem', 'M104,113 Q120,127 136,113', darkenHex(c, 0.35), 1.2, { opacity: '.5' }),
    // shadow the roll casts onto the drape
    shade(
      'cw-sh',
      'M100,102 Q120,114 140,102 Q141,107 138,110 Q120,123 102,110 Q99,107 100,102 Z',
      0.18
    ),
    // hanging tail: fold-over notch at the top, tapered angled tip
    p(
      'cw-t',
      'M122,106 Q128,108 130,116 Q134,132 133,150 L125,147 Q127,132 124,118 Q122,110 118,106 Z',
      darkenHex(c, 0.12)
    ),
    shade('cw-te', 'M129,116 Q133,132 132,148 L129,147 Q131,132 126,116 Z', 0.15),
    shade('cw-tf', 'M118,106 L128,107 L123,114 Z', 0.25),
    // the roll wrapped around the neck — top edge hugs under the chin
    p('cw-r', 'M104,86 Q120,94 136,86 Q142,92 140,102 Q120,114 100,102 Q98,92 104,86 Z', c),
    light('cw-rl', 'M104,86 Q120,94 136,86 Q135,90 132,92 Q120,100 108,92 Q105,90 104,86 Z', 0.14),
    strokeP('cw-f1', 'M103,95 Q120,105 137,95', darkenHex(c, 0.4), 1.1, { opacity: '.45' }),
    strokeP('cw-f2', 'M105,90 Q120,98 135,90', darkenHex(c, 0.4), 1, { opacity: '.3' }),
  ];
}

export function crewNeck(cw: NormalizedFigure): Node[] {
  return [strokeP('crew', 'M107,97 Q120,108 133,97', darkenHex(safeHex(cw.jacket), 0.25), 3)];
}

export function neckerchief(cw: NormalizedFigure): Node[] {
  if (!cw.scarf) return [];
  const c = safeHex(cw.scarf);
  return [
    p('sc', 'M104,96 Q120,104 136,96 L124,122 Q120,126 116,122 Z', c),
    shade('sc-s', 'M116,120 Q120,125 124,120 L121,113 L119,113 Z', 0.25),
    <rect key="sc-k" x="116.5" y="108" width="7" height="6" rx="1" fill={darkenHex(c, 0.3)} />,
  ];
}

export function epaulets(cw: NormalizedFigure): Node[] {
  if (!cw.epaulet) return [];
  const c = safeHex(cw.epaulet);
  const m = safeHex(cw.metal);
  const ep = (kp: string): Node[] => [
    p(`${kp}`, 'M68,101 Q80,93 93,99 L91,111 Q79,105 71,111 Z', c),
    strokeP(`${kp}-fr`, 'M70,110 L69,120 M75,111 L74,121 M80,112 L79,122 M85,112 L84,121', c, 2),
    <circle key={`${kp}-b`} cx="82" cy="101" r="2.6" fill={m} />,
    <circle key={`${kp}-bl`} cx="81.2" cy="100.2" r="0.9" fill={FIGURE_INK.white} opacity=".8" />,
  ];
  return [...ep('epL'), mirrored('epR', ep('epR'))];
}

export function belt(cw: NormalizedFigure): Node[] {
  if (cw.waistBand) {
    const out: Node[] = [
      p('wb', 'M84,240 L156,222 L158,238 L86,258 Z', safeHex(cw.waistBand)),
      strokeP('wb-e', 'M84,240 L156,222', safeHex(cw.waistBandEdge || cw.metal), 2.2),
      shade('wb-s', 'M84,246 L157,228 L158,238 L86,258 Z', 0.15),
    ];
    return out;
  }
  if (!cw.belt) return [];
  const out: Node[] = [
    p('bt', 'M87,244 L153,244 L155,260 Q120,269 85,260 Z', safeHex(cw.belt)),
    shade('bt-s', 'M87,244 L153,244 L153.5,249 L86.7,249 Z', 0.18),
  ];
  if (cw.buckle) {
    const b = safeHex(cw.buckle);
    out.push(
      <rect key="bk" x="112" y="247" width="16" height="13" fill={b} />,
      <rect key="bk-i" x="115" y="250" width="10" height="7" fill={darkenHex(b, 0.5)} />,
      <rect
        key="bk-l"
        x="112"
        y="247"
        width="16"
        height="2.5"
        fill={FIGURE_INK.white}
        opacity=".35"
      />
    );
  }
  return out;
}
