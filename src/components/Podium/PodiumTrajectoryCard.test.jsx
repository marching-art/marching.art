// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// Historical shadows chart (decision 29): the committed shadow data renders
// as ghost lines and the player's scoreHistory as the emphasized series.

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PodiumTrajectoryCard from './PodiumTrajectoryCard';
import shadowData from '../../data/historicalShadows.json';

const podiumWith = (state) => ({ data: { state } });

describe('PodiumTrajectoryCard', () => {
  it('renders every committed shadow with a direct end-label', () => {
    render(
      <PodiumTrajectoryCard podium={podiumWith({ corpsName: 'Test Corps', scoreHistory: [] })} />
    );
    for (const shadow of shadowData.shadows) {
      expect(screen.getByText(new RegExp(`${shadow.corps} '\\d{2}`))).toBeInTheDocument();
    }
    expect(screen.getByText(/Your line starts after your first scored show/)).toBeInTheDocument();
  });

  it('renders the corps line once scores exist', () => {
    const { container } = render(
      <PodiumTrajectoryCard
        podium={podiumWith({
          corpsName: 'Test Corps',
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

  it('committed shadows keep the DCI shape — community corps never near the elite', () => {
    const finals = Object.fromEntries(shadowData.shadows.map((s) => [s.corps, s.finals]));
    expect(finals['Carolina Crown']).toBeGreaterThan(95);
    expect(finals['Jersey Surf']).toBeLessThan(80);
    expect(finals['Pioneer']).toBeLessThan(80);
    for (const shadow of shadowData.shadows) {
      expect(shadow.totals).toHaveLength(49);
    }
  });

  it('draws on the full 2000-2025 corpus, not just the 2000-2012 backfill', () => {
    const years = shadowData.shadows.map((s) => s.year);
    for (const year of years) {
      expect(year).toBeGreaterThanOrEqual(2000);
      expect(year).toBeLessThanOrEqual(2025);
    }
    // At least one arc must come from the modern (post-2012) era the wider
    // corpus unlocked — otherwise the chart quietly regressed to 2000-2012.
    expect(years.some((y) => y > 2012)).toBe(true);
  });
});
