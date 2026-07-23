const { getDb } = require("../config");
const { paths } = require("./paths");
const { logger } = require("firebase-functions/v2");
const { getDoc, FieldValue } = require("firebase-admin/firestore");
const { getScheduleDay } = require("./season");
const { calculateLineupSynergyBonus } = require('./showConceptSynergy');
const { SHOW_PARTICIPATION_REWARDS } = require("./economy");
const {
  clearRegressionCache,
  getCachedRegressionScore,
  fetchHistoricalData,
  simpleLinearRegression,
  getRealisticCaptionScore,
  getScoreForDay,
  countDataPointsForCorps,
  logarithmicRegression,
} = require("./scoringMath");
const {
  buildChampionshipConfig,
  processCoinAwardsBatch,
  awardRegionalTrophies,
  awardClassChampionshipTrophies,
  awardFinalsAndSaveChampions,
  buildEasternClassicParticipantSet,
  processWeeklyMatchups,
  payWeeklyParticipationXP,
} = require("./scoringAwards");
const { ChunkedWriter } = require("./chunkedWriter");
const { getCompletedCalendarDay } = require("./gameDay");
const { updateRecordsFromRecap } = require("./gameRecords");
const {
  claimScoringRun,
  markScoringRunCompleted,
  markScoringRunFailed,
} = require("./scoringRunGuard");
const { settleLeaguePoolsForDay } = require("./leaguePools");
const { processAllInPages } = require("./firestorePaging");
const { publishSeasonSummaryRequest } = require("./newsSeasonSummaryTrigger");
const {
  isTwoNightShow,
  resolveEasternNightSet,
  publishEasternPreview,
} = require("./easternSplit");



// The eight lineup captions a corps must fill before it can be scored. A corps
// with an incomplete (or empty) lineup has not finished selecting captions and
// must be excluded from scoring entirely — otherwise it lands in the recap and
// standings with a meaningless 0.000.
const LINEUP_CAPTIONS = ["GE1", "GE2", "VP", "VA", "CG", "B", "MA", "P"];

/**
 * True only when a lineup has a non-empty selection for every scoring caption.
 * Newly registered corps start with an empty `lineup: {}`, and the caption
 * selection is only ever saved as a complete 8-caption set, so this rejects
 * both the empty and any partially-filled case.
 *
 * @param {Object|undefined} lineup - The corps' caption -> "corpsName|year" map.
 * @returns {boolean}
 */
function hasCompleteLineup(lineup) {
  if (!lineup) return false;
  return LINEUP_CAPTIONS.every(
    (caption) => typeof lineup[caption] === "string" && lineup[caption].length > 0
  );
}

// Nightly profile fetch: documents per page (also the max held in one query
// response). The full doc list is accumulated in memory, but the select()
// projection keeps each doc to ~2KB, so even tens of thousands of profiles
// stay well within a 512MiB scoring job.
const PROFILE_PAGE_SIZE = 1000;

/**
 * Fetch EVERY active-season profile, paging past any single query's cap.
 *
 * Replaces the old `.limit(5000)` fetch, which silently never scored profile
 * 5,001+. Pages via firestorePaging.processAllInPages (stable __name__
 * ordering; the equality filter + implicit __name__ order is served by the
 * existing collection-group index on activeSeasonId, so no new index is
 * needed). Keeps the field projection: only 'corps', 'username' and
 * 'displayName' are fetched (~87% less data than full profile docs).
 *
 * Returns a QuerySnapshot-shaped object ({ docs, size, empty }) so the
 * downstream scoring core, Eastern-split and rankings code — which only use
 * those three members — is unchanged.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} seasonUid - The active season's uid (activeSeasonId filter).
 * @returns {Promise<{docs: FirebaseFirestore.QueryDocumentSnapshot[], size: number, empty: boolean}>}
 */
async function fetchAllActiveProfiles(db, seasonUid) {
  const profilesQuery = db.collectionGroup("profile")
    .where("activeSeasonId", "==", seasonUid)
    .select("corps", "username", "displayName");
  const docs = await processAllInPages(profilesQuery, PROFILE_PAGE_SIZE, async (doc) => doc);
  return { docs, size: docs.length, empty: docs.length === 0 };
}

// =============================================================================
// END: Shared helper functions
// =============================================================================

// =============================================================================
// SHARED DAILY-SCORING CORE
//
// The off-season and live-season scoring runs are identical except for how a
// single caption's base score is derived (off-season regresses on the corps'
// source year; live season prefers a scraped current-year score and falls
// back to regression). Both build the same recap, per-corps score map, and
// coin-award list, then commit the same set of writes. These two helpers hold
// that shared body so a scoring fix only has to be made once.
// =============================================================================

/**
 * Run the show-by-show, corps-by-corps scoring loop for a single day.
 *
 * Pushes one showResult per show into `dailyRecap.shows` and returns the
 * accumulated per-corps daily scores and coin awards, plus diagnostic stats.
 *
 * @param {Object} params
 * @param {Object} params.dayEventData - The day's shows (from the schedule).
 * @param {FirebaseFirestore.QuerySnapshot} params.profilesSnapshot - Active profiles.
 * @param {number} params.week - Competition week (ceil(scoredDay / 7)).
 * @param {number} params.scoredDay - The day being scored (1-49).
 * @param {Object|null} params.championshipConfig - Per-show championship config, or null.
 * @param {Object} params.dailyRecap - Recap accumulator; shows are pushed onto it.
 * @param {(corpsName: string, sourceYear: string, caption: string) => number}
 *   params.getBaseCaptionScore - Season-specific base-score strategy.
 * @param {Set<string>|null} [params.easternNightSet] - Persisted two-night
 *   assignment for this day's multi-night show ("${uid}_${corpsClass}" keys,
 *   from easternSplit.resolveEasternNightSet). When absent, falls back to the
 *   legacy in-loop alphabetical split.
 * @returns {{ dailyScores: Map<string, number>, coinAwards: Array,
 *   captionPoints: Map<string, Object>, stats: Object }}
 */
function scoreShowsForDay({
  dayEventData,
  profilesSnapshot,
  week,
  scoredDay,
  championshipConfig,
  dailyRecap,
  getBaseCaptionScore,
  easternNightSet = null,
}) {
  const dailyScores = new Map();
  const coinAwards = []; // { uid, corpsClass, showName, amount }
  // Caption mastery (WS5.5): lifetime per-caption points, accumulated per
  // uid across every corps and show scored today. Committed as
  // captionStats.{caption} increments in commitDailyScoring.
  const captionPoints = new Map(); // uid -> { GE1: points, ... }
  const stats = { corpsProcessed: 0, corpsScored: 0, corpsWithNoShowsSelected: 0 };

  for (const show of dayEventData.shows) {
    const showResult = {
      eventName: show.eventName,
      location: show.location,
      results: [],
    };

    // --- DAY 41/42 REGIONAL SPLIT LOGIC ---
    // Eastern Classic spans two days; each corps performs one assigned night.
    // Keys are "${uid}_${corpsClass}" composites so per-corps assignment works
    // even when a user has multiple corps registered for the show.
    // The caller resolves the PERSISTED snake split (easternSplit.js) so both
    // nights score against the same assignment; the legacy in-loop
    // alphabetical split remains the fallback when no set was resolved.
    let day41_42_participantSet = null;
    if (
      [41, 42].includes(scoredDay) &&
      (isTwoNightShow(show) || show.eventName.includes("Eastern Classic"))
    ) {
      day41_42_participantSet = easternNightSet || buildEasternClassicParticipantSet(
        profilesSnapshot, show.eventName, week, scoredDay
      );
    }
    // --- END: DAY 41/42 REGIONAL SPLIT LOGIC ---

    // --- CHAMPIONSHIP SHOW CONFIGURATION ---
    // Get config for this specific show if it's a championship event
    const showConfig = championshipConfig ? championshipConfig[show.eventName] : null;
    // OPTIMIZATION #6: Build Set for O(1) participant lookups instead of O(n) .some()
    // Key format: "${uid}_${corpsClass}" for composite lookup
    let participantSet = null;
    if (showConfig?.participants) {
      participantSet = new Set(showConfig.participants.map(p => `${p.uid}_${p.corpsClass}`));
    }
    // --- END: CHAMPIONSHIP SHOW CONFIGURATION ---

    for (const userDoc of profilesSnapshot.docs) {
      const userProfile = userDoc.data();
      const uid = userDoc.ref.parent.parent.id;

      const userCorps = userProfile.corps || {};
      for (const corpsClass of Object.keys(userCorps)) {
        const corps = userCorps[corpsClass];
        if (!corps || !corps.corpsName || !corps.lineup) continue;

        // A corps that hasn't finished selecting its captions must not be
        // scored at all. Without this it would otherwise "attend" any show it
        // registered for and post a 0.000 in the recap and standings.
        if (!hasCompleteLineup(corps.lineup)) continue;

        // Eastern Classic Day 41/42 per-corps filter (keyed by uid+corpsClass
        // so each registered corps competes on exactly one of the two days).
        if (day41_42_participantSet && !day41_42_participantSet.has(`${uid}_${corpsClass}`)) continue;

        let attended = false;

        // Championship Week Logic (Days 45-49)
        if (showConfig) {
          // Check if this corps class is eligible for this show
          if (!showConfig.classFilter.includes(corpsClass)) {
            continue; // This class can't participate in this show
          }

          // Check if this user/class combo is in the participants list (for advancement rounds)
          // OPTIMIZATION #6: O(1) Set lookup instead of O(n) .some()
          if (participantSet !== null) {
            if (!participantSet.has(`${uid}_${corpsClass}`)) {
              continue; // Didn't advance to this round
            }
          }

          // If we get here, the corps is eligible and has advanced (if applicable)
          attended = true;
        } else {
          // Regular show - check manual registration
          const userShows = corps.selectedShows?.[`week${week}`] || [];
          // Match by eventName only - dates can have type mismatches (Timestamp vs string)
          // and eventName should be unique enough within a week
          attended = userShows.some(s => s.eventName === show.eventName);

          // Track statistics for diagnostics
          stats.corpsProcessed++;
          if (userShows.length === 0) {
            stats.corpsWithNoShowsSelected++;
          }
        }

        if (attended) {
          stats.corpsScored++;
          let geScore = 0, rawVisualScore = 0, rawMusicScore = 0;
          const userCaptionPoints = captionPoints.get(uid) || {};

          for (const caption in corps.lineup) {
            const [corpsName, sourceYear] = corps.lineup[caption].split("|");
            // Season-specific base score (regression vs. scraped-live strategy)
            const baseCaptionScore = getBaseCaptionScore(corpsName, sourceYear, caption);

            // Hard cap each caption at 20 points. Competitive scores come ONLY
            // from the historical data — no game system (show concepts,
            // purchases, streaks) may ever modify them.
            const captionScore = Math.min(20, baseCaptionScore);

            if (["GE1", "GE2"].includes(caption)) geScore += captionScore;
            else if (["VP", "VA", "CG"].includes(caption)) rawVisualScore += captionScore;
            else if (["B", "MA", "P"].includes(caption)) rawMusicScore += captionScore;

            // Lifetime mastery accumulation — display-only, never feeds back
            // into competitive scoring.
            userCaptionPoints[caption] = (userCaptionPoints[caption] || 0) + captionScore;
          }
          captionPoints.set(uid, userCaptionPoints);
          const visualScore = rawVisualScore / 2;
          const musicScore = rawMusicScore / 2;
          // Hard cap at 100 - this is the maximum possible score
          const totalShowScore = Math.min(100, geScore + visualScore + musicScore);

          const currentDailyTotal = dailyScores.get(`${uid}_${corpsClass}`) || 0;
          dailyScores.set(`${uid}_${corpsClass}`, currentDailyTotal + totalShowScore);

          // OPTIMIZATION: Collect coin award for batch processing (instead of individual await)
          const coinAmount = SHOW_PARTICIPATION_REWARDS[corpsClass] || 0;
          if (coinAmount > 0) {
            coinAwards.push({ uid, corpsClass, showName: show.eventName, amount: coinAmount });
          }

          // Show-design bonus: a structured show concept whose style matches
          // the lineup's corps pays a small nightly CorpsCoin award — a game
          // reward only, with zero effect on the competitive score above.
          const { captionBonuses } = calculateLineupSynergyBonus(
            corps.showConcept || {},
            corps.lineup
          );
          const synergyTotal = Object.values(captionBonuses).reduce((sum, v) => sum + v, 0);
          const designCoin = Math.min(15, Math.round(synergyTotal * 2));
          if (designCoin > 0) {
            coinAwards.push({
              uid, corpsClass, showName: show.eventName, amount: designCoin,
              type: 'show_design',
              description: `Show design bonus at ${show.eventName}`,
            });
          }

          showResult.results.push({
            uid: uid,
            displayName: userProfile.username || userProfile.displayName,
            location: corps.location,
            corpsClass: corpsClass,
            corpsName: corps.corpsName,
            avatarUrl: corps.avatarUrl || null,
            totalScore: totalShowScore,
            geScore, visualScore, musicScore,
          });
        }
      }
    }
    dailyRecap.shows.push(showResult);
  }

  return { dailyScores, coinAwards, captionPoints, stats };
}

// Competitive classes ranked nightly. SoundSport is deliberately excluded:
// it is a ratings-only format whose standings are never shown as placements.
// Ranked classes come from the class-capability registry (Phase 1.1);
// SoundSport (ratings-only) and disabled classes are excluded there.
const { RANKED_CLASSES } = require("./classRegistry");

/**
 * Class standings after tonight's scoring — the "World Class · #14" number.
 *
 * Rank is by effective season score: tonight's daily total for corps that
 * just performed (that becomes their totalSeasonScore), the stored
 * totalSeasonScore for everyone else. Corps with no score yet are unranked.
 * Pure function so the standing math is unit-testable without Firestore.
 *
 * @param {QuerySnapshot} profilesSnapshot - Active-season profile docs
 * @param {Map<string, number>} dailyScores - uid_class -> tonight's total
 * @returns {Map<string, {rank: number, of: number}>} keyed by `${uid}_${class}`
 */
function computeSeasonRankings(profilesSnapshot, dailyScores) {
  const byClass = new Map(RANKED_CLASSES.map((c) => [c, []]));

  for (const userDoc of profilesSnapshot.docs) {
    const uid = userDoc.ref.parent.parent.id;
    const corpsMap = userDoc.data().corps || {};
    for (const corpsClass of RANKED_CLASSES) {
      const corps = corpsMap[corpsClass];
      if (!corps || !corps.corpsName) continue;
      const key = `${uid}_${corpsClass}`;
      const effective = dailyScores.get(key) ?? corps.totalSeasonScore ?? 0;
      if (effective > 0) byClass.get(corpsClass).push({ key, effective });
    }
  }

  const rankings = new Map();
  for (const entries of byClass.values()) {
    entries.sort((a, b) => b.effective - a.effective);
    entries.forEach(({ key }, index) => {
      rankings.set(key, { rank: index + 1, of: entries.length });
    });
  }
  return rankings;
}

/**
 * Commit a scored day: profile score updates, the recap subcollection doc,
 * trophy awards, and coin awards, all in one chunked batch.
 *
 * @param {Object} params
 * @param {FirebaseFirestore.Firestore} params.db
 * @param {ChunkedWriter} params.batch
 * @param {Object} params.seasonData
 * @param {number} params.scoredDay
 * @param {Map<string, number>} params.dailyScores
 * @param {Object} params.dailyRecap
 * @param {Array} params.coinAwards
 * @param {Map<string, Object>} [params.captionPoints] - uid -> per-caption points
 * @param {QuerySnapshot} [params.profilesSnapshot] - for nightly class standings
 * @returns {Promise<{ opCount: number, batchCount: number }>}
 */
async function commitDailyScoring({
  db,
  batch,
  seasonData,
  scoredDay,
  dailyScores,
  dailyRecap,
  coinAwards,
  captionPoints,
  profilesSnapshot,
  force = false,
}) {
  // Update user profiles with their most recent score.
  // Note: Uses latest score (not cumulative) - drum corps rankings are based
  // on most recent performance.
  for (const [uidAndClass, totalDailyScore] of dailyScores.entries()) {
    if (totalDailyScore > 0) {
      const [uid, corpsClass] = uidAndClass.split("_");
      const userProfileRef = db.doc(paths.userProfile(uid));
      batch.update(userProfileRef, {
        [`corps.${corpsClass}.totalSeasonScore`]: totalDailyScore,
        [`corps.${corpsClass}.lastScoredDay`]: scoredDay,
      });
    }
  }

  // Class standings — the profile's "World Class · #14" number. Recomputed
  // for every ranked corps each night (a corps that sat out still moves
  // when others pass it). One update per ranked corps; multiple updates to
  // the same doc in one batch are legal and land in order.
  if (profilesSnapshot) {
    const rankings = computeSeasonRankings(profilesSnapshot, dailyScores);
    for (const [uidAndClass, { rank, of }] of rankings.entries()) {
      const [uid, corpsClass] = uidAndClass.split("_");
      const ref = db.doc(paths.userProfile(uid));
      batch.update(ref, {
        [`corps.${corpsClass}.seasonRank`]: rank,
        [`corps.${corpsClass}.seasonRankOf`]: of,
      });
    }
  }

  // Caption mastery (WS5.5): bank tonight's per-caption points into the
  // lifetime captionStats counters. Increments ride the same scoring-run
  // lease as every other award, so a repeat run can't double-bank.
  if (captionPoints) {
    for (const [uid, points] of captionPoints.entries()) {
      const updates = {};
      for (const [caption, value] of Object.entries(points)) {
        if (value > 0) {
          updates[`captionStats.${caption}`] =
            FieldValue.increment(Math.round(value * 10) / 10);
        }
      }
      if (Object.keys(updates).length > 0) {
        const ref = db.doc(paths.userProfile(uid));
        batch.update(ref, updates);
      }
    }
  }

  // Save the completed recap document as a per-day subcollection document.
  // OPTIMIZATION: Write directly to subcollection instead of growing an array
  // in a single document (O(1) per day, no 1MB document-size risk).
  const recapDocRef = db.doc(`fantasy_recaps/${seasonData.seasonUid}`);
  const dayRecapRef = db.doc(`fantasy_recaps/${seasonData.seasonUid}/days/${scoredDay}`);

  // Ensure parent document exists with season metadata (only on first write)
  const recapDoc = await recapDocRef.get();
  if (!recapDoc.exists) {
    batch.set(recapDocRef, {
      seasonName: seasonData.name,
      createdAt: new Date(),
    });
  }
  batch.set(dayRecapRef, dailyRecap);

  // --- TROPHY AWARDING LOGIC ---
  // OPTIMIZATION #5: Uses shared trophy awarding helpers
  // (async: day 42 reads the day-41 recap for the combined Eastern field)
  await awardRegionalTrophies(batch, dailyRecap, scoredDay, seasonData, db);

  if (scoredDay === 46) {
    awardClassChampionshipTrophies(batch, dailyRecap, seasonData, db);
  }

  if (scoredDay === 49) {
    await awardFinalsAndSaveChampions(batch, dailyRecap, seasonData, db);
  }
  // --- END: TROPHY AWARDING LOGIC ---

  // OPTIMIZATION #5: Uses shared processCoinAwardsBatch helper.
  // Season context enables per-(uid, day) idempotency markers so a
  // ChunkedWriter partial-failure retry cannot double-pay (awardLedger).
  await processCoinAwardsBatch(coinAwards, batch, db, {
    seasonUid: seasonData.seasonUid,
    scoredDay,
    force,
  });

  // Commit all database writes (chunked into multiple batches as needed)
  return batch.commit();
}

async function processAndArchiveOffSeasonScoresLogic({ force = false } = {}) {
  const db = getDb();
  logger.info("Running Daily Off-Season Score Processor & Archiver...");

  // OPTIMIZATION #1: Clear regression cache at start of each scoring run
  clearRegressionCache();

  const seasonSettingsRef = db.doc("game-settings/season");
  const seasonDoc = await seasonSettingsRef.get();

  if (!seasonDoc.exists || seasonDoc.data().status !== "off-season") {
    logger.info("No active off-season found. Exiting.");
    return { status: "skipped", reason: "no-active-season" };
  }

  const seasonData = seasonDoc.data();
  const seasonStartDate = seasonData.schedule.startDate.toDate();

  // Off-season has no spring training, so the calendar day IS the scored day.
  const scoredDay = getCompletedCalendarDay(seasonStartDate);

  if (scoredDay < 1 || scoredDay > 49) {
    logger.info(`Scored day (${scoredDay}) is outside the 1-49 range. Exiting.`);
    return { status: "skipped", reason: "out-of-range", scoredDay };
  }

  // Coin and league-record awards use FieldValue.increment, so a repeat run
  // (scheduler redelivery, manual re-trigger) would double-award. Claim the
  // day before doing any work.
  const claim = await claimScoringRun(db, seasonData.seasonUid, scoredDay, { force });
  if (!claim.claimed) {
    logger.warn(`Off-season day ${scoredDay} already ${claim.reason}. Skipping to prevent double-awarding.`);
    return { status: "skipped", reason: claim.reason, scoredDay };
  }

  try {
    logger.info(`Processing and archiving scores for Off-Season Day: ${scoredDay}`);

    const historicalData = await fetchHistoricalData(seasonData.dataDocId);
    // Fetch day data from subcollection instead of season document
    const dayEventData = await getScheduleDay(seasonData.seasonUid, scoredDay);

    // Cursor-paged fetch of ALL active profiles (projected fields only) — the
    // old .limit(5000) fetch silently never scored profile 5,001+.
    const profilesSnapshot = await fetchAllActiveProfiles(db, seasonData.seasonUid);
    if (profilesSnapshot.empty) {
      await markScoringRunCompleted(db, seasonData.seasonUid, scoredDay, { note: "no active profiles" });
      return { status: "processed", scoredDay, note: "no active profiles" };
    }

    const week = Math.ceil(scoredDay / 7);
    // Calculate the actual date for this off-season day from the season start date
    const scoredDayDate = new Date(seasonStartDate.getTime() + (scoredDay - 1) * 24 * 60 * 60 * 1000);
    const dailyRecap = {
      offSeasonDay: scoredDay,
      date: scoredDayDate,  // The actual calendar date for this off-season day
      shows: [],
    };
    // ChunkedWriter: one write per scored corps plus coin/trophy/recap writes
    // scales with the player base, so a single WriteBatch (capped per request)
    // would eventually fail outright on a busy scoring night.
    const batch = new ChunkedWriter(db);

    // --- CHAMPIONSHIP WEEK AUTO-ENROLLMENT & PROGRESSION LOGIC ---
    // OPTIMIZATION #5: Uses shared buildChampionshipConfig helper
    let championshipConfig = null;

    if (scoredDay >= 45) {
      const recapsSnapshot = await db.collection(`fantasy_recaps/${seasonData.seasonUid}/days`).get();
      const allRecaps = recapsSnapshot.docs.map(doc => doc.data());
      const recapsByDay = new Map(allRecaps.map(r => [r.offSeasonDay, r]));
      championshipConfig = buildChampionshipConfig(scoredDay, recapsByDay, allRecaps);
    }
    // --- END: CHAMPIONSHIP WEEK AUTO-ENROLLMENT & PROGRESSION LOGIC ---

    if (!dayEventData || !dayEventData.shows || dayEventData.shows.length === 0) {
      logger.info(`No shows for day ${scoredDay}. Nothing to score.`);
      // A dark day still has obligations: members may have bought into
      // league pools (joinLeaguePool doesn't require shows), and if the
      // dark day lands on a week boundary the whole week's matchup and
      // participation payouts are due. Skipping these here stranded pool
      // antes in escrow forever and silently dropped week payouts — and
      // the completed guard means no retry would ever pick them up.
      await settleLeaguePoolsForDay(db, seasonData);
      if (scoredDay % 7 === 0) {
        await payWeeklyParticipationXP(scoredDay / 7, seasonData, db, { force });
        await processWeeklyMatchups(scoredDay / 7, seasonData, db, { force });
      }
      // Empty scored day (15–49): publish a season-to-date summary article so
      // the news feed has something on a day the 5-article batch can't run.
      await publishSeasonSummaryRequest({
        seasonId: seasonData.seasonUid,
        dataDocId: seasonData.dataDocId,
        scoredDay,
      });
      await markScoringRunCompleted(db, seasonData.seasonUid, scoredDay, { note: "no shows" });
      return { status: "processed", scoredDay, note: "no shows" };
    }

    // Off-season base score: regression on the corps' source year.
    // OPTIMIZATION #1: Use cached regression score to avoid recomputing.
    const getBaseCaptionScore = (corpsName, sourceYear, caption) =>
      getCachedRegressionScore(corpsName, sourceYear, caption, scoredDay, historicalData);

    // Eastern Classic nights: resolve the persisted snake split so day 42
    // scores the exact complement of day 41 (Phase 6.1, design §5.11). On
    // any failure the loop falls back to the legacy in-loop split.
    let easternNightSet = null;
    if ([41, 42].includes(scoredDay)) {
      try {
        easternNightSet = await resolveEasternNightSet(
          db, seasonData, profilesSnapshot, dayEventData, week, scoredDay
        );
      } catch (error) {
        logger.error(`Eastern split resolution failed (legacy fallback in effect): ${error.message}`);
      }
    }

    const { dailyScores, coinAwards, captionPoints, stats } = scoreShowsForDay({
      dayEventData, profilesSnapshot, week, scoredDay,
      championshipConfig, dailyRecap, getBaseCaptionScore, easternNightSet,
    });

    // Log scoring statistics for diagnostics
    logger.info(`Day ${scoredDay} scoring stats: ${stats.corpsProcessed} corps processed, ${stats.corpsScored} corps scored, ${stats.corpsWithNoShowsSelected} corps with no shows selected for week ${week}`);

    const { opCount, batchCount } = await commitDailyScoring({
      db, batch, seasonData, scoredDay, dailyScores, dailyRecap, coinAwards, captionPoints,
      profilesSnapshot, force,
    });
    logger.info(`Successfully processed and archived scores for day ${scoredDay} (${opCount} writes in ${batchCount} batches).`);

    // Records Book: fold tonight's results into the all-time records doc.
    await updateRecordsFromRecap(db, dailyRecap, seasonData.name || seasonData.seasonUid, scoredDay);

    // Settle league prediction pools for the game day whose results just
    // posted (inside the guard, so redeliveries cannot double-pay).
    await settleLeaguePoolsForDay(db, seasonData);

    // Week boundary: resolve league matchups and pay the weekly XP the
    // economy advertises (participation + league win). Both run inside the
    // scoringRunGuard claim above, so redeliveries cannot double-pay.
    if (scoredDay % 7 === 0) {
      await payWeeklyParticipationXP(scoredDay / 7, seasonData, db, { force });
      await processWeeklyMatchups(scoredDay / 7, seasonData, db, { force });
    }

    // Post-day-38 (Atlanta standings final): publish the Eastern Classic
    // night-lineup preview — the day-39 community moment. Isolated: the
    // preview is decorative and must never fail the scoring run.
    if (scoredDay === 38) {
      try {
        await publishEasternPreview(db, seasonData, profilesSnapshot, scoredDay);
      } catch (error) {
        logger.error(`Eastern preview publication failed (scoring unaffected): ${error.message}`);
      }
    }

    await markScoringRunCompleted(db, seasonData.seasonUid, scoredDay, { opCount, batchCount });
    return { status: "processed", scoredDay };
  } catch (error) {
    // Structured tear diagnostics: which chunks landed before the failure, so
    // a double-award (idempotency now prevents it, but reconciliation still
    // wants the record) is diagnosable without parsing the message string.
    logger.error("Off-season scoring run failed", {
      seasonUid: seasonData.seasonUid,
      scoredDay,
      committedChunks: error.committedBatches ?? null,
      totalChunks: error.totalBatches ?? null,
      message: error.message,
    });
    // Mark failed so a retry can re-claim immediately instead of waiting out
    // the stale lease; then let the original error propagate.
    await markScoringRunFailed(db, seasonData.seasonUid, scoredDay, error);
    throw error;
  }
}

async function processAndScoreLiveSeasonDayLogic(scoredDay, seasonData, { force = false } = {}) {
  const db = getDb();
  logger.info(`Processing and scoring Live Season Day: ${scoredDay}`);

  // OPTIMIZATION #1: Clear regression cache at start of each scoring run
  clearRegressionCache();

  // Coin and league-record awards use FieldValue.increment, so a repeat run
  // (scheduler redelivery, manual re-trigger) would double-award. Claim the
  // day before doing any work.
  const claim = await claimScoringRun(db, seasonData.seasonUid, scoredDay, { force });
  if (!claim.claimed) {
    logger.warn(`Live season day ${scoredDay} already ${claim.reason}. Skipping to prevent double-awarding.`);
    return { status: "skipped", reason: claim.reason, scoredDay };
  }

  try {
    return await scoreLiveSeasonDay(db, scoredDay, seasonData, { force });
  } catch (error) {
    logger.error("Live season scoring run failed", {
      seasonUid: seasonData.seasonUid,
      scoredDay,
      committedChunks: error.committedBatches ?? null,
      totalChunks: error.totalBatches ?? null,
      message: error.message,
    });
    // Mark failed so a retry can re-claim immediately instead of waiting out
    // the stale lease; then let the original error propagate.
    await markScoringRunFailed(db, seasonData.seasonUid, scoredDay, error);
    throw error;
  }
}

async function scoreLiveSeasonDay(db, scoredDay, seasonData, { force = false } = {}) {
  const week = Math.ceil(scoredDay / 7);

  // Cursor-paged fetch of ALL active profiles (projected fields only) — the
  // old .limit(5000) fetch silently never scored profile 5,001+.
  const profilesSnapshot = await fetchAllActiveProfiles(db, seasonData.seasonUid);
  if (profilesSnapshot.empty) {
    logger.info("No active profiles found for the live season.");
    await markScoringRunCompleted(db, seasonData.seasonUid, scoredDay, { note: "no active profiles" });
    return { status: "processed", scoredDay, note: "no active profiles" };
  }

  // Calculate the actual calendar date for this competition day.
  // Live seasons open with a spring-training period (schedule.springTrainingDays)
  // before scoring begins, so competition day N falls on
  // startDate + springTrainingDays + (N - 1). Omitting this offset shifted every
  // live-season recap date earlier by the spring-training length (21 days),
  // producing wrong dates in the Scores and SoundSport recaps. startDate is stored
  // at UTC midnight; build the target date in UTC so the calendar date is stable
  // regardless of the runtime timezone.
  const seasonStartDate = seasonData.schedule.startDate.toDate();
  const springTrainingDays = seasonData.schedule.springTrainingDays || 0;
  const scoreDate = new Date(Date.UTC(
    seasonStartDate.getUTCFullYear(),
    seasonStartDate.getUTCMonth(),
    seasonStartDate.getUTCDate() + springTrainingDays + (scoredDay - 1),
  ));

  // Get current year for fetching live scores from historical_scores
  const currentYear = new Date().getFullYear();

  // Fetch historical data including current year's scraped live scores
  // Corps source years (prior year) + current year for live scraped data
  const historicalData = await fetchHistoricalData(seasonData.dataDocId, [currentYear]);

  const dailyRecap = {
    offSeasonDay: scoredDay,
    date: scoreDate,
    shows: [],
  };
  // ChunkedWriter: one write per scored corps plus coin/trophy/recap writes
  // scales with the player base, so a single WriteBatch (capped per request)
  // would eventually fail outright on a busy scoring night.
  const batch = new ChunkedWriter(db);

  // --- CHAMPIONSHIP WEEK AUTO-ENROLLMENT & PROGRESSION LOGIC (Days 45-49) ---
  // OPTIMIZATION #5: Uses shared buildChampionshipConfig helper
  let championshipConfig = null;

  if (scoredDay >= 45) {
    const recapsSnapshot = await db.collection(`fantasy_recaps/${seasonData.seasonUid}/days`).get();
    const allRecaps = recapsSnapshot.docs.map(doc => doc.data());
    const recapsByDay = new Map(allRecaps.map(r => [r.offSeasonDay, r]));
    championshipConfig = buildChampionshipConfig(scoredDay, recapsByDay, allRecaps);
  }
  // --- END: CHAMPIONSHIP WEEK AUTO-ENROLLMENT & PROGRESSION LOGIC ---

  // Fetch day data from subcollection instead of season document
  const dayEventData = await getScheduleDay(seasonData.seasonUid, scoredDay);

  if (!dayEventData || !dayEventData.shows || dayEventData.shows.length === 0) {
    logger.info(`No shows for day ${scoredDay}. Nothing to score.`);
    // A dark day still has obligations — league pool settlement and, on a
    // week boundary, the week's matchup/participation payouts (live seasons
    // routinely have dark days, so this path is COMMON here). Skipping them
    // stranded pool antes and dropped week payouts with no retry possible.
    await settleLeaguePoolsForDay(db, seasonData);
    if (scoredDay % 7 === 0) {
      await payWeeklyParticipationXP(scoredDay / 7, seasonData, db, { force });
      await processWeeklyMatchups(scoredDay / 7, seasonData, db, { force });
    }
    // Empty scored day (15–49): publish a season-to-date summary article so the
    // news feed has something on a day the 5-article batch can't run. This is
    // the common case for the summary — live seasons routinely have dark days.
    await publishSeasonSummaryRequest({
      seasonId: seasonData.seasonUid,
      dataDocId: seasonData.dataDocId,
      scoredDay,
    });
    await markScoringRunCompleted(db, seasonData.seasonUid, scoredDay, { note: "no shows" });
    return { status: "processed", scoredDay, note: "no shows" };
  }

  // Live-season base score:
  //   1. Prefer an actual scraped score for the current year on this day.
  //   2. Otherwise regress on current-year scraped data if there are enough
  //      points (>= 3); else fall back to prior-year (sourceYear) regression.
  const getBaseCaptionScore = (corpsName, sourceYear, caption) => {
    let baseCaptionScore = getScoreForDay(scoredDay, corpsName, currentYear.toString(), caption, historicalData);

    if (baseCaptionScore === null) {
      const currentYearDataPoints = countDataPointsForCorps(
        corpsName, currentYear.toString(), caption, historicalData
      );

      // OPTIMIZATION #1: Use cached regression score
      if (currentYearDataPoints >= 3) {
        baseCaptionScore = getCachedRegressionScore(
          corpsName, currentYear.toString(), caption, scoredDay, historicalData
        );
      } else {
        baseCaptionScore = getCachedRegressionScore(
          corpsName, sourceYear, caption, scoredDay, historicalData
        );
      }
    }

    return baseCaptionScore;
  };

  // Eastern Classic nights: resolve the persisted snake split so day 42
  // scores the exact complement of day 41 (Phase 6.1, design §5.11). On
  // any failure the loop falls back to the legacy in-loop split.
  let easternNightSet = null;
  if ([41, 42].includes(scoredDay)) {
    try {
      easternNightSet = await resolveEasternNightSet(
        db, seasonData, profilesSnapshot, dayEventData, week, scoredDay
      );
    } catch (error) {
      logger.error(`Eastern split resolution failed (legacy fallback in effect): ${error.message}`);
    }
  }

  const { dailyScores, coinAwards, captionPoints } = scoreShowsForDay({
    dayEventData, profilesSnapshot, week, scoredDay,
    championshipConfig, dailyRecap, getBaseCaptionScore, easternNightSet,
  });

  const { opCount, batchCount } = await commitDailyScoring({
    db, batch, seasonData, scoredDay, dailyScores, dailyRecap, coinAwards, captionPoints,
    profilesSnapshot, force,
  });
  logger.info(`Successfully processed and archived scores for live season day ${scoredDay} (${opCount} writes in ${batchCount} batches).`);

  // Records Book: fold tonight's results into the all-time records doc.
  await updateRecordsFromRecap(db, dailyRecap, seasonData.name || seasonData.seasonUid, scoredDay);

  // Settle league prediction pools for the game day whose results just
  // posted (inside the caller's guard, so redeliveries cannot double-pay).
  await settleLeaguePoolsForDay(db, seasonData);

  // Week boundary: resolve league matchups and pay the weekly XP the
  // economy advertises (participation + league win). Runs inside the
  // scoringRunGuard claim taken by the caller, so redeliveries cannot
  // double-pay.
  if (scoredDay % 7 === 0) {
    await payWeeklyParticipationXP(scoredDay / 7, seasonData, db, { force });
    await processWeeklyMatchups(scoredDay / 7, seasonData, db, { force });
  }

  // Post-day-38: publish the Eastern Classic night-lineup preview (see the
  // off-season path). Isolated — never fails the scoring run.
  if (scoredDay === 38) {
    try {
      await publishEasternPreview(db, seasonData, profilesSnapshot, scoredDay);
    } catch (error) {
      logger.error(`Eastern preview publication failed (scoring unaffected): ${error.message}`);
    }
  }

  await markScoringRunCompleted(db, seasonData.seasonUid, scoredDay, { opCount, batchCount });
  return { status: "processed", scoredDay };
}

async function calculateCorpsStatisticsLogic() {
  logger.info("Starting corps statistics calculation...");
  const db = getDb();

  // 1. Get the current season to identify the active corps list
  const seasonSettingsRef = db.doc("game-settings/season");
  const seasonDoc = await seasonSettingsRef.get();
  if (!seasonDoc.exists) {
    throw new Error("No active season document found.");
  }
  const seasonData = seasonDoc.data();
  const seasonId = seasonData.seasonUid;

  const corpsDataRef = db.doc(`dci-data/${seasonData.dataDocId}`);
  const corpsSnap = await getDoc(corpsDataRef);
  if (!corpsSnap.exists) {
    throw new Error(`Corps data document not found: ${seasonData.dataDocId}`);
  }
  const corpsInSeason = corpsSnap.data().corpsValues || [];
  const yearsToFetch = [...new Set(corpsInSeason.map((c) => c.sourceYear))];

  // 2. Fetch all necessary historical score documents
  const historicalPromises = yearsToFetch.map((year) => db.doc(`historical_scores/${year}`).get());
  const historicalDocs = await Promise.all(historicalPromises);
  const historicalData = {};
  historicalDocs.forEach((doc) => {
    if (doc.exists) {
      historicalData[doc.id] = doc.data().data;
    }
  });

  // 3. Process the data for each corps
  // Pre-index events by corps name per year so each corps lookup is O(1) instead of O(E×S).
  // Map structure: year -> corpsName -> event[]
  const corpsByYear = {};
  for (const [year, events] of Object.entries(historicalData)) {
    const byCorps = {};
    for (const event of events) {
      for (const scoreEntry of (event.scores || [])) {
        if (!byCorps[scoreEntry.corps]) byCorps[scoreEntry.corps] = [];
        byCorps[scoreEntry.corps].push(event);
      }
    }
    corpsByYear[year] = byCorps;
  }

  const allCorpsStats = [];
  for (const corps of corpsInSeason) {
    const uniqueId = `${corps.corpsName}|${corps.sourceYear}`;
    const corpsEvents = corpsByYear[corps.sourceYear]?.[corps.corpsName] || [];

    const captionScores = { GE1: [], GE2: [], VP: [], VA: [], CG: [], B: [], MA: [], P: [] };

    corpsEvents.forEach((event) => {
      const scoreData = event.scores.find((s) => s.corps === corps.corpsName);
      if (scoreData) {
        for (const caption in captionScores) {
          if (scoreData.captions[caption] > 0) {
            captionScores[caption].push(scoreData.captions[caption]);
          }
        }
      }
    });

    const calculatedStats = {};
    for (const caption in captionScores) {
      const scores = captionScores[caption];
      if (scores.length > 0) {
        const sum = scores.reduce((a, b) => a + b, 0);
        calculatedStats[caption] = {
          avg: parseFloat((sum / scores.length).toFixed(3)),
          max: Math.max(...scores),
          min: Math.min(...scores),
          count: scores.length,
        };
      } else {
        calculatedStats[caption] = { avg: 0, max: 0, min: 0, count: 0 };
      }
    }

    allCorpsStats.push({
      id: uniqueId,
      corpsName: corps.corpsName,
      sourceYear: corps.sourceYear,
      points: corps.points,
      stats: calculatedStats,
    });
  }

  // 4. Save the aggregated data to a new document
  const statsDocRef = db.doc(`dci-stats/${seasonId}`);
  await statsDocRef.set({
    seasonName: seasonData.name,
    lastUpdated: new Date(),
    data: allCorpsStats,
  });

  logger.info(`Successfully processed and saved stats for ${allCorpsStats.length} corps.`);
}



module.exports = {
  fetchHistoricalData,
  simpleLinearRegression,
  getRealisticCaptionScore,
  getScoreForDay,
  logarithmicRegression,
  processAndArchiveOffSeasonScoresLogic,
  calculateCorpsStatisticsLogic,
  processAndScoreLiveSeasonDayLogic,
  // Exported for unit testing the shared scoring core
  scoreShowsForDay,
  hasCompleteLineup,
  computeSeasonRankings,
  fetchAllActiveProfiles,
};