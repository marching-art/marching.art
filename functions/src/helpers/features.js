/**
 * Runtime feature flags (Phase 1.5, PODIUM.md).
 *
 * Flags live in the Firestore doc `game-settings/features` so a rollout or
 * rollback is a config write, never a deploy. A missing doc or missing field
 * means OFF — the safe default for every gated feature.
 *
 * Reads are memoized per function instance for a short window: the nightly
 * stage reads once per run, and future callables must not pay a Firestore
 * read on every invocation.
 */

const FEATURES_DOC = "game-settings/features";
const CACHE_TTL_MS = 60 * 1000;

let cache = { at: 0, data: null };

/**
 * All feature flags as a plain object ({} when the doc doesn't exist).
 * @param {FirebaseFirestore.Firestore} db
 * @param {{now?: Date}} [opts] injectable clock for tests
 * @returns {Promise<object>}
 */
async function getFeatures(db, { now = new Date() } = {}) {
  if (cache.data && now.getTime() - cache.at < CACHE_TTL_MS) return cache.data;
  const snapshot = await db.doc(FEATURES_DOC).get();
  const data = snapshot.exists ? snapshot.data() : {};
  cache = { at: now.getTime(), data };
  return data;
}

/**
 * True only when `game-settings/features.podiumClass === true`.
 * @param {FirebaseFirestore.Firestore} db
 * @param {{now?: Date}} [opts]
 * @returns {Promise<boolean>}
 */
async function isPodiumEnabled(db, opts) {
  const features = await getFeatures(db, opts);
  return features.podiumClass === true;
}

/** Test hook: drop the memo so the next read hits Firestore. */
function resetFeatureCache() {
  cache = { at: 0, data: null };
}

module.exports = { getFeatures, isPodiumEnabled, resetFeatureCache, FEATURES_DOC };
