// Tests for getAdminInbox (callable/adminInbox.js): the Admin home's queue
// counts + health readout, and its degrade-to-partial behaviour when a read
// fails. node:test; run with `npm test` inside functions/.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe, after } = require("node:test");
const assert = require("node:assert/strict");

const { setDbForTesting } = require("../config");
const { getAdminInbox, buildAdminInbox } = require("./adminInbox");

/**
 * Fake Firestore: `counts[collection][status]` backs the count() queries,
 * `runs[collection]` backs the watchdog's startedAt range query, and `canary`
 * is the admin-stats/scrapeCanary doc. `throwOn` names a collection to fail.
 */
function makeDb({ counts = {}, runs = {}, canary = null, throwOn = null } = {}) {
  return {
    collection(name) {
      return {
        where(field, op, value) {
          return {
            count: () => ({
              async get() {
                if (throwOn === name) throw new Error("boom");
                return { data: () => ({ count: counts[name]?.[value] ?? 0 }) };
              },
            }),
            async get() {
              if (throwOn === name) throw new Error("boom");
              return {
                docs: (runs[name] || []).map((run) => ({ id: run.id, data: () => run })),
              };
            },
          };
        },
      };
    },
    doc(path) {
      assert.equal(path, "admin-stats/scrapeCanary");
      return {
        async get() {
          return { exists: canary !== null, data: () => canary };
        },
      };
    },
  };
}

after(() => setDbForTesting(null));

describe("buildAdminInbox", () => {
  const now = new Date("2026-09-29T12:00:00Z");

  test("returns queue counts, unhealthy runs and the canary verdict", async () => {
    const db = makeDb({
      counts: {
        news_submissions: { pending: 2 },
        article_comments: { pending: 3 },
        article_comments_reports: { pending: 1 },
        reports: { new: 4 },
      },
      runs: {
        scoring_runs: [
          { id: "s1", status: "failed", kind: "scoring", scoredDay: 12, lastError: "x".repeat(400), startedAt: now },
          { id: "s2", status: "completed", startedAt: now },
        ],
      },
      canary: { healthy: false, problems: ["recap table moved"], warnings: [], checkedAt: "2026-09-29T17:00:00Z" },
    });
    const inbox = await buildAdminInbox(db, now);
    assert.deepEqual(inbox.queues, { submissions: 2, comments: 3, reports: 5, available: true });
    assert.equal(inbox.health.unhealthyRuns.length, 1);
    assert.equal(inbox.health.unhealthyRuns[0].id, "s1");
    assert.equal(inbox.health.unhealthyRuns[0].lastError.length, 300);
    assert.equal(inbox.health.scrapeCanary.healthy, false);
    assert.deepEqual(inbox.health.scrapeCanary.problems, ["recap table moved"]);
  });

  test("a failed watchdog read degrades to null instead of failing the inbox", async () => {
    const db = makeDb({ throwOn: "scoring_runs" });
    const inbox = await buildAdminInbox(db, now);
    assert.equal(inbox.queues.available, true);
    // Rollovers still read, so the list exists (empty) rather than null.
    assert.deepEqual(inbox.health.unhealthyRuns, []);
    assert.equal(inbox.health.scrapeCanary, null);
  });
});

describe("getAdminInbox", () => {
  test("is admin-only", async () => {
    setDbForTesting(makeDb());
    await assert.rejects(getAdminInbox.run({ data: {}, auth: { uid: "u1", token: {} } }), /admin/i);
    const res = await getAdminInbox.run({ data: {}, auth: { uid: "a1", token: { admin: true } } });
    assert.equal(res.success, true);
    assert.equal(res.queues.reports, 0);
  });
});
