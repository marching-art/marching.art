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
  test("materializes every upcoming show with a field, slotted worst-to-best", async () => {
    const db = fakeDb(seedWith());
    const res = await enrichScheduleRunningOrdersLogic(db, { now: NOW });

    // Show A and the far show are both upcoming (whole-season window); only Show A
    // has a field, so only it is written. Past + championship are skipped.
    assert.equal(res.built, 2, "Show A + far are processed; past & champ skipped");
    assert.equal(res.updated, 1, "only Show A has a field to write");
    assert.equal(db.writes.length, 1);

    const comps = db.store.get("schedules/s1").competitions;
    const byId = Object.fromEntries(comps.map((c) => [c.id, c]));

    // Worst (60) performs first, best (92) headlines last.
    assert.deepEqual(byId.a.fantasySchedule.lineup.map((e) => e.corps), ["Cadets", "Crossmen", "Bluecoats"]);
    assert.equal(byId.a.fantasySchedule.fieldSize, 3);
    assert.ok(byId.a.fantasySchedule.scoresAt, "has a scores-read instant");
    assert.equal(byId.a.fantasySchedule.lineup[2].uid, "u2");

    // No field / skipped comps carry no fantasySchedule (empty writes are guarded).
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

  test("a show with no registrations and no prior schedule writes nothing (no churn)", async () => {
    const seed = seedWith();
    delete seed[paths.showRegistrationEvent("s1", regKeyA)];
    const db = fakeDb(seed);
    const res = await enrichScheduleRunningOrdersLogic(db, { now: NOW });
    assert.equal(res.built, 2); // Show A + far both processed, both empty
    assert.equal(res.updated, 0); // nothing written — the roster covers "who's in"
    const a = db.store.get("schedules/s1").competitions.find((c) => c.id === "a");
    assert.equal(a.fantasySchedule, undefined);
  });

  test("clears a fantasySchedule when its field empties out", async () => {
    const seed = seedWith();
    // Show A already has a materialized schedule, but its registrations are gone.
    delete seed[paths.showRegistrationEvent("s1", regKeyA)];
    seed["schedules/s1"].competitions.find((c) => c.id === "a").fantasySchedule = {
      fieldSize: 3,
      lineup: [{ order: 1, uid: "u1", corps: "Cadets" }],
      overflow: [],
      intervalMin: 17,
      scoresAt: "2026-06-18T21:00:00Z",
    };
    const db = fakeDb(seed);
    await enrichScheduleRunningOrdersLogic(db, { now: NOW });
    const a = db.store.get("schedules/s1").competitions.find((c) => c.id === "a");
    assert.equal(a.fantasySchedule.fieldSize, 0);
    assert.deepEqual(a.fantasySchedule.lineup, []);
  });

  test("no active season → no-op", async () => {
    const db = fakeDb({});
    const res = await enrichScheduleRunningOrdersLogic(db, { now: NOW });
    assert.deepEqual(res, { updated: 0, built: 0, total: 0, seasonId: null });
  });

  test("builds the podium running order alongside the fantasy one", async () => {
    const db = fakeDb(seedWith());
    // Two podium corps picked Show A on its day (18); ordered by recent form.
    const podiumEntries = [
      {
        uid: "p1",
        state: {
          seasonUid: "s1",
          corpsName: "Vanguard Podium",
          lastTotal: 70,
          selectedShows: { 18: { eventName: "Show A" } },
        },
      },
      {
        uid: "p2",
        state: {
          seasonUid: "s1",
          corpsName: "Bluecoats Podium",
          lastTotal: 95,
          selectedShows: { 18: { eventName: "Show A" } },
        },
      },
    ];
    const res = await enrichScheduleRunningOrdersLogic(db, {
      now: NOW,
      podiumEnabled: true,
      loadPodiumEntries: async () => podiumEntries,
    });
    assert.ok(res.updated >= 1);

    const a = db.store.get("schedules/s1").competitions.find((c) => c.id === "a");
    assert.ok(a.podiumSchedule, "Show A has a podium schedule");
    assert.equal(a.podiumSchedule.fieldSize, 2);
    // Worst (70) first, best (95) headlines.
    assert.deepEqual(a.podiumSchedule.lineup.map((e) => e.corps), [
      "Vanguard Podium",
      "Bluecoats Podium",
    ]);
    assert.equal(a.podiumSchedule.lineup[0].corpsClass, "podiumClass");
    // Fantasy schedule is still built independently.
    assert.equal(a.fantasySchedule.fieldSize, 3);
  });

  test("seats the whole podium roster at a regional major (auto-attended, no picks)", async () => {
    // The Southwestern Championship on day 28 — 13 days out, eventTier stamped.
    const major = {
      id: "sw",
      name: "marching.art Southwestern Championship",
      day: 28,
      week: 4,
      location: "San Antonio, TX",
      eventTier: "regional",
      date: "2026-06-28",
    };
    const db = fakeDb(seedWith([major]));
    const podiumEntries = [
      { uid: "p1", state: { seasonUid: "s1", corpsName: "Vanguard Podium", division: "worldClass", lastTotal: 70, selectedShows: {} } },
      { uid: "p2", state: { seasonUid: "s1", corpsName: "Bluecoats Podium", division: "aClass", lastTotal: 95, selectedShows: {} } },
      // Last season's corps — on the roster read, but never this season's field.
      { uid: "old", state: { seasonUid: "s0", corpsName: "Stale Podium", division: "worldClass", lastTotal: 99 } },
    ];
    await enrichScheduleRunningOrdersLogic(db, {
      now: NOW,
      podiumEnabled: true,
      loadPodiumEntries: async () => podiumEntries,
    });
    const sw = db.store.get("schedules/s1").competitions.find((c) => c.id === "sw");
    assert.ok(sw.podiumSchedule, "the major has a podium running order");
    assert.deepEqual(sw.podiumSchedule.lineup.map((e) => e.corps), [
      "Vanguard Podium",
      "Bluecoats Podium",
    ]);
  });

  test("builds the podium field for a championship round while fantasy keeps heritage", async () => {
    const db = fakeDb(seedWith());
    const podiumEntries = [
      { uid: "w", state: { seasonUid: "s1", corpsName: "World Podium", division: "worldClass", lastTotal: 90, selectedShows: {} } },
      { uid: "a", state: { seasonUid: "s1", corpsName: "A Podium", division: "aClass", lastTotal: 60, selectedShows: {} } },
    ];
    await enrichScheduleRunningOrdersLogic(db, {
      now: NOW,
      podiumEnabled: true,
      loadPodiumEntries: async () => podiumEntries,
    });
    const champ = db.store.get("schedules/s1").competitions.find((c) => c.id === "champ");
    assert.equal(champ.fantasySchedule, undefined, "fantasy championship stays synthesized");
    assert.ok(champ.podiumSchedule, "podium championship field is real");
    // Day 49 is World Finals: every division reaches the World rounds.
    assert.deepEqual(champ.podiumSchedule.lineup.map((e) => e.corps), ["A Podium", "World Podium"]);
  });

  test("an advancement round seats only the prior round's cut", async () => {
    const seed = seedWith();
    // Day-48 Semifinals recap: only "w" made the top-12 cut into Finals (day 49).
    seed["podium-recaps/s1/days/48"] = {
      shows: [
        {
          eventName: "marching.art World Championship Semifinals",
          results: [
            { uid: "w", division: "worldClass", totalScore: 90 },
            { uid: "a", division: "aClass", totalScore: 60 },
          ],
        },
      ],
    };
    const db = fakeDb(seed);
    const podiumEntries = [
      { uid: "w", state: { seasonUid: "s1", corpsName: "World Podium", division: "worldClass", lastTotal: 90, selectedShows: {} } },
      { uid: "a", state: { seasonUid: "s1", corpsName: "A Podium", division: "aClass", lastTotal: 60, selectedShows: {} } },
    ];
    // Shrink the finals cut to 1 so the fixture proves the gate.
    const podiumStore = require("../helpers/podium/store");
    const saved = podiumStore.balance.championship.advancement.worldFinals;
    podiumStore.balance.championship.advancement.worldFinals = 1;
    try {
      await enrichScheduleRunningOrdersLogic(db, {
        now: NOW,
        podiumEnabled: true,
        loadPodiumEntries: async () => podiumEntries,
      });
    } finally {
      podiumStore.balance.championship.advancement.worldFinals = saved;
    }
    const champ = db.store.get("schedules/s1").competitions.find((c) => c.id === "champ");
    assert.deepEqual(champ.podiumSchedule.lineup.map((e) => e.corps), ["World Podium"]);
  });

  test("assigns the podium encore to the closest-home podium corps", async () => {
    const db = fakeDb(seedWith());
    // Show A is in Allentown, PA. Give two podium corps homes: one next door
    // (Bethlehem, PA) and one far (Akron, OH). Nearest wins the podium encore.
    const podiumEntries = [
      {
        uid: "p1",
        state: {
          seasonUid: "s1",
          corpsName: "Near Podium",
          lastTotal: 80,
          home: { venueId: "bethlehem-pa", lat: 40.63, lng: -75.37 },
          selectedShows: { 18: { eventName: "Show A" } },
        },
      },
      {
        uid: "p2",
        state: {
          seasonUid: "s1",
          corpsName: "Far Podium",
          lastTotal: 90,
          home: { venueId: "akron-oh", lat: 41.08, lng: -81.52 },
          selectedShows: { 18: { eventName: "Show A" } },
        },
      },
    ];
    await enrichScheduleRunningOrdersLogic(db, {
      now: NOW,
      podiumEnabled: true,
      loadPodiumEntries: async () => podiumEntries,
    });
    const a = db.store.get("schedules/s1").competitions.find((c) => c.id === "a");
    assert.ok(a.podiumEncore, "Show A has a podium encore");
    assert.equal(a.podiumEncore.corps, "Near Podium");
    assert.equal(a.podiumEncore.reason, "proximity");
    assert.equal(a.podiumEncore.corpsClass, "podiumClass");
    // Independent of the fantasy encore (the fantasy field carries no homes here).
    assert.ok(!a.encore);
  });

  test("podium encore honors the host default at a hosted show", async () => {
    const seed = seedWith([
      {
        id: "phost",
        name: "Podium Host Show",
        day: 20,
        week: 3,
        location: "Allentown, PA",
        date: "2026-06-20",
        eventTier: "hosted",
        hostUid: "p2", // the farther-home corps hosts
      },
    ]);
    const db = fakeDb(seed);
    const podiumEntries = [
      {
        uid: "p1",
        state: {
          seasonUid: "s1",
          corpsName: "Near Podium",
          lastTotal: 80,
          home: { venueId: "bethlehem-pa", lat: 40.63, lng: -75.37 },
          selectedShows: { 20: { eventName: "Podium Host Show" } },
        },
      },
      {
        uid: "p2",
        state: {
          seasonUid: "s1",
          corpsName: "Host Podium",
          lastTotal: 90,
          home: { venueId: "akron-oh", lat: 41.08, lng: -81.52 },
          selectedShows: { 20: { eventName: "Podium Host Show" } },
        },
      },
    ];
    await enrichScheduleRunningOrdersLogic(db, {
      now: NOW,
      podiumEnabled: true,
      loadPodiumEntries: async () => podiumEntries,
    });
    const hosted = db.store.get("schedules/s1").competitions.find((c) => c.id === "phost");
    assert.equal(hosted.podiumEncore.corps, "Host Podium"); // host wins over proximity
    assert.equal(hosted.podiumEncore.reason, "host");
  });

  test("assigns the encore to the closest-home registered corps", async () => {
    const seed = seedWith();
    // Give the field homes: Bethlehem is next to the Allentown, PA venue.
    seed[paths.showRegistrationEvent("s1", regKeyA)].registrations = {
      u1_worldClass: {
        uid: "u1",
        corpsClass: "worldClass",
        corpsName: "Cadets",
        homeGeo: { lat: 40.63, lng: -75.37, venueId: "bethlehem-pa" }, // ~near Allentown
      },
      u2_worldClass: {
        uid: "u2",
        corpsClass: "worldClass",
        corpsName: "Bluecoats",
        homeGeo: { lat: 41.08, lng: -81.52, venueId: "akron-oh" }, // far (OH)
      },
    };
    const db = fakeDb(seed);
    await enrichScheduleRunningOrdersLogic(db, { now: NOW });
    const a = db.store.get("schedules/s1").competitions.find((c) => c.id === "a");
    assert.ok(a.encore, "Show A has an encore");
    assert.equal(a.encore.corps, "Cadets");
    assert.equal(a.encore.reason, "proximity");
  });

  test("host corps gets the encore at its own hosted show", async () => {
    const seed = seedWith([
      {
        id: "hosted",
        name: "Bob's Classic",
        day: 17,
        week: 3,
        location: "Allentown, PA",
        date: "2026-06-17",
        eventTier: "hosted",
        hostUid: "u2",
      },
    ]);
    const hostedKey = showRegistrationEventKey(3, "Bob's Classic", "2026-06-17");
    seed[paths.showRegistrationEvent("s1", hostedKey)] = {
      week: 3,
      eventName: "Bob's Classic",
      date: "2026-06-17",
      registrations: {
        u1_worldClass: {
          uid: "u1",
          corpsClass: "worldClass",
          corpsName: "Cadets",
          homeGeo: { lat: 40.6, lng: -75.4, venueId: "bethlehem-pa" }, // closer
        },
        u2_worldClass: {
          uid: "u2",
          corpsClass: "worldClass",
          corpsName: "Bluecoats",
          homeGeo: { lat: 41.08, lng: -81.52, venueId: "akron-oh" }, // farther, but host
        },
      },
    };
    const db = fakeDb(seed);
    await enrichScheduleRunningOrdersLogic(db, { now: NOW });
    const hosted = db.store.get("schedules/s1").competitions.find((c) => c.id === "hosted");
    assert.equal(hosted.encore.corps, "Bluecoats"); // host wins over proximity
    assert.equal(hosted.encore.reason, "host");
  });

  test("no podium schedule when the feature is off", async () => {
    const db = fakeDb(seedWith());
    await enrichScheduleRunningOrdersLogic(db, {
      now: NOW,
      podiumEnabled: false,
      loadPodiumEntries: async () => [{ uid: 'p1', state: {} }],
    });
    const a = db.store.get("schedules/s1").competitions.find((c) => c.id === "a");
    assert.equal(a.podiumSchedule, undefined);
  });
});

describe("two-night event (Eastern Classic) fantasy field", () => {
  // Days 41/42 (week 6), 26-27 days out from NOW. The registration index
  // holds ONE event under night one's date (showSelection stores the first
  // night's entry), with every registrant.
  const NIGHT_1 = {
    id: "ec1", name: "marching.art Eastern Classic", day: 41, week: 6,
    location: "Allentown, PA", date: "2026-07-11", eventTier: "regional",
    multiNight: { nights: [41, 42] },
  };
  const NIGHT_2 = { ...NIGHT_1, id: "ec2", day: 42, date: "2026-07-12" };
  const ecKey = showRegistrationEventKey(6, NIGHT_1.name, NIGHT_1.date);
  const ecRegs = {
    u1_worldClass: { uid: "u1", corpsClass: "worldClass", corpsName: "Cadets" },
    u2_worldClass: { uid: "u2", corpsClass: "worldClass", corpsName: "Bluecoats" },
    u3_worldClass: { uid: "u3", corpsClass: "worldClass", corpsName: "Crossmen" },
    u4_worldClass: { uid: "u4", corpsClass: "worldClass", corpsName: "Mandarins" },
  };
  const uidsOf = (sched) => (sched ? sched.lineup.map((e) => e.uid).sort() : []);

  test("each corps marches exactly one night — never the whole field on both", async () => {
    const seed = seedWith([NIGHT_1, NIGHT_2]);
    seed[paths.showRegistrationEvent("s1", ecKey)] = {
      week: 6, eventName: NIGHT_1.name, date: NIGHT_1.date, registrations: ecRegs,
    };
    const db = fakeDb(seed);
    await enrichScheduleRunningOrdersLogic(db, { now: NOW, podiumEnabled: false });
    const comps = db.store.get("schedules/s1").competitions;
    const n1 = comps.find((c) => c.id === "ec1").fantasySchedule;
    const n2 = comps.find((c) => c.id === "ec2").fantasySchedule;
    assert.ok(n1 && n2, "both nights materialized from the single registration doc");
    assert.equal(n1.fieldSize + n2.fieldSize, 4);
    assert.equal(n1.fieldSize, 2);
    assert.deepEqual([...uidsOf(n1), ...uidsOf(n2)].sort(), ["u1", "u2", "u3", "u4"]);
    assert.deepEqual(n1.night, { day: 41, nights: [41, 42], status: "provisional" });
    assert.deepEqual(n2.night, { day: 42, nights: [41, 42], status: "provisional" });
  });

  test("the published split seats the nights exactly as announced", async () => {
    const seed = seedWith([NIGHT_1, NIGHT_2]);
    seed[paths.showRegistrationEvent("s1", ecKey)] = {
      week: 6, eventName: NIGHT_1.name, date: NIGHT_1.date, registrations: ecRegs,
    };
    seed["eastern-classic/s1"] = {
      nights: [41, 42],
      preview: {
        assignments: {
          41: [{ key: "u1_worldClass", uid: "u1", corpsClass: "worldClass" }],
          42: [
            { key: "u2_worldClass", uid: "u2", corpsClass: "worldClass" },
            { key: "u3_worldClass", uid: "u3", corpsClass: "worldClass" },
            { key: "u4_worldClass", uid: "u4", corpsClass: "worldClass" },
          ],
        },
      },
    };
    const db = fakeDb(seed);
    await enrichScheduleRunningOrdersLogic(db, { now: NOW, podiumEnabled: false });
    const comps = db.store.get("schedules/s1").competitions;
    const n1 = comps.find((c) => c.id === "ec1").fantasySchedule;
    const n2 = comps.find((c) => c.id === "ec2").fantasySchedule;
    assert.deepEqual(uidsOf(n1), ["u1"]);
    assert.deepEqual(uidsOf(n2), ["u2", "u3", "u4"]);
    assert.equal(n1.night.status, "preview");

    // Locking the final split (same seats) flips the label without moving anyone.
    seed["eastern-classic/s1"].final = seed["eastern-classic/s1"].preview;
    const again = await enrichScheduleRunningOrdersLogic(db, { now: NOW, podiumEnabled: false });
    assert.ok(again.updated >= 1, "a status change alone rewrites the show");
    assert.equal(db.store.get("schedules/s1").competitions.find((c) => c.id === "ec1").fantasySchedule.night.status, "final");
  });
});
