// The colorway strip is the equipped-uniform's presence on the score sheets —
// these pin its render gate: a validated hex triple renders three stacked
// swatches; anything else (absent, short, non-hex) renders nothing, so legacy
// rows and un-equipped corps change no layout.
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ColorwayStrip, CorpsIdentity, ScoreAge } from './SheetPrimitives';

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

// The score-age column tells a reader whether the number a corps is ranked on
// is fresh or a week stale — the tone ramp is the at-a-glance half of that, so
// it's pinned here alongside the text.
describe('ScoreAge', () => {
  const renderAge = (days: number | null | undefined) => {
    const { container } = render(<ScoreAge days={days} />);
    return container.firstElementChild as HTMLElement;
  };

  it('renders the age in days, warming as the score goes stale', () => {
    expect(renderAge(0).textContent).toBe('0d');
    expect(renderAge(0).className).toContain('text-white');
    expect(renderAge(2).textContent).toBe('2d');
    expect(renderAge(2).className).toContain('text-secondary');
    expect(renderAge(4).className).toContain('text-muted');
    expect(renderAge(9).textContent).toBe('9d');
    expect(renderAge(9).className).toContain('text-orange-400');
  });

  it('names the age for screen readers', () => {
    expect(renderAge(0).getAttribute('aria-label')).toBe('Scored today');
    expect(renderAge(1).getAttribute('aria-label')).toBe('1 day old');
    expect(renderAge(3).getAttribute('aria-label')).toBe('3 days old');
  });

  it('falls back to a muted dash when the day is unknown or nonsense', () => {
    for (const days of [null, undefined, NaN, -1]) {
      expect(renderAge(days).textContent?.trim(), String(days)).toBe('—');
    }
  });
});
