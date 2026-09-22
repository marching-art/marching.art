// Tests for the daily season scheduler's routing and — the part that used to
// be missing — its failure path (scheduled/seasonScheduler.js). A rollover
// that threw used to leave no marker for the 4:30 AM watchdog and page no one;
// now it records season_rollovers/scheduler_{date}, posts to #operations, and
// rethrows so Cloud Scheduler retries.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { runSeasonScheduler } = require("./seasonScheduler");

// 2026-07-05T07:00Z = 03:00 ET, the scheduler's slot.
const NOW = new Date("2026-07-05T07:00:00Z");
const asTimestamp = (date) => ({ toDate: () => date });

function makeDb(seasonDoc) {
  return {
    doc(path) {
      assert.equal(path, "game-settings/season");
      return {
        async get() {
          return { exists: seasonDoc !== undefined, data: () => seasonDoc };
        },
      };
    },
  };
}

// Every collaborator recorded, none of them real.
function makeDeps(overrides = {}) {
  const calls = { startLive: [], startOff: [], announce: 0, failures: [], alerts: [] };
  const deps = {
    startLive: async (opts) => { calls.startLive.push(opts); },
    startOff: async (opts) => { calls.startOff.push(opts); },
    isLive: () => false,
    finalsOverridesFor: async () => ({}),
    announce: async () => { calls.announce += 1; },
    recordFailure: async (db, error, opts) => { calls.failures.push({ error, ...opts }); },
    alert: async (params) => { calls.alerts.push(params); },
    ...overrides,
  };
  return { deps, calls };
}

describe("runSeasonScheduler routing", () => {
  test("an active season is left alone", async () => {
    const { deps, calls } = makeDeps();
    const db = makeDb({
      seasonUid: "off_2026_5", name: "off_2026_5",
      schedule: { endDate: asTimestamp(new Date("2026-07-20T06:00:00Z")) },
    });
    const result = await runSeasonScheduler(db, { now: NOW, deps });

    assert.deepEqual(result, { action: "active", seasonUid: "off_2026_5" });
    assert.equal(calls.startOff.length + calls.startLive.length, 0);
    assert.equal(calls.announce, 0);
    assert.equal(calls.failures.length, 0);
  });

  test("an ended season rolls into the phase the calendar names, then announces", async () => {
    const { deps, calls } = makeDeps({ isLive: () => true });
    const db = makeDb({
      seasonUid: "off_2026_5", name: "off_2026_5",
      schedule: { endDate: asTimestamp(new Date("2026-07-05T06:00:00Z")) },
    });
    const result = await runSeasonScheduler(db, { now: NOW, deps });

    assert.deepEqual(result, { action: "rolled-over", seasonUid: "off_2026_5" });
    assert.deepEqual(calls.startLive, [{ force: false }]);
    assert.equal(calls.startOff.length, 0);
    assert.equal(calls.announce, 1);
  });

  test("a missing season doc bootstraps; a malformed one is regenerated in place (force)", async () => {
    const boot = makeDeps();
    assert.deepEqual(
      await runSeasonScheduler(makeDb(undefined), { now: NOW, deps: boot.deps }),
      { action: "bootstrapped", seasonUid: null },
    );
    assert.deepEqual(boot.calls.startOff, [{ force: false }]);

    const repair = makeDeps();
    assert.deepEqual(
      await runSeasonScheduler(makeDb({ seasonUid: "off_2026_5", schedule: {} }), { now: NOW, deps: repair.deps }),
      { action: "repaired", seasonUid: "off_2026_5" },
    );
    assert.deepEqual(repair.calls.startOff, [{ force: true }]);
  });
});

describe("runSeasonScheduler failure path", () => {
  test("a thrown rollover is marked, paged as critical, and rethrown for the retry", async () => {
    const boom = new Error("Cannot start live season: Final rankings for 2025 not found.");
    const { deps, calls } = makeDeps({
      isLive: () => true,
      startLive: async () => { throw boom; },
    });
    const db = makeDb({
      seasonUid: "off_2026_5", name: "off_2026_5",
      schedule: { endDate: asTimestamp(new Date("2026-07-05T06:00:00Z")) },
    });

    await assert.rejects(() => runSeasonScheduler(db, { now: NOW, deps }), boom);

    assert.equal(calls.failures.length, 1);
    assert.equal(calls.failures[0].error, boom);
    assert.equal(calls.failures[0].seasonUid, "off_2026_5");
    assert.equal(calls.failures[0].now, NOW);

    assert.equal(calls.alerts.length, 1);
    assert.equal(calls.alerts[0].severity, "critical");
    assert.equal(calls.alerts[0].source, "season-scheduler");
    assert.ok(calls.alerts[0].details.some((d) => d.includes("off_2026_5")));
    assert.ok(calls.alerts[0].details.some((d) => d.includes(boom.message)));
    // The announcement never ran — nothing new to announce.
    assert.equal(calls.announce, 0);
  });

  test("a failure reading the season doc itself is still marked (seasonUid unknown)", async () => {
    const { deps, calls } = makeDeps();
    const db = { doc: () => ({ get: async () => { throw new Error("firestore unavailable"); } }) };

    await assert.rejects(() => runSeasonScheduler(db, { now: NOW, deps }), /firestore unavailable/);
    assert.equal(calls.failures[0].seasonUid, null);
    assert.equal(calls.alerts.length, 1);
  });
});
