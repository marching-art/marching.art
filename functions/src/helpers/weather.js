// Real weather for a show's venue and date, for the fantasy articles' SETTING
// line. The fantasy pieces may frame the night as a scene, and the strongest
// atmosphere is REAL atmosphere: instead of inventing a sky, we look up what it
// actually did at the venue on the show's real calendar date and hand the writer
// a short, factual conditions string. An off-season winter show genuinely reads
// differently from a July night, and now the article can say so truthfully.
//
// Source: Open-Meteo (https://open-meteo.com). Keyless and free for
// non-commercial use — geocoding turns a venue city into coordinates, and the
// historical/forecast API returns the day's conditions. If the site ever needs
// the commercial tier, set OPEN_METEO_API_KEY and it is appended as `apikey`;
// the endpoints move to the customer subdomain automatically.
//
// Everything here is best-effort: any failure (no location, no network, no data,
// a bad response) resolves to null, and the caller simply omits the SETTING
// weather rather than blocking or failing article generation. Both the geocode
// and the daily lookup are cached in Firestore so a night's five articles and any
// re-runs cost at most one call per (city) and one per (city, date) — historical
// weather never changes, so those entries are effectively permanent.

const axios = require("axios");
const { logger } = require("firebase-functions/v2");

// Optional commercial API key. Unset in the default (free, non-commercial)
// configuration; when present, Open-Meteo wants it on the customer subdomain.
const OPEN_METEO_API_KEY = process.env.OPEN_METEO_API_KEY || null;
const GEOCODE_HOST = "https://geocoding-api.open-meteo.com";
const FORECAST_HOST = OPEN_METEO_API_KEY
  ? "https://customer-api.open-meteo.com"
  : "https://api.open-meteo.com";
const ARCHIVE_HOST = OPEN_METEO_API_KEY
  ? "https://customer-archive-api.open-meteo.com"
  : "https://archive-api.open-meteo.com";

// The archive (ERA5) series lags real time by a few days; anything more recent
// than this many days is read from the forecast endpoint instead (it serves the
// recent past and the near future). Picking the endpoint by the date's age keeps
// both historical off-season dates and current-season nights covered.
const ARCHIVE_LAG_DAYS = 6;
const HTTP_TIMEOUT_MS = 6000;

// Drum corps shows are evening events, so the schedule card's weather is read at
// a constant local show hour rather than a daily high/low — 8 p.m. local. (The
// hourly series comes back in the venue's own timezone via timezone=auto, so the
// index is simply the local hour.)
const SHOWTIME_HOUR = 20;

// A cached showtime lookup for a date still in the forecast window can change, so
// non-final entries are re-fetched once they are older than this. The producer
// runs daily, so a ~20h staleness means each daily pass refreshes the upcoming
// slate exactly once. Past dates are marked `final` and never re-fetched.
const SHOWTIME_REFRESH_MS = 20 * 60 * 60 * 1000;

// Open-Meteo's forecast reaches ~16 days out; a show further out than this has no
// data yet, so the producer skips it (and tries again once it enters the window).
const FORECAST_HORIZON_DAYS = 15;

/** A Firestore-safe slug for a cache key: lowercase alphanumerics and dashes. */
function slug(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining diacritics so accented letters fold to ASCII
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

/** A Date (or parseable value) as a local YYYY-MM-DD string, or null. */
function toIsoDate(date) {
  const d = date instanceof Date ? date : date ? new Date(date) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// WMO weather-code → plain-English sky. Grouped to the bands the daily code
// actually reports; anything unmapped falls back to a neutral "mixed skies" so
// the string is always readable.
function skyFromCode(code) {
  const c = Number(code);
  if (c === 0) return "clear skies";
  if (c === 1) return "mostly clear";
  if (c === 2) return "partly cloudy";
  if (c === 3) return "overcast";
  if (c === 45 || c === 48) return "fog";
  if (c >= 51 && c <= 57) return "drizzle";
  if (c >= 61 && c <= 67) return "rain";
  if (c >= 71 && c <= 77) return "snow";
  if (c >= 80 && c <= 82) return "rain showers";
  if (c === 85 || c === 86) return "snow showers";
  if (c >= 95 && c <= 99) return "thunderstorms";
  return "mixed skies";
}

/**
 * Turn one day's Open-Meteo `daily` record into a short factual conditions
 * string, e.g. "overcast, high 39°F / low 27°F, winds to 21 mph, 0.4 in snow".
 * Returns null when the core temperatures are missing, so a half-empty record
 * never reaches the article. Pure.
 */
function describeDailyWeather(daily, index = 0) {
  if (!daily) return null;
  const at = (key) => {
    const arr = daily[key];
    return Array.isArray(arr) && typeof arr[index] === "number" ? arr[index] : null;
  };
  const hi = at("temperature_2m_max");
  const lo = at("temperature_2m_min");
  if (hi == null && lo == null) return null;

  const sky = skyFromCode(Array.isArray(daily.weather_code) ? daily.weather_code[index] : null);
  const parts = [sky];

  if (hi != null && lo != null) parts.push(`high ${Math.round(hi)}°F / low ${Math.round(lo)}°F`);
  else if (hi != null) parts.push(`around ${Math.round(hi)}°F`);
  else parts.push(`around ${Math.round(lo)}°F`);

  const wind = at("wind_speed_10m_max");
  if (wind != null && wind >= 15) parts.push(`winds to ${Math.round(wind)} mph`);

  const snow = at("snowfall_sum");
  const precip = at("precipitation_sum");
  if (snow != null && snow >= 0.1) parts.push(`${snow.toFixed(1)} in snow`);
  else if (precip != null && precip >= 0.1) parts.push(`${precip.toFixed(2)} in rain`);

  return parts.join(", ");
}

/** GET JSON with a short timeout; resolves to null on any error. */
async function getJson(fetchImpl, url, params) {
  try {
    const res = await fetchImpl(url, { params, timeout: HTTP_TIMEOUT_MS });
    return res && res.data ? res.data : null;
  } catch (err) {
    logger.warn(`[weather] request failed for ${url}: ${err.message}`);
    return null;
  }
}

/**
 * Resolve a venue string (a city, optionally "City, State") to coordinates via
 * Open-Meteo geocoding, cached in Firestore under weather_geocode/{slug}. Returns
 * { latitude, longitude, name } or null.
 *
 * Only POSITIVE resolutions are cached. A miss — whether the place genuinely
 * doesn't resolve or the request failed (a network blip, a rate limit) — is left
 * uncached so the next night simply tries again, rather than a transient failure
 * being frozen into a permanent "no such place". The cost of re-looking-up the
 * rare unresolvable venue is one request a night; the cost of caching a transient
 * failure is a venue that never gets weather again.
 */
async function geocodeLocation({ db, fetchImpl, location }) {
  const key = slug(location);
  if (!key) return null;
  const ref = db ? db.doc(`weather_geocode/${key}`) : null;

  if (ref) {
    try {
      const snap = await ref.get();
      if (snap.exists) return snap.data();
    } catch (err) {
      logger.warn(`[weather] geocode cache read failed: ${err.message}`);
    }
  }

  // Open-Meteo matches on a bare place name, so query the first comma-segment
  // (the city) rather than "City, State" which often fails to resolve.
  const cityQuery = String(location).split(",")[0].trim();
  const data = await getJson(fetchImpl, `${GEOCODE_HOST}/v1/search`, {
    name: cityQuery,
    count: 1,
    language: "en",
    format: "json",
    ...(OPEN_METEO_API_KEY ? { apikey: OPEN_METEO_API_KEY } : {}),
  });
  const hit = data && Array.isArray(data.results) ? data.results[0] : null;
  if (!hit || typeof hit.latitude !== "number" || typeof hit.longitude !== "number") return null;

  const result = { latitude: hit.latitude, longitude: hit.longitude, name: hit.name || cityQuery };
  if (ref) {
    try {
      await ref.set({ ...result, cachedAt: new Date() });
    } catch (err) {
      logger.warn(`[weather] geocode cache write failed: ${err.message}`);
    }
  }
  return result;
}

/**
 * The day's conditions at a set of coordinates, from the endpoint appropriate to
 * how old the date is (archive for well past, forecast for the recent past and
 * near future). Returns a describeDailyWeather string or null.
 */
async function fetchDailyConditions({ fetchImpl, latitude, longitude, isoDate }) {
  const ageDays = Math.floor((Date.now() - new Date(`${isoDate}T12:00:00`).getTime()) / 86400000);
  const host = ageDays > ARCHIVE_LAG_DAYS ? ARCHIVE_HOST : FORECAST_HOST;

  const data = await getJson(fetchImpl, `${host}/v1/${host === ARCHIVE_HOST ? "archive" : "forecast"}`, {
    latitude,
    longitude,
    start_date: isoDate,
    end_date: isoDate,
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum,wind_speed_10m_max",
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    precipitation_unit: "inch",
    timezone: "auto",
    ...(OPEN_METEO_API_KEY ? { apikey: OPEN_METEO_API_KEY } : {}),
  });

  return describeDailyWeather(data && data.daily ? data.daily : null, 0);
}

/**
 * Turn one hour of an Open-Meteo `hourly` record into a compact conditions
 * object for the schedule card, e.g.
 *   { summary: "clear skies, 61°F, winds 12 mph", tempF: 61, code: 0 }.
 * Returns null when the temperature at that hour is missing. Pure.
 */
function describeHourlyWeather(hourly, index) {
  if (!hourly || index == null || index < 0) return null;
  const at = (key) => {
    const arr = hourly[key];
    return Array.isArray(arr) && typeof arr[index] === "number" ? arr[index] : null;
  };
  const temp = at("temperature_2m");
  if (temp == null) return null;

  const rawCode = Array.isArray(hourly.weather_code) ? hourly.weather_code[index] : null;
  const code = typeof rawCode === "number" ? rawCode : null;
  const parts = [skyFromCode(code), `${Math.round(temp)}°F`];

  const wind = at("wind_speed_10m");
  if (wind != null && wind >= 15) parts.push(`winds ${Math.round(wind)} mph`);

  const snow = at("snowfall");
  const precip = at("precipitation");
  if (snow != null && snow >= 0.1) parts.push(`${snow.toFixed(1)} in snow`);
  else if (precip != null && precip >= 0.1) parts.push(`${precip.toFixed(2)} in rain`);

  return { summary: parts.join(", "), tempF: Math.round(temp), code };
}

/**
 * The conditions at a set of coordinates at a specific local hour on a date,
 * from the endpoint appropriate to the date's age. Returns a describeHourlyWeather
 * object or null.
 */
async function fetchShowtimeConditions({ fetchImpl, latitude, longitude, isoDate, hour }) {
  const ageDays = Math.floor((Date.now() - new Date(`${isoDate}T12:00:00`).getTime()) / 86400000);
  const useArchive = ageDays > ARCHIVE_LAG_DAYS;
  const host = useArchive ? ARCHIVE_HOST : FORECAST_HOST;

  const data = await getJson(fetchImpl, `${host}/v1/${useArchive ? "archive" : "forecast"}`, {
    latitude,
    longitude,
    start_date: isoDate,
    end_date: isoDate,
    hourly: "temperature_2m,weather_code,wind_speed_10m,precipitation,snowfall",
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    precipitation_unit: "inch",
    timezone: "auto",
    ...(OPEN_METEO_API_KEY ? { apikey: OPEN_METEO_API_KEY } : {}),
  });

  const hourly = data && data.hourly ? data.hourly : null;
  if (!hourly) return null;

  // With timezone=auto and a single-day range the hourly series is that local
  // day, so the local hour is the index — but match on the timestamp when the
  // series carries one, in case the window isn't exactly 24 aligned entries.
  let index = hour;
  if (Array.isArray(hourly.time)) {
    const target = `${isoDate}T${String(hour).padStart(2, "0")}:00`;
    const found = hourly.time.findIndex((t) => String(t).startsWith(target));
    if (found >= 0) index = found;
  }
  return describeHourlyWeather(hourly, index);
}

/**
 * The real weather at a show's venue on its date, as a short factual string for
 * the fantasy SETTING line — or null when it can't be determined (no location,
 * no date, no network, no data). Best-effort by design: the caller treats null
 * as "no weather to add" and the article omits it.
 *
 * Caches the resolved conditions in Firestore under
 * weather_daily/{citySlug}__{isoDate}; historical weather is immutable, so the
 * entry is effectively permanent and a re-run never re-fetches.
 *
 * @param {object}   opts
 * @param {object}   opts.db         Firestore (for caching). Optional; omit to skip caching.
 * @param {string}   opts.location   Venue city, e.g. "Dubuque, Iowa".
 * @param {Date|*}   opts.date       The show's real calendar date.
 * @param {Function} [opts.fetchImpl] HTTP GET (url, {params, timeout}) → {data}. Defaults to axios.get.
 */
async function getShowWeather({ db, location, date, fetchImpl = axios.get }) {
  const isoDate = toIsoDate(date);
  const citySlug = slug(location);
  if (!isoDate || !citySlug) return null;

  const cacheRef = db ? db.doc(`weather_daily/${citySlug}__${isoDate}`) : null;
  if (cacheRef) {
    try {
      const snap = await cacheRef.get();
      if (snap.exists) {
        const cached = snap.data();
        if (cached && typeof cached.summary === "string") return cached.summary;
      }
    } catch (err) {
      logger.warn(`[weather] daily cache read failed: ${err.message}`);
    }
  }

  let summary = null;
  try {
    const geo = await geocodeLocation({ db, fetchImpl, location });
    if (geo) {
      summary = await fetchDailyConditions({
        fetchImpl,
        latitude: geo.latitude,
        longitude: geo.longitude,
        isoDate,
      });
    }
  } catch (err) {
    logger.warn(`[weather] lookup failed for ${location} ${isoDate}: ${err.message}`);
    summary = null;
  }

  // Only a real conditions string is cached — a miss (bad place, no data, or a
  // transient network/rate-limit failure) is left uncached so the next run
  // retries rather than freezing a temporary failure into permanent silence.
  // Historical weather never changes, so a cached summary is effectively final.
  if (cacheRef && summary) {
    try {
      await cacheRef.set({ location, isoDate, summary, cachedAt: new Date() });
    } catch (err) {
      logger.warn(`[weather] daily cache write failed: ${err.message}`);
    }
  }
  return summary;
}

// Timestamp helper: a Firestore Timestamp (has toDate) or a JS Date/ISO → ms, or
// null. Lets the showtime cache read entries written by either Firestore or the
// in-memory test fake.
function toMillis(value) {
  if (!value) return null;
  const d = typeof value.toDate === "function" ? value.toDate() : value;
  const t = d instanceof Date ? d.getTime() : new Date(d).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * The real conditions at a show's venue at showtime (a constant local hour), as a
 * compact object { summary, tempF, code } for the schedule card — or null when it
 * can't be determined. Best-effort, like getShowWeather.
 *
 * Cached in Firestore under weather_show/{citySlug}__{isoDate}__{hour} with a
 * `final` flag. A past date is final and served from cache forever (historical
 * weather doesn't change); an upcoming date is a forecast, so its cache entry is
 * re-fetched once it goes stale (SHOWTIME_REFRESH_MS) — the daily producer thus
 * refreshes the upcoming slate exactly once per run. Only positive results are
 * cached, so a transient failure retries next run instead of sticking.
 *
 * @param {object}   opts
 * @param {object}   opts.db         Firestore (for caching). Optional.
 * @param {string}   opts.location   Venue city, e.g. "Dubuque, Iowa".
 * @param {Date|*}   opts.date       The show's real calendar date.
 * @param {number}   [opts.hour]     Local show hour (default 8 p.m.).
 * @param {Function} [opts.fetchImpl] HTTP GET; defaults to axios.get.
 */
async function getShowtimeWeather({ db, location, date, hour = SHOWTIME_HOUR, fetchImpl = axios.get }) {
  const isoDate = toIsoDate(date);
  const citySlug = slug(location);
  if (!isoDate || !citySlug) return null;

  const ageDays = Math.floor((Date.now() - new Date(`${isoDate}T12:00:00`).getTime()) / 86400000);
  const isFinal = ageDays > ARCHIVE_LAG_DAYS;
  const cacheRef = db ? db.doc(`weather_show/${citySlug}__${isoDate}__${hour}`) : null;

  if (cacheRef) {
    try {
      const snap = await cacheRef.get();
      if (snap.exists) {
        const cached = snap.data();
        const weather = cached && cached.weather;
        if (weather && typeof weather.summary === "string") {
          const fresh = toMillis(cached.cachedAt) != null &&
            Date.now() - toMillis(cached.cachedAt) < SHOWTIME_REFRESH_MS;
          // A final (past) entry never changes; a still-fresh forecast is reused.
          if (cached.final || fresh) return weather;
        }
      }
    } catch (err) {
      logger.warn(`[weather] showtime cache read failed: ${err.message}`);
    }
  }

  let weather = null;
  try {
    const geo = await geocodeLocation({ db, fetchImpl, location });
    if (geo) {
      weather = await fetchShowtimeConditions({
        fetchImpl,
        latitude: geo.latitude,
        longitude: geo.longitude,
        isoDate,
        hour,
      });
    }
  } catch (err) {
    logger.warn(`[weather] showtime lookup failed for ${location} ${isoDate}: ${err.message}`);
    weather = null;
  }

  if (cacheRef && weather) {
    try {
      await cacheRef.set({ location, isoDate, hour, weather, final: isFinal, cachedAt: new Date() });
    } catch (err) {
      logger.warn(`[weather] showtime cache write failed: ${err.message}`);
    }
  }
  return weather;
}

module.exports = {
  getShowWeather,
  getShowtimeWeather,
  SHOWTIME_HOUR,
  FORECAST_HORIZON_DAYS,
  // Exported for unit tests:
  slug,
  toIsoDate,
  skyFromCode,
  describeDailyWeather,
  describeHourlyWeather,
  geocodeLocation,
  fetchDailyConditions,
  fetchShowtimeConditions,
};
