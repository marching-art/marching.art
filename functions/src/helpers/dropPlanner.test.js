const { test } = require("node:test");
const assert = require("node:assert/strict");

const { planDrop, showDateFor } = require("./dropPlanner");
const { easternLabel } = require("./scoreDropTime");

// Live season: calendar day 1 = 2026-06-01, 21 spring-training days, so
// competition day 10 falls on 2026-07-01 (calendar day 31).
const LIVE_SEASON = {
  status: "live-season",
  schedule: { startDate: new Date(Date.UTC(2026, 5, 1)), springTrainingDays: 21 },
};

// Two representative instants on the evening/early-morning of 2026-07-01's shows.
const EVENING = new Date("2026-07-02T03:30:00Z"); // 11:30 PM EDT, 2026-07-01
const AFTER_MIDNIGHT = new Date("2026-07-02T05:30:00Z"); // 1:30 AM EDT, 2026-07-02

test("showDateFor maps the whole 11 PM–2 AM window to the show's calendar date", () => {
  assert.equal(showDateFor(EVENING).iso, "2026-07-01");
  assert.equal(showDateFor(AFTER_MIDNIGHT).iso, "2026-07-01");
});

test("selects tonight's competition day (not the 2 AM-reset 'yesterday')", () => {
  const plan = planDrop({ seasonData: LIVE_SEASON, competitions: [], now: EVENING });
  assert.equal(plan.competitionDay, 10);
  assert.equal(plan.showDateET, "2026-07-01");
});

test("Eastern-only day drops at 11 PM ET", () => {
  const competitions = [{ day: 10, location: "Allentown, PA" }];
  const plan = planDrop({ seasonData: LIVE_SEASON, competitions, now: EVENING });
  assert.equal(easternLabel(plan.dropInstant), "2026-07-01 23:00 ET");
  assert.deepEqual(plan.timeZones, ["America/New_York"]);
  assert.equal(plan.needsScrape, true);
});

test("furthest-west (Mountain) show pushes the drop to 1 AM ET", () => {
  const competitions = [
    { day: 10, location: "Allentown, PA" },
    { day: 10, location: "Denver, Colorado" },
    { day: 11, location: "Los Angeles, CA" }, // other day, ignored
  ];
  const plan = planDrop({ seasonData: LIVE_SEASON, competitions, now: AFTER_MIDNIGHT });
  assert.equal(easternLabel(plan.dropInstant), "2026-07-02 01:00 ET");
});

test("El Paso resolves to Mountain via the gazetteer (not coarse Central)", () => {
  const competitions = [{ day: 10, location: "El Paso, TX" }];
  const plan = planDrop({ seasonData: LIVE_SEASON, competitions, now: EVENING });
  // Mountain 11 PM local -> 1 AM ET, proving the coordinate gazetteer won.
  assert.equal(easternLabel(plan.dropInstant), "2026-07-02 01:00 ET");
  assert.deepEqual(plan.timeZones, ["America/Denver"]);
});

test("scrapeInstant anchors to the real announced time + buffer when known", () => {
  const scoresAt = "2026-07-02T04:30:00Z";
  const competitions = [{ day: 10, location: "Denver, Colorado", scoresAt }];
  const plan = planDrop({ seasonData: LIVE_SEASON, competitions, now: AFTER_MIDNIGHT });
  assert.equal(plan.scoresAt.getTime(), new Date(scoresAt).getTime());
  // +10 minutes past the announced time.
  assert.equal(plan.scrapeInstant.getTime(), new Date(scoresAt).getTime() + 10 * 60000);
});

test("scrapeInstant falls back to drop − 15 min when no announced time is known", () => {
  const competitions = [{ day: 10, location: "Allentown, PA" }]; // no scoresAt
  const plan = planDrop({ seasonData: LIVE_SEASON, competitions, now: EVENING });
  assert.equal(plan.scoresAt, null);
  assert.equal(plan.scrapeInstant.getTime(), plan.dropInstant.getTime() - 15 * 60000);
});

test("uses the latest announced time across the day's shows", () => {
  const competitions = [
    { day: 10, location: "Allentown, PA", scoresAt: "2026-07-02T02:30:00Z" },
    { day: 10, location: "Denver, Colorado", scoresAt: "2026-07-02T04:30:00Z" },
  ];
  const plan = planDrop({ seasonData: LIVE_SEASON, competitions, now: AFTER_MIDNIGHT });
  assert.equal(plan.scoresAt.getTime(), new Date("2026-07-02T04:30:00Z").getTime());
});

test("championship week (day 47) drops at midnight ET even with no scheduled shows", () => {
  // Competition day 47 = calendar day 68 = 2026-08-07.
  const now = new Date("2026-08-08T03:30:00Z"); // 11:30 PM EDT, 2026-08-07
  const plan = planDrop({ seasonData: LIVE_SEASON, competitions: [], now });
  assert.equal(plan.competitionDay, 47);
  assert.equal(plan.timeZones[0], "America/Indiana/Indianapolis");
  assert.equal(easternLabel(plan.dropInstant), "2026-08-08 00:00 ET");
});

test("off-season drops at 9 PM ET with no scrape", () => {
  const offSeason = { status: "off-season", schedule: { startDate: new Date(Date.UTC(2026, 10, 1)) } };
  const now = new Date("2026-11-06T01:00:00Z"); // 8 PM EST, 2026-11-05
  const plan = planDrop({ seasonData: offSeason, competitions: [], now });
  assert.equal(plan.competitionDay, 5);
  assert.equal(plan.needsScrape, false);
  assert.equal(plan.scrapeInstant, null);
  assert.equal(easternLabel(plan.dropInstant), "2026-11-05 21:00 ET");
});

test("returns null during spring training and after the season", () => {
  // 2026-06-10 is calendar day 10 -> competition day -11 (spring training).
  const spring = planDrop({ seasonData: LIVE_SEASON, competitions: [], now: new Date("2026-06-11T03:30:00Z") });
  assert.equal(spring, null);
  // 2026-08-20 is well past competition day 49.
  const over = planDrop({ seasonData: LIVE_SEASON, competitions: [], now: new Date("2026-08-21T03:30:00Z") });
  assert.equal(over, null);
});

test("returns null without a usable season/start date", () => {
  assert.equal(planDrop({ seasonData: null, now: EVENING }), null);
  assert.equal(planDrop({ seasonData: { status: "live-season", schedule: {} }, now: EVENING }), null);
});
