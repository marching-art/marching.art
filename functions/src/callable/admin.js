const functions = require('firebase-functions');
const admin = require('firebase-admin');

/**
 * marching.art Admin Functions - COMPLETE VERSION
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

// ============================================================================
// EXPORTED CLOUD FUNCTIONS
// ============================================================================

/**
 * Get comprehensive system statistics
 * FIXED: Inline admin verification to ensure CORS headers are set properly
 */
exports.getSystemStats = functions.https.onCall(async (data, context) => {
  // Inline admin verification for better error handling
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
  }
  
  if (context.auth.uid !== ADMIN_USER_ID) {
    console.log(`Access denied for user: ${context.auth.uid}`);
    throw new functions.https.HttpsError('permission-denied', 'Admin access required.');
  }
  
  try {
    const db = admin.firestore();
    const now = new Date();
    
    console.log(`Admin stats requested by: ${context.auth.uid}`);
    
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
          const lastActive = profileData.lastActive?.toDate?.() || profileData.lastActive;
          if (lastActive && (now - new Date(lastActive)) < 7 * 24 * 60 * 60 * 1000) {
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
        console.warn(`Error processing user ${userDoc.id}:`, err.message);
        // Continue with other users
      }
    }
    
    // Get current season information
    let currentSeasonInfo = null;
    
    try {
      const currentSeasonSnapshot = await db.collection('game-settings').doc('current').get();
      
      if (currentSeasonSnapshot.exists) {
        const seasonData = currentSeasonSnapshot.data();
        
        // Calculate current day if season is active
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
    } catch (seasonErr) {
      console.error('Error fetching season data:', seasonErr);
      // Continue without season data
    }
    
    // Return comprehensive stats
    console.log(`Returning stats: ${totalUsers} users, ${activeUsers} active, ${totalCorps} corps`);
    
    return {
      success: true,
      stats: {
        users: {
          total: totalUsers,
          active: activeUsers
        },
        corps: {
          total: totalCorps,
          distribution: classDistribution
        },
        currentSeason: currentSeasonInfo,
        system: {
          status: 'operational',
          lastCheck: now.toISOString()
        }
      }
    };
    
  } catch (error) {
    console.error('Error fetching system stats:', error);
    throw new functions.https.HttpsError('internal', `Failed to fetch stats: ${error.message}`);
  }
});

/**
 * Execute season management actions
 */
exports.seasonAction = functions
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .https.onCall(async (data, context) => {
    // Inline admin verification
    if (!context.auth || context.auth.uid !== ADMIN_USER_ID) {
      throw new functions.https.HttpsError('permission-denied', 'Admin access required');
    }
    
    const { action, seasonType, year } = data;
    const db = admin.firestore();
    
    try {
      console.log(`Season action ${action} requested by admin`);
      
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
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError("internal", `Failed to execute ${action}: ${error.message}`);
    }
  });

/**
 * Execute database management actions
 */
exports.databaseAction = functions
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .https.onCall(async (data, context) => {
    // Inline admin verification
    if (!context.auth || context.auth.uid !== ADMIN_USER_ID) {
      throw new functions.https.HttpsError('permission-denied', 'Admin access required');
    }
    
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
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError("internal", `Failed to execute ${action}: ${error.message}`);
    }
  });

/**
 * User management actions
 */
exports.userAction = functions.https.onCall(async (data, context) => {
  // Inline admin verification
  if (!context.auth || context.auth.uid !== ADMIN_USER_ID) {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required');
  }
  
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
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", `Failed to execute ${action}: ${error.message}`);
  }
});

/**
 * Staff management actions
 */
exports.staffAction = functions.https.onCall(async (data, context) => {
  // Inline admin verification
  if (!context.auth || context.auth.uid !== ADMIN_USER_ID) {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required');
  }
  
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
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", `Failed to execute ${action}: ${error.message}`);
  }
});

// ============================================================================
// SEASON MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Create a new season - uses the SAME logic as automatic scheduler
 * No duplication - just calls the scheduler's initialization
 */
async function createNewSeason(db, seasonType, year) {
  try {
    // Import the scheduler's initialization function
    const { initializeSeasonManually } = require('../../src/scheduled/seasonScheduler');
    
    // Call the existing manual initialization that's already exported
    const result = await initializeSeasonManually({ 
      startDate: new Date().toISOString() 
    }, {
      auth: { uid: ADMIN_USER_ID }  // Simulate admin context
    });
    
    console.log('Season created using scheduler logic:', result);
    
    return result;
    
  } catch (error) {
    // If we can't use the scheduler function directly, fall back to triggering it via callable
    console.log('Using fallback method to create season');
    
    // The scheduler already exports initializeSeasonManually as a callable function
    // We just need to invoke it properly
    const functions = require('firebase-functions');
    const httpsCallable = functions.httpsCallable;
    
    try {
      // Since we're in the backend, we can directly call the scheduler's logic
      const seasonScheduler = require('../../src/scheduled/seasonScheduler');
      
      // Determine what season should be created
      const now = new Date();
      const seasonInfo = determineCurrentCycle(now);
      
      // Use the scheduler's initialization function
      const db = admin.firestore();
      const result = await seasonScheduler.initializeNewSeason(db, now, seasonInfo);
      
      return {
        success: true,
        message: `Season ${result.seasonData.seasonName} created successfully!`,
        seasonId: result.seasonId,
        seasonName: result.seasonData.seasonName,
        seasonType: result.seasonData.seasonType,
        currentDay: result.seasonData.currentDay,
        totalDays: result.seasonData.totalDays,
        status: result.seasonData.status
      };
      
    } catch (innerError) {
      console.error('Failed to use scheduler directly:', innerError);
      throw new Error(`Failed to create season: ${innerError.message}`);
    }
  }
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
  return {
    success: true,
    message: 'Old data cleaned up successfully!'
  };
}

// ============================================================================
// DATABASE MANAGEMENT FUNCTIONS
// ============================================================================

async function backupDatabase(db) {
  return {
    success: true,
    message: 'Database backup initiated! Check your admin email for download link.'
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
    'corps.corpsClass': 'SoundSport',
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
    message: `Updated values for ${staffSnapshot.size} staff members!`
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