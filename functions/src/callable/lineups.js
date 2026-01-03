const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getDb, dataNamespaceParam } = require("../config");
const { logger } = require("firebase-functions/v2");
const { analyzeLineupTrends } = require("../helpers/captionAnalytics");

/**
 * Task 2.7: Saves a user's 8-caption lineup for a specific corps class.
 */
// Add { cors: true } here
exports.saveLineup = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in to save a lineup.");
  }
  const { lineup, corpsClass } = request.data;
  const uid = request.auth.uid;

  // 1. --- Validate Inputs ---
  const validClasses = ["worldClass", "openClass", "aClass", "soundSport"];
  if (!validClasses.includes(corpsClass)) {
    throw new HttpsError("invalid-argument", "Invalid corps class specified.");
  }

  if (!lineup || Object.keys(lineup).length !== 8) {
    throw new HttpsError("invalid-argument", "A complete 8-caption lineup is required.");
  }

  // 2. --- Validate Points Cap ---
  const pointCaps = {
    worldClass: 150,
    openClass: 120,
    aClass: 60,
    soundSport: 90,
  };
  const pointCap = pointCaps[corpsClass];

  const totalPoints = Object.values(lineup).reduce((sum, selection) => {
    if (!selection || typeof selection !== 'string') return sum;
    const parts = selection.split("|");
    // Use parts.length-1 to get the last part, which is the points
    return sum + (Number(parts[parts.length - 1]) || 0);
  }, 0);

  if (totalPoints > pointCap) {
    throw new HttpsError("invalid-argument", `Lineup exceeds ${pointCap} point limit for ${corpsClass}. Total: ${totalPoints}`);
  }

  // 3. --- Get Season & Profile Data ---
  const db = getDb();
  const seasonSettingsRef = db.doc("game-settings/season");
  const seasonDoc = await seasonSettingsRef.get();
  if (!seasonDoc.exists || !seasonDoc.data().seasonUid) {
    throw new HttpsError("failed-precondition", "There is no active season.");
  }
  const seasonData = seasonDoc.data();
  const activeSeasonId = seasonData.seasonUid;

  // 4. --- Create Unique Lineup Key ---
  const lineupKey = `${corpsClass}_${Object.values(lineup).sort().join("_")}`;

  try {
    await db.runTransaction(async (transaction) => {
      const userProfileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);
      const userProfileDoc = await transaction.get(userProfileRef);
      if (!userProfileDoc.exists) {
        throw new HttpsError("not-found", "User profile does not exist.");
      }
      
      const userProfileData = userProfileDoc.data();
      const currentCorpsData = userProfileData.corps?.[corpsClass];

      if (!currentCorpsData) {
        throw new HttpsError("not-found", `You must register a ${corpsClass} corps before saving a lineup.`);
      }

      // 5. --- Check Lineup Uniqueness ---
      const newActiveLineupRef = db.collection("activeLineups").doc(lineupKey);
      const existingLineupDoc = await transaction.get(newActiveLineupRef);
      if (existingLineupDoc.exists && existingLineupDoc.data().uid !== uid) {
        throw new HttpsError("already-exists", "This exact lineup has already been claimed.");
      }

      // 6. --- Check Trade Limits ---
      const oldLineupKey = currentCorpsData.lineupKey;
      const originalLineup = currentCorpsData.lineup || {};
      let newTrades = 0;
      Object.keys(lineup).forEach((caption) => {
        if (originalLineup[caption] !== lineup[caption]) newTrades++;
      });

      const profileUpdateData = {};

      if (newTrades > 0) {
        const now = new Date();
        const seasonStartDate = seasonData.schedule.startDate.toDate();
        const diffInMillis = now.getTime() - seasonStartDate.getTime();
        const currentDay = Math.floor(diffInMillis / (1000 * 60 * 60 * 24)) + 1;
        const currentWeek = Math.ceil(currentDay / 7);

        let tradeLimit = 3; // Default
        // Allow unlimited trades for initial lineup setup (no existing lineup)
        const isInitialSetup = Object.keys(originalLineup).length === 0;
        if (isInitialSetup) tradeLimit = Infinity;
        if (seasonData.status === "off-season" && currentWeek === 1) tradeLimit = Infinity;
        if (seasonData.status === "live-season" && [1, 2, 3].includes(currentWeek)) tradeLimit = Infinity;

        if (tradeLimit !== Infinity) {
          const weeklyTrades = currentCorpsData.weeklyTrades || { week: 0, used: 0 };
          let tradesAlreadyUsed = (weeklyTrades.seasonUid === activeSeasonId &&
            weeklyTrades.week === currentWeek) ? weeklyTrades.used : 0;

          if (tradesAlreadyUsed + newTrades > tradeLimit) {
            throw new HttpsError("failed-precondition",
              `Exceeds trade limit. You have ${tradeLimit - tradesAlreadyUsed} trades remaining this week.`);
          }

          profileUpdateData[`corps.${corpsClass}.weeklyTrades`] = {
            seasonUid: activeSeasonId,
            week: currentWeek,
            used: tradesAlreadyUsed + newTrades,
          };
        }
      }

      // 7. --- Commit Changes ---
      if (oldLineupKey && oldLineupKey !== lineupKey) {
        transaction.delete(db.collection("activeLineups").doc(oldLineupKey));
      }
      
      transaction.set(newActiveLineupRef, {
        uid: uid,
        seasonId: activeSeasonId,
        corpsClass: corpsClass,
      });

      profileUpdateData[`corps.${corpsClass}.lineup`] = lineup;
      profileUpdateData[`corps.${corpsClass}.lineupKey`] = lineupKey;
      profileUpdateData.activeSeasonId = activeSeasonId; 

      transaction.update(userProfileRef, profileUpdateData);
    });

    return { success: true, message: `${corpsClass} lineup saved successfully!` };
  } catch (error) {
    logger.error(`[saveLineup] Transaction FAILED for user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "An error occurred while saving your lineup.");
  }
});

/**
 * Get maximum number of show registrations allowed for a given week
 * @param {number} week - Week number (1-7)
 * @param {number} totalWeeks - Total weeks in the season (default 7)
 * @returns {number} Maximum shows allowed for the week
 */
const getMaxShowsForWeek = (week, totalWeeks = 7) => {
  // Final week allows 7 registrations (1 per day max per corps)
  if (week === totalWeeks) {
    return 7;
  }
  // Regular weeks allow 4 shows
  return 4;
};

/**
 * Task 3.3: Saves a user's selected shows for the week.
 */
// Add { cors: true } here
exports.selectUserShows = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }
  const uid = request.auth.uid;
  const { week, shows, corpsClass } = request.data;

  // Get the max shows allowed for this week (7 for final week, 4 otherwise)
  const maxShowsForWeek = getMaxShowsForWeek(week);

  if (!week || !shows || !Array.isArray(shows) || shows.length > maxShowsForWeek) {
    throw new HttpsError("invalid-argument",
      `Invalid data. A week number and a maximum of ${maxShowsForWeek} shows are required.`);
  }

  if (!corpsClass || !["worldClass", "openClass", "aClass", "soundSport"].includes(corpsClass)) {
    throw new HttpsError("invalid-argument", "Valid corps class is required.");
  }

  // Validate no two shows on the same day
  const daysUsed = new Set();
  for (const show of shows) {
    if (show.day !== undefined && show.day !== null) {
      if (daysUsed.has(show.day)) {
        throw new HttpsError("invalid-argument",
          `Cannot select multiple shows on day ${show.day}. Corps can only attend one show per day.`);
      }
      daysUsed.add(show.day);
    }
  }

  const db = getDb();

  // Validate that the week is not in the past
  const seasonRef = db.doc("game-settings/season");
  const seasonDoc = await seasonRef.get();

  if (!seasonDoc.exists) {
    throw new HttpsError("failed-precondition", "No active season found.");
  }

  const seasonData = seasonDoc.data();
  if (seasonData.schedule?.startDate) {
    const startDate = seasonData.schedule.startDate.toDate();
    const now = new Date();
    const diffInMillis = now.getTime() - startDate.getTime();
    const diffInDays = Math.floor(diffInMillis / (1000 * 60 * 60 * 24));
    const currentWeek = Math.max(1, Math.ceil((diffInDays + 1) / 7));

    if (week < currentWeek) {
      throw new HttpsError("failed-precondition",
        `Cannot select shows for week ${week}. The current week is ${currentWeek}. You can only modify the current or future weeks.`);
    }
  }

  const userProfileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);

  try {
    // Also set activeSeasonId so user is properly tracked for season resets
    const updateData = {
      [`corps.${corpsClass}.selectedShows.week${week}`]: shows,
    };
    if (seasonData.seasonUid) {
      updateData.activeSeasonId = seasonData.seasonUid;
    }
    await userProfileRef.update(updateData);
    return { success: true, message: `Successfully saved selections for week ${week}.` };
  } catch (error) {
    logger.error(`Failed to save show selections for user ${uid}:`, error);
    throw new HttpsError("internal", "Could not save your show selections.");
  }
});

/**
 * Save show concept (theme, music source, drill style) for synergy bonuses
 */
exports.saveShowConcept = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const { corpsClass, showConcept } = request.data;
  const uid = request.auth.uid;

  // Validate inputs
  const validClasses = ["worldClass", "openClass", "aClass", "soundSport"];
  if (!validClasses.includes(corpsClass)) {
    throw new HttpsError("invalid-argument", "Invalid corps class specified.");
  }

  if (!showConcept || !showConcept.theme || !showConcept.musicSource || !showConcept.drillStyle) {
    throw new HttpsError("invalid-argument", "Complete show concept required (theme, musicSource, drillStyle).");
  }

  const db = getDb();
  const userProfileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);

  try {
    await userProfileRef.update({
      [`corps.${corpsClass}.showConcept`]: {
        theme: showConcept.theme,
        musicSource: showConcept.musicSource,
        drillStyle: showConcept.drillStyle,
        updatedAt: new Date()
      }
    });

    logger.info(`User ${uid} saved show concept for ${corpsClass}`);
    return { success: true, message: "Show concept saved successfully!" };
  } catch (error) {
    logger.error(`Failed to save show concept for user ${uid}:`, error);
    throw new HttpsError("internal", "Could not save show concept.");
  }
});

/**
 * Get "hot" status for all corps in the season, calculated PER CAPTION.
 * A corps is "hot" for a specific caption if they've performed above average
 * in that caption during the recent window (last 10 days).
 *
 * Returns: { hotCorps: { "CorpsName|Year": { GE1: {isHot, improvement}, GE2: {...}, ... } } }
 */
exports.getHotCorps = onCall({ cors: true }, async (request) => {
  const db = getDb();
  const CAPTIONS = ['GE1', 'GE2', 'VP', 'VA', 'CG', 'B', 'MA', 'P'];

  try {
    // Get season data
    const seasonDoc = await db.doc("game-settings/season").get();
    if (!seasonDoc.exists) {
      return { success: true, hotCorps: {} };
    }

    const seasonData = seasonDoc.data();
    const dataDocId = seasonData.dataDocId;

    // Calculate current day
    let currentDay = 1;
    if (seasonData.schedule?.startDate) {
      const now = new Date();
      const startDate = seasonData.schedule.startDate.toDate();
      const diffInMillis = now.getTime() - startDate.getTime();
      currentDay = Math.floor(diffInMillis / (1000 * 60 * 60 * 24)) + 1;
    }

    // Define the lookback window (10 days)
    const lookbackDays = 10;
    const windowStart = Math.max(1, currentDay - lookbackDays);
    const windowEnd = currentDay - 1; // Don't include today since scores may not be in yet

    if (windowEnd < 1) {
      // Season just started, no historical data to compare
      return { success: true, hotCorps: {} };
    }

    // Get corps list for this season
    const corpsDataDoc = await db.doc(`dci-data/${dataDocId}`).get();
    if (!corpsDataDoc.exists) {
      return { success: true, hotCorps: {} };
    }

    const corpsList = corpsDataDoc.data().corpsValues || [];

    // Get the years we need to fetch
    const yearsToFetch = [...new Set(corpsList.map(c => c.sourceYear))];

    // Fetch historical scores for all relevant years
    const historicalDocs = await Promise.all(
      yearsToFetch.map(year => db.doc(`historical_scores/${year}`).get())
    );

    const historicalData = {};
    historicalDocs.forEach(doc => {
      if (doc.exists) {
        historicalData[doc.id] = doc.data().data || [];
      }
    });

    // OPTIMIZATION: Pre-build score index for O(1) lookups instead of O(n) .find()
    // Structure: Map<year, Map<corpsName, Map<offSeasonDay, scoreData>>>
    // This reduces ~96,000,000 operations to ~50,000 operations (99.95% reduction)
    const scoreIndex = new Map();
    for (const [year, events] of Object.entries(historicalData)) {
      const yearIndex = new Map();
      for (const event of events) {
        if (!event.scores) continue;
        for (const score of event.scores) {
          if (!yearIndex.has(score.corps)) {
            yearIndex.set(score.corps, new Map());
          }
          yearIndex.get(score.corps).set(event.offSeasonDay, score);
        }
      }
      scoreIndex.set(year, yearIndex);
    }

    // For each caption, collect all corps' performance metrics
    // Structure: { caption: [{ corpsName, sourceYear, recentAvg, improvement }, ...] }
    const captionPerformance = {};
    CAPTIONS.forEach(cap => { captionPerformance[cap] = []; });

    for (const corps of corpsList) {
      const { corpsName, sourceYear } = corps;
      const yearData = historicalData[sourceYear] || [];
      const corpsScoreMap = scoreIndex.get(sourceYear)?.get(corpsName);

      // Skip if no scores exist for this corps
      if (!corpsScoreMap) continue;

      // For each caption, calculate performance metrics
      for (const caption of CAPTIONS) {
        const recentScores = [];
        const allScores = [];

        for (const event of yearData) {
          // O(1) lookup instead of O(n) .find()
          const scoreData = corpsScoreMap.get(event.offSeasonDay);
          if (scoreData && scoreData.captions && scoreData.captions[caption] > 0) {
            const score = scoreData.captions[caption];
            allScores.push({ day: event.offSeasonDay, score });

            if (event.offSeasonDay >= windowStart && event.offSeasonDay <= windowEnd) {
              recentScores.push(score);
            }
          }
        }

        if (recentScores.length > 0 && allScores.length >= 3) {
          const recentAvg = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;

          // Calculate trend: compare recent to early season
          const midpoint = Math.floor(allScores.length / 2);
          const earlyScores = allScores.slice(0, midpoint).map(s => s.score);
          const earlyAvg = earlyScores.length > 0
            ? earlyScores.reduce((a, b) => a + b, 0) / earlyScores.length
            : recentAvg;

          // Improvement percentage from early season to recent
          const improvement = earlyAvg > 0 ? ((recentAvg - earlyAvg) / earlyAvg) * 100 : 0;

          captionPerformance[caption].push({
            corpsName,
            sourceYear,
            recentAvg,
            improvement,
            recentCount: recentScores.length
          });
        }
      }
    }

    // For each caption, determine which corps are "hot"
    const hotCorps = {};

    for (const caption of CAPTIONS) {
      const performers = captionPerformance[caption];
      if (performers.length === 0) continue;

      // Sort by recent average and find thresholds
      const sortedByRecent = [...performers].sort((a, b) => b.recentAvg - a.recentAvg);
      const medianIndex = Math.floor(sortedByRecent.length / 2);
      const medianRecentAvg = sortedByRecent[medianIndex].recentAvg;
      const topQuartileThreshold = sortedByRecent[Math.floor(sortedByRecent.length * 0.25)]?.recentAvg || medianRecentAvg;

      // Determine hot status for each corps in this caption
      for (const perf of performers) {
        const corpsId = `${perf.corpsName}|${perf.sourceYear}`;
        const isAboveMedian = perf.recentAvg >= medianRecentAvg;
        const isImproving = perf.improvement > 2; // More than 2% improvement
        const isTopQuartile = perf.recentAvg >= topQuartileThreshold;

        if (!hotCorps[corpsId]) {
          hotCorps[corpsId] = {};
        }

        hotCorps[corpsId][caption] = {
          isHot: (isAboveMedian && isImproving) || isTopQuartile,
          improvement: Math.round(perf.improvement * 10) / 10,
          recentAvg: Math.round(perf.recentAvg * 100) / 100
        };
      }
    }

    return { success: true, hotCorps, windowStart, windowEnd, currentDay };
  } catch (error) {
    logger.error("Error calculating hot corps:", error);
    return { success: true, hotCorps: {} };
  }
});

/**
 * Get caption trend analytics for a lineup
 * Returns trend indicators without exposing raw scores
 */
exports.getLineupAnalytics = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const { corpsClass } = request.data;
  const uid = request.auth.uid;

  const validClasses = ["worldClass", "openClass", "aClass", "soundSport"];
  if (!validClasses.includes(corpsClass)) {
    throw new HttpsError("invalid-argument", "Invalid corps class specified.");
  }

  const db = getDb();

  try {
    // Get user's lineup
    const profileDoc = await db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`).get();
    if (!profileDoc.exists) {
      throw new HttpsError("not-found", "User profile not found.");
    }

    const profileData = profileDoc.data();
    const lineup = profileData.corps?.[corpsClass]?.lineup;

    if (!lineup) {
      return { success: true, analytics: {} };
    }

    // Get current day from season
    const seasonDoc = await db.doc("game-settings/season").get();
    const currentDay = seasonDoc.exists ? (seasonDoc.data().currentDay || 1) : 1;

    // Analyze trends
    const analytics = await analyzeLineupTrends(lineup, currentDay);

    return { success: true, analytics };
  } catch (error) {
    logger.error(`Failed to get lineup analytics for user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Could not retrieve lineup analytics.");
  }
});