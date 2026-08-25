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
