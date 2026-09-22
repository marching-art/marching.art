// Schedule weather producer.
//
// Denormalizes real show-time weather onto each competition in the active
// season's schedule doc (schedules/{seasonUid}.competitions[]), so the schedule
// show cards can render it straight from the data the client already loads — no
// per-card, per-user weather calls, and therefore no risk to Open-Meteo's daily
// limits. This scheduled job is the ONLY thing that calls the weather API for the
// schedule: it runs twice a day (early morning and early evening Eastern), and
// every lookup is Firestore-cached, so a full season of shows costs at most a few
// dozen calls a day (historical dates are cached permanently; only the upcoming
// ~two weeks refresh). The evening pass exists so a card seen on competition day
// reflects a forecast captured a couple hours before the ~8 p.m. shows, not just
// that morning's outlook.
//
// Show time is a constant 8 p.m. local (SHOWTIME_HOUR) — drum corps shows are
// evening events, and that beats a daily high/low for "what it felt like at the
// show". Everything is best-effort: a lookup that fails or returns nothing simply
// leaves that competition's existing weather untouched.
//
// WHICH date: the night the show is played in THIS season — the season calendar
// (start + spring training + day − 1, gameDay.competitionDayToIsoDate), never the
// row's own `date`. An off-season row's `date` is the archive night it replays
// (kept so heritage running orders can be matched, and years old), and the
// generated championship rounds carry no date at all; both used to be dated
// wrong here — the off-season cards showed a past summer's weather in January,
// and a live season's Championship Week was dated three weeks early, before
// spring training. Every competition — regular, major, championship — is now
// dated the same way, so the Open & A Class Prelims card carries Marion's
// forecast for the actual night, whatever month the season runs in.

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
const { getShowtimeWeather, SHOWTIME_HOUR, FORECAST_HORIZON_DAYS } = require("../helpers/weather");
const { cleanLocation } = require("../helpers/newsArticleShared");
const { championshipVenueFor } = require("../helpers/championshipVenues");
const { competitionDayToIsoDate } = require("../helpers/gameDay");

const DAY_MS = 86400000;

/** A Firestore Timestamp, a Date, an ISO string, or epoch ms → Date, or null. */
function coerceDate(value) {
  if (!value) return null;
  const d = typeof value.toDate === "function" ? value.toDate() : value instanceof Date ? value : new Date(value);
  return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
}

/**
 * The calendar day a competition is played on in the active season, as a
 * `YYYY-MM-DD` string: the season calendar for its day number (spring-training
 * aware), so an off-season replay is dated in the season being played rather
 * than the archive year its row was copied from. The row's own `date` is only a
 * fallback for a season doc with no usable start date (or a row with no day).
 * Null when neither yields a date.
 *
 * @param {{day?: number, date?: unknown}} comp
 * @param {{schedule?: {startDate?: unknown, springTrainingDays?: number}, startDate?: unknown}|null|undefined} season
 * @returns {string|null}
 */
function competitionIsoDate(comp, season) {
  const fromCalendar = competitionDayToIsoDate(season, comp.day);
  if (fromCalendar) return fromCalendar;
  const explicit = coerceDate(comp.date);
  if (!explicit) return null;
  const y = explicit.getUTCFullYear();
  const m = String(explicit.getUTCMonth() + 1).padStart(2, "0");
  const d = String(explicit.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * True when the two weather objects carry the same rendered facts for the same
 * calendar day. An entry with no `date` predates season-calendar dating (it may
 * be the archive year's weather), so it never counts as the same.
 */
function sameWeather(a, b) {
  if (!a || !b) return false;
  return a.summary === b.summary && a.tempF === b.tempF && a.code === b.code && a.date === b.date;
}

/**
 * Walk the active season's schedule and fill/refresh each competition's
 * `weather`. Pure-ish: all effects go through the injected/real db and weather
 * function, so the test drives it with fakes and no network.
 *
 * @param {object} db  Firestore.
 * @param {object} [deps]  { getShowtimeWeather, now } overrides for tests.
 * @returns {Promise<{updated:number, looked:number, total:number, seasonId:string|null}>}
 */
async function enrichScheduleWeatherLogic(db, deps = {}) {
  const weatherFn = deps.getShowtimeWeather || getShowtimeWeather;
  const now = deps.now || Date.now();

  const seasonSnap = await db.doc("game-settings/season").get();
  if (!seasonSnap.exists) {
    logger.info("[schedule-weather] no active season; nothing to enrich.");
    return { updated: 0, looked: 0, total: 0, seasonId: null };
  }
  const season = seasonSnap.data() || {};
  const seasonId = season.seasonUid || null;
  if (!seasonId) {
    logger.info("[schedule-weather] active season has no seasonUid; skipping.");
    return { updated: 0, looked: 0, total: 0, seasonId: null };
  }
  const schedRef = db.doc(`schedules/${seasonId}`);
  const schedSnap = await schedRef.get();
  const competitions = (schedSnap.exists && schedSnap.data().competitions) || [];
  if (competitions.length === 0) {
    logger.info(`[schedule-weather] schedules/${seasonId} has no competitions.`);
    return { updated: 0, looked: 0, total: 0, seasonId };
  }

  let updated = 0;
  let looked = 0;
  const out = [];
  for (const comp of competitions) {
    const entry = { ...comp };
    // A championship round's venue is a fixed game fact (Indianapolis for the
    // World rounds, Marion for Open & A): resolve it through the shared table
    // and repair the row when an off-season copied an archive year's site, so
    // the weather is fetched for — and the card shows — the real venue.
    const fixedVenue = championshipVenueFor(comp);
    if (fixedVenue && comp.location !== fixedVenue) {
      entry.location = fixedVenue;
      updated += 1;
    }
    const location = fixedVenue || cleanLocation(comp.location);
    const date = competitionIsoDate(comp, season);

    if (location && date) {
      const ageDays = Math.floor((now - Date.parse(`${date}T12:00:00Z`)) / DAY_MS);
      // Skip only shows beyond the forecast horizon (no data exists yet); they
      // get picked up on a later run once they enter the window. Past and near
      // shows are looked up (and served from cache when already resolved).
      if (ageDays >= -FORECAST_HORIZON_DAYS) {
        looked += 1;
        try {
          const w = await weatherFn({ db, location, date });
          if (w && w.summary) {
            const next = {
              summary: w.summary,
              tempF: w.tempF == null ? null : w.tempF,
              code: w.code == null ? null : w.code,
              hour: SHOWTIME_HOUR,
              // The calendar day the conditions are for, so a card (and a
              // re-run) can tell a season-dated entry from a stale one.
              date,
            };
            if (!sameWeather(comp.weather, next)) updated += 1;
            entry.weather = next;
          }
          // A null result leaves any existing entry.weather (from the spread)
          // intact — a transient miss never wipes good weather off the card.
        } catch (err) {
          logger.warn(`[schedule-weather] lookup failed for ${location}: ${err.message}`);
        }
      }
    }
    out.push(entry);
  }

  // Only write when something actually changed, so the client's schedule
  // onSnapshot doesn't churn on a no-op pass.
  if (updated > 0) {
    await schedRef.set({ competitions: out }, { merge: true });
  }
  logger.info(
    `[schedule-weather] season ${seasonId}: looked up ${looked}, updated ${updated} of ${competitions.length}.`
  );
  return { updated, looked, total: competitions.length, seasonId };
}

exports.enrichScheduleWeatherLogic = enrichScheduleWeatherLogic;
exports.competitionIsoDate = competitionIsoDate;
exports.coerceDate = coerceDate;
exports.sameWeather = sameWeather;

exports.scheduledScheduleWeather = onSchedule(
  {
    // First pass, once a day after the overnight score/news pipeline has settled.
    // Historical lookups are cached forever and only the upcoming slate refreshes,
    // so this stays comfortably inside Open-Meteo's free daily limit.
    schedule: "0 5 * * *",
    timeZone: "America/New_York",
    timeoutSeconds: 300,
    memory: "256MiB",
    cpu: 1,
  },
  async () => {
    logger.info("Starting scheduled schedule-weather enrichment");
    const result = await enrichScheduleWeatherLogic(getDb());
    logger.info("Completed schedule-weather enrichment", result);
  }
);

exports.scheduledScheduleWeatherEvening = onSchedule(
  {
    // Second pass at 6 p.m. Eastern. Drum corps shows are ~8 p.m. local events, so
    // a day-of refresh a couple hours ahead of the eastern shows captures a much
    // fresher forecast than the 5 a.m. run — the card the audience sees at showtime
    // reflects the evening's actual conditions, not that morning's outlook. Same
    // limit-safe logic: past dates are final and cached forever, and only the
    // in-horizon slate re-fetches (SHOWTIME_REFRESH_MS is under the ~11h gap
    // between the two passes, so this pass genuinely re-fetches it).
    schedule: "0 18 * * *",
    timeZone: "America/New_York",
    timeoutSeconds: 300,
    memory: "256MiB",
    cpu: 1,
  },
  async () => {
    logger.info("Starting evening schedule-weather refresh");
    const result = await enrichScheduleWeatherLogic(getDb());
    logger.info("Completed evening schedule-weather refresh", result);
  }
);
