/**
 * marching.art Lineup Management System - COMPLETE VALIDATED VERSION
 * Location: functions/src/callable/lineups.js
 * 
 * Handles all lineup validation and saving with full DCI compliance:
 * - All 8 captions must be filled
 * - No duplicate corps allowed
 * - Class-based point limits enforced
 * - Real-time corps value calculation
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { DATA_NAMESPACE, getFunctionConfig } = require('../../config');

// DCI Caption requirements - all 8 captions must be filled
const REQUIRED_CAPTIONS = [
  "GE1", "GE2", "Visual Proficiency", "Visual Analysis",
  "Color Guard", "Brass", "Music Analysis", "Percussion"
];

// Class-based point limits
const CLASS_POINT_LIMITS = {
  "SoundSport": 90,
  "A Class": 60,
  "Open Class": 120,
  "World Class": 150,
};

// Caption abbreviations for scoring
const CAPTION_ABBREVIATIONS = {
  "GE1": "GE1",
  "GE2": "GE2",
  "Visual Proficiency": "VP",
  "Visual Analysis": "VA",
  "Color Guard": "CG",
  "Brass": "B",
  "Music Analysis": "MA",
  "Percussion": "P"
};

/**
 * Validates lineup against all game rules
 * FIXED: Uses correct database structure
 */
async function validateLineup(lineup, corpsClass, seasonId, db) {
  const errors = [];
  
  // 1. Check all captions are present
  for (const caption of REQUIRED_CAPTIONS) {
    if (!lineup[caption]) {
      errors.push(`Caption "${caption}" must be filled.`);
    }
  }
  
  if (errors.length > 0) {
    return { valid: false, errors };
  }
  
  // 2. Check for duplicate corps
  const usedCorps = new Set();
  const corpsNames = Object.values(lineup);
  
  for (const corpsName of corpsNames) {
    if (corpsName) {
      if (usedCorps.has(corpsName)) {
        errors.push(`Duplicate corps selected: "${corpsName}". Each corps can only be used once.`);
      }
      usedCorps.add(corpsName);
    }
  }
  
  if (errors.length > 0) {
    return { valid: false, errors };
  }
  
  // 3. Get corps data for the season from dci-data collection
  const dciDataRef = db.collection('dci-data').doc(seasonId);
  const dciDataSnap = await dciDataRef.get();
  
  if (!dciDataSnap.exists()) {
    return { 
      valid: false, 
      errors: [`Season data not found for ${seasonId}. Please contact support.`] 
    };
  }
  
  const dciData = dciDataSnap.data();
  const corpsArray = dciData.corps || [];
  
  // Create a lookup map: corps name -> corps data
  const corpsLookup = {};
  corpsArray.forEach(corps => {
    const name = corps.name || corps.corpsName;
    corpsLookup[name] = corps;
  });
  
  // 4. Calculate total points and validate corps existence
  let totalPoints = 0;
  const lineupDetails = {};
  
  for (const [caption, corpsName] of Object.entries(lineup)) {
    const corps = corpsLookup[corpsName];
    
    if (!corps) {
      errors.push(`Corps "${corpsName}" not found in season ${seasonId}.`);
      continue;
    }
    
    const corpsValue = corps.value || corps.pointCost || 0;
    totalPoints += corpsValue;
    
    lineupDetails[caption] = {
      corps: corpsName,
      value: corpsValue,
      rank: corps.rank,
      sourceYear: corps.sourceYear
    };
  }
  
  if (errors.length > 0) {
    return { valid: false, errors };
  }
  
  // 5. Check point limit for class
  const pointLimit = CLASS_POINT_LIMITS[corpsClass];
  
  if (!pointLimit) {
    return { 
      valid: false, 
      errors: [`Invalid corps class: ${corpsClass}`] 
    };
  }
  
  if (totalPoints > pointLimit) {
    errors.push(
      `Total lineup value (${totalPoints} points) exceeds ${corpsClass} limit of ${pointLimit} points. ` +
      `Please remove ${totalPoints - pointLimit} points.`
    );
  }
  
  if (errors.length > 0) {
    return { valid: false, errors };
  }
  
  // All validations passed
  return { 
    valid: true, 
    totalPoints, 
    lineupDetails,
    pointLimit,
    pointsRemaining: pointLimit - totalPoints
  };
}

/**
 * MAIN FUNCTION: Validate and Save Lineup
 */
exports.validateAndSaveLineup = functions
  .runWith(getFunctionConfig('light'))
  .https.onCall(async (data, context) => {
    // Authentication check
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated', 
        'You must be logged in to save a lineup.'
      );
    }

    const { seasonId, lineup } = data;
    const uid = context.auth.uid;

    // Basic input validation
    if (!seasonId || !lineup) {
      throw new functions.https.HttpsError(
        'invalid-argument', 
        'Season ID and lineup are required.'
      );
    }

    if (typeof lineup !== 'object' || Object.keys(lineup).length !== 8) {
      throw new functions.https.HttpsError(
        'invalid-argument', 
        'Lineup must contain exactly 8 captions.'
      );
    }

    const db = admin.firestore();
    const profileRef = db.doc(`artifacts/${DATA_NAMESPACE}/users/${uid}/profile/data`);

    try {
      // Get user profile
      const profileSnap = await profileRef.get();
      
      if (!profileSnap.exists()) {
        throw new functions.https.HttpsError(
          'not-found', 
          'User profile not found.'
        );
      }

      const profile = profileSnap.data();
      const corpsClass = profile.corps?.corpsClass || 'SoundSport';

      // Perform comprehensive validation
      const validation = await validateLineup(lineup, corpsClass, seasonId, db);

      if (!validation.valid) {
        throw new functions.https.HttpsError(
          'invalid-argument', 
          validation.errors.join(' ')
        );
      }

      // Save the validated lineup
      await profileRef.update({
        lineup: lineup,
        lineupDetails: validation.lineupDetails,
        activeSeasonId: seasonId,
        'corps.totalPoints': validation.totalPoints,
        'corps.pointsRemaining': validation.pointsRemaining,
        'corps.lastEdit': admin.firestore.FieldValue.serverTimestamp(),
      });

      // Log successful lineup save
      functions.logger.info(`Lineup saved for user ${uid}:`, {
        seasonId,
        totalPoints: validation.totalPoints,
        corpsClass
      });

      return { 
        success: true, 
        message: 'Lineup saved successfully!',
        totalPoints: validation.totalPoints,
        pointLimit: validation.pointLimit,
        pointsRemaining: validation.pointsRemaining,
        lineupDetails: validation.lineupDetails
      };

    } catch (error) {
      functions.logger.error('Error saving lineup:', error);
      
      // Re-throw HttpsErrors
      if (error.code && error.code.startsWith('functions/')) {
        throw error;
      }
      
      // Generic error
      throw new functions.https.HttpsError(
        'internal', 
        'An error occurred while saving your lineup. Please try again.'
      );
    }
  });

/**
 * LEGACY FUNCTION: Basic lineup save (maintained for backward compatibility)
 * @deprecated Use validateAndSaveLineup instead
 */
exports.saveLineup = functions
  .runWith(getFunctionConfig('light'))
  .https.onCall(async (data, context) => {
    functions.logger.warn('saveLineup called - deprecated, redirecting to validateAndSaveLineup');
    return exports.validateAndSaveLineup.run(data, context);
  });

/**
 * Get available corps for current season with their values
 * FIXED: Uses correct database collection structure from existing code
 */
exports.getAvailableCorps = functions
  .runWith(getFunctionConfig('light'))
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    }

    const { seasonId } = data;

    if (!seasonId) {
      throw new functions.https.HttpsError('invalid-argument', 'Season ID required.');
    }

    try {
      const db = admin.firestore();
      
      // CRITICAL: Use dci-data collection (with hyphen, not underscore)
      const dciDataRef = db.collection('dci-data').doc(seasonId);
      const dciDataSnap = await dciDataRef.get();

      if (!dciDataSnap.exists()) {
        functions.logger.error(`dci-data document not found for season: ${seasonId}`);
        
        throw new functions.https.HttpsError(
          'not-found', 
          `Season data not found. Season may not be initialized yet.`
        );
      }

      const dciData = dciDataSnap.data();
      
      // CRITICAL: Corps data is in the 'corps' field as an array of objects
      const corpsArray = dciData.corps || [];

      // Validate that we have corps data
      if (!corpsArray || corpsArray.length === 0) {
        throw new functions.https.HttpsError(
          'not-found',
          'No corps data available for this season.'
        );
      }

      // Transform to expected format: array of { name, value }
      // Corps objects have structure: { name, corpsName, value, pointCost, rank, sourceYear }
      const sortedCorps = corpsArray
        .map(corps => ({
          name: corps.name || corps.corpsName,
          value: corps.value || corps.pointCost || 0,
          rank: corps.rank,
          sourceYear: corps.sourceYear
        }))
        .sort((a, b) => b.value - a.value);

      functions.logger.info(`Retrieved ${sortedCorps.length} corps for season ${seasonId}`);

      return {
        success: true,
        corps: sortedCorps,
        seasonId,
        count: sortedCorps.length
      };

    } catch (error) {
      functions.logger.error('Error fetching available corps:', error);
      
      if (error.code && error.code.startsWith('functions/')) {
        throw error;
      }
      
      throw new functions.https.HttpsError(
        'internal', 
        'Failed to fetch corps data: ' + error.message
      );
    }
  });

/**
 * Validate lineup without saving (for preview)
 */
exports.validateLineupPreview = functions
  .runWith(getFunctionConfig('light'))
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    }

    const { seasonId, lineup, corpsClass } = data;

    if (!seasonId || !lineup || !corpsClass) {
      throw new functions.https.HttpsError(
        'invalid-argument', 
        'Season ID, lineup, and corps class are required.'
      );
    }

    try {
      const db = admin.firestore();
      const validation = await validateLineup(lineup, corpsClass, seasonId, db);

      return {
        ...validation,
        success: validation.valid
      };

    } catch (error) {
      functions.logger.error('Error validating lineup preview:', error);
      throw new functions.https.HttpsError('internal', 'Validation failed.');
    }
  });