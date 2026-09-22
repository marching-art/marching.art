// Shared fixtures for the running-order producer tests: an in-memory fake
// Firestore seeded through the same path/key helpers the producer reads, and
// a season with one regular show, one past show, one far-out show and the
// World Championship Finals. Not a test file (no `.test.js`), so node --test
// never runs it directly.

const { paths } = require("../helpers/paths");
const { showRegistrationEventKey } = require("../helpers/showRegistrations");

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
const SEASON = {
  seasonUid: "s1",
  status: "off-season",
  schedule: { startDate: new Date("2026-06-01T00:00:00Z") },
};

// A regular upcoming show, 3 days out (day 18 → week 3).
const SHOW_A = { id: "a", name: "Show A", day: 18, week: 3, location: "Allentown, PA", date: "2026-06-18" };
const regKeyA = showRegistrationEventKey(SHOW_A.week, SHOW_A.name, SHOW_A.date);

function seedWith(extraComps = []) {
  return {
    "game-settings/season": SEASON,
    "schedules/s1": {
      competitions: [
        // A copy: one test stamps a stale fantasySchedule onto its Show A, and
        // the shared fixture must not carry that into the next test's seed.
        { ...SHOW_A },
        { id: "past", name: "Old Show", day: 8, week: 2, location: "Dubuque, IA", date: "2026-06-08" },
        { id: "far", name: "Far Show", day: 60, week: 9, location: "Denver, CO", date: "2026-07-30" },
        {
          id: "champ",
          name: "marching.art World Championship Finals",
          type: "championship",
          mandatory: true,
          allowedClasses: ["worldClass", "openClass", "aClass"],
          day: 49,
          week: 7,
          location: "Indianapolis, IN",
          // Generated rounds carry no date: dated from season start + day (July 19),
          // after every regular fixture show, as in a real season.
          date: null,
        },
        ...extraComps,
      ],
    },
    "fantasy_standings/s1/classes/worldClass": {
      entries: [
        { uid: "u1", corpsClass: "worldClass", corpsName: "Cadets", totalScore: 60, scores: [{ score: 60 }] },
        { uid: "u2", corpsClass: "worldClass", corpsName: "Bluecoats", totalScore: 92, scores: [{ score: 92 }] },
        { uid: "u3", corpsClass: "worldClass", corpsName: "Crossmen", totalScore: 78, scores: [{ score: 78 }] },
      ],
    },
    [paths.showRegistrationEvent("s1", regKeyA)]: {
      week: SHOW_A.week,
      eventName: SHOW_A.name,
      date: SHOW_A.date,
      registrations: {
        u1_worldClass: { uid: "u1", corpsClass: "worldClass", corpsName: "Cadets" },
        u2_worldClass: { uid: "u2", corpsClass: "worldClass", corpsName: "Bluecoats" },
        u3_worldClass: { uid: "u3", corpsClass: "worldClass", corpsName: "Crossmen" },
      },
    },
  };
}

module.exports = { fakeDb, NOW, SEASON, SHOW_A, regKeyA, seedWith };
