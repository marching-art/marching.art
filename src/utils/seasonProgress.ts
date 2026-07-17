/**
 * Season progress — the single client-side source of truth for "what
 * competition day/week is it right now."
 *
 * This mirrors the backend authority in functions/src/helpers/gameDay.js
 * EXACTLY so the day the UI shows never disagrees with the day the nightly
 * scoring processors actually score. The rules that make it correct:
 *
 *   1. The game-day boundary is SEASON-TYPE-AWARE. Live season: days reset at
 *      2 AM Eastern (the nightly run scores "yesterday" — West Coast DCI
 *      shows post after 1 AM ET). Off-season: days END at 9 PM Eastern, when
 *      the prime-time score drop processes THAT evening's day; at 9 PM the
 *      next game day begins. A raw `(now - startDate) / 24h` count rolls the
 *      day at midnight UTC — 8 PM ET in summer, 7 PM in winter — advancing
 *      the day hours early and drifting with DST; counting ET calendar days
 *      with the season's reset shift fixes both.
 *   2. The season start is normalized on the UTC calendar. seasonStartDate is
 *      stored at midnight UTC (see scheduleGeneration.getNextOffSeasonWindow);
 *      reading it in ET would shift winter UTC-midnight dates back a day and
 *      make the day number one too high (e.g. Semifinals mislabeled Finals).
 *
 * The "current" day is the game day IN PROGRESS (backend
 * gameDay.getActiveCalendarDay = completedGameDay + 1), which is what a live
 * dashboard should show.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;
// Live season: shift back 2h then take the previous date — the 12–2 AM window
// still belongs to the previous game day (gameDay.LIVE_RESET_SHIFT_HOURS).
const LIVE_RESET_SHIFT_HOURS = 2;
// Off-season: shift FORWARD 3h — at/after 9 PM ET the evening's day has been
// scored and the next one has begun (gameDay.OFF_SEASON_RESET_SHIFT_HOURS).
const OFF_SEASON_RESET_SHIFT_HOURS = -3;

/** Reset shift for a season status (mirrors gameDay.resetShiftHours). */
export function resetShiftHours(seasonStatus: string | null | undefined): number {
  return seasonStatus === 'off-season' ? OFF_SEASON_RESET_SHIFT_HOURS : LIVE_RESET_SHIFT_HOURS;
}

const SEASON_FINAL_DAY = 49;
const TOTAL_SEASON_WEEKS = 7;

/** A Firestore Timestamp exposes toDate(); we also accept a raw Date. */
type TimestampLike = Date | { toDate: () => Date };

export interface SeasonProgressInput {
  status?: string;
  schedule?: {
    startDate?: TimestampLike | null;
    springTrainingDays?: number;
  } | null;
}

export interface SeasonProgress {
  currentDay: number;
  currentWeek: number;
}

function toDate(value: TimestampLike | null | undefined): Date | null {
  if (!value) return null;
  const date =
    typeof (value as { toDate?: unknown }).toDate === 'function'
      ? (value as { toDate: () => Date }).toDate()
      : (value as Date);
  return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
}

/**
 * The calendar day currently in progress, counted 1-based from the season's
 * (UTC-midnight) start date, using the season-aware reset shift (2 AM ET
 * live, 9 PM ET off-season). Ported verbatim from
 * functions/src/helpers/gameDay.js (getCompletedGameDayET + getActiveCalendarDay).
 */
function getActiveCalendarDay(
  seasonStartDate: Date,
  now: Date,
  seasonStatus?: string | null
): number {
  const etParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const et: Record<string, string> = {};
  for (const part of etParts) et[part.type] = part.value;

  // Build a UTC Date numerically equal to the ET wall-clock time (arithmetic
  // only). Some ICU versions report midnight as hour "24" in h23 mode.
  const nowET = new Date(
    Date.UTC(
      parseInt(et.year, 10),
      parseInt(et.month, 10) - 1,
      parseInt(et.day, 10),
      parseInt(et.hour === '24' ? '0' : et.hour, 10),
      parseInt(et.minute, 10),
      parseInt(et.second, 10)
    )
  );

  // Shift by the season's reset offset (back 2h live, forward 3h off-season),
  // then take that day's completed value; the active day is the next one.
  const gameTimeET = new Date(nowET.getTime() - resetShiftHours(seasonStatus) * 60 * 60 * 1000);
  const completedGameDay = new Date(gameTimeET);
  completedGameDay.setUTCDate(completedGameDay.getUTCDate() - 1);
  completedGameDay.setUTCHours(0, 0, 0, 0);

  const startNormalized = new Date(
    Date.UTC(
      seasonStartDate.getUTCFullYear(),
      seasonStartDate.getUTCMonth(),
      seasonStartDate.getUTCDate(),
      0,
      0,
      0
    )
  );

  const completedCalendarDay =
    Math.floor((completedGameDay.getTime() - startNormalized.getTime()) / MS_PER_DAY) + 1;
  // Active (in-progress) day is exactly one past the completed one.
  return completedCalendarDay + 1;
}

/**
 * Current competition day (1–49) and week (1–7) for a season doc.
 *
 * @param seasonData - game-settings/season doc (needs schedule.startDate;
 *   optional schedule.springTrainingDays for live seasons — off-seasons omit it).
 * @param now - Injectable clock for tests; defaults to the wall clock.
 * @returns Clamped { currentDay, currentWeek }. Day 0 / week 0 before a start
 *   date exists (matches the previous getSeasonProgress contract).
 */
export function getSeasonProgress(
  seasonData: SeasonProgressInput | null | undefined,
  now: Date = new Date()
): SeasonProgress {
  const startDate = toDate(seasonData?.schedule?.startDate);
  if (!startDate) {
    return { currentDay: 0, currentWeek: 0 };
  }

  const springTrainingDays = seasonData?.schedule?.springTrainingDays || 0;
  const competitionDay =
    getActiveCalendarDay(startDate, now, seasonData?.status) - springTrainingDays;

  const currentDay = Math.max(1, Math.min(competitionDay, SEASON_FINAL_DAY));
  const currentWeek = Math.max(1, Math.min(Math.ceil(currentDay / 7), TOTAL_SEASON_WEEKS));

  return { currentDay, currentWeek };
}
