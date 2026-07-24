const { test } = require("node:test");
const assert = require("node:assert/strict");

const { dueActions, MAX_SCRAPE_ATTEMPTS } = require("./dropDispatcher");
const { planDrop } = require("../helpers/dropPlanner");
const { getCompletedCalendarDay, toCompetitionDay } = require("../helpers/gameDay");

// A live-season plan for competition day 10 on an Eastern-only night:
// drop 11 PM ET (2026-07-02T03:00Z), scrape 10:45 PM ET, clamp 2:45 AM ET.
const LIVE_SEASON = {
  status: "live-season",
  schedule: { startDate: new Date(Date.UTC(2026, 5, 1)), springTrainingDays: 21 },
};
const EASTERN_PLAN = planDrop({
  seasonData: LIVE_SEASON,
  competitions: [{ day: 10, location: "Allentown, PA" }],
  now: new Date("2026-07-02T02:00:00Z"), // 10 PM EDT, 2026-07-01
});

test("nothing is due before the scrape instant", () => {
  const { scrapeDue, scoreDue } = dueActions({
    plan: EASTERN_PLAN,
    now: new Date("2026-07-02T02:30:00Z"), // 10:30 PM — before 10:45 scrape
    scrapedTonight: false,
  });
  assert.equal(scrapeDue, false);
  assert.equal(scoreDue, false);
});

test("scrape fires between its instant and the clamp; score waits for the scrape", () => {
  const now = new Date("2026-07-02T02:50:00Z"); // 10:50 PM — past scrape, before drop
  const before = dueActions({ plan: EASTERN_PLAN, now, scrapedTonight: false });
  assert.equal(before.scrapeDue, true);
  assert.equal(before.scoreDue, false);
});

test("score fires at the drop once tonight's scrape succeeded", () => {
  const now = new Date("2026-07-02T03:05:00Z"); // 11:05 PM — past the 11 PM drop
  const { scrapeDue, scoreDue } = dueActions({ plan: EASTERN_PLAN, now, scrapedTonight: true });
  assert.equal(scrapeDue, false); // already scraped
  assert.equal(scoreDue, true);
});

test("an unscraped night holds scoring at the drop (retry window still open)", () => {
  const now = new Date("2026-07-02T03:05:00Z");
  const { scrapeDue, scoreDue } = dueActions({ plan: EASTERN_PLAN, now, scrapedTonight: false });
  assert.equal(scrapeDue, true); // retrying
  assert.equal(scoreDue, false); // scores derive from the scrape
});

test("an exhausted scrape budget releases scoring on regression fallback", () => {
  const now = new Date("2026-07-02T03:05:00Z");
  const { scrapeDue, scoreDue } = dueActions({
    plan: EASTERN_PLAN, now, scrapedTonight: false, scrapeAttempts: MAX_SCRAPE_ATTEMPTS,
  });
  assert.equal(scrapeDue, false); // budget spent — no more dci.org requests
  assert.equal(scoreDue, true);
});

test("the late clamp force-releases scoring so a night is never orphaned", () => {
  const now = new Date(EASTERN_PLAN.scrapeRetryUntil.getTime()); // 2:45 AM ET
  const { scoreDue } = dueActions({ plan: EASTERN_PLAN, now, scrapedTonight: false, scrapeAttempts: 1 });
  assert.equal(scoreDue, true);
});

test("a dark day (no scheduled shows) scores at the drop without waiting for a scrape", () => {
  const darkPlan = planDrop({
    seasonData: LIVE_SEASON,
    competitions: [], // nothing scheduled on day 10
    now: new Date("2026-07-02T02:00:00Z"),
  });
  assert.equal(darkPlan.hasScheduledShows, false);
  // Dark-day drop defaults to the Pacific worst case (2 AM ET).
  const now = new Date(darkPlan.dropInstant.getTime());
  const { scoreDue } = dueActions({ plan: darkPlan, now, scrapedTonight: false });
  assert.equal(scoreDue, true); // pools/week payouts settle even with no shows
});

test("off-season plans score at 9 PM with no scrape gating", () => {
  const plan = planDrop({
    seasonData: { status: "off-season", schedule: { startDate: new Date(Date.UTC(2026, 10, 1)) } },
    competitions: [],
    now: new Date("2026-11-06T01:00:00Z"), // 8 PM EST Nov 5
  });
  const before = dueActions({ plan, now: new Date("2026-11-06T01:30:00Z"), scrapedTonight: false });
  assert.equal(before.scoreDue, false); // 8:30 PM — before the 9 PM drop
  const after = dueActions({ plan, now: new Date("2026-11-06T02:05:00Z"), scrapedTonight: false });
  assert.equal(after.scrapeDue, false);
  assert.equal(after.scoreDue, true); // 9:05 PM
});

// Review finding #5, documented as a test: the scorer must take the planner's
// day. gameDay.js's 2 AM reset — correct for the legacy 2 AM run — is one day
// behind at every pre-2AM drop time, and converges only at 2 AM itself.
test("gameDay's 2 AM reset disagrees with the planner at 11 PM/12 AM/1 AM, converges at 2 AM", () => {
  const cases = [
    { now: new Date("2026-07-02T03:00:00Z"), delta: 1 }, // 11 PM EDT (Eastern drop)
    { now: new Date("2026-07-02T04:00:00Z"), delta: 1 }, // 12 AM EDT (Central drop)
    { now: new Date("2026-07-02T05:00:00Z"), delta: 1 }, // 1 AM EDT (Mountain drop)
    { now: new Date("2026-07-02T06:00:00Z"), delta: 0 }, // 2 AM EDT (Pacific drop)
  ];
  for (const { now, delta } of cases) {
    const plan = planDrop({ seasonData: LIVE_SEASON, competitions: [], now });
    const gameDayDerived = toCompetitionDay(
      getCompletedCalendarDay(LIVE_SEASON.schedule.startDate, now), LIVE_SEASON,
    );
    assert.equal(
      plan.competitionDay - gameDayDerived, delta,
      `at ${now.toISOString()}: planner=${plan.competitionDay} gameDay=${gameDayDerived}`,
    );
  }
});
