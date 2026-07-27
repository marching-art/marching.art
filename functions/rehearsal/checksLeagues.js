/**
 * Checks on what a season LEAVES BEHIND: who was crowned, what the title paid,
 * and what the rollover carried into the next season.
 *
 * Split from checks.js, which holds the checks on how the season RAN. The two
 * halves fail for different reasons and get triaged by different people: a
 * bracket error is a scoring problem, and everything here is a league problem.
 */

const { paths } = require("../src/helpers/paths");
const { RARITY_CC } = require("../src/helpers/achievements");
const { compareStandingRows } = require("../src/helpers/leagueStandings");
const { pass, fail, warn } = require("./finding");

// ---------------------------------------------------------------------------
// D. The league championship — permanent, and paid in real currency
// ---------------------------------------------------------------------------

async function checkChampions(db, world, played) {
  const findings = [];
  const seasonUid = played.rollover.oldSeasonUid;

  for (const seed of world.leagues) {
    const leagueDoc = await db.doc(paths.league(seed.leagueId)).get();
    const league = leagueDoc.data();
    const entries = (league.champions || []).filter((c) => c.seasonId === seasonUid);

    if (seed.dormant === true) {
      findings.push(
        entries.length === 0
          ? pass("champion", "a league of unregistered members crowns nobody", seed.id)
          : fail(
              "champion",
              "a league of unregistered members crowns nobody",
              `${seed.id} crowned ${entries[0].winnerUsername}`
            )
      );
      continue;
    }

    if (entries.length !== 1) {
      findings.push(
        fail(
          "champion",
          `${seed.id} records exactly one champion`,
          `found ${entries.length} entries for ${seasonUid}`
        )
      );
      continue;
    }
    const champion = entries[0];
    findings.push(pass("champion", `${seed.id} records exactly one champion`, champion.winnerUsername));

    // The champion must have come from the finals field, and the field must be
    // the top `finalsSize` seeds of the standings that were archived.
    const archived = await db
      .doc(`${paths.league(seed.leagueId)}/standings/${seasonUid}`)
      .get();
    const rows = archived.exists ? archived.data().standings || [] : [];
    const seededRows = rows.slice().sort(compareStandingRows);
    const expectedField = seededRows.slice(0, seed.finalsSize).map((r) => r.uid);

    findings.push(
      champion.finalsField && champion.finalsField.includes(champion.winnerId)
        ? pass("champion", `${seed.id} champion came from the finals field`, `seed #${champion.seed}`)
        : fail(
            "champion",
            `${seed.id} champion came from the finals field`,
            `winner ${champion.winnerId} not in [${(champion.finalsField || []).join(", ")}]`
          )
    );

    if (expectedField.length > 0) {
      const mismatched = (champion.finalsField || []).filter((uid) => !expectedField.includes(uid));
      findings.push(
        mismatched.length === 0
          ? pass(
              "champion",
              `${seed.id} finals field is the top ${seed.finalsSize} seeds`,
              `${(champion.finalsField || []).length} qualifiers`
            )
          : fail(
              "champion",
              `${seed.id} finals field is the top ${seed.finalsSize} seeds`,
              `${mismatched.length} qualifier(s) outside the cut: ${mismatched.join(", ")}`
            )
      );
    }

    // The record on the entry is what the Hall of Fame renders; an entry with
    // no story is the bug this field was added for.
    findings.push(
      champion.record && champion.decidedBy && typeof champion.seed === "number"
        ? pass("champion", `${seed.id} entry carries the story`, `decided by ${champion.decidedBy}`)
        : fail(
            "champion",
            `${seed.id} entry carries the story`,
            `record=${JSON.stringify(champion.record)} decidedBy=${champion.decidedBy} seed=${champion.seed}`
          )
    );

    // Consolation: a race below the cut only when there is a field for one.
    const belowCut = Math.max(0, seededRows.length - seed.finalsSize);
    if (belowCut >= 2) {
      findings.push(
        champion.consolation && champion.consolation.fieldSize === belowCut
          ? pass(
              "champion",
              `${seed.id} runs a consolation race`,
              `${champion.consolation.winnerUsername} of ${belowCut} below the cut`
            )
          : fail(
              "champion",
              `${seed.id} runs a consolation race`,
              `${belowCut} directors below the cut but consolation is ` +
                `${JSON.stringify(champion.consolation)}`
            )
      );
    } else {
      findings.push(
        champion.consolation === null
          ? pass("champion", `${seed.id} has no consolation race`, `${belowCut} below the cut`)
          : fail(
              "champion",
              `${seed.id} has no consolation race`,
              `only ${belowCut} below the cut but consolation was awarded`
            )
      );
    }

    // A director who sat championship week out cannot win it on Finals night.
    // A title decided on Finals night must have been decided on a night the
    // champion actually competed on.
    if (champion.decidedBy === "finals" && !(champion.score > 0)) {
      findings.push(
        fail(
          "champion",
          `${seed.id} decided its title on a real Finals result`,
          `decidedBy=finals but the winning score was ${champion.score} — the title was awarded ` +
            "on a night nobody in the field competed"
        )
      );
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// E. What the championship paid
// ---------------------------------------------------------------------------

async function checkPayouts(db, world, played) {
  const findings = [];
  const seasonUid = played.rollover.oldSeasonUid;

  // The escrow league has a number we can predict exactly: the pool plus the
  // unclaimed prediction carry, and both drained to zero afterwards.
  const poolSeed = world.leagues.find((l) => l.id === "LG_POOL");
  const poolLeague = (await db.doc(paths.league(poolSeed.leagueId)).get()).data();
  const poolChampion = (poolLeague.champions || []).find((c) => c.seasonId === seasonUid);

  if (poolChampion) {
    // The pool is real escrow: every member paid the entry fee at join, so the
    // pot is fee x roster, plus the unclaimed prediction carry.
    const expectedPayout = poolSeed.entryFee * poolSeed.members.length + poolSeed.poolCarry;
    const history = await db
      .collection(paths.userCorpsCoinHistory(poolChampion.winnerId))
      .get();
    // Weekly league-win rewards share the `league_win` type and also name the
    // league, so match the archival payout by its own wording — that entry is
    // the one the rollover writes, and the one a double-payout would duplicate.
    const leagueWinEntries = history.docs
      .map((d) => d.data())
      .filter(
        (entry) =>
          (entry.description || "").includes(poolSeed.name) &&
          (entry.description || "").includes("champion prize pool")
      );
    const paid = leagueWinEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0);

    findings.push(
      paid === expectedPayout
        ? pass(
            "payout",
            "prize pool + unclaimed carry paid exactly once",
            `${paid} CC to ${poolChampion.winnerUsername}`
          )
        : fail(
            "payout",
            "prize pool + unclaimed carry paid exactly once",
            `expected ${expectedPayout} CC across ${leagueWinEntries.length} entr(ies), saw ${paid}`
          )
    );

    const drainedPool = poolLeague.settings?.prizePool || 0;
    const drainedCarry = poolLeague.poolCarry || 0;
    findings.push(
      drainedPool === 0 && drainedCarry === 0
        ? pass("payout", "escrow is drained after payout", "prizePool 0, poolCarry 0")
        : fail(
            "payout",
            "escrow is drained after payout",
            `prizePool=${drainedPool} poolCarry=${drainedCarry} — escrow left behind re-mints next season`
          )
    );
  } else {
    findings.push(fail("payout", "escrow league crowned a champion", "no champion, so no payout to check"));
  }

  // One legendary achievement per league won, keyed per league AND season.
  const championsByUid = new Map();
  for (const seed of world.leagues) {
    const league = (await db.doc(paths.league(seed.leagueId)).get()).data();
    const entry = (league.champions || []).find((c) => c.seasonId === seasonUid);
    if (!entry) continue;
    const list = championsByUid.get(entry.winnerId) || [];
    list.push({ label: seed.id, leagueId: seed.leagueId });
    championsByUid.set(entry.winnerId, list);
  }

  for (const [uid, won] of championsByUid.entries()) {
    const profile = (await db.doc(paths.userProfile(uid)).get()).data();
    const achievements = (profile.achievements || []).filter((a) =>
      String(a.id).startsWith("league_champion_")
    );
    const expectedIds = won.map((w) => `league_champion_${w.leagueId}_${seasonUid}`).sort();
    const actualIds = achievements.map((a) => a.id).sort();
    findings.push(
      JSON.stringify(expectedIds) === JSON.stringify(actualIds)
        ? pass(
            "payout",
            `${uid} earned one champion achievement per league won`,
            `${actualIds.length} (${won.map((w) => w.label).join(", ")})`
          )
        : fail(
            "payout",
            `${uid} earned one champion achievement per league won`,
            `expected [${expectedIds.join(", ")}], got [${actualIds.join(", ")}]`
          )
    );

    const malformed = achievements.filter(
      (a) => !a.title || a.rarity !== "legendary" || a.ccReward !== RARITY_CC.legendary
    );
    findings.push(
      malformed.length === 0
        ? pass("payout", `${uid}'s champion achievement is renderable and paid`)
        : fail(
            "payout",
            `${uid}'s champion achievement is renderable and paid`,
            `${malformed.length} entr(ies) missing title/rarity/ccReward`
          )
    );
  }

  // Every member of a league with a champion must have been told.
  for (const seed of world.leagues) {
    const league = (await db.doc(paths.league(seed.leagueId)).get()).data();
    const entry = (league.champions || []).find((c) => c.seasonId === seasonUid);
    if (!entry) continue;
    const missing = [];
    for (const member of seed.members) {
      const notifications = await db
        .collection(paths.userNotifications(member))
        .where("type", "==", "new_champion")
        .get();
      if (notifications.empty) missing.push(member);
    }
    findings.push(
      missing.length === 0
        ? pass("payout", `${seed.id} told every member who won`, `${seed.members.length} notified`)
        : fail(
            "payout",
            `${seed.id} told every member who won`,
            `${missing.length} member(s) never notified: ${missing.join(", ")}`
          )
    );
  }

  return findings;
}

// ---------------------------------------------------------------------------
// F. The rollover — what a league and a profile carry into the next season
// ---------------------------------------------------------------------------

async function checkRollover(db, world, played) {
  const findings = [];
  const { oldSeasonUid, newSeasonUid } = played.rollover;

  findings.push(
    newSeasonUid && newSeasonUid !== oldSeasonUid
      ? pass("rollover", "a new season started", `${oldSeasonUid} -> ${newSeasonUid}`)
      : fail("rollover", "a new season started", `season uid is still ${oldSeasonUid}`)
  );

  for (const seed of world.leagues) {
    const leagueRef = db.doc(paths.league(seed.leagueId));
    const league = (await leagueRef.get()).data();

    findings.push(
      league.seasonId === newSeasonUid
        ? pass("rollover", `${seed.id} advanced to the new season`)
        : fail("rollover", `${seed.id} advanced to the new season`, `seasonId is ${league.seasonId}`)
    );

    // Live standings reset, previous season archived.
    const current = await db.doc(paths.leagueStandings(seed.leagueId)).get();
    const currentRows = current.exists ? current.data().standings || [] : [];
    const archived = await db.doc(`${paths.league(seed.leagueId)}/standings/${oldSeasonUid}`).get();
    findings.push(
      currentRows.length === 0
        ? pass("rollover", `${seed.id} standings start empty`)
        : fail(
            "rollover",
            `${seed.id} standings start empty`,
            `${currentRows.length} rows carried into the new season`
          )
    );
    const playedAnyWeeks = seed.dormant !== true;
    if (playedAnyWeeks) {
      findings.push(
        archived.exists && (archived.data().standings || []).length > 0
          ? pass("rollover", `${seed.id} archived last season's table`)
          : fail(
              "rollover",
              `${seed.id} archived last season's table`,
              "no standings history document — the season's record is gone"
            )
      );
    }

    // Matchups and recaps MOVED, not copied: leaving week-1 in place is what
    // stopped a league ever getting matchups again.
    const liveMatchups = await leagueRef.collection("matchups").get();
    const historyMatchups = await leagueRef.collection("matchupHistory").get();
    findings.push(
      liveMatchups.empty
        ? pass("rollover", `${seed.id} live matchups cleared`, `${historyMatchups.size} archived`)
        : fail(
            "rollover",
            `${seed.id} live matchups cleared`,
            `${liveMatchups.size} week document(s) left behind — next season's generator will skip ` +
              "those weeks entirely"
          )
    );
    if (playedAnyWeeks) {
      findings.push(
        historyMatchups.size > 0
          ? pass("rollover", `${seed.id} matchup history kept`, `${historyMatchups.size} weeks`)
          : fail("rollover", `${seed.id} matchup history kept`, "the season's matchups were deleted, not archived")
      );
    }

    const liveRecaps = await leagueRef.collection("recaps").get();
    findings.push(
      liveRecaps.empty
        ? pass("rollover", `${seed.id} live weekly recaps cleared`)
        : fail(
            "rollover",
            `${seed.id} live weekly recaps cleared`,
            `${liveRecaps.size} recap(s) left — the Activity tab will show last season as current`
          )
    );

    const rivalries = await db.doc(paths.leagueMeta(seed.leagueId, "rivalries")).get();
    findings.push(
      !rivalries.exists
        ? pass("rollover", `${seed.id} rivalries cleared`)
        : fail("rollover", `${seed.id} rivalries cleared`, "last season's grudges are still displayed")
    );

    findings.push(
      league.announcement === undefined
        ? pass("rollover", `${seed.id} stale announcement cleared`)
        : fail(
            "rollover",
            `${seed.id} stale announcement cleared`,
            "a pinned announcement about a finished season still sits above every tab"
          )
    );

    findings.push(
      league.matchupsGeneratedWeek === undefined
        ? pass("rollover", `${seed.id} matchup marker cleared`)
        : fail(
            "rollover",
            `${seed.id} matchup marker cleared`,
            `matchupsGeneratedWeek=${league.matchupsGeneratedWeek}`
          )
    );

    findings.push(
      league.seasonActivity?.seasonUid === newSeasonUid &&
        (league.seasonActivity?.activeMemberCount || 0) === 0
        ? pass("rollover", `${seed.id} activity reset to zero`)
        : fail(
            "rollover",
            `${seed.id} activity reset to zero`,
            `seasonActivity=${JSON.stringify(league.seasonActivity)}`
          )
    );

    // The Hall of Fame is the one thing that must survive untouched.
    findings.push(
      (league.champions || []).length > 0 || seed.dormant === true
        ? pass("rollover", `${seed.id} kept its champions`)
        : fail("rollover", `${seed.id} kept its champions`, "champions[] was wiped by the rollover")
    );
  }

  // A paid alternate format is bought for one season and must lapse.
  const captionsSeed = world.leagues.find((l) => l.captionWars);
  const captions = (await db.doc(paths.league(captionsSeed.leagueId)).get()).data();
  findings.push(
    captions.settings?.scoringFormat === "total" &&
      captions.settings?.scoringFormatSeasonUid === undefined
      ? pass("rollover", "Caption Wars lapses at season end", "format reset, season stamp cleared")
      : fail(
          "rollover",
          "Caption Wars lapses at season end",
          `format=${captions.settings?.scoringFormat} ` +
            `stamp=${captions.settings?.scoringFormatSeasonUid} — a league is playing a paid ` +
            "format nobody paid for"
        )
  );

  const rookiePointer = await db.doc("game-settings/rookie-league").get();
  findings.push(
    rookiePointer.exists && rookiePointer.data().leagueId === null
      ? pass("rollover", "rookie circuit pointer retired", "new directors get a fresh circuit")
      : fail(
          "rollover",
          "rookie circuit pointer retired",
          `pointer is ${JSON.stringify(rookiePointer.data())} — new directors land in a league of ghosts`
        )
  );

  return findings;
}

// ---------------------------------------------------------------------------
// G. Profiles after the reset
// ---------------------------------------------------------------------------

async function checkProfiles(db, world, played) {
  const findings = [];
  const { oldSeasonUid } = played.rollover;

  for (const director of world.directors) {
    const profile = (await db.doc(paths.userProfile(director.uid)).get()).data();
    const corpsClasses = Object.keys(director.classes);

    // A director who did not play this season is not part of this rollover:
    // archiveAndResetProfiles selects on `activeSeasonId == oldSeasonUid`, so a
    // dormant profile is deliberately left exactly as the LAST rollover left
    // it. Asserting the live-season reset against them would be asserting that
    // the sweep reaches profiles it is designed not to touch.
    if (director.dormant) {
      const untouched =
        profile.activeSeasonId !== oldSeasonUid &&
        corpsClasses.every((c) => profile.corps?.[c]?.corpsName);
      findings.push(
        untouched
          ? pass("profile", `${director.uid} (dormant) was left alone`, profile.activeSeasonId)
          : fail(
              "profile",
              `${director.uid} (dormant) was left alone`,
              `a profile that never registered for ${oldSeasonUid} was swept by its rollover ` +
                `(activeSeasonId=${profile.activeSeasonId})`
            )
      );
      continue;
    }

    const keptIdentity = corpsClasses.every((c) => profile.corps?.[c]?.corpsName);
    findings.push(
      keptIdentity
        ? pass("profile", `${director.uid} kept its corps identity`)
        : fail(
            "profile",
            `${director.uid} kept its corps identity`,
            "corpsName was cleared — directors lose the corps they named"
          )
    );

    const seasonDataCleared = corpsClasses.every((c) => {
      const corps = profile.corps?.[c] || {};
      const lineupEmpty = !corps.lineup || Object.keys(corps.lineup).length === 0;
      const showsEmpty = !corps.selectedShows || Object.keys(corps.selectedShows).length === 0;
      return lineupEmpty && showsEmpty && !corps.seasonUid;
    });
    findings.push(
      seasonDataCleared
        ? pass("profile", `${director.uid} season data cleared`)
        : fail(
            "profile",
            `${director.uid} season data cleared`,
            "a lineup, selected shows or a season stamp survived the reset, so the corps still " +
              "reads as competing"
          )
    );

    findings.push(
      profile.activeSeasonId === oldSeasonUid
        ? pass("profile", `${director.uid} still needs to opt into the new season`)
        : fail(
            "profile",
            `${director.uid} still needs to opt into the new season`,
            `activeSeasonId=${profile.activeSeasonId} — rollover must NOT advance this marker`
          )
    );
  }

  // Season history should record the season that just ended for competitors.
  const competitor = (await db.doc(paths.userProfile("d01")).get()).data();
  const history = competitor.corps?.worldClass?.seasonHistory || [];
  findings.push(
    history.some((h) => h.seasonUid === oldSeasonUid || h.seasonId === oldSeasonUid || h.season === oldSeasonUid)
      ? pass("profile", "the finished season is archived to seasonHistory")
      : warn(
          "profile",
          "the finished season is archived to seasonHistory",
          `d01's worldClass seasonHistory has ${history.length} entr(ies) and none names ` +
            `${oldSeasonUid}: ${JSON.stringify(history.slice(0, 2))}`
        )
  );

  // The participation gate: a corps that never competed must not be paid for
  // finishing. dq_lineup saved picks for every week but never appeared in a
  // recap, because its lineup was never complete and scoring skips incomplete
  // lineups. This used to be credited a full season.
  const unscored = (await db.doc(paths.userProfile("dq_lineup")).get()).data();
  const seasonsCounted = unscored.lifetimeStats?.totalSeasons || 0;
  const showsCounted = unscored.lifetimeStats?.totalShows || 0;
  findings.push(
    seasonsCounted === 0 && showsCounted === 0
      ? pass(
          "profile",
          "a corps that never competed is not credited a season",
          "dq_lineup: 0 seasons, 0 shows"
        )
      : fail(
          "profile",
          "a corps that never competed is not credited a season",
          `dq_lineup never appeared in a single recap yet carries ${seasonsCounted} season(s) ` +
            `and ${showsCounted} show(s) — the finish bonus, completion XP and the ` +
            "seasons-completed class unlock all credit a director who never took the field"
        )
  );

  // Career figures must be the real ones. `showsAttended` used to be the number
  // of WEEKS a director had picks saved for, and best week came from
  // `corps.weeklyScores`, which nothing writes — so it was always zero.
  const veteran = (await db.doc(paths.userProfile("d01")).get()).data();
  const veteranHistory = veteran.corps?.worldClass?.seasonHistory || [];
  const archived = veteranHistory.find(
    (h) => h.seasonId === oldSeasonUid || h.seasonName === oldSeasonUid
  );
  if (archived) {
    findings.push(
      archived.showsAttended > 7
        ? pass(
            "profile",
            "shows attended counts shows, not weeks",
            `d01 attended ${archived.showsAttended} shows across a 7-week season`
          )
        : fail(
            "profile",
            "shows attended counts shows, not weeks",
            `d01's archived season records ${archived.showsAttended} shows. A director who ` +
              "competed twice a week for seven weeks attended more than seven shows; a figure " +
              "of 7 or less means weeks with picks are being counted instead"
          )
    );
    findings.push(
      archived.highestWeeklyScore > 0
        ? pass(
            "profile",
            "best week is a real number",
            `d01's best week: ${archived.highestWeeklyScore.toFixed(3)}`
          )
        : fail(
            "profile",
            "best week is a real number",
            "d01's archived best week is 0, so the Best Week tile on the career page " +
              "(src/pages/CorpsHistory.jsx) renders 0.000 for a director who competed all season"
          )
    );
    findings.push(
      (veteran.lifetimeStats?.totalShows || 0) === archived.showsAttended
        ? pass("profile", "lifetime shows agree with the archived season")
        : fail(
            "profile",
            "lifetime shows agree with the archived season",
            `lifetimeStats.totalShows=${veteran.lifetimeStats?.totalShows} but the archived ` +
              `season records ${archived.showsAttended}`
          )
    );
  }

  return findings;
}

// ---------------------------------------------------------------------------
// H. Doing it twice — scheduler redelivery is normal
// ---------------------------------------------------------------------------

async function checkIdempotency(db, world, played) {
  const findings = [];
  const seasonUid = played.rollover.oldSeasonUid;
  const { replayRollover } = require("./drive");

  const poolSeed = world.leagues.find((l) => l.id === "LG_POOL");
  const league = (await db.doc(paths.league(poolSeed.leagueId)).get()).data();
  const champion = (league.champions || []).find((c) => c.seasonId === seasonUid);
  if (!champion) {
    return [warn("idempotency", "rollover replay", "no champion to re-pay, so nothing to prove")];
  }

  const before = (await db.doc(paths.userProfile(champion.winnerId)).get()).data();
  const beforeChampions = ((await db.doc(paths.league(poolSeed.leagueId)).get()).data().champions || [])
    .length;

  await replayRollover(db, { seasonUid, seasonName: seasonUid });

  const after = (await db.doc(paths.userProfile(champion.winnerId)).get()).data();
  const afterChampions = ((await db.doc(paths.league(poolSeed.leagueId)).get()).data().champions || [])
    .length;

  findings.push(
    before.corpsCoin === after.corpsCoin
      ? pass("idempotency", "a replayed rollover pays nothing twice", `${after.corpsCoin} CC unchanged`)
      : fail(
          "idempotency",
          "a replayed rollover pays nothing twice",
          `champion balance moved ${before.corpsCoin} -> ${after.corpsCoin} on a rerun`
        )
  );
  findings.push(
    beforeChampions === afterChampions
      ? pass("idempotency", "a replayed rollover crowns nobody twice")
      : fail(
          "idempotency",
          "a replayed rollover crowns nobody twice",
          `champions[] grew ${beforeChampions} -> ${afterChampions}`
        )
  );
  findings.push(
    (before.lifetimeStats?.totalSeasons || 0) === (after.lifetimeStats?.totalSeasons || 0)
      ? pass("idempotency", "a replayed rollover counts no extra season")
      : fail(
          "idempotency",
          "a replayed rollover counts no extra season",
          `totalSeasons ${before.lifetimeStats?.totalSeasons} -> ${after.lifetimeStats?.totalSeasons}`
        )
  );

  return findings;
}

module.exports = {
  checkChampions,
  checkPayouts,
  checkRollover,
  checkProfiles,
  checkIdempotency,
};
