/**
 * Week-scoped league scoring — the source of truth for "what did this director
 * do THIS week".
 *
 * League matchups used to resolve on `corps.{class}.totalSeasonScore`. Despite
 * its name that field is NOT a season aggregate: the nightly run overwrites it
 * with the corps' most recent show total each night ("Uses latest score (not
 * cumulative) — drum corps rankings are based on most recent performance",
 * helpers/scoring.js commitDailyScoring). Resolving a WEEK on it compared:
 *
 *  - a director whose last show was Tuesday against one whose last show was
 *    Saturday — different nights, different shows, no shared week;
 *  - a director who sat the whole week out at full strength, because the stale
 *    number from an earlier week carried forward untouched and could still win
 *    the matchup;
 *  - only the LAST of several shows, for anyone who competed more than once.
 *
 * This module derives the week's actual body of work from the committed recap
 * days (`fantasy_recaps/{seasonUid}/days/{d}`) — the same source
 * payWeeklyParticipationXP reads, and the same one the client's league table
 * sums (src/utils/leagueStats.ts buildWeeklyResults), so the server and the
 * client finally describe the same quantity.
 *
 * A week is seven competition days: week N covers days 7N-6 .. 7N, matching
 * the `scoredDay % 7 === 0` boundary in helpers/scoring.js.
 */

const { logger } = require("firebase-functions/v2");

/** Competition days covered by a week. Week 1 = days 1..7. */
function weekDayRange(week) {
  const lastDay = week * 7;
  return { firstDay: lastDay - 6, lastDay };
}

/** Index key for a director's corps in one class. */
function scoreKey(uid, corpsClass) {
  return `${uid}_${corpsClass}`;
}

/**
 * Fold a week's recap day documents into a per-corps weekly index.
 *
 * Pure: takes the snapshots, returns a plain Map. Every show a corps attended
 * during the week is summed, so competing twice counts twice — which is the
 * point, and what the "latest score" comparison threw away.
 *
 * @param {Array<{exists: boolean, data: function}>} dayDocs
 * @returns {{index: Map<string, {score: number, shows: number}>, daysFound: number}}
 */
function buildWeeklyScoreIndex(dayDocs) {
  const index = new Map();
  let daysFound = 0;

  for (const dayDoc of dayDocs) {
    if (!dayDoc || !dayDoc.exists) continue;
    daysFound += 1;
    for (const show of dayDoc.data().shows || []) {
      for (const result of show.results || []) {
        if (!result || !result.uid || !result.corpsClass) continue;
        const key = scoreKey(result.uid, result.corpsClass);
        const entry = index.get(key) || {
          uid: result.uid,
          corpsClass: result.corpsClass,
          score: 0,
          shows: 0,
        };
        entry.score += Number(result.totalScore) || 0;
        entry.shows += 1;
        index.set(key, entry);
      }
    }
  }

  return { index, daysFound };
}

/**
 * Read and fold a week's recap days.
 *
 * `daysFound` is how many of the seven day documents exist. Zero means the
 * recaps for this week were never written — callers MUST treat that as "cannot
 * resolve" rather than "everybody scored nothing", or a missing-data incident
 * silently freezes an entire week of matchups as ties.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} seasonUid
 * @param {number} week
 */
async function fetchWeeklyScoreIndex(db, seasonUid, week) {
  const { firstDay, lastDay } = weekDayRange(week);
  const dayRefs = [];
  for (let day = firstDay; day <= lastDay; day++) {
    dayRefs.push(db.doc(`fantasy_recaps/${seasonUid}/days/${day}`));
  }
  const dayDocs = await db.getAll(...dayRefs);
  const result = buildWeeklyScoreIndex(dayDocs);
  logger.info(
    `Week ${week} score index: ${result.index.size} corps across ${result.daysFound}/7 recap days.`
  );
  return result;
}

/**
 * One corps' week. A corps that did not compete scores 0 with 0 shows — that
 * is a real result (you forfeited the week), not missing data.
 *
 * @param {Map<string, {score: number, shows: number}>} index
 */
function getWeekScore(index, uid, corpsClass) {
  return index.get(scoreKey(uid, corpsClass)) || { score: 0, shows: 0 };
}

/**
 * Distinct classes each director competed in during the week, derived from the
 * same index — so participation XP and matchup resolution can never disagree
 * about who showed up.
 *
 * @param {Map<string, {score: number, shows: number}>} index
 * @returns {Map<string, Set<string>>} uid -> set of corps classes
 */
function participatingClassesByUid(index) {
  const byUid = new Map();
  for (const entry of index.values()) {
    if (entry.shows <= 0) continue;
    if (!byUid.has(entry.uid)) byUid.set(entry.uid, new Set());
    byUid.get(entry.uid).add(entry.corpsClass);
  }
  return byUid;
}

module.exports = {
  weekDayRange,
  scoreKey,
  buildWeeklyScoreIndex,
  fetchWeeklyScoreIndex,
  getWeekScore,
  participatingClassesByUid,
};
