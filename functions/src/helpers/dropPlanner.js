/**
 * Nightly score-drop planner.
 *
 * Given the season and the current time, decides — with NO network access —
 * which competition day is in its scrape/drop window tonight, and the two
 * instants that gate the pipeline:
 *
 *   scrapeInstant  when to hit dci.org ONCE. Anchored to the westernmost
 *                  show's real "Scores Announced" time + buffer when known
 *                  (so the recap is near-certainly posted), but FLOORED at
 *                  drop − 15 min: an early-eastern announced time must never
 *                  pull the single scrape attempt earlier than the drop
 *                  requires, because a later scrape maximizes the chance
 *                  every recap is up (dci.org scraping is rationed).
 *   dropInstant    when fantasy scores publish (helpers/scoreDropTime.js:
 *                  furthest-west 11 PM local -> ET ladder, off-season 9 PM ET,
 *                  Indianapolis finals week -> midnight ET). If the scrape
 *                  anchor lands after the planned drop, the drop slips to the
 *                  scrape (scoring always follows data); the pre-slip value is
 *                  returned as plannedDropInstant for diagnostics.
 *
 * Both instants are clamped before the 3 AM ET show-day boundary so a late or
 * bogus scoresAt can never push tonight's pipeline into tomorrow's plan.
 * scoresAt is scraped, scheduled (not actual) data — values outside the
 * plausible evening window are ignored and surfaced in ignoredScoresAt.
 *
 * Everything comes from schedules/{seasonId}.competitions[] (each show's
 * location -> timezone via the offline gazetteer, plus the enriched scoresAt),
 * so the gate ticks that AREN'T tonight's slot never touch dci.org — they read
 * one Firestore doc and return. That is what keeps the scrape to once per
 * night without burning scraper credits. scrapeRetryUntil bounds failure-only
 * retries: a failed/zero-row attempt may re-arm on later ticks up to the
 * clamp, which costs nothing on a normal night.
 *
 * ONLY REAL DCI SHOWS DRIVE TIMING. Every instant above exists to wait on
 * scores being announced at an actual venue, so timezones and announced times
 * skip the day's player-hosted events (isVirtualShow) — those are virtual,
 * scored by marching.art itself with nothing to wait for, and a hosted show's
 * location must never move the drop. The all-virtual off-season is the same
 * rule taken to its limit: a flat 9 PM ET, no ladder at all. expectedShowCount
 * applies the stricter owesDciRecap, since a show only counts toward what the
 * night is owed if a dci.org recap will actually exist for it.
 */

const {
  fantasyDropInstant,
  eveningDropInstant,
  easternLabel,
  wallClockToUtc,
  tzOffsetMs,
  EASTERN_ZONE,
  DEFAULT_ZONE,
} = require("./scoreDropTime");
const { timezoneFor } = require("./podium/venues");

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_MIN = 60 * 1000;

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
const SCRAPE_LEAD_BEFORE_DROP_MIN = 15;    // floor/fallback: this long before the drop

// scoresAt sanity window: a show's announced time must land between this ET
// hour on the show date and the late clamp below, or it is ignored (bad parse,
// wrong date/year). Real announcements run ~9:30 PM–2 AM ET.
const EARLIEST_SCORES_HOUR_ET = 18;
// Hard stop for scrape + drop: this long before the 3 AM ET show-day boundary,
// so a slipped drop can never cross into the next plan's date.
const LATE_CLAMP_LEAD_MIN = 15;

// The legacy pipeline's scoring hour (the 2 AM ET run the drop dispatcher
// replaced). Still the reference point for "how long is it reasonable to wait
// on DCI?": the dispatcher holds a half-posted night open until this instant,
// takes one more scrape, and then scores with whatever arrived.
const LEGACY_SCORING_HOUR_ET = 2;

function pad(n) {
  return String(n).padStart(2, "0");
}

/**
 * The "show date" (YYYY-MM-DD, Eastern) whose evening `now` belongs to, using
 * the 3-hour reset so the 11 PM–2 AM drop window resolves to one date.
 * (Derived from tzOffsetMs rather than a fourth copy of the formatToParts
 * wall-clock dance — see gameDay.js's header for why that matters.)
 * @param {Date} now
 * @returns {{iso: string, utcMidnight: number}}
 */
function showDateFor(now) {
  const etWallAsUtc = now.getTime() + tzOffsetMs(EASTERN_ZONE, now.getTime());
  const shifted = new Date(etWallAsUtc - SHOW_DAY_RESET_HOURS * 60 * 60 * 1000);
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
 * True for a player-hosted event (callable/podiumHost.js -> addShowToDay):
 * virtual, scored by marching.art itself, never held at a real venue and never
 * listed on dci.org. Nothing about it should move the night's timing.
 *
 * Positive markers only. An unmarked show is treated as real, which at worst
 * makes a night wait LONGER — the safe direction. Inferring "virtual" from a
 * missing field could drop a Pacific night's scores at 11 PM.
 *
 * @param {object} show - A competitions[] entry.
 * @returns {boolean}
 */
function isVirtualShow(show) {
  return Boolean(show && (show.hostUid || show.eventTier === "hosted"));
}

/**
 * True when a scheduled show will eventually appear in a dci.org recap, and so
 * counts toward what tonight owes before its scores are fully real.
 *
 * Stricter than `!isVirtualShow`: it also requires the `date` every scraped
 * event carries (helpers/scheduleGeneration.js and scheduleRefresh.js both
 * skip dateless events outright), which catches hosted shows created before
 * addShowToDay persisted its markers — those store `date: null`. Here the
 * heuristic errs toward NOT counting a show, which only ever gives up waiting
 * sooner. That is the safe direction for a count, and the opposite of the safe
 * direction for timing — hence the two predicates.
 *
 * @param {object} show - A competitions[] entry.
 * @returns {boolean}
 */
function owesDciRecap(show) {
  return Boolean(show && !isVirtualShow(show) && show.date);
}

/**
 * The 1-based calendar day of tonight's show date, counted from the season
 * start. THE day selector for everything the drop pipeline scores — the
 * dispatcher, the 9 PM Podium job, and the admin manual triggers when the
 * pipeline owns scoring. Never derive this via gameDay.js's 2 AM reset,
 * which is one day behind at every pre-2AM drop time.
 * @param {Date} seasonStartDate - Season start (UTC midnight).
 * @param {Date} [now]
 * @returns {number}
 */
function showCalendarDay(seasonStartDate, now = new Date()) {
  const { utcMidnight } = showDateFor(now);
  const startUtc = Date.UTC(
    seasonStartDate.getUTCFullYear(),
    seasonStartDate.getUTCMonth(),
    seasonStartDate.getUTCDate(),
  );
  return Math.floor((utcMidnight - startUtc) / MS_PER_DAY) + 1;
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
 *   timeZones: string[], scoresAt: Date|null, ignoredScoresAt: Array<object>,
 *   tzMismatches: Array<object>, hasScheduledShows: boolean|null,
 *   expectedShowCount: number,
 *   scrapeInstant: Date|null, scrapeRetryUntil: Date|null,
 *   legacyScoringInstant: Date|null,
 *   dropInstant: Date, plannedDropInstant: Date,
 *   dropLabel: string, needsScrape: boolean,
 * }} null when there is nothing to score tonight (before season, spring
 *   training, season over, or no/unknown season).
 */
function planDrop({ seasonData, competitions = [], now = new Date() }) {
  const seasonType = seasonData && seasonData.status;
  // Fail closed on anything that isn't an explicitly scoreable status —
  // "finished", a typo, etc. must never flow into a scoring path.
  if (seasonType !== "live-season" && seasonType !== "off-season") return null;
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
      timeZones: [], scoresAt: null, ignoredScoresAt: [], tzMismatches: [],
      hasScheduledShows: null, expectedShowCount: 0,
      scrapeInstant: null, scrapeRetryUntil: null, legacyScoringInstant: null,
      dropInstant, plannedDropInstant: dropInstant,
      dropLabel: easternLabel(dropInstant), needsScrape: false,
    };
  }

  const [year, month, date] = showDateET.split("-").map((n) => parseInt(n, 10));
  // Hard boundaries for tonight: nothing may cross the 3 AM ET show-day reset.
  const dayBoundary = wallClockToUtc(year, month, date + 1, SHOW_DAY_RESET_HOURS, 0, EASTERN_ZONE);
  const lateClamp = new Date(dayBoundary.getTime() - LATE_CLAMP_LEAD_MIN * MS_PER_MIN);
  const earliestPlausibleScores = wallClockToUtc(year, month, date, EARLIEST_SCORES_HOUR_ET, 0, EASTERN_ZONE);
  // The legacy 2 AM ET scoring run, the morning after the shows.
  const legacyScoringInstant =
    wallClockToUtc(year, month, date + 1, LEGACY_SCORING_HOUR_ET, 0, EASTERN_ZONE);

  // Live season: gather tonight's REAL shows and their zones + announced times.
  //
  // Only actual DCI shows drive timing. The whole drop ladder exists to wait
  // for real scores to be announced at a real venue in a real timezone;
  // player-hosted events are virtual, scored by marching.art itself with
  // nothing to wait for (which is exactly why the all-virtual off-season drops
  // at a flat 9 PM ET above). A hosted show in Denver must never push an
  // Eastern night's drop from 11 PM to 1 AM.
  const todaysShows = competitions.filter((c) => c && c.day === competitionDay);
  const realShows = todaysShows.filter((s) => !isVirtualShow(s));
  const dciShows = todaysShows.filter(owesDciRecap);
  const hasScheduledShows = realShows.length > 0;
  let timeZones = realShows.map(zoneForShow);
  if (timeZones.length === 0) {
    // Championship week (45-49) is Indianapolis/Eastern but absent from
    // competitions[]; everything else with no real shows defaults to Pacific —
    // the conservative bound, since an empty day is indistinguishable from a
    // stale schedules doc that is missing tonight's shows.
    // hasScheduledShows lets the caller tell "expected empty" (day >= 45)
    // from a stale schedule doc burning the latest slot every night.
    timeZones = competitionDay >= CHAMPIONSHIP_WEEK_START_DAY ? [CHAMPIONSHIP_WEEK_ZONE] : [];
  }

  // Surface gazetteer-vs-enrichment zone disagreements (compared by actual UTC
  // offset tonight, so America/Detroit vs America/New_York never false-flags).
  // A real mismatch means a geocode issue or a bad detail-page parse.
  const tzMismatches = [];
  for (const show of realShows) {
    const geo = timezoneFor(show.location);
    if (!geo || !show.timezone || geo === show.timezone) continue;
    const ref = earliestPlausibleScores.getTime();
    if (tzOffsetMs(geo, ref) !== tzOffsetMs(show.timezone, ref)) {
      tzMismatches.push({ location: show.location || null, gazetteer: geo, enriched: show.timezone });
    }
  }

  // Latest VALID announced time across tonight's real shows. scoresAt is
  // scraped scheduled data — a wrong-date/wrong-year value would delay the drop
  // unboundedly, so anything outside tonight's plausible window is ignored.
  let scoresAt = null;
  const ignoredScoresAt = [];
  for (const show of realShows) {
    if (!show.scoresAt) continue;
    const t = new Date(show.scoresAt);
    if (isNaN(t.getTime()) ||
        t.getTime() < earliestPlausibleScores.getTime() ||
        t.getTime() > lateClamp.getTime()) {
      ignoredScoresAt.push({ location: show.location || null, scoresAt: show.scoresAt });
      continue;
    }
    if (!scoresAt || t.getTime() > scoresAt.getTime()) scoresAt = t;
  }

  const plannedDropInstant = fantasyDropInstant({
    etDate: showDateET, timeZones, seasonType, day: competitionDay,
  });

  // Scrape anchor: announced time + buffer when known, FLOORED at drop − 15 min
  // (an early-eastern scoresAt with an unknown western show must not spend the
  // night's one attempt before the western recap can exist), and CLAMPED before
  // the show-day boundary.
  const scrapeFloor = plannedDropInstant.getTime() - SCRAPE_LEAD_BEFORE_DROP_MIN * MS_PER_MIN;
  const scrapeAnchor = scoresAt
    ? scoresAt.getTime() + SCRAPE_BUFFER_AFTER_SCORES_MIN * MS_PER_MIN
    : scrapeFloor;
  const scrapeInstant = new Date(Math.min(Math.max(scrapeAnchor, scrapeFloor), lateClamp.getTime()));

  // Scoring always follows data: if the scrape anchor lands after the planned
  // drop, the drop slips to the scrape. Both are already clamped tonight.
  const dropInstant = new Date(Math.max(plannedDropInstant.getTime(), scrapeInstant.getTime()));

  return {
    seasonType, competitionDay, showDateET,
    timeZones, scoresAt, ignoredScoresAt, tzMismatches, hasScheduledShows,
    // How many DCI recaps tonight owes. competitions[] is built from dci.org's
    // own event list (helpers/scheduleRefresh.js mergeScheduleRefresh), so the
    // scraped entries are directly comparable to the events the scrape finds
    // listed for tonight — that comparison is what tells the dispatcher the
    // recaps are still trickling in.
    expectedShowCount: dciShows.length,
    scrapeInstant, scrapeRetryUntil: lateClamp, legacyScoringInstant,
    dropInstant, plannedDropInstant,
    dropLabel: easternLabel(dropInstant), needsScrape: true,
  };
}

module.exports = {
  planDrop,
  showDateFor,
  showCalendarDay,
  zoneForShow,
  isVirtualShow,
  owesDciRecap,
  SHOW_DAY_RESET_HOURS,
  LEGACY_SCORING_HOUR_ET,
  CHAMPIONSHIP_WEEK_START_DAY,
  CHAMPIONSHIP_WEEK_ZONE,
  SCRAPE_BUFFER_AFTER_SCORES_MIN,
  SCRAPE_LEAD_BEFORE_DROP_MIN,
  EARLIEST_SCORES_HOUR_ET,
  LATE_CLAMP_LEAD_MIN,
};
