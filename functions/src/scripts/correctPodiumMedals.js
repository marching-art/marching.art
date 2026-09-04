/**
 * Correction: re-rank every Podium recap WITHIN ITS DIVISION and rebuild the
 * medal counters from the corrected rows.
 *
 * Every division crowns its own winner (§5.7): the recap sheet sections a show
 * World / Open / A and numbers each section on its own, and the season ledger
 * prints a corps' place within its division. But the nightly processor used
 * to rank the MIXED field — `place` was the rank among everyone at the show,
 * and the gold / silver / bronze went to the top three of that mixed field
 * (once it held `balance.medals.minFieldSize` corps). So a director saw "1/3"
 * beside a silver and "2/3" beside a gold, and the lifetime medal counters on
 * the profile counted podiums nobody was shown.
 *
 * The processor now ranks per division (helpers/podium/showRanking.js — one
 * rule, shared with this script). This one-off (re-runnable) migration brings
 * the data already written into line with it:
 *
 *   1. RECAPS: for every `podium-recaps/{season}/days/{day}` show, re-stamp each
 *      row's `place`, `fieldSize` and `medal` from its division field. Rows are
 *      never added or removed and every other field is left alone.
 *   2. COUNTERS: tally the corrected medals per corps per season and reconcile
 *      the counters that display them —
 *        - the live season's `podium/state.medals` and its profile mirror
 *          `corps.podiumClass.medals` (only when the state doc still holds that
 *          season, i.e. `state.seasonUid` matches);
 *        - an archived season's `podium/career.history[].medals` entry (the
 *          career's own lineage or a retired one), which is what the
 *          between-seasons assessment and the trophy case read back.
 *
 * Idempotent: a row already ranked per division serializes identically and is
 * skipped; counters are written only when they differ. A second run that finds
 * nothing is a safe no-op.
 *
 * Run from the GitHub Actions tab (no console needed) —
 * .github/workflows/correct-podium-medals.yml — or locally:
 *   node src/scripts/correctPodiumMedals.js --dry-run
 *   node src/scripts/correctPodiumMedals.js --commit
 */

const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();

const { paths } = require("../helpers/paths");
const store = require("../helpers/podium/store");
const { MEDAL_NAMES, rankShowResults } = require("../helpers/podium/showRanking");

const EMPTY_MEDALS = Object.freeze({ gold: 0, silver: 0, bronze: 0 });

/**
 * Re-rank every show of one recap day in place (division place, division
 * field size, medal). Legacy per-day recaps carried a flat `results` array —
 * that is one show, and is ranked the same way. Pure.
 *
 * @param {Object} recap podium-recaps/{seasonUid}/days/{day} doc data.
 * @param {{ minFieldSize: number }} medalsCfg
 * @returns {{ changed: boolean, rowsChanged: number, rows: Array }} The recap
 *   is mutated; `rows` is every ranked row (for the medal tally).
 */
function rerankRecap(recap, medalsCfg) {
  const shows = Array.isArray(recap && recap.shows)
    ? recap.shows
    : Array.isArray(recap && recap.results)
      ? [{ results: recap.results }]
      : [];
  let changed = false;
  let rowsChanged = 0;
  const rows = [];
  for (const show of shows) {
    const results = Array.isArray(show.results) ? show.results : [];
    if (results.length === 0) continue;
    const before = results.map((row) => JSON.stringify(row));
    rankShowResults(results, medalsCfg);
    results.forEach((row, index) => {
      if (JSON.stringify(row) !== before[index]) {
        changed = true;
        rowsChanged += 1;
      }
      rows.push(row);
    });
  }
  return { changed, rowsChanged, rows };
}

/**
 * Count medals per corps from ranked recap rows: `{ [uid]: {gold, silver, bronze} }`.
 * A corps with no medal in the season gets no entry — its counter should be
 * empty, and `medalsEqual` treats a missing counter as one.
 * @param {Array<{ uid?: string, medal?: ?string }>} rows
 * @returns {Record<string, { gold: number, silver: number, bronze: number }>}
 */
function tallyMedals(rows) {
  /** @type {Record<string, { gold: number, silver: number, bronze: number }>} */
  const byUid = {};
  for (const row of rows) {
    if (!row || !row.uid || !MEDAL_NAMES.includes(row.medal)) continue;
    if (!byUid[row.uid]) byUid[row.uid] = { ...EMPTY_MEDALS };
    byUid[row.uid][row.medal] += 1;
  }
  return byUid;
}

/** Zero and missing are the same medal count. */
function medalsEqual(a, b) {
  return MEDAL_NAMES.every((m) => ((a && a[m]) || 0) === ((b && b[m]) || 0));
}

/**
 * The counter to store for a corps: the tally, or an all-zero record when it
 * won nothing (never `undefined`, so a wrong old count is overwritten).
 */
function counterFor(tally, uid) {
  return { ...EMPTY_MEDALS, ...((tally && tally[uid]) || {}) };
}

/**
 * Reconcile an archived season's medal count on a career doc. Returns the
 * fields to write (whichever lineage held the entry), or null when the season
 * is not archived on this career or its count already agrees. Pure.
 *
 * @param {Object} career podium/career doc data.
 * @param {string} seasonUid
 * @param {{ gold: number, silver: number, bronze: number }} medals
 * @returns {?Object} Partial doc: `{ history }` or `{ retiredCareers }`.
 */
function reconcileCareerMedals(career, seasonUid, medals) {
  if (!career) return null;
  const patchHistory = (history) => {
    const index = (history || []).findIndex((h) => h && h.seasonUid === seasonUid);
    if (index === -1) return null;
    if (medalsEqual(history[index].medals, medals)) return false;
    const next = history.slice();
    next[index] = { ...next[index], medals: { ...medals } };
    return next;
  };

  const own = patchHistory(career.history);
  if (own) return { history: own };
  if (own === false) return null;

  const retired = Array.isArray(career.retiredCareers) ? career.retiredCareers : [];
  for (let i = 0; i < retired.length; i++) {
    const patched = patchHistory(retired[i] && retired[i].history);
    if (patched === false) return null;
    if (patched) {
      const next = retired.slice();
      next[i] = { ...retired[i], history: patched };
      return { retiredCareers: next };
    }
  }
  return null;
}

async function run({ commit }) {
  const db = admin.firestore();
  const medalsCfg = store.balance.medals;

  // ---- 1. Recaps ----------------------------------------------------------
  console.log(`Re-ranking Podium recaps within division (medals from ${medalsCfg.minFieldSize}+ corps)…`);
  const seasonRefs = await db.collection("podium-recaps").listDocuments();
  /** @type {Map<string, Record<string, { gold: number, silver: number, bronze: number }>>} */
  const tallyBySeason = new Map();
  let recapsChanged = 0;
  let rowsChanged = 0;

  for (const seasonRef of seasonRefs) {
    const seasonUid = seasonRef.id;
    const daySnaps = await seasonRef.collection("days").get();
    const seasonRows = [];
    let writer = db.batch();
    let pending = 0;
    for (const daySnap of daySnaps.docs) {
      const recap = daySnap.data();
      const result = rerankRecap(recap, medalsCfg);
      seasonRows.push(...result.rows);
      if (!result.changed) continue;
      recapsChanged += 1;
      rowsChanged += result.rowsChanged;
      console.log(`  ${seasonUid}/day ${daySnap.id}: ${result.rowsChanged} row(s) re-ranked`);
      if (commit) {
        const patch = Array.isArray(recap.shows) ? { shows: recap.shows } : { results: recap.results };
        writer.update(daySnap.ref, patch);
        pending += 1;
        if (pending >= 400) {
          await writer.commit();
          writer = db.batch();
          pending = 0;
        }
      }
    }
    if (commit && pending > 0) await writer.commit();
    tallyBySeason.set(seasonUid, tallyMedals(seasonRows));
  }
  console.log(
    `  ${commit ? "Updated" : "Would update"} ${recapsChanged} recap day(s), ${rowsChanged} row(s).`
  );

  // ---- 2. Counters --------------------------------------------------------
  console.log("Reconciling medal counters…");
  let statesChanged = 0;
  let careersChanged = 0;
  const FETCH_CHUNK = 150;

  for (const [seasonUid, tally] of tallyBySeason) {
    const rosterRefs = await store.rosterCollection(db, seasonUid).listDocuments();
    for (let i = 0; i < rosterRefs.length; i += FETCH_CHUNK) {
      const uids = rosterRefs.slice(i, i + FETCH_CHUNK).map((ref) => ref.id);
      const stateRefs = uids.map((uid) => store.stateRef(db, uid));
      const careerRefs = uids.map((uid) => db.doc(paths.userPodiumCareer(uid)));
      const [stateSnaps, careerSnaps] = await Promise.all([
        db.getAll(...stateRefs),
        db.getAll(...careerRefs),
      ]);

      const batch = db.batch();
      let pending = 0;
      uids.forEach((uid, idx) => {
        const medals = counterFor(tally, uid);
        const state = stateSnaps[idx].exists ? stateSnaps[idx].data() : null;
        if (state && state.seasonUid === seasonUid) {
          // The live season: the state doc and its profile mirror display it.
          if (!medalsEqual(state.medals, medals)) {
            statesChanged += 1;
            console.log(
              `  ${uid} (${seasonUid}, live): ${fmtMedals(state.medals)} → ${fmtMedals(medals)}`
            );
            batch.set(stateRefs[idx], { medals }, { merge: true });
            batch.set(
              store.profileRef(db, uid),
              { corps: { podiumClass: { medals } } },
              { merge: true }
            );
            pending += 2;
          }
          return;
        }
        // An archived season: the career's history entry carries the count.
        const career = careerSnaps[idx].exists ? careerSnaps[idx].data() : null;
        const patch = reconcileCareerMedals(career, seasonUid, medals);
        if (patch) {
          careersChanged += 1;
          console.log(`  ${uid} (${seasonUid}, archived): → ${fmtMedals(medals)}`);
          batch.update(careerRefs[idx], patch);
          pending += 1;
        }
      });
      if (commit && pending > 0) await batch.commit();
    }
  }

  console.log(
    `\n${commit ? "Updated" : "Would update"} ${recapsChanged} recap day(s), ` +
      `${statesChanged} live medal counter(s), ${careersChanged} archived season(s).`
  );
  if (!commit) console.log("Dry run — re-run with --commit to apply.");

  return { recapsChanged, rowsChanged, statesChanged, careersChanged };
}

function fmtMedals(medals) {
  const m = medals || {};
  return `${m.gold || 0}G/${m.silver || 0}S/${m.bronze || 0}B`;
}

module.exports = { rerankRecap, tallyMedals, medalsEqual, reconcileCareerMedals };

if (require.main === module) {
  const commit = process.argv.includes("--commit");
  run({ commit })
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
