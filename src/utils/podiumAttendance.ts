/**
 * Podium attendance — which schedule entries a Podium corps is on the bill for.
 *
 * The Podium corps records attendance outside the fantasy `selectedShows` map:
 *   - self-picks: `state.selectedShows = { [day]: {eventName, location} }` —
 *     ONE show per night, matched by event name;
 *   - auto-days: the majors + the corps' championship days (`autoDays` from
 *     getPodiumState) — on those days it attends exactly the anchor event.
 *
 * The Schedule page derives `{events, autoDays}` once and every consumer (show
 * cards, the registration modal, the tour map) asks these helpers, so the
 * Eastern Classic rule lives in one place: a two-night event is ONE
 * registration. The corps is on the bill both nights and performs on its
 * assigned one — exactly how a fantasy registration badges both nights (it
 * matches by event name). `autoDays` only carries the performing night, so
 * every night of the event counts as attended when any of them does.
 */

export interface PodiumAttendance {
  /** Event names the corps self-picked (one per night). */
  events?: Set<string> | null;
  /** Competition days the corps auto-attends (majors + its championship days). */
  autoDays?: Set<number> | null;
  corpsName?: string;
}

/** The subset of a schedule entry these helpers read. */
export interface PodiumShowLike {
  day?: number | string | null;
  eventName?: string | null;
  eventTier?: string | null;
  type?: string | null;
  isChampionship?: boolean | null;
  eligibleClasses?: string[] | null;
  multiNight?: { nights?: number[] | null } | null;
}

// The branded majors keep their real scraped names in live seasons, where
// eventTier isn't stamped until the schedule is regenerated/refreshed — so
// recognize them by name as a fallback and identify the anchor either way.
const MAJOR_NAME_RE = /(southwestern|southeastern) championship|eastern classic/i;

/**
 * The one event a Podium corps auto-attends on an auto-day: the regional major
 * or its division's championship — never a pool show that merely shares the
 * date, and never the day-49 SoundSport festival.
 */
export function isPodiumAutoAnchor(show: PodiumShowLike | null | undefined): boolean {
  const eligible = show?.eligibleClasses;
  if (Array.isArray(eligible) && eligible.length === 1 && eligible[0] === 'soundSport')
    return false;
  return Boolean(
    show?.eventTier === 'regional' ||
    show?.isChampionship === true ||
    show?.type === 'championship' ||
    MAJOR_NAME_RE.test(show?.eventName || '')
  );
}

/** The nights of a multi-night event (`[41, 42]` for the Eastern Classic), else []. */
export function multiNightNights(show: PodiumShowLike | null | undefined): number[] {
  const nights = show?.multiNight?.nights;
  return Array.isArray(nights) && nights.length > 1 ? nights : [];
}

/**
 * The auto-attended night of `show` for this corps: the show's own day when it
 * is an auto-day, else (for a multi-night event) whichever of its nights is —
 * the night the corps performs. Null when the corps doesn't auto-attend it.
 */
export function podiumAutoNightFor(
  autoDays: Set<number> | number[] | null | undefined,
  show: PodiumShowLike | null | undefined
): number | null {
  if (!autoDays) return null;
  const days = autoDays instanceof Set ? autoDays : new Set(autoDays);
  const day = Number(show?.day);
  if (Number.isFinite(day) && days.has(day)) return day;
  return multiNightNights(show).find((night) => days.has(night)) ?? null;
}

/**
 * True when the corps auto-attends this show's day — or, for a two-night
 * event, any of its nights (one registration covers both).
 */
export function podiumAutoAttendsDay(
  podiumAttendance: PodiumAttendance | null | undefined,
  show: PodiumShowLike | null | undefined
): boolean {
  return podiumAutoNightFor(podiumAttendance?.autoDays, show) !== null;
}

/**
 * Podium attends a SPECIFIC show: self-picks match by eventName (one show per
 * night — never every show that day); majors/championship are auto-attended,
 * so on those days only the anchor event counts, not every co-located pool
 * show. A two-night anchor counts on every one of its nights.
 */
export function podiumAttendsShow(
  podiumAttendance: PodiumAttendance | null | undefined,
  show: PodiumShowLike | null | undefined
): boolean {
  if (!podiumAttendance || !show) return false;
  if (show.eventName && podiumAttendance.events?.has(show.eventName)) return true;
  return podiumAutoAttendsDay(podiumAttendance, show) && isPodiumAutoAnchor(show);
}
