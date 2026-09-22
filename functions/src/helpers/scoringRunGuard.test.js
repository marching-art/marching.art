// Tests for the daily-scoring idempotency guard (helpers/scoringRunGuard.js).
// A fake Firestore transaction backs the claim so the skip/re-claim rules can
// be asserted without an emulator — the guard is what stands between a
// scheduler redelivery or manual re-trigger and double-awarded CorpsCoin.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  claimScoringRun,
  markScoringRunCompleted,
  markScoringRunFailed,
  recordStageFailure,
  recordSchedulerFailure,
  STALE_LEASE_MS,
} = require("./scoringRunGuard");

const NOW = new Date("2026-07-05T06:05:00Z");

// Fake Firestore where scoring_runs/{id} maps to `store.doc` (or absent).
// Both the transactional claim and the direct ref.set() used by
// markScoringRunCompleted/Failed write through to the same store.
function makeDb(initialDoc) {
  const store = { doc: initialDoc };
  const writes = [];
  const refSets = [];
  const makeRef = (id) => ({
    id,
    async set(data, options) {
      refSets.push({ id, data, options });
      store.doc = { ...(options?.merge ? store.doc : {}), ...data };
    },
  });
  const db = {
    collection(name) {
      assert.equal(name, "scoring_runs");
      return { doc: makeRef };
    },
    async runTransaction(fn) {
      const transaction = {
        async get() {
          return { exists: store.doc !== undefined, data: () => store.doc };
        },
        set(ref, data) {
          writes.push({ id: ref.id, data });
          store.doc = data;
        },
      };
      return fn(transaction);
    },
  };
  return { db, writes, refSets, store };
}

describe("claimScoringRun", () => {
  test("claims an unprocessed day and records the attempt", async () => {
    const { db, writes } = makeDb(undefined);
    const result = await claimScoringRun(db, "s2026", 5, { now: NOW });

    assert.deepEqual(result, { claimed: true });
    assert.equal(writes.length, 1);
    assert.equal(writes[0].id, "s2026_day5");
    assert.equal(writes[0].data.status, "running");
    assert.equal(writes[0].data.attempts, 1);
    assert.equal(writes[0].data.seasonUid, "s2026");
    assert.equal(writes[0].data.scoredDay, 5);
  });

  test("stamps kind 'scoring' by default and passes an explicit kind through", async () => {
    const scoring = makeDb(undefined);
    await claimScoringRun(scoring.db, "s2026", 5, { now: NOW });
    assert.equal(scoring.writes[0].data.kind, "scoring");

    // Announcement leases (Discord posts etc.) mark themselves so the
    // watchdog can report their failures as warnings, not critical.
    const announce = makeDb(undefined);
    await claimScoringRun(announce.db, "s2026_discord", 5, { now: NOW, kind: "announce" });
    assert.equal(announce.writes[0].data.kind, "announce");
  });

  test("skips a day that already completed", async () => {
    const { db, writes } = makeDb({ status: "completed", attempts: 1 });
    const result = await claimScoringRun(db, "s2026", 5, { now: NOW });

    assert.deepEqual(result, { claimed: false, reason: "completed" });
    assert.equal(writes.length, 0);
  });

  test("skips a run that is currently in progress", async () => {
    const startedAt = new Date(NOW.getTime() - 60 * 1000); // 1 minute ago
    const { db, writes } = makeDb({ status: "running", startedAt, attempts: 1 });
    const result = await claimScoringRun(db, "s2026", 5, { now: NOW });

    assert.deepEqual(result, { claimed: false, reason: "in-progress" });
    assert.equal(writes.length, 0);
  });

  test("re-claims a stale running claim from a crashed run", async () => {
    const startedAt = new Date(NOW.getTime() - STALE_LEASE_MS - 1000);
    const { db, writes } = makeDb({ status: "running", startedAt, attempts: 1 });
    const result = await claimScoringRun(db, "s2026", 5, { now: NOW });

    assert.deepEqual(result, { claimed: true });
    assert.equal(writes[0].data.status, "running");
    assert.equal(writes[0].data.attempts, 2);
  });

  test("re-claims immediately after a failed run", async () => {
    const { db, writes } = makeDb({ status: "failed", attempts: 2 });
    const result = await claimScoringRun(db, "s2026", 5, { now: NOW });

    assert.deepEqual(result, { claimed: true });
    assert.equal(writes[0].data.attempts, 3);
  });

  test("force re-claims even a completed day and flags it", async () => {
    const { db, writes } = makeDb({ status: "completed", attempts: 1 });
    const result = await claimScoringRun(db, "s2026", 5, { force: true, now: NOW });

    assert.deepEqual(result, { claimed: true });
    assert.equal(writes[0].data.status, "running");
    assert.equal(writes[0].data.forced, true);
    assert.equal(writes[0].data.attempts, 2);
  });

  test("a second claim after a successful one is rejected", async () => {
    const { db } = makeDb(undefined);
    const first = await claimScoringRun(db, "s2026", 5, { now: NOW });
    const second = await claimScoringRun(db, "s2026", 5, {
      now: new Date(NOW.getTime() + 1000),
    });

    assert.equal(first.claimed, true);
    assert.deepEqual(second, { claimed: false, reason: "in-progress" });
  });

  test("reads startedAt back through a Firestore Timestamp", async () => {
    // In production startedAt round-trips as a Timestamp with .toDate().
    const startedAt = { toDate: () => new Date(NOW.getTime() - 60 * 1000) };
    const { db } = makeDb({ status: "running", startedAt, attempts: 1 });
    const result = await claimScoringRun(db, "s2026", 5, { now: NOW });

    assert.deepEqual(result, { claimed: false, reason: "in-progress" });
  });
});

describe("markScoringRunCompleted / markScoringRunFailed", () => {
  test("completed merges status and details onto the run doc", async () => {
    const { db, refSets } = makeDb({ status: "running", attempts: 1 });
    await markScoringRunCompleted(db, "s2026", 5, { opCount: 42, batchCount: 1 });

    assert.equal(refSets.length, 1);
    assert.equal(refSets[0].id, "s2026_day5");
    assert.equal(refSets[0].data.status, "completed");
    assert.equal(refSets[0].data.opCount, 42);
    assert.deepEqual(refSets[0].options, { merge: true });
  });

  test("failed records the error message", async () => {
    const { db, refSets } = makeDb({ status: "running", attempts: 1 });
    await markScoringRunFailed(db, "s2026", 5, new Error("commit exploded"));

    assert.equal(refSets[0].data.status, "failed");
    assert.equal(refSets[0].data.lastError, "commit exploded");
  });

  test("failed never throws, even when the marker write itself fails", async () => {
    const db = {
      collection: () => ({
        doc: () => ({
          set: async () => {
            throw new Error("firestore down");
          },
        }),
      }),
    };
    // Must resolve — the original scoring error has to propagate, not this one.
    await markScoringRunFailed(db, "s2026", 5, new Error("original"));
  });
});

// Failure markers: the isolated stages and the season scheduler write these
// so a failure that never held a lease still reaches the 4:30 AM watchdog.
describe("failure markers", () => {
  // 2026-07-05T06:05Z is 02:05 ET, so the Eastern date key is 2026-07-05.
  function makeMarkerDb(expectedCollection) {
    const sets = [];
    return {
      sets,
      db: {
        collection(name) {
          assert.equal(name, expectedCollection);
          return {
            doc: (id) => ({
              id,
              async set(data, options) {
                sets.push({ id, data, options });
              },
            }),
          };
        },
      },
    };
  }

  test("recordStageFailure writes a failed, dated scoring_runs marker keyed by stage", async () => {
    const { db, sets } = makeMarkerDb("scoring_runs");
    await recordStageFailure(db, "discord-stage", new Error("webhook 502"), { now: NOW });

    assert.equal(sets.length, 1);
    assert.equal(sets[0].id, "stage_discord-stage_2026-07-05");
    assert.deepEqual(sets[0].options, { merge: true });
    const { attempts, ...rest } = sets[0].data;
    assert.deepEqual(rest, {
      kind: "announce",
      stage: "discord-stage",
      status: "failed",
      startedAt: NOW,
      failedAt: NOW,
      lastError: "webhook 502",
    });
    // attempts is a FieldValue.increment so a retried night merges into one doc.
    assert.ok(attempts && typeof attempts === "object");
  });

  test("recordStageFailure honors kind 'scoring' for stages that carry results", async () => {
    const { db, sets } = makeMarkerDb("scoring_runs");
    await recordStageFailure(db, "podium-nightly", "plain string error", { kind: "scoring", now: NOW });

    assert.equal(sets[0].data.kind, "scoring");
    assert.equal(sets[0].data.lastError, "plain string error");
  });

  test("recordSchedulerFailure writes a dated season_rollovers marker with the season", async () => {
    const { db, sets } = makeMarkerDb("season_rollovers");
    await recordSchedulerFailure(db, new Error("rankings missing"), { seasonUid: "live_2025-26", now: NOW });

    assert.equal(sets[0].id, "scheduler_2026-07-05");
    assert.equal(sets[0].data.kind, "scheduler");
    assert.equal(sets[0].data.seasonUid, "live_2025-26");
    assert.equal(sets[0].data.status, "failed");
    assert.equal(sets[0].data.lastError, "rankings missing");
  });

  test("markers never throw — a marker write failure must not replace the real error", async () => {
    const db = {
      collection: () => ({ doc: () => ({ id: "x", set: async () => { throw new Error("db down"); } }) }),
    };
    await assert.doesNotReject(() => recordStageFailure(db, "showcase-stage", new Error("boom"), { now: NOW }));
    await assert.doesNotReject(() => recordSchedulerFailure(db, new Error("boom"), { now: NOW }));
  });
});
