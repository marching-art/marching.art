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

/**
 * Movement-aware note for one line of the column (pure, deterministic).
 * `periodLabel` ("week" or "day") tailors the biggest-move copy so the weekly
 * column and the daily standings sheet each read naturally.
 */
function noteFor(entry, index, previousByUid, biggestRiserUid, periodLabel = "week") {
  const prev = previousByUid.get(entry.uid);
  const delta = prev ? prev.rank - (index + 1) : null;
  if (index === 0) {
    return prev && prev.rank === 1
      ? "Holds the top spot."
      : "Takes over at #1.";
  }
  if (entry.uid === biggestRiserUid && delta > 0) {
    return `Up ${delta} — the ${periodLabel}'s biggest move.`;
  }
  if (delta != null && delta > 0) return `Up ${delta}.`;
  if (delta != null && delta < 0) return `Slips ${-delta}.`;
  if (delta === 0) return "Steady.";
  return "New to the rankings.";
}

/** The biggest climber's uid among corps present in both snapshots (or null). */
function biggestRiserOf(standings, previousByUid) {
  let uid = null;
  let best = 0;
  standings.forEach((entry, index) => {
    const prev = previousByUid.get(entry.uid);
    if (!prev) return;
    const climb = prev.rank - (index + 1);
    if (climb > best) {
      best = climb;
      uid = entry.uid;
    }
  });
  return uid;
}

/** One ranked line, carrying the GE/Visual/Music breakdown + movement. */
function toEntry(entry, index, previousByUid, biggestRiserUid, periodLabel) {
  const prev = previousByUid.get(entry.uid);
  return {
    rank: index + 1,
    uid: entry.uid,
    corpsName: entry.corpsName || null,
    total: entry.lastTotal ?? null,
    // GE/Visual/Music breakdown so the standings sheet shows caption columns.
    ge: entry.lastGe ?? null,
    vis: entry.lastVis ?? null,
    mus: entry.lastMus ?? null,
    repTier: entry.repTier ?? null,
    prevRank: prev ? prev.rank : null,
    delta: prev ? prev.rank - (index + 1) : null,
    note: noteFor(entry, index, previousByUid, biggestRiserUid, periodLabel),
  };
}

/**
 * Build one week's column (pure).
 *
 * @param {Array<{uid, corpsName, lastTotal, lastGe, lastVis, lastMus, repTier}>}
 *   standings sorted desc by lastTotal (the processor's ranking order).
 * @param {object|null} previous last week's column doc ({entries}) or null.
 * @param {number} week competition week (1-7).
 * @returns {{week, entries: Array}} entries capped at COLUMN_SIZE (the column),
 *   with fieldSize recording the full count.
 */
// The column now rides on its own sub-view under the Podium tab (not stacked
// above the recap sheets), so it has room for a deeper field than the original
// top-10 — everyone in the upper third of a 100-corps field can find their line.
const COLUMN_SIZE = 25;

function buildPowerRankings(standings, previous, week) {
  const previousByUid = new Map(
    ((previous && previous.entries) || []).map((entry) => [entry.uid, entry])
  );
  const biggestRiserUid = biggestRiserOf(standings, previousByUid);

  const entries = standings
    .slice(0, COLUMN_SIZE)
    .map((entry, index) => toEntry(entry, index, previousByUid, biggestRiserUid, "week"));

  return { week, fieldSize: standings.length, entries };
}

/**
 * The daily Podium Class standings sheet (pure, deterministic).
 *
 * Same shape as a power column but published EVERY processing day and NOT
 * capped — the Scores-tab standings sheet mirrors the full-field fantasy class
 * standings, and movement is measured against the previous day's sheet. The
 * weekly power column (buildPowerRankings) stays the news article's source.
 *
 * @param {Array} standings sorted desc by lastTotal (the processor's order).
 * @param {object|null} previous the previous day's standings doc ({entries}).
 * @param {number} day competition day.
 * @returns {{day, fieldSize, entries: Array}} the full ranked field.
 */
function buildDailyStandings(standings, previous, day) {
  const previousByUid = new Map(
    ((previous && previous.entries) || []).map((entry) => [entry.uid, entry])
  );
  const biggestRiserUid = biggestRiserOf(standings, previousByUid);

  const entries = standings.map((entry, index) =>
    toEntry(entry, index, previousByUid, biggestRiserUid, "day")
  );

  return { day, fieldSize: standings.length, entries };
}

module.exports = { buildPowerRankings, buildDailyStandings, COLUMN_SIZE };
