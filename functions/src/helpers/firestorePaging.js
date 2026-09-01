const admin = require("firebase-admin");

/**
 * Process every document in a collection in pages, so a collection that grows
 * past a single query's cap is fully covered instead of silently truncated.
 *
 * The nightly league jobs used `collection(...).limit(500).get()` and fanned
 * out over the result. That silently dropped every league past the 500th — the
 * exact failure that appears once the game succeeds at its stated scale
 * ("hundreds of active ensembles"). This walks the whole collection in pages,
 * awaiting each page's processing before fetching the next so at most `pageSize`
 * documents are in flight at once (bounded parallelism and memory).
 *
 * `concurrency` bounds how many `processDoc` calls run at once WITHIN a page.
 * It defaults to the page size (the historical behaviour: a page of 500 fans
 * out 500 at once), which is fine for a projection but not for a callback
 * that itself issues a burst of reads — the league jobs do a 50-profile
 * getAll, a standings read, and a matchup-collection read per league, so a
 * 500-league page meant thousands of simultaneous reads inside a 512 MiB
 * function. Those callers pass a small concurrency and keep the large page.
 *
 * @template T
 * @param {FirebaseFirestore.CollectionReference|FirebaseFirestore.Query} collectionRef
 * @param {number} pageSize - Documents per page.
 * @param {(doc: FirebaseFirestore.QueryDocumentSnapshot) => Promise<T>} processDoc
 * @param {{ concurrency?: number }} [options]
 * @returns {Promise<T[]>} Results from processDoc, in document-id order.
 */
async function processAllInPages(collectionRef, pageSize, processDoc, options = {}) {
  const results = [];
  let cursor = null;
  const concurrency = Math.max(1, Math.min(pageSize, options.concurrency || pageSize));

  // Order by document id so pagination is stable and startAfter is well-defined.
  for (;;) {
    let query = collectionRef.orderBy(admin.firestore.FieldPath.documentId()).limit(pageSize);
    if (cursor) query = query.startAfter(cursor);

    const snap = await query.get();
    if (snap.empty) break;

    for (let i = 0; i < snap.docs.length; i += concurrency) {
      const chunk = snap.docs.slice(i, i + concurrency);
      const chunkResults = await Promise.all(chunk.map((doc) => processDoc(doc)));
      results.push(...chunkResults);
    }

    // A short page means we've reached the end; stop before an empty round-trip.
    if (snap.docs.length < pageSize) break;
    cursor = snap.docs[snap.docs.length - 1];
  }

  return results;
}

module.exports = { processAllInPages };
