// Tests for the shared score-reveal boundary (useRevealedDay.ts): the
// currentDay - 1 fallback, the drop_plans scoredAt overlay that reveals
// tonight's day the moment it is scored, and the cache invalidation fired
// when a session watches the night flip from unscored to scored.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('../api/season', () => ({
  getDropPlan: vi.fn(),
}));

import { getDropPlan } from '../api/season';
import { queryKeys } from '../lib/queryClient';
import { getShowDateKey } from '../utils/seasonClock';
import { useRevealedDay, useMaxVisibleArticleDay } from './useRevealedDay';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { queryClient, Wrapper };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useRevealedDay', () => {
  it('falls back to currentDay - 1 when no plan doc exists', async () => {
    vi.mocked(getDropPlan).mockResolvedValue(null);
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useRevealedDay(10), { wrapper: Wrapper });

    expect(result.current).toBe(9);
    await waitFor(() => expect(getDropPlan).toHaveBeenCalled());
    expect(result.current).toBe(9);
  });

  it('stays at currentDay - 1 while tonight is planned but not yet scored', async () => {
    vi.mocked(getDropPlan).mockResolvedValue({
      competitionDay: 10,
      dropInstant: new Date().toISOString(),
    });
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useRevealedDay(10), { wrapper: Wrapper });

    await waitFor(() => expect(getDropPlan).toHaveBeenCalled());
    expect(result.current).toBe(9);
  });

  it("reveals tonight's day once the plan carries scoredAt", async () => {
    vi.mocked(getDropPlan).mockResolvedValue({
      competitionDay: 10,
      scoredAt: new Date().toISOString(),
    });
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useRevealedDay(10), { wrapper: Wrapper });

    await waitFor(() => expect(result.current).toBe(10));
  });

  it('never reveals ahead of the scored day on a stale clock', async () => {
    // Client whose currentDay already rolled past the scored day: the
    // rollover fallback (currentDay - 1) wins.
    vi.mocked(getDropPlan).mockResolvedValue({
      competitionDay: 10,
      scoredAt: new Date().toISOString(),
    });
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useRevealedDay(12), { wrapper: Wrapper });

    await waitFor(() => expect(getDropPlan).toHaveBeenCalled());
    expect(result.current).toBe(11);
  });

  it('reveals day 49 at the finals clamp with no plan doc', async () => {
    // currentDay is clamped at 49, so the currentDay - 1 fallback would pin the
    // boundary at 48 forever after the finals 2 AM run and hide the finals
    // scores. getEffectiveDay's finals exception lifts it to 49.
    vi.mocked(getDropPlan).mockResolvedValue(null);
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useRevealedDay(49), { wrapper: Wrapper });

    await waitFor(() => expect(getDropPlan).toHaveBeenCalled());
    expect(result.current).toBe(49);
  });

  it('returns null on day 1 with nothing scored', async () => {
    vi.mocked(getDropPlan).mockResolvedValue(null);
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useRevealedDay(1), { wrapper: Wrapper });

    await waitFor(() => expect(getDropPlan).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });

  it('ignores a plan with scoredAt but no valid competitionDay', async () => {
    vi.mocked(getDropPlan).mockResolvedValue({ scoredAt: new Date().toISOString() });
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useRevealedDay(10), { wrapper: Wrapper });

    await waitFor(() => expect(getDropPlan).toHaveBeenCalled());
    expect(result.current).toBe(9);
  });

  it('invalidates score caches when the night flips from unscored to scored', async () => {
    vi.mocked(getDropPlan).mockResolvedValue({
      competitionDay: 10,
      dropInstant: new Date().toISOString(),
    });
    const { queryClient, Wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useRevealedDay(10), { wrapper: Wrapper });

    // Wait for the unscored plan to actually land in the cache (so the hook
    // has observed the "unscored" state) before flipping it to scored.
    const planKey = queryKeys.dropPlan(getShowDateKey());
    await waitFor(() => expect(queryClient.getQueryData(planKey)).toBeTruthy());
    expect(result.current).toBe(9);
    invalidateSpy.mockClear();

    // Simulate the poll seeing the night get scored.
    act(() => {
      queryClient.setQueryData(planKey, {
        competitionDay: 10,
        scoredAt: new Date().toISOString(),
      });
    });

    await waitFor(() => expect(result.current).toBe(10));
    await waitFor(() => {
      const invalidatedKeys = invalidateSpy.mock.calls.map(([f]) => f?.queryKey?.[0]);
      expect(invalidatedKeys).toEqual(
        expect.arrayContaining([
          'fantasyRecaps',
          'seasonStandings',
          'historicalScores',
          'podiumRecaps',
        ])
      );
    });
  });

  it('does not invalidate on a fresh load that already sees scoredAt', async () => {
    vi.mocked(getDropPlan).mockResolvedValue({
      competitionDay: 10,
      scoredAt: new Date().toISOString(),
    });
    const { queryClient, Wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useRevealedDay(10), { wrapper: Wrapper });

    await waitFor(() => expect(result.current).toBe(10));
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});

describe('useMaxVisibleArticleDay', () => {
  it('keeps the base gate when tonight is not scored', async () => {
    vi.mocked(getDropPlan).mockResolvedValue(null);
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useMaxVisibleArticleDay(10), { wrapper: Wrapper });

    await waitFor(() => expect(getDropPlan).toHaveBeenCalled());
    expect(result.current).toBe(9);
  });

  it("bumps the gate to tonight's day once scored", async () => {
    vi.mocked(getDropPlan).mockResolvedValue({
      competitionDay: 10,
      scoredAt: new Date().toISOString(),
    });
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useMaxVisibleArticleDay(10), { wrapper: Wrapper });

    await waitFor(() => expect(result.current).toBe(10));
  });

  it('stays off (null) when the base gate is off', async () => {
    vi.mocked(getDropPlan).mockResolvedValue({
      competitionDay: 49,
      scoredAt: new Date().toISOString(),
    });
    const { Wrapper } = createWrapper();
    // Day >= 49: the base gate is off so every article of the finished
    // season stays visible — the overlay must not re-enable gating.
    const { result } = renderHook(() => useMaxVisibleArticleDay(49), { wrapper: Wrapper });

    await waitFor(() => expect(getDropPlan).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });
});
