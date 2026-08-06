// Tests for the pending-approvals digest (scheduled/pendingApprovalsDigest.js).
// A fake Firestore backs the three count() queries so the queue tallies and the
// "only alert when something is waiting" behaviour can be asserted without an
// emulator.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  computePendingApprovals,
  runPendingApprovalsDigest,
} = require("./pendingApprovalsDigest");

// Fake Firestore. `counts` maps collection name -> pending count returned by
// its count() aggregation. `throwOn` names a collection whose query should
// reject, to exercise the swallow-to-0 path. Records doc.set() writes.
function makeDb(counts, { throwOn } = {}) {
  const writes = [];
  return {
    _writes: writes,
    collection(name) {
      return {
        where(field, op, value) {
          assert.equal(field, "status");
          assert.equal(op, "==");
          assert.equal(value, "pending");
          return {
            count() {
              return {
                async get() {
                  if (throwOn === name) throw new Error("boom");
                  return { data: () => ({ count: counts[name] ?? 0 }) };
                },
              };
            },
          };
        },
      };
    },
    doc(path) {
      return {
        async set(data) {
          writes.push({ path, data });
        },
      };
    },
  };
}

describe("computePendingApprovals", () => {
  test("tallies each queue and the total", async () => {
    const db = makeDb({
      news_submissions: 2,
      article_comments: 5,
      article_comments_reports: 1,
    });
    assert.deepEqual(await computePendingApprovals(db), {
      pendingArticles: 2,
      pendingComments: 5,
      pendingReports: 1,
      total: 8,
    });
  });

  test("a broken queue query counts as 0 rather than failing the whole run", async () => {
    const db = makeDb(
      { news_submissions: 3, article_comments: 4, article_comments_reports: 2 },
      { throwOn: "article_comments" }
    );
    const result = await computePendingApprovals(db);
    assert.equal(result.pendingComments, 0);
    assert.equal(result.pendingArticles, 3);
    assert.equal(result.pendingReports, 2);
    assert.equal(result.total, 5);
  });
});

describe("runPendingApprovalsDigest", () => {
  test("persists a snapshot and does not notify when every queue is empty", async () => {
    const db = makeDb({
      news_submissions: 0,
      article_comments: 0,
      article_comments_reports: 0,
    });
    // A falsy webhook keeps postOpsAlert disabled; the email fan-out finds no
    // admins in this bare fake and no-ops. The assertion of interest is
    // notified === false and the persisted snapshot.
    const result = await runPendingApprovalsDigest(db, "");
    assert.equal(result.notified, false);
    assert.equal(result.total, 0);

    assert.equal(db._writes.length, 1);
    assert.equal(db._writes[0].path, "admin-stats/pendingApprovalsDigest");
    assert.equal(db._writes[0].data.total, 0);
    assert.ok(typeof db._writes[0].data.checkedAt === "string");
  });

  test("notifies when at least one queue has items", async () => {
    const db = makeDb({
      news_submissions: 1,
      article_comments: 0,
      article_comments_reports: 0,
    });
    const result = await runPendingApprovalsDigest(db, "");
    assert.equal(result.notified, true);
    assert.equal(result.total, 1);
    assert.equal(db._writes[0].data.pendingArticles, 1);
  });
});
