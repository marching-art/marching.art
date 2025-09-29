const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { 
  DATA_NAMESPACE, 
  GAME_CONFIG, 
  DCI_SCORING_SYSTEM,
  SECURITY_CONFIG,
  getFunctionConfig 
} = require('../../config');

/**
 * Enhanced Lineup Management System
 * Combines original lineup saving with advanced validation and DCI compliance
 * Ensures users select lineups within point limits and follow DCI rules
 */

// DCI Caption requirements - all 8 captions must be filled
const REQUIRED_CAPTIONS = GAME_CONFIG.REQUIRED_CAPTIONS;

// Class-based point limits (from game configuration)
const CLASS_POINT_LIMITS = GAME_CONFIG.CLASS_POINT_LIMITS;

/**
 * LEGACY FUNCTION: Basic lineup save (maintained for backward compatibility)
 * @deprecated Use validateAndSaveLineup instead for full validation
 */
exports.saveLineup = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "You must be logged in.");
  }

  const { seasonId, lineup } = data;
  const uid = context.auth.uid;

  // Basic validation for legacy compatibility
  if (!seasonId || !lineup || Object.keys(lineup).length !== 8) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid data provided.");
  }

  const profileRef = admin.firestore().doc(`artifacts/${DATA_NAMESPACE}/users/${uid}/profile/data`);
  
  try {
    await profileRef.update({
      lineup: lineup,
      activeSeasonId: seasonId,
      "corps.lastEdit": admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true, message: "Lineup saved successfully!" };
  } catch (error) {
    console.error("Error updating lineup for user:", uid, error);
    throw new functions.https.HttpsError("internal", "An error occurred while saving.");
  }
});

/**
 * ENHANCED FUNCTION: Validate and save user lineup with full DCI compliance
 */
exports.validateAndSaveLineup = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  }

  const { lineup, corpsClass, seasonId } = data;
  const userId = context.auth.uid;

  try {
    // Get current season data if seasonId not provided
    let currentSeasonId = seasonId;
    if (!currentSeasonId) {
      const gameSettingsRef = admin.firestore().collection('game-settings').doc('current');
      const gameSettings = await gameSettingsRef.get();
      
      if (!gameSettings.exists) {
        throw new functions.https.HttpsError('failed-precondition', 'No active season found');
      }
      
      currentSeasonId = gameSettings.data().currentSeasonId;
    }

    // Get available corps for this season
    const seasonCorpsRef = admin.firestore().collection('dci-data').doc(currentSeasonId);
    const seasonCorpsDoc = await seasonCorpsRef.get();
    
    if (!seasonCorpsDoc.exists) {
      throw new functions.https.HttpsError('failed-precondition', 'Season corps data not found');
    }

    const availableCorps = seasonCorpsDoc.data().corps;
    const corpsValueMap = {};
    
    availableCorps.forEach(corps => {
      corpsValueMap[corps.name] = corps.value;
    });

    // Validate lineup
    const validationResult = validateLineup(lineup, corpsClass, corpsValueMap);
    
    if (!validationResult.isValid) {
      throw new functions.https.HttpsError('invalid-argument', validationResult.error);
    }

    // Check for duplicate corps selections across all users
    const duplicateCheck = await checkForDuplicateLineups(lineup, userId, currentSeasonId);
    
    if (!duplicateCheck.isValid) {
      throw new functions.https.HttpsError('invalid-argument', duplicateCheck.error);
    }

    // Save validated lineup
    const userRef = admin.firestore().doc(`artifacts/${DATA_NAMESPACE}/users/${userId}/profile/data`);
    
    await userRef.update({
      lineup: lineup,
      'corps.class': corpsClass,
      activeSeasonId: currentSeasonId,
      lastLineupUpdate: admin.firestore.FieldValue.serverTimestamp(),
      lineupPointsUsed: validationResult.totalPoints,
      // Maintain legacy compatibility
      "corps.lastEdit": admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      success: true,
      message: 'Lineup saved successfully',
      totalPoints: validationResult.totalPoints,
      pointsRemaining: CLASS_POINT_LIMITS[corpsClass] - validationResult.totalPoints
    };

  } catch (error) {
    functions.logger.error('Error validating lineup:', error);
    
    if (error.code) {
      throw error; // Re-throw HttpsError
    }
    
    throw new functions.https.HttpsError('internal', 'Failed to validate lineup');
  }
});

/**
 * Real-time lineup validation (no saving)
 */
exports.checkLineupValidity = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  }

  const { lineup, corpsClass } = data;

  try {
    // Get current season corps data
    const gameSettingsRef = admin.firestore().collection('game-settings').doc('current');
    const gameSettings = await gameSettingsRef.get();
    
    if (!gameSettings.exists) {
      return { isValid: false, error: 'No active season found' };
    }

    const seasonId = gameSettings.data().currentSeasonId;
    const seasonCorpsRef = admin.firestore().collection('dci-data').doc(seasonId);
    const seasonCorpsDoc = await seasonCorpsRef.get();
    
    if (!seasonCorpsDoc.exists) {
      return { isValid: false, error: 'Season corps data not found' };
    }

    const availableCorps = seasonCorpsDoc.data().corps;
    const corpsValueMap = {};
    
    availableCorps.forEach(corps => {
      corpsValueMap[corps.name] = corps.value;
    });

    // Validate lineup
    const validationResult = validateLineup(lineup, corpsClass, corpsValueMap);
    
    return {
      isValid: validationResult.isValid,
      error: validationResult.error || null,
      totalPoints: validationResult.totalPoints || 0,
      pointLimit: CLASS_POINT_LIMITS[corpsClass] || 0,
      pointsRemaining: validationResult.totalPoints ? 
        CLASS_POINT_LIMITS[corpsClass] - validationResult.totalPoints : 0
    };

  } catch (error) {
    functions.logger.error('Error checking lineup validity:', error);
    return { isValid: false, error: 'Failed to validate lineup' };
  }
});

/**
 * Get available corps for season with point values
 */
exports.getAvailableCorps = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  }

  try {
    // Get current season
    const gameSettingsRef = admin.firestore().collection('game-settings').doc('current');
    const gameSettings = await gameSettingsRef.get();
    
    if (!gameSettings.exists) {
      throw new functions.https.HttpsError('failed-precondition', 'No active season found');
    }

    const seasonId = gameSettings.data().currentSeasonId;

    // Get season corps
    const seasonCorpsRef = admin.firestore().collection('dci-data').doc(seasonId);
    const seasonCorpsDoc = await seasonCorpsRef.get();
    
    if (!seasonCorpsDoc.exists) {
      throw new functions.https.HttpsError('failed-precondition', 'Season corps data not found');
    }

    const corps = seasonCorpsDoc.data().corps;

    return {
      success: true,
      seasonId: seasonId,
      corps: corps,
      pointLimits: CLASS_POINT_LIMITS,
      requiredCaptions: REQUIRED_CAPTIONS
    };

  } catch (error) {
    functions.logger.error('Error getting available corps:', error);
    throw new functions.https.HttpsError('internal', 'Failed to get available corps');
  }
});

/**
 * VALIDATION HELPER FUNCTIONS
 */

/**
 * Validate lineup meets all DCI requirements
 */
function validateLineup(lineup, corpsClass, corpsValueMap) {
  // Check if all required captions are filled
  const missingCaptions = REQUIRED_CAPTIONS.filter(caption => !lineup[caption]);
  
  if (missingCaptions.length > 0) {
    return {
      isValid: false,
      error: `Missing required captions: ${missingCaptions.join(', ')}`
    };
  }

  // Check if corps class is valid
  if (!CLASS_POINT_LIMITS[corpsClass]) {
    return {
      isValid: false,
      error: 'Invalid corps class'
    };
  }

  // Calculate total points used
  let totalPoints = 0;
  const duplicateCorps = [];
  const usedCorps = new Set();

  for (const [caption, corpsName] of Object.entries(lineup)) {
    if (!REQUIRED_CAPTIONS.includes(caption)) {
      continue; // Skip non-required captions
    }

    // Check if corps exists in available corps
    if (!corpsValueMap[corpsName]) {
      return {
        isValid: false,
        error: `Corps "${corpsName}" not available this season`
      };
    }

    // Check for duplicate corps usage
    if (usedCorps.has(corpsName)) {
      duplicateCorps.push(corpsName);
    }
    usedCorps.add(corpsName);

    // Add corps value to total points
    totalPoints += corpsValueMap[corpsName];
  }

  // Check for duplicate corps
  if (duplicateCorps.length > 0) {
    return {
      isValid: false,
      error: `Duplicate corps not allowed: ${duplicateCorps.join(', ')}`
    };
  }

  // Check point limit
  const pointLimit = CLASS_POINT_LIMITS[corpsClass];
  if (totalPoints > pointLimit) {
    return {
      isValid: false,
      error: `Point total (${totalPoints}) exceeds ${corpsClass} limit (${pointLimit})`
    };
  }

  // Must use ALL points for competitive balance
  if (totalPoints < pointLimit) {
    return {
      isValid: false,
      error: `Must use all ${pointLimit} points. Currently using ${totalPoints}`
    };
  }

  return {
    isValid: true,
    totalPoints: totalPoints
  };
}

/**
 * Check if lineup conflicts with existing lineups
 */
async function checkForDuplicateLineups(lineup, userId, seasonId) {
  try {
    // Get all users with lineups for this season
    const usersSnapshot = await admin.firestore()
      .collectionGroup('data')
      .where('activeSeasonId', '==', seasonId)
      .where('lineup', '!=', null)
      .get();

    const lineupString = JSON.stringify(sortLineupForComparison(lineup));

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const otherUserId = userDoc.ref.parent.parent.id;
      
      // Skip own lineup
      if (otherUserId === userId) {
        continue;
      }

      if (userData.lineup) {
        const otherLineupString = JSON.stringify(sortLineupForComparison(userData.lineup));
        
        if (lineupString === otherLineupString) {
          return {
            isValid: false,
            error: 'This exact lineup combination is already taken by another user'
          };
        }
      }
    }

    return { isValid: true };

  } catch (error) {
    functions.logger.error('Error checking duplicate lineups:', error);
    return { isValid: true }; // Allow on error to prevent blocking
  }
}

/**
 * Sort lineup for consistent comparison
 */
function sortLineupForComparison(lineup) {
  const sorted = {};
  REQUIRED_CAPTIONS.sort().forEach(caption => {
    if (lineup[caption]) {
      sorted[caption] = lineup[caption];
    }
  });
  return sorted;
}

module.exports = {
  // Enhanced functions (primary)
  validateAndSaveLineup: exports.validateAndSaveLineup,
  checkLineupValidity: exports.checkLineupValidity,
  getAvailableCorps: exports.getAvailableCorps,
  
  // Legacy function (backward compatibility)
  saveLineup: exports.saveLineup
};