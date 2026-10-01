// Prism Forge pack (Lumen & Vane): the split-panel torso, the shatter print,
// the light streak, glow cuffs/hems, knee plates and seams — rendered, derived,
// re-skinned, and gated consistently on the client.
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import UniformFigure from './UniformFigure';
import type { FigureConfig } from '../../types/uniform';
import { applyColorway, withDerivedFlags } from '../../utils/uniform';
import { requiredPacksFor } from '../../utils/uniformPacks';

const BASE: FigureConfig = { skin: '#c9a074', jacket: '#16181d', hatType: 'shako' };

/** The "light-cut" concept: crackle half, silver half, glowing slash + hems. */
const LIGHT_CUT: FigureConfig = withDerivedFlags({
  ...BASE,
  torsoFill: 'url:shatter',
  printColors: { shatter: ['#16181d', '#aeb6c2'] },
  torsoSplit: { color: '#c3c9d1' },
  chest: 'streak',
  streak: '#7cc4ff',
  chestFade: ['#7cc4ff', '#f2c14e'],
  armL: { type: 'sleeve', fill: 'url:shatter', cuffGlow: ['#7cc4ff', '#f2c14e'], glove: '#101013' },
  armR: { type: 'sleeve', color: '#c3c9d1', cuffGlow: ['#7cc4ff', '#f2c14e'], glove: '#101013' },
  legL: {
    color: '#2a2d33',
    seams: '#aeb6c2',
    kneePlate: '#cfd4da',
    hemGlow: ['#7cc4ff', '#f2c14e'],
  },
  legR: {
    color: '#2a2d33',
    seams: '#aeb6c2',
    kneePlate: '#cfd4da',
    hemGlow: ['#7cc4ff', '#f2c14e'],
  },
});

describe('Prism Forge rendering', () => {
  it('draws nothing extra for a plain figure', () => {
    const { container } = render(<UniformFigure label="plain" figure={BASE} />);
    expect(container.querySelector('pattern[id$="-shatter"]')).toBeNull();
    expect(container.querySelector('filter')).toBeNull();
    expect(container.querySelectorAll('linearGradient[id$="-hg"]')).toHaveLength(0);
  });

  it('renders the full light-cut look', () => {
    const { container } = render(<UniformFigure label="light cut" figure={LIGHT_CUT} />);
    // the shatter crack print, recolored from printColors
    const pattern = container.querySelector('pattern[id$="-shatter"]');
    expect(pattern).not.toBeNull();
    expect(pattern!.querySelector('rect')!.getAttribute('fill')).toBe('#16181d');
    expect(pattern!.querySelectorAll('path[stroke="#aeb6c2"]').length).toBeGreaterThan(0);
    // exactly one glow filter, whichever module defines it
    expect(container.querySelectorAll('filter[id$="-glow"]')).toHaveLength(1);
    // the split panel in its own color, under the streak
    expect(container.querySelectorAll('path[fill="#c3c9d1"]').length).toBeGreaterThan(0);
    // the streak blade wears the chest fade; its core is near-white
    expect(container.querySelector('linearGradient[id$="-fadeChest"]')).not.toBeNull();
    expect(container.querySelectorAll('path[stroke="#fbfbf4"]').length).toBeGreaterThan(0);
    // one cuff + one hem gradient per side
    expect(container.querySelectorAll('linearGradient[id$="-cg"]')).toHaveLength(2);
    expect(container.querySelectorAll('linearGradient[id$="-hg"]')).toHaveLength(2);
    // knee plates and seams
    expect(container.querySelectorAll('path[fill="#cfd4da"]')).toHaveLength(2);
    expect(container.querySelectorAll('path[stroke="#aeb6c2"]').length).toBeGreaterThan(2);
  });

  it('defines the glow filter once even with glow line-art on too', () => {
    const figure = withDerivedFlags({ ...LIGHT_CUT, glowArt: '#4fc3ff' });
    const { container } = render(<UniformFigure label="both glows" figure={figure} />);
    expect(container.querySelectorAll('filter[id$="-glow"]')).toHaveLength(1);
  });

  it('never draws a glow cuff on a half sleeve or a bare arm', () => {
    const figure = withDerivedFlags({
      ...BASE,
      armL: { type: 'half', cuffGlow: ['#7cc4ff', '#f2c14e'] },
      armR: { type: 'bare', cuffGlow: ['#7cc4ff', '#f2c14e'] },
    });
    const { container } = render(<UniformFigure label="half" figure={figure} />);
    expect(container.querySelectorAll('linearGradient[id$="-cg"]')).toHaveLength(0);
    expect(requiredPacksFor(figure)).toEqual([]);
  });

  it('mirrors the split panel and the streak independently', () => {
    const flipped = withDerivedFlags({
      ...LIGHT_CUT,
      torsoSplit: { color: '#c3c9d1', flip: true },
      chestReverse: true,
    });
    const a = render(<UniformFigure label="a" figure={LIGHT_CUT} />);
    const b = render(<UniformFigure label="b" figure={flipped} />);
    const mirrorsIn = (el: HTMLElement) =>
      el.querySelectorAll('g[transform="translate(240,0) scale(-1,1)"]').length;
    expect(mirrorsIn(b.container)).toBe(mirrorsIn(a.container) + 2);
  });
});

describe('Prism Forge derived flags and colorway', () => {
  it('defines shatter only while something references it', () => {
    expect(withDerivedFlags({ ...BASE, torsoFill: 'url:shatter' }).shatter).toBe(true);
    expect(
      withDerivedFlags({ ...BASE, torsoSplit: { color: '#c3c9d1', fill: 'url:shatter' } }).shatter
    ).toBe(true);
    expect(withDerivedFlags({ ...BASE, legL: { fill: 'url:shatter' } }).shatter).toBe(true);
    expect(withDerivedFlags({ ...BASE, shatter: true }).shatter).toBe(false);
  });

  it('turns the glow filter on for the streak, cuffs and hems', () => {
    expect(withDerivedFlags({ ...BASE, chest: 'streak' }).glow).toBe(true);
    expect(withDerivedFlags({ ...BASE, legL: { hemGlow: ['#111111', '#222222'] } }).glow).toBe(
      true
    );
    expect(withDerivedFlags(BASE).glow).toBe(false);
  });

  it('re-skins every Prism piece from the colorway', () => {
    const cw = {
      primary: '#101c33',
      secondary: '#4fc3ff',
      accent: '#e8c25a',
      metal: 'gold' as const,
    };
    const out = applyColorway(LIGHT_CUT, cw);
    expect(out.streak).toBe('#4fc3ff');
    expect(out.torsoSplit).toMatchObject({ color: '#4fc3ff' });
    expect(out.armL?.cuffGlow).toEqual(['#4fc3ff', '#e8c25a']);
    expect(out.legR?.hemGlow).toEqual(['#4fc3ff', '#e8c25a']);
    expect(out.legL?.kneePlate).toBe('#d9a41c');
    expect(out.legL?.seams).toBe('#d9a41c');
  });
});

describe('Prism Forge gating (client mirror)', () => {
  it('gates every Prism piece and nothing else', () => {
    const cases: FigureConfig[] = [
      { ...BASE, torsoFill: 'url:shatter' },
      { ...BASE, mockNeck: 'url:shatter' },
      { ...BASE, torsoSplit: { color: '#c3c9d1' } },
      { ...BASE, chest: 'streak' },
      { ...BASE, armL: { type: 'sleeve', cuffGlow: ['#111111', '#222222'] } },
      { ...BASE, armR: { type: 'sleeve', fill: 'url:shatter' } },
      { ...BASE, legL: { hemGlow: ['#111111', '#222222'] } },
      { ...BASE, legR: { kneePlate: '#cfd4da' } },
      { ...BASE, legL: { seams: '#cfd4da' } },
      { ...BASE, legR: { fill: 'url:shatter' } },
    ];
    for (const fig of cases) expect(requiredPacksFor(fig)).toEqual(['pack_prism_forge']);
    expect(requiredPacksFor({ ...BASE, chest: 'swash', swash: '#cfd4da' })).toEqual([]);
    expect(requiredPacksFor(LIGHT_CUT)).toEqual(['pack_prism_forge']);
  });
});
