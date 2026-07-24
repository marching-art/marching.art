// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// Live-updating deadlines derived from the shared season clock.
// Any component that shows a countdown should use these hooks rather than
// computing times itself, so every surface agrees on the same instants.

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSeasonStore } from '../store/seasonStore';
import { getDropPlan } from '../api/season';
import { queryKeys } from '../lib/queryClient';
import {
  getScoreDropEstimate,
  getShowDateKey,
  getCaptionChangeInfo,
} from '../utils/seasonClock';

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

/**
 * Tonight's score-drop plan (drop_plans/{showDate}), published nightly by the
 * backend from ~8 PM ET. Returns { dropAt: Date, dropLabel: string } when the
 * plan exists and its drop is still ahead; null otherwise (callers fall back
 * to the season-clock estimate).
 * @param {Date} now
 * @returns {{dropAt: Date, dropLabel: string}|null}
 */
export function useDropPlan(now) {
  const showDateKey = getShowDateKey(now);
  const { data: plan } = useQuery({
    queryKey: queryKeys.dropPlan(showDateKey),
    queryFn: () => getDropPlan(showDateKey),
    staleTime: DROP_PLAN_STALE_TIME,
  });

  return useMemo(() => {
    const raw = plan?.dropInstant;
    if (!raw) return null;
    const dropAt = typeof raw.toDate === 'function' ? raw.toDate() : new Date(raw);
    if (Number.isNaN(dropAt.getTime()) || dropAt.getTime() <= now.getTime()) return null;
    return { dropAt, dropLabel: plan.dropLabel || null };
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
 * @param {number} [intervalMs] - Tick interval (default 30s)
 * @param {string|null} [corpsClass] - Canonical class id. When provided, the
 *   Championship-day class lockout is reflected in `trade`; omit for a
 *   class-agnostic window.
 * @returns {{
 *   now: Date,
 *   scoresAt: Date,
 *   scoresInMs: number,
 *   scoresExact: boolean,
 *   trade: ReturnType<typeof getCaptionChangeInfo>,
 * }}
 */
export function useSeasonDeadlines(intervalMs = 30000, corpsClass = null) {
  const seasonData = useSeasonStore((s) => s.seasonData);
  const now = useNow(intervalMs);
  const plan = useDropPlan(now);
  return useMemo(() => {
    const estimate = getScoreDropEstimate(seasonData, now);
    const scoresAt = plan?.dropAt || estimate.at;
    return {
      now,
      scoresAt,
      scoresInMs: scoresAt.getTime() - now.getTime(),
      scoresExact: plan ? true : estimate.exact,
      trade: getCaptionChangeInfo(seasonData, now, corpsClass),
    };
  }, [seasonData, now, corpsClass, plan]);
}
