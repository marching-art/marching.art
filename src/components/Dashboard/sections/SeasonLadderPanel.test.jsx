// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// Render tests for the seasonal reward ladder panel: season-XP math from the
// xpAtSeasonStart baseline, claimable-tier detection, stale-season claim
// reset, and the claim call to the server.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const claimLadderTier = vi.fn();
vi.mock('../../../api/functions', () => ({
  claimLadderTier: (...args) => claimLadderTier(...args),
}));
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

import SeasonLadderPanel from './SeasonLadderPanel';

const makeProfile = (overrides = {}) => ({
  xp: 1000,
  xpAtSeasonStart: 0,
  seasonLadder: null,
  ...overrides,
});

describe('SeasonLadderPanel', () => {
  beforeEach(() => {
    claimLadderTier.mockReset();
  });

  it('renders nothing without a profile', () => {
    const { container } = render(<SeasonLadderPanel profile={null} seasonUid="s1" />);
    expect(container.firstChild).toBeNull();
  });

  it('explains that tracking has not started when the baseline is missing', () => {
    render(
      <SeasonLadderPanel
        profile={makeProfile({ xp: 5000, xpAtSeasonStart: undefined })}
        seasonUid="s1"
      />
    );
    // No baseline → season XP can't be computed yet; say so instead of
    // showing a misleading locked tier
    expect(screen.getByText(/starts counting/i)).toBeInTheDocument();
    expect(screen.queryByText(/Tier 1 ready/)).not.toBeInTheDocument();
  });

  it('offers claims for every tier the season XP has reached', () => {
    // 1,000 season XP reaches tiers 1-5
    render(<SeasonLadderPanel profile={makeProfile()} seasonUid="s1" />);
    expect(screen.getByText(/Tier 1 ready/)).toBeInTheDocument();
    expect(screen.getByText(/Tier 5 ready/)).toBeInTheDocument();
    expect(screen.queryByText(/Tier 6 ready/)).not.toBeInTheDocument();
  });

  it('hides already-claimed tiers for the current season', () => {
    render(
      <SeasonLadderPanel
        profile={makeProfile({ seasonLadder: { seasonUid: 's1', claimed: [1, 2, 3] } })}
        seasonUid="s1"
      />
    );
    expect(screen.queryByText(/Tier 1 ready/)).not.toBeInTheDocument();
    expect(screen.getByText(/Tier 4 ready/)).toBeInTheDocument();
    expect(screen.getByText('3/12 tiers')).toBeInTheDocument();
  });

  it("ignores a previous season's claims", () => {
    render(
      <SeasonLadderPanel
        profile={makeProfile({ seasonLadder: { seasonUid: 'old-season', claimed: [1, 2, 3] } })}
        seasonUid="s1"
      />
    );
    // Stale claims don't count — tier 1 is claimable again this season
    expect(screen.getByText(/Tier 1 ready/)).toBeInTheDocument();
    expect(screen.getByText('0/12 tiers')).toBeInTheDocument();
  });

  it('calls the server to claim a tier', async () => {
    claimLadderTier.mockResolvedValue({
      data: { success: true, alreadyClaimed: false, coinAwarded: 50 },
    });
    render(<SeasonLadderPanel profile={makeProfile({ xp: 150 })} seasonUid="s1" />);
    fireEvent.click(screen.getByText(/Tier 1 ready/));
    await waitFor(() => expect(claimLadderTier).toHaveBeenCalledWith({ tier: 1 }));
  });

  it('celebrates a completed ladder', () => {
    render(
      <SeasonLadderPanel
        profile={makeProfile({
          xp: 4000,
          seasonLadder: {
            seasonUid: 's1',
            claimed: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
          },
        })}
        seasonUid="s1"
      />
    );
    expect(screen.getByText(/Ladder complete/)).toBeInTheDocument();
  });
});
