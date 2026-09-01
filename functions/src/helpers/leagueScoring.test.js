// Week-scoped league scoring: the fix for matchups that were decided by each
// corps' MOST RECENT show score rather than by the week they were supposed to
// be about.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  weekDayRange,
  buildWeeklyScoreIndex,
  getWeekScore,
  decideHeadToHead,
  participatingClassesByUid,
} = require("./leagueScoring");

const day = (results) => ({ exists: true, data: () => ({ shows: [{ results }] }) });
const missingDay = { exists: false, data: () => undefined };

describe("weekDayRange", () => {
  test("maps weeks onto the scorer's 7-day boundary", () => {
    assert.deepEqual(weekDayRange(1), { firstDay: 1, lastDay: 7 });
    assert.deepEqual(weekDayRange(3), { firstDay: 15, lastDay: 21 });
    // Championship week ends on Finals (day 49).
    assert.deepEqual(weekDayRange(7), { firstDay: 43, lastDay: 49 });
  });
});

describe("buildWeeklyScoreIndex", () => {
  test("sums every show a corps attended during the week", () => {
    const { index, daysFound } = buildWeeklyScoreIndex([
      day([{ uid: "alice", corpsClass: "worldClass", totalScore: 80 }]),
      day([{ uid: "alice", corpsClass: "worldClass", totalScore: 82.5 }]),
    ]);

    assert.equal(daysFound, 2);
    // Competing twice counts twice. The old "latest show" comparison threw the
    // first performance away entirely.
    const alice = getWeekScore(index, "alice", "worldClass");
    assert.equal(alice.score, 162.5);
    assert.equal(alice.shows, 2);
  });

  test("keeps a director's classes separate", () => {
    const { index } = buildWeeklyScoreIndex([
      day([
        { uid: "alice", corpsClass: "worldClass", totalScore: 90 },
        { uid: "alice", corpsClass: "soundSport", totalScore: 60 },
      ]),
    ]);

    assert.equal(getWeekScore(index, "alice", "worldClass").score, 90);
    assert.equal(getWeekScore(index, "alice", "soundSport").score, 60);
  });

  test("a corps that did not compete scores zero with zero shows", () => {
    const { index } = buildWeeklyScoreIndex([
      day([{ uid: "alice", corpsClass: "worldClass", totalScore: 90 }]),
    ]);

    // This is the whole point: sitting the week out is a forfeited week, not a
    // stale score carried forward from whenever the corps last performed.
    const absent = getWeekScore(index, "absent", "worldClass");
    assert.equal(absent.score, 0);
    assert.equal(absent.shows, 0);
    // Last in their field, by definition.
    assert.equal(absent.classPercentile, 0);
  });

  test("daysFound distinguishes an unscored week from an empty one", () => {
    assert.equal(buildWeeklyScoreIndex([missingDay, missingDay]).daysFound, 0);
    assert.equal(buildWeeklyScoreIndex([day([])]).daysFound, 1);
  });

  test("ignores malformed results instead of throwing", () => {
    const { index } = buildWeeklyScoreIndex([
      day([
        null,
        { corpsClass: "worldClass", totalScore: 90 }, // no uid
        { uid: "bob", totalScore: 90 }, // no class
        { uid: "bob", corpsClass: "worldClass" }, // no score
      ]),
    ]);

    const bob = getWeekScore(index, "bob", "worldClass");
    assert.equal(bob.score, 0);
    assert.equal(bob.shows, 1);
  });
});

// The three caption groups the scorer persists on every show result, carried
// through the same fold as the total so the Caption Wars format can never
// disagree with it about which shows a week contained.
describe("caption groups", () => {
  const show = (uid, totalScore, geScore, visualScore, musicScore) => ({
    uid,
    corpsClass: "worldClass",
    totalScore,
    geScore,
    visualScore,
    musicScore,
  });

  test("sums each caption group across the week alongside the total", () => {
    const { index } = buildWeeklyScoreIndex([
      day([show("alice", 86, 30, 28, 28)]),
      day([show("alice", 88, 32, 28, 28)]),
    ]);

    const alice = getWeekScore(index, "alice", "worldClass");
    assert.equal(alice.score, 174);
    assert.equal(alice.ge, 62);
    assert.equal(alice.visual, 56);
    assert.equal(alice.music, 56);
  });

  test("a corps that did not compete forfeits every category, not just the total", () => {
    const { index } = buildWeeklyScoreIndex([day([show("alice", 86, 30, 28, 28)])]);

    const missing = getWeekScore(index, "absent", "worldClass");
    assert.equal(missing.ge, 0);
    assert.equal(missing.visual, 0);
    assert.equal(missing.music, 0);
  });

  // Recap days written before the caption groups existed, or a malformed
  // result, must not poison a week's captions with NaN.
  test("results with no caption fields contribute zero", () => {
    const { index } = buildWeeklyScoreIndex([
      day([{ uid: "bob", corpsClass: "worldClass", totalScore: 86 }]),
    ]);

    const bob = getWeekScore(index, "bob", "worldClass");
    assert.equal(bob.score, 86);
    assert.equal(bob.ge, 0);
    assert.equal(bob.visual, 0);
    assert.equal(bob.music, 0);
  });
});

// League standings are league-wide but matchups are class-segregated, so a
// mixed-class league used to rank its members on numbers that were never
// comparable: a World Class week is ~90 points and a SoundSport week ~60, which
// meant the points tiebreaker quietly sorted by class rather than by
// performance.
describe("class percentiles", () => {
  test("ranks each corps against its own class, not the whole field", () => {
    const { index } = buildWeeklyScoreIndex([
      day([
        { uid: "worldTop", corpsClass: "worldClass", totalScore: 95 },
        { uid: "worldMid", corpsClass: "worldClass", totalScore: 90 },
        { uid: "worldLow", corpsClass: "worldClass", totalScore: 85 },
        // Would rank last overall on raw points, but leads its own class.
        { uid: "soundTop", corpsClass: "soundSport", totalScore: 62 },
        { uid: "soundLow", corpsClass: "soundSport", totalScore: 55 },
      ]),
    ]);

    assert.equal(getWeekScore(index, "worldTop", "worldClass").classPercentile, 100);
    assert.equal(getWeekScore(index, "soundTop", "soundSport").classPercentile, 100);
    // The best SoundSport week beats the worst World Class week once each is
    // measured against its own field — which is the entire point.
    assert.ok(
      getWeekScore(index, "soundTop", "soundSport").classPercentile >
        getWeekScore(index, "worldLow", "worldClass").classPercentile
    );
  });

  test("tied corps share a percentile rather than one edging the other", () => {
    const { index } = buildWeeklyScoreIndex([
      day([
        { uid: "a", corpsClass: "worldClass", totalScore: 90 },
        { uid: "b", corpsClass: "worldClass", totalScore: 90 },
      ]),
    ]);

    assert.equal(
      getWeekScore(index, "a", "worldClass").classPercentile,
      getWeekScore(index, "b", "worldClass").classPercentile
    );
  });

  test("a lone entrant leads their field", () => {
    const { index } = buildWeeklyScoreIndex([
      day([{ uid: "solo", corpsClass: "aClass", totalScore: 70 }]),
    ]);
    assert.equal(getWeekScore(index, "solo", "aClass").classPercentile, 100);
    assert.equal(getWeekScore(index, "solo", "aClass").classFieldSize, 1);
  });
});

describe("participatingClassesByUid", () => {
  test("reports the distinct classes each director competed in", () => {
    const { index } = buildWeeklyScoreIndex([
      day([
        { uid: "alice", corpsClass: "worldClass", totalScore: 90 },
        { uid: "alice", corpsClass: "aClass", totalScore: 70 },
        { uid: "bob", corpsClass: "worldClass", totalScore: 88 },
      ]),
    ]);

    const byUid = participatingClassesByUid(index);
    assert.deepEqual([...byUid.get("alice")].sort(), ["aClass", "worldClass"]);
    assert.deepEqual([...byUid.get("bob")], ["worldClass"]);
    assert.equal(byUid.has("absent"), false);
  });
});

describe("decideHeadToHead", () => {
  // Alice's World Class week is a middling 85 in a strong field; Bob's
  // SoundSport 62 leads his. Raw points say Alice; the class fields say Bob.
  const crossIndex = () =>
    buildWeeklyScoreIndex([
      day([
        { uid: "alice", corpsClass: "worldClass", totalScore: 85 },
        { uid: "wc2", corpsClass: "worldClass", totalScore: 90 },
        { uid: "wc3", corpsClass: "worldClass", totalScore: 88 },
        { uid: "bob", corpsClass: "soundSport", totalScore: 62 },
        { uid: "ss2", corpsClass: "soundSport", totalScore: 55 },
      ]),
    ]).index;

  test("same-class matchups are still decided on points", () => {
    const { winner, crossClass } = decideHeadToHead(
      { pair: ["alice", "wc2"] },
      "worldClass",
      crossIndex()
    );
    assert.equal(crossClass, false);
    assert.equal(winner, "wc2");
  });

  test("cross-class matchups are decided on each side's class percentile", () => {
    const decided = decideHeadToHead(
      { pair: ["alice", "bob"], classes: { alice: "worldClass", bob: "soundSport" } },
      "worldClass",
      crossIndex()
    );
    assert.equal(decided.crossClass, true);
    assert.equal(decided.p1Class, "worldClass");
    assert.equal(decided.p2Class, "soundSport");
    // Alice posted more raw points but finished last of three in her class;
    // Bob led his field. The percentile, not the raw total, decides it.
    assert.ok(decided.p1Week.score > decided.p2Week.score);
    assert.equal(decided.winner, "bob");
  });

  test("sitting out a cross-class week is still a forfeit", () => {
    const decided = decideHeadToHead(
      { pair: ["alice", "ghost"], classes: { alice: "worldClass", ghost: "soundSport" } },
      "worldClass",
      crossIndex()
    );
    // Ghost never competed: 0th percentile against Alice's real week.
    assert.equal(decided.winner, "alice");
  });

  test("two identical percentiles tie", () => {
    // Both led their (solo) class fields: 100th percentile each.
    const { index } = buildWeeklyScoreIndex([
      day([
        { uid: "alice", corpsClass: "worldClass", totalScore: 85 },
        { uid: "bob", corpsClass: "soundSport", totalScore: 62 },
      ]),
    ]);
    const decided = decideHeadToHead(
      { pair: ["alice", "bob"], classes: { alice: "worldClass", bob: "soundSport" } },
      "worldClass",
      index
    );
    assert.equal(decided.winner, "tie");
  });

  test("a matchup with no classes map resolves in the array's class", () => {
    const decided = decideHeadToHead({ pair: ["bob", "ss2"] }, "soundSport", crossIndex());
    assert.equal(decided.crossClass, false);
    assert.equal(decided.winner, "bob");
  });
});
