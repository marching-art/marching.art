/**
 * Caption Change Windows
 *
 * Single source of truth for WHEN caption (lineup) changes are allowed and
 * HOW MANY are allowed. Mirrored on the client in src/utils/seasonClock.js
 * (getCaptionChangeInfo) — keep the two in sync so what the UI displays is
 * exactly what saveLineup enforces.
 *
 * The rules, in competition days (1-49; weeks are ceil(day / 7)):
 *   - Days 1-14:  unlimited changes, ending when Day 14 ends (the day
 *                 boundary falls at 8:00 PM ET during the summer).
 *   - Days 15-42: 3 changes per week per class. Changes can be spent one at
 *                 a time or all at once; the counter resets each week.
 *   - Every Saturday at 8:00 PM ET (the end of days 7/14/21/28/35/42):
 *                 changes lock until that night's scores are processed
 *                 (nightly processor runs at 2:00 AM ET; if the day had no
 *                 events, changes reopen at 2:00 AM ET).
 *   - Days 43-44: no caption changes at all.
 *   - Days 45-49 (Championship Week): 2 changes per class TOTAL for the
 *                 whole stretch; changes close at 8:00 PM ET each day (the
 *                 day boundary) and reopen once scores are processed.
 *
 * Day boundaries are startDate + N * 24h. The admin tool writes startDate at
 * midnight UTC, so boundaries land at 8:00 PM ET during EDT (7:00 PM during
 * EST). All UI labels format the actual instant, so the two never disagree.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const ET_ZONE = "America/New_York";

/** Hour of day (ET) when the nightly score processors run. */
const SCORES_PROCESS_HOUR_ET = 2;

/** Changes allowed per week per class once weekly limits apply (days 15-42). */
const WEEKLY_TRADE_LIMIT = 3;

/** Changes allowed per class across all of Championship Week (days 45-49). */
const CHAMPIONSHIP_TRADE_LIMIT = 2;

/** Last competition day with unlimited caption changes. */
const UNLIMITED_THROUGH_DAY = 14;

/** No caption changes at all on these days. */
const BLACKOUT_DAYS = [43, 44];

/** First day of Championship Week. */
const CHAMPIONSHIP_START_DAY = 45;

/** Final competition day of a season. */
const SEASON_FINAL_DAY = 49;

/**
 * Break a Date into its Eastern-Time wall-clock parts.
 * @param {Date} date
 * @returns {Object} parts keyed by type ('year', 'month', 'day', 'hour', ...)
 */
function easternParts(date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: ET_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const out = {};
  for (const { type, value } of fmt.formatToParts(date)) out[type] = value;
  return out;
}

/**
 * UTC instant for a given Eastern-Time wall-clock time. Tries both EST and
 * EDT offsets and keeps the one that round-trips.
 * @param {string} year - 'YYYY'
 * @param {string} month - 'MM'
 * @param {string} day - 'DD'
 * @param {number} hour - 0-23 (ET)
 * @returns {Date}
 */
function easternWallTimeToDate(year, month, day, hour) {
  const hh = String(hour).padStart(2, "0");
  for (const offset of ["-05:00", "-04:00"]) {
    const candidate = new Date(`${year}-${month}-${day}T${hh}:00:00${offset}`);
    const p = easternParts(candidate);
    if (p.year === year && p.month === month && p.day === day && Number(p.hour) === hour) {
      return candidate;
    }
  }
  // The wall time doesn't exist (spring-forward skips 2 AM); the scheduler
  // fires at the next real instant, 3 AM EDT.
  return new Date(`${year}-${month}-${day}T03:00:00-04:00`);
}

/**
 * Next 2:00 AM ET strictly after the given instant — when the nightly score
 * processors will next run.
 * @param {Date} after
 * @returns {Date}
 */
function nextScoresProcessingAfter(after) {
  const today = easternParts(after);
  let target = easternWallTimeToDate(today.year, today.month, today.day, SCORES_PROCESS_HOUR_ET);
  if (target.getTime() <= after.getTime()) {
    const tomorrow = easternParts(new Date(after.getTime() + DAY_MS));
    target = easternWallTimeToDate(
      tomorrow.year,
      tomorrow.month,
      tomorrow.day,
      SCORES_PROCESS_HOUR_ET,
    );
  }
  return target;
}

/**
 * Compute the caption-change window for a given instant.
 *
 * @param {Object} seasonData - Season doc (needs schedule.startDate; optional
 *   schedule.springTrainingDays and status)
 * @param {Date} [now]
 * @returns {{
 *   day: number,
 *   week: number,
 *   phase: 'unlimited'|'weekly'|'blackout'|'championship'|'complete',
 *   status: 'open'|'locked'|'closed',
 *   tradeLimit: number,
 *   unlimitedEndsAt: Date|null,
 *   locksAt: Date|null,
 *   reopensAt: Date|null,
 *   pendingScoresDay: number|null,
 * }|null} null when the season has no start date. `pendingScoresDay` is set
 *   when the window only counts as open once that day's scores have been
 *   processed — callers with Firestore access must verify via
 *   isDayScoresProcessed() before allowing a change.
 */
function getCaptionChangeWindow(seasonData, now = new Date()) {
  const startTs = seasonData?.schedule?.startDate;
  if (!startTs) return null;
  const startDate = typeof startTs.toDate === "function" ? startTs.toDate() : new Date(startTs);
  if (Number.isNaN(startDate.getTime())) return null;

  const springTrainingDays = seasonData.schedule.springTrainingDays || 0;
  const dayStart = (d) =>
    new Date(startDate.getTime() + (springTrainingDays + d - 1) * DAY_MS);
  const day =
    Math.floor((now.getTime() - startDate.getTime()) / DAY_MS) + 1 - springTrainingDays;
  const week = Math.max(1, Math.ceil(day / 7));
  const reopenAfter = (d) => nextScoresProcessingAfter(dayStart(d));

  const base = {
    day,
    week,
    tradeLimit: WEEKLY_TRADE_LIMIT,
    unlimitedEndsAt: null,
    locksAt: null,
    reopensAt: null,
    pendingScoresDay: null,
  };

  if (day > SEASON_FINAL_DAY) {
    return { ...base, phase: "complete", status: "closed", tradeLimit: 0 };
  }

  if (BLACKOUT_DAYS.includes(day)) {
    return {
      ...base,
      phase: "blackout",
      status: "closed",
      tradeLimit: 0,
      reopensAt: reopenAfter(CHAMPIONSHIP_START_DAY),
    };
  }

  if (day >= CHAMPIONSHIP_START_DAY) {
    // Championship Week: locked from the 8 PM ET day boundary until scores
    // from the previous day are processed (nightly run at 2 AM ET).
    const opensAt = reopenAfter(day);
    const locked = now.getTime() < opensAt.getTime();
    return {
      ...base,
      phase: "championship",
      status: locked ? "locked" : "open",
      tradeLimit: CHAMPIONSHIP_TRADE_LIMIT,
      reopensAt: locked ? opensAt : null,
      locksAt: locked ? null : dayStart(day + 1),
      pendingScoresDay: locked ? null : day - 1,
    };
  }

  // Days 1-42 (day < 1 means spring training / pre-season: treated as the
  // unlimited phase with no lock, since there are no scores pending).
  // Weeks begin on days 8, 15, 22, 29, 36 — the morning after a Saturday
  // 8 PM ET close — and stay locked until that night's scores process.
  const isWeekStartDay = day > 1 && day % 7 === 1;
  const opensAt = isWeekStartDay ? reopenAfter(day) : null;
  const locked = opensAt !== null && now.getTime() < opensAt.getTime();
  const isUnlimited = day <= UNLIMITED_THROUGH_DAY;

  return {
    ...base,
    phase: isUnlimited ? "unlimited" : "weekly",
    status: locked ? "locked" : "open",
    tradeLimit: isUnlimited ? Infinity : WEEKLY_TRADE_LIMIT,
    unlimitedEndsAt: isUnlimited ? dayStart(UNLIMITED_THROUGH_DAY + 1) : null,
    locksAt: locked ? null : dayStart(week * 7 + 1),
    reopensAt: locked ? opensAt : null,
    pendingScoresDay: !locked && isWeekStartDay ? day - 1 : null,
  };
}

/**
 * Have the given competition day's scores been processed (or was there
 * nothing to process)? Used to end the Saturday-night / championship-night
 * lockouts: changes stay closed after 2 AM ET until the nightly processor
 * has actually written the day's recap.
 *
 * @param {Object} db - Firestore instance
 * @param {Object} seasonData - Season doc (needs seasonUid)
 * @param {number} day - Competition day whose scores must be in (1-49)
 * @returns {Promise<boolean>}
 */
async function isDayScoresProcessed(db, seasonData, day) {
  if (!seasonData?.seasonUid || day < 1) return true;

  const recap = await db.doc(`fantasy_recaps/${seasonData.seasonUid}/days/${day}`).get();
  if (recap.exists) return true;

  // No recap yet — locked only if the day actually had events to score.
  // Missing schedule data fails open so a data quirk can't freeze changes.
  const scheduleDoc = await db.doc(`schedules/${seasonData.seasonUid}`).get();
  if (!scheduleDoc.exists) return true;
  const competitions = scheduleDoc.data().competitions || [];
  return !competitions.some((comp) => comp.day === day);
}

module.exports = {
  getCaptionChangeWindow,
  isDayScoresProcessed,
  WEEKLY_TRADE_LIMIT,
  CHAMPIONSHIP_TRADE_LIMIT,
  UNLIMITED_THROUGH_DAY,
  BLACKOUT_DAYS,
  CHAMPIONSHIP_START_DAY,
  SEASON_FINAL_DAY,
};
