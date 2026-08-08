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
  analyzeStandings,
  leadSentence,
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
