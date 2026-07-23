const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  fantasyDropInstant,
  podiumDropInstant,
  eveningDropInstant,
  easternLabel,
  wallClockToUtc,
} = require("./scoreDropTime");

// All DCI-season dates below are inside US daylight saving time (EDT/CDT/MDT/PDT).

test("live: Eastern-only day drops at 11 PM ET", () => {
  const instant = fantasyDropInstant({
    etDate: "2026-07-15",
    timeZones: ["America/New_York"],
    seasonType: "live-season",
    day: 10,
  });
  assert.equal(easternLabel(instant), "2026-07-15 23:00 ET");
});

test("live: Central westernmost day drops at midnight ET (12 AM next day)", () => {
  const instant = fantasyDropInstant({
    etDate: "2026-07-15",
    timeZones: ["America/New_York", "America/Chicago"],
    seasonType: "live-season",
    day: 10,
  });
  assert.equal(easternLabel(instant), "2026-07-16 00:00 ET");
});

test("live: Mountain westernmost day drops at 1 AM ET", () => {
  const instant = fantasyDropInstant({
    etDate: "2026-07-15",
    timeZones: ["America/Denver", "America/Chicago"],
    seasonType: "live-season",
    day: 10,
  });
  assert.equal(easternLabel(instant), "2026-07-16 01:00 ET");
});

test("live: Pacific westernmost day drops at 2 AM ET", () => {
  const instant = fantasyDropInstant({
    etDate: "2026-07-15",
    timeZones: ["America/Los_Angeles", "America/New_York"],
    seasonType: "live-season",
    day: 10,
  });
  assert.equal(easternLabel(instant), "2026-07-16 02:00 ET");
});

test("live: Arizona (no DST) behaves like Pacific clock time in summer -> 2 AM ET", () => {
  // Phoenix in July is UTC-7, same instant as 11 PM PDT.
  const az = fantasyDropInstant({
    etDate: "2026-07-15",
    timeZones: ["America/Phoenix"],
    seasonType: "live-season",
    day: 10,
  });
  const pacific = fantasyDropInstant({
    etDate: "2026-07-15",
    timeZones: ["America/Los_Angeles"],
    seasonType: "live-season",
    day: 10,
  });
  assert.equal(az.getTime(), pacific.getTime());
  assert.equal(easternLabel(az), "2026-07-16 02:00 ET");
});

test("live: furthest-west wins regardless of zone order", () => {
  const a = fantasyDropInstant({
    etDate: "2026-07-15",
    timeZones: ["America/New_York", "America/Los_Angeles", "America/Chicago"],
    seasonType: "live-season",
    day: 10,
  });
  const b = fantasyDropInstant({
    etDate: "2026-07-15",
    timeZones: ["America/Los_Angeles"],
    seasonType: "live-season",
    day: 10,
  });
  assert.equal(a.getTime(), b.getTime());
});

test("live: unresolved zones default to Pacific (never drop early)", () => {
  const instant = fantasyDropInstant({
    etDate: "2026-07-15",
    timeZones: [],
    seasonType: "live-season",
    day: 10,
  });
  assert.equal(easternLabel(instant), "2026-07-16 02:00 ET");
});

test("live: World Championship days 47-49 (Indianapolis) drop at midnight ET", () => {
  for (const day of [47, 48, 49]) {
    const instant = fantasyDropInstant({
      etDate: "2026-08-08",
      timeZones: ["America/Indiana/Indianapolis"],
      seasonType: "live-season",
      day,
    });
    // Midnight ET the night of finals = 00:00 ET on 2026-08-09.
    assert.equal(easternLabel(instant), "2026-08-09 00:00 ET", `day ${day}`);
  }
});

test("live: finals-week midnight is one hour later than the plain Eastern 11 PM", () => {
  const eastern11 = fantasyDropInstant({
    etDate: "2026-08-08",
    timeZones: ["America/New_York"],
    seasonType: "live-season",
    day: 40, // not finals week
  });
  const finalsMidnight = fantasyDropInstant({
    etDate: "2026-08-08",
    timeZones: ["America/New_York"],
    seasonType: "live-season",
    day: 49,
  });
  assert.equal(finalsMidnight.getTime() - eastern11.getTime(), 60 * 60 * 1000);
});

test("off-season: always 9 PM ET regardless of show zones or finals days", () => {
  const withWest = fantasyDropInstant({
    etDate: "2026-11-15",
    timeZones: ["America/Los_Angeles"],
    seasonType: "off-season",
    day: 49,
  });
  // Nov 15 is EST (UTC-5); 9 PM ET.
  assert.equal(easternLabel(withWest), "2026-11-15 21:00 ET");
});

test("podium: 9 PM ET year-round, tracking DST", () => {
  const summer = podiumDropInstant("2026-07-15"); // EDT
  const winter = podiumDropInstant("2026-01-15"); // EST
  assert.equal(easternLabel(summer), "2026-07-15 21:00 ET");
  assert.equal(easternLabel(winter), "2026-01-15 21:00 ET");
  // Same wall clock, different UTC instant across the DST boundary.
  assert.equal(summer.getUTCHours(), 1); // 21:00 EDT -> 01:00 UTC next day
  assert.equal(winter.getUTCHours(), 2); // 21:00 EST -> 02:00 UTC next day
});

test("eveningDropInstant equals podiumDropInstant", () => {
  assert.equal(eveningDropInstant("2026-07-15").getTime(), podiumDropInstant("2026-07-15").getTime());
});

test("wallClockToUtc handles a spring-forward day without error", () => {
  // 2026 US spring forward is Mar 8. 11 PM local that day is well clear of the
  // 2 AM gap; just assert it resolves to a valid EDT instant.
  const instant = wallClockToUtc(2026, 3, 8, 23, 0, "America/New_York");
  assert.equal(easternLabel(instant), "2026-03-08 23:00 ET");
});
