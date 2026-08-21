// Tests for the Podium Report feature composer: the deterministic feature voice
// built straight from a daily standings sheet (read against the nights before
// it) — the day's hook, the dek, the lede, the caption story, caption kings, the
// chase, the closest call, movers, division crowns, arrivals and the floor.
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
  rankOneUid,
  topMargin,
  captionKings,
  tightestPair,
  analyzeStandings,
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

// A day-N sheet with consistent rank/prevRank/delta and full caption books.
const captionSheet = {
  day: 20,
  fieldSize: 4,
  entries: [
    entry({ rank: 1, uid: "a", corpsName: "Altitude", total: 74.25, delta: 3, prevRank: 4, ge: 30, vis: 24, mus: 20.25, division: "worldClass" }),
    entry({ rank: 2, uid: "b", corpsName: "Black Gold", total: 73.053, delta: -1, prevRank: 1, ge: 28, vis: 24.5, mus: 20.553, division: "worldClass" }),
    entry({ rank: 3, uid: "c", corpsName: "Dragon Corps", total: 72.356, delta: 1, prevRank: 4, ge: 27, vis: 24, mus: 21.356, division: "openClass" }),
    entry({ rank: 4, uid: "d", corpsName: "Fogwalkers", total: 71.0, delta: -2, prevRank: 2, ge: 26, vis: 24, mus: 21.0, division: "aClass" }),
  ],
};

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

  test("rankOneUid and topMargin read the top of a sheet", () => {
    assert.equal(rankOneUid(captionSheet), "a");
    assert.equal(rankOneUid({ entries: [] }), null);
    // 74.250 − 73.053 = 1.197
    assert.equal(topMargin(captionSheet), 1.197);
    assert.equal(topMargin({ entries: [entry({})] }), null);
  });

  test("captionKings finds the field-wide owner of each book, or null when absent", () => {
    const ranked = [...captionSheet.entries];
    const kings = captionKings(ranked);
    assert.equal(kings.ge.corpsName, "Altitude"); // 30
    assert.equal(kings.vis.corpsName, "Black Gold"); // 24.5
    assert.equal(kings.mus.corpsName, "Dragon Corps"); // 21.356
    assert.equal(captionKings([entry({ ge: 1 })]), null); // no vis/mus
  });

  test("tightestPair finds the closest adjacent gap on the board", () => {
    const pair = tightestPair([...captionSheet.entries]);
    // 2↔3 is the closest: 73.053 − 72.356 = 0.697
    assert.equal(pair.top.corpsName, "Black Gold");
    assert.equal(pair.bottom.corpsName, "Dragon Corps");
    assert.equal(pair.gap, 0.697);
  });
});

describe("analyzeStandings", () => {
  test("returns null for an empty sheet", () => {
    assert.equal(analyzeStandings({ entries: [] }), null);
    assert.equal(analyzeStandings(null), null);
  });

  test("derives leader, margin, biggest riser and steepest faller", () => {
    const a = analyzeStandings(captionSheet);
    assert.equal(a.leader.corpsName, "Altitude");
    assert.equal(a.runnerUp.corpsName, "Black Gold");
    assert.equal(a.leadMargin, 1.197);
    assert.equal(a.climber.corpsName, "Altitude"); // up 3
    assert.equal(a.faller.corpsName, "Fogwalkers"); // down 2
    assert.equal(a.risers.length, 2);
    assert.equal(a.fallers.length, 2);
  });

  test("flags a lead change and names the corps that was displaced", () => {
    const a = analyzeStandings({
      day: 9,
      fieldSize: 3,
      entries: [
        entry({ rank: 1, uid: "x", corpsName: "Newcomer", total: 90, delta: 1, prevRank: 2 }),
        entry({ rank: 2, uid: "y", corpsName: "Deposed", total: 89, delta: -1, prevRank: 1 }),
        entry({ rank: 3, uid: "z", corpsName: "Third", total: 88, delta: 0, prevRank: 3 }),
      ],
    });
    assert.equal(a.leadChange, true);
    assert.equal(a.formerLeader.corpsName, "Deposed");
  });

  test("counts the leader's streak across the prior nights", () => {
    const night = (uid) => ({ entries: [entry({ rank: 1, uid, corpsName: uid })] });
    // Altitude (uid a) led the last three nights too → streak of 4 counting tonight.
    const a = analyzeStandings(captionSheet, [night("a"), night("a"), night("a"), night("b")]);
    assert.equal(a.leaderStreak, 4);
    // No history → streak of 1 (tonight only).
    assert.equal(analyzeStandings(captionSheet).leaderStreak, 1);
  });

  test("reads the previous margin only when the same corps led last night", () => {
    const prevSame = { entries: [
      entry({ rank: 1, uid: "a", corpsName: "Altitude", total: 70, prevRank: 1 }),
      entry({ rank: 2, uid: "b", corpsName: "Black Gold", total: 69.5, prevRank: 2 }),
    ] };
    const a = analyzeStandings(captionSheet, [prevSame]);
    assert.equal(a.prevLeadMargin, 0.5);
    // Different leader last night → no honest comparison, so null.
    const prevOther = { entries: [
      entry({ rank: 1, uid: "b", corpsName: "Black Gold", total: 70 }),
      entry({ rank: 2, uid: "a", corpsName: "Altitude", total: 69 }),
    ] };
    assert.equal(analyzeStandings(captionSheet, [prevOther]).prevLeadMargin, null);
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
    assert.equal(a.leadChange, false);
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

describe("the day's hook (composeHeadline)", () => {
  const leadChangeSheet = {
    day: 9,
    fieldSize: 2,
    entries: [
      entry({ rank: 1, uid: "x", corpsName: "Newcomer", total: 90, delta: 1, prevRank: 2 }),
      entry({ rank: 2, uid: "y", corpsName: "Deposed", total: 88, delta: -1, prevRank: 1 }),
    ],
  };

  test("a coup at the top names both corps", () => {
    const h = composeHeadline(analyzeStandings(leadChangeSheet));
    assert.equal(h, "Newcomer Topples Deposed for the Podium Class Lead");
  });

  test("a whisker-thin held lead leads on how little there is to spare", () => {
    const sheet = { day: 12, fieldSize: 2, entries: [
      entry({ rank: 1, uid: "a", corpsName: "Altitude", total: 80.05, delta: 0, prevRank: 1 }),
      entry({ rank: 2, uid: "b", corpsName: "Black Gold", total: 80.0, delta: 0, prevRank: 2 }),
    ] };
    assert.equal(composeHeadline(analyzeStandings(sheet)), "Nothing to Spare: Altitude Holds by 0.050");
  });

  test("a long, comfortable reign leads on the streak", () => {
    const night = () => ({ entries: [entry({ rank: 1, uid: "a" })] });
    const sheet = { day: 15, fieldSize: 2, entries: [
      entry({ rank: 1, uid: "a", corpsName: "Altitude", total: 82, delta: 0, prevRank: 1 }),
      entry({ rank: 2, uid: "b", corpsName: "Black Gold", total: 81, delta: 0, prevRank: 2 }),
    ] };
    const h = composeHeadline(analyzeStandings(sheet, [night(), night(), night()]));
    assert.equal(h, "Altitude Makes It 4 Straight Atop the Podium Class");
  });

  test("a genuine surge through the field leads on the climber", () => {
    const sheet = { day: 8, fieldSize: 3, entries: [
      entry({ rank: 1, uid: "a", corpsName: "Altitude", total: 82, delta: 0, prevRank: 1 }),
      entry({ rank: 2, uid: "b", corpsName: "Black Gold", total: 81, delta: 0, prevRank: 2 }),
      entry({ rank: 3, uid: "c", corpsName: "The Gigglers", total: 80, delta: 4, prevRank: 7 }),
    ] };
    assert.equal(composeHeadline(analyzeStandings(sheet)), "The Gigglers Surges 4 Into 3rd");
  });

  test("a runaway at the top", () => {
    const sheet = { day: 8, fieldSize: 2, entries: [
      entry({ rank: 1, uid: "a", corpsName: "Altitude", total: 85, delta: 0, prevRank: 1 }),
      entry({ rank: 2, uid: "b", corpsName: "Black Gold", total: 82, delta: 0, prevRank: 2 }),
    ] };
    assert.equal(composeHeadline(analyzeStandings(sheet)), "Altitude Pulls Away at the Top of the Podium Class");
  });

  test("a quiet hold still names the corps and the day", () => {
    const sheet = { day: 8, fieldSize: 2, entries: [
      entry({ rank: 1, uid: "a", corpsName: "Altitude", total: 81, delta: 0, prevRank: 1 }),
      entry({ rank: 2, uid: "b", corpsName: "Black Gold", total: 80.5, delta: 0, prevRank: 2 }),
    ] };
    assert.equal(composeHeadline(analyzeStandings(sheet)), "Altitude Holds the Podium Class Lead on Day 8");
  });

  test("opening night gets its own hook", () => {
    const sheet = { day: 1, fieldSize: 2, entries: [
      entry({ rank: 1, uid: "a", corpsName: "Altitude", total: 43, delta: null, prevRank: null }),
      entry({ rank: 2, uid: "b", corpsName: "Black Gold", total: 42, delta: null, prevRank: null }),
    ] };
    assert.equal(
      composeHeadline(analyzeStandings(sheet)),
      "The Podium Class Takes Shape: Altitude Sets the Opening Pace"
    );
  });
});

describe("the dek (composeDek)", () => {
  test("packs the leader, score, margin and field shape into a standfirst", () => {
    const dek = composeDek(analyzeStandings(captionSheet));
    assert.match(dek, /Day 20/);
    assert.match(dek, /Altitude takes the lead at 74\.250/); // up 3 from 4th → a lead change
    assert.match(dek, /1\.197 up on Black Gold/);
    // The leader is also the biggest riser here, so it is not double-counted.
    assert.doesNotMatch(dek, /biggest riser/);
    // 74.250 − 71.000 = 3.250 across 4 corps
    assert.match(dek, /4 corps, 3\.250 points top to bottom/);
  });

  test("names the biggest riser in the dek when it isn't the leader", () => {
    const sheet = { day: 8, fieldSize: 3, entries: [
      entry({ rank: 1, uid: "a", corpsName: "Altitude", total: 82, delta: 0, prevRank: 1 }),
      entry({ rank: 2, uid: "b", corpsName: "Black Gold", total: 81, delta: 0, prevRank: 2 }),
      entry({ rank: 3, uid: "c", corpsName: "The Gigglers", total: 80, delta: 4, prevRank: 7 }),
    ] };
    const dek = composeDek(analyzeStandings(sheet));
    assert.match(dek, /The Gigglers is the day's biggest riser, up 4 to 3rd/);
  });
});

describe("prose is deterministic and data-true", () => {
  test("lead sentence names the day, the leader, the margin and the runner-up", () => {
    const held = { day: 12, fieldSize: 2, entries: [
      entry({ rank: 1, uid: "a", corpsName: "Devils", total: 91.2, delta: 0, prevRank: 1 }),
      entry({ rank: 2, uid: "b", corpsName: "Colts", total: 90.1, delta: 0, prevRank: 2 }),
    ] };
    const lede = leadSentence(analyzeStandings(held));
    assert.match(lede, /Day 12/);
    assert.match(lede, /Devils/);
    assert.match(lede, /stays on top of the Podium Class/);
    assert.match(lede, /1\.100 back/);
    assert.match(lede, /Colts/);
  });

  test("lead sentence dramatizes a coup, without naming the deposed corps twice", () => {
    const coup = { day: 9, fieldSize: 2, entries: [
      entry({ rank: 1, uid: "x", corpsName: "Newcomer", total: 90, delta: 1, prevRank: 2 }),
      entry({ rank: 2, uid: "y", corpsName: "Deposed", total: 88, delta: -1, prevRank: 1 }),
    ] };
    const lede = leadSentence(analyzeStandings(coup));
    assert.match(lede, /Newcomer climbs past Deposed to seize the top of the Podium Class/);
    assert.match(lede, /2\.000 clear/);
    // "Deposed" appears exactly once.
    assert.equal((lede.match(/Deposed/g) || []).length, 1);
  });

  test("lead sentence carries a multi-night streak", () => {
    const night = () => ({ entries: [entry({ rank: 1, uid: "a" })] });
    const sheet = { day: 15, fieldSize: 2, entries: [
      entry({ rank: 1, uid: "a", corpsName: "Altitude", total: 82, delta: 0, prevRank: 1 }),
      entry({ rank: 2, uid: "b", corpsName: "Black Gold", total: 81, delta: 0, prevRank: 2 }),
    ] };
    const lede = leadSentence(analyzeStandings(sheet, [night(), night()]));
    assert.match(lede, /makes it 3 nights running atop the Podium Class/);
  });

  test("movers sentence carries multiple climbs and slides plus the top climb's score", () => {
    const movers = moversSentence(analyzeStandings(captionSheet));
    assert.match(movers, /Altitude \(up 3 to 1st\)/);
    assert.match(movers, /Dragon Corps \(up 1 to 3rd\)/);
    assert.match(movers, /Fogwalkers \(down 2 to 4th\)/);
    assert.match(movers, /climb rides on a 74\.250/);
  });

  test("chase sentence names the pack behind the top two, with the spread when tight", () => {
    const chase = chaseSentence(analyzeStandings(captionSheet));
    // Ranks 3–4 here (Dragon Corps, Fogwalkers); the top two are the lede's story.
    assert.match(chase, /Dragon Corps \(72\.356\)/);
    assert.match(chase, /Fogwalkers \(71\.000\)/);
    assert.match(chase, /give chase/);
    assert.doesNotMatch(chase, /Altitude|Black Gold/);
  });

  test("closest-call fires for a photo finish below the top, and stays quiet otherwise", () => {
    // captionSheet's tightest pair (2↔3) is 0.697 — not a photo finish.
    assert.equal(closestCallSentence(analyzeStandings(captionSheet)), null);
    const tight = { day: 8, fieldSize: 4, entries: [
      entry({ rank: 1, uid: "a", corpsName: "Altitude", total: 85, prevRank: 1 }),
      entry({ rank: 2, uid: "b", corpsName: "Black Gold", total: 82, prevRank: 2 }),
      entry({ rank: 3, uid: "c", corpsName: "Dragon Corps", total: 80.02, prevRank: 3 }),
      entry({ rank: 4, uid: "d", corpsName: "Fogwalkers", total: 80.0, prevRank: 4 }),
    ] };
    const call = closestCallSentence(analyzeStandings(tight));
    assert.match(call, /isn't at the top at all/);
    assert.match(call, /Dragon Corps \(3rd\) and Fogwalkers \(4th\)/);
    assert.match(call, /just 0\.020/);
  });

  test("caption kings names each book's field-wide owner and flags a split field", () => {
    const kings = captionKingsSentence(analyzeStandings(captionSheet));
    assert.match(kings, /Altitude owns General Effect at 30\.000/);
    assert.match(kings, /Black Gold the Visual sheet at 24\.500/);
    assert.match(kings, /Dragon Corps the Music book at 21\.356/);
    assert.match(kings, /three different owners/);
  });

  test("caption kings flags a clean sweep", () => {
    const sweep = { day: 8, fieldSize: 2, entries: [
      entry({ rank: 1, uid: "a", corpsName: "Altitude", total: 80, ge: 30, vis: 26, mus: 24, prevRank: 1 }),
      entry({ rank: 2, uid: "b", corpsName: "Black Gold", total: 70, ge: 25, vis: 24, mus: 21, prevRank: 2 }),
    ] };
    assert.match(captionKingsSentence(analyzeStandings(sweep)), /clean sweep of all three books/);
  });

  test("division sentence lists each division's leader", () => {
    const div = divisionSentence(analyzeStandings(captionSheet));
    assert.match(div, /World Class to Altitude/);
    assert.match(div, /Open Class to Dragon Corps/);
    assert.match(div, /A Class to Fogwalkers/);
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

  test("floor sentence anchors a deep field and stays quiet on a shallow one", () => {
    assert.equal(floorSentence(analyzeStandings(captionSheet)), null); // only 4 corps
    const deep = { day: 8, fieldSize: 8, entries: Array.from({ length: 8 }, (_, i) =>
      entry({ rank: i + 1, uid: `u${i}`, corpsName: `Corps ${i + 1}`, total: 80 - i, delta: i === 7 ? -2 : 0, prevRank: i === 7 ? 6 : i + 1 })
    ) };
    const floor = floorSentence(analyzeStandings(deep));
    assert.match(floor, /Corps 8 anchors the field in 8th at 73\.000/);
    assert.match(floor, /down 2 into the cellar/);
  });
});

describe("feature-length prose", () => {
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
    // Black Gold outscores the leader in Visual (24.500 to 24.000).
    assert.match(story, /Black Gold/);
    assert.match(story, /Visual caption outright/);
    assert.match(story, /24\.500 to 24\.000/);
  });

  test("leaderStory adds the night-over-night margin trend when the leader is unchanged", () => {
    const held = { day: 13, fieldSize: 2, entries: [
      entry({ rank: 1, uid: "a", corpsName: "Altitude", total: 80.2, ge: 30, vis: 26, mus: 24.2, delta: 0, prevRank: 1 }),
      entry({ rank: 2, uid: "b", corpsName: "Black Gold", total: 80.0, ge: 29, vis: 26, mus: 25, delta: 0, prevRank: 2 }),
    ] };
    // Yesterday the same leader was 0.800 clear; tonight only 0.200 → tightening.
    const prev = { entries: [
      entry({ rank: 1, uid: "a", corpsName: "Altitude", total: 79.8 }),
      entry({ rank: 2, uid: "b", corpsName: "Black Gold", total: 79.0 }),
    ] };
    const story = leaderStory(analyzeStandings(held, [prev]));
    assert.match(story, /was 0\.800 a night ago is down to 0\.200/);
    assert.match(story, /tightening/);
  });

  test("leaderStory goes silent when the caption breakdown is missing", () => {
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

  test("opening night still reads as a feature: scene set, no movers or arrivals", () => {
    const openingSheet = {
      day: 1,
      fieldSize: 3,
      entries: [
        entry({ rank: 1, uid: "a", corpsName: "Altitude", total: 43.508, ge: 17.2, vis: 13.131, mus: 13.177, delta: null, prevRank: null, division: "worldClass" }),
        entry({ rank: 2, uid: "b", corpsName: "Black Gold", total: 43.401, ge: 17.0, vis: 13.012, mus: 13.389, delta: null, prevRank: null, division: "worldClass" }),
        entry({ rank: 3, uid: "c", corpsName: "Fogwalkers", total: 42.411, ge: 16.4, vis: 13.0, mus: 13.011, delta: null, prevRank: null, division: "worldClass" }),
      ],
    };
    const article = composeNarrative(analyzeStandings(openingSheet));
    assert.match(article, /Opening night is a blank page/);
    // The scene and the caption story are woven in as flowing prose...
    assert.match(article, /3 corps answered the bell/);
    assert.match(article, /packed tight/);
    assert.match(article, /Pull the .* apart/); // the leader's caption story
    assert.match(article, /Read it caption by caption/); // caption kings
    // ...with no Axios-style subhead chips anywhere in the piece.
    assert.doesNotMatch(article, /\*\*/);
    // Nothing to move or arrive when the whole field is brand new.
    assert.doesNotMatch(article, /is climbing|are climbing|giving ground/);
    assert.doesNotMatch(article, /New to the conversation/);
    assert.match(article, /no ballots, no bias, just the board/);
    assert.doesNotMatch(article, /[^\n]\n[^\n]/);
  });

  test("the full column reads as a magazine feature and stays data-true", () => {
    const one = composeNarrative(analyzeStandings(captionSheet));
    const two = composeNarrative(analyzeStandings(captionSheet));
    assert.equal(one, two); // deterministic

    // Blank-line paragraphs, no lone newline inside a line.
    assert.ok(one.includes("\n\n"));
    assert.doesNotMatch(one, /[^\n]\n[^\n]/);

    // Flowing feature prose — the beats are woven in, NOT stacked as labeled
    // chips, and never a "1. … 2. …" ranking dump.
    assert.doesNotMatch(one, /\*\*/); // no bolded subhead chips
    assert.match(one, /Pull the .* apart/); // the leader's caption story
    assert.match(one, /Read it caption by caption/); // caption kings
    assert.match(one, /pack is doing its own math/); // the chase
    assert.match(one, /is climbing|are climbing/); // the movers
    assert.doesNotMatch(one, /^\d+\.\s/m);

    // A handful of substantial paragraphs, not a fragment per beat.
    assert.ok(one.split("\n\n").length <= 6);

    // Still data-true: the leader, score and caption story lead the piece.
    assert.match(one, /Altitude/);
    assert.match(one, /74\.250/);
    assert.match(one, /General Effect/);
    assert.match(one, /no ballots, no bias, just the board/);
  });
});
