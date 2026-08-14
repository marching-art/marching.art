/**
 * Backfill: correct archived Open Class / A Class Hall of Champions podiums.
 *
 * The Hall of Champions renders each season's `season_champions/{seasonUid}`
 * doc. Before the Day-46 fix (see scoringAwards.awardFinalsAndSaveChampions),
 * that doc crowned the Open/A Class podiums from each corps' placement in the
 * Day 49 World Championship Finals bracket — where Open/A corps that advance
 * are ranked against World Class for overall standing — instead of from the
 * Day 46 Open and A Class Finals, where those class titles are actually
 * decided. Seasons archived under the old logic therefore have inaccurate
 * `classes.openClass` / `classes.aClass` entries.
 *
 * This script rebuilds those two classes for every archived season from the
 * season's own Day 46 recap (`fantasy_recaps/{seasonUid}/days/46`), exactly as
 * a fresh archival now would: top 3 per class by totalScore, usernames resolved
 * from current profiles. World Class, SoundSport, and Podium Class entries are
 * never touched.
 *
 * Banners: a champion can pay CorpsCoin to hang a banner on their rank-1 entry
 * (callable/prestige.purchaseHallBanner). A banner is carried to wherever its
 * buyer lands in the corrected podium so a real champion never loses one. A
 * banner whose buyer is no longer on the corrected podium (it was bought on an
 * entry that the old bug crowned in error) is dropped from the record and
 * reported here as an ORPHANED BANNER so the purchase can be refunded manually.
 *
 * Idempotent: a season whose stored Open/A podiums already match its Day 46
 * recap is skipped, so a second run is a no-op. A season with no Day 46 recap
 * is left untouched and reported.
 *
 *   node src/scripts/backfillHallOpenAChampions.js --dry-run
 *   node src/scripts/backfillHallOpenAChampions.js --commit
 */

const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();

const { paths } = require("../helpers/paths");

// Only these two classes are decided at the Day 46 Open and A Class Finals.
const CLASS_FINALS_CLASSES = ["openClass", "aClass"];

/** First non-empty value of `field` among old entries matching `uid`. */
function oldFieldForUid(entries, uid, field) {
  for (const entry of entries || []) {
    if (entry && entry.uid === uid && entry[field] != null) return entry[field];
  }
  return null;
}

/**
 * Rebuild one season's Open/A Class podiums from its Day 46 recap shows. Pure,
 * so the ranking + banner-carry rules are testable without Firestore.
 *
 * @param {Object<string, Array<object>>} classes  the doc's `classes` map
 * @param {Array<{results?: Array<object>}>} day46Shows  Day 46 recap shows
 * @param {(uid: string) => (object|null)} resolveProfile  current profile lookup
 * @returns {{ classes: Object, changed: boolean, orphanedBanners: Array }}
 *   a new `classes` map (World/SoundSport/Podium preserved), whether Open/A
 *   changed, and any banners whose buyer fell off the corrected podium.
 */
function rebuildOpenAClasses(classes, day46Shows, resolveProfile) {
  const oldClasses = classes || {};
  const next = { ...oldClasses };
  const orphanedBanners = [];
  let changed = false;

  // Collect Day 46 Open/A Finals results by class.
  const day46ByClass = {};
  for (const show of day46Shows || []) {
    for (const result of show.results || []) {
      if (!CLASS_FINALS_CLASSES.includes(result.corpsClass)) continue;
      if (!day46ByClass[result.corpsClass]) day46ByClass[result.corpsClass] = [];
      day46ByClass[result.corpsClass].push(result);
    }
  }

  for (const corpsClass of CLASS_FINALS_CLASSES) {
    const results = day46ByClass[corpsClass];
    // No Day 46 field for this class — leave whatever is stored untouched.
    if (!results || results.length === 0) continue;

    const oldEntries = Array.isArray(oldClasses[corpsClass]) ? oldClasses[corpsClass] : [];

    // Banner buyers in the OLD podium for this class (banners can only be
    // bought by a rank-1 holder, so at most one, but map by uid defensively).
    const bannersByUid = new Map();
    for (const entry of oldEntries) {
      if (entry && entry.banner && entry.uid) bannersByUid.set(entry.uid, entry.banner);
    }

    const top3 = [...results].sort((a, b) => b.totalScore - a.totalScore).slice(0, 3);
    const placed = new Set();
    const rebuilt = top3.map((result, index) => {
      placed.add(result.uid);
      const profile = resolveProfile(result.uid);
      const entry = {
        rank: index + 1,
        uid: result.uid,
        username:
          (profile && profile.username) ||
          oldFieldForUid(oldEntries, result.uid, "username") ||
          "Unknown",
        corpsName: result.corpsName,
        // Prefer the graphic the Day 46 field carried, then any avatar the old
        // entry already had for this director; else null (re-run
        // backfillChampionAvatars.js afterward to fill fresh nulls).
        avatarUrl:
          result.avatarUrl || oldFieldForUid(oldEntries, result.uid, "avatarUrl") || null,
        score: result.totalScore,
      };
      // Carry a banner to its buyer's new entry, wherever they placed.
      if (bannersByUid.has(result.uid)) entry.banner = bannersByUid.get(result.uid);
      return entry;
    });

    // Any banner whose buyer is no longer on the corrected podium.
    for (const [uid, banner] of bannersByUid) {
      if (!placed.has(uid)) orphanedBanners.push({ corpsClass, uid, banner });
    }

    if (JSON.stringify(oldClasses[corpsClass]) !== JSON.stringify(rebuilt)) {
      next[corpsClass] = rebuilt;
      changed = true;
    }
  }

  return { classes: next, changed, orphanedBanners };
}

async function run({ commit }) {
  const db = admin.firestore();

  const snapshot = await db.collection("season_champions").get();
  console.log(`Scanning ${snapshot.size} archived season(s)…`);

  // First pass: load each season's Day 46 recap and gather every Open/A
  // champion uid so profiles are fetched once.
  const day46BySeason = new Map();
  const allUids = new Set();
  for (const doc of snapshot.docs) {
    const recapSnap = await db.doc(`fantasy_recaps/${doc.id}/days/46`).get();
    const shows = recapSnap.exists ? recapSnap.data().shows || [] : null;
    day46BySeason.set(doc.id, shows);
    if (!shows) continue;
    for (const show of shows) {
      for (const result of show.results || []) {
        if (CLASS_FINALS_CLASSES.includes(result.corpsClass) && result.uid) {
          allUids.add(result.uid);
        }
      }
    }
  }

  // uid -> profile data (or null when the profile is gone). Batched getAll,
  // chunked to stay under Firestore's ref limit.
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
  let missingRecap = 0;
  const orphaned = [];

  for (const doc of snapshot.docs) {
    const shows = day46BySeason.get(doc.id);
    if (!shows) {
      missingRecap += 1;
      console.log(`  ${doc.id}: no Day 46 recap — left unchanged`);
      continue;
    }

    const { classes, changed, orphanedBanners } = rebuildOpenAClasses(
      doc.get("classes") || {},
      shows,
      resolveProfile
    );

    for (const orphan of orphanedBanners) {
      orphaned.push({ seasonId: doc.id, ...orphan });
    }

    if (!changed) continue;

    docsChanged += 1;
    const summary = CLASS_FINALS_CLASSES.map((c) => {
      const champ = classes[c] && classes[c][0];
      return champ ? `${c}=${champ.corpsName || champ.username || champ.uid}` : null;
    })
      .filter(Boolean)
      .join(", ");
    console.log(`  ${doc.id}: rebuilt Open/A (${summary})`);

    if (commit) await doc.ref.update({ classes });
  }

  if (orphaned.length > 0) {
    console.log(`\n⚠ ${orphaned.length} ORPHANED BANNER(S) — buyer fell off the corrected podium:`);
    for (const o of orphaned) {
      console.log(
        `    season=${o.seasonId} class=${o.corpsClass} uid=${o.uid} ` +
          `message="${o.banner && o.banner.message}" — refund manually`
      );
    }
  }

  console.log(
    `\n${commit ? "Updated" : "Would update"} ${docsChanged} doc(s); ` +
      `${missingRecap} without a Day 46 recap; ${orphaned.length} orphaned banner(s).`
  );
  if (!commit) console.log("Dry run — re-run with --commit to apply.");

  return { docsChanged, missingRecap, orphaned };
}

module.exports = { rebuildOpenAClasses };

if (require.main === module) {
  const commit = process.argv.includes("--commit");
  run({ commit })
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
