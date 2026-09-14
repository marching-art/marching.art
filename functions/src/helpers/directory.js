// The director directory index: one small `directory/{uid}` document per
// director, written by triggers/profileMirror.js on every public profile
// change (and by scripts/backfillPublicProfiles.js once for existing
// accounts), read directly by the /directors page through Firestore queries.
//
// Why a top-level collection rather than querying the profile/public mirrors:
// a top-level collection gets Firestore's automatic single-field indexes, so
// the page's three access paths need no composite index and no console step:
//   - browse:  orderBy(usernameKey) + cursor, 50 rows a page
//   - search:  where(searchTokens, array-contains, <typed word>), 50 rows
//   - total:   a count() aggregation (billed per 1,000 rows, not per row)
// Every visit therefore costs one page of reads whether the game has a
// hundred directors or fifty thousand. The row is a strict subset of the
// public projection (helpers/publicProfileMirror.js) plus derived search
// keys — nothing a signed-in director cannot already see on a profile page.
//
// Search keys: `usernameKey` / `displayNameKey` are the lowercased strings
// (prefix ranges); `searchTokens` holds every prefix (2..MAX_TOKEN_LENGTH
// chars) of every word in the username, display name and corps names, so a
// single equality query answers "type the start of any word" — the only
// kind of search a document store answers in one indexed read.

/** Rows per page the client may request; firestore.rules enforces the cap. */
const DIRECTORY_PAGE_SIZE = 50;
/** Longest prefix token stored per word; longer typed words are truncated to match. */
const MAX_TOKEN_LENGTH = 12;
const MIN_TOKEN_LENGTH = 2;
/** Bound on the token array so a director with five long corps names stays a small doc. */
const MAX_TOKENS = 150;

// Ranked classes first, SoundSport, then the Podium Division — the display
// order the profile UI uses (PROFILE_CORPS_CLASS_ORDER in src/utils/corps).
// A Podium corps lives on the profile as a display copy at `corps.podiumClass`.
const CORPS_CLASS_ORDER = ["worldClass", "openClass", "aClass", "soundSport", "podiumClass"];

/**
 * Lowercase words of a name: letters, digits and underscores; everything
 * else separates.
 * @param {string} text
 * @returns {string[]}
 */
function words(text) {
  return String(text || "")
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter(Boolean);
}

/**
 * Every prefix of every word across the given strings, deduped, bounded.
 * @param {string[]} texts
 * @returns {string[]}
 */
function searchTokensFor(texts) {
  const tokens = new Set();
  for (const text of texts) {
    for (const word of words(text)) {
      const max = Math.min(word.length, MAX_TOKEN_LENGTH);
      for (let n = MIN_TOKEN_LENGTH; n <= max; n++) {
        tokens.add(word.slice(0, n));
        if (tokens.size >= MAX_TOKENS) return [...tokens];
      }
      // A one-character word (an initial) is still findable by itself.
      if (word.length < MIN_TOKEN_LENGTH) tokens.add(word);
    }
  }
  return [...tokens];
}

/**
 * The directory row for one director, from their profile (or its public
 * projection — both carry the same fields). null when there is nothing to
 * list: no username means the profile cannot render.
 *
 * @param {string} uid
 * @param {Record<string, any> | null | undefined} data
 * @returns {{
 *   uid: string, username: string, displayName: string, photoURL: string | null,
 *   xpLevel: number, userTitle: string, location: string, seasonsPlayed: number,
 *   corps: Array<{classKey: string, corpsName: string}>,
 *   usernameKey: string, displayNameKey: string, searchTokens: string[],
 * } | null}
 */
function directoryRowFromProfile(uid, data) {
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
    usernameKey: username.toLowerCase(),
    displayNameKey: displayName.toLowerCase(),
    searchTokens: searchTokensFor([username, displayName, ...corps.map((c) => c.corpsName)]),
  };
}

/** `directory/{uid}` */
function directoryDocPath(uid) {
  return `directory/${uid}`;
}

module.exports = {
  DIRECTORY_PAGE_SIZE,
  MAX_TOKEN_LENGTH,
  MIN_TOKEN_LENGTH,
  MAX_TOKENS,
  words,
  searchTokensFor,
  directoryRowFromProfile,
  directoryDocPath,
};
