// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// Live-updating deadlines derived from the shared season clock.
// Any component that shows a countdown should use these hooks rather than
// computing times itself, so every surface agrees on the same instants.

import { useEffect, useMemo, useState } from 'react';
import { useSeasonStore } from '../store/seasonStore';
import { getNextScoresProcessingTime, getCaptionChangeInfo } from '../utils/seasonClock';

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
 * The player-facing deadlines that matter right now.
 * @param {number} [intervalMs] - Tick interval (default 30s)
 * @param {string|null} [corpsClass] - Canonical class id. When provided, the
 *   Championship-day class lockout is reflected in `trade`; omit for a
 *   class-agnostic window.
 * @returns {{
 *   now: Date,
 *   scoresAt: Date,
 *   scoresInMs: number,
 *   trade: ReturnType<typeof getCaptionChangeInfo>,
 * }}
 */
export function useSeasonDeadlines(intervalMs = 30000, corpsClass = null) {
  const seasonData = useSeasonStore((s) => s.seasonData);
  const now = useNow(intervalMs);
  return useMemo(() => {
    const scoresAt = getNextScoresProcessingTime(now);
    return {
      now,
      scoresAt,
      scoresInMs: scoresAt.getTime() - now.getTime(),
      trade: getCaptionChangeInfo(seasonData, now, corpsClass),
    };
  }, [seasonData, now, corpsClass]);
}
