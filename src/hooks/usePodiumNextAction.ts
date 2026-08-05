// Assembles the Podium Next Action resolver's inputs from the loaded Podium
// state and the season clock. The ranking and its reasoning live in
// utils/podiumNextAction; this only gathers what it reads.

import { useMemo } from 'react';
import { useSeasonDeadlines } from './useSeasonClock';
import { resolvePodiumNextAction } from '../utils/podiumNextAction';
import type { NextAction } from '../utils/nextAction';
import type { PodiumStateResponse } from '../api/podium';

/**
 * The single most important thing a Podium director should do next, or null
 * when there's nothing to say (no corps yet — the founding flow owns that).
 *
 * @param data     usePodium's `data` payload (getPodiumState), or null.
 * @param enabled  Only resolve when Podium is the active surface.
 */
export function usePodiumNextAction(
  data: PodiumStateResponse | null | undefined,
  enabled: boolean
): NextAction | null {
  // Podium keeps its own class-agnostic drop clock; the caption-change window
  // is irrelevant here, so the class-agnostic call is right.
  const { scoresInMs, scoresPending } = useSeasonDeadlines();

  return useMemo(() => {
    if (!enabled || !data?.exists) return null;

    const state = (data.state || {}) as {
      today?: { restDay?: boolean } | null;
      condition?: { stamina?: number } | null;
      selectedShowDays?: number[] | null;
      planTemplate?: string[] | null;
    };

    return resolvePodiumNextAction({
      exists: true,
      competitionDay: data.competitionDay ?? 0,
      isShowDay: Boolean(data.isShowDay),
      blocksRemainingToday: data.blocksRemainingToday ?? 0,
      blocksUsedToday: data.blocksUsedToday ?? 0,
      restDay: Boolean(state.today?.restDay),
      stamina: state.condition?.stamina ?? 100,
      hasShows: (state.selectedShowDays?.length ?? 0) > 0,
      hasAutoShows: (data.autoDays?.length ?? 0) > 0,
      hasPlan: (state.planTemplate?.length ?? 0) > 0,
      scoresPending,
      scoresInMs,
    });
  }, [enabled, data, scoresPending, scoresInMs]);
}

export default usePodiumNextAction;
