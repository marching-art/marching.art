// Showday model — the who/what/where/when of a director's OWN show day, for
// the dashboard's Showday strip. Pure data joins over the season schedule:
// no React, no Firestore, injectable `now`/`currentDay` for tests.
//
// Two divisions share the model:
//   - Fantasy: the corps' registered shows (corps.selectedShows) joined to the
//     schedule's competitions; the materialized fantasy running order supplies
//     the director's own timed slot (matched by uid).
//   - Podium: attendance lives in the podium state (selectedShows keyed by day,
//     plus auto-enrolled major days); the podium field's running order
//     (competition.podiumSchedule) supplies the slot.

import {
  transformCompetitionToShow,
  isShowLive,
  showStartsAtDate,
  showEndsAtDate,
  getRunningOrderStatus,
  getMyPerformanceSlots,
  formatDayKey,
  showCalendarDay,
} from './scheduleUtils';
import { CAPTION_LABELS, normalizeCorpsName } from './pickHighlights';

/**
 * @typedef {import('./scheduleUtils').LineupEntry} LineupEntry
 * @typedef {import('./scheduleUtils').PerformerSlot} PerformerSlot
 */

/**
 * One field's materialized schedule (competition.fantasySchedule /
 * .podiumSchedule), as written by scheduled/scheduleRunningOrder.js.
 * @typedef {Object} FieldSchedule
 * @property {string} [startsAt]
 * @property {string} [scoresAt]
 * @property {string} [gatesAt]
 * @property {string} [timezone]
 * @property {LineupEntry[]} [lineup]
 * @property {Array<{uid?: string|null, corps?: string}>} [overflow]
 */

/**
 * The slice of a raw `schedules/{seasonUid}` competition this module reads.
 * @typedef {Object} RawCompetition
 * @property {number} [day]
 * @property {string} [name]
 * @property {string|Date} [date]
 * @property {string|null} [timezone]
 * @property {LineupEntry[]|null} [lineup]
 * @property {{uid?: string, corps?: string, reason?: string}|null} [encore]
 * @property {{uid?: string, corps?: string, reason?: string}|null} [podiumEncore]
 * @property {FieldSchedule|null} [fantasySchedule]
 * @property {FieldSchedule|null} [podiumSchedule]
 */

/**
 * A transformed show (transformCompetitionToShow / projectPodiumShow). The
 * transform passes through more than this module reads; only the fields the
 * showday surfaces consume are modeled.
 * @typedef {Object} ShowLike
 * @property {number} day
 * @property {string} eventName
 * @property {string} location
 * @property {string|null} [venue]
 * @property {string|null} [timezone]
 * @property {string|null} [startsAt]
 * @property {string|null} [scoresAt]
 * @property {string|null} [gatesAt]
 * @property {boolean} [isChampionship]
 * @property {LineupEntry[]|null} [lineup]
 * @property {Array<{uid?: string|null, corps?: string}>|null} [overflow]
 * @property {{uid?: string, corps?: string, reason?: string}|null} [encore]
 * @property {{uid?: string, corps?: string, reason?: string}|null} [podiumEncore]
 * @property {{summary?: string, tempF?: number}|null} [weather]
 * @property {FieldSchedule|null} [fantasySchedule]
 * @property {FieldSchedule|null} [podiumSchedule]
 */

/**
 * @typedef {Object} ShowdayModel
 * @property {('live'|'today'|'done'|'upcoming'|'none')} phase - Where the
 *   director's day stands: their show is on the field now / later today / has
 *   finished tonight / their next show is on a later day / nothing scheduled.
 * @property {ShowLike|null} show - The featured show (today's, else the next).
 * @property {PerformerSlot|null} mySlot - The director's own slot in the
 *   featured day's running order, when materialized.
 * @property {LineupEntry|null} onNow - Corps on the field right now (live only).
 * @property {LineupEntry|null} upNext - Corps up next (live only).
 */

/**
 * Join key for a competition: season day + normalized event name.
 * @param {number|undefined} day
 * @param {unknown} name
 */
const compKey = (day, name) => `${day}::${normalizeCorpsName(name)}`;

/**
 * A show's start instant in ms, Infinity when untimed (sorts last).
 * @param {Object} s
 */
const showStartMs = (s) => showStartsAtDate(s)?.getTime() ?? Infinity;

/**
 * Join a fantasy corps' registered shows (corps.selectedShows, keyed
 * `week{n}` -> [{ day, eventName }]) to the schedule's competitions.
 * @param {RawCompetition[]} competitions - Raw competitions from scheduleStore.
 * @param {Record<string, Array<{day?: number, eventName?: string, name?: string}>>|null|undefined} selectedShows
 * @returns {ShowLike[]} transformed shows (see transformCompetitionToShow)
 */
export function joinFantasyShows(competitions, selectedShows) {
  /** @type {Map<string, RawCompetition>} */
  const byKey = new Map();
  for (const comp of competitions || []) {
    byKey.set(compKey(comp.day, comp.name), comp);
  }
  const joined = [];
  for (const weekShows of Object.values(selectedShows || {})) {
    if (!Array.isArray(weekShows)) continue;
    for (const sel of weekShows) {
      const comp = byKey.get(compKey(sel.day, sel.eventName || sel.name));
      if (comp) joined.push(transformCompetitionToShow(comp));
    }
  }
  return joined;
}

/**
 * Project a competition's PODIUM field onto the common show shape: podium
 * times and lineup where materialized. Without a materialized podium schedule
 * the fantasy/scraped times remain (same venue, same evening — a fair "when"),
 * but the lineup is nulled so the fantasy field is never presented as the
 * podium running order.
 * @param {RawCompetition} comp - Raw competition.
 * @returns {ShowLike} transformed show
 */
export function projectPodiumShow(comp) {
  const base = transformCompetitionToShow(comp);
  const ps = comp.podiumSchedule || null;
  return {
    ...base,
    lineup: ps?.lineup ?? null,
    overflow: ps?.overflow ?? null,
    startsAt: ps?.startsAt ?? base.startsAt,
    scoresAt: ps?.scoresAt ?? base.scoresAt,
    gatesAt: ps?.gatesAt ?? base.gatesAt,
    timezone: ps?.timezone ?? base.timezone,
    // The podium field decides its own encore (competition.podiumEncore),
    // projected into the common slot so encore readers see the right side's.
    encore: base.podiumEncore ?? null,
  };
}

/**
 * The shows a Podium corps attends: the director's self-picked shows
 * (state.selectedShows, keyed by day, matched by event name) plus the
 * auto-enrolled major days (one event per such day).
 * @param {RawCompetition[]} competitions - Raw competitions from scheduleStore.
 * @param {{selectedShows?: Record<number, {eventName?: string}|null>|null, autoDays?: number[]|null}|null|undefined} podiumPicks
 * @returns {ShowLike[]} projected podium shows
 */
export function joinPodiumShows(competitions, podiumPicks) {
  const picks = podiumPicks?.selectedShows || {};
  const autoDays = new Set(podiumPicks?.autoDays || []);
  const joined = [];
  for (const comp of competitions || []) {
    const day = comp.day;
    if (typeof day !== 'number') continue;
    const pick = picks[day];
    const isPicked =
      pick?.eventName && normalizeCorpsName(pick.eventName) === normalizeCorpsName(comp.name);
    if (isPicked || autoDays.has(day)) joined.push(projectPodiumShow(comp));
  }
  return joined;
}

/**
 * Rank for choosing the director's most relevant own slot: on the field beats
 * upcoming beats done. Ties on state break by soonest.
 * @type {Record<string, number>}
 */
const SLOT_RANK = { onNow: 0, upcoming: 1, done: 2, unknown: 3 };

/**
 * Build the Showday model for one corps: which of the director's shows matters
 * right now (today's — live, pending, or finished — else the next one), their
 * own timed slot in it, and the live on-field context.
 *
 * @param {Object} params
 * @param {ShowLike[]} params.shows - The corps' joined shows (joinFantasyShows / joinPodiumShows).
 * @param {number|null|undefined} params.currentDay - Season day in progress (rolls at the 2 AM ET reset).
 * @param {string|null|undefined} params.myUid - The director's uid, matched against running-order slots.
 * @param {string|null} [params.corpsClass] - Restrict slot matching to this class
 *   (a director can have corps in several classes at the same event).
 * @param {Date} [params.now]
 * @returns {ShowdayModel}
 */
export function buildShowdayModel({
  shows,
  currentDay,
  myUid,
  corpsClass = null,
  now = new Date(),
}) {
  const all = Array.isArray(shows) ? shows.filter((s) => typeof s?.day === 'number') : [];
  const todayShows = currentDay == null ? [] : all.filter((s) => s.day === currentDay);

  /** @type {ShowdayModel['phase']} */
  let phase = 'none';
  let featured = todayShows.find((s) => isShowLive(s, now)) || null;
  if (featured) {
    phase = 'live';
  } else if (todayShows.length > 0) {
    // Not started yet vs already finished tonight. Untimed shows (no enriched
    // startsAt) count as pending — the day itself says "you compete tonight".
    const pending = todayShows
      .filter((s) => {
        const end = showEndsAtDate(s);
        return !end || end > now;
      })
      .sort((a, b) => showStartMs(a) - showStartMs(b));
    if (pending.length > 0) {
      featured = pending[0];
      phase = 'today';
    } else {
      featured = todayShows[todayShows.length - 1];
      phase = 'done';
    }
  } else {
    const upcoming = all
      .filter((s) => currentDay == null || s.day > currentDay)
      .sort((a, b) => a.day - b.day || showStartMs(a) - showStartMs(b));
    if (upcoming.length > 0) {
      featured = upcoming[0];
      phase = 'upcoming';
    }
  }

  // The director's own slot across the featured day. On a show day every one
  // of that day's shows is eligible (they registered for them all); otherwise
  // just the featured show.
  const slotPool = phase === 'upcoming' ? (featured ? [featured] : []) : todayShows;
  /** @type {PerformerSlot[]} */
  const slots = [];
  if (myUid) {
    for (const show of slotPool) slots.push(...getMyPerformanceSlots(show, myUid, now));
  }
  const mine = slots
    .filter((s) => !corpsClass || !s.entry.corpsClass || s.entry.corpsClass === corpsClass)
    .sort((a, b) => {
      const r = (SLOT_RANK[a.state] ?? 9) - (SLOT_RANK[b.state] ?? 9);
      if (r !== 0) return r;
      return (a.minutesUntil ?? Infinity) - (b.minutesUntil ?? Infinity);
    });
  const mySlot = mine[0] || null;

  const status =
    phase === 'live' && featured
      ? getRunningOrderStatus(featured, now)
      : { current: null, next: null };

  return {
    phase,
    show: featured,
    mySlot,
    onNow: /** @type {LineupEntry|null} */ (status.current),
    upNext: /** @type {LineupEntry|null} */ (status.next),
  };
}

/**
 * @typedef {Object} PickSpotlightEntry
 * @property {string} corps
 * @property {string[]} captions
 * @property {string} showName
 * @property {string|null} timezone
 * @property {Date|null} performsAt
 */

/**
 * "Your picks are on tour today": the director's picked real corps performing
 * at any show on TODAY's calendar date, with the minute each takes the field.
 * (Fantasy only — Podium has no caption picks.)
 * @param {RawCompetition[]} competitions - Raw competitions from scheduleStore.
 * @param {Record<string, string>|null|undefined} lineup - Caption -> "CorpsName|Year".
 * @param {Date} [now]
 * @returns {PickSpotlightEntry[]} sorted by performance time
 */
export function buildPicksSpotlight(competitions, lineup, now = new Date()) {
  /** @type {Map<string, {corps: string, captions: string[]}>} */
  const picksByCorps = new Map();
  for (const [caption, value] of Object.entries(lineup || {})) {
    if (!value) continue;
    const corpsName = String(value).split('|')[0];
    const key = normalizeCorpsName(corpsName);
    if (!key) continue;
    if (!picksByCorps.has(key)) picksByCorps.set(key, { corps: corpsName, captions: [] });
    picksByCorps.get(key)?.captions.push(CAPTION_LABELS[caption] || caption);
  }
  if (picksByCorps.size === 0) return [];

  const todayKey = formatDayKey(now);
  /** @type {PickSpotlightEntry[]} */
  const entries = [];
  for (const comp of competitions || []) {
    if (!Array.isArray(comp.lineup) || comp.lineup.length === 0) continue;
    if (showCalendarDay(comp) !== todayKey) continue;
    for (const performer of comp.lineup) {
      const pick = picksByCorps.get(normalizeCorpsName(performer.corps));
      if (!pick) continue;
      entries.push({
        corps: pick.corps,
        captions: pick.captions,
        showName: comp.name || '',
        timezone: comp.timezone ?? null,
        performsAt: performer.performsAt ? new Date(performer.performsAt) : null,
      });
    }
  }
  return entries.sort((a, b) => (a.performsAt?.getTime() ?? 0) - (b.performsAt?.getTime() ?? 0));
}

/**
 * Is the director's corps this show's encore? Cosmetic pride moment. Reads
 * the joined shows' projected encore slot, so each division sees its own
 * side's encore (projectPodiumShow maps podiumEncore into it).
 * @param {ShowLike[]} shows - Joined shows.
 * @param {string|null|undefined} myUid
 * @returns {{show: ShowLike, encore: {uid?: string, corps?: string, reason?: string}}|null}
 */
export function findMyEncore(shows, myUid) {
  if (!myUid) return null;
  for (const show of shows || []) {
    if (show.encore && show.encore.uid === myUid) return { show, encore: show.encore };
  }
  return null;
}
