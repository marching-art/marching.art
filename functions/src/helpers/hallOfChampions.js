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
 * WHEN each title is decided (HALL_CROWNING): the World Championship podiums
 * at the Day 49 World Championship Finals; the Open and A Class titles at the
 * Day 46 Open & A Class Finals — a separate competition, in both divisions —
 * never by a corps' later placement in the World bracket; SoundSport's Best
 * in Show at the Day 49 festival.
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

/**
 * The show that decides each Hall title — the night a champion is crowned.
 * @type {Readonly<Record<string, {day: number, eventName: string, short: string}>>}
 */
const HALL_CROWNING = Object.freeze({
  worldClass: { day: 49, eventName: "World Championship Finals", short: "World Finals" },
  openClass: { day: 46, eventName: "Open & A Class Finals", short: "Open & A Finals" },
  aClass: { day: 46, eventName: "Open & A Class Finals", short: "Open & A Finals" },
  soundSport: { day: 49, eventName: "SoundSport International Festival", short: "Festival" },
  podiumClass: { day: 49, eventName: "World Championship Finals", short: "World Finals" },
  podiumOpenClass: { day: 46, eventName: "Open & A Class Finals", short: "Open & A Finals" },
  podiumAClass: { day: 46, eventName: "Open & A Class Finals", short: "Open & A Finals" },
});

/** The championship day whose Podium recap decides the Open / A Class titles. */
const CLASS_FINALS_DAY = 46;

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
 * The Podium Division's Hall podiums.
 *
 * `record` is the season's frozen final standings
 * (`podium-recaps/{seasonUid}.finalStandings` — every scored corps, ranked
 * 1..N on the whole record, each carrying the `division` it competed in). The
 * top three of it are the Podium World Championship podium (`podiumClass`).
 *
 * `classFinals` is the Day 46 Open & A Class Finals recap rows
 * (`podium-recaps/{seasonUid}/days/46`, every show's `results` flattened:
 * `{uid, corpsName, division, totalScore}`) — the competition that DECIDES
 * the Open and A Class titles, in both divisions. Each division's top three
 * that night are its podium (`podiumOpenClass` / `podiumAClass`); a corps'
 * later placement in the World bracket never rewrites them. When a season
 * has no Day 46 recap for a division (an old archive, or nobody in that
 * division marched), that division falls back to its season-end standing —
 * the same fallback the fantasy archival uses.
 *
 * A key is present only when at least one corps competed there. Entries
 * carry the Hall shape minus the director identity (`username`,
 * `avatarUrl`), which the caller resolves from profiles.
 *
 * Pure: no Firestore, no clock.
 *
 * @param {Array<{uid: string, corpsName?: string, lastTotal?: number, score?: number, division?: string}>} record
 * @param {{classFinals?: Array<{uid: string, corpsName?: string, totalScore?: number, score?: number, division?: string}>}} [options]
 * @returns {Object<string, Array<{rank: number, uid: string, corpsName: string, score: number, corpsClass: string}>>}
 */
function buildPodiumHallPodiums(record, { classFinals } = {}) {
  const standings = Array.isArray(record) ? record.filter((entry) => entry && entry.uid) : [];
  const finals = Array.isArray(classFinals) ? classFinals.filter((row) => row && row.uid) : [];
  /** @param {{lastTotal?: number, score?: number, totalScore?: number}} entry */
  const scoreOf = (entry) =>
    typeof entry.lastTotal === "number"
      ? entry.lastTotal
      : typeof entry.totalScore === "number"
        ? entry.totalScore
        : entry.score;
  /**
   * @param {{uid: string, corpsName?: string, lastTotal?: number, score?: number, totalScore?: number, division?: string}} entry
   * @param {number} index
   */
  const toEntry = (entry, index) => ({
    rank: index + 1,
    uid: entry.uid,
    corpsName: entry.corpsName || "Unknown Corps",
    score: scoreOf(entry),
    // The division the corps competed in — on the World podium that can be
    // any of the three, and the Hall says which.
    corpsClass: divisions.normalizeDivision(entry.division),
  });
  /** @param {string} division */
  const inDivision = (division) =>
    /** @param {{division?: string}} row */
    (row) => divisions.normalizeDivision(row.division) === division;

  /** @type {Object<string, Array<object>>} */
  const podiums = {};
  const world = standings.slice(0, PODIUM_TOP).map(toEntry);
  if (world.length > 0) podiums[PODIUM_HALL_CLASSES.worldClass] = world;

  for (const division of divisions.DIVISIONS) {
    if (division === "worldClass") continue; // the World key is the whole field
    // The Day 46 Open & A Class Finals decide the title; one show, ranked by
    // that night's total (dedupe defensively — a corps marches once).
    const seen = new Set();
    const finalsField = finals
      .filter(inDivision(division))
      .filter((row) => (typeof row.totalScore === "number" || typeof row.score === "number") && !seen.has(row.uid) && seen.add(row.uid))
      .sort((a, b) => (scoreOf(b) || 0) - (scoreOf(a) || 0) || String(a.uid).localeCompare(String(b.uid)));
    const classField = (finalsField.length > 0 ? finalsField : standings.filter(inDivision(division)))
      .slice(0, PODIUM_TOP)
      .map(toEntry);
    if (classField.length > 0) podiums[PODIUM_HALL_CLASSES[division]] = classField;
  }
  return podiums;
}

/**
 * Flatten a Podium recap day doc (`{shows: [{results: [...]}]}`) into the
 * `classFinals` rows `buildPodiumHallPodiums` reads. Null/undefined-safe.
 * @param {{shows?: Array<{results?: Array<object>}>} | null | undefined} recapDay
 * @returns {Array<object>}
 */
function recapDayResults(recapDay) {
  const shows = recapDay && Array.isArray(recapDay.shows) ? recapDay.shows : [];
  return shows.flatMap((show) => (show && Array.isArray(show.results) ? show.results : []));
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
  HALL_CROWNING,
  CLASS_FINALS_DAY,
  recapDayResults,
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
