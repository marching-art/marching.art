const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
const { Timestamp } = require("firebase-admin/firestore");
const admin = require("firebase-admin");
const {
  TRANSACTION_TYPES,
  addCoinHistoryEntryToBatch,
  getSeasonBonusAmount,
} = require("./economy");
const { calculateXPUpdates, getSeasonCompletionXP } = require("./xpCalculations");
const { updateSeasonBestRecords } = require("./gameRecords");
const { resetLeaguesForNewSeason } = require("./leagueSeasonReset");
const { archiveSeasonResultsLogic } = require("./leagueArchival");
const { fetchSeasonParticipation, corpsSeason } = require("./seasonParticipation");
const { paths } = require("./paths");
const {
  seasonDetailId,
  splitSeasonRecord,
  compactEquippedUniform,
} = require("./seasonHistoryRecord");
const {
  claimSeasonRollover,
  markSeasonRolloverCompleted,
  markSeasonRolloverFailed,
} = require("./scoringRunGuard");
const {
  applyEnrichment,
  brandEventName,
  scraperInvokeKey,
  writeScheduleToSubcollection,
  writeScheduleToCollection,
  getScheduleDay,
  getScheduleDays,
  getAllScheduleDays,
  updateScheduleDay,
  addShowToDay,
  shuffleArray,
} = require("./seasonSchedule");
const {
  generateLiveSeasonSchedule,
  generateOffSeasonSchedule,
  calculateOffSeasonDay,
  getThematicOffSeasonName,
  getNextOffSeasonWindow,
  getLiveSeasonWindow,
  isLiveSeasonTime,
  getFinalsDateOverrides,
} = require("./scheduleGeneration");
const {
  showMatchKey,
  mergeScheduleRefresh,
  refreshLiveSeasonSchedule,
} = require("./scheduleRefresh");



/**
 * Archive every active profile's season, pay season-finish rewards, and reset
 * corps for the new season. Shared by startNewLiveSeason and startNewOffSeason
 * (the two previously carried identical copies of this loop).
 *
 * "Participated" has ONE definition here: the corps competed in at least one
 * show (or carries a score). It gates rankings, completion XP, the finish
 * bonus, the recap line, AND lifetimeStats.totalSeasons — the same counter
 * the seasons-completed class unlock and the finish_season journey step read.
 * A corps with a filled lineup that never competed is still archived to
 * seasonHistory (the historical record) and reset, but earns nothing and
 * occupies no rank slot. (Previously the award gate was `lineup || score>0`
 * while totalSeasons required actual shows — a lineup-only corps was paid
 * completion XP yet never advanced totalSeasons.)
 *
 * Every per-season figure — participation, shows attended, best week — now
 * comes from the season's recap days via helpers/seasonParticipation.js, not
 * from profile fields. The fields lied: `selectedShows` is keyed by week, so it
 * counted weeks with picks rather than shows competed in, and `weeklyScores`
 * is never written by anything, so best week was always zero.
 *
 * For each corps that participated:
 * - placement within its class is computed and archived to seasonHistory
 * - a CorpsCoin finish bonus is paid per SEASON_FINISH_BONUSES (top 25;
 *   SoundSport is non-competitive so it earns no rank-based coin)
 * - season-completion XP is awarded per getSeasonCompletionXP
 * - a pendingSeasonRecap summary is written to the profile so the client can
 *   show a "Season Complete" recap modal (client clears the field on dismiss)
 */

/**
 * The single participation test: competed in ≥1 show, or carries points.
 *
 * `participation` is the season's recap-derived index
 * (helpers/seasonParticipation.js). It is optional so the predicate stays
 * usable where no index has been built; without one this falls back to the
 * profile's own score, which is non-zero only for a corps the nightly run
 * actually scored.
 *
 * It deliberately no longer consults `selectedShows`. That map is keyed by
 * WEEK, so it counted weeks a director made picks in — and since selecting
 * shows requires no lineup while scoring requires a complete one, a corps that
 * never took the field could pick shows all season and still be paid for
 * finishing it.
 *
 * @param {Object} corps - one entry of profileData.corps
 * @param {{index?: Map<string, Object>, uid?: string, corpsClass?: string}} [context]
 */
function corpsParticipatedThisSeason(corps, context = {}) {
  const { index, uid, corpsClass } = context;
  if (index && uid && corpsClass) {
    return corpsSeason(index, uid, corpsClass, corps).participated;
  }
  return (corps.totalSeasonScore || 0) > 0;
}

async function archiveAndResetProfiles(db, oldSeasonUid, newSeasonUid) {
  const profilesQuery = db.collectionGroup("profile").where("activeSeasonId", "==", oldSeasonUid);
  const profilesSnapshot = await profilesQuery.get();

  if (profilesSnapshot.empty) return;

  // What every corps actually did, from the recap days — one read of at most
  // 49 documents, shared by every profile below.
  const participation = await fetchSeasonParticipation(db, oldSeasonUid);

  logger.info(`Resetting ${profilesSnapshot.size} user profiles from season ${oldSeasonUid}...`);

  // Build class rankings from all profiles before archiving.
  // Keyed by the user's uid (doc.ref.parent.parent.id) — every profile doc in
  // the collectionGroup has the same doc.id ("data"), so keying by doc.id
  // made findIndex match the first entry and archived placement 1 for everyone.
  const classRankings = {}; // Map<classKey, Array<{uid, totalSeasonScore, corpsName, displayName}>>
  for (const doc of profilesSnapshot.docs) {
    const uid = doc.ref.parent.parent.id;
    const profileData = doc.data();
    const corpsData = profileData.corps || {};
    Object.keys(corpsData).forEach((corpsClass) => {
      const corps = corpsData[corpsClass];
      // Only corps that actually competed occupy a rank slot — a lineup-only
      // corps at 0 points must not inflate totalInClass or push real
      // competitors' placements down.
      if (corpsParticipatedThisSeason(corps, { index: participation, uid, corpsClass })) {
        if (!classRankings[corpsClass]) {
          classRankings[corpsClass] = [];
        }
        classRankings[corpsClass].push({
          uid,
          totalSeasonScore: corps.totalSeasonScore || 0,
          corpsName: corps.corpsName || null,
          displayName: profileData.username || profileData.displayName || null,
        });
      }
    });
  }
  // Sort each class by score descending to determine rankings
  Object.keys(classRankings).forEach((classKey) => {
    classRankings[classKey].sort((a, b) => b.totalSeasonScore - a.totalSeasonScore);
  });
  logger.info(`Computed rankings for ${Object.keys(classRankings).length} classes`);

  let batch = db.batch();
  let opCount = 0; // counts every write in the batch (profile + coin history)

  for (const doc of profilesSnapshot.docs) {
    const uid = doc.ref.parent.parent.id;
    const profileData = doc.data();
    const corpsData = profileData.corps || {};
    // Defaulted FIELD BY FIELD, not as a whole object. A profile carrying a
    // partial `lifetimeStats` — one written before a field existed, or by any
    // path that sets only the counters it cares about — skipped the fallback
    // entirely, and the two Math.max calls below then wrote `Math.max(undefined,
    // n)`, which is NaN. Once a career best is NaN it stays NaN forever (every
    // later Math.max propagates it), the profile renders NaN, and the lifetime
    // leaderboard reads it as zero — the two disagree permanently.
    const lifetimeStats = {
      totalSeasons: 0,
      totalShows: 0,
      totalPoints: 0,
      bestSeasonScore: 0,
      bestWeeklyScore: 0,
      leagueChampionships: 0,
      ...(profileData.lifetimeStats || {}),
    };

    // Archive current season data and reset corps
    const resetCorps = {};
    // Heavy per-season detail (full lineup + show picks) is written to the
    // seasonDetail subcollection instead of onto the profile's seasonHistory
    // summary rows — collected here and added to the same chunked batch as the
    // profile update below. See helpers/seasonHistoryRecord.js.
    const detailWrites = [];
    let seasonShowCount = 0;
    let seasonPointsTotal = 0;
    const seasonAwards = []; // one entry per active corps: recap + payout data
    // Snapshot the pre-season career bests so the recap can call out a new
    // personal best (self-competition retains directors who'll never be #1).
    const previousBestSeasonScore = lifetimeStats.bestSeasonScore || 0;

    Object.keys(corpsData).forEach((corpsClass) => {
      const corps = corpsData[corpsClass];
      const seasonHistory = corps.seasonHistory || [];

      const season = corpsSeason(participation, uid, corpsClass, corps);
      const participated = season.participated;

      // Archive if the corps was set up at all (lineup) or participated —
      // the seasonHistory record is historical, not a reward.
      if (corps.lineup || participated) {
        // Both from the recap days. `showsAttended` used to be the number of
        // WEEKS the director had picks saved for, and `highestWeeklyScore` came
        // from `corps.weeklyScores`, which nothing in the codebase has ever
        // written — so every archived season recorded a best week of zero.
        const showsAttended = season.shows;
        const highestWeeklyScore = season.bestWeek;

        // Find placement for this corps in its class (participants only;
        // a lineup-only corps was never ranked, so placement stays null)
        const classRanking = classRankings[corpsClass] || [];
        const rankIndex = classRanking.findIndex((r) => r.uid === uid);
        const placement = rankIndex >= 0 ? rankIndex + 1 : null;

        // Season-finish rewards — participants only (the same gate as
        // lifetimeStats.totalSeasons below). SoundSport is deliberately
        // non-competitive (medals, no numeric standings), so it earns
        // completion XP but no rank-based coin bonus.
        if (participated) {
          const coinBonus =
            corpsClass === "soundSport" ? 0 : getSeasonBonusAmount(placement).amount;
          const xpBonus = getSeasonCompletionXP(placement, classRanking.length);
          seasonAwards.push({
            corpsClass,
            corpsName: corps.corpsName || null,
            placement,
            totalInClass: classRanking.length,
            totalSeasonScore: corps.totalSeasonScore || 0,
            coinBonus,
            xpBonus,
            // Personal best: beat every season you've ever played
            newBestSeason:
              (corps.totalSeasonScore || 0) > previousBestSeasonScore &&
              (corps.totalSeasonScore || 0) > 0,
          });
        }

        // Archive this season's performance. The show concept (title +
        // theme/music/drill) is part of the historical record — the corps
        // history a director looks back on — even though the live field
        // resets for the new season.
        //
        // The bulky lineup / show-pick fields are split off into a seasonDetail
        // doc (helpers/seasonHistoryRecord.js) so they never ride along on the
        // hot profile document; the lean summary row is what stays on the
        // profile and feeds the chart, rating, and career aggregates.
        const archivedAt = new Date();
        const { summary, detail } = splitSeasonRecord({
          seasonId: oldSeasonUid,
          seasonName: oldSeasonUid,
          corpsClass,
          corpsName: corps.corpsName || null,
          location: corps.location || null,
          showConcept: corps.showConcept?.theme ? corps.showConcept : null,
          lineup: corps.lineup || null,
          selectedShows: corps.selectedShows || {},
          weeklyScores: corps.weeklyScores || {},
          totalSeasonScore: corps.totalSeasonScore || 0,
          showsAttended,
          highestWeeklyScore,
          placement,
          // Uniform History (docs/UNIFORM_STUDIO.md §6): the compact look
          // ({designId, name, colors}) stays on the summary row for the
          // timeline; the full renderable snapshot rides the detail doc.
          uniform: compactEquippedUniform(corps.uniform),
          uniformSnapshot: corps.uniform
            ? {
                name: corps.uniform.name || null,
                colorway: corps.uniform.colorway || null,
                figure: corps.uniform.figure || null,
              }
            : null,
          archivedAt,
        });
        seasonHistory.push(summary);
        if (detail) {
          detailWrites.push({
            ref: db.doc(paths.userSeasonDetail(uid, seasonDetailId(oldSeasonUid, corpsClass))),
            data: { seasonId: oldSeasonUid, corpsClass, ...detail, archivedAt },
          });
        }

        seasonShowCount += showsAttended;
        seasonPointsTotal += corps.totalSeasonScore || 0;

        // Update lifetime stats. Both sides are coalesced: a stored null (as
        // opposed to a missing key, which the defaults above cover) would
        // otherwise poison the career best with NaN for good.
        lifetimeStats.bestSeasonScore = Math.max(
          lifetimeStats.bestSeasonScore || 0,
          corps.totalSeasonScore || 0
        );
        lifetimeStats.bestWeeklyScore = Math.max(
          lifetimeStats.bestWeeklyScore || 0,
          highestWeeklyScore || 0
        );
      }

      resetCorps[corpsClass] = {
        // PRESERVE: Historical data
        corpsName: corps.corpsName || null,
        location: corps.location || null,
        seasonHistory,
        // PRESERVE: Director-designed branding and ensemble identity across seasons
        uniformDesign: corps.uniformDesign || null,
        // The equipped Uniform Studio looks are corps identity, not season
        // data — without these two lines every rollover silently stripped the
        // equipped design (and the alternate) off every corps.
        uniform: corps.uniform || null,
        uniformAlt: corps.uniformAlt || null,
        avatarUrl: corps.avatarUrl || null,
        // avatarSource pairs with avatarUrl (custom vs AI) — dropping it made
        // a director-supplied avatar look AI-generated after rollover.
        avatarSource: corps.avatarSource || null,
        avatarGeneratedAt: corps.avatarGeneratedAt || null,
        ensembleInfo: corps.ensembleInfo || null,
        // RESET: Season-specific data (including weeklyTrades so users can set up corps)
        // NOTE: this literal deliberately omits `seasonUid` — the per-corps
        // season stamp league participation reads (helpers/leagueActivity.js).
        // Dropping it here is what makes every corps go dormant at rollover,
        // so never "preserve" it by spreading `corps` into this object.
        weeklyTrades: null,
        lineup: null,
        lineupKey: null,
        selectedShows: {},
        weeklyScores: {},
        totalSeasonScore: 0,
      };
    });

    // Update lifetime stats
    if (seasonShowCount > 0 || seasonPointsTotal > 0) {
      lifetimeStats.totalSeasons = (lifetimeStats.totalSeasons || 0) + 1;
      lifetimeStats.totalShows = (lifetimeStats.totalShows || 0) + seasonShowCount;
      lifetimeStats.totalPoints = (lifetimeStats.totalPoints || 0) + seasonPointsTotal;
    }

    // Reset corps data for new season but DON'T update activeSeasonId yet.
    // This allows the SeasonSetupWizard to detect the season mismatch and show
    // the corps verification step (Step 0) where users can choose to continue,
    // retire, or start a new corps. activeSeasonId gets updated by processCorpsDecisions
    // after the user makes their decisions.
    // NOTE: no retiredCorps write here — batch.update only touches listed
    // fields, so "preserving" it was a no-op that could only ever clobber a
    // concurrent retire/unretire/plaque purchase landing between the
    // snapshot read and this batch's commit.
    const updateData = {
      corps: resetCorps,
      lifetimeStats,
      // Clear the nightly-scoring idempotency ledger (helpers/awardLedger.js):
      // its tokens are scoped to the closing season, so a fresh season starts
      // with an empty ledger and it never accumulates across seasons.
      awardLedger: admin.firestore.FieldValue.delete(),
    };

    // Season-finish payouts (coin + XP) and the recap the client shows once.
    // Pass the freshly-incremented lifetimeStats explicitly: completing
    // season N must unlock the seasons-gated class in this same write (the
    // "graduation" lands with the recap), not on some later XP event.
    const totalCoin = seasonAwards.reduce((sum, a) => sum + a.coinBonus, 0);
    const totalXP = seasonAwards.reduce((sum, a) => sum + a.xpBonus, 0);
    if (totalXP > 0) {
      Object.assign(
        updateData,
        calculateXPUpdates({ ...profileData, lifetimeStats }, totalXP).updates
      );
      // calculateXPUpdates emits xp as a plain total computed from the
      // query snapshot, which can be minutes stale by the time this chunked
      // batch commits — a claimDailyLogin or challenge completed in that
      // window would be silently erased. Award the season XP as an
      // increment instead; xpLevel/userTitle stay plain-set and reconcile
      // on the next claim (the codebase's lazy-recompute convention).
      updateData.xp = admin.firestore.FieldValue.increment(totalXP);
    }

    // Reset the seasonal reward ladder: new baseline is the post-award XP
    // total, and tier claims reset with the new seasonUid.
    updateData.xpAtSeasonStart = (profileData.xp || 0) + totalXP;
    updateData.seasonLadder = null;
    if (totalCoin > 0) {
      updateData.corpsCoin = admin.firestore.FieldValue.increment(totalCoin);
    }
    if (seasonAwards.length > 0) {
      updateData.pendingSeasonRecap = {
        seasonId: oldSeasonUid,
        seasonName: oldSeasonUid,
        results: seasonAwards,
        totalCoin,
        totalXP,
        awardedAt: new Date(),
      };
    }

    batch.update(doc.ref, updateData);
    opCount++;

    // Season detail docs for this profile — one per archived corps that had a
    // lineup / show picks. Part of the same chunked batch so they commit
    // atomically with the summary rows that point at them.
    for (const { ref, data } of detailWrites) {
      batch.set(ref, data);
      opCount++;
    }

    for (const award of seasonAwards) {
      if (award.coinBonus > 0) {
        const { rankDescription } = getSeasonBonusAmount(award.placement);
        addCoinHistoryEntryToBatch(batch, db, uid, {
          type: TRANSACTION_TYPES.SEASON_BONUS,
          amount: award.coinBonus,
          description: `${rankDescription} in ${oldSeasonUid} (${award.corpsClass})`,
          finalRank: award.placement,
          corpsClass: award.corpsClass,
          timestamp: new Date(),
        });
        opCount++;
      }
    }

    if (opCount >= 400) {
      logger.info(`Committing batch of ${opCount} season-archival writes...`);
      await batch.commit();
      batch = db.batch();
      opCount = 0;
    }
  }

  if (opCount > 0) {
    await batch.commit();
  }

  // Records Book: each class's top season total is a best-season candidate.
  const topFinishers = Object.entries(classRankings)
    .filter(([, ranking]) => ranking.length > 0)
    .map(([corpsClass, ranking]) => ({
      corpsClass,
      value: ranking[0].totalSeasonScore,
      corpsName: ranking[0].corpsName,
      displayName: ranking[0].displayName,
      uid: ranking[0].uid,
    }));
  await updateSeasonBestRecords(db, topFinishers, oldSeasonUid);

  logger.info(`Successfully auto-continued all user corps into new season: ${newSeasonUid}`);
}


/**
 * Delete every activeLineups doc belonging to the finished season.
 * Shared by startNewLiveSeason and startNewOffSeason.
 */
async function clearActiveLineups(db, oldSeasonUid) {
  logger.info(`Clearing active lineups from season ${oldSeasonUid}...`);
  const activeLineupsQuery = db.collection("activeLineups").where("seasonId", "==", oldSeasonUid);
  const lineupSnapshot = await activeLineupsQuery.get();

  if (lineupSnapshot.empty) {
    logger.info("No active lineups found to clear");
    return;
  }

  logger.info(`Found ${lineupSnapshot.size} active lineups to clear...`);

  let batch = db.batch();
  let batchCount = 0;

  for (const doc of lineupSnapshot.docs) {
    batch.delete(doc.ref);
    batchCount++;

    if (batchCount >= 400) {
      logger.info(`Committing batch of ${batchCount} lineup deletions...`);
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  logger.info(`Successfully cleared ${lineupSnapshot.size} active lineups from previous season`);
}

/**
 * One-time close-out of the season that just ended: league champion archival
 * and prize pools first (winner selection reads live corps.totalSeasonScore,
 * which the profile reset zeroes), then profile archival/rewards, then
 * lineup cleanup.
 *
 * Guarded by a season_rollovers/{oldSeasonUid} lease (scoringRunGuard
 * pattern): scheduler redelivery or a forced double season-start cannot
 * re-pay finish bonuses, re-increment lifetimeStats.totalSeasons, or
 * double-pay league prize pools.
 */
async function rolloverFromOldSeason(db, oldSeason, newSeasonUid) {
  const { seasonUid, seasonName } = oldSeason;
  const claim = await claimSeasonRollover(db, seasonUid);
  if (!claim.claimed) {
    logger.warn(
      `Season rollover for ${seasonUid} already ${claim.reason}; skipping payouts and archival.`
    );
    return;
  }
  try {
    // Settle the Podium season boundary FIRST — advancement (division re-seat)
    // and each corps' season-start assessment. The new season doc is already
    // published by the caller (registration is open), so this runs before the
    // heavier fantasy-archival steps to shrink the window in which a director
    // could register and be seated from last season's stale career division:
    // the earned seat must exist before anyone registers into the new season
    // (design §5.7 + §5.13). Order-independent of the profile reset — the
    // budget refund is a corpsCoin INCREMENT, and the reset never writes
    // corps.podiumClass.division. Fully isolated: it never throws, so a Podium
    // hiccup can't fail the rollover. Registration and the nightly stage each
    // re-settle idempotently, so a rare miss here still self-corrects.
    await settlePodiumSeasonBoundary(db);
    await archiveSeasonResultsLogic(db, { seasonUid, seasonName });
    await resetLeaguesForNewSeason(db, seasonUid, newSeasonUid);
    await archiveAndResetProfiles(db, seasonUid, newSeasonUid);
    await clearActiveLineups(db, seasonUid);
    await markSeasonRolloverCompleted(db, seasonUid);
  } catch (error) {
    await markSeasonRolloverFailed(db, seasonUid, error);
    throw error;
  }
}

/**
 * Settle the Podium season boundary at rollover (design §5.7 + §5.13).
 *
 * Runs the SAME idempotent archival sweep the nightly stage runs — archive each
 * corps' career, re-seat divisions against the published percentile cutoffs, and
 * publish every corps' season-start assessment — but at the MOMENT the new
 * season starts, before registration opens, instead of waiting for the new
 * season's first competition night. That is what lets a returning director see
 * their advancement (promoted / relegated / held class + status) at registration
 * and make an informed continue / retire / start-new decision, rather than
 * marching a whole season before learning where they stand.
 *
 * Shares the nightly stage's `{seasonUid}_podium_archive` lease and the sweep's
 * own once-only guards (`divisionsSeatedAt`, `lastSeasonUid`), so the two never
 * double-process: whichever runs first seats the divisions and completes the
 * lease; the other no-ops. If this fails it marks the lease failed and the
 * nightly stage self-heals exactly as before. Isolated end-to-end — every error
 * is swallowed so a Podium failure can never fail the core season rollover.
 *
 * @param {FirebaseFirestore.Firestore} db
 */
async function settlePodiumSeasonBoundary(db) {
  try {
    const { isPodiumEnabled } = require("./features");
    if (!(await isPodiumEnabled(db))) return;

    const career = require("./podium/career");
    const {
      claimScoringRun,
      markScoringRunCompleted,
      markScoringRunFailed,
    } = require("./scoringRunGuard");

    const seasonDoc = await db.doc("game-settings/season").get();
    if (!seasonDoc.exists) return;
    const seasonData = seasonDoc.data();

    // Advance the Podium season index for the just-started season and read back
    // the season that ended. Idempotent: the nightly stage's later call sees the
    // index already advanced and re-derives `previous` from history.
    const seasonIndex = await career.ensureSeasonIndex(db, seasonData);
    const previousSeason = seasonIndex.previous || (await career.latestPreviousSeason(db));
    if (!previousSeason || previousSeason.seasonUid === seasonData.seasonUid) return;

    const archiveKey = `${previousSeason.seasonUid}_podium_archive`;
    // kind "announce": a failed sweep self-heals on the next nightly run, so the
    // watchdog treats it as a warning, not a critical scoring incident.
    const lease = await claimScoringRun(db, archiveKey, 0, { kind: "announce" });
    if (!lease.claimed) return; // already seated (or being seated) elsewhere
    try {
      const archived = await career.archivePodiumSeason(db, previousSeason);
      await markScoringRunCompleted(db, archiveKey, 0, { archived });
      logger.info(
        `[podium] season boundary settled at rollover for ${previousSeason.seasonUid} ` +
          `(${archived} archived); advancement + assessment available at registration.`
      );
    } catch (error) {
      await markScoringRunFailed(db, archiveKey, 0, error);
      logger.error(
        `[podium] boundary settlement at rollover failed (nightly will retry): ${error.message}`
      );
    }
  } catch (error) {
    // Never let a Podium settlement failure fail the season rollover.
    logger.error(`[podium] boundary settlement at rollover skipped: ${error.message}`);
  }
}

async function startNewLiveSeason() {
  logger.info("Generating new live season...");
  const db = getDb();
  // Anchor everything on the next DCI finals. Spring training is variable so the
  // six preceding off-seasons pack in right after the previous finals and
  // competition day 49 lands exactly on the real finals date (getLiveSeasonWindow).
  // Manual finals-date overrides (game-settings/config) win over the computed
  // 2nd Saturday for the rare year DCI moves finals.
  const finalsOverrides = await getFinalsDateOverrides(db);
  const { startDate, finalsDate, springTrainingDays, seasonEndDate, finalsYear } =
    getLiveSeasonWindow(new Date(), finalsOverrides);
  const year = finalsYear;
  const previousYear = (finalsYear - 1).toString();

  let oldSeason = null;
  const oldSeasonDoc = await db.doc("game-settings/season").get();
  if (oldSeasonDoc.exists && oldSeasonDoc.data().seasonUid) {
    oldSeason = {
      seasonUid: oldSeasonDoc.data().seasonUid,
      seasonName: oldSeasonDoc.data().name || oldSeasonDoc.data().seasonUid,
    };
  }

  const rankingsDocRef = db.doc(`final_rankings/${previousYear}`);
  const rankingsDoc = await rankingsDocRef.get();
  if (!rankingsDoc.exists) {
    throw new Error(`Cannot start live season: Final rankings for ${previousYear} not found.`);
  }
  const corpsValues = rankingsDoc.data().data.map((c) => ({
    corpsName: c.corps,
    sourceYear: previousYear,
    points: c.points,
  }));

  // Season naming: start calendar year to finals year (two digits).
  const seasonYearSuffix = `${startDate.getFullYear()}-${finalsDate.getFullYear().toString().slice(-2)}`;
  const seasonName = `live_${seasonYearSuffix}`;

  const dataDocId = seasonName;
  await db.doc(`dci-data/${dataDocId}`).set({ corpsValues: corpsValues });

  // Generate schedule with offSeasonDay structure (1-49 competition days).
  // startDate/finalsDate map scraped events onto competition days; springTrainingDays
  // is this season's actual (variable) spring-training length so the mapping is exact.
  const schedule = await generateLiveSeasonSchedule(49, 1, year, startDate, finalsDate, springTrainingDays);

  // Write schedule to schedules collection (competitions array format)
  await writeScheduleToCollection(dataDocId, schedule);

  const newSeasonData = {
    name: seasonName,
    status: "live-season",
    seasonUid: dataDocId,
    seasonYear: year,
    currentPointCap: 150,
    dataDocId: dataDocId,
    schedule: {
      startDate: Timestamp.fromDate(startDate),
      endDate: Timestamp.fromDate(seasonEndDate),
      springTrainingDays, // variable (21 or 28) — see getLiveSeasonWindow
    },
  };

  await db.doc("game-settings/season").set(newSeasonData);
  logger.info(`Successfully started the ${newSeasonData.name} (spring training ${springTrainingDays} days).`);

  if (oldSeason) {
    await rolloverFromOldSeason(db, oldSeason, dataDocId);
  }
}

async function startNewOffSeason() {
  logger.info("Generating new themed off-season...");
  const db = getDb();
  const seasonSettingsRef = db.doc("game-settings/season");

  let oldSeason = null;
  const oldSeasonDoc = await seasonSettingsRef.get();
  if (oldSeasonDoc.exists && oldSeasonDoc.data().seasonUid) {
    oldSeason = {
      seasonUid: oldSeasonDoc.data().seasonUid,
      seasonName: oldSeasonDoc.data().name || oldSeasonDoc.data().seasonUid,
    };
  }

  const finalsOverrides = await getFinalsDateOverrides(db);
  const offWindow = getNextOffSeasonWindow(new Date(), finalsOverrides);
  if (!offWindow) {
    // now is in the live-season run-up; the scheduler should have routed here to
    // startNewLiveSeason via isLiveSeasonTime. Fail loudly rather than fabricate
    // an off-season on top of the live calendar.
    throw new Error(
      "startNewOffSeason called during the live-season run-up (no off-season window)."
    );
  }
  const { startDate, endDate, seasonType, finalsYear } = offWindow;
  const seasonLength = 49;
  const rankingsSnapshot = await db.collection("final_rankings").get();
  if (rankingsSnapshot.empty) {
    throw new Error("Cannot start off-season: No final rankings found.");
  }
  const pointsMap = new Map();
  const allCorpsList = [];
  rankingsSnapshot.forEach((doc) => {
    const year = doc.id;
    const corpsData = doc.data().data || [];
    corpsData.forEach((corps) => {
      const pointValue = corps.points;
      if (pointValue) {
        const entry = { corpsName: corps.corps, sourceYear: year, points: pointValue };
        if (!pointsMap.has(pointValue)) pointsMap.set(pointValue, []);
        pointsMap.get(pointValue).push(entry);
        allCorpsList.push(entry);
      }
    });
  });
  const offSeasonCorpsData = [];
  const usedCorpsNames = new Set();
  const shuffledAllCorps = shuffleArray(allCorpsList);
  for (let points = 25; points >= 1; points--) {
    let candidates = pointsMap.get(points) || [];
    let chosenCorps = null;
    if (candidates.length > 0) {
      const shuffledCandidates = shuffleArray([...candidates]);
      chosenCorps = shuffledCandidates.find((c) => !usedCorpsNames.has(c.corpsName));
      if (!chosenCorps) chosenCorps = shuffledCandidates[0];
    }
    if (!chosenCorps) {
      const fallback = shuffledAllCorps.find((c) => !usedCorpsNames.has(c.corpsName));
      if (fallback) chosenCorps = { ...fallback, points: points };
    }
    if (chosenCorps) {
      const { corpsName, sourceYear, points: chosenPoints } = chosenCorps;
      offSeasonCorpsData.push({ corpsName, sourceYear, points: chosenPoints });
      usedCorpsNames.add(chosenCorps.corpsName);
    }
  }
  // Attach each pool corps' real competition days so the client can resolve the
  // two-tier pick highlight (full = real result that day, dim = interpolated).
  // Best-effort: highlighting degrades to "full" if this can't be computed.
  try {
    const { computeResultDaysForPool } = require("./pickResultDays");
    await computeResultDaysForPool(db, offSeasonCorpsData);
  } catch (error) {
    logger.warn(`Pool result-day index failed (non-fatal): ${error.message}`);
  }

  const schedule = await generateOffSeasonSchedule(seasonLength, 1);
  const seasonName = getThematicOffSeasonName(seasonType, finalsYear);
  const dataDocId = seasonName;

  await db.doc(`dci-data/${dataDocId}`).set({ corpsValues: offSeasonCorpsData });

  // Enrich each stage with a running order + performance clock (heritage for
  // regular shows, pool-synthesized for championships), rebased onto the
  // off-season calendar so the live RunningOrder/NextPerformance UI works
  // off-season too. Gated by a feature flag (kill switch) and best-effort: a
  // failure here must not block season creation.
  try {
    const { enrichOffSeasonSchedule, isHeritageSchedulesEnabled } = require("./offSeasonHeritage");
    if (await isHeritageSchedulesEnabled(db)) {
      await enrichOffSeasonSchedule(db, schedule, {
        startDate,
        pool: offSeasonCorpsData,
        dataDocId,
      });
    } else {
      logger.info("Heritage schedule enrichment disabled by flag; using names-only schedule.");
    }
  } catch (error) {
    logger.warn(`Off-season schedule heritage enrichment failed (non-fatal): ${error.message}`);
  }

  // Write schedule to schedules collection (competitions array format)
  await writeScheduleToCollection(dataDocId, schedule);

  const newSeasonSettings = {
    name: seasonName,
    status: "off-season",
    seasonUid: dataDocId,
    currentPointCap: 150,
    dataDocId: dataDocId,
    schedule: { startDate: Timestamp.fromDate(startDate), endDate: Timestamp.fromDate(endDate) },
  };

  await seasonSettingsRef.set(newSeasonSettings);
  logger.info(`Successfully started ${seasonName}.`);

  if (oldSeason) {
    await rolloverFromOldSeason(db, oldSeason, dataDocId);
  }
}


module.exports = {
  // Core season functions
  shuffleArray,
  startNewLiveSeason,
  startNewOffSeason,
  generateLiveSeasonSchedule,
  generateOffSeasonSchedule,
  calculateOffSeasonDay,
  getThematicOffSeasonName,
  getNextOffSeasonWindow,
  getLiveSeasonWindow,
  isLiveSeasonTime,
  getFinalsDateOverrides,
  archiveSeasonResultsLogic,
  // Exported for tests (rollover pipeline internals)
  archiveAndResetProfiles,
  resetLeaguesForNewSeason,
  rolloverFromOldSeason,
  settlePodiumSeasonBoundary,
  corpsParticipatedThisSeason,
  refreshLiveSeasonSchedule,
  mergeScheduleRefresh,
  showMatchKey,
  applyEnrichment,
  brandEventName,
  // Schedule helpers
  writeScheduleToCollection,
  writeScheduleToSubcollection,
  getScheduleDay,
  getScheduleDays,
  getAllScheduleDays,
  updateScheduleDay,
  addShowToDay,
  // Secrets
  scraperInvokeKey,
};