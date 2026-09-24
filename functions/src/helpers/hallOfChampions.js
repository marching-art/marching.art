/**
 * Hall of Champions — the class keys of `season_champions/{seasonUid}.classes`
 * and the pure builders behind them.
 *
 * The Hall shows BOTH divisions, each with its own classes:
 *
 *   Fantasy Division  worldClass · openClass · aClass · soundSport
 *   Podium Division   podiumClass · podiumOpenClass · podiumAClass
 *
 * The two "World" keys are World CHAMPIONSHIP podiums — the top three of the
 * whole Finals field, whatever class each corps competed in (one field, one
 * title; helpers/worldChampionship.js). The Open / A keys are class titles:
 * the top three among the corps that competed in that class.
 *
 * `podiumClass` keeps its historical name (it is the key every archived
 * season, every trophy-case medal, the Records Book and the share cards
 * already carry) and is billed as the Podium World Championship. The two
 * division keys were added later — `scripts/backfillHallPodiumClasses.js`
 * fills them for seasons archived before they existed.
 */

const divisions = require("./podium/divisions");

/** Podium division id -> Hall class key. */
const PODIUM_HALL_CLASSES = Object.freeze({
  worldClass: "podiumClass",
  openClass: "podiumOpenClass",
  aClass: "podiumAClass",
});

/** Every Hall class key the Podium Division writes. @type {readonly string[]} */
const PODIUM_HALL_CLASS_KEYS = Object.freeze(Object.values(PODIUM_HALL_CLASSES));

/** Every Hall class key the Fantasy Division writes. @type {readonly string[]} */
const FANTASY_HALL_CLASS_KEYS = Object.freeze(["worldClass", "openClass", "aClass", "soundSport"]);

/** Every key a `season_champions` doc's `classes` map may carry. @type {readonly string[]} */
const HALL_CLASS_KEYS = Object.freeze([...FANTASY_HALL_CLASS_KEYS, ...PODIUM_HALL_CLASS_KEYS]);

/** How each Hall key is billed on cards and public pages. */
const HALL_CLASS_LABELS = Object.freeze({
  worldClass: "World Championship",
  openClass: "Open Class",
  aClass: "A Class",
  soundSport: "SoundSport",
  podiumClass: "Podium World Championship",
  podiumOpenClass: "Podium Open Class",
  podiumAClass: "Podium A Class",
});

/** The division a Hall key belongs to. */
const HALL_DIVISION_OF = Object.freeze({
  ...Object.fromEntries(FANTASY_HALL_CLASS_KEYS.map((key) => [key, "fantasy"])),
  ...Object.fromEntries(PODIUM_HALL_CLASS_KEYS.map((key) => [key, "podium"])),
});

const PODIUM_TOP = 3;

/** @param {string} key */
function isHallClassKey(key) {
  return HALL_CLASS_KEYS.includes(key);
}

/** @param {string} key */
function isPodiumHallClassKey(key) {
  return PODIUM_HALL_CLASS_KEYS.includes(key);
}

/**
 * The Podium Division's Hall podiums from a season's frozen final standings
 * (`podium-recaps/{seasonUid}.finalStandings` — every scored corps, ranked
 * 1..N on the whole record, each carrying the `division` it competed in).
 *
 * Returns `{ podiumClass, podiumOpenClass, podiumAClass }` — the top three
 * of the whole record under the World key, the top three of each division
 * under its class key — with a key present only when at least one corps
 * competed there. Entries carry the Hall shape minus the director identity
 * (`username`, `avatarUrl`), which the caller resolves from profiles.
 *
 * Pure: no Firestore, no clock.
 *
 * @param {Array<{uid: string, corpsName?: string, lastTotal?: number, score?: number, division?: string}>} record
 * @returns {Object<string, Array<{rank: number, uid: string, corpsName: string, score: number, corpsClass: string}>>}
 */
function buildPodiumHallPodiums(record) {
  const standings = Array.isArray(record) ? record.filter((entry) => entry && entry.uid) : [];
  const toEntry = (entry, index) => ({
    rank: index + 1,
    uid: entry.uid,
    corpsName: entry.corpsName || "Unknown Corps",
    score: typeof entry.lastTotal === "number" ? entry.lastTotal : entry.score,
    // The division the corps competed in — on the World podium that can be
    // any of the three, and the Hall says which.
    corpsClass: divisions.normalizeDivision(entry.division),
  });

  /** @type {Object<string, Array<object>>} */
  const podiums = {};
  const world = standings.slice(0, PODIUM_TOP).map(toEntry);
  if (world.length > 0) podiums[PODIUM_HALL_CLASSES.worldClass] = world;

  for (const division of divisions.DIVISIONS) {
    if (division === "worldClass") continue; // the World key is the whole field
    const classField = standings
      .filter((entry) => divisions.normalizeDivision(entry.division) === division)
      .slice(0, PODIUM_TOP)
      .map(toEntry);
    if (classField.length > 0) podiums[PODIUM_HALL_CLASSES[division]] = classField;
  }
  return podiums;
}

/**
 * Attach director identity to every entry of a podiums map, resolving each
 * uid once. `resolveIdentity(uid)` returns `{ username, avatarUrl }` (or
 * null) — async so it can read profiles.
 *
 * @typedef {{username?: string|null, avatarUrl?: string|null}} DirectorIdentity
 *
 * @param {Object<string, Array<{uid: string}>>} podiums
 * @param {(uid: string) => Promise<DirectorIdentity|null>} resolveIdentity
 * @returns {Promise<Object<string, Array<{uid: string, username: string, avatarUrl: string|null}>>>}
 */
async function withDirectorIdentity(podiums, resolveIdentity) {
  const uids = new Set();
  for (const entries of Object.values(podiums)) for (const entry of entries) uids.add(entry.uid);
  /** @type {Map<string, DirectorIdentity>} */
  const identities = new Map();
  for (const uid of uids) {
    let identity = null;
    try {
      identity = await resolveIdentity(uid);
    } catch {
      identity = null;
    }
    identities.set(uid, identity || {});
  }
  /** @type {Object<string, Array<{uid: string, username: string, avatarUrl: string|null}>>} */
  const out = {};
  for (const [key, entries] of Object.entries(podiums)) {
    out[key] = entries.map((entry) => {
      const identity = identities.get(entry.uid) || {};
      return {
        ...entry,
        username: identity.username || "Unknown",
        avatarUrl: identity.avatarUrl || null,
      };
    });
  }
  return out;
}

/**
 * Carry purchased banners from an already-archived `classes` map onto a
 * rebuilt one: a banner hangs on a champion's own entry (matched by key + uid
 * + rank), so a re-sweep or backfill that rewrites the podium arrays never
 * takes one down. Pure; returns a new map, `next` untouched.
 *
 * @typedef {{uid?: string, rank?: number, banner?: object}} BannerBearer
 *
 * @param {Object<string, BannerBearer[]> | null | undefined} existing
 * @param {Object<string, Array<object & BannerBearer>>} next
 * @returns {Object<string, Array<object & BannerBearer>>}
 */
function carryBanners(existing, next) {
  /** @type {Object<string, Array<object & BannerBearer>>} */
  const out = {};
  for (const [key, entries] of Object.entries(next)) {
    const previous = (existing && existing[key]) || [];
    out[key] = entries.map((entry) => {
      const match = previous.find(
        (old) => old && old.banner && old.uid === entry.uid && old.rank === entry.rank
      );
      return match ? { ...entry, banner: match.banner } : entry;
    });
  }
  return out;
}

module.exports = {
  carryBanners,
  PODIUM_HALL_CLASSES,
  PODIUM_HALL_CLASS_KEYS,
  FANTASY_HALL_CLASS_KEYS,
  HALL_CLASS_KEYS,
  HALL_CLASS_LABELS,
  HALL_DIVISION_OF,
  isHallClassKey,
  isPodiumHallClassKey,
  buildPodiumHallPodiums,
  withDirectorIdentity,
};
