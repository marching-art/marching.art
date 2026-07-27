// The weekly league recap — specifically the Caption Wars stats, which are the
// part that has to tell "no sweeps this week" apart from "this league does not
// have sweeps".
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { generateWeeklyRecap } = require("./leagueRecaps");

/** A resolved matchup on the default format. */
const plain = (p1, p2, s1, s2) => ({
  pair: [p1, p2],
  scores: { [p1]: s1, [p2]: s2 },
  winner: s1 === s2 ? "tie" : s1 > s2 ? p1 : p2,
  completed: true,
});

/** The same, plus the stored caption verdicts. */
const withCaptions = (p1, p2, s1, s2, winners) => ({
  ...plain(p1, p2, s1, s2),
  winner: winners.filter((w) => w === p1).length >= 2 ? p1 : p2,
  captions: {
    ge: { scores: { [p1]: 30, [p2]: 30 }, winner: winners[0] },
    visual: { scores: { [p1]: 28, [p2]: 28 }, winner: winners[1] },
    music: { scores: { [p1]: 28, [p2]: 28 }, winner: winners[2] },
    tally: {
      [p1]: winners.filter((w) => w === p1).length,
      [p2]: winners.filter((w) => w === p2).length,
    },
  },
});

const week = (matchups) => ({ worldClassMatchups: matchups });
const profiles = { alice: { displayName: "Alice" }, bob: { displayName: "Bob" } };

describe("generateWeeklyRecap caption stats", () => {
  test("a league on the default format has no caption block at all", () => {
    const recap = generateWeeklyRecap(week([plain("alice", "bob", 90, 80)]), {}, profiles);
    assert.equal(recap.stats.captions, null);
    assert.equal(
      recap.highlights.some((h) => h.type === "caption_sweep"),
      false
    );
  });

  test("counts sweeps and names them", () => {
    const recap = generateWeeklyRecap(
      week([withCaptions("alice", "bob", 90, 80, ["alice", "alice", "alice"])]),
      {},
      profiles
    );

    assert.equal(recap.stats.captions.matchups, 1);
    assert.deepEqual(
      recap.stats.captions.sweeps.map((s) => s.playerId),
      ["alice"]
    );
    const highlight = recap.highlights.find((h) => h.type === "caption_sweep");
    assert.match(highlight.text, /Alice swept all three/);
  });

  // Under this format the close game is the 2-1, not the narrow points margin:
  // a director can lose by a tenth and still be swept.
  test("a 2-1 is a thriller, not a sweep", () => {
    const recap = generateWeeklyRecap(
      week([withCaptions("alice", "bob", 86, 94, ["bob", "alice", "alice"])]),
      {},
      profiles
    );

    assert.equal(recap.stats.captions.sweeps.length, 0);
    assert.equal(recap.stats.captions.thrillers, 1);
    assert.equal(
      recap.highlights.some((h) => h.type === "caption_sweep"),
      false
    );
  });

  test("a week with captions but no sweeps still reports the block", () => {
    const recap = generateWeeklyRecap(
      week([withCaptions("alice", "bob", 90, 80, ["alice", "alice", "bob"])]),
      {},
      profiles
    );
    assert.equal(recap.stats.captions.matchups, 1);
    assert.equal(recap.stats.captions.sweeps.length, 0);
  });

  test("names every sweeper when more than one manages it", () => {
    const recap = generateWeeklyRecap(
      {
        worldClassMatchups: [withCaptions("alice", "bob", 90, 80, ["alice", "alice", "alice"])],
        aClassMatchups: [withCaptions("carol", "dave", 70, 60, ["carol", "carol", "carol"])],
      },
      {},
      profiles
    );

    assert.equal(recap.stats.captions.sweeps.length, 2);
    const highlight = recap.highlights.find((h) => h.type === "caption_sweep");
    assert.match(highlight.text, /2 directors swept/);
  });

  test("byes carry no captions and are counted as byes", () => {
    const recap = generateWeeklyRecap(
      week([{ pair: ["alice", null], winner: "alice", completed: true, isBye: true }]),
      {},
      profiles
    );
    assert.equal(recap.stats.totalByes, 1);
    assert.equal(recap.stats.captions, null);
  });
});
