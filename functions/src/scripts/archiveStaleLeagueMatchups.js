/**
 * One-off repair: move pre-rollover league matchup documents into history.
 *
 * Matchup documents are keyed by week number alone (`matchups/week-N`), and
 * season rollover reset standings but never touched them. So when a second
 * season began, last season's week-1 was still sitting in the live collection —
 * and the generator skips a week whose document already exists. A league that
 * completed one season never had matchups generated again: every week looked
 * done, the weekly resolution found nothing to resolve, and the standings table
 * never moved for the rest of the season.
 *
 * resetLeaguesForNewSeason now archives them, and the generator regenerates
 * over a document stamped with a previous season, so this cannot recur. But
 * leagues ALREADY in that state are stuck: their stale documents predate the
 * `seasonUid` stamp, so nothing can tell them apart from this season's work.
 * That is what this script is for.
 *
 * A week document is treated as stale when it carries no `seasonUid` stamp AND
 * the league has already archived at least one prior season's standings — i.e.
 * the league has rolled over at least once, so an unstamped week can only have
 * been written before that rollover.
 *
 *   node src/scripts/archiveStaleLeagueMatchups.js --dry-run
 *   node src/scripts/archiveStaleLeagueMatchups.js --commit
 */

const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();

const { paths } = require("../helpers/paths");

const WEEK_ID = /^week-(\d+)$/;

/**
 * Decide what to do with one league. Pure, so the rule is testable without
 * Firestore.
 *
 * @param {Array<{id: string, data: object}>} weekDocs live matchup documents
 * @param {string[]} archivedSeasonIds standings docs other than `current`
 * @param {string|null} liveSeasonUid
 * @returns {{stale: Array<{id: string, week: string, seasonUid: string}>, reason: string}}
 */
function planLeagueRepair(weekDocs, archivedSeasonIds, liveSeasonUid) {
  const weeks = weekDocs.filter((doc) => WEEK_ID.test(doc.id));
  if (weeks.length === 0) return { stale: [], reason: "no matchup weeks" };

  // A league that has never rolled over cannot have stale weeks: everything in
  // the live collection belongs to the only season it has played.
  if (archivedSeasonIds.length === 0) {
    return { stale: [], reason: "league has never rolled over" };
  }

  // Most recent archived season by id ordering — season uids sort
  // chronologically, and this is only used to label the history document.
  const mostRecentArchived = [...archivedSeasonIds].sort().pop();

  const stale = [];
  for (const doc of weeks) {
    const stamp = doc.data.seasonUid;
    if (stamp) {
      // Stamped documents are self-describing; the generator already handles
      // these, and a stamp matching the live season is simply current work.
      if (liveSeasonUid && stamp !== liveSeasonUid) {
        stale.push({ id: doc.id, week: doc.id.match(WEEK_ID)[1], seasonUid: stamp });
      }
      continue;
    }
    stale.push({
      id: doc.id,
      week: doc.id.match(WEEK_ID)[1],
      seasonUid: mostRecentArchived,
    });
  }

  return { stale, reason: stale.length ? "stale weeks found" : "all weeks current" };
}

async function run({ commit }) {
  const db = admin.firestore();

  const seasonDoc = await db.doc("game-settings/season").get();
  const liveSeasonUid = seasonDoc.exists ? seasonDoc.data().seasonUid || null : null;
  if (!liveSeasonUid) {
    console.warn("No live season; stamped documents cannot be judged, unstamped ones still can.");
  }

  const leagues = await db.collection(paths.leagues()).get();
  console.log(`Scanning ${leagues.size} league(s)…`);

  let leaguesRepaired = 0;
  let docsMoved = 0;

  for (const leagueDoc of leagues.docs) {
    const [matchups, standings] = await Promise.all([
      leagueDoc.ref.collection("matchups").get(),
      leagueDoc.ref.collection("standings").get(),
    ]);

    const weekDocs = matchups.docs.map((d) => ({ id: d.id, data: d.data() }));
    const archivedSeasonIds = standings.docs.map((d) => d.id).filter((id) => id !== "current");

    const { stale, reason } = planLeagueRepair(weekDocs, archivedSeasonIds, liveSeasonUid);
    if (stale.length === 0) {
      console.log(`  ${leagueDoc.id} (${leagueDoc.data().name || "unnamed"}): ${reason}`);
      continue;
    }

    console.log(
      `  ${leagueDoc.id} (${leagueDoc.data().name || "unnamed"}): ` +
        `${stale.length} stale week(s) → ${stale.map((s) => s.id).join(", ")}`
    );
    leaguesRepaired += 1;
    docsMoved += stale.length;

    if (!commit) continue;

    const batch = db.batch();
    for (const entry of stale) {
      const source = matchups.docs.find((d) => d.id === entry.id);
      batch.set(
        db.doc(paths.leagueMatchupHistoryWeek(leagueDoc.id, entry.seasonUid, entry.week)),
        { ...source.data(), seasonUid: entry.seasonUid, archivedAt: new Date() }
      );
      batch.delete(source.ref);
    }
    await batch.commit();
  }

  console.log(
    `${commit ? "Moved" : "Would move"} ${docsMoved} document(s) across ${leaguesRepaired} league(s).`
  );
  if (!commit) console.log("Dry run — re-run with --commit to apply.");
}

module.exports = { planLeagueRepair };

if (require.main === module) {
  const commit = process.argv.includes("--commit");
  run({ commit }).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
