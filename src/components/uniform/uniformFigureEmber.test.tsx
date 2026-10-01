// Ember Glass pack (Kiln & Lantern): the ember glass print, the swept yoke
// and the printed hat front panel — rendered, derived, re-skinned, and gated
// consistently on the client.
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import UniformFigure from './UniformFigure';
import type { FigureConfig } from '../../types/uniform';
import {
  applyColorway,
  hatShowsPanel,
  mixHex,
  resolvePrintPalettes,
  withDerivedFlags,
} from '../../utils/uniform';
import { missingPacksFor, requiredPacksFor, usesEmberGlass } from '../../utils/uniformPacks';

const K = '#111114';
const BASE: FigureConfig = { skin: '#e0b48e', jacket: K, hatType: 'shako', hat: { body: K } };

/** The lit stained-glass look: ember coat + sleeve, piped yoke, printed shako. */
const LANTERN: FigureConfig = withDerivedFlags({
  ...BASE,
  torsoFill: 'url:ember',
  chest: 'yoke',
  yoke: K,
  yokePiping: '#f4f2ec',
  armL: { type: 'sleeve', color: K, glove: K },
  armR: { type: 'sleeve', fill: 'url:ember', glove: K },
  hat: { body: K, panel: 'url:ember', ornament: 'none' },
  plume: { type: 'upright', color: '#f4f2ec' },
});

describe('Ember Glass rendering', () => {
  it('draws nothing extra for a plain figure', () => {
    const { container } = render(<UniformFigure label="plain" figure={withDerivedFlags(BASE)} />);
    expect(container.querySelector('pattern[id$="-ember"]')).toBeNull();
    expect(container.querySelector('pattern[id$="-emberSm"]')).toBeNull();
    expect(container.querySelector('clipPath[id$="-hpc"]')).toBeNull();
  });

  it('renders the full lit-glass look', () => {
    const { container } = render(<UniformFigure label="lantern" figure={LANTERN} />);
    // both print scales, built on the flame base with black lead came
    const pattern = container.querySelector('pattern[id$="-ember"]');
    expect(pattern).not.toBeNull();
    expect(pattern!.querySelector('rect')!.getAttribute('fill')).toBe('#e2540f');
    expect(pattern!.querySelectorAll('path[stroke="#111114"]').length).toBeGreaterThan(20);
    expect(container.querySelector('pattern[id$="-emberSm"]')).not.toBeNull();
    expect(container.querySelector('radialGradient[id$="-emberHeart"]')).not.toBeNull();
    // torso + right sleeve wear the garment scale; the hat panel the fine one
    const uid = pattern!.id.replace(/-ember$/, '');
    expect(container.querySelectorAll(`path[fill="url(#${uid}-ember)"]`)).toHaveLength(2);
    expect(container.querySelectorAll(`path[fill="url(#${uid}-emberSm)"]`)).toHaveLength(1);
    // the yoke body and its piping band
    expect(container.querySelectorAll('path[stroke="#f4f2ec"]')).toHaveLength(1);
    expect(container.querySelector('clipPath[id$="-hpc"]')).not.toBeNull();
  });

  it('recolors the print from printColors', () => {
    const figure = withDerivedFlags({
      ...LANTERN,
      printColors: { ember: ['#1d3fbf', '#5fd0e8', '#f4f2ec'] },
    });
    const { container } = render(<UniformFigure label="blue glass" figure={figure} />);
    const pattern = container.querySelector('pattern[id$="-ember"]');
    expect(pattern!.querySelector('rect')!.getAttribute('fill')).toBe('#1d3fbf');
    expect(pattern!.querySelectorAll('path[stroke="#f4f2ec"]').length).toBeGreaterThan(20);
    const pal = resolvePrintPalettes(figure).ember;
    expect(pal.mid).toBe(mixHex('#1d3fbf', '#5fd0e8', 0.5));
  });

  it('mirrors the yoke with chestReverse and drops the piping when cleared', () => {
    const { container } = render(
      <UniformFigure
        label="reversed"
        figure={withDerivedFlags({ ...LANTERN, chestReverse: true, yokePiping: null })}
      />
    );
    expect(container.querySelectorAll('path[stroke="#f4f2ec"]')).toHaveLength(0);
    expect(
      container.querySelector('g[transform="translate(240,0) scale(-1,1)"] path')
    ).not.toBeNull();
  });

  it('draws the hat panel only on a hat with a front face', () => {
    for (const hatType of ['shako', 'pith', 'contour'] as const) {
      const fig = withDerivedFlags({ ...BASE, hatType, hat: { body: K, panel: '#e2540f' } });
      const { container } = render(<UniformFigure label={hatType} figure={fig} />);
      expect(container.querySelectorAll('path[fill="#e2540f"]')).toHaveLength(1);
    }
    for (const hatType of ['campaign', 'aussie', 'busby'] as const) {
      const fig = withDerivedFlags({ ...BASE, hatType, hat: { body: K, panel: 'url:ember' } });
      expect(hatShowsPanel(fig)).toBe(false);
      // an invisible panel neither defines the print nor needs the pack
      expect(fig.ember).toBe(false);
      expect(requiredPacksFor(fig)).not.toContain('pack_ember_glass');
      const { container } = render(<UniformFigure label={hatType} figure={fig} />);
      expect(container.querySelector('clipPath[id$="-hpc"]')).toBeNull();
    }
  });
});

describe('Ember Glass derivation, re-skin and gate', () => {
  it('defines the print for any surface that wears it, including the hat panel', () => {
    expect(withDerivedFlags({ ...BASE, torsoFill: 'url:ember' }).ember).toBe(true);
    expect(withDerivedFlags({ ...BASE, legL: { fill: 'url:ember' } }).ember).toBe(true);
    expect(withDerivedFlags({ ...BASE, hat: { body: K, panel: 'url:ember' } }).ember).toBe(true);
    expect(
      withDerivedFlags({ ...LANTERN, torsoFill: null, armR: { type: 'sleeve' }, hat: { body: K } })
        .ember
    ).toBe(false);
  });

  it('re-skins the yoke, piping and a solid hat panel, keeping a printed panel', () => {
    const cw = {
      primary: '#6d1a26',
      secondary: '#d9a41c',
      accent: '#ece2cc',
      metal: 'gold' as const,
    };
    const solid = applyColorway({ ...LANTERN, hat: { body: K, panel: '#e2540f' } }, cw);
    expect(solid.yokePiping).toBe('#ece2cc');
    expect(solid.yoke).not.toBe(K);
    expect(solid.hat?.panel).toBe('#d9a41c');
    expect(applyColorway(LANTERN, cw).hat?.panel).toBe('url:ember');
  });

  it('gates every piece on pack_ember_glass', () => {
    expect(usesEmberGlass(withDerivedFlags(BASE))).toBe(false);
    expect(requiredPacksFor(LANTERN)).toEqual(['pack_ember_glass']);
    expect(requiredPacksFor({ ...BASE, chest: 'yoke', yoke: K })).toEqual(['pack_ember_glass']);
    expect(requiredPacksFor({ ...BASE, hat: { body: K, panel: '#e2540f' } })).toEqual([
      'pack_ember_glass',
    ]);
    // another house's print on the hat panel needs both houses
    expect(requiredPacksFor({ ...BASE, hat: { body: K, panel: 'url:shatter' } }).sort()).toEqual([
      'pack_ember_glass',
      'pack_prism_forge',
    ]);
    expect(missingPacksFor(LANTERN, ['pack_ember_glass'])).toEqual([]);
    expect(missingPacksFor(LANTERN, [])[0].house).toBe('Kiln & Lantern');
  });
});
