/**
 * Backfill: add corps graphics (avatarUrl) to archived Hall of Champions docs.
 *
 * The Hall of Champions renders each champion and finalist with their corps
 * graphic (`avatarUrl`). Newly archived seasons carry it — the fantasy finals
 * (scoringAwards.js) and Podium career sweep (podium/career.js) both write it
 * onto every `season_champions/{seasonUid}` entry. But seasons archived BEFORE
 * that change have entries with no `avatarUrl` field, so they still show the
 * bare-initial fallback. This script fills those in from each champion's
 * current profile.
 *
 * A champion entry lives under `classes[corpsClass][i]`, and the class key is
 * the same slot used on the profile's corps map, so the graphic is resolved
 * from `profile.corps[corpsClass].avatarUrl` — the persistent per-class
 * identity field (see corpsHelpers PERSISTENT_IDENTITY_FIELDS). A champion
 * whose profile or corps slot is gone resolves to `null`, matching what a
 * fresh archival would have written when no graphic exists.
 *
 * Idempotent: only entries missing the field entirely (`avatarUrl === undefined`)
 * are touched, so a second run is a no-op. Setting a resolved-absent value to
 * `null` marks the entry done and keeps re-runs cheap.
 *
 *   node src/scripts/backfillChampionAvatars.js --dry-run
 *   node src/scripts/backfillChampionAvatars.js --commit
 */

const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();

const { paths } = require("../helpers/paths");

/**
 * Fill missing `avatarUrl` on a champions doc's `classes` map. Pure, so the
 * fill rule is testable without Firestore.
 *
 * @param {Object<string, Array<object>>} classes the doc's `classes` map
 * @param {(uid: string, corpsClass: string) => (string|null)} resolve
 *        looks up the corps graphic for one champion entry
 * @returns {{ classes: Object, changed: number }} a new classes map (unchanged
 *          entries are preserved) and how many entries gained an avatarUrl
 */
function backfillClasses(classes, resolve) {
  let changed = 0;
  const next = {};

  for (const [corpsClass, entries] of Object.entries(classes || {})) {
    if (!Array.isArray(entries)) {
      next[corpsClass] = entries;
      continue;
    }
    next[corpsClass] = entries.map((entry) => {
      // Already backfilled (or written by a modern archival) — leave it be.
      if (!entry || entry.avatarUrl !== undefined) return entry;
      changed += 1;
      return { ...entry, avatarUrl: entry.uid ? resolve(entry.uid, corpsClass) || null : null };
    });
  }

  return { classes: next, changed };
}

async function run({ commit }) {
  const db = admin.firestore();

  const snapshot = await db.collection("season_champions").get();
  console.log(`Scanning ${snapshot.size} archived season(s)…`);

  // Collect every champion uid across all docs so profiles are fetched once.
  const allUids = new Set();
  for (const doc of snapshot.docs) {
    const classes = doc.get("classes") || {};
    for (const entries of Object.values(classes)) {
      if (!Array.isArray(entries)) continue;
      for (const entry of entries) {
        if (entry && entry.avatarUrl === undefined && entry.uid) allUids.add(entry.uid);
      }
    }
  }

  // uid -> profile.corps map (or null when the profile is gone). Batched
  // getAll, chunked to Firestore's 500-ref limit.
  const corpsByUid = new Map();
  const uids = [...allUids];
  const FETCH_CHUNK = 300;
  for (let i = 0; i < uids.length; i += FETCH_CHUNK) {
    const chunk = uids.slice(i, i + FETCH_CHUNK);
    const refs = chunk.map((uid) => db.doc(paths.userProfile(uid)));
    const docs = await db.getAll(...refs);
    docs.forEach((profileDoc, idx) => {
      corpsByUid.set(chunk[idx], profileDoc.exists ? profileDoc.data().corps || {} : null);
    });
  }

  const resolve = (uid, corpsClass) => {
    const corps = corpsByUid.get(uid);
    return (corps && corps[corpsClass] && corps[corpsClass].avatarUrl) || null;
  };

  let docsChanged = 0;
  let entriesFilled = 0;
  let graphicsFound = 0;

  for (const doc of snapshot.docs) {
    const original = doc.get("classes") || {};
    const { classes, changed } = backfillClasses(original, resolve);
    if (changed === 0) continue;

    // Count how many of the JUST-filled entries resolved to a real graphic
    // (vs. null) for a clearer report — re-derived from the original so a
    // pre-existing avatar on the doc is never counted.
    for (const [corpsClass, entries] of Object.entries(original)) {
      if (!Array.isArray(entries)) continue;
      for (const entry of entries) {
        if (entry && entry.avatarUrl === undefined && entry.uid && resolve(entry.uid, corpsClass)) {
          graphicsFound += 1;
        }
      }
    }

    docsChanged += 1;
    entriesFilled += changed;
    console.log(`  ${doc.id}: filled ${changed} entr${changed === 1 ? "y" : "ies"}`);

    if (commit) await doc.ref.update({ classes });
  }

  console.log(
    `${commit ? "Updated" : "Would update"} ${docsChanged} doc(s), ` +
      `${entriesFilled} entr${entriesFilled === 1 ? "y" : "ies"} ` +
      `(${graphicsFound} resolved to a graphic).`
  );
  if (!commit) console.log("Dry run — re-run with --commit to apply.");

  return { docsChanged, entriesFilled, graphicsFound };
}

module.exports = { backfillClasses };

if (require.main === module) {
  const commit = process.argv.includes("--commit");
  run({ commit })
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
