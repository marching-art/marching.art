// Tests for regionalTierForEventName — the name-match that stamps the branded
// marching.art majors (Southwestern / Southeastern / Eastern Classic) with
// eventTier: "regional" at live-season ingest, so live seasons mark them the
// same way the off-season generator's placeMajor does (design §5.11).
//
// Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { regionalTierForEventName } = require("./seasonSchedule");
const { mergeScheduleRefresh } = require("./scheduleRefresh");

describe("regionalTierForEventName", () => {
  test("tags the three branded majors as regional", () => {
    assert.equal(regionalTierForEventName("marching.art Southwestern Championship"), "regional");
    assert.equal(regionalTierForEventName("marching.art Southeastern Championship"), "regional");
    assert.equal(regionalTierForEventName("marching.art Eastern Classic"), "regional");
  });

  test("tags the real (unbranded) DCI major names too", () => {
    assert.equal(regionalTierForEventName("DCI Southwestern Championship"), "regional");
    assert.equal(regionalTierForEventName("DCI Eastern Classic"), "regional");
  });

  test("leaves ordinary pool shows untagged", () => {
    // The exact co-located shows that shared major days in the reported clutter.
    assert.equal(regionalTierForEventName("The Buccaneer Classic"), null);
    assert.equal(regionalTierForEventName("Midwestern Championship"), null);
    assert.equal(regionalTierForEventName("Music on the Mountain"), null);
    assert.equal(regionalTierForEventName("Bushwackers Invitational"), null);
    assert.equal(regionalTierForEventName("marching.art Houston"), null);
  });

  test("handles missing/blank names", () => {
    assert.equal(regionalTierForEventName(null), null);
    assert.equal(regionalTierForEventName(undefined), null);
    assert.equal(regionalTierForEventName(""), null);
  });
});

describe("mergeScheduleRefresh eventTier tagging", () => {
  const startDate = new Date("2026-06-01T00:00:00Z");
  const springTrainingDays = 21;
  // Competition day N falls on calendar day N + springTrainingDays.
  const dateForDay = (day) =>
    new Date(startDate.getTime() + (day + springTrainingDays - 1) * 86400000).toISOString();

  test("stamps eventTier on a newly appended major", () => {
    const { competitions } = mergeScheduleRefresh(
      [],
      [{ eventName: "marching.art Southeastern Championship", location: "Atlanta, GA", date: dateForDay(35) }],
      "live_2026-26",
      startDate,
      springTrainingDays
    );
    const major = competitions.find((c) => c.day === 35);
    assert.equal(major.eventTier, "regional");
  });

  test("backfills eventTier onto a major already on the schedule (in place)", () => {
    const existing = [
      {
        id: "live_2026-26_day35_0",
        name: "marching.art Southeastern Championship",
        location: "Atlanta, GA",
        date: dateForDay(35),
        day: 35,
        week: 5,
        type: "regular",
        mandatory: false,
        // No eventTier — generated before tagging existed.
      },
    ];
    const { competitions, enrichedCount } = mergeScheduleRefresh(
      existing,
      [{ eventName: "marching.art Southeastern Championship", location: "Atlanta, GA", date: dateForDay(35) }],
      "live_2026-26",
      startDate,
      springTrainingDays
    );
    assert.equal(enrichedCount, 1);
    assert.equal(competitions.find((c) => c.day === 35).eventTier, "regional");
  });

  test("does not tag ordinary co-located pool shows", () => {
    const { competitions } = mergeScheduleRefresh(
      [],
      [
        { eventName: "marching.art Southeastern Championship", location: "Atlanta, GA", date: dateForDay(35) },
        { eventName: "Midwestern Championship", location: "DeKalb, IL", date: dateForDay(35) },
      ],
      "live_2026-26",
      startDate,
      springTrainingDays
    );
    const midwest = competitions.find((c) => c.name === "Midwestern Championship");
    assert.equal(midwest.eventTier, undefined);
  });
});
