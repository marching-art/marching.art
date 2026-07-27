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
