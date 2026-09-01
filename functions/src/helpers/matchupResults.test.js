// Tests for the matchup-result pushes built from a settled weekly matchup
// doc: win/loss/tie copy, the multi-matchup W-L summary, and that byes and
// unsettled matchups never generate a push.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { buildMatchupResultPushes } = require("./matchupResults");

const PROFILES = {
  u1: { displayName: "chris" },
  u2: { displayName: "alex" },
  u3: { displayName: "sam" },
  u4: { displayName: "kai" },
};

describe("buildMatchupResultPushes", () => {
  test("single settled matchup: full score line, both sides notified", () => {
    const pushes = buildMatchupResultPushes({
      leagueName: "Brass Bandits",
      week: 3,
      matchupData: {
        worldClassMatchups: [
          {
            pair: ["u1", "u2"],
            completed: true,
            winner: "u1",
            scores: { u1: 287.4, u2: 285.1 },
          },
        ],
      },
      memberProfiles: PROFILES,
    });

    const byUid = new Map(pushes.map((p) => [p.uid, p]));
    assert.equal(pushes.length, 2);
    assert.equal(byUid.get("u1").title, "Week 3 results are in 🏆");
    assert.match(byUid.get("u1").body, /You beat alex 287\.400–285\.100 in World Class \(Brass Bandits\)!/);
    assert.match(byUid.get("u2").body, /You fell to chris 287\.400–285\.100 in World Class \(Brass Bandits\)\./);
    assert.equal(byUid.get("u1").url, "/leagues");
  });

  test("ties are reported as ties", () => {
    const pushes = buildMatchupResultPushes({
      leagueName: "Brass Bandits",
      week: 2,
      matchupData: {
        aClassMatchups: [
          { pair: ["u1", "u2"], completed: true, winner: null, scores: { u1: 100, u2: 100 } },
        ],
      },
      memberProfiles: PROFILES,
    });
    assert.match(pushes[0].body, /You tied (alex|chris) 100\.000–100\.000 in A Class/);
  });

  test("multiple settled matchups collapse to one W-L summary push", () => {
    const pushes = buildMatchupResultPushes({
      leagueName: "Brass Bandits",
      week: 4,
      matchupData: {
        worldClassMatchups: [
          { pair: ["u1", "u2"], completed: true, winner: "u1", scores: { u1: 287, u2: 285 } },
        ],
        openClassMatchups: [
          { pair: ["u1", "u3"], completed: true, winner: "u3", scores: { u1: 110, u3: 112 } },
        ],
        aClassMatchups: [
          { pair: ["u1", "u4"], completed: true, winner: "u1", scores: { u1: 55, u4: 51 } },
        ],
      },
      memberProfiles: PROFILES,
    });

    const u1 = pushes.find((p) => p.uid === "u1");
    assert.match(u1.body, /Brass Bandits: you went 2W–1L across your matchups this week/);
    assert.equal(u1.data.matchups, "3");
    // Opponents with a single matchup each still get the full score line.
    assert.match(pushes.find((p) => p.uid === "u2").body, /You fell to chris/);
  });

  test("byes, unsettled, and score-less matchups produce no pushes", () => {
    const pushes = buildMatchupResultPushes({
      leagueName: "Brass Bandits",
      week: 1,
      matchupData: {
        worldClassMatchups: [
          { pair: ["u1", null], winner: "u1", completed: true, isBye: true },
          { pair: ["u2", "u3"], completed: false, winner: null },
          { pair: ["u2", "u4"], completed: true, winner: "u2" }, // no scores
        ],
      },
      memberProfiles: PROFILES,
    });
    assert.equal(pushes.length, 0);
  });

  test("missing winner falls back to the score line", () => {
    const pushes = buildMatchupResultPushes({
      leagueName: null,
      week: 5,
      matchupData: {
        soundSportMatchups: [
          { pair: ["u1", "u2"], completed: true, winner: null, scores: { u1: 90, u2: 80 } },
        ],
      },
      memberProfiles: {},
    });
    const byUid = new Map(pushes.map((p) => [p.uid, p]));
    assert.match(byUid.get("u1").body, /You beat your opponent/);
    assert.match(byUid.get("u2").body, /You fell to your opponent/);
    assert.match(byUid.get("u1").body, /\(your league\)/);
  });
});

describe("cross-class matchup pushes", () => {
  test("the copy explains the class-rank verdict and drops the score line", () => {
    const pushes = buildMatchupResultPushes({
      leagueName: "Mixed League",
      week: 4,
      matchupData: {
        worldClassMatchups: [
          {
            pair: ["u1", "u2"],
            classes: { u1: "worldClass", u2: "soundSport" },
            crossClass: true,
            completed: true,
            winner: "u2", // fewer raw points, better week against their class
            scores: { u1: 85, u2: 62 },
            normalized: { u1: 33, u2: 100 },
          },
        ],
      },
      memberProfiles: {},
    });
    const byUid = new Map(pushes.map((p) => [p.uid, p]));
    assert.match(byUid.get("u2").body, /cross-class/);
    assert.match(byUid.get("u1").body, /cross-class/);
    assert.doesNotMatch(byUid.get("u2").body, /85\.000/);
    // Each side is labeled with its OWN class, not the array it was stored in.
    assert.match(byUid.get("u2").body, /SoundSport/);
  });

  test("a stored tie reads as a tie, not a loss for both sides", () => {
    const pushes = buildMatchupResultPushes({
      leagueName: null,
      week: 2,
      matchupData: {
        aClassMatchups: [
          { pair: ["u1", "u2"], completed: true, winner: "tie", scores: { u1: 70, u2: 70 } },
        ],
      },
      memberProfiles: {},
    });
    for (const push of pushes) assert.match(push.body, /tied/);
  });
});

describe("one-night slate pushes", () => {
  test("the push quotes best shows, not weekly totals", () => {
    const pushes = buildMatchupResultPushes({
      leagueName: "Peak League",
      week: 3,
      matchupData: {
        worldClassMatchups: [
          {
            pair: ["u1", "u2"],
            completed: true,
            winner: "u2",
            scores: { u1: 162, u2: 85 },
            best: { u1: { score: 82, showName: "Tuesday" }, u2: { score: 85, showName: "Saturday" } },
          },
        ],
      },
      memberProfiles: {},
    });
    const byUid = new Map(pushes.map((p) => [p.uid, p]));
    assert.match(byUid.get("u2").body, /85\.000–82\.000 \(best show\)/);
    assert.match(byUid.get("u1").body, /You fell to/);
    assert.doesNotMatch(byUid.get("u2").body, /162\.000/);
  });
});
