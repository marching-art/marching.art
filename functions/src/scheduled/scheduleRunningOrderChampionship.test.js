// Championship-week fantasy field tests for the running-order producer: the
// auto-enrolled rounds come from the registration index (the standings stand
// in until the nightly rebuild has folded them in), an advancement round is
// narrowed to the prior night's cut by the scorer's own buildChampionshipConfig,
// and the `advancement` stamp says whether that cut is decided. Same fakes as
// scheduleRunningOrder.test.js (scheduleRunningOrder.fixtures.js).

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { enrichScheduleRunningOrdersLogic, applyChampionshipCut } = require("./scheduleRunningOrder");
const { paths } = require("../helpers/paths");
const { showRegistrationEventKey } = require("../helpers/showRegistrations");
const { fakeDb, NOW, seedWith, regKeyA } = require("./scheduleRunningOrder.fixtures");

describe("championship week fantasy field", () => {
  const FINALS = "marching.art World Championship Finals";
  const finalsKey = showRegistrationEventKey(7, FINALS, null);

  /** A day-48 Semifinals recap where only u2 and u3 make the top-12 cut. */
  function semisRecap() {
    const fillers = Array.from({ length: 10 }, (_, i) => ({
      uid: `f${i}`,
      corpsClass: "worldClass",
      corpsName: `Filler ${i}`,
      totalScore: 90 - i, // 90..81
    }));
    return {
      offSeasonDay: 48,
      shows: [
        {
          eventName: "marching.art World Championship Semifinals",
          results: [
            ...fillers,
            { uid: "u2", corpsClass: "worldClass", corpsName: "Bluecoats", totalScore: 92 },
            { uid: "u3", corpsClass: "worldClass", corpsName: "Crossmen", totalScore: 78 }, // 12th
            { uid: "u1", corpsClass: "worldClass", corpsName: "Cadets", totalScore: 60 }, // 13th: cut
          ],
        },
      ],
    };
  }

  test("the registration index (auto-enrolled rounds) wins over the standings stand-in", async () => {
    const seed = seedWith();
    // The nightly rebuild has folded the round in: an Open Class corps that has
    // never scored (absent from the standings) is still in the field.
    seed[paths.showRegistrationEvent("s1", finalsKey)] = {
      week: 7,
      eventName: FINALS,
      date: null,
      registrations: {
        u2_worldClass: { uid: "u2", corpsClass: "worldClass", corpsName: "Bluecoats", auto: true },
        u9_openClass: { uid: "u9", corpsClass: "openClass", corpsName: "Rookie Open", auto: true },
        // A SoundSport corps can never be on the World Finals doc, but a stale
        // entry must not leak into the field either.
        u8_soundSport: { uid: "u8", corpsClass: "soundSport", corpsName: "Stray SS", auto: true },
      },
    };
    const db = fakeDb(seed);
    await enrichScheduleRunningOrdersLogic(db, { now: NOW });
    const champ = db.store.get("schedules/s1").competitions.find((c) => c.id === "champ");
    assert.deepEqual(champ.fantasySchedule.lineup.map((e) => e.corps), ["Rookie Open", "Bluecoats"]);
    assert.equal(champ.fantasySchedule.advancement.status, "pending");
  });

  test("an advancement round seats only the prior night's fantasy cut, marked final", async () => {
    const seed = seedWith();
    seed["fantasy_recaps/s1/days/48"] = semisRecap();
    const db = fakeDb(seed);
    await enrichScheduleRunningOrdersLogic(db, { now: NOW });
    const champ = db.store.get("schedules/s1").competitions.find((c) => c.id === "champ");
    // Cadets (13th at Semis) misses; survivors still march worst-to-best.
    assert.deepEqual(champ.fantasySchedule.lineup.map((e) => e.corps), ["Crossmen", "Bluecoats"]);
    assert.deepEqual(champ.fantasySchedule.advancement, {
      fromDay: 48,
      rule: "Top 12 from Semifinals",
      status: "final",
    });
  });

  test("a pending → final cut rewrites even when the lineup is unchanged", async () => {
    const seed = seedWith();
    const db = fakeDb(seed);
    await enrichScheduleRunningOrdersLogic(db, { now: NOW });
    const writesBefore = db.writes.length;
    // Every corps survives this cut (fewer than 12 at Semis), so the lineup is
    // the same three — but the field is now decided, and the stamp must flip.
    db.store.set("fantasy_recaps/s1/days/48", {
      offSeasonDay: 48,
      shows: [
        {
          eventName: "marching.art World Championship Semifinals",
          results: [
            { uid: "u1", corpsClass: "worldClass", totalScore: 60 },
            { uid: "u2", corpsClass: "worldClass", totalScore: 92 },
            { uid: "u3", corpsClass: "worldClass", totalScore: 78 },
          ],
        },
      ],
    });
    const res = await enrichScheduleRunningOrdersLogic(db, { now: NOW });
    assert.ok(res.updated >= 1);
    assert.equal(db.writes.length, writesBefore + 1);
    const champ = db.store.get("schedules/s1").competitions.find((c) => c.id === "champ");
    assert.equal(champ.fantasySchedule.advancement.status, "final");
    assert.equal(champ.fantasySchedule.fieldSize, 3);
  });

  test("Open & A Class Finals cuts each class on its own Prelims standing", async () => {
    const OA_FINALS = "Open and A Class Finals";
    const comp = {
      id: "oa",
      name: OA_FINALS,
      type: "championship",
      mandatory: true,
      allowedClasses: ["openClass", "aClass"],
      day: 46,
      week: 7,
      location: "Marion, IN",
      date: null, // generated rounds carry no date: dated from season start + day
    };
    const seed = seedWith([comp]);
    const reg = (uid, corpsClass, corpsName) => ({ uid, corpsClass, corpsName, auto: true });
    seed[paths.showRegistrationEvent("s1", showRegistrationEventKey(7, OA_FINALS, null))] = {
      week: 7,
      eventName: OA_FINALS,
      date: null,
      registrations: {
        o1_openClass: reg("o1", "openClass", "Open One"),
        o2_openClass: reg("o2", "openClass", "Open Two"),
        a1_aClass: reg("a1", "aClass", "A One"),
        a2_aClass: reg("a2", "aClass", "A Two"),
        a3_aClass: reg("a3", "aClass", "A Three"),
        a4_aClass: reg("a4", "aClass", "A Four"),
        a5_aClass: reg("a5", "aClass", "A Five"),
      },
    };
    seed["fantasy_recaps/s1/days/45"] = {
      offSeasonDay: 45,
      shows: [
        {
          eventName: "Open and A Class Prelims",
          results: [
            { uid: "o1", corpsClass: "openClass", totalScore: 70 },
            { uid: "o2", corpsClass: "openClass", totalScore: 65 },
            { uid: "a1", corpsClass: "aClass", totalScore: 60 },
            { uid: "a2", corpsClass: "aClass", totalScore: 59 },
            { uid: "a3", corpsClass: "aClass", totalScore: 58 },
            { uid: "a4", corpsClass: "aClass", totalScore: 57 },
            { uid: "a5", corpsClass: "aClass", totalScore: 40 }, // 5th A Class: cut
          ],
        },
      ],
    };
    const db = fakeDb(seed);
    await enrichScheduleRunningOrdersLogic(db, { now: NOW });
    const oa = db.store.get("schedules/s1").competitions.find((c) => c.id === "oa");
    const names = oa.fantasySchedule.lineup.map((e) => e.corps);
    assert.equal(names.length, 6, "both Open corps + the top 4 A Class");
    assert.ok(!names.includes("A Five"));
    assert.deepEqual(oa.fantasySchedule.advancement, {
      fromDay: 45,
      rule: "Top 8 Open Class · Top 4 A Class",
      status: "final",
    });
  });

  test("the SoundSport festival is auto-enrolled from the index and never cut", async () => {
    const FEST = "SoundSport International Music & Food Festival";
    const comp = {
      id: "fest",
      name: FEST,
      type: "championship",
      mandatory: true,
      allowedClasses: ["soundSport"],
      day: 49,
      week: 7,
      location: "Indianapolis, IN",
      date: null,
    };
    const seed = seedWith([comp]);
    seed["fantasy_recaps/s1/days/48"] = semisRecap(); // a decided World Finals cut
    seed[paths.showRegistrationEvent("s1", showRegistrationEventKey(7, FEST, null))] = {
      week: 7,
      eventName: FEST,
      date: null,
      registrations: {
        s1_soundSport: { uid: "s1", corpsClass: "soundSport", corpsName: "SS One", auto: true },
        s2_soundSport: { uid: "s2", corpsClass: "soundSport", corpsName: "SS Two", auto: true },
      },
    };
    const db = fakeDb(seed);
    await enrichScheduleRunningOrdersLogic(db, { now: NOW });
    const fest = db.store.get("schedules/s1").competitions.find((c) => c.id === "fest");
    assert.equal(fest.fantasySchedule.fieldSize, 2);
    assert.equal(fest.fantasySchedule.advancement, undefined, "a festival has no cut");
    // The World Finals on the same day still carries its own cut.
    const champ = db.store.get("schedules/s1").competitions.find((c) => c.id === "champ");
    assert.equal(champ.fantasySchedule.advancement.status, "final");
  });

  test("a championship round with no eligible corps anywhere writes nothing", async () => {
    const seed = seedWith();
    delete seed["fantasy_standings/s1/classes/worldClass"];
    delete seed[paths.showRegistrationEvent("s1", regKeyA)];
    const db = fakeDb(seed);
    const res = await enrichScheduleRunningOrdersLogic(db, { now: NOW });
    assert.equal(res.updated, 0);
    const champ = db.store.get("schedules/s1").competitions.find((c) => c.id === "champ");
    assert.equal(champ.fantasySchedule, undefined);
  });
});

describe("applyChampionshipCut", () => {
  const comp = { name: "marching.art World Championship Finals", allowedClasses: ["worldClass", "openClass", "aClass"] };
  const field = [
    { uid: "w", corpsClass: "worldClass" },
    { uid: "o", corpsClass: "openClass" },
    { uid: "s", corpsClass: "soundSport" },
  ];

  test("with no cut, keeps the round's classes and drops the rest", () => {
    const out = applyChampionshipCut(comp, field, null);
    assert.deepEqual(out.registrations.map((r) => r.uid), ["w", "o"]);
    assert.equal(out.advancement, null);
  });

  test("a decided cut keeps only the survivors, matched by name", () => {
    const advancing = {
      fromDay: 48,
      rule: "Top 12 from Semifinals",
      byEvent: {
        [comp.name]: { participants: new Set(["o_openClass"]), classFilter: ["worldClass", "openClass", "aClass"] },
      },
    };
    const out = applyChampionshipCut(comp, field, advancing);
    assert.deepEqual(out.registrations.map((r) => r.uid), ["o"]);
    assert.equal(out.advancement.status, "final");
  });

  test("a renamed round still finds its cut by class shape", () => {
    const advancing = {
      fromDay: 48,
      rule: "Top 12 from Semifinals",
      byEvent: {
        "Some Rebranded Finals": { participants: new Set(["w_worldClass"]), classFilter: ["worldClass", "openClass", "aClass"] },
        "SoundSport Festival": { participants: null, classFilter: ["soundSport"] },
      },
    };
    const out = applyChampionshipCut(comp, field, advancing);
    assert.deepEqual(out.registrations.map((r) => r.uid), ["w"]);
  });

  test("display-form class names on the schedule entry are understood", () => {
    const out = applyChampionshipCut({ name: "x", allowedClasses: ["Open Class", "A Class"] }, field, null);
    assert.deepEqual(out.registrations.map((r) => r.uid), ["o"]);
  });
});
