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

/**
 * One corps' week, as folded from the recap days.
 *
 * @typedef {Object} WeekScoreEntry
 * @property {string} uid
 * @property {string} corpsClass
 * @property {number} score - total across every show attended this week
 * @property {number} shows - shows attended
 * @property {number} ge - General Effect across the week (0–40 per show)
 * @property {number} visual - Visual across the week (0–30 per show)
 * @property {number} music - Music across the week (0–30 per show)
 * @property {number} classPercentile - finish against this corps' own class, 0–100
 * @property {number} classFieldSize - how many corps that class fielded
 */

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
 * @returns {{index: Map<string, WeekScoreEntry>, daysFound: number}}
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
          ge: 0,
          visual: 0,
          music: 0,
        };
        entry.score += Number(result.totalScore) || 0;
        // The three caption groups the scorer already persists on every show
        // result (helpers/scoring.js): GE 0–40, Visual 0–30, Music 0–30. Summed
        // exactly like `score`, so competing twice counts twice in every
        // category equally. Only the Caption Wars format reads these; carrying
        // them always costs one addition over documents already in memory, and
        // means the format can never disagree with the total about which shows
        // a week contained.
        entry.ge += Number(result.geScore) || 0;
        entry.visual += Number(result.visualScore) || 0;
        entry.music += Number(result.musicScore) || 0;
        entry.shows += 1;
        index.set(key, entry);
      }
    }
  }

  applyClassPercentiles(index);
  return { index, daysFound };
}

/**
 * Rank each corps against the rest of ITS OWN CLASS and store the result as a
 * 0–100 percentile.
 *
 * League standings are league-wide but matchups are class-segregated, so a
 * mixed-class league ranked its members on numbers that were never comparable:
 * a World Class week is ~90 points and a SoundSport week ~60, which meant the
 * points tiebreaker quietly sorted by class rather than by performance. A
 * percentile answers the question that actually transfers — "how did you do
 * against your own field this week" — and 82nd percentile means the same thing
 * in every class.
 *
 * The reference population is every corps in that class across the whole game
 * for the week, not just the league, because a league of three is far too small
 * a field to rank against.
 *
 * Percentile is the fraction of its own class this corps finished AT OR AHEAD
 * OF. The best corps in a class is 100 and a lone entrant is 100 — they led
 * their field — while last of four is 25. Tied corps share a value rather than
 * one arbitrarily edging the other. (The textbook mid-rank definition never
 * reaches 100, which reads wrong to a director who just won their class.)
 */
function applyClassPercentiles(index) {
  const byClass = new Map();
  for (const entry of index.values()) {
    if (!byClass.has(entry.corpsClass)) byClass.set(entry.corpsClass, []);
    byClass.get(entry.corpsClass).push(entry);
  }

  for (const entries of byClass.values()) {
    const sorted = [...entries].sort((a, b) => a.score - b.score);
    const total = sorted.length;
    for (const entry of entries) {
      // Everyone this corps finished ahead of, plus everyone level with it
      // (itself included) — so ties share a value and the class winner is 100.
      let below = 0;
      let tied = 0;
      for (const other of sorted) {
        if (other.score < entry.score) below += 1;
        else if (other.score === entry.score) tied += 1;
      }
      entry.classPercentile = total === 0 ? 0 : ((below + tied) / total) * 100;
      entry.classFieldSize = total;
    }
  }

  return index;
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
 * @param {Map<string, WeekScoreEntry>} index
 * @returns {WeekScoreEntry}
 */
function getWeekScore(index, uid, corpsClass) {
  return (
    index.get(scoreKey(uid, corpsClass)) || {
      uid,
      corpsClass,
      score: 0,
      shows: 0,
      // Zero in every caption too, so a Caption Wars matchup against a director
      // who sat the week out is a 3-0 sweep rather than a comparison against
      // undefined. Forfeiting a week forfeits every category.
      ge: 0,
      visual: 0,
      music: 0,
      // Did not compete: last in their field, by definition.
      classPercentile: 0,
      classFieldSize: 0,
    }
  );
}

/**
 * Decide one head-to-head matchup from the week index — the ONE place the
 * decision rule lives, shared by the nightly resolution
 * (helpers/weeklyMatchups.js) and the commissioner's manual close
 * (callable/leagues.js updateMatchupResults) so the two can never disagree
 * about who won a week.
 *
 * A same-class matchup is decided on the weekly point totals, as always. A
 * CROSS-CLASS matchup (generated for the directors a class could not seat —
 * see leagueHelpers.js pairLeagueWeek) carries a per-side `classes` map and is
 * decided on each corps' percentile against ITS OWN class field, because a
 * ~90-point World Class week and a ~60-point SoundSport week are not on the
 * same scale. Sitting the week out is 0th percentile, so showing up still
 * beats a forfeit; two forfeits (or two identical percentiles) tie.
 *
 * @param {Object} matchup - stored matchup entry ({ pair, classes? })
 * @param {string} corpsClass - the class array the matchup is stored under
 * @param {Map<string, WeekScoreEntry>} index - the week's score index
 * @returns {{p1: string, p2: string, p1Class: string, p2Class: string,
 *   crossClass: boolean, p1Week: WeekScoreEntry, p2Week: WeekScoreEntry,
 *   winner: string}} winner is a uid or the string 'tie'
 */
function decideHeadToHead(matchup, corpsClass, index) {
  const [p1, p2] = matchup.pair;
  const p1Class = matchup.classes?.[p1] || corpsClass;
  const p2Class = matchup.classes?.[p2] || corpsClass;
  const crossClass = p1Class !== p2Class;
  const p1Week = getWeekScore(index, p1, p1Class);
  const p2Week = getWeekScore(index, p2, p2Class);

  let winner = "tie";
  if (crossClass) {
    if (p1Week.classPercentile > p2Week.classPercentile) winner = p1;
    else if (p2Week.classPercentile > p1Week.classPercentile) winner = p2;
  } else {
    if (p1Week.score > p2Week.score) winner = p1;
    else if (p2Week.score > p1Week.score) winner = p2;
  }

  return { p1, p2, p1Class, p2Class, crossClass, p1Week, p2Week, winner };
}

/**
 * Distinct classes each director competed in during the week, derived from the
 * same index — so participation XP and matchup resolution can never disagree
 * about who showed up.
 *
 * @param {Map<string, WeekScoreEntry>} index
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
  applyClassPercentiles,
  buildWeeklyScoreIndex,
  fetchWeeklyScoreIndex,
  getWeekScore,
  decideHeadToHead,
  participatingClassesByUid,
};
