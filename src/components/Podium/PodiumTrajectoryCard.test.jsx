// Historical shadows chart (decision 29): this season's drawn cast renders as
// ghost lines and the player's scoreHistory as the emphasized series.

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PodiumTrajectoryCard from './PodiumTrajectoryCard';
import { selectSeasonShadows } from '../../utils/historicalShadows';

/** @param {any} state */
const podiumWith = (state) => ({ data: { state } });

describe('PodiumTrajectoryCard', () => {
  it('renders every drawn shadow with a direct end-label', () => {
    render(
      <PodiumTrajectoryCard
        podium={podiumWith({
          corpsName: 'Test Corps',
          seasonUid: 'finale_2026-27',
          scoreHistory: [],
        })}
      />
    );
    for (const shadow of selectSeasonShadows('finale_2026-27')) {
      expect(screen.getByText(new RegExp(`${shadow.corps} '\\d{2}`))).toBeInTheDocument();
    }
    expect(screen.getByText(/Your line starts after your first scored show/)).toBeInTheDocument();
  });

  it('renders the corps line once scores exist', () => {
    const { container } = render(
      <PodiumTrajectoryCard
        podium={podiumWith({
          corpsName: 'Test Corps',
          seasonUid: 'finale_2026-27',
          scoreHistory: [
            { day: 10, total: 62.5 },
            { day: 17, total: 68.1 },
          ],
        })}
      />
    );
    expect(container.querySelectorAll('circle').length).toBe(2);
    expect(screen.getByText('Test Corps')).toBeInTheDocument();
  });

  it('draws a different cast after a season reset', () => {
    /** @param {string} seasonUid */
    const labels = (seasonUid) => {
      const { container, unmount } = render(
        <PodiumTrajectoryCard podium={podiumWith({ corpsName: 'Test Corps', seasonUid })} />
      );
      const text = [...container.querySelectorAll('text')].map((n) => n.textContent).join('|');
      unmount();
      return text;
    };
    expect(labels('crescendo_2026-27')).not.toBe(labels('finale_2026-27'));
  });

  it('the drawn cast keeps the DCI shape and spans the full 49-day season', () => {
    const cast = selectSeasonShadows('finale_2026-27');
    // One ghost near the top of the sheet and one down in the low 70s, so
    // there is a line to chase at every level of the field.
    expect(cast[0].finals).toBeGreaterThan(94.5);
    expect(cast[cast.length - 1].finals).toBeLessThan(73.5);
    for (const shadow of cast) {
      expect(shadow.totals).toHaveLength(49);
      // Drawn from the full 2000-2025 corpus, not just the 2000-2012 backfill.
      expect(shadow.year).toBeGreaterThanOrEqual(2000);
      expect(shadow.year).toBeLessThanOrEqual(2025);
    }
    expect(cast.some((s) => s.year > 2012)).toBe(true);
  });
});
