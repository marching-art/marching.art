// League champion selection — the fix for a title that ignored the season.
//
// The old selector summed corps.*.totalSeasonScore (each corps' LAST show
// score) across every class and crowned the biggest number, so the prize pool,
// the legendary achievement and the permanent champions[] entry could all go to
// a director who lost most of their matchups but peaked on the final night.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { selectLeagueChampion } = require("./leagueChampion");

const row = (uid, wins, losses, ties = 0, totalPoints = 0) => ({
  uid,
  wins,
  losses,
  ties,
  totalPoints,
  pointsAgainst: 0,
});

describe("selectLeagueChampion", () => {
  test("crowns the standings leader when no Finals night was scored", () => {
    const result = selectLeagueChampion({
      standings: [row("bob", 1, 5), row("alice", 5, 1)],
      eligibleUids: ["alice", "bob"],
    });

    assert.equal(result.championUid, "alice");
    assert.equal(result.decidedBy, "standings");
    assert.equal(result.seed, 1);
    assert.deepEqual(result.record, { wins: 5, losses: 1, ties: 0, totalPoints: 0 });
  });

  test("re-seeds rather than trusting the stored row order", () => {
    // A standings document written before compareStandingRows existed carries
    // the old wins-then-points order.
    const result = selectLeagueChampion({
      standings: [row("bob", 2, 4), row("alice", 6, 0)],
      eligibleUids: ["alice", "bob"],
    });
    assert.equal(result.championUid, "alice");
  });

  test("Finals night decides the title among the qualifiers", () => {
    const result = selectLeagueChampion({
      standings: [row("alice", 6, 0), row("bob", 5, 1), row("carol", 0, 6)],
      eligibleUids: ["alice", "bob", "carol"],
      finalsScores: new Map([
        ["alice", { score: 91, shows: 1 }],
        ["bob", { score: 95, shows: 1 }],
        ["carol", { score: 99, shows: 1 }],
      ]),
      finalsSize: 2,
    });

    // Carol posted the best Finals score but never made the finals field —
    // the regular season is what earns you the right to be there.
    assert.equal(result.championUid, "bob");
    assert.equal(result.decidedBy, "finals");
    assert.equal(result.finalsScore, 95);
    assert.deepEqual(
      result.qualifiers.map((q) => q.uid),
      ["alice", "bob"]
    );
  });

  test("a Finals tie breaks to the better regular-season seed", () => {
    const result = selectLeagueChampion({
      standings: [row("alice", 6, 0), row("bob", 5, 1)],
      eligibleUids: ["alice", "bob"],
      finalsScores: new Map([
        ["alice", { score: 90, shows: 1 }],
        ["bob", { score: 90, shows: 1 }],
      ]),
    });

    assert.equal(result.championUid, "alice");
    assert.equal(result.seed, 1);
  });

  test("falls back to the standings when nobody in the field competed at Finals", () => {
    const result = selectLeagueChampion({
      standings: [row("alice", 6, 0), row("bob", 5, 1)],
      eligibleUids: ["alice", "bob"],
      // Present but empty: crowning on these zeros would pick whoever sorted
      // first rather than whoever won the league.
      finalsScores: new Map([
        ["alice", { score: 0, shows: 0 }],
        ["bob", { score: 0, shows: 0 }],
      ]),
    });

    assert.equal(result.championUid, "alice");
    assert.equal(result.decidedBy, "standings");
    assert.equal(result.finalsScore, null);
  });

  test("directors who did not register this season cannot win it", () => {
    const result = selectLeagueChampion({
      standings: [row("ghost", 9, 0), row("alice", 3, 3)],
      eligibleUids: ["alice"],
    });

    assert.equal(result.championUid, "alice");
    assert.deepEqual(
      result.qualifiers.map((q) => q.uid),
      ["alice"]
    );
  });

  test("ranks on win percentage, so uneven schedules do not decide it", () => {
    // Byes and part-season classes mean members do not all play the same
    // number of matchups; ranking on raw wins rewarded whoever was paired most.
    const result = selectLeagueChampion({
      standings: [row("grinder", 4, 4), row("sharp", 3, 0)],
      eligibleUids: ["grinder", "sharp"],
    });

    assert.equal(result.championUid, "sharp");
  });

  test("returns no champion for a league with no standings", () => {
    const result = selectLeagueChampion({ standings: [], eligibleUids: ["alice"] });
    assert.equal(result.championUid, null);
    assert.equal(result.decidedBy, "none");
    assert.deepEqual(result.qualifiers, []);
  });
});

// A league of twenty with a finals field of twelve left eight directors with
// nothing to play for from the moment they were mathematically out — which is
// the week most of them stop showing up. The consolation title is the same race
// on the same week, decided by the same rule.
describe("consolation title", () => {
  const field = (n) =>
    Array.from({ length: n }, (_, i) => row(`d${i + 1}`, n - i, i));
  const uids = (n) => field(n).map((r) => r.uid);

  test("crowns the best of the directors below the cut", () => {
    const result = selectLeagueChampion({
      standings: field(6),
      eligibleUids: uids(6),
      finalsSize: 4,
    });

    assert.equal(result.championUid, "d1");
    // Seeds continue from the cut: 13th is 13th, not the #1 seed of anything.
    assert.deepEqual(result.consolation, {
      uid: "d5",
      seed: 5,
      decidedBy: "standings",
      finalsScore: null,
      record: { wins: 2, losses: 4, ties: 0, totalPoints: 0 },
      fieldSize: 2,
    });
  });

  test("championship week decides it, exactly as it decides the title", () => {
    const result = selectLeagueChampion({
      standings: field(6),
      eligibleUids: uids(6),
      finalsSize: 4,
      // The lower seed below the cut has the better Finals night.
      finalsScores: new Map([
        ["d5", { score: 70, shows: 1 }],
        ["d6", { score: 88, shows: 1 }],
      ]),
    });

    assert.equal(result.consolation.uid, "d6");
    assert.equal(result.consolation.decidedBy, "finals");
    assert.equal(result.consolation.finalsScore, 88);
  });

  test("a Finals night nobody below the cut competed in falls back to the seed", () => {
    const result = selectLeagueChampion({
      standings: field(6),
      eligibleUids: uids(6),
      finalsSize: 4,
      // Only a qualifier competed — the consolation field all sat it out.
      finalsScores: new Map([["d1", { score: 95, shows: 1 }]]),
    });

    assert.equal(result.consolation.uid, "d5");
    assert.equal(result.consolation.decidedBy, "standings");
    assert.equal(result.consolation.finalsScore, null);
  });

  // Winning by beating nobody is not a title, and a "Consolation Champion" of
  // one reads as a consolation prize in the worst sense.
  test("a field of one is not a race", () => {
    const result = selectLeagueChampion({
      standings: field(5),
      eligibleUids: uids(5),
      finalsSize: 4,
    });
    assert.equal(result.consolation, null);
  });

  test("a league where everyone qualifies has no consolation", () => {
    const result = selectLeagueChampion({
      standings: field(4),
      eligibleUids: uids(4),
      finalsSize: 12,
    });
    assert.equal(result.consolation, null);
  });

  test("a league with no standings at all has none either", () => {
    const result = selectLeagueChampion({ standings: [], eligibleUids: [] });
    assert.equal(result.consolation, null);
  });

  // Directors who did not register for the season are not in anyone's field.
  test("ineligible directors are excluded before the cut is drawn", () => {
    const result = selectLeagueChampion({
      standings: field(6),
      eligibleUids: ["d1", "d2", "d5", "d6"],
      finalsSize: 2,
    });

    assert.equal(result.championUid, "d1");
    assert.equal(result.consolation.uid, "d5");
    assert.equal(result.consolation.seed, 3);
    assert.equal(result.consolation.fieldSize, 2);
  });
});
