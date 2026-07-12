// Unit tests for the paginated collection processor. Uses a fake Firestore
// query that supports the orderBy/limit/startAfter/get chain the helper builds.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { processAllInPages } = require("./firestorePaging");

// A fake collection over an in-memory array of { id, value }. Cursor is a doc
// snapshot ({ id }); paging slices the array by id order.
function fakeCollection(items, calls) {
  const makeQuery = (afterId, lim) => ({
    orderBy: () => makeQuery(afterId, lim),
    limit: (n) => makeQuery(afterId, n),
    startAfter: (docSnap) => makeQuery(docSnap.id, lim),
    get: async () => {
      if (calls) calls.pages++;
      let start = 0;
      if (afterId != null) start = items.findIndex((d) => d.id === afterId) + 1;
      const slice = items.slice(start, lim != null ? start + lim : undefined);
      return {
        empty: slice.length === 0,
        docs: slice.map((d) => ({ id: d.id, data: () => ({ value: d.value }) })),
      };
    },
  });
  return makeQuery(null, null);
}

const mkItems = (n) => Array.from({ length: n }, (_, i) => ({ id: `L${i}`, value: i }));

describe("processAllInPages", () => {
  test("covers every document across multiple pages (no silent cap)", async () => {
    const items = mkItems(1250); // > 2 pages of 500
    const seen = [];
    const results = await processAllInPages(fakeCollection(items), 500, async (doc) => {
      seen.push(doc.id);
      return doc.data().value * 2;
    });
    assert.equal(seen.length, 1250, "every league processed");
    assert.equal(results.length, 1250);
    assert.equal(results[0], 0);
    assert.equal(results[1249], 2498);
  });

  test("stops after a short page without an extra empty read", async () => {
    const calls = { pages: 0 };
    const items = mkItems(600); // one full page (500) + a short page (100)
    await processAllInPages(fakeCollection(items, calls), 500, async () => null);
    assert.equal(calls.pages, 2, "full page then short page, no trailing empty read");
  });

  test("does exactly one read when the collection fits in a page", async () => {
    const calls = { pages: 0 };
    await processAllInPages(fakeCollection(mkItems(10), calls), 500, async () => null);
    assert.equal(calls.pages, 1);
  });

  test("returns an empty array for an empty collection", async () => {
    const calls = { pages: 0 };
    const results = await processAllInPages(fakeCollection([], calls), 500, async () => "x");
    assert.deepEqual(results, []);
    assert.equal(calls.pages, 1);
  });

  test("processes at most pageSize docs concurrently", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    await processAllInPages(fakeCollection(mkItems(300)), 100, async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await Promise.resolve();
      inFlight--;
    });
    assert.ok(maxInFlight <= 100, `max concurrency ${maxInFlight} should be <= pageSize`);
  });
});
