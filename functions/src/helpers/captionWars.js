/**
 * Caption Wars — the league scoring format that decides a matchup as a
 * best-of-three across GE, Visual and Music instead of one comparison of the
 * week's total score. Full design in docs/CAPTION_WARS_SPEC.md.
 *
 * The whole feature rests on one fact: helpers/scoring.js already folds the
 * eight lineup captions into exactly these three groups and persists all three
 * on every show result, so the format needs no scoring change, no recap-shape
 * change and no backfill. It is a different reading of numbers the game has
 * been writing since launch.
 *
 * It also cannot go finer than three, ever. The eight sub-captions (GE1, GE2,
 * VP, VA, CG, B, MA, P) are deliberately never persisted per show: publishing
 * them would let an opponent read a director's lineup straight off the recap.
 * Three groups aggregate 2, 3 and 3 captions respectively — enough blending
 * that a weekly group total identifies no individual pick — and they are
 * already public in the matchup breakdown, so this format exposes nothing that
 * was not already on the screen.
 *
 * Resolution returns a single winner uid (or the string "tie"), which is what
 * keeps the blast radius at zero: standings, the champion selection, the Finals
 * bracket, the weekly-win payout and the rivalry detector all read `winner` and
 * `scores` and none of them need to know the format exists.
 */

const SCORING_FORMATS = {
  TOTAL: "total",
  CAPTION_WARS: "captionWars",
  // One-Night Slate: the week is decided by each director's best single show
  // (helpers/oneNightSlate.js). Registered here because this module owns the
  // format registry the purchase callable and the season guard read.
  ONE_NIGHT: "oneNight",
};

/**
 * What a commissioner pays to run Caption Wars for ONE season, out of their own
 * balance.
 *
 * Grounded against the rest of the economy: a show pays 50–200 CC, a weekly
 * league win 100, a season finish bonus 250–1,000, and the World Class unlock
 * 5,000. Two thousand is a real commitment — roughly a season's participation
 * earnings for a mid-tier director — without being the biggest purchase in the
 * game.
 *
 * Per season rather than once: a one-time unlock drains a balance once and then
 * the sink is gone forever, while this recurs for as long as the league lasts.
 * The rollover clears the format (helpers/leagueSeasonReset.js), which is what
 * makes that true.
 */
const CAPTION_WARS_SEASON_COST = 2000;

/**
 * The three categories, in the order they are shown and stored.
 *
 * `field` is the accumulator on a weekly score entry (helpers/leagueScoring.js);
 * `max` is the per-show ceiling, which is the DCI ratio and the reason a
 * best-of-three diverges from the total at all — winning GE by twelve and
 * losing Visual and Music by a point each loses the week here and wins it
 * comfortably on totals.
 */
const CAPTION_CATEGORIES = [
  { key: "ge", field: "ge", label: "General Effect", max: 40 },
  { key: "visual", field: "visual", label: "Visual", max: 30 },
  { key: "music", field: "music", label: "Music", max: 30 },
];

/**
 * Is this league resolving on Caption Wars for THIS season?
 *
 * Both conditions, every time. `settings.scoringFormat` existed once as a value
 * with no implementation and was deleted as dead weight; some league documents
 * may still carry a stale copy of it. Pairing the format with the season it was
 * bought for means a legacy value can never switch a league into a paid format
 * nobody bought, and a rollover bug can only ever fail back to the default.
 *
 * @param {any} leagueData - the league document data
 * @param {string} seasonUid - the season being resolved
 */
function isCaptionWarsLeague(leagueData, seasonUid) {
  return activeScoringFormat(leagueData, seasonUid) === SCORING_FORMATS.CAPTION_WARS;
}

/**
 * The scoring format this league resolves on for THIS season — the one guard
 * every format shares, so a stale `scoringFormat` value from a previous season
 * (or an unknown value written by anything) can only ever fail back to the
 * default. See isCaptionWarsLeague above for why both conditions are checked
 * every time.
 *
 * @param {any} leagueData - the league document data
 * @param {string} seasonUid - the season being resolved
 * @returns {string} one of SCORING_FORMATS' values
 */
function activeScoringFormat(leagueData, seasonUid) {
  const settings = leagueData?.settings || {};
  const format = settings.scoringFormat;
  if (!format || format === SCORING_FORMATS.TOTAL) return SCORING_FORMATS.TOTAL;
  if (!seasonUid || settings.scoringFormatSeasonUid !== seasonUid) return SCORING_FORMATS.TOTAL;
  return Object.values(SCORING_FORMATS).includes(format) ? format : SCORING_FORMATS.TOTAL;
}

/**
 * Decide one matchup on captions.
 *
 * Pure. Takes the two directors' weekly score entries (helpers/leagueScoring.js
 * getWeekScore, which returns zeros for a director who did not compete) and
 * returns the stored `captions` block plus the matchup winner.
 *
 * A category is never drawn: a tie in a caption resolves to whoever posted the
 * higher weekly TOTAL. Only when the totals are level too — the genuinely
 * dead-even matchup, and the 0-0 week where neither director competed — is a
 * category left undecided, and then the other two still decide the week.
 *
 * @param {string} p1Uid
 * @param {string} p2Uid
 * @param {{score: number, ge: number, visual: number, music: number}} p1Week
 * @param {{score: number, ge: number, visual: number, music: number}} p2Week
 * @returns {{captions: Object, winner: string}} winner is a uid or "tie"
 */
function resolveCaptionWars(p1Uid, p2Uid, p1Week, p2Week) {
  /** @type {Record<string, any>} */
  const captions = {};
  const tally = { [p1Uid]: 0, [p2Uid]: 0 };

  const p1Total = Number(p1Week?.score) || 0;
  const p2Total = Number(p2Week?.score) || 0;

  for (const { key, field } of CAPTION_CATEGORIES) {
    // `field` is one of the entry's own keys by construction; the casts only
    // tell checkJs that, since it cannot follow the CAPTION_CATEGORIES table.
    const p1 = Number(/** @type {any} */ (p1Week)?.[field]) || 0;
    const p2 = Number(/** @type {any} */ (p2Week)?.[field]) || 0;

    let winner;
    if (p1 > p2) winner = p1Uid;
    else if (p2 > p1) winner = p2Uid;
    else if (p1Total > p2Total) winner = p1Uid;
    else if (p2Total > p1Total) winner = p2Uid;
    else winner = "tie";

    captions[key] = { scores: { [p1Uid]: p1, [p2Uid]: p2 }, winner };
    if (winner !== "tie") tally[winner] += 1;
  }

  captions.tally = tally;

  let winner = "tie";
  if (tally[p1Uid] > tally[p2Uid]) winner = p1Uid;
  else if (tally[p2Uid] > tally[p1Uid]) winner = p2Uid;

  return { captions, winner };
}

/**
 * Categories each director took, from a stored `captions` block.
 *
 * Reads the block rather than recomputing it, so a commissioner override that
 * rewrote a result cannot make the standings column disagree with the matchup
 * card. Returns zeros for a matchup with no block (a `"total"` league, a bye,
 * or a week resolved before the format existed).
 *
 * @param {any} captions
 * @param {string} uid
 */
function captionsWonBy(captions, uid) {
  const won = Number(captions?.tally?.[uid]) || 0;
  let contested = 0;
  for (const { key } of CAPTION_CATEGORIES) {
    if (captions?.[key]?.winner && captions[key].winner !== "tie") contested += 1;
  }
  return { won, lost: Math.max(0, contested - won) };
}

module.exports = {
  SCORING_FORMATS,
  CAPTION_WARS_SEASON_COST,
  CAPTION_CATEGORIES,
  isCaptionWarsLeague,
  activeScoringFormat,
  resolveCaptionWars,
  captionsWonBy,
};
