/**
 * League Automation System
 *
 * Automated weekly matchup generation, rivalry detection, and recap creation
 * for scaling leagues with hundreds of active ensembles.
 *
 * Schedule:
 * - Sunday 11:59 PM ET: Generate next week's matchups for ALL leagues
 * - Monday 8:00 AM ET: Push notifications sent to users (weeklyMatchupPushJob)
 * - Sunday 10:00 PM ET: Generate weekly recaps for completed week
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { getDb } = require("../config");
const { paths } = require("../helpers/paths");
const { assertAuth, assertWriteBudget } = require("../helpers/callableGuards");
// One pairing implementation, shared with the commissioner callable. The
// scheduled job used to carry a near-identical private copy that had already
// drifted from it (differing bye shape), so automated and manual generation
// could produce structurally different matchup documents.
const {
  smartPairMembers,
  buildPairingHistory,
  recordPairingsInHistory,
} = require("../helpers/leagueHelpers");
const { getCurrentSeasonWeek } = require("../helpers/gameDay");
const { processAllInPages } = require("../helpers/firestorePaging");
const { detectRivalries, generateLeagueRecapsForWeek } = require("../helpers/leagueRecaps");
const { isLeagueCommissioner } = require("../helpers/leaguePermissions");
const {
  isClassActiveThisSeason,
  computeSeasonActivity,
  getActiveSeasonUid,
} = require("../helpers/leagueActivity");

// Corps class configuration — registry-derived (Phase 7.4) so Podium joins
// automated matchup generation when its registry entry enables at launch.
const { MATCHUP_CLASSES: CORPS_CLASSES } = require("../helpers/classRegistry");

/**
 * Calculate current week number from season start date
 */
async function getCurrentWeek(db) {
  const seasonDoc = await db.doc("game-settings/season").get();
  if (!seasonDoc.exists) return 1;
  // Shared week math (helpers/gameDay.js) — also used by the weekly matchup
  // push job, so the generator and the notifier can never disagree.
  return getCurrentSeasonWeek(seasonDoc.data()) || 1;
}

/**
 * SCHEDULED: Make sure every league has matchups for the weeks it needs.
 *
 * Runs DAILY, not on a fixed Sunday slot. The old `59 23 * * 0` schedule
 * assumed a season week boundary always lands on Sunday night, but weeks are
 * `ceil((activeDay - springTrainingDays) / 7)` from the season's start date
 * (helpers/gameDay.js) — nothing makes those agree, and nothing asserted it. A
 * season starting on a Wednesday generated its matchups mid-week, and a single
 * missed firing left a league with no matchups for a whole week.
 *
 * Generation is already idempotent (an existing week document is skipped), so
 * running daily is free when there is nothing to do and self-healing when
 * there is: a league created mid-week gets matchups immediately instead of
 * waiting for Sunday, and a failed run is retried within a day.
 *
 * Both the CURRENT and the NEXT week are ensured. Pairing reads standings that
 * are settled through the previous week either way — the Sunday job had exactly
 * the same staleness, because the week it followed did not resolve until the
 * nightly run hours later.
 */
exports.generateWeeklyMatchups = onSchedule(
  {
    schedule: "0 6 * * *", // Daily 6:00 AM ET, after the nightly scoring run
    timeZone: "America/New_York",
    // Pages through every league with per-league profile/standings reads — the
    // default 60s timeout would cut the job off mid-scan as leagues grow. 540s
    // matches the scoring jobs (see dailyProcessors.js).
    timeoutSeconds: 540,
    memory: "512MiB",
    cpu: 1,
  },
  async () => {
    logger.info("Ensuring league matchups exist for the current and next week");

    const db = getDb();

    try {
      // Get current week
      const currentWeek = await getCurrentWeek(db);
      const targetWeeks = [currentWeek, currentWeek + 1];

      // Pairing is season-scoped (see the grouping loop below); without a live
      // season there is nobody registered to pair.
      const seasonUid = await getActiveSeasonUid(db);
      if (!seasonUid) {
        logger.warn("No active season; skipping weekly matchup generation.");
        return;
      }

      logger.info(`Ensuring matchups for weeks ${targetWeeks.join(" and ")}`);

      let leaguesProcessed = 0;
      let matchupsGenerated = 0;
      let errors = [];

      // Page through every league rather than reading them all at once: this
      // job does per-league profile and standings reads, so an unbounded fetch
      // grows its memory and its time with the league count until the 540s
      // timeout cuts it off mid-scan (see helpers/firestorePaging).
      const leaguesRef = db.collection(paths.leagues());
      const leagueResults = await processAllInPages(leaguesRef, 500, async (leagueDoc) => {
        try {
          const league = leagueDoc.data();
          const leagueId = leagueDoc.id;
          const members = league.members || [];

          if (members.length < 2) {
            return { skipped: true };
          }

          // Which of the target weeks still need generating. A week counts as
          // needing one if its document is absent OR belongs to a PREVIOUS
          // season: matchup documents are keyed by week number alone, so before
          // rollover started archiving them, last season's week-1 was still
          // sitting there and this skip made a league that finished one season
          // never receive matchups again. Regenerating over a stale document is
          // the self-heal for leagues already in that state.
          const weekRefs = targetWeeks.map((w) => db.doc(paths.leagueMatchupWeek(leagueId, w)));
          const weekDocs = await db.getAll(...weekRefs);
          const missingWeeks = targetWeeks.filter((_, i) => {
            const doc = weekDocs[i];
            if (!doc.exists) return true;
            const docSeason = doc.data().seasonUid;
            return Boolean(docSeason) && docSeason !== seasonUid;
          });

          if (missingWeeks.length === 0) {
            return { skipped: true };
          }

          // Fetch member profiles, standings, and the league's matchup history
          // in parallel (profile field mask: only activeSeasonId + corps feed
          // isClassActiveThisSeason below). The history is what stops the
          // generator handing the same two directors to each other every week
          // and the same director the bye every week.
          const [profileDocs, standingsDoc, historySnapshot] = await Promise.all([
            db.getAll(
              ...members.map(memberId => db.doc(paths.userProfile(memberId))),
              { fieldMask: ["activeSeasonId", "corps"] }
            ),
            db.doc(paths.leagueStandings(leagueId)).get(),
            db.collection(paths.leagueMatchups(leagueId)).get()
          ]);
          const pairingHistory = buildPairingHistory(
            historySnapshot.docs.map((d) => d.data()),
            CORPS_CLASSES
          );

          const standingsData = standingsDoc.exists ? standingsDoc.data()?.standings || [] : [];
          const standings = {};
          standingsData.forEach((s, idx) => {
            standings[s.uid] = { ...s, rank: idx + 1 };
          });

          // Group members by corps class — REGISTERED FOR THE LIVE SEASON
          // only. corpsName survives season rollover by design
          // (helpers/season.js), so testing it alone paired every director who
          // had ever named a corps into every future season's matchups: active
          // directors drew absent opponents who score 0, and ghost-inflated
          // odd counts handed out meaningless byes. See helpers/leagueActivity.js.
          const membersByClass = Object.fromEntries(CORPS_CLASSES.map((c) => [c, []]));

          profileDocs.forEach((doc, index) => {
            const memberId = members[index];
            if (doc.exists) {
              const profileData = doc.data();

              for (const corpsClass of CORPS_CLASSES) {
                if (isClassActiveThisSeason(profileData, corpsClass, seasonUid)) {
                  membersByClass[corpsClass].push(memberId);
                }
              }
            }
          });

          // Generate each missing week in order, folding each week back into
          // the pairing history so generating two weeks at once cannot hand the
          // same two directors to each other twice.
          let leagueMatchups = 0;
          for (const week of missingWeeks) {
            const matchupData = {
              week,
              // Stamped so a stale week is recognisable as stale. Without it a
              // week document is indistinguishable from one written a season ago.
              seasonUid,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              autoGenerated: true,
              pairs: []
            };

            for (const corpsClass of CORPS_CLASSES) {
              const matchupArrayKey = `${corpsClass}Matchups`;
              matchupData[matchupArrayKey] = smartPairMembers(
                membersByClass[corpsClass],
                standings,
                pairingHistory
              );
              leagueMatchups += matchupData[matchupArrayKey].filter(m => !m.isBye).length;
            }

            await db.doc(paths.leagueMatchupWeek(leagueId, week)).set(matchupData);
            recordPairingsInHistory(pairingHistory, matchupData, CORPS_CLASSES);
          }

          // The league card reads this to show "Matchup in progress". Only the
          // commissioner path used to set it, so auto-generated leagues — i.e.
          // nearly all of them — never showed the indicator.
          await leagueDoc.ref.update({
            matchupsGeneratedWeek: Math.max(...missingWeeks),
          });

          logger.info(
            `Generated matchups for league ${leagueId}: weeks ${missingWeeks.join(", ")}`
          );

          return { processed: 1, matchupsCount: leagueMatchups };
        } catch (leagueError) {
          logger.error(`Error processing league ${leagueDoc.id}:`, leagueError);
          return { error: { leagueId: leagueDoc.id, error: leagueError.message } };
        }
      });

      for (const result of leagueResults) {
        if (result.error) errors.push(result.error);
        else if (!result.skipped) {
          leaguesProcessed++;
          matchupsGenerated += result.matchupsCount;
        }
      }

      // Log summary
      logger.info(`Weekly matchup generation complete: ${leaguesProcessed} leagues processed, ${matchupsGenerated} matchups created`);

      if (errors.length > 0) {
        logger.warn(`Errors encountered: ${JSON.stringify(errors)}`);
      }

    } catch (error) {
      logger.error("Fatal error in weekly matchup generation:", error);
      throw error;
    }
  }
);

/**
 * SCHEDULED: Backstop weekly recap generation.
 *
 * The primary path is the nightly scoring run, which generates a week's recap
 * immediately after processWeeklyMatchups resolves it (helpers/leagueRecaps.js).
 * This job exists only to repair a week whose nightly generation failed.
 *
 * It runs MONDAY 07:00 ET, not Sunday 22:00. The old Sunday-evening slot was
 * before the nightly run that resolves the week, and the recap generator skips
 * matchups that are not completed — so every recap it ever wrote had an empty
 * highlights[] and null stats.
 */
exports.generateWeeklyRecaps = onSchedule(
  {
    schedule: "0 7 * * 1", // Monday 7:00 AM ET — after the night that resolves the week
    timeZone: "America/New_York",
    // Pages through every league with per-league matchup/profile reads — the
    // default 60s timeout would cut the job off mid-scan as leagues grow. 540s
    // matches the scoring jobs (see dailyProcessors.js).
    timeoutSeconds: 540,
    memory: "512MiB",
    cpu: 1,
  },
  async () => {
    const db = getDb();

    // The week that just ENDED is the one to summarize. getCurrentWeek at
    // Monday morning already reports the new week, so step back one.
    const week = (await getCurrentWeek(db)) - 1;
    if (week < 1) {
      logger.info("No completed week to recap yet.");
      return;
    }

    logger.info(`Backstop recap generation for week ${week}`);
    await generateLeagueRecapsForWeek(db, week);
  }
);

/**
 * SCHEDULED: Update rivalry data for all leagues
 * Runs Monday 6:00 AM ET after matchups are generated
 */
exports.updateLeagueRivalries = onSchedule(
  {
    schedule: "0 6 * * 1", // Monday 6:00 AM
    timeZone: "America/New_York",
    // Pages through every league with a matchup-history read per league — the
    // default 60s timeout would cut the job off mid-scan as leagues grow. 540s
    // matches the sibling league jobs above.
    timeoutSeconds: 540,
    memory: "256MiB",
    cpu: 1,
  },
  async () => {
    logger.info("Starting league rivalry update");

    const db = getDb();

    try {
      let rivalriesUpdated = 0;
      const seasonUid = await getActiveSeasonUid(db);

      // Page through every league (see helpers/firestorePaging) — no silent cap.
      const leaguesRef = db.collection(paths.leagues());
      const rivalryResults = await processAllInPages(leaguesRef, 500, async (leagueDoc) => {
        try {
          const leagueId = leagueDoc.id;
          const league = leagueDoc.data();
          const members = league.members || [];

          if (members.length < 2) return { skipped: true };

          // Fetch all matchup history
          const matchupHistorySnapshot = await db
            .collection(paths.leagueMatchups(leagueId))
            .get();

          const matchupHistory = {};
          matchupHistorySnapshot.forEach(doc => {
            matchupHistory[doc.id] = { ...doc.data(), week: parseInt(doc.id.replace('week-', '')) };
          });

          // Detect rivalries
          const rivalries = detectRivalries(matchupHistory);

          // Written unconditionally, and stamped with the season it describes.
          // Skipping the write when the list came back empty meant a league
          // that lost its rivalries — a rematch-free season, a departed member,
          // a fresh season — kept displaying the previous set forever, with no
          // way to tell how old it was.
          await db.doc(paths.leagueMeta(leagueId, "rivalries")).set({
            rivalries,
            seasonUid: seasonUid || null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          return rivalries.length > 0 ? { updated: 1 } : { cleared: 1 };
        } catch (leagueError) {
          logger.error(`Error updating rivalries for league ${leagueDoc.id}:`, leagueError);
          return { skipped: true };
        }
      });

      rivalriesUpdated = rivalryResults.filter(r => r.updated).length;

      logger.info(`Rivalry update complete: ${rivalriesUpdated} leagues updated`);

    } catch (error) {
      logger.error("Fatal error in rivalry update:", error);
      throw error;
    }
  }
);

/**
 * CALLABLE: Manual trigger for matchup generation (admin only)
 * Allows admins to force matchup generation for a specific week
 */
exports.triggerMatchupGeneration = onCall(
  { cors: true },
  async (request) => {
    assertAuth(request);

    const { leagueId, week, forceRegenerate } = request.data;
    const uid = request.auth.uid;

    if (!leagueId) {
      throw new HttpsError("invalid-argument", "League ID is required.");
    }

    const db = getDb();

    // Abuse throttle (commissioner-only mutation, but still per-uid capped
    // so a scripted caller can't hammer matchup regeneration).
    await assertWriteBudget(db, uid, "leagueAdmin", { max: 10, windowMs: 60 * 60 * 1000 });

    // Check if user is commissioner
    const leagueRef = db.doc(paths.league(leagueId));
    const leagueDoc = await leagueRef.get();

    if (!leagueDoc.exists) {
      throw new HttpsError("not-found", "League not found.");
    }

    const league = leagueDoc.data();

    if (!isLeagueCommissioner(league, uid)) {
      throw new HttpsError("permission-denied", "Only a commissioner can trigger matchup generation.");
    }

    const targetWeek = week || (await getCurrentWeek(db)) + 1;
    const matchupRef = db.doc(paths.leagueMatchupWeek(leagueId, targetWeek));

    // Resolved before the existence check below, which needs it. Pairing is
    // season-scoped anyway (see helpers/leagueActivity.js).
    const seasonUid = await getActiveSeasonUid(db);
    if (!seasonUid) {
      throw new HttpsError("failed-precondition", "No active season.");
    }

    // A week stamped with a PREVIOUS season is not "already generated" — see
    // the scheduled generator above and resetLeaguesForNewSeason.
    const existingMatchup = await matchupRef.get();
    if (existingMatchup.exists && !forceRegenerate) {
      const existingSeason = existingMatchup.data().seasonUid;
      if (!existingSeason || existingSeason === seasonUid) {
        throw new HttpsError("already-exists", `Matchups for week ${targetWeek} already exist. Set forceRegenerate to true to overwrite.`);
      }
    }

    const members = league.members || [];
    if (members.length < 2) {
      throw new HttpsError("failed-precondition", "Need at least 2 members to generate matchups.");
    }

    // Fetch member profiles (field mask: only activeSeasonId + corps feed
    // isClassActiveThisSeason below).
    const profileRefs = members.map(memberId =>
      db.doc(paths.userProfile(memberId))
    );
    const profileDocs = await db.getAll(...profileRefs, {
      fieldMask: ["activeSeasonId", "corps"],
    });

    // Build standings and the matchup history that steers pairing away from
    // rematches and repeated byes (helpers/leagueHelpers.js).
    const standingsDoc = await db.doc(paths.leagueStandings(leagueId)).get();
    const standingsData = standingsDoc.exists ? standingsDoc.data()?.standings || [] : [];
    const standings = {};
    standingsData.forEach((s, idx) => {
      standings[s.uid] = { ...s, rank: idx + 1 };
    });
    const historySnapshot = await db.collection(paths.leagueMatchups(leagueId)).get();
    const pairingHistory = buildPairingHistory(
      historySnapshot.docs.filter((d) => d.id !== `week-${targetWeek}`).map((d) => d.data()),
      CORPS_CLASSES
    );

    // Group by corps class — registered-this-season only, matching the
    // scheduled generator (see helpers/leagueActivity.js).
    const membersByClass = Object.fromEntries(CORPS_CLASSES.map((c) => [c, []]));

    profileDocs.forEach((doc, index) => {
      const memberId = members[index];
      if (doc.exists) {
        const profileData = doc.data();
        for (const corpsClass of CORPS_CLASSES) {
          if (isClassActiveThisSeason(profileData, corpsClass, seasonUid)) {
            membersByClass[corpsClass].push(memberId);
          }
        }
      }
    });

    // Generate with smart pairing
    const matchupData = {
      week: targetWeek,
      seasonUid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      autoGenerated: false,
      triggeredBy: uid,
      pairs: []
    };

    for (const corpsClass of CORPS_CLASSES) {
      matchupData[`${corpsClass}Matchups`] = smartPairMembers(
        membersByClass[corpsClass],
        standings,
        pairingHistory
      );
    }

    await matchupRef.set(matchupData);
    await leagueRef.update({ matchupsGeneratedWeek: targetWeek });

    return {
      success: true,
      message: `Matchups generated for week ${targetWeek}`,
      matchups: {
        worldClass: matchupData.worldClassMatchups?.length || 0,
        openClass: matchupData.openClassMatchups?.length || 0,
        aClass: matchupData.aClassMatchups?.length || 0,
        soundSport: matchupData.soundSportMatchups?.length || 0
      }
    };
  }
);

/**
 * SCHEDULED: Recompute every league's season participation.
 *
 * The authoritative pass behind `seasonActivity` (helpers/leagueActivity.js).
 * The incremental writers — createLeague, join/leave, commissioner removal, and
 * the post-registration hooks in registerCorps/processCorpsDecisions — keep the
 * block fresh in the common cases; this job is what guarantees it converges
 * anyway: it repairs anything a best-effort hook swallowed, and it backfills
 * leagues created before the block existed (which are otherwise invisible to
 * the discovery query, since Firestore inequality filters skip documents
 * missing the field).
 *
 * Runs daily, after the nightly scoring pass has settled.
 */
exports.refreshLeagueActivityJob = onSchedule(
  {
    schedule: "30 5 * * *", // 5:30 AM ET, after nightly scoring
    timeZone: "America/New_York",
    timeoutSeconds: 540,
    memory: "512MiB",
    cpu: 1,
  },
  async () => {
    const db = getDb();

    const seasonUid = await getActiveSeasonUid(db);
    if (!seasonUid) {
      logger.warn("No active season; skipping league activity refresh.");
      return;
    }

    let leaguesUpdated = 0;
    let activeLeagues = 0;

    const leaguesRef = db.collection(paths.leagues());
    await processAllInPages(leaguesRef, 500, async (leagueDoc) => {
      try {
        const members = leagueDoc.data().members || [];
        // Field mask: computeSeasonActivity → isActiveThisSeason reads only
        // activeSeasonId + corps from each profile.
        const profileDocs = members.length
          ? await db.getAll(...members.map((uid) => db.doc(paths.userProfile(uid))), {
              fieldMask: ["activeSeasonId", "corps"],
            })
          : [];

        const seasonActivity = computeSeasonActivity(members, profileDocs, seasonUid);
        // Skip the write when nothing changed (ignoring the updatedAt stamp) —
        // on a quiet day this job is otherwise one write per league.
        const prior = leagueDoc.data().seasonActivity;
        const unchanged =
          prior &&
          prior.seasonUid === seasonActivity.seasonUid &&
          prior.activeMemberCount === seasonActivity.activeMemberCount &&
          prior.totalMemberCount === seasonActivity.totalMemberCount &&
          Array.isArray(prior.activeMembers) &&
          prior.activeMembers.length === seasonActivity.activeMembers.length &&
          prior.activeMembers.every((uid, i) => uid === seasonActivity.activeMembers[i]);
        if (!unchanged) {
          await leagueDoc.ref.update({ seasonActivity });
          leaguesUpdated++;
        }

        if (seasonActivity.activeMemberCount > 0) activeLeagues++;
        return { processed: 1 };
      } catch (error) {
        logger.error(`Failed to refresh activity for league ${leagueDoc.id}:`, error);
        return { error: error.message };
      }
    });

    logger.info(
      `League activity refresh complete: ${leaguesUpdated} leagues updated, ` +
      `${activeLeagues} with at least one director registered for ${seasonUid}.`
    );
  }
);

module.exports = {
  generateWeeklyMatchups: exports.generateWeeklyMatchups,
  generateWeeklyRecaps: exports.generateWeeklyRecaps,
  updateLeagueRivalries: exports.updateLeagueRivalries,
  triggerMatchupGeneration: exports.triggerMatchupGeneration,
  refreshLeagueActivityJob: exports.refreshLeagueActivityJob
};
