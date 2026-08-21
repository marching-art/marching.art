// Schedule weather producer.
//
// Denormalizes real show-time weather onto each competition in the active
// season's schedule doc (schedules/{seasonUid}.competitions[]), so the schedule
// show cards can render it straight from the data the client already loads — no
// per-card, per-user weather calls, and therefore no risk to Open-Meteo's daily
// limits. This scheduled job is the ONLY thing that calls the weather API for the
// schedule: it runs once a day, and every lookup is Firestore-cached, so a full
// season of shows costs at most a few dozen calls a day (historical dates are
// cached permanently; only the upcoming ~two weeks refresh).
//
// Show time is a constant 8 p.m. local (SHOWTIME_HOUR) — drum corps shows are
// evening events, and that beats a daily high/low for "what it felt like at the
// show". Everything is best-effort: a lookup that fails or returns nothing simply
// leaves that competition's existing weather untouched.

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
const { getShowtimeWeather, SHOWTIME_HOUR, FORECAST_HORIZON_DAYS } = require("../helpers/weather");
const { cleanLocation } = require("../helpers/newsArticleShared");
const { assertAdmin } = require("../helpers/callableGuards");

const DAY_MS = 86400000;

/** A Firestore Timestamp, a Date, an ISO string, or epoch ms → Date, or null. */
function coerceDate(value) {
  if (!value) return null;
  const d = typeof value.toDate === "function" ? value.toDate() : value instanceof Date ? value : new Date(value);
  return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
}

/**
 * A competition's real calendar date: its own `date` when present, otherwise
 * derived from the season start plus its day number (off-season shows carry a day
 * but often no explicit date). Returns a Date or null.
 */
function competitionDate(comp, seasonStartDate) {
  const explicit = coerceDate(comp.date);
  if (explicit) return explicit;
  if (seasonStartDate && Number.isFinite(comp.day)) {
    const d = new Date(seasonStartDate);
    d.setDate(d.getDate() + (comp.day - 1));
    return d;
  }
  return null;
}

/** True when the two weather objects carry the same rendered facts. */
function sameWeather(a, b) {
  if (!a || !b) return false;
  return a.summary === b.summary && a.tempF === b.tempF && a.code === b.code;
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
  const seasonStartDate =
    coerceDate(season.schedule && season.schedule.startDate) || coerceDate(season.startDate);

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
    const location = cleanLocation(comp.location);
    const date = competitionDate(comp, seasonStartDate);

    if (location && date) {
      const ageDays = Math.floor((now - date.getTime()) / DAY_MS);
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
exports.competitionDate = competitionDate;
exports.coerceDate = coerceDate;
exports.sameWeather = sameWeather;

exports.scheduledScheduleWeather = onSchedule(
  {
    // Once a day, after the overnight score/news pipeline has settled. Historical
    // lookups are cached forever and only the upcoming slate refreshes, so this
    // stays comfortably inside Open-Meteo's free daily limit.
    schedule: "0 5 * * *",
    timeZone: "America/New_York",
    timeoutSeconds: 300,
    memory: "256MiB",
  },
  async () => {
    logger.info("Starting scheduled schedule-weather enrichment");
    const result = await enrichScheduleWeatherLogic(getDb());
    logger.info("Completed schedule-weather enrichment", result);
  }
);

exports.refreshScheduleWeatherNow = onCall({ cors: true, timeoutSeconds: 300 }, async (request) => {
  assertAdmin(request);
  return enrichScheduleWeatherLogic(getDb());
});
