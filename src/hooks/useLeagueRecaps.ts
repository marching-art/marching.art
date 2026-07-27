// src/hooks/useLeagueRecaps.ts
// React Query access to the season recap archive the league tables are built
// from.

import { useQuery } from '@tanstack/react-query';
import { getSeasonRecaps } from '../api/season';
import { queryKeys } from '../lib/queryClient';

const FIVE_MINUTES = 5 * 60 * 1000;

/**
 * Fetch the full recap archive for a season.
 *
 * Shares the exact cache entry the Scores page and Dashboard use
 * (`queryKeys.fantasyRecaps`), so opening a league reuses an already
 * downloaded archive instead of re-reading every day document. The seasonUid
 * passed here is always the current season, so the 5-minute freshness window
 * applies — archived seasons pin `staleTime: Infinity` in useScoresData
 * because past days are immutable.
 */
export function useLeagueRecaps(seasonUid: string | undefined, options?: { enabled?: boolean }) {
  const enabled = (options?.enabled ?? true) && !!seasonUid;

  return useQuery({
    queryKey: queryKeys.fantasyRecaps(seasonUid || ''),
    queryFn: () => getSeasonRecaps(seasonUid!),
    enabled,
    staleTime: FIVE_MINUTES,
  });
}
