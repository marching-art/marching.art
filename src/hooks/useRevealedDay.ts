// The score-reveal boundary, shared by every surface that gates scores or
// score-bearing articles.
//
// Scores for a day publish the moment the backend scores it — off-season at
// 9 PM ET, live season when the night's westernmost show posts (11 PM–2 AM
// ET; drop_plans/{showDate}.dropInstant) — and the dispatcher stamps
// `scoredAt` on the plan doc when the day is done. The reveal is therefore:
//
//   revealedDay = max(currentDay - 1, tonight's scored day)
//
// `currentDay - 1` (getEffectiveDay) is the fallback boundary: everything up
// to yesterday is always visible, and it covers nights where no plan doc is
// stamped (legacy 2 AM pipeline, dispatcher in shadow mode) — those reveal at
// the 2 AM ET rollover exactly as before. The `scoredAt` overlay is what
// makes tonight's day appear the moment its scores exist instead of waiting
// for 2 AM.

import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { DocumentData } from 'firebase/firestore';
import { getDropPlan } from '../api/season';
import { queryKeys } from '../lib/queryClient';
import { getShowDateKey } from '../utils/seasonClock';
import { getEffectiveDay } from '../utils/dashboardScoring';
import { getMaxVisibleArticleDay } from '../utils/seasonProgress';

// Shares the cache entry with useSeasonClock's useDropPlan (same query key).
const DROP_PLAN_STALE_TIME = 5 * 60 * 1000;

// Polling cadences for the plan doc. The doc is tiny, so the cost of keeping
// an open session current is negligible: a slow background check most of the
// day, tightening to once a minute around the drop so the reveal lands
// without the user having to refresh.
const POLL_SLOW_MS = 15 * 60 * 1000;
const POLL_FAST_MS = 60 * 1000;
// Fast polling starts this long before the planned drop...
const POLL_FAST_BEFORE_MS = 30 * 60 * 1000;
// ...and gives up this long after it (a night that still has no scoredAt by
// then failed; the 2 AM rollover fallback covers the reveal).
const POLL_FAST_AFTER_MS = 4 * 60 * 60 * 1000;

/** Firestore Timestamp | Date | ISO string -> Date (null when unparseable). */
function toDateSafe(value: unknown): Date | null {
  if (!value) return null;
  const date =
    typeof (value as { toDate?: unknown }).toDate === 'function'
      ? (value as { toDate: () => Date }).toDate()
      : new Date(value as string | number | Date);
  return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
}

/** The competition day tonight's plan says is fully scored, or null. */
function planScoredDay(plan: DocumentData | null | undefined): number | null {
  if (!plan?.scoredAt) return null;
  const day = plan.competitionDay;
  return typeof day === 'number' && day >= 1 ? day : null;
}

/**
 * The competition day (1-49) that was scored TONIGHT, per tonight's
 * drop_plans doc, or null when tonight hasn't been scored (or no plan doc
 * exists — legacy pipeline / shadow mode). Polls the plan doc around the
 * planned drop instant so an open session sees the reveal within a minute.
 */
export function useScoredTonight(): number | null {
  const queryClient = useQueryClient();
  const showDateKey = getShowDateKey();
  const { data: plan } = useQuery({
    queryKey: queryKeys.dropPlan(showDateKey),
    queryFn: () => getDropPlan(showDateKey),
    staleTime: DROP_PLAN_STALE_TIME,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data === undefined) return false; // initial fetch still in flight
      if (!data) return POLL_SLOW_MS; // no plan doc yet (written from ~8 PM ET)
      if (planScoredDay(data) != null) return false; // night is done
      const dropAt = toDateSafe(data.dropInstant);
      if (!dropAt) return false;
      const untilDrop = dropAt.getTime() - Date.now();
      if (untilDrop > POLL_FAST_BEFORE_MS) return POLL_SLOW_MS;
      if (untilDrop > -POLL_FAST_AFTER_MS) return POLL_FAST_MS;
      return false; // long past the drop with no scoredAt — night failed
    },
  });

  const scoredDay = planScoredDay(plan);

  // When this session WATCHES the night flip from unscored to scored, the
  // score data caches (recaps, standings, scraped DCI scores) predate the new
  // day — invalidate them so mounted surfaces refetch and the new day
  // actually renders. Deliberately not run on a fresh load that already sees
  // scoredAt: those queries fetch fresh anyway.
  const sawUnscoredRef = useRef(false);
  useEffect(() => {
    if (plan === undefined) return;
    if (scoredDay == null) {
      sawUnscoredRef.current = true;
      return;
    }
    if (sawUnscoredRef.current) {
      sawUnscoredRef.current = false;
      queryClient.invalidateQueries({ queryKey: ['fantasyRecaps'] });
      queryClient.invalidateQueries({ queryKey: ['seasonStandings'] });
      queryClient.invalidateQueries({ queryKey: ['historicalScores'] });
      queryClient.invalidateQueries({ queryKey: ['podiumRecaps'] });
    }
  }, [plan, scoredDay, queryClient]);

  return scoredDay;
}

/**
 * The most recent competition day whose scores may be shown, or null when
 * nothing is visible yet (day 1). This is THE reveal boundary — the Scores
 * page, Dashboard, ticker, and Live Scores box all gate on it, and the news
 * gate (useMaxVisibleArticleDay) derives from the same scored-tonight signal,
 * so scores and articles always reveal together.
 *
 * @param currentDay The active season day from the season store
 *   (getSeasonProgress; 2 AM ET reset).
 */
export function useRevealedDay(currentDay: number): number | null {
  const scoredTonight = useScoredTonight();
  const base = getEffectiveDay(currentDay);
  const revealed = Math.max(base ?? 0, scoredTonight ?? 0);
  return revealed >= 1 ? revealed : null;
}

/**
 * Day-gate for news articles: the highest reportDay whose articles may be
 * shown, or null when nothing should be gated. The base gate
 * (seasonProgress.getMaxVisibleArticleDay) hides the active day's articles;
 * once tonight is scored, its articles — generated right after scoring —
 * reveal along with the scores instead of waiting for the 2 AM rollover.
 *
 * @param currentDay The active season day from the season store.
 */
export function useMaxVisibleArticleDay(currentDay: number): number | null {
  const scoredTonight = useScoredTonight();
  const gate = getMaxVisibleArticleDay(currentDay);
  if (gate == null) return null;
  return scoredTonight != null ? Math.max(gate, scoredTonight) : gate;
}

export default useRevealedDay;
