/**
 * Correction: put every live Podium corps back on its OWN record.
 *
 * History follows the corps (owner direction, 2026-10): a corps is its name, a
 * corps with a new name holds no history, and a newly founded corps starts in
 * A Class from a blank slate. Before that rule was enforced, three paths could
 * hand a new corps its predecessor's record:
 *
 *   - RENAMED: "continue" allowed a new name, so the new name kept the old
 *     corps' reputation, class seat, and history.
 *   - CONTAMINATED: retiring a corps and then founding one let registration
 *     re-apply the retired corps' last season onto the new corps.
 *   - SEATED: a new corps founded while the season boundary was still being
 *     swept received the class seat its predecessor had earned.
 *
 * For every corps fielded THIS season, this one-off (re-runnable) migration
 * detects those shapes (pure `planLineageRepair`) and fixes them:
 *
 *   - RENAMED → the old record is banked under the old name as a retired corps
 *     (recoverable through "bring back a retired corps"), and the live corps
 *     restarts blank: A Class, Community Corps.
 *   - CONTAMINATED → the inherited season is dropped from the live corps (the
 *     retired corps already holds it) and the live corps restarts blank.
 *   - SEATED → the new corps returns to A Class, and the seat goes to the
 *     retired corps that earned it.
 *
 * The live season state (`division`, `reputation`, `repTier`) and the profile
 * display are brought in line. Scores already posted, staff, and the corps'
 * look are left alone. Idempotent: a corrected corps no longer matches.
 *
 * Run from the GitHub Actions tab — .github/workflows/correct-podium-lineages.yml
 * — or locally:
 *   node src/scripts/correctPodiumLineages.js --dry-run
 *   node src/scripts/correctPodiumLineages.js --commit
 */

const career = require("../helpers/podium/career");
const divisions = require("../helpers/podium/divisions");

/** A blank live record for `corpsName`, keeping the banked lineages. */
function blankCareer(corpsName, retiredCareers) {
  return {
    ...career.initCareer(),
    corpsName,
    division: "aClass",
    underCutoffSeasons: 0,
    retiredCareers,
  };
}

/**
 * Plan the repair for one corps fielded this season (pure). Returns null when
 * the corps is on its own record, else
 * { kind, career, state, profile, note } — the full career doc to write and
 * the merge patches for the live state and the profile's `corps.podiumClass`.
 *
 * @param {{ careerData: any, state: any, currentIndex: number }} input
 */
function planLineageRepair({ careerData, state, currentIndex }) {
  if (!careerData || !state) return null;
  const name = state.corpsName || careerData.corpsName;
  const history = careerData.history || [];
  const latest = history[history.length - 1];
  const retired = careerData.retiredCareers || [];
  const blankState = { division: "aClass", reputation: 0, repTier: 1 };
  const blankProfile = { division: "aClass", repTier: 1 };

  if (latest && latest.corpsName && !career.isSameCorps({ corpsName: latest.corpsName }, name)) {
    const inherited = latest.seasonUid;
    const alreadyBanked = retired.some((lineage) => career.lineagePlayed(lineage, inherited));
    if (alreadyBanked && history.length === 1) {
      return {
        kind: "contaminated",
        career: blankCareer(name, retired),
        state: blankState,
        profile: blankProfile,
        note: `dropped ${latest.corpsName}'s ${inherited} season from ${name}`,
      };
    }
    const banked = career.bankLineage(
      { ...careerData, corpsName: latest.corpsName },
      currentIndex,
      null
    );
    return {
      kind: "renamed",
      career: blankCareer(name, [...retired.slice(-9), banked]),
      state: blankState,
      profile: blankProfile,
      note: `banked ${latest.corpsName} (${careerData.seasonsPlayed || 0} seasons); ${name} restarts blank`,
    };
  }

  const fresh = !(careerData.seasonsPlayed > 0) && history.length === 0;
  const seat = divisions.normalizeDivision(careerData.division);
  const liveSeat = divisions.normalizeDivision(state.division);
  if (fresh && (seat !== "aClass" || liveSeat !== "aClass")) {
    // Hand the seat to the retired corps that played the season it was earned in.
    let nextRetired = retired;
    const index = retired.length - 1;
    if (seat !== "aClass" && index >= 0 && retired[index].lastSeasonUid) {
      nextRetired = [...retired];
      nextRetired[index] = { ...retired[index], division: seat };
    }
    return {
      kind: "seated",
      career: { ...careerData, division: "aClass", underCutoffSeasons: 0, retiredCareers: nextRetired },
      state: { division: "aClass" },
      profile: { division: "aClass" },
      note: `${name} was seated in ${divisions.DIVISION_LABELS[liveSeat === "aClass" ? seat : liveSeat]}`,
    };
  }
  return null;
}

async function run({ commit }) {
  const { getFirestore } = require("firebase-admin/firestore");
  const { initializeApp, getApps } = require("firebase-admin/app");
  if (!getApps().length) initializeApp();
  const store = require("../helpers/podium/store");
  const db = getFirestore();

  const seasonDoc = await db.doc("game-settings/season").get();
  const seasonUid = seasonDoc.exists ? seasonDoc.data().seasonUid : null;
  if (!seasonUid) throw new Error("No active season.");
  const currentIndex = await career.peekSeasonIndex(db, seasonUid);
  const roster = await store.rosterCollection(db, seasonUid).get();
  console.log(`Season ${seasonUid} (index ${currentIndex}): ${roster.size} Podium corps.`);

  const counts = { renamed: 0, contaminated: 0, seated: 0 };
  for (const rosterDoc of roster.docs) {
    const uid = rosterDoc.id;
    const [careerSnapshot, stateSnapshot] = await Promise.all([
      career.careerRef(db, uid).get(),
      store.stateRef(db, uid).get(),
    ]);
    const state = stateSnapshot.exists ? stateSnapshot.data() : null;
    if (!state || state.seasonUid !== seasonUid || !careerSnapshot.exists) continue;
    const plan = planLineageRepair({ careerData: careerSnapshot.data(), state, currentIndex });
    if (!plan) continue;
    counts[plan.kind] += 1;
    console.log(`  ${uid} [${plan.kind}] ${plan.note}`);
    if (!commit) continue;
    const batch = db.batch();
    batch.set(career.careerRef(db, uid), { ...plan.career, updatedAt: new Date().toISOString() });
    batch.set(store.stateRef(db, uid), plan.state, { merge: true });
    batch.set(store.profileRef(db, uid), { corps: { podiumClass: plan.profile } }, { merge: true });
    await batch.commit();
  }

  console.log(
    `\n${commit ? "Corrected" : "Would correct"} ${counts.renamed} renamed, ` +
      `${counts.contaminated} contaminated, ${counts.seated} mis-seated corps.`
  );
  if (!commit) console.log("Dry run — re-run with --commit to apply.");
  return counts;
}

if (require.main === module) {
  const commit = process.argv.includes("--commit");
  run({ commit })
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { planLineageRepair };
