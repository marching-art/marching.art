/**
 * Backfill: add the Podium Division's Open Class / A Class podiums to the
 * Hall of Champions for seasons archived before those keys existed.
 *
 * The Hall renders each season's `season_champions/{seasonUid}` doc. The
 * Podium archival (helpers/podium/career.archivePodiumSeason) used to write a
 * single Podium key, `classes.podiumClass` — the Podium World Championship
 * podium, the top three of the whole record. It now also writes
 * `classes.podiumOpenClass` and `classes.podiumAClass` — the top three of
 * each division — so the Hall shows the Podium Division with the same
 * classes the Fantasy Division has (helpers/hallOfChampions.js).
 *
 * This script derives those two podiums for every archived Podium season
 * from the season's Day 46 Open & A Class Finals recap
 * (`podium-recaps/{seasonUid}/days/46` — the competition that decides those
 * titles), falling back to the season's frozen record
 * (`podium-recaps/{seasonUid}.finalStandings`) for a division with no Day 46
 * rows, exactly as a fresh archival now would, with director usernames and
 * corps avatars resolved from current profiles. The World podium
 * (`podiumClass`), every fantasy class and every banner are never touched.
 *
 * Idempotent: a season whose stored podiums already match its record is
 * skipped, so a second run is a no-op. A season with no Podium record is left
 * untouched and reported. A season whose champions doc does not exist yet
 * (Podium-only season never archived to the Hall) is created with the
 * doc-level fields the Hall expects.
 *
 *   node src/scripts/backfillHallPodiumClasses.js --dry-run
 *   node src/scripts/backfillHallPodiumClasses.js --commit
 */

const { getFirestore } = require("firebase-admin/firestore");
const { initializeApp, getApps } = require("firebase-admin/app");

if (!getApps().length) initializeApp();

const { paths } = require("../helpers/paths");
const {
  PODIUM_HALL_CLASSES,
  PODIUM_HALL_CLASS_KEYS,
  CLASS_FINALS_DAY,
  buildPodiumHallPodiums,
  recapDayResults,
  carryBanners,
} = require("../helpers/hallOfChampions");

// Only the two division podiums are (re)built; the World key is the
// archival's own record and is left exactly as written.
const DIVISION_KEYS = PODIUM_HALL_CLASS_KEYS.filter(
  (key) => key !== PODIUM_HALL_CLASSES.worldClass
);

/**
 * Rebuild one season's Podium Open/A podiums from its frozen record. Pure,
 * so the rule is testable without Firestore.
 *
 * @param {Object<string, Array<object>>} classes  the doc's `classes` map
 * @param {Array<object>} finalStandings  `podium-recaps/{seasonUid}.finalStandings`
 * @param {(uid: string) => (object|null)} resolveProfile  current profile lookup
 * @param {Array<object>} [classFinals]  the Day 46 recap rows (every show's
 *   `results` flattened); a division absent from them falls back to the record
 * @returns {{ classes: Object, changed: boolean }} a new `classes` map (every
 *   other key preserved) and whether either division podium changed.
 */
function rebuildPodiumDivisionClasses(classes, finalStandings, resolveProfile, classFinals = []) {
  const oldClasses = classes || {};
  const next = { ...oldClasses };
  let changed = false;

  const podiums = buildPodiumHallPodiums(finalStandings, { classFinals });
  for (const key of DIVISION_KEYS) {
    const identified = (podiums[key] || []).map((entry) => {
      const profile = resolveProfile(entry.uid);
      return {
        ...entry,
        username: (profile && (profile.username || profile.displayName)) || "Unknown",
        avatarUrl:
          (profile && profile.corps && profile.corps.podiumClass && profile.corps.podiumClass.avatarUrl) ||
          null,
      };
    });
    if (identified.length === 0) continue; // nobody competed there — leave the key absent
    // A banner hangs on the champion's own entry — a re-run keeps it there.
    const rebuilt = carryBanners(oldClasses, { [key]: identified })[key];
    if (JSON.stringify(oldClasses[key]) !== JSON.stringify(rebuilt)) {
      next[key] = rebuilt;
      changed = true;
    }
  }

  return { classes: next, changed };
}

async function run({ commit }) {
  const db = getFirestore();

  const recaps = await db.collection("podium-recaps").get();
  const seasons = recaps.docs.filter((doc) => Array.isArray(doc.get("finalStandings")));
  console.log(`Scanning ${recaps.size} Podium recap doc(s), ${seasons.length} with a frozen record…`);

  // Each season's Day 46 Open & A Class Finals sheet, then every uid that can
  // land on a division podium, fetched once.
  const classFinalsBySeason = new Map();
  const allUids = new Set();
  for (const doc of seasons) {
    const day46 = await db.doc(`podium-recaps/${doc.id}/days/${CLASS_FINALS_DAY}`).get();
    const classFinals = recapDayResults(day46.exists ? day46.data() : null);
    classFinalsBySeason.set(doc.id, classFinals);
    const podiums = buildPodiumHallPodiums(doc.get("finalStandings"), { classFinals });
    for (const key of DIVISION_KEYS) for (const entry of podiums[key] || []) allUids.add(entry.uid);
  }
  const profileByUid = new Map();
  const uids = [...allUids];
  const FETCH_CHUNK = 300;
  for (let i = 0; i < uids.length; i += FETCH_CHUNK) {
    const chunk = uids.slice(i, i + FETCH_CHUNK);
    const refs = chunk.map((uid) => db.doc(paths.userProfile(uid)));
    const docs = await db.getAll(...refs);
    docs.forEach((profileDoc, idx) => {
      profileByUid.set(chunk[idx], profileDoc.exists ? profileDoc.data() : null);
    });
  }
  const resolveProfile = (uid) => profileByUid.get(uid) || null;

  let docsChanged = 0;
  let docsCreated = 0;
  for (const recap of seasons) {
    const seasonUid = recap.id;
    const championsRef = db.doc(`season_champions/${seasonUid}`);
    const championsDoc = await championsRef.get();
    const { classes, changed } = rebuildPodiumDivisionClasses(
      championsDoc.exists ? championsDoc.get("classes") || {} : {},
      recap.get("finalStandings"),
      resolveProfile,
      classFinalsBySeason.get(seasonUid) || []
    );
    const fromDay46 = (classFinalsBySeason.get(seasonUid) || []).length > 0;
    if (!changed) continue;

    docsChanged += 1;
    const summary = DIVISION_KEYS.map((key) => {
      const champ = classes[key] && classes[key][0];
      return champ ? `${key}=${champ.corpsName || champ.username || champ.uid}` : null;
    })
      .filter(Boolean)
      .join(", ");
    console.log(
      `  ${seasonUid}: ${championsDoc.exists ? "added" : "created doc with"} Podium Open/A ` +
        `from ${fromDay46 ? "the Day 46 Finals" : "the season record (no Day 46 recap)"} (${summary})`
    );

    if (!commit) continue;
    if (championsDoc.exists) {
      await championsRef.update({ classes });
    } else {
      docsCreated += 1;
      await championsRef.set({ seasonName: seasonUid, archivedAt: new Date(), classes });
    }
  }

  console.log(
    `\n${commit ? "Updated" : "Would update"} ${docsChanged} doc(s)` +
      `${commit ? ` (${docsCreated} created)` : ""}; ` +
      `${recaps.size - seasons.length} recap(s) without a frozen record skipped.`
  );
  if (!commit) console.log("Dry run — re-run with --commit to apply.");

  return { docsChanged, docsCreated };
}

module.exports = { rebuildPodiumDivisionClasses };

if (require.main === module) {
  const commit = process.argv.includes("--commit");
  run({ commit })
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
