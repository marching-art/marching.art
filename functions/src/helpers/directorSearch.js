// Director directory — the pure half of the searchDirectors callable
// (callable/users.js). Firestore-free so the row projection, ordering and
// the per-instance cache pin down in unit tests.
//
// How the directory is built: every director is a document location under
// `artifacts/{ns}/users/` (listDocuments() returns those locations even when
// the user doc itself is absent — accountErasure.js relies on the same
// behavior for seasons), and every director's public projection lives at
// `profile/public`, kept in step by triggers/profileMirror.js and backfilled
// for every existing profile (docs/NEXT.md, 2026-09-13). Reading those
// mirrors in bulk is therefore the one enumeration that is complete by
// construction: no side index to drift (the first cut keyed on the
// `usernames/{lower}` reservation collection and silently dropped every
// director whose reservation was missing), no derived search field, no
// composite index, no backfill. The whole list is small (hundreds of rows of
// ~200 bytes), so the callable returns it in one response and the client
// filters locally — which also lets search match display and corps names,
// not just the username prefix a Firestore range could serve.
//
// Cost: one listDocuments plus one profile/public read per director, per
// call, per function instance — absorbed by a short in-memory cache so a
// burst of visits doesn't re-read the mirrors each time. If the game ever
// passes MAX_DIRECTORY_SIZE directors the response is truncated and flagged;
// that is the point to move to a materialized index, not before.

/** Hard ceiling on rows per response (keeps the payload well under 1 MiB). */
const MAX_DIRECTORY_SIZE = 2000;
/** getAll batch size — Firestore caps a single getAll well above this. */
const MIRROR_BATCH_SIZE = 300;
/** Per-instance cache lifetime. */
const DIRECTORY_CACHE_TTL_MS = 60 * 1000;

// Ranked classes first, SoundSport, then the Podium Division — the display
// order the profile UI uses (PROFILE_CORPS_CLASS_ORDER in src/utils/corps).
// A Podium corps lives on the profile as a display copy at
// `corps.podiumClass` (callable/podium.js registerPodiumCorps), which the
// public mirror carries like any other class entry.
const CORPS_CLASS_ORDER = ["worldClass", "openClass", "aClass", "soundSport", "podiumClass"];

/**
 * The directory row for one director, projected from their profile/public
 * mirror. Deliberately small: identity, progression, and the corps they field
 * by name — enough to recognize someone and click through to /profile/{uid}.
 * Nothing here that the mirror doesn't already expose to every signed-in
 * director.
 *
 * @param {string} uid
 * @param {Record<string, any> | null | undefined} data profile/public data.
 * @returns {{
 *   uid: string, username: string, displayName: string, photoURL: string | null,
 *   xpLevel: number, userTitle: string, location: string,
 *   seasonsPlayed: number, corps: Array<{classKey: string, corpsName: string}>,
 * } | null} null when the mirror is missing or has no username (a profile that
 *   cannot render — never advertise it).
 */
function directoryEntryFromProfile(uid, data) {
  if (!data || typeof data !== "object") return null;
  const username = typeof data.username === "string" ? data.username.trim() : "";
  if (!username) return null;

  const corps = [];
  const record = data.corps && typeof data.corps === "object" ? data.corps : {};
  for (const classKey of CORPS_CLASS_ORDER) {
    const name = record[classKey]?.corpsName;
    if (typeof name === "string" && name.trim() !== "") {
      corps.push({ classKey, corpsName: name.trim() });
    }
  }

  const displayName =
    typeof data.displayName === "string" && data.displayName.trim() !== ""
      ? data.displayName.trim()
      : username;
  const xpLevel = Number.isFinite(data.xpLevel) && data.xpLevel > 0 ? Math.floor(data.xpLevel) : 1;

  return {
    uid,
    username,
    displayName,
    photoURL: typeof data.photoURL === "string" && data.photoURL !== "" ? data.photoURL : null,
    xpLevel,
    userTitle: typeof data.userTitle === "string" ? data.userTitle : "",
    location: typeof data.location === "string" ? data.location.trim() : "",
    seasonsPlayed: Number(data.stats?.seasonsPlayed) || 0,
    corps,
  };
}

/**
 * Alphabetical by username, case-insensitively, uid as the tiebreak so the
 * order is stable between calls.
 * @template {{username: string, uid: string}} T
 * @param {T[]} entries
 * @returns {T[]} a new sorted array
 */
function sortDirectoryEntries(entries) {
  return [...entries].sort((a, b) => {
    const au = a.username.toLowerCase();
    const bu = b.username.toLowerCase();
    if (au !== bu) return au < bu ? -1 : 1;
    return a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0;
  });
}

/**
 * Build the whole directory: every user location's profile/public mirror,
 * projected and sorted. Locations without a mirror (an account mid-erasure,
 * or one that never finished onboarding) are skipped.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {{users: () => string, userProfilePublic: (uid: string) => string}} paths
 * @returns {Promise<{directors: ReturnType<typeof directoryEntryFromProfile>[], total: number, truncated: boolean}>}
 */
async function loadDirectory(db, paths) {
  const userRefs = await db.collection(paths.users()).listDocuments();
  const uids = userRefs.map((ref) => ref.id).filter((id) => typeof id === "string" && id !== "");
  const truncated = uids.length > MAX_DIRECTORY_SIZE;
  const wanted = truncated ? uids.slice(0, MAX_DIRECTORY_SIZE) : uids;

  const directors = [];
  for (let i = 0; i < wanted.length; i += MIRROR_BATCH_SIZE) {
    const batch = wanted.slice(i, i + MIRROR_BATCH_SIZE);
    const mirrors = await db.getAll(...batch.map((uid) => db.doc(paths.userProfilePublic(uid))));
    mirrors.forEach((mirror, index) => {
      const entry = directoryEntryFromProfile(batch[index], mirror.exists ? mirror.data() : null);
      if (entry) directors.push(entry);
    });
  }
  const sorted = sortDirectoryEntries(directors);
  return { directors: sorted, total: sorted.length, truncated };
}

/** @type {{at: number, value: Awaited<ReturnType<typeof loadDirectory>>} | null} */
let cache = null;

/**
 * loadDirectory behind a per-instance TTL cache. A cache hit costs no reads;
 * a miss rebuilds and stores. Failures are not cached.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {{users: () => string, userProfilePublic: (uid: string) => string}} paths
 * @param {{now?: () => number, ttlMs?: number}} [opts]
 */
async function loadDirectoryCached(db, paths, { now = Date.now, ttlMs = DIRECTORY_CACHE_TTL_MS } = {}) {
  const at = now();
  if (cache && at - cache.at < ttlMs) return cache.value;
  const value = await loadDirectory(db, paths);
  cache = { at, value };
  return value;
}

/** Tests only. */
function resetDirectoryCacheForTesting() {
  cache = null;
}

module.exports = {
  MAX_DIRECTORY_SIZE,
  MIRROR_BATCH_SIZE,
  DIRECTORY_CACHE_TTL_MS,
  directoryEntryFromProfile,
  sortDirectoryEntries,
  loadDirectory,
  loadDirectoryCached,
  resetDirectoryCacheForTesting,
};
