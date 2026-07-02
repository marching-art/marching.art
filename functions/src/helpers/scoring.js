const { getDb, dataNamespaceParam } = require("../config");
const { logger } = require("firebase-functions/v2");
const { getDoc } = require("firebase-admin/firestore");
const { getScheduleDay } = require("./season");
const { calculateLineupSynergyBonus } = require('./showConceptSynergy');
const { SHOW_PARTICIPATION_REWARDS } = require("../callable/economy");
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
} = require("./scoringAwards");
const { ChunkedWriter } = require("./chunkedWriter");



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
 * @returns {{ dailyScores: Map<string, number>, coinAwards: Array, stats: Object }}
 */
function scoreShowsForDay({
  dayEventData,
  profilesSnapshot,
  week,
  scoredDay,
  championshipConfig,
  dailyRecap,
  getBaseCaptionScore,
}) {
  const dailyScores = new Map();
  const coinAwards = []; // { uid, corpsClass, showName, amount }
  const stats = { corpsProcessed: 0, corpsScored: 0, corpsWithNoShowsSelected: 0 };

  for (const show of dayEventData.shows) {
    const showResult = {
      eventName: show.eventName,
      location: show.location,
      results: [],
    };

    // --- DAY 41/42 REGIONAL SPLIT LOGIC ---
    // Eastern Classic spans two days. Split enrollees across all corps classes
    // roughly in half per class, with Day 41 = Friday and Day 42 = Saturday.
    // Keys are "${uid}_${corpsClass}" composites so per-corps assignment works
    // even when a user has multiple corps registered for the show.
    let day41_42_participantSet = null;
    if ([41, 42].includes(scoredDay) && show.eventName.includes("Eastern Classic")) {
      day41_42_participantSet = buildEasternClassicParticipantSet(
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

          // Calculate synergy bonus for show concept
          const { captionBonuses } = calculateLineupSynergyBonus(
            corps.showConcept || {},
            corps.lineup
          );

          for (const caption in corps.lineup) {
            const [corpsName, sourceYear] = corps.lineup[caption].split("|");
            // Season-specific base score (regression vs. scraped-live strategy)
            const baseCaptionScore = getBaseCaptionScore(corpsName, sourceYear, caption);

            // Apply synergy bonus (0 - 1.0 based on show concept match)
            const synergyBonus = captionBonuses[caption] || 0;
            // Hard cap each caption at 20 points
            const captionScore = Math.min(20, baseCaptionScore + synergyBonus);

            if (["GE1", "GE2"].includes(caption)) geScore += captionScore;
            else if (["VP", "VA", "CG"].includes(caption)) rawVisualScore += captionScore;
            else if (["B", "MA", "P"].includes(caption)) rawMusicScore += captionScore;
          }
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

  return { dailyScores, coinAwards, stats };
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
}) {
  // Update user profiles with their most recent score.
  // Note: Uses latest score (not cumulative) - drum corps rankings are based
  // on most recent performance.
  for (const [uidAndClass, totalDailyScore] of dailyScores.entries()) {
    if (totalDailyScore > 0) {
      const [uid, corpsClass] = uidAndClass.split("_");
      const userProfileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);
      batch.update(userProfileRef, {
        [`corps.${corpsClass}.totalSeasonScore`]: totalDailyScore,
        [`corps.${corpsClass}.lastScoredDay`]: scoredDay,
      });
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
  awardRegionalTrophies(batch, dailyRecap, scoredDay, seasonData, db);

  if (scoredDay === 46) {
    awardClassChampionshipTrophies(batch, dailyRecap, seasonData, db);
  }

  if (scoredDay === 49) {
    await awardFinalsAndSaveChampions(batch, dailyRecap, seasonData, db);
  }
  // --- END: TROPHY AWARDING LOGIC ---

  // OPTIMIZATION #5: Uses shared processCoinAwardsBatch helper
  processCoinAwardsBatch(coinAwards, batch, db);

  // Commit all database writes (chunked into multiple batches as needed)
  return batch.commit();
}

async function processAndArchiveOffSeasonScoresLogic() {
  const db = getDb();
  logger.info("Running Daily Off-Season Score Processor & Archiver...");

  // OPTIMIZATION #1: Clear regression cache at start of each scoring run
  clearRegressionCache();

  const seasonSettingsRef = db.doc("game-settings/season");
  const seasonDoc = await seasonSettingsRef.get();

  if (!seasonDoc.exists || seasonDoc.data().status !== "off-season") {
    logger.info("No active off-season found. Exiting.");
    return;
  }

  const seasonData = seasonDoc.data();
  const seasonStartDate = seasonData.schedule.startDate.toDate();

  // Calculate "yesterday" in Eastern timezone with 2 AM game day reset.
  // This function runs at 2 AM ET via the scheduler, so we need the date of
  // the game day that just ended (i.e., yesterday's game day).
  //
  // We use Intl.DateTimeFormat to reliably get the current Eastern date,
  // which correctly handles DST transitions (unlike toLocaleString round-trip
  // which loses timezone context when re-parsed by new Date()).
  const nowUtc = new Date();
  const etParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(nowUtc);
  const etValues = {};
  for (const part of etParts) etValues[part.type] = part.value;
  // Build a UTC Date that represents the ET wall-clock time (for arithmetic only)
  const nowET = new Date(Date.UTC(
    parseInt(etValues.year),
    parseInt(etValues.month) - 1,
    parseInt(etValues.day),
    parseInt(etValues.hour === "24" ? "0" : etValues.hour),
    parseInt(etValues.minute),
    parseInt(etValues.second),
  ));
  // Shift by 2 hours to align with 2 AM game day boundary
  // e.g., 1 AM on Jan 5 becomes 11 PM on Jan 4 (still Jan 4's game day)
  const gameTimeET = new Date(nowET.getTime() - (2 * 60 * 60 * 1000));
  const yesterday = new Date(gameTimeET);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  // Normalize to start of day for consistent day calculation
  yesterday.setUTCHours(0, 0, 0, 0);

  // Normalize seasonStartDate using the UTC calendar date directly.
  // seasonStartDate is stored at midnight UTC by getNextOffSeasonWindow().
  // Reading it via ET timezone incorrectly shifts winter UTC-midnight dates back
  // one day (midnight UTC = previous evening in EST/UTC-5), making scoredDay one
  // too high and causing e.g. Semifinals (day 48) to be labeled Finals (day 49).
  const seasonStartNormalized = new Date(Date.UTC(
    seasonStartDate.getUTCFullYear(),
    seasonStartDate.getUTCMonth(),
    seasonStartDate.getUTCDate(),
    0, 0, 0,
  ));

  const diffInMillis = yesterday.getTime() - seasonStartNormalized.getTime();
  const scoredDay = Math.floor(diffInMillis / (1000 * 60 * 60 * 24)) + 1;

  if (scoredDay < 1 || scoredDay > 49) {
    logger.info(`Scored day (${scoredDay}) is outside the 1-49 range. Exiting.`);
    return;
  }

  logger.info(`Processing and archiving scores for Off-Season Day: ${scoredDay}`);

  const historicalData = await fetchHistoricalData(seasonData.dataDocId);
  // Fetch day data from subcollection instead of season document
  const dayEventData = await getScheduleDay(seasonData.seasonUid, scoredDay);

  // Field projection: Only fetch 'corps' field to reduce data transfer by ~87%
  // Full profile docs are ~15KB each; with projection ~2KB each
  // OPTIMIZATION #8: Added limit to prevent runaway memory usage
  // Note: For true pagination at scale (10K+ users), implement cursor-based batching
  const PROFILE_FETCH_LIMIT = 5000;
  const profilesQuery = db.collectionGroup("profile")
    .where("activeSeasonId", "==", seasonData.seasonUid)
    .select("corps", "username", "displayName")
    .limit(PROFILE_FETCH_LIMIT);
  const profilesSnapshot = await profilesQuery.get();
  if (profilesSnapshot.empty) return;
  if (profilesSnapshot.size === PROFILE_FETCH_LIMIT) {
    logger.warn(`OPTIMIZATION WARNING: Profile fetch hit limit of ${PROFILE_FETCH_LIMIT}. Consider implementing pagination for larger user bases.`);
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
    logger.info(`No shows for day ${scoredDay}. Nothing to process.`);
    return;
  }

  // Off-season base score: regression on the corps' source year.
  // OPTIMIZATION #1: Use cached regression score to avoid recomputing.
  const getBaseCaptionScore = (corpsName, sourceYear, caption) =>
    getCachedRegressionScore(corpsName, sourceYear, caption, scoredDay, historicalData);

  const { dailyScores, coinAwards, stats } = scoreShowsForDay({
    dayEventData, profilesSnapshot, week, scoredDay,
    championshipConfig, dailyRecap, getBaseCaptionScore,
  });

  // Log scoring statistics for diagnostics
  logger.info(`Day ${scoredDay} scoring stats: ${stats.corpsProcessed} corps processed, ${stats.corpsScored} corps scored, ${stats.corpsWithNoShowsSelected} corps with no shows selected for week ${week}`);

  const { opCount, batchCount } = await commitDailyScoring({
    db, batch, seasonData, scoredDay, dailyScores, dailyRecap, coinAwards,
  });
  logger.info(`Successfully processed and archived scores for day ${scoredDay} (${opCount} writes in ${batchCount} batches).`);

  // OPTIMIZATION #5: Uses shared processWeeklyMatchups helper
  if (scoredDay % 7 === 0) {
    await processWeeklyMatchups(scoredDay / 7, seasonData, db);
  }
}

async function processAndScoreLiveSeasonDayLogic(scoredDay, seasonData) {
  const db = getDb();
  logger.info(`Processing and scoring Live Season Day: ${scoredDay}`);

  // OPTIMIZATION #1: Clear regression cache at start of each scoring run
  clearRegressionCache();

  const week = Math.ceil(scoredDay / 7);

  // OPTIMIZATION #8: Added limit and field projection to prevent runaway memory usage
  const PROFILE_FETCH_LIMIT = 5000;
  const profilesQuery = db.collectionGroup("profile")
    .where("activeSeasonId", "==", seasonData.seasonUid)
    .select("corps", "username", "displayName")
    .limit(PROFILE_FETCH_LIMIT);
  const profilesSnapshot = await profilesQuery.get();
  if (profilesSnapshot.size === PROFILE_FETCH_LIMIT) {
    logger.warn(`OPTIMIZATION WARNING: Live season profile fetch hit limit of ${PROFILE_FETCH_LIMIT}. Consider implementing pagination.`);
  }
  if (profilesSnapshot.empty) {
    logger.info("No active profiles found for the live season.");
    return;
  }

  // Calculate the actual date for this scored day
  const seasonStartDate = seasonData.schedule.startDate.toDate();
  const scoreDate = new Date(seasonStartDate);
  scoreDate.setDate(seasonStartDate.getDate() + (scoredDay - 1));

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
    logger.info(`No shows for day ${scoredDay}. Nothing to process.`);
    return;
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

  const { dailyScores, coinAwards } = scoreShowsForDay({
    dayEventData, profilesSnapshot, week, scoredDay,
    championshipConfig, dailyRecap, getBaseCaptionScore,
  });

  const { opCount, batchCount } = await commitDailyScoring({
    db, batch, seasonData, scoredDay, dailyScores, dailyRecap, coinAwards,
  });
  logger.info(`Successfully processed and archived scores for live season day ${scoredDay} (${opCount} writes in ${batchCount} batches).`);

  // OPTIMIZATION #5: Uses shared processWeeklyMatchups helper
  if (scoredDay % 7 === 0) {
    await processWeeklyMatchups(scoredDay / 7, seasonData, db);
  }
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
};