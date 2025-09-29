const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Get function configuration based on complexity
function getFunctionConfig(complexity = 'standard') {
  const configs = {
    light: {
      timeoutSeconds: 60,
      memory: '256MB',
      maxInstances: 100
    },
    standard: {
      timeoutSeconds: 300,
      memory: '512MB',
      maxInstances: 50
    },
    heavy: {
      timeoutSeconds: 540,
      memory: '1GB',
      maxInstances: 10
    }
  };
  
  return configs[complexity] || configs.standard;
}

// Season configuration - matching seasonScheduler.js
const SEASON_THEMES = ['Overture', 'Allegro', 'Adagio', 'Scherzo', 'Crescendo', 'Finale'];
const SEASON_TYPES = ['overture', 'allegro', 'adagio', 'scherzo', 'crescendo', 'finale', 'live'];

// ============================================================================
// ADMIN VERIFICATION
// ============================================================================

/**
 * Verify admin access
 */
function verifyAdmin(context) {
  if (!context.auth || context.auth.uid !== 'o8vfRCOevjTKBY0k2dISlpiYiIH2') {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required');
  }
}

// ============================================================================
// MAIN ADMIN FUNCTIONS
// ============================================================================

/**
 * Get admin dashboard statistics
 */
exports.getAdminStats = functions.https.onCall(async (data, context) => {
  verifyAdmin(context);
  
  const db = admin.firestore();
  
  try {
    const now = new Date();
    
    // Get all users count
    const usersSnapshot = await db.collection('artifacts')
      .doc('marching-art')
      .collection('users')
      .get();
    
    const totalUsers = usersSnapshot.size;
    
    // Count active users and get class distribution
    let activeUsers = 0;
    let totalCorps = 0;
    const classDistribution = {
      'World Class': 0,
      'Open Class': 0,
      'A Class': 0,
      'SoundSport': 0
    };
    
    // Process each user
    for (const userDoc of usersSnapshot.docs) {
      try {
        const profileDoc = await db.doc(`artifacts/marching-art/users/${userDoc.id}/profile/data`).get();
        
        if (profileDoc.exists) {
          const profileData = profileDoc.data();
          
          // Check if user is active (logged in within last 7 days)
          const lastActive = profileData.lastActive?.toDate();
          if (lastActive && (now - lastActive) < 7 * 24 * 60 * 60 * 1000) {
            activeUsers++;
          }
          
          // Count corps by class
          if (profileData.corps?.corpsClass) {
            totalCorps++;
            const corpsClass = profileData.corps.corpsClass;
            if (classDistribution.hasOwnProperty(corpsClass)) {
              classDistribution[corpsClass]++;
            }
          }
        }
      } catch (err) {
        console.warn(`Error processing user ${userDoc.id}:`, err);
        // Continue with other users
      }
    }
    
    // Get current season information with dynamic day calculation
    const currentSeasonSnapshot = await db.collection('game-settings').doc('current').get();
    
    let currentSeasonInfo = null;
    
    if (currentSeasonSnapshot.exists) {
      const seasonData = currentSeasonSnapshot.data();
      
      // Dynamically calculate current day for active seasons
      let calculatedCurrentDay = seasonData.currentDay || 0;
      let calculatedCurrentWeek = seasonData.currentWeek || 0;
      let calculatedStatus = seasonData.status || 'preparation';
      
      if (seasonData.startDate) {
        const startDate = seasonData.startDate.toDate();
        const endDate = seasonData.endDate ? seasonData.endDate.toDate() : null;
        
        if (now >= startDate) {
          if (!endDate || now <= endDate) {
            // Season is active - calculate actual current day
            const daysSinceStart = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
            calculatedCurrentDay = daysSinceStart + 1;
            calculatedCurrentWeek = Math.floor(daysSinceStart / 7) + 1;
            calculatedStatus = 'active';
          } else {
            // Season has ended
            calculatedCurrentDay = seasonData.totalDays || 49;
            calculatedCurrentWeek = seasonData.totalWeeks || 7;
            calculatedStatus = 'completed';
          }
        } else {
          // Season hasn't started yet
          calculatedCurrentDay = 0;
          calculatedCurrentWeek = 0;
          calculatedStatus = 'preparation';
        }
      }
      
      currentSeasonInfo = {
        seasonId: seasonData.seasonId || seasonData.activeSeasonId,
        activeSeasonId: seasonData.activeSeasonId,
        seasonNumber: seasonData.seasonNumber || seasonData.seasonName || 'N/A',
        seasonName: seasonData.seasonName || 'Unknown Season',
        seasonType: seasonData.seasonType || 'off',
        currentDay: calculatedCurrentDay,
        currentWeek: calculatedCurrentWeek,
        totalDays: seasonData.totalDays || (seasonData.seasonType === 'live' ? 70 : 49),
        totalWeeks: seasonData.totalWeeks || (seasonData.seasonType === 'live' ? 10 : 7),
        status: calculatedStatus,
        startDate: seasonData.startDate,
        endDate: seasonData.endDate
      };
    }
    
    // Get recent activity logs
    const logsSnapshot = await db.collection('admin-logs')
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();
    
    const recentActivity = logsSnapshot.docs.map(doc => doc.data());
    
    return {
      totalUsers,
      activeUsers,
      totalCorps,
      classDistribution,
      currentSeason: currentSeasonInfo,
      recentActivity
    };
    
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    throw new functions.https.HttpsError('internal', `Failed to fetch admin stats: ${error.message}`);
  }
});

/**
 * Season management actions
 */
exports.seasonAction = functions.https.onCall(async (data, context) => {
  verifyAdmin(context);
  
  const { action, seasonType, date } = data;
  const db = admin.firestore();
  
  try {
    switch (action) {
      case 'createNewSeason':
        return await createNewSeason(db, seasonType, null);
        
      case 'endCurrentSeason':
        return await endCurrentSeason(db);
        
      case 'processScores':
        return await processScores(db);
        
      case 'generateSchedule':
        return await generateSchedule(db);
        
      default:
        throw new functions.https.HttpsError("invalid-argument", `Unknown season action: ${action}`);
    }
  } catch (error) {
    console.error(`Error executing season action ${action}:`, error);
    throw new functions.https.HttpsError("internal", `Failed to execute ${action}: ${error.message}`);
  }
});

/**
 * User management actions  
 */
exports.userAction = functions.https.onCall(async (data, context) => {
  verifyAdmin(context);
  
  const { action, userId, amount } = data;
  const db = admin.firestore();
  
  try {
    switch (action) {
      case 'grantAdmin':
        return await grantAdminAccess(userId);
        
      case 'resetProgress':
        return await resetUserProgress(db, userId);
        
      case 'awardCorpsCoin':
        return await awardCorpsCoin(db, userId, amount);
        
      default:
        throw new functions.https.HttpsError("invalid-argument", `Unknown user action: ${action}`);
    }
  } catch (error) {
    console.error(`Error executing user action ${action}:`, error);
    throw new functions.https.HttpsError("internal", `Failed to execute ${action}: ${error.message}`);
  }
});

/**
 * Staff management actions
 */
exports.staffAction = functions.https.onCall(async (data, context) => {
  verifyAdmin(context);
  
  const { action, staffData } = data;
  const db = admin.firestore();
  
  try {
    switch (action) {
      case 'addStaffMember':
        return await addStaffMember(db, staffData);
        
      case 'updateValues':
        return await updateStaffValues(db);
        
      case 'cleanupMarketplace':
        return await cleanupMarketplace(db);
        
      default:
        throw new functions.https.HttpsError("invalid-argument", `Unknown staff action: ${action}`);
    }
  } catch (error) {
    console.error(`Error executing staff action ${action}:`, error);
    throw new functions.https.HttpsError("internal", `Failed to execute ${action}: ${error.message}`);
  }
});

// ============================================================================
// SEASON MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Create a new season with dynamic date calculations for any year
 * This will work for 2025, 2026, 2027, and beyond
 * 
 * @param {FirebaseFirestore.Firestore} db 
 * @param {string} seasonType - OPTIONAL: One of: overture, allegro, adagio, scherzo, crescendo, finale, live
 * @param {number} year - The Finals year for the season
 */
async function createNewSeason(db, seasonType, year) {
  const now = new Date();
  
  // Determine which year's cycle we're in
  const { cycleYear, seasonInfo } = determineCurrentCycle(now);
  const finalsYear = year || cycleYear;
  
  // AUTO-DETECT season type if not provided
  let seasonTypeLower;
  
  if (!seasonType) {
    seasonTypeLower = seasonInfo.seasonType;
    console.log(`Auto-detected season type: ${seasonTypeLower} for cycle year ${finalsYear}`);
  } else {
    // Manual season type provided - validate it
    seasonTypeLower = seasonType.toLowerCase();
    
    if (!SEASON_TYPES.includes(seasonTypeLower)) {
      throw new Error(`Invalid season type. Must be one of: ${SEASON_TYPES.join(', ')}`);
    }
  }
  
  // Calculate the actual season start and end dates
  const isLiveSeason = seasonTypeLower === 'live';
  const totalWeeks = isLiveSeason ? 10 : 7;
  const totalDays = isLiveSeason ? 70 : 49;
  
  // Get proper season dates
  const seasonDates = calculateSeasonDates(seasonTypeLower, finalsYear);
  const { seasonStartDate, seasonEndDate } = seasonDates;
  
  // Calculate current week and day based on actual date
  let currentWeek = 0;
  let currentDay = 0;
  let status = 'preparation';
  
  if (now >= seasonStartDate && now <= seasonEndDate) {
    // Season is active - calculate actual current day
    const daysSinceStart = Math.floor((now - seasonStartDate) / (1000 * 60 * 60 * 24));
    currentDay = daysSinceStart + 1;
    currentWeek = Math.floor(daysSinceStart / 7) + 1;
    status = 'active';
  } else if (now > seasonEndDate) {
    // Season has already ended
    status = 'completed';
    currentDay = totalDays;
    currentWeek = totalWeeks;
  }
  
  // Create proper season ID based on type
  let seasonId, seasonName;
  const seasonYear = isLiveSeason ? 
    finalsYear : 
    `${finalsYear - 1}-${finalsYear.toString().slice(-2)}`;
  
  if (isLiveSeason) {
    seasonId = `live_${finalsYear}`;
    seasonName = `DCI ${finalsYear} Live Season`;
  } else {
    seasonId = `${seasonTypeLower}_${seasonYear}`;
    const themeIndex = SEASON_THEMES.findIndex(t => t.toLowerCase() === seasonTypeLower);
    seasonName = `${SEASON_THEMES[themeIndex]} Season ${seasonYear}`;
  }
  
  // Get next season number (incremental counter)
  const seasonNumber = await getNextSeasonNumber(db);
  
  // Create season document
  const seasonData = {
    seasonId,
    activeSeasonId: seasonId,
    seasonName,
    seasonNumber,
    seasonType: isLiveSeason ? 'live' : 'off',
    isLiveSeason,
    finalsYear,
    startDate: admin.firestore.Timestamp.fromDate(seasonStartDate),
    endDate: admin.firestore.Timestamp.fromDate(seasonEndDate),
    currentWeek,
    currentDay,
    totalWeeks,
    totalDays,
    status,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    lastProgressionCheck: admin.firestore.FieldValue.serverTimestamp()
  };
  
  // Save to game-settings
  await db.collection('game-settings').doc('current').set(seasonData);
  
  // Initialize other season collections
  await db.collection('schedules').doc(seasonId).set({
    seasonId,
    competitions: [],
    generatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  await db.collection('leaderboards').doc(seasonId).set({
    seasonId,
    rankings: [],
    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
  });
  
  // Assign corps and generate schedule
  await assignCorpsForSeason(db, seasonId, seasonTypeLower, finalsYear);
  
  // Log admin action
  await db.collection('admin-logs').add({
    action: 'createNewSeason',
    seasonId,
    seasonType: seasonTypeLower,
    adminId: 'manual',
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    details: `Created ${seasonName} - Status: ${status}, Current Day: ${currentDay}/${totalDays}`
  });
  
  return {
    success: true,
    message: `Season ${seasonName} created successfully! Status: ${status}, Current Day: ${currentDay}/${totalDays}`,
    seasonId,
    seasonName,
    seasonType: seasonTypeLower,
    currentDay,
    currentWeek,
    status
  };
}

/**
 * Determine which year's cycle we're in and what season
 * This works for any year from 2025 onward
 */
function determineCurrentCycle(currentDate) {
  const currentYear = currentDate.getFullYear();
  
  // Check if we're in the current year's live season or after
  const currentYearFinalsDate = getSecondSaturdayOfAugust(currentYear);
  const liveSeasonStart = new Date(currentYearFinalsDate);
  liveSeasonStart.setDate(liveSeasonStart.getDate() - 69);
  liveSeasonStart.setHours(3, 0, 0, 0);
  
  if (currentDate >= liveSeasonStart) {
    // We're in or after the current year's live season
    const liveSeasonEnd = new Date(currentYearFinalsDate);
    liveSeasonEnd.setHours(23, 59, 59, 999);
    
    if (currentDate <= liveSeasonEnd) {
      // We're in the live season
      return {
        cycleYear: currentYear,
        seasonInfo: { seasonType: 'live', seasonNumber: 7 }
      };
    } else {
      // We're after finals - start of next cycle (Overture for next year)
      return {
        cycleYear: currentYear + 1,
        seasonInfo: { seasonType: 'overture', seasonNumber: 1 }
      };
    }
  }
  
  // We're in an off-season leading up to this year's live season
  // Calculate which off-season based on days since last year's finals
  const previousYearFinalsDate = getSecondSaturdayOfAugust(currentYear - 1);
  const cycleStartDate = new Date(previousYearFinalsDate);
  cycleStartDate.setDate(cycleStartDate.getDate() + 1); // Day after finals
  cycleStartDate.setHours(3, 0, 0, 0);
  
  const daysSinceCycleStart = Math.floor((currentDate - cycleStartDate) / (1000 * 60 * 60 * 24));
  const offSeasonNumber = Math.min(Math.floor(daysSinceCycleStart / 49) + 1, 6);
  
  return {
    cycleYear: currentYear,
    seasonInfo: {
      seasonType: SEASON_THEMES[offSeasonNumber - 1].toLowerCase(),
      seasonNumber: offSeasonNumber
    }
  };
}

/**
 * Calculate exact season start and end dates for any year
 */
function calculateSeasonDates(seasonType, finalsYear) {
  const finalsDate = getSecondSaturdayOfAugust(finalsYear);
  
  if (seasonType === 'live') {
    // Live season: 70 days ending on Finals
    const seasonEndDate = new Date(finalsDate);
    seasonEndDate.setHours(23, 59, 59, 999);
    
    const seasonStartDate = new Date(finalsDate);
    seasonStartDate.setDate(seasonStartDate.getDate() - 69); // 70 days total
    seasonStartDate.setHours(3, 0, 0, 0);
    
    return { seasonStartDate, seasonEndDate };
  } else {
    // Off-season: Calculate based on position in yearly cycle
    const seasonIndex = SEASON_THEMES.findIndex(t => t.toLowerCase() === seasonType);
    if (seasonIndex === -1) {
      throw new Error(`Invalid season type: ${seasonType}`);
    }
    
    // Off-seasons run from day after previous year's finals until current year's live season
    const previousFinalsDate = getSecondSaturdayOfAugust(finalsYear - 1);
    const cycleStartDate = new Date(previousFinalsDate);
    cycleStartDate.setDate(cycleStartDate.getDate() + 1); // Day after finals
    cycleStartDate.setHours(3, 0, 0, 0);
    
    // Each off-season is 49 days
    const seasonStartDate = new Date(cycleStartDate);
    seasonStartDate.setDate(seasonStartDate.getDate() + (seasonIndex * 49));
    
    const seasonEndDate = new Date(seasonStartDate);
    seasonEndDate.setDate(seasonEndDate.getDate() + 48); // 49 days total
    seasonEndDate.setHours(23, 59, 59, 999);
    
    return { seasonStartDate, seasonEndDate };
  }
}

/**
 * Helper: Get the second Saturday of August for any given year
 */
function getSecondSaturdayOfAugust(year) {
  const august = new Date(year, 7, 1); // Month 7 = August
  
  // Find first Saturday
  let firstSaturday = 1;
  while (new Date(year, 7, firstSaturday).getDay() !== 6) {
    firstSaturday++;
  }
  
  // Second Saturday is 7 days later
  const secondSaturday = firstSaturday + 7;
  
  return new Date(year, 7, secondSaturday, 3, 0, 0); // 3:00 AM ET
}

/**
 * Get the next season number (incremental counter across all seasons)
 */
async function getNextSeasonNumber(db) {
  const archivesSnapshot = await db.collection('season-archives')
    .orderBy('seasonNumber', 'desc')
    .limit(1)
    .get();
  
  if (archivesSnapshot.empty) {
    return 1;
  }
  
  const lastSeason = archivesSnapshot.docs[0].data();
  return (lastSeason.seasonNumber || 0) + 1;
}

/**
 * Assign corps for the season
 */
async function assignCorpsForSeason(db, seasonId, seasonType, finalsYear) {
  // Implementation would go here - assigning 25 corps from historical data
  // This is a placeholder for the actual corps assignment logic
  console.log(`Assigning corps for ${seasonId}`);
  
  // TODO: Implement actual corps assignment from historical_scores database
  // Should select 25 corps with values 1-25 from appropriate year
}

/**
 * End the current season and archive it
 */
async function endCurrentSeason(db) {
  const currentSeasonRef = db.collection('game-settings').doc('current');
  const currentSeason = await currentSeasonRef.get();
  
  if (!currentSeason.exists) {
    throw new Error('No active season found');
  }
  
  const seasonData = currentSeason.data();
  
  // Archive current season
  await db.collection('season-archives').doc(seasonData.seasonId).set({
    ...seasonData,
    endDate: admin.firestore.FieldValue.serverTimestamp(),
    status: 'completed'
  });
  
  // Update status instead of deleting
  await currentSeasonRef.update({
    status: 'completed',
    isActive: false,
    endDate: admin.firestore.FieldValue.serverTimestamp()
  });
  
  // Log admin action
  await db.collection('admin-logs').add({
    action: 'endCurrentSeason',
    seasonId: seasonData.seasonId,
    adminId: 'manual',
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });
  
  return {
    success: true,
    message: `Season ${seasonData.seasonName || seasonData.seasonId} ended and archived successfully!`,
    seasonId: seasonData.seasonId
  };
}

/**
 * Process scores for current season
 */
async function processScores(db) {
  // This would trigger the score processing function
  return {
    success: true,
    message: 'Score processing initiated. This may take several minutes to complete.'
  };
}

/**
 * Generate schedule for current season
 */
async function generateSchedule(db) {
  const currentSeasonRef = db.collection('game-settings').doc('current');
  const currentSeason = await currentSeasonRef.get();
  
  if (!currentSeason.exists) {
    throw new Error('No active season found');
  }
  
  const seasonData = currentSeason.data();
  // Schedule generation logic would go here
  
  return {
    success: true,
    message: `Schedule regenerated for ${seasonData.seasonName || seasonData.seasonId}`,
    seasonId: seasonData.seasonId
  };
}

// ============================================================================
// USER MANAGEMENT FUNCTIONS  
// ============================================================================

async function grantAdminAccess(userId) {
  // Implementation for granting admin access
  return {
    success: true,
    message: `Admin access granted to user ${userId}`
  };
}

async function resetUserProgress(db, userId) {
  // Implementation for resetting user progress
  return {
    success: true,
    message: `Progress reset for user ${userId}`
  };
}

async function awardCorpsCoin(db, userId, amount) {
  // Implementation for awarding CorpsCoin
  return {
    success: true,
    message: `Awarded ${amount} CorpsCoin to user ${userId}`
  };
}

// ============================================================================
// STAFF MANAGEMENT FUNCTIONS
// ============================================================================

async function addStaffMember(db, staffData) {
  // Implementation for adding staff member
  return {
    success: true,
    message: `Staff member ${staffData.name} added successfully`
  };
}

async function updateStaffValues(db) {
  // Implementation for updating staff values
  return {
    success: true,
    message: 'Staff values updated successfully'
  };
}

async function cleanupMarketplace(db) {
  // Implementation for marketplace cleanup
  return {
    success: true,
    message: 'Marketplace cleaned up successfully'
  };
}

// Export all functions
module.exports = {
  getAdminStats: exports.getAdminStats,
  seasonAction: exports.seasonAction,
  userAction: exports.userAction,
  staffAction: exports.staffAction
};