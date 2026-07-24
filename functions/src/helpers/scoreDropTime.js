// @ts-nocheck -- date math is plain JS; typed callers pass validated inputs.
/**
 * Single source of truth for WHEN a competition day's scores drop.
 *
 * The rule mirrors how real Drum Corps International scores become known:
 *
 *   Live season — a day's scores are only final once the furthest-WEST show of
 *   that day has finished and DCI posts, which happens ~11 PM local. Converting
 *   11 PM local of the westernmost show to Eastern gives the familiar ladder:
 *     Pacific  -> 2:00 AM ET   Mountain -> 1:00 AM ET
 *     Central  -> 12:00 AM ET  Eastern  -> 11:00 PM ET
 *   Because we compute "11 PM wall-clock in the show's own IANA zone" and take
 *   the LATEST resulting UTC instant, Arizona (no DST) and every split-zone
 *   state fall out correctly with no bucketing.
 *
 *   World Championship week in Indianapolis (competition days 47-49, Eastern)
 *   always publishes after 11 PM, so those days drop at MIDNIGHT ET instead of
 *   11 PM — one hour past the plain Eastern time.
 *
 *   Off-season — synthetic scores with no real show to gate them, so a fixed
 *   9:00 PM ET drop.
 *
 *   Podium Class — 9:00 PM ET year-round, independent of the fantasy ladder.
 *
 * Everything is computed as wall-clock time in the relevant IANA zone, so it
 * tracks daylight saving automatically (EDT during the DCI season, EST/PST
 * otherwise) without any hardcoded offsets. No runtime dependency beyond Intl.
 */

const EASTERN_ZONE = "America/New_York";
// 11 PM local is when a show's scores post; the westernmost show of the day
// gates the whole day. See module header.
const LOCAL_DROP_HOUR = 23;
// Fixed evening drop for off-season fantasy and for Podium Class (both ET).
const EVENING_DROP_HOUR = 21;
// World Championship week (Indianapolis, Eastern) publishes late -> midnight ET.
const FINALS_WEEK_DAYS = new Set([47, 48, 49]);
// When a day's show locations can't be resolved to a zone, assume the latest
// possible (Pacific) so scores never drop early on incomplete data.
const DEFAULT_ZONE = "America/Los_Angeles";

/**
 * Milliseconds that `timeZone`'s wall clock is ahead of UTC at a given instant.
 * Positive east of UTC, negative west. DST-correct because it asks Intl for the
 * zone's actual offset at that instant.
 * @param {string} timeZone - IANA zone id.
 * @param {number} atUtcMs - The instant, in epoch ms.
 * @returns {number}
 */
function tzOffsetMs(timeZone, atUtcMs) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = {};
  for (const part of dtf.formatToParts(atUtcMs)) parts[part.type] = part.value;
  const asUtc = Date.UTC(
    parseInt(parts.year),
    parseInt(parts.month) - 1,
    parseInt(parts.day),
    // Some ICU versions report midnight as hour "24" in h23 mode.
    parseInt(parts.hour === "24" ? "0" : parts.hour),
    parseInt(parts.minute),
    parseInt(parts.second),
  );
  return asUtc - atUtcMs;
}

/**
 * The UTC instant of a wall-clock time in a given zone. Standard offset
 * inversion with one correction pass so it stays correct across a DST boundary
 * (the offset at the naive guess can differ from the offset at the answer).
 * @param {number} year
 * @param {number} month - 1-12.
 * @param {number} day - 1-31 (Date.UTC normalizes overflow, so hour 24 / day+1
 *   both work).
 * @param {number} hour - 0-24.
 * @param {number} minute
 * @param {string} timeZone - IANA zone id.
 * @returns {Date}
 */
function wallClockToUtc(year, month, day, hour, minute, timeZone) {
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const firstOffset = tzOffsetMs(timeZone, guess);
  let utc = guess - firstOffset;
  const secondOffset = tzOffsetMs(timeZone, utc);
  if (secondOffset !== firstOffset) utc = guess - secondOffset;
  return new Date(utc);
}

/**
 * Parse an Eastern calendar date ("YYYY-MM-DD") into numeric parts. This is the
 * show date — the date the day's competitions are held, in Eastern time.
 * @param {string} etDate
 * @returns {{year: number, month: number, day: number}}
 */
function parseEtDate(etDate) {
  const [year, month, day] = String(etDate).split("-").map((n) => parseInt(n, 10));
  if (!year || !month || !day) {
    throw new Error(`scoreDropTime: invalid ET date "${etDate}" (expected YYYY-MM-DD).`);
  }
  return { year, month, day };
}

/**
 * The 9:00 PM ET evening drop instant for a given Eastern show date. Used by
 * off-season fantasy scoring and by Podium Class (year-round).
 * @param {string} etDate - Show date, Eastern, "YYYY-MM-DD".
 * @returns {Date}
 */
function eveningDropInstant(etDate) {
  const { year, month, day } = parseEtDate(etDate);
  return wallClockToUtc(year, month, day, EVENING_DROP_HOUR, 0, EASTERN_ZONE);
}

/**
 * The Podium Class drop instant: 9:00 PM ET, every day of the year.
 * @param {string} etDate - Show date, Eastern, "YYYY-MM-DD".
 * @returns {Date}
 */
function podiumDropInstant(etDate) {
  return eveningDropInstant(etDate);
}

/**
 * The fantasy score drop instant for a competition day.
 *
 * @param {Object} params
 * @param {string} params.etDate - The day's show date in Eastern, "YYYY-MM-DD".
 * @param {string[]} [params.timeZones] - IANA zones of the day's shows. Empty
 *   or unresolved entries fall back to Pacific (latest possible).
 * @param {"live-season"|"off-season"} params.seasonType
 * @param {number} [params.day] - 1-based competition day (for the finals-week
 *   midnight override; only meaningful in live season).
 * @returns {Date} The UTC instant at which the day's scores should drop.
 */
function fantasyDropInstant({ etDate, timeZones = [], seasonType, day }) {
  // Fail loudly on a typo'd status — silently treating it as live season would
  // route a bad season doc into the show-gated scrape path.
  if (seasonType !== "off-season" && seasonType !== "live-season") {
    throw new Error(`scoreDropTime: unknown seasonType "${seasonType}".`);
  }
  const { year, month, day: date } = parseEtDate(etDate);

  // Off-season: fixed 9 PM ET, no show gating.
  if (seasonType === "off-season") {
    return wallClockToUtc(year, month, date, EVENING_DROP_HOUR, 0, EASTERN_ZONE);
  }

  // Live-season World Championship week in Indianapolis publishes late.
  if (FINALS_WEEK_DAYS.has(day)) {
    // Midnight ET the night the finals run = 00:00 ET on the day AFTER the
    // Eastern show date (Date.UTC normalizes date+1 for month/year rollover).
    return wallClockToUtc(year, month, date + 1, 0, 0, EASTERN_ZONE);
  }

  // Live-season default: 11 PM local of the FURTHEST-WEST show that day. With
  // no resolvable zone, assume Pacific so we never drop before a possible
  // late-posting western show.
  const zones = timeZones.filter(Boolean);
  const effectiveZones = zones.length > 0 ? zones : [DEFAULT_ZONE];
  let latest = null;
  for (const zone of effectiveZones) {
    const instant = wallClockToUtc(year, month, date, LOCAL_DROP_HOUR, 0, zone);
    if (!latest || instant.getTime() > latest.getTime()) latest = instant;
  }
  return latest;
}

/**
 * The Eastern wall-clock label (e.g. "2026-08-08 23:00 ET") for a drop instant.
 * Diagnostics / logging only.
 * @param {Date} instant
 * @returns {string}
 */
function easternLabel(instant) {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: EASTERN_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = {};
  for (const part of dtf.formatToParts(instant)) parts[part.type] = part.value;
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day} ${hour}:${parts.minute} ET`;
}

module.exports = {
  fantasyDropInstant,
  podiumDropInstant,
  eveningDropInstant,
  easternLabel,
  wallClockToUtc,
  tzOffsetMs,
  FINALS_WEEK_DAYS,
  LOCAL_DROP_HOUR,
  EVENING_DROP_HOUR,
  EASTERN_ZONE,
  DEFAULT_ZONE,
};
