import { describe, expect, it } from 'vitest';
import {
  applyColorway,
  armFadeStops,
  darkenHex,
  designWithinLimits,
  isHexColor,
  lightenHex,
  migrateV1Design,
  normalizeFigure,
  normalizeUniformCode,
  printColorDefaults,
  printColorValues,
  proseColorToHex,
  resolvePrintPalettes,
  safeHex,
  withArmFade,
} from './uniform';
import { UNIFORM_PRESETS, designFromPreset, getUniformPreset } from '../data/uniformCatalog';
import type { CorpsUniformDesign } from '../types';

describe('color math', () => {
  it('validates hex colors strictly', () => {
    expect(isHexColor('#6d1a26')).toBe(true);
    expect(isHexColor('#FFF')).toBe(false);
    expect(isHexColor('crimson')).toBe(false);
    expect(isHexColor('url:opart')).toBe(false);
    expect(isHexColor(undefined)).toBe(false);
  });

  it('safeHex falls back on invalid input and lowercases valid input', () => {
    expect(safeHex('#ABCDEF')).toBe('#abcdef');
    expect(safeHex('javascript:alert(1)')).toBe('#888888');
    expect(safeHex(null)).toBe('#888888');
  });

  it('darken/lighten stay in range and are monotonic', () => {
    expect(darkenHex('#ffffff', 0.5)).toBe('#808080');
    expect(lightenHex('#000000', 0.5)).toBe('#808080');
    expect(darkenHex('#6d1a26', 0)).toBe('#6d1a26');
  });
});

describe('normalizeFigure', () => {
  it('expands legacy symmetric shorthands into per-side configs', () => {
    const n = normalizeFigure({
      skin: '#c9a074',
      jacket: '#6d1a26',
      gauntlet: '#f2ede2',
      gauntletSequin: true,
      glove: '#f5f2ea',
      pants: '#ece2cc',
      stripe: '#6d1a26',
    });
    expect(n.armL.type).toBe('sleeve');
    expect(n.armL.color).toBe('#6d1a26');
    expect(n.armL.gauntlet).toEqual({ color: '#f2ede2', sequin: true });
    expect(n.armR).toEqual(n.armL);
    expect(n.legL).toEqual({ color: '#ece2cc', stripe: '#6d1a26' });
    expect(n.legR).toEqual(n.legL);
  });

  it('leaves explicit per-side configs untouched', () => {
    const n = normalizeFigure({
      skin: '#c9a074',
      armL: { type: 'bare' },
      armR: { type: 'sleeve', fill: 'url:ombre' },
      legL: { color: '#caa64e', foil: true },
      legR: { color: '#17161c' },
    });
    expect(n.armL.type).toBe('bare');
    expect(n.armR.fill).toBe('url:ombre');
    expect(n.legL.foil).toBe(true);
    expect(n.legR.color).toBe('#17161c');
  });
});

describe('uniform code normalization', () => {
  it('accepts any casing, spacing, and missing dashes', () => {
    expect(normalizeUniformCode('MA-7K3F-Q2')).toBe('MA-7K3F-Q2');
    expect(normalizeUniformCode('  ma-7k3f-q2 ')).toBe('MA-7K3F-Q2');
    expect(normalizeUniformCode('MA7K3FQ2')).toBe('MA-7K3F-Q2');
    expect(normalizeUniformCode('ma 7k3f q2')).toBe('MA-7K3F-Q2');
  });

  it('rejects malformed or ambiguous codes', () => {
    expect(normalizeUniformCode('MA-0OIL-1I')).toBeNull(); // ambiguous glyphs
    expect(normalizeUniformCode('XX-7K3F-Q2')).toBeNull();
    expect(normalizeUniformCode('MA-7K3F')).toBeNull();
    expect(normalizeUniformCode('')).toBeNull();
  });
});

describe('sleeve fades', () => {
  it('writes per-side fade gradients and points the sleeve fills at them', () => {
    const faded = withArmFade(
      { skin: '#c9a074', jacket: '#1d2f66' },
      'armL',
      ['#1d2f66', '#e3b23c'],
      true // linked → both sides
    );
    expect(faded.grads?.fadeL).toEqual([
      ['0', '#1d2f66'],
      ['1', '#e3b23c'],
    ]);
    expect(faded.grads?.fadeR).toEqual(faded.grads?.fadeL);
    expect(faded.armL?.fill).toBe('url:fadeL');
    expect(faded.armR?.fill).toBe('url:fadeR');
    expect(armFadeStops(faded, 'armL')).toEqual(['#1d2f66', '#e3b23c']);
    expect(armFadeStops(faded, 'armR')).toEqual(['#1d2f66', '#e3b23c']);
  });

  it('clears a fade and its gradient without touching other grads', () => {
    const base = {
      skin: '#c9a074',
      grads: {
        ombre: [
          ['0', '#111111'],
          ['1', '#222222'],
        ] as Array<[string, string]>,
      },
    };
    const on = withArmFade(base, 'armL', ['#334455', '#667788'], false);
    expect(on.grads?.ombre).toBeDefined();
    expect(armFadeStops(on, 'armR')).toBeNull(); // unlinked: right untouched
    const off = withArmFade(on, 'armL', null, false);
    expect(off.grads?.fadeL).toBeUndefined();
    expect(off.grads?.ombre).toBeDefined();
    expect(off.armL?.fill).toBeNull();
    expect(armFadeStops(off, 'armL')).toBeNull();
  });

  it('sanitizes junk fade colors', () => {
    const faded = withArmFade({ skin: '#c9a074' }, 'armR', ['garbage', '#eeeeee'], false);
    expect(faded.grads?.fadeR?.[0][1]).toBe('#888888');
  });
});

describe('print color resolution', () => {
  it('returns the stock palettes byte-for-byte when nothing is overridden', () => {
    const pal = resolvePrintPalettes({});
    expect(pal.sunburst.stops[0]).toEqual(['0', '#f7dd7a']);
    expect(pal.sunburst.ray).toBe('#f7dd7a');
    expect(pal.opart.wave).toBe('#f9e8a0');
    expect(pal.pinstripe).toEqual({ bg: '#efe3c8', stripe: '#d3bd90' });
    expect(pal.plaid.bandC).toBe('#8f5f10');
    expect(pal.foil.stops).toHaveLength(4);
  });

  it('rebuilds each surface, derived shades included, from overridden slots', () => {
    const pal = resolvePrintPalettes({
      printColors: {
        sunburst: ['#112233', '#445566', '#778899'],
        opart: ['#204020', '#80c080', '#103010'],
        pinstripe: ['#101018', '#c0c0d0'],
        plaid: ['#222a44', '#4a5a8a', '#c8d0e8'],
        foil: ['#8a2a3a', '#f0c0c8'],
      },
    });
    expect(pal.sunburst.stops.map(([, c]) => c).slice(0, 3)).toEqual([
      '#112233',
      '#445566',
      '#778899',
    ]);
    expect(pal.sunburst.stops[3][1]).toBe(darkenHex('#778899', 0.5));
    expect(pal.sunburst.ray).toBe('#112233');
    expect(pal.opart).toEqual({
      bg: '#204020',
      dotA: '#80c080',
      dotB: '#103010',
      wave: lightenHex('#204020', 0.6),
    });
    expect(pal.pinstripe).toEqual({ bg: '#101018', stripe: '#c0c0d0' });
    expect(pal.plaid.bandC).toBe(darkenHex('#4a5a8a', 0.25));
    expect(pal.foil.stops[2][1]).toBe('#8a2a3a');
    expect(pal.foil.stops[1][1]).toBe('#f0c0c8');
  });

  it('printColorValues merges overrides over defaults and sanitizes junk', () => {
    expect(printColorValues({ skin: '#c9a074' }, 'plaid')).toEqual(printColorDefaults('plaid'));
    const partial = printColorValues(
      { skin: '#c9a074', printColors: { sunburst: ['#112233', 'garbage'] } },
      'sunburst'
    );
    expect(partial[0]).toBe('#112233');
    expect(partial[1]).toBe(printColorDefaults('sunburst')[1]); // junk → default
    expect(partial[2]).toBe(printColorDefaults('sunburst')[2]); // missing → default
  });
});

describe('applyColorway', () => {
  const cw = {
    primary: '#1d2f66',
    secondary: '#cfd4da',
    accent: '#dfe6f2',
    metal: 'silver' as const,
  };

  it('re-skins base garments, trim, and hardware from the palette', () => {
    const preset = getUniformPreset('classic-cadet');
    expect(preset).toBeDefined();
    const out = applyColorway(preset!.figure, cw);
    expect(out.jacket).toBe('#1d2f66');
    expect(out.braid).toBe('#cfd4da');
    expect(out.plume?.color).toBe('#dfe6f2');
    expect(out.metal).toBe('#cfd4da');
    // pants take a deep shade of primary for silhouette contrast
    expect(out.legL?.color).toBe(darkenHex('#1d2f66', 0.45));
  });

  it('never recolors print fills or per-side layout', () => {
    const preset = getUniformPreset('radial-burst');
    const out = applyColorway(preset!.figure, cw);
    expect(out.torsoFill).toBe('url:sun');
    expect(out.armL?.type).toBe('bare');
    expect(out.armR?.detached).toBe(true);
    expect(out.legL?.fill).toBe('url:foil');
  });
});

describe('v1 → v2 migration', () => {
  it('resolves prose colors through the name map', () => {
    expect(proseColorToHex('crimson red')).toBe('#b3121c');
    expect(proseColorToHex('Deep Midnight Blue trim')).toBe('#101c33');
    expect(proseColorToHex('the color of victory')).toBeNull();
    expect(proseColorToHex(undefined)).toBeNull();
  });

  it('builds a renderable draft from a v1 prose design', () => {
    const v1: CorpsUniformDesign = {
      primaryColor: 'crimson red',
      secondaryColor: 'silver',
      style: 'traditional',
      helmetStyle: 'aussie',
      mascotOrEmblem: 'phoenix',
      themeKeywords: ['fire'],
    };
    const out = migrateV1Design(v1, 'Ashline Cadets');
    expect(out.schema).toBe(2);
    expect(out.colorway.primary).toBe('#b3121c');
    expect(out.colorway.metal).toBe('silver');
    // v1 'aussie' now migrates to the real aussie slouch (was campaign
    // before the hat existed)
    expect(out.figure.hatType).toBe('aussie');
    expect(out.figure.jacket).toBe('#b3121c');
    expect(out.aiHints?.mascotOrEmblem).toBe('phoenix');
    expect(out.name).toContain('Ashline Cadets');
  });

  it('survives an empty v1 design with preset defaults', () => {
    const out = migrateV1Design(undefined);
    expect(out.schema).toBe(2);
    expect(out.figure.jacket).toBeTruthy();
  });
});

describe('presets and limits', () => {
  it('ships twelve presets across both eras', () => {
    // 11 at launch + Millennium (the 2000s bridge, added on player feedback)
    expect(UNIFORM_PRESETS).toHaveLength(12);
    expect(UNIFORM_PRESETS.filter((p) => p.era === 'classic')).toHaveLength(5);
    expect(UNIFORM_PRESETS.filter((p) => p.era === 'modern')).toHaveLength(7);
    const ids = new Set(UNIFORM_PRESETS.map((p) => p.id));
    expect(ids.size).toBe(12);
  });

  it('every preset yields a design within the payload limits', () => {
    for (const preset of UNIFORM_PRESETS) {
      const design = designFromPreset(preset);
      expect(designWithinLimits(design), preset.id).toBe(true);
    }
  });

  it('designFromPreset deep-copies so edits never mutate the catalog', () => {
    const preset = getUniformPreset('classic-cadet')!;
    const design = designFromPreset(preset, 'My Look');
    design.figure.jacket = '#000000';
    expect(preset.figure.jacket).toBe('#6d1a26');
    expect(design.name).toBe('My Look');
  });
});
