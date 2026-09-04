// =============================================================================
// UNIFORM FIGURE PARTS — chest treatments
// =============================================================================
// The chest layer builder (braid, sash, baldric, plastron, buttons, swash,
// vinyl panel). Split from uniformFigureParts.tsx so that file stays under the
// max-lines guardrail; see UniformFigure.tsx for the architecture notes.

import React from 'react';
import { darkenHex, safeHex, type NormalizedFigure } from '../../utils/uniform';
import { FIGURE_INK } from '../../data/uniformRenderTheme';
import { light, mirrored, p, sequinField, shade, strokeP, type Node } from './uniformFigureParts';

export function chest(cw: NormalizedFigure, uid: string): Node[] {
  const m = safeHex(cw.metal);
  // Buttons take their own color when set; hardware metal otherwise.
  const btn = cw.buttonColor ? safeHex(cw.buttonColor) : m;
  // Diagonal treatments (sash/baldric/swash) can run the other shoulder:
  // the figure centers on x=120, so the standard mirror flips the diagonal.
  const flip = (key: string, nodes: Node[]): Node[] =>
    cw.chestReverse ? [mirrored(key, nodes)] : nodes;
  // Band fill: the director's chest fade when set, else the solid color.
  const bandFill = (solid: string | null | undefined): string =>
    cw.chestFade ? `url(#${uid}-fadeChest)` : safeHex(solid);
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
          <circle key={`br${i}-b`} cx="120" cy={y + 3.4} r="2.7" fill={btn} />,
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
      const c = bandFill(cw.sash);
      if (cw.chestShape === 'triangles') {
        // Star-'93 blade: a curved triangle sweeping shoulder → waist point,
        // with a nested inner triangle and a metal trim edge.
        const out: Node[] = [
          p('sa-tb', 'M112,99 L82,111 Q100,170 144,238 Q130,164 112,99 Z', c),
          p(
            'sa-ti',
            'M107,105 L89,112 Q105,165 136,220 Q123,162 107,105 Z',
            darkenHex(safeHex(cw.sash), 0.45)
          ),
          strokeP('sa-te', 'M82,111 Q100,170 144,238', m, 1.8),
        ];
        if (cw.sashSequin) out.push(...sequinField('sa-q', 118, 172, 26, 120, 11, 30));
        return flip('sa-r', out);
      }
      if (cw.chestShape === 'tapered') {
        const out: Node[] = [
          p('sa', 'M82,110 L102,102 L150,233 L140,239 Z', c),
          light('sa-l', 'M88,110 L96,107 L144,234 L140,237 Z', 0.16),
        ];
        if (cw.sashSequin) out.push(...sequinField('sa-q', 118, 172, 26, 120, 11, 30));
        return flip('sa-r', out);
      }
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
      return flip('sa-r', out);
    }
    case 'baldric': {
      const c = bandFill(cw.baldric);
      if (cw.chestShape === 'triangles') {
        // Star-'93 blade; the two-tone center color drives the inner triangle.
        const inner = cw.baldricCenter
          ? safeHex(cw.baldricCenter)
          : darkenHex(safeHex(cw.baldric), 0.45);
        const out: Node[] = [
          p('ba-tb', 'M128,99 L158,111 Q140,170 96,238 Q110,164 128,99 Z', c),
          p('ba-ti', 'M133,105 L151,112 Q135,165 104,220 Q117,162 133,105 Z', inner),
          strokeP('ba-te', 'M158,111 Q140,170 96,238', m, 1.8),
        ];
        if (cw.baldricSequin) out.push(...sequinField('ba-q', 120, 175, 30, 130, 5, 42));
        return flip('ba-r', out);
      }
      if (cw.chestShape === 'tapered') {
        const out: Node[] = [
          p('ba', 'M134,101 L158,109 L97,250 L88,246 Z', c),
          light('ba-l', 'M138,103 L146,106 L94,247 L90,245 Z', 0.1),
        ];
        if (cw.baldricSequin) out.push(...sequinField('ba-q', 120, 175, 30, 130, 5, 42));
        out.push(
          <circle key="ba-c" cx="144" cy="106" r="3.4" fill={m} />,
          <circle key="ba-cl" cx="143" cy="105" r="1.1" fill={FIGURE_INK.white} opacity=".8" />
        );
        return flip('ba-r', out);
      }
      const out: Node[] = [p('ba', 'M134,101 L158,109 L102,252 L82,242 Z', c)];
      if (cw.baldricCenter) {
        // Two-tone: a center stripe inset ~30% from each band edge.
        out.push(
          p('ba-ct', 'M141.2,103.4 L150.8,106.6 L96,249 L88,245 Z', safeHex(cw.baldricCenter))
        );
      }
      out.push(light('ba-l', 'M138,103 L146,106 L92,246 L86,243 Z', 0.1));
      if (cw.baldricSequin) out.push(...sequinField('ba-q', 120, 175, 30, 130, 5, 42));
      out.push(
        <circle key="ba-c" cx="144" cy="106" r="3.4" fill={m} />,
        <circle key="ba-cl" cx="143" cy="105" r="1.1" fill={FIGURE_INK.white} opacity=".8" />
      );
      return flip('ba-r', out);
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
          <circle key={`bu-l${i}`} cx="108" cy={y} r="3" fill={btn} />,
          <circle
            key={`bu-lh${i}`}
            cx="107"
            cy={y - 1}
            r="1"
            fill={FIGURE_INK.white}
            opacity=".8"
          />,
          <circle key={`bu-r${i}`} cx="132" cy={y} r="3" fill={btn} />,
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
      if (cw.swashTop === false) return []; // director kept only the leg part
      const c = bandFill(cw.swash);
      return flip('sw-r', [
        p(
          'sw',
          'M148,98 Q118,148 98,198 Q90,226 90,256 L110,256 Q106,220 120,180 Q136,140 162,110 L158,100 Z',
          c
        ),
        light('sw-l', 'M150,102 Q126,140 112,180 L108,180 Q124,138 147,100 Z', 0.18),
        // sequins default on (the launch look) but are the director's call
        ...(cw.swashSequin === false ? [] : sequinField('sw-q', 120, 180, 40, 140, 9, 40)),
      ]);
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
