// useLeaguePoolFacts — the per-day fact the join-league-pool daily challenge
// needs: has the director entered TODAY's prediction pool in any of their
// leagues? Pool entries live at leagues/{id}/pools/{gameDay}.entrants[uid], off
// the profile, so (like the Podium challenge facts) they have to be read
// separately and threaded down to the Director's Report.
//
// react-query keeps the read cached and refetches on mount/focus, so entering a
// pool on the Leagues page and returning to the dashboard reflects without a
// manual refresh — which is what lets the challenge auto-claim.

import { useQuery } from '@tanstack/react-query';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, paths } from '../api/client';

export interface LeaguePoolFacts {
  hasEntered: boolean;
}

const EMPTY: LeaguePoolFacts = { hasEntered: false };

/**
 * @param leagueIds - profile.leagueIds (the leagues the director belongs to)
 * @param gameDay   - the current game day string (getGameDay())
 */
export function useLeaguePoolFacts(
  leagueIds: string[] | null | undefined,
  gameDay: string
): LeaguePoolFacts {
  const uid = auth.currentUser?.uid ?? null;
  const ids = Array.isArray(leagueIds) ? leagueIds : [];

  const { data } = useQuery({
    // Sorted ids keep the key stable regardless of membership order.
    queryKey: ['leaguePoolFacts', uid, gameDay, [...ids].sort().join(',')],
    enabled: Boolean(uid) && ids.length > 0 && Boolean(gameDay),
    staleTime: 60 * 1000,
    queryFn: async (): Promise<LeaguePoolFacts> => {
      if (!uid || ids.length === 0) return EMPTY;
      const snaps = await Promise.all(
        ids.map((id) => getDoc(doc(db, paths.leaguePool(id, gameDay))))
      );
      const hasEntered = snaps.some(
        (snap) => snap.exists() && Boolean((snap.data() as { entrants?: Record<string, unknown> })?.entrants?.[uid])
      );
      return { hasEntered };
    },
  });

  return data ?? EMPTY;
}

export default useLeaguePoolFacts;
