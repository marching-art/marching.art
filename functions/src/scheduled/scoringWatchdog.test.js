// Tests for the scoring failure watchdog (scheduled/scoringWatchdog.js).
// A fake Firestore backs the scoring_runs query so the failed / stale-running
// / healthy classification can be asserted without an emulator — this job is
// the only thing that notices a broken 2 AM scoring night.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  findUnhealthyScoringRuns,
  findUnhealthyRolloverRuns,
  watchdogSeverity,
  LOOKBACK_MS,
} = require("./scoringWatchdog");
const { STALE_LEASE_MS } = require("../helpers/scoringRunGuard");

const NOW = new Date("2026-07-22T08:30:00Z");

// Fake Firestore: lease docs as { id, ...data } under one collection
// (scoring_runs by default; season_rollovers for the rollover check). Applies
// the single startedAt range filter the watchdog issues, like production would.
function makeDb(docs, collectionName = "scoring_runs") {
  return {
    collection(name) {
      assert.equal(name, collectionName);
      return {
        where(field, op, value) {
          assert.equal(field, "startedAt");
          assert.equal(op, ">=");
          return {
            async get() {
              const matching = docs.filter((d) => {
                const startedAt = typeof d.startedAt?.toDate === "function"
                  ? d.startedAt.toDate()
                  : d.startedAt;
                return startedAt && startedAt.getTime() >= value.getTime();
              });
              return {
                docs: matching.map(({ id, ...data }) => ({ id, data: () => data })),
              };
            },
          };
        },
      };
    },
  };
}

const minutesAgo = (m) => new Date(NOW.getTime() - m * 60 * 1000);

describe("findUnhealthyScoringRuns", () => {
  test("returns nothing when all recent runs completed", async () => {
    const db = makeDb([
      { id: "s2026_day4", status: "completed", startedAt: minutesAgo(60 * 26) },
      { id: "s2026_day5", status: "completed", startedAt: minutesAgo(150) },
    ]);
    assert.deepEqual(await findUnhealthyScoringRuns(db, NOW), []);
  });

  test("flags a failed run with its last error", async () => {
    const db = makeDb([
      {
        id: "s2026_day5", status: "failed", startedAt: minutesAgo(150),
        seasonUid: "s2026", scoredDay: 5, attempts: 2, lastError: "commit exploded",
      },
    ]);
    const unhealthy = await findUnhealthyScoringRuns(db, NOW);

    assert.equal(unhealthy.length, 1);
    assert.equal(unhealthy[0].id, "s2026_day5");
    assert.equal(unhealthy[0].status, "failed");
    assert.equal(unhealthy[0].scoredDay, 5);
    assert.equal(unhealthy[0].attempts, 2);
    assert.equal(unhealthy[0].lastError, "commit exploded");
  });

  test("flags a stale running claim (crashed run) but not a live one", async () => {
    const db = makeDb([
      // Crashed: claimed well past the stale lease, never marked failed.
      { id: "s2026_day5", status: "running", startedAt: new Date(NOW.getTime() - STALE_LEASE_MS - 1000) },
      // Live: claimed a minute ago (e.g. a manual re-run in progress).
      { id: "s2026_day6", status: "running", startedAt: minutesAgo(1) },
    ]);
    const unhealthy = await findUnhealthyScoringRuns(db, NOW);

    assert.equal(unhealthy.length, 1);
    assert.equal(unhealthy[0].id, "s2026_day5");
    assert.equal(unhealthy[0].status, "stale-running");
  });

  test("ignores failures older than the 2-day lookback", async () => {
    const db = makeDb([
      { id: "s2026_day1", status: "failed", startedAt: new Date(NOW.getTime() - LOOKBACK_MS - 1000) },
    ]);
    assert.deepEqual(await findUnhealthyScoringRuns(db, NOW), []);
  });

  test("reads startedAt back through a Firestore Timestamp", async () => {
    // In production startedAt round-trips as a Timestamp with .toDate().
    const asTimestamp = (date) => ({ toDate: () => date });
    const db = makeDb([
      {
        id: "s2026_day5", status: "running",
        startedAt: asTimestamp(new Date(NOW.getTime() - STALE_LEASE_MS - 1000)),
      },
    ]);
    const unhealthy = await findUnhealthyScoringRuns(db, NOW);

    assert.equal(unhealthy.length, 1);
    assert.equal(unhealthy[0].status, "stale-running");
  });

  test("carries the lease kind through, defaulting pre-kind docs to 'scoring'", async () => {
    const db = makeDb([
      // Written before the kind field existed — must read as scoring.
      { id: "s2026_day5", status: "failed", startedAt: minutesAgo(150) },
      { id: "s2026_discord_day5", status: "failed", kind: "announce", startedAt: minutesAgo(140) },
    ]);
    const unhealthy = await findUnhealthyScoringRuns(db, NOW);

    assert.equal(unhealthy.find((r) => r.id === "s2026_day5").kind, "scoring");
    assert.equal(unhealthy.find((r) => r.id === "s2026_discord_day5").kind, "announce");
  });

  test("surfaces an isolated stage's failure marker with its stage tag", async () => {
    // Written by scoringRunGuard.recordStageFailure when a stage died before
    // it held a lease of its own — previously invisible to the watchdog.
    const db = makeDb([
      {
        id: "stage_podium-nightly_2026-07-22", status: "failed", kind: "scoring",
        stage: "podium-nightly", startedAt: minutesAgo(690), lastError: "season index exploded",
        attempts: 1,
      },
      {
        id: "stage_discord-stage_2026-07-22", status: "failed", kind: "announce",
        stage: "discord-stage", startedAt: minutesAgo(150), lastError: "webhook 502",
      },
    ]);
    const unhealthy = await findUnhealthyScoringRuns(db, NOW);

    assert.equal(unhealthy.length, 2);
    const podium = unhealthy.find((r) => r.stage === "podium-nightly");
    assert.equal(podium.kind, "scoring");
    assert.equal(podium.status, "failed");
    assert.equal(podium.lastError, "season index exploded");
    assert.equal(unhealthy.find((r) => r.stage === "discord-stage").kind, "announce");
    // Plain leases carry no stage key at all (the alert text keys off it).
    assert.ok(!("stage" in (await findUnhealthyScoringRuns(makeDb([
      { id: "s2026_day5", status: "failed", startedAt: minutesAgo(150) },
    ]), NOW))[0]));
  });
});

describe("findUnhealthyRolloverRuns", () => {
  test("returns nothing when the rollover completed and no scheduler marker exists", async () => {
    const db = makeDb([
      { id: "live_2025-26", status: "completed", kind: "rollover", startedAt: minutesAgo(90) },
    ], "season_rollovers");
    assert.deepEqual(await findUnhealthyRolloverRuns(db, NOW), []);
  });

  test("flags a failed rollover lease (never retried by the scheduler) as kind rollover", async () => {
    const db = makeDb([
      // Written before the kind field existed on rollover leases.
      {
        id: "live_2025-26", status: "failed", seasonUid: "live_2025-26",
        startedAt: minutesAgo(90), lastError: "prize pool payout failed",
      },
    ], "season_rollovers");
    const unhealthy = await findUnhealthyRolloverRuns(db, NOW);

    assert.equal(unhealthy.length, 1);
    assert.equal(unhealthy[0].id, "live_2025-26");
    assert.equal(unhealthy[0].kind, "rollover");
    assert.equal(unhealthy[0].status, "failed");
    assert.equal(unhealthy[0].lastError, "prize pool payout failed");
  });

  test("flags the 3 AM scheduler's failure marker and a stalled rollover claim", async () => {
    const db = makeDb([
      {
        id: "scheduler_2026-07-22", status: "failed", kind: "scheduler",
        startedAt: minutesAgo(90), lastError: "Final rankings for 2025 not found", attempts: 3,
      },
      {
        id: "off_2026_5", status: "running", kind: "rollover",
        startedAt: new Date(NOW.getTime() - STALE_LEASE_MS - 1000),
      },
      // Older than the lookback: an already-reported incident stays quiet.
      { id: "off_2026_3", status: "failed", startedAt: new Date(NOW.getTime() - LOOKBACK_MS - 1000) },
    ], "season_rollovers");
    const unhealthy = await findUnhealthyRolloverRuns(db, NOW);

    assert.deepEqual(unhealthy.map((r) => [r.id, r.status, r.kind]), [
      ["scheduler_2026-07-22", "failed", "scheduler"],
      ["off_2026_5", "stale-running", "rollover"],
    ]);
    assert.equal(unhealthy[0].attempts, 3);
  });
});

describe("watchdogSeverity", () => {
  test("a failed scoring run is critical", () => {
    const severity = watchdogSeverity({
      unhealthy: [{ id: "s2026_day5", status: "failed", kind: "scoring" }],
      scrapeProblem: null,
      unscoredProblem: null,
    });
    assert.equal(severity, "critical");
  });

  test("only announce-kind failures downgrade to a warning", () => {
    const severity = watchdogSeverity({
      unhealthy: [{ id: "s2026_discord_day5", status: "failed", kind: "announce" }],
      scrapeProblem: null,
      unscoredProblem: null,
    });
    assert.equal(severity, "warning");
  });

  test("any season rollover / scheduler problem is critical", () => {
    const severity = watchdogSeverity({
      unhealthy: [],
      scrapeProblem: null,
      unscoredProblem: null,
      rolloverProblems: [{ id: "scheduler_2026-07-22", status: "failed", kind: "scheduler" }],
    });
    assert.equal(severity, "critical");
  });

  test("a pre-kind doc counts as scoring (backward compat) — critical", () => {
    const severity = watchdogSeverity({
      unhealthy: [{ id: "s2026_day5", status: "failed" }],
      scrapeProblem: null,
      unscoredProblem: null,
    });
    assert.equal(severity, "critical");
  });

  test("a scrape or unscored-night problem is critical even with healthy runs", () => {
    assert.equal(
      watchdogSeverity({ unhealthy: [], scrapeProblem: { status: "failed" }, unscoredProblem: null }),
      "critical",
    );
    assert.equal(
      watchdogSeverity({ unhealthy: [], scrapeProblem: null, unscoredProblem: { status: "unscored" } }),
      "critical",
    );
  });
});

// ---------------------------------------------------------------------------
// Unscored-night detection (drop dispatcher audit trail). A night where
// scoring never claimed a lease leaves scoring_runs empty — only the
// "active" drop_plans doc without a scoredAt stamp reveals it.
// ---------------------------------------------------------------------------

const { findUnscoredNightProblem } = require("./scoringWatchdog");

// 4:30 AM EDT on 2026-07-02 — last night's show date is 2026-07-01.
const WATCHDOG_NOW = new Date("2026-07-02T08:30:00Z");

// Flat path -> data fake covering doc() and collection().doc() reads.
function makePathDb(docs) {
  const docRef = (path) => ({
    async get() {
      const data = docs[path];
      return { exists: data !== undefined, data: () => data };
    },
  });
  return {
    doc: docRef,
    collection: (name) => ({ doc: (id) => docRef(`${name}/${id}`) }),
  };
}

describe("findUnscoredNightProblem", () => {
  test("no plan doc (dispatcher not deployed / season inactive) is healthy", async () => {
    const db = makePathDb({});
    assert.equal(await findUnscoredNightProblem(db, WATCHDOG_NOW), null);
  });

  test("a shadow-mode plan never alerts (legacy pipeline owned the night)", async () => {
    const db = makePathDb({
      "drop_plans/2026-07-01": { mode: "shadow", competitionDay: 10 },
    });
    assert.equal(await findUnscoredNightProblem(db, WATCHDOG_NOW), null);
  });

  test("an active plan with scoredAt is healthy", async () => {
    const db = makePathDb({
      "drop_plans/2026-07-01": { mode: "active", competitionDay: 10, scoredAt: new Date() },
    });
    assert.equal(await findUnscoredNightProblem(db, WATCHDOG_NOW), null);
  });

  test("an active plan with no scoredAt and no completed lease alerts", async () => {
    const db = makePathDb({
      "drop_plans/2026-07-01": {
        mode: "active", competitionDay: 10, dropLabel: "2026-07-01 23:00 ET",
      },
      "game-settings/season": { seasonUid: "s26" },
    });
    const problem = await findUnscoredNightProblem(db, WATCHDOG_NOW);
    assert.deepEqual(problem, {
      date: "2026-07-01",
      status: "unscored",
      competitionDay: 10,
      dropLabel: "2026-07-01 23:00 ET",
    });
  });

  test("a completed scoring lease suppresses the alert (mid-night flag flip)", async () => {
    const db = makePathDb({
      "drop_plans/2026-07-01": { mode: "active", competitionDay: 10 },
      "game-settings/season": { seasonUid: "s26" },
      "scoring_runs/s26_day10": { status: "completed" },
    });
    assert.equal(await findUnscoredNightProblem(db, WATCHDOG_NOW), null);
  });
});
