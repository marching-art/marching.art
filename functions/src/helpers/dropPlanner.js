// @ts-nocheck -- date math is plain JS; typed callers pass validated inputs.
/**
 * Nightly score-drop planner.
 *
 * Given the season and the current time, decides — with NO network access —
 * which competition day is in its scrape/drop window tonight, and the two
 * instants that gate the pipeline:
 *
 *   scrapeInstant  when to hit dci.org ONCE (anchored to the westernmost show's
 *                  real "Scores Announced" time when known, so the recap is
 *                  near-certainly posted; otherwise a fixed lead before the drop)
 *   dropInstant    when fantasy scores publish (helpers/scoreDropTime.js:
 *                  furthest-west 11 PM local -> ET ladder, off-season 9 PM ET,
 *                  Indianapolis finals week -> midnight ET)
 *
 * Everything comes from schedules/{seasonId}.competitions[] (each show's
 * location -> timezone via the offline gazetteer, plus the enriched scoresAt),
 * so the gate ticks that AREN'T tonight's slot never touch dci.org — they read
 * one Firestore doc and return. That is what keeps the scrape to once per night
 * without burning scraper credits.
 */

const { fantasyDropInstant, eveningDropInstant, easternLabel, DEFAULT_ZONE } =
  require("./scoreDropTime");
const { timezoneFor } = require("./podium/venues");

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// The live drop window runs 11 PM ET (Eastern show) to 2 AM ET (Pacific show),
// plus the finals-week midnight drop. Shifting the clock back 3 hours maps that
// whole window onto the single calendar date the shows were held (D) — unlike
// the 2 AM game-day reset (gameDay.js), which would attribute a 2 AM Pacific
// drop to D+1 and score the wrong day.
const SHOW_DAY_RESET_HOURS = 3;

// Championship week (competition days 45-49) is held in Indianapolis (Eastern)
// and is NOT carried in competitions[] (mergeScheduleRefresh skips day > 44),
// so resolve its zone explicitly rather than falling back to Pacific.
const CHAMPIONSHIP_WEEK_START_DAY = 45;
const CHAMPIONSHIP_WEEK_ZONE = "America/Indiana/Indianapolis";

// Scrape timing relative to the real announced time / the drop.
const SCRAPE_BUFFER_AFTER_SCORES_MIN = 10; // scrape this long after scoresAt (recap surely up)
const SCRAPE_LEAD_BEFORE_DROP_MIN = 15;    // fallback: scrape this long before the drop

function pad(n) {
  return String(n).padStart(2, "0");
}

/** Eastern wall-clock parts of an instant. */
function easternParts(now) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
  const v = {};
  for (const p of dtf.formatToParts(now)) v[p.type] = p.value;
  return {
    year: +v.year, month: +v.month, day: +v.day,
    hour: v.hour === "24" ? 0 : +v.hour, minute: +v.minute, second: +v.second,
  };
}

/**
 * The "show date" (YYYY-MM-DD, Eastern) whose evening `now` belongs to, using
 * the 3-hour reset so the 11 PM–2 AM drop window resolves to one date.
 * @param {Date} now
 * @returns {{iso: string, utcMidnight: number}}
 */
function showDateFor(now) {
  const et = easternParts(now);
  const etAsUtc = Date.UTC(et.year, et.month - 1, et.day, et.hour, et.minute, et.second);
  const shifted = new Date(etAsUtc - SHOW_DAY_RESET_HOURS * 60 * 60 * 1000);
  const iso = `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
  const utcMidnight = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
  return { iso, utcMidnight };
}

/**
 * Resolve a show's IANA zone: accurate coordinate gazetteer first, the enriched
 * detail-page zone next, then Pacific (latest possible) so an unknown venue
 * never causes an early drop.
 * @param {{location?: string, timezone?: string}} show
 * @returns {string}
 */
function zoneForShow(show) {
  return timezoneFor(show && show.location) || (show && show.timezone) || DEFAULT_ZONE;
}

/**
 * Plan tonight's scrape + drop for the live/off-season pipeline.
 *
 * @param {object} params
 * @param {object} params.seasonData - game-settings/season doc data. Needs
 *   `status`, and for live season `schedule.startDate` + `schedule.springTrainingDays`.
 * @param {Array<object>} [params.competitions] - schedules/{seasonId}.competitions[].
 * @param {Date} [params.now]
 * @returns {null | {
 *   seasonType: string, competitionDay: number, showDateET: string,
 *   timeZones: string[], scoresAt: Date|null,
 *   scrapeInstant: Date|null, dropInstant: Date,
 *   dropLabel: string, needsScrape: boolean,
 * }} null when there is nothing to score tonight (before season, spring
 *   training, season over, or no season).
 */
function planDrop({ seasonData, competitions = [], now = new Date() }) {
  if (!seasonData || !seasonData.status) return null;
  const seasonType = seasonData.status; // "live-season" | "off-season"
  const isLive = seasonType === "live-season";

  const startRaw = seasonData?.schedule?.startDate;
  const startDate = startRaw && typeof startRaw.toDate === "function" ? startRaw.toDate() : startRaw;
  if (!(startDate instanceof Date) || isNaN(startDate.getTime())) return null;

  const { iso: showDateET, utcMidnight: showUtc } = showDateFor(now);
  const startUtc = Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate());
  const calendarDay = Math.floor((showUtc - startUtc) / MS_PER_DAY) + 1;

  const springTrainingDays = isLive ? (seasonData?.schedule?.springTrainingDays ?? 21) : 0;
  const competitionDay = calendarDay - springTrainingDays;

  // Nothing to score outside the 1-49 competition window.
  if (competitionDay < 1 || competitionDay > 49) return null;

  // Off-season: fixed 9 PM ET, synthetic scores, no dci.org scrape.
  if (!isLive) {
    const dropInstant = eveningDropInstant(showDateET);
    return {
      seasonType, competitionDay, showDateET,
      timeZones: [], scoresAt: null,
      scrapeInstant: null, dropInstant,
      dropLabel: easternLabel(dropInstant), needsScrape: false,
    };
  }

  // Live season: gather tonight's shows and their zones + real announced times.
  const todaysShows = competitions.filter((c) => c && c.day === competitionDay);
  let timeZones = todaysShows.map(zoneForShow);
  if (timeZones.length === 0) {
    // Championship week (45-49) is Indianapolis/Eastern but absent from
    // competitions[]; everything else with no shows defaults to Pacific.
    timeZones = competitionDay >= CHAMPIONSHIP_WEEK_START_DAY ? [CHAMPIONSHIP_WEEK_ZONE] : [];
  }

  let scoresAt = null;
  for (const show of todaysShows) {
    if (!show.scoresAt) continue;
    const t = new Date(show.scoresAt);
    if (!isNaN(t.getTime()) && (!scoresAt || t.getTime() > scoresAt.getTime())) scoresAt = t;
  }

  const dropInstant = fantasyDropInstant({
    etDate: showDateET, timeZones, seasonType, day: competitionDay,
  });

  // Scrape anchor: after the westernmost show's real announced time (recap surely
  // posted) when we know it; otherwise a fixed lead before the drop. Never later
  // than the drop unless the real announced time forces it (then the drop slips
  // to the scrape so scoring always has data).
  let scrapeInstant;
  if (scoresAt) {
    scrapeInstant = new Date(scoresAt.getTime() + SCRAPE_BUFFER_AFTER_SCORES_MIN * 60000);
  } else {
    scrapeInstant = new Date(dropInstant.getTime() - SCRAPE_LEAD_BEFORE_DROP_MIN * 60000);
  }
  const effectiveDrop =
    scrapeInstant.getTime() > dropInstant.getTime() ? scrapeInstant : dropInstant;

  return {
    seasonType, competitionDay, showDateET,
    timeZones, scoresAt,
    scrapeInstant, dropInstant: effectiveDrop,
    dropLabel: easternLabel(effectiveDrop), needsScrape: true,
  };
}

module.exports = {
  planDrop,
  showDateFor,
  zoneForShow,
  SHOW_DAY_RESET_HOURS,
  CHAMPIONSHIP_WEEK_START_DAY,
  CHAMPIONSHIP_WEEK_ZONE,
  SCRAPE_BUFFER_AFTER_SCORES_MIN,
  SCRAPE_LEAD_BEFORE_DROP_MIN,
};
