// Pins the Uniform History cells: swatches render only from a validated
// triple (pre-Studio seasons show nothing), and the detail section prefers
// the full archived figure over the compact row.
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import SeasonUniformSection, { SeasonLookSwatches } from './SeasonUniformSection';

const COMPACT = {
  designId: 'd1',
  name: '2026 Finals Look',
  colors: ['#101c33', '#d7dde2', '#2f6fd0'],
};

describe('SeasonLookSwatches', () => {
  it('renders three swatches for an archived look', () => {
    const { container } = render(<SeasonLookSwatches uniform={COMPACT} />);
    const strip = container.firstElementChild as HTMLElement;
    expect(Array.from(strip.children)).toHaveLength(3);
    expect((strip.children[0] as HTMLElement).style.backgroundColor).toBe('rgb(16, 28, 51)');
  });

  it('renders nothing for pre-Studio seasons or bad colors', () => {
    for (const uniform of [undefined, null, {}, { colors: ['red', 'green', 'blue'] }]) {
      const { container } = render(
        <SeasonLookSwatches uniform={uniform as typeof COMPACT | null | undefined} />
      );
      expect(container.firstElementChild, JSON.stringify(uniform)).toBeNull();
    }
  });
});

describe('SeasonUniformSection', () => {
  it('renders the archived figure when the detail snapshot carries one', () => {
    const { getByRole } = render(
      <SeasonUniformSection
        compact={COMPACT}
        snapshot={{ name: '2026 Finals Look', figure: { skin: '#c9a074', jacket: '#101c33' } }}
      />
    );
    expect(getByRole('img', { name: '2026 Finals Look uniform' })).toBeInTheDocument();
  });

  it('falls back to compact swatches, and to nothing at all', () => {
    const withCompact = render(<SeasonUniformSection compact={COMPACT} snapshot={null} />);
    // no archived figure -> no figure svg (the header's Shirt icon is aria-hidden)
    expect(withCompact.container.querySelector('svg[role="img"]')).toBeNull();
    expect(withCompact.getByText('2026 Finals Look')).toBeInTheDocument();

    const empty = render(<SeasonUniformSection compact={null} snapshot={null} />);
    expect(empty.container.firstElementChild).toBeNull();
  });
});
