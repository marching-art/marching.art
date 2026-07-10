/**
 * The Podium Report — auto power-rankings column (Phase 7.3, design §7).
 *
 * A weekly, fully DETERMINISTIC column built from the standings the nightly
 * processor already computes: rank, movement vs last week's column, and a
 * template note per line (no LLM, no randomness — the same inputs always
 * publish the same column). Written to the public
 * `podium-recaps/{seasonUid}/power/{week}` doc at each week boundary; the
 * Scores tab renders it above the recap sheets. The heavyweight news
 * pipeline (AI prose + images) can consume the same doc later.
 */

/** Movement-aware note for one line of the column (pure, deterministic). */
function noteFor(entry, index, previousByUid, biggestRiserUid) {
  const prev = previousByUid.get(entry.uid);
  const delta = prev ? prev.rank - (index + 1) : null;
  if (index === 0) {
    return prev && prev.rank === 1
      ? "Holds the top spot."
      : "Takes over at #1.";
  }
  if (entry.uid === biggestRiserUid && delta > 0) {
    return `Up ${delta} — the week's biggest move.`;
  }
  if (delta != null && delta > 0) return `Up ${delta}.`;
  if (delta != null && delta < 0) return `Slips ${-delta}.`;
  if (delta === 0) return "Steady.";
  return "New to the rankings.";
}

/**
 * Build one week's column (pure).
 *
 * @param {Array<{uid, corpsName, lastTotal, repTier}>} standings sorted desc
 *   by lastTotal (the processor's ranking order).
 * @param {object|null} previous last week's column doc ({entries}) or null.
 * @param {number} week competition week (1-7).
 * @returns {{week, entries: Array}} entries capped at 10 (the column), with
 *   fieldSize recording the full count.
 */
function buildPowerRankings(standings, previous, week) {
  const previousByUid = new Map(
    ((previous && previous.entries) || []).map((entry) => [entry.uid, entry])
  );

  // The week's biggest climber (among corps present in both weeks).
  let biggestRiserUid = null;
  let biggestClimb = 0;
  standings.forEach((entry, index) => {
    const prev = previousByUid.get(entry.uid);
    if (!prev) return;
    const climb = prev.rank - (index + 1);
    if (climb > biggestClimb) {
      biggestClimb = climb;
      biggestRiserUid = entry.uid;
    }
  });

  const entries = standings.slice(0, 10).map((entry, index) => {
    const prev = previousByUid.get(entry.uid);
    return {
      rank: index + 1,
      uid: entry.uid,
      corpsName: entry.corpsName || null,
      total: entry.lastTotal ?? null,
      repTier: entry.repTier ?? null,
      prevRank: prev ? prev.rank : null,
      delta: prev ? prev.rank - (index + 1) : null,
      note: noteFor(entry, index, previousByUid, biggestRiserUid),
    };
  });

  return { week, fieldSize: standings.length, entries };
}

module.exports = { buildPowerRankings };
