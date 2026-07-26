// Show registration constants: per-class display config and Podium tour-pick
// rules. Kept in a non-component module so fast refresh stays happy for the
// components that consume them.

export const CLASS_CONFIG = {
  worldClass: {
    name: 'World Class',
    shortName: 'World',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
  },
  openClass: {
    name: 'Open Class',
    shortName: 'Open',
    color: 'text-purple-400',
    bgColor: 'bg-purple-400/10',
  },
  aClass: {
    name: 'A Class',
    shortName: 'A Class',
    color: 'text-interactive',
    bgColor: 'bg-interactive/10',
  },
  soundSport: {
    name: 'SoundSport',
    shortName: 'SS',
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
  },
  podiumClass: {
    name: 'Podium Class',
    shortName: 'Podium',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-400/10',
  },
};

// Podium tour rules (mirror of functions store.js; server re-validates):
// majors + championship week are auto-attended, the Eastern Classic spans two
// nights, and self-picked shows are capped per week.
export const PODIUM_EASTERN_DAYS = [41, 42];
// Championship Week (days 45-49) is auto-attended for every Podium corps and
// never self-selectable — a corps' own division bracket is a subset of these
// (A/Open days 45-46, World days 47-49), but the whole window is off-limits to
// picks regardless of division (mirror of store.CHAMPIONSHIP_WEEK_DAYS).
export const PODIUM_CHAMPIONSHIP_WEEK_DAYS = [45, 46, 47, 48, 49];
// Week 7 opens its two non-championship days (43-44) to picks; days 45-49 are
// auto-attended Championship Week. Weeks 4-6 spend one slot on a major.
/** @param {number} week */
export const podiumMaxPicksForWeek = (week) => (week === 7 ? 2 : week >= 4 ? 3 : 4);

// Why the Podium pick budget is under the fantasy 4: weeks 4-6 auto-attend
// the week's major; week 7 auto-attends Championship Week (days 45-49).
// Surfaced wherever the sub-4 cap shows, so "3/3" under a "Max 4 shows per
// corps" header reads as design, not a bug.
/** Short row-subtitle note (or null for weeks with the full budget). @param {number} week */
export const podiumAutoSlotNoteForWeek = (week) =>
  week === 7 ? 'Championship Week auto-attended' : week >= 4 ? 'major auto-attended' : null;

/** Full-sentence version for the at-max error toast (or empty). @param {number} week */
export const podiumAutoSlotSentenceForWeek = (week) =>
  week === 7
    ? ' Days 45-49 are the auto-attended Championship Week.'
    : week >= 4
      ? " The week's major is auto-attended and fills the fourth slot."
      : '';

// Fantasy corps attend one show per day (server: resolveShowsAgainstSchedule
// in callable/lineups.js). Surface the conflict at selection time instead of
// letting the save round-trip fail.
/**
 * The DIFFERENT show a corps already has registered on `day`, or undefined.
 * @param {Array<{day?: number, eventName: string}>} corpsShows - The corps' stored week selections.
 * @param {number} day - The open show's competition day.
 * @param {string} eventName - The open show's event name (excluded from the match).
 */
export const sameDayShowFor = (corpsShows, day, eventName) =>
  Number.isInteger(day)
    ? corpsShows.find((s) => s.day === day && s.eventName !== eventName)
    : undefined;
