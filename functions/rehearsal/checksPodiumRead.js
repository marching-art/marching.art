/**
 * How the Podium checks read the world back.
 *
 * Shared by checksPodium.js (did the season run, did the boundary produce a
 * record) and checksPodiumSettlement.js (was that record right about the money,
 * the divisions, the ballot and the return). Readers only — nothing here
 * asserts.
 */

const { paths } = require("../src/helpers/paths");
const podiumWorld = require("./podiumWorld");

/** Every Podium recap day the season wrote, keyed by competition day. */
async function readPodiumRecaps(db, seasonUid) {
  const snapshot = await db.collection(`podium-recaps/${seasonUid}/days`).get();
  const byDay = new Map();
  for (const doc of snapshot.docs) byDay.set(Number(doc.id), doc.data());
  return byDay;
}

/** Every result row on a Podium recap day, flattened across its shows. */
function rowsFor(recap) {
  return (recap?.shows || []).flatMap((show) => show.results || []);
}


/** The state, career and profile of every director in the Podium cast. */
async function readCast(db, seasonUid) {
  const cast = new Map();
  for (const director of podiumWorld.ALL_PODIUM_DIRECTORS) {
    const [state, career, profile, history] = await Promise.all([
      db.doc(paths.userPodiumState(director.uid)).get(),
      db.doc(paths.userPodiumCareer(director.uid)).get(),
      db.doc(paths.userProfile(director.uid)).get(),
      db.collection(paths.userCorpsCoinHistory(director.uid)).get(),
    ]);
    cast.set(director.uid, {
      director,
      state: state.exists ? state.data() : null,
      career: career.exists ? career.data() : null,
      profile: profile.exists ? profile.data() : null,
      history: history.docs.map((d) => d.data()),
      // A corps swept from the finished season carries that season's stamp;
      // one that has already re-registered carries the new one.
      finishedSeason: state.exists && state.data().seasonUid === seasonUid,
    });
  }
  return cast;
}

/**
 * A career holds the season it just played in one of two places: on the career
 * itself, or — when the director founded a new corps at re-registration —
 * banked inside `retiredCareers`. Both are the same archival; a check that
 * only looked at the live career would call a legitimately retired lineage a
 * missing one.
 */
function archivedSeasonRow(career, seasonUid) {
  const lineages = [career, ...((career && career.retiredCareers) || [])];
  for (const lineage of lineages) {
    const row = (lineage?.history || []).find((h) => h && h.seasonUid === seasonUid);
    if (row) return row;
  }
  return null;
}

/** The end-of-season financial report for `seasonUid`, live or retired. */
function seasonReportFor(career, seasonUid) {
  const lineages = [career, ...((career && career.retiredCareers) || [])];
  for (const lineage of lineages) {
    const report = lineage && lineage.lastSeasonReport;
    if (report && report.seasonUid === seasonUid) return report;
  }
  return null;
}

/** Top N of a row set by total, tie-inclusive at the cut line. */
function topN(rows, n) {
  if (rows.length === 0 || n <= 0) return new Set();
  const ranked = [...rows].sort((a, b) => b.totalScore - a.totalScore);
  const cutoff = ranked[Math.min(n, ranked.length) - 1].totalScore;
  return new Set(ranked.filter((r) => r.totalScore >= cutoff).map((r) => r.uid));
}

module.exports = {
  readPodiumRecaps,
  rowsFor,
  readCast,
  archivedSeasonRow,
  seasonReportFor,
  topN,
};
