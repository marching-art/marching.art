/**
 * Season progress — the single client-side source of truth for "what
 * competition day/week is it right now."
 *
 * This mirrors the backend authority in functions/src/helpers/gameDay.js
 * EXACTLY so the day the UI shows never disagrees with the day the nightly
 * scoring processors actually score. Two rules make it correct where the
 * previous ad-hoc computations were not:
 *
 *   1. Game days reset at 2 AM Eastern, not midnight and not 8 PM. A raw
 *      `(now - startDate) / 24h` count rolls the day over at midnight UTC —
 *      which is 8 PM ET in summer and 7 PM in winter — so it advanced the day
 *      hours early and its boundary drifted with DST. Counting ET calendar
 *      days with a 2 AM reset fixes both.
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
// Game days roll over at 2 AM ET, not midnight, so the 12–2 AM window still
// belongs to the previous game day (matches gameDay.GAME_DAY_RESET_HOURS).
const GAME_DAY_RESET_HOURS = 2;

const SEASON_FINAL_DAY = 49;
const TOTAL_SEASON_WEEKS = 7;

/** A Firestore Timestamp exposes toDate(); we also accept a raw Date. */
type TimestampLike = Date | { toDate: () => Date };

export interface SeasonProgressInput {
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
 * (UTC-midnight) start date, using a 2 AM ET reset. Ported verbatim from
 * functions/src/helpers/gameDay.js (getCompletedGameDayET + getActiveCalendarDay).
 */
function getActiveCalendarDay(seasonStartDate: Date, now: Date): number {
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

  // Shift back by the 2 AM reset so 1 AM Jan 5 still belongs to Jan 4's game
  // day, then take that day's completed value; the active day is the next one.
  const gameTimeET = new Date(nowET.getTime() - GAME_DAY_RESET_HOURS * 60 * 60 * 1000);
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
  const competitionDay = getActiveCalendarDay(startDate, now) - springTrainingDays;

  const currentDay = Math.max(1, Math.min(competitionDay, SEASON_FINAL_DAY));
  const currentWeek = Math.max(1, Math.min(Math.ceil(currentDay / 7), TOTAL_SEASON_WEEKS));

  return { currentDay, currentWeek };
}

/**
 * Day-gate for news articles: the highest reportDay whose articles may be
 * shown, or null when nothing should be gated.
 *
 * Articles for a game day are generated when that day's scores are processed
 * at the 2 AM ET reset, so only days strictly before the active one are safe
 * to show. Because currentDay itself already rolls at 2 AM ET (see
 * getSeasonProgress), no extra wall-clock adjustment belongs here —
 * subtracting an additional day before 2 AM double-counts the reset and hides
 * the newest articles between midnight and 2 AM.
 *
 * @param currentDay - Active competition day from getSeasonProgress (0 when
 *   no season info is available).
 * @returns Highest visible reportDay, or null when the gate is off: no season
 *   info, day 1 (nothing published yet to gate), or the season has reached
 *   its final day — during the off-season every article of the finished
 *   season stays visible.
 */
export function getMaxVisibleArticleDay(currentDay: number): number | null {
  if (!currentDay) return null;
  if (currentDay >= SEASON_FINAL_DAY) return null;
  const day = currentDay - 1;
  return day >= 1 ? day : null;
}
