// Unit tests for the Firestore path builders. Uses Node's built-in test runner.
// These assert the produced strings byte-for-byte so the helper can never
// silently drift from the literal paths it replaced.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

// The builders read DATA_NAMESPACE via dataNamespaceParam.value(); set it first.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";
const NS = process.env.DATA_NAMESPACE;

const { paths } = require("./paths");

describe("paths (users)", () => {
  test("user document and profile", () => {
    assert.equal(paths.users(), `artifacts/${NS}/users`);
    assert.equal(paths.user("u1"), `artifacts/${NS}/users/u1`);
    assert.equal(paths.userProfile("u1"), `artifacts/${NS}/users/u1/profile/data`);
    assert.equal(paths.userPrivate("u1"), `artifacts/${NS}/users/u1/private/data`);
  });

  test("user subcollections", () => {
    assert.equal(paths.userCorps("u1", "worldClass"), `artifacts/${NS}/users/u1/corps/worldClass`);
    assert.equal(paths.userCorpsCoinHistory("u1"), `artifacts/${NS}/users/u1/corpsCoinHistory`);
    assert.equal(paths.userNotifications("u1"), `artifacts/${NS}/users/u1/notifications`);
    assert.equal(
      paths.userLeagueNotifications("u1"),
      `artifacts/${NS}/users/u1/notifications/leagues`
    );
    assert.equal(paths.userEmailLog("u1"), `artifacts/${NS}/users/u1/email_log`);
    assert.equal(paths.userComment("u1", "c9"), `artifacts/${NS}/users/u1/comments/c9`);
    assert.equal(paths.userPodiumState("u1"), `artifacts/${NS}/users/u1/podium/state`);
    assert.equal(paths.userPodiumCareer("u1"), `artifacts/${NS}/users/u1/podium/career`);
  });
});

describe("paths (leaderboard + leagues)", () => {
  test("leaderboard", () => {
    assert.equal(paths.lifetimeLeaderboard("weekly"), `artifacts/${NS}/leaderboard/lifetime_weekly`);
  });

  test("leagues and subcollections", () => {
    assert.equal(paths.leagues(), `artifacts/${NS}/leagues`);
    assert.equal(paths.league("lg1"), `artifacts/${NS}/leagues/lg1`);
    assert.equal(paths.leagueStandings("lg1"), `artifacts/${NS}/leagues/lg1/standings/current`);
    assert.equal(paths.leagueActivity("lg1"), `artifacts/${NS}/leagues/lg1/activity`);
    assert.equal(paths.leagueMatchups("lg1"), `artifacts/${NS}/leagues/lg1/matchups`);
    assert.equal(paths.leagueMatchupWeek("lg1", 3), `artifacts/${NS}/leagues/lg1/matchups/week-3`);
    assert.equal(paths.leagueWeekRecap("lg1", 3), `artifacts/${NS}/leagues/lg1/recaps/week-3`);
    assert.equal(paths.leagueMeta("lg1", "rivalries"), `artifacts/${NS}/leagues/lg1/meta/rivalries`);
  });

  test("league invitations", () => {
    assert.equal(paths.leagueInvitations(), `artifacts/${NS}/leagueInvitations`);
    assert.equal(paths.leagueInvitation("inv1"), `artifacts/${NS}/leagueInvitations/inv1`);
  });
});
