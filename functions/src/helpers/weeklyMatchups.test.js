// Behavior tests for processWeeklyMatchups — the automated weekly
// winner/reward path that runs at the end of each scored week.
//
// Regression: this helper used to read the root-level `leagues` collection
// and `week${N}` doc ids while the matchup writers (callable/leagues.js,
// scheduled/leagueAutomation.js) write `artifacts/{ns}/leagues/.../week-N`,
// so winner determination silently processed zero leagues and the
// advertised weekly-win CorpsCoin bonus never paid. These tests pin the
// namespaced paths and the reward writes.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const admin = require("firebase-admin");
const { processWeeklyMatchups, payWeeklyParticipationXP } = require("./scoringAwards");
const { WEEKLY_LEAGUE_WIN_REWARD } = require("../callable/economy");
const { XP_SOURCES } = require("./xpCalculations");

const NS = process.env.DATA_NAMESPACE;
const profilePath = (uid) => `artifacts/${NS}/users/${uid}/profile/data`;
const leaguesPath = `artifacts/${NS}/leagues`;

/**
 * Fake Firestore covering what processWeeklyMatchups touches:
 * collection().limit().get() for leagues, db.doc(), db.getAll(), and
 * batched set/update via the ChunkedWriter (which uses db.batch()).
 */
function makeFakeDb({ leagues = [], docs = new Map() } = {}) {
  const writes = [];
  let autoId = 0;

  const makeDocRef = (path) => ({
    path,
    id: path.split("/").pop(),
  });

  const db = {
    doc(path) {
      return makeDocRef(path);
    },
    collection(path) {
      return {
        limit() {
          return {
            async get() {
              if (path !== leaguesPath) {
                // Any other collection (e.g. the old root `leagues`) is empty —
                // exactly how the path bug failed silently in production.
                return { docs: [], size: 0 };
              }
              return {
                size: leagues.length,
                docs: leagues.map((l) => ({
                  id: l.id,
                  ref: makeDocRef(`${leaguesPath}/${l.id}`),
                  data: () => l.data,
                })),
              };
            },
          };
        },
        doc() {
          return makeDocRef(`${path}/auto-${++autoId}`);
        },
      };
    },
    async getAll(...refs) {
      return refs.map((ref) => ({
        ref,
        exists: docs.has(ref.path),
        data: () => docs.get(ref.path),
      }));
    },
    batch() {
      return {
        set(ref, data, options) {
          writes.push({ type: "set", path: ref.path, data, options });
        },
        update(ref, data) {
          writes.push({ type: "update", path: ref.path, data });
        },
        async commit() {},
      };
    },
  };

  return { db, writes };
}

const seasonData = { seasonUid: "season-1" };

describe("processWeeklyMatchups", () => {
  test("reads namespaced league and week-N matchup paths", async () => {
    const docs = new Map([
      [
        `${leaguesPath}/league-1/matchups/week-3`,
        {
          worldClassMatchups: [{ pair: ["alice", "bob"] }],
        },
      ],
      [profilePath("alice"), { corps: { worldClass: { totalSeasonScore: 90 } } }],
      [profilePath("bob"), { corps: { worldClass: { totalSeasonScore: 80 } } }],
    ]);
    const { db, writes } = makeFakeDb({
      leagues: [{ id: "league-1", data: { name: "Test League" } }],
      docs,
    });

    await processWeeklyMatchups(3, seasonData, db);

    // Winner resolution happened: alice gets a W, bob an L
    const recordWrites = writes.filter((w) => w.data?.["seasons.season-1.records.worldClass"]);
    assert.equal(recordWrites.length, 2);

    // The matchup doc itself was updated with scores + winner
    const matchupWrite = writes.find((w) => w.path === `${leaguesPath}/league-1/matchups/week-3`);
    assert.ok(matchupWrite, "matchup doc should be updated at the week-N path");
    const resolved = matchupWrite.data.worldClassMatchups[0];
    assert.equal(resolved.winner, "alice");
    assert.deepEqual(resolved.scores, { alice: 90, bob: 80 });
  });

  test("pays the weekly-win bonus and bumps stats.leagueWins for the winner", async () => {
    const docs = new Map([
      [
        `${leaguesPath}/league-1/matchups/week-3`,
        { aClassMatchups: [{ pair: ["alice", "bob"] }] },
      ],
      [profilePath("alice"), { corps: { aClass: { totalSeasonScore: 70 } } }],
      [profilePath("bob"), { corps: { aClass: { totalSeasonScore: 60 } } }],
    ]);
    const { db, writes } = makeFakeDb({
      leagues: [{ id: "league-1", data: { name: "Test League" } }],
      docs,
    });

    await processWeeklyMatchups(3, seasonData, db);

    const rewardWrite = writes.find(
      (w) => w.path === profilePath("alice") && w.data?.corpsCoin !== undefined
    );
    assert.ok(rewardWrite, "winner should receive a corpsCoin write");
    assert.ok(rewardWrite.data.stats?.leagueWins, "winner should get a leagueWins increment");
    assert.ok(
      rewardWrite.data.xp?.isEqual(admin.firestore.FieldValue.increment(XP_SOURCES.leagueWin)),
      "winner should get the league-win XP increment"
    );

    const historyWrite = writes.find(
      (w) => w.path.startsWith(`artifacts/${NS}/users/alice/`) && w.data?.type === "league_win"
    );
    assert.ok(historyWrite, "winner should get a league_win history entry");
    assert.equal(historyWrite.data.amount, WEEKLY_LEAGUE_WIN_REWARD);

    // Loser gets no reward
    const loserReward = writes.find(
      (w) => w.path === profilePath("bob") && w.data?.corpsCoin !== undefined
    );
    assert.equal(loserReward, undefined);
  });

  test("ties and byes award nothing", async () => {
    const docs = new Map([
      [
        `${leaguesPath}/league-1/matchups/week-3`,
        {
          openClassMatchups: [
            { pair: ["alice", "bob"] }, // tie
            { pair: ["carol", null] }, // bye
          ],
        },
      ],
      [profilePath("alice"), { corps: { openClass: { totalSeasonScore: 50 } } }],
      [profilePath("bob"), { corps: { openClass: { totalSeasonScore: 50 } } }],
      [profilePath("carol"), { corps: { openClass: { totalSeasonScore: 40 } } }],
    ]);
    const { db, writes } = makeFakeDb({
      leagues: [{ id: "league-1", data: { name: "Test League" } }],
      docs,
    });

    await processWeeklyMatchups(3, seasonData, db);

    const rewardWrites = writes.filter((w) => w.data?.corpsCoin !== undefined);
    assert.equal(rewardWrites.length, 0);
  });
});

// Weekly-participation XP — the "compete in the weekly shows" earner that was
// advertised in XP_SOURCES but never paid (awardXP had no callers). Paid at
// the week boundary from the week's committed recap docs, once per
// participating class.
describe("payWeeklyParticipationXP", () => {
  const recapDayPath = (day) => `fantasy_recaps/season-1/days/${day}`;
  const recapWithResults = (results) => ({
    offSeasonDay: 0,
    shows: [{ eventName: "Test Show", results }],
  });

  test("pays once per participating class across the week's recaps", async () => {
    const docs = new Map([
      // alice competes twice in worldClass (still one grant) and once in aClass
      [recapDayPath(15), recapWithResults([
        { uid: "alice", corpsClass: "worldClass" },
        { uid: "bob", corpsClass: "soundSport" },
      ])],
      [recapDayPath(17), recapWithResults([
        { uid: "alice", corpsClass: "worldClass" },
        { uid: "alice", corpsClass: "aClass" },
      ])],
    ]);
    const { db, writes } = makeFakeDb({ docs });

    await payWeeklyParticipationXP(3, seasonData, db);

    const aliceWrite = writes.find((w) => w.path === profilePath("alice"));
    assert.ok(aliceWrite, "alice should receive an XP write");
    assert.ok(
      aliceWrite.data.xp.isEqual(
        admin.firestore.FieldValue.increment(XP_SOURCES.weeklyParticipation * 2)
      ),
      "alice competed in two classes → two grants in one increment"
    );

    const bobWrite = writes.find((w) => w.path === profilePath("bob"));
    assert.ok(bobWrite, "bob should receive an XP write");
    assert.ok(
      bobWrite.data.xp.isEqual(
        admin.firestore.FieldValue.increment(XP_SOURCES.weeklyParticipation)
      ),
      "bob competed in one class → one grant"
    );

    // Exactly one write per director — no per-show double-pay.
    assert.equal(writes.filter((w) => w.path === profilePath("alice")).length, 1);
  });

  test("reads exactly the week's seven day docs", async () => {
    const requested = [];
    const { db } = makeFakeDb({ docs: new Map() });
    const origGetAll = db.getAll.bind(db);
    db.getAll = async (...refs) => {
      requested.push(...refs.map((r) => r.path));
      return origGetAll(...refs);
    };

    await payWeeklyParticipationXP(2, seasonData, db);

    assert.deepEqual(
      requested,
      [8, 9, 10, 11, 12, 13, 14].map((d) => recapDayPath(d))
    );
  });

  test("pays nothing when the week has no participants", async () => {
    const { db, writes } = makeFakeDb({
      docs: new Map([[recapDayPath(7), recapWithResults([])]]),
    });

    await payWeeklyParticipationXP(1, seasonData, db);

    assert.equal(writes.length, 0);
  });
});
