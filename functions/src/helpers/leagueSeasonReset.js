/**
 * League season rollover.
 *
 * Split out of helpers/season.js, which is at its module size cap. It reads
 * better alone anyway: this is the one place that decides what a league carries
 * from one season into the next, and getting that list wrong is how a league
 * quietly stops working — see the note on matchups below.
 */

const { logger } = require("firebase-functions/v2");
const { paths } = require("./paths");
const admin = require("firebase-admin");
const { emptySeasonActivity } = require("./leagueActivity");
const { SCORING_FORMATS } = require("./captionWars");

/**
 * Roll every league into the new season.
 *
 * Leagues used to be entirely season-blind: `seasonId` was stamped once at
 * creation and never touched again, and standings/matchup state simply
 * accumulated. Two seasons in, a league's table showed W/L records blended
 * across every season it had ever played, which also broke the client's
 * "inactive member" heuristic (it inferred activity from a non-zero record, so
 * everyone who had ever played read as active forever).
 *
 * For each league this:
 *  - copies standings/current to standings/{oldSeasonUid} as history, then
 *    resets the live doc so week 1 starts 0-0 for everyone;
 *  - MOVES every matchups/week-N document into matchupHistory, and every
 *    recaps/week-N into recapHistory. Standings were reset here from the start
 *    but neither of these ever was, and both are keyed by week number alone —
 *    so last season's week-1 was still sitting there when the new season began.
 *    For matchups that was fatal: the generator skips a week whose document
 *    already exists, so a league that completed one season never had matchups
 *    generated again — every week looked done, the weekly resolution found
 *    nothing to resolve, and the table never moved. Everything downstream
 *    (pairing history, rivalries, the record book, the standings rebuild) also
 *    silently blended the two seasons. For recaps it was quieter but still
 *    wrong: the Activity tab reads recaps/week-{currentWeek}, so for most of
 *    every week of every season after the first, members were shown last
 *    season's highlights as if they had just happened.
 *  - clears meta/rivalries, which describes head-to-head history WITHIN a
 *    season (it is derived from the live matchup collection this empties) and
 *    would otherwise display last season's grudges until the Monday job ran;
 *  - clears matchupsGeneratedWeek so the UI stops claiming a matchup is running;
 *  - resets the scoring format, which is bought one season at a time;
 *  - advances seasonId;
 *  - zeroes seasonActivity, so a league goes dark the moment the season resets
 *    and lights back up only as its members return and set their corps up.
 *
 * Runs AFTER archiveSeasonResultsLogic (which crowns champions and pays the
 * prize pools out of the state this clears) and BEFORE archiveAndResetProfiles.
 * Deliberately NOT part of archiveSeasonResultsLogic: that function is also
 * reachable on its own through the admin manualTrigger, where wiping live
 * standings mid-season would be destructive.
 *
 * Batches are chunked — archiveSeasonResultsLogic's single un-chunked batch is
 * already near Firestore's 500-op ceiling as leagues grow, and this writes up
 * to three ops per league.
 */
async function resetLeaguesForNewSeason(db, oldSeasonUid, newSeasonUid) {
  const leaguesSnapshot = await db.collection(paths.leagues()).get();
  if (leaguesSnapshot.empty) {
    logger.info("No leagues to roll into the new season.");
    return;
  }

  logger.info(`Rolling ${leaguesSnapshot.size} leagues into season ${newSeasonUid}...`);

  const emptyStandings = { records: {}, standings: [], lastUpdated: new Date() };

  let batch = db.batch();
  let opCount = 0;

  for (const leagueDoc of leaguesSnapshot.docs) {
    const leagueRef = leagueDoc.ref;
    const memberCount = (leagueDoc.data().members || []).length;

    const standingsRef = leagueRef.collection("standings").doc("current");
    const standingsDoc = await standingsRef.get();
    if (standingsDoc.exists) {
      const previous = standingsDoc.data();
      // Only archive a table that actually recorded something — an untouched
      // league shouldn't accumulate empty history docs every season.
      if ((previous.standings || []).length > 0 || Object.keys(previous.records || {}).length > 0) {
        batch.set(leagueRef.collection("standings").doc(oldSeasonUid), {
          ...previous,
          seasonUid: oldSeasonUid,
          archivedAt: new Date(),
        });
        opCount++;
      }
    }

    batch.set(standingsRef, emptyStandings);
    opCount++;

    // Move, don't copy: leaving the live document in place is the bug.
    const [matchupsSnapshot, recapsSnapshot] = await Promise.all([
      leagueRef.collection("matchups").get(),
      leagueRef.collection("recaps").get(),
    ]);

    const weekly = [
      { snapshot: matchupsSnapshot, archivePath: paths.leagueMatchupHistoryWeek },
      { snapshot: recapsSnapshot, archivePath: paths.leagueRecapHistoryWeek },
    ];
    for (const { snapshot, archivePath } of weekly) {
      for (const weekDoc of snapshot.docs) {
        const weekMatch = weekDoc.id.match(/^week-(\d+)$/);
        if (!weekMatch) continue;
        batch.set(db.doc(archivePath(leagueDoc.id, oldSeasonUid, weekMatch[1])), {
          ...weekDoc.data(),
          seasonUid: oldSeasonUid,
          archivedAt: new Date(),
        });
        batch.delete(weekDoc.ref);
        opCount += 2;

        if (opCount >= 400) {
          await batch.commit();
          batch = db.batch();
          opCount = 0;
        }
      }
    }

    batch.delete(db.doc(paths.leagueMeta(leagueDoc.id, "rivalries")));
    opCount++;

    batch.update(leagueRef, {
      seasonId: newSeasonUid,
      matchupsGeneratedWeek: admin.firestore.FieldValue.delete(),
      seasonActivity: emptySeasonActivity(newSeasonUid, memberCount),
      // A pinned announcement is topical — "draft night moved to Thursday"
      // sits above every tab, and one about a season that has ended is worse
      // than none at all.
      announcement: admin.firestore.FieldValue.delete(),
      // An alternate scoring format is bought for ONE season (see
      // callable/leagueFormat.js). Clearing it here is what makes it a
      // recurring CorpsCoin sink rather than a one-time one, and it means a
      // commissioner who has moved on cannot leave their league playing a
      // format none of the current members chose. Resolution requires both the
      // format and its season uid, so this pair being cleared can only ever
      // fail back to the default.
      "settings.scoringFormat": SCORING_FORMATS.TOTAL,
      "settings.scoringFormatSeasonUid": admin.firestore.FieldValue.delete(),
    });

    // Deliberately kept: champions[] (the Hall of Fame), commissioners[], the
    // league's tag and the rest of settings, meta/private (the invite code), chat (a
    // conversation, not season state), activity (its own chronological
    // history), and poolCarry — unclaimed prediction-pool escrow whose whole
    // purpose is to roll into the next pool.
    opCount++;

    if (opCount >= 400) {
      await batch.commit();
      batch = db.batch();
      opCount = 0;
    }
  }

  if (opCount > 0) {
    await batch.commit();
  }

  // Retire the rookie-circuit pointer. It names the circuit new directors are
  // placed into, and that circuit is now full of members from a season that has
  // ended — none of whom have registered for the new one. Leaving it set drops
  // every new director into a league of ghosts. Clearing it makes the next
  // joiner provision a fresh circuit (callable/rookieLeague.js), which is
  // exactly what a new season wants. The counter survives, so circuits keep
  // numbering upward.
  try {
    await db.doc("game-settings/rookie-league").set({ leagueId: null }, { merge: true });
  } catch (error) {
    // A stale pointer is a bad welcome, not a failed rollover.
    logger.error(`Could not retire the rookie-league pointer: ${error.message}`);
  }

  logger.info(`Leagues rolled into ${newSeasonUid}; all season participation reset to zero.`);
}

module.exports = { resetLeaguesForNewSeason };
