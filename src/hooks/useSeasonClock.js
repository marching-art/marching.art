// Live-updating deadlines derived from the shared season clock.
// Any component that shows a countdown should use these hooks rather than
// computing times itself, so every surface agrees on the same instants.

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSeasonStore } from '../store/seasonStore';
import { getDropPlan } from '../api/season';
import { queryKeys } from '../lib/queryClient';
import { getScoreDropEstimate, getShowDateKey, getCaptionChangeInfo } from '../utils/seasonClock';

// The plan doc is written/refreshed by backend gate ticks every 15 minutes,
// so a 5-minute client cache never lags it meaningfully.
const DROP_PLAN_STALE_TIME = 5 * 60 * 1000;

/**
 * Current time, re-evaluated on an interval so countdowns tick.
 * @param {number} [intervalMs] - Tick interval (default 30s)
 * @returns {Date}
 */
export function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

// How long past the planned drop to keep saying "processing" when the plan doc
// carries no scrapeRetryUntil to bound the night with. Matches the backend's
// 2:45 AM ET clamp measured from the earliest possible drop (11 PM ET).
const DEFAULT_PENDING_WINDOW_MS = 3.75 * 60 * 60 * 1000;

/**
 * Firestore Timestamp | ISO string | Date -> Date, or null when unusable.
 * @param {*} raw
 * @returns {Date|null}
 */
function toDate(raw) {
  if (!raw) return null;
  const date = typeof raw.toDate === 'function' ? raw.toDate() : new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Tonight's score-drop plan (drop_plans/{showDate}), published nightly by the
 * backend from ~8 PM ET.
 *
 * The planned instant is when scoring may FIRST run, not a guarantee it did:
 * live scores derive from the DCI recap, and the backend holds the drop when
 * dci.org hasn't posted yet (functions/src/scheduled/dropDispatcher.js). So the
 * plan stays authoritative past its own drop instant — `pending` marks that
 * "scores are processing" stretch, which is what callers must show instead of
 * silently rolling the countdown forward to a time nothing will happen at.
 *
 * The plan is spent once the backend stamps `scoredAt` (tonight is done — the
 * next drop is tomorrow) or once the night's retry window closes, and callers
 * fall back to the season-clock estimate from `windowEndsAt`.
 *
 * @param {Date} now
 * @returns {{dropAt: Date, dropLabel: string|null, pending: boolean,
 *   done: boolean, windowEndsAt: Date}|null}
 */
export function useDropPlan(now) {
  const showDateKey = getShowDateKey(now);
  const { data: plan } = useQuery({
    queryKey: queryKeys.dropPlan(showDateKey),
    queryFn: () => getDropPlan(showDateKey),
    staleTime: DROP_PLAN_STALE_TIME,
  });

  return useMemo(() => {
    if (!plan) return null;
    const dropAt = toDate(plan.dropInstant);
    if (!dropAt) return null;

    const windowEndsAt =
      toDate(plan.scrapeRetryUntil) || new Date(dropAt.getTime() + DEFAULT_PENDING_WINDOW_MS);
    const dropLabel = plan.dropLabel || null;
    const base = { dropAt, dropLabel, windowEndsAt };

    if (toDate(plan.scoredAt)) return { ...base, pending: false, done: true };
    if (dropAt.getTime() > now.getTime()) return { ...base, pending: false, done: false };
    // Past the planned drop with nothing scored yet: the backend is still
    // waiting on DCI. Hold the plan (as pending) until the night's window
    // closes; after that the 4:30 AM watchdog owns the problem, not the UI.
    if (now.getTime() < windowEndsAt.getTime()) return { ...base, pending: true, done: false };
    return null;
  }, [plan, now]);
}

/**
 * The player-facing deadlines that matter right now.
 *
 * `scoresAt` is the next score drop: tonight's exact planned instant when the
 * backend has published it (drop_plans — varies by the night's westernmost
 * show in live season), otherwise the season-clock estimate (9 PM ET exact in
 * the off-season; the conservative "by 2 AM ET" bound on live nights —
 * `scoresExact` tells surfaces which wording to use). Caption-change windows
 * (`trade`) keep their own 2 AM ET reopen boundary independent of the drop.
 *
 * `scoresPending` is the state in between: tonight's planned instant has passed
 * and the backend is still waiting on DCI to post the recap. Surfaces MUST show
 * that rather than a countdown — `scoresAt` is in the past here, and rolling it
 * forward to the next estimate is how the chip used to promise 11 PM and then
 * jump to "3 hours" the moment 11 PM arrived.
 *
 * Once tonight's scores have landed, the estimate is taken from the end of
 * tonight's window, so the next countdown targets TOMORROW night rather than a
 * bound that already elapsed.
 *
 * @param {number} [intervalMs] - Tick interval (default 30s)
 * @param {string|null} [corpsClass] - Canonical class id. When provided, the
 *   Championship-day class lockout is reflected in `trade`; omit for a
 *   class-agnostic window.
 * @returns {{
 *   now: Date,
 *   scoresAt: Date,
 *   scoresInMs: number,
 *   scoresExact: boolean,
 *   scoresPending: boolean,
 *   trade: ReturnType<typeof getCaptionChangeInfo>,
 * }}
 */
export function useSeasonDeadlines(intervalMs = 30000, corpsClass = null) {
  const seasonData = useSeasonStore((s) => s.seasonData);
  const now = useNow(intervalMs);
  const plan = useDropPlan(now);
  return useMemo(() => {
    // A spent plan (tonight already scored) still tells us when tonight's
    // window closed — estimate from there so the next drop is tomorrow's.
    const usePlanInstant = plan !== null && !plan.done;
    const estimateFrom = plan !== null && plan.done ? plan.windowEndsAt : now;
    const estimate = getScoreDropEstimate(seasonData, estimateFrom);
    const scoresAt = usePlanInstant ? plan.dropAt : estimate.at;
    return {
      now,
      scoresAt,
      scoresInMs: scoresAt.getTime() - now.getTime(),
      scoresExact: usePlanInstant ? true : estimate.exact,
      scoresPending: Boolean(plan?.pending),
      trade: getCaptionChangeInfo(seasonData, now, corpsClass),
    };
  }, [seasonData, now, corpsClass, plan]);
}
