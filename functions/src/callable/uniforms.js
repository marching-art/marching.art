const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Import config from root of functions directory
const config = require('../../config');
const DATA_NAMESPACE = config.DATA_NAMESPACE;
const getFunctionConfig = config.getFunctionConfig;

/**
 * marching.art Uniform System Functions
 * Professional-grade uniform design with XP/CorpsCoin unlocking
 * Optimized for 10,000+ users with cost efficiency
 */

// Feature unlock requirements (XP thresholds and CorpsCoin alternatives)
const FEATURE_REQUIREMENTS = {
  gauntlets: { xp: 500, corpsCoin: 50 },
  epaulets: { xp: 750, corpsCoin: 100 },
  overlay: { xp: 1000, corpsCoin: 150 },
  piping: { xp: 1200, corpsCoin: 180 },
  sash: { xp: 1500, corpsCoin: 220 },
  braiding: { xp: 1800, corpsCoin: 250 },
  capelets: { xp: 2500, corpsCoin: 400 },
  premiumFabric: { xp: 3000, corpsCoin: 500 },
  metallic: { xp: 2000, corpsCoin: 300 },
  textureRibbed: { xp: 2500, corpsCoin: 400 },
  embroidery: { xp: 3500, corpsCoin: 600 },
  appliques: { xp: 4000, corpsCoin: 750 },
  ledLighting: { xp: 5000, corpsCoin: 1000 }
};

/**
 * Validate uniform object structure and data types
 */
function validateUniform(uniform) {
  if (!uniform || typeof uniform !== 'object') {
    throw new functions.https.HttpsError('invalid-argument', 'Valid uniform configuration required');
  }

  // Validate required sections exist
  const requiredSections = ['jacket', 'pants', 'shako'];
  for (const section of requiredSections) {
    if (!uniform[section] || typeof uniform[section] !== 'object') {
      throw new functions.https.HttpsError('invalid-argument', `Missing or invalid section: ${section}`);
    }
  }

  // Validate hex color format
  const hexColorRegex = /^#[0-9A-F]{6}$/i;
  const colorsToValidate = [
    { value: uniform.jacket?.baseColor, name: 'jacket base color' },
    { value: uniform.jacket?.trim1Color, name: 'jacket trim 1' },
    { value: uniform.jacket?.trim2Color, name: 'jacket trim 2' },
    { value: uniform.jacket?.buttonColor, name: 'jacket buttons' },
    { value: uniform.pants?.baseColor, name: 'pants base color' },
    { value: uniform.pants?.stripeColor, name: 'pants stripe' },
    { value: uniform.shako?.baseColor, name: 'shako base color' },
    { value: uniform.shako?.plumeColor, name: 'shako plume' },
    { value: uniform.shako?.badgeColor, name: 'shako badge' }
  ];

  for (const colorCheck of colorsToValidate) {
    if (colorCheck.value && !hexColorRegex.test(colorCheck.value)) {
      throw new functions.https.HttpsError(
        'invalid-argument', 
        `Invalid ${colorCheck.name} format: ${colorCheck.value}. Must be hex color (e.g., #FF0000)`
      );
    }
  }

  // Validate style options
  if (uniform.jacket?.frontStyle && !['doubleBreasted', 'singleBreasted', 'asymmetric', 'zippered'].includes(uniform.jacket.frontStyle)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid jacket front style');
  }

  const validPantsStyles = ['straight', 'tapered', 'boot-cut'];
  if (uniform.pants?.style && !validPantsStyles.includes(uniform.pants.style)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid pants style');
  }

  return true;
}

/**
 * Check if a feature is unlocked for the user (by XP or purchase)
 */
function isFeatureUnlocked(feature, userXP, purchasedFeatures) {
  const requirement = FEATURE_REQUIREMENTS[feature];
  if (!requirement) return true; // Base features are always unlocked

  // Check XP unlock
  if (userXP >= requirement.xp) return true;

  // Check if purchased with CorpsCoin
  if (purchasedFeatures && purchasedFeatures.includes(feature)) return true;

  return false;
}

/**
 * Update user's uniform configuration
 * Validates unlock requirements and saves to Firestore
 */
exports.updateUniform = functions
  .runWith(getFunctionConfig('light'))
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'You must be logged in');
    }

    const { uniform } = data;
    const uid = context.auth.uid;
    const logger = functions.logger;

    try {
      // Validate uniform structure
      validateUniform(uniform);

      const db = admin.firestore();
      const profileRef = db.doc(`artifacts/${DATA_NAMESPACE}/users/${uid}/profile/data`);
      
      // Get current profile to check unlock status
      const profileSnap = await profileRef.get();
      if (!profileSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'User profile not found');
      }

      const userProfile = profileSnap.data();
      const userXP = userProfile.xp || 0;
      const purchasedFeatures = userProfile.purchasedUniformFeatures || [];

      // Collect all features that need to be checked
      const enabledFeatures = [];
      
      // Check accessories
      if (uniform.accessories?.gauntlets?.enabled) enabledFeatures.push('gauntlets');
      if (uniform.accessories?.epaulets?.enabled) enabledFeatures.push('epaulets');
      if (uniform.accessories?.sash?.enabled) enabledFeatures.push('sash');
      if (uniform.accessories?.capelets?.enabled) enabledFeatures.push('capelets');
      
      // Check overlay
      if (uniform.overlay?.enabled) enabledFeatures.push('overlay');
      
      // Check embellishments
      if (uniform.embellishments?.piping?.enabled) enabledFeatures.push('piping');
      if (uniform.embellishments?.braiding?.enabled) enabledFeatures.push('braiding');
      if (uniform.embellishments?.embroidery?.enabled) enabledFeatures.push('embroidery');
      if (uniform.embellishments?.appliques?.enabled) enabledFeatures.push('appliques');
      
      // Check materials (premium features)
      if (uniform.materials?.jacket?.fabric && uniform.materials.jacket.fabric !== 'wool') {
        enabledFeatures.push('premiumFabric');
      }
      if (uniform.materials?.jacket?.finish && uniform.materials.jacket.finish !== 'matte') {
        enabledFeatures.push('metallic');
      }
      if (uniform.materials?.jacket?.texture && uniform.materials.jacket.texture !== 'smooth') {
        enabledFeatures.push('textureRibbed');
      }
      
      // Check LED lighting
      if (uniform.lighting?.enabled) enabledFeatures.push('ledLighting');

      // Validate all enabled features are unlocked
      for (const feature of enabledFeatures) {
        if (!isFeatureUnlocked(feature, userXP, purchasedFeatures)) {
          const req = FEATURE_REQUIREMENTS[feature];
          throw new functions.https.HttpsError(
            'permission-denied',
            `Feature "${feature}" requires ${req.xp} XP or ${req.corpsCoin} CorpsCoin to unlock`
          );
        }
      }

      // Save uniform to profile
      await profileRef.update({
        uniforms: uniform,
        'uniforms.lastUpdated': admin.firestore.FieldValue.serverTimestamp()
      });

      logger.info(`Uniform updated successfully for user: ${uid}`);

      return {
        success: true,
        message: 'Uniform saved successfully! 🎨'
      };

    } catch (error) {
      logger.error('Error updating uniform:', error);
      if (error.code && error.code.startsWith('functions/')) {
        throw error;
      }
      throw new functions.https.HttpsError('internal', 'Failed to update uniform');
    }
  });

/**
 * Purchase a uniform feature with CorpsCoin
 * Transaction-based to ensure atomicity and prevent double-spending
 */
exports.purchaseFeature = functions
  .runWith(getFunctionConfig('light'))
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'You must be logged in');
    }

    const { feature, cost } = data;
    const uid = context.auth.uid;
    const logger = functions.logger;

    // Validate feature exists
    if (!feature || !FEATURE_REQUIREMENTS[feature]) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid feature');
    }

    // Validate cost matches requirement
    const requirement = FEATURE_REQUIREMENTS[feature];
    if (cost !== requirement.corpsCoin) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid cost amount');
    }

    try {
      const db = admin.firestore();
      const profileRef = db.doc(`artifacts/${DATA_NAMESPACE}/users/${uid}/profile/data`);

      // Use transaction for atomicity
      const result = await db.runTransaction(async (transaction) => {
        const profileSnap = await transaction.get(profileRef);
        
        if (!profileSnap.exists) {
          throw new functions.https.HttpsError('not-found', 'User profile not found');
        }

        const userProfile = profileSnap.data();
        const currentCorpsCoin = userProfile.corpsCoin || 0;
        const purchasedFeatures = userProfile.purchasedUniformFeatures || [];
        const userXP = userProfile.xp || 0;

        // Check if already unlocked by XP
        if (userXP >= requirement.xp) {
          throw new functions.https.HttpsError(
            'failed-precondition',
            'Feature already unlocked by XP'
          );
        }

        // Check if already purchased
        if (purchasedFeatures.includes(feature)) {
          throw new functions.https.HttpsError(
            'already-exists',
            'Feature already purchased'
          );
        }

        // Check sufficient CorpsCoin
        if (currentCorpsCoin < cost) {
          throw new functions.https.HttpsError(
            'failed-precondition',
            `Insufficient CorpsCoin. Need ${cost}, have ${currentCorpsCoin}`
          );
        }

        // Deduct CorpsCoin and add feature to purchased list
        transaction.update(profileRef, {
          corpsCoin: admin.firestore.FieldValue.increment(-cost),
          purchasedUniformFeatures: admin.firestore.FieldValue.arrayUnion(feature),
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });

        // Log transaction for audit trail
        const transactionRef = db.collection(`corps_coin_transactions`).doc(`${uid}_${Date.now()}`);
        transaction.set(transactionRef, {
          userId: uid,
          type: 'uniform_feature_purchase',
          feature: feature,
          amount: -cost,
          balanceBefore: currentCorpsCoin,
          balanceAfter: currentCorpsCoin - cost,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          description: `Purchased uniform feature: ${feature}`
        });

        return {
          newBalance: currentCorpsCoin - cost,
          feature: feature
        };
      });

      logger.info(`User ${uid} purchased uniform feature: ${feature} for ${cost} CorpsCoin`);

      return {
        success: true,
        message: `Successfully purchased ${feature}! 🎨`,
        feature: result.feature,
        newBalance: result.newBalance
      };

    } catch (error) {
      logger.error('Error purchasing feature:', error);
      if (error.code && error.code.startsWith('functions/')) {
        throw error;
      }
      throw new functions.https.HttpsError('internal', 'Failed to purchase feature');
    }
  });

/**
 * Get user's uniform unlock status
 * Returns which features are unlocked, by XP or purchase
 */
exports.getUnlockStatus = functions
  .runWith(getFunctionConfig('light'))
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'You must be logged in');
    }

    const uid = context.auth.uid;

    try {
      const db = admin.firestore();
      const profileRef = db.doc(`artifacts/${DATA_NAMESPACE}/users/${uid}/profile/data`);
      const profileSnap = await profileRef.get();

      if (!profileSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'User profile not found');
      }

      const userProfile = profileSnap.data();
      const userXP = userProfile.xp || 0;
      const corpsCoin = userProfile.corpsCoin || 0;
      const purchasedFeatures = userProfile.purchasedUniformFeatures || [];

      const unlockStatus = {};

      // Check each feature
      for (const [feature, requirement] of Object.entries(FEATURE_REQUIREMENTS)) {
        const unlockedByXP = userXP >= requirement.xp;
        const purchased = purchasedFeatures.includes(feature);
        const canPurchase = !unlockedByXP && !purchased && corpsCoin >= requirement.corpsCoin;

        unlockStatus[feature] = {
          unlocked: unlockedByXP || purchased,
          unlockedByXP: unlockedByXP,
          purchased: purchased,
          canPurchase: canPurchase,
          requirement: {
            xp: requirement.xp,
            corpsCoin: requirement.corpsCoin
          }
        };
      }

      return {
        success: true,
        unlockStatus: unlockStatus,
        userStats: {
          xp: userXP,
          corpsCoin: corpsCoin,
          totalFeaturesPurchased: purchasedFeatures.length
        }
      };

    } catch (error) {
      functions.logger.error('Error getting unlock status:', error);
      throw new functions.https.HttpsError('internal', 'Failed to get unlock status');
    }
  });

/**
 * Get list of all available uniform features with requirements
 * Public endpoint, no auth required
 */
exports.getFeatureList = functions
  .runWith(getFunctionConfig('light'))
  .https.onCall(async (data, context) => {
    try {
      const features = Object.entries(FEATURE_REQUIREMENTS).map(([key, value]) => ({
        id: key,
        name: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1'),
        xpRequired: value.xp,
        corpsCoinCost: value.corpsCoin
      }));

      return {
        success: true,
        features: features
      };
    } catch (error) {
      functions.logger.error('Error getting feature list:', error);
      throw new functions.https.HttpsError('internal', 'Failed to get feature list');
    }
  });

module.exports = {
  updateUniform: exports.updateUniform,
  purchaseFeature: exports.purchaseFeature,
  getUnlockStatus: exports.getUnlockStatus,
  getFeatureList: exports.getFeatureList
};