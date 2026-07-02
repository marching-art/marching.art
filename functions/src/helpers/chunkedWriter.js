/**
 * ChunkedWriter — a drop-in replacement for a Firestore WriteBatch that
 * splits writes across multiple underlying batches.
 *
 * Firestore batched writes are capped per request (historically 500 writes,
 * and field transforms like increment/arrayUnion count double toward that
 * limit; current servers cap the request at 10 MiB). The nightly scoring run
 * queues one or more writes per active user plus coin history, trophies, and
 * recap docs in a single batch, so a single WriteBatch stops scaling with the
 * player base. ChunkedWriter exposes the same set/update/delete/commit
 * surface but transparently rolls over to a new batch every `maxOpsPerBatch`
 * operations and commits the batches sequentially.
 *
 * Trade-off: unlike a single WriteBatch, a multi-batch commit is not atomic.
 * If a chunk fails mid-commit, earlier chunks are already durable. Callers
 * (scheduled scoring jobs) treat writes as idempotent sets where possible;
 * commit() reports how many chunks were committed so failures can be
 * diagnosed from logs.
 */

// Conservative default: 200 ops leaves ample headroom for the legacy
// 500-write-unit limit even when every op carries a field transform
// (which counts as an extra write unit), and keeps requests far below
// the 10 MiB request-size cap.
const DEFAULT_MAX_OPS_PER_BATCH = 200;

class ChunkedWriter {
  /**
   * @param {FirebaseFirestore.Firestore} db - Firestore instance
   * @param {number} [maxOpsPerBatch] - Writes per underlying batch
   */
  constructor(db, maxOpsPerBatch = DEFAULT_MAX_OPS_PER_BATCH) {
    if (!Number.isInteger(maxOpsPerBatch) || maxOpsPerBatch < 1) {
      throw new Error(`maxOpsPerBatch must be a positive integer, got ${maxOpsPerBatch}`);
    }
    this._db = db;
    this._maxOpsPerBatch = maxOpsPerBatch;
    this._batches = [];
    this._opsInCurrentBatch = 0;
    this._totalOps = 0;
    this._committed = false;
  }

  /** Number of writes queued so far. */
  get opCount() {
    return this._totalOps;
  }

  /** Number of underlying batches created so far. */
  get batchCount() {
    return this._batches.length;
  }

  _nextBatch() {
    if (this._committed) {
      throw new Error("ChunkedWriter has already been committed.");
    }
    if (
      this._batches.length === 0 ||
      this._opsInCurrentBatch >= this._maxOpsPerBatch
    ) {
      this._batches.push(this._db.batch());
      this._opsInCurrentBatch = 0;
    }
    this._opsInCurrentBatch++;
    this._totalOps++;
    return this._batches[this._batches.length - 1];
  }

  set(ref, data, options) {
    const batch = this._nextBatch();
    if (options === undefined) {
      batch.set(ref, data);
    } else {
      batch.set(ref, data, options);
    }
    return this;
  }

  update(ref, data) {
    this._nextBatch().update(ref, data);
    return this;
  }

  delete(ref) {
    this._nextBatch().delete(ref);
    return this;
  }

  /**
   * Commit all queued batches sequentially.
   *
   * @returns {Promise<{ opCount: number, batchCount: number }>}
   * @throws The first commit error, annotated with how many chunks landed.
   */
  async commit() {
    if (this._committed) {
      throw new Error("ChunkedWriter has already been committed.");
    }
    this._committed = true;

    let committedBatches = 0;
    for (const batch of this._batches) {
      try {
        await batch.commit();
        committedBatches++;
      } catch (error) {
        error.message =
          `ChunkedWriter commit failed on chunk ${committedBatches + 1}/` +
          `${this._batches.length} (${this._totalOps} ops total; earlier ` +
          `chunks are already committed): ${error.message}`;
        throw error;
      }
    }

    return { opCount: this._totalOps, batchCount: committedBatches };
  }
}

module.exports = { ChunkedWriter, DEFAULT_MAX_OPS_PER_BATCH };
