/**
 * Schedule Utilities
 *
 * Shared transformation functions for schedule/competition data.
 * Used by scheduleStore and any component that needs schedule data.
 */

import { getShowRegistrationDeadline } from './seasonClock';

/**
 * @typedef {Object} LineupEntry
 * @property {number} order
 * @property {string|null} [uid]
 * @property {string} [corpsClass]
 * @property {string} corps
 * @property {string|null} [hometown]
 * @property {string} [performsAt]
 * @property {string} [performanceTime]
 */

/**
 * @typedef {Object} EncoreEntry
 * @property {string|null} [uid]
 * @property {string} [corpsClass]
 * @property {string} [corps]
 * @property {string} [reason]
 * @property {number|null} [miles]
 */

/**
 * One field's materialized running order (competition.fantasySchedule /
 * competition.podiumSchedule), written by scheduled/scheduleRunningOrder.js.
 * @typedef {Object} FieldSchedule
 * @property {string|null} [startsAt]
 * @property {string|null} [scoresAt]
 * @property {string|null} [gatesAt]
 * @property {string|null} [timezone]
 * @property {LineupEntry[]} [lineup]
 * @property {Array<{uid?: string|null, corpsClass?: string, corps?: string}>} [overflow]
 * @property {number} [fieldSize]
 * @property {NightAssignment|null} [night]
 * @property {Advancement|null} [advancement]
 */

/**
 * The slice of a raw `schedules/{seasonUid}` competition this module reads.
 * @typedef {Object} RawCompetition
 * @property {string} [id]
 * @property {string} name
 * @property {number} day
 * @property {number} [week]
 * @property {string} [location]
 * @property {*} [date]
 * @property {string} [type]
 * @property {string[]} [allowedClasses]
 * @property {boolean} [mandatory]
 * @property {string|null} [eventTier]
 * @property {string|null} [hostUid]
 * @property {{nights?: number[]}|null} [multiNight]
 * @property {string|null} [startsAt]
 * @property {string|null} [scoresAt]
 * @property {string|null} [gatesAt]
 * @property {string|null} [timezone]
 * @property {string|null} [venue]
 * @property {LineupEntry[]|null} [lineup]
 * @property {FieldSchedule|null} [fantasySchedule]
 * @property {FieldSchedule|null} [podiumSchedule]
 * @property {EncoreEntry|null} [encore]
 * @property {EncoreEntry|null} [podiumEncore]
 * @property {Object|null} [sponsor]
 * @property {{summary?: string, tempF?: number, code?: number, hour?: number}|null} [weather]
 */

/**
 * A show with enriched timing and a running order — the shape the live
 * helpers below read (a transformed show, a raw competition, or a projected
 * podium view all satisfy it).
 * @typedef {Object} TimedShow
 * @property {string|null} [startsAt]
 * @property {string|null} [scoresAt]
 * @property {string|null} [timezone]
 * @property {LineupEntry[]|null} [lineup]
 */

/**
 * @typedef {Object} NightAssignment
 * @property {number} day
 * @property {number[]} nights
 * @property {'provisional'|'preview'|'final'} status
 *
 * The advancement stamp a championship round's fantasy field carries
 * (scheduled/scheduleRunningOrder.js): which night's scores decide the field,
 * the cutoff copy, and whether that cut is decided yet.
 * @typedef {Object} Advancement
 * @property {number} fromDay
 * @property {string} rule
 * @property {'pending'|'final'} status
 */

/**
 * Transform a competition object from Firestore to a show object for UI
 * @param {RawCompetition} competition - Raw competition from Firestore
 * @returns the transformed show object (shape inferred for consumers)
 */
export function transformCompetitionToShow(competition) {
  // The real-field fantasy running order (scheduled/scheduleRunningOrder.js), when
  // materialized, is the primary schedule a director sees — their own corps in a
  // timed order that ends at the night's score drop. It takes precedence over the
  // legacy heritage/scraped enrichment (which is the historical cast); those
  // remain the fallback for regular shows not yet materialized (early season).
  // A championship round never falls back: its heritage lineup is a synthesized
  // DCI stage cast, not the auto-enrolled directors, so until the real field is
  // materialized it honestly shows no running order. The podium running order
  // rides alongside for the Fantasy/Podium toggle.
  const fs = competition.fantasySchedule || null;
  const ps = competition.podiumSchedule || null;
  const isChampionship = competition.type === 'championship';
  return {
    eventName: competition.name,
    location: competition.location || '',
    date: competition.date,
    day: competition.day,
    week: competition.week || Math.ceil(competition.day / 7),
    type: competition.type,
    isChampionship,
    allowedClasses: competition.allowedClasses || [],
    mandatory: competition.mandatory || false,
    // Major-event metadata (hard-coded marching.art majors): eventTier marks
    // regionals/championships; multiNight marks one event spanning several
    // nights (e.g. the two-night Eastern Classic). Absent on regular shows.
    eventTier: competition.eventTier || null,
    // Director-hosted shows (eventTier === 'hosted') carry the host's uid so the
    // schedule can distinguish them from scraped/system shows and label them.
    hostUid: competition.hostUid || null,
    multiNight: competition.multiNight || null,
    // Detail-page enrichment. Prefer the materialized fantasy schedule; fall back
    // to the legacy heritage/scraped fields when it isn't present yet.
    startsAt: fs?.startsAt ?? competition.startsAt ?? null,
    scoresAt: fs?.scoresAt ?? competition.scoresAt ?? null,
    gatesAt: fs?.gatesAt ?? competition.gatesAt ?? null,
    timezone: fs?.timezone ?? competition.timezone ?? null,
    venue: competition.venue || null,
    lineup: fs?.lineup ?? (isChampionship ? null : (competition.lineup ?? null)),
    // Real-field extras (present only once materialized): the "also competing"
    // overflow list, the field size, and both schedules for the toggle.
    fantasySchedule: fs,
    podiumSchedule: ps,
    overflow: fs?.overflow ?? null,
    fieldSize: fs?.fieldSize ?? null,
    // Championship advancement round: which night's scores set this field and
    // whether that cut is decided yet (null on a regular show / Prelims).
    advancement: fs?.advancement ?? null,
    // The cosmetic encore corps for this show ({ uid, corpsClass, corps, reason }).
    // Each side carries its own: `encore` is the fantasy field's, `podiumEncore`
    // the podium field's (DualRunningOrder swaps it in on the Podium tab).
    encore: competition.encore || null,
    podiumEncore: competition.podiumEncore || null,
    // Legacy show sponsorship ("Presented by <corps>") — the purchase was
    // retired in favor of hosted events; old schedule docs still render it.
    sponsor: competition.sponsor || null,
    // Backend-produced show-time weather ({ summary, tempF, code, hour }),
    // denormalized onto each competition by scheduleWeather. The card renders
    // it straight from here, so it must survive the transform.
    weather: competition.weather || null,
  };
}

/**
 * A name folded for matching: lowercase, alphanumerics only.
 * @param {unknown} name
 */
function foldName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

/**
 * True when a class list (ids or display names) names SoundSport.
 * @param {unknown} classes
 */
function namesSoundSport(classes) {
  return (Array.isArray(classes) ? classes : []).some((c) => foldName(c) === 'soundsport');
}

/**
 * The season schedule's row for a Championship Week card. The Championship
 * Week panel lists its rounds from the hard-coded CHAMPIONSHIP_EVENTS constants,
 * but the live facts about a round — the venue the season actually stamped and
 * the backend-produced show-time weather — live on the `schedules/{seasonUid}`
 * row for that day. This joins the two: the championship row on the same day
 * with the same (folded) name; else the day's only championship row; else, on
 * a two-event day (Finals night + the SoundSport festival), the row whose
 * classes agree with the card on SoundSport. Null when the schedule has no
 * such row yet (the card then renders from the constants alone).
 *
 * @param {Array<{day?: number, eventName?: string, isChampionship?: boolean, type?: string, allowedClasses?: string[]}>} shows - Transformed shows (any week).
 * @param {{day: number, eventName: string, eligibleClasses?: string[]}} event - A CHAMPIONSHIP_EVENTS entry.
 * @returns {*} The matching transformed show, or null.
 */
export function championshipShowFor(shows, event) {
  if (!Array.isArray(shows) || !event) return null;
  const candidates = shows.filter(
    (show) =>
      show && show.day === event.day && (show.isChampionship || show.type === 'championship')
  );
  if (candidates.length === 0) return null;
  const wanted = foldName(event.eventName);
  const byName = candidates.find((show) => foldName(show.eventName) === wanted);
  if (byName) return byName;
  if (candidates.length === 1) return candidates[0];
  const wantsSoundSport = namesSoundSport(event.eligibleClasses);
  const byClass = candidates.filter(
    (show) => namesSoundSport(show.allowedClasses) === wantsSoundSport
  );
  return byClass.length === 1 ? byClass[0] : null;
}

/**
 * "Top 12 from Semifinals · field set by Day 48 scores" — the one-line
 * explanation of why an advancement round's field is (or will be) a cut of
 * the class, not everyone. Null for Prelims, the SoundSport festival and
 * every regular show.
 * @param {Advancement|null|undefined} advancement
 * @returns {string|null}
 */
export function advancementLabel(advancement) {
  if (!advancement || !advancement.rule || !Number.isFinite(advancement.fromDay)) return null;
  return advancement.status === 'final'
    ? `${advancement.rule} · field set by Day ${advancement.fromDay} scores`
    : `${advancement.rule} · full field until Day ${advancement.fromDay} scores decide the cut`;
}

/**
 * "Night 1 of 2 · lineups announced Day 39" — the one-line explanation of why
 * a two-night field is half the registrants. Null for ordinary shows.
 * @param {NightAssignment|null|undefined} night
 * @returns {string|null}
 */
export function nightAssignmentLabel(night) {
  if (!night || !Array.isArray(night.nights) || night.nights.length < 2) return null;
  const index = night.nights.indexOf(night.day);
  const which = index >= 0 ? `Night ${index + 1} of ${night.nights.length}` : `Day ${night.day}`;
  const state =
    night.status === 'final'
      ? 'final lineup'
      : night.status === 'preview'
        ? 'published lineup, re-seeds as corps register'
        : `provisional split, lineups announced Day ${night.nights[0] - 2}`;
  return `${which} · ${state}`;
}

// A show is considered "live" from its real start time until scores are announced
// (or, if we only know the start, for an estimated 3-hour window). Runs entirely
// on the enriched `startsAt`/`scoresAt` instants — no guessing from wall-clock.
const DEFAULT_SHOW_DURATION_MS = 3 * 60 * 60 * 1000;

/** A transformed show, as `transformCompetitionToShow` returns it.
 * @typedef {ReturnType<typeof transformCompetitionToShow>} TransformedShow */

/**
 * Get a show's real start time as a Date, or null if not enriched.
 * @param {TimedShow} show
 * @returns {Date|null}
 */
export function showStartsAtDate(show) {
  return show?.startsAt ? new Date(show.startsAt) : null;
}

/**
 * Get the instant a show's competition window ends (scores announced, or start +
 * estimated duration).
 * @param {TimedShow} show
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
 * @param {TimedShow} show
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
 * @param {TimedShow} show
 * @param {Date} [now]
 * @returns {{current: LineupEntry|null, next: LineupEntry|null}}
 */
export function getRunningOrderStatus(show, now = new Date()) {
  const lineup = Array.isArray(show?.lineup) ? show.lineup : [];
  if (lineup.length === 0) return { current: null, next: null };

  const timed = lineup
    .filter((p) => p.performsAt)
    .map((p) => ({ ...p, _at: new Date(/** @type {string} */ (p.performsAt)) }))
    .sort((a, b) => a._at.getTime() - b._at.getTime());
  if (timed.length === 0) return { current: null, next: null };

  const endMs = showEndsAtDate(show)?.getTime() ?? Infinity;
  /** @type {LineupEntry|null} */
  let current = null;
  /** @type {LineupEntry|null} */
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
 * @typedef {Object} PerformerSlot
 * @property {LineupEntry} entry
 * @property {TimedShow} show
 * @property {('onNow'|'upcoming'|'done'|'unknown')} state
 * @property {number|null} minutesUntil
 */

/**
 * Status of ONE performer's slot relative to now: is this corps on the field
 * right now, how many whole minutes until it takes the field, and has it already
 * performed. A corps holds the field from its `performsAt` until the next
 * performer's time (the last uses the show end). Pure — inject `now` for tests.
 *
 * @param {TimedShow} show - enriched show with a `lineup` (and startsAt/scoresAt).
 * @param {LineupEntry} entry - a lineup entry (must carry `performsAt`).
 * @param {Date} [now]
 * @returns {{state:('onNow'|'upcoming'|'done'|'unknown'), minutesUntil:(number|null)}}
 */
export function getPerformanceStatus(show, entry, now = new Date()) {
  if (!entry || !entry.performsAt) return { state: 'unknown', minutesUntil: null };
  const timed = (Array.isArray(show?.lineup) ? show.lineup : [])
    .filter((p) => p.performsAt)
    .map((p) => ({ ...p, _at: new Date(/** @type {string} */ (p.performsAt)).getTime() }))
    .sort((a, b) => a._at - b._at);
  const at = new Date(entry.performsAt).getTime();
  if (Number.isNaN(at)) return { state: 'unknown', minutesUntil: null };

  const idx = timed.findIndex((p) => p._at === at && p.order === entry.order);
  const endMs = showEndsAtDate(show)?.getTime() ?? Infinity;
  const stopMs = idx >= 0 && idx + 1 < timed.length ? timed[idx + 1]._at : endMs;
  const nowMs = now.getTime();

  if (nowMs >= at && nowMs < stopMs) return { state: 'onNow', minutesUntil: 0 };
  if (nowMs < at) return { state: 'upcoming', minutesUntil: Math.ceil((at - nowMs) / 60000) };
  return { state: 'done', minutesUntil: null };
}

/**
 * Find the viewing director's OWN corps slots in a show's real-field running
 * order (matched by uid), each with its live status. Powers the "your corps
 * takes the field" element.
 *
 * @param {TimedShow} show - enriched show (lineup entries carry `uid`).
 * @param {string} myUid
 * @param {Date} [now]
 * @returns {Array<PerformerSlot>}
 */
export function getMyPerformanceSlots(show, myUid, now = new Date()) {
  if (!myUid || !Array.isArray(show?.lineup)) return [];
  return show.lineup
    .filter((e) => e.uid && e.uid === myUid)
    .map((entry) => ({ entry, show, ...getPerformanceStatus(show, entry, now) }));
}

/**
 * Rank of a performance state for "which of my slots matters most right now":
 * on the field beats upcoming beats done/unknown. Ties on state break by soonest.
 */
const MY_SLOT_STATE_RANK = { onNow: 0, upcoming: 1, done: 2, unknown: 3 };

/**
 * Across many shows, pick the director's single most relevant own-corps slot:
 * one on the field now, else the soonest upcoming. Returns null if none.
 * @param {Array<TimedShow>} shows - enriched shows.
 * @param {string} myUid
 * @param {Date} [now]
 * @returns {PerformerSlot|null}
 */
export function pickMyNextPerformance(shows, myUid, now = new Date()) {
  const slots = [];
  for (const show of shows || []) slots.push(...getMyPerformanceSlots(show, myUid, now));
  const live = slots.filter((s) => s.state === 'onNow' || s.state === 'upcoming');
  if (live.length === 0) return null;
  live.sort((a, b) => {
    const r = MY_SLOT_STATE_RANK[a.state] - MY_SLOT_STATE_RANK[b.state];
    if (r !== 0) return r;
    return (a.minutesUntil ?? Infinity) - (b.minutesUntil ?? Infinity);
  });
  return live[0];
}

/**
 * Filter and transform competitions for a specific week
 * @param {RawCompetition[]} competitions - Raw competitions array from Firestore
 * @param {number} weekNumber - Week to filter (1-7)
 * @param {{skipChampionship?: boolean}} [options] - Filter options
 * @returns {TransformedShow[]} Filtered and transformed shows
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
 * @param {RawCompetition[]} competitions - Raw competitions array
 * @returns {Record<number, TransformedShow[]>} Object with week numbers as keys, arrays of shows as values
 */
export function groupShowsByWeek(competitions) {
  /** @type {Record<number, TransformedShow[]>} */
  const grouped = {};

  competitions.forEach((comp) => {
    const week = comp.week || Math.ceil(comp.day / 7);
    if (!grouped[week]) grouped[week] = [];
    grouped[week].push(transformCompetitionToShow(comp));
  });

  // Sort shows within each week by day
  Object.values(grouped).forEach((shows) => {
    shows.sort((a, b) => a.day - b.day);
  });

  return grouped;
}

/**
 * Group competitions by day (for Schedule page day-based view)
 * @param {RawCompetition[]} competitions - Raw competitions array
 * @returns {Array<{offSeasonDay: number, week: number, shows: TransformedShow[]}>} Array of day objects with shows
 */
export function groupShowsByDay(competitions) {
  /** @type {Record<number, {offSeasonDay: number, week: number, shows: TransformedShow[]}>} */
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
 * @param {RawCompetition[]} competitions - Raw competitions array
 * @param {number} dayNumber - Day number (1-49)
 * @returns {TransformedShow[]} Shows for that day
 */
export function getShowsForDay(competitions, dayNumber) {
  return competitions.filter((comp) => comp.day === dayNumber).map(transformCompetitionToShow);
}

/**
 * Count shows per week (for week pills display)
 * @param {RawCompetition[]} competitions - Raw competitions array
 * @returns {Record<number, number>} Object with week numbers as keys, counts as values
 */
export function getShowCountsByWeek(competitions) {
  /** @type {Record<number, number>} */
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
 * @param {{name?: string, date?: *, startsAt?: string|null, timezone?: string|null}} comp - Competition or transformed show ({ date, startsAt, timezone }).
 * @returns {string|null}
 */
export function showCalendarDay(comp) {
  if (comp.date) {
    const d = comp.date instanceof Date ? comp.date : new Date(comp.date);
    if (!Number.isNaN(d.getTime())) return formatDayKey(d, 'UTC');
  }
  if (comp.startsAt) {
    const d = new Date(comp.startsAt);
    if (!Number.isNaN(d.getTime())) return formatDayKey(d, comp.timezone ?? undefined);
  }
  return null;
}

/**
 * Check if an event date is considered "past" for display purposes.
 * Events are considered past only once the nightly score processing after
 * show day has run (2 AM ET — the same instant registration closes), via
 * the shared season clock.
 * @param {Date|null} eventDate - The date of the event
 * @returns {boolean} True if the event is past
 */
export function isEventPast(eventDate) {
  const deadline = getShowRegistrationDeadline(eventDate);
  return deadline ? new Date() >= deadline : false;
}
