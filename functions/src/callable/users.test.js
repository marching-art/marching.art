// Tests for getUserRankings' materialized-snapshot fallback behavior.
//
// The rankings snapshot (paths.seasonRankings(), rebuilt nightly by the
// lifetime-leaderboard job) goes stale at every season rollover. The old
// fallback recomputed the ranking with a full profile scan PER CALLER — a
// thundering herd of O(players) reads exactly when the whole player base
// reloads. A stale snapshot must now be served as-is (flagged `stale`); the
// scan remains only for the first-ever season, when no snapshot exists.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");

const { setDbForTesting } = require("../config");
const { getUserRankings } = require("./users");

const NS = process.env.DATA_NAMESPACE;
const RANKINGS_PATH = `artifacts/${NS}/leaderboard/season_rankings/data`;

/**
 * Fake Firestore covering what getUserRankings touches: db.doc().get() for the
 * season + snapshot docs, and the collectionGroup("profile") fallback scan.
 * `profiles` is null to make any scan throw (asserting the scan is NOT taken).
 */
function makeFakeDb(docs = new Map(), profiles = null) {
  const query = {
    where() {
      return query;
    },
    select() {
      return query;
    },
    async get() {
      if (profiles === null) {
        throw new Error("unexpected profile scan: the snapshot should have been served");
      }
      return {
        empty: profiles.length === 0,
        docs: profiles.map(({ uid, data }) => ({
          data: () => data,
          ref: { parent: { parent: { id: uid } } },
        })),
      };
    },
  };

  return {
    doc: (path) => ({
      path,
      async get() {
        const data = docs.get(path);
        return { exists: data !== undefined, data: () => data };
      },
    }),
    collectionGroup: () => query,
  };
}

const authedRequest = (uid) => ({ data: {}, auth: { uid, token: {} } });

describe("getUserRankings snapshot fallback", () => {
  beforeEach(() => setDbForTesting(null));
  after(() => setDbForTesting(null));

  test("serves a current-season snapshot without a scan (and without a stale flag)", async () => {
    const docs = new Map([
      ["game-settings/season", { seasonUid: "season-2" }],
      [RANKINGS_PATH, {
        seasonUid: "season-2",
        totalPlayers: 3,
        ranks: { u1: { rank: 2, totalScore: 55 } },
      }],
    ]);
    setDbForTesting(makeFakeDb(docs));

    const result = await getUserRankings.run(authedRequest("u1"));

    assert.deepEqual(result, { globalRank: 2, totalPlayers: 3, totalScore: 55 });
    assert.ok(!("stale" in result));
  });

  test("serves a PREVIOUS season's snapshot flagged stale instead of scanning per caller", async () => {
    const docs = new Map([
      ["game-settings/season", { seasonUid: "season-2" }],
      [RANKINGS_PATH, {
        seasonUid: "season-1",
        totalPlayers: 4,
        ranks: { u1: { rank: 3, totalScore: 40 } },
      }],
    ]);
    setDbForTesting(makeFakeDb(docs));

    const result = await getUserRankings.run(authedRequest("u1"));

    assert.deepEqual(result, { globalRank: 3, totalPlayers: 4, totalScore: 40, stale: true });
  });

  test("a caller missing from a stale snapshot ranks at the bottom, still without a scan", async () => {
    const docs = new Map([
      ["game-settings/season", { seasonUid: "season-2" }],
      [RANKINGS_PATH, {
        seasonUid: "season-1",
        totalPlayers: 4,
        ranks: { other: { rank: 1, totalScore: 90 } },
      }],
    ]);
    setDbForTesting(makeFakeDb(docs));

    const result = await getUserRankings.run(authedRequest("u1"));

    assert.deepEqual(result, { globalRank: 4, totalPlayers: 4, totalScore: 0, stale: true });
  });

  test("falls back to the scan only when NO snapshot exists (first-ever season)", async () => {
    const docs = new Map([
      ["game-settings/season", { seasonUid: "season-1" }],
    ]);
    const profiles = [
      { uid: "u1", data: { corps: { worldClass: { totalSeasonScore: 10 } } } },
      { uid: "u2", data: { corps: { worldClass: { totalSeasonScore: 20 } } } },
    ];
    setDbForTesting(makeFakeDb(docs, profiles));

    const result = await getUserRankings.run(authedRequest("u1"));

    assert.deepEqual(result, { globalRank: 2, totalPlayers: 2, totalScore: 10 });
  });
});
