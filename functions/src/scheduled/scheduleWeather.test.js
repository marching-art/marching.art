// Tests for the schedule-weather producer logic. No network and no real
// Firestore: db is an in-memory fake and the weather lookup is injected, so this
// exercises date resolution, the forecast-horizon gate, change detection, and the
// write-only-when-changed behaviour deterministically.

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  enrichScheduleWeatherLogic,
  competitionDate,
  coerceDate,
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

describe("coerceDate / competitionDate", () => {
  test("coerceDate handles Timestamp, Date, and ISO", () => {
    assert.equal(coerceDate({ toDate: () => new Date("2026-06-10") }).getUTCFullYear(), 2026);
    assert.equal(coerceDate(new Date("2026-06-10")).getUTCMonth(), 5);
    assert.equal(coerceDate("2026-06-10").getUTCDate(), 10);
    assert.equal(coerceDate(null), null);
  });
  test("competitionDate prefers explicit date, else derives from season start + day", () => {
    assert.equal(competitionDate({ date: "2026-07-04" }, new Date("2026-06-01")).getUTCDate(), 4);
    // day 3 → start + 2 days
    const derived = competitionDate({ day: 3 }, new Date("2026-06-01T00:00:00Z"));
    assert.equal(derived.getUTCDate(), 3);
    assert.equal(competitionDate({}, null), null);
  });
});

describe("enrichScheduleWeatherLogic", () => {
  const weatherOk = async () => ({ summary: "clear skies, 61°F", tempF: 61, code: 0 });

  test("fills weather on eligible comps and writes once", async () => {
    const db = fakeDb({
      "game-settings/season": SEASON,
      "schedules/s1": {
        competitions: [
          { id: "a", day: 8, location: "Dubuque, Iowa", date: "2026-06-08" }, // past
          { id: "b", day: 15, location: "Allentown, PA", date: "2026-06-15" }, // today
          { id: "c", day: 40, location: "Indianapolis, IN", date: "2026-07-25" }, // beyond horizon → skip
          { id: "d", day: 9, location: "", date: "2026-06-09" }, // no location → skip
        ],
      },
    });
    const res = await enrichScheduleWeatherLogic(db, { getShowtimeWeather: weatherOk, now: NOW });
    assert.equal(res.looked, 2); // a and b only
    assert.equal(res.updated, 2);
    assert.equal(res.total, 4);

    const comps = db.store.get("schedules/s1").competitions;
    const byId = Object.fromEntries(comps.map((c) => [c.id, c]));
    assert.equal(byId.a.weather.summary, "clear skies, 61°F");
    assert.equal(byId.a.weather.hour, 20);
    assert.equal(byId.b.weather.tempF, 61);
    assert.equal(byId.c.weather, undefined); // beyond horizon
    assert.equal(byId.d.weather, undefined); // no location
    assert.equal(db.writes.length, 1); // one merge write
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
            weather: { summary: "clear skies, 61°F", tempF: 61, code: 0, hour: 20 },
          },
        ],
      },
    });
    const res = await enrichScheduleWeatherLogic(db, { getShowtimeWeather: weatherOk, now: NOW });
    assert.equal(res.looked, 1);
    assert.equal(res.updated, 0);
    assert.equal(db.writes.length, 0);
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
            weather: { summary: "overcast, 55°F", tempF: 55, code: 3, hour: 20 },
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
