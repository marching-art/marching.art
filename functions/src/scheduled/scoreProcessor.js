const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { DATA_NAMESPACE } = require('../../config');

/**
 * Score Processing System
 * Handles automated scoring for all fantasy corps based on historical data
 * Runs daily at 2:00 AM UTC (before season scheduler at 3:00 AM)
 */

// DCI Caption scoring system - exactly as DCI scores
const DCI_SCORING_SYSTEM = {
  // General Effect: GE1 + GE2 = 40 points total
  GE1: 20,      // General Effect 1
  GE2: 20,      // General Effect 2
  
  // Visual Total: (VP + VA + CG) / 2 = 30 points total  
  VP: 20,       // Visual Proficiency (out of 20, divided by 2)
  VA: 20,       // Visual Analysis (out of 20, divided by 2) 
  CG: 20,       // Color Guard (out of 20, divided by 2)
  
  // Music Total: (B + MA + P) / 2 = 30 points total
  B: 20,        // Brass (out of 20, divided by 2)
  MA: 20,       // Music Analysis (out of 20, divided by 2)
  P: 20         // Percussion (out of 20, divided by 2)
};

// Total possible score: GE (40) + Visual (30) + Music (30) = 100 points

// Class-based point limits for corps registration
const CLASS_POINT_LIMITS = {
  'SoundSport': 90,
  'A Class': 60,
  'Open Class': 120,
  'World Class': 150
};

/**
 * Daily score processing - runs at 2:00 AM UTC
 */
exports.processNightlyScores = functions.pubsub.schedule('0 2 * * *')
  .timeZone('UTC')
  .onRun(async (context) => {
    const logger = functions.logger;
    
    try {
      logger.info('Starting nightly score processing...');
      
      const currentDate = new Date();
      currentDate.setDate(currentDate.getDate() - 1); // Process previous day's competitions
      
      await processCompetitionsForDate(currentDate);
      await updateLeaderboards();
      
      logger.info('Nightly score processing completed successfully');
      
    } catch (error) {
      logger.error('Error in nightly score processing:', error);
      throw error;
    }
  });

/**
 * Process all competitions scheduled for a specific date
 */
async function processCompetitionsForDate(targetDate) {
  const db = admin.firestore();
  
  // Get current season info
  const gameSettingsRef = db.collection('game-settings').doc('current');
  const gameSettings = await gameSettingsRef.get();
  
  if (!gameSettings.exists) {
    functions.logger.warn('No current season found, skipping score processing');
    return;
  }
  
  const seasonData = gameSettings.data();
  const seasonId = seasonData.currentSeasonId;
  
  // Get scheduled competitions for target date
  const scheduleRef = db.collection('schedules').doc(seasonId);
  const scheduleDoc = await scheduleRef.get();
  
  if (!scheduleDoc.exists) {
    functions.logger.warn(`No schedule found for season ${seasonId}`);
    return;
  }
  
  const schedule = scheduleDoc.data();
  const targetDateStr = targetDate.toISOString().split('T')[0];
  
  // Find competitions for target date
  const competitionsForDate = schedule.competitions.filter(comp => {
    const compDate = comp.date.toDate().toISOString().split('T')[0];
    return compDate === targetDateStr && comp.status === 'scheduled';
  });
  
  if (competitionsForDate.length === 0) {
    functions.logger.info(`No competitions scheduled for ${targetDateStr}`);
    return;
  }
  
  // Process each competition
  for (const competition of competitionsForDate) {
    await processCompetition(competition, seasonId, targetDate);
  }
}

/**
 * Process scores for a single competition
 */
async function processCompetition(competition, seasonId, date) {
  const db = admin.firestore();
  const logger = functions.logger;
  
  logger.info(`Processing competition: ${competition.name}`);
  
  // Get all registered corps for this competition
  const registeredCorps = await getRegisteredCorpsForCompetition(competition, seasonId);
  
  if (registeredCorps.length === 0) {
    logger.info(`No corps registered for ${competition.name}`);
    return;
  }
  
  // Generate scores for each corps
  const competitionResults = [];
  
  for (const corps of registeredCorps) {
    const score = await generateCorpsScore(corps, competition, seasonId, date);
    competitionResults.push(score);
  }
  
  // Sort by total score (highest first)
  competitionResults.sort((a, b) => b.totalScore - a.totalScore);
  
  // Assign placements
  competitionResults.forEach((result, index) => {
    result.placement = index + 1;
  });
  
  // Save competition results
  await saveCompetitionResults(competition, competitionResults, seasonId, date);
  
  // Update user scores and stats
  await updateUserScoresFromCompetition(competitionResults, competition, seasonId);
  
  logger.info(`Processed ${competitionResults.length} corps for ${competition.name}`);
}

/**
 * Get all fantasy corps registered for a competition
 */
async function getRegisteredCorpsForCompetition(competition, seasonId) {
  const db = admin.firestore();
  
  // Get all users with active lineups
  const usersSnapshot = await db.collectionGroup('data')
    .where('activeSeasonId', '==', seasonId)
    .where('lineup', '!=', null)
    .get();
  
  const registeredCorps = [];
  
  usersSnapshot.forEach(userDoc => {
    const userData = userDoc.data();
    const userId = userDoc.ref.parent.parent.id;
    
    // Check if user has selected this competition
    if (userData.selectedShows && userData.selectedShows[competition.id]) {
      // Validate corps class is allowed in this competition
      const corpsClass = userData.corps?.class || 'SoundSport';
      
      if (competition.allowedClasses.includes(corpsClass)) {
        registeredCorps.push({
          userId: userId,
          displayName: userData.displayName || userData.email?.split('@')[0] || 'Anonymous',
          corpsName: userData.corps?.corpsName || 'Unknown Corps',
          corpsClass: corpsClass,
          lineup: userData.lineup || {},
          uniform: userData.uniform || {},
          staff: userData.staff || []
        });
      }
    }
  });
  
  return registeredCorps;
}

/**
 * Generate scores for a fantasy corps based on lineup and historical DCI data
 */
async function generateCorpsScore(corps, competition, seasonId, date) {
  const db = admin.firestore();
  
  // Get season corps data for caption value lookup
  const seasonCorpsRef = db.collection('dci-data').doc(seasonId);
  const seasonCorpsDoc = await seasonCorpsRef.get();
  
  if (!seasonCorpsDoc.exists) {
    throw new Error(`Season corps data not found for ${seasonId}`);
  }
  
  const seasonCorps = seasonCorpsDoc.data().corps;
  
  // Calculate caption scores based on lineup using DCI scoring methodology
  const captionScores = {};
  
  // Process each caption in user's lineup
  for (const [caption, selectedCorpsName] of Object.entries(corps.lineup)) {
    if (!selectedCorpsName || !DCI_SCORING_SYSTEM[caption]) continue;
    
    // Get historical score for this corps/caption combination
    const historicalScore = await getHistoricalScore(selectedCorpsName, caption, date);
    
    // Apply staff bonuses if applicable
    const staffBonus = calculateStaffBonus(corps.staff, caption);
    
    // Apply random variance (-2% to +2%)
    const variance = (Math.random() - 0.5) * 0.04;
    
    // Calculate final caption score with variance and staff bonus
    const captionScore = Math.max(0, historicalScore * (1 + variance) + staffBonus);
    
    captionScores[caption] = Math.round(captionScore * 100) / 100;
  }
  
  // Calculate total score using DCI methodology
  const totalScore = calculateDCITotalScore(captionScores);
  
  // Apply class-based scoring adjustments
  const classMultiplier = getClassMultiplier(corps.corpsClass);
  const finalScore = totalScore * classMultiplier;
  
  return {
    userId: corps.userId,
    displayName: corps.displayName,
    corpsName: corps.corpsName,
    corpsClass: corps.corpsClass,
    captionScores: captionScores,
    totalScore: Math.round(finalScore * 100) / 100,
    competitionId: competition.id,
    competitionName: competition.name,
    date: admin.firestore.Timestamp.fromDate(date),
    
    // DCI-style breakdown
    generalEffect: captionScores.GE1 + captionScores.GE2,
    visualTotal: ((captionScores.VP + captionScores.VA + captionScores.CG) / 2),
    musicTotal: ((captionScores.B + captionScores.MA + captionScores.P) / 2)
  };
}

/**
 * Get historical score from existing firestore historical_scores collection
 */
async function getHistoricalScore(corpsName, caption, date) {
  const db = admin.firestore();
  
  try {
    // Determine which year of historical data to use
    const targetYear = date.getFullYear();
    
    // Query the existing historical_scores collection structure
    const historicalRef = db.collection('historical_scores').doc(targetYear.toString());
    const historicalDoc = await historicalRef.get();
    
    if (historicalDoc.exists) {
      const yearData = historicalDoc.data();
      
      // The structure appears to be organized by event/date with corps data nested
      // Look through all events to find scores for this corps
      for (const [eventKey, eventData] of Object.entries(yearData)) {
        if (eventData && typeof eventData === 'object') {
          // Check if this event has the corps we're looking for
          if (eventData.corps === corpsName && eventData.captions && eventData.captions[caption]) {
            return eventData.captions[caption];
          }
          
          // Also check if it's structured differently (corps as key with scores)
          if (eventData[corpsName] && eventData[corpsName].captions && eventData[corpsName].captions[caption]) {
            return eventData[corpsName].captions[caption];
          }
          
          // Check for direct caption access
          if (eventData.captions && eventData.captions[caption] && eventData.corps === corpsName) {
            return eventData.captions[caption];
          }
        }
      }
    }
    
    // If no historical data found, try previous years (2024, 2023, 2022, etc.)
    for (let year = targetYear - 1; year >= targetYear - 3; year--) {
      const fallbackRef = db.collection('historical_scores').doc(year.toString());
      const fallbackDoc = await fallbackRef.get();
      
      if (fallbackDoc.exists) {
        const fallbackData = fallbackDoc.data();
        
        for (const [eventKey, eventData] of Object.entries(fallbackData)) {
          if (eventData && typeof eventData === 'object') {
            if (eventData.corps === corpsName && eventData.captions && eventData.captions[caption]) {
              // Apply slight degradation for older data
              return eventData.captions[caption] * 0.98;
            }
          }
        }
      }
    }
    
    // Fallback: Generate score based on corps value if no historical data
    const seasonCorpsRef = db.collection('dci-data').doc(seasonId);
    const seasonCorpsDoc = await seasonCorpsRef.get();
    
    if (seasonCorpsDoc.exists) {
      const seasonCorps = seasonCorpsDoc.data().corps;
      const corpsInfo = seasonCorps.find(c => c.name === corpsName);
      
      if (corpsInfo) {
        return generateFallbackScore(corpsInfo.value, caption);
      }
    }
    
    // Ultimate fallback
    return generateFallbackScore(15, caption); // Middle-tier score
    
  } catch (error) {
    functions.logger.error(`Error getting historical score for ${corpsName}/${caption}:`, error);
    return generateFallbackScore(15, caption);
  }
}

/**
 * Generate fallback score when historical data is unavailable
 */
function generateFallbackScore(corpsValue, caption) {
  // Base scores by caption type (out of 20 for individual captions)
  const baseCaptionScores = {
    GE1: 19.5 - ((corpsValue - 1) * 0.15),  // 19.5 down to 16.0
    GE2: 19.5 - ((corpsValue - 1) * 0.15),
    VP: 19.2 - ((corpsValue - 1) * 0.13),   // Visual captions slightly lower
    VA: 19.2 - ((corpsValue - 1) * 0.13),
    CG: 19.2 - ((corpsValue - 1) * 0.13),
    B: 19.3 - ((corpsValue - 1) * 0.14),    // Music captions
    MA: 19.3 - ((corpsValue - 1) * 0.14),
    P: 19.3 - ((corpsValue - 1) * 0.14)
  };
  
  return baseCaptionScores[caption] || 18.0;
}

/**
 * Calculate total score using DCI methodology
 */
function calculateDCITotalScore(captionScores) {
  // General Effect: GE1 + GE2 (direct sum)
  const generalEffect = (captionScores.GE1 || 0) + (captionScores.GE2 || 0);
  
  // Visual Total: (VP + VA + CG) / 2
  const visualTotal = ((captionScores.VP || 0) + (captionScores.VA || 0) + (captionScores.CG || 0)) / 2;
  
  // Music Total: (B + MA + P) / 2  
  const musicTotal = ((captionScores.B || 0) + (captionScores.MA || 0) + (captionScores.P || 0)) / 2;
  
  // Total DCI score
  return generalEffect + visualTotal + musicTotal;
}

/**
 * Calculate base score for a corps based on their value and competition type
 */
function calculateBaseScore(corpsValue, competition) {
  // Base scoring scale: value 1 = ~19.5 points, value 25 = ~16.0 points
  // This creates a competitive spread while keeping scores realistic
  
  let baseScore = 19.5 - ((corpsValue - 1) * 0.15);
  
  // Regional competitions tend to have slightly lower scores
  if (competition.isRegional) {
    baseScore *= 0.97;
  }
  
  // National competitions have higher scoring potential
  if (competition.isNational) {
    baseScore *= 1.02;
  }
  
  return baseScore;
}

/**
 * Calculate staff bonus for a caption
 */
function calculateStaffBonus(staffMembers, caption) {
  if (!staffMembers || staffMembers.length === 0) return 0;
  
  // Find staff member assigned to this caption
  const staffForCaption = staffMembers.find(staff => 
    staff.caption === caption && staff.isAssigned
  );
  
  if (!staffForCaption) return 0;
  
  // Staff bonus based on experience and induction year
  // More experienced staff (lower induction year number) = higher bonus
  const experienceBonus = Math.max(0.05, (2025 - staffForCaption.inductionYear) * 0.025);
  
  return Math.min(0.3, experienceBonus); // Cap at 0.3 points (reasonable for DCI scoring)
}

/**
 * Get scoring multiplier based on corps class
 */
function getClassMultiplier(corpsClass) {
  const multipliers = {
    'World Class': 1.0,
    'Open Class': 0.95,
    'A Class': 0.90,
    'SoundSport': 0.85
  };
  
  return multipliers[corpsClass] || 1.0;
}

/**
 * Save competition results to database
 */
async function saveCompetitionResults(competition, results, seasonId, date) {
  const db = admin.firestore();
  
  const resultsRef = db.collection('live_scores')
    .doc(seasonId)
    .collection('scores')
    .doc(competition.id);
  
  await resultsRef.set({
    competitionId: competition.id,
    competitionName: competition.name,
    date: admin.firestore.Timestamp.fromDate(date),
    seasonId: seasonId,
    results: results,
    processedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  // Update competition status to completed
  const scheduleRef = db.collection('schedules').doc(seasonId);
  const scheduleDoc = await scheduleRef.get();
  
  if (scheduleDoc.exists) {
    const schedule = scheduleDoc.data();
    const updatedCompetitions = schedule.competitions.map(comp => {
      if (comp.id === competition.id) {
        return { ...comp, status: 'completed' };
      }
      return comp;
    });
    
    await scheduleRef.update({ competitions: updatedCompetitions });
  }
}

/**
 * Update user scores and stats from competition
 */
async function updateUserScoresFromCompetition(results, competition, seasonId) {
  const db = admin.firestore();
  const batch = db.batch();
  
  for (const result of results) {
    const userRef = db.doc(`artifacts/${DATA_NAMESPACE}/users/${result.userId}/profile/data`);
    
    // Add to user's total season score
    batch.update(userRef, {
      totalSeasonScore: admin.firestore.FieldValue.increment(result.totalScore),
      lastCompetitionScore: result.totalScore,
      lastCompetitionDate: result.date,
      lastCompetitionName: competition.name,
      lastUpdatedShowScoring: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Award CorpsCoin based on class
    const corpsCoinReward = getCorpsCoinReward(result.corpsClass);
    if (corpsCoinReward > 0) {
      batch.update(userRef, {
        corpsCoin: admin.firestore.FieldValue.increment(corpsCoinReward)
      });
    }
  }
  
  await batch.commit();
}

/**
 * Get CorpsCoin reward based on corps class
 */
function getCorpsCoinReward(corpsClass) {
  const rewards = {
    'World Class': 100,
    'Open Class': 50,
    'A Class': 25,
    'SoundSport': 0
  };
  
  return rewards[corpsClass] || 0;
}

/**
 * Update global leaderboards
 */
async function updateLeaderboards() {
  const db = admin.firestore();
  
  // Get current season
  const gameSettingsRef = db.collection('game-settings').doc('current');
  const gameSettings = await gameSettingsRef.get();
  
  if (!gameSettings.exists) return;
  
  const seasonId = gameSettings.data().currentSeasonId;
  
  // Get all users with scores this season
  const usersSnapshot = await db.collectionGroup('data')
    .where('activeSeasonId', '==', seasonId)
    .where('totalSeasonScore', '>', 0)
    .orderBy('totalSeasonScore', 'desc')
    .get();
  
  const leaderboardData = [];
  
  usersSnapshot.forEach((userDoc, index) => {
    const userData = userDoc.data();
    const userId = userDoc.ref.parent.parent.id;
    
    leaderboardData.push({
      userId: userId,
      displayName: userData.displayName || userData.email?.split('@')[0] || 'Anonymous',
      corpsName: userData.corps?.corpsName || 'Unknown Corps',
      corpsClass: userData.corps?.class || 'SoundSport',
      totalScore: userData.totalSeasonScore || 0,
      rank: index + 1
    });
  });
  
  // Save updated leaderboard
  const leaderboardRef = db.collection('leaderboards').doc(seasonId);
  await leaderboardRef.set({
    seasonId: seasonId,
    rankings: leaderboardData,
    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
  });
  
  // Update user ranks
  const batch = db.batch();
  
  leaderboardData.forEach(entry => {
    const userRef = db.doc(`artifacts/${DATA_NAMESPACE}/users/${entry.userId}/profile/data`);
    batch.update(userRef, { seasonRank: entry.rank });
  });
  
  await batch.commit();
  
  functions.logger.info(`Updated leaderboard with ${leaderboardData.length} entries`);
}

/**
 * Manual score processing (callable function for admin)
 */
exports.processScoresManually = functions.https.onCall(async (data, context) => {
  // Verify admin access
  if (!context.auth?.token?.admin) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Admin access required'
    );
  }
  
  try {
    const targetDate = data.date ? new Date(data.date) : new Date();
    await processCompetitionsForDate(targetDate);
    await updateLeaderboards();
    
    return {
      success: true,
      message: 'Scores processed successfully',
      date: targetDate.toISOString()
    };
    
  } catch (error) {
    functions.logger.error('Error processing scores manually:', error);
    throw new functions.https.HttpsError('internal', 'Failed to process scores');
  }
});

module.exports = {
  processNightlyScores: exports.processNightlyScores,
  processScoresManually: exports.processScoresManually
};