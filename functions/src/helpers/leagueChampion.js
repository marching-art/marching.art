/**
 * Who won the league.
 *
 * The old selector (helpers/season.js) ignored the standings entirely: it
 * summed `corps.*.totalSeasonScore` across every class and crowned the biggest
 * number. Since that field holds each corps' MOST RECENT show score (see
 * helpers/leagueScoring.js), the league championship — its prize pool, its
 * legendary achievement, its permanent `champions[]` entry — was decided by
 * whoever happened to have the best final night, in whichever class, no matter
 * what their record was. A director could go 7-0 and lose their league.
 *
 * It also gated eligibility on `profileData.activeSeasonId === seasonId`, the
 * marker helpers/leagueActivity.js documents as unreliable: registerCorps
 * deliberately withholds it from directors who still owe corps decisions, so a
 * fully competing member could be excluded from their own league's
 * championship.
 *
 * This module decides it the way the season was actually played:
 *
 *   1. FINALS FIELD — the top `finalsSize` seeds in the regular-season
 *      standings qualify. That is what `settings.finalsSize` has always
 *      promised and what the standings table's cut line has always drawn.
 *   2. CHAMPION — among qualifiers, the best regular-season seed wins, unless
 *      a championship-week score is available, in which case Finals night
 *      decides it among the qualifiers. Drum corps seasons end at Finals; the
 *      standings earn you the right to be there.
 *   3. ELIGIBILITY — only directors registered for the season being archived
 *      (isActiveThisSeason), never the profile-wide marker alone.
 *
 * Pure: takes rows and maps, returns a decision. The Firestore reads live in
 * helpers/season.js.
 */

const { compareStandingRows } = require("./leagueStandings");

/** Default when a league carries no `settings.finalsSize`. */
const DEFAULT_FINALS_SIZE = 12;

/**
 * @typedef {Object} ChampionInput
 * @property {Array<Object>} standings - standings/current rows (uid, wins, …)
 * @property {Set<string>|Array<string>} eligibleUids - members registered for
 *   the season being archived
 * @property {Map<string, {score: number, shows: number}>} [finalsScores] -
 *   uid -> championship-week total; omit to decide on seed alone
 * @property {number} [finalsSize]
 */

/**
 * @param {ChampionInput} input
 * @returns {{
 *   championUid: string|null,
 *   decidedBy: 'finals'|'standings'|'none',
 *   seed: number|null,
 *   record: Object|null,
 *   finalsScore: number|null,
 *   qualifiers: Array<{uid: string, seed: number, finalsScore: number}>
 * }}
 */
function selectLeagueChampion({
  standings = [],
  eligibleUids = [],
  finalsScores = new Map(),
  finalsSize = DEFAULT_FINALS_SIZE,
} = {}) {
  const eligible = eligibleUids instanceof Set ? eligibleUids : new Set(eligibleUids);

  // Re-sort rather than trusting the stored order: a standings document written
  // before compareStandingRows existed carries the old wins-then-points order.
  const seeded = standings
    .filter((row) => row && row.uid && eligible.has(row.uid))
    .slice()
    .sort(compareStandingRows);

  if (seeded.length === 0) {
    return {
      championUid: null,
      decidedBy: "none",
      seed: null,
      record: null,
      finalsScore: null,
      qualifiers: [],
    };
  }

  const cut = Math.max(1, Number(finalsSize) || DEFAULT_FINALS_SIZE);
  const qualifiers = seeded.slice(0, cut).map((row, index) => ({
    uid: row.uid,
    seed: index + 1,
    finalsScore: finalsScores.get(row.uid)?.score ?? 0,
    row,
  }));

  // Did anyone in the finals field actually compete on the final week? If not,
  // the season simply ends on the standings — inventing a Finals result from
  // seven zeros would crown the alphabetically-luckiest qualifier.
  const anyFinalsScore = qualifiers.some((q) => (finalsScores.get(q.uid)?.shows || 0) > 0);

  const winner = anyFinalsScore
    ? qualifiers
        .slice()
        .sort((a, b) => b.finalsScore - a.finalsScore || a.seed - b.seed)[0]
    : qualifiers[0];

  return {
    championUid: winner.uid,
    decidedBy: anyFinalsScore ? "finals" : "standings",
    seed: winner.seed,
    record: {
      wins: winner.row.wins || 0,
      losses: winner.row.losses || 0,
      ties: winner.row.ties || 0,
      totalPoints: winner.row.totalPoints || 0,
    },
    finalsScore: anyFinalsScore ? winner.finalsScore : null,
    qualifiers: qualifiers.map(({ uid, seed, finalsScore }) => ({ uid, seed, finalsScore })),
  };
}

module.exports = { selectLeagueChampion, DEFAULT_FINALS_SIZE };
