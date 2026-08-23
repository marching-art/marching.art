// Tests for the running-order producer logic. No network, no real Firestore: db
// is an in-memory fake seeded through the same path/key helpers the producer
// reads, and the real (pure) builder runs. Exercises the window gate,
// championship skip, worst-to-best ordering from standings, and
// write-only-when-changed.

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  enrichScheduleRunningOrdersLogic,
  competitionDate,
  isChampionship,
} = require("./scheduleRunningOrder");
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
        SHOW_A,
        { id: "past", name: "Old Show", day: 8, week: 2, location: "Dubuque, IA", date: "2026-06-08" },
        { id: "far", name: "Far Show", day: 60, week: 9, location: "Denver, CO", date: "2026-07-30" },
        { id: "champ", name: "World Championship Finals", type: "championship", day: 49, week: 7, date: "2026-06-19" },
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

describe("isChampionship / competitionDate", () => {
  test("championship events are recognized by type or mandatory", () => {
    assert.ok(isChampionship({ type: "championship" }));
    assert.ok(isChampionship({ mandatory: true }));
    assert.ok(!isChampionship({ type: "regional" }));
  });
  test("competitionDate derives from season start + day when no explicit date", () => {
    assert.equal(competitionDate({ day: 3 }, new Date("2026-06-01T00:00:00Z")).getUTCDate(), 3);
  });
});

describe("enrichScheduleRunningOrdersLogic", () => {
  test("materializes only the in-window regular show, slotted worst-to-best", async () => {
    const db = fakeDb(seedWith());
    const res = await enrichScheduleRunningOrdersLogic(db, { now: NOW });

    assert.equal(res.built, 1, "only Show A is in-window and non-championship");
    assert.equal(res.updated, 1);
    assert.equal(db.writes.length, 1);

    const comps = db.store.get("schedules/s1").competitions;
    const byId = Object.fromEntries(comps.map((c) => [c.id, c]));

    // Worst (60) performs first, best (92) headlines last.
    assert.deepEqual(byId.a.fantasySchedule.lineup.map((e) => e.corps), ["Cadets", "Crossmen", "Bluecoats"]);
    assert.equal(byId.a.fantasySchedule.fieldSize, 3);
    assert.ok(byId.a.fantasySchedule.scoresAt, "has a scores-read instant");
    assert.equal(byId.a.fantasySchedule.lineup[2].uid, "u2");

    // Skipped comps carry no fantasySchedule.
    assert.equal(byId.past.fantasySchedule, undefined);
    assert.equal(byId.far.fantasySchedule, undefined);
    assert.equal(byId.champ.fantasySchedule, undefined);
  });

  test("second pass is idempotent — no write when nothing changed", async () => {
    const db = fakeDb(seedWith());
    await enrichScheduleRunningOrdersLogic(db, { now: NOW });
    const writesAfterFirst = db.writes.length;
    const res = await enrichScheduleRunningOrdersLogic(db, { now: NOW });
    assert.equal(res.updated, 0);
    assert.equal(db.writes.length, writesAfterFirst, "no second write");
  });

  test("a show with no registrations records an empty field, not a throw", async () => {
    const seed = seedWith();
    delete seed[paths.showRegistrationEvent("s1", regKeyA)];
    const db = fakeDb(seed);
    const res = await enrichScheduleRunningOrdersLogic(db, { now: NOW });
    assert.equal(res.built, 1);
    const a = db.store.get("schedules/s1").competitions.find((c) => c.id === "a");
    assert.equal(a.fantasySchedule.fieldSize, 0);
    assert.deepEqual(a.fantasySchedule.lineup, []);
  });

  test("no active season → no-op", async () => {
    const db = fakeDb({});
    const res = await enrichScheduleRunningOrdersLogic(db, { now: NOW });
    assert.deepEqual(res, { updated: 0, built: 0, total: 0, seasonId: null });
  });
});
