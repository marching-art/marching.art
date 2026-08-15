// Tests for the Podium Class path in useTickerData — the wiring that pulls the
// separate podium-recaps pipeline into the shell ticker. The fantasy-class
// aggregation is exercised in situ by the Scores/Dashboard hooks; here we pin
// the Podium-specific behavior: the feature-flag gate, the reveal boundary, and
// the per-division "most recent score per corps" grouping.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

vi.mock('../api/season', () => ({
  getRecentSeasonRecaps: vi.fn(() => Promise.resolve([])),
  getRecentPodiumRecaps: vi.fn(() => Promise.resolve([])),
  RECENT_RECAP_DAYS: 10,
}));

const seasonState = {
  seasonUid: 'season-1',
  currentDay: 6,
  seasonData: { seasonUid: 'season-1' },
};
vi.mock('../store/seasonStore', () => ({
  useSeasonStore: (selector: (s: typeof seasonState) => unknown) => selector(seasonState),
}));

const revealedDay = { value: 6 };
vi.mock('./useRevealedDay', () => ({
  useRevealedDay: () => revealedDay.value,
}));

const podiumEnabled = { value: true };
vi.mock('./useFeatures', () => ({
  usePodiumEnabled: () => podiumEnabled.value,
}));

// useScoresData transitively imports api/client (Firebase init); stub the two
// pure helpers the ticker uses so the test never touches Firebase.
vi.mock('./useScoresData', () => ({
  calculateCaptionAggregates: () => ({ GE_Total: 0, VIS_Total: 0, MUS_Total: 0, Total_Score: 0 }),
  calculateTrend: () => ({ trend: 'stable' as const, values: [], direction: 0 }),
}));

vi.mock('../utils/recap', () => ({
  toRecapDate: () => new Date('2026-08-15T00:00:00Z'),
}));

import { getRecentPodiumRecaps } from '../api/season';
import { useTickerData } from './useTickerData';

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

// A podium recap day: one show, results split across divisions.
const podiumRecap = (competitionDay: number, results: Array<Record<string, unknown>>) => ({
  competitionDay,
  shows: [{ eventName: `Podium Show ${competitionDay}`, location: 'Somewhere, USA', results }],
});

beforeEach(() => {
  vi.clearAllMocks();
  revealedDay.value = 6;
  podiumEnabled.value = true;
});

describe('useTickerData — Podium', () => {
  it('does not fetch Podium recaps when the feature flag is off', async () => {
    podiumEnabled.value = false;
    const { result } = renderHook(() => useTickerData(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getRecentPodiumRecaps).not.toHaveBeenCalled();
    expect(result.current.podiumData.availableDivisions).toEqual([]);
  });

  it('groups the most recent score per corps by division, ranked and ordered', async () => {
    (getRecentPodiumRecaps as ReturnType<typeof vi.fn>).mockResolvedValue([
      podiumRecap(5, [
        { corpsName: 'World A', uid: 'w1', division: 'worldClass', totalScore: 90 },
        { corpsName: 'World B', uid: 'w2', division: 'worldClass', totalScore: 80 },
        { corpsName: 'Open A', uid: 'o1', division: 'openClass', totalScore: 70 },
        { corpsName: 'A One', uid: 'a1', division: 'aClass', totalScore: 60 },
      ]),
      // Day 6 is the latest revealed day — World A's newer, higher score wins.
      podiumRecap(6, [{ corpsName: 'World A', uid: 'w1', division: 'worldClass', totalScore: 95 }]),
    ]);

    const { result } = renderHook(() => useTickerData(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.podiumData.availableDivisions.length).toBe(3));

    const { byDivision, availableDivisions } = result.current.podiumData;
    // World → Open → A ordering.
    expect(availableDivisions).toEqual(['worldClass', 'openClass', 'aClass']);
    // Most-recent World A score (95 from Day 6), ranked above World B.
    expect(byDivision.worldClass.scores.map((s) => [s.fullName, s.score])).toEqual([
      ['World A', '95.000'],
      ['World B', '80.000'],
    ]);
    expect(byDivision.worldClass.label).toBe('Podium · World');
    expect(byDivision.openClass.scores[0].fullName).toBe('Open A');
    expect(byDivision.aClass.scores[0].fullName).toBe('A One');
    expect(result.current.hasData).toBe(true);
  });

  it('excludes days beyond the revealed boundary', async () => {
    revealedDay.value = 5;
    (getRecentPodiumRecaps as ReturnType<typeof vi.fn>).mockResolvedValue([
      podiumRecap(5, [{ corpsName: 'World A', uid: 'w1', division: 'worldClass', totalScore: 90 }]),
      // Day 6 has not revealed yet — its higher score must be ignored.
      podiumRecap(6, [{ corpsName: 'World A', uid: 'w1', division: 'worldClass', totalScore: 99 }]),
    ]);

    const { result } = renderHook(() => useTickerData(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.podiumData.availableDivisions.length).toBe(1));
    expect(result.current.podiumData.byDivision.worldClass.scores[0].score).toBe('90.000');
  });

  it('shows no Podium data before the first reveal (revealedDay null)', async () => {
    revealedDay.value = null as unknown as number;
    (getRecentPodiumRecaps as ReturnType<typeof vi.fn>).mockResolvedValue([
      podiumRecap(1, [{ corpsName: 'World A', uid: 'w1', division: 'worldClass', totalScore: 90 }]),
    ]);

    const { result } = renderHook(() => useTickerData(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.podiumData.availableDivisions).toEqual([]);
  });
});
