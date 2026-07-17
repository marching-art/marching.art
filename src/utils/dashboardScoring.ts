// =============================================================================
// DASHBOARD SCORING UTILITIES
// =============================================================================
// Pure data-transformation helpers extracted from Dashboard.jsx. They turn raw
// historical score events into the category totals, caption scores, and trends
// the dashboard renders. Kept free of React/Firestore so they are unit-testable.

// A single caption -> score map (e.g. { GE1: 19.5, VP: 18.2, ... }).
export type CaptionScores = Record<string, number | undefined>;

export interface ScoreEvent {
  offSeasonDay?: number | null;
  eventName?: string;
  name?: string;
  scores?: Array<{
    corps: string;
    captions?: CaptionScores;
  }>;
}

export type TrendDirection = 'up' | 'down' | 'same';

export interface Trend {
  direction: TrendDirection;
  delta: string;
}

export interface CategoryTotals {
  geTotal: number | null;
  visTotal: number | null;
  musTotal: number | null;
  geTrend?: Trend | null;
  visTrend?: Trend | null;
  musTrend?: Trend | null;
}

export interface NextShow {
  day: number | null | undefined;
  location: string;
}

export interface CaptionScoreResult {
  score: number | null;
  trend: Trend | null;
  nextShow: NextShow | null;
}

/** A show the director has registered for, as stored under corps.selectedShows. */
export interface SelectedShow {
  day?: number | null;
  eventName?: string;
  name?: string;
  location?: string;
}

export interface NextSelectedShow {
  day: number;
  eventName: string;
  location: string;
}

/**
 * The director's actual next competition.
 *
 * A fantasy corps competes as a single unit at the shows its director
 * registered for (corps.selectedShows), NOT at the real-world dates the
 * historical source corps competed. Every caption is scored together at each
 * registered show, so the "next show" is a corps-level fact shared by all
 * eight lineup slots — not something that varies per caption.
 *
 * Flattens every week's selections, keeps shows dated today or later
 * (a show on the current day has not been scored yet, so it still counts as
 * upcoming), and returns the soonest one.
 *
 * @param selectedShows Map of `week{n}` -> array of registered shows.
 * @param currentDay The current season day (1-49); when unknown, all dated
 *   shows are treated as upcoming.
 * @returns The soonest upcoming registered show, or null if none remain.
 */
export function getNextSelectedShow(
  selectedShows: Record<string, SelectedShow[]> | null | undefined,
  currentDay: number | null | undefined
): NextSelectedShow | null {
  if (!selectedShows) return null;

  const upcoming: NextSelectedShow[] = [];
  for (const weekShows of Object.values(selectedShows)) {
    if (!Array.isArray(weekShows)) continue;
    for (const show of weekShows) {
      const day = show?.day;
      if (typeof day !== 'number') continue;
      // A show on the current day is still upcoming (scored at 2 AM the next day).
      if (currentDay != null && day < currentDay) continue;
      upcoming.push({
        day,
        eventName: show.eventName || show.name || 'TBD',
        location: show.location || '',
      });
    }
  }

  if (upcoming.length === 0) return null;
  upcoming.sort((a, b) => a.day - b.day);
  return upcoming[0];
}

/**
 * Get the current hour (0-23) in Eastern Time.
 *
 * Score processing runs at 2 AM ET regardless of the user's timezone, so all
 * "has day N been processed yet" checks must read the ET clock, never the
 * browser's local hour.
 *
 * @param now Injectable clock for testing; defaults to the real time.
 */
export function getEasternHour(now: Date = new Date()): number {
  const hour = parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      hour12: false,
    }).format(now),
    10
  );
  // Some ICU builds format midnight as "24" in h23 mode.
  return hour === 24 ? 0 : hour;
}

/**
 * Get the effective current day for score filtering — the most recent day
 * whose scores have been processed.
 *
 * Live season: scores for day N are processed at 2 AM ET on day N+1, so
 * - After 2 AM ET: the previous day's scores were just processed (currentDay - 1)
 * - Before 2 AM ET: scores are only available up to currentDay - 2
 *
 * Off-season: the game day itself rolls at the 9 PM ET score drop (see
 * utils/seasonProgress), so the just-scored day is ALWAYS currentDay - 1 —
 * no hour branch. Passing the season status is what makes the 9 PM reveal
 * visible immediately instead of hidden until 2 AM.
 *
 * This is the single implementation shared by the Scores page, Dashboard,
 * ticker, and Live Scores box (it previously existed as four near-identical
 * copies, one of which wrongly read the browser-local hour).
 *
 * @param currentDay The current season day (the season-aware ACTIVE day from
 *   utils/seasonProgress via the season store).
 * @param now Injectable clock for testing; defaults to the real time.
 * @param seasonStatus game-settings/season status; anything other than
 *   'off-season' uses the live-season hour branch.
 * @returns The effective day, or null if no scores are available yet.
 */
export function getEffectiveDay(
  currentDay: number,
  now: Date = new Date(),
  seasonStatus?: string | null
): number | null {
  if (!currentDay) return null;
  let effectiveDay: number;
  if (seasonStatus === 'off-season') {
    effectiveDay = currentDay - 1;
  } else {
    const hour = getEasternHour(now);
    effectiveDay = hour < 2 ? currentDay - 2 : currentDay - 1;
  }
  return effectiveDay >= 1 ? effectiveDay : null;
}

/** Compute a trend descriptor from a current/previous value pair. */
function calcTrend(current: number, previous: number): Trend {
  const delta = current - previous;
  if (delta > 0.001) return { direction: 'up', delta: `+${delta.toFixed(2)}` };
  if (delta < -0.001) return { direction: 'down', delta: delta.toFixed(2) };
  return { direction: 'same', delta: '0.00' };
}

const geOf = (c: CaptionScores) => (c.GE1 || 0) + (c.GE2 || 0);
const visOf = (c: CaptionScores) => (c.VP || 0) + (c.VA || 0) + (c.CG || 0);
const musOf = (c: CaptionScores) => (c.B || 0) + (c.MA || 0) + (c.P || 0);

/**
 * Process historical scores for a corps into GE/Visual/Music category totals
 * (with trends) from the most recent processed day. Used for SoundSport.
 */
export function processCategoryTotals(
  yearData: ScoreEvent[],
  corpsName: string,
  effectiveDay: number | null
): CategoryTotals {
  if (effectiveDay === null) {
    return { geTotal: null, visTotal: null, musTotal: null };
  }

  const scores: Array<{ day: number; captions: CaptionScores }> = [];

  for (const event of yearData) {
    if ((event.offSeasonDay ?? 0) > effectiveDay) continue;
    const scoreData = event.scores?.find((s) => s.corps === corpsName);
    if (scoreData?.captions) {
      scores.push({ day: event.offSeasonDay as number, captions: scoreData.captions });
    }
  }

  if (scores.length === 0) {
    return { geTotal: null, visTotal: null, musTotal: null };
  }

  // Most recent first.
  scores.sort((a, b) => b.day - a.day);
  const latest = scores[0].captions;

  const geTotal = geOf(latest);
  const visTotal = visOf(latest);
  const musTotal = musOf(latest);

  let geTrend: Trend | null = null;
  let visTrend: Trend | null = null;
  let musTrend: Trend | null = null;

  if (scores.length > 1) {
    const prev = scores[1].captions;
    geTrend = calcTrend(geTotal, geOf(prev));
    visTrend = calcTrend(visTotal, visOf(prev));
    musTrend = calcTrend(musTotal, musOf(prev));
  }

  return { geTotal, visTotal, musTotal, geTrend, visTrend, musTrend };
}

/**
 * Process historical scores for a corps into a single caption's latest score,
 * its trend vs. the previous scored day, and the next upcoming show.
 */
export function processCaptionScores(
  yearData: ScoreEvent[],
  corpsName: string,
  captionId: string,
  effectiveDay: number | null
): CaptionScoreResult {
  const sortedEvents = [...yearData].sort((a, b) => (a.offSeasonDay || 0) - (b.offSeasonDay || 0));

  if (effectiveDay === null) {
    // No processed scores yet — still surface the first upcoming show.
    const firstShow = sortedEvents.find((e) => e.scores?.find((s) => s.corps === corpsName));
    return {
      score: null,
      trend: null,
      nextShow: firstShow
        ? { day: firstShow.offSeasonDay, location: firstShow.eventName || firstShow.name || 'TBD' }
        : null,
    };
  }

  const scores: Array<{ day: number; score: number; eventName?: string }> = [];
  let nextShow: NextShow | null = null;

  for (const event of sortedEvents) {
    const scoreData = event.scores?.find((s) => s.corps === corpsName);

    // First event beyond the effective day is the next upcoming show.
    if ((event.offSeasonDay ?? 0) > effectiveDay && !nextShow && scoreData) {
      nextShow = { day: event.offSeasonDay, location: event.eventName || event.name || 'TBD' };
    }

    if ((event.offSeasonDay ?? 0) > effectiveDay) continue;

    if (scoreData?.captions) {
      const captionScore = scoreData.captions[captionId];
      if (captionScore && captionScore > 0) {
        scores.push({
          day: event.offSeasonDay as number,
          score: captionScore,
          eventName: event.eventName || event.name,
        });
      }
    }
  }

  if (scores.length === 0) {
    return { score: null, trend: null, nextShow };
  }

  // Most recent first.
  scores.sort((a, b) => b.day - a.day);
  const latestScore = scores[0].score;
  const latestDay = scores[0].day;

  // Previous score from a different day.
  let previousScore: number | null = null;
  for (let i = 1; i < scores.length; i++) {
    if (scores[i].day !== latestDay) {
      previousScore = scores[i].score;
      break;
    }
  }

  const trend = previousScore !== null ? calcTrend(latestScore, previousScore) : null;

  return { score: latestScore, trend, nextShow };
}
