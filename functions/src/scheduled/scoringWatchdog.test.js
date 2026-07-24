// Tests for the scoring failure watchdog (scheduled/scoringWatchdog.js).
// A fake Firestore backs the scoring_runs query so the failed / stale-running
// / healthy classification can be asserted without an emulator — this job is
// the only thing that notices a broken 2 AM scoring night.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { findUnhealthyScoringRuns, LOOKBACK_MS } = require("./scoringWatchdog");
const { STALE_LEASE_MS } = require("../helpers/scoringRunGuard");

const NOW = new Date("2026-07-22T08:30:00Z");

// Fake Firestore: scoring_runs docs as { id, ...data }. Applies the single
// startedAt range filter the watchdog issues, like production would.
function makeDb(docs) {
  return {
    collection(name) {
      assert.equal(name, "scoring_runs");
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
