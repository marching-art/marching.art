// consumeRateBudget: the abuse throttle behind assertWriteBudget and league
// chat. Pins that the count is consumed atomically inside a transaction, that
// the window resets, that contention denies, and that other failures still
// fail open. node:test; `npm test` in functions/.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { consumeRateBudget, isContentionError } = require("./rateLimit");

/** Fake Firestore whose runTransaction serializes and applies tx.set. */
function makeFakeDb({ failWith } = {}) {
  const docs = new Map();
  let transactions = 0;
  let directWrites = 0;
  const db = {
    collection(name) {
      return {
        doc(id) {
          return {
            path: `${name}/${id}`,
            async get() {
              throw new Error("budget must be read inside the transaction");
            },
            async set() {
              directWrites += 1;
            },
          };
        },
      };
    },
    async runTransaction(fn) {
      transactions += 1;
      if (failWith) throw failWith;
      const tx = {
        async get(ref) {
          const data = docs.get(ref.path);
          return { exists: data !== undefined, data: () => data };
        },
        set(ref, data) {
          docs.set(ref.path, data);
        },
      };
      return fn(tx);
    },
  };
  return { db, docs, counters: { get transactions() { return transactions; }, get directWrites() { return directWrites; } } };
}

describe("consumeRateBudget", () => {
  test("admits exactly maxPerWindow calls, then denies, all inside transactions", async () => {
    const { db, counters } = makeFakeDb();
    const results = [];
    for (let i = 0; i < 5; i += 1) {
      results.push(await consumeRateBudget(db, "rate_test", "u1", 3, 60_000));
    }
    assert.deepEqual(results, [true, true, true, false, false]);
    assert.equal(counters.transactions, 5);
    assert.equal(counters.directWrites, 0);
  });

  test("a spent window resets once it expires", async () => {
    const { db, docs } = makeFakeDb();
    assert.equal(await consumeRateBudget(db, "rate_test", "u1", 1, 60_000), true);
    assert.equal(await consumeRateBudget(db, "rate_test", "u1", 1, 60_000), false);
    // Age the window past its length.
    const doc = docs.get("rate_test/u1");
    docs.set("rate_test/u1", { ...doc, windowStart: doc.windowStart - 61_000 });
    assert.equal(await consumeRateBudget(db, "rate_test", "u1", 1, 60_000), true);
    assert.equal(docs.get("rate_test/u1").count, 1);
  });

  test("contention (a same-uid burst) denies", async () => {
    const aborted = Object.assign(new Error("10 ABORTED: Too much contention on these documents."), { code: 10 });
    const { db } = makeFakeDb({ failWith: aborted });
    assert.equal(await consumeRateBudget(db, "rate_test", "u1", 30, 60_000), false);
  });

  test("any other bookkeeping failure fails open", async () => {
    const { db } = makeFakeDb({ failWith: new Error("network down") });
    assert.equal(await consumeRateBudget(db, "rate_test", "u1", 30, 60_000), true);
  });

  test("isContentionError recognizes the gRPC code and message shapes", () => {
    assert.equal(isContentionError({ code: 10 }), true);
    assert.equal(isContentionError({ code: "aborted" }), true);
    assert.equal(isContentionError(new Error("Transaction aborted after retries")), true);
    assert.equal(isContentionError(new Error("permission denied")), false);
    assert.equal(isContentionError(null), false);
  });
});
