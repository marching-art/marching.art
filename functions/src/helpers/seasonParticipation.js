/**
 * What a corps actually DID this season, read from the record of what happened.
 *
 * Season archival needs three numbers per corps: did it compete at all, how
 * many shows did it attend, and what was its best week. All three used to be
 * derived from fields on the profile, and all three were wrong:
 *
 *  - **Participation** was `Object.keys(selectedShows).length > 0`, which counts
 *    the WEEKS a director made picks in, not the shows they competed in.
 *    Nothing requires a complete lineup to select shows (callable/lineups.js
 *    selectUserShows), while scoring skips any corps whose lineup is incomplete
 *    (helpers/scoring.js hasCompleteLineup) — so a director could register,
 *    pick shows for all seven weeks, never finish their eight captions, never
 *    appear in a single recap, and still be paid the season finish bonus,
 *    granted completion XP, and credited a season against the class unlock.
 *
 *  - **`showsAttended`** was that same week count, so it landed in
 *    `seasonHistory` and `lifetimeStats.totalShows` as a career total that was
 *    never the number of shows anyone attended. Two shows in one week counted
 *    once; a week attended with no picks saved counted the same as a week of
 *    two.
 *
 *  - **`highestWeeklyScore`** came from `corps.weeklyScores`, which NOTHING
 *    writes. Every writer in the codebase only ever resets it to `{}` — so the
 *    field was uniformly empty, `lifetimeStats.bestWeeklyScore` never left
 *    zero, and the "Best Week" tile on every director's career page
 *    (src/pages/CorpsHistory.jsx) has always rendered 0.000.
 *
 * The recap days are the record of what actually happened — the same source
 * league matchups resolve on (helpers/leagueScoring.js), weekly participation
 * XP is paid from, and the client's league table sums. Reading them here means
 * a director's career stats and their league record can no longer disagree
 * about what they did.
 *
 * Cost is one collection read of at most 49 small documents, once per season
 * rollover, shared across every profile in the game.
 */

const { logger } = require("firebase-functions/v2");
const { buildWeeklyScoreIndex, weekDayRange } = require("./leagueScoring");

/** Competition weeks in a season. */
const WEEKS_IN_SEASON = 7;

/** Index key for a director's corps in one class. */
function participationKey(uid, corpsClass) {
  return `${uid}_${corpsClass}`;
}

/**
 * What one corps did this season.
 *
 * @typedef {Object} CorpsParticipation
 * @property {number} shows - shows actually competed in, across the season
 * @property {number} bestWeek - highest single-week total (sum of that week's
 *   show scores), which is what "Best Week" has always meant to mean
 * @property {number} totalScore - every show score summed; diagnostic only,
 *   deliberately NOT the same quantity as `corps.totalSeasonScore` (which holds
 *   the most recent show's total, see helpers/scoring.js commitDailyScoring)
 */

/**
 * Fold a season's recap day documents into a per-corps participation index.
 *
 * Pure: takes the day snapshots, returns a plain Map. Weeks are folded with the
 * same helper the league table uses, so "a week" means exactly one thing across
 * the backend.
 *
 * @param {Array<{id: string, exists: boolean, data: function}>} dayDocs
 * @returns {Map<string, CorpsParticipation>}
 */
function buildParticipationIndex(dayDocs) {
  const byDay = new Map();
  for (const doc of dayDocs) {
    if (!doc || !doc.exists) continue;
    // Prefer the recap's own day field; fall back to the document id, which is
    // the day number (helpers/scoring.js writes days/{scoredDay}).
    const day = Number(doc.data().offSeasonDay ?? doc.id);
    if (!Number.isFinite(day)) continue;
    byDay.set(day, doc);
  }

  const index = new Map();
  for (let week = 1; week <= WEEKS_IN_SEASON; week++) {
    const { firstDay, lastDay } = weekDayRange(week);
    const weekDocs = [];
    for (let day = firstDay; day <= lastDay; day++) {
      const doc = byDay.get(day);
      if (doc) weekDocs.push(doc);
    }
    if (weekDocs.length === 0) continue;

    const { index: weekIndex } = buildWeeklyScoreIndex(weekDocs);
    for (const entry of weekIndex.values()) {
      // A corps with zero shows this week contributes nothing — not a zero
      // "best week", which would be indistinguishable from a bad one.
      if (entry.shows <= 0) continue;
      const key = participationKey(entry.uid, entry.corpsClass);
      const current = index.get(key) || { shows: 0, bestWeek: 0, totalScore: 0 };
      current.shows += entry.shows;
      current.totalScore += entry.score;
      current.bestWeek = Math.max(current.bestWeek, entry.score);
      index.set(key, current);
    }
  }

  return index;
}

/**
 * Read and fold every recap day of a season, across BOTH scoring pipelines.
 *
 * Podium keeps its own recap collection (`podium-recaps`) for total pipeline
 * isolation, and its day documents carry the same `shows: [{results}]` shape
 * with the same `uid`/`corpsClass`/`totalScore` fields. Folding only the
 * fantasy recaps meant a Podium corps came back with zero shows: its season
 * archived as `showsAttended: 0` with a best week of zero, and a whole Podium
 * season added nothing to `lifetimeStats.totalShows`. Participation itself
 * still resolved, but only through the `totalSeasonScore > 0` fallback.
 *
 * The two indexes are folded separately and merged rather than reading the day
 * documents into one list: both collections number their days 1-49, so a
 * single day map would have one pipeline's day overwrite the other's. The
 * merged keys are disjoint (`uid_corpsClass`, and no corps is in two classes),
 * so the merge is a plain union.
 *
 * Never throws: a rollover must not be blocked by a missing or unreadable recap
 * subcollection. An empty index makes every caller fall back to the profile's
 * own `totalSeasonScore`, which is the pre-existing behavior for a corps that
 * competed, so a read failure degrades to "slightly less accurate" rather than
 * "nobody finished the season".
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} seasonUid
 * @returns {Promise<Map<string, CorpsParticipation>>}
 */
async function fetchSeasonParticipation(db, seasonUid) {
  const index = new Map();
  let days = 0;
  for (const collection of [`fantasy_recaps/${seasonUid}/days`, `podium-recaps/${seasonUid}/days`]) {
    try {
      const snapshot = await db.collection(collection).get();
      days += snapshot.size;
      for (const [key, entry] of buildParticipationIndex(snapshot.docs)) {
        index.set(key, entry);
      }
    } catch (error) {
      logger.error(
        `Could not read ${collection} for ${seasonUid}; season figures for that pipeline fall ` +
          `back to profile scores: ${error.message}`
      );
    }
  }
  logger.info(`Season participation for ${seasonUid}: ${index.size} corps across ${days} recap days.`);
  return index;
}

/**
 * This corps' season, with the profile as the fallback.
 *
 * `totalSeasonScore > 0` is retained as a second signal purely for robustness:
 * it can only be non-zero if the nightly run scored this corps at least once
 * (commitDailyScoring writes it only for a positive score), so it agrees with
 * the recaps wherever both exist and covers the case where the recaps do not.
 *
 * @param {Map<string, CorpsParticipation>} index
 * @param {string} uid
 * @param {string} corpsClass
 * @param {{totalSeasonScore?: number}} [corps] - the profile's corps entry
 * @returns {CorpsParticipation & {participated: boolean}}
 */
function corpsSeason(index, uid, corpsClass, corps = {}) {
  const found = index.get(participationKey(uid, corpsClass));
  const shows = found ? found.shows : 0;
  const scored = (corps.totalSeasonScore || 0) > 0;
  return {
    shows,
    bestWeek: found ? found.bestWeek : 0,
    totalScore: found ? found.totalScore : 0,
    participated: shows > 0 || scored,
  };
}

module.exports = {
  buildParticipationIndex,
  fetchSeasonParticipation,
  corpsSeason,
  participationKey,
  WEEKS_IN_SEASON,
};
