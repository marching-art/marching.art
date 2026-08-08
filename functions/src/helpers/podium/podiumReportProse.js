/**
 * The Podium Report — deterministic commentary composer (design §7.3).
 *
 * The Podium Report used to publish once a week off the `power` column. It now
 * runs EVERY processing night off the daily standings sheet
 * (`podium-recaps/{seasonUid}/standings/{day}`, built by buildDailyStandings),
 * and reads like a commentative news magazine rather than a bare ranking dump.
 *
 * The voice is editorial, but every clause is still composed straight from the
 * standings numbers — no LLM, no randomness. Corps names, ranks, scores and
 * margins can never be hallucinated because nothing here invents them: the same
 * standings doc always yields the same column. That is the whole reason this
 * article is data-composed rather than model-written (decision 31), and the
 * magazine voice must not cost us that guarantee.
 *
 * `analyzeStandings` turns a standings doc into the handful of facts a night's
 * story is built from (leader, margin, mover, faller, arrivals, division
 * leaders). `composeNarrative` and `leadSentence` render those facts as prose
 * for the news article and the Discord post respectively, so both surfaces read
 * in one voice.
 */

const DIVISION_LABELS = { aClass: "A Class", openClass: "Open Class", worldClass: "World Class" };
// World → Open → A: the order every other score sheet lists divisions in (§5.7).
const DIVISION_ORDER = ["worldClass", "openClass", "aClass"];

/** "1st", "2nd", "3rd", "11th"… for prose that names a placement. */
function ordinal(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return String(n);
  const mod100 = num % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${num}th`;
  switch (num % 10) {
    case 1:
      return `${num}st`;
    case 2:
      return `${num}nd`;
    case 3:
      return `${num}rd`;
    default:
      return `${num}th`;
  }
}

/** A score for prose, fixed to three places, or "—" when absent. */
function fmtScore(total) {
  return typeof total === "number" ? total.toFixed(3) : "—";
}

/** Join a list of names as "A, B and C" (Oxford-free, magazine house style). */
function humanList(names) {
  const list = names.filter(Boolean);
  if (list.length === 0) return "";
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
}

/**
 * The commentator's read on how safe the lead is, keyed to the actual gap to
 * second. Data-true: the phrase only ever describes the margin the numbers give.
 */
function marginPhrase(margin) {
  if (margin == null) return null;
  if (margin >= 1.5) return "with a comfortable cushion";
  if (margin >= 0.5) return "with a working margin";
  if (margin >= 0.15) return "by a slim edge";
  return "by a whisker";
}

/**
 * Reduce a daily standings doc to the facts a night's write-up needs (pure).
 * Returns null when the doc has no usable entries.
 *
 * @param {{day?: number, fieldSize?: number, entries?: Array}} doc
 */
function analyzeStandings(doc) {
  const entries = ((doc && doc.entries) || []).filter((e) => e && e.corpsName);
  if (entries.length === 0) return null;

  // The processor writes entries in rank order, but sort defensively so the
  // commentary never depends on array order.
  const ranked = [...entries].sort((a, b) => (a.rank || 0) - (b.rank || 0));
  const leader = ranked[0];
  const runnerUp = ranked[1] || null;
  const leadMargin =
    leader && runnerUp && typeof leader.total === "number" && typeof runnerUp.total === "number"
      ? Number((leader.total - runnerUp.total).toFixed(3))
      : null;

  // The night's biggest climb and biggest slide, measured against the previous
  // day's sheet (delta is prevRank - rank, so positive is a climb).
  let climber = null;
  let faller = null;
  for (const entry of ranked) {
    if (typeof entry.delta !== "number") continue;
    if (entry.delta > 0 && (!climber || entry.delta > climber.delta)) climber = entry;
    if (entry.delta < 0 && (!faller || entry.delta < faller.delta)) faller = entry;
  }

  // "New to the rankings" corps — but on opening day everyone is new, which is
  // not a story, so suppress arrivals when the whole field is fresh.
  const fresh = ranked.filter((e) => e.delta == null && e.prevRank == null);
  const openingDay = fresh.length === ranked.length;

  // The corps sitting atop each division it competes in (§5.7: each crowns its
  // own), in World → Open → A order.
  const seen = new Set();
  const divisionLeaders = [];
  for (const entry of ranked) {
    const division = entry.division || "aClass";
    if (seen.has(division)) continue;
    seen.add(division);
    divisionLeaders.push({ division, entry });
  }
  divisionLeaders.sort(
    (a, b) => DIVISION_ORDER.indexOf(a.division) - DIVISION_ORDER.indexOf(b.division)
  );

  return {
    day: doc && doc.day != null ? doc.day : null,
    fieldSize: doc && doc.fieldSize != null ? doc.fieldSize : ranked.length,
    ranked,
    leader,
    runnerUp,
    leadMargin,
    climber,
    faller,
    arrivals: openingDay ? [] : fresh,
    openingDay,
    divisionLeaders,
  };
}

/**
 * The lead sentence — the column's own lede, in the commentator's voice. Used
 * verbatim as the Discord description and as the article's opening line.
 */
function leadSentence(analysis) {
  const { leader, runnerUp, leadMargin, day } = analysis;
  const held = /holds|steady/i.test(leader.note || "");
  const dayTag = day != null ? `Day ${day}` : "Tonight";
  const summit = held ? "stays on top of the Podium Class" : "seizes the top of the Podium Class";
  const scoreClause = typeof leader.total === "number" ? ` at ${fmtScore(leader.total)}` : "";

  if (runnerUp && leadMargin != null) {
    const margin = marginPhrase(leadMargin);
    return (
      `${dayTag} on the floor: ${leader.corpsName} ${summit}${scoreClause}, ` +
      `${margin} over ${runnerUp.corpsName} — ${fmtScore(leadMargin)} back.`
    );
  }
  return `${dayTag} on the floor: ${leader.corpsName} ${summit}${scoreClause}.`;
}

/** One movers sentence: the night's biggest climb and, if any, its biggest slide. */
function moversSentence(analysis) {
  const { climber, faller } = analysis;
  if (!climber && !faller) return null;
  const parts = [];
  if (climber) {
    parts.push(
      `${climber.corpsName} is the night's biggest riser, up ${climber.delta} to ${ordinal(
        climber.rank
      )}`
    );
  }
  if (faller) {
    const lead = climber ? "while" : "The steepest drop belongs to";
    parts.push(
      climber
        ? `${lead} ${faller.corpsName} slides ${Math.abs(faller.delta)} to ${ordinal(faller.rank)}`
        : `${faller.corpsName}, down ${Math.abs(faller.delta)} to ${ordinal(faller.rank)}`
    );
  }
  return `${parts.join(", ")}.`;
}

/**
 * The chase sentence: the pack running behind the top two (ranks 3–6), named
 * with scores, and — when they are genuinely bunched — how little separates
 * them. Data-true: the spread is only ever the gap the numbers give, and it is
 * called out only when it is actually tight.
 */
function chaseSentence(analysis) {
  const pack = analysis.ranked.slice(2, 6);
  if (pack.length === 0) return null;
  const named = pack.map((e) => `${e.corpsName} (${fmtScore(e.total)})`);

  let spreadClause = "";
  const totals = pack.map((e) => e.total).filter((t) => typeof t === "number");
  if (totals.length >= 2) {
    const spread = Number((totals[0] - totals[totals.length - 1]).toFixed(3));
    if (spread <= 0.75) spreadClause = `, separated by just ${spread.toFixed(3)}`;
  }

  const verb = pack.length === 1 ? "gives chase" : "give chase";
  return `${humanList(named)} ${verb}${spreadClause}.`;
}

/** The division-leaders sentence, only when the field spans more than one. */
function divisionSentence(analysis) {
  const leaders = analysis.divisionLeaders;
  if (leaders.length <= 1) return null;
  const clauses = leaders.map(
    ({ division, entry }) => `${DIVISION_LABELS[division] || division} to ${entry.corpsName}`
  );
  return `Each division crowns its own tonight: ${humanList(clauses)}.`;
}

/** The arrivals sentence, only when someone genuinely new cracked the field. */
function arrivalsSentence(analysis) {
  const names = analysis.arrivals.map((e) => e.corpsName).slice(0, 4);
  if (names.length === 0) return null;
  const more = analysis.arrivals.length - names.length;
  const tail = more > 0 ? ` and ${more} more` : "";
  const verb = names.length === 1 ? "arrives" : "arrive";
  return `New to the conversation: ${humanList(names)}${tail} ${verb} in the rankings.`;
}

/**
 * The full article narrative — a commentative news-magazine column, not a
 * ranking dump. Flowing prose with understated **subheads** (the news feed's
 * editorial renderer turns a leading "**Head.**" into a small accent subhead),
 * each frame a different angle on the same night: the lede, the chase pack, the
 * movers, the division crowns, and any new arrivals, closed with the column's
 * standing kicker. The full numbered board lives in the Scores tab, so the
 * article reads and the sheet ranks.
 *
 * Paragraphs are separated by blank lines because that is the only break the
 * renderer honours — a single newline would collapse into a run-on wall.
 */
function composeNarrative(analysis) {
  const paragraphs = [];

  paragraphs.push(
    analysis.openingDay
      ? `${leadSentence(analysis)} Opening night sets the first order of the season — every ` +
          `corps on the board is new to it, and the chase starts here.`
      : leadSentence(analysis)
  );

  const chase = chaseSentence(analysis);
  if (chase) paragraphs.push(`**The chase.** ${chase}`);

  const movers = analysis.openingDay ? null : moversSentence(analysis);
  if (movers) paragraphs.push(`**Movers.** ${movers}`);

  const divisions = divisionSentence(analysis);
  if (divisions) paragraphs.push(`**By division.** ${divisions}`);

  const arrivals = arrivalsSentence(analysis);
  if (arrivals) paragraphs.push(`**New faces.** ${arrivals}`);

  paragraphs.push(
    "The Podium Report re-seats the director-run field every night on the numbers that just " +
      "posted — no ballots, no bias, just the board. Full box scores for all eight captions live " +
      "in the Scores tab under Podium Class."
  );
  return paragraphs.join("\n\n");
}

module.exports = {
  DIVISION_LABELS,
  DIVISION_ORDER,
  ordinal,
  fmtScore,
  humanList,
  marginPhrase,
  analyzeStandings,
  leadSentence,
  moversSentence,
  chaseSentence,
  divisionSentence,
  arrivalsSentence,
  composeNarrative,
};
