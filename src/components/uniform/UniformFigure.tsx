// =============================================================================
// UNIFORM FIGURE — deterministic layered-SVG corps figure renderer
// =============================================================================
// The Studio's product: a corps member rendered from a structured design in
// real time, with zero AI round-trips. Architecture (docs/UNIFORM_STUDIO.md
// §10.3–10.4): albedo garment parts whose fills come from colorway channels +
// a shared, colorway-independent shading/highlight overlay set + procedural
// finish effects (sequin fields, satin/velvet sheen, patent gloss, glow
// piping) and procedural prints (radial burst, op-art, plaid, pinstripe).
// Symmetric limbs are authored once and mirrored; per-side configs unlock the
// modern asymmetry axis.
//
// Like TourPoster, this SVG is style-attribute-only (no Tailwind classes, no
// CSS variables) so it can be serialized and exported via posterExport. All
// hex constants live in src/data/uniformRenderTheme.ts (design-census exempt);
// user-supplied colors pass through safeHex().
//
// Geometry is ported field-for-field from the proposal prototype
// (docs/prototypes/uniform-figure.html) — keep the two in sync when adding
// parts.

import React, { forwardRef, useId, useMemo } from 'react';
import type { FigureConfig } from '../../types/uniform';
import {
  darkenHex,
  lightenHex,
  normalizeFigure,
  safeHex,
  type NormalizedFigure,
} from '../../utils/uniform';
import type { ArmConfig, LegConfig } from '../../types/uniform';
import { FIGURE_INK, PRINT_PALETTES } from '../../data/uniformRenderTheme';

export const FIGURE_VIEWBOX = '0 -84 240 560';

// ---------------------------------------------------------------------------
// low-level building blocks
// ---------------------------------------------------------------------------

type Node = React.ReactNode;

const p = (key: string, d: string, fill: string): Node => <path key={key} d={d} fill={fill} />;
const shade = (key: string, d: string, o: number): Node => (
  <path key={key} d={d} fill={FIGURE_INK.black} opacity={o} />
);
const light = (key: string, d: string, o: number): Node => (
  <path key={key} d={d} fill={FIGURE_INK.white} opacity={o} />
);
const strokeP = (
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
const mirrored = (key: string, children: Node): Node => (
  <g key={key} transform="translate(240,0) scale(-1,1)">
    {children}
  </g>
);

/** Deterministic sparkle field (same LCG as the prototype). */
function sequinField(
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
const LEG_D =
  'M90,254 L85,308 Q83,360 91,438 L114,438 Q112,384 113,336 Q113,306 116,284 Q119,276 120,272 L120,254 Z';
const LEG_FLARE_D =
  'M90,254 L85,308 Q83,360 83,406 Q81,428 75,446 L118,446 Q114,390 114,336 Q113,306 116,284 Q119,276 120,272 L120,254 Z';
const LEG_TATTER_D =
  'M90,254 L85,308 Q83,360 88,422 L87,442 L92,427 L96,444 L101,428 L105,443 L109,427 L112,441 L114,422 Q113,380 113,336 Q113,306 116,284 Q119,276 120,272 L120,254 Z';
const SLEEVE_D =
  'M78,103 Q66,111 62,134 Q57,165 59,197 Q60,223 63,242 L82,244 Q79,214 79,186 Q79,148 88,118 Q85,107 78,103 Z';
const BARE_ARM_D =
  'M80,110 Q68,120 63,142 Q58,168 60,198 Q61,224 64,242 L82,244 Q80,214 80,188 Q80,152 86,122 Q85,114 80,110 Z';

// ---------------------------------------------------------------------------
// fills
// ---------------------------------------------------------------------------

function fillOf(spec: string | null | undefined, uid: string, fallback?: string | null): string {
  if (spec && spec.startsWith('url:')) return `url(#${uid}-${spec.slice(4)})`;
  if (spec) return safeHex(spec);
  return safeHex(fallback);
}

// ---------------------------------------------------------------------------
// defs: clip paths, procedural prints, gradients, glow filter
// ---------------------------------------------------------------------------

function Defs({ cw, uid }: { cw: NormalizedFigure; uid: string }) {
  const sun = PRINT_PALETTES.sunburst;
  const op = PRINT_PALETTES.opart;
  const pin = PRINT_PALETTES.pinstripe;
  const pl = PRINT_PALETTES.plaid;
  const foil = PRINT_PALETTES.foil;
  return (
    <defs>
      <clipPath id={`${uid}-tclip`}>
        <path d={cw.torsoStyle === 'tunic' ? TUNIC_D : TORSO_D} />
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
            {stops.map(([off, col]) => (
              <stop key={off} offset={off} stopColor={safeHex(col)} />
            ))}
          </linearGradient>
        ))}
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

function ground(): Node[] {
  return [
    <ellipse key="gnd" cx="120" cy="466" rx="54" ry="8" fill={FIGURE_INK.black} opacity="0.4" />,
  ];
}

function headNeck(cw: NormalizedFigure): Node[] {
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

function hair(cw: NormalizedFigure): Node[] {
  const c = safeHex(cw.hair || '#2b2119');
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

function legs(cw: NormalizedFigure, uid: string): Node[] {
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

function swashLeg(cw: NormalizedFigure): Node[] {
  if (cw.chest !== 'swash') return [];
  const c = safeHex(cw.swash);
  return [
    p('swl', 'M89,256 Q86,320 93,436 L104,436 Q95,330 100,256 Z', c),
    ...sequinField('swl-s', 96, 340, 12, 170, 7, 26),
  ];
}

function streamers(cw: NormalizedFigure): Node[] {
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

function shoes(cw: NormalizedFigure): Node[] {
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

function torso(cw: NormalizedFigure, uid: string): Node[] {
  const d = cw.torsoStyle === 'tunic' ? TUNIC_D : TORSO_D;
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
    out.push(
      <g key="to-rays" clipPath={`url(#${uid}-tclip)`}>
        {ends.map(([x, y], i) =>
          strokeP(`ray${i}`, `M98,252 L${x},${y}`, PRINT_PALETTES.sunburst.ray, 2.4, {
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

function satinSheen(): Node[] {
  return [
    light('sat1', 'M92,124 Q124,110 152,138 Q124,128 94,142 Z', 0.1),
    light('sat2', 'M90,176 Q122,162 150,190 Q122,180 92,196 Z', 0.06),
    light('sat3', 'M96,116 Q95,180 98,244 L102,244 Q99,180 101,118 Z', 0.05),
  ];
}

function velvetSheen(): Node[] {
  return [
    light('vel1', 'M90,130 Q120,118 150,140 Q120,132 92,148 Z', 0.05),
    light('vel2', 'M92,196 Q120,186 148,204 Q120,196 94,212 Z', 0.04),
  ];
}

function glowArt(cw: NormalizedFigure, uid: string): Node[] {
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

function suspenders(cw: NormalizedFigure): Node[] {
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

function tieDrop(cw: NormalizedFigure): Node[] {
  if (!cw.tie) return [];
  const c = safeHex(cw.tie);
  return [
    p('tie', 'M113,100 L127,100 L124,150 Q120,158 116,150 Z', c),
    ...sequinField('tie-s', 120, 126, 10, 50, 27, 22),
    shade('tie-sh', 'M123,102 L127,100 L124,150 Q122,155 120,156 Q123,130 123,102 Z', 0.18),
  ];
}

function fringeHip(cw: NormalizedFigure): Node[] {
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

function collar(cw: NormalizedFigure): Node[] {
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

function mockNeck(cw: NormalizedFigure, uid: string): Node[] {
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

function cowlScarf(cw: NormalizedFigure): Node[] {
  if (!cw.cowl) return [];
  const c = safeHex(cw.cowl);
  return [
    p('cw1', 'M98,96 Q120,84 142,96 Q145,104 142,112 Q120,124 98,112 Q95,104 98,96 Z', c),
    p(
      'cw2',
      'M100,106 Q120,96 140,106 Q142,112 140,118 Q120,128 100,118 Q98,112 100,106 Z',
      lightenHex(c, 0.12)
    ),
    shade('cw-s', 'M100,98 Q120,88 140,98 Q120,104 100,98 Z', 0.22),
    p('cw3', 'M136,110 Q148,130 144,152 L133,148 Q137,128 132,114 Z', darkenHex(c, 0.15)),
    shade('cw-t', 'M136,112 Q145,132 142,150 L139,149 Q141,130 134,114 Z', 0.15),
  ];
}

function crewNeck(cw: NormalizedFigure): Node[] {
  return [strokeP('crew', 'M107,97 Q120,108 133,97', darkenHex(safeHex(cw.jacket), 0.25), 3)];
}

function neckerchief(cw: NormalizedFigure): Node[] {
  if (!cw.scarf) return [];
  const c = safeHex(cw.scarf);
  return [
    p('sc', 'M104,96 Q120,104 136,96 L124,122 Q120,126 116,122 Z', c),
    shade('sc-s', 'M116,120 Q120,125 124,120 L121,113 L119,113 Z', 0.25),
    <rect key="sc-k" x="116.5" y="108" width="7" height="6" rx="1" fill={darkenHex(c, 0.3)} />,
  ];
}

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
    out.push(
      p(`${kp}-ga`, 'M61,212 L81,214 L84,248 Q70,255 56,247 Z', c),
      strokeP(`${kp}-gat`, 'M61,214 L81,216', darkenHex(c, 0.35), 2.2),
      shade(`${kp}-gas`, 'M76,215 L84,248 L78,251 L72,216 Z', 0.15)
    );
    if (a.gauntlet.sequin) out.push(...sequinField(`${kp}-gaq`, 70, 232, 22, 30, 3, 16));
  }
  const handC = a.glove ? safeHex(a.glove) : safeHex(cw.skin);
  out.push(
    p(`${kp}-hd`, 'M63,246 Q60,260 66,267 Q74,271 79,264 Q83,256 82,246 Q72,251 63,246 Z', handC),
    shade(`${kp}-hds`, 'M76,248 Q79,258 75,265 Q80,259 80,248 Z', 0.15)
  );
  return out;
}

function arms(cw: NormalizedFigure, uid: string): Node[] {
  return [...armSide(cw.armL, cw, uid, 'arL'), mirrored('arR', armSide(cw.armR, cw, uid, 'arR'))];
}

function epaulets(cw: NormalizedFigure): Node[] {
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

function belt(cw: NormalizedFigure): Node[] {
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

function chest(cw: NormalizedFigure): Node[] {
  const m = safeHex(cw.metal);
  switch (cw.chest) {
    case 'braid': {
      const c = safeHex(cw.braid);
      const out: Node[] = [];
      for (let i = 0; i < 5; i++) {
        const y = 126 + i * 17;
        const half = 21 + i * 1.2;
        out.push(
          strokeP(`br${i}`, `M${120 - half},${y} Q120,${y + 4} ${120 + half},${y}`, c, 2.4),
          <circle key={`br${i}-l`} cx={120 - half} cy={y} r="2.4" fill={c} />,
          <circle key={`br${i}-r`} cx={120 + half} cy={y} r="2.4" fill={c} />,
          <circle key={`br${i}-b`} cx="120" cy={y + 3.4} r="2.7" fill={m} />,
          <circle
            key={`br${i}-h`}
            cx="119.2"
            cy={y + 2.6}
            r="0.9"
            fill={FIGURE_INK.white}
            opacity=".85"
          />
        );
      }
      return out;
    }
    case 'sash': {
      const c = safeHex(cw.sash);
      const out: Node[] = [
        p('sa', 'M82,110 L102,102 L154,230 L136,242 Z', c),
        light('sa-l', 'M88,110 L96,107 L146,232 L140,236 Z', 0.16),
        shade('sa-s', 'M146,222 L154,230 L136,242 L131,232 Z', 0.18),
        strokeP(
          'sa-f',
          'M138,242 L136,254 M143,239 L142,252 M148,236 L148,249 M152,232 L154,245',
          c,
          2
        ),
      ];
      if (cw.sashSequin) out.push(...sequinField('sa-q', 118, 172, 26, 120, 11, 30));
      return out;
    }
    case 'baldric': {
      const c = safeHex(cw.baldric);
      const out: Node[] = [
        p('ba', 'M134,101 L158,109 L102,252 L82,242 Z', c),
        light('ba-l', 'M138,103 L146,106 L92,246 L86,243 Z', 0.1),
      ];
      if (cw.baldricSequin) out.push(...sequinField('ba-q', 120, 175, 30, 130, 5, 42));
      out.push(
        <circle key="ba-c" cx="144" cy="106" r="3.4" fill={m} />,
        <circle key="ba-cl" cx="143" cy="105" r="1.1" fill={FIGURE_INK.white} opacity=".8" />
      );
      return out;
    }
    case 'plastron': {
      const c = safeHex(cw.panel);
      const out: Node[] = [
        p('pl', 'M100,103 Q120,96 140,103 L147,180 Q120,190 93,180 Z', c),
        strokeP('pl-t', 'M100,103 L93,180 M140,103 L147,180', safeHex(cw.panelTrim), 2),
      ];
      for (let i = 0; i < 4; i++) {
        const y = 114 + i * 19;
        out.push(
          <circle key={`pl-l${i}`} cx={101 - i * 1.4} cy={y} r="2.4" fill={m} />,
          <circle key={`pl-r${i}`} cx={139 + i * 1.4} cy={y} r="2.4" fill={m} />
        );
      }
      return out;
    }
    case 'buttons': {
      const out: Node[] = [];
      for (let i = 0; i < 5; i++) {
        const y = 122 + i * 24;
        out.push(
          <circle key={`bu-l${i}`} cx="108" cy={y} r="3" fill={m} />,
          <circle
            key={`bu-lh${i}`}
            cx="107"
            cy={y - 1}
            r="1"
            fill={FIGURE_INK.white}
            opacity=".8"
          />,
          <circle key={`bu-r${i}`} cx="132" cy={y} r="3" fill={m} />,
          <circle
            key={`bu-rh${i}`}
            cx="131"
            cy={y - 1}
            r="1"
            fill={FIGURE_INK.white}
            opacity=".8"
          />
        );
      }
      return out;
    }
    case 'swash': {
      const c = safeHex(cw.swash);
      return [
        p(
          'sw',
          'M148,98 Q118,148 98,198 Q90,226 90,256 L110,256 Q106,220 120,180 Q136,140 162,110 L158,100 Z',
          c
        ),
        light('sw-l', 'M150,102 Q126,140 112,180 L108,180 Q124,138 147,100 Z', 0.18),
        ...sequinField('sw-q', 120, 180, 40, 140, 9, 40),
      ];
    }
    case 'vinylPanel': {
      const c = safeHex(cw.panel);
      return [
        p('vp', 'M96,103 Q120,95 144,103 L150,196 Q120,206 90,196 Z', c),
        strokeP('vp-z', 'M120,100 L120,200', FIGURE_INK.zipper, 1.6),
        <circle key="vp-zp" cx="120" cy="112" r="2.2" fill={FIGURE_INK.zipper} />,
        light('vp-l1', 'M101,108 Q99,150 101,192 L108,194 Q104,150 107,110 Z', 0.28),
        light('vp-l2', 'M134,106 Q137,148 136,190 L140,189 Q142,148 138,108 Z', 0.12),
        strokeP(
          'vp-t',
          'M96,103 L90,196 M144,103 L150,196',
          safeHex(cw.panelTrim || FIGURE_INK.visor),
          2
        ),
      ];
    }
    default:
      return [];
  }
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
  const layers: Node[] = [<Defs key="defs" cw={cw} uid={uid} />, ...ground()];
  if (flared) layers.push(<g key="shoes">{shoes(cw)}</g>);
  layers.push(<g key="legs">{legs(cw, uid)}</g>);
  layers.push(<g key="swl">{swashLeg(cw)}</g>);
  layers.push(<g key="stream">{streamers(cw)}</g>);
  if (!flared) layers.push(<g key="shoes">{shoes(cw)}</g>);
  layers.push(<g key="torso">{torso(cw, uid)}</g>);
  if (cw.satin) layers.push(<g key="satin">{satinSheen()}</g>);
  if (cw.velvet) layers.push(<g key="velvet">{velvetSheen()}</g>);
  layers.push(
    <g key="chest">{chest(cw)}</g>,
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

export interface UniformFigureProps {
  figure: FigureConfig;
  /** Accessible description, e.g. "Blue Stars identity uniform". */
  label: string;
  /** CSS width; the figure scales via its viewBox. */
  width?: number | string;
  style?: React.CSSProperties;
}

/**
 * The renderable corps figure. Pure and deterministic: same design in, same
 * SVG out — safe to render at avatar size, editor size, or export size.
 */
const UniformFigure = forwardRef<SVGSVGElement, UniformFigureProps>(function UniformFigure(
  { figure, label, width = '100%', style },
  ref
) {
  const reactId = useId();
  // useId() emits colons, which are invalid inside url(#…) references.
  const uid = useMemo(() => `uf${reactId.replace(/[^a-zA-Z0-9]/g, '')}`, [reactId]);
  const layers = useMemo(() => figureLayers(figure, uid), [figure, uid]);
  return (
    <svg
      ref={ref}
      viewBox={FIGURE_VIEWBOX}
      width={width}
      style={style}
      role="img"
      aria-label={label}
      xmlns="http://www.w3.org/2000/svg"
    >
      {layers}
    </svg>
  );
});

export default React.memo(UniformFigure);
