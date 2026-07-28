/**
 * Weekly show-selection rules for the fantasy classes — the pure half of
 * `callable/lineups.js`'s `selectUserShows` (extracted so that callable file
 * stays under the max-lines guardrail; the callable re-exports these for the
 * tests that already import them from there).
 *
 * Two layers, in order:
 *   1. `validateShowSelection` — shape of the client's request (week in range,
 *      slot count, non-empty event names, no obvious same-day/duplicate picks),
 *   2. `resolveShowsAgainstSchedule` — the authoritative pass: every selection
 *      is resolved by eventName against the season schedule, and day/date/
 *      location come from the schedule, never from the client.
 *
 * Both throw `HttpsError` so the callable can hand them the request verbatim.
 */

const { HttpsError } = require("firebase-functions/v2/https");

// Season length in weeks (49 competition days). Week numbers outside this
// range are rejected by validateShowSelection.
const TOTAL_SEASON_WEEKS = 7;

/**
 * Get maximum number of show registrations allowed for a given week
 * @param {number} week - Week number (1-7)
 * @param {number} totalWeeks - Total weeks in the season (default 7)
 * @returns {number} Maximum shows allowed for the week
 */
const getMaxShowsForWeek = (week, totalWeeks = TOTAL_SEASON_WEEKS) => {
  // Final week allows 7 registrations (1 per day max per corps)
  if (week === totalWeeks) {
    return 7;
  }
  // Regular weeks allow 4 shows
  return 4;
};

/**
 * Validate a week's show selection shape (pure — exported for tests). Throws
 * HttpsError on violation:
 *   - an integer week number in 1..TOTAL_SEASON_WEEKS and at most
 *     maxShowsForWeek shows, each with a non-empty eventName;
 *   - no two shows on the same client-declared day (early feedback only —
 *     the authoritative one-per-day check runs on schedule-derived days in
 *     resolveShowsAgainstSchedule, because the client's day is untrusted);
 *   - no event selected twice. Multi-night events (the Eastern Classic
 *     appears on both days 41 and 42) COUNT AS ONE SHOW: one registration
 *     covers every night — scoring matches by eventName and assigns each
 *     corps a single performance night server-side (§5.11) — so selecting
 *     the second night would silently burn a weekly slot.
 */
function validateShowSelection(week, shows, maxShowsForWeek) {
  if (!Number.isInteger(week) || week < 1 || week > TOTAL_SEASON_WEEKS ||
      !shows || !Array.isArray(shows) || shows.length > maxShowsForWeek) {
    throw new HttpsError("invalid-argument",
      `Invalid data. A week number (1-${TOTAL_SEASON_WEEKS}) and a maximum of ` +
      `${maxShowsForWeek} shows are required.`);
  }

  const daysUsed = new Set();
  const eventsUsed = new Set();
  for (const show of shows) {
    if (!show || typeof show !== "object" ||
        typeof show.eventName !== "string" || !show.eventName) {
      throw new HttpsError("invalid-argument",
        "Each selected show must include an event name.");
    }
    if (show.day !== undefined && show.day !== null) {
      if (daysUsed.has(show.day)) {
        throw new HttpsError("invalid-argument",
          `Cannot select multiple shows on day ${show.day}. Corps can only attend one show per day.`);
      }
      daysUsed.add(show.day);
    }
    if (eventsUsed.has(show.eventName)) {
      throw new HttpsError("invalid-argument",
        `"${show.eventName}" is already selected. Multi-night events count as one show — ` +
        "a single registration covers every night.");
    }
    eventsUsed.add(show.eventName);
  }
}

/**
 * Resolve the client's selections against the season schedule (pure —
 * exported for tests). The client's show objects are NEVER stored verbatim:
 * scoring (helpers/scoring.js) matches attendance by eventName and
 * ACCUMULATES one score per attended show per day, so a client that omitted
 * or faked `day` used to slip multiple same-day shows (or invented events)
 * past the one-per-day rule and multiply totalSeasonScore.
 *
 * Every selection is resolved by eventName within the requested week's
 * schedule (days (week-1)*7+1 .. week*7) and day/date/location are derived
 * from the schedule, never from the client. Multi-night events occupy EVERY
 * one of their nights for the one-per-day check: scoring assigns each corps
 * exactly one night via the persisted snake split (helpers/easternSplit.js,
 * §5.11), and because that split depends on final enrollment the assigned
 * night is unknowable at selection time — reserving all nights guarantees
 * the invariant for whichever night scoring picks.
 *
 * @param {number} week - Validated week number.
 * @param {Array<{eventName: string}>} shows - Validated client selections.
 * @param {Array<Object>} competitions - schedules/{seasonId}.competitions.
 * @returns {Array<{eventName: string, day: number, date: *, location: *}>}
 *   Whitelisted show objects, safe to store on the profile.
 */
function resolveShowsAgainstSchedule(week, shows, competitions) {
  const weekStartDay = (week - 1) * 7 + 1;
  const weekEndDay = week * 7;

  // Group this week's schedule entries by event name. A multi-night event
  // appears once per night; all of its nights count as occupied days.
  const eventsByName = new Map();
  for (const comp of competitions || []) {
    if (!comp || typeof comp.name !== "string" || !comp.name) continue;
    if (!Number.isInteger(comp.day) || comp.day < weekStartDay || comp.day > weekEndDay) continue;
    const nights = Array.isArray(comp.multiNight?.nights) && comp.multiNight.nights.length > 0
      ? comp.multiNight.nights
      : [comp.day];
    let entry = eventsByName.get(comp.name);
    if (!entry) {
      entry = { days: new Set(), byDay: new Map() };
      eventsByName.set(comp.name, entry);
    }
    nights.filter(Number.isInteger).forEach((night) => entry.days.add(night));
    if (!entry.byDay.has(comp.day)) entry.byDay.set(comp.day, comp);
  }

  const daysUsed = new Set();
  const resolved = [];
  for (const show of shows) {
    const entry = eventsByName.get(show.eventName);
    if (!entry) {
      throw new HttpsError("invalid-argument",
        `"${show.eventName}" is not on the week ${week} schedule.`);
    }

    const occupiedDays = [...entry.days].sort((a, b) => a - b);
    for (const day of occupiedDays) {
      if (daysUsed.has(day)) {
        throw new HttpsError("invalid-argument",
          `Cannot select multiple shows on day ${day}. Corps can only attend one show per day.`);
      }
      daysUsed.add(day);
    }

    // Store the whitelisted fields consumers actually read (scoring matches
    // eventName; the registration index keys on eventName+date; the client
    // dashboard reads day/location), derived from the first night's entry.
    const firstDay = occupiedDays[0];
    const comp = entry.byDay.get(firstDay) || entry.byDay.values().next().value;
    resolved.push({
      eventName: show.eventName,
      day: firstDay,
      date: comp.date ?? null,
      location: comp.location ?? null,
    });
  }
  return resolved;
}

module.exports = {
  TOTAL_SEASON_WEEKS,
  getMaxShowsForWeek,
  validateShowSelection,
  resolveShowsAgainstSchedule,
};
