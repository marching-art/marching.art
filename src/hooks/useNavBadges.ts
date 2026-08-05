// Live nav-badge state, wired to the global stores. The rules themselves —
// and the reasoning for what is and is not badged — live in utils/navBadges.

import { useMemo } from 'react';
import { useProfileStore } from '../store/profileStore';
import { useSeasonStore } from '../store/seasonStore';
import { deriveNavBadges, type NavBadges } from '../utils/navBadges';

export type { NavBadges };

/** Live badge state for the mobile nav, from the global stores. */
export function useNavBadges(): NavBadges {
  const corps = useProfileStore((s) => s.corps);
  const currentDay = useSeasonStore((s) => s.currentDay);
  const currentWeek = useSeasonStore((s) => s.currentWeek);

  return useMemo(
    () => deriveNavBadges(corps, currentDay, currentWeek),
    [corps, currentDay, currentWeek]
  );
}

export default useNavBadges;
