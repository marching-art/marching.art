// Auth-gate regression sweep for callable Cloud Functions.
//
// Every callable in the table below is invoked via the v2 `.run()` test hook
// with NO auth context and must reject at the gate — before any Firestore or
// external API access (no fake db is injected, so reaching Firestore would
// fail with a DIFFERENT error, "no-app", and the assertion would catch it).
//
// This is the regression net for the class of bug where a callable ships
// without an auth check (it happened: searchYoutubeVideo spent billed
// YouTube API quota for anonymous callers, and getHotCorps ran Firestore
// aggregates unauthenticated until this suite was added).
//
// When adding a new callable, add it to CALLABLES below. If it is
// intentionally public, add it to PUBLIC_BY_DESIGN with a justification.
//
// Uses Node's built-in test runner (node:test). Run with `npm test`.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

// [module, exportName, expectedRejection]
// Anonymous callers are rejected "unauthenticated" everywhere: admin gates
// go through assertAdmin, which checks authentication before authorization,
// so "permission-denied" is only reachable by a logged-in non-admin.
const CALLABLES = [
  ["economy", "unlockClassWithCorpsCoin", "unauthenticated"],
  ["economy", "syncClassUnlocks", "unauthenticated"],
  ["economy", "getCorpsCoinHistory", "unauthenticated"],
  ["economy", "getEarningOpportunities", "unauthenticated"],
  ["corps", "processCorpsDecisions", "unauthenticated"],
  ["corps", "retireCorps", "unauthenticated"],
  ["corps", "transferCorps", "unauthenticated"],
  ["corps", "unretireCorps", "unauthenticated"],
  ["corps", "renameCorps", "unauthenticated"],
  ["lineups", "saveLineup", "unauthenticated"],
  ["lineups", "selectUserShows", "unauthenticated"],
  ["lineups", "saveShowConcept", "unauthenticated"],
  ["lineups", "getHotCorps", "unauthenticated"],
  ["lineups", "getLineupAnalytics", "unauthenticated"],
  ["lineups", "getActiveLineupKeys", "unauthenticated"],
  ["lineups", "validateLineup", "unauthenticated"],
  ["registerCorps", "registerCorps", "unauthenticated"],
  ["users", "setUserRole", "unauthenticated"],
  ["users", "createUserProfile", "unauthenticated"],
  ["users", "getShowRegistrations", "unauthenticated"],
  ["users", "getUserRankings", "unauthenticated"],
  ["users", "migrateUserProfiles", "unauthenticated"],
  ["users", "fixProfileFields", "unauthenticated"],
  ["profile", "updateProfile", "unauthenticated"],
  ["profile", "updateUsername", "unauthenticated"],
  ["profile", "updateEmail", "unauthenticated"],
  ["profile", "deleteAccount", "unauthenticated"],
  ["leagues", "createLeague", "unauthenticated"],
  ["leagues", "joinLeague", "unauthenticated"],
  ["leagues", "joinLeagueByCode", "unauthenticated"],
  ["leagues", "leaveLeague", "unauthenticated"],
  ["leagues", "generateMatchups", "unauthenticated"],
  ["leagues", "updateMatchupResults", "unauthenticated"],
  ["leagues", "postLeagueMessage", "unauthenticated"],
  ["leagueInvitations", "inviteDirectorToLeague", "unauthenticated"],
  ["leagueInvitations", "respondToLeagueInvitation", "unauthenticated"],
  ["leagueInvitations", "rescindLeagueInvitation", "unauthenticated"],
  ["dailyOps", "claimDailyLogin", "unauthenticated"],
  ["dailyOps", "purchaseStreakFreeze", "unauthenticated"],
  ["dailyOps", "getStreakStatus", "unauthenticated"],
];

// Callables that intentionally serve unauthenticated requests. Each entry
// documents WHY it is public so a future reader doesn't "fix" it blindly.
const PUBLIC_BY_DESIGN = {
  "users.checkUsername":
    "username availability is checked during registration, before sign-in; " +
    "validates input and reads only the public usernames lookup collection",
  "profile.getPublicProfile":
    "public profile pages are world-readable by design (mirrors the " +
    "Firestore rules' public read on profile docs)",
  "youtube.searchYoutubeVideo":
    "anonymous visitors may read the video CACHE for public Landing/Article " +
    "embeds, but only signed-in users may trigger billed API searches — " +
    "covered by dedicated behavior tests in youtube.test.js",
};

describe("callable auth gates", () => {
  for (const [moduleName, exportName, expected] of CALLABLES) {
    test(`${moduleName}.${exportName} rejects anonymous callers (${expected})`, async () => {
      const mod = require(`./${moduleName}`);
      const callable = mod[exportName];
      assert.equal(typeof callable?.run, "function", `${exportName} is not a callable`);

      await assert.rejects(
        callable.run({ data: {}, auth: null }),
        (err) => {
          assert.equal(
            err.code,
            expected,
            `${moduleName}.${exportName} rejected with '${err.code}' ` +
            `(message: ${err.message}) — expected '${expected}'. If it reached ` +
            `Firestore ('no-app') the auth gate is missing.`
          );
          return true;
        }
      );
    });
  }

  test("public-by-design list is documented and minimal", () => {
    // If a callable is meant to be public, it must be justified here.
    assert.deepEqual(Object.keys(PUBLIC_BY_DESIGN).sort(), [
      "profile.getPublicProfile",
      "users.checkUsername",
      "youtube.searchYoutubeVideo",
    ]);
    for (const justification of Object.values(PUBLIC_BY_DESIGN)) {
      assert.ok(justification.length > 20, "justify every public callable");
    }
  });
});
