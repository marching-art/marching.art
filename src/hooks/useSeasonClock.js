// Live-updating deadlines derived from the shared season clock.
// Any component that shows a countdown should use these hooks rather than
// computing times itself, so every surface agrees on the same instants.

import { useEffect, useMemo, useState } from 'react';
import { useSeasonStore } from '../store/seasonStore';
import { getNextScoresProcessingTime, getTradeWeekInfo } from '../utils/seasonClock';

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
 * @returns {{
 *   now: Date,
 *   scoresAt: Date,
 *   scoresInMs: number,
 *   trade: ReturnType<typeof getTradeWeekInfo>,
 * }}
 */
export function useSeasonDeadlines(intervalMs = 30000) {
  const seasonData = useSeasonStore((s) => s.seasonData);
  const now = useNow(intervalMs);
  return useMemo(() => {
    const scoresAt = getNextScoresProcessingTime(now);
    return {
      now,
      scoresAt,
      scoresInMs: scoresAt.getTime() - now.getTime(),
      trade: getTradeWeekInfo(seasonData, now),
    };
  }, [seasonData, now]);
}
