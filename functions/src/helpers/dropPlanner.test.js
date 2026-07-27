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
  // Announced 12:50 AM ET for a Denver night (planned drop 1 AM ET): the
  // anchor (+10 min) lands at the drop, past the drop − 15 floor, so it wins.
  const scoresAt = "2026-07-02T04:50:00Z";
  const competitions = [{ day: 10, location: "Denver, Colorado", scoresAt }];
  const plan = planDrop({ seasonData: LIVE_SEASON, competitions, now: AFTER_MIDNIGHT });
  assert.equal(plan.scoresAt.getTime(), new Date(scoresAt).getTime());
  assert.equal(plan.scrapeInstant.getTime(), new Date(scoresAt).getTime() + 10 * 60000);
});

test("an early announced time never pulls the scrape before drop − 15 min", () => {
  // Eastern show announced 9:51 PM ET, Denver show with NO announced time:
  // the single scrape attempt must wait for the western show, not fire at
  // 10:01 PM on the eastern anchor.
  const competitions = [
    { day: 10, location: "Allentown, PA", scoresAt: "2026-07-02T01:51:00Z" },
    { day: 10, location: "Denver, Colorado" },
  ];
  const plan = planDrop({ seasonData: LIVE_SEASON, competitions, now: AFTER_MIDNIGHT });
  assert.equal(easternLabel(plan.dropInstant), "2026-07-02 01:00 ET");
  // Floor: drop − 15 min = 12:45 AM ET.
  assert.equal(plan.scrapeInstant.getTime(), plan.dropInstant.getTime() - 15 * 60000);
});

test("a bogus scoresAt (wrong date/year) is ignored, not trusted", () => {
  const competitions = [
    { day: 10, location: "Allentown, PA", scoresAt: "2027-07-02T02:30:00Z" }, // wrong year
    { day: 10, location: "Denver, Colorado", scoresAt: "not-a-date" },
  ];
  const plan = planDrop({ seasonData: LIVE_SEASON, competitions, now: AFTER_MIDNIGHT });
  assert.equal(plan.scoresAt, null);
  assert.equal(plan.ignoredScoresAt.length, 2);
  // Falls back to drop − 15 as if no announced time were known.
  assert.equal(plan.scrapeInstant.getTime(), plan.dropInstant.getTime() - 15 * 60000);
});

test("a late announced time slips the drop but is clamped before the 3 AM boundary", () => {
  // Pacific night (planned drop 2 AM ET) announced 2:40 AM ET: anchor +10 min
  // = 2:50, clamped to 2:45 (15 min before the 3 AM show-day reset). The drop
  // slips to the clamped scrape; the pre-slip plan is preserved.
  const competitions = [
    { day: 10, location: "Los Angeles, CA", scoresAt: "2026-07-02T06:40:00Z" },
  ];
  const plan = planDrop({ seasonData: LIVE_SEASON, competitions, now: AFTER_MIDNIGHT });
  assert.equal(easternLabel(plan.plannedDropInstant), "2026-07-02 02:00 ET");
  assert.equal(easternLabel(plan.scrapeInstant), "2026-07-02 02:45 ET");
  assert.equal(easternLabel(plan.dropInstant), "2026-07-02 02:45 ET");
  assert.equal(easternLabel(plan.scrapeRetryUntil), "2026-07-02 02:45 ET");
});

test("hasScheduledShows distinguishes a stale schedule from championship week", () => {
  const stale = planDrop({ seasonData: LIVE_SEASON, competitions: [], now: EVENING });
  assert.equal(stale.hasScheduledShows, false); // day 10: schedule doc is stale
  const finals = planDrop({
    seasonData: LIVE_SEASON, competitions: [], now: new Date("2026-08-08T03:30:00Z"),
  });
  assert.equal(finals.hasScheduledShows, false); // day 47: expected — not scraped into competitions[]
  assert.equal(finals.competitionDay, 47);
});

test("flags a real gazetteer-vs-enrichment zone disagreement, ignores same-offset aliases", () => {
  const competitions = [
    // Real disagreement: gazetteer says Eastern, enrichment claims Central.
    { day: 10, location: "Allentown, PA", timezone: "America/Chicago" },
    // Alias, same offset: Detroit vs New_York must NOT flag.
    { day: 10, location: "Detroit, Michigan", timezone: "America/New_York" },
  ];
  const plan = planDrop({ seasonData: LIVE_SEASON, competitions, now: EVENING });
  assert.equal(plan.tzMismatches.length, 1);
  assert.equal(plan.tzMismatches[0].location, "Allentown, PA");
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

test("returns null for a non-scoreable season status (fail closed)", () => {
  const finished = { status: "finished", schedule: LIVE_SEASON.schedule };
  assert.equal(planDrop({ seasonData: finished, competitions: [], now: EVENING }), null);
});

test("showDateFor rolls to the next date exactly at the 3 AM ET boundary", () => {
  const justBefore = new Date("2026-07-02T06:59:59Z"); // 2:59:59 AM EDT
  const atBoundary = new Date("2026-07-02T07:00:00Z"); // 3:00:00 AM EDT
  assert.equal(showDateFor(justBefore).iso, "2026-07-01");
  assert.equal(showDateFor(atBoundary).iso, "2026-07-02");
});

// ---------------------------------------------------------------------------
// The legacy 2 AM handoff, and which scheduled shows owe a DCI recap.
// ---------------------------------------------------------------------------

const { isVirtualShow, owesDciRecap } = require("./dropPlanner");

test("legacyScoringInstant is 2 AM ET the morning after the shows", () => {
  const plan = planDrop({ seasonData: LIVE_SEASON, competitions: [], now: EVENING });
  // 2026-07-02 02:00 EDT = 06:00Z.
  assert.equal(plan.legacyScoringInstant.toISOString(), "2026-07-02T06:00:00.000Z");
  assert.equal(easternLabel(plan.legacyScoringInstant), "2026-07-02 02:00 ET");
});

test("legacyScoringInstant tracks DST (EST nights are 07:00Z)", () => {
  const winter = {
    status: "live-season",
    schedule: { startDate: new Date(Date.UTC(2026, 10, 1)), springTrainingDays: 0 },
  };
  // 2026-11-10's shows -> 2 AM EST on the 11th = 07:00Z.
  const plan = planDrop({
    seasonData: winter, competitions: [], now: new Date("2026-11-11T02:00:00Z"),
  });
  assert.equal(plan.legacyScoringInstant.toISOString(), "2026-11-11T07:00:00.000Z");
});

test("off-season plans carry no legacy handoff (nothing to scrape)", () => {
  const plan = planDrop({
    seasonData: { status: "off-season", schedule: { startDate: new Date(Date.UTC(2026, 10, 1)) } },
    competitions: [],
    now: new Date("2026-11-06T01:00:00Z"),
  });
  assert.equal(plan.legacyScoringInstant, null);
  assert.equal(plan.expectedShowCount, 0);
});

test("isVirtualShow flags player-hosted events on positive markers only", () => {
  assert.equal(isVirtualShow({ date: "2026-07-01", eventTier: "hosted" }), true);
  assert.equal(isVirtualShow({ date: "2026-07-01", hostUid: "u1" }), true);
  assert.equal(isVirtualShow({ location: "Allentown, PA", date: "2026-07-01" }), false);
  // An unmarked show stays "real" — guessing virtual from a missing field
  // could drop a Pacific night's scores at 11 PM.
  assert.equal(isVirtualShow({ location: "Boise, ID" }), false);
  assert.equal(isVirtualShow(null), false);
});

test("owesDciRecap also requires the date every scraped event carries", () => {
  assert.equal(owesDciRecap({ location: "Allentown, PA", date: "2026-07-01" }), true);
  assert.equal(owesDciRecap({ date: "2026-07-01", eventTier: "hosted" }), false);
  assert.equal(owesDciRecap({ date: "2026-07-01", hostUid: "u1" }), false);
  // Hosted shows created before addShowToDay persisted its markers.
  assert.equal(owesDciRecap({ location: "Boise, ID" }), false);
  assert.equal(owesDciRecap(null), false);
});

test("expectedShowCount counts only the DCI-scraped shows on the day", () => {
  const plan = planDrop({
    seasonData: LIVE_SEASON,
    competitions: [
      { day: 10, location: "Allentown, PA", date: "2026-07-01" },
      { day: 10, location: "Atlanta, GA", date: "2026-07-01" },
      { day: 10, location: "Denver, CO", eventTier: "hosted", hostUid: "u1" },
      { day: 11, location: "Boston, MA", date: "2026-07-02" }, // another day
    ],
    now: EVENING,
  });
  assert.equal(plan.expectedShowCount, 2);
});
