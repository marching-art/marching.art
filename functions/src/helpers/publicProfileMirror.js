// The public projection of a profile doc — what any signed-in director may
// see about another director.
//
// profile/data carries the caption lineup, weekly show picks, and open
// prediction picks (docs/CAPTION_WARS_SPEC.md §7 treats lineups as secret
// from opponents), alongside everything a public profile page renders.
// Firestore rules cannot hide fields, so triggers/profileMirror.js keeps a
// sibling doc, profile/public, holding ONLY this projection; league rosters
// and the other-director profile view read that, and profile/data can go
// owner/admin-only once every profile has a mirror (see docs/NEXT.md ops).
//
// Shape rule: top-level fields are an ALLOWLIST (a new profile field is
// private until it is named here). Inside `corps`, entries are copied minus a
// short DENYLIST — the per-corps map is wide (uniform snapshots, show
// concept, season history, avatar, standing) and every part of it except the
// lineup/picks is public by design on the corps program pages.
const { isDeepStrictEqual } = require("node:util");

/** Top-level fields copied verbatim. */
const PUBLIC_PROFILE_FIELDS = [
  "uid",
  "username",
  "displayName",
  "photoURL",
  "location",
  "bio",
  "favoriteCorps",
  "directorInfo",
  "xp",
  "xpLevel",
  "userTitle",
  "unlockedClasses",
  "stats",
  "articleStats",
  "lifetimeStats",
  "trophies",
  "captionStats",
  "achievements",
  "retiredCorps",
  "activeSeasonId",
  "profileAvatarCorps",
  "hosting",
  "createdAt",
  "lastActive",
];

/** Per-corps keys that never leave profile/data. */
const CORPS_PRIVATE_KEYS = ["lineup", "lineupKey", "selectedShows", "weeklyTrades"];

/**
 * @param {Record<string, any>|null|undefined} data Raw profile/data.
 * @returns {Record<string, any>|null} The projection, or null for no source.
 */
function projectPublicProfile(data) {
  if (!data || typeof data !== "object") return null;
  /** @type {Record<string, any>} */
  const out = {};
  for (const key of PUBLIC_PROFILE_FIELDS) {
    if (data[key] !== undefined) out[key] = data[key];
  }

  // Sub-objects with a private half.
  if (data.engagement && typeof data.engagement === "object") {
    out.engagement = { loginStreak: Number(data.engagement.loginStreak) || 0 };
  }
  if (data.cosmetics && typeof data.cosmetics === "object" && data.cosmetics.equipped) {
    out.cosmetics = { equipped: data.cosmetics.equipped };
  }
  if (data.legacy && typeof data.legacy === "object") {
    const { total, count, entries, lastEndowedAt } = data.legacy;
    out.legacy = { total: total || 0, count: count || 0, entries: entries || [], lastEndowedAt: lastEndowedAt ?? null };
  }
  if (data.supporter && typeof data.supporter === "object") {
    // Never the emailHash (it is the BMAC linkage key).
    const { tier, since, anonymous, message, until } = data.supporter;
    out.supporter = { tier, since: since ?? null, anonymous: anonymous === true, message: message ?? null, until: until ?? null };
  } else if (data.supporter === null) {
    out.supporter = null;
  }

  if (data.corps && typeof data.corps === "object") {
    /** @type {Record<string, any>} */
    const corps = {};
    for (const [classKey, entry] of Object.entries(data.corps)) {
      if (!entry || typeof entry !== "object") continue;
      const copy = { ...entry };
      for (const key of CORPS_PRIVATE_KEYS) delete copy[key];
      corps[classKey] = copy;
    }
    out.corps = corps;
  }
  return out;
}

/**
 * Structural equality of two projections (Timestamps compare by value).
 * @param {Record<string, any>|null} a
 * @param {Record<string, any>|null} b
 */
function publicProjectionEquals(a, b) {
  return isDeepStrictEqual(a, b);
}

module.exports = {
  PUBLIC_PROFILE_FIELDS,
  CORPS_PRIVATE_KEYS,
  projectPublicProfile,
  publicProjectionEquals,
};
