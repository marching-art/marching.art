// Tests for the schedule-weather producer logic. No network and no real
// Firestore: db is an in-memory fake and the weather lookup is injected, so this
// exercises date resolution, the forecast-horizon gate, change detection, and the
// write-only-when-changed behaviour deterministically.

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  enrichScheduleWeatherLogic,
  competitionIsoDate,
  coerceDate,
  sameWeather,
} = require("./scheduleWeather");

// Firestore stand-in over a Map, recording writes with merge semantics for the
// one field the producer sets.
function fakeDb(seed = {}) {
  const store = new Map(Object.entries(seed));
  const writes = [];
  return {
    store,
    writes,
    doc(path) {
      return {
        async get() {
          return { exists: store.has(path), data: () => store.get(path) };
        },
        async set(value, options) {
          writes.push({ path, value, options });
          const prev = options && options.merge ? store.get(path) || {} : {};
          store.set(path, { ...prev, ...value });
        },
      };
    },
  };
}

const NOW = new Date("2026-06-15T12:00:00Z").getTime();
const SEASON = { seasonUid: "s1", schedule: { startDate: new Date("2026-06-01T00:00:00Z") } };

describe("coerceDate / competitionIsoDate", () => {
  test("coerceDate handles Timestamp, Date, and ISO", () => {
    assert.equal(coerceDate({ toDate: () => new Date("2026-06-10") }).getUTCFullYear(), 2026);
    assert.equal(coerceDate(new Date("2026-06-10")).getUTCMonth(), 5);
    assert.equal(coerceDate("2026-06-10").getUTCDate(), 10);
    assert.equal(coerceDate(null), null);
  });
  test("dates a row from the season calendar, not its own archive date", () => {
    // An off-season row replays a 2014 night; the show is played on Day 3 of
    // THIS season, so its weather is June 3, 2026 — not July 2014.
    assert.equal(competitionIsoDate({ day: 3, date: "2014-07-12" }, SEASON), "2026-06-03");
  });
  test("a live season lands the day after spring training", () => {
    const live = {
      seasonUid: "live_2026-27",
      status: "live-season",
      schedule: { startDate: new Date("2026-06-01T00:00:00Z"), springTrainingDays: 21 },
    };
    // Day 45 (Open & A Prelims) = June 1 + 21 + 44 = Aug 5, 2026.
    assert.equal(competitionIsoDate({ day: 45, date: null }, live), "2026-08-05");
  });
  test("a generated championship round with no date is dated from its day", () => {
    assert.equal(competitionIsoDate({ day: 45, date: null }, SEASON), "2026-07-15");
  });
  test("accepts a Firestore Timestamp start and a legacy top-level startDate", () => {
    const ts = { seasonUid: "s1", schedule: { startDate: { toDate: () => new Date("2026-06-01T00:00:00Z") } } };
    assert.equal(competitionIsoDate({ day: 1 }, ts), "2026-06-01");
    assert.equal(competitionIsoDate({ day: 2 }, { startDate: "2026-06-01T00:00:00Z" }), "2026-06-02");
  });
  test("falls back to the row's own date only without a season calendar", () => {
    assert.equal(competitionIsoDate({ day: 3, date: "2026-07-04" }, {}), "2026-07-04");
    assert.equal(competitionIsoDate({ date: "2026-07-04" }, SEASON), "2026-07-04"); // no day
    assert.equal(competitionIsoDate({}, null), null);
  });
  test("sameWeather requires the same calendar day", () => {
    const a = { summary: "clear skies, 61°F", tempF: 61, code: 0, hour: 20, date: "2026-06-08" };
    assert.ok(sameWeather(a, { ...a }));
    assert.ok(!sameWeather(a, { ...a, date: "2014-07-12" }));
    assert.ok(!sameWeather(a, { summary: a.summary, tempF: 61, code: 0, hour: 20 })); // undated legacy
  });
});

describe("enrichScheduleWeatherLogic", () => {
  const weatherOk = async () => ({ summary: "clear skies, 61°F", tempF: 61, code: 0 });

  test("fills weather on eligible comps (championship rounds included) and writes once", async () => {
    const db = fakeDb({
      "game-settings/season": SEASON,
      "schedules/s1": {
        competitions: [
          { id: "a", day: 8, location: "Dubuque, Iowa", date: "2014-07-12" }, // past (archive-dated row)
          { id: "b", day: 15, location: "Allentown, PA", date: "2026-06-15" }, // today
          { id: "c", day: 40, location: "Indianapolis, IN", date: "2026-07-10" }, // beyond horizon → skip
          { id: "d", day: 9, location: "", date: "2026-06-09" }, // no location → skip
          {
            id: "champ",
            day: 25,
            type: "championship",
            name: "Open and A Class Prelims",
            location: "Marion, IN",
            date: null, // generated rounds carry no date
          },
        ],
      },
    });
    const seen = [];
    const spy = async (args) => {
      seen.push(args);
      return weatherOk();
    };
    const res = await enrichScheduleWeatherLogic(db, { getShowtimeWeather: spy, now: NOW });
    assert.equal(res.looked, 3); // a, b and the championship round
    assert.equal(res.updated, 3);
    assert.equal(res.total, 5);

    // Every lookup is keyed on the SEASON calendar day, as a YYYY-MM-DD string.
    assert.deepEqual(
      seen.map((call) => [call.location, call.date]),
      [
        ["Dubuque, Iowa", "2026-06-08"],
        ["Allentown, PA", "2026-06-15"],
        ["Marion, IN", "2026-06-25"],
      ]
    );

    const comps = db.store.get("schedules/s1").competitions;
    const byId = Object.fromEntries(comps.map((c) => [c.id, c]));
    assert.equal(byId.a.weather.summary, "clear skies, 61°F");
    assert.equal(byId.a.weather.hour, 20);
    assert.equal(byId.a.weather.date, "2026-06-08");
    assert.equal(byId.b.weather.tempF, 61);
    assert.equal(byId.champ.weather.date, "2026-06-25");
    assert.equal(byId.c.weather, undefined); // beyond horizon
    assert.equal(byId.d.weather, undefined); // no location
    assert.equal(db.writes.length, 1); // one merge write
  });

  test("pins a championship round to its fixed venue and fetches weather there", async () => {
    // An off-season copies the World rounds from an archive year, dragging that
    // year's venue along; the game's World Championship is always Indianapolis.
    const db = fakeDb({
      "game-settings/season": SEASON,
      "schedules/s1": {
        competitions: [
          {
            id: "finals",
            day: 14,
            type: "championship",
            name: "marching.art World Championship Finals",
            location: "Madison, WI",
            date: "2003-08-09",
          },
        ],
      },
    });
    const seen = [];
    const spy = async (args) => {
      seen.push(args);
      return weatherOk();
    };
    const res = await enrichScheduleWeatherLogic(db, { getShowtimeWeather: spy, now: NOW });
    assert.equal(seen[0].location, "Indianapolis, IN");
    assert.equal(seen[0].date, "2026-06-14");
    const row = db.store.get("schedules/s1").competitions[0];
    assert.equal(row.location, "Indianapolis, IN");
    assert.equal(row.weather.summary, "clear skies, 61°F");
    assert.ok(res.updated >= 1);
    assert.equal(db.writes.length, 1);
  });

  test("makes no write when nothing changed (idempotent second pass)", async () => {
    const db = fakeDb({
      "game-settings/season": SEASON,
      "schedules/s1": {
        competitions: [
          {
            id: "a",
            day: 8,
            location: "Dubuque, Iowa",
            date: "2026-06-08",
            weather: { summary: "clear skies, 61°F", tempF: 61, code: 0, hour: 20, date: "2026-06-08" },
          },
        ],
      },
    });
    const res = await enrichScheduleWeatherLogic(db, { getShowtimeWeather: weatherOk, now: NOW });
    assert.equal(res.looked, 1);
    assert.equal(res.updated, 0);
    assert.equal(db.writes.length, 0);
  });

  test("re-dates a legacy entry that was fetched for the archive year", async () => {
    // Same facts, but the stored entry has no `date` — it predates season-
    // calendar dating and may be the replayed year's weather. One pass replaces it.
    const db = fakeDb({
      "game-settings/season": SEASON,
      "schedules/s1": {
        competitions: [
          {
            id: "a",
            day: 8,
            location: "Dubuque, Iowa",
            date: "2014-07-12",
            weather: { summary: "clear skies, 61°F", tempF: 61, code: 0, hour: 20 },
          },
        ],
      },
    });
    const res = await enrichScheduleWeatherLogic(db, { getShowtimeWeather: weatherOk, now: NOW });
    assert.equal(res.updated, 1);
    assert.equal(db.store.get("schedules/s1").competitions[0].weather.date, "2026-06-08");
  });

  test("a null (miss) leaves existing weather intact", async () => {
    const db = fakeDb({
      "game-settings/season": SEASON,
      "schedules/s1": {
        competitions: [
          {
            id: "a",
            day: 8,
            location: "Dubuque, Iowa",
            date: "2026-06-08",
            weather: { summary: "overcast, 55°F", tempF: 55, code: 3, hour: 20, date: "2026-06-08" },
          },
        ],
      },
    });
    const miss = async () => null;
    const res = await enrichScheduleWeatherLogic(db, { getShowtimeWeather: miss, now: NOW });
    assert.equal(res.updated, 0);
    assert.equal(db.store.get("schedules/s1").competitions[0].weather.summary, "overcast, 55°F");
  });

  test("no active season → no-op", async () => {
    const db = fakeDb({});
    const res = await enrichScheduleWeatherLogic(db, { getShowtimeWeather: weatherOk, now: NOW });
    assert.deepEqual(res, { updated: 0, looked: 0, total: 0, seasonId: null });
  });
});
