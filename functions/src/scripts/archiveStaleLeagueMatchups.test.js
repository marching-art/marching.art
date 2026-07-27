// The repair rule for leagues already stuck with a previous season's matchups.
//
// Matchup documents are keyed by week number alone and rollover never cleared
// them, so a league that completed one season had last season's week-1 sitting
// in the live collection — and the generator skips a week whose document
// already exists. Getting this rule wrong in the aggressive direction would
// delete a live season's matchups mid-season, so the bar for "stale" is high.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { planLeagueRepair } = require("./archiveStaleLeagueMatchups");

const wk = (n, data = {}) => ({ id: `week-${n}`, data });

describe("planLeagueRepair", () => {
  test("a league that has never rolled over has nothing stale", () => {
    // Everything in the live collection belongs to the only season it played.
    const { stale } = planLeagueRepair([wk(1), wk(2)], [], "season-2");
    assert.deepEqual(stale, []);
  });

  test("unstamped weeks in a rolled-over league are stale", () => {
    const { stale } = planLeagueRepair([wk(1), wk(7)], ["season-1"], "season-2");
    assert.deepEqual(
      stale.map((s) => s.id),
      ["week-1", "week-7"]
    );
    // Labelled with the season they must have belonged to.
    assert.equal(stale[0].seasonUid, "season-1");
  });

  test("picks the most recent archived season as the label", () => {
    const { stale } = planLeagueRepair([wk(1)], ["season-1", "season-3", "season-2"], "season-4");
    assert.equal(stale[0].seasonUid, "season-3");
  });

  test("a week stamped with the live season is current work, not stale", () => {
    const { stale } = planLeagueRepair(
      [wk(1, { seasonUid: "season-2" })],
      ["season-1"],
      "season-2"
    );
    assert.deepEqual(stale, []);
  });

  test("a week stamped with an older season is stale under its own stamp", () => {
    const { stale } = planLeagueRepair(
      [wk(1, { seasonUid: "season-1" })],
      ["season-1"],
      "season-2"
    );
    assert.equal(stale.length, 1);
    assert.equal(stale[0].seasonUid, "season-1");
  });

  test("ignores documents that are not week-N", () => {
    const { stale } = planLeagueRepair([{ id: "notes", data: {} }], ["season-1"], "season-2");
    assert.deepEqual(stale, []);
  });

  // Without a live season a stamped document cannot be judged — but an
  // unstamped one in a rolled-over league still can.
  test("still repairs unstamped weeks when no season is live", () => {
    const { stale } = planLeagueRepair(
      [wk(1), wk(2, { seasonUid: "season-1" })],
      ["season-1"],
      null
    );
    assert.deepEqual(
      stale.map((s) => s.id),
      ["week-1"]
    );
  });
});
