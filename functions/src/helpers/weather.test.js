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
  getShowWeather,
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
