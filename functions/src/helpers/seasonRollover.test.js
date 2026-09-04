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
//
// resetLeaguesForNewSeason and the season_rollovers lease are covered in
// seasonRollover.leagues.test.js; both files share __fixtures__/seasonRolloverFakes.

// The namespace must be pinned before ./season (and its path helpers) load.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  archiveAndResetProfiles,
  archiveSeasonResultsLogic,
  corpsParticipatedThisSeason,
} = require("./season");
const { RARITY_CC } = require("./achievements");
const {
  NS,
  profilePath,
  leaguesPath,
  makeFakeDb,
  participatingCorps,
  lineupOnlyCorps,
} = require("./__fixtures__/seasonRolloverFakes");

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

  test("a multi-corps director is paid ONE finish bonus, for their best result", async () => {
    // Two participating corps, each the only entrant in its class (placement 1
    // in both). Per-corps payment would be two champion bonuses.
    const { db, writes } = makeFakeDb({
      profiles: [
        {
          uid: "alice",
          data: {
            xp: 100,
            corps: {
              worldClass: participatingCorps(90),
              openClass: participatingCorps(80),
            },
          },
        },
      ],
    });

    await archiveAndResetProfiles(db, "old-season", "new-season");

    const update = writes.find(
      (w) => w.type === "update" && w.path === profilePath("alice")
    ).data;
    const results = update.pendingSeasonRecap.results;
    assert.equal(results.length, 2, "both corps keep their recap line");
    assert.ok(results.every((r) => r.placement === 1));
    const paidRows = results.filter((r) => r.coinBonus > 0);
    assert.equal(paidRows.length, 1, "exactly one row carries the coin bonus");
    assert.equal(results.filter((r) => r.xpBonus > 0).length, 1, "and one the XP");
    assert.equal(update.pendingSeasonRecap.totalCoin, paidRows[0].coinBonus);
    assert.equal(update.xp.operand, paidRows[0].xpBonus);
    // One season completed, not two.
    assert.equal(update.lifetimeStats.totalSeasons, 1);
  });

  test("equipped uniforms survive rollover and stamp the Uniform History", async () => {
    const equipped = {
      designId: "d1",
      name: "2026 Finals Look",
      colorway: { primary: "#101c33", secondary: "#d7dde2", accent: "#2f6fd0", metal: "silver" },
      figure: { skin: "#c9a074", jacket: "#101c33" },
      equippedAt: "2026-08-01T00:00:00.000Z",
    };
    const alt = { ...equipped, designId: "d2", name: "Exhibition Look" };
    const { db, writes } = makeFakeDb({
      profiles: [
        {
          uid: "alice",
          data: {
            corps: {
              worldClass: {
                ...participatingCorps(90),
                uniform: equipped,
                uniformAlt: alt,
                avatarSource: "custom",
              },
            },
          },
        },
      ],
    });

    await archiveAndResetProfiles(db, "old-season", "new-season");
    const update = writes.find(
      (w) => w.type === "update" && w.path === profilePath("alice")
    ).data;

    // The identity uniforms ride into the new season untouched...
    assert.deepEqual(update.corps.worldClass.uniform, equipped);
    assert.deepEqual(update.corps.worldClass.uniformAlt, alt);
    assert.equal(update.corps.worldClass.avatarSource, "custom");

    // ...the summary row keeps only the compact look (timeline swatches)...
    const summary = update.corps.worldClass.seasonHistory[0];
    assert.deepEqual(summary.uniform, {
      designId: "d1",
      name: "2026 Finals Look",
      colors: ["#101c33", "#d7dde2", "#2f6fd0"],
    });
    assert.equal(summary.uniformSnapshot, undefined, "full figure must not ride the summary");

    // ...and the full renderable snapshot lands on the seasonDetail doc.
    const detail = writes.find(
      (w) =>
        w.type === "set" &&
        w.path === `artifacts/${NS}/users/alice/seasonDetail/old-season__worldClass`
    );
    assert.deepEqual(detail.data.uniformSnapshot.figure, equipped.figure);
    assert.equal(detail.data.uniformSnapshot.name, "2026 Finals Look");
  });

  test("the guard look is archived with the season and RESET at rollover", async () => {
    const guard = {
      designId: "g1",
      name: "Show Costume",
      colorway: { primary: "#4b2a6b", secondary: "#e8c25a", accent: "#c25a6e", metal: "silver" },
      figure: { skin: "#d8a97e", torsoStyle: "dress", jacket: "#4b2a6b" },
      equippedAt: "2026-08-01T00:00:00.000Z",
    };
    const { db, writes } = makeFakeDb({
      profiles: [
        {
          uid: "alice",
          data: {
            corps: {
              worldClass: { ...participatingCorps(90), uniformGuard: guard },
            },
          },
        },
      ],
    });

    await archiveAndResetProfiles(db, "old-season", "new-season");
    const update = writes.find(
      (w) => w.type === "update" && w.path === profilePath("alice")
    ).data;

    // The guard wears the SHOW: its look does not ride into the new season...
    assert.equal(update.corps.worldClass.uniformGuard, undefined);

    // ...but the archive keeps it — compact on the summary row...
    const summary = update.corps.worldClass.seasonHistory[0];
    assert.deepEqual(summary.uniformGuard, {
      designId: "g1",
      name: "Show Costume",
      colors: ["#4b2a6b", "#e8c25a", "#c25a6e"],
    });
    assert.equal(summary.uniformGuardSnapshot, undefined, "full figure stays off the summary");

    // ...and the full snapshot on the seasonDetail doc.
    const detail = writes.find(
      (w) =>
        w.type === "set" &&
        w.path === `artifacts/${NS}/users/alice/seasonDetail/old-season__worldClass`
    );
    assert.deepEqual(detail.data.uniformGuardSnapshot.figure, guard.figure);
    assert.equal(detail.data.uniformGuardSnapshot.name, "Show Costume");
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

    // Both members get the champion notice; the winner also gets prize_payout.
    // All stamped to the inbox contract (createdAt/read/title) — the old inline
    // write used timestamp/isRead and never surfaced in the bell.
    const notifications = writes.filter((w) => w.path.includes("/notifications/"));
    assert.deepEqual(
      notifications.map((w) => w.data.type).sort(),
      ["new_champion", "new_champion", "prize_payout"]
    );
    assert.ok(notifications.every((n) => n.data.read === false && n.data.createdAt && n.data.title && n.data.userId));
    const payout = notifications.find((w) => w.data.type === "prize_payout");
    assert.ok(payout.path.includes("/users/alice/"), "prize_payout goes to the winner");
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
