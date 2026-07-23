// Unit tests for ChunkedWriter, the multi-batch WriteBatch replacement used
// by the scoring pipeline. Uses Node's built-in test runner (node:test) so no
// extra dependency is needed in the functions codebase. Run with `npm test`
// inside functions/.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { ChunkedWriter, DEFAULT_MAX_OPS_PER_BATCH } = require("./chunkedWriter");

/**
 * Minimal fake Firestore: db.batch() returns batches that record their ops
 * and commits, so tests can assert how writes were distributed.
 */
function makeFakeDb({ failOnCommitOfBatch = null } = {}) {
  const batches = [];
  return {
    batches,
    batch() {
      const b = {
        ops: [],
        committed: false,
        set(ref, data, options) {
          this.ops.push({ type: "set", ref, data, options });
        },
        update(ref, data) {
          this.ops.push({ type: "update", ref, data });
        },
        delete(ref) {
          this.ops.push({ type: "delete", ref });
        },
        async commit() {
          if (batches.indexOf(b) + 1 === failOnCommitOfBatch) {
            throw new Error("simulated commit failure");
          }
          this.committed = true;
        },
      };
      batches.push(b);
      return b;
    },
  };
}

describe("ChunkedWriter", () => {
  test("keeps writes below the limit in a single batch", async () => {
    const db = makeFakeDb();
    const writer = new ChunkedWriter(db, 10);

    for (let i = 0; i < 10; i++) {
      writer.update(`ref-${i}`, { value: i });
    }

    const result = await writer.commit();
    assert.equal(db.batches.length, 1);
    assert.equal(db.batches[0].ops.length, 10);
    assert.deepEqual(result, { opCount: 10, batchCount: 1 });
  });

  test("rolls over to a new batch at the op limit", async () => {
    const db = makeFakeDb();
    const writer = new ChunkedWriter(db, 3);

    for (let i = 0; i < 8; i++) {
      writer.set(`ref-${i}`, { value: i });
    }

    const result = await writer.commit();
    assert.equal(db.batches.length, 3);
    assert.deepEqual(
      db.batches.map((b) => b.ops.length),
      [3, 3, 2]
    );
    assert.ok(db.batches.every((b) => b.committed));
    assert.deepEqual(result, { opCount: 8, batchCount: 3 });
  });

  test("handles thousands of ops without a 500-op batch", async () => {
    const db = makeFakeDb();
    const writer = new ChunkedWriter(db); // default chunk size

    // Simulates a 5000-user scoring night: profile update + coin increment
    // + coin history entry per user.
    for (let i = 0; i < 5000; i++) {
      writer.update(`profile-${i}`, { score: i });
      writer.update(`profile-${i}`, { corpsCoin: "increment" });
      writer.set(`history-${i}`, { amount: 25 });
    }

    const result = await writer.commit();
    assert.equal(result.opCount, 15000);
    assert.ok(db.batches.every((b) => b.ops.length <= DEFAULT_MAX_OPS_PER_BATCH));
    assert.ok(db.batches.every((b) => b.ops.length <= 500));
    assert.ok(db.batches.every((b) => b.committed));
  });

  test("preserves set options (merge) and op order within a chunk", async () => {
    const db = makeFakeDb();
    const writer = new ChunkedWriter(db, 5);

    writer.set("a", { x: 1 }, { merge: true });
    writer.update("b", { y: 2 });
    writer.delete("c");
    writer.set("d", { z: 3 });

    await writer.commit();
    const ops = db.batches[0].ops;
    assert.deepEqual(ops[0], { type: "set", ref: "a", data: { x: 1 }, options: { merge: true } });
    assert.equal(ops[1].type, "update");
    assert.equal(ops[2].type, "delete");
    // No options argument passed through when the caller omitted it
    assert.deepEqual(ops[3], { type: "set", ref: "d", data: { z: 3 }, options: undefined });
  });

  test("committing an empty writer is a no-op", async () => {
    const db = makeFakeDb();
    const writer = new ChunkedWriter(db, 3);
    const result = await writer.commit();
    assert.deepEqual(result, { opCount: 0, batchCount: 0 });
    assert.equal(db.batches.length, 0);
  });

  test("cannot write or commit after commit", async () => {
    const db = makeFakeDb();
    const writer = new ChunkedWriter(db, 3);
    writer.set("a", { x: 1 });
    await writer.commit();

    assert.throws(() => writer.set("b", { x: 2 }), /already been committed/);
    await assert.rejects(() => writer.commit(), /already been committed/);
  });

  test("annotates commit failures with chunk progress", async () => {
    const db = makeFakeDb({ failOnCommitOfBatch: 2 });
    const writer = new ChunkedWriter(db, 2);

    for (let i = 0; i < 6; i++) {
      writer.update(`ref-${i}`, { value: i });
    }

    const error = await writer.commit().then(
      () => assert.fail("commit should reject"),
      (e) => e
    );
    assert.match(error.message, /failed on chunk 2\/3 .*earlier chunks are already committed/);
    // Machine-readable tear point for structured logging / reconciliation.
    assert.equal(error.committedBatches, 1, "one chunk landed before the failure");
    assert.equal(error.totalBatches, 3);
    assert.equal(error.totalOps, 6);
    assert.equal(db.batches[0].committed, true);
    assert.equal(db.batches[1].committed, false);
  });

  test("rejects invalid chunk sizes", () => {
    const db = makeFakeDb();
    assert.throws(() => new ChunkedWriter(db, 0), /positive integer/);
    assert.throws(() => new ChunkedWriter(db, 1.5), /positive integer/);
  });
});
