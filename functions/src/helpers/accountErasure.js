/**
 * Anonymize a deleted director's PAST RESULTS in place.
 *
 * Account deletion removes the profile (and with it the username reservation),
 * so a director's name returns to the open market. But their historical
 * standings live in materialized public documents that DENORMALIZE the
 * director's identity (`displayName`/`username` + a `uid` the Scores sheets link
 * to `/profile/{uid}`). Left untouched, those old rows would keep showing a name
 * that now belongs to no one — or, once the freed username is reclaimed, appear
 * to belong to a different, living director.
 *
 * The rule the product wants: the RESULT stays (the corps name and its scores
 * are the record), but it must no longer name the deleted director or link to a
 * profile that no longer exists. The frontend already renders every director
 * credit as `displayName && (uid ? <Link/> : <span/>)`, so nulling `displayName`
 * both hides the name and drops the link while keeping the row — and we keep
 * `uid` because the results-page builder and the Podium sheets key rows on it.
 * The Hall of Champions is the one surface with no `displayName` gate (it prints
 * `Director: {username}` and links whenever `uid` is set), so there we null both
 * `uid` and `username` instead.
 *
 * The Scores page's Fantasy standings don't read the recap days directly — they
 * read the nightly-materialized `fantasy_standings/{season}/classes/{class}`
 * docs (helpers/standingsMaterializer.js), which DENORMALIZE the same
 * `displayName`/`uid` off the recap rows. The current season self-heals on the
 * next nightly materialization (it rebuilds from the now-anonymized recaps), but
 * archived seasons never re-materialize, so those docs would keep the deleted
 * name forever. This sweep anonymizes them in place too — the exact analog of
 * the Podium standings docs above.
 *
 * The transforms below are pure so they can be unit-tested; scanAndErase does
 * the Firestore I/O. Everything is best-effort at the call site: the account is
 * gone regardless, and re-running is idempotent (a second pass finds nothing to
 * change).
 */

const { logger } = require("firebase-functions/v2");

/**
 * Null the director credit (`displayName`, and a `username` if the row carries
 * one) on every entry in `results` whose `uid` matches, keeping `uid` and the
 * rest of the row intact.
 * @returns {boolean} whether anything changed.
 */
function anonymizeResultEntries(results, uid) {
  if (!Array.isArray(results)) return false;
  let changed = false;
  for (const entry of results) {
    if (!entry || entry.uid !== uid) continue;
    if (entry.displayName != null) {
      entry.displayName = null;
      changed = true;
    }
    if (entry.username != null) {
      entry.username = null;
      changed = true;
    }
  }
  return changed;
}

/**
 * Anonymize a recap day document ({ shows: [{ results: [...] }] }) — the shared
 * shape of fantasy_recaps and podium-recaps day docs. Mutates `data` in place.
 * @returns {boolean} whether anything changed.
 */
function anonymizeRecapDay(data, uid) {
  if (!data || !Array.isArray(data.shows)) return false;
  let changed = false;
  for (const show of data.shows) {
    if (anonymizeResultEntries(show?.results, uid)) changed = true;
  }
  return changed;
}

/**
 * Anonymize a Podium standings document ({ standings: [...] }). Mutates `data`.
 * @returns {boolean} whether anything changed.
 */
function anonymizeStandingsDoc(data, uid) {
  if (!data) return false;
  return anonymizeResultEntries(data.standings, uid);
}

/**
 * Anonymize a materialized Fantasy standings class document ({ entries: [...] }),
 * the `fantasy_standings/{season}/classes/{class}` shape written by
 * helpers/standingsMaterializer.js. Each entry denormalizes the recap row's
 * `displayName`/`uid`; the bounded score history nested on the entry carries no
 * identity, so nulling the entry's `displayName` is all the frontend credit gate
 * needs. Mutates `data` in place.
 * @returns {boolean} whether anything changed.
 */
function anonymizeFantasyStandingsDoc(data, uid) {
  if (!data) return false;
  return anonymizeResultEntries(data.entries, uid);
}

/**
 * Anonymize a season_champions document ({ classes: { worldClass: [...] } }).
 * Champion rows have no `displayName` gate on the frontend — the link is drawn
 * whenever `uid` is set and the name comes straight from `username` — so drop
 * both `uid` and `username` here. Mutates `data` in place.
 * @returns {boolean} whether anything changed.
 */
function anonymizeChampionsDoc(data, uid) {
  if (!data || !data.classes || typeof data.classes !== "object") return false;
  let changed = false;
  for (const corpsClass of Object.keys(data.classes)) {
    const entries = data.classes[corpsClass];
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (!entry || entry.uid !== uid) continue;
      entry.uid = null;
      if (entry.username != null) entry.username = null;
      changed = true;
    }
  }
  return changed;
}

/**
 * Scan one collection of documents, apply `transform(data, uid)` to each, and
 * rewrite only the docs that changed. `getDocRefs` returns the DocumentReferences
 * to visit. Best-effort per doc so one malformed record can't abort the sweep.
 * @returns {Promise<number>} number of documents rewritten.
 */
async function eraseInDocs(getDocRefs, transform, uid) {
  let rewritten = 0;
  const refs = await getDocRefs();
  for (const ref of refs) {
    try {
      const snap = await ref.get();
      if (!snap.exists) continue;
      const data = snap.data();
      if (transform(data, uid)) {
        await ref.set(data);
        rewritten++;
      }
    } catch (docError) {
      logger.warn(`Erasure skipped a doc (${ref.path}) for ${uid}: ${docError.message}`);
    }
  }
  return rewritten;
}

/**
 * Anonymize `uid` across every persistent results surface: fantasy_recaps and
 * podium-recaps day docs, Podium standings docs, and season_champions.
 *
 * Each recap collection is keyed by season, so we enumerate seasons via
 * listDocuments() (a season may have only subcollections and no parent doc, so
 * a plain .get() would miss it) and then sweep each season's day/standings
 * subcollections. Bounded by the game's history; deletions are rare and this
 * runs best-effort, so a partial sweep is acceptable — re-running is idempotent.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} uid
 * @returns {Promise<{recapDays:number, standings:number, champions:number, fantasyStandings:number}>}
 */
async function eraseDirectorFromResults(db, uid) {
  const stats = { recapDays: 0, standings: 0, champions: 0, fantasyStandings: 0 };

  for (const recapCollection of ["fantasy_recaps", "podium-recaps"]) {
    let seasonRefs = [];
    try {
      seasonRefs = await db.collection(recapCollection).listDocuments();
    } catch (error) {
      logger.warn(`Erasure could not list ${recapCollection} for ${uid}: ${error.message}`);
      continue;
    }
    for (const seasonRef of seasonRefs) {
      stats.recapDays += await eraseInDocs(
        () => seasonRef.collection("days").listDocuments(),
        anonymizeRecapDay,
        uid
      );
      // podium-recaps also keeps a per-day `standings` subcollection.
      if (recapCollection === "podium-recaps") {
        stats.standings += await eraseInDocs(
          () => seasonRef.collection("standings").listDocuments(),
          anonymizeStandingsDoc,
          uid
        );
      }
    }
  }

  // Materialized Fantasy standings: one summary doc per season plus a
  // `classes/{class}` subcollection carrying the denormalized director credit
  // the Scores page renders. The summary doc holds no per-director identity, so
  // only the class docs need sweeping.
  let fantasyStandingsSeasons = [];
  try {
    fantasyStandingsSeasons = await db.collection("fantasy_standings").listDocuments();
  } catch (error) {
    logger.warn(`Erasure could not list fantasy_standings for ${uid}: ${error.message}`);
  }
  for (const seasonRef of fantasyStandingsSeasons) {
    stats.fantasyStandings += await eraseInDocs(
      () => seasonRef.collection("classes").listDocuments(),
      anonymizeFantasyStandingsDoc,
      uid
    );
  }

  stats.champions += await eraseInDocs(
    () => db.collection("season_champions").listDocuments(),
    anonymizeChampionsDoc,
    uid
  );

  return stats;
}

module.exports = {
  anonymizeResultEntries,
  anonymizeRecapDay,
  anonymizeStandingsDoc,
  anonymizeFantasyStandingsDoc,
  anonymizeChampionsDoc,
  eraseDirectorFromResults,
};
