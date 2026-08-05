// Assembles the Next Action resolver's inputs from live dashboard state.
//
// Everything here is already on the dashboard — this hook only gathers it in
// one place so utils/nextAction can stay pure. The ranking itself, and the
// gameplay reasoning behind it, lives there.

import { useMemo } from 'react';
import { useSeasonStore } from '../store/seasonStore';
import { useSeasonDeadlines } from './useSeasonClock';
import {
  computeDirectorsReport,
  type DirectorsReportProfile,
  type RecentResult,
} from '../utils/directorsReport';
import { getClaimableJourneySteps, type JourneyProfile } from '../utils/journeyProgress';
import { getClaimableLadderTiers, type LadderProfile } from '../utils/seasonLadder';
import {
  resolveNextAction,
  type ClaimableReward,
  type NextAction,
  type NextActionCorps,
} from '../utils/nextAction';

/**
 * Everything the three contributing resolvers read off the profile. Each owns
 * its own narrow view; the hook needs all of them at once.
 */
export type NextActionProfile = JourneyProfile & DirectorsReportProfile & LadderProfile;

export interface UseNextActionOptions {
  profile: NextActionProfile | null;
  activeCorps: NextActionCorps | null;
  activeCorpsClass: string | null;
  recentResults: RecentResult[];
  seasonUid?: string | null;
}

/**
 * Pick the reward to advertise when several are waiting.
 *
 * Journey steps come first: they are the first-season quest line, so a
 * director who has one pending is by definition still learning the game —
 * exactly the audience this card exists for. Ladder tiers are a long-run XP
 * reward that keeps just as well for one more scroll.
 */
function pickClaimable(
  profile: NextActionProfile | null,
  resultCount: number,
  seasonUid?: string | null
): ClaimableReward | null {
  const journeySteps = getClaimableJourneySteps(profile, resultCount);
  const ladderTiers = getClaimableLadderTiers(profile, seasonUid);
  const count = journeySteps.length + ladderTiers.length;
  if (count === 0) return null;

  if (journeySteps.length > 0) {
    return { count, label: journeySteps[0].title, targetId: 'journey-panel' };
  }
  return {
    count,
    label: `Season Ladder Tier ${ladderTiers[0].tier}`,
    targetId: 'directors-report',
  };
}

/**
 * The single most important thing this director should do next, or null when
 * there is no meaningful answer (Podium, which has its own guided surfaces).
 */
export function useNextAction({
  profile,
  activeCorps,
  activeCorpsClass,
  recentResults,
  seasonUid,
}: UseNextActionOptions): NextAction | null {
  const currentDay = useSeasonStore((s) => s.currentDay);
  const currentWeek = useSeasonStore((s) => s.currentWeek);

  // Class-aware: the Championship-week lockout differs per class, and the
  // hero must not offer a lineup button to a class that is done for the year.
  const { scoresInMs, scoresPending, trade } = useSeasonDeadlines(30000, activeCorpsClass);

  const daily = useMemo(
    () =>
      computeDirectorsReport({
        profile,
        recentResults,
        corpsClass: activeCorpsClass,
      }),
    [profile, recentResults, activeCorpsClass]
  );

  const claimable = useMemo(
    () => pickClaimable(profile, recentResults.length, seasonUid),
    [profile, recentResults.length, seasonUid]
  );

  return useMemo(
    () =>
      resolveNextAction({
        corps: activeCorps,
        corpsClass: activeCorpsClass,
        currentDay: currentDay ?? null,
        currentWeek: currentWeek ?? null,
        captionWindow: trade,
        dailyDone: daily.doneCount,
        dailyTotal: daily.totalCount,
        claimable,
        scoresPending,
        scoresInMs,
      }),
    [
      activeCorps,
      activeCorpsClass,
      currentDay,
      currentWeek,
      trade,
      daily.doneCount,
      daily.totalCount,
      claimable,
      scoresPending,
      scoresInMs,
    ]
  );
}

export default useNextAction;
