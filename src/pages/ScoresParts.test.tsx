// Component tests for the Scores page's core presentational views:
// ClassStandingsGrid (the class-standings sheet) and FantasyRecapsView's two
// data modes — eager (season shows in hand) and lazy (day list from the
// materialized standings, one recap doc fetched per viewed day). These are
// the money surfaces of the nightly loop and previously had no component
// coverage at all.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ComponentType, ReactElement } from 'react';

// useScoresData transitively initializes Firebase via api/client — mock the
// single hook FantasyRecapsView consumes.
vi.mock('../hooks/useScoresData', () => ({
  useDayRecapShows: vi.fn(),
}));

import { useDayRecapShows } from '../hooks/useScoresData';

const mockedUseDayRecapShows = vi.mocked(useDayRecapShows);
import { FantasyRecapsView, ClassStandingsGrid } from './ScoresParts';

// The components are untyped .jsx; TS narrows their props from the default
// values (e.g. `shows = null` infers `null`), so cast to loose prop maps.
const RecapsView = FantasyRecapsView as unknown as ComponentType<Record<string, unknown>>;
const StandingsGrid = ClassStandingsGrid as unknown as ComponentType<Record<string, unknown>>;

const wrap = (ui: ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

const historyEntry = (score: number, day: number) => ({
  score,
  totalScore: score,
  geScore: score * 0.4,
  visualScore: score * 0.3,
  musicScore: score * 0.3,
  offSeasonDay: day,
});

const standingsEntry = (
  rank: number,
  corpsName: string,
  score: number,
  opts: { displayName?: string } = {}
) => ({
  rank,
  corps: corpsName,
  corpsName,
  corpsClass: 'worldClass',
  uid: `uid-${rank}`,
  displayName: opts.displayName,
  avatarUrl: null,
  score,
  totalScore: score,
  showCount: 2,
  GE_Total: score * 0.4,
  VIS_Total: score * 0.3,
  MUS_Total: score * 0.3,
  Total_Score: score,
  trend: { trend: 'stable', values: [score - 1, score], direction: 0 },
  scores: [historyEntry(score, 2), historyEntry(score - 1, 1)],
});

const show = (eventName: string, day: number, scores: object[]) => ({
  eventName,
  location: 'Akron, OH',
  date: '7/20/2026',
  offSeasonDay: day,
  seasonId: 'season-1',
  scores,
});

const showScore = (corpsName: string, score: number) => ({
  corps: corpsName,
  corpsName,
  uid: `uid-${corpsName}`,
  displayName: undefined,
  avatarUrl: null,
  score,
  totalScore: score,
  geScore: score * 0.4,
  visualScore: score * 0.3,
  musicScore: score * 0.3,
  corpsClass: 'worldClass',
  captions: {},
});

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseDayRecapShows.mockReturnValue({ shows: [], loading: false });
});

describe('ClassStandingsGrid', () => {
  it('renders entries in rank order with formatted totals', () => {
    wrap(
      <StandingsGrid
        standings={[
          standingsEntry(1, 'Crimson Cadence', 91.35, { displayName: 'DirectorDan' }),
          standingsEntry(2, 'Golden Empire', 89.9),
        ]}
        className="World Class"
      />
    );
    const crimson = screen.getByText('Crimson Cadence');
    const golden = screen.getByText('Golden Empire');
    expect(crimson).toBeInTheDocument();
    // Rank order: Crimson before Golden in the document.
    expect(crimson.compareDocumentPosition(golden) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText('91.350')).toBeInTheDocument();
    expect(screen.getByText('89.900')).toBeInTheDocument();
  });

  it('shows an empty state when there are no standings', () => {
    wrap(<StandingsGrid standings={[]} className="Open Class" />);
    expect(screen.getByText(/no open class standings yet/i)).toBeInTheDocument();
  });
});

describe('FantasyRecapsView — eager mode', () => {
  it('renders the latest day by default with day tabs', () => {
    wrap(
      <RecapsView
        shows={[
          show('Opening Night', 1, [showScore('Crimson Cadence', 80)]),
          show('Midwest Classic', 2, [showScore('Crimson Cadence', 91.35)]),
        ]}
      />
    );
    // Day tabs for both days; the latest day's show is on screen.
    expect(screen.getByRole('button', { name: 'D1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'D2' })).toBeInTheDocument();
    expect(screen.getByText(/midwest classic/i)).toBeInTheDocument();
    expect(screen.queryByText(/opening night/i)).not.toBeInTheDocument();
    // Never fetches in eager mode.
    expect(useDayRecapShows).toHaveBeenCalledWith(null, expect.anything(), false);
  });

  it('switches days via the tab strip', () => {
    wrap(
      <RecapsView
        shows={[
          show('Opening Night', 1, [showScore('Crimson Cadence', 80)]),
          show('Midwest Classic', 2, [showScore('Crimson Cadence', 91.35)]),
        ]}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'D1' }));
    expect(screen.getByText(/opening night/i)).toBeInTheDocument();
  });

  it('renders the empty state with no shows', () => {
    wrap(<RecapsView shows={[]} />);
    expect(screen.getByText(/no recent shows/i)).toBeInTheDocument();
  });
});

describe('FantasyRecapsView — lazy mode (materialized standings)', () => {
  it('takes its day list from availableDays and fetches only the active day', () => {
    mockedUseDayRecapShows.mockImplementation((seasonId, day, enabled) => ({
      shows: (enabled && day === 3
        ? [show('Finals Preview', 3, [showScore('Golden Empire', 92)])]
        : []) as never,
      loading: false,
    }));

    wrap(<RecapsView seasonId="season-1" availableDays={[3, 2, 1]} />);

    expect(screen.getByRole('button', { name: 'D3' })).toBeInTheDocument();
    expect(screen.getByText(/finals preview/i)).toBeInTheDocument();
    // The active-day fetch is enabled; the Eastern-night fetches are not
    // (day 3 is not a two-night day).
    expect(useDayRecapShows).toHaveBeenCalledWith('season-1', 3, true);
    expect(useDayRecapShows).toHaveBeenCalledWith('season-1', 41, false);
    expect(useDayRecapShows).toHaveBeenCalledWith('season-1', 42, false);
  });

  it('filters SoundSport out of lazily fetched shows', () => {
    mockedUseDayRecapShows.mockImplementation((seasonId, day, enabled) => ({
      shows: (enabled && day === 2
        ? [
            show('Mixed Show', 2, [
              showScore('Crimson Cadence', 90),
              { ...showScore('Bayou Brigade', 80), corpsClass: 'soundSport' },
            ]),
          ]
        : []) as never,
      loading: false,
    }));

    wrap(<RecapsView seasonId="season-1" availableDays={[2]} />);
    expect(screen.getByText('Crimson Cadence')).toBeInTheDocument();
    expect(screen.queryByText('Bayou Brigade')).not.toBeInTheDocument();
  });

  it('shows a loading state while the day recap fetches', () => {
    mockedUseDayRecapShows.mockImplementation((seasonId, day, enabled) => ({
      shows: [],
      loading: Boolean(enabled && day === 2),
    }));

    wrap(<RecapsView seasonId="season-1" availableDays={[2, 1]} />);
    expect(screen.getByText(/loading day 2/i)).toBeInTheDocument();
  });
});
