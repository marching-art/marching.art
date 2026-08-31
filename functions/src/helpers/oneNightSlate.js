/**
 * One-Night Slate — the league scoring format that decides a matchup on each
 * director's BEST SINGLE SHOW of the week instead of the week's sum.
 *
 * The design constraint set is Caption Wars' (docs/CAPTION_WARS_SPEC.md §1):
 * nobody's lineup changes, no new data is persisted per show, and resolution
 * returns one winner uid (or "tie") so standings, the champion selection, the
 * weekly-win payout and the rivalry detector need never know the format
 * exists. The weekly score index already walks every show result to build the
 * sum, so tracking the maximum alongside it is one comparison over documents
 * already in memory (helpers/leagueScoring.js buildWeeklyScoreIndex) — no
 * scoring change, no recap-shape change, no backfill.
 *
 * Why this format earns its place next to Caption Wars: the default total
 * rewards VOLUME — competing twice counts twice, which is the right default
 * (showing up is the game) but means a director who can attend five shows a
 * week out-grinds one who can attend two. One-Night Slate rewards PEAK — the
 * week comes down to the best run either director put on the field, so a
 * two-show director with one great night beats a five-show director whose
 * nights were all mid. Attendance still matters (more shows are more chances
 * at a peak, and the tie-break below still reads the sum), but it cannot
 * out-grind a great performance — the format for a league whose members
 * cannot all give the game the same number of nights.
 *
 * Tie-break, mirroring Caption Wars' drawn-category rule: equal best shows go
 * to the higher WEEKLY TOTAL — the fuller week takes it — and only equal
 * totals as well are a genuine "tie". A director who did not compete has a
 * best of 0 with a total of 0: showing up still beats sitting out, and two
 * forfeits still tie.
 *
 * Cross-class matchups (helpers/leagueHelpers.js pairLeagueWeek) resolve on
 * class percentile under EVERY format, this one included — a best-single-show
 * comparison across classes carries the same scale problem as any other raw
 * number (see leagueScoring.js decideHeadToHead).
 */

/**
 * What a commissioner pays to run One-Night Slate for ONE season, out of their
 * own balance. Same recurring-sink logic as CAPTION_WARS_SEASON_COST (see
 * helpers/captionWars.js): per season, never per member, cleared at rollover.
 * Priced a notch below Caption Wars — it is the lighter read of the same
 * numbers — so the format shelf has a real ladder instead of one price.
 */
const ONE_NIGHT_SEASON_COST = 1500;

/**
 * Decide one matchup on best single show.
 *
 * Pure. Takes the two directors' weekly score entries (leagueScoring.js
 * getWeekScore — zeros, best 0, for a director who did not compete) and
 * returns the winner plus the stored `best` block the matchup card renders.
 *
 * @param {string} p1Uid
 * @param {string} p2Uid
 * @param {any} p1Week
 * @param {any} p2Week
 * @returns {{winner: string, best: Object}} winner is a uid or "tie"
 */
function resolveOneNight(p1Uid, p2Uid, p1Week, p2Week) {
  const p1Best = Number(p1Week?.best) || 0;
  const p2Best = Number(p2Week?.best) || 0;
  const p1Total = Number(p1Week?.score) || 0;
  const p2Total = Number(p2Week?.score) || 0;

  let winner = "tie";
  if (p1Best > p2Best) winner = p1Uid;
  else if (p2Best > p1Best) winner = p2Uid;
  else if (p1Total > p2Total) winner = p1Uid;
  else if (p2Total > p1Total) winner = p2Uid;

  return {
    winner,
    // Stored on the matchup document (like Caption Wars' `captions` block) so
    // the card can show the nights that decided the week without recomputing —
    // and so a commissioner override can never make the display disagree with
    // the data it was decided on.
    best: {
      [p1Uid]: { score: p1Best, showName: p1Week?.bestShowName ?? null },
      [p2Uid]: { score: p2Best, showName: p2Week?.bestShowName ?? null },
    },
  };
}

module.exports = {
  ONE_NIGHT_SEASON_COST,
  resolveOneNight,
};
