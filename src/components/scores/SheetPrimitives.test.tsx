// The colorway strip is the equipped-uniform's presence on the score sheets —
// these pin its render gate: a validated hex triple renders three stacked
// swatches; anything else (absent, short, non-hex) renders nothing, so legacy
// rows and un-equipped corps change no layout.
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ColorwayStrip, CorpsIdentity } from './SheetPrimitives';

describe('ColorwayStrip', () => {
  it('renders the three colorway swatches for a valid triple', () => {
    const { container } = render(<ColorwayStrip colors={['#6d1a26', '#d9a41c', '#ece2cc']} />);
    const strip = container.firstElementChild as HTMLElement;
    expect(strip).not.toBeNull();
    const swatches = Array.from(strip.children) as HTMLElement[];
    expect(swatches).toHaveLength(3);
    expect(swatches.map((s) => s.style.backgroundColor)).toEqual([
      'rgb(109, 26, 38)',
      'rgb(217, 164, 28)',
      'rgb(236, 226, 204)',
    ]);
  });

  it('renders nothing when the strip is absent, short, or not hex', () => {
    for (const colors of [undefined, null, [], ['#6d1a26', '#d9a41c'], ['red', 'green', 'blue']]) {
      const { container } = render(<ColorwayStrip colors={colors as string[] | null} />);
      expect(container.firstElementChild, JSON.stringify(colors)).toBeNull();
    }
  });

  it('rides along inside CorpsIdentity rows', () => {
    const { container } = render(
      <MemoryRouter>
        <CorpsIdentity
          place={1}
          name="Crimson Cadence"
          displayName="DirectorOne"
          uid="u1"
          colors={['#6d1a26', '#d9a41c', '#ece2cc']}
        />
      </MemoryRouter>
    );
    expect(container.querySelector('[title="Corps colors"]')).not.toBeNull();
  });
});
