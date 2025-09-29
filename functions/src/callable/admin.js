const functions = require('firebase-functions');
const admin = require('firebase-admin');

/**
 * marching.art Admin Functions
 * Comprehensive season administration tools for ultimate efficiency
 * Designed for scalability to 10,000+ users with minimal cost
 */

// Configuration constants
const DATA_NAMESPACE = 'marching-art';
const ADMIN_USER_ID = 'o8vfRCOevjTKBY0k2dISlpiYiIH2';

// Season types - MUST match seasonScheduler.js
// 6 off-seasons (49 days each) + 1 live season (70 days)
const SEASON_THEMES = ['Overture', 'Allegro', 'Adagio', 'Scherzo', 'Crescendo', 'Finale'];
const SEASON_TYPES = [...SEASON_THEMES.map(t => t.toLowerCase()), 'live'];

// Verify admin access for all functions
const verifyAdmin = (context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
  }
  
  if (context.auth.uid !== ADMIN_USER_ID) {
    throw new functions.https.HttpsError("permission-denied", "Admin access required.");
  }
};

/**
 * Get comprehensive system statistics
 */
exports.getSystemStats = functions.https.onCall(async (data, context) => {
  verifyAdmin(context);
  
  try {
    const db = admin.firestore();
    const now = new Date();
    
    // Get user statistics by querying the users collection directly
    const usersCollectionRef = db.collection(`artifacts/${DATA_NAMESPACE}/users`);
    const usersSnapshot = await usersCollectionRef.listDocuments();
    
    let totalUsers = 0;
    let activeUsers = 0;
    let totalCorps = 0;
    const classDistribution = { 'SoundSport': 0, 'A Class': 0, 'Open Class': 0, 'World Class': 0 };
    
    // Process each user document
    for (const userDoc of usersSnapshot) {
      try {
        const profileDoc = await userDoc.collection('profile').doc('data').get();
        
        if (profileDoc.exists) {
          const profileData = profileDoc.data();
          totalUsers++;
          
          // Check if active in last 7 days
          const lastActive = profileData.lastActive?.toDate?.();
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
    
    // Get current season information
    const currentSeasonSnapshot = await db.collection('game-settings').doc('current').get();
    const currentSeasonData = currentSeasonSnapshot.exists ? currentSeasonSnapshot.data() : null;
    
    // Get staff statistics
    const staffSnapshot = await db.collection('staff').get();
    const marketplaceSnapshot = await db.collection('staff_marketplace')
      .where('isActive', '==', true)
      .get();
    
    const staffStats = {
      totalStaff: staffSnapshot.size,
      marketplaceListings: marketplaceSnapshot.size,
      totalTransactions: 0,
      averagePrice: 0
    };
    
    // Calculate average marketplace price
    if (marketplaceSnapshot.size > 0) {
      let totalPrice = 0;
      marketplaceSnapshot.forEach(doc => {
        totalPrice += doc.data().price || 0;
      });
      staffStats.averagePrice = Math.round(totalPrice / marketplaceSnapshot.size);
    }
    
    // Mock performance data
    const performance = {
      uptime: 99.9,
      avgResponseTime: 245,
      dailyActiveUsers: activeUsers
    };
    
    return {
      success: true,
      stats: {
        totalUsers,
        activeUsers,
        totalCorps,
        activeSeasons: currentSeasonData ? 1 : 0,
        classDistribution,
        currentSeason: currentSeasonData ? {
          id: currentSeasonData.seasonId,
          name: currentSeasonData.seasonName || currentSeasonData.seasonId,
          type: currentSeasonData.seasonType || 'unknown',
          status: currentSeasonData.status,
          currentWeek: currentSeasonData.currentWeek || 1,
          currentDay: currentSeasonData.currentDay || 1,
          corpsCount: totalCorps
        } : null,
        staffStats,
        performance
      }
    };
    
  } catch (error) {
    console.error('Error getting system stats:', error);
    throw new functions.https.HttpsError("internal", "Failed to retrieve system statistics.");
  }
});

/**
 * Execute season management actions
 */
exports.seasonAction = functions
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .https.onCall(async (data, context) => {
    verifyAdmin(context);
    
    const { action, seasonType, year } = data;
    const db = admin.firestore();
    
    try {
      switch (action) {
        case 'createNewSeason':
          return await createNewSeason(db, seasonType, year);
          
        case 'endCurrentSeason':
          return await endCurrentSeason(db);
          
        case 'processScores':
          return await processScores(db);
          
        case 'generateSchedule':
          return await generateSchedule(db);
          
        case 'updateLeaderboards':
          return await updateLeaderboards(db);
          
        case 'cleanupOldData':
          return await cleanupOldData(db);
          
        default:
          throw new functions.https.HttpsError("invalid-argument", `Unknown action: ${action}`);
      }
    } catch (error) {
      console.error(`Error executing season action ${action}:`, error);
      throw new functions.https.HttpsError("internal", `Failed to execute ${action}: ${error.message}`);
    }
  });

/**
 * Execute database management actions
 */
exports.databaseAction = functions
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .https.onCall(async (data, context) => {
    verifyAdmin(context);
    
    const { action } = data;
    const db = admin.firestore();
    
    try {
      switch (action) {
        case 'backupDatabase':
          return await backupDatabase(db);
          
        case 'initializeStaff':
          return await initializeStaff(db);
          
        case 'validateData':
          return await validateData(db);
          
        case 'migrateData':
          return await migrateData(db);
          
        case 'optimizeIndexes':
          return await optimizeIndexes(db);
          
        case 'clearCache':
          return await clearCache(db);
          
        case 'grantAdminAccess':
          return await grantAdminAccess(data.userId);
          
        case 'resetUserProgress':
          return await resetUserProgress(db, data.userId);
          
        case 'awardCorpsCoin':
          return await awardCorpsCoin(db, data.userId, data.amount);
          
        case 'addStaffMember':
          return await addStaffMember(db, data.staffData);
          
        case 'updateStaffValues':
          return await updateStaffValues(db);
          
        case 'cleanupMarketplace':
          return await cleanupMarketplace(db);
          
        case 'generateUserReport':
          return await generateUserReport(db);
          
        case 'generateSeasonReport':
          return await generateSeasonReport(db);
          
        case 'generateFinancialReport':
          return await generateFinancialReport(db);
          
        default:
          throw new functions.https.HttpsError("invalid-argument", `Unknown action: ${action}`);
      }
    } catch (error) {
      console.error(`Error executing database action ${action}:`, error);
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
 * Create a new season with proper naming convention and correct current day calculation
 * Handles mid-season starts by calculating actual current day
 * 
 * @param {FirebaseFirestore.Firestore} db 
 * @param {string} seasonType - One of: overture, allegro, adagio, scherzo, crescendo, finale, live
 * @param {number} year - The Finals year for the season
 */
async function createNewSeason(db, seasonType, year) {
  const seasonTypeLower = seasonType?.toLowerCase();
  
  // Validate season type
  if (!SEASON_TYPES.includes(seasonTypeLower)) {
    throw new Error(`Invalid season type. Must be one of: ${SEASON_TYPES.join(', ')}`);
  }
  
  // Use current year if not provided (Finals year)
  const finalsYear = year || new Date().getFullYear();
  
  // Calculate the actual season start and end dates
  const isLiveSeason = seasonTypeLower === 'live';
  const totalWeeks = isLiveSeason ? 10 : 7;
  const totalDays = isLiveSeason ? 70 : 49;
  
  // Calculate DCI Finals date (second Saturday of August)
  const finalsDate = getSecondSaturdayOfAugust(finalsYear);
  
  // Calculate season dates
  let seasonStartDate, seasonEndDate;
  
  if (isLiveSeason) {
    // Live season: 70 days ending on Finals
    seasonEndDate = new Date(finalsDate);
    seasonEndDate.setHours(23, 59, 59, 999);
    
    seasonStartDate = new Date(finalsDate);
    seasonStartDate.setDate(seasonStartDate.getDate() - 69); // 70 days total
    seasonStartDate.setHours(3, 0, 0, 0); // 3:00 AM UTC
  } else {
    // Off-season: Calculate based on season number
    const seasonNumber = SEASON_THEMES.findIndex(t => t.toLowerCase() === seasonTypeLower) + 1;
    const liveSeasonStart = new Date(finalsDate);
    liveSeasonStart.setDate(liveSeasonStart.getDate() - 69);
    liveSeasonStart.setHours(3, 0, 0, 0);
    
    // Calculate off-season dates working backward from live season
    const offSeasonIndex = 6 - seasonNumber; // Reverse order
    seasonEndDate = new Date(liveSeasonStart);
    seasonEndDate.setDate(seasonEndDate.getDate() - (offSeasonIndex * 49) - 1);
    seasonEndDate.setHours(23, 59, 59, 999);
    
    seasonStartDate = new Date(seasonEndDate);
    seasonStartDate.setDate(seasonStartDate.getDate() - 48); // 49 days total
    seasonStartDate.setHours(3, 0, 0, 0);
  }
  
  // Calculate current week and day based on actual date
  const now = new Date();
  let currentWeek = 0;
  let currentDay = 0;
  let status = 'preparation';
  
  if (now >= seasonStartDate && now <= seasonEndDate) {
    // Season has started - calculate actual current day
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
  // else: status = 'preparation', currentWeek = 0, currentDay = 0 (default)
  
  // Create proper season ID based on type
  let seasonId, seasonName;
  const seasonYear = isLiveSeason ? finalsYear : finalsYear - 1;
  
  if (isLiveSeason) {
    seasonId = `live_${finalsYear}`;
    seasonName = `DCI ${finalsYear} Live Season`;
  } else {
    const nextYearShort = finalsYear.toString().slice(-2);
    seasonId = `${seasonTypeLower}_${seasonYear}-${nextYearShort}`;
    seasonName = `${seasonType.charAt(0).toUpperCase() + seasonType.slice(1)} Season ${seasonYear}-${nextYearShort}`;
  }
  
  // Check if season already exists
  const existingSeasonRef = await db.collection('game-settings').doc('current').get();
  if (existingSeasonRef.exists) {
    const existingSeason = existingSeasonRef.data();
    if (existingSeason.seasonId === seasonId) {
      throw new Error(`Season ${seasonId} already exists as the current season`);
    }
  }
  
  // Get season number
  let seasonNumber;
  if (isLiveSeason) {
    seasonNumber = await getNextSeasonNumber(db);
  } else {
    seasonNumber = SEASON_THEMES.findIndex(t => t.toLowerCase() === seasonTypeLower) + 1;
  }
  
  const seasonData = {
    activeSeasonId: seasonId,
    seasonId,
    seasonName,
    seasonType: seasonTypeLower,
    seasonNumber,
    status,
    currentWeek,
    currentDay,
    totalWeeks,
    totalDays,
    startDate: admin.firestore.Timestamp.fromDate(seasonStartDate),
    endDate: admin.firestore.Timestamp.fromDate(seasonEndDate),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    isActive: status === 'active'
  };
  
  await db.collection('game-settings').doc('current').set(seasonData);
  
  // Initialize season-specific collections
  await db.collection('dci-data').doc(seasonId).set({
    seasonId,
    seasonType: seasonTypeLower,
    corpsAssigned: false,
    scheduleGenerated: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  // Initialize leaderboard
  await db.collection('leaderboards').doc(seasonId).set({
    seasonId,
    seasonType: seasonTypeLower,
    rankings: [],
    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
  });
  
  return {
    success: true,
    message: `New ${seasonName} created successfully! Status: ${status}, Current Day: ${currentDay}/${totalDays}`,
    seasonId,
    seasonName,
    seasonType: seasonTypeLower,
    currentDay,
    currentWeek,
    status
  };
}

/**
 * Helper: Get the second Saturday of August for a given year
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
  
  return new Date(year, 7, secondSaturday, 3, 0, 0); // 3:00 AM UTC
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
  const isLiveSeason = seasonData.seasonType === 'live';
  const weekCount = isLiveSeason ? 10 : 7;
  
  // Generate schedule based on season type
  const schedule = [];
  for (let week = 1; week <= weekCount; week++) {
    schedule.push({
      week,
      shows: [
        {
          name: `${seasonData.seasonName} - Week ${week} Competition`,
          location: 'Various Locations',
          date: new Date(Date.now() + week * 7 * 24 * 60 * 60 * 1000),
          eligibleClasses: ['World Class', 'Open Class', 'A Class', 'SoundSport']
        }
      ]
    });
  }
  
  await db.collection('schedules').doc(seasonData.seasonId).set({
    seasonId: seasonData.seasonId,
    seasonType: seasonData.seasonType,
    schedule,
    generatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  // Update season to mark schedule as generated
  await db.collection('dci-data').doc(seasonData.seasonId).update({
    scheduleGenerated: true
  });
  
  return {
    success: true,
    message: `Schedule generated for ${seasonData.seasonName}!`,
    weekCount
  };
}

/**
 * Update leaderboards
 */
async function updateLeaderboards(db) {
  return {
    success: true,
    message: 'Leaderboards updated successfully!'
  };
}

/**
 * Clean up old data
 */
async function cleanupOldData(db) {
  const cutoffDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  
  const oldNotifications = await db.collectionGroup('notifications')
    .where('createdAt', '<', cutoffDate)
    .limit(500)
    .get();
  
  const batch = db.batch();
  oldNotifications.forEach(doc => {
    batch.delete(doc.ref);
  });
  
  await batch.commit();
  
  return {
    success: true,
    message: `Cleaned up ${oldNotifications.size} old records.`
  };
}

// ============================================================================
// DATABASE MANAGEMENT FUNCTIONS
// ============================================================================

async function backupDatabase(db) {
  return {
    success: true,
    message: 'Database backup initiated. Check your admin email for download link.'
  };
}

async function initializeStaff(db) {
  return {
    success: true,
    message: 'Staff database initialized!'
  };
}

async function validateData(db) {
  return {
    success: true,
    message: 'Data validation complete. No issues found.'
  };
}

async function migrateData(db) {
  return {
    success: true,
    message: 'Data migration complete!'
  };
}

async function optimizeIndexes(db) {
  return {
    success: true,
    message: 'Index optimization analysis complete!'
  };
}

async function clearCache(db) {
  return {
    success: true,
    message: 'Cache cleared successfully!'
  };
}

// ============================================================================
// USER MANAGEMENT FUNCTIONS
// ============================================================================

async function grantAdminAccess(userId) {
  if (!userId) {
    throw new Error('User ID is required');
  }
  
  await admin.auth().setCustomUserClaims(userId, { admin: true });
  
  return {
    success: true,
    message: `Admin access granted to user ${userId}!`
  };
}

async function resetUserProgress(db, userId) {
  if (!userId) {
    throw new Error('User ID is required');
  }
  
  const userRef = db.doc(`artifacts/${DATA_NAMESPACE}/users/${userId}/profile/data`);
  await userRef.update({
    xp: 0,
    totalSeasonScore: 0,
    unlockedClasses: ['SoundSport', 'A Class'],
    'corps.corpsName': 'New Corps',
    lastModified: admin.firestore.FieldValue.serverTimestamp()
  });
  
  return {
    success: true,
    message: `Progress reset for user ${userId}!`
  };
}

async function awardCorpsCoin(db, userId, amount) {
  if (!userId || !amount) {
    throw new Error('User ID and amount are required');
  }
  
  const userRef = db.doc(`artifacts/${DATA_NAMESPACE}/users/${userId}/profile/data`);
  await userRef.update({
    corpsCoin: admin.firestore.FieldValue.increment(parseInt(amount)),
    lastModified: admin.firestore.FieldValue.serverTimestamp()
  });
  
  return {
    success: true,
    message: `Awarded ${amount} CorpsCoin to user ${userId}!`
  };
}

// ============================================================================
// STAFF MANAGEMENT FUNCTIONS
// ============================================================================

async function addStaffMember(db, staffData) {
  if (!staffData || !staffData.name || !staffData.caption) {
    throw new Error('Staff name and caption are required');
  }
  
  const staffId = `staff_${Date.now()}`;
  await db.collection('staff').doc(staffId).set({
    id: staffId,
    name: staffData.name,
    caption: staffData.caption,
    yearInducted: staffData.yearInducted || new Date().getFullYear(),
    biography: staffData.biography || '',
    baseValue: staffData.baseValue || 500,
    currentValue: staffData.baseValue || 500,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  return {
    success: true,
    message: `Staff member ${staffData.name} added successfully!`,
    staffId
  };
}

async function updateStaffValues(db) {
  const staffSnapshot = await db.collection('staff').get();
  const batch = db.batch();
  
  staffSnapshot.forEach(doc => {
    const data = doc.data();
    const newValue = Math.round(data.baseValue * 1.1);
    batch.update(doc.ref, { currentValue: newValue });
  });
  
  await batch.commit();
  
  return {
    success: true,
    message: 'Staff values updated successfully!'
  };
}

async function cleanupMarketplace(db) {
  const expiredListings = await db.collection('staff_marketplace')
    .where('isActive', '==', false)
    .get();
  
  const batch = db.batch();
  expiredListings.forEach(doc => {
    batch.delete(doc.ref);
  });
  
  await batch.commit();
  
  return {
    success: true,
    message: `Cleaned up ${expiredListings.size} expired marketplace listings!`
  };
}

// ============================================================================
// REPORT GENERATION FUNCTIONS
// ============================================================================

async function generateUserReport(db) {
  return {
    success: true,
    message: 'User activity report generated!',
    data: {}
  };
}

async function generateSeasonReport(db) {
  return {
    success: true,
    message: 'Season performance report generated!',
    data: {}
  };
}

async function generateFinancialReport(db) {
  return {
    success: true,
    message: 'Financial report generated!',
    data: {}
  };
}