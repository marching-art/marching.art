// Behavior tests for the season-rollover pipeline:
//
// 1. The participation gate in archiveAndResetProfiles — ONE definition of
//    "participated" (competed in ≥1 show or carries points) gates rankings,
//    completion XP, the finish bonus, the recap line, AND
//    lifetimeStats.totalSeasons. Regression: the award gate used to be
//    `lineup || score>0` while totalSeasons required shows, so a lineup-only
//    corps was paid completion XP but never advanced totalSeasons — which
//    also blocked the finish_season journey step and would silently deny the
//    seasons-completed class unlock.
//
// 2. archiveSeasonResultsLogic — league champion archival + prize-pool
//    payout, now invoked automatically at rollover with the OLD season passed
//    in (it used to read game-settings/season, which already holds the new
//    season at that point). Idempotent per league via champions[].
//
// 3. The season_rollovers lease — a forced double season-start cannot re-pay
//    finish bonuses or re-increment totalSeasons.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  archiveAndResetProfiles,
  archiveSeasonResultsLogic,
  rolloverFromOldSeason,
  corpsParticipatedThisSeason,
} = require("./season");
const {
  claimSeasonRollover,
  markSeasonRolloverCompleted,
} = require("./scoringRunGuard");
const { RARITY_CC } = require("./achievements");

const NS = process.env.DATA_NAMESPACE;
const profilePath = (uid) => `artifacts/${NS}/users/${uid}/profile/data`;
const leaguesPath = `artifacts/${NS}/leagues`;

/**
 * Fake Firestore covering what the rollover pipeline touches:
 * collectionGroup("profile").where().get(), collection().get()/.where().get()/
 * .doc(), db.doc().get()/.set(), db.batch(), db.runTransaction() (for the
 * rollover lease). Docs live in a Map so transactional writes are visible to
 * later reads (the lease test depends on that).
 */
function makeFakeDb({ profiles = [], leagues = [], docs = new Map() } = {}) {
  const writes = [];
  let autoId = 0;

  const makeDocRef = (path) => ({
    path,
    id: path.split("/").pop(),
    // profile docs live at artifacts/{ns}/users/{uid}/profile/data —
    // parent.parent is the uid doc, matching production refs.
    parent: { parent: { id: path.split("/")[3] } },
    async get() {
      return {
        exists: docs.has(path),
        data: () => docs.get(path),
        ref: makeDocRef(path),
      };
    },
    async set(data, options) {
      if (options?.merge && docs.has(path)) {
        docs.set(path, { ...docs.get(path), ...data });
      } else {
        docs.set(path, data);
      }
      writes.push({ type: "docSet", path, data, options });
    },
  });

  const makeQuery = (items) => ({
    async get() {
      return {
        empty: items.length === 0,
        size: items.length,
        docs: items,
      };
    },
    where() {
      return makeQuery(items);
    },
    limit() {
      return makeQuery(items);
    },
  });

  const db = {
    doc(path) {
      return makeDocRef(path);
    },
    collection(path) {
      const items =
        path === leaguesPath
          ? leagues.map((l) => ({
              id: l.id,
              ref: makeDocRef(`${leaguesPath}/${l.id}`),
              data: () => l.data,
            }))
          : [];
      return {
        ...makeQuery(items),
        doc(id) {
          return makeDocRef(`${path}/${id ?? `auto-${++autoId}`}`);
        },
        async listDocuments() {
          return [];
        },
      };
    },
    collectionGroup(name) {
      const items =
        name === "profile"
          ? profiles.map((p) => ({
              ref: makeDocRef(profilePath(p.uid)),
              data: () => p.data,
            }))
          : [];
      return makeQuery(items);
    },
    batch() {
      return {
        set(ref, data, options) {
          writes.push({ type: "set", path: ref.path, data, options });
        },
        update(ref, data) {
          writes.push({ type: "update", path: ref.path, data });
        },
        delete(ref) {
          writes.push({ type: "delete", path: ref.path });
        },
        async commit() {},
      };
    },
    async runTransaction(fn) {
      return fn({
        get: (ref) => ref.get(),
        set: (ref, data) => {
          docs.set(ref.path, data);
          writes.push({ type: "txnSet", path: ref.path, data });
        },
        update: (ref, data) => {
          docs.set(ref.path, { ...(docs.get(ref.path) || {}), ...data });
          writes.push({ type: "txnUpdate", path: ref.path, data });
        },
      });
    },
  };

  return { db, writes, docs };
}

const participatingCorps = (score = 85) => ({
  corpsName: "The Regulars",
  lineup: { GE1: "Blue Devils|2024" },
  selectedShows: { 1: ["show-a"] },
  weeklyScores: { 1: score },
  totalSeasonScore: score,
});

const lineupOnlyCorps = () => ({
  corpsName: "The Ghosts",
  lineup: { GE1: "Phantom Regiment|2024" },
  selectedShows: {},
  weeklyScores: {},
  totalSeasonScore: 0,
});

describe("corpsParticipatedThisSeason", () => {
  test("competing or scoring counts; a lineup alone does not", () => {
    assert.equal(corpsParticipatedThisSeason(participatingCorps()), true);
    assert.equal(corpsParticipatedThisSeason(lineupOnlyCorps()), false);
    assert.equal(corpsParticipatedThisSeason({}), false);
  });
});

describe("archiveAndResetProfiles participation gate", () => {
  test("participating corps earns awards and bumps totalSeasons; lineup-only corps is archived unpaid", async () => {
    const { db, writes } = makeFakeDb({
      profiles: [
        {
          uid: "alice",
          data: {
            xp: 100,
            corps: {
              worldClass: participatingCorps(90),
              aClass: lineupOnlyCorps(),
            },
          },
        },
      ],
    });

    await archiveAndResetProfiles(db, "old-season", "new-season");

    const profileWrite = writes.find(
      (w) => w.type === "update" && w.path === profilePath("alice")
    );
    assert.ok(profileWrite, "profile should be archived/reset");
    const update = profileWrite.data;

    // Participation counted exactly once (worldClass competed, aClass did not)
    assert.equal(update.lifetimeStats.totalSeasons, 1);

    // Awards: only the participating corps appears in the recap
    assert.equal(update.pendingSeasonRecap.results.length, 1);
    assert.equal(update.pendingSeasonRecap.results[0].corpsClass, "worldClass");

    // Completion XP paid for the participant only: placement 1 → top10 (500),
    // written as an INCREMENT so XP earned concurrently between the profile
    // snapshot and the chunked batch commit is never clobbered.
    assert.equal(update.xp.operand, 500);
    assert.equal(update.xp.constructor.name, "NumericIncrementTransform");

    // Champion finish bonus (placement 1 → 1000 CC) via increment
    assert.ok(update.corpsCoin, "finish bonus should be paid");

    // The lineup-only corps is still archived to seasonHistory (history,
    // not a reward) with no placement, and reset for the new season
    const ghostHistory = update.corps.aClass.seasonHistory;
    assert.equal(ghostHistory.length, 1);
    assert.equal(ghostHistory[0].placement, null);
    assert.equal(update.corps.aClass.lineup, null);
  });

  test("a profile with only a lineup-only corps earns nothing and totalSeasons stays flat", async () => {
    const { db, writes } = makeFakeDb({
      profiles: [
        {
          uid: "bob",
          data: { xp: 50, corps: { aClass: lineupOnlyCorps() } },
        },
      ],
    });

    await archiveAndResetProfiles(db, "old-season", "new-season");

    const update = writes.find(
      (w) => w.type === "update" && w.path === profilePath("bob")
    ).data;

    assert.equal(update.lifetimeStats.totalSeasons, 0);
    assert.equal(update.pendingSeasonRecap, undefined);
    assert.equal(update.xp, undefined, "no completion XP for a corps that never competed");
    assert.equal(update.corpsCoin, undefined);
    // ...but the season is still archived as history
    assert.equal(update.corps.aClass.seasonHistory.length, 1);
  });

  test("completing season 1 unlocks A Class in the same archival write (the graduation)", async () => {
    const { db, writes } = makeFakeDb({
      profiles: [
        {
          uid: "alice",
          data: {
            xp: 100,
            unlockedClasses: ["soundSport"],
            lifetimeStats: { totalSeasons: 0 },
            corps: { soundSport: participatingCorps(80) },
          },
        },
      ],
    });

    await archiveAndResetProfiles(db, "old-season", "new-season");

    const update = writes.find(
      (w) => w.type === "update" && w.path === profilePath("alice")
    ).data;
    assert.equal(update.lifetimeStats.totalSeasons, 1);
    assert.ok(
      update.unlockedClasses?.includes("aClass"),
      "season-1 completion must unlock A Class in this same write"
    );
    assert.equal(update["classUnlockPaths.aClass"], "seasons");
  });

  test("the recap flags a new personal-best season", async () => {
    const { db, writes } = makeFakeDb({
      profiles: [
        {
          uid: "alice",
          data: {
            lifetimeStats: { totalSeasons: 2, bestSeasonScore: 85 },
            corps: { worldClass: participatingCorps(90) }, // beats her 85
          },
        },
        {
          uid: "bob",
          data: {
            lifetimeStats: { totalSeasons: 2, bestSeasonScore: 95 },
            corps: { worldClass: participatingCorps(88) }, // short of his 95
          },
        },
      ],
    });

    await archiveAndResetProfiles(db, "old-season", "new-season");

    const recapFor = (uid) =>
      writes.find((w) => w.type === "update" && w.path === profilePath(uid)).data
        .pendingSeasonRecap.results[0];
    assert.equal(recapFor("alice").newBestSeason, true);
    assert.equal(recapFor("bob").newBestSeason, false);
  });

  test("lineup-only corps occupies no rank slot", async () => {
    const { db, writes } = makeFakeDb({
      profiles: [
        { uid: "alice", data: { corps: { aClass: participatingCorps(70) } } },
        { uid: "bob", data: { corps: { aClass: lineupOnlyCorps() } } },
      ],
    });

    await archiveAndResetProfiles(db, "old-season", "new-season");

    const aliceRecap = writes.find(
      (w) => w.type === "update" && w.path === profilePath("alice")
    ).data.pendingSeasonRecap;
    assert.equal(aliceRecap.results[0].placement, 1);
    assert.equal(
      aliceRecap.results[0].totalInClass,
      1,
      "the never-competed corps must not inflate the class size"
    );
  });
});

describe("archiveSeasonResultsLogic", () => {
  const leagueMembers = ["alice", "bob"];
  const makeLeagueFixture = (leagueData = {}) =>
    makeFakeDb({
      leagues: [
        {
          id: "league-1",
          data: {
            name: "Test League",
            members: leagueMembers,
            settings: { prizePool: 500 },
            ...leagueData,
          },
        },
      ],
      docs: new Map([
        [
          profilePath("alice"),
          {
            activeSeasonId: "old-season",
            username: "alice",
            corps: { worldClass: { corpsName: "A Corps", totalSeasonScore: 90 } },
          },
        ],
        [
          profilePath("bob"),
          {
            activeSeasonId: "old-season",
            username: "bob",
            corps: { worldClass: { corpsName: "B Corps", totalSeasonScore: 80 } },
          },
        ],
      ]),
    });

  test("archives the champion for the PASSED-IN season and pays pool + achievement CC", async () => {
    const { db, writes } = makeLeagueFixture();

    await archiveSeasonResultsLogic(db, {
      seasonUid: "old-season",
      seasonName: "Old Season",
    });

    // Champion entry records the season id (the idempotency key)
    const leagueWrite = writes.find((w) => w.path === `${leaguesPath}/league-1`);
    assert.ok(leagueWrite, "league champions should be updated");

    // Winner (alice, higher score) gets the catalog-shaped achievement + CC.
    // The id is keyed per league AND season so multi-league champions earn
    // distinct achievements instead of duplicate entries under one id.
    const achievementWrite = writes.find(
      (w) => w.path === profilePath("alice") && w.data?.achievements
    );
    assert.ok(achievementWrite, "winner should receive the achievement");
    assert.ok(
      JSON.stringify(achievementWrite.data.achievements).includes(
        "league_champion_league-1_old-season"
      ),
      "achievement id must be keyed per league + season"
    );
    assert.ok(
      achievementWrite.data.corpsCoin,
      "achievement CC should be paid with the achievement"
    );

    // Prize pool paid to the winner, never the runner-up
    const poolWrite = writes.find(
      (w) => w.path === profilePath("alice") && w.data?.corpsCoin && !w.data?.achievements
    );
    assert.ok(poolWrite, "prize pool should be paid to the winner");

    // The escrow is drained in the same batch — without this the same pool
    // would be re-minted to every future season's champion.
    const drainWrite = writes.find(
      (w) => w.path === `${leaguesPath}/league-1` && w.data?.["settings.prizePool"]
    );
    assert.ok(drainWrite, "prize pool must be drained on payout");
    assert.equal(drainWrite.data["settings.prizePool"].operand, -500);
    const bobPayout = writes.find(
      (w) => w.path === profilePath("bob") && w.data?.corpsCoin
    );
    assert.equal(bobPayout, undefined);

    // Coin history: achievement CC + prize pool
    const historyWrites = writes.filter((w) =>
      w.path.startsWith(`artifacts/${NS}/users/alice/corpsCoinHistory/`)
    );
    const historyTypes = historyWrites.map((w) => w.data.type).sort();
    assert.deepEqual(historyTypes, ["achievement", "league_win"]);
    const achievementHistory = historyWrites.find((w) => w.data.type === "achievement");
    assert.equal(achievementHistory.data.amount, RARITY_CC.legendary);

    // Both members are notified
    const notifications = writes.filter((w) => w.path.includes("/notifications/"));
    assert.equal(notifications.length, 2);
  });

  test("skips a league whose champion for this season is already recorded", async () => {
    const { db, writes } = makeLeagueFixture({
      champions: [{ seasonId: "old-season", winnerId: "alice" }],
    });

    await archiveSeasonResultsLogic(db, {
      seasonUid: "old-season",
      seasonName: "Old Season",
    });

    assert.equal(writes.length, 0, "an already-archived league must not be re-paid");
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
