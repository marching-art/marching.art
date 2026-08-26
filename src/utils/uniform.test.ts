import { describe, expect, it } from 'vitest';
import {
  applyColorway,
  darkenHex,
  designWithinLimits,
  isHexColor,
  lightenHex,
  migrateV1Design,
  normalizeFigure,
  proseColorToHex,
  safeHex,
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
    expect(out.figure.hatType).toBe('campaign');
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
  it('ships eleven presets across both eras', () => {
    expect(UNIFORM_PRESETS).toHaveLength(11);
    expect(UNIFORM_PRESETS.filter((p) => p.era === 'classic')).toHaveLength(5);
    expect(UNIFORM_PRESETS.filter((p) => p.era === 'modern')).toHaveLength(6);
    const ids = new Set(UNIFORM_PRESETS.map((p) => p.id));
    expect(ids.size).toBe(11);
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
