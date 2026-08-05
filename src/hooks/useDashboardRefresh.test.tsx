import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const haptic = vi.fn();
vi.mock('./useHaptic', () => ({ useHaptic: () => ({ trigger: haptic }) }));

import { useDashboardRefresh } from './useDashboardRefresh';

function setup(seasonUid?: string | null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries').mockResolvedValue(undefined);
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useDashboardRefresh(seasonUid), { wrapper });
  return { result, invalidate };
}

describe('useDashboardRefresh', () => {
  beforeEach(() => haptic.mockReset());

  it('invalidates the nightly-drop caches for the active season', async () => {
    const { result, invalidate } = setup('s1');
    await act(async () => {
      await result.current();
    });

    const keys = invalidate.mock.calls.map((call) => JSON.stringify(call[0]?.queryKey));
    // Prefixes, so every nested recap variant the page may hold is covered.
    expect(keys).toContain(JSON.stringify(['fantasyRecaps', 's1']));
    expect(keys).toContain(JSON.stringify(['podiumRecaps', 's1']));
    expect(keys).toContain(JSON.stringify(['seasonStandings', 's1']));
    expect(keys).toContain(JSON.stringify(['corpsValues', 's1']));
  });

  it('does not invalidate the profile or season stores', async () => {
    // Both are live Firestore listeners; there is nothing stale to refetch.
    const { result, invalidate } = setup('s1');
    await act(async () => {
      await result.current();
    });
    const keys = invalidate.mock.calls.map((call) => String(call[0]?.queryKey?.[0]));
    expect(keys).not.toContain('profile');
    expect(keys).not.toContain('season');
  });

  it('completes quietly before the season store has hydrated', async () => {
    const { result, invalidate } = setup(null);
    await act(async () => {
      await result.current();
    });
    expect(invalidate).not.toHaveBeenCalled();
    // The gesture still resolves and still feels acknowledged.
    expect(haptic).toHaveBeenCalledWith('success');
  });

  it('acknowledges the pull and then the completion', async () => {
    const { result } = setup('s1');
    await act(async () => {
      await result.current();
    });
    expect(haptic.mock.calls.map((c) => c[0])).toEqual(['pull', 'success']);
  });
});
