// Director directory / search — the pure half of the searchDirectors callable
// (callable/users.js). Firestore-free so the query normalization and the row
// projection pin down in unit tests.
//
// How search works: `usernames/{lower}` (the username reservation collection,
// written only by the profile callables) is keyed by the LOWERCASED username,
// so an ordered document-id range query on it IS a case-insensitive prefix
// search — no search index, no derived field on the profile mirror, no
// backfill. The callable resolves each hit to `profile/public` (the server
// mirror every signed-in director may already read one at a time) and hands
// back the small projection below. Client rules keep `usernames` list-closed
// (firestore.rules), so the directory is reachable ONLY through the callable:
// signed in, budgeted, page-capped.

const { HttpsError } = require("firebase-functions/v2/https");

/** Page size when the client sends none / clamp ceiling. */
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 50;

/** Username shape enforced by the profile callables: 3-15 word chars. */
const USERNAME_KEY_RE = /^[a-z0-9_]{1,15}$/;

// Ranked classes first, SoundSport last — the display order the profile UI
// uses (PROFILE_CORPS_CLASS_ORDER in src/utils/corps).
const CORPS_CLASS_ORDER = ["worldClass", "openClass", "aClass", "soundSport"];

/**
 * Normalize a raw search string into the lowercase username-key prefix.
 * Empty (browse the whole directory alphabetically) is a valid query; a
 * leading "@" is tolerated because that is how usernames are written in the
 * app. Anything that could never prefix a username is rejected before any
 * Firestore read.
 *
 * @param {unknown} raw
 * @returns {string} "" for browse, else the lowercase prefix.
 */
function normalizeDirectorQuery(raw) {
  if (raw === undefined || raw === null) return "";
  if (typeof raw !== "string") {
    throw new HttpsError("invalid-argument", "Search text must be a string.");
  }
  const key = raw.trim().replace(/^@/, "").toLowerCase();
  if (key === "") return "";
  if (!USERNAME_KEY_RE.test(key)) {
    throw new HttpsError(
      "invalid-argument",
      "Search by username: letters, numbers and underscores only (up to 15 characters)."
    );
  }
  return key;
}

/**
 * Validate a page cursor (the last username key of the previous page, as the
 * callable returned it). null/undefined = first page.
 *
 * @param {unknown} raw
 * @returns {string | null}
 */
function normalizeDirectorCursor(raw) {
  if (raw === undefined || raw === null || raw === "") return null;
  if (typeof raw !== "string" || !USERNAME_KEY_RE.test(raw)) {
    throw new HttpsError("invalid-argument", "Invalid page cursor.");
  }
  return raw;
}

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
 * } | null} null when the mirror is missing or has no username (a ghost
 *   reservation — never advertise a profile that cannot render).
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

module.exports = {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  normalizeDirectorQuery,
  normalizeDirectorCursor,
  directoryEntryFromProfile,
};
