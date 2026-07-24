// Tests for useScoresData's materialized-standings path: when the nightly
// fantasy_standings docs cover a season, the hook must serve the leaderboard,
// stats, and day list from them and skip the full recap download; when they
// don't (missing doc, class-specific filter, or a standings doc that runs
// ahead of the reveal boundary), it must fall back to recap aggregation.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('../api/season', () => ({
  getSeasonRecaps: vi.fn(),
  getSeasonRecapDay: vi.fn(),
  getSeasonChampions: vi.fn(),
  getSeasonStandings: vi.fn(),
}));

// Selector-style zustand mock: useSeasonStore(sel) => sel(state).
const seasonState = {
  seasonUid: 'current_season',
  seasonData: { schedule: null },
  currentDay: 13,
};
vi.mock('../store/seasonStore', () => ({
  useSeasonStore: (selector: (s: typeof seasonState) => unknown) => selector(seasonState),
}));

vi.mock('../utils/dashboardScoring', () => ({
  getEffectiveDay: vi.fn(),
}));

import { getSeasonRecaps, getSeasonChampions, getSeasonStandings } from '../api/season';
import { getEffectiveDay } from '../utils/dashboardScoring';
import { useScoresData } from './useScoresData';

const STANDINGS = {
  seasonUid: 'current_season',
  scoredDays: [1, 2, 3],
  lastScoredDay: 3,
  stats: { recentShows: 5, topScore: '91.350', corpsActive: 12, avgScore: '84.000' },
  classes: {
    worldClass: [
      {
        rank: 1,
        corps: 'Crimson Cadence',
        corpsName: 'Crimson Cadence',
        corpsClass: 'worldClass',
        uid: 'u1',
        displayName: 'DirectorDan',
        avatarUrl: null,
        score: 91.35,
        totalScore: 91.35,
        showCount: 3,
        GE_Total: 36,
        VIS_Total: 27,
        MUS_Total: 28,
        Total_Score: 91.35,
        GE_Rank: 1,
        VIS_Rank: 1,
        MUS_Rank: 1,
        trend: { trend: 'up', values: [80, 91.35], direction: 0.14 },
        scores: [
          {
            score: 91.35,
            totalScore: 91.35,
            geScore: 36,
            visualScore: 27,
            musicScore: 28,
            offSeasonDay: 3,
          },
          {
            score: 80,
            totalScore: 80,
            geScore: 32,
            visualScore: 24,
            musicScore: 24,
            offSeasonDay: 2,
          },
        ],
      },
    ],
    aClass: [
      {
        rank: 1,
        corps: 'Steel City Sound',
        corpsName: 'Steel City Sound',
        corpsClass: 'aClass',
        uid: 'u3',
        displayName: '',
        avatarUrl: null,
        score: 55.2,
        totalScore: 55.2,
        showCount: 1,
        GE_Total: 20,
        VIS_Total: 17,
        MUS_Total: 18,
        Total_Score: 55.2,
        GE_Rank: 1,
        VIS_Rank: 1,
        MUS_Rank: 1,
        trend: { trend: 'stable', values: [], direction: 0 },
        scores: [
          {
            score: 55.2,
            totalScore: 55.2,
            geScore: 20,
            visualScore: 17,
            musicScore: 18,
            offSeasonDay: 3,
          },
        ],
      },
    ],
  },
};

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSeasonChampions).mockResolvedValue([]);
  vi.mocked(getSeasonRecaps).mockResolvedValue([]);
});

describe('useScoresData standings path', () => {
  it('serves leaderboard/stats/days from standings and skips the recap download', async () => {
    vi.mocked(getEffectiveDay).mockReturnValue(12);
    vi.mocked(getSeasonStandings).mockResolvedValue(STANDINGS as never);

    const { result } = renderHook(() => useScoresData({ skipShows: true }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    await waitFor(() => expect(result.current.usingStandings).toBe(true));

    // Leaderboard flattened world -> a class, with the entry contract intact.
    expect(result.current.aggregatedScores.map((e) => e.corpsName)).toEqual([
      'Crimson Cadence',
      'Steel City Sound',
    ]);
    const crimson = result.current.aggregatedScores[0];
    expect(crimson.rank).toBe(1);
    expect(crimson.GE_Total).toBe(36);
    // History hydrated with identity so rank-delta/caption consumers work.
    expect(crimson.scores[1].score).toBe(80);
    expect(crimson.scores[0].corpsName).toBe('Crimson Cadence');

    expect(result.current.stats.topScore).toBe('91.350');
    expect(result.current.availableDays).toEqual([3, 2, 1]);
    expect(result.current.displayedSeasonId).toBe('current_season');
    expect(getSeasonRecaps).not.toHaveBeenCalled();
  });

  it('falls back to recaps when the standings run ahead of the reveal boundary', async () => {
    // Standings materialized through day 3, but the 2 AM boundary says only
    // day 2 is revealable — trusting them would leak tonight's scores early.
    vi.mocked(getEffectiveDay).mockReturnValue(2);
    vi.mocked(getSeasonStandings).mockResolvedValue(STANDINGS as never);

    const { result } = renderHook(() => useScoresData({ skipShows: true }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.usingStandings).toBe(false);
    await waitFor(() => expect(getSeasonRecaps).toHaveBeenCalled());
  });

  it('ignores standings for class-specific filters (Dashboard/SoundSport path)', async () => {
    vi.mocked(getEffectiveDay).mockReturnValue(12);
    vi.mocked(getSeasonStandings).mockResolvedValue(STANDINGS as never);

    const { result } = renderHook(
      () => useScoresData({ classFilter: 'soundSport', skipShows: true }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.usingStandings).toBe(false);
    await waitFor(() => expect(getSeasonRecaps).toHaveBeenCalled());
  });

  it('falls back to recap aggregation when no standings doc exists', async () => {
    vi.mocked(getEffectiveDay).mockReturnValue(12);
    vi.mocked(getSeasonStandings).mockResolvedValue(null);
    vi.mocked(getSeasonRecaps).mockResolvedValue([
      {
        offSeasonDay: 2,
        date: 'x',
        shows: [
          {
            eventName: 'Opener',
            location: 'Akron, OH',
            results: [
              {
                uid: 'u1',
                corpsClass: 'worldClass',
                corpsName: 'Crimson Cadence',
                totalScore: 88,
                geScore: 35,
                visualScore: 26,
                musicScore: 27,
                captions: {},
              },
            ],
          },
        ],
      },
    ] as never);

    const { result } = renderHook(() => useScoresData({ skipShows: true }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    await waitFor(() => expect(result.current.aggregatedScores.length).toBe(1));
    expect(result.current.usingStandings).toBe(false);
    expect(result.current.aggregatedScores[0].corpsName).toBe('Crimson Cadence');
  });
});
