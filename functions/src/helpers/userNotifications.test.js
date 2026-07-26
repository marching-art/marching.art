// Unit tests for the shared in-app notification writer. The contract that
// matters: doc shape compatibility with the client hooks (read/createdAt/
// type/title/message + passthrough extras like leagueId), best-effort
// semantics (never throw into the parent job), and dedupeKey idempotence.
// Uses Node's built-in test runner — run with `npm test` inside functions/.

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  buildNotificationDoc,
  createUserNotification,
  createUserNotifications,
} = require("./userNotifications");

// Force the paths namespace so expectations are stable regardless of env.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "marching-art";

/**
 * Minimal fake Firestore covering exactly what the writer touches:
 * collection().doc([id]) refs with set(), plus batch() for ChunkedWriter.
 * Records every write (direct and batched) as {path, id, data}.
 */
function makeFakeDb({ failBatchCommit = false, failSet = false } = {}) {
  const writes = [];
  let autoId = 0;

  const makeRef = (collectionPath, id) => {
    const refId = id || `auto-${++autoId}`;
    return {
      id: refId,
      path: `${collectionPath}/${refId}`,
      async set(data) {
        if (failSet) throw new Error("set failed");
        writes.push({ path: this.path, id: refId, data });
      },
    };
  };

  return {
    writes,
    collection(collectionPath) {
      return {
        doc(id) {
          return makeRef(collectionPath, id);
        },
      };
    },
    batch() {
      const ops = [];
      return {
        set(ref, data) {
          ops.push({ ref, data });
        },
        async commit() {
          if (failBatchCommit) throw new Error("commit failed");
          for (const op of ops) {
            writes.push({ path: op.ref.path, id: op.ref.id, data: op.data });
          }
        },
      };
    },
  };
}

const VALID = {
  type: "score_drop",
  title: "Day 12 scores are in",
  message: "Blue Stars scored 78.4 tonight.",
};

describe("buildNotificationDoc", () => {
  test("builds the client-compatible shape with read:false", () => {
    const doc = buildNotificationDoc({
      ...VALID,
      link: "/scores?src=inbox",
      metadata: { scoredDay: "12" },
    });
    assert.deepEqual(doc, {
      type: "score_drop",
      title: "Day 12 scores are in",
      message: "Blue Stars scored 78.4 tonight.",
      read: false,
      link: "/scores?src=inbox",
      metadata: { scoredDay: "12" },
    });
  });

  test("passes extra fields through (league doc compatibility)", () => {
    const doc = buildNotificationDoc({
      ...VALID,
      type: "league_invite",
      leagueId: "league-1",
      leagueName: "Brass Bosses",
    });
    assert.equal(doc.leagueId, "league-1");
    assert.equal(doc.leagueName, "Brass Bosses");
  });

  test("never leaks dedupeKey or uid into the doc body", () => {
    const doc = buildNotificationDoc({ ...VALID, dedupeKey: "k", uid: "u1" });
    assert.ok(!("dedupeKey" in doc));
    assert.ok(!("uid" in doc));
  });

  test("rejects entries missing type, title, or message", () => {
    assert.equal(buildNotificationDoc(null), null);
    assert.equal(buildNotificationDoc({ ...VALID, type: undefined }), null);
    assert.equal(buildNotificationDoc({ ...VALID, title: "   " }), null);
    assert.equal(buildNotificationDoc({ ...VALID, message: "" }), null);
  });

  test("clamps runaway text", () => {
    const doc = buildNotificationDoc({
      ...VALID,
      title: "t".repeat(1000),
      message: "m".repeat(5000),
    });
    assert.ok(doc.title.length <= 120);
    assert.ok(doc.message.length <= 500);
  });
});

describe("createUserNotification", () => {
  test("writes id/userId/createdAt and returns the doc id", async () => {
    const db = makeFakeDb();
    const id = await createUserNotification(db, "user-1", VALID);
    assert.equal(db.writes.length, 1);
    const write = db.writes[0];
    assert.equal(write.data.id, id);
    assert.equal(write.data.userId, "user-1");
    assert.equal(write.data.read, false);
    assert.ok(write.data.createdAt, "createdAt sentinel must be stamped");
    assert.ok(write.path.includes("/users/user-1/notifications/"));
  });

  test("dedupeKey addresses a deterministic, sanitized doc id", async () => {
    const db = makeFakeDb();
    const id = await createUserNotification(db, "user-1", {
      ...VALID,
      dedupeKey: "score drop/day 12",
    });
    assert.equal(id, "score_drop_day_12");
  });

  test("never throws: skips malformed input and swallows write failures", async () => {
    const db = makeFakeDb({ failSet: true });
    assert.equal(await createUserNotification(db, "user-1", VALID), null);
    assert.equal(await createUserNotification(makeFakeDb(), "user-1", { type: "x" }), null);
    assert.equal(await createUserNotification(makeFakeDb(), "", VALID), null);
  });
});

describe("createUserNotifications", () => {
  test("fans out one doc per valid entry, counting skips", async () => {
    const db = makeFakeDb();
    const result = await createUserNotifications(db, [
      { uid: "a", ...VALID },
      { uid: "b", ...VALID, dedupeKey: "score_drop_s1_12" },
      { uid: "", ...VALID }, // no recipient
      { uid: "c", type: "score_drop" }, // no title/message
    ]);
    assert.deepEqual(result, { written: 2, skipped: 2 });
    assert.equal(db.writes.length, 2);
    assert.equal(db.writes[1].id, "score_drop_s1_12");
    assert.ok(db.writes[0].path.includes("/users/a/notifications/"));
    assert.ok(db.writes[1].path.includes("/users/b/notifications/"));
  });

  test("never throws when the batched commit fails", async () => {
    const db = makeFakeDb({ failBatchCommit: true });
    const result = await createUserNotifications(db, [{ uid: "a", ...VALID }]);
    // Best-effort: the failure is logged, nothing propagates to the job.
    assert.equal(db.writes.length, 0);
    assert.equal(result.skipped, 0);
  });

  test("handles empty and invalid entry lists", async () => {
    assert.deepEqual(await createUserNotifications(makeFakeDb(), []), {
      written: 0,
      skipped: 0,
    });
    assert.deepEqual(await createUserNotifications(makeFakeDb(), null), {
      written: 0,
      skipped: 0,
    });
  });
});
