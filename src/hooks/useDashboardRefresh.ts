// Pull-to-refresh for the dashboard.
//
// Most of what the dashboard shows needs no refreshing: the profile and season
// stores are live Firestore listeners, so corps, lineup, XP, coins, and streak
// are already current to the millisecond. What is cached — and what a director
// pulling down is actually reaching for — is the nightly drop: recaps, season
// standings, and the season's corps pool.
//
// Invalidating by prefix rather than by exact key is deliberate: the recap keys
// are nested (`['fantasyRecaps', uid]` covers the full archive, the bounded
// recent list, and each single-day entry), so a prefix hits every variant the
// page might be holding.

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import { useHaptic } from './useHaptic';

export function useDashboardRefresh(seasonUid?: string | null): () => Promise<void> {
  const queryClient = useQueryClient();
  const { trigger: haptic } = useHaptic();

  return useCallback(async () => {
    haptic?.('pull');

    // Nothing season-scoped to refetch before the season store hydrates; the
    // gesture should still feel like it did something rather than error.
    if (!seasonUid) {
      haptic?.('success');
      return;
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.fantasyRecaps(seasonUid) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.podiumRecaps(seasonUid) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.seasonStandings(seasonUid) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.corpsValues(seasonUid) }),
    ]);

    haptic?.('success');
  }, [queryClient, seasonUid, haptic]);
}

export default useDashboardRefresh;
