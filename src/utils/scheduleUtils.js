/**
 * Schedule Utilities
 *
 * Shared transformation functions for schedule/competition data.
 * Used by scheduleStore and any component that needs schedule data.
 */

import { getShowRegistrationDeadline } from './seasonClock';

/**
 * Transform a competition object from Firestore to a show object for UI
 * @param {Object} competition - Raw competition from Firestore
 * @returns {Object} Transformed show object
 */
export function transformCompetitionToShow(competition) {
  return {
    eventName: competition.name,
    location: competition.location || '',
    date: competition.date,
    day: competition.day,
    week: competition.week || Math.ceil(competition.day / 7),
    type: competition.type,
    isChampionship: competition.type === 'championship',
    allowedClasses: competition.allowedClasses || [],
    mandatory: competition.mandatory || false,
    // Major-event metadata (hard-coded marching.art majors): eventTier marks
    // regionals/championships; multiNight marks one event spanning several
    // nights (e.g. the two-night Eastern Classic). Absent on regular shows.
    eventTier: competition.eventTier || null,
    multiNight: competition.multiNight || null,
    // Detail-page enrichment (present on live-season shows scraped from dci.org).
    // Absent on off-season / unenriched shows — consumers must handle null.
    startsAt: competition.startsAt || null,
    scoresAt: competition.scoresAt || null,
    gatesAt: competition.gatesAt || null,
    timezone: competition.timezone || null,
    venue: competition.venue || null,
    lineup: competition.lineup || null,
    // Legacy show sponsorship ("Presented by <corps>") — the purchase was
    // retired in favor of hosted events; old schedule docs still render it.
    sponsor: competition.sponsor || null,
  };
}

// A show is considered "live" from its real start time until scores are announced
// (or, if we only know the start, for an estimated 3-hour window). Runs entirely
// on the enriched `startsAt`/`scoresAt` instants — no guessing from wall-clock.
const DEFAULT_SHOW_DURATION_MS = 3 * 60 * 60 * 1000;

/**
 * Get a show's real start time as a Date, or null if not enriched.
 * @param {Object} show
 * @returns {Date|null}
 */
export function showStartsAtDate(show) {
  return show?.startsAt ? new Date(show.startsAt) : null;
}

/**
 * Get the instant a show's competition window ends (scores announced, or start +
 * estimated duration).
 * @param {Object} show
 * @returns {Date|null}
 */
export function showEndsAtDate(show) {
  const start = showStartsAtDate(show);
  if (!start) return null;
  if (show.scoresAt) return new Date(show.scoresAt);
  return new Date(start.getTime() + DEFAULT_SHOW_DURATION_MS);
}

/**
 * Is this show performing right now (between real start and scores-announced)?
 * Returns false for shows without enriched timing so callers can fall back.
 * @param {Object} show
 * @param {Date} [now]
 * @returns {boolean}
 */
export function isShowLive(show, now = new Date()) {
  const start = showStartsAtDate(show);
  const end = showEndsAtDate(show);
  if (!start || !end) return false;
  return now >= start && now < end;
}

/**
 * From a show's running order, determine who is performing now and who is up next.
 * Uses each lineup entry's `performsAt` instant; each corps is assumed to hold the
 * field until the next corps' time (last corps uses the show end).
 * @param {Object} show
 * @param {Date} [now]
 * @returns {{current: Object|null, next: Object|null}}
 */
export function getRunningOrderStatus(show, now = new Date()) {
  const lineup = Array.isArray(show?.lineup) ? show.lineup : [];
  if (lineup.length === 0) return { current: null, next: null };

  const timed = lineup
    .filter((p) => p.performsAt)
    .map((p) => ({ ...p, _at: new Date(p.performsAt) }))
    .sort((a, b) => a._at - b._at);
  if (timed.length === 0) return { current: null, next: null };

  const endMs = showEndsAtDate(show)?.getTime() ?? Infinity;
  let current = null;
  let next = null;
  for (let i = 0; i < timed.length; i++) {
    const startMs = timed[i]._at.getTime();
    const stopMs = i + 1 < timed.length ? timed[i + 1]._at.getTime() : endMs;
    if (now.getTime() >= startMs && now.getTime() < stopMs) {
      current = timed[i];
      next = timed[i + 1] || null;
      break;
    }
    if (now.getTime() < startMs) {
      next = timed[i];
      break;
    }
  }
  return { current, next };
}

/**
 * Filter and transform competitions for a specific week
 * @param {Array} competitions - Raw competitions array from Firestore
 * @param {number} weekNumber - Week to filter (1-7)
 * @param {Object} options - Filter options
 * @param {boolean} options.skipChampionship - Skip championship shows
 * @returns {Array} Filtered and transformed shows
 */
export function getShowsForWeek(competitions, weekNumber, options = {}) {
  const { skipChampionship = false } = options;

  return competitions
    .filter((comp) => {
      const week = comp.week || Math.ceil(comp.day / 7);
      if (week !== weekNumber) return false;
      if (skipChampionship && comp.type === 'championship') return false;
      return true;
    })
    .map(transformCompetitionToShow)
    .sort((a, b) => a.day - b.day);
}

/**
 * Group competitions by week
 * @param {Array} competitions - Raw competitions array
 * @returns {Object} Object with week numbers as keys, arrays of shows as values
 */
export function groupShowsByWeek(competitions) {
  const grouped = {};

  competitions.forEach((comp) => {
    const week = comp.week || Math.ceil(comp.day / 7);
    if (!grouped[week]) grouped[week] = [];
    grouped[week].push(transformCompetitionToShow(comp));
  });

  // Sort shows within each week by day
  Object.keys(grouped).forEach((week) => {
    grouped[week].sort((a, b) => a.day - b.day);
  });

  return grouped;
}

/**
 * Group competitions by day (for Schedule page day-based view)
 * @param {Array} competitions - Raw competitions array
 * @returns {Array} Array of day objects with shows
 */
export function groupShowsByDay(competitions) {
  const dayMap = {};

  competitions.forEach((comp) => {
    const day = comp.day || 0;
    if (!dayMap[day]) {
      dayMap[day] = {
        offSeasonDay: day,
        week: comp.week || Math.ceil(day / 7),
        shows: [],
      };
    }
    dayMap[day].shows.push(transformCompetitionToShow(comp));
  });

  return Object.values(dayMap).sort((a, b) => a.offSeasonDay - b.offSeasonDay);
}

/**
 * Get shows for a specific day
 * @param {Array} competitions - Raw competitions array
 * @param {number} dayNumber - Day number (1-49)
 * @returns {Array} Shows for that day
 */
export function getShowsForDay(competitions, dayNumber) {
  return competitions.filter((comp) => comp.day === dayNumber).map(transformCompetitionToShow);
}

/**
 * Count shows per week (for week pills display)
 * @param {Array} competitions - Raw competitions array
 * @returns {Object} Object with week numbers as keys, counts as values
 */
export function getShowCountsByWeek(competitions) {
  const counts = {};

  competitions.forEach((comp) => {
    const week = comp.week || Math.ceil(comp.day / 7);
    counts[week] = (counts[week] || 0) + 1;
  });

  return counts;
}

/**
 * Format a date's calendar day as "YYYY-MM-DD" in a timezone (viewer-local when omitted).
 * @param {Date} date
 * @param {string} [timeZone]
 * @returns {string}
 */
export function formatDayKey(date, timeZone) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone || undefined,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }
}

/**
 * The calendar day a competition/show takes place, as "YYYY-MM-DD".
 * `date` stores the event's calendar date at UTC midnight (list scraper), so
 * its UTC components ARE the show's calendar day. `startsAt` is a true UTC
 * instant of an (often evening) local showtime, so it must be read in the
 * show's own timezone — reading it with UTC getters rolls evening shows onto
 * the next calendar day.
 * @param {Object} comp - Competition or transformed show ({ date, startsAt, timezone }).
 * @returns {string|null}
 */
export function showCalendarDay(comp) {
  if (comp.date) {
    const d = comp.date instanceof Date ? comp.date : new Date(comp.date);
    if (!Number.isNaN(d.getTime())) return formatDayKey(d, 'UTC');
  }
  if (comp.startsAt) {
    const d = new Date(comp.startsAt);
    if (!Number.isNaN(d.getTime())) return formatDayKey(d, comp.timezone);
  }
  return null;
}

/**
 * Check if an event date is considered "past" for display purposes.
 * Events are considered past only once the score processing that scores the
 * show has run (9 PM ET show night in the off-season, 2 AM ET the next
 * morning in live season — the same instant registration closes), via the
 * shared season clock.
 * @param {Date|null} eventDate - The date of the event
 * @param {Object|null} [seasonData] - game-settings/season doc (for status)
 * @returns {boolean} True if the event is past
 */
export function isEventPast(eventDate, seasonData = undefined) {
  const deadline = getShowRegistrationDeadline(eventDate, seasonData);
  return deadline ? new Date() >= deadline : false;
}
