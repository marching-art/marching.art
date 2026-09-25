/**
 * Profile collection-group hygiene.
 *
 * `db.collectionGroup("profile")` reaches every document in every collection
 * named `profile`, which is MORE than one doc per director:
 *
 *   - `users/{uid}/profile/data`   — the profile (the doc every scan wants)
 *   - `users/{uid}/profile/public` — the public projection the mirror trigger
 *     (triggers/profileMirror.js) keeps beside it. It carries `username`,
 *     `activeSeasonId` and the whole `corps` map minus lineups, so it matches
 *     the same `activeSeasonId ==` filter and looks exactly like a second,
 *     score-bearing director.
 *   - the same two docs under every OTHER data namespace.
 *
 * Every scan that means "each director once" must pin itself to this
 * namespace's `profile/data` docs, or it double-counts the whole player base:
 * the rivals job listed the same director twice, class rankings doubled
 * `seasonRankOf`, the duplicate-corps sweep saw every corps collide with its
 * own mirror, and the season rollover would have paid every finish bonus twice.
 * Filter with these helpers rather than a hand-rolled prefix check.
 */

const { paths } = require("./paths");

/** The doc id of the profile itself inside `users/{uid}/profile`. */
const PROFILE_DATA_DOC_ID = "data";

/**
 * True only for this namespace's `users/{uid}/profile/data` documents.
 *
 * @param {{ ref: { path: string } }} doc - A snapshot from a
 *   `collectionGroup("profile")` query.
 * @returns {boolean}
 */
function isProfileDataDoc(doc) {
  const path = doc && doc.ref && doc.ref.path;
  if (typeof path !== "string") return false;
  const prefix = `${paths.users()}/`;
  if (!path.startsWith(prefix)) return false;
  // Exactly users/{uid}/profile/data — decided from the path alone so it
  // holds for any snapshot shape (query docs, getAll docs, test fakes).
  const rest = path.slice(prefix.length).split("/");
  return rest.length === 3 && rest[1] === "profile" && rest[2] === PROFILE_DATA_DOC_ID;
}

/**
 * Keep only this namespace's `profile/data` docs, in their original order.
 * Generic over the snapshot type so a `QueryDocumentSnapshot[]` stays one.
 *
 * @template T
 * @param {ReadonlyArray<T>} docs
 * @returns {T[]}
 */
function profileDataDocs(docs) {
  return (docs || []).filter((doc) => isProfileDataDoc(/** @type {any} */ (doc)));
}

/**
 * The director's uid for a `users/{uid}/profile/{docId}` snapshot.
 *
 * @param {{ ref: { parent: { parent: { id: string } | null } } }} doc
 * @returns {string|null}
 */
function profileDocUid(doc) {
  const owner = doc && doc.ref && doc.ref.parent && doc.ref.parent.parent;
  return owner ? owner.id : null;
}

module.exports = { PROFILE_DATA_DOC_ID, isProfileDataDoc, profileDataDocs, profileDocUid };
