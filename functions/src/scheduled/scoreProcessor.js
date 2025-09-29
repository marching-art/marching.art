/**
 * marching.art Score Processing System - PRODUCTION INTEGRATED VERSION
 * Combines proven scoring algorithms with new season scheduler
 * Runs daily at 2:00 AM ET (America/New_York)
 * Optimized for 10,000+ users with minimal cost
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { 
  DATA_NAMESPACE, 
  GAME_CONFIG,
  getFunctionConfig,
  calculateDCITotalScore 
} = require('../../config');

// === DCI SCORING CONSTANTS ===
const CAPTION_MAX_SCORES = {
  GE1: 20, GE2: 20,
  VP: 20, VA: 20, CG: 20,
  B: 20, MA: 20, P: 20
};

const CLASS_MULTIPLIERS = {
  'World Class': 1.0,
  'Open Class': 0.95,
  'A Class': 0.90,
  'SoundSport': 0.85
};

const CORPS_COIN_REWARDS = {
  'World Class': 100,
  'Open Class': 50,
  'A Class': 25,
  'SoundSport': 0
};

const TROPHY_METALS = ['gold', 'silver', 'bronze'];

// Regional trophy days (off-season: 28, 35, 41, 42 | live season: 49, 56, 62, 63)
const OFF_SEASON_REGIONAL_DAYS = [28, 35, 41, 42];
const LIVE_SEASON_REGIONAL_DAYS = [49, 56, 62, 63];

/**
 * MAIN FUNCTION: Daily score processing at 2:00 AM ET
 */
exports.processNightlyScores = functions
  .runWith(getFunctionConfig('standard'))
  .pubsub.schedule('0 2 * * *')
  .timeZone('America/New_York')
  .onRun(async (context) => {
    const logger = functions.logger;
    
    try {
      logger.info('Starting nightly score processing...');
      
      const db = admin.firestore();
      
      // Get current season info
      const seasonDoc = await db.doc('game-settings/current').get();
      
      if (!seasonDoc.exists) {
        logger.warn('No active season found, skipping score processing');
        return;
      }
      
      const seasonData = seasonDoc.data();
      const seasonType = seasonData.seasonType; // 'live' or 'off'
      const seasonId = seasonData.activeSeasonId;
      
      // Calculate scored day
      const seasonStartDate = seasonData.startDate.toDate();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const diffInMillis = yesterday.getTime() - seasonStartDate.getTime();
      const scoredDay = Math.floor(diffInMillis / (1000 * 60 * 60 * 24)) + 1;
      
      if (scoredDay < 1) {
        logger.info(`Scored day (${scoredDay}) is not within the season yet. Exiting.`);
        return;
      }
      
      logger.info(`Processing ${seasonType} season, Day ${scoredDay}`);
      
      // Process scores based on season type
      if (seasonType === 'live') {
        await processLiveSeasonDay(db, seasonData, seasonId, scoredDay);
      } else {
        await processOffSeasonDay(db, seasonData, seasonId, scoredDay);
      }
      
      // Update leaderboards
      await updateLeaderboards(db, seasonId);
      
      // Handle weekly matchups (every 7 days)
      if (scoredDay % 7 === 0) {
        await resolveWeeklyMatchups(db, seasonData, seasonId, scoredDay);
      }
      
      logger.info('Nightly score processing completed successfully');
      
    } catch (error) {
      logger.error('Error in nightly score processing:', error);
      throw error;
    }
  });

/**
 * Process OFF-SEASON day
 */
async function processOffSeasonDay(db, seasonData, seasonId, scoredDay) {
  const logger = functions.logger;
  logger.info(`Processing OFF-SEASON Day ${scoredDay}...`);
  
  // Get historical data
  const historicalData = await fetchHistoricalData(db, seasonId);
  
  // Get profiles registered for this season
  const profilesSnapshot = await db.collectionGroup('data')
    .where('activeSeasonId', '==', seasonId)
    .where('lineup', '!=', null)
    .get();
  
  if (profilesSnapshot.empty) {
    logger.info('No active profiles found.');
    return;
  }
  
  const week = Math.ceil(scoredDay / 7);
  
  // Get competitions for this day
  const scheduleRef = db.collection('schedules').doc(seasonId);
  const scheduleDoc = await scheduleRef.get();
  
  if (!scheduleDoc.exists) {
    logger.warn(`No schedule found for season ${seasonId}`);
    return;
  }
  
  const schedule = scheduleDoc.data();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const targetDateStr = yesterday.toISOString().split('T')[0];
  
  const competitionsForDay = schedule.competitions.filter(comp => {
    const compDate = comp.date.toDate().toISOString().split('T')[0];
    return compDate === targetDateStr && comp.status === 'scheduled';
  });
  
  if (competitionsForDay.length === 0) {
    logger.info(`No competitions scheduled for day ${scoredDay}`);
    return;
  }
  
  logger.info(`Processing ${competitionsForDay.length} competitions`);
  
  // Championship progression filter
  let championshipParticipants = null;
  if ([48, 49].includes(scoredDay)) {
    championshipParticipants = await getChampionshipParticipants(db, seasonId, scoredDay);
  }
  
  const dailyRecap = {
    offSeasonDay: scoredDay,
    date: admin.firestore.Timestamp.now(),
    shows: []
  };
  
  const batch = db.batch();
  const dailyScores = new Map();
  
  // Process each competition
  for (const competition of competitionsForDay) {
    const showResult = {
      eventName: competition.name,
      location: competition.location,
      results: []
    };
    
    // Eastern Classic split (days 41-42)
    let easternClassicParticipants = null;
    if ([41, 42].includes(scoredDay) && competition.name.includes('Eastern Classic')) {
      easternClassicParticipants = await getEasternClassicParticipants(
        db, 
        profilesSnapshot, 
        competition, 
        week, 
        scoredDay
      );
    }
    
    // Score each registered corps
    for (const userDoc of profilesSnapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.ref.parent.parent.id;
      
      // Apply championship filter
      if (championshipParticipants && !championshipParticipants.includes(userId)) {
        continue;
      }
      
      // Apply Eastern Classic filter
      if (easternClassicParticipants && !easternClassicParticipants.includes(userId)) {
        continue;
      }
      
      // Check if user registered for this competition
      const registrations = userData.competitionRegistrations || {};
      
      // Auto-enroll for championships (day 47+)
      const isRegistered = scoredDay >= 47 || registrations[competition.id];
      
      if (!isRegistered) continue;
      
      // Check class eligibility
      const corpsClass = userData.corps?.corpsClass || 'SoundSport';
      if (!competition.allowedClasses.includes(corpsClass)) {
        continue;
      }
      
      // Generate score
      const corpsScore = await generateOffSeasonScore(
        db,
        userData,
        userId,
        competition,
        seasonId,
        scoredDay,
        historicalData
      );
      
      if (corpsScore) {
        showResult.results.push(corpsScore);
        
        // Track daily total
        const dailyKey = `${userId}_${corpsClass}`;
        const currentTotal = dailyScores.get(dailyKey) || 0;
        dailyScores.set(dailyKey, currentTotal + corpsScore.totalScore);
      }
    }
    
    dailyRecap.shows.push(showResult);
  }
  
  // Update user profiles with daily scores
  for (const [uidAndClass, totalDailyScore] of dailyScores.entries()) {
    if (totalDailyScore > 0) {
      const [uid, corpsClass] = uidAndClass.split('_');
      const userRef = db.doc(`artifacts/${DATA_NAMESPACE}/users/${uid}/profile/data`);
      
      batch.update(userRef, {
        totalSeasonScore: admin.firestore.FieldValue.increment(totalDailyScore),
        corpsCoin: admin.firestore.FieldValue.increment(CORPS_COIN_REWARDS[corpsClass] || 0),
        lastCompetitionScore: totalDailyScore,
        lastScoredDay: scoredDay
      });
    }
  }
  
  // Award trophies for regional days
  if (OFF_SEASON_REGIONAL_DAYS.includes(scoredDay)) {
    awardRegionalTrophies(batch, dailyRecap, seasonData, db);
  }
  
  // Award championship trophies and medals (day 49)
  if (scoredDay === 49) {
    awardChampionshipHonors(batch, dailyRecap, seasonData, db);
  }
  
  // Save recap
  await saveRecap(db, batch, seasonId, seasonData, dailyRecap, scoredDay);
  
  // Mark competitions as completed
  await markCompetitionsCompleted(db, batch, seasonId, competitionsForDay);
  
  // Commit all updates
  await batch.commit();
  
  logger.info(`Successfully processed day ${scoredDay}`);
}

/**
 * Process LIVE SEASON day
 */
async function processLiveSeasonDay(db, seasonData, seasonId, scoredDay) {
  const logger = functions.logger;
  logger.info(`Processing LIVE SEASON Day ${scoredDay}...`);
  
  const historicalData = await fetchHistoricalData(db, seasonId);
  
  const profilesSnapshot = await db.collectionGroup('data')
    .where('activeSeasonId', '==', seasonId)
    .where('lineup', '!=', null)
    .get();
  
  if (profilesSnapshot.empty) {
    logger.info('No active profiles found.');
    return;
  }
  
  const week = Math.ceil(scoredDay / 7);
  
  // Championship progression (days 68-70 in live season)
  let championshipParticipants = null;
  if ([69, 70].includes(scoredDay)) {
    championshipParticipants = await getChampionshipParticipants(db, seasonId, scoredDay, true);
  }
  
  // Get today's real scores from live_scores collection
  const liveScoresSnapshot = await db.collection(`live_scores/${seasonId}/scores`)
    .where('day', '==', scoredDay)
    .get();
  
  const realScoresMap = new Map();
  liveScoresSnapshot.forEach(doc => {
    const data = doc.data();
    realScoresMap.set(data.corpsName, data.captions);
  });
  
  logger.info(`Found ${realScoresMap.size} real scores for day ${scoredDay}`);
  
  const dailyRecap = {
    offSeasonDay: scoredDay,
    date: admin.firestore.Timestamp.now(),
    shows: []
  };
  
  // Create show containers
  const recapShows = new Map();
  const predictedShowKey = `Predicted Scores - Day ${scoredDay}`;
  recapShows.set(predictedShowKey, {
    eventName: predictedShowKey,
    location: 'Cloud Arena',
    results: []
  });
  
  const batch = db.batch();
  
  // Process each user
  for (const userDoc of profilesSnapshot.docs) {
    const userData = userDoc.data();
    const userId = userDoc.ref.parent.parent.id;
    
    // Championship filter
    if (championshipParticipants && !championshipParticipants.includes(userId)) {
      continue;
    }
    
    // Generate score using live data or prediction
    const corpsScore = await generateLiveSeasonScore(
      db,
      userData,
      userId,
      seasonId,
      scoredDay,
      historicalData,
      realScoresMap
    );
    
    if (corpsScore) {
      const showKey = realScoresMap.size > 0 ? 
        `DCI World Championships Day ${scoredDay}` : 
        predictedShowKey;
      
      if (!recapShows.has(showKey)) {
        recapShows.set(showKey, {
          eventName: showKey,
          location: 'Indianapolis, IN',
          results: []
        });
      }
      
      recapShows.get(showKey).results.push(corpsScore);
      
      // Update user score
      const userRef = db.doc(`artifacts/${DATA_NAMESPACE}/users/${userId}/profile/data`);
      batch.update(userRef, {
        totalSeasonScore: corpsScore.totalScore,
        corpsCoin: admin.firestore.FieldValue.increment(CORPS_COIN_REWARDS[corpsScore.corpsClass] || 0),
        lastCompetitionScore: corpsScore.totalScore,
        lastScoredDay: scoredDay
      });
    }
  }
  
  dailyRecap.shows = Array.from(recapShows.values()).filter(s => s.results.length > 0);
  
  // Award trophies for live season regionals
  if (LIVE_SEASON_REGIONAL_DAYS.includes(scoredDay)) {
    awardRegionalTrophies(batch, dailyRecap, seasonData, db);
  }
  
  // Award championship honors (day 70)
  if (scoredDay === 70) {
    awardChampionshipHonors(batch, dailyRecap, seasonData, db);
  }
  
  // Save recap
  await saveRecap(db, batch, seasonId, seasonData, dailyRecap, scoredDay);
  
  await batch.commit();
  
  logger.info(`Successfully processed live season day ${scoredDay}`);
}

/**
 * Generate score for OFF-SEASON competition
 */
async function generateOffSeasonScore(db, userData, userId, competition, seasonId, scoredDay, historicalData) {
  const lineup = userData.lineup;
  const staff = userData.staff || [];
  const corpsClass = userData.corps?.corpsClass || 'SoundSport';
  const corpsName = userData.corps?.corpsName || 'Unknown Corps';
  
  // Get season corps data
  const seasonCorpsRef = db.collection('dci-data').doc(seasonId);
  const seasonCorpsDoc = await seasonCorpsRef.get();
  
  if (!seasonCorpsDoc.exists) {
    return null;
  }
  
  const seasonCorps = seasonCorpsDoc.data().corps;
  
  let geScore = 0, rawVisualScore = 0, rawMusicScore = 0;
  const captionScores = {};
  
  // Calculate each caption
  for (const caption in lineup) {
    const selectedCorpsName = lineup[caption];
    if (!selectedCorpsName) continue;
    
    // Find corps info
    const corpsInfo = seasonCorps.find(c => c.name === selectedCorpsName);
    const corpsValue = corpsInfo ? corpsInfo.value : 15;
    const sourceYear = corpsInfo ? corpsInfo.sourceYear : new Date().getFullYear();
    
    // Get realistic caption score using logarithmic regression
    let captionScore = getRealisticCaptionScore(
      selectedCorpsName,
      sourceYear,
      caption,
      scoredDay,
      historicalData
    );
    
    // Apply staff bonus
    const staffBonus = calculateStaffBonus(staff, caption);
    captionScore += staffBonus;
    
    // Apply variance
    const jitter = (Math.random() - 0.5) * 0.5;
    captionScore += jitter;
    
    // Competition modifiers
    if (competition.isRegional) captionScore *= 0.98;
    if (competition.isChampionship) captionScore *= 1.02;
    
    // Cap at max
    captionScore = Math.max(0, Math.min(CAPTION_MAX_SCORES[caption], captionScore));
    captionScore = parseFloat(captionScore.toFixed(3));
    
    captionScores[caption] = captionScore;
    
    // Accumulate totals
    if (['GE1', 'GE2'].includes(caption)) geScore += captionScore;
    else if (['VP', 'VA', 'CG'].includes(caption)) rawVisualScore += captionScore;
    else if (['B', 'MA', 'P'].includes(caption)) rawMusicScore += captionScore;
  }
  
  const visualScore = rawVisualScore / 2;
  const musicScore = rawMusicScore / 2;
  const totalScore = geScore + visualScore + musicScore;
  
  // Apply class multiplier
  const finalScore = totalScore * (CLASS_MULTIPLIERS[corpsClass] || 1.0);
  
  return {
    uid: userId,
    corpsClass: corpsClass,
    corpsName: corpsName,
    totalScore: parseFloat(finalScore.toFixed(3)),
    geScore: parseFloat(geScore.toFixed(3)),
    visualScore: parseFloat(visualScore.toFixed(3)),
    musicScore: parseFloat(musicScore.toFixed(3)),
    captionScores: captionScores
  };
}

/**
 * Generate score for LIVE SEASON (uses real scores + prediction)
 */
async function generateLiveSeasonScore(db, userData, userId, seasonId, scoredDay, historicalData, realScoresMap) {
  const lineup = userData.lineup;
  const staff = userData.staff || [];
  const corpsClass = userData.corps?.corpsClass || 'SoundSport';
  const corpsName = userData.corps?.corpsName || 'Unknown Corps';
  
  const seasonCorpsRef = db.collection('dci-data').doc(seasonId);
  const seasonCorpsDoc = await seasonCorpsRef.get();
  
  if (!seasonCorpsDoc.exists) {
    return null;
  }
  
  const seasonCorps = seasonCorpsDoc.data().corps;
  
  let geScore = 0, rawVisualScore = 0, rawMusicScore = 0;
  const captionScores = {};
  
  for (const caption in lineup) {
    const selectedCorpsName = lineup[caption];
    if (!selectedCorpsName) continue;
    
    const corpsInfo = seasonCorps.find(c => c.name === selectedCorpsName);
    const sourceYear = corpsInfo ? corpsInfo.sourceYear : new Date().getFullYear();
    
    let captionScore = 0;
    
    // Use real score if available
    if (realScoresMap.has(selectedCorpsName) && realScoresMap.get(selectedCorpsName)[caption] > 0) {
      captionScore = realScoresMap.get(selectedCorpsName)[caption];
    } else {
      // Predict using logarithmic regression on season data
      captionScore = await getLiveCaptionScore(
        db,
        selectedCorpsName,
        sourceYear,
        caption,
        scoredDay,
        seasonId,
        historicalData
      );
    }
    
    // Apply staff bonus
    const staffBonus = calculateStaffBonus(staff, caption);
    captionScore += staffBonus;
    
    captionScore = Math.max(0, Math.min(CAPTION_MAX_SCORES[caption], captionScore));
    captionScore = parseFloat(captionScore.toFixed(3));
    
    captionScores[caption] = captionScore;
    
    if (['GE1', 'GE2'].includes(caption)) geScore += captionScore;
    else if (['VP', 'VA', 'CG'].includes(caption)) rawVisualScore += captionScore;
    else if (['B', 'MA', 'P'].includes(caption)) rawMusicScore += captionScore;
  }
  
  const visualScore = rawVisualScore / 2;
  const musicScore = rawMusicScore / 2;
  const totalScore = geScore + visualScore + musicScore;
  
  const finalScore = totalScore * (CLASS_MULTIPLIERS[corpsClass] || 1.0);
  
  return {
    uid: userId,
    corpsClass: corpsClass,
    corpsName: corpsName,
    totalScore: parseFloat(finalScore.toFixed(3)),
    geScore: parseFloat(geScore.toFixed(3)),
    visualScore: parseFloat(visualScore.toFixed(3)),
    musicScore: parseFloat(musicScore.toFixed(3)),
    captionScores: captionScores
  };
}

/**
 * Get realistic caption score using LOGARITHMIC REGRESSION
 * This is the proven algorithm from the existing system
 */
function getRealisticCaptionScore(corpsName, sourceYear, caption, currentDay, historicalData) {
  // Try to get actual score for this day
  const actualScore = getScoreForDay(currentDay, corpsName, sourceYear, caption, historicalData);
  if (actualScore !== null) {
    return actualScore; // Always use real score if available
  }
  
  // Collect all available data points for this corps/caption
  const allDataPoints = [];
  const yearData = historicalData[sourceYear] || [];
  
  for (const event of yearData) {
    const score = getScoreForDay(event.offSeasonDay, corpsName, sourceYear, caption, historicalData);
    if (score !== null) {
      // Avoid duplicates
      if (!allDataPoints.some(p => p[0] === event.offSeasonDay)) {
        allDataPoints.push([event.offSeasonDay, score]);
      }
    }
  }
  
  const maxScore = 20;
  
  // Use logarithmic regression if we have enough data points
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
    // No historical data - return 0 (will use fallback in calling function)
    return 0;
  }
}

/**
 * Get live caption score using current season progression
 */
async function getLiveCaptionScore(db, corpsName, sourceYear, caption, currentDay, seasonId, historicalData) {
  // Get all scores for this corps in the current season
  const liveScoresRef = db.collection(`live_scores/${seasonId}/scores`)
    .where('corpsName', '==', corpsName);
  const liveScoresSnap = await liveScoresRef.get();
  
  const currentSeasonScores = [];
  liveScoresSnap.forEach(doc => {
    const data = doc.data();
    if (data.captions && data.captions[caption]) {
      currentSeasonScores.push([data.day, data.captions[caption]]);
    }
  });
  
  // If we have 3+ data points, use logarithmic regression on current season
  if (currentSeasonScores.length >= 3) {
    const regression = logarithmicRegression(currentSeasonScores);
    const predictedScore = regression.predict(currentDay);
    const jitter = (Math.random() - 0.5) * 0.5;
    const finalScore = predictedScore + jitter;
    return Math.max(0, Math.min(20, parseFloat(finalScore.toFixed(3))));
  } else {
    // Fall back to historical data
    const equivalentOffSeasonDay = mapLiveDayToOffSeasonDay(currentDay);
    return getRealisticCaptionScore(corpsName, sourceYear, caption, equivalentOffSeasonDay, historicalData);
  }
}

/**
 * LOGARITHMIC REGRESSION - The secret sauce
 * Creates realistic DCI-style score curves
 */
function logarithmicRegression(data) {
  // Transform data: y = e^(mx + c)
  const transformedData = data.map(([x, y]) => [x, y > 0 ? Math.log(y) : 0]);
  
  const { m, c } = simpleLinearRegression(transformedData);
  
  return {
    predict: (x) => {
      const logPrediction = m * x + c;
      return Math.exp(logPrediction); // Reverse the log transformation
    }
  };
}

/**
 * Simple linear regression helper
 */
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

/**
 * Get score for a specific day from historical data
 */
function getScoreForDay(day, corps, year, caption, historicalData) {
  const events = historicalData[year]?.filter(e => e.offSeasonDay === day);
  if (!events || events.length === 0) return null;
  
  for (const event of events) {
    const scoreData = event.scores.find(s => s.corps === corps);
    if (scoreData && scoreData.captions[caption] > 0) {
      return scoreData.captions[caption];
    }
  }
  return null;
}

/**
 * Map live season day to equivalent off-season day
 */
function mapLiveDayToOffSeasonDay(liveDay) {
  const liveSeasonStartDay = 22;
  const dayOffset = 21;
  
  if (liveDay < liveSeasonStartDay) {
    return 1;
  } else {
    return liveDay - dayOffset;
  }
}

/**
 * Calculate staff bonus
 */
function calculateStaffBonus(staffMembers, caption) {
  if (!staffMembers || staffMembers.length === 0) return 0;
  
  const staffForCaption = staffMembers.find(staff => 
    staff.caption === caption && staff.isAssigned
  );
  
  if (!staffForCaption) return 0;
  
  const currentYear = new Date().getFullYear();
  const yearsInHOF = currentYear - staffForCaption.inductionYear;
  const experienceBonus = 0.05 + (yearsInHOF * 0.02);
  
  return Math.min(0.3, experienceBonus);
}

/**
 * Fetch historical score data
 */
async function fetchHistoricalData(db, seasonId) {
  const corpsDataRef = db.collection('dci-data').doc(seasonId);
  const corpsDataSnap = await corpsDataRef.get();
  
  if (!corpsDataSnap.exists) {
    functions.logger.error(`dci-data document ${seasonId} not found.`);
    return {};
  }
  
  const seasonCorpsList = corpsDataSnap.data().corps || [];
  const yearsToFetch = [...new Set(seasonCorpsList.map(c => c.sourceYear))];
  
  const historicalDocs = await Promise.all(
    yearsToFetch.map(year => db.doc(`historical_scores/${year}`).get())
  );
  
  const historicalData = {};
  historicalDocs.forEach(doc => {
    if (doc.exists) {
      historicalData[doc.id] = doc.data().data;
    }
  });
  
  return historicalData;
}

/**
 * Get championship participants (top 25 for semis, top 12 for finals)
 */
async function getChampionshipParticipants(db, seasonId, scoredDay, isLiveSeason = false) {
  const recapDoc = await db.doc(`fantasy_recaps/${seasonId}`).get();
  if (!recapDoc.exists) return null;
  
  const allRecaps = recapDoc.data().recaps || [];
  
  // Live season: days 69-70 (semis/finals)
  // Off season: days 48-49 (semis/finals)
  const prelimsDay = isLiveSeason ? 68 : 47;
  const semisDay = isLiveSeason ? 69 : 48;
  
  if (scoredDay === semisDay + 1) {
    // Finals - get top 12 from semifinals
    const semisRecap = allRecaps.find(r => r.offSeasonDay === semisDay);
    if (semisRecap) {
      const allResults = semisRecap.shows.flatMap(s => s.results);
      allResults.sort((a, b) => b.totalScore - a.totalScore);
      
      if (allResults.length >= 12) {
        const twelfthPlaceScore = allResults[11].totalScore;
        // Include ties
        return allResults.filter(r => r.totalScore >= twelfthPlaceScore).map(r => r.uid);
      } else {
        return allResults.map(r => r.uid);
      }
    }
  } else if (scoredDay === semisDay) {
    // Semifinals - get top 25 from prelims
    const prelimsRecap = allRecaps.find(r => r.offSeasonDay === prelimsDay);
    if (prelimsRecap) {
      const allResults = prelimsRecap.shows.flatMap(s => s.results);
      allResults.sort((a, b) => b.totalScore - a.totalScore);
      return allResults.slice(0, 25).map(r => r.uid);
    }
  }
  
  return null;
}

/**
 * Get Eastern Classic participants (50/50 split across days 41-42)
 */
async function getEasternClassicParticipants(db, profilesSnapshot, competition, week, scoredDay) {
  const allEnrollees = [];
  
  for (const userDoc of profilesSnapshot.docs) {
    const userProfile = userDoc.data();
    const registrations = userProfile.competitionRegistrations || {};
    
    if (registrations[competition.id]) {
      allEnrollees.push(userDoc.ref.parent.parent.id);
    }
  }
  
  // Deterministic sort
  allEnrollees.sort();
  
  const splitIndex = Math.ceil(allEnrollees.length / 2);
  
  if (scoredDay === 41) {
    return allEnrollees.slice(0, splitIndex); // First half
  } else {
    return allEnrollees.slice(splitIndex); // Second half
  }
}

/**
 * Award regional trophies (top 3)
 */
function awardRegionalTrophies(batch, dailyRecap, seasonData, db) {
  dailyRecap.shows.forEach(show => {
    if (show.eventName.includes('Predicted')) return;
    
    show.results.sort((a, b) => b.totalScore - a.totalScore);
    const top3 = show.results.slice(0, 3);
    
    top3.forEach((winner, index) => {
      const userRef = db.doc(`artifacts/${DATA_NAMESPACE}/users/${winner.uid}/profile/data`);
      const trophy = {
        type: 'regional',
        metal: TROPHY_METALS[index],
        seasonName: seasonData.seasonNumber || seasonData.seasonId,
        eventName: show.eventName,
        score: winner.totalScore,
        rank: index + 1,
        awardedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      batch.update(userRef, {
        'trophies.regionals': admin.firestore.FieldValue.arrayUnion(trophy)
      });
    });
  });
}

/**
 * Award championship trophies (top 3) and finalist medals (all participants)
 */
function awardChampionshipHonors(batch, dailyRecap, seasonData, db) {
  const finalsShow = dailyRecap.shows[0];
  if (!finalsShow || finalsShow.eventName.includes('Predicted')) return;
  
  finalsShow.results.sort((a, b) => b.totalScore - a.totalScore);
  
  // Top 3 get trophies
  const top3 = finalsShow.results.slice(0, 3);
  top3.forEach((winner, index) => {
    const userRef = db.doc(`artifacts/${DATA_NAMESPACE}/users/${winner.uid}/profile/data`);
    const trophy = {
      type: 'championship',
      metal: TROPHY_METALS[index],
      seasonName: seasonData.seasonNumber || seasonData.seasonId,
      eventName: finalsShow.eventName,
      score: winner.totalScore,
      rank: index + 1,
      awardedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    batch.update(userRef, {
      'trophies.championships': admin.firestore.FieldValue.arrayUnion(trophy)
    });
  });
  
  // All finalists get medals
  finalsShow.results.forEach((finalist, index) => {
    const userRef = db.doc(`artifacts/${DATA_NAMESPACE}/users/${finalist.uid}/profile/data`);
    const medal = {
      type: 'finalist',
      seasonName: seasonData.seasonNumber || seasonData.seasonId,
      rank: index + 1,
      awardedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    batch.update(userRef, {
      'trophies.finalistMedals': admin.firestore.FieldValue.arrayUnion(medal)
    });
  });
}

/**
 * Save daily recap to database
 */
async function saveRecap(db, batch, seasonId, seasonData, dailyRecap, scoredDay) {
  const recapDocRef = db.doc(`fantasy_recaps/${seasonId}`);
  const recapDoc = await recapDocRef.get();
  
  if (!recapDoc.exists) {
    batch.set(recapDocRef, {
      seasonName: seasonData.seasonNumber || seasonId,
      recaps: [dailyRecap]
    });
  } else {
    const existingRecaps = recapDoc.data().recaps || [];
    const updatedRecaps = existingRecaps.filter(r => r.offSeasonDay !== scoredDay);
    updatedRecaps.push(dailyRecap);
    batch.update(recapDocRef, { recaps: updatedRecaps });
  }
}

/**
 * Mark competitions as completed
 */
async function markCompetitionsCompleted(db, batch, seasonId, competitions) {
  const scheduleRef = db.collection('schedules').doc(seasonId);
  const scheduleDoc = await scheduleRef.get();
  
  if (scheduleDoc.exists) {
    const schedule = scheduleDoc.data();
    const updatedCompetitions = schedule.competitions.map(comp => {
      if (competitions.some(c => c.id === comp.id)) {
        return { ...comp, status: 'completed' };
      }
      return comp;
    });
    
    batch.update(scheduleRef, { competitions: updatedCompetitions });
  }
}

/**
 * Resolve weekly matchups
 */
async function resolveWeeklyMatchups(db, seasonData, seasonId, scoredDay) {
  const logger = functions.logger;
  const week = scoredDay / 7;
  
  logger.info(`Resolving matchups for week ${week}...`);
  
  const leaguesSnapshot = await db.collection('leagues').get();
  const winnerBatch = db.batch();
  const corpsClasses = ['worldClass', 'openClass', 'aClass'];
  
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
        
        const updatedMatchups = [];
        
        for (const matchup of matchups) {
          if (matchup.winner) {
            updatedMatchups.push(matchup);
            continue;
          }
          
          const [p1_uid, p2_uid] = matchup.pair;
          
          const p1_doc = await db.doc(`artifacts/${DATA_NAMESPACE}/users/${p1_uid}/profile/data`).get();
          const p2_doc = await db.doc(`artifacts/${DATA_NAMESPACE}/users/${p2_uid}/profile/data`).get();
          
          const p1_score = p1_doc.data()?.totalSeasonScore || 0;
          const p2_score = p2_doc.data()?.totalSeasonScore || 0;
          
          let winnerUid = null;
          if (p1_score > p2_score) winnerUid = p1_uid;
          if (p2_score > p1_score) winnerUid = p2_uid;
          
          const seasonRecordPath = `seasons.${seasonId}.records.${corpsClass}`;
          const increment = admin.firestore.FieldValue.increment(1);
          
          if (winnerUid === p1_uid) {
            winnerBatch.set(p1_doc.ref, { [seasonRecordPath]: { w: increment } }, { merge: true });
            winnerBatch.set(p2_doc.ref, { [seasonRecordPath]: { l: increment } }, { merge: true });
          } else if (winnerUid === p2_uid) {
            winnerBatch.set(p1_doc.ref, { [seasonRecordPath]: { l: increment } }, { merge: true });
            winnerBatch.set(p2_doc.ref, { [seasonRecordPath]: { w: increment } }, { merge: true });
          } else {
            winnerBatch.set(p1_doc.ref, { [seasonRecordPath]: { t: increment } }, { merge: true });
            winnerBatch.set(p2_doc.ref, { [seasonRecordPath]: { t: increment } }, { merge: true });
          }
          
          updatedMatchups.push({
            ...matchup,
            scores: { [p1_uid]: p1_score, [p2_uid]: p2_score },
            winner: winnerUid
          });
        }
        
        matchupData[matchupArrayKey] = updatedMatchups;
        hasUpdates = true;
      }
      
      if (hasUpdates) {
        winnerBatch.update(matchupDocRef, matchupData);
      }
    }
  }
  
  await winnerBatch.commit();
  logger.info(`Matchup resolution for week ${week} complete.`);
}

/**
 * Update global leaderboards
 */
async function updateLeaderboards(db, seasonId) {
  const logger = functions.logger;
  
  try {
    const usersSnapshot = await db.collectionGroup('data')
      .where('activeSeasonId', '==', seasonId)
      .where('totalSeasonScore', '>', 0)
      .orderBy('totalSeasonScore', 'desc')
      .limit(1000)
      .get();
    
    const leaderboardData = [];
    
    usersSnapshot.forEach((userDoc, index) => {
      const userData = userDoc.data();
      const userId = userDoc.ref.parent.parent.id;
      
      leaderboardData.push({
        userId: userId,
        displayName: userData.displayName || userData.email?.split('@')[0] || 'Anonymous',
        corpsName: userData.corps?.corpsName || 'Unknown Corps',
        corpsClass: userData.corps?.corpsClass || 'SoundSport',
        totalScore: userData.totalSeasonScore || 0,
        rank: index + 1
      });
    });
    
    await db.collection('leaderboards').doc(seasonId).set({
      seasonId: seasonId,
      rankings: leaderboardData,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    const batch = db.batch();
    let batchCount = 0;
    
    for (const entry of leaderboardData) {
      const userRef = db.doc(`artifacts/${DATA_NAMESPACE}/users/${entry.userId}/profile/data`);
      batch.update(userRef, { seasonRank: entry.rank });
      batchCount++;
      
      if (batchCount % 500 === 0) {
        await batch.commit();
      }
    }
    
    if (batchCount % 500 !== 0) {
      await batch.commit();
    }
    
    logger.info(`Updated leaderboard with ${leaderboardData.length} entries`);
    
  } catch (error) {
    logger.error('Error updating leaderboards:', error);
  }
}

/**
 * ADMIN FUNCTION: Manual score processing
 */
exports.processScoresManually = functions
  .runWith(getFunctionConfig('standard'))
  .https.onCall(async (data, context) => {
    if (!context.auth || context.auth.uid !== 'o8vfRCOevjTKBY0k2dISlpiYiIH2') {
      throw new functions.https.HttpsError('permission-denied', 'Admin access required');
    }
    
    try {
      const db = admin.firestore();
      const targetDate = data.date ? new Date(data.date) : new Date();
      
      const seasonDoc = await db.doc('game-settings/current').get();
      if (!seasonDoc.exists) {
        throw new Error('No active season found');
      }
      
      const seasonData = seasonDoc.data();
      const seasonId = seasonData.activeSeasonId;
      
      // Calculate day
      const seasonStartDate = seasonData.startDate.toDate();
      const diffInMillis = targetDate.getTime() - seasonStartDate.getTime();
      const scoredDay = Math.floor(diffInMillis / (1000 * 60 * 60 * 24)) + 1;
      
      if (seasonData.seasonType === 'live') {
        await processLiveSeasonDay(db, seasonData, seasonId, scoredDay);
      } else {
        await processOffSeasonDay(db, seasonData, seasonId, scoredDay);
      }
      
      await updateLeaderboards(db, seasonId);
      
      return {
        success: true,
        message: 'Scores processed successfully',
        date: targetDate.toISOString(),
        day: scoredDay
      };
      
    } catch (error) {
      functions.logger.error('Error processing scores manually:', error);
      throw new functions.https.HttpsError('internal', `Failed to process scores: ${error.message}`);
    }
  });

// Export functions
module.exports = {
  processNightlyScores: exports.processNightlyScores,
  processScoresManually: exports.processScoresManually
};