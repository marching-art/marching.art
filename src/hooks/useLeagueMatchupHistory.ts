// src/hooks/useLeagueMatchupHistory.ts
// Finished seasons' matchup weeks, for the views that look backwards.

import { useQuery } from '@tanstack/react-query';

import { getLeagueMatchupHistory } from '../api/leagues';
import { queryKeys } from '../lib/queryClient';
import type { RecordWeekDoc } from '../utils/leagueRecords';

const AN_HOUR = 60 * 60 * 1000;

/**
 * Archived matchup weeks for a league.
 *
 * Enabled by the caller, not by default: only the Record Book reads this, and
 * it lives behind a tab. History is append-only and only changes at season
 * rollover, so it is cached for an hour rather than the usual few minutes.
 */
export function useLeagueMatchupHistory(
  leagueId: string | undefined,
  options?: { enabled?: boolean }
) {
  const enabled = (options?.enabled ?? true) && !!leagueId;

  return useQuery({
    queryKey: queryKeys.leagueMatchupHistory(leagueId || ''),
    queryFn: () => getLeagueMatchupHistory(leagueId!) as Promise<RecordWeekDoc[]>,
    enabled,
    staleTime: AN_HOUR,
  });
}
