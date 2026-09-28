// "Has this show's registration closed?" — shared by every schedule surface so
// a card greys out at the same instant the server (selectUserShows) starts
// rejecting changes: when that night's scores RUN (9 PM ET off-season, the
// published drop instant live), not the 2 AM ET rollover.
//
// The Schedule page provides a live predicate (season doc + tonight's drop
// plan + a ticking clock, via useSeasonDeadlines) so presentational parts stay
// free of the Firebase-backed hooks. Without a provider, callers fall back to
// the season-status-only clock.

import { createContext, useContext } from 'react';
import { isEventPast } from '../../utils/scheduleUtils';

/** @typedef {(eventDate: Date | null | undefined) => boolean} ShowClosedPredicate */

export const ShowClockContext = createContext(/** @type {ShowClosedPredicate | null} */ (null));

/**
 * The live "registration closed" predicate from the nearest provider, or a
 * season-status-only fallback when rendered outside one.
 * @param {{status?: string} | null} [seasonData] - Used only by the fallback.
 * @returns {ShowClosedPredicate}
 */
export function useIsShowClosed(seasonData = null) {
  const provided = useContext(ShowClockContext);
  return provided ?? ((eventDate) => isEventPast(eventDate ?? null, seasonData));
}
