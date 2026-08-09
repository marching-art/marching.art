/**
 * The Podium Report — deterministic commentary composer (design §7.3).
 *
 * The Podium Report used to publish once a week off the `power` column. It now
 * runs EVERY processing night off the daily standings sheet
 * (`podium-recaps/{seasonUid}/standings/{day}`, built by buildDailyStandings),
 * and reads like a feature in a news magazine — a Sports-Illustrated-meets-
 * Vanity-Fair column that sets a scene and tells the night's story — rather than
 * the bare ranking dump or quick-glance summary it began as.
 *
 * The voice is editorial and warm, but every clause is still composed straight
 * from the standings numbers — no LLM, no randomness. Corps names, ranks, scores,
 * caption books and margins can never be hallucinated because nothing here
 * invents them: the same standings doc always yields the same column. That is the
 * whole reason this article is data-composed rather than model-written (decision
 * 31), and the magazine voice must not cost us that guarantee — so the caption
 * analysis names only the GE/Visual/Music numbers actually on the sheet, and goes
 * silent when the breakdown is missing.
 *
 * `analyzeStandings` turns a standings doc into the handful of facts a night's
 * story is built from (leader, margin, mover, faller, arrivals, division
 * leaders). `composeNarrative` renders those facts — plus the leader's caption
 * book and the field's shape — as a full feature for the news article, while
 * `leadSentence` renders the lede alone for the Discord post, so both surfaces
 * read in one voice.
 */

const DIVISION_LABELS = { aClass: "A Class", openClass: "Open Class", worldClass: "World Class" };
// World → Open → A: the order every other score sheet lists divisions in (§5.7).
const DIVISION_ORDER = ["worldClass", "openClass", "aClass"];
// The three books every Podium score is built from, in the standings entry's
// own field names. The article never cites a caption the sheet does not carry.
const CAPTION_LABELS = { ge: "General Effect", vis: "Visual", mus: "Music" };
const CAPTION_KEYS = ["ge", "vis", "mus"];

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
 * The three caption scores for an entry, strongest book first. Returns [] unless
 * all three are on the sheet, so the caption commentary only ever runs when the
 * numbers to back it are actually there.
 */
function captionBook(entry) {
  if (!entry) return [];
  const book = CAPTION_KEYS.map((key) => ({ key, label: CAPTION_LABELS[key], score: entry[key] }));
  if (book.some((c) => typeof c.score !== "number")) return [];
  return book.sort((a, b) => b.score - a.score);
}

/**
 * The commentator's read on the lead, one register warmer than marginPhrase and
 * used to open the feature's analysis of the top of the board. Every branch is
 * still keyed only to the gap the numbers give.
 */
function leadCharacter(margin) {
  if (margin == null) return "alone at the top";
  if (margin >= 1.5) return "out in front and breathing easy";
  if (margin >= 0.5) return "in front with real daylight";
  if (margin >= 0.15) return "in front, but only just";
  return "clinging to the top by their fingernails";
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

/**
 * The shape of the field the leader sits atop: how deep it is and how much
 * scoring stretches between first and last. A feature sets the scene before it
 * tells the story; this is the scene, drawn only from the totals on the board.
 */
function fieldScene(analysis) {
  const { ranked, fieldSize } = analysis;
  const totals = ranked.map((e) => e.total).filter((t) => typeof t === "number");
  if (totals.length < 2) return null;
  const spread = Number((totals[0] - totals[totals.length - 1]).toFixed(3));
  const n = fieldSize || ranked.length;
  return (
    `${n} corps answered the bell tonight, and ${fmtScore(spread)} of scoring is all that ` +
    `stretches between the top of the board and the bottom of it.`
  );
}

/**
 * The feature's centerpiece: how the night's top number was actually built,
 * read off the caption sheet, and where the corps in second is landing its
 * counterpunches. This is the paragraph that turns a ranking into a story — but
 * it invents nothing, naming only the caption scores the standings carry, so it
 * goes quiet the moment the breakdown is missing (returns null).
 */
function leaderStory(analysis) {
  const { leader, runnerUp, leadMargin } = analysis;
  const book = captionBook(leader);
  if (book.length === 0) return null;

  const [top, mid, bottom] = book;
  const sentences = [
    `Pull the ${fmtScore(leader.total)} apart and it is a ${top.label} story before it is anything ` +
      `else: ${fmtScore(top.score)} in ${top.label} is the sturdiest of ${leader.corpsName}'s three ` +
      `books, with ${mid.label} (${fmtScore(mid.score)}) and ${bottom.label} (${fmtScore(bottom.score)}) ` +
      `carrying the rest of the weight.`,
  ];

  const rBook = captionBook(runnerUp);
  if (rBook.length > 0 && leadMargin != null) {
    // Caption by caption, where the challenger does best against the leader.
    let best = null;
    for (const key of CAPTION_KEYS) {
      const diff = Number(((runnerUp[key] || 0) - (leader[key] || 0)).toFixed(3));
      if (!best || diff > best.diff) best = { key, diff, label: CAPTION_LABELS[key] };
    }
    const rs = fmtScore(runnerUp[best.key]);
    const ls = fmtScore(leader[best.key]);
    const gap = fmtScore(leadMargin);
    if (best.diff > 0) {
      sentences.push(
        `${runnerUp.corpsName} is not going quietly — it takes the ${best.label} caption outright, ` +
          `${rs} to ${ls}, and if it can bank a few more nights like that the ${gap} between them ` +
          `stops looking so safe.`
      );
    } else if (best.diff === 0) {
      sentences.push(
        `${runnerUp.corpsName} can at least say it drew even somewhere — ${best.label} is level at ${rs} — ` +
          `but it surrenders ground on the other two, and the ${gap} is the arithmetic of that.`
      );
    } else {
      sentences.push(
        `${runnerUp.corpsName} runs closest in ${best.label}, ${rs} to ${ls}, and still comes up short ` +
          `on every caption; a ${gap} margin does not hold together any other way.`
      );
    }
  }
  return sentences.join(" ");
}

/**
 * The movers beat: the night's biggest climb and, when there is one, its
 * steepest slide — then, if the climber's score is on the sheet, the number the
 * jump was built on. Two sentences at most, and only ever the movement and
 * totals the standings record.
 */
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
  const base = `${parts.join(", ")}.`;
  if (climber && typeof climber.total === "number") {
    return `${base} The climb rides on a ${fmtScore(climber.total)} on the night.`;
  }
  return base;
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
 * The full article narrative — a feature-length column, not a quick-glance
 * summary. The register sits somewhere between a Sports Illustrated game story
 * and a Vanity Fair profile: scene first, then the analysis, then the field it
 * all plays out against, in flowing prose with understated **subheads** (the
 * news feed's editorial renderer turns a leading "**Head.**" into a small accent
 * subhead). The frames — the lede and the shape of the night, how the lead was
 * built off the caption sheet, the chase pack, the movers, the division crowns,
 * and any new arrivals — each take a different angle on the same board, and the
 * column signs off on its standing kicker.
 *
 * The voice is warmer than the numbers, but it is still only ever the numbers:
 * every clause is composed straight from the standings doc (decision 31), so the
 * magazine tone can never cost us a hallucinated corps, rank, score or margin.
 * The full numbered board lives in the Scores tab, so the article reads and the
 * sheet ranks.
 *
 * Paragraphs are separated by blank lines because that is the only break the
 * renderer honours — a single newline would collapse into a run-on wall.
 */
function composeNarrative(analysis) {
  const paragraphs = [];

  // Lede — the column's own lede, then the character of the lead and the shape
  // of the field, so the piece opens on a scene rather than a scoreline.
  const lede = [leadSentence(analysis)];
  if (analysis.openingDay) {
    lede.push(
      "Opening night sets the first order of the season — every corps on the board is new to it, " +
        "and the chase starts here."
    );
  } else {
    lede.push(`For now ${analysis.leader.corpsName} is ${leadCharacter(analysis.leadMargin)}.`);
    const scene = fieldScene(analysis);
    if (scene) lede.push(scene);
  }
  paragraphs.push(lede.join(" "));

  // The centerpiece: how the night's top number was built, off the caption sheet.
  const lead = leaderStory(analysis);
  if (lead) paragraphs.push(`**The lead.** ${lead}`);

  const chase = chaseSentence(analysis);
  if (chase) {
    paragraphs.push(
      `**The chase.** Behind the top two, the pack is doing its own math. ${chase}`
    );
  }

  const movers = analysis.openingDay ? null : moversSentence(analysis);
  if (movers) paragraphs.push(`**Movers.** ${movers}`);

  const divisions = divisionSentence(analysis);
  if (divisions) paragraphs.push(`**By division.** ${divisions}`);

  const arrivals = arrivalsSentence(analysis);
  if (arrivals) paragraphs.push(`**New faces.** ${arrivals}`);

  paragraphs.push(
    "None of it is a matter of opinion. The Podium Report re-seats the director-run field every " +
      "night on the numbers that just posted — no ballots, no bias, just the board — and it will " +
      "do it again tomorrow. Full box scores for all eight captions live in the Scores tab under " +
      "Podium Class."
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
  captionBook,
  leadCharacter,
  analyzeStandings,
  leadSentence,
  fieldScene,
  leaderStory,
  moversSentence,
  chaseSentence,
  divisionSentence,
  arrivalsSentence,
  composeNarrative,
};
