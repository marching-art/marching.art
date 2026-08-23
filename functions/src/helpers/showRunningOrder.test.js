// Tests for the real-field running-order builder (Phase 2).
// Pure: no Firestore, no network — a fixed field + a metric lookup + a drop
// instant in, a running order with real ISO instants out.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  recentPerformance,
  buildShowRunningOrder,
  tzParts,
  CLASS_BAND,
} = require("./showRunningOrder");

const TZ = "America/New_York";
// 9:00 PM EDT on 2026-07-15 (the off-season drop), as an absolute instant.
const NINE_PM_ET = new Date("2026-07-16T01:00:00.000Z");

const reg = (uid, corpsClass, corpsName) => ({ uid, corpsClass, corpsName });

describe("recentPerformance", () => {
  test("averages the most recent scored nights", () => {
    const entry = { scores: [{ score: 90 }, { score: 80 }, { score: 70 }, { score: 10 }] };
    assert.equal(recentPerformance(entry, 3), 80); // (90+80+70)/3
  });
  test("falls back to latest total when no history array", () => {
    assert.equal(recentPerformance({ totalScore: 88 }), 88);
  });
  test("cold start (null / empty) is 0", () => {
    assert.equal(recentPerformance(null), 0);
    assert.equal(recentPerformance({ scores: [] }), 0);
  });
});

describe("buildShowRunningOrder — ordering & anchoring", () => {
  const registrations = [
    reg("u1", "worldClass", "Best Corps"),
    reg("u2", "worldClass", "Worst Corps"),
    reg("u3", "worldClass", "Mid Corps"),
  ];
  const standings = {
    u1_worldClass: { totalScore: 95, scores: [{ score: 95 }] },
    u2_worldClass: { totalScore: 60, scores: [{ score: 60 }] },
    u3_worldClass: { totalScore: 78, scores: [{ score: 78 }] },
  };
  const metricFor = (uid, cls) => standings[`${uid}_${cls}`] || null;

  test("orders worst-to-best; the top performer headlines (last)", () => {
    const r = buildShowRunningOrder({ registrations, metricFor, scoresDropAt: NINE_PM_ET, timezone: TZ });
    assert.deepEqual(r.lineup.map((e) => e.corps), ["Worst Corps", "Mid Corps", "Best Corps"]);
  });

  test("carries uid + corpsClass through each slot", () => {
    const r = buildShowRunningOrder({ registrations, metricFor, scoresDropAt: NINE_PM_ET, timezone: TZ });
    const last = r.lineup[r.lineup.length - 1];
    assert.equal(last.uid, "u1");
    assert.equal(last.corpsClass, "worldClass");
  });

  test("scores read exactly at the drop instant (same venue wall-clock)", () => {
    const r = buildShowRunningOrder({ registrations, metricFor, scoresDropAt: NINE_PM_ET, timezone: TZ });
    const got = tzParts(new Date(r.scoresAt), TZ);
    const want = tzParts(NINE_PM_ET, TZ);
    assert.equal(got.hour, want.hour);
    assert.equal(got.minute, want.minute);
  });

  test("every performer takes the field before scores read", () => {
    const r = buildShowRunningOrder({ registrations, metricFor, scoresDropAt: NINE_PM_ET, timezone: TZ });
    const scores = new Date(r.scoresAt).getTime();
    for (const e of r.lineup) assert.ok(new Date(e.performsAt).getTime() < scores);
    assert.ok(new Date(r.gatesAt).getTime() < new Date(r.startsAt).getTime());
  });
});

describe("buildShowRunningOrder — robustness", () => {
  test("duplicate / unnamed corps never collide (keyed by uid_class)", () => {
    const registrations = [
      reg("u1", "soundSport", "Unnamed Corps"),
      reg("u2", "soundSport", "Unnamed Corps"),
      reg("u3", "aClass", "Unnamed Corps"),
    ];
    const r = buildShowRunningOrder({ registrations, scoresDropAt: NINE_PM_ET, timezone: TZ });
    assert.equal(r.lineup.length, 3);
    assert.deepEqual(
      r.lineup.map((e) => `${e.uid}_${e.corpsClass}`).sort(),
      ["u1_soundSport", "u2_soundSport", "u3_aClass"]
    );
  });

  test("cold start: higher classes tend to headline when no one has scored", () => {
    const registrations = [
      reg("u1", "worldClass", "W"),
      reg("u2", "soundSport", "S"),
      reg("u3", "openClass", "O"),
      reg("u4", "aClass", "A"),
    ];
    const r = buildShowRunningOrder({ registrations, scoresDropAt: NINE_PM_ET, timezone: TZ });
    // Bands ascend soundSport < aClass < openClass < worldClass -> that order.
    assert.deepEqual(r.lineup.map((e) => e.corps), ["S", "A", "O", "W"]);
    assert.ok(CLASS_BAND.worldClass > CLASS_BAND.soundSport);
  });

  test("real scores override the class band", () => {
    const registrations = [reg("u1", "worldClass", "W"), reg("u2", "soundSport", "S")];
    // SoundSport corps is outscoring the World corps -> it headlines despite band.
    const metricFor = (uid) => (uid === "u2" ? { totalScore: 99 } : { totalScore: 40 });
    const r = buildShowRunningOrder({ registrations, metricFor, scoresDropAt: NINE_PM_ET, timezone: TZ });
    assert.equal(r.lineup[r.lineup.length - 1].corps, "S");
  });

  test("empty field: no lineup, null times, no throw", () => {
    const r = buildShowRunningOrder({ registrations: [], scoresDropAt: NINE_PM_ET, timezone: TZ });
    assert.deepEqual(r.lineup, []);
    assert.equal(r.startsAt, null);
    assert.equal(r.scoresAt, null);
    assert.equal(r.fieldSize, 0);
  });

  test("overflow safety valve: a pathological field keeps the best, overflows the worst", () => {
    const registrations = Array.from({ length: 120 }, (_, i) => reg(`u${i}`, "worldClass", `C${i}`));
    const metricFor = (uid) => ({ totalScore: Number(uid.slice(1)) }); // u0 worst ... u119 best
    const r = buildShowRunningOrder({
      registrations,
      metricFor,
      scoresDropAt: NINE_PM_ET,
      timezone: TZ,
      fitOpts: { windowMinutes: 120, minIntervalMin: 5 },
    });
    assert.ok(r.overflow.length > 0);
    assert.equal(r.lineup.length + r.overflow.length, 120);
    // The kept field is the top performers; the overflow is the bottom.
    const keptUids = new Set(r.lineup.map((e) => e.uid));
    assert.ok(keptUids.has("u119"), "best performer must be kept");
    assert.ok(r.overflow.some((o) => o.uid === "u0"), "worst performer must overflow");
  });

  test("resolves timezone from location when not given", () => {
    const r = buildShowRunningOrder({
      registrations: [reg("u1", "worldClass", "W")],
      scoresDropAt: NINE_PM_ET,
      location: "Allentown, PA",
    });
    assert.ok(typeof r.timezone === "string" && r.timezone.length > 0);
  });
});
