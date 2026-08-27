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
    expect(slouch.container.querySelector('g[transform*="scale(0.6)"] circle')).not.toBeNull();
  });

  it('renders the contour shako: swept top, no visor, bare face by default', () => {
    const { container } = render(
      <UniformFigure
        label="contour"
        figure={{
          skin: '#c9a074',
          jacket: '#101014',
          metal: '#d9a41c',
          hatType: 'contour' as const,
          hat: { body: '#f4f2ec', band: '#101014' },
        }}
      />
    );
    expect(container.querySelectorAll('path[fill="#f4f2ec"]').length).toBeGreaterThan(0);
    // no shako visor, and the face stays bare (no default sunburst plate)
    expect(container.querySelectorAll('path[fill="#0d0d0f"]')).toHaveLength(0);
    expect(container.querySelectorAll('circle[fill="#d9a41c"]')).toHaveLength(0);
  });

  it('splits the modern swash into independent torso and leg parts', () => {
    const base = {
      skin: '#c9a074',
      jacket: '#101014',
      chest: 'swash' as const,
      swash: '#f4f2ec',
      legL: { color: '#101014' },
      legR: { color: '#101014' },
    };
    const both = render(<UniformFigure label="both" figure={base} />);
    const bothCount = both.container.querySelectorAll('path[fill="#f4f2ec"]').length;

    const topOnly = render(<UniformFigure label="top" figure={{ ...base, swashBottom: false }} />);
    const legOnly = render(<UniformFigure label="leg" figure={{ ...base, swashTop: false }} />);
    expect(topOnly.container.querySelectorAll('path[fill="#f4f2ec"]').length).toBeLessThan(
      bothCount
    );
    expect(legOnly.container.querySelectorAll('path[fill="#f4f2ec"]').length).toBeLessThan(
      bothCount
    );
    expect(legOnly.container.querySelectorAll('path[fill="#f4f2ec"]').length).toBeGreaterThan(0);

    // the leg band takes its own color when set
    const recolored = render(
      <UniformFigure label="recolored" figure={{ ...base, swashLegColor: '#e01010' }} />
    );
    expect(recolored.container.querySelectorAll('path[fill="#e01010"]').length).toBe(1);

    // sequins are the director's call
    const noSequins = render(
      <UniformFigure label="matte" figure={{ ...base, swashSequin: false }} />
    );
    expect(noSequins.container.querySelectorAll('circle').length).toBeLessThan(
      both.container.querySelectorAll('circle').length
    );
  });

  it('mirrors the aussie and its side feather when hat.flip is set', () => {
    const base = {
      skin: '#c9a074',
      jacket: '#8a1a1a',
      metal: '#d9a41c',
      hatType: 'aussie' as const,
      hat: { body: '#1c4a2a', band: '#101014' },
      plume: { type: 'sideFeather' as const, color: '#f4f2ec', accent: '#b3121c' },
    };
    const stock = render(<UniformFigure label="stock" figure={base} />);
    // the feather renders its accent-dyed tips
    expect(stock.container.querySelectorAll('path[stroke="#b3121c"]').length).toBeGreaterThan(0);
    // stock: hat body is not inside a mirror group
    const stockBody = stock.container.querySelector('path[fill="#1c4a2a"]');
    expect(stockBody?.closest('g[transform="translate(240,0) scale(-1,1)"]')).toBeNull();

    const flipped = render(
      <UniformFigure label="flipped" figure={{ ...base, hat: { ...base.hat, flip: true } }} />
    );
    const flippedBody = flipped.container.querySelector('path[fill="#1c4a2a"]');
    expect(flippedBody?.closest('g[transform="translate(240,0) scale(-1,1)"]')).not.toBeNull();
    const feather = flipped.container.querySelector('path[stroke="#f4f2ec"]');
    expect(feather?.closest('g[transform="translate(240,0) scale(-1,1)"]')).not.toBeNull();
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

  it('renders the chest badge in its own colors on either breast', () => {
    const base = {
      skin: '#c9a074',
      jacket: '#1d2f66',
      metal: '#d9a41c',
      chestBadge: { shape: 'rect' as const, color: '#8a1a1a', accent: '#101014' },
    };
    const badge = render(<UniformFigure label="badge" figure={base} />);
    const outer = badge.container.querySelector('rect[fill="#8a1a1a"]');
    expect(outer).not.toBeNull();
    // the two-tone accent drives the inset panel; the badge group scales the
    // shared ornament builder onto the breast
    expect(badge.container.querySelector('rect[fill="#101014"]')).not.toBeNull();
    expect(outer?.closest('g[transform="translate(71,111.3) scale(0.55)"]')).not.toBeNull();
    expect(outer?.closest('g[transform="translate(240,0) scale(-1,1)"]')).toBeNull();

    const flipped = render(
      <UniformFigure
        label="badge flipped"
        figure={{ ...base, chestBadge: { ...base.chestBadge, flip: true } }}
      />
    );
    const moved = flipped.container.querySelector('rect[fill="#8a1a1a"]');
    expect(moved?.closest('g[transform="translate(240,0) scale(-1,1)"]')).not.toBeNull();
  });

  it('cuts the baldric into blade and tapered shapes via chestShape', () => {
    const base = {
      skin: '#c9a074',
      jacket: '#ece2cc',
      chest: 'baldric' as const,
      baldric: '#17171a',
      baldricCenter: '#101014',
      metal: '#d9a41c',
    };
    const blade = render(
      <UniformFigure label="blade" figure={{ ...base, chestShape: 'triangles' }} />
    );
    // outer blade sweep + the center color driving the nested inner triangle
    expect(blade.container.querySelector('path[d^="M128,99"]')).not.toBeNull();
    expect(blade.container.querySelector('path[d^="M133,105"]')?.getAttribute('fill')).toBe(
      '#101014'
    );

    const tapered = render(
      <UniformFigure label="tapered" figure={{ ...base, chestShape: 'tapered' }} />
    );
    expect(tapered.container.querySelector('path[d^="M134,101 L158,109 L97,250"]')).not.toBeNull();
    // the classic parallel band is replaced, not layered underneath
    expect(tapered.container.querySelector('path[d^="M134,101 L158,109 L102,252"]')).toBeNull();
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
              { o: '0', c: '#1d2f66' },
              { o: '1', c: '#e3b23c' },
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

  it('renders the busby with its bag, tassel, and chin chain', () => {
    const { container } = render(
      <UniformFigure
        label="busby test"
        figure={{
          skin: '#c9a074',
          jacket: '#1d2f66',
          metal: '#d9a41c',
          hatType: 'busby',
          hat: { body: '#17171a', band: '#8a1a1a' },
        }}
      />
    );
    // fur body + broken-strand strokes
    expect(container.querySelectorAll('path[fill="#17171a"]').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('path[stroke-dasharray]').length).toBeGreaterThan(0);
    // bag takes the band channel; its tassel is a darkened circle
    expect(container.querySelectorAll('path[fill="#8a1a1a"]').length).toBeGreaterThan(0);
    // chin chain: five metal links
    expect(container.querySelectorAll('circle[fill="#d9a41c"]').length).toBeGreaterThanOrEqual(5);
  });

  it('renders the cape with its lining and mirrors it to the other shoulder', () => {
    const base = {
      skin: '#c9a074',
      jacket: '#1d2f66',
      cape: { color: '#22355c', lining: '#d9a41c' },
    } as const;
    const left = render(<UniformFigure label="cape left" figure={{ ...base }} />);
    expect(left.container.querySelectorAll('path[fill="#22355c"]').length).toBeGreaterThan(0);
    expect(left.container.querySelectorAll('path[fill="#d9a41c"]').length).toBeGreaterThan(0);

    const right = render(
      <UniformFigure
        label="cape right"
        figure={{ ...base, cape: { ...base.cape, side: 'right' } }}
      />
    );
    const mirrors = (html: string) => html.split('translate(240,0) scale(-1,1)').length - 1;
    expect(mirrors(right.container.innerHTML)).toBe(mirrors(left.container.innerHTML) + 1);
  });

  it('renders the guard dress silhouette with prints clipped to it', () => {
    const dress = render(
      <UniformFigure
        label="dress"
        figure={{
          skin: '#c9a074',
          torsoStyle: 'dress',
          jacket: '#4b2a6b',
          armL: { type: 'bare' },
          armR: { type: 'bare' },
          legL: { color: '#17161c' },
          legR: { color: '#17161c' },
        }}
      />
    );
    // the dress body renders in the jacket channel and the hem drops below
    // the jacket's waistline (y≈260) — pick the torso path by its fill
    const body = Array.from(dress.container.querySelectorAll('path[fill="#4b2a6b"]')).find((el) =>
      el.getAttribute('d')?.startsWith('M78,104')
    );
    expect(body).toBeTruthy();
    expect(body!.getAttribute('d')).toContain('344');

    // the Guard Flourish preset ships the dress with its veil fade sleeve
    const preset = renderPreset('guard-flourish');
    const stops = Array.from(preset.container.querySelectorAll('stop')).map((s) =>
      s.getAttribute('stop-color')
    );
    expect(stops).toContain('#c25a6e');
  });

  it('renders the drum-major aiguillette with metal ferrule tips', () => {
    const base = { skin: '#c9a074', jacket: '#1d2f66', metal: '#cfd4da' };
    const plain = render(<UniformFigure label="no cord" figure={{ ...base }} />);
    const withCord = render(
      <UniformFigure label="cord" figure={{ ...base, aiguillette: '#d9a41c' }} />
    );
    // the cord loops are stroked paths in the cord color
    expect(withCord.container.querySelectorAll('path[stroke="#d9a41c"]').length).toBeGreaterThan(
      plain.container.querySelectorAll('path[stroke="#d9a41c"]').length
    );
    // two metal ferrule tips hang from the chest stud
    expect(
      withCord.container.querySelectorAll('rect[fill="#cfd4da"]').length
    ).toBeGreaterThanOrEqual(2);
  });

  it('defines the iridescent ramp only when the finish is on', () => {
    const plain = render(
      <UniformFigure label="plain torso" figure={{ skin: '#c9a074', jacket: '#1d2f66' }} />
    );
    expect(plain.container.innerHTML).not.toContain('-irid');

    const irid = render(
      <UniformFigure
        label="iridescent torso"
        figure={{ skin: '#c9a074', jacket: '#1d2f66', iridescent: true }}
      />
    );
    expect(irid.container.innerHTML).toContain('-irid)');
    const stops = Array.from(irid.container.querySelectorAll('stop')).map((s) =>
      s.getAttribute('stop-color')
    );
    expect(stops).toContain('#7de8dc');
    expect(stops).toContain('#e8d27a');
  });

  it('scatters the lamé sequin weave over the torso', () => {
    const base = { skin: '#c9a074', jacket: '#1d2f66' };
    const plain = render(<UniformFigure label="no lame" figure={{ ...base }} />);
    const shiny = render(<UniformFigure label="lame" figure={{ ...base, lame: true }} />);
    expect(shiny.container.querySelectorAll('circle').length).toBeGreaterThan(
      plain.container.querySelectorAll('circle').length + 50
    );
  });

  it('is deterministic: identical designs produce identical markup', () => {
    const preset = getUniformPreset('streamline')!;
    const a = render(<UniformFigure figure={preset.figure} label="a" />);
    const b = render(<UniformFigure figure={preset.figure} label="a" />);
    const strip = (html: string) => html.replace(/uf[a-zA-Z0-9]+/g, 'uid');
    expect(strip(a.container.innerHTML)).toBe(strip(b.container.innerHTML));
  });
});
