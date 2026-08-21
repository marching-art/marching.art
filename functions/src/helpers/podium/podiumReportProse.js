/**
 * The Podium Report — deterministic feature composer (design §7.3).
 *
 * The Podium Report used to publish once a week off the `power` column. It now
 * runs EVERY processing night off the daily standings sheet
 * (`podium-recaps/{seasonUid}/standings/{day}`, built by buildDailyStandings),
 * and reads like the day's must-read column — a Sports-Illustrated-meets-Vanity-
 * Fair feature that leads on the night's real drama (a coup at the top, a photo
 * finish, a surge through the field), sets a scene, and tells the story caption
 * by caption — rather than the bare ranking dump it began as.
 *
 * The voice is editorial and warm, but every clause is still composed straight
 * from the standings numbers — no LLM, no randomness. Corps names, ranks, scores,
 * caption books and margins can never be hallucinated because nothing here
 * invents them: the same standings doc (plus the prior nights' sheets) always
 * yields the same column. That is the whole reason this article is data-composed
 * rather than model-written (decision 31), and the feature voice must not cost us
 * that guarantee — so every beat names only numbers that are actually on a sheet,
 * and goes silent when the data behind it is missing.
 *
 * `analyzeStandings(doc, previousSheets)` turns tonight's standings — read
 * against the nights before it — into the facts a story is built from: who leads
 * and by how much, whether the lead changed hands and from whom, how long the
 * leader has held, whether the gap is opening or closing, the caption kings
 * across the whole field, the tightest race on the board, the movers, the
 * division crowns and the new arrivals. `composeHeadline` writes the day's hook
 * from the dominant storyline; `composeDek` writes the standfirst; and
 * `composeNarrative` renders the full feature. `leadSentence` renders the lede
 * alone for the Discord post, so every surface reads in one voice.
 */

const DIVISION_LABELS = { aClass: "A Class", openClass: "Open Class", worldClass: "World Class" };
// World → Open → A: the order every other score sheet lists divisions in (§5.7).
const DIVISION_ORDER = ["worldClass", "openClass", "aClass"];
// The three books every Podium score is built from, in the standings entry's
// own field names. The article never cites a caption the sheet does not carry.
const CAPTION_LABELS = { ge: "General Effect", vis: "Visual", mus: "Music" };
const CAPTION_SHORT = { ge: "GE", vis: "Visual", mus: "Music" };
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

/** The uid sitting at rank 1 on a standings doc, or null. */
function rankOneUid(doc) {
  const entries = ((doc && doc.entries) || []).filter((e) => e && e.corpsName);
  if (entries.length === 0) return null;
  const ranked = [...entries].sort((a, b) => (a.rank || 0) - (b.rank || 0));
  return ranked[0].uid || null;
}

/** The top-two scoring margin on a standings doc, or null when it can't be read. */
function topMargin(doc) {
  const entries = ((doc && doc.entries) || []).filter((e) => e && e.corpsName);
  const ranked = [...entries].sort((a, b) => (a.rank || 0) - (b.rank || 0));
  if (ranked.length < 2) return null;
  const a = ranked[0].total;
  const b = ranked[1].total;
  if (typeof a !== "number" || typeof b !== "number") return null;
  return Number((a - b).toFixed(3));
}

/**
 * The corps that owns each caption across the whole field tonight — the biggest
 * GE, Visual and Music numbers on the board, each with the corps that posted it.
 * Returns null unless all three books are present on at least one entry, so the
 * caption-kings beat runs only when the sheet carries the breakdown. Pure.
 */
function captionKings(ranked) {
  const kings = {};
  for (const key of CAPTION_KEYS) {
    let king = null;
    for (const entry of ranked) {
      if (typeof entry[key] !== "number") continue;
      if (!king || entry[key] > king[key]) king = entry;
    }
    if (!king) return null;
    kings[key] = king;
  }
  return kings;
}

/**
 * The tightest adjacent gap anywhere in the ranked field — the night's closest
 * race — as { top, bottom, gap }, or null when fewer than two scored corps. Pure.
 */
function tightestPair(ranked) {
  let tightest = null;
  for (let i = 0; i < ranked.length - 1; i++) {
    const top = ranked[i];
    const bottom = ranked[i + 1];
    if (typeof top.total !== "number" || typeof bottom.total !== "number") continue;
    const gap = Number((top.total - bottom.total).toFixed(3));
    if (!tightest || gap < tightest.gap) tightest = { top, bottom, gap };
  }
  return tightest;
}

/**
 * Reduce a daily standings doc — read against the nights before it — to the
 * facts a night's write-up needs (pure). Returns null when the doc has no usable
 * entries.
 *
 * @param {{day?: number, fieldSize?: number, entries?: Array}} doc tonight's sheet
 * @param {Array<object>} previousSheets prior standings docs, most-recent first
 *   (yesterday, the day before, …). Used only to read how long the leader has
 *   held the top and whether the lead is opening or closing — every fact still
 *   comes from a real sheet, so the story stays data-true and deterministic.
 */
function analyzeStandings(doc, previousSheets = []) {
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

  // A coup at the top: the leader wasn't #1 last night. The corps it displaced
  // is the one that carried prevRank 1 into tonight — named so the story can tell
  // who was dethroned, not just who won.
  const leadChange = typeof leader.prevRank === "number" && leader.prevRank !== 1;
  const formerLeader = leadChange
    ? ranked.find((e) => e.prevRank === 1 && e.uid !== leader.uid) || null
    : null;

  // How many nights running the current leader has owned the top, counting
  // tonight — walked back through the prior sheets until the #1 uid changes.
  let leaderStreak = 1;
  for (const sheet of previousSheets) {
    if (rankOneUid(sheet) === leader.uid) leaderStreak += 1;
    else break;
  }

  // Is the lead opening or closing? Only meaningful when the same corps led last
  // night too; otherwise a margin comparison would be apples to oranges.
  const prevSheet = previousSheets[0] || null;
  const prevLeaderSame = prevSheet ? rankOneUid(prevSheet) === leader.uid : false;
  const prevLeadMargin = prevLeaderSame ? topMargin(prevSheet) : null;

  // The night's climbs and slides, measured against the previous sheet (delta is
  // prevRank - rank, so positive is a climb). Kept as ordered lists so the movers
  // beat can name more than one, and as single climber/faller for compatibility.
  const risers = ranked
    .filter((e) => typeof e.delta === "number" && e.delta > 0)
    .sort((a, b) => b.delta - a.delta);
  const fallers = ranked
    .filter((e) => typeof e.delta === "number" && e.delta < 0)
    .sort((a, b) => a.delta - b.delta);
  const climber = risers[0] || null;
  const faller = fallers[0] || null;

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
    leadChange,
    formerLeader,
    leaderStreak,
    prevLeadMargin,
    climber,
    faller,
    risers,
    fallers,
    captionKings: captionKings(ranked),
    tightestPair: tightestPair(ranked),
    arrivals: openingDay ? [] : fresh,
    openingDay,
    divisionLeaders,
  };
}

/**
 * How the leader is holding the top, in one clause — a coronation, a streak, a
 * hold, or (on opening night) simply setting the pace. Data-true: every branch
 * is keyed to a fact on the sheets.
 */
function summitClause(analysis) {
  const { leadChange, formerLeader, runnerUp, leaderStreak, openingDay } = analysis;
  if (openingDay) return "sets the opening pace in the Podium Class";
  if (leadChange) {
    // When the corps it displaced is the one now chasing in second, one name
    // does the work of both — no need to say it twice.
    if (formerLeader && runnerUp && formerLeader.uid === runnerUp.uid) {
      return `climbs past ${formerLeader.corpsName} to seize the top of the Podium Class`;
    }
    if (formerLeader) {
      return `wrestles the top of the Podium Class away from ${formerLeader.corpsName}`;
    }
    return "seizes the top of the Podium Class";
  }
  if (leaderStreak >= 3) return `makes it ${leaderStreak} nights running atop the Podium Class`;
  return "stays on top of the Podium Class";
}

/**
 * The lead sentence — the column's own lede, in the commentator's voice. Used
 * verbatim as the Discord description and as the article's opening line.
 */
function leadSentence(analysis) {
  const { leader, runnerUp, leadMargin, leadChange, formerLeader, day } = analysis;
  const dayTag = day != null ? `Day ${day}` : "Tonight";
  const scoreClause = typeof leader.total === "number" ? ` at ${fmtScore(leader.total)}` : "";
  const summit = summitClause(analysis);

  // When the lede already named the dethroned corps and it is also the runner-up,
  // close on the margin alone rather than repeating the name a third time.
  const dethronedIsRunnerUp =
    leadChange && formerLeader && runnerUp && formerLeader.uid === runnerUp.uid;

  if (runnerUp && leadMargin != null) {
    if (dethronedIsRunnerUp) {
      return `${dayTag} on the floor: ${leader.corpsName} ${summit}${scoreClause} — now ${fmtScore(
        leadMargin
      )} clear.`;
    }
    const margin = marginPhrase(leadMargin);
    return (
      `${dayTag} on the floor: ${leader.corpsName} ${summit}${scoreClause}, ` +
      `${margin} over ${runnerUp.corpsName} — ${fmtScore(leadMargin)} back.`
    );
  }
  return `${dayTag} on the floor: ${leader.corpsName} ${summit}${scoreClause}.`;
}

/**
 * The day's hook, written from the dominant storyline the numbers give. A coup
 * at the top beats a photo finish beats a runaway beats a surge beats a logjam
 * beats the quiet hold — and every branch names only what the sheet carries, so
 * the headline can never oversell a night that didn't happen.
 */
function composeHeadline(analysis) {
  const { leader, leadChange, formerLeader, leadMargin, leaderStreak, climber, openingDay } =
    analysis;
  const dayTag = analysis.day != null ? `Day ${analysis.day}` : null;

  if (openingDay) {
    return `The Podium Class Takes Shape: ${leader.corpsName} Sets the Opening Pace`;
  }

  // A coup at the top is always the story.
  if (leadChange) {
    return formerLeader
      ? `${leader.corpsName} Topples ${formerLeader.corpsName} for the Podium Class Lead`
      : `${leader.corpsName} Seizes the Podium Class Lead`;
  }

  // A held lead by a whisker — the drama is in how little there is to spare.
  if (leadMargin != null && leadMargin < 0.15) {
    return `Nothing to Spare: ${leader.corpsName} Holds by ${fmtScore(leadMargin)}`;
  }

  // A comfortable, sustained reign.
  if (leaderStreak >= 4 && (leadMargin == null || leadMargin >= 0.5)) {
    return `${leader.corpsName} Makes It ${leaderStreak} Straight Atop the Podium Class`;
  }

  // A genuine surge through the field.
  if (climber && climber !== leader && climber.delta >= 3) {
    return `${climber.corpsName} Surges ${climber.delta} Into ${ordinal(climber.rank)}`;
  }

  // A runaway at the top.
  if (leadMargin != null && leadMargin >= 2) {
    return `${leader.corpsName} Pulls Away at the Top of the Podium Class`;
  }

  // The quiet hold — still named for the corps, still tied to the day.
  return dayTag
    ? `${leader.corpsName} Holds the Podium Class Lead on ${dayTag}`
    : `${leader.corpsName} Leads the Podium Class`;
}

/**
 * The standfirst — one or two sentences of exactly what happened, for the feed
 * card and the article dek. Data-true and compact: the leader and score, the
 * margin and runner-up, the biggest riser when there is one, and the shape of
 * the field.
 */
function composeDek(analysis) {
  const { leader, runnerUp, leadMargin, climber, fieldSize, day, ranked, openingDay } = analysis;
  const parts = [];

  const dayTag = day != null ? `Day ${day}` : "Tonight";
  let lead = `${dayTag}: ${leader.corpsName} `;
  lead += openingDay ? "sets the pace" : leadChangeVerb(analysis);
  if (typeof leader.total === "number") lead += ` at ${fmtScore(leader.total)}`;
  if (runnerUp && leadMargin != null) {
    lead += `, ${fmtScore(leadMargin)} up on ${runnerUp.corpsName}`;
  }
  parts.push(`${lead}.`);

  if (climber && climber !== leader && !openingDay) {
    parts.push(
      `${climber.corpsName} is the day's biggest riser, up ${climber.delta} to ${ordinal(
        climber.rank
      )}.`
    );
  }

  const totals = ranked.map((e) => e.total).filter((t) => typeof t === "number");
  if (totals.length >= 2) {
    const spread = fmtScore(Number((totals[0] - totals[totals.length - 1]).toFixed(3)));
    parts.push(`${fieldSize} corps, ${spread} points top to bottom.`);
  } else {
    parts.push(`${fieldSize} corps ranked.`);
  }

  return parts.join(" ");
}

/** The dek's verb for how the leader arrived at the top (data-true). */
function leadChangeVerb(analysis) {
  if (analysis.leadChange) return "takes the lead";
  if (analysis.leaderStreak >= 3) return "leads again";
  return "leads";
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
  // A second beat keyed only to the spread the numbers give: how tight or how
  // stretched the board is, and what that says about how quickly it can move.
  let shape = "";
  if (spread <= 2) {
    shape =
      " It is a field packed tight enough that a single strong caption can reorder the whole thing overnight.";
  } else if (spread >= 8) {
    shape =
      " It is a field with real distance between its floors — the kind of gap that takes weeks, not nights, to close.";
  }
  return (
    `${n} corps answered the bell tonight, and ${fmtScore(spread)} of scoring is all that ` +
    `stretches between the top of the board and the bottom of it.${shape}`
  );
}

/**
 * The feature's centerpiece: how the night's top number was actually built, read
 * off the caption sheet; where the corps in second is landing its counterpunches;
 * and — when the prior nights are on hand — whether the lead is opening or
 * closing. This is the paragraph that turns a ranking into a story, but it
 * invents nothing, naming only the caption scores and margins the sheets carry,
 * so it goes quiet the moment the breakdown is missing (returns null).
 */
function leaderStory(analysis) {
  const { leader, runnerUp, leadMargin, leadChange, prevLeadMargin } = analysis;
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

  // The night-over-night beat: only when the same corps led last night, so a
  // margin comparison is honest — and only when the movement is real.
  if (!leadChange && prevLeadMargin != null && leadMargin != null) {
    const swing = Number((leadMargin - prevLeadMargin).toFixed(3));
    if (swing <= -0.1) {
      sentences.push(
        `And the margin is moving: what was ${fmtScore(prevLeadMargin)} a night ago is down to ` +
          `${fmtScore(leadMargin)}, and the race is tightening under the leader's feet.`
      );
    } else if (swing >= 0.1) {
      sentences.push(
        `The lead is growing, too — ${fmtScore(prevLeadMargin)} a night ago, ${fmtScore(leadMargin)} ` +
          `now, the daylight widening rather than closing.`
      );
    }
  }

  return sentences.join(" ");
}

/**
 * The caption-kings beat: who owns General Effect, Visual and Music across the
 * whole field tonight, with the numbers — and whether the three books belong to
 * one corps or three. Genuine analysis, but only ever the caption scores the
 * sheet records; returns null when the breakdown is missing.
 */
function captionKingsSentence(analysis) {
  const kings = analysis.captionKings;
  if (!kings) return null;

  const clauses = [
    `${kings.ge.corpsName} owns General Effect at ${fmtScore(kings.ge.ge)}`,
    `${kings.vis.corpsName} the Visual sheet at ${fmtScore(kings.vis.vis)}`,
    `${kings.mus.corpsName} the Music book at ${fmtScore(kings.mus.mus)}`,
  ];
  const base = `Read it caption by caption and ${humanList(clauses)}.`;

  const uids = new Set([kings.ge.uid, kings.vis.uid, kings.mus.uid]);
  if (uids.size === 1) {
    return `${base} One corps has the whole floor — a clean sweep of all three books.`;
  }
  if (uids.size === 3) {
    return `${base} Three books, three different owners — nobody has the whole floor tonight.`;
  }
  return base;
}

/**
 * The movers beat: the night's biggest climbs and steepest slides — up to two of
 * each — then, if the top climber's score is on the sheet, the number the jump
 * was built on. Only ever the movement and totals the standings record.
 */
function moversSentence(analysis) {
  const { risers, fallers, climber } = analysis;
  if (risers.length === 0 && fallers.length === 0) return null;

  const climbClause = (e) => `${e.corpsName} (up ${e.delta} to ${ordinal(e.rank)})`;
  const slideClause = (e) => `${e.corpsName} (down ${Math.abs(e.delta)} to ${ordinal(e.rank)})`;

  const parts = [];
  if (risers.length > 0) {
    const named = risers.slice(0, 2).map(climbClause);
    const verb = named.length === 1 ? "is climbing" : "are climbing";
    parts.push(`${humanList(named)} ${verb}`);
  }
  if (fallers.length > 0) {
    const named = fallers.slice(0, 2).map(slideClause);
    const lead = risers.length > 0 ? "while" : "The board is sliding under";
    const verb = named.length === 1 ? "is giving ground" : "are giving ground";
    parts.push(risers.length > 0 ? `${lead} ${humanList(named)} ${verb}` : `${lead} ${humanList(named)}`);
  }

  const base = `${parts.join(", ")}.`;
  if (climber && typeof climber.total === "number") {
    return `${base} The night's biggest climb rides on a ${fmtScore(climber.total)}.`;
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

/**
 * The closest-call beat: the tightest adjacent margin on the board when it sits
 * BELOW the top two (the lede already owns the title race) and is genuinely
 * slim. A single-caption swing separates them — real drama the ranking alone
 * hides. Returns null when the top two are the tightest pair or nothing is close.
 */
function closestCallSentence(analysis) {
  const pair = analysis.tightestPair;
  if (!pair) return null;
  if (pair.top.rank <= 1) return null; // the title race is the lede's story
  if (pair.gap > 0.3) return null; // only when it is actually a photo finish
  return (
    `The tightest margin on the board isn't at the top at all: ${pair.top.corpsName} ` +
    `(${ordinal(pair.top.rank)}) and ${pair.bottom.corpsName} (${ordinal(pair.bottom.rank)}) are ` +
    `separated by just ${fmtScore(pair.gap)} — one caption swings it.`
  );
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
 * The floor beat: who anchors the field tonight, for full-board coverage — only
 * on a field deep enough (eight or more) for the bottom to be its own story.
 * Names the last-place corps, its score, and any movement the sheet records.
 */
function floorSentence(analysis) {
  const { ranked } = analysis;
  if (ranked.length < 8) return null;
  const anchor = ranked[ranked.length - 1];
  if (typeof anchor.total !== "number") return null;
  let movement = "";
  if (typeof anchor.delta === "number" && anchor.delta > 0) {
    movement = `, up ${anchor.delta} even from the back`;
  } else if (typeof anchor.delta === "number" && anchor.delta < 0) {
    movement = `, down ${Math.abs(anchor.delta)} into the cellar`;
  }
  return (
    `Down at the floor, ${anchor.corpsName} anchors the field in ${ordinal(anchor.rank)} at ` +
    `${fmtScore(anchor.total)}${movement} — ground to make up, and a whole season to make it.`
  );
}

/**
 * The full article narrative — a feature-length column, not a quick-glance
 * summary. The register sits somewhere between a Sports Illustrated game story
 * and a Vanity Fair profile: the night's drama up front, then the scene and how
 * the lead was built off the caption sheet, then the caption ownership and the
 * chase, then the movement and the wider board — every angle woven into flowing
 * paragraphs rather than a stack of captioned one-liners. The piece deliberately
 * carries NO bolded subhead labels: it reads as a magazine column, in the same
 * voice as the site's other long-form articles, not as a scannable bulletin.
 *
 * The same frames are all still here — the lede and the shape of the night, how
 * the lead was built, who owns each caption across the field, the chase pack, the
 * tightest race, the movers, the division crowns, the new arrivals and the floor
 * — but they are grouped into a handful of substantial paragraphs with real
 * transitions between beats. A beat that has no data behind it drops out silently,
 * and the paragraph it would have joined simply carries the beats that remain.
 *
 * The voice is warmer than the numbers, but it is still only ever the numbers:
 * every clause is composed straight from the standings sheets (decision 31), so
 * the feature tone can never cost us a hallucinated corps, rank, score or margin.
 * The full numbered board lives in the Scores tab, so the article reads and the
 * sheet ranks.
 *
 * Paragraphs are separated by blank lines because that is the only break the
 * renderer honours — a single newline would collapse into a run-on wall.
 */
function composeNarrative(analysis) {
  const paragraphs = [];

  // Push a paragraph built from the non-empty beats in `beats`, joined into one
  // flowing block. Nothing is pushed when every beat is missing, so the column
  // never opens a section it has no data to fill.
  const pushParagraph = (...beats) => {
    const kept = beats.filter(Boolean);
    if (kept.length) paragraphs.push(kept.join(" "));
  };

  // 1) Lede — the column's own opening line, then the character of the night: on
  // opening night the weight of a first ranking, otherwise how the leader is
  // holding the top of the board.
  let nightCharacter;
  if (analysis.openingDay) {
    nightCharacter =
      "Opening night is a blank page. Every corps on the board is new to the Podium Class, and " +
      "tonight's order is only the first word in an argument the season will spend the next " +
      "several weeks having with itself.";
  } else if (analysis.leadChange && analysis.formerLeader) {
    nightCharacter =
      `The order at the top has a new name on it, and ${analysis.formerLeader.corpsName} — ` +
      `${ordinal(analysis.formerLeader.rank)} tonight — is left to answer it.`;
  } else {
    nightCharacter = `For now ${analysis.leader.corpsName} is ${leadCharacter(analysis.leadMargin)}.`;
  }
  pushParagraph(leadSentence(analysis), nightCharacter);

  // 2) The board and how the night's top number was built: set the scene, then
  // open the caption sheet on the leader and its nearest challenger.
  pushParagraph(fieldScene(analysis), leaderStory(analysis));

  // 3) Who owns each caption across the field, and the pack giving chase behind
  // the top two.
  const chase = chaseSentence(analysis);
  const chaseBeat = chase ? `Behind the top two, the pack is doing its own math. ${chase}` : null;
  pushParagraph(captionKingsSentence(analysis), chaseBeat);

  // 4) The movement deeper in the field: the night's climbs and slides, then the
  // tightest race on the board (both go quiet on opening night, when nothing has
  // moved and the title race owns the lede).
  const movers = analysis.openingDay ? null : moversSentence(analysis);
  pushParagraph(movers, closestCallSentence(analysis));

  // 5) The wider board: the division crowns, the new faces and the floor.
  pushParagraph(divisionSentence(analysis), arrivalsSentence(analysis), floorSentence(analysis));

  // Standing kicker.
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
  CAPTION_LABELS,
  CAPTION_SHORT,
  ordinal,
  fmtScore,
  humanList,
  marginPhrase,
  captionBook,
  leadCharacter,
  rankOneUid,
  topMargin,
  captionKings,
  tightestPair,
  analyzeStandings,
  summitClause,
  leadSentence,
  composeHeadline,
  composeDek,
  fieldScene,
  leaderStory,
  captionKingsSentence,
  moversSentence,
  chaseSentence,
  closestCallSentence,
  divisionSentence,
  arrivalsSentence,
  floorSentence,
  composeNarrative,
};
