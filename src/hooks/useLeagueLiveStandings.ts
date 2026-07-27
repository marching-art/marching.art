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
  /**
   * True when these rows are the client-side fallback rather than the
   * authoritative backend table — the view should say so rather than present
   * a provisional record as settled.
   */
  isProvisional: boolean;
}

/**
 * The league's standings, from the ONE source that owns them.
 *
 * This used to have two writers racing each other. The streamed backend
 * document and a table the client computed from recaps were layered
 * last-writer-wins: the subscription landed first, the computation overwrote
 * it, a later backend push overwrote that. The two did not agree — the server
 * resolved matchups on each corps' most recent show score while the client
 * summed the week's recap scores — so a member's record, rank, streak and
 * playoff position visibly changed with nothing happening in the game. Nothing
 * erodes trust in a competition faster.
 *
 * The backend document is now authoritative, always. The computed table is a
 * FALLBACK only, used when the league has no standings rows at all (a league
 * whose first week has not resolved yet, or one created before the backend
 * materialized standings). Once the server has rows, they win and stay won —
 * a later computation can never overwrite them.
 *
 * Local state rather than `queryClient.setQueryData` because this carries a
 * `lastUpdated` stamp that exists only on the client, and has no second
 * consumer that would benefit from cache sharing. `useLeagueSubscription` in
 * useLeagues.ts does use setQueryData — correctly, because `useLeague` already
 * owns that key and the snapshot is its only writer.
 *
 * @param leagueId  League whose standings document to stream.
 * @param computedStandings  The locally computed fallback table, or null when
 *   there is nothing to compute from yet.
 */
export function useLeagueLiveStandings(
  leagueId: string | undefined,
  computedStandings: LeagueMemberStanding[] | null
): LiveStandingsResult {
  const [serverStandings, setServerStandings] = useState<LeagueStandingRow[] | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    setServerStandings(null);
    setLastUpdated(null);
    if (!leagueId) return;

    const unsubscribe = subscribeToStandings(
      leagueId,
      (standingsData) => {
        if (standingsData && standingsData.length > 0) {
          // Backend standings are already sorted (helpers/leagueStandings.js
          // compareStandingRows) — rank is position, never recomputed here.
          const rows = standingsData as unknown as LeagueStandingRow[];
          setServerStandings(
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

  return {
    standings: serverStandings ?? computedStandings ?? [],
    // Only the server document has a real "last updated" moment; the fallback
    // table is derived on the fly and must not claim one.
    lastUpdated: serverStandings ? lastUpdated : null,
    /** True while the view is showing the client-side fallback. */
    isProvisional: !serverStandings,
  };
}
