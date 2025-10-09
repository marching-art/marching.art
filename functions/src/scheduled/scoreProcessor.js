/**
 * marching.art Score Processing System - COMPLETE INTEGRATED VERSION
 * Combines proven scoring algorithms with seasonal score grid optimization
 * Runs daily at 2:00 AM ET (America/New_York)
 * Optimized for 10,000+ users with minimal cost
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

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

// Data namespace for user profiles
const DATA_NAMESPACE = 'marching-art';

/**
 * MAIN FUNCTION: Daily score processing at 2:00 AM ET
 */
exports.processNightlyScores = functions
  .runWith({ timeoutSeconds: 540, memory: '1GB', maxInstances: 10 })
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
      const seasonId = seasonData.activeSeasonId || seasonData.currentSeasonId;
      
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
 * NEW: Get score from seasonal grid (pre-computed scores)
 */
async function getScoreFromSeasonalGrid(db, seasonId, corpsName, day) {
  try {
    // Get from seasonal_scores collection
    const seasonalScoreDoc = await db.doc(`seasonal_scores/${seasonId}`).get();
    
    if (seasonalScoreDoc.exists) {
      const grid = seasonalScoreDoc.data().grid || {};
      const corpsScores = grid[corpsName];
      
      if (corpsScores && corpsScores[day]) {
        return corpsScores[day];
      }
    }
    
    return null;
  } catch (error) {
    functions.logger.error(`Error fetching score from seasonal grid: ${error}`);
    return null;
  }
}

/**
 * UPDATED: Fetch historical score data with seasonal grid support
 */
async function fetchHistoricalData(db, seasonId) {
  const scoreGridDoc = await db.doc(`seasonal_scores/${seasonId}`).get();
  
  if (scoreGridDoc.exists && scoreGridDoc.data().grid) {
    functions.logger.info('Using pre-computed seasonal score grid');
    return { useGrid: true, grid: scoreGridDoc.data().grid };
  }
  
  // Fallback to historical data
  const corpsDataSnap = await db.doc(`dci-data/${seasonId}`).get();
  if (!corpsDataSnap.exists) {
    return { useGrid: false, historicalData: {} };
  }
  
  const seasonCorpsList = corpsDataSnap.data().corps || corpsDataSnap.data().corpsValues || [];
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
  
  return { useGrid: false, historicalData: historicalData };
}

/**
 * Process OFF-SEASON day
 */
async function processOffSeasonDay(db, seasonData, seasonId, scoredDay) {
  const logger = functions.logger;
  logger.info(`Processing OFF-SEASON Day ${scoredDay}...`);
  
  // Get data source (seasonal grid or historical data)
  const dataSource = await fetchHistoricalData(db, seasonId);
  
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
  
  // Get competitions for today
  const scheduleDoc = await db.doc(`schedules/${seasonId}`).get();
  if (!scheduleDoc.exists) {
    logger.warn('Schedule not found for season');
    return;
  }
  
  const competitions = scheduleDoc.data().competitions.filter(c => c.day === scoredDay);
  if (competitions.length === 0) {
    logger.info(`No competitions scheduled for day ${scoredDay}`);
    return;
  }
  
  logger.info(`Found ${competitions.length} competitions for day ${scoredDay}`);
  
  // Championship filter setup (days 48-49 in off-season)
  let championshipParticipants = null;
  if ([48, 49].includes(scoredDay)) {
    championshipParticipants = await getChampionshipParticipants(db, seasonId, scoredDay, false);
  }
  
  const batch = db.batch();
  const dailyRecap = {
    offSeasonDay: scoredDay,
    date: admin.firestore.Timestamp.now(),
    shows: []
  };
  
  const dailyScores = new Map(); // Track daily totals per user
  
  // Process each competition
  for (const competition of competitions) {
    const showResult = {
      eventName: competition.name,
      location: competition.location,
      results: []
    };
    
    // Eastern Classic special handling (days 41-42)
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
      
      // Generate score with data source
      const corpsScore = await generateOffSeasonScore(
        db,
        userData,
        userId,
        competition,
        seasonId,
        scoredDay,
        dataSource  // Pass data source instead of historicalData
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
  await markCompetitionsCompleted(db, batch, seasonId, competitions);
  
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
  
  const dataSource = await fetchHistoricalData(db, seasonId);
  
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
      dataSource,
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
 * UPDATED: Generate score for OFF-SEASON competition - PASS CORPS VALUE
 */
async function generateOffSeasonScore(db, userData, userId, competition, seasonId, scoredDay, dataSource) {
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
  
  const seasonCorps = seasonCorpsDoc.data().corps || seasonCorpsDoc.data().corpsValues || [];
  
  let geScore = 0, rawVisualScore = 0, rawMusicScore = 0;
  const captionScores = {};
  
  // Calculate each caption
  for (const caption in lineup) {
    const selectedCorpsName = lineup[caption];
    if (!selectedCorpsName) continue;
    
    // Find corps info
    const corpsInfo = seasonCorps.find(c => c.name === selectedCorpsName || c.corpsName === selectedCorpsName);
    
    if (!corpsInfo) continue;
    
    const corpsValue = corpsInfo.value || 15;
    const sourceYear = corpsInfo.sourceYear || new Date().getFullYear().toString();
    
    // CRITICAL: Pass corpsValue to getRealisticCaptionScore
    let captionScore = getRealisticCaptionScore(
      selectedCorpsName,
      sourceYear,
      corpsValue,  // PASS THE VALUE!
      caption,
      scoredDay,
      dataSource
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
 * UPDATED: Generate score for LIVE SEASON - PASS CORPS VALUE
 */
async function generateLiveSeasonScore(db, userData, userId, seasonId, scoredDay, dataSource, realScoresMap) {
  const lineup = userData.lineup;
  const staff = userData.staff || [];
  const corpsClass = userData.corps?.corpsClass || 'SoundSport';
  const corpsName = userData.corps?.corpsName || 'Unknown Corps';
  
  const seasonCorpsRef = db.collection('dci-data').doc(seasonId);
  const seasonCorpsDoc = await seasonCorpsRef.get();
  
  if (!seasonCorpsDoc.exists) {
    return null;
  }
  
  const seasonCorps = seasonCorpsDoc.data().corps || seasonCorpsDoc.data().corpsValues || [];
  
  let geScore = 0, rawVisualScore = 0, rawMusicScore = 0;
  const captionScores = {};
  
  for (const caption in lineup) {
    const selectedCorpsName = lineup[caption];
    if (!selectedCorpsName) continue;
    
    const corpsInfo = seasonCorps.find(c => c.name === selectedCorpsName || c.corpsName === selectedCorpsName);
    
    if (!corpsInfo) continue;
    
    const corpsValue = corpsInfo.value || 15;
    const sourceYear = corpsInfo.sourceYear || new Date().getFullYear().toString();
    
    let captionScore = 0;
    
    // Use real score if available
    if (realScoresMap.has(selectedCorpsName)) {
      const realScore = realScoresMap.get(selectedCorpsName)[caption];
      if (realScore && realScore > 0) {
        captionScore = realScore;
      }
    }
    
    // Fallback to prediction if no real score or score is 0
    if (captionScore === 0) {
      // Map to off-season day for prediction
      const equivalentDay = mapLiveDayToOffSeasonDay(scoredDay);
      
      // CRITICAL: Pass corpsValue
      captionScore = getRealisticCaptionScore(
        selectedCorpsName,
        sourceYear,
        corpsValue,  // PASS THE VALUE!
        caption,
        equivalentDay,
        dataSource
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
 * UPDATED: Get realistic caption score using data source with UNIQUE KEY
 */
function getRealisticCaptionScore(corpsName, sourceYear, corpsValue, caption, currentDay, dataSource) {
  // Use unique key to distinguish duplicate corps
  const uniqueKey = `${corpsName}_${corpsValue}`;
  
  // Check if we're using the seasonal grid
  if (dataSource.useGrid && dataSource.grid) {
    const gridData = dataSource.grid[uniqueKey];
    
    if (gridData && gridData.scores && gridData.scores[currentDay]) {
      const dayScore = gridData.scores[currentDay];
      
      // Get caption score
      if (dayScore.captions && dayScore.captions[caption]) {
        const score = dayScore.captions[caption];
        // IGNORE 0 SCORES
        return score > 0 ? score : 0;
      }
      
      // Fallback: distribute total score across captions
      if (dayScore.totalScore && dayScore.totalScore > 0) {
        const captionWeight = caption.startsWith('GE') ? 0.2 : 0.1;
        return dayScore.totalScore * captionWeight;
      }
    }
  }
  
  // Fallback to historical data logic
  const historicalData = dataSource.historicalData || dataSource;
  
  // Try to get actual score for this day from the specific source year
  const actualScore = getScoreForDay(currentDay, corpsName, sourceYear, caption, historicalData);
  if (actualScore !== null && actualScore > 0) {
    return actualScore;
  }
  
  // Collect all available data points for this corps/caption from source year
  const allDataPoints = [];
  const yearData = historicalData[sourceYear] || [];
  
  for (const event of yearData) {
    const score = getScoreForDay(event.offSeasonDay, corpsName, sourceYear, caption, historicalData);
    if (score !== null && score > 0) {
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
    // No historical data - return 0
    return 0;
  }
}


/**
 * LOGARITHMIC REGRESSION - Creates realistic DCI-style score curves
 */
function logarithmicRegression(data) {
  const transformedData = data.map(([x, y]) => [x, y > 0 ? Math.log(y) : 0]);
  
  const { m, c } = simpleLinearRegression(transformedData);
  
  return {
    predict: (x) => {
      const logPrediction = m * x + c;
      return Math.exp(logPrediction);
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
    const scoreData = event.scores?.find(s => s.corps === corps);
    if (scoreData && scoreData.captions && scoreData.captions[caption] > 0) {
      return scoreData.captions[caption];
    }
  }
  return null;
}

/**
 * Map live season day to equivalent off-season day
 */
function mapLiveDayToOffSeasonDay(liveDay) {
  // Live season championships align with off-season
  if (liveDay >= 68) {
    return liveDay - 21;  // Maps 68->47, 69->48, 70->49
  }
  return Math.min(liveDay, 46);
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
 * Get championship participants (top 25 for semis, top 12 for finals)
 */
async function getChampionshipParticipants(db, seasonId, scoredDay, isLiveSeason = false) {
  const recapDoc = await db.doc(`fantasy_recaps/${seasonId}`).get();
  if (!recapDoc.exists) return null;
  
  const allRecaps = recapDoc.data().recaps || [];
  
  const prelimsDay = isLiveSeason ? 68 : 47;
  const semisDay = isLiveSeason ? 69 : 48;
  
  if (scoredDay === semisDay) {
    // Get top 25 from prelims
    const prelimsRecap = allRecaps.find(r => r.offSeasonDay === prelimsDay);
    if (prelimsRecap && prelimsRecap.shows.length > 0) {
      const allResults = prelimsRecap.shows.flatMap(s => s.results);
      allResults.sort((a, b) => b.totalScore - a.totalScore);
      return allResults.slice(0, 25).map(r => r.uid);
    }
  } else if (scoredDay === (isLiveSeason ? 70 : 49)) {
    // Get top 12 from semis
    const semisRecap = allRecaps.find(r => r.offSeasonDay === semisDay);
    if (semisRecap && semisRecap.shows.length > 0) {
      const allResults = semisRecap.shows.flatMap(s => s.results);
      allResults.sort((a, b) => b.totalScore - a.totalScore);
      return allResults.slice(0, 12).map(r => r.uid);
    }
  }
  
  return null;
}

/**
 * Get Eastern Classic participants (50% split across days 41-42)
 */
async function getEasternClassicParticipants(db, profilesSnapshot, competition, week, scoredDay) {
  const registeredUsers = [];
  
  profilesSnapshot.forEach(doc => {
    const userData = doc.data();
    const registrations = userData.competitionRegistrations || {};
    
    if (registrations[competition.id]) {
      registeredUsers.push(doc.ref.parent.parent.id);
    }
  });
  
  // Split 50/50 across two days
  const halfPoint = Math.floor(registeredUsers.length / 2);
  
  if (scoredDay === 41) {
    return registeredUsers.slice(0, halfPoint);
  } else if (scoredDay === 42) {
    return registeredUsers.slice(halfPoint);
  }
  
  return null;
}

/**
 * Award regional trophies
 */
function awardRegionalTrophies(batch, dailyRecap, seasonData, db) {
  dailyRecap.shows.forEach(show => {
    if (show.results.length === 0) return;
    
    // Sort by score
    show.results.sort((a, b) => b.totalScore - a.totalScore);
    
    // Award top 3
    for (let i = 0; i < Math.min(3, show.results.length); i++) {
      const winner = show.results[i];
      const userRef = db.doc(`artifacts/${DATA_NAMESPACE}/users/${winner.uid}/profile/data`);
      
      batch.update(userRef, {
        trophies: admin.firestore.FieldValue.arrayUnion({
          seasonId: seasonData.seasonId || seasonData.activeSeasonId,
          eventName: show.eventName,
          placement: i + 1,
          metal: TROPHY_METALS[i],
          date: admin.firestore.Timestamp.now()
        })
      });
    }
  });
}

/**
 * Award championship honors
 */
function awardChampionshipHonors(batch, dailyRecap, seasonData, db) {
  const allResults = dailyRecap.shows.flatMap(s => s.results);
  allResults.sort((a, b) => b.totalScore - a.totalScore);
  
  // Award champion trophy and medals
  for (let i = 0; i < Math.min(12, allResults.length); i++) {
    const winner = allResults[i];
    const userRef = db.doc(`artifacts/${DATA_NAMESPACE}/users/${winner.uid}/profile/data`);
    
    const award = i < 3 ? {
      seasonId: seasonData.seasonId || seasonData.activeSeasonId,
      eventName: 'DCI World Championship',
      placement: i + 1,
      metal: TROPHY_METALS[i],
      date: admin.firestore.Timestamp.now()
    } : {
      seasonId: seasonData.seasonId || seasonData.activeSeasonId,
      eventName: 'DCI World Championship Finalist',
      placement: i + 1,
      date: admin.firestore.Timestamp.now()
    };
    
    batch.update(userRef, {
      trophies: admin.firestore.FieldValue.arrayUnion(award)
    });
  }
}

/**
 * Update leaderboards
 */
async function updateLeaderboards(db, seasonId) {
  const logger = functions.logger;
  
  // Get all recaps for the season
  const recapDoc = await db.doc(`fantasy_recaps/${seasonId}`).get();
  if (!recapDoc.exists) return;
  
  const allRecaps = recapDoc.data().recaps || [];
  const userScores = new Map();
  
  // Aggregate scores
  allRecaps.forEach(recap => {
    recap.shows.forEach(show => {
      show.results.forEach(result => {
        const current = userScores.get(result.uid) || {
          uid: result.uid,
          corpsName: result.corpsName,
          corpsClass: result.corpsClass,
          totalScore: 0,
          competitionCount: 0,
          bestScore: 0
        };
        
        current.totalScore += result.totalScore;
        current.competitionCount++;
        current.bestScore = Math.max(current.bestScore, result.totalScore);
        
        userScores.set(result.uid, current);
      });
    });
  });
  
  // Calculate rankings
  const rankings = Array.from(userScores.values())
    .sort((a, b) => b.totalScore - a.totalScore)
    .map((user, index) => ({
      ...user,
      rank: index + 1,
      averageScore: user.totalScore / user.competitionCount
    }));
  
  // Save leaderboard
  await db.collection('leaderboards').doc(seasonId).set({
    seasonId: seasonId,
    rankings: rankings.slice(0, 100),
    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  
  logger.info(`Updated leaderboard with ${rankings.length} users`);
}

/**
 * Save recap to database
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
          const team1Score = await getWeeklyScore(db, matchup.team1.uid, week, seasonId);
          const team2Score = await getWeeklyScore(db, matchup.team2.uid, week, seasonId);
          
          const winner = team1Score > team2Score ? matchup.team1 : 
                        team2Score > team1Score ? matchup.team2 : null;
          
          updatedMatchups.push({
            ...matchup,
            team1Score: team1Score,
            team2Score: team2Score,
            winner: winner,
            completed: true
          });
          
          hasUpdates = true;
        }
        
        if (hasUpdates) {
          winnerBatch.update(matchupDocRef, {
            [matchupArrayKey]: updatedMatchups
          });
        }
      }
    }
  }
  
  await winnerBatch.commit();
  logger.info('Weekly matchups resolved');
}

/**
 * Get weekly score for a user
 */
async function getWeeklyScore(db, userId, week, seasonId) {
  const recapDoc = await db.doc(`fantasy_recaps/${seasonId}`).get();
  if (!recapDoc.exists) return 0;
  
  const recaps = recapDoc.data().recaps || [];
  const startDay = (week - 1) * 7 + 1;
  const endDay = week * 7;
  
  let totalScore = 0;
  recaps.forEach(recap => {
    if (recap.offSeasonDay >= startDay && recap.offSeasonDay <= endDay) {
      recap.shows.forEach(show => {
        const userResult = show.results.find(r => r.uid === userId);
        if (userResult) {
          totalScore += userResult.totalScore;
        }
      });
    }
  });
  
  return totalScore;
}

/**
 * Manual score processing (admin only)
 */
exports.processScoresManually = functions
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .https.onCall(async (data, context) => {
    if (!context.auth || context.auth.uid !== 'o8vfRCOevjTKBY0k2dISlpiYiIH2') {
      throw new functions.https.HttpsError('permission-denied', 'Admin access required.');
    }
    
    const db = admin.firestore();
    
    try {
      const targetDate = data?.date ? new Date(data.date) : new Date();
      
      const seasonDoc = await db.doc('game-settings/current').get();
      if (!seasonDoc.exists) {
        throw new Error('No active season found');
      }
      
      const seasonData = seasonDoc.data();
      const seasonId = seasonData.activeSeasonId || seasonData.currentSeasonId;
      
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