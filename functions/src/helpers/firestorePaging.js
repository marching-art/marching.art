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
 * @template T
 * @param {FirebaseFirestore.CollectionReference|FirebaseFirestore.Query} collectionRef
 * @param {number} pageSize - Documents per page (also the max concurrency).
 * @param {(doc: FirebaseFirestore.QueryDocumentSnapshot) => Promise<T>} processDoc
 * @returns {Promise<T[]>} Results from processDoc, in document-id order.
 */
async function processAllInPages(collectionRef, pageSize, processDoc) {
  const results = [];
  let cursor = null;

  // Order by document id so pagination is stable and startAfter is well-defined.
  for (;;) {
    let query = collectionRef.orderBy(admin.firestore.FieldPath.documentId()).limit(pageSize);
    if (cursor) query = query.startAfter(cursor);

    const snap = await query.get();
    if (snap.empty) break;

    const pageResults = await Promise.all(snap.docs.map((doc) => processDoc(doc)));
    results.push(...pageResults);

    // A short page means we've reached the end; stop before an empty round-trip.
    if (snap.docs.length < pageSize) break;
    cursor = snap.docs[snap.docs.length - 1];
  }

  return results;
}

module.exports = { processAllInPages };
