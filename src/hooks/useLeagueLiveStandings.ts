// src/hooks/useLeagueLiveStandings.ts
// The league detail view's standings feed: the backend's materialized
// standings document, streamed, layered over the locally computed table.

import { useEffect, useState } from 'react';
import { subscribeToStandings } from '../api/leagues';
import type { LeagueMemberStanding } from '../utils/leagueStats';

/**
 * A standings row as rendered. Only the fields the view reads are declared;
 * backend rows carry more (corps name, medals, placements) and those survive
 * the spread below untouched for the JS tab components that render them.
 */
export type LeagueStandingRow = LeagueMemberStanding;

export interface LiveStandingsResult {
  standings: LeagueStandingRow[];
  /** When the backend last pushed a standings update, or null if never. */
  lastUpdated: Date | null;
}

/**
 * Why local state rather than `queryClient.setQueryData`:
 *
 * This feed has two writers — the streamed backend document and the table the
 * client computes from recaps — and the view has always been last-writer-wins
 * between them (the subscription typically lands first, the computation
 * overwrites it, and any later backend push wins again). Modelling that in the
 * query cache would mean a `useQuery` whose queryFn never resolves, purely so
 * something can read back what the snapshot wrote. It also carries a
 * `lastUpdated` stamp that exists only on the client and has no place in a
 * cached server payload, and no second consumer that would benefit from cache
 * sharing. `useLeagueSubscription` in useLeagues.ts does use setQueryData —
 * correctly, because `useLeague` already owns that key and the snapshot is the
 * only writer.
 *
 * @param leagueId  League whose standings document to stream.
 * @param computedStandings  The locally computed table, or null when there is
 *   nothing to compute from yet. Null is never published, so an empty season
 *   cannot blank out a backend standings push.
 */
export function useLeagueLiveStandings(
  leagueId: string | undefined,
  computedStandings: LeagueMemberStanding[] | null
): LiveStandingsResult {
  const [standings, setStandings] = useState<LeagueStandingRow[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    if (!computedStandings) return;
    setStandings(computedStandings);
  }, [computedStandings]);

  useEffect(() => {
    if (!leagueId) return;

    const unsubscribe = subscribeToStandings(
      leagueId,
      (standingsData) => {
        if (standingsData && standingsData.length > 0) {
          // Backend standings are already sorted - use them directly
          const rows = standingsData as unknown as LeagueStandingRow[];
          setStandings(
            rows.map((s, idx) => ({
              ...s,
              currentRank: idx + 1,
              trend:
                s.streak > 2 && s.streakType === 'W'
                  ? 'up'
                  : s.streak > 2 && s.streakType === 'L'
                    ? 'down'
                    : 'same',
            }))
          );
          setLastUpdated(new Date());
        }
      },
      (error) => {
        console.error('Standings subscription error:', error);
      }
    );

    return () => unsubscribe();
  }, [leagueId]);

  return { standings, lastUpdated };
}
