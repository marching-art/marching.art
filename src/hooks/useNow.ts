// useNow — a bare, dependency-free ticking clock. Kept in its own module (with
// no Firebase/api imports) so purely-presentational components can roll over on
// a time boundary without pulling the whole season-clock stack — and its
// Firebase client — into their import graph and unit tests.

import { useEffect, useState } from 'react';

/**
 * Current time, re-evaluated on an interval so time-derived UI (countdowns, the
 * game-day boundary) updates without a manual refresh.
 * @param intervalMs Tick interval (default 30s)
 */
export function useNow(intervalMs = 30000): Date {
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export default useNow;
