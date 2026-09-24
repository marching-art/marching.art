// =============================================================================
// FIXED EVENT NAMES — the majors and Championship Week
// =============================================================================
// marching.art's majors (Southwestern, Southeastern, the two-night Eastern
// Classic) and every Championship Week round (days 45–49) are branded game
// events on fixed days at fixed sites. Their names are hard-coded here, and
// this module is the ONE place the client turns a schedule row for one of
// those days into the name a director sees.
//
// Why a display-time step is needed at all: the off-season generator seeds a
// season's day-47/48/49 rows from the historical archive (so the row carries
// a real date), and an archive row arrives with its historical title — e.g.
// "DCI Division I World Championship Quarterfinals" for a 2000s year. The
// generator now stamps the canonical name on those rows, but a season minted
// before that fix still carries the archive title in `schedules/{seasonUid}`,
// and renaming a live season's rows would break every join keyed by event
// name. So the stored name stays the join key, and `displayEventName` is the
// label. The Schedule page's Championship Week panel already renders from
// CHAMPIONSHIP_EVENTS; the dashboard and its feeds go through this helper.
//
// Server twin of the names: functions/src/helpers/scheduleGeneration.js
// (generateLiveSeasonSchedule / generateOffSeasonSchedule) and the
// `patchChampionshipShows` admin action.

import { formatEventName } from './season';

export interface ChampionshipEvent {
  day: 45 | 46 | 47 | 48 | 49;
  eventName: string;
  location: string;
  eligibleClasses: string[];
  isChampionship: true;
  description: string;
}

// Championship Week (Week 7) event configuration.
// isChampionship marks these as auto-enrolled anchor events (the Podium corps
// auto-attends its division's championship days); the SoundSport festival is
// still isChampionship but soundSport-only, so Podium never auto-attends it.
export const CHAMPIONSHIP_EVENTS: ChampionshipEvent[] = [
  {
    day: 45,
    eventName: 'Open and A Class Prelims',
    location: 'Marion, IN',
    eligibleClasses: ['openClass', 'aClass'],
    isChampionship: true,
    description: 'All Open and A Class corps compete',
  },
  {
    day: 46,
    eventName: 'Open and A Class Finals',
    location: 'Marion, IN',
    eligibleClasses: ['openClass', 'aClass'],
    isChampionship: true,
    description: 'Top 8 Open Class, Top 4 A Class advance',
  },
  {
    day: 47,
    eventName: 'marching.art World Championship Prelims',
    location: 'Indianapolis, IN',
    eligibleClasses: ['worldClass', 'openClass', 'aClass'],
    isChampionship: true,
    description: 'All World, Open, and A Class corps compete',
  },
  {
    day: 48,
    eventName: 'marching.art World Championship Semifinals',
    location: 'Indianapolis, IN',
    eligibleClasses: ['worldClass', 'openClass', 'aClass'],
    isChampionship: true,
    description: 'Top 25 from Prelims advance',
  },
  {
    day: 49,
    eventName: 'marching.art World Championship Finals',
    location: 'Indianapolis, IN',
    eligibleClasses: ['worldClass', 'openClass', 'aClass'],
    isChampionship: true,
    description: 'Top 12 from Semifinals compete for title',
  },
  {
    day: 49,
    eventName: 'SoundSport International Music & Food Festival',
    location: 'Indianapolis, IN',
    eligibleClasses: ['soundSport'],
    isChampionship: true,
    description: 'All SoundSport corps compete',
  },
];

/** The first and last Championship Week day. */
export const CHAMPIONSHIP_WEEK_DAYS: readonly number[] = [45, 46, 47, 48, 49];

export interface MajorEvent {
  day: 28 | 35 | 41 | 42;
  eventName: string;
  location: string;
  /** Every night of a multi-night event (the Eastern Classic). */
  nights: number[];
}

/** The branded majors, by the day each is played. */
export const MAJOR_EVENTS: Readonly<Record<number, MajorEvent>> = {
  28: {
    day: 28,
    eventName: 'marching.art Southwestern Championship',
    location: 'San Antonio, TX',
    nights: [28],
  },
  35: {
    day: 35,
    eventName: 'marching.art Southeastern Championship',
    location: 'Atlanta, GA',
    nights: [35],
  },
  41: {
    day: 41,
    eventName: 'marching.art Eastern Classic',
    location: 'Allentown, PA',
    nights: [41, 42],
  },
  42: {
    day: 42,
    eventName: 'marching.art Eastern Classic',
    location: 'Allentown, PA',
    nights: [41, 42],
  },
};

/** A major's name in any spelling a schedule row might carry. */
export const MAJOR_NAME_RE = /(southwestern|southeastern) championship|eastern classic/i;

/**
 * A Championship Week row's name in any spelling: the canonical names, the
 * archive titles the generator used to copy onto days 47–49 ("DCI Division I
 * World Championship Quarterfinals", "DCI World Class World Championship
 * Semi-Finals"), and the SoundSport festival.
 */
const CHAMPIONSHIP_NAME_RE =
  /world\s+championship|open\s+(and|&)\s+a\s+class|soundsport|\b(prelims|semi-?finals|quarter-?finals|finals)\b/i;

const SOUNDSPORT_RE = /soundsport/i;

/** The minimum a schedule row, recap show or registration needs to be named. */
export interface NameableShow {
  day?: number | string | null;
  eventName?: string | null;
  name?: string | null;
  isChampionship?: boolean | null;
  type?: string | null;
  eventTier?: string | null;
  allowedClasses?: string[] | null;
  eligibleClasses?: string[] | null;
}

function namesSoundSport(classes: string[] | null | undefined): boolean {
  return Array.isArray(classes) && classes.some((c) => SOUNDSPORT_RE.test(String(c)));
}

/**
 * The Championship Week event a schedule row stands for, or null when the row
 * is not a championship round. Matched by day; Finals night (two events)
 * splits on SoundSport, by the row's classes or its name.
 */
export function championshipEventFor(
  show: NameableShow | null | undefined
): ChampionshipEvent | null {
  if (!show) return null;
  const day = Number(show.day);
  const candidates = CHAMPIONSHIP_EVENTS.filter((e) => e.day === day);
  if (candidates.length === 0) return null;
  const raw = String(show.eventName ?? show.name ?? '');
  const flagged =
    show.isChampionship === true || show.type === 'championship' || CHAMPIONSHIP_NAME_RE.test(raw);
  if (!flagged) return null;
  if (candidates.length === 1) return candidates[0];
  const wantsSoundSport =
    namesSoundSport(show.allowedClasses) ||
    namesSoundSport(show.eligibleClasses) ||
    SOUNDSPORT_RE.test(raw);
  return candidates.find((e) => namesSoundSport(e.eligibleClasses) === wantsSoundSport) ?? null;
}

/**
 * The major a schedule row stands for, or null. A row is a major when it is
 * on a major's day and is either tiered `regional` or named like one.
 */
export function majorEventFor(show: NameableShow | null | undefined): MajorEvent | null {
  if (!show) return null;
  const major = MAJOR_EVENTS[Number(show.day)];
  if (!major) return null;
  const raw = String(show.eventName ?? show.name ?? '');
  return show.eventTier === 'regional' || MAJOR_NAME_RE.test(raw) ? major : null;
}

/**
 * The name a director sees for a show: the hard-coded name for a major or a
 * Championship Week round (whatever title the season's row happens to carry),
 * else the row's own name with the DCI brand swap applied.
 */
export function displayEventName(show: NameableShow | null | undefined): string {
  if (!show) return '';
  const championship = championshipEventFor(show);
  if (championship) return championship.eventName;
  const major = majorEventFor(show);
  if (major) return major.eventName;
  return formatEventName(show.eventName ?? show.name ?? '');
}
