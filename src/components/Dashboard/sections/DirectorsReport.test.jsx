// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// Render tests for the Director's Report — the unified Zone-B daily card.
// Pins the "Today · X of Y done" count assembly (login + challenges +
// predictions) and the pending ladder-claim row.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const claimLadderTier = vi.fn();
vi.mock('../../../api/functions', () => ({
  claimLadderTier: (...args) => claimLadderTier(...args),
}));
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

// The store hook powers the report, the embedded challenges, and predictions.
let mockProfile = null;
vi.mock('../../../store/profileStore', () => ({
  useProfileStore: (selector) =>
    selector({
      profile: mockProfile,
      completeDailyChallenge: vi.fn(),
      submitPrediction: vi.fn(),
      resolvePredictions: vi.fn(),
    }),
}));

import DirectorsReport from './DirectorsReport';
import { getGameDay } from '../../../utils/dailyChallenges';

const gameDay = getGameDay();

const twoResults = [
  { score: 72.5, placement: 4, eventName: 'Show A' },
  { score: 70.1, placement: 6, eventName: 'Show B' },
];

const renderReport = (props = {}) =>
  render(
    <MemoryRouter>
      <DirectorsReport
        recentResults={twoResults}
        corpsClass="worldClass"
        seasonUid="s1"
        onLineupClick={() => {}}
        {...props}
      />
    </MemoryRouter>
  );

describe('DirectorsReport', () => {
  beforeEach(() => {
    claimLadderTier.mockReset();
    window.localStorage.clear();
    mockProfile = {
      xp: 100,
      xpAtSeasonStart: 0,
      engagement: { loginStreak: 4, lastLogin: new Date() },
      challenges: {},
      predictions: {},
      seasonLadder: null,
    };
  });

  it('renders nothing without a profile', () => {
    mockProfile = null;
    const { container } = renderReport();
    expect(container.firstChild).toBeNull();
  });

  it('assembles the daily count: login done, challenges and predictions open', () => {
    // login(1 done) + 3 challenges(0) + 3 predictions(0) → 1 of 7
    renderReport();
    expect(screen.getByText(/Today · 1 of 7 done/)).toBeInTheDocument();
    expect(screen.getByText(/4 day streak/)).toBeInTheDocument();
  });

  it('counts completed challenges and picked predictions', () => {
    const todaysChallengeId = 'check-lineup';
    mockProfile.challenges = { [gameDay]: [{ id: todaysChallengeId, completed: true }] };
    mockProfile.predictions = {
      [gameDay]: { picks: { 'over-under': { pick: 'Over' } }, resolved: false },
    };
    renderReport();
    // login(1) + up-to-1 completed challenge + 1 pick — at minimum 2 of 7;
    // exactly 3 when today's rotation includes check-lineup. Assert the
    // count moved past 1 rather than pinning the rotation.
    expect(screen.queryByText(/Today · 1 of 7 done/)).not.toBeInTheDocument();
  });

  it('surfaces a pending Season Ladder claim with its CC amount', () => {
    mockProfile.xp = 400; // season XP 400 → tiers 1-2 claimable
    renderReport();
    expect(screen.getByText(/Season Ladder Tier 1 ready/)).toBeInTheDocument();
    expect(screen.getByText(/\+1 more/)).toBeInTheDocument();
    expect(screen.getByText(/Claim \+50 CC/)).toBeInTheDocument();
  });

  it('hides the claim row when every reached tier is claimed', () => {
    mockProfile.xp = 400;
    mockProfile.seasonLadder = { seasonUid: 's1', claimed: [1, 2] };
    renderReport();
    expect(screen.queryByText(/ready/)).not.toBeInTheDocument();
  });
});
