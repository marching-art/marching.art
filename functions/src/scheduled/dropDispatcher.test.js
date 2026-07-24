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

// ---------------------------------------------------------------------------
// Dark-day scrape budget, already-scored short-circuit, and the recap-settle
// defer (review follow-up findings).
// ---------------------------------------------------------------------------

const { scrapeBudgetFor, runDropDispatcherTick } = require("./dropDispatcher");
const { resetFeatureCache } = require("../helpers/features");
const { FieldValue } = require("firebase-admin/firestore");

const DARK_PLAN = planDrop({
  seasonData: LIVE_SEASON,
  competitions: [], // nothing scheduled on day 10
  now: new Date("2026-07-02T02:00:00Z"),
});

test("a dark day before championship week gets a single scrape attempt", () => {
  assert.equal(scrapeBudgetFor(DARK_PLAN), 1);
  const now = new Date("2026-07-02T06:00:00Z"); // 2 AM EDT — the Pacific-default drop
  const first = dueActions({ plan: DARK_PLAN, now, scrapedTonight: false, scrapeAttempts: 0 });
  assert.equal(first.scrapeDue, true); // one attempt covers the stale-schedule case
  const after = dueActions({ plan: DARK_PLAN, now, scrapedTonight: false, scrapeAttempts: 1 });
  assert.equal(after.scrapeDue, false); // budget spent — a genuine dark day stops here
  assert.equal(after.scoreDue, true);
});

test("championship week keeps the full budget despite empty competitions[]", () => {
  // Competition day 47 = calendar day 68 = 2026-08-07; real events exist on
  // dci.org, they are just never carried in competitions[].
  const plan = planDrop({
    seasonData: LIVE_SEASON, competitions: [], now: new Date("2026-08-08T03:30:00Z"),
  });
  assert.equal(plan.competitionDay, 47);
  assert.equal(plan.hasScheduledShows, false);
  assert.equal(scrapeBudgetFor(plan), MAX_SCRAPE_ATTEMPTS);
});

test("an already-scored night suppresses scoring on later ticks", () => {
  const now = new Date("2026-07-02T03:30:00Z"); // past the 11 PM drop
  const { scoreDue } = dueActions({
    plan: EASTERN_PLAN, now, scrapedTonight: true, alreadyScored: true,
  });
  assert.equal(scoreDue, false);
});

// Minimal fake Firestore for driving whole ticks: a flat path -> data map
// with get/set(merge)/update. FieldValue.increment sentinels (only ever +1
// here) are resolved so multi-tick attempt counts stay numeric.
function makeFakeDb(initialDocs) {
  const store = new Map(Object.entries(initialDocs));
  const docRef = (path) => ({
    async get() {
      const data = store.get(path);
      return { exists: data !== undefined, data: () => data };
    },
    async set(data, opts) {
      const prev = (opts && opts.merge && store.get(path)) || {};
      const next = { ...prev };
      for (const [key, value] of Object.entries(data)) {
        next[key] = value instanceof FieldValue
          ? (typeof prev[key] === "number" ? prev[key] : 0) + 1
          : value;
      }
      store.set(path, next);
    },
    async update(data) {
      store.set(path, { ...(store.get(path) || {}), ...data });
    },
  });
  return {
    store,
    doc: docRef,
    collection: (name) => ({ doc: (id) => docRef(`${name}/${id}`) }),
  };
}

function liveNightDb({ dropScheduling = true, lastScrapedDate = null, planDoc } = {}) {
  const docs = {
    "game-settings/season": {
      ...LIVE_SEASON, seasonUid: "s26", lastScrapedDate,
    },
    "game-settings/features": { dropScheduling },
    "schedules/s26": { competitions: [{ day: 10, location: "Allentown, PA" }] },
  };
  if (planDoc) docs["drop_plans/2026-07-01"] = planDoc;
  return makeFakeDb(docs);
}

test("a fresh in-tick scrape defers scoring to the next tick (recap settle)", async () => {
  resetFeatureCache();
  const db = liveNightDb();
  const called = { score: 0 };
  const result = await runDropDispatcherTick(db, {
    now: new Date("2026-07-02T03:05:00Z"), // 11:05 PM — past scrape AND drop
    settleMs: 0,
    deps: {
      scrape: async () => ({ scraped: true, stampedLastScrapedDate: true }),
      scoreLive: async () => { called.score++; return { status: "processed" }; },
      discord: async () => ({ status: "disabled" }),
    },
  });
  assert.equal(called.score, 0); // recap rows are still in flight via Pub/Sub
  assert.deepEqual(result.actions.at(-1), { action: "score", deferred: "recap-settle" });
  assert.equal(db.store.get("drop_plans/2026-07-01").scrapeAttempts, 1);
  assert.equal(db.store.get("drop_plans/2026-07-01").scoredAt, undefined);
});

test("the next tick scores a settled night and stamps scoredAt once", async () => {
  resetFeatureCache();
  const db = liveNightDb({
    lastScrapedDate: "2026-07-01",
    planDoc: { scrapeAttempts: 1 },
  });
  const called = { score: 0, discord: 0 };
  const deps = {
    scrape: async () => { throw new Error("must not scrape again"); },
    scoreLive: async (day) => {
      called.score++;
      assert.equal(day, 10); // the PLANNER'S day, never gameDay's 2 AM reset
      return { status: "processed", scoredDay: day };
    },
    discord: async () => { called.discord++; return { status: "disabled" }; },
  };
  await runDropDispatcherTick(db, { now: new Date("2026-07-02T03:20:00Z"), settleMs: 0, deps });
  assert.equal(called.score, 1);
  assert.equal(called.discord, 1);
  assert.ok(db.store.get("drop_plans/2026-07-01").scoredAt instanceof Date);

  // Later ticks see scoredAt and skip the scoring path entirely.
  resetFeatureCache();
  const again = await runDropDispatcherTick(db, {
    now: new Date("2026-07-02T03:35:00Z"), settleMs: 0, deps,
  });
  assert.equal(called.score, 1);
  assert.equal(called.discord, 1);
  assert.deepEqual(again.actions, []);
});

test("the night's last tick scrapes and scores in one slot (no later tick exists)", async () => {
  resetFeatureCache();
  const db = liveNightDb();
  const called = { score: 0 };
  await runDropDispatcherTick(db, {
    now: EASTERN_PLAN.scrapeRetryUntil, // 2:45 AM ET — the final cron slot
    settleMs: 0,
    deps: {
      scrape: async () => ({ scraped: true, stampedLastScrapedDate: true }),
      scoreLive: async () => { called.score++; return { status: "processed" }; },
      discord: async () => ({ status: "disabled" }),
    },
  });
  assert.equal(called.score, 1); // never orphan the night waiting on a tick that won't come
});

test("a skipped in-progress claim leaves the night unstamped for later ticks", async () => {
  resetFeatureCache();
  const db = liveNightDb({ lastScrapedDate: "2026-07-01" });
  await runDropDispatcherTick(db, {
    now: new Date("2026-07-02T03:20:00Z"),
    settleMs: 0,
    deps: {
      scoreLive: async () => ({ status: "skipped", reason: "in-progress" }),
      discord: async () => { throw new Error("must not post before the day is done"); },
    },
  });
  assert.equal(db.store.get("drop_plans/2026-07-01").scoredAt, undefined);
});
