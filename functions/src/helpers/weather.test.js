// Tests for the Open-Meteo weather helper. No network and no Firestore: the HTTP
// client is injected (fetchImpl) and Firestore is a tiny in-memory fake, so these
// exercise the real geocode → daily → describe → cache flow deterministically.

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  slug,
  toIsoDate,
  skyFromCode,
  describeDailyWeather,
  describeHourlyWeather,
  getShowWeather,
  getShowtimeWeather,
} = require("./weather");

// A minimal Firestore stand-in: doc(path) → { get, set } over a Map.
function fakeDb() {
  const store = new Map();
  return {
    store,
    doc(path) {
      return {
        async get() {
          const has = store.has(path);
          return { exists: has, data: () => store.get(path) };
        },
        async set(value) {
          store.set(path, value);
        },
      };
    },
  };
}

// A fetchImpl that routes by URL to canned payloads and counts calls.
function fakeFetch(routes) {
  const calls = [];
  const impl = async (url, opts) => {
    calls.push({ url, params: opts && opts.params });
    for (const [needle, payload] of routes) {
      if (url.includes(needle)) {
        if (payload instanceof Error) throw payload;
        return { data: typeof payload === "function" ? payload(opts) : payload };
      }
    }
    return { data: null };
  };
  impl.calls = calls;
  return impl;
}

const GEO_HIT = { results: [{ latitude: 42.5, longitude: -90.66, name: "Dubuque" }] };
// An hourly day with a distinct 8 p.m. (hour 20) reading. The `time` array is
// dated 2020-02-20, but fetchShowtimeConditions falls back to the raw hour index
// when the timestamp doesn't match, so this fixture works for any test date.
const HOURLY_HIT = {
  hourly: {
    time: Array.from({ length: 24 }, (_, h) => `2020-02-20T${String(h).padStart(2, "0")}:00`),
    temperature_2m: Array.from({ length: 24 }, (_, h) => (h === 20 ? 61.4 : 30)),
    weather_code: Array.from({ length: 24 }, (_, h) => (h === 20 ? 0 : 3)),
    wind_speed_10m: Array.from({ length: 24 }, () => 12.2),
    precipitation: Array.from({ length: 24 }, () => 0),
    snowfall: Array.from({ length: 24 }, () => 0),
  },
};
const DAILY_HIT = {
  daily: {
    weather_code: [71],
    temperature_2m_max: [34.2],
    temperature_2m_min: [21.4],
    precipitation_sum: [0.0],
    snowfall_sum: [0.6],
    wind_speed_10m_max: [18.3],
  },
};

describe("slug", () => {
  test("lowercases and dashes a place", () => {
    assert.equal(slug("Dubuque, Iowa"), "dubuque-iowa");
    assert.equal(slug("  Saint-Étienne  "), "saint-etienne");
  });
  test("empty for junk", () => {
    assert.equal(slug(null), "");
    assert.equal(slug("!!!"), "");
  });
});

describe("toIsoDate", () => {
  test("formats a Date to local YYYY-MM-DD", () => {
    assert.equal(toIsoDate(new Date(2026, 1, 20)), "2026-02-20"); // Feb = month 1
  });
  test("null for a bad value", () => {
    assert.equal(toIsoDate(null), null);
    assert.equal(toIsoDate("not a date"), null);
  });
});

describe("skyFromCode", () => {
  test("maps WMO bands to plain English", () => {
    assert.equal(skyFromCode(0), "clear skies");
    assert.equal(skyFromCode(3), "overcast");
    assert.equal(skyFromCode(73), "snow");
    assert.equal(skyFromCode(95), "thunderstorms");
  });
  test("unknown code falls back", () => {
    assert.equal(skyFromCode(999), "mixed skies");
  });
});

describe("describeDailyWeather", () => {
  test("builds a factual conditions string with snow and wind", () => {
    const s = describeDailyWeather(DAILY_HIT.daily, 0);
    assert.match(s, /^snow, high 34°F \/ low 21°F/);
    assert.match(s, /winds to 18 mph/);
    assert.match(s, /0\.6 in snow/);
  });
  test("omits wind under threshold and prefers rain when no snow", () => {
    const s = describeDailyWeather(
      {
        weather_code: [61],
        temperature_2m_max: [58],
        temperature_2m_min: [44],
        precipitation_sum: [0.3],
        snowfall_sum: [0],
        wind_speed_10m_max: [8],
      },
      0
    );
    assert.match(s, /^rain, high 58°F \/ low 44°F/);
    assert.doesNotMatch(s, /winds/);
    assert.match(s, /0\.30 in rain/);
  });
  test("null when temperatures are missing", () => {
    assert.equal(describeDailyWeather({ weather_code: [0] }, 0), null);
    assert.equal(describeDailyWeather(null, 0), null);
  });
});

describe("getShowWeather", () => {
  test("resolves geocode → daily → summary and caches it", async () => {
    const db = fakeDb();
    const fetchImpl = fakeFetch([
      ["geocoding-api", GEO_HIT],
      ["/archive", DAILY_HIT],
      ["/forecast", DAILY_HIT],
    ]);
    // A well-past date so the archive endpoint is chosen.
    const summary = await getShowWeather({
      db,
      location: "Dubuque, Iowa",
      date: new Date("2020-02-20T18:00:00"),
      fetchImpl,
    });
    assert.match(summary, /snow, high 34°F/);
    // Both the geocode and the daily conditions were cached.
    assert.ok(db.store.has("weather_geocode/dubuque-iowa"));
    assert.ok(db.store.has("weather_daily/dubuque-iowa__2020-02-20"));
  });

  test("second call hits the daily cache and makes no HTTP request", async () => {
    const db = fakeDb();
    const fetchImpl = fakeFetch([
      ["geocoding-api", GEO_HIT],
      ["/archive", DAILY_HIT],
    ]);
    const opts = { db, location: "Dubuque, Iowa", date: new Date("2020-02-20T18:00:00"), fetchImpl };
    await getShowWeather(opts);
    const callsAfterFirst = fetchImpl.calls.length;
    const again = await getShowWeather(opts);
    assert.match(again, /snow, high 34°F/);
    assert.equal(fetchImpl.calls.length, callsAfterFirst, "no new HTTP calls on a cache hit");
  });

  test("null when the city can't be geocoded, and does NOT cache the miss", async () => {
    const db = fakeDb();
    const fetchImpl = fakeFetch([["geocoding-api", { results: [] }]]);
    const summary = await getShowWeather({
      db,
      location: "Nowheresville",
      date: new Date("2020-02-20T18:00:00"),
      fetchImpl,
    });
    assert.equal(summary, null);
    // A miss is left uncached so a transient failure isn't frozen forever —
    // neither the daily nor the geocode negative is written.
    assert.ok(!db.store.has("weather_daily/nowheresville__2020-02-20"));
    assert.ok(!db.store.has("weather_geocode/nowheresville"));
  });

  test("a transient daily failure after a good geocode is not cached (retries next run)", async () => {
    const db = fakeDb();
    // Geocode resolves, but the archive endpoint returns Open-Meteo's rate-limit
    // error body — describeDailyWeather yields null, and nothing is cached.
    const fetchImpl = fakeFetch([
      ["geocoding-api", GEO_HIT],
      ["/archive", { error: true, reason: "Daily API request limit exceeded." }],
    ]);
    const summary = await getShowWeather({
      db,
      location: "Dubuque, Iowa",
      date: new Date("2020-02-20T18:00:00"),
      fetchImpl,
    });
    assert.equal(summary, null);
    assert.ok(!db.store.has("weather_daily/dubuque-iowa__2020-02-20"));
    // The positive geocode IS cached — that part succeeded and is reusable.
    assert.ok(db.store.has("weather_geocode/dubuque-iowa"));
  });

  test("null on a missing location or date, with no HTTP calls", async () => {
    const fetchImpl = fakeFetch([]);
    assert.equal(await getShowWeather({ location: null, date: new Date(), fetchImpl }), null);
    assert.equal(await getShowWeather({ location: "Dubuque", date: null, fetchImpl }), null);
    assert.equal(fetchImpl.calls.length, 0);
  });

  test("network failure resolves to null rather than throwing", async () => {
    const db = fakeDb();
    const fetchImpl = fakeFetch([["geocoding-api", new Error("socket hang up")]]);
    const summary = await getShowWeather({
      db,
      location: "Dubuque, Iowa",
      date: new Date("2020-02-20T18:00:00"),
      fetchImpl,
    });
    assert.equal(summary, null);
  });
});

describe("describeHourlyWeather", () => {
  test("builds a compact showtime object at the given hour", () => {
    const w = describeHourlyWeather(HOURLY_HIT.hourly, 20);
    assert.deepEqual(w, { summary: "clear skies, 61°F", tempF: 61, code: 0 });
  });
  test("includes wind and precip when notable", () => {
    const w = describeHourlyWeather(
      {
        temperature_2m: [null, 40],
        weather_code: [null, 63],
        wind_speed_10m: [null, 22],
        precipitation: [null, 0.25],
        snowfall: [null, 0],
      },
      1
    );
    assert.equal(w.summary, "rain, 40°F, winds 22 mph, 0.25 in rain");
    assert.equal(w.tempF, 40);
    assert.equal(w.code, 63);
  });
  test("null when the hour's temperature is missing", () => {
    assert.equal(describeHourlyWeather({ temperature_2m: [null] }, 0), null);
    assert.equal(describeHourlyWeather(null, 0), null);
  });
});

describe("getShowtimeWeather", () => {
  test("resolves a past show to a final, permanently-cached object", async () => {
    const db = fakeDb();
    const fetchImpl = fakeFetch([
      ["geocoding-api", GEO_HIT],
      ["/archive", HOURLY_HIT],
    ]);
    const opts = { db, location: "Dubuque, Iowa", date: new Date("2020-02-20"), fetchImpl };
    const w = await getShowtimeWeather(opts);
    assert.deepEqual(w, { summary: "clear skies, 61°F", tempF: 61, code: 0 });

    const cached = db.store.get("weather_show/dubuque-iowa__2020-02-20__20");
    assert.equal(cached.final, true);

    // A second call is served from the cache with no new HTTP.
    const before = fetchImpl.calls.length;
    const again = await getShowtimeWeather(opts);
    assert.deepEqual(again, w);
    assert.equal(fetchImpl.calls.length, before);
  });

  test("a fresh forecast cache entry is reused without any HTTP", async () => {
    const db = fakeDb();
    const soon = new Date(Date.now() + 3 * 86400000);
    const iso = toIsoDate(soon);
    db.store.set(`weather_show/dubuque-iowa__${iso}__20`, {
      final: false,
      cachedAt: new Date(), // fresh
      weather: { summary: "overcast, 55°F", tempF: 55, code: 3 },
    });
    const fetchImpl = fakeFetch([]); // any HTTP call would return null → fail loudly
    const w = await getShowtimeWeather({ db, location: "Dubuque, Iowa", date: soon, fetchImpl });
    assert.equal(w.summary, "overcast, 55°F");
    assert.equal(fetchImpl.calls.length, 0);
  });

  test("a stale forecast cache entry is re-fetched", async () => {
    const db = fakeDb();
    const soon = new Date(Date.now() + 3 * 86400000);
    const iso = toIsoDate(soon);
    db.store.set(`weather_show/dubuque-iowa__${iso}__20`, {
      final: false,
      cachedAt: new Date(Date.now() - 2 * 86400000), // stale
      weather: { summary: "stale, 99°F", tempF: 99, code: 0 },
    });
    const fetchImpl = fakeFetch([
      ["geocoding-api", GEO_HIT],
      ["/forecast", HOURLY_HIT],
    ]);
    const w = await getShowtimeWeather({ db, location: "Dubuque, Iowa", date: soon, fetchImpl });
    assert.equal(w.summary, "clear skies, 61°F"); // refreshed, not the stale value
    assert.ok(fetchImpl.calls.length > 0);
  });

  test("null on missing location/date with no HTTP", async () => {
    const fetchImpl = fakeFetch([]);
    assert.equal(await getShowtimeWeather({ location: null, date: new Date(), fetchImpl }), null);
    assert.equal(await getShowtimeWeather({ location: "Dubuque", date: null, fetchImpl }), null);
    assert.equal(fetchImpl.calls.length, 0);
  });
});
