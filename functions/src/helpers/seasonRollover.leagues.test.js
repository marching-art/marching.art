// Behavior tests for the league half of the season-rollover pipeline:
//
// 1. resetLeaguesForNewSeason — every league's finished table, matchups and
//    weekly recaps move into per-season history and the live season restarts
//    at 0-0 with rivalries, pins, pointers and the bought scoring format reset.
//
// 2. The season_rollovers lease — a forced double season-start cannot re-pay
//    finish bonuses or re-increment totalSeasons.
//
// The profile/champion half lives in seasonRollover.test.js; both share
// __fixtures__/seasonRolloverFakes.

// The namespace must be pinned before ./season (and its path helpers) load.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { resetLeaguesForNewSeason, rolloverFromOldSeason } = require("./season");
const {
  claimSeasonRollover,
  markSeasonRolloverCompleted,
} = require("./scoringRunGuard");
const {
  leaguesPath,
  makeFakeDb,
  participatingCorps,
} = require("./__fixtures__/seasonRolloverFakes");

describe("resetLeaguesForNewSeason", () => {
  // Leagues used to be season-blind: seasonId was stamped once at creation and
  // standings simply accumulated, so two seasons in, a league's table showed
  // W/L blended across every season it had ever played — which also defeated
  // the client's "inactive member" heuristic, since it inferred activity from
  // a non-zero record.
  const leagueWithStandings = (docs, id = "league-1", members = ["alice", "bob"]) => {
    docs.set(`${leaguesPath}/${id}/standings/current`, {
      records: { alice: { wins: 5, losses: 1 }, bob: { wins: 1, losses: 5 } },
      standings: [
        { uid: "alice", wins: 5, losses: 1, totalPoints: 400 },
        { uid: "bob", wins: 1, losses: 5, totalPoints: 120 },
      ],
    });
    return { id, data: { name: "Test League", members, matchupsGeneratedWeek: 8 } };
  };

  test("archives the finished table and starts the new season at 0-0", async () => {
    const docs = new Map();
    const league = leagueWithStandings(docs);
    const { db, writes } = makeFakeDb({ leagues: [league], docs });

    await resetLeaguesForNewSeason(db, "old-season", "new-season");

    const archived = writes.find(
      (w) => w.path === `${leaguesPath}/league-1/standings/old-season`
    );
    assert.ok(archived, "the finished season's table must be kept as history");
    assert.equal(archived.data.seasonUid, "old-season");
    assert.equal(archived.data.standings.length, 2);

    const live = writes.find((w) => w.path === `${leaguesPath}/league-1/standings/current`);
    assert.ok(live, "the live table must be reset");
    assert.deepEqual(live.data.standings, []);
    assert.deepEqual(live.data.records, {});
  });

  // Standings were reset here from the start; matchups never were. They are
  // keyed by week number alone, so last season's week-1 was still sitting there
  // when the new season began — and the generator skips a week whose document
  // already exists. A league that completed one season never had matchups
  // generated again: every week looked done, the weekly resolution found
  // nothing to resolve, and the table never moved.
  test("moves the finished season's matchups out of the live collection", async () => {
    const docs = new Map();
    const league = leagueWithStandings(docs);
    docs.set(`${leaguesPath}/league-1/matchups/week-1`, {
      worldClassMatchups: [{ pair: ["alice", "bob"], winner: "alice", completed: true }],
    });
    docs.set(`${leaguesPath}/league-1/matchups/week-7`, {
      worldClassMatchups: [{ pair: ["alice", "bob"], winner: "bob", completed: true }],
    });
    const { db, writes } = makeFakeDb({ leagues: [league], docs });

    await resetLeaguesForNewSeason(db, "old-season", "new-season");

    // Kept as history, stamped with the season it belonged to...
    const archived = writes.find(
      (w) => w.path === `${leaguesPath}/league-1/matchupHistory/old-season_week-1`
    );
    assert.ok(archived, "the finished season's matchups must be kept as history");
    assert.equal(archived.data.seasonUid, "old-season");
    assert.equal(archived.data.worldClassMatchups.length, 1);

    // ...and MOVED, not copied. Leaving the live document in place is the bug.
    for (const week of [1, 7]) {
      assert.ok(
        writes.some(
          (w) => w.type === "delete" && w.path === `${leaguesPath}/league-1/matchups/week-${week}`
        ),
        `week-${week} must be cleared from the live collection`
      );
    }
  });

  // The Activity tab reads recaps/week-{currentWeek}. Recaps are keyed by week
  // number alone and were never reset, so for most of every week of every
  // season after the first, members were shown last season's highlights,
  // upsets and top scorer as if they had just happened.
  test("moves the finished season's weekly recaps out of the live collection", async () => {
    const docs = new Map();
    const league = leagueWithStandings(docs);
    docs.set(`${leaguesPath}/league-1/recaps/week-1`, {
      week: 1,
      highlights: [{ type: "upset", text: "Upset Alert!" }],
    });
    const { db, writes } = makeFakeDb({ leagues: [league], docs });

    await resetLeaguesForNewSeason(db, "old-season", "new-season");

    const archived = writes.find(
      (w) => w.path === `${leaguesPath}/league-1/recapHistory/old-season_week-1`
    );
    assert.ok(archived, "the finished season's recaps must be kept as history");
    assert.equal(archived.data.seasonUid, "old-season");
    assert.ok(
      writes.some(
        (w) => w.type === "delete" && w.path === `${leaguesPath}/league-1/recaps/week-1`
      ),
      "the live recap must be cleared"
    );
  });

  // Rivalries are derived from the live matchup collection, which rollover
  // empties — so a stale doc would keep displaying last season's grudges until
  // the Monday job next ran.
  test("clears detected rivalries", async () => {
    const docs = new Map();
    const league = leagueWithStandings(docs);
    const { db, writes } = makeFakeDb({ leagues: [league], docs });

    await resetLeaguesForNewSeason(db, "old-season", "new-season");

    assert.ok(
      writes.some(
        (w) => w.type === "delete" && w.path === `${leaguesPath}/league-1/meta/rivalries`
      )
    );
  });

  // The pointer names the circuit new directors are placed into, and that
  // circuit is now full of members from a season that has ended.
  test("retires the rookie-circuit pointer so new directors get a fresh one", async () => {
    const docs = new Map();
    const league = leagueWithStandings(docs);
    docs.set("game-settings/rookie-league", { leagueId: "league-1", counter: 3 });
    const { db, writes } = makeFakeDb({ leagues: [league], docs });

    await resetLeaguesForNewSeason(db, "old-season", "new-season");

    const pointerWrite = writes.find((w) => w.path === "game-settings/rookie-league");
    assert.ok(pointerWrite, "the pointer must be retired");
    assert.equal(pointerWrite.data.leagueId, null);
    // The counter survives, so circuits keep numbering upward.
    assert.equal(docs.get("game-settings/rookie-league").counter, 3);
  });

  // A pinned announcement sits above every tab. One about a season that has
  // ended is worse than none at all.
  test("unpins the commissioner's announcement", async () => {
    const docs = new Map();
    const league = leagueWithStandings(docs);
    league.data.announcement = { text: 'Draft night moved to Thursday.' };
    const { db, writes } = makeFakeDb({ leagues: [league], docs });

    await resetLeaguesForNewSeason(db, "old-season", "new-season");

    const leagueWrite = writes.find(
      (w) => w.path === `${leaguesPath}/league-1` && w.data?.seasonId === "new-season"
    );
    assert.ok(leagueWrite.data.announcement, "announcement must be explicitly cleared");
  });

  // An alternate scoring format is bought for ONE season. Clearing it here is
  // what makes it a recurring CorpsCoin sink rather than a one-time unlock, and
  // it stops a departed commissioner leaving their league on a format none of
  // the current members chose.
  test("resets the scoring format, which is bought one season at a time", async () => {
    const docs = new Map();
    const league = leagueWithStandings(docs);
    league.data.settings = {
      entryFee: 500,
      scoringFormat: "captionWars",
      scoringFormatSeasonUid: "old-season",
    };
    const { db, writes } = makeFakeDb({ leagues: [league], docs });

    await resetLeaguesForNewSeason(db, "old-season", "new-season");

    const leagueWrite = writes.find(
      (w) => w.path === `${leaguesPath}/league-1` && w.data?.seasonId === "new-season"
    );
    assert.equal(leagueWrite.data["settings.scoringFormat"], "total");
    assert.ok(
      leagueWrite.data["settings.scoringFormatSeasonUid"],
      "the season pin must be explicitly cleared"
    );
    // The rest of settings — entry fee, prize pool, finals size — is untouched.
    assert.equal(leagueWrite.data["settings.entryFee"], undefined);
  });

  test("leaves documents that are not week-N alone", async () => {
    const docs = new Map();
    const league = leagueWithStandings(docs);
    docs.set(`${leaguesPath}/league-1/matchups/notes`, { anything: true });
    const { db, writes } = makeFakeDb({ leagues: [league], docs });

    await resetLeaguesForNewSeason(db, "old-season", "new-season");

    assert.equal(
      writes.filter((w) => w.path.includes("/matchups/notes")).length,
      0
    );
  });

  test("zeroes season participation so the league goes dark until members return", async () => {
    const docs = new Map();
    const league = leagueWithStandings(docs, "league-1", ["alice", "bob", "carol"]);
    const { db, writes } = makeFakeDb({ leagues: [league], docs });

    await resetLeaguesForNewSeason(db, "old-season", "new-season");

    const update = writes.find(
      (w) => w.type === "update" && w.path === `${leaguesPath}/league-1`
    );
    assert.ok(update);
    assert.equal(update.data.seasonId, "new-season");
    assert.equal(update.data.seasonActivity.seasonUid, "new-season");
    assert.equal(update.data.seasonActivity.activeMemberCount, 0);
    assert.deepEqual(update.data.seasonActivity.activeMembers, []);
    // The roster itself is untouched — members stay members, they just are not
    // counted as playing until they set their corps up again.
    assert.equal(update.data.seasonActivity.totalMemberCount, 3);
    assert.ok(
      update.data.matchupsGeneratedWeek,
      "matchupsGeneratedWeek must be cleared so the UI stops claiming a matchup is live"
    );
  });

  test("a league that never recorded a result accumulates no history docs", async () => {
    const docs = new Map();
    const { db, writes } = makeFakeDb({
      leagues: [{ id: "empty-league", data: { name: "Empty", members: ["alice"] } }],
      docs,
    });

    await resetLeaguesForNewSeason(db, "old-season", "new-season");

    assert.equal(
      writes.filter((w) => w.path.endsWith("/standings/old-season")).length,
      0,
      "an untouched league must not write an empty history doc every season"
    );
    // It is still rolled forward, so discovery sees a zeroed block.
    assert.ok(writes.find((w) => w.type === "update" && w.path === `${leaguesPath}/empty-league`));
  });
});

describe("season rollover lease", () => {
  test("second claim after completion is rejected", async () => {
    const { db } = makeFakeDb();

    const first = await claimSeasonRollover(db, "old-season");
    assert.equal(first.claimed, true);

    await markSeasonRolloverCompleted(db, "old-season");

    const second = await claimSeasonRollover(db, "old-season");
    assert.deepEqual(second, { claimed: false, reason: "completed" });
  });

  test("rolloverFromOldSeason skips all payouts when the rollover already completed", async () => {
    const { db, writes, docs } = makeFakeDb({
      profiles: [{ uid: "alice", data: { corps: { aClass: participatingCorps() } } }],
    });
    docs.set("season_rollovers/old-season", { status: "completed" });
    const before = writes.length;

    await rolloverFromOldSeason(
      db,
      { seasonUid: "old-season", seasonName: "Old Season" },
      "new-season"
    );

    assert.equal(
      writes.length,
      before,
      "a completed rollover must not archive or pay anything again"
    );
  });
});
