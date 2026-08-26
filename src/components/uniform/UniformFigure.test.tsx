import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import UniformFigure from './UniformFigure';
import { getUniformPreset } from '../../data/uniformCatalog';

function renderPreset(id: string) {
  const preset = getUniformPreset(id);
  expect(preset, id).toBeDefined();
  return render(<UniformFigure figure={preset!.figure} label={`${preset!.label} preview`} />);
}

describe('UniformFigure', () => {
  it('renders an accessible svg image', () => {
    const { getByRole } = renderPreset('classic-cadet');
    const svg = getByRole('img', { name: 'Classic Cadet preview' });
    expect(svg.tagName.toLowerCase()).toBe('svg');
    expect(svg.getAttribute('viewBox')).toBe('0 -84 240 560');
  });

  it('drives garment fills from the design channels', () => {
    const { container } = renderPreset('classic-cadet');
    // jacket base + maroon leg stripe come straight from the config
    expect(container.querySelectorAll('path[fill="#6d1a26"]').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('path[fill="#ece2cc"]').length).toBeGreaterThan(0);
    // spats render as their fixed ink
    expect(container.querySelectorAll('path[fill="#f2efe6"]').length).toBeGreaterThan(0);
  });

  it('defines procedural prints only when the design uses them', () => {
    const burst = renderPreset('radial-burst');
    expect(burst.container.querySelector('radialGradient')).not.toBeNull();
    expect(burst.container.querySelector('linearGradient')).not.toBeNull(); // ombre + foil

    const cadet = renderPreset('classic-cadet');
    expect(cadet.container.querySelector('radialGradient')).toBeNull();
    expect(cadet.container.querySelector('pattern')).toBeNull();
  });

  it('recolors procedural prints from printColors overrides', () => {
    const preset = getUniformPreset('radial-burst')!;
    const { container } = render(
      <UniformFigure
        label="custom burst"
        figure={{
          ...preset.figure,
          printColors: { sunburst: ['#112233', '#445566', '#778899'] },
        }}
      />
    );
    // jsdom can't run descendant selectors on camelCase SVG tags — scope instead
    const stops = container.querySelector('radialGradient')!.querySelectorAll('stop');
    expect(stops[0].getAttribute('stop-color')).toBe('#112233');
    expect(stops[1].getAttribute('stop-color')).toBe('#445566');
    expect(stops[2].getAttribute('stop-color')).toBe('#778899');
    // the burst rays take the custom center color
    expect(container.querySelectorAll('path[stroke="#112233"]').length).toBeGreaterThan(0);
  });

  it('recolors plaid and foil legs from printColors overrides', () => {
    const { container } = render(
      <UniformFigure
        label="custom legs"
        figure={{
          skin: '#c9a074',
          jacket: '#1d2f66',
          plaid: true,
          foilLeg: true,
          legL: { fill: 'url:plaid' },
          legR: { fill: 'url:foil', foil: true },
          printColors: { plaid: ['#222a44', '#4a5a8a', '#c8d0e8'], foil: ['#8a2a3a', '#f0c0c8'] },
        }}
      />
    );
    expect(container.querySelector('pattern rect')?.getAttribute('fill')).toBe('#222a44');
    const colors = Array.from(container.querySelectorAll('stop')).map((s) =>
      s.getAttribute('stop-color')
    );
    expect(colors).toContain('#8a2a3a');
    expect(colors).toContain('#f0c0c8');
  });

  it('colors the shako plate from hat.emblem instead of the hardware metal', () => {
    const base = {
      skin: '#c9a074',
      jacket: '#8a1a1a',
      metal: '#d9a41c',
      hatType: 'shako' as const,
      hat: { body: '#17171a', band: '#8a1a1a', emblem: '#e01010' },
    };
    const { container } = render(<UniformFigure label="red cog" figure={base} />);
    // plate disc and rays wear the emblem color; no metal-gold plate remains
    expect(container.querySelectorAll('circle[fill="#e01010"]').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('line[stroke="#e01010"]').length).toBe(8);
    expect(container.querySelectorAll('circle[fill="#d9a41c"]')).toHaveLength(0);
  });

  it('swaps hat ornaments: star renders, bare renders nothing, aussie mounts one', () => {
    const base = {
      skin: '#c9a074',
      jacket: '#8a1a1a',
      metal: '#d9a41c',
      hatType: 'shako' as const,
      hat: { body: '#17171a', band: '#8a1a1a', emblem: '#e01010', ornament: 'star' as const },
    };
    const star = render(<UniformFigure label="star shako" figure={base} />);
    expect(star.container.querySelectorAll('polygon[fill="#e01010"]').length).toBe(1);

    const bare = render(
      <UniformFigure
        label="bare shako"
        figure={{ ...base, hat: { ...base.hat, ornament: 'none' as const } }}
      />
    );
    expect(bare.container.querySelectorAll('polygon').length).toBe(0);
    expect(bare.container.querySelectorAll('circle[fill="#e01010"]')).toHaveLength(0);

    const slouch = render(
      <UniformFigure
        label="aussie"
        figure={{
          ...base,
          hatType: 'aussie' as const,
          hat: { ...base.hat, ornament: 'disc' as const },
        }}
      />
    );
    // the aussie's badge rides the pinned-up brim inside a scaled group
    expect(slouch.container.querySelector('g[transform*="scale(0.65)"] circle')).not.toBeNull();
  });

  it('reverses diagonal chest pieces and renders the two-tone baldric stripe', () => {
    const base = {
      skin: '#c9a074',
      jacket: '#1d2f66',
      chest: 'baldric' as const,
      baldric: '#8a1a1a',
      baldricCenter: '#101014',
      metal: '#d9a41c',
    };
    const twoTone = render(<UniformFigure label="two-tone" figure={base} />);
    const stripe = twoTone.container.querySelector('path[fill="#101014"]');
    expect(stripe).not.toBeNull();

    const reversed = render(
      <UniformFigure label="reversed" figure={{ ...base, chestReverse: true }} />
    );
    // the baldric band now sits inside a mirror transform group
    const band = reversed.container.querySelector('path[fill="#8a1a1a"]');
    expect(band?.closest('g[transform="translate(240,0) scale(-1,1)"]')).not.toBeNull();
    // unreversed control: no mirror group wraps the band
    const control = twoTone.container.querySelector('path[fill="#8a1a1a"]');
    expect(control?.closest('g[transform="translate(240,0) scale(-1,1)"]')).toBeNull();
  });

  it('fades the chest band between the two chestFade colors', () => {
    const { container } = render(
      <UniformFigure
        label="faded sash"
        figure={{
          skin: '#c9a074',
          jacket: '#1d2f66',
          chest: 'sash',
          sash: '#8a1a1a',
          chestFade: ['#8a1a1a', '#101014'],
        }}
      />
    );
    const stops = Array.from(container.querySelectorAll('stop')).map((s) =>
      s.getAttribute('stop-color')
    );
    expect(stops).toContain('#8a1a1a');
    expect(stops).toContain('#101014');
    // the band path points at the chest-fade gradient, not a solid color
    expect(container.innerHTML).toContain('-fadeChest)');
  });

  it('renders director fade sleeves through the grads pipeline', () => {
    const { container } = render(
      <UniformFigure
        label="fade sleeves"
        figure={{
          skin: '#c9a074',
          jacket: '#1d2f66',
          grads: {
            fadeL: [
              ['0', '#1d2f66'],
              ['1', '#e3b23c'],
            ],
          },
          armL: { type: 'sleeve', fill: 'url:fadeL' },
          armR: { type: 'sleeve', color: '#1d2f66' },
        }}
      />
    );
    const stops = Array.from(container.querySelectorAll('stop')).map((s) =>
      s.getAttribute('stop-color')
    );
    expect(stops).toContain('#1d2f66');
    expect(stops).toContain('#e3b23c');
    expect(container.innerHTML).toContain('-fadeL)');
  });

  it('renders the glow filter for glow designs', () => {
    const { container } = renderPreset('neon-circuit');
    expect(container.querySelector('filter feGaussianBlur')).not.toBeNull();
    expect(container.querySelectorAll('[filter]').length).toBeGreaterThan(0);
  });

  it('supports per-side asymmetry (independent left/right limbs)', () => {
    const { container } = render(
      <UniformFigure
        label="asymmetry test"
        figure={{
          skin: '#c9a074',
          jacket: '#1d2f66',
          armL: { type: 'bare' },
          armR: { type: 'sleeve', color: '#1d2f66' },
          legL: { color: '#101014', stripe: '#e3b23c' },
          legR: { color: '#101014' },
        }}
      />
    );
    // exactly one stripe path (left leg only)
    expect(container.querySelectorAll('path[fill="#e3b23c"]')).toHaveLength(1);
  });

  it('clamps invalid colors instead of rendering them', () => {
    const { container } = render(
      <UniformFigure
        label="sanitize test"
        figure={{ skin: 'not-a-color', jacket: 'url(javascript:alert(1))' }}
      />
    );
    expect(container.innerHTML).not.toContain('javascript:');
    expect(container.querySelectorAll('path[fill="#888888"]').length).toBeGreaterThan(0);
  });

  it('is deterministic: identical designs produce identical markup', () => {
    const preset = getUniformPreset('streamline')!;
    const a = render(<UniformFigure figure={preset.figure} label="a" />);
    const b = render(<UniformFigure figure={preset.figure} label="a" />);
    const strip = (html: string) => html.replace(/uf[a-zA-Z0-9]+/g, 'uid');
    expect(strip(a.container.innerHTML)).toBe(strip(b.container.innerHTML));
  });
});
