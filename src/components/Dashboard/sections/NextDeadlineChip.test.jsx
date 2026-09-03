// Render tests for the deadline countdown chip. Firebase modules are mocked;
// the season store is seeded directly. Time-dependent output is asserted
// loosely (a countdown exists) since the chip reads the real clock.
import { describe, it, expect, vi } from 'vitest';
import { render as rtlRender, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../../api', () => ({ db: {}, functions: {} }));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({})),
  onSnapshot: vi.fn(() => () => {}),
}));

// useSeasonDeadlines fetches tonight's drop plan through the api layer; a
// null plan exercises the season-clock estimate fallback the chip renders.
vi.mock('../../../api/season', () => ({
  getDropPlan: vi.fn(async () => null),
}));

import { useSeasonStore } from '../../../store/seasonStore';
import { getDropPlan } from '../../../api/season';
import NextDeadlineChip from './NextDeadlineChip';

// The chip's deadline hook uses react-query (drop-plan cache), so renders
// need a provider. Fresh client per render keeps tests isolated.
/** @param {React.ReactElement} ui */
const render = (ui) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return rtlRender(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

/**
 * @param {string} status
 * @param {Date} startDate
 */
const seedSeason = (status, startDate) => {
  // The chip only calls `toDate()` on the Timestamp; a stub is enough.
  const startTs = /** @type {import('firebase/firestore').Timestamp} */ (
    /** @type {unknown} */ ({ toDate: () => startDate })
  );
  useSeasonStore.setState({
    seasonData: {
      status,
      seasonUid: 'test-season',
      schedule: { startDate: startTs },
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

  it('shows the upcoming lock while changes are open during limited weeks', () => {
    seedSeason('off-season', new Date(Date.now() - 30 * 24 * 3600e3));
    render(<NextDeadlineChip />);
    expect(screen.getByText(/Changes lock/i)).toBeInTheDocument();
  });

  it('shows the change-limit reset once changes are locked', () => {
    // Freeze time at 1:30 AM ET Sunday and start the season 14.5 days
    // earlier: competition day 15, inside the lockout that ends when scores
    // process at 2 AM ET.
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-07-05T05:30:00Z'));
      seedSeason('off-season', new Date(Date.now() - 14.5 * 24 * 3600e3));
      render(<NextDeadlineChip />);
      expect(screen.getByText(/Changes reset/i)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
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

  // Live scores derive from the DCI recap, so the backend holds the drop when
  // dci.org posts late. The chip used to discard the plan the instant its drop
  // time passed and roll the countdown forward to the 2 AM ET estimate — so it
  // promised 11 PM and then jumped to "3 hours" at 11 PM sharp.
  describe('while the drop is pending', () => {
    const mockGetDropPlan = vi.mocked(getDropPlan);
    /**
     * @param {{ dropOffsetMs: number, windowOffsetMs: number, scoredAt?: string | null }} plan
     */
    const planFor = ({ dropOffsetMs, windowOffsetMs, scoredAt = null }) => ({
      dropInstant: new Date(Date.now() + dropOffsetMs).toISOString(),
      scrapeRetryUntil: new Date(Date.now() + windowOffsetMs).toISOString(),
      dropLabel: '11:00 PM ET',
      ...(scoredAt ? { scoredAt } : {}),
    });

    it('says scores are processing instead of counting down to a later time', async () => {
      mockGetDropPlan.mockResolvedValueOnce(
        // Drop was 10 minutes ago; the night's retry window runs 2 more hours.
        planFor({ dropOffsetMs: -10 * 60e3, windowOffsetMs: 2 * 3600e3 })
      );
      seedSeason('live-season', new Date(Date.now() - 30 * 24 * 3600e3));
      render(<NextDeadlineChip />);

      expect(await screen.findByText(/Scores processing/i)).toBeInTheDocument();
      expect(screen.queryByText(/Scores in/i)).not.toBeInTheDocument();
    });

    it('counts down normally while the planned drop is still ahead', async () => {
      mockGetDropPlan.mockResolvedValueOnce(
        planFor({ dropOffsetMs: 45 * 60e3, windowOffsetMs: 3 * 3600e3 })
      );
      seedSeason('live-season', new Date(Date.now() - 30 * 24 * 3600e3));
      render(<NextDeadlineChip />);

      expect(await screen.findByText(/Scores in/i)).toBeInTheDocument();
      expect(screen.queryByText(/Scores processing/i)).not.toBeInTheDocument();
    });

    it('goes back to a countdown once the night has scored', async () => {
      mockGetDropPlan.mockResolvedValueOnce(
        planFor({
          dropOffsetMs: -10 * 60e3,
          windowOffsetMs: 2 * 3600e3,
          scoredAt: new Date().toISOString(),
        })
      );
      seedSeason('live-season', new Date(Date.now() - 30 * 24 * 3600e3));
      render(<NextDeadlineChip />);

      expect(await screen.findByText(/Scores in/i)).toBeInTheDocument();
      expect(screen.queryByText(/Scores processing/i)).not.toBeInTheDocument();
    });
  });
});
