// Render tests for the deadline countdown chip. Firebase modules are mocked;
// the season store is seeded directly. Time-dependent output is asserted
// loosely (a countdown exists) since the chip reads the real clock.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../../api', () => ({ db: {}, functions: {} }));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({})),
  onSnapshot: vi.fn(() => () => {}),
}));

import { useSeasonStore } from '../../../store/seasonStore';
import NextDeadlineChip from './NextDeadlineChip';

const seedSeason = (status, startDate) => {
  useSeasonStore.setState({
    seasonData: {
      status,
      seasonUid: 'test-season',
      schedule: { startDate: { toDate: () => startDate } },
    },
    loading: false,
  });
};

describe('NextDeadlineChip', () => {
  it('shows the scores countdown', () => {
    // Season in week 5 (limited trades): started 30 days ago
    seedSeason('off-season', new Date(Date.now() - 30 * 24 * 3600e3));
    render(<NextDeadlineChip />);
    expect(screen.getByText(/Scores in/i)).toBeInTheDocument();
  });

  it('shows the change-limit reset during limited weeks', () => {
    seedSeason('off-season', new Date(Date.now() - 30 * 24 * 3600e3));
    render(<NextDeadlineChip />);
    expect(screen.getByText(/Changes reset/i)).toBeInTheDocument();
  });

  it('shows the unlimited window during live-season week 1', () => {
    seedSeason('live-season', new Date(Date.now() - 1 * 24 * 3600e3));
    render(<NextDeadlineChip variant="strip" />);
    expect(screen.getByText(/Unlimited changes until/i)).toBeInTheDocument();
  });

  it('shows the blackout notice on days 43-44', () => {
    // Started 42.5 days ago → competition day 43 (no changes allowed)
    seedSeason('off-season', new Date(Date.now() - 42.5 * 24 * 3600e3));
    render(<NextDeadlineChip variant="strip" />);
    expect(screen.getByText(/Changes closed until/i)).toBeInTheDocument();
  });

  it('renders the countdown even without season data', () => {
    useSeasonStore.setState({ seasonData: null, loading: false });
    render(<NextDeadlineChip />);
    expect(screen.getByText(/Scores in/i)).toBeInTheDocument();
  });
});
