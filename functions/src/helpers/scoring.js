const { getDb, dataNamespaceParam } = require("../config");
const { logger } = require("firebase-functions/v2");
const { getDoc } = require("firebase-admin/firestore");
const admin = require("firebase-admin");
const { shuffleArray, getScheduleDay } = require("./season");
const { calculateLineupSynergyBonus } = require('./showConceptSynergy');
const { SHOW_PARTICIPATION_REWARDS, TRANSACTION_TYPES } = require("../callable/economy");

// OPTIMIZATION #1: Cache for regression calculations to avoid recomputing
// the same corps/year/caption/day combination multiple times per scoring run.
// This cache is cleared at the start of each scoring run to prevent stale data.
const regressionCache = new Map();

/**
 * Clear the regression cache. Should be called at the start of each scoring run.
 */
function clearRegressionCache() {
  regressionCache.clear();
}

/**
 * Get a cached regression score or compute and cache it.
 * Reduces ~40,000 regression calculations to ~2,000 unique calculations per day.
 */
function getCachedRegressionScore(corpsName, sourceYear, caption, currentDay, historicalData) {
  const cacheKey = `${corpsName}|${sourceYear}|${caption}|${currentDay}`;

  if (regressionCache.has(cacheKey)) {
    return regressionCache.get(cacheKey);
  }

  const score = getRealisticCaptionScore(corpsName, sourceYear, caption, currentDay, historicalData);
  regressionCache.set(cacheKey, score);
  return score;
}


async function fetchHistoricalData(dataDocId, additionalYears = []) {
  const db = getDb();
  const corpsDataRef = db.doc(`dci-data/${dataDocId}`);
  const corpsDataSnap = await corpsDataRef.get();
  if (!corpsDataSnap.exists) {
    logger.error(`dci-data document ${dataDocId} not found.`);
    return {};
  }

  const seasonCorpsList = corpsDataSnap.data().corpsValues || [];
  const yearsFromCorps = seasonCorpsList.map((c) => c.sourceYear);
  // Combine corps source years with any additional years (e.g., current year for live season)
  const yearsToFetch = [...new Set([...yearsFromCorps, ...additionalYears.map(String)])];

  const historicalDocs = await Promise.all(
    yearsToFetch.map((year) => db.doc(`historical_scores/${year}`).get())
  );

  const historicalData = {};
  historicalDocs.forEach((doc) => {
    if (doc.exists) {
      historicalData[doc.id] = doc.data().data;
    }
  });
  return historicalData;
}

function simpleLinearRegression(data) {
  const n = data.length;
  if (n < 2) {
    return { m: 0, c: data.length > 0 ? data[0][1] : 0 };
  }

  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (const [x, y] of data) {
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }

  const m = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const c = (sumY - m * sumX) / n;

  return { m, c };
}

function getRealisticCaptionScore(corpsName, sourceYear, caption, currentDay, historicalData) {
  const actualScore = getScoreForDay(currentDay, corpsName, sourceYear, caption, historicalData);
  if (actualScore !== null) {
    return actualScore; // Always use the real score if it exists.
  }

  const allDataPoints = [];
  // OPTIMIZATION: Use Set for O(1) lookups instead of .some() which is O(n)
  // This reduces complexity from O(n²) to O(n)
  const seenDays = new Set();
  const yearData = historicalData[sourceYear] || [];
  for (const event of yearData) {
    // Skip if we've already processed this day
    if (seenDays.has(event.offSeasonDay)) continue;

    const score = getScoreForDay(event.offSeasonDay, corpsName, sourceYear, caption, historicalData);
    if (score !== null) {
      seenDays.add(event.offSeasonDay);
      allDataPoints.push([event.offSeasonDay, score]);
    }
  }

  const maxScore = 20;

  if (allDataPoints.length >= 2) {
    const regression = logarithmicRegression(allDataPoints);
    const predictedScore = regression.predict(currentDay);
    const jitter = (Math.random() - 0.5) * 0.5;
    const finalScore = predictedScore + jitter;
    const roundedScore = parseFloat(finalScore.toFixed(3));
    return Math.max(0, Math.min(maxScore, roundedScore));
  } else if (allDataPoints.length === 1) {
    return allDataPoints[0][1];
  } else {
    // Only warn if we actually fetched data for this year (meaning corps should exist).
    // If the year isn't in historicalData at all, it's likely a stale lineup from a
    // previous season - no need to spam logs for expected missing data.
    if (historicalData[sourceYear] !== undefined) {
      logger.warn(`No historical scores found for ${corpsName} (${sourceYear}), caption ${caption}. Returning 0.`);
    }
    return 0;
  }
}

function getScoreForDay(day, corps, year, caption, historicalData) {
  const events = historicalData[year]?.filter((e) => e.offSeasonDay === day);
  if (!events || events.length === 0) return null;

  for (const event of events) {
    const scoreData = event.scores.find((s) => s.corps === corps);
    if (scoreData && scoreData.captions[caption] > 0) {
      return scoreData.captions[caption]; // Return the first one found
    }
  }
  return null;
}

/**
 * Counts the number of unique data points available for a corps/caption in a given year.
 * Used to determine if there's enough data for regression.
 */
function countDataPointsForCorps(corpsName, year, caption, historicalData) {
  const yearData = historicalData[year] || [];
  const uniqueDays = new Set();

  for (const event of yearData) {
    if (event.offSeasonDay === null) continue; // Skip pre-season events
    const scoreData = event.scores?.find((s) => s.corps === corpsName);
    if (scoreData && scoreData.captions?.[caption] > 0) {
      uniqueDays.add(event.offSeasonDay);
    }
  }

  return uniqueDays.size;
}

function logarithmicRegression(data) {
  const transformedData = data.map(([x, y]) => [x, y > 0 ? Math.log(y) : 0]);

  const { m, c } = simpleLinearRegression(transformedData);

  return {
    predict: (x) => {
      const logPrediction = m * x + c;
      // Use Math.exp() to reverse the Math.log() transformation.
      return Math.exp(logPrediction);
    },
  };
}

/**
 * Get top N corps from season standings with tie handling at cutoff position.
 * Used for championship fallback when previous day results are missing.
 *
 * @param {Array} allRecaps - All season recaps from fantasy_recaps collection
 * @param {number} cutoffRank - Number of corps to include (25 for semis, 12 for finals)
 * @param {Array} eligibleClasses - Array of corps classes to include (e.g., ["worldClass", "openClass", "aClass"])
 * @returns {Array} Array of { uid, corpsClass } for corps that should advance
 */
function getTopCorpsFromSeasonStandings(allRecaps, cutoffRank, eligibleClasses) {
  // Aggregate best score per corps from all season recaps (excluding championship days 45+)
  const corpsScores = new Map(); // key: `${uid}_${corpsClass}`, value: { uid, corpsClass, totalScore, day }

  for (const recap of allRecaps) {
    if (recap.offSeasonDay >= 45) continue; // Skip championship days
    for (const show of (recap.shows || [])) {
      for (const result of (show.results || [])) {
        if (!eligibleClasses.includes(result.corpsClass)) continue;

        const key = `${result.uid}_${result.corpsClass}`;
        const existing = corpsScores.get(key);

        // Use most recent score (highest day number)
        if (!existing || recap.offSeasonDay > existing.day) {
          corpsScores.set(key, {
            uid: result.uid,
            corpsClass: result.corpsClass,
            totalScore: result.totalScore,
            day: recap.offSeasonDay,
          });
        }
      }
    }
  }

  // Convert to array and sort by score descending
  const sortedCorps = Array.from(corpsScores.values())
    .sort((a, b) => b.totalScore - a.totalScore);

  if (sortedCorps.length === 0) {
    return null; // No standings data, fall back to all eligible
  }

  // Handle ties at cutoff position
  let advancingCorps = [];
  if (sortedCorps.length >= cutoffRank) {
    const cutoffScore = sortedCorps[cutoffRank - 1].totalScore;
    advancingCorps = sortedCorps.filter(r => r.totalScore >= cutoffScore);
  } else {
    advancingCorps = sortedCorps;
  }

  return advancingCorps.map(r => ({ uid: r.uid, corpsClass: r.corpsClass }));
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

  // Calculate "yesterday" in Eastern timezone with 2 AM game day reset
  // Game day resets at 2 AM ET, not midnight. Between midnight and 2 AM,
  // we're still in the previous game day and should process the day before that.
  // Solution: Subtract 2 hours from current time, then calculate "yesterday"
  const nowET = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
  // Shift by 2 hours to align with 2 AM game day boundary
  // e.g., 1 AM on Jan 5 becomes 11 PM on Jan 4 (still Jan 4's game day)
  const gameTimeET = new Date(nowET.getTime() - (2 * 60 * 60 * 1000));
  const yesterday = new Date(gameTimeET);
  yesterday.setDate(yesterday.getDate() - 1);
  // Normalize to start of day for consistent day calculation
  yesterday.setHours(0, 0, 0, 0);

  // Also normalize seasonStartDate to start of day for comparison
  const seasonStartNormalized = new Date(seasonStartDate);
  seasonStartNormalized.setHours(0, 0, 0, 0);

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
  const batch = db.batch();
  const dailyScores = new Map();
  // OPTIMIZATION: Collect coin awards to process in batch instead of individual transactions
  const coinAwards = []; // Array of { uid, corpsClass, showName, amount }

  // --- CHAMPIONSHIP WEEK AUTO-ENROLLMENT & PROGRESSION LOGIC ---
  // Structure: { showEventName: { participants: [uid], classFilter: [corpsClass] } }
  let championshipConfig = null;

  if (scoredDay >= 45) {
    const recapDoc = await db.doc(`fantasy_recaps/${seasonData.seasonUid}`).get();
    const allRecaps = recapDoc.exists ? recapDoc.data().recaps || [] : [];

    if (scoredDay === 45) {
      // Day 45: Open and A Class Prelims - All Open and A Class corps auto-enrolled
      championshipConfig = {
        "Open and A Class Prelims": {
          participants: null, // null means all eligible
          classFilter: ["openClass", "aClass"],
        },
      };
      logger.info("Day 45: Auto-enrolling all Open Class and A Class corps in Prelims.");

    } else if (scoredDay === 46) {
      // Day 46: Open and A Class Finals - Top 8 Open, Top 4 A Class from Day 45
      const day45Recap = allRecaps.find(r => r.offSeasonDay === 45);
      const day45Results = day45Recap?.shows?.flatMap(s => s.results) || [];

      // Check if there are actual results, not just if recap exists
      if (day45Results.length > 0) {
        const openClassResults = [];
        const aClassResults = [];

        day45Results.forEach(r => {
          if (r.corpsClass === "openClass") openClassResults.push(r);
          else if (r.corpsClass === "aClass") aClassResults.push(r);
        });

        openClassResults.sort((a, b) => b.totalScore - a.totalScore);
        aClassResults.sort((a, b) => b.totalScore - a.totalScore);

        // Top 8 Open Class
        const top8Open = openClassResults.slice(0, 8).map(r => ({ uid: r.uid, corpsClass: "openClass" }));
        // Top 4 A Class
        const top4AClass = aClassResults.slice(0, 4).map(r => ({ uid: r.uid, corpsClass: "aClass" }));

        const finalists = [...top8Open, ...top4AClass];
        logger.info(`Day 46: ${top8Open.length} Open Class and ${top4AClass.length} A Class corps advancing to Finals.`);

        championshipConfig = {
          "Open and A Class Finals": {
            participants: finalists, // Array of { uid, corpsClass }
            classFilter: ["openClass", "aClass"],
          },
        };
      } else {
        // FALLBACK: No Day 45 results (recap missing OR empty due to maintenance)
        // Auto-enroll all Open/A Class corps to finals
        logger.info("Day 46: No Day 45 results found. Auto-enrolling all Open/A Class corps to Finals.");
        championshipConfig = {
          "Open and A Class Finals": {
            participants: null, // null means all eligible
            classFilter: ["openClass", "aClass"],
          },
        };
      }

    } else if (scoredDay === 47) {
      // Day 47: World Championships Prelims - All World, Open, and A Class corps
      championshipConfig = {
        "marching.art World Championship Prelims": {
          participants: null, // All eligible
          classFilter: ["worldClass", "openClass", "aClass"],
        },
      };
      logger.info("Day 47: Auto-enrolling all World, Open, and A Class corps in World Championship Prelims.");

    } else if (scoredDay === 48) {
      // Day 48: World Championships Semifinals - Top 25 from Day 47
      const prelimsRecap = allRecaps.find(r => r.offSeasonDay === 47);
      const prelimsResults = prelimsRecap?.shows?.flatMap(s => s.results) || [];

      // Check if there are actual results, not just if recap exists
      if (prelimsResults.length > 0) {
        prelimsResults.sort((a, b) => b.totalScore - a.totalScore);

        // Handle tie at 25th place
        let advancingCorps = [];
        if (prelimsResults.length >= 25) {
          const twentyFifthPlaceScore = prelimsResults[24].totalScore;
          advancingCorps = prelimsResults.filter(r => r.totalScore >= twentyFifthPlaceScore);
        } else {
          advancingCorps = prelimsResults;
        }

        const participants = advancingCorps.map(r => ({ uid: r.uid, corpsClass: r.corpsClass }));
        logger.info(`Day 48: ${participants.length} corps advancing to Semifinals.`);

        championshipConfig = {
          "marching.art World Championship Semifinals": {
            participants,
            classFilter: ["worldClass", "openClass", "aClass"],
          },
        };
      } else {
        // FALLBACK: No Day 47 results (recap missing OR empty due to maintenance)
        // Use season standings to get top 25 corps instead of auto-enrolling everyone
        logger.info("Day 48: No Day 47 results found. Using season standings for top 25 corps.");
        const eligibleClasses = ["worldClass", "openClass", "aClass"];
        const top25FromStandings = getTopCorpsFromSeasonStandings(allRecaps, 25, eligibleClasses);

        if (top25FromStandings && top25FromStandings.length > 0) {
          logger.info(`Day 48: ${top25FromStandings.length} corps advancing to Semifinals from season standings.`);
          championshipConfig = {
            "marching.art World Championship Semifinals": {
              participants: top25FromStandings,
              classFilter: eligibleClasses,
            },
          };
        } else {
          // No season standings data at all - fall back to all eligible as last resort
          logger.info("Day 48: No season standings data. Auto-enrolling all eligible corps.");
          championshipConfig = {
            "marching.art World Championship Semifinals": {
              participants: null,
              classFilter: eligibleClasses,
            },
          };
        }
      }

    } else if (scoredDay === 49) {
      // Day 49: Two shows - World Finals (top 12) and SoundSport Festival (all SoundSport)
      const semisRecap = allRecaps.find(r => r.offSeasonDay === 48);
      const semisResults = semisRecap?.shows?.flatMap(s => s.results) || [];

      championshipConfig = {
        // World Championship Finals - Top 12 from Day 48
        "marching.art World Championship Finals": {
          participants: null, // Will be set to specific corps if semis results exist
          classFilter: ["worldClass", "openClass", "aClass"],
        },
        // SoundSport Festival - All SoundSport corps
        "SoundSport International Music & Food Festival": {
          participants: null, // All eligible
          classFilter: ["soundSport"],
        },
      };

      // Check if there are actual results, not just if recap exists
      if (semisResults.length > 0) {
        semisResults.sort((a, b) => b.totalScore - a.totalScore);

        // Handle tie at 12th place
        let finalists = [];
        if (semisResults.length >= 12) {
          const twelfthPlaceScore = semisResults[11].totalScore;
          finalists = semisResults.filter(r => r.totalScore >= twelfthPlaceScore);
        } else {
          finalists = semisResults;
        }

        championshipConfig["marching.art World Championship Finals"].participants =
          finalists.map(r => ({ uid: r.uid, corpsClass: r.corpsClass }));

        logger.info(`Day 49: ${finalists.length} corps advancing to World Championship Finals.`);
      } else {
        // FALLBACK: No Day 48 results (recap missing OR empty due to maintenance)
        // Use season standings to get top 12 corps instead of auto-enrolling everyone
        logger.info("Day 49: No Day 48 results found. Using season standings for top 12 corps.");
        const eligibleClasses = ["worldClass", "openClass", "aClass"];
        const top12FromStandings = getTopCorpsFromSeasonStandings(allRecaps, 12, eligibleClasses);

        if (top12FromStandings && top12FromStandings.length > 0) {
          championshipConfig["marching.art World Championship Finals"].participants = top12FromStandings;
          logger.info(`Day 49: ${top12FromStandings.length} corps advancing to Finals from season standings.`);
        } else {
          // No season standings data at all - fall back to all eligible as last resort
          logger.info("Day 49: No season standings data. Auto-enrolling all eligible corps.");
          // participants is already null, which means all eligible
        }
      }
      logger.info("Day 49: All SoundSport corps enrolled in SoundSport Festival.");
    }
  }
  // --- END: CHAMPIONSHIP WEEK AUTO-ENROLLMENT & PROGRESSION LOGIC ---

  if (!dayEventData || !dayEventData.shows || dayEventData.shows.length === 0) {
    logger.info(`No shows for day ${scoredDay}. Nothing to process.`);
    return;
  }

  // Scoring statistics tracking for diagnostics
  let corpsWithNoShowsSelected = 0;
  let corpsProcessed = 0;
  let corpsScored = 0;

  for (const show of dayEventData.shows) {
    const showResult = {
      eventName: show.eventName,
      location: show.location,
      results: [],
    };

    // --- DAY 41/42 REGIONAL SPLIT LOGIC ---
    let day41_42_participants = null;
    if ([41, 42].includes(scoredDay) && show.eventName.includes("Eastern Classic")) {
        const allEnrollees = [];
        for (const userDoc of profilesSnapshot.docs) {
            const userProfile = userDoc.data();
            const userShows = userProfile.corps?.worldClass?.selectedShows?.[`week${week}`] || [];
            if (userShows.some(s => s.eventName === show.eventName)) {
                allEnrollees.push(userDoc.ref.parent.parent.id);
            }
        }
        allEnrollees.sort(); // Deterministic sort
        const splitIndex = Math.ceil(allEnrollees.length / 2);
        if (scoredDay === 41) {
            day41_42_participants = allEnrollees.slice(0, splitIndex);
            logger.info(`Day 41: Scoring first half (${day41_42_participants.length}) of Eastern Classic enrollees.`);
        } else { // Day 42
            day41_42_participants = allEnrollees.slice(splitIndex);
            logger.info(`Day 42: Scoring second half (${day41_42_participants.length}) of Eastern Classic enrollees.`);
        }
    }
    // --- END: DAY 41/42 REGIONAL SPLIT LOGIC ---

    // --- CHAMPIONSHIP SHOW CONFIGURATION ---
    // Get config for this specific show if it's a championship event
    const showConfig = championshipConfig ? championshipConfig[show.eventName] : null;
    // --- END: CHAMPIONSHIP SHOW CONFIGURATION ---

    for (const userDoc of profilesSnapshot.docs) {
      const userProfile = userDoc.data();
      const uid = userDoc.ref.parent.parent.id;

      // Filter for regional split
      if (day41_42_participants && !day41_42_participants.includes(uid)) continue;

      const userCorps = userProfile.corps || {};
      for (const corpsClass of Object.keys(userCorps)) {
        const corps = userCorps[corpsClass];
        if (!corps || !corps.corpsName || !corps.lineup) continue;

        let attended = false;

        // Championship Week Logic (Days 45-49)
        if (showConfig) {
          // Check if this corps class is eligible for this show
          if (!showConfig.classFilter.includes(corpsClass)) {
            continue; // This class can't participate in this show
          }

          // Check if this user/class combo is in the participants list (for advancement rounds)
          if (showConfig.participants !== null) {
            // participants is an array of { uid, corpsClass } objects
            const isParticipant = showConfig.participants.some(
              p => p.uid === uid && p.corpsClass === corpsClass
            );
            if (!isParticipant) {
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
          corpsProcessed++;
          if (userShows.length === 0) {
            corpsWithNoShowsSelected++;
          }
        }

        if (attended) {
          corpsScored++;
          let geScore = 0, rawVisualScore = 0, rawMusicScore = 0;

          // Calculate synergy bonus for show concept
          const { captionBonuses } = calculateLineupSynergyBonus(
            corps.showConcept || {},
            corps.lineup
          );

          for (const caption in corps.lineup) {
            const [corpsName, sourceYear, points] = corps.lineup[caption].split("|");
            // OPTIMIZATION #1: Use cached regression score to avoid recomputing
            const baseCaptionScore = getCachedRegressionScore(corpsName, sourceYear, caption, scoredDay, historicalData);

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
            totalScore: totalShowScore,
            geScore, visualScore, musicScore,
          });
        }
      }
    }
    dailyRecap.shows.push(showResult);
  }

  // Log scoring statistics for diagnostics
  logger.info(`Day ${scoredDay} scoring stats: ${corpsProcessed} corps processed, ${corpsScored} corps scored, ${corpsWithNoShowsSelected} corps with no shows selected for week ${week}`);

  // Action 1: Update user profiles with their most recent score
  // Note: Uses latest score (not cumulative) - drum corps rankings are based on most recent performance
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

  // Action 2: Save the completed recap document
  const recapDocRef = db.doc(`fantasy_recaps/${seasonData.seasonUid}`);
  const recapDoc = await recapDocRef.get();
  if (!recapDoc.exists) {
    batch.set(recapDocRef, {
      seasonName: seasonData.name,
      recaps: [dailyRecap],
    });
  } else {
    const existingRecaps = recapDoc.data().recaps || [];
    const updatedRecaps = existingRecaps.filter((r) => r.offSeasonDay !== scoredDay);
    updatedRecaps.push(dailyRecap);
    batch.update(recapDocRef, { recaps: updatedRecaps });
  }

  // --- TROPHY AWARDING LOGIC ---
  const regionalTrophyDays = [28, 35, 41, 42];
  const metals = ['gold', 'silver', 'bronze'];

  if (regionalTrophyDays.includes(scoredDay)) {
    logger.info(`Day ${scoredDay} is a regional trophy day. Awarding trophies...`);
    dailyRecap.shows.forEach(show => {
        show.results.sort((a,b) => b.totalScore - a.totalScore);
        const top3 = show.results.slice(0, 3);

        top3.forEach((winner, index) => {
            const userProfileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${winner.uid}/profile/data`);
            const trophy = {
                type: 'regional',
                metal: metals[index],
                seasonName: seasonData.name,
                eventName: show.eventName,
                score: winner.totalScore,
                rank: index + 1
            };
            batch.update(userProfileRef, {
                'trophies.regionals': admin.firestore.FieldValue.arrayUnion(trophy)
            });
        });
    });
  }

  // Day 46: Open and A Class Finals - Award class-specific trophies
  if (scoredDay === 46) {
    logger.info("Day 46: Awarding Open and A Class Finals trophies...");
    dailyRecap.shows.forEach(show => {
      // Group results by class for separate awards
      const openClassResults = show.results.filter(r => r.corpsClass === "openClass");
      const aClassResults = show.results.filter(r => r.corpsClass === "aClass");

      // Sort each class
      openClassResults.sort((a, b) => b.totalScore - a.totalScore);
      aClassResults.sort((a, b) => b.totalScore - a.totalScore);

      // Award Open Class champion trophies (top 3)
      openClassResults.slice(0, 3).forEach((winner, index) => {
        const userProfileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${winner.uid}/profile/data`);
        const trophy = {
          type: 'class_championship',
          classType: 'openClass',
          metal: metals[index],
          seasonName: seasonData.name,
          eventName: show.eventName,
          score: winner.totalScore,
          rank: index + 1
        };
        batch.update(userProfileRef, {
          'trophies.classChampionships': admin.firestore.FieldValue.arrayUnion(trophy)
        });
      });

      // Award A Class champion trophies (top 3)
      aClassResults.slice(0, 3).forEach((winner, index) => {
        const userProfileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${winner.uid}/profile/data`);
        const trophy = {
          type: 'class_championship',
          classType: 'aClass',
          metal: metals[index],
          seasonName: seasonData.name,
          eventName: show.eventName,
          score: winner.totalScore,
          rank: index + 1
        };
        batch.update(userProfileRef, {
          'trophies.classChampionships': admin.firestore.FieldValue.arrayUnion(trophy)
        });
      });

      // Award finalist ribbons to all participants
      show.results.forEach((finalist) => {
        const userProfileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${finalist.uid}/profile/data`);
        const ribbon = {
          type: 'class_finalist',
          classType: finalist.corpsClass,
          seasonName: seasonData.name,
          eventName: show.eventName
        };
        batch.update(userProfileRef, {
          'trophies.classFinalistRibbons': admin.firestore.FieldValue.arrayUnion(ribbon)
        });
      });

      logger.info(`Awarded trophies to ${openClassResults.slice(0, 3).length} Open Class and ${aClassResults.slice(0, 3).length} A Class champions.`);
    });
  }

  if (scoredDay === 49) { // Finals Day - Multiple shows
    logger.info(`Day ${scoredDay} is Finals day. Awarding championship trophies and finalist medals...`);

    // Collect all results by class for season champions
    const allResultsByClass = {};

    // Process each show on Day 49 (World Finals and SoundSport Festival)
    for (const show of dailyRecap.shows) {
      show.results.sort((a, b) => b.totalScore - a.totalScore);

      // Determine trophy type based on show
      const isSoundSport = show.eventName.includes("SoundSport");
      const trophyType = isSoundSport ? 'soundsport_championship' : 'championship';

      // Award trophies to top 3
      const top3 = show.results.slice(0, 3);
      top3.forEach((winner, index) => {
        const userProfileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${winner.uid}/profile/data`);
        const trophy = {
          type: trophyType,
          metal: metals[index],
          seasonName: seasonData.name,
          eventName: show.eventName,
          score: winner.totalScore,
          rank: index + 1
        };
        batch.update(userProfileRef, {
          'trophies.championships': admin.firestore.FieldValue.arrayUnion(trophy)
        });
      });

      // Award finalist medals/ribbons to all participants
      show.results.forEach((finalist, index) => {
        const userProfileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${finalist.uid}/profile/data`);
        const medal = {
          type: isSoundSport ? 'soundsport_finalist' : 'finalist',
          seasonName: seasonData.name,
          eventName: show.eventName,
          rank: index + 1
        };
        batch.update(userProfileRef, {
          'trophies.finalistMedals': admin.firestore.FieldValue.arrayUnion(medal)
        });
      });

      // Collect results by class for season champions
      show.results.forEach(result => {
        const corpsClass = result.corpsClass || 'worldClass';
        if (!allResultsByClass[corpsClass]) {
          allResultsByClass[corpsClass] = [];
        }
        allResultsByClass[corpsClass].push(result);
      });
    }

    // --- SAVE SEASON CHAMPIONS BY CLASS ---
    const seasonChampionsData = {
      seasonId: seasonData.seasonUid,
      seasonName: seasonData.name,
      seasonType: seasonData.status,
      archivedAt: new Date(),
      classes: {}
    };

    // OPTIMIZATION #4: Collect all champion UIDs first, then batch fetch all profiles at once
    // instead of making N individual reads per class
    const allChampionsByClass = {};
    const allChampionUids = new Set();

    // First pass: identify all champions and collect their UIDs
    for (const [corpsClass, classResults] of Object.entries(allResultsByClass)) {
      classResults.sort((a, b) => b.totalScore - a.totalScore);
      const classTop3 = classResults.slice(0, 3);
      allChampionsByClass[corpsClass] = classTop3;
      classTop3.forEach(r => allChampionUids.add(r.uid));
    }

    // Single batched fetch for all champion profiles
    const championProfileRefs = [...allChampionUids].map(uid =>
      db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`)
    );
    const championProfileDocs = championProfileRefs.length > 0 ? await db.getAll(...championProfileRefs) : [];
    const championUsernameMap = new Map();
    championProfileDocs.forEach(doc => {
      if (doc.exists) {
        championUsernameMap.set(doc.ref.parent.parent.id, doc.data().username || 'Unknown');
      }
    });

    // Second pass: build champion data using the pre-fetched usernames
    for (const [corpsClass, classTop3] of Object.entries(allChampionsByClass)) {
      const championsWithUsernames = classTop3.map((result, index) => ({
        rank: index + 1,
        uid: result.uid,
        username: championUsernameMap.get(result.uid) || 'Unknown',
        corpsName: result.corpsName,
        score: result.totalScore
      }));
      seasonChampionsData.classes[corpsClass] = championsWithUsernames;
    }

    // Save to season_champions collection
    const seasonChampionsRef = db.doc(`season_champions/${seasonData.seasonUid}`);
    batch.set(seasonChampionsRef, seasonChampionsData);
    logger.info(`Saved season champions for ${Object.keys(allResultsByClass).length} classes.`);
    // --- END SAVE SEASON CHAMPIONS BY CLASS ---
  }
  // --- END: TROPHY AWARDING LOGIC ---

  // OPTIMIZATION: Process all coin awards in batch instead of individual transactions
  // Aggregate by uid to minimize writes (multiple shows = single update per user)
  if (coinAwards.length > 0) {
    const coinByUser = new Map(); // uid -> { totalAmount, history: [] }

    for (const award of coinAwards) {
      const existing = coinByUser.get(award.uid) || { totalAmount: 0, history: [] };
      existing.totalAmount += award.amount;
      existing.history.push({
        type: TRANSACTION_TYPES.SHOW_PARTICIPATION,
        amount: award.amount,
        description: `Show performance at ${award.showName}`,
        corpsClass: award.corpsClass,
        timestamp: new Date(),
      });
      coinByUser.set(award.uid, existing);
    }

    // Add coin updates to batch (uses increment for concurrency safety)
    for (const [uid, data] of coinByUser) {
      const userProfileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);
      batch.update(userProfileRef, {
        corpsCoin: admin.firestore.FieldValue.increment(data.totalAmount),
        corpsCoinHistory: admin.firestore.FieldValue.arrayUnion(...data.history),
      });
    }
    logger.info(`Batched ${coinAwards.length} coin awards for ${coinByUser.size} users`);
  }

  // Commit all database writes at once
  await batch.commit();
  logger.info(`Successfully processed and archived scores for day ${scoredDay}.`);

  if (scoredDay % 7 === 0) {
    const week = scoredDay / 7;
    logger.info(`End of week ${week}. Determining class-based matchup winners...`);

    const leaguesSnapshot = await db.collection("leagues").get();
    const winnerBatch = db.batch();
    const corpsClasses = ["worldClass", "openClass", "aClass", "soundSport"];

    for (const leagueDoc of leaguesSnapshot.docs) {
      const matchupDocRef = db.doc(`leagues/${leagueDoc.id}/matchups/week${week}`);
      const matchupDoc = await matchupDocRef.get();

      if (matchupDoc.exists) {
        const matchupData = matchupDoc.data();
        let hasUpdates = false;

        for (const corpsClass of corpsClasses) {
          const matchupArrayKey = `${corpsClass}Matchups`;
          const matchups = matchupData[matchupArrayKey] || [];
          if (matchups.length === 0) continue;

          const updatedMatchupsForClass = [];

          // OPTIMIZATION: Batch fetch all matchup profiles for this class upfront
          const matchupsNeedingScores = matchups.filter(m => !m.winner);
          const allPlayerIds = [...new Set(matchupsNeedingScores.flatMap(m => m.pair))];

          // Batch fetch all profiles in ONE operation
          const profileRefs = allPlayerIds.map(uid =>
            db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`)
          );
          const profileDocs = allPlayerIds.length > 0 ? await db.getAll(...profileRefs) : [];
          const profileMap = new Map();
          profileDocs.forEach((doc, i) => {
            if (doc.exists) {
              profileMap.set(allPlayerIds[i], { ref: doc.ref, data: doc.data() });
            }
          });

          for (const matchup of matchups) {
            if (matchup.winner) {
              updatedMatchupsForClass.push(matchup);
              continue;
            }

            const [p1_uid, p2_uid] = matchup.pair;
            const p1_profile = profileMap.get(p1_uid);
            const p2_profile = profileMap.get(p2_uid);

            // IMPORTANT: Get score for the SPECIFIC corps class, not total score
            const p1_score = p1_profile?.data?.corps?.[corpsClass]?.totalSeasonScore || 0;
            const p2_score = p2_profile?.data?.corps?.[corpsClass]?.totalSeasonScore || 0;

            let winnerUid = null;
            if (p1_score > p2_score) winnerUid = p1_uid;
            if (p2_score > p1_score) winnerUid = p2_uid;

            // Path to the new, class-specific record
            const seasonRecordPath = `seasons.${seasonData.seasonUid}.records.${corpsClass}`;
            const increment = admin.firestore.FieldValue.increment(1);

            if (p1_profile?.ref && p2_profile?.ref) {
              if (winnerUid === p1_uid) {
                winnerBatch.set(p1_profile.ref, { [seasonRecordPath]: { w: increment } }, { merge: true });
                winnerBatch.set(p2_profile.ref, { [seasonRecordPath]: { l: increment } }, { merge: true });
              } else if (winnerUid === p2_uid) {
                winnerBatch.set(p1_profile.ref, { [seasonRecordPath]: { l: increment } }, { merge: true });
                winnerBatch.set(p2_profile.ref, { [seasonRecordPath]: { w: increment } }, { merge: true });
              } else { // Tie
                winnerBatch.set(p1_profile.ref, { [seasonRecordPath]: { t: increment } }, { merge: true });
                winnerBatch.set(p2_profile.ref, { [seasonRecordPath]: { t: increment } }, { merge: true });
              }
            }

            const newMatchup = {
              ...matchup,
              scores: { [p1_uid]: p1_score, [p2_uid]: p2_score },
              winner: winnerUid,
            };
            updatedMatchupsForClass.push(newMatchup);
          }
          matchupData[matchupArrayKey] = updatedMatchupsForClass;
          hasUpdates = true;
        }
        if (hasUpdates) {
          winnerBatch.update(matchupDocRef, matchupData);
        }
      }
    }
    await winnerBatch.commit();
    logger.info(`Matchup winner determination for week ${week} complete.`);
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
  const batch = db.batch();
  const dailyScores = new Map();
  // OPTIMIZATION: Collect coin awards to process in batch instead of individual transactions
  const coinAwards = []; // Array of { uid, corpsClass, showName, amount }

  // --- CHAMPIONSHIP WEEK AUTO-ENROLLMENT & PROGRESSION LOGIC (Days 45-49) ---
  let championshipConfig = null;

  if (scoredDay >= 45) {
    const recapDoc = await db.doc(`fantasy_recaps/${seasonData.seasonUid}`).get();
    const allRecaps = recapDoc.exists ? recapDoc.data().recaps || [] : [];

    if (scoredDay === 45) {
      // Day 45: Open and A Class Prelims - All Open and A Class corps auto-enrolled
      championshipConfig = {
        "Open and A Class Prelims": {
          participants: null,
          classFilter: ["openClass", "aClass"],
        },
      };
      logger.info("Day 45: Auto-enrolling all Open Class and A Class corps in Prelims.");

    } else if (scoredDay === 46) {
      // Day 46: Open and A Class Finals - Top 8 Open, Top 4 A Class from Day 45
      const day45Recap = allRecaps.find(r => r.offSeasonDay === 45);
      const day45Results = day45Recap?.shows?.flatMap(s => s.results) || [];

      // Check if there are actual results, not just if recap exists
      if (day45Results.length > 0) {
        const openClassResults = [];
        const aClassResults = [];

        day45Results.forEach(r => {
          if (r.corpsClass === "openClass") openClassResults.push(r);
          else if (r.corpsClass === "aClass") aClassResults.push(r);
        });

        openClassResults.sort((a, b) => b.totalScore - a.totalScore);
        aClassResults.sort((a, b) => b.totalScore - a.totalScore);

        const top8Open = openClassResults.slice(0, 8).map(r => ({ uid: r.uid, corpsClass: "openClass" }));
        const top4AClass = aClassResults.slice(0, 4).map(r => ({ uid: r.uid, corpsClass: "aClass" }));
        const finalists = [...top8Open, ...top4AClass];
        logger.info(`Day 46: ${top8Open.length} Open Class and ${top4AClass.length} A Class corps advancing to Finals.`);

        championshipConfig = {
          "Open and A Class Finals": {
            participants: finalists,
            classFilter: ["openClass", "aClass"],
          },
        };
      } else {
        // FALLBACK: No Day 45 results (recap missing OR empty due to maintenance)
        // Auto-enroll all Open/A Class corps to finals
        logger.info("Day 46: No Day 45 results found. Auto-enrolling all Open/A Class corps to Finals.");
        championshipConfig = {
          "Open and A Class Finals": {
            participants: null, // null means all eligible
            classFilter: ["openClass", "aClass"],
          },
        };
      }

    } else if (scoredDay === 47) {
      // Day 47: World Championships Prelims - All World, Open, and A Class corps
      championshipConfig = {
        "marching.art World Championship Prelims": {
          participants: null,
          classFilter: ["worldClass", "openClass", "aClass"],
        },
      };
      logger.info("Day 47: Auto-enrolling all World, Open, and A Class corps in World Championship Prelims.");

    } else if (scoredDay === 48) {
      // Day 48: World Championships Semifinals - Top 25 from Day 47
      const prelimsRecap = allRecaps.find(r => r.offSeasonDay === 47);
      const prelimsResults = prelimsRecap?.shows?.flatMap(s => s.results) || [];

      // Check if there are actual results, not just if recap exists
      if (prelimsResults.length > 0) {
        prelimsResults.sort((a, b) => b.totalScore - a.totalScore);

        let advancingCorps = [];
        if (prelimsResults.length >= 25) {
          const twentyFifthPlaceScore = prelimsResults[24].totalScore;
          advancingCorps = prelimsResults.filter(r => r.totalScore >= twentyFifthPlaceScore);
        } else {
          advancingCorps = prelimsResults;
        }

        const participants = advancingCorps.map(r => ({ uid: r.uid, corpsClass: r.corpsClass }));
        logger.info(`Day 48: ${participants.length} corps advancing to Semifinals.`);

        championshipConfig = {
          "marching.art World Championship Semifinals": {
            participants,
            classFilter: ["worldClass", "openClass", "aClass"],
          },
        };
      } else {
        // FALLBACK: No Day 47 results (recap missing OR empty due to maintenance)
        // Use season standings to get top 25 corps instead of auto-enrolling everyone
        logger.info("Day 48: No Day 47 results found. Using season standings for top 25 corps.");
        const eligibleClasses = ["worldClass", "openClass", "aClass"];
        const top25FromStandings = getTopCorpsFromSeasonStandings(allRecaps, 25, eligibleClasses);

        if (top25FromStandings && top25FromStandings.length > 0) {
          logger.info(`Day 48: ${top25FromStandings.length} corps advancing to Semifinals from season standings.`);
          championshipConfig = {
            "marching.art World Championship Semifinals": {
              participants: top25FromStandings,
              classFilter: eligibleClasses,
            },
          };
        } else {
          // No season standings data at all - fall back to all eligible as last resort
          logger.info("Day 48: No season standings data. Auto-enrolling all eligible corps.");
          championshipConfig = {
            "marching.art World Championship Semifinals": {
              participants: null,
              classFilter: eligibleClasses,
            },
          };
        }
      }

    } else if (scoredDay === 49) {
      // Day 49: Two shows - World Finals (top 12) and SoundSport Festival (all SoundSport)
      const semisRecap = allRecaps.find(r => r.offSeasonDay === 48);
      const semisResults = semisRecap?.shows?.flatMap(s => s.results) || [];

      championshipConfig = {
        "marching.art World Championship Finals": {
          participants: null, // Will be set to specific corps if semis results exist
          classFilter: ["worldClass", "openClass", "aClass"],
        },
        "SoundSport International Music & Food Festival": {
          participants: null,
          classFilter: ["soundSport"],
        },
      };

      // Check if there are actual results, not just if recap exists
      if (semisResults.length > 0) {
        semisResults.sort((a, b) => b.totalScore - a.totalScore);

        let finalists = [];
        if (semisResults.length >= 12) {
          const twelfthPlaceScore = semisResults[11].totalScore;
          finalists = semisResults.filter(r => r.totalScore >= twelfthPlaceScore);
        } else {
          finalists = semisResults;
        }

        championshipConfig["marching.art World Championship Finals"].participants =
          finalists.map(r => ({ uid: r.uid, corpsClass: r.corpsClass }));
        logger.info(`Day 49: ${finalists.length} corps advancing to World Championship Finals.`);
      } else {
        // FALLBACK: No Day 48 results (recap missing OR empty due to maintenance)
        // Use season standings to get top 12 corps instead of auto-enrolling everyone
        logger.info("Day 49: No Day 48 results found. Using season standings for top 12 corps.");
        const eligibleClasses = ["worldClass", "openClass", "aClass"];
        const top12FromStandings = getTopCorpsFromSeasonStandings(allRecaps, 12, eligibleClasses);

        if (top12FromStandings && top12FromStandings.length > 0) {
          championshipConfig["marching.art World Championship Finals"].participants = top12FromStandings;
          logger.info(`Day 49: ${top12FromStandings.length} corps advancing to Finals from season standings.`);
        } else {
          // No season standings data at all - fall back to all eligible as last resort
          logger.info("Day 49: No season standings data. Auto-enrolling all eligible corps.");
          // participants is already null, which means all eligible
        }
      }
      logger.info("Day 49: All SoundSport corps enrolled in SoundSport Festival.");
    }
  }
  // --- END: CHAMPIONSHIP WEEK AUTO-ENROLLMENT & PROGRESSION LOGIC ---

  // Fetch day data from subcollection instead of season document
  const dayEventData = await getScheduleDay(seasonData.seasonUid, scoredDay);

  if (!dayEventData || !dayEventData.shows || dayEventData.shows.length === 0) {
    logger.info(`No shows for day ${scoredDay}. Nothing to process.`);
    return;
  }

  for (const show of dayEventData.shows) {
    const showResult = {
      eventName: show.eventName,
      location: show.location,
      results: [],
    };

    // --- DAY 41/42 REGIONAL SPLIT LOGIC ---
    let day41_42_participants = null;
    if ([41, 42].includes(scoredDay) && show.eventName.includes("Eastern Classic")) {
      const allEnrollees = [];
      for (const userDoc of profilesSnapshot.docs) {
        const userProfile = userDoc.data();
        const userShows = userProfile.corps?.worldClass?.selectedShows?.[`week${week}`] || [];
        if (userShows.some(s => s.eventName === show.eventName)) {
          allEnrollees.push(userDoc.ref.parent.parent.id);
        }
      }
      allEnrollees.sort();
      const splitIndex = Math.ceil(allEnrollees.length / 2);
      if (scoredDay === 41) {
        day41_42_participants = allEnrollees.slice(0, splitIndex);
        logger.info(`Day 41: Scoring first half (${day41_42_participants.length}) of Eastern Classic enrollees.`);
      } else {
        day41_42_participants = allEnrollees.slice(splitIndex);
        logger.info(`Day 42: Scoring second half (${day41_42_participants.length}) of Eastern Classic enrollees.`);
      }
    }
    // --- END: DAY 41/42 REGIONAL SPLIT LOGIC ---

    const showConfig = championshipConfig ? championshipConfig[show.eventName] : null;

    for (const userDoc of profilesSnapshot.docs) {
      const userProfile = userDoc.data();
      const uid = userDoc.ref.parent.parent.id;

      if (day41_42_participants && !day41_42_participants.includes(uid)) continue;

      const userCorps = userProfile.corps || {};
      for (const corpsClass of Object.keys(userCorps)) {
        const corps = userCorps[corpsClass];
        if (!corps || !corps.corpsName || !corps.lineup) continue;

        let attended = false;

        // Championship Week Logic (Days 45-49)
        if (showConfig) {
          if (!showConfig.classFilter.includes(corpsClass)) {
            continue;
          }

          if (showConfig.participants !== null) {
            const isParticipant = showConfig.participants.some(
              p => p.uid === uid && p.corpsClass === corpsClass
            );
            if (!isParticipant) {
              continue;
            }
          }

          attended = true;
        } else {
          // Regular show - check manual registration
          const userShows = corps.selectedShows?.[`week${week}`] || [];
          attended = userShows.some(s => s.eventName === show.eventName);
        }

        if (attended) {
          let geScore = 0, rawVisualScore = 0, rawMusicScore = 0;

          // Calculate synergy bonus for show concept
          const { captionBonuses } = calculateLineupSynergyBonus(
            corps.showConcept || {},
            corps.lineup
          );

          for (const caption in corps.lineup) {
            const [corpsName, sourceYear] = corps.lineup[caption].split("|");

            // For live season scoring:
            // 1. First check for actual score in current year (scraped live data)
            // 2. If not found, use prior year (sourceYear from lineup) for regression
            let baseCaptionScore = getScoreForDay(scoredDay, corpsName, currentYear.toString(), caption, historicalData);

            if (baseCaptionScore === null) {
              // No scraped score for current year on this exact day
              // Try current year regression first if we have enough data points
              const currentYearDataPoints = countDataPointsForCorps(
                corpsName, currentYear.toString(), caption, historicalData
              );

              if (currentYearDataPoints >= 3) {
                // Use current year data for regression (enough scraped data exists)
                // OPTIMIZATION #1: Use cached regression score
                baseCaptionScore = getCachedRegressionScore(
                  corpsName,
                  currentYear.toString(),
                  caption,
                  scoredDay,
                  historicalData
                );
              } else {
                // Fall back to prior year data for regression predictions
                // OPTIMIZATION #1: Use cached regression score
                baseCaptionScore = getCachedRegressionScore(
                  corpsName,
                  sourceYear,
                  caption,
                  scoredDay,
                  historicalData
                );
              }
            }

            const synergyBonus = captionBonuses[caption] || 0;
            const captionScore = Math.min(20, baseCaptionScore + synergyBonus);

            if (["GE1", "GE2"].includes(caption)) geScore += captionScore;
            else if (["VP", "VA", "CG"].includes(caption)) rawVisualScore += captionScore;
            else if (["B", "MA", "P"].includes(caption)) rawMusicScore += captionScore;
          }

          const visualScore = rawVisualScore / 2;
          const musicScore = rawMusicScore / 2;
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
            totalScore: totalShowScore,
            geScore, visualScore, musicScore,
          });
        }
      }
    }
    dailyRecap.shows.push(showResult);
  }

  // Update user profiles with their most recent score
  // Note: Uses latest score (not cumulative) - drum corps rankings are based on most recent performance
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

  // --- TROPHY AWARDING LOGIC ---
  const regionalTrophyDays = [28, 35, 41, 42];
  const metals = ['gold', 'silver', 'bronze'];

  if (regionalTrophyDays.includes(scoredDay)) {
    logger.info(`Day ${scoredDay} is a regional trophy day. Awarding trophies...`);
    dailyRecap.shows.forEach(show => {
      show.results.sort((a, b) => b.totalScore - a.totalScore);
      const top3 = show.results.slice(0, 3);

      top3.forEach((winner, index) => {
        const userProfileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${winner.uid}/profile/data`);
        const trophy = {
          type: 'regional',
          metal: metals[index],
          seasonName: seasonData.name,
          eventName: show.eventName,
          score: winner.totalScore,
          rank: index + 1
        };
        batch.update(userProfileRef, {
          'trophies.regionals': admin.firestore.FieldValue.arrayUnion(trophy)
        });
      });
    });
  }

  // Day 46: Open and A Class Finals - Award class-specific trophies
  if (scoredDay === 46) {
    logger.info("Day 46: Awarding Open and A Class Finals trophies...");
    dailyRecap.shows.forEach(show => {
      const openClassResults = show.results.filter(r => r.corpsClass === "openClass");
      const aClassResults = show.results.filter(r => r.corpsClass === "aClass");

      openClassResults.sort((a, b) => b.totalScore - a.totalScore);
      aClassResults.sort((a, b) => b.totalScore - a.totalScore);

      openClassResults.slice(0, 3).forEach((winner, index) => {
        const userProfileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${winner.uid}/profile/data`);
        const trophy = {
          type: 'class_championship',
          classType: 'openClass',
          metal: metals[index],
          seasonName: seasonData.name,
          eventName: show.eventName,
          score: winner.totalScore,
          rank: index + 1
        };
        batch.update(userProfileRef, {
          'trophies.classChampionships': admin.firestore.FieldValue.arrayUnion(trophy)
        });
      });

      aClassResults.slice(0, 3).forEach((winner, index) => {
        const userProfileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${winner.uid}/profile/data`);
        const trophy = {
          type: 'class_championship',
          classType: 'aClass',
          metal: metals[index],
          seasonName: seasonData.name,
          eventName: show.eventName,
          score: winner.totalScore,
          rank: index + 1
        };
        batch.update(userProfileRef, {
          'trophies.classChampionships': admin.firestore.FieldValue.arrayUnion(trophy)
        });
      });

      show.results.forEach((finalist) => {
        const userProfileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${finalist.uid}/profile/data`);
        const ribbon = {
          type: 'class_finalist',
          classType: finalist.corpsClass,
          seasonName: seasonData.name,
          eventName: show.eventName
        };
        batch.update(userProfileRef, {
          'trophies.classFinalistRibbons': admin.firestore.FieldValue.arrayUnion(ribbon)
        });
      });

      logger.info(`Awarded trophies to ${openClassResults.slice(0, 3).length} Open Class and ${aClassResults.slice(0, 3).length} A Class champions.`);
    });
  }

  if (scoredDay === 49) { // Finals Day
    logger.info(`Day ${scoredDay} is Finals day. Awarding championship trophies and finalist medals...`);

    const allResultsByClass = {};

    for (const show of dailyRecap.shows) {
      show.results.sort((a, b) => b.totalScore - a.totalScore);

      const isSoundSport = show.eventName.includes("SoundSport");
      const trophyType = isSoundSport ? 'soundsport_championship' : 'championship';

      const top3 = show.results.slice(0, 3);
      top3.forEach((winner, index) => {
        const userProfileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${winner.uid}/profile/data`);
        const trophy = {
          type: trophyType,
          metal: metals[index],
          seasonName: seasonData.name,
          eventName: show.eventName,
          score: winner.totalScore,
          rank: index + 1
        };
        batch.update(userProfileRef, {
          'trophies.championships': admin.firestore.FieldValue.arrayUnion(trophy)
        });
      });

      show.results.forEach((finalist, index) => {
        const userProfileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${finalist.uid}/profile/data`);
        const medal = {
          type: isSoundSport ? 'soundsport_finalist' : 'finalist',
          seasonName: seasonData.name,
          eventName: show.eventName,
          rank: index + 1
        };
        batch.update(userProfileRef, {
          'trophies.finalistMedals': admin.firestore.FieldValue.arrayUnion(medal)
        });
      });

      show.results.forEach(result => {
        const corpsClass = result.corpsClass || 'worldClass';
        if (!allResultsByClass[corpsClass]) {
          allResultsByClass[corpsClass] = [];
        }
        allResultsByClass[corpsClass].push(result);
      });
    }

    // --- SAVE SEASON CHAMPIONS BY CLASS ---
    const seasonChampionsData = {
      seasonId: seasonData.seasonUid,
      seasonName: seasonData.name,
      seasonType: seasonData.status,
      archivedAt: new Date(),
      classes: {}
    };

    for (const [corpsClass, classResults] of Object.entries(allResultsByClass)) {
      classResults.sort((a, b) => b.totalScore - a.totalScore);
      const classTop3 = classResults.slice(0, 3);

      const championsWithUsernames = await Promise.all(classTop3.map(async (result, index) => {
        const userProfileDoc = await db.doc(`artifacts/${dataNamespaceParam.value()}/users/${result.uid}/profile/data`).get();
        const username = userProfileDoc.exists ? userProfileDoc.data().username : 'Unknown';
        return {
          rank: index + 1,
          uid: result.uid,
          username,
          corpsName: result.corpsName,
          score: result.totalScore
        };
      }));

      seasonChampionsData.classes[corpsClass] = championsWithUsernames;
    }

    const seasonChampionsRef = db.doc(`season_champions/${seasonData.seasonUid}`);
    batch.set(seasonChampionsRef, seasonChampionsData);
    logger.info(`Saved season champions for ${Object.keys(allResultsByClass).length} classes.`);
    // --- END SAVE SEASON CHAMPIONS BY CLASS ---
  }
  // --- END: TROPHY AWARDING LOGIC ---

  // OPTIMIZATION: Process all coin awards in batch instead of individual transactions
  // Aggregate by uid to minimize writes (multiple shows = single update per user)
  if (coinAwards.length > 0) {
    const coinByUser = new Map(); // uid -> { totalAmount, history: [] }

    for (const award of coinAwards) {
      const existing = coinByUser.get(award.uid) || { totalAmount: 0, history: [] };
      existing.totalAmount += award.amount;
      existing.history.push({
        type: TRANSACTION_TYPES.SHOW_PARTICIPATION,
        amount: award.amount,
        description: `Show performance at ${award.showName}`,
        corpsClass: award.corpsClass,
        timestamp: new Date(),
      });
      coinByUser.set(award.uid, existing);
    }

    // Add coin updates to batch (uses increment for concurrency safety)
    for (const [uid, data] of coinByUser) {
      const userProfileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);
      batch.update(userProfileRef, {
        corpsCoin: admin.firestore.FieldValue.increment(data.totalAmount),
        corpsCoinHistory: admin.firestore.FieldValue.arrayUnion(...data.history),
      });
    }
    logger.info(`Batched ${coinAwards.length} coin awards for ${coinByUser.size} users`);
  }

  // Save the recap document
  const recapDocRef = db.doc(`fantasy_recaps/${seasonData.seasonUid}`);
  const recapDoc = await recapDocRef.get();
  if (!recapDoc.exists) {
    batch.set(recapDocRef, {
      seasonName: seasonData.name,
      recaps: [dailyRecap],
    });
  } else {
    const existingRecaps = recapDoc.data().recaps || [];
    const updatedRecaps = existingRecaps.filter((r) => r.offSeasonDay !== scoredDay);
    updatedRecaps.push(dailyRecap);
    batch.update(recapDocRef, { recaps: updatedRecaps });
  }

  await batch.commit();
  logger.info(`Successfully processed and archived scores for live season day ${scoredDay}.`);

  // Weekly matchup determination (same as off-season)
  if (scoredDay % 7 === 0) {
    const week = scoredDay / 7;
    logger.info(`End of week ${week}. Determining class-based matchup winners...`);

    const leaguesSnapshot = await db.collection("leagues").get();
    const winnerBatch = db.batch();
    const corpsClasses = ["worldClass", "openClass", "aClass", "soundSport"];

    for (const leagueDoc of leaguesSnapshot.docs) {
      const matchupDocRef = db.doc(`leagues/${leagueDoc.id}/matchups/week${week}`);
      const matchupDoc = await matchupDocRef.get();

      if (matchupDoc.exists) {
        const matchupData = matchupDoc.data();
        let hasUpdates = false;

        for (const corpsClass of corpsClasses) {
          const matchupArrayKey = `${corpsClass}Matchups`;
          const matchups = matchupData[matchupArrayKey] || [];
          if (matchups.length === 0) continue;

          const updatedMatchupsForClass = [];

          // OPTIMIZATION: Batch fetch all matchup profiles for this class upfront
          const matchupsNeedingScores = matchups.filter(m => !m.winner);
          const allPlayerIds = [...new Set(matchupsNeedingScores.flatMap(m => m.pair))];

          // Batch fetch all profiles in ONE operation
          const profileRefs = allPlayerIds.map(uid =>
            db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`)
          );
          const profileDocs = allPlayerIds.length > 0 ? await db.getAll(...profileRefs) : [];
          const profileMap = new Map();
          profileDocs.forEach((doc, i) => {
            if (doc.exists) {
              profileMap.set(allPlayerIds[i], { ref: doc.ref, data: doc.data() });
            }
          });

          for (const matchup of matchups) {
            if (matchup.winner) {
              updatedMatchupsForClass.push(matchup);
              continue;
            }

            const [p1_uid, p2_uid] = matchup.pair;
            const p1_profile = profileMap.get(p1_uid);
            const p2_profile = profileMap.get(p2_uid);

            const p1_score = p1_profile?.data?.corps?.[corpsClass]?.totalSeasonScore || 0;
            const p2_score = p2_profile?.data?.corps?.[corpsClass]?.totalSeasonScore || 0;

            let winnerUid = null;
            if (p1_score > p2_score) winnerUid = p1_uid;
            if (p2_score > p1_score) winnerUid = p2_uid;

            const seasonRecordPath = `seasons.${seasonData.seasonUid}.records.${corpsClass}`;
            const increment = admin.firestore.FieldValue.increment(1);

            if (p1_profile?.ref && p2_profile?.ref) {
              if (winnerUid === p1_uid) {
                winnerBatch.set(p1_profile.ref, { [seasonRecordPath]: { w: increment } }, { merge: true });
                winnerBatch.set(p2_profile.ref, { [seasonRecordPath]: { l: increment } }, { merge: true });
              } else if (winnerUid === p2_uid) {
                winnerBatch.set(p1_profile.ref, { [seasonRecordPath]: { l: increment } }, { merge: true });
                winnerBatch.set(p2_profile.ref, { [seasonRecordPath]: { w: increment } }, { merge: true });
              } else {
                winnerBatch.set(p1_profile.ref, { [seasonRecordPath]: { t: increment } }, { merge: true });
                winnerBatch.set(p2_profile.ref, { [seasonRecordPath]: { t: increment } }, { merge: true });
              }
            }

            const newMatchup = {
              ...matchup,
              scores: { [p1_uid]: p1_score, [p2_uid]: p2_score },
              winner: winnerUid,
            };
            updatedMatchupsForClass.push(newMatchup);
          }
          matchupData[matchupArrayKey] = updatedMatchupsForClass;
          hasUpdates = true;
        }
        if (hasUpdates) {
          winnerBatch.update(matchupDocRef, matchupData);
        }
      }
    }
    await winnerBatch.commit();
    logger.info(`Matchup winner determination for week ${week} complete.`);
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
  const allCorpsStats = [];
  for (const corps of corpsInSeason) {
    const uniqueId = `${corps.corpsName}|${corps.sourceYear}`;
    const corpsEvents = (historicalData[corps.sourceYear] || []).filter((event) =>
      event.scores.some((s) => s.corps === corps.corpsName)
    );

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
};