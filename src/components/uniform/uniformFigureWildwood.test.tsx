// Wildwood pack (Alder & Moss): branchwork (torso, sleeves, legs, stored as
// `veins`), its bioluminescent glow, the gill fan, the sheer drape and the patina
// brocade print — rendered, derived, re-skinned, and gated consistently on
// the client.
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import UniformFigure from './UniformFigure';
import type { FigureConfig } from '../../types/uniform';
import { applyColorway, figureShowsBranchwork, withDerivedFlags } from '../../utils/uniform';
import { requiredPacksFor } from '../../utils/uniformPacks';

const BASE: FigureConfig = { skin: '#8d5a3b', jacket: '#2b231d', hatType: 'shako' };

/** The living-forest look: brocade coat, branchwork everywhere, glowing, gill, drape. */
const GROVE: FigureConfig = withDerivedFlags({
  ...BASE,
  torsoFill: 'url:brocade',
  printColors: { brocade: ['#1d4a4f', '#3f7f78', '#b88a4a'] },
  veins: { color: '#e4dccb' },
  veinGlow: '#5ff0dc',
  chest: 'gill',
  gill: '#b06a3a',
  drape: { color: '#5c4960' },
  armL: { type: 'sleeve', color: '#2b231d', veins: '#e4dccb', glove: '#141414' },
  armR: { type: 'sleeve', color: '#2b231d', veins: '#e4dccb', glove: '#141414' },
  legL: { color: '#141414', veins: '#e4dccb' },
  legR: { color: '#141414', veins: '#e4dccb' },
});

describe('Wildwood rendering', () => {
  it('draws nothing extra for a plain figure', () => {
    const { container } = render(<UniformFigure label="plain" figure={BASE} />);
    expect(container.querySelector('pattern[id$="-brocade"]')).toBeNull();
    expect(container.querySelector('filter')).toBeNull();
    expect(container.querySelectorAll('clipPath[id$="-vnc"]')).toHaveLength(0);
  });

  it('renders the full living-forest look', () => {
    const { container } = render(<UniformFigure label="grove" figure={GROVE} />);
    // the brocade print, recolored from printColors
    const pattern = container.querySelector('pattern[id$="-brocade"]');
    expect(pattern).not.toBeNull();
    expect(pattern!.querySelector('rect')!.getAttribute('fill')).toBe('#1d4a4f');
    expect(pattern!.querySelectorAll('circle[fill="#b88a4a"]').length).toBeGreaterThan(0);
    // exactly one glow filter, and the branchwork halo uses it
    expect(container.querySelectorAll('filter[id$="-glow"]')).toHaveLength(1);
    expect(container.querySelectorAll('path[stroke="#5ff0dc"]').length).toBeGreaterThan(10);
    // metal branchwork on the torso, both sleeves and both legs (one clip per limb)
    expect(container.querySelectorAll('path[stroke="#e4dccb"]').length).toBeGreaterThan(10);
    expect(container.querySelectorAll('clipPath[id$="-vnc"]')).toHaveLength(4);
    // the gill fan body and the sheer drape
    expect(container.querySelectorAll('path[fill="#b06a3a"]')).toHaveLength(1);
    const drape = container.querySelectorAll('path[fill="#5c4960"]');
    expect(drape.length).toBe(2);
    expect(Number(drape[0].getAttribute('opacity'))).toBeLessThan(0.5);
  });

  it('defines the glow filter once with glow line-art and Prism glows on too', () => {
    const figure = withDerivedFlags({
      ...GROVE,
      glowArt: '#4fc3ff',
      chest: 'streak',
      streak: '#7cc4ff',
    });
    const { container } = render(<UniformFigure label="all glows" figure={figure} />);
    expect(container.querySelectorAll('filter[id$="-glow"]')).toHaveLength(1);
  });

  it('defines the glow filter for a stored design missing the derived flag', () => {
    const { container } = render(
      <UniformFigure label="stale" figure={{ ...GROVE, glow: false }} />
    );
    expect(container.querySelectorAll('filter[id$="-glow"]')).toHaveLength(1);
  });

  it('keeps arm branchwork off bare skin', () => {
    const figure = withDerivedFlags({
      ...BASE,
      armL: { type: 'bare', veins: '#e4dccb' },
      armR: { type: 'bare', veins: '#e4dccb', glove: '#141414' },
    });
    const { container } = render(<UniformFigure label="bare" figure={figure} />);
    // only the gloved arm draws (and clips to the glove alone)
    const clips = container.querySelectorAll('clipPath[id$="-vnc"]');
    expect(clips).toHaveLength(1);
    expect(clips[0].querySelectorAll('path')).toHaveLength(1);
  });

  it('mirrors the torso branchwork, the drape and the gill independently', () => {
    const flipped = withDerivedFlags({
      ...GROVE,
      veins: { color: '#e4dccb', flip: true },
      drape: { color: '#5c4960', flip: true },
      chestReverse: true,
    });
    const a = render(<UniformFigure label="a" figure={GROVE} />);
    const b = render(<UniformFigure label="b" figure={flipped} />);
    const mirrorsIn = (el: HTMLElement) =>
      el.querySelectorAll('g[transform="translate(240,0) scale(-1,1)"]').length;
    expect(mirrorsIn(b.container)).toBe(mirrorsIn(a.container) + 3);
  });
});

describe('Wildwood derived flags and colorway', () => {
  it('defines brocade only while something references it', () => {
    expect(withDerivedFlags({ ...BASE, torsoFill: 'url:brocade' }).brocade).toBe(true);
    expect(
      withDerivedFlags({ ...BASE, torsoSplit: { color: '#c3c9d1', fill: 'url:brocade' } }).brocade
    ).toBe(true);
    expect(
      withDerivedFlags({ ...BASE, legL: { fill: 'url:brocade' }, legR: { color: '#141414' } })
        .brocade
    ).toBe(true);
    expect(withDerivedFlags({ ...BASE, brocade: true }).brocade).toBe(false);
  });

  it('turns the glow filter on only while glowing branchwork is visible', () => {
    expect(withDerivedFlags({ ...BASE, veinGlow: '#5ff0dc' }).glow).toBe(false);
    expect(
      withDerivedFlags({ ...BASE, veins: { color: '#e4dccb' }, veinGlow: '#5ff0dc' }).glow
    ).toBe(true);
    const bareBranch = { ...BASE, armL: { type: 'bare' as const, veins: '#e4dccb' } };
    expect(figureShowsBranchwork(bareBranch)).toBe(false);
    expect(withDerivedFlags({ ...bareBranch, veinGlow: '#5ff0dc' }).glow).toBe(false);
  });

  it('re-skins every Wildwood color from the colorway', () => {
    const out = applyColorway(GROVE, {
      primary: '#101c33',
      secondary: '#2f6fd0',
      accent: '#e8952f',
      metal: 'silver',
    });
    expect(out.veins).toEqual({ color: '#cfd4da' });
    expect(out.armL?.veins).toBe('#cfd4da');
    expect(out.legR?.veins).toBe('#cfd4da');
    expect(out.veinGlow).toBe('#2f6fd0');
    expect(out.gill).toBe('#e8952f');
    expect(out.drape).toEqual({ color: '#2f6fd0' });
  });
});

describe('Wildwood gating', () => {
  it('maps every piece to the one pack', () => {
    const cases: FigureConfig[] = [
      { ...BASE, torsoFill: 'url:brocade' },
      { ...BASE, mockNeck: 'url:brocade' },
      { ...BASE, veins: { color: '#e4dccb' } },
      { ...BASE, chest: 'gill', gill: '#b06a3a' },
      { ...BASE, drape: { color: '#5c4960', flip: true } },
      { ...BASE, armL: { type: 'sleeve', veins: '#e4dccb' } },
      { ...BASE, armR: { type: 'half', veins: '#e4dccb' } },
      { ...BASE, armL: { type: 'bare', veins: '#e4dccb', gauntlet: { color: '#b06a3a' } } },
      { ...BASE, legL: { veins: '#e4dccb' } },
      { ...BASE, legR: { fill: 'url:brocade' } },
    ];
    for (const fig of cases) expect(requiredPacksFor(fig)).toEqual(['pack_wildwood']);
  });

  it('keeps invisible leftovers free', () => {
    expect(requiredPacksFor({ ...BASE, veinGlow: '#5ff0dc' })).toEqual([]);
    expect(requiredPacksFor({ ...BASE, armL: { type: 'bare', veins: '#e4dccb' } })).toEqual([]);
    expect(requiredPacksFor({ ...BASE, armR: { type: 'none', veins: '#e4dccb' } })).toEqual([]);
    expect(requiredPacksFor(GROVE)).toEqual(['pack_wildwood']);
  });

  it('a brocade split panel needs both houses', () => {
    const fig = { ...BASE, torsoSplit: { color: '#c3c9d1', fill: 'url:brocade' } };
    expect(requiredPacksFor(fig).sort()).toEqual(['pack_prism_forge', 'pack_wildwood']);
  });
});
