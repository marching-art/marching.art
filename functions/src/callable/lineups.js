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
const REQUIRED_CAPTIONS = GAME_CONFIG.REQUIRED_CAPTIONS || [
  "GE1", "GE2", "Visual Proficiency", "Visual Analysis",
  "Color Guard", "Brass", "Music Analysis", "Percussion"
];

// Class-based point limits (from game configuration)
const CLASS_POINT_LIMITS = GAME_CONFIG.CLASS_POINT_LIMITS || {
  "SoundSport": 90,
  "A Class": 60,
  "Open Class": 120,
  "World Class": 150,
};

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
 * Get available corps for season with point values
 * Fixed version with proper error handling
 */
exports.getAvailableCorps = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  }

  try {
    // Get current season from game-settings/current
    const gameSettingsRef = admin.firestore().collection('game-settings').doc('current');
    const gameSettings = await gameSettingsRef.get();
    
    if (!gameSettings.exists) {
      // Return empty data if no active season
      return {
        success: true,
        seasonId: null,
        corps: [],
        pointLimits: CLASS_POINT_LIMITS,
        requiredCaptions: REQUIRED_CAPTIONS,
        message: 'No active season configured'
      };
    }

    const settingsData = gameSettings.data();
    
    // Try multiple possible field names for season ID
    const seasonId = settingsData.activeSeasonId || 
                     settingsData.currentSeasonId || 
                     settingsData.seasonId ||
                     '2024'; // Fallback to 2024 season

    // Get season corps data
    const seasonCorpsRef = admin.firestore().collection('dci-data').doc(seasonId);
    const seasonCorpsDoc = await seasonCorpsRef.get();
    
    if (!seasonCorpsDoc.exists) {
      // Try fallback to 2024 season data
      const fallbackRef = admin.firestore().collection('dci-data').doc('2024');
      const fallbackDoc = await fallbackRef.get();
      
      if (fallbackDoc.exists) {
        const corpsData = fallbackDoc.data().corps || [];
        
        // Ensure each corps has required fields
        const validatedCorps = corpsData.map(corps => ({
          name: corps.name || 'Unknown Corps',
          value: corps.value || corps.points || 10,
          class: corps.class || 'Open Class',
          location: corps.location || 'USA'
        }));
        
        return {
          success: true,
          seasonId: '2024',
          corps: validatedCorps,
          pointLimits: CLASS_POINT_LIMITS,
          requiredCaptions: REQUIRED_CAPTIONS,
          message: 'Using 2024 season data'
        };
      }
      
      // If no data exists, return sample data for development
      return {
        success: true,
        seasonId: 'sample',
        corps: generateSampleCorps(),
        pointLimits: CLASS_POINT_LIMITS,
        requiredCaptions: REQUIRED_CAPTIONS,
        message: 'Using sample data - no season data found'
      };
    }

    const corpsData = seasonCorpsDoc.data().corps || [];
    
    // Validate and normalize corps data
    const validatedCorps = corpsData.map(corps => ({
      name: corps.name || 'Unknown Corps',
      value: corps.value || corps.points || 10,
      class: corps.class || 'Open Class',
      location: corps.location || 'USA'
    }));

    return {
      success: true,
      seasonId: seasonId,
      corps: validatedCorps,
      pointLimits: CLASS_POINT_LIMITS,
      requiredCaptions: REQUIRED_CAPTIONS
    };

  } catch (error) {
    functions.logger.error('Error getting available corps:', error);
    
    // Return sample data on error to keep app functional
    return {
      success: true,
      seasonId: 'sample',
      corps: generateSampleCorps(),
      pointLimits: CLASS_POINT_LIMITS,
      requiredCaptions: REQUIRED_CAPTIONS,
      error: 'Failed to fetch live data, using sample corps'
    };
  }
});

/**
 * Generate sample corps data for development/fallback
 */
function generateSampleCorps() {
  return [
    // World Class
    { name: "Blue Devils", value: 50, class: "World Class", location: "Concord, CA" },
    { name: "Carolina Crown", value: 48, class: "World Class", location: "Fort Mill, SC" },
    { name: "The Cadets", value: 46, class: "World Class", location: "Allentown, PA" },
    { name: "Bluecoats", value: 47, class: "World Class", location: "Canton, OH" },
    { name: "Santa Clara Vanguard", value: 49, class: "World Class", location: "Santa Clara, CA" },
    { name: "Boston Crusaders", value: 45, class: "World Class", location: "Boston, MA" },
    { name: "The Cavaliers", value: 44, class: "World Class", location: "Rosemont, IL" },
    { name: "Blue Knights", value: 42, class: "World Class", location: "Denver, CO" },
    { name: "Phantom Regiment", value: 43, class: "World Class", location: "Rockford, IL" },
    { name: "Madison Scouts", value: 40, class: "World Class", location: "Madison, WI" },
    
    // Open Class
    { name: "Spartans", value: 35, class: "Open Class", location: "Nashua, NH" },
    { name: "Vanguard Cadets", value: 34, class: "Open Class", location: "Santa Clara, CA" },
    { name: "Blue Devils B", value: 36, class: "Open Class", location: "Concord, CA" },
    { name: "Gold", value: 32, class: "Open Class", location: "San Diego, CA" },
    { name: "Louisiana Stars", value: 30, class: "Open Class", location: "Lafayette, LA" },
    { name: "Legends", value: 28, class: "Open Class", location: "Kalamazoo, MI" },
    
    // A Class
    { name: "Cincinnati Tradition", value: 20, class: "A Class", location: "Cincinnati, OH" },
    { name: "Colt Cadets", value: 18, class: "A Class", location: "Dubuque, IA" },
    { name: "Raiders", value: 15, class: "A Class", location: "Wayne, NJ" },
    
    // SoundSport
    { name: "Hometown Heroes", value: 10, class: "SoundSport", location: "Anytown, USA" },
    { name: "Street Beat", value: 8, class: "SoundSport", location: "Urban, USA" },
    { name: "Community Pride", value: 12, class: "SoundSport", location: "Smallville, USA" }
  ];
}

/**
 * Enhanced lineup save with validation
 */
exports.validateAndSaveLineup = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  }

  const { seasonId, lineup, corpsClass } = data;
  const uid = context.auth.uid;

  try {
    // Get corps values for validation
    const seasonCorpsRef = admin.firestore().collection('dci-data').doc(seasonId || '2024');
    const seasonCorpsDoc = await seasonCorpsRef.get();
    
    let corpsValueMap = {};
    
    if (seasonCorpsDoc.exists) {
      const corpsData = seasonCorpsDoc.data().corps || [];
      corpsData.forEach(corps => {
        corpsValueMap[corps.name] = corps.value || corps.points || 10;
      });
    } else {
      // Use sample corps if no data exists
      const sampleCorps = generateSampleCorps();
      sampleCorps.forEach(corps => {
        corpsValueMap[corps.name] = corps.value;
      });
    }

    // Validate lineup
    const validationResult = validateLineup(lineup, corpsClass, corpsValueMap);
    
    if (!validationResult.isValid) {
      throw new functions.https.HttpsError('invalid-argument', validationResult.error);
    }

    // Save validated lineup
    const profileRef = admin.firestore().doc(`artifacts/${DATA_NAMESPACE}/users/${uid}/profile/data`);
    
    await profileRef.update({
      lineup: lineup,
      lineupPoints: validationResult.totalPoints,
      activeSeasonId: seasonId,
      "corps.lastEdit": admin.firestore.FieldValue.serverTimestamp(),
    });

    return { 
      success: true, 
      message: "Lineup saved successfully!",
      totalPoints: validationResult.totalPoints,
      pointsRemaining: CLASS_POINT_LIMITS[corpsClass] - validationResult.totalPoints
    };

  } catch (error) {
    if (error.code && error.code.startsWith('functions/')) {
      throw error;
    }
    functions.logger.error('Error saving lineup:', error);
    throw new functions.https.HttpsError('internal', 'Failed to save lineup');
  }
});

/**
 * Check if lineup is valid (without saving)
 */
exports.checkLineupValidity = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  }

  const { seasonId, lineup, corpsClass } = data;

  try {
    // Get corps values for validation
    const seasonCorpsRef = admin.firestore().collection('dci-data').doc(seasonId || '2024');
    const seasonCorpsDoc = await seasonCorpsRef.get();
    
    let corpsValueMap = {};
    
    if (seasonCorpsDoc.exists) {
      const corpsData = seasonCorpsDoc.data().corps || [];
      corpsData.forEach(corps => {
        corpsValueMap[corps.name] = corps.value || corps.points || 10;
      });
    } else {
      // Use sample corps if no data exists
      const sampleCorps = generateSampleCorps();
      sampleCorps.forEach(corps => {
        corpsValueMap[corps.name] = corps.value;
      });
    }

    const validationResult = validateLineup(lineup, corpsClass, corpsValueMap);

    return {
      isValid: validationResult.isValid,
      error: validationResult.error,
      totalPoints: validationResult.totalPoints,
      pointsRemaining: validationResult.isValid ? 
        CLASS_POINT_LIMITS[corpsClass] - validationResult.totalPoints : 0
    };

  } catch (error) {
    functions.logger.error('Error checking lineup validity:', error);
    return { isValid: false, error: 'Failed to validate lineup' };
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
      error: `Missing required captions: ${missingCaptions.join(', ')}`,
      totalPoints: 0
    };
  }

  // Check if corps class is valid
  if (!CLASS_POINT_LIMITS[corpsClass]) {
    return {
      isValid: false,
      error: 'Invalid corps class',
      totalPoints: 0
    };
  }

  // Calculate total points used
  let totalPoints = 0;
  const duplicateCorps = [];
  const usedCorps = new Set();

  for (const [caption, corpsName] of Object.entries(lineup)) {
    if (!corpsName) continue;
    
    // Check for duplicate corps
    if (usedCorps.has(corpsName)) {
      duplicateCorps.push(corpsName);
    } else {
      usedCorps.add(corpsName);
    }

    // Add corps value to total
    const corpsValue = corpsValueMap[corpsName];
    if (corpsValue) {
      totalPoints += corpsValue;
    } else {
      // If corps not found, use default value of 10
      totalPoints += 10;
    }
  }

  // Check for duplicate corps
  if (duplicateCorps.length > 0) {
    return {
      isValid: false,
      error: `Duplicate corps selected: ${duplicateCorps.join(', ')}. Each corps can only be used once.`,
      totalPoints: totalPoints
    };
  }

  // Check if within point limit
  const pointLimit = CLASS_POINT_LIMITS[corpsClass];
  if (totalPoints > pointLimit) {
    return {
      isValid: false,
      error: `Total points (${totalPoints}) exceeds class limit (${pointLimit})`,
      totalPoints: totalPoints
    };
  }

  return {
    isValid: true,
    totalPoints: totalPoints,
    error: null
  };
}

module.exports = {
  saveLineup: exports.saveLineup,
  getAvailableCorps: exports.getAvailableCorps,
  validateAndSaveLineup: exports.validateAndSaveLineup,
  checkLineupValidity: exports.checkLineupValidity
};