const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { getDb, dataNamespaceParam } = require("../config");
const { calculateXPUpdates } = require("../helpers/xpCalculations");

/**
 * Daily Operations Configuration
 * Rewards and costs for various daily activities
 */
const DAILY_OPS_CONFIG = {
  // Login bonus (once per day)
  loginBonus: {
    baseXp: 10,
    baseCoin: 5,
    streakMultiplier: 0.1, // +10% per day streak (capped at 100%)
    maxStreakBonus: 1.0 // Max 2x multiplier at 10+ day streak
  },

  // Staff check-in (talk to your staff)
  staffCheckin: {
    xpReward: 15,
    moraleBoost: 0.02, // +2% staff morale per check-in
    cooldownHours: 20
  },

  // Member wellness check
  memberWellness: {
    xpReward: 15,
    moraleBoost: 0.03, // +3% corps morale
    cooldownHours: 20
  },

  // Equipment inspection
  equipmentInspection: {
    xpReward: 10,
    coinReward: 5, // Small coin reward for keeping up with inspection
    cooldownHours: 20,
    // Random events can occur during inspection
    eventChance: 0.15 // 15% chance of random event
  },

  // Sectional rehearsals (can do one of each per day)
  sectionalRehearsal: {
    music: { xpReward: 20, readinessGain: 0.02, focusArea: 'music' },
    visual: { xpReward: 20, readinessGain: 0.02, focusArea: 'visual' },
    guard: { xpReward: 20, readinessGain: 0.02, focusArea: 'guard' },
    percussion: { xpReward: 20, readinessGain: 0.02, focusArea: 'percussion' }
  },

  // Show review (analyze last performance)
  showReview: {
    xpReward: 20,
    insightBonus: true, // Provides tips for improvement
    cooldownHours: 20
  }
};

/**
 * Random events that can occur during equipment inspection
 */
const INSPECTION_EVENTS = [
  {
    id: 'found_damage',
    type: 'negative',
    message: 'Found unexpected damage to equipment during inspection.',
    effect: { equipmentPenalty: 0.05 }
  },
  {
    id: 'early_catch',
    type: 'positive',
    message: 'Caught a potential issue early! Saved on repair costs.',
    effect: { coinBonus: 20 }
  },
  {
    id: 'member_suggestion',
    type: 'positive',
    message: 'A member suggested an improvement to equipment maintenance.',
    effect: { xpBonus: 15 }
  },
  {
    id: 'wear_and_tear',
    type: 'neutral',
    message: 'Normal wear and tear observed. Schedule maintenance soon.',
    effect: {}
  },
  {
    id: 'pristine_condition',
    type: 'positive',
    message: 'Equipment is in excellent condition! Morale boost for the corps.',
    effect: { moraleBonus: 0.02 }
  }
];

/**
 * Claim Daily Login Bonus
 * Awards XP and CorpsCoin once per day, with streak bonuses
 */
const claimDailyLogin = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const uid = request.auth.uid;
  const db = getDb();
  const profileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);

  try {
    const result = await db.runTransaction(async (transaction) => {
      const profileDoc = await transaction.get(profileRef);
      if (!profileDoc.exists) {
        throw new HttpsError("not-found", "User profile not found.");
      }

      const profileData = profileDoc.data();
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Check if already claimed today
      const dailyOps = profileData.dailyOps || {};
      const lastLoginClaim = dailyOps.lastLoginClaim
        ? (dailyOps.lastLoginClaim.toDate ? dailyOps.lastLoginClaim.toDate() : new Date(dailyOps.lastLoginClaim))
        : null;

      if (lastLoginClaim) {
        const lastClaimDay = new Date(lastLoginClaim.getFullYear(), lastLoginClaim.getMonth(), lastLoginClaim.getDate());
        if (lastClaimDay.getTime() === today.getTime()) {
          throw new HttpsError("failed-precondition", "Already claimed today's login bonus!");
        }
      }

      // Calculate streak
      const loginStreak = profileData.engagement?.loginStreak || 1;
      const streakBonus = Math.min(
        loginStreak * DAILY_OPS_CONFIG.loginBonus.streakMultiplier,
        DAILY_OPS_CONFIG.loginBonus.maxStreakBonus
      );

      // Calculate rewards
      const xpReward = Math.floor(DAILY_OPS_CONFIG.loginBonus.baseXp * (1 + streakBonus));
      const coinReward = Math.floor(DAILY_OPS_CONFIG.loginBonus.baseCoin * (1 + streakBonus));

      // Calculate XP updates (profile level + battle pass)
      const { updates: xpUpdates, newXP, newLevel, classUnlocked } = calculateXPUpdates(profileData, xpReward);

      // Combine all updates
      const updates = {
        ...xpUpdates,
        'dailyOps.lastLoginClaim': admin.firestore.FieldValue.serverTimestamp(),
        corpsCoin: admin.firestore.FieldValue.increment(coinReward)
      };

      transaction.update(profileRef, updates);

      return {
        xpReward,
        coinReward,
        loginStreak,
        streakBonus: Math.round(streakBonus * 100),
        newXP,
        newLevel,
        classUnlocked
      };
    });

    logger.info(`User ${uid} claimed daily login bonus`);
    return {
      success: true,
      message: `Welcome back! +${result.xpReward} XP, +${result.coinReward} CorpsCoin`,
      ...result
    };
  } catch (error) {
    logger.error(`Error claiming daily login for user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to claim daily login bonus.");
  }
});

/**
 * Staff Check-in - Daily interaction with your staff
 * Improves staff morale and earns XP
 */
const staffCheckin = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const { corpsClass } = request.data;
  const uid = request.auth.uid;

  if (!corpsClass) {
    throw new HttpsError("invalid-argument", "Corps class required.");
  }

  const db = getDb();
  const profileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);

  try {
    const result = await db.runTransaction(async (transaction) => {
      const profileDoc = await transaction.get(profileRef);
      if (!profileDoc.exists) {
        throw new HttpsError("not-found", "User profile not found.");
      }

      const profileData = profileDoc.data();
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Check cooldown
      const dailyOps = profileData.dailyOps || {};
      const lastCheckin = dailyOps.lastStaffCheckin?.[corpsClass]
        ? (dailyOps.lastStaffCheckin[corpsClass].toDate ? dailyOps.lastStaffCheckin[corpsClass].toDate() : new Date(dailyOps.lastStaffCheckin[corpsClass]))
        : null;

      if (lastCheckin) {
        const lastCheckinDay = new Date(lastCheckin.getFullYear(), lastCheckin.getMonth(), lastCheckin.getDate());
        if (lastCheckinDay.getTime() === today.getTime()) {
          throw new HttpsError("failed-precondition", "Already completed staff check-in today!");
        }
      }

      // Get staff assigned to this corps
      const assignedStaff = (profileData.staff || []).filter(
        s => s.assignedTo?.corpsClass === corpsClass
      );

      // Boost morale for assigned staff
      const updatedStaff = (profileData.staff || []).map(s => {
        if (s.assignedTo?.corpsClass === corpsClass) {
          const currentMorale = s.morale || 0.85;
          return {
            ...s,
            morale: Math.min(currentMorale + DAILY_OPS_CONFIG.staffCheckin.moraleBoost, 1.0)
          };
        }
        return s;
      });

      // Calculate XP updates (profile level + battle pass)
      const xpReward = DAILY_OPS_CONFIG.staffCheckin.xpReward;
      const { updates: xpUpdates, newXP, newLevel, classUnlocked } = calculateXPUpdates(profileData, xpReward);

      const updates = {
        ...xpUpdates,
        [`dailyOps.lastStaffCheckin.${corpsClass}`]: admin.firestore.FieldValue.serverTimestamp(),
        staff: updatedStaff
      };

      transaction.update(profileRef, updates);

      return {
        xpReward,
        staffCount: assignedStaff.length,
        moraleBoost: DAILY_OPS_CONFIG.staffCheckin.moraleBoost,
        newXP,
        newLevel,
        classUnlocked
      };
    });

    logger.info(`User ${uid} completed staff check-in for ${corpsClass}`);
    return {
      success: true,
      message: `Staff meeting complete! +${result.xpReward} XP`,
      ...result
    };
  } catch (error) {
    logger.error(`Error in staff check-in for user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to complete staff check-in.");
  }
});

/**
 * Member Wellness Check - Check on your corps members
 * Improves corps morale and earns XP
 */
const memberWellnessCheck = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const { corpsClass } = request.data;
  const uid = request.auth.uid;

  if (!corpsClass) {
    throw new HttpsError("invalid-argument", "Corps class required.");
  }

  const db = getDb();
  const profileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);

  try {
    const result = await db.runTransaction(async (transaction) => {
      const profileDoc = await transaction.get(profileRef);
      if (!profileDoc.exists) {
        throw new HttpsError("not-found", "User profile not found.");
      }

      const profileData = profileDoc.data();
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Check cooldown
      const dailyOps = profileData.dailyOps || {};
      const lastCheck = dailyOps.lastWellnessCheck?.[corpsClass]
        ? (dailyOps.lastWellnessCheck[corpsClass].toDate ? dailyOps.lastWellnessCheck[corpsClass].toDate() : new Date(dailyOps.lastWellnessCheck[corpsClass]))
        : null;

      if (lastCheck) {
        const lastCheckDay = new Date(lastCheck.getFullYear(), lastCheck.getMonth(), lastCheck.getDate());
        if (lastCheckDay.getTime() === today.getTime()) {
          throw new HttpsError("failed-precondition", "Already completed wellness check today!");
        }
      }

      // Check if corps exists
      if (!profileData.corps?.[corpsClass]) {
        throw new HttpsError("not-found", "Corps not found.");
      }

      // Boost corps morale
      const execution = profileData.corps[corpsClass].execution || {};
      const currentMorale = typeof execution.morale === 'number' ? execution.morale : 0.80;
      const newMorale = Math.min(currentMorale + DAILY_OPS_CONFIG.memberWellness.moraleBoost, 1.0);

      // Calculate XP updates (profile level + battle pass)
      const xpReward = DAILY_OPS_CONFIG.memberWellness.xpReward;
      const { updates: xpUpdates, newXP, newLevel, classUnlocked } = calculateXPUpdates(profileData, xpReward);

      const updates = {
        ...xpUpdates,
        [`dailyOps.lastWellnessCheck.${corpsClass}`]: admin.firestore.FieldValue.serverTimestamp(),
        [`corps.${corpsClass}.execution.morale`]: newMorale
      };

      transaction.update(profileRef, updates);

      return {
        xpReward,
        moraleBoost: DAILY_OPS_CONFIG.memberWellness.moraleBoost,
        newMorale,
        newXP,
        newLevel,
        classUnlocked
      };
    });

    logger.info(`User ${uid} completed wellness check for ${corpsClass}`);
    return {
      success: true,
      message: `Member check-in complete! Corps morale improved. +${result.xpReward} XP`,
      ...result
    };
  } catch (error) {
    logger.error(`Error in wellness check for user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to complete wellness check.");
  }
});

/**
 * Equipment Inspection - Daily equipment check
 * Can trigger random events, earns XP and small coin reward
 */
const equipmentInspection = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const { corpsClass } = request.data;
  const uid = request.auth.uid;

  if (!corpsClass) {
    throw new HttpsError("invalid-argument", "Corps class required.");
  }

  const db = getDb();
  const profileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);

  try {
    const result = await db.runTransaction(async (transaction) => {
      const profileDoc = await transaction.get(profileRef);
      if (!profileDoc.exists) {
        throw new HttpsError("not-found", "User profile not found.");
      }

      const profileData = profileDoc.data();
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Check cooldown
      const dailyOps = profileData.dailyOps || {};
      const lastInspection = dailyOps.lastEquipmentInspection?.[corpsClass]
        ? (dailyOps.lastEquipmentInspection[corpsClass].toDate ? dailyOps.lastEquipmentInspection[corpsClass].toDate() : new Date(dailyOps.lastEquipmentInspection[corpsClass]))
        : null;

      if (lastInspection) {
        const lastInspDay = new Date(lastInspection.getFullYear(), lastInspection.getMonth(), lastInspection.getDate());
        if (lastInspDay.getTime() === today.getTime()) {
          throw new HttpsError("failed-precondition", "Already completed equipment inspection today!");
        }
      }

      // Check if corps exists
      if (!profileData.corps?.[corpsClass]) {
        throw new HttpsError("not-found", "Corps not found.");
      }

      let xpReward = DAILY_OPS_CONFIG.equipmentInspection.xpReward;
      let coinReward = DAILY_OPS_CONFIG.equipmentInspection.coinReward;
      let event = null;

      // Random event check
      if (Math.random() < DAILY_OPS_CONFIG.equipmentInspection.eventChance) {
        event = INSPECTION_EVENTS[Math.floor(Math.random() * INSPECTION_EVENTS.length)];

        // Apply event effects
        if (event.effect.xpBonus) xpReward += event.effect.xpBonus;
        if (event.effect.coinBonus) coinReward += event.effect.coinBonus;
      }

      // Calculate XP updates (profile level + battle pass)
      const { updates: xpUpdates, newXP, newLevel, classUnlocked } = calculateXPUpdates(profileData, xpReward);

      const updates = {
        ...xpUpdates,
        [`dailyOps.lastEquipmentInspection.${corpsClass}`]: admin.firestore.FieldValue.serverTimestamp(),
        corpsCoin: admin.firestore.FieldValue.increment(coinReward)
      };

      // Apply event equipment penalty if any
      if (event?.effect?.equipmentPenalty) {
        const execution = profileData.corps[corpsClass].execution || {};
        const equipment = execution.equipment || {};
        // Apply penalty to all equipment
        Object.keys(equipment).forEach(key => {
          if (typeof equipment[key] === 'number' && !key.includes('Max')) {
            const newVal = Math.max(0.5, equipment[key] - event.effect.equipmentPenalty);
            updates[`corps.${corpsClass}.execution.equipment.${key}`] = newVal;
          }
        });
      }

      // Apply morale bonus if any
      if (event?.effect?.moraleBonus) {
        const execution = profileData.corps[corpsClass].execution || {};
        const currentMorale = typeof execution.morale === 'number' ? execution.morale : 0.80;
        updates[`corps.${corpsClass}.execution.morale`] = Math.min(currentMorale + event.effect.moraleBonus, 1.0);
      }

      transaction.update(profileRef, updates);

      return {
        xpReward,
        coinReward,
        event: event ? { id: event.id, type: event.type, message: event.message } : null,
        newXP,
        newLevel,
        classUnlocked
      };
    });

    logger.info(`User ${uid} completed equipment inspection for ${corpsClass}`);
    return {
      success: true,
      message: result.event
        ? `Inspection complete! ${result.event.message}`
        : `Equipment inspection complete! +${result.xpReward} XP, +${result.coinReward} CC`,
      ...result
    };
  } catch (error) {
    logger.error(`Error in equipment inspection for user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to complete equipment inspection.");
  }
});

/**
 * Sectional Rehearsal - Focus on a specific section
 * Can do one of each type per day (music, visual, guard, percussion)
 */
const sectionalRehearsal = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const { corpsClass, section } = request.data;
  const uid = request.auth.uid;

  if (!corpsClass || !section) {
    throw new HttpsError("invalid-argument", "Corps class and section required.");
  }

  const validSections = ['music', 'visual', 'guard', 'percussion'];
  if (!validSections.includes(section)) {
    throw new HttpsError("invalid-argument", "Invalid section. Choose: music, visual, guard, or percussion.");
  }

  const db = getDb();
  const profileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);

  try {
    const result = await db.runTransaction(async (transaction) => {
      const profileDoc = await transaction.get(profileRef);
      if (!profileDoc.exists) {
        throw new HttpsError("not-found", "User profile not found.");
      }

      const profileData = profileDoc.data();
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Check cooldown for this specific section
      const dailyOps = profileData.dailyOps || {};
      const lastSectional = dailyOps.lastSectionalRehearsal?.[corpsClass]?.[section]
        ? (dailyOps.lastSectionalRehearsal[corpsClass][section].toDate
          ? dailyOps.lastSectionalRehearsal[corpsClass][section].toDate()
          : new Date(dailyOps.lastSectionalRehearsal[corpsClass][section]))
        : null;

      if (lastSectional) {
        const lastSectDay = new Date(lastSectional.getFullYear(), lastSectional.getMonth(), lastSectional.getDate());
        if (lastSectDay.getTime() === today.getTime()) {
          throw new HttpsError("failed-precondition", `Already completed ${section} sectional today!`);
        }
      }

      // Check if corps exists
      if (!profileData.corps?.[corpsClass]) {
        throw new HttpsError("not-found", "Corps not found.");
      }

      const sectionConfig = DAILY_OPS_CONFIG.sectionalRehearsal[section];

      // Improve readiness
      const execution = profileData.corps[corpsClass].execution || {};
      const currentReadiness = typeof execution.readiness === 'number' ? execution.readiness : 0.75;
      const newReadiness = Math.min(currentReadiness + sectionConfig.readinessGain, 1.0);

      // Track sectional focus for potential scoring bonuses
      const sectionalFocus = execution.sectionalFocus || {};
      sectionalFocus[section] = (sectionalFocus[section] || 0) + 1;

      // Calculate XP updates (profile level + battle pass)
      const xpReward = sectionConfig.xpReward;
      const { updates: xpUpdates, newXP, newLevel, classUnlocked } = calculateXPUpdates(profileData, xpReward);

      const updates = {
        ...xpUpdates,
        [`dailyOps.lastSectionalRehearsal.${corpsClass}.${section}`]: admin.firestore.FieldValue.serverTimestamp(),
        [`corps.${corpsClass}.execution.readiness`]: newReadiness,
        [`corps.${corpsClass}.execution.sectionalFocus`]: sectionalFocus
      };

      transaction.update(profileRef, updates);

      return {
        section,
        xpReward,
        readinessGain: sectionConfig.readinessGain,
        newReadiness,
        totalSectionals: sectionalFocus,
        newXP,
        newLevel,
        classUnlocked
      };
    });

    const sectionNames = {
      music: 'Music',
      visual: 'Visual/Drill',
      guard: 'Color Guard',
      percussion: 'Percussion'
    };

    logger.info(`User ${uid} completed ${section} sectional for ${corpsClass}`);
    return {
      success: true,
      message: `${sectionNames[section]} sectional complete! +${result.xpReward} XP, +${Math.round(result.readinessGain * 100)}% readiness`,
      ...result
    };
  } catch (error) {
    logger.error(`Error in sectional rehearsal for user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to complete sectional rehearsal.");
  }
});

/**
 * Show Review - Analyze your last performance
 * Provides insights and earns XP
 */
const showReview = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const { corpsClass } = request.data;
  const uid = request.auth.uid;

  if (!corpsClass) {
    throw new HttpsError("invalid-argument", "Corps class required.");
  }

  const db = getDb();
  const profileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);

  try {
    const result = await db.runTransaction(async (transaction) => {
      const profileDoc = await transaction.get(profileRef);
      if (!profileDoc.exists) {
        throw new HttpsError("not-found", "User profile not found.");
      }

      const profileData = profileDoc.data();
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Check cooldown
      const dailyOps = profileData.dailyOps || {};
      const lastReview = dailyOps.lastShowReview?.[corpsClass]
        ? (dailyOps.lastShowReview[corpsClass].toDate ? dailyOps.lastShowReview[corpsClass].toDate() : new Date(dailyOps.lastShowReview[corpsClass]))
        : null;

      if (lastReview) {
        const lastReviewDay = new Date(lastReview.getFullYear(), lastReview.getMonth(), lastReview.getDate());
        if (lastReviewDay.getTime() === today.getTime()) {
          throw new HttpsError("failed-precondition", "Already completed show review today!");
        }
      }

      // Check if corps exists
      if (!profileData.corps?.[corpsClass]) {
        throw new HttpsError("not-found", "Corps not found.");
      }

      // Generate insights based on corps state
      const execution = profileData.corps[corpsClass].execution || {};
      const insights = [];

      const readiness = typeof execution.readiness === 'number' ? execution.readiness : 0.75;
      const morale = typeof execution.morale === 'number' ? execution.morale : 0.80;

      if (readiness < 0.7) {
        insights.push({ type: 'warning', message: 'Readiness is below optimal. Focus on full rehearsals.' });
      } else if (readiness >= 0.9) {
        insights.push({ type: 'success', message: 'Excellent readiness! Show is well-prepared.' });
      }

      if (morale < 0.7) {
        insights.push({ type: 'warning', message: 'Corps morale is low. Consider a morale boost or lighter schedule.' });
      } else if (morale >= 0.9) {
        insights.push({ type: 'success', message: 'Corps morale is excellent! Members are motivated.' });
      }

      // Check sectional balance
      const sectionalFocus = execution.sectionalFocus || {};
      const sections = ['music', 'visual', 'guard', 'percussion'];
      const sectionCounts = sections.map(s => sectionalFocus[s] || 0);
      const minSection = Math.min(...sectionCounts);
      const maxSection = Math.max(...sectionCounts);

      if (maxSection - minSection > 3) {
        const weakSection = sections[sectionCounts.indexOf(minSection)];
        insights.push({ type: 'tip', message: `Consider more ${weakSection} sectionals to balance your show.` });
      }

      // Equipment check
      const equipment = execution.equipment || {};
      const lowEquipment = Object.entries(equipment)
        .filter(([k, v]) => typeof v === 'number' && v < 0.7 && !k.includes('Max'))
        .map(([k]) => k);

      if (lowEquipment.length > 0) {
        insights.push({ type: 'warning', message: `Equipment needs attention: ${lowEquipment.join(', ')}` });
      }

      // Default insight if none generated
      if (insights.length === 0) {
        insights.push({ type: 'success', message: 'Corps is in good shape. Keep up the consistent work!' });
      }

      // Calculate XP updates (profile level + battle pass)
      const xpReward = DAILY_OPS_CONFIG.showReview.xpReward;
      const { updates: xpUpdates, newXP, newLevel, classUnlocked } = calculateXPUpdates(profileData, xpReward);

      const updates = {
        ...xpUpdates,
        [`dailyOps.lastShowReview.${corpsClass}`]: admin.firestore.FieldValue.serverTimestamp()
      };

      transaction.update(profileRef, updates);

      // Build detailed stats for the modal
      const stats = {
        readiness: Math.round(readiness * 100),
        morale: Math.round(morale * 100),
        sectionalFocus: {
          music: sectionalFocus.music || 0,
          visual: sectionalFocus.visual || 0,
          guard: sectionalFocus.guard || 0,
          percussion: sectionalFocus.percussion || 0
        },
        equipmentHealth: Object.entries(equipment)
          .filter(([k, v]) => typeof v === 'number' && !k.includes('Max'))
          .reduce((acc, [k, v]) => {
            acc[k] = Math.round(v * 100);
            return acc;
          }, {})
      };

      return {
        xpReward,
        insights,
        stats,
        newXP,
        newLevel,
        classUnlocked
      };
    });

    logger.info(`User ${uid} completed show review for ${corpsClass}`);
    return {
      success: true,
      message: `Show review complete! +${result.xpReward} XP`,
      ...result
    };
  } catch (error) {
    logger.error(`Error in show review for user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to complete show review.");
  }
});

/**
 * Get Daily Ops Status - Check what activities are available today
 */
const getDailyOpsStatus = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const { corpsClass } = request.data;
  const uid = request.auth.uid;

  const db = getDb();
  const profileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);

  try {
    const profileDoc = await profileRef.get();
    if (!profileDoc.exists) {
      throw new HttpsError("not-found", "User profile not found.");
    }

    const profileData = profileDoc.data();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const dailyOps = profileData.dailyOps || {};

    // Helper to check if activity was done today
    const isDoneToday = (timestamp) => {
      if (!timestamp) return false;
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      return dateDay.getTime() === today.getTime();
    };

    const status = {
      loginBonus: {
        available: !isDoneToday(dailyOps.lastLoginClaim),
        lastClaimed: dailyOps.lastLoginClaim || null
      },
      staffCheckin: {
        available: corpsClass ? !isDoneToday(dailyOps.lastStaffCheckin?.[corpsClass]) : false,
        lastCompleted: dailyOps.lastStaffCheckin?.[corpsClass] || null
      },
      memberWellness: {
        available: corpsClass ? !isDoneToday(dailyOps.lastWellnessCheck?.[corpsClass]) : false,
        lastCompleted: dailyOps.lastWellnessCheck?.[corpsClass] || null
      },
      equipmentInspection: {
        available: corpsClass ? !isDoneToday(dailyOps.lastEquipmentInspection?.[corpsClass]) : false,
        lastCompleted: dailyOps.lastEquipmentInspection?.[corpsClass] || null
      },
      showReview: {
        available: corpsClass ? !isDoneToday(dailyOps.lastShowReview?.[corpsClass]) : false,
        lastCompleted: dailyOps.lastShowReview?.[corpsClass] || null
      },
      sectionalRehearsals: corpsClass ? {
        music: { available: !isDoneToday(dailyOps.lastSectionalRehearsal?.[corpsClass]?.music) },
        visual: { available: !isDoneToday(dailyOps.lastSectionalRehearsal?.[corpsClass]?.visual) },
        guard: { available: !isDoneToday(dailyOps.lastSectionalRehearsal?.[corpsClass]?.guard) },
        percussion: { available: !isDoneToday(dailyOps.lastSectionalRehearsal?.[corpsClass]?.percussion) }
      } : null
    };

    // Count available activities
    let availableCount = 0;
    if (status.loginBonus.available) availableCount++;
    if (status.staffCheckin.available) availableCount++;
    if (status.memberWellness.available) availableCount++;
    if (status.equipmentInspection.available) availableCount++;
    if (status.showReview.available) availableCount++;
    if (status.sectionalRehearsals) {
      Object.values(status.sectionalRehearsals).forEach(s => {
        if (s.available) availableCount++;
      });
    }

    return {
      success: true,
      status,
      availableCount,
      totalPossible: 9 // login + 4 daily ops + 4 sectionals
    };
  } catch (error) {
    logger.error(`Error getting daily ops status for user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to get daily ops status.");
  }
});

module.exports = {
  claimDailyLogin,
  staffCheckin,
  memberWellnessCheck,
  equipmentInspection,
  sectionalRehearsal,
  showReview,
  getDailyOpsStatus
};
