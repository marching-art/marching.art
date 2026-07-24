// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// Tests for the Dashboard score hooks (useDashboardScores.js) — the wiring
// between react-query, the api/season service, and the per-caption/recent-
// results derivations. The scoring math itself is covered by
// utils/dashboardScoring.test.ts; here that module is mocked so these tests
// pin the data flow: which years get fetched, how the shared recap cache is
// filtered, and the SoundSport/empty-slot edge cases.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../api/season', () => ({
  getSeasonRecaps: vi.fn(),
  getHistoricalScoresForYear: vi.fn(),
  getRecentPodiumRecaps: vi.fn(),
  RECENT_RECAP_DAYS: 10,
}));

vi.mock('../utils/dashboardScoring', () => ({
  getEffectiveDay: vi.fn(),
  processCaptionScores: vi.fn(),
}));

// The hook imports CAPTIONS from the Dashboard barrel and formatRecapDate
// from useScoresData; both transitively import api/client.ts, which
// initializes Firebase Auth at module load and throws without real env vars
// (exactly what happens in CI). Mock them so this test never touches Firebase.
vi.mock('../components/Dashboard', () => ({
  CAPTIONS: [
    { id: 'GE1' },
    { id: 'GE2' },
    { id: 'VP' },
    { id: 'VA' },
    { id: 'CG' },
    { id: 'B' },
    { id: 'MA' },
    { id: 'P' },
  ],
}));

vi.mock('./useScoresData', () => ({
  formatRecapDate: vi.fn(() => 'Jan 1'),
}));

import { getSeasonRecaps, getHistoricalScoresForYear, getRecentPodiumRecaps } from '../api/season';
import { getEffectiveDay, processCaptionScores } from '../utils/dashboardScoring';
import {
  useLineupScores,
  useRecentResults,
  usePodiumRecentResults,
  useBestInShowCount,
} from './useDashboardScores';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useLineupScores', () => {
  it('returns empty data without fetching when the lineup is empty', () => {
    getEffectiveDay.mockReturnValue(9);
    const { result } = renderHook(() => useLineupScores({}, 10, 'worldClass'), {
      wrapper: createWrapper(),
    });

    expect(result.current.lineupScoreData).toEqual({});
    expect(result.current.lineupScoresLoading).toBe(false);
    expect(getHistoricalScoresForYear).not.toHaveBeenCalled();
  });

  it('returns empty data when no day has been processed yet (effectiveDay null)', () => {
    getEffectiveDay.mockReturnValue(null);
    const { result } = renderHook(
      () => useLineupScores({ GE1: 'Blue Devils|2023' }, 1, 'worldClass'),
      { wrapper: createWrapper() }
    );

    expect(result.current.lineupScoreData).toEqual({});
    expect(result.current.lineupScoresLoading).toBe(false);
    expect(getHistoricalScoresForYear).not.toHaveBeenCalled();
  });

  it('fetches each source year once and maps caption scores', async () => {
    getEffectiveDay.mockReturnValue(9);
    getHistoricalScoresForYear.mockImplementation(async (year) => [{ offSeasonDay: 9, year }]);
    processCaptionScores.mockReturnValue({ score: 85.5, trend: 'up', nextShow: null });

    const lineup = {
      GE1: 'Blue Devils|2023',
      GE2: 'Bluecoats|2023',
      VP: 'Carolina Crown|2024',
    };
    const { result } = renderHook(() => useLineupScores(lineup, 10, 'worldClass'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.lineupScoresLoading).toBe(false));

    // One fetch per unique year, not per caption
    expect(getHistoricalScoresForYear).toHaveBeenCalledTimes(2);
    expect(getHistoricalScoresForYear).toHaveBeenCalledWith('2023');
    expect(getHistoricalScoresForYear).toHaveBeenCalledWith('2024');

    // Filled slots get processed scores; empty slots get the null entry
    expect(result.current.lineupScoreData.GE1).toEqual({
      score: 85.5,
      trend: 'up',
      nextShow: null,
    });
    expect(result.current.lineupScoreData.CG).toEqual({
      score: null,
      trend: null,
      nextShow: null,
    });
    // processCaptionScores received the corps parsed out of "name|year"
    expect(processCaptionScores).toHaveBeenCalledWith(expect.anything(), 'Blue Devils', 'GE1', 9);
  });

  it('suppresses numeric scores for SoundSport but keeps next-show info', async () => {
    getEffectiveDay.mockReturnValue(9);
    getHistoricalScoresForYear.mockResolvedValue([{ offSeasonDay: 9 }]);
    processCaptionScores.mockReturnValue({
      score: 85.5,
      trend: 'up',
      nextShow: { day: 11, eventName: 'Big Show' },
    });

    const { result } = renderHook(
      () => useLineupScores({ GE1: 'Genesis|2022' }, 10, 'soundSport'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.lineupScoresLoading).toBe(false));

    expect(result.current.lineupScoreData.GE1).toEqual({
      score: null,
      trend: null,
      nextShow: { day: 11, eventName: 'Big Show' },
    });
  });
});

describe('useRecentResults', () => {
  const user = { uid: 'alice' };
  const seasonData = { seasonUid: 'season-1', schedule: null };

  const recap = (day, results) => ({
    offSeasonDay: day,
    shows: [{ eventName: `Show ${day}`, results }],
  });
  const aliceResult = { uid: 'alice', corpsClass: 'worldClass', totalScore: 80, placement: 2 };

  it('returns [] when required inputs are missing', () => {
    const { result } = renderHook(() => useRecentResults(null, seasonData, 'worldClass', 10), {
      wrapper: createWrapper(),
    });
    expect(result.current).toEqual([]);
    expect(getSeasonRecaps).not.toHaveBeenCalled();
  });

  it('returns the most recent processed results for the active class only', async () => {
    getEffectiveDay.mockReturnValue(5);
    getSeasonRecaps.mockResolvedValue([
      recap(4, [aliceResult]),
      // Day 6 is beyond the effective day — must be filtered out
      recap(6, [{ ...aliceResult, totalScore: 99 }]),
      recap(5, [{ ...aliceResult, totalScore: 85 }]),
      // Other class and other user — must be ignored
      recap(3, [{ uid: 'alice', corpsClass: 'aClass', totalScore: 70 }]),
      recap(2, [{ uid: 'bob', corpsClass: 'worldClass', totalScore: 60 }]),
    ]);

    const { result } = renderHook(() => useRecentResults(user, seasonData, 'worldClass', 6), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.length).toBeGreaterThan(0));

    // Sorted most-recent first, capped to effective day, class-filtered
    expect(result.current.map((r) => r.score)).toEqual([85, 80]);
    expect(result.current[0].eventName).toBe('Show 5');
  });

  it('caps the list at 5 results', async () => {
    getEffectiveDay.mockReturnValue(10);
    getSeasonRecaps.mockResolvedValue(
      [10, 9, 8, 7, 6, 5, 4].map((day) => recap(day, [aliceResult]))
    );

    const { result } = renderHook(() => useRecentResults(user, seasonData, 'worldClass', 11), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.length).toBeGreaterThan(0));
    expect(result.current).toHaveLength(5);
  });
});

describe('usePodiumRecentResults', () => {
  const user = { uid: 'alice' };
  const seasonData = { seasonUid: 'season-1', schedule: null };

  // Podium recaps key by competitionDay and rank per show (result.place).
  const recap = (day, results) => ({
    competitionDay: day,
    shows: [{ eventName: `Podium Show ${day}`, location: 'Somewhere, USA', results }],
  });
  const aliceResult = {
    uid: 'alice',
    corpsName: 'Rohn Regiment',
    corpsClass: 'podiumClass',
    totalScore: 82.5,
    place: 3,
  };

  it('returns [] when disabled (non-Podium class active)', () => {
    const { result } = renderHook(() => usePodiumRecentResults(user, seasonData, 10, false), {
      wrapper: createWrapper(),
    });
    expect(result.current).toEqual([]);
    expect(getRecentPodiumRecaps).not.toHaveBeenCalled();
  });

  it('returns the most recent processed Podium results for this director', async () => {
    getEffectiveDay.mockReturnValue(5);
    getRecentPodiumRecaps.mockResolvedValue([
      recap(4, [aliceResult]),
      // Day 6 is beyond the effective day — filtered out
      recap(6, [{ ...aliceResult, totalScore: 99 }]),
      recap(5, [{ ...aliceResult, totalScore: 88 }]),
      // Another director — ignored
      recap(3, [{ uid: 'bob', corpsClass: 'podiumClass', totalScore: 70, place: 1 }]),
    ]);

    const { result } = renderHook(() => usePodiumRecentResults(user, seasonData, 6, true), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.length).toBeGreaterThan(0));

    // Most-recent first, capped to effective day, filtered to this uid.
    expect(result.current.map((r) => r.score)).toEqual([88, 82.5]);
    expect(result.current[0].eventName).toBe('Podium Show 5');
    // Per-show placement maps from result.place.
    expect(result.current[1].placement).toBe(3);
  });
});

describe('useBestInShowCount', () => {
  const corps = { corpsName: 'My SoundSport' };
  const show = (scores) => ({ scores });

  it('counts shows where the corps has the top score', () => {
    const allShows = [
      show([
        { corpsName: 'My SoundSport', score: 90 },
        { corpsName: 'Rival', score: 80 },
      ]),
      show([
        { corpsName: 'My SoundSport', score: 70 },
        { corpsName: 'Rival', score: 88 },
      ]),
      show([
        { corpsName: 'My SoundSport', score: 85 },
        { corpsName: 'Rival', score: 85 },
      ]),
    ];

    const { result } = renderHook(() => useBestInShowCount(corps, 'soundSport', allShows));
    // Wins show 1 outright and ties for top in show 3
    expect(result.current).toBe(2);
  });

  it('returns 0 for non-SoundSport classes', () => {
    const allShows = [show([{ corpsName: 'My SoundSport', score: 90 }])];
    const { result } = renderHook(() => useBestInShowCount(corps, 'worldClass', allShows));
    expect(result.current).toBe(0);
  });
});
