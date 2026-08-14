/**
 * Correction: fix regional trophies that were awarded to the wrong shows.
 *
 * Only the three branded regional majors crown regional champions (§5.11):
 * the Southwestern Championship (day 28), the Southeastern Championship
 * (day 35), and the two-night Eastern Classic (days 41/42). Off-season
 * schedules place exactly one show on each of those days, but LIVE seasons map
 * every scraped DCI event to its calendar day — so ordinary pool shows
 * (Midwestern Championship, marching.art Pittsburgh, the Buccaneer Classic,
 * Music on the Mountain, …) can land on a major's day.
 *
 * The old `awardRegionalTrophies` (functions/src/helpers/scoringAwards.js)
 * awarded a regional trophy to EVERY show scored on those days, so those pool
 * shows minted regional trophies they never should have, and the actual Eastern
 * Classic wasn't reliably crowned. That code is now fixed to filter to the
 * branded major; this one-off (re-runnable) migration reconciles the profiles
 * already written under the old logic:
 *
 *   1. REMOVE WRONG: drop any `trophies.regionals` entry whose eventName is not
 *      a branded major, and any `trophies.soundSportAwards` entry of type
 *      `regional_best_in_show` on a non-major show. (Festival / international
 *      SoundSport awards are never touched.)
 *   2. ADD MISSING: recompute the correct regional champions for every archived
 *      season from its stored recaps — fantasy (per competitive class + a
 *      SoundSport Best in Show, Eastern combined across days 41/42) and Podium
 *      (one overall champion, Eastern combined) — and union in any that are
 *      absent.
 *
 * Idempotent: entries are compared by identity (type · corpsClass · eventName ·
 * seasonName), so a legitimately-won major already on a profile is neither
 * duplicated nor removed, and a second run that finds nothing is a safe no-op.
 *
 * Run from the GitHub Actions tab (no console needed) —
 * .github/workflows/correct-regional-awards.yml — or locally:
 *   node src/scripts/correctRegionalAwards.js --dry-run
 *   node src/scripts/correctRegionalAwards.js --commit
 */

const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();

const { paths } = require("../helpers/paths");
const { regionalTierForEventName } = require("../helpers/seasonSchedule");

// The days the three branded majors sit on. Day 41 is Eastern night 1 and is
// folded into day 42's combined field, so it is not scanned on its own.
const FANTASY_MAJOR_DAYS = [28, 35, 42];
const PODIUM_MAJOR_DAYS = [28, 35, 42];
const EASTERN_NIGHT_1 = 41;
const COMPETITIVE_CLASSES = ["worldClass", "openClass", "aClass"];

/** Identity key for a regional trophy (score/rank intentionally excluded). */
function regionalKey(t) {
  return [t.type, t.corpsClass || "", t.eventName || "", t.seasonName || ""].join("|");
}
/** Identity key for a SoundSport regional Best in Show award. */
function soundSportKey(t) {
  return [t.type, t.eventName || "", t.seasonName || ""].join("|");
}

/** True for one of the three branded regional-major event names. */
function isBrandedMajor(eventName) {
  return Boolean(regionalTierForEventName(eventName));
}

/**
 * Merge the branded-major shows out of one or more recap days, combining the
 * results of same-named shows (the Eastern Classic's two nights share a name,
 * so nights 41 + 42 collapse into one combined field).
 *
 * @param {Array<{shows?: Array}>} recapDays - recap day documents (may be null)
 * @returns {Array<{eventName: string, results: Array}>}
 */
function mergeMajorShows(recapDays) {
  const byName = new Map();
  for (const day of recapDays) {
    for (const show of (day && day.shows) || []) {
      if (!isBrandedMajor(show.eventName)) continue;
      const existing = byName.get(show.eventName);
      if (existing) {
        existing.results = [...existing.results, ...(show.results || [])];
      } else {
        byName.set(show.eventName, {
          eventName: show.eventName,
          results: [...(show.results || [])],
        });
      }
    }
  }
  return [...byName.values()];
}

/**
 * The fantasy regional trophies + SoundSport Best in Show a major show should
 * mint — one champion per competitive class, plus the top SoundSport corps.
 * Mirrors the fixed `awardRegionalTrophies`.
 *
 * @returns {{regionals: Array<{uid, trophy}>, soundSport: Array<{uid, award}>}}
 */
function fantasyMajorAwards(show, seasonName) {
  const regionals = [];
  const soundSport = [];
  for (const corpsClass of COMPETITIVE_CLASSES) {
    const champion = (show.results || [])
      .filter((r) => r.corpsClass === corpsClass)
      .sort((a, b) => b.totalScore - a.totalScore)[0];
    if (!champion) continue;
    regionals.push({
      uid: champion.uid,
      trophy: {
        type: "regional",
        corpsClass,
        seasonName,
        eventName: show.eventName,
        score: champion.totalScore,
        rank: 1,
      },
    });
  }
  const bestInShow = (show.results || [])
    .filter((r) => r.corpsClass === "soundSport")
    .sort((a, b) => b.totalScore - a.totalScore)[0];
  if (bestInShow) {
    soundSport.push({
      uid: bestInShow.uid,
      award: {
        type: "regional_best_in_show",
        seasonName,
        eventName: show.eventName,
        score: bestInShow.totalScore,
      },
    });
  }
  return { regionals, soundSport };
}

/**
 * The single overall Podium regional champion a major show should crown — the
 * top `podiumClass` corps across all divisions. Mirrors
 * `resolvePodiumRegionalChampion`.
 *
 * @returns {{uid: string, trophy: Object}|null}
 */
function podiumMajorChampion(show, seasonName) {
  const champion = (show.results || [])
    .filter((r) => r.corpsClass === "podiumClass")
    .sort((a, b) => b.totalScore - a.totalScore)[0];
  if (!champion) return null;
  return {
    uid: champion.uid,
    trophy: {
      type: "regional",
      corpsClass: "podiumClass",
      seasonName,
      eventName: show.eventName,
      score: champion.totalScore,
      rank: 1,
    },
  };
}

/**
 * Reconcile one profile's stored regional awards against the set it should
 * hold. Pure — no Firestore — so the remove/add/idempotency rules are testable.
 *
 * @param {{regionals?: Array, soundSportAwards?: Array}} stored - profile.trophies
 * @param {{regionals: Array, soundSportAwards: Array}} correct - trophies this uid earned
 * @returns {{regionals: Array, soundSportAwards: Array, changed: boolean, stats: Object}}
 */
function reconcileProfileTrophies(stored, correct) {
  const storedRegionals = Array.isArray(stored.regionals) ? stored.regionals : [];
  const storedSoundSport = Array.isArray(stored.soundSportAwards)
    ? stored.soundSportAwards
    : [];

  // REGIONALS: keep entries on branded majors; drop the rest (the wrong ones).
  const keptRegionals = storedRegionals.filter((t) => isBrandedMajor(t.eventName));
  const regionalKeys = new Set(keptRegionals.map(regionalKey));
  const addedRegionals = [];
  for (const t of correct.regionals) {
    if (regionalKeys.has(regionalKey(t))) continue;
    regionalKeys.add(regionalKey(t));
    addedRegionals.push(t);
  }
  const nextRegionals = [...keptRegionals, ...addedRegionals];

  // SOUNDSPORT: only prune regional Best in Show on non-major shows; leave
  // festival / international awards alone. Then add any missing correct ones.
  const keptSoundSport = storedSoundSport.filter(
    (t) => t.type !== "regional_best_in_show" || isBrandedMajor(t.eventName)
  );
  const soundSportKeys = new Set(
    keptSoundSport
      .filter((t) => t.type === "regional_best_in_show")
      .map(soundSportKey)
  );
  const addedSoundSport = [];
  for (const t of correct.soundSportAwards) {
    if (soundSportKeys.has(soundSportKey(t))) continue;
    soundSportKeys.add(soundSportKey(t));
    addedSoundSport.push(t);
  }
  const nextSoundSport = [...keptSoundSport, ...addedSoundSport];

  const removedRegionals = storedRegionals.length - keptRegionals.length;
  const removedSoundSport = storedSoundSport.length - keptSoundSport.length;
  const changed =
    removedRegionals > 0 ||
    addedRegionals.length > 0 ||
    removedSoundSport > 0 ||
    addedSoundSport.length > 0;

  return {
    regionals: nextRegionals,
    soundSportAwards: nextSoundSport,
    changed,
    stats: {
      removedRegionals,
      addedRegionals: addedRegionals.length,
      removedSoundSport,
      addedSoundSport: addedSoundSport.length,
    },
  };
}

/**
 * Accumulate a correct trophy under its uid, de-duping by identity key.
 *
 * @param {Map} correctByUid
 * @param {string} uid
 * @param {{regional?: Object, soundSport?: Object}} entry - one of the two award kinds
 */
function addCorrect(correctByUid, uid, { regional, soundSport }) {
  let entry = correctByUid.get(uid);
  if (!entry) {
    entry = { regionals: [], soundSportAwards: [], regionalKeys: new Set(), soundSportKeys: new Set() };
    correctByUid.set(uid, entry);
  }
  if (regional) {
    const key = regionalKey(regional);
    if (!entry.regionalKeys.has(key)) {
      entry.regionalKeys.add(key);
      entry.regionals.push(regional);
    }
  }
  if (soundSport) {
    const key = soundSportKey(soundSport);
    if (!entry.soundSportKeys.has(key)) {
      entry.soundSportKeys.add(key);
      entry.soundSportAwards.push(soundSport);
    }
  }
}

/** Read a recap day doc's data, or null when it does not exist. */
async function readRecapDay(ref) {
  const snap = await ref.get();
  return snap.exists ? snap.data() : null;
}

/**
 * Build the map of correct regional awards each uid earned, scanning every
 * fantasy and Podium season's stored recaps.
 */
async function buildCorrectByUid(db) {
  const correctByUid = new Map();

  // Season name resolves from the fantasy recap parent doc (podium shares the
  // season's seasonUid); falls back to the seasonUid string.
  const seasonNameFor = async (collection, seasonUid) => {
    const snap = await db.doc(`${collection}/${seasonUid}`).get();
    const name = snap.exists ? snap.data().seasonName : null;
    if (name) return name;
    const fantasyParent = await db.doc(`fantasy_recaps/${seasonUid}`).get();
    return (fantasyParent.exists && fantasyParent.data().seasonName) || seasonUid;
  };

  // --- Fantasy ---
  const fantasySeasons = await db.collection("fantasy_recaps").listDocuments();
  for (const seasonRef of fantasySeasons) {
    const seasonUid = seasonRef.id;
    const seasonName = await seasonNameFor("fantasy_recaps", seasonUid);
    for (const day of FANTASY_MAJOR_DAYS) {
      const days = [await readRecapDay(seasonRef.collection("days").doc(String(day)))];
      if (day === 42) {
        days.push(await readRecapDay(seasonRef.collection("days").doc(String(EASTERN_NIGHT_1))));
      }
      for (const show of mergeMajorShows(days)) {
        const { regionals, soundSport } = fantasyMajorAwards(show, seasonName);
        for (const r of regionals) addCorrect(correctByUid, r.uid, { regional: r.trophy });
        for (const s of soundSport) addCorrect(correctByUid, s.uid, { soundSport: s.award });
      }
    }
  }

  // --- Podium ---
  const podiumSeasons = await db.collection("podium-recaps").listDocuments();
  for (const seasonRef of podiumSeasons) {
    const seasonUid = seasonRef.id;
    const seasonName = await seasonNameFor("podium-recaps", seasonUid);
    for (const day of PODIUM_MAJOR_DAYS) {
      const days = [await readRecapDay(seasonRef.collection("days").doc(String(day)))];
      if (day === 42) {
        days.push(await readRecapDay(seasonRef.collection("days").doc(String(EASTERN_NIGHT_1))));
      }
      for (const show of mergeMajorShows(days)) {
        const champion = podiumMajorChampion(show, seasonName);
        if (champion) addCorrect(correctByUid, champion.uid, { regional: champion.trophy });
      }
    }
  }

  return correctByUid;
}

async function run({ commit }) {
  const db = admin.firestore();

  console.log("Computing correct regional champions from stored recaps…");
  const correctByUid = await buildCorrectByUid(db);
  console.log(`  ${correctByUid.size} director(s) earned at least one correct regional award.`);

  // Reconcile every profile: those with wrong trophies to strip and those owed
  // a missing one both need visiting, so scan the whole users collection.
  const userRefs = await db.collection(paths.users()).listDocuments();
  console.log(`Scanning ${userRefs.length} profile(s)…`);

  const empty = { regionals: [], soundSportAwards: [] };
  const FETCH_CHUNK = 300;
  let changedCount = 0;
  let removedRegionals = 0;
  let addedRegionals = 0;
  let removedSoundSport = 0;
  let addedSoundSport = 0;

  for (let i = 0; i < userRefs.length; i += FETCH_CHUNK) {
    const chunk = userRefs.slice(i, i + FETCH_CHUNK);
    const profileRefs = chunk.map((userRef) => db.doc(paths.userProfile(userRef.id)));
    const profiles = await db.getAll(...profileRefs);

    const writes = [];
    profiles.forEach((snap, idx) => {
      if (!snap.exists) return;
      const uid = chunk[idx].id;
      const trophies = snap.data().trophies || {};
      const correct = correctByUid.get(uid) || empty;
      const result = reconcileProfileTrophies(trophies, correct);
      if (!result.changed) return;

      changedCount += 1;
      removedRegionals += result.stats.removedRegionals;
      addedRegionals += result.stats.addedRegionals;
      removedSoundSport += result.stats.removedSoundSport;
      addedSoundSport += result.stats.addedSoundSport;
      console.log(
        `  ${uid}: regionals -${result.stats.removedRegionals}/+${result.stats.addedRegionals}, ` +
          `soundSport -${result.stats.removedSoundSport}/+${result.stats.addedSoundSport}`
      );

      writes.push({
        ref: profileRefs[idx],
        data: {
          "trophies.regionals": result.regionals,
          "trophies.soundSportAwards": result.soundSportAwards,
        },
      });
    });

    if (commit && writes.length > 0) {
      // Firestore caps a batch at 500 ops; a 300-profile chunk stays well under.
      const batch = db.batch();
      for (const w of writes) batch.update(w.ref, w.data);
      await batch.commit();
    }
  }

  console.log(
    `\n${commit ? "Updated" : "Would update"} ${changedCount} profile(s): ` +
      `regionals -${removedRegionals}/+${addedRegionals}, ` +
      `soundSport Best in Show -${removedSoundSport}/+${addedSoundSport}.`
  );
  if (!commit) console.log("Dry run — re-run with --commit to apply.");

  return { changedCount, removedRegionals, addedRegionals, removedSoundSport, addedSoundSport };
}

module.exports = {
  regionalKey,
  soundSportKey,
  isBrandedMajor,
  mergeMajorShows,
  fantasyMajorAwards,
  podiumMajorChampion,
  reconcileProfileTrophies,
};

if (require.main === module) {
  const commit = process.argv.includes("--commit");
  run({ commit })
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
