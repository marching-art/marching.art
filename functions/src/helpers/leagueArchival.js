const { logger } = require("firebase-functions/v2");
const { paths } = require("./paths");
const { getDb } = require("../config");
const admin = require("firebase-admin");
const {
  TRANSACTION_TYPES,
  addCoinHistoryEntryToBatch,
} = require("./economy");
const { RARITY_CC } = require("./achievements");
const { isActiveThisSeason } = require("./leagueActivity");
const { selectLeagueChampion, DEFAULT_FINALS_SIZE } = require("./leagueChampion");
const { fetchWeeklyScoreIndex } = require("./leagueScoring");
const { buildNotificationDoc } = require("./userNotifications");

/**
 * Add one in-app notification to an existing batch, stamped to match the inbox
 * contract the bell reads (createdAt / read / id / userId — see
 * helpers/userNotifications.js). Champion + payout notices ride the archival
 * batch so they land atomically with the payout, so they can't go through
 * createUserNotification's own set(); this keeps the SAME doc shape.
 *
 * A malformed entry (missing type/title/message) is skipped rather than
 * written, exactly as the standalone helper does.
 */
function addNotificationToBatch(batch, db, uid, notification) {
  const doc = buildNotificationDoc(notification);
  if (!uid || !doc) return;
  const ref = db.collection(paths.userNotifications(uid)).doc();
  batch.set(ref, {
    ...doc,
    id: ref.id,
    userId: uid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * Championship week. A season is 49 competition days in 7 weeks, and day 49 is
 * Finals (helpers/scoreDrop.js FINALS_DAY), so week 7 is the week league
 * titles are decided in.
 */
const SEASON_FINAL_WEEK = 7;

/**
 * Archive league champions and pay league prize pools for a finished season.
 *
 * Called automatically at season rollover (startNewLiveSeason /
 * startNewOffSeason) BEFORE archiveAndResetProfiles — winner selection reads
 * live corps.totalSeasonScore, which the profile reset zeroes. Also reachable
 * via the admin manualTrigger("archiveSeasonResults"), which passes no season
 * and falls back to the current game-settings/season doc.
 *
 * Idempotent per league: a league whose champions[] already records this
 * season is skipped, so re-runs (manual after automatic, retry after a
 * partial failure) cannot double-pay a prize pool.
 *
 * @param {FirebaseFirestore.Firestore} [dbArg] - Injectable for rollover/tests.
 * @param {{seasonUid: string, seasonName: string}} [season] - The season to
 *   archive; omit to read the current game-settings/season doc (admin path).
 */
async function archiveSeasonResultsLogic(dbArg = null, season = null) {
  logger.info("Starting end-of-season archival process...");
  const db = dbArg || getDb();

  let seasonId = season?.seasonUid;
  let seasonName = season?.seasonName || seasonId;
  if (!seasonId) {
    const seasonDoc = await db.doc("game-settings/season").get();
    if (!seasonDoc.exists) {
      logger.error("No season document found. Cannot archive results.");
      throw new Error("No active season document found.");
    }
    const seasonData = seasonDoc.data();
    seasonId = seasonData.seasonUid;
    seasonName = seasonData.name;
  }

  // Leagues live under the data namespace (see callable/leagues.js) — this
  // path must stay in sync with that writer or archival silently processes
  // zero leagues.
  const leaguesSnapshot = await db
    .collection(paths.leagues())
    .get();
  if (leaguesSnapshot.empty) {
    logger.info("No leagues found to archive.");
    return;
  }

  const batch = db.batch();

  // Championship week (days 43-49, ending on Finals day 49) decides the title
  // among the qualifiers a league's regular season produced. One read for the
  // whole archival pass, shared by every league.
  let finalsScores = new Map();
  try {
    ({ index: finalsScores } = await fetchWeeklyScoreIndex(db, seasonId, SEASON_FINAL_WEEK));
  } catch (error) {
    logger.error(
      `Could not read championship-week scores for ${seasonId}; ` +
        `league titles will be decided on the standings alone: ${error.message}`
    );
  }
  // Finals scores are per corps class; a league title is one director against
  // another, so a director's Finals night is the sum of what they fielded.
  const finalsByUid = new Map();
  for (const entry of finalsScores.values()) {
    const prior = finalsByUid.get(entry.uid) || { score: 0, shows: 0 };
    finalsByUid.set(entry.uid, {
      score: prior.score + entry.score,
      shows: prior.shows + entry.shows,
    });
  }

  for (const leagueDoc of leaguesSnapshot.docs) {
    const league = leagueDoc.data();
    const leagueId = leagueDoc.id;
    const members = league.members || [];

    if (members.length === 0) continue;

    // Idempotency: this league already has a champion recorded for this
    // season (seasonId on new entries; seasonName covers legacy entries).
    const alreadyArchived = (league.champions || []).some(
      (c) => c.seasonId === seasonId || c.seasonName === seasonName
    );
    if (alreadyArchived) {
      logger.info(`League '${league.name}' already has a ${seasonName} champion; skipping.`);
      continue;
    }

    // The champion is the director who WON THE LEAGUE — the season's standings
    // decide the finals field, and championship week decides the title among
    // it (helpers/leagueChampion.js). This used to crown whoever had the
    // biggest `corps.*.totalSeasonScore` sum, which is a sum of each corps'
    // LAST show score, so a 7-0 director could lose their league to a 2-5 one
    // who happened to peak on the final night.
    const profilePromises = members.map((uid) => db.doc(paths.userProfile(uid)).get());
    const profileDocs = await Promise.all(profilePromises);

    const profileByUid = new Map();
    const eligibleUids = new Set();
    profileDocs.forEach((profileDoc, index) => {
      if (!profileDoc.exists) return;
      const uid = members[index];
      const profileData = profileDoc.data();
      profileByUid.set(uid, profileData);
      // isActiveThisSeason, never `activeSeasonId` alone: registerCorps
      // deliberately withholds that marker from directors who still owe corps
      // decisions, so gating on it excluded fully competing members from their
      // own league's championship (see helpers/leagueActivity.js).
      if (isActiveThisSeason(profileData, seasonId)) eligibleUids.add(uid);
    });

    const standingsDoc = await db.doc(paths.leagueStandings(leagueId)).get();
    const standingsRows = standingsDoc.exists ? standingsDoc.data()?.standings || [] : [];

    const decision = selectLeagueChampion({
      standings: standingsRows,
      eligibleUids,
      finalsScores: finalsByUid,
      finalsSize: league.settings?.finalsSize || DEFAULT_FINALS_SIZE,
    });

    let leagueWinner = { userId: null, username: "Unknown", finalScore: -1, corpsName: "Unknown" };
    if (decision.championUid) {
      const winnerProfile = profileByUid.get(decision.championUid) || {};
      const winnerCorps = winnerProfile.corps || {};
      leagueWinner = {
        userId: decision.championUid,
        username: winnerProfile.username || winnerProfile.displayName || "Unknown",
        // The headline number is what decided it: Finals night when Finals
        // happened, the season's points-for when it came down to the standings.
        finalScore: decision.finalsScore ?? decision.record?.totalPoints ?? 0,
        corpsName:
          winnerCorps.worldClass?.corpsName ||
          Object.values(winnerCorps).find((c) => c?.corpsName)?.corpsName ||
          winnerProfile.corpsName ||
          "Unnamed Corps",
      };
      logger.info(
        `League '${league.name}' champion: ${leagueWinner.username} ` +
          `(seed #${decision.seed}, ${decision.record.wins}-${decision.record.losses}-${decision.record.ties}, ` +
          `decided by ${decision.decidedBy}).`
      );
    } else if (eligibleUids.size > 0) {
      logger.warn(
        `League '${league.name}' has ${eligibleUids.size} registered member(s) but no ` +
          `standings rows for ${seasonId}; no champion crowned.`
      );
    }

    if (leagueWinner.userId) {
      const leagueRef = leagueDoc.ref;
      const championEntry = {
        seasonId: seasonId,
        seasonName: seasonName,
        winnerId: leagueWinner.userId,
        winnerUsername: leagueWinner.username,
        winnerCorpsName: leagueWinner.corpsName,
        score: leagueWinner.finalScore,
        // How the title was won — the Hall of Fame renders this, and without
        // it a champions[] entry is just a name and a number with no story.
        record: decision.record,
        seed: decision.seed,
        decidedBy: decision.decidedBy,
        finalsField: decision.qualifiers.map((q) => q.uid),
        // The best of the directors who missed the cut, decided by the same
        // rule on the same week. Recognition only — it pays no prize pool and
        // mints no CorpsCoin — but a league of twenty used to leave eight
        // members with nothing to play for the moment they were mathematically
        // out. Null when the field below the cut was too small to be a race.
        consolation: decision.consolation
          ? {
              winnerId: decision.consolation.uid,
              winnerUsername:
                profileByUid.get(decision.consolation.uid)?.username ||
                profileByUid.get(decision.consolation.uid)?.displayName ||
                "Unknown",
              seed: decision.consolation.seed,
              decidedBy: decision.consolation.decidedBy,
              record: decision.consolation.record,
              fieldSize: decision.consolation.fieldSize,
            }
          : null,
        archivedAt: new Date(),
      };
      batch.update(leagueRef, {
        champions: admin.firestore.FieldValue.arrayUnion(championEntry),
      });
      logger.info(`Archived winner for league '${league.name}': ${leagueWinner.username}`);
      if (championEntry.consolation) {
        logger.info(
          `League '${league.name}' consolation: ${championEntry.consolation.winnerUsername} ` +
            `(seed #${championEntry.consolation.seed} of ${championEntry.consolation.fieldSize} below the cut).`
        );
      }

      // --- ACHIEVEMENT LOGIC ---
      // Shape matches the server catalog (helpers/achievements.js) and what
      // AchievementMini/the celebration modal render: title (not name),
      // rarity, ccReward — the legacy `name` shape rendered with no title
      // and paid nothing.
      const winnerProfileRef = db.doc(paths.userProfile(leagueWinner.userId));
      const championAchievement = {
        // Keyed per league AND season: a director who wins two leagues in
        // one season earns two distinct achievements (each with its CC),
        // not two array entries sharing one id (which breaks id-keyed
        // rendering and reads as a duplicate grant).
        id: `league_champion_${leagueId}_${seasonId}`,
        title: `League Champion: ${seasonName}`,
        description: `Finished 1st in the ${league.name} league during the ${seasonName}.`,
        icon: "trophy", // An identifier for the frontend to use
        rarity: "legendary",
        ccReward: RARITY_CC.legendary,
        earnedAt: new Date(),
      };
      batch.update(winnerProfileRef, {
        achievements: admin.firestore.FieldValue.arrayUnion(championAchievement),
        corpsCoin: admin.firestore.FieldValue.increment(championAchievement.ccReward),
      });
      addCoinHistoryEntryToBatch(batch, db, leagueWinner.userId, {
        type: "achievement",
        amount: championAchievement.ccReward,
        description: `Achievement unlocked: ${championAchievement.title}`,
        timestamp: new Date(),
      });
      logger.info(`Granted 'League Champion' achievement to ${leagueWinner.username}.`);

      // --- PRIZE POOL PAYOUT ---
      // Pay the escrowed entry-fee pool shown on the league's settings tab,
      // and drain it in the same batch — the pool is escrow, so paying
      // without zeroing would re-mint the same fees at every future
      // rollover (the champions[] guard is per-season, not per-pool).
      // Decrement rather than set 0 so an entry fee escrowed concurrently
      // by a joiner mid-rollover isn't clobbered.
      // `poolCarry` rides along. It is prediction-pool antes that no member
      // ever won, and it was only ever released when someone next bought in —
      // so a league that stopped running pools mid-season left real escrowed
      // CorpsCoin in a field nothing would ever pay out, permanently. Rolling
      // it up to the season champion keeps the loop zero-sum and closes the
      // leak; every coin in it was staked by a member of this league.
      const prizePool = league.settings?.prizePool || 0;
      const poolCarry = league.poolCarry || 0;
      const payout = prizePool + poolCarry;
      if (payout > 0) {
        batch.update(winnerProfileRef, {
          corpsCoin: admin.firestore.FieldValue.increment(payout),
        });
        const leaguePayoutUpdate = {};
        if (prizePool > 0) {
          leaguePayoutUpdate["settings.prizePool"] =
            admin.firestore.FieldValue.increment(-prizePool);
        }
        if (poolCarry > 0) {
          leaguePayoutUpdate.poolCarry = admin.firestore.FieldValue.increment(-poolCarry);
        }
        batch.update(leagueRef, leaguePayoutUpdate);
        addCoinHistoryEntryToBatch(batch, db, leagueWinner.userId, {
          type: TRANSACTION_TYPES.LEAGUE_WIN,
          amount: payout,
          description: poolCarry > 0
            ? `${seasonName} champion prize pool + unclaimed prediction pool — ${league.name}`
            : `${seasonName} champion prize pool — ${league.name}`,
          timestamp: new Date(),
        });
        logger.info(
          `Paid ${payout} CC (${prizePool} prize pool + ${poolCarry} pool carry) to ` +
            `${leagueWinner.username} for winning '${league.name}'.`
        );

        // Tell the winner their winnings landed. Gold reward moment (bell type
        // prize_payout) — distinct from the champion notice below, which every
        // member (winner included) also gets.
        addNotificationToBatch(batch, db, leagueWinner.userId, {
          type: "prize_payout",
          title: "Prize Pool Paid Out",
          message: `You won ${payout.toLocaleString()} CorpsCoin as the ${seasonName} ` +
            `champion of ${league.name}!`,
          link: `/leagues/${leagueId}`,
          metadata: { amount: payout, prizePool, poolCarry, seasonId, leagueId },
        });
      }

      // --- CHAMPION NOTIFICATION ---
      // Every member is told who won. Routed through the same doc shape the
      // bell reads (createdAt/read/title) — the previous inline write used
      // timestamp/isRead and was invisible to the inbox listener entirely.
      const notificationMessage = `🏆 ${leagueWinner.username} has won the ${seasonName} ` +
        `championship in your league, ${league.name}!`;
      members.forEach((memberUid) => {
        addNotificationToBatch(batch, db, memberUid, {
          type: "new_champion",
          title: "League Champion Crowned",
          message: notificationMessage,
          link: `/leagues/${leagueId}`, // client-side routing target
          leagueId,
          leagueName: league.name,
          metadata: {
            seasonId,
            winnerId: leagueWinner.userId,
            winnerUsername: leagueWinner.username,
          },
        });
      });
      logger.info(`Created notifications for all ${members.length} members of league '${league.name}'.`);

      // Champion crowned is a league moment — drop it into the activity feed
      // too (same batch, so the feed and the champions[] entry land together).
      const activityRef = db
        .collection(paths.leagueActivity(leagueId))
        .doc();
      batch.set(activityRef, {
        id: activityRef.id,
        type: "new_champion",
        title: "League Champion Crowned",
        message: notificationMessage,
        metadata: {
          seasonId,
          winnerId: leagueWinner.userId,
          winnerUsername: leagueWinner.username,
          score: leagueWinner.finalScore,
        },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }

  await batch.commit();
  logger.info("End-of-season archival process complete.");
}

module.exports = {
  archiveSeasonResultsLogic,
  SEASON_FINAL_WEEK,
};
