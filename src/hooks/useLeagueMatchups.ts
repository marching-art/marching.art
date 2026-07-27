// src/hooks/useLeagueMatchups.ts
// React Query access to a league's generated matchup schedule.

import { useQuery } from '@tanstack/react-query';
import { getLeagueMatchups } from '../api/leagues';
import { queryKeys } from '../lib/queryClient';
import type { LeagueMatchupDoc } from '../utils/leagueStats';

const FIVE_MINUTES = 5 * 60 * 1000;

/**
 * Fetch every `week-N` matchup document for a league.
 *
 * The schedule only changes when the backend regenerates it (weekly), so the
 * default freshness window is plenty and re-entering a league inside it costs
 * nothing.
 */
export function useLeagueMatchups(leagueId: string | undefined, options?: { enabled?: boolean }) {
  const enabled = (options?.enabled ?? true) && !!leagueId;

  return useQuery({
    queryKey: queryKeys.leagueMatchups(leagueId || ''),
    queryFn: () => getLeagueMatchups(leagueId!) as Promise<LeagueMatchupDoc[]>,
    enabled,
    staleTime: FIVE_MINUTES,
  });
}
