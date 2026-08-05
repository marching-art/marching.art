// =============================================================================
// PODIUM CHALLENGE FACTS
// =============================================================================
// The two daily-challenge facts the profile document can't answer for a Podium
// director, because Podium keeps its show picks and (as a string, not a
// `{theme}` object) its concept in a server-only subcollection.
//
// The client's daily-challenge predicates (utils/dailyChallenges) OR these in,
// so a Podium-only director's register-show / set-show-concept can auto-claim
// and their daily set stays winnable. Mirrors the server's
// loadPodiumChallengeFacts (functions/src/helpers/podium/store.js).

import type { PodiumChallengeFacts } from './directorsReport';

/** The subset of the getPodiumState response this reads. */
interface PodiumStateData {
  exists?: boolean;
  state?: {
    selectedShows?: Record<string, unknown> | null;
    selectedShowDays?: number[] | null;
    showConcept?: string | null;
  } | null;
}

/**
 * Derive the Podium show/concept facts from a usePodium `data` payload, or null
 * when the director has no Podium corps (so callers treat it as "no facts",
 * not "facts that are false").
 */
export function derivePodiumChallengeFacts(
  data: PodiumStateData | null | undefined
): PodiumChallengeFacts | null {
  const state = data?.state;
  if (!data?.exists || !state) return null;

  const showCount =
    (state.selectedShowDays?.length ?? 0) || Object.keys(state.selectedShows || {}).length;

  return {
    hasShows: showCount > 0,
    hasConcept: typeof state.showConcept === 'string' && state.showConcept.trim().length > 0,
  };
}

export default derivePodiumChallengeFacts;
