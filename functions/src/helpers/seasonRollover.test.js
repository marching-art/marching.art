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
  resetLeaguesForNewSeason,
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
    // resetLeaguesForNewSeason reaches leagues/{id}/standings/{docId} and
    // leagues/{id}/matchups through the league ref, the same way createLeague
    // and joinLeague do.
    collection(sub) {
      const prefix = `${path}/${sub}/`;
      return {
        doc: (id) => makeDocRef(`${prefix}${id ?? `auto-${++autoId}`}`),
        async get() {
          const found = [...docs.keys()]
            .filter((key) => key.startsWith(prefix) && !key.slice(prefix.length).includes("/"))
            .map((key) => ({
              id: key.slice(prefix.length),
              ref: makeDocRef(key),
              data: () => docs.get(key),
            }));
          return { empty: found.length === 0, size: found.length, docs: found };
        },
      };
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

    // The heavy lineup / show-pick fields are split OFF the summary rows onto
    // seasonDetail docs, so the hot profile document never carries them.
    const wcSummary = update.corps.worldClass.seasonHistory[0];
    assert.equal(wcSummary.lineup, undefined, "lineup must not be on the summary row");
    assert.equal(wcSummary.selectedShows, undefined);
    assert.equal(wcSummary.weeklyScores, undefined);
    assert.equal(wcSummary.weeks, 1, "summary keeps a weeks count for the timeline");
    // ...but the summary keeps what the chart / rating / aggregates read.
    assert.equal(wcSummary.placement, 1);
    assert.equal(wcSummary.totalSeasonScore, 90);

    const wcDetail = writes.find(
      (w) =>
        w.type === "set" &&
        w.path === `artifacts/${NS}/users/alice/seasonDetail/old-season__worldClass`
    );
    assert.ok(wcDetail, "a seasonDetail doc is written for the competing corps");
    assert.deepEqual(wcDetail.data.lineup, { GE1: "Blue Devils|2024" });
    assert.deepEqual(wcDetail.data.selectedShows, { 1: ["show-a"] });
    assert.equal(wcDetail.data.corpsClass, "worldClass");

    // The lineup-only corps still gets a detail doc (its lineup is history too).
    const aDetail = writes.find(
      (w) =>
        w.type === "set" &&
        w.path === `artifacts/${NS}/users/alice/seasonDetail/old-season__aClass`
    );
    assert.ok(aDetail, "a seasonDetail doc is written for the lineup-only corps");
    assert.deepEqual(aDetail.data.lineup, { GE1: "Phantom Regiment|2024" });
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

  test("picking shows all season without ever competing earns nothing", async () => {
    // The regression the championship-week rehearsal found. Selecting shows
    // requires no lineup (callable/lineups.js selectUserShows) while scoring
    // skips any corps whose lineup is incomplete (helpers/scoring.js), so this
    // director registered, saved picks for all seven weeks, never finished
    // their eight captions, and never appeared in a single recap.
    //
    // The old gate was `Object.keys(selectedShows).length > 0` — weeks with
    // picks, not shows competed — so this profile was paid the finish bonus,
    // granted completion XP, and credited a season against the class unlock.
    const pickedButNeverScored = () => ({
      corpsName: "The No-Shows",
      lineup: { GE1: "Blue Devils|2024" }, // seven of eight captions: incomplete
      selectedShows: {
        week1: ["show-a"],
        week2: ["show-b"],
        week3: ["show-c"],
        week4: ["show-d"],
        week5: ["show-e"],
        week6: ["show-f"],
        week7: ["show-g"],
      },
      weeklyScores: {},
      totalSeasonScore: 0,
    });

    const { db, writes } = makeFakeDb({
      profiles: [{ uid: "carol", data: { xp: 50, corps: { worldClass: pickedButNeverScored() } } }],
    });

    await archiveAndResetProfiles(db, "old-season", "new-season");

    const update = writes.find(
      (w) => w.type === "update" && w.path === profilePath("carol")
    ).data;

    assert.equal(update.lifetimeStats.totalSeasons, 0, "a season nobody competed in is not a season completed");
    assert.equal(update.lifetimeStats.totalShows, 0, "weeks with picks are not shows attended");
    assert.equal(update.xp, undefined, "no completion XP");
    assert.equal(update.corpsCoin, undefined, "no finish bonus");
    assert.equal(update.pendingSeasonRecap, undefined, "no season recap to show");
    // Still archived as history, with an honest zero.
    const history = update.corps.worldClass.seasonHistory;
    assert.equal(history.length, 1);
    assert.equal(history[0].showsAttended, 0);
    assert.equal(history[0].placement, null);
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

describe("archiveAndResetProfiles career bests", () => {
  // A profile carrying a PARTIAL lifetimeStats skipped the whole-object
  // fallback, and `Math.max(undefined, n)` is NaN. Once a career best is NaN it
  // stays NaN forever, the profile renders NaN, and the lifetime leaderboard
  // (which coalesces with `|| 0`) reads it as zero — the two disagree
  // permanently. Found by the championship-week rehearsal.
  test("a partial lifetimeStats does not poison the career bests with NaN", async () => {
    const { db, writes } = makeFakeDb({
      profiles: [
        {
          uid: "partial",
          data: {
            // Every field but the two the archival maxes against.
            lifetimeStats: { totalSeasons: 3 },
            corps: { worldClass: participatingCorps(90) },
          },
        },
      ],
    });

    await archiveAndResetProfiles(db, "old-season", "new-season");

    const update = writes.find(
      (w) => w.type === "update" && w.path === profilePath("partial")
    ).data;

    assert.equal(Number.isNaN(update.lifetimeStats.bestSeasonScore), false);
    assert.equal(Number.isNaN(update.lifetimeStats.bestWeeklyScore), false);
    assert.equal(update.lifetimeStats.bestSeasonScore, 90);
    // The fields that WERE present are carried, not reset by the defaults.
    assert.equal(update.lifetimeStats.totalSeasons, 4);
  });

  test("a stored null career best is coalesced, not maxed against", async () => {
    const { db, writes } = makeFakeDb({
      profiles: [
        {
          uid: "nulled",
          data: {
            lifetimeStats: { totalSeasons: 1, bestSeasonScore: null, bestWeeklyScore: null },
            corps: { worldClass: participatingCorps(77) },
          },
        },
      ],
    });

    await archiveAndResetProfiles(db, "old-season", "new-season");

    const update = writes.find(
      (w) => w.type === "update" && w.path === profilePath("nulled")
    ).data;

    assert.equal(update.lifetimeStats.bestSeasonScore, 77);
    assert.equal(Number.isNaN(update.lifetimeStats.bestWeeklyScore), false);
  });
});

describe("archiveSeasonResultsLogic", () => {
  const leagueMembers = ["alice", "bob"];
  const makeLeagueFixture = (leagueData = {}, extraDocs = null) =>
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
        // The champion comes from the STANDINGS now (helpers/leagueChampion.js).
        // It used to be whoever had the biggest corps.*.totalSeasonScore sum —
        // a sum of each corps' LAST show score — so a 7-0 director could lose
        // their own league to a 2-5 one who peaked on the final night.
        [
          `${leaguesPath}/league-1/standings/current`,
          {
            standings: [
              { uid: "alice", wins: 3, losses: 0, ties: 0, totalPoints: 270, pointsAgainst: 240 },
              { uid: "bob", wins: 0, losses: 3, ties: 0, totalPoints: 240, pointsAgainst: 270 },
            ],
          },
        ],
        ...(extraDocs || []),
      ]),
    });

  // A league of twenty with a field of twelve used to leave eight directors
  // with nothing to play for the moment they were mathematically out. The
  // consolation title is the same race on the same week — recognition only, so
  // it moves no CorpsCoin and never touches the prize pool.
  test("records the consolation title alongside the champion", async () => {
    const { db, writes } = makeLeagueFixture(
      { members: ["alice", "bob", "carol", "dave"], settings: { finalsSize: 2 } },
      [
        [
          profilePath("carol"),
          { activeSeasonId: "old-season", username: "carol", corps: { worldClass: { corpsName: "C" } } },
        ],
        [
          profilePath("dave"),
          { activeSeasonId: "old-season", username: "dave", corps: { worldClass: { corpsName: "D" } } },
        ],
        [
          `${leaguesPath}/league-1/standings/current`,
          {
            standings: [
              { uid: "alice", wins: 3, losses: 0, ties: 0, totalPoints: 270, pointsAgainst: 240 },
              { uid: "bob", wins: 2, losses: 1, ties: 0, totalPoints: 260, pointsAgainst: 250 },
              { uid: "carol", wins: 1, losses: 2, ties: 0, totalPoints: 250, pointsAgainst: 260 },
              { uid: "dave", wins: 0, losses: 3, ties: 0, totalPoints: 240, pointsAgainst: 270 },
            ],
          },
        ],
      ]
    );

    await archiveSeasonResultsLogic(db, { seasonUid: "old-season", seasonName: "Old Season" });

    const leagueWrite = writes.find((w) => w.path === `${leaguesPath}/league-1`);
    const entry = JSON.stringify(leagueWrite.data.champions);
    assert.match(entry, /"winnerId":"alice"/);
    assert.match(entry, /"consolation":\{"winnerId":"carol"/);
    // Seeds continue from the cut: third is third, not the #1 seed of anything.
    assert.match(entry, /"seed":3/);

    // Recognition only — no achievement, no coin, nothing out of the pool.
    const carolWrites = writes.filter((w) => w.path === profilePath("carol"));
    assert.equal(
      carolWrites.filter((w) => w.data?.corpsCoin !== undefined || w.data?.achievements).length,
      0,
      "the consolation title must move no CorpsCoin and grant no achievement"
    );
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
