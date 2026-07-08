/**
 * Off-season schedule heritage enrichment (Step 3).
 *
 * The off-season schedule is a set of stages: each regular show is a real
 * historical DCI event, each championship day is a marching.art event. This
 * module gives every stage a running order + performance clock in the SAME shape
 * the live season uses (startsAt/scoresAt/gatesAt/timezone/venue/lineup), so the
 * existing RunningOrder / NextPerformance / SchedulePanel UI lights up off-season
 * with no client changes.
 *
 *   - Regular shows pull their running order from historical_schedules (real
 *     scraped order for 2019+, learned for older years — Step 2 built both), then
 *     REBASE the times onto the off-season calendar date.
 *   - Championship days (45-49) have no historical source, so their running order
 *     is synthesized from the season's 25-corps pool ordered by each pool corps'
 *     score at that day (the shared "stage", per the agreed design).
 *
 * The historical corps are the STAGE cast, not the competitors — the directors'
 * corps are ranked separately in the recap. The Step 4 highlight will connect a
 * director's pick to a corps in this order when the brand is present.
 */

const { logger } = require("firebase-functions/v2");
const { deriveRunningOrder } = require("./scheduleModel");
const { resolveTimezone, zonedWallTimeToUtc } = require("./eventDetails");
const { fetchHistoricalData, getCachedRegressionScore } = require("./scoringMath");

const DAY_MS = 24 * 60 * 60 * 1000;
const CAPTIONS = ["GE1", "GE2", "VP", "VA", "CG", "B", "MA", "P"];
const MIN_CHAMPIONSHIP_FIELD = 4;

/** UTC-midnight epoch ms for a date's calendar day (timezone-agnostic day key). */
function midnightUtc(date) {
  const d = date instanceof Date ? date : new Date(date);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Invert brandEventName (marching.art -> DCI) to match heritage records. */
function unbrand(name) {
  return String(name || "").replace(/marching\.art/g, "DCI");
}

function normLoc(loc) {
  return String(loc || "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** The off-season calendar date for a competition day (day 1 = season start). */
function offSeasonDateFor(startDate, offSeasonDay) {
  return new Date(startDate.getTime() + (offSeasonDay - 1) * DAY_MS);
}

/**
 * Shift an absolute instant by a whole number of days. Off-season and DCI seasons
 * both run in summer (US DST), so a whole-day shift preserves the local wall-clock
 * exactly — a 6:40 PM performer stays 6:40 PM on the off-season date.
 */
function rebaseIso(iso, dayDeltaMs) {
  if (!iso) return null;
  const t = Date.parse(iso);
  return isNaN(t) ? null : new Date(t + dayDeltaMs).toISOString();
}

/**
 * Pick the best heritage record for a show from its year's candidates: prefer an
 * exact (unbranded) name match, then a location match, with scraped outranking
 * learned as the tiebreak. Falls back to a sole same-day candidate.
 * @param {Array<Object>} entries - historical_schedules entries for the year.
 * @param {Object} show
 * @returns {Object|null}
 */
function pickHeritage(entries, show) {
  const day = midnightUtc(show.date);
  const sameDay = (entries || []).filter((e) => midnightUtc(e.date) === day);
  if (sameDay.length === 0) return null;
  const name = unbrand(show.eventName);
  const loc = normLoc(show.location);
  const rank = (e) =>
    (e.eventName === name ? 4 : 0) +
    (loc && normLoc(e.location) === loc ? 2 : 0) +
    (e.source === "scraped" || !e.source ? 1 : 0);
  sameDay.sort((a, b) => rank(b) - rank(a));
  const best = sameDay[0];
  // Require a real signal — an exact (unbranded) name match or a location match.
  // Every archived event has a heritage record under its own name (Step 2), so a
  // lone unrelated same-day event must NOT be borrowed.
  return rank(best) >= 2 ? best : null;
}

/**
 * Enrich a regular show in place from its heritage record, rebased to the
 * off-season date. Returns true if it was enriched.
 * @param {Object} show
 * @param {Array<Object>} yearEntries - historical_schedules entries for show's year.
 * @param {Date} offSeasonDate
 */
function enrichRegularShow(show, yearEntries, offSeasonDate) {
  if (!show || !show.date) return false;
  const histDate = new Date(show.date);
  if (isNaN(histDate.getTime())) return false;

  const entry = pickHeritage(yearEntries, show);
  if (!entry || !Array.isArray(entry.lineup) || entry.lineup.length === 0) return false;

  const dayDeltaMs = midnightUtc(offSeasonDate) - midnightUtc(entry.date);
  show.timezone = entry.timezone || null;
  show.venue = entry.venue || null;
  show.gatesAt = rebaseIso(entry.gatesAt, dayDeltaMs);
  show.startsAt = rebaseIso(entry.startsAt, dayDeltaMs);
  show.scoresAt = rebaseIso(entry.scoresAt, dayDeltaMs);
  show.lineup = entry.lineup.map((e) => ({
    order: e.order,
    corps: e.corps,
    hometown: e.hometown ?? null,
    performanceTime: e.performanceTime,
    performsAt: rebaseIso(e.performsAt, dayDeltaMs),
  }));
  show.heritageSource = entry.source || "scraped";
  return true;
}

/**
 * Synthesize a championship running order in place from the season pool. The
 * field is the pool corps ordered by their score at this day; times land on the
 * off-season date in the venue's timezone. SoundSport-only stages are skipped.
 *
 * @param {Object} show
 * @param {Array<{corpsName:string, sourceYear:(string|number)}>} pool
 * @param {number} offSeasonDay
 * @param {Date} offSeasonDate
 * @param {Object} opts
 * @param {(corpsName:string, sourceYear:any, day:number)=>number} opts.corpsTotalAtDay
 * @returns {boolean}
 */
function buildChampionshipLineup(show, pool, offSeasonDay, offSeasonDate, opts) {
  const classes = show.eligibleClasses || [];
  if (classes.length > 0 && classes.every((c) => c === "soundSport")) return false;

  const field = (pool || [])
    .map((c) => ({ corps: c.corpsName, score: opts.corpsTotalAtDay(c.corpsName, c.sourceYear, offSeasonDay) }))
    .filter((f) => f.corps && Number.isFinite(f.score) && f.score > 0);
  if (field.length < MIN_CHAMPIONSHIP_FIELD) return false;

  const tz = resolveTimezone(show.location, null);
  const ro = deriveRunningOrder(field);
  const y = offSeasonDate.getUTCFullYear();
  const mo = offSeasonDate.getUTCMonth();
  const d = offSeasonDate.getUTCDate();
  const toIso = (mins) => {
    const dayOff = Math.floor(mins / 1440);
    const m = ((mins % 1440) + 1440) % 1440;
    return zonedWallTimeToUtc(y, mo, d + dayOff, Math.floor(m / 60), m % 60, tz).toISOString();
  };

  show.timezone = tz;
  show.gatesAt = toIso(ro.gatesLocalMinutes);
  show.startsAt = toIso(ro.startLocalMinutes);
  show.scoresAt = toIso(ro.scoresLocalMinutes);
  show.lineup = ro.lineup.map((e) => ({
    order: e.order,
    corps: e.corps,
    hometown: null,
    performanceTime: e.performanceTime,
    performsAt: toIso(e.performsAtLocalMinutes),
  }));
  show.heritageSource = "learned-championship";
  return true;
}

/**
 * Enrich a generated off-season schedule in place: regular shows from
 * historical_schedules (rebased), championship days from the pool. Loads only
 * the year docs referenced by the schedule. Never throws — a show that can't be
 * enriched keeps its base fields (RunningOrder renders nothing for it).
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {Array<{offSeasonDay:number, shows:Array}>} schedule
 * @param {Object} params
 * @param {Date} params.startDate - Off-season calendar day 1.
 * @param {Array} params.pool - dci-data corpsValues ({corpsName, sourceYear}).
 * @param {string} params.dataDocId - Season id (for regression historical data).
 * @returns {Promise<{regular:number, championship:number, unmatched:number}>}
 */
async function enrichOffSeasonSchedule(db, schedule, { startDate, pool, dataDocId }) {
  const counts = { regular: 0, championship: 0, unmatched: 0 };

  // Load historical_schedules only for the years the regular shows reference.
  const years = new Set();
  let hasChampionship = false;
  for (const day of schedule) {
    for (const show of day.shows || []) {
      if (show.isChampionship) hasChampionship = true;
      else if (show.date) {
        const y = new Date(show.date).getUTCFullYear();
        if (!isNaN(y)) years.add(y);
      }
    }
  }

  const heritageByYear = new Map();
  await Promise.all([...years].map(async (y) => {
    const doc = await db.doc(`historical_schedules/${y}`).get();
    if (doc.exists) heritageByYear.set(y, doc.data().data || []);
  }));

  // Championship ordering uses each pool corps' expected total at the day, via
  // the same regression the scorer uses.
  let corpsTotalAtDay = () => 0;
  if (hasChampionship) {
    const historicalData = await fetchHistoricalData(dataDocId);
    corpsTotalAtDay = (corpsName, sourceYear, day) => {
      let ge = 0, vis = 0, mus = 0;
      for (const cap of CAPTIONS) {
        const s = Math.min(20, getCachedRegressionScore(corpsName, String(sourceYear), cap, day, historicalData) || 0);
        if (cap === "GE1" || cap === "GE2") ge += s;
        else if (cap === "VP" || cap === "VA" || cap === "CG") vis += s;
        else mus += s;
      }
      return Math.min(100, ge + vis / 2 + mus / 2);
    };
  }

  for (const day of schedule) {
    const offSeasonDate = offSeasonDateFor(startDate, day.offSeasonDay);
    for (const show of day.shows || []) {
      let ok;
      if (show.isChampionship) {
        ok = buildChampionshipLineup(show, pool, day.offSeasonDay, offSeasonDate, { corpsTotalAtDay });
        if (ok) counts.championship += 1;
      } else {
        ok = enrichRegularShow(show, heritageByYear.get(new Date(show.date).getUTCFullYear()) || [], offSeasonDate);
        if (ok) counts.regular += 1;
        else counts.unmatched += 1;
      }
      // Align the show's date with its rebased running order (display-only;
      // scoring matches shows by name, not date).
      if (ok) show.date = offSeasonDate.toISOString();
    }
  }

  logger.info(
    `[OffSeasonHeritage] Enriched ${counts.regular} regular + ${counts.championship} championship ` +
    `shows; ${counts.unmatched} regular unmatched.`
  );
  return counts;
}

/**
 * Feature flag (kill switch) for heritage schedule enrichment. Reads
 * game-settings/config.heritageSchedulesEnabled; defaults to enabled when the
 * doc/field is absent. Set it to false to revert new off-seasons to the
 * names-only schedule if enrichment ever misbehaves in production.
 * @param {FirebaseFirestore.Firestore} db
 * @returns {Promise<boolean>}
 */
async function isHeritageSchedulesEnabled(db) {
  try {
    const doc = await db.doc("game-settings/config").get();
    return doc.exists ? doc.data().heritageSchedulesEnabled !== false : true;
  } catch {
    return true;
  }
}

module.exports = {
  enrichOffSeasonSchedule,
  enrichRegularShow,
  buildChampionshipLineup,
  pickHeritage,
  unbrand,
  offSeasonDateFor,
  rebaseIso,
  midnightUtc,
  isHeritageSchedulesEnabled,
};
