/**
 * Tour stops — a corps' season itinerary, in travel order.
 *
 * The Schedule page shows a director WHICH shows they registered for; the tour
 * map shows them the SEASON as a route. This module turns the three places
 * attendance is recorded into one ordered list:
 *
 *   1. `corps.selectedShows.week{N}` — the shows a director registered for.
 *      These already carry a whitelisted {eventName, day, date, location}
 *      resolved server-side (functions/src/helpers/showSelection.js), so a
 *      stop survives even when the live schedule doc hasn't loaded.
 *   2. Championship Week — auto-enrolled by class, never registered for, so it
 *      appears nowhere in selectedShows. Advancement (top 25 / top 12) isn't
 *      known ahead of time; like the Championship Week cards, every event the
 *      corps' class is eligible for is shown.
 *   3. Podium attendance — the director-simulation corps picks shows outside
 *      the fantasy `selectedShows` map, so the caller passes the same derived
 *      {events, autoDays} the Schedule page already computes.
 *
 * Locations resolve to map coordinates through the venue gazetteer. A stop
 * whose city isn't in the gazetteer keeps `point: null` — it stays in the
 * itinerary list and is simply not plotted, rather than being dropped or
 * pinned somewhere wrong.
 */

import { locationPoint, venueLatLng, type VenuePoint } from './tourMap';
import { CORPS_CLASS_ALIASES } from './corps';
import type { StopKind } from '../data/tourPosterTheme';

/** Weeks in a season — selectedShows is keyed `week1`…`week7`. */
const TOTAL_WEEKS = 7;

/**
 * The branded majors keep their scraped names in live seasons, where eventTier
 * isn't stamped until the schedule is regenerated. Recognize them by name too,
 * exactly as the Schedule cards do.
 */
const MAJOR_NAME_RE = /(southwestern|southeastern) championship|eastern classic/i;

/** The subset of a schedule show / stored selection this module reads. */
export interface TourSource {
  eventName?: string;
  day?: number;
  week?: number;
  location?: string | null;
  type?: string;
  eventTier?: string | null;
  isChampionship?: boolean;
  eligibleClasses?: string[];
  multiNight?: { nights?: number[] } | null;
}

export interface TourStop {
  day: number;
  week: number;
  eventName: string;
  location: string;
  kind: StopKind;
  /** One registration covering more than one night (e.g. the Eastern Classic). */
  multiNight: boolean;
  /** Attended by enrollment rather than by registration. */
  auto: boolean;
  point: VenuePoint | null;
}

export interface PodiumAttendance {
  events?: Set<string>;
  autoDays?: Set<number>;
}

export interface BuildTourStopsParams {
  /** Profile corps record (`corps.worldClass`, …). Ignored for the Podium corps. */
  corps?: { selectedShows?: Record<string, TourSource[]> } | null;
  /** Canonical class key ('worldClass', 'podiumClass', …). */
  corpsClass: string;
  /** This season's shows, already transformed (scheduleUtils.transformCompetitionToShow). */
  competitions?: TourSource[];
  /**
   * Championship Week events (pages/scheduleConstants.CHAMPIONSHIP_EVENTS),
   * passed in so this module stays free of page-level imports.
   */
  championshipEvents?: TourSource[];
  podiumAttendance?: PodiumAttendance | null;
}

/**
 * The one event a Podium corps auto-attends on an auto-day: the regional major
 * or its division's championship — never a pool show that merely shares the
 * date, and never the day-49 SoundSport festival. Mirrors isPodiumAutoAnchor
 * in src/pages/ScheduleParts.jsx.
 */
function isPodiumAutoAnchor(show: TourSource): boolean {
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

/** Which marker treatment a stop earns. */
function stopKind(show: TourSource): StopKind {
  if (show.isChampionship || show.type === 'championship') return 'championship';
  if (show.eventTier === 'regional' || MAJOR_NAME_RE.test(show.eventName || '')) return 'major';
  return 'show';
}

/** Every accepted spelling of a class key, so legacy 'world'/'open' still match. */
function classAliases(corpsClass: string): string[] {
  return CORPS_CLASS_ALIASES[corpsClass] || [corpsClass];
}

/** Build the ordered itinerary for one corps, sorted by day. */
export function buildTourStops({
  corps,
  corpsClass,
  competitions = [],
  championshipEvents = [],
  podiumAttendance = null,
}: BuildTourStopsParams): TourStop[] {
  const scheduleByName = new Map<string, TourSource>();
  for (const comp of competitions) {
    if (comp?.eventName && !scheduleByName.has(comp.eventName)) {
      scheduleByName.set(comp.eventName, comp);
    }
  }

  // Keyed by day+eventName: a two-night event is one stop, and a show that is
  // both registered and auto-enrolled must not appear twice.
  const stops = new Map<string, TourStop>();

  const addStop = (source: TourSource, { auto = false }: { auto?: boolean } = {}) => {
    const eventName = source?.eventName;
    const day = Number(source?.day);
    if (!eventName || !Number.isFinite(day)) return;

    const key = `${day}::${eventName}`;
    if (stops.has(key)) return;

    // The live schedule is the better source for tier/multi-night metadata; the
    // stored selection is the better source for a stop whose show has since
    // fallen off the schedule. Prefer the schedule, fall back to the selection.
    const scheduled = scheduleByName.get(eventName);
    const location = source.location || scheduled?.location || '';

    stops.set(key, {
      day,
      week: Number(source.week || scheduled?.week) || Math.ceil(day / 7),
      eventName,
      location,
      kind: stopKind({ ...scheduled, ...source }),
      multiNight: Boolean(scheduled?.multiNight?.nights && scheduled.multiNight.nights.length > 1),
      auto,
      point: location ? locationPoint(location) : null,
    });
  };

  if (corpsClass === 'podiumClass') {
    // Podium picks one show per night by name, and auto-attends the anchor
    // event on major/championship days.
    const events = podiumAttendance?.events || new Set<string>();
    const autoDays = podiumAttendance?.autoDays || new Set<number>();

    for (const comp of competitions) {
      if (comp?.eventName && events.has(comp.eventName)) addStop(comp);
    }
    // Auto-attended anchors: exactly ONE per auto-day. Championship-week days
    // take their canonical name from championshipEvents — the same source the
    // Schedule page's Championship Week renders — so a season-schedule copy of
    // the same championship under a scraped/historical name (e.g. "…Division I
    // World Championship Prelims") can't double-book the day against the
    // canonical "…World Championship Prelims". Majors aren't in
    // championshipEvents, so they fall through to the schedule. Guarding by day
    // (not day+name) is what collapses the two differently-named copies into
    // one stop.
    const anchoredDays = new Set<number>();
    const addAutoAnchor = (source: TourSource) => {
      const day = Number(source?.day);
      if (!autoDays.has(day) || anchoredDays.has(day)) return;
      if (!isPodiumAutoAnchor(source)) return;
      anchoredDays.add(day);
      addStop(source, { auto: true });
    };
    for (const event of championshipEvents) addAutoAnchor(event);
    for (const comp of competitions) addAutoAnchor(comp);
  } else {
    const selectedShows = corps?.selectedShows || {};
    for (let week = 1; week <= TOTAL_WEEKS; week++) {
      for (const show of selectedShows[`week${week}`] || []) {
        addStop({ week, ...show });
      }
    }

    // Championship Week is enrollment by class, not by registration.
    if (corps) {
      const aliases = classAliases(corpsClass);
      for (const event of championshipEvents) {
        const eligible = event?.eligibleClasses || [];
        if (aliases.some((alias) => eligible.includes(alias))) addStop(event, { auto: true });
      }
    }
  }

  return [...stops.values()].sort(
    (a, b) => a.day - b.day || a.eventName.localeCompare(b.eventName)
  );
}

/**
 * Total miles between consecutive plotted stops, great-circle, in the order a
 * corps travels them. Unplaceable stops are skipped rather than treated as the
 * origin, so one unknown city can't invent a 2,000-mile leg.
 */
export function tourDistance(stops: Array<Pick<TourStop, 'point'>>): number {
  const coords: Array<{ lat: number; lng: number }> = [];
  for (const stop of stops) {
    const coord = stop.point ? venueLatLng(stop.point.venueId) : null;
    if (coord) coords.push(coord);
  }

  const R = 3958.8; // Earth radius, miles
  const rad = (deg: number) => (deg * Math.PI) / 180;
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1];
    const b = coords[i];
    const dLat = rad(b.lat - a.lat);
    const dLng = rad(b.lng - a.lng);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    total += 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  return Math.round(total);
}

/**
 * Distinct states/provinces visited, in first-visit order. The map already
 * shows the shape of a tour; this is the stat a director quotes.
 */
export function tourRegions(stops: Array<Pick<TourStop, 'point'>>): string[] {
  const seen: string[] = [];
  for (const stop of stops) {
    const region = stop.point?.region;
    if (region && !seen.includes(region)) seen.push(region);
  }
  return seen;
}
