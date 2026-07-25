// =============================================================================
// SCORE-DROP RETURN — the conversion event for the nightly drop
// =============================================================================
// The nightly score drop is the product's heartbeat, and the last cycle built
// three announcement channels around it (Discord embed, morning FCM push,
// in-app). None of them were measurable: there was no event for "a director
// came back and saw new results", so there was no way to tell whether any
// channel pulls anyone in, or which one.
//
// This hook fires `score_drop_return` exactly once per (season, scored day) per
// device, the first time the director views a day's results. The interesting
// parameters are not the fire itself but the shape of the return:
//
//   - `src`         which announcement channel the arrival is attributed to
//                   (scoreDrop.js tags its deep links `?src=push|discord`)
//   - `days_missed` how many drops passed unseen before this visit. 0 means the
//                   announcement worked; 3 means they came back on their own
//                   schedule and the notifications are not doing their job.
//   - `competed`    whether this director actually performed that day, which
//                   separates "came to see my score" from "came to browse".
//
// The watermark is per-device localStorage rather than a profile field: this is
// a view event, it does not need to survive a reinstall, and writing a profile
// field on dashboard mount would add a Firestore write to every page view of
// the app's most-visited route.

import { useEffect, useRef } from 'react';
import { trackFunnelEvent, CLIENT_FUNNEL_EVENTS } from '../api/funnel';

/** localStorage key prefix; one watermark per season so a new season resets. */
const WATERMARK_PREFIX = 'ma:lastSeenScoredDay:';

/** Query param scoreDrop.js tags its announcement deep links with. */
const SRC_PARAM = 'src';

/** Channels we accept, so a hand-edited URL cannot inject arbitrary values. */
const KNOWN_SOURCES = new Set(['push', 'discord', 'share']);

function readWatermark(seasonUid: string): number | null {
  try {
    const raw = window.localStorage.getItem(`${WATERMARK_PREFIX}${seasonUid}`);
    if (raw === null) return null;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    // Private mode / disabled storage: treat as "never seen". The event then
    // fires once per page load instead of once per day, which is a tolerable
    // over-count for a small minority of sessions and never blocks the UI.
    return null;
  }
}

function writeWatermark(seasonUid: string, day: number): void {
  try {
    window.localStorage.setItem(`${WATERMARK_PREFIX}${seasonUid}`, String(day));
  } catch {
    // Best-effort, as above.
  }
}

/** The announcement channel this page load is attributed to, if any. */
function readSource(): string | undefined {
  try {
    const value = new URLSearchParams(window.location.search).get(SRC_PARAM);
    return value && KNOWN_SOURCES.has(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

export interface ScoreDropReturnOptions {
  /** Season the viewed day belongs to. Scopes the watermark. */
  seasonUid: string | null | undefined;
  /**
   * Latest competition day whose scores are visible — the post-2 AM effective
   * day, not the raw calendar day, so the event tracks what was actually seen.
   */
  scoredDay: number | null | undefined;
  /** Whether this director has a result on that day (vs. browsing others'). */
  competed?: boolean;
}

/**
 * Report the first view of each new scored day. No-op until both `seasonUid`
 * and `scoredDay` are known, so it is safe to call during loading.
 */
export function useScoreDropReturn({
  seasonUid,
  scoredDay,
  competed,
}: ScoreDropReturnOptions): void {
  // Guards against a second fire within the same mount when React re-runs the
  // effect (StrictMode double-invoke, or `competed` resolving after the day).
  const reportedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!seasonUid || typeof scoredDay !== 'number' || !Number.isFinite(scoredDay)) return;
    if (scoredDay < 1) return;

    const fireKey = `${seasonUid}:${scoredDay}`;
    if (reportedRef.current === fireKey) return;

    const lastSeen = readWatermark(seasonUid);
    if (lastSeen !== null && lastSeen >= scoredDay) return;

    reportedRef.current = fireKey;
    writeWatermark(seasonUid, scoredDay);

    trackFunnelEvent(CLIENT_FUNNEL_EVENTS.SCORE_DROP_RETURN, {
      day: scoredDay,
      // First-ever view has no previous watermark, so "missed" is unknowable —
      // reporting 0 there would understate the metric. Omitted instead.
      days_missed: lastSeen === null ? undefined : scoredDay - lastSeen - 1,
      first_view: lastSeen === null,
      competed: competed === undefined ? undefined : competed,
      src: readSource(),
    });
  }, [seasonUid, scoredDay, competed]);
}

export default useScoreDropReturn;
