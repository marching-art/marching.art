// Tests for the Podium Report commentary composer: the deterministic magazine
// voice built straight from a daily standings sheet — leader/margin, movers,
// division leaders, arrivals, and the numbered board.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  ordinal,
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
} = require("./podiumReportProse");

const entry = (over) => ({
  rank: 1,
  uid: "u",
  corpsName: "Corps",
  division: "worldClass",
  total: 80,
  delta: null,
  prevRank: null,
  note: "",
  ...over,
});

describe("small helpers", () => {
  test("ordinal", () => {
    assert.equal(ordinal(1), "1st");
    assert.equal(ordinal(2), "2nd");
    assert.equal(ordinal(3), "3rd");
    assert.equal(ordinal(4), "4th");
    assert.equal(ordinal(11), "11th");
    assert.equal(ordinal(21), "21st");
  });

  test("humanList reads with 'and'", () => {
    assert.equal(humanList(["A"]), "A");
    assert.equal(humanList(["A", "B"]), "A and B");
    assert.equal(humanList(["A", "B", "C"]), "A, B and C");
  });

  test("marginPhrase keys to the gap and only describes what the numbers give", () => {
    assert.equal(marginPhrase(null), null);
    assert.equal(marginPhrase(2), "with a comfortable cushion");
    assert.equal(marginPhrase(0.6), "with a working margin");
    assert.equal(marginPhrase(0.2), "by a slim edge");
    assert.equal(marginPhrase(0.05), "by a whisker");
  });

  test("leadCharacter keys to the gap the same way marginPhrase does", () => {
    assert.match(leadCharacter(2), /breathing easy/);
    assert.match(leadCharacter(0.6), /real daylight/);
    assert.match(leadCharacter(0.2), /only just/);
    assert.match(leadCharacter(0.05), /fingernails/);
  });

  test("captionBook sorts the three books strongest-first, or [] when incomplete", () => {
    assert.deepEqual(
      captionBook({ ge: 20, vis: 25, mus: 22 }).map((c) => c.key),
      ["vis", "mus", "ge"]
    );
    // No commentary without the full breakdown to back it.
    assert.deepEqual(captionBook({ ge: 20, vis: 25 }), []);
    assert.deepEqual(captionBook(null), []);
  });
});

describe("analyzeStandings", () => {
  test("returns null for an empty sheet", () => {
    assert.equal(analyzeStandings({ entries: [] }), null);
    assert.equal(analyzeStandings(null), null);
  });

  test("derives leader, margin, biggest riser and steepest faller", () => {
    const a = analyzeStandings({
      day: 12,
      fieldSize: 4,
      entries: [
        entry({ rank: 1, uid: "a", corpsName: "Devils", total: 91.2, delta: 1 }),
        entry({ rank: 2, uid: "b", corpsName: "Colts", total: 90.1, delta: -1 }),
        entry({ rank: 3, uid: "c", corpsName: "Raiders", total: 88.4, delta: 6 }),
        entry({ rank: 4, uid: "d", corpsName: "Cavaliers", total: 87.0, delta: -3 }),
      ],
    });
    assert.equal(a.leader.corpsName, "Devils");
    assert.equal(a.runnerUp.corpsName, "Colts");
    assert.equal(a.leadMargin, 1.1);
    assert.equal(a.climber.corpsName, "Raiders");
    assert.equal(a.faller.corpsName, "Cavaliers");
  });

  test("opening day: everyone new, so no arrivals story and no movers", () => {
    const a = analyzeStandings({
      day: 1,
      fieldSize: 2,
      entries: [
        entry({ uid: "a", corpsName: "A", rank: 1, delta: null, prevRank: null }),
        entry({ uid: "b", corpsName: "B", rank: 2, delta: null, prevRank: null }),
      ],
    });
    assert.equal(a.openingDay, true);
    assert.deepEqual(a.arrivals, []);
    assert.equal(a.climber, null);
  });

  test("division leaders come back in World → Open → A order", () => {
    const a = analyzeStandings({
      day: 5,
      fieldSize: 3,
      entries: [
        entry({ uid: "a", corpsName: "Open Top", rank: 1, division: "openClass" }),
        entry({ uid: "b", corpsName: "World Top", rank: 2, division: "worldClass" }),
        entry({ uid: "c", corpsName: "A Top", rank: 3, division: "aClass" }),
      ],
    });
    assert.deepEqual(
      a.divisionLeaders.map((d) => `${d.division}:${d.entry.corpsName}`),
      ["worldClass:World Top", "openClass:Open Top", "aClass:A Top"]
    );
  });
});

describe("prose is deterministic and data-true", () => {
  const sheet = {
    day: 12,
    fieldSize: 4,
    entries: [
      entry({ rank: 1, uid: "a", corpsName: "Devils", total: 91.2, delta: 1, note: "Takes over at #1.", division: "worldClass" }),
      entry({ rank: 2, uid: "b", corpsName: "Colts", total: 90.1, delta: -1, division: "worldClass" }),
      entry({ rank: 3, uid: "c", corpsName: "Raiders", total: 88.4, delta: 6, note: "Up 6 — the day's biggest move.", division: "openClass" }),
      entry({ rank: 4, uid: "d", corpsName: "Cavaliers", total: 87.0, delta: -3, division: "aClass" }),
    ],
  };

  test("lead sentence names the day, the leader, the margin and the runner-up", () => {
    const a = analyzeStandings(sheet);
    const lede = leadSentence(a);
    assert.match(lede, /Day 12/);
    assert.match(lede, /Devils/);
    assert.match(lede, /1\.100 back/);
    assert.match(lede, /Colts/);
  });

  test("movers sentence carries both the climb and the slide", () => {
    const a = analyzeStandings(sheet);
    const movers = moversSentence(a);
    assert.match(movers, /Raiders is the night's biggest riser, up 6 to 3rd/);
    assert.match(movers, /Cavaliers slides 3 to 4th/);
  });

  test("chase sentence names the pack behind the top two, with the spread when tight", () => {
    const a = analyzeStandings(sheet);
    const chase = chaseSentence(a);
    // Ranks 3–4 here (Raiders, Cavaliers); the top two are the lede's story.
    assert.match(chase, /Raiders \(88\.400\)/);
    assert.match(chase, /Cavaliers \(87\.000\)/);
    assert.match(chase, /give chase/);
    assert.doesNotMatch(chase, /Devils|Colts/);
  });

  test("division sentence lists each division's leader", () => {
    const a = analyzeStandings(sheet);
    const div = divisionSentence(a);
    assert.match(div, /World Class to Devils/);
    assert.match(div, /Open Class to Raiders/);
    assert.match(div, /A Class to Cavaliers/);
  });

  test("arrivals sentence only fires for genuinely new corps", () => {
    const a = analyzeStandings({
      day: 6,
      fieldSize: 2,
      entries: [
        entry({ uid: "a", corpsName: "Held", rank: 1, delta: 0, prevRank: 1 }),
        entry({ uid: "z", corpsName: "Rookie", rank: 2, delta: null, prevRank: null }),
      ],
    });
    assert.match(arrivalsSentence(a), /Rookie arrives in the rankings/);
  });

  test("narrative reads as a magazine column: subheads, prose, no numbered dump", () => {
    const one = composeNarrative(analyzeStandings(sheet));
    const two = composeNarrative(analyzeStandings(sheet));
    assert.equal(one, two); // deterministic

    // Paragraphs are blank-line separated so the editorial renderer keeps them
    // apart (a single newline collapses into a run-on wall).
    assert.ok(one.includes("\n\n"));
    assert.doesNotMatch(one, /[^\n]\n[^\n]/); // no lone newline inside a line

    // Understated subheads, not a "1. … 2. …" ranking dump.
    assert.match(one, /\*\*The chase\.\*\*/);
    assert.match(one, /\*\*Movers\.\*\*/);
    assert.doesNotMatch(one, /^\d+\.\s/m);

    // Still data-true: the leader, score and margin lead the piece.
    assert.match(one, /Devils/);
    assert.match(one, /91\.200/);
    assert.match(one, /no ballots, no bias, just the board/);
  });
});

describe("feature-length prose", () => {
  // A sheet carrying the GE/Visual/Music books the standings actually store, so
  // the caption commentary has numbers to read.
  const captionSheet = {
    day: 20,
    fieldSize: 4,
    entries: [
      entry({ rank: 1, uid: "a", corpsName: "Altitude", total: 74.25, delta: 3, ge: 30, vis: 24, mus: 20.25, division: "worldClass" }),
      entry({ rank: 2, uid: "b", corpsName: "Black Gold", total: 73.053, delta: -1, ge: 28, vis: 24.5, mus: 20.553, division: "worldClass" }),
      entry({ rank: 3, uid: "c", corpsName: "Dragon Corps", total: 72.356, delta: 1, ge: 27, vis: 24, mus: 21.356, division: "openClass" }),
      entry({ rank: 4, uid: "d", corpsName: "Fogwalkers", total: 71.0, delta: -2, ge: 26, vis: 24, mus: 21.0, division: "aClass" }),
    ],
  };

  test("fieldScene draws the depth and the spread, and only that", () => {
    const scene = fieldScene(analyzeStandings(captionSheet));
    assert.match(scene, /4 corps/);
    // Spread is first-minus-last: 74.250 − 71.000 = 3.250.
    assert.match(scene, /3\.250/);
  });

  test("leaderStory reads the caption book and names the challenger's best answer", () => {
    const story = leaderStory(analyzeStandings(captionSheet));
    // Altitude's strongest book is General Effect (30.000).
    assert.match(story, /General Effect story/);
    assert.match(story, /30\.000/);
    // Black Gold outscores the leader in Visual (24.500 to 24.000), so the story
    // names that as the caption it takes outright.
    assert.match(story, /Black Gold/);
    assert.match(story, /Visual caption outright/);
    assert.match(story, /24\.500 to 24\.000/);
  });

  test("leaderStory goes silent when the caption breakdown is missing", () => {
    // A sheet with no ge/vis/mus gives the caption analysis nothing to read.
    const bare = {
      day: 3,
      fieldSize: 2,
      entries: [
        entry({ rank: 1, uid: "a", corpsName: "Alpha", total: 80 }),
        entry({ rank: 2, uid: "b", corpsName: "Beta", total: 79 }),
      ],
    };
    assert.equal(leaderStory(analyzeStandings(bare)), null);
  });

  test("the full column carries the feature frames when the numbers are there", () => {
    const article = composeNarrative(analyzeStandings(captionSheet));
    // The scene-setting lede beats.
    assert.match(article, /Altitude is in front and breathing easy|real daylight/);
    assert.match(article, /answered the bell/);
    // The centerpiece caption analysis.
    assert.match(article, /\*\*The lead\.\*\*/);
    assert.match(article, /General Effect/);
    // Movers now hangs a score on the climb.
    assert.match(article, /\*\*Movers\.\*\*/);
    assert.match(article, /The climb rides on a 74\.250/);
    // Still one voice, still blank-line paragraphs, still no numbered dump.
    assert.ok(article.includes("\n\n"));
    assert.doesNotMatch(article, /[^\n]\n[^\n]/);
    assert.doesNotMatch(article, /^\d+\.\s/m);
    assert.match(article, /no ballots, no bias, just the board/);
  });
});
