const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { getDb, dataNamespaceParam } = require("../config");
const { getDefaultExecutionState } = require("../helpers/executionMultiplier");

/**
 * Rehearsal costs and benefits by section
 */
const REHEARSAL_CONFIG = {
  // How much readiness improves per rehearsal
  readinessGain: 0.05, // 5% per rehearsal
  maxReadiness: 1.00, // Cap at 100%

  // XP gained per rehearsal
  xpGain: 25,

  // Morale cost (rehearsals are tiring!)
  moraleCost: 0.02, // -2% morale per rehearsal

  // Equipment degradation
  equipmentWear: 0.01, // -1% equipment per rehearsal

  // Cooldown (can't rehearse same section multiple times per day)
  cooldownHours: 8,
};

/**
 * Equipment repair/upgrade costs
 */
const EQUIPMENT_CONFIG = {
  // Repair costs (per 10% condition)
  repairCosts: {
    instruments: 50,
    uniforms: 30,
    props: 75,
    bus: 200,
    truck: 250,
  },

  // Upgrade costs (improve max condition by 0.05)
  upgradeCosts: {
    instruments: 500,
    uniforms: 300,
    props: 750,
    bus: 2000,
    truck: 2500,
  },

  maxCondition: 1.00, // 100% base
  maxUpgradedCondition: 1.20, // Can upgrade to 120%
};

/**
 * Show difficulty presets
 */
const SHOW_DIFFICULTY_PRESETS = {
  conservative: {
    difficulty: 3,
    preparednessThreshold: 0.70,
    ceilingBonus: 0.04,
    riskPenalty: -0.05,
    description: "Safe show that's easy to execute well"
  },
  moderate: {
    difficulty: 5,
    preparednessThreshold: 0.80,
    ceilingBonus: 0.08,
    riskPenalty: -0.10,
    description: "Balanced risk and reward"
  },
  ambitious: {
    difficulty: 7,
    preparednessThreshold: 0.85,
    ceilingBonus: 0.12,
    riskPenalty: -0.15,
    description: "High difficulty with great potential"
  },
  legendary: {
    difficulty: 10,
    preparednessThreshold: 0.90,
    ceilingBonus: 0.15,
    riskPenalty: -0.20,
    description: "Historic show - huge risk, massive reward"
  },
};

/**
 * Daily Rehearsal - Improve corps readiness
 * Full corps rehearsal improves overall readiness
 * Costs: Morale, Equipment wear
 * Gains: Readiness, XP
 */
const dailyRehearsal = onCall({ cors: true }, async (request) => {
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

      // Initialize execution state if not present
      if (!profileData.corps?.[corpsClass]?.execution) {
        const defaultExecution = getDefaultExecutionState();
        transaction.update(profileRef, {
          [`corps.${corpsClass}.execution`]: defaultExecution
        });

        // Return early with initialization message
        return {
          initialized: true,
          message: "Execution state initialized. Please rehearse again.",
        };
      }

      const execution = profileData.corps[corpsClass].execution;

      // Check cooldown - use lastRehearsalDate for better tracking
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      if (execution.lastRehearsalDate) {
        const lastRehearsalValue = execution.lastRehearsalDate;
        const lastRehearsal = lastRehearsalValue?.toDate
          ? lastRehearsalValue.toDate()
          : new Date(lastRehearsalValue);
        const lastRehearsalDay = new Date(lastRehearsal.getFullYear(), lastRehearsal.getMonth(), lastRehearsal.getDate());

        if (lastRehearsalDay.getTime() === today.getTime()) {
          throw new HttpsError("failed-precondition",
            "You've already rehearsed today. Come back tomorrow!");
        }
      }

      // Full corps rehearsal - improve overall readiness
      const currentReadiness = typeof execution.readiness === 'number'
        ? execution.readiness
        : (execution.readiness?.overall || 0.75);
      const newReadiness = Math.min(
        currentReadiness + REHEARSAL_CONFIG.readinessGain,
        REHEARSAL_CONFIG.maxReadiness
      );

      const currentMorale = typeof execution.morale === 'number'
        ? execution.morale
        : (execution.morale?.overall || 0.80);
      const newMorale = Math.max(0.50, currentMorale - REHEARSAL_CONFIG.moraleCost);

      // Equipment wear (spread across all equipment)
      const currentEquipment = execution.equipment?.instruments || execution.equipment || 0.90;
      const newEquipment = Math.max(0.50, currentEquipment - REHEARSAL_CONFIG.equipmentWear);

      // Track weekly rehearsals
      const currentWeek = Math.ceil((profileData.currentDay || 1) / 7);
      const lastRehearsalWeek = execution.lastRehearsalWeek || 0;
      const rehearsalsThisWeek = lastRehearsalWeek === currentWeek
        ? (execution.rehearsalsThisWeek || 0) + 1
        : 1;

      // Bonus XP for perfect week (7 rehearsals)
      let bonusXp = 0;
      let bonusMessage = null;
      if (rehearsalsThisWeek === 7) {
        bonusXp = 50;
        bonusMessage = "Perfect week! +50 bonus XP";
      }

      // Update execution state
      const updates = {
        [`corps.${corpsClass}.execution.readiness`]: newReadiness,
        [`corps.${corpsClass}.execution.morale`]: newMorale,
        [`corps.${corpsClass}.execution.equipment`]: typeof execution.equipment === 'object'
          ? { ...execution.equipment, instruments: newEquipment }
          : newEquipment,
        [`corps.${corpsClass}.execution.lastRehearsalDate`]: admin.firestore.FieldValue.serverTimestamp(),
        [`corps.${corpsClass}.execution.lastRehearsalWeek`]: currentWeek,
        [`corps.${corpsClass}.execution.rehearsalsThisWeek`]: rehearsalsThisWeek,
        [`corps.${corpsClass}.execution.rehearsalStreak`]: admin.firestore.FieldValue.increment(1),
      };

      // Award XP
      const totalXp = REHEARSAL_CONFIG.xpGain + bonusXp;
      if (profileData.battlePass?.currentSeason) {
        updates[`battlePass.xp`] = admin.firestore.FieldValue.increment(totalXp);
      }

      transaction.update(profileRef, updates);

      return {
        initialized: false,
        oldReadiness: currentReadiness,
        newReadiness: newReadiness,
        readinessGain: newReadiness - currentReadiness,
        morale: {
          before: currentMorale,
          after: newMorale,
        },
        rehearsalsThisWeek,
        xpGained: totalXp,
        bonusMessage,
      };
    });

    if (result.initialized) {
      return {
        success: true,
        message: result.message,
        xpGained: 0,
        newReadiness: 0.75,
      };
    }

    logger.info(`User ${uid} completed daily rehearsal for ${corpsClass}`);
    return {
      success: true,
      message: "Rehearsal complete!",
      xpGained: result.xpGained,
      newReadiness: result.newReadiness,
      readinessGain: result.readinessGain,
      rehearsalsThisWeek: result.rehearsalsThisWeek,
      bonusMessage: result.bonusMessage,
    };
  } catch (error) {
    logger.error(`Error during rehearsal for user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to complete rehearsal.");
  }
});

/**
 * Repair Equipment - Restore equipment condition
 * Costs: CorpsCoin
 */
const repairEquipment = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const { corpsClass, equipmentType, repairAmount } = request.data;
  const uid = request.auth.uid;

  if (!corpsClass || !equipmentType) {
    throw new HttpsError("invalid-argument", "Corps class and equipment type required.");
  }

  const validEquipment = ['instruments', 'uniforms', 'props', 'bus', 'truck'];
  if (!validEquipment.includes(equipmentType)) {
    throw new HttpsError("invalid-argument", "Invalid equipment type.");
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

      if (!profileData.corps?.[corpsClass]?.execution) {
        throw new HttpsError("failed-precondition", "Initialize your corps first.");
      }

      const execution = profileData.corps[corpsClass].execution;
      const currentCondition = execution.equipment[equipmentType] || 0.90;
      const maxCondition = execution.equipment[`${equipmentType}Max`] || 1.00;

      // Calculate repair amount (default to full repair)
      const actualRepairAmount = repairAmount || (maxCondition - currentCondition);

      if (actualRepairAmount <= 0) {
        throw new HttpsError("failed-precondition", "Equipment is already at maximum condition.");
      }

      // Calculate cost (per 10% = base cost)
      const repairUnits = Math.ceil(actualRepairAmount / 0.10);
      const cost = repairUnits * EQUIPMENT_CONFIG.repairCosts[equipmentType];

      // Check CorpsCoin balance
      const currentCoin = profileData.corpsCoin || 0;
      if (currentCoin < cost) {
        throw new HttpsError("failed-precondition",
          `Insufficient CorpsCoin. Need ${cost}, have ${currentCoin}.`);
      }

      // Apply repair
      const newCondition = Math.min(currentCondition + actualRepairAmount, maxCondition);

      transaction.update(profileRef, {
        corpsCoin: currentCoin - cost,
        [`corps.${corpsClass}.execution.equipment.${equipmentType}`]: newCondition,
      });

      return {
        equipmentType,
        before: currentCondition,
        after: newCondition,
        repaired: newCondition - currentCondition,
        cost,
      };
    });

    logger.info(`User ${uid} repaired ${equipmentType} for ${corpsClass}`);
    return {
      success: true,
      message: `${equipmentType} repaired!`,
      results: result,
    };
  } catch (error) {
    logger.error(`Error repairing equipment for user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to repair equipment.");
  }
});

/**
 * Upgrade Equipment - Increase maximum condition
 * Costs: CorpsCoin (expensive!)
 */
const upgradeEquipment = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const { corpsClass, equipmentType } = request.data;
  const uid = request.auth.uid;

  if (!corpsClass || !equipmentType) {
    throw new HttpsError("invalid-argument", "Corps class and equipment type required.");
  }

  const validEquipment = ['instruments', 'uniforms', 'props', 'bus', 'truck'];
  if (!validEquipment.includes(equipmentType)) {
    throw new HttpsError("invalid-argument", "Invalid equipment type.");
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

      if (!profileData.corps?.[corpsClass]?.execution) {
        throw new HttpsError("failed-precondition", "Initialize your corps first.");
      }

      const execution = profileData.corps[corpsClass].execution;
      const currentMax = execution.equipment[`${equipmentType}Max`] || 1.00;

      // Check upgrade limit
      if (currentMax >= EQUIPMENT_CONFIG.maxUpgradedCondition) {
        throw new HttpsError("failed-precondition",
          "Equipment is already fully upgraded.");
      }

      const cost = EQUIPMENT_CONFIG.upgradeCosts[equipmentType];

      // Check CorpsCoin balance
      const currentCoin = profileData.corpsCoin || 0;
      if (currentCoin < cost) {
        throw new HttpsError("failed-precondition",
          `Insufficient CorpsCoin. Need ${cost}, have ${currentCoin}.`);
      }

      // Apply upgrade (+5% max condition)
      const newMax = Math.min(currentMax + 0.05, EQUIPMENT_CONFIG.maxUpgradedCondition);

      transaction.update(profileRef, {
        corpsCoin: currentCoin - cost,
        [`corps.${corpsClass}.execution.equipment.${equipmentType}Max`]: newMax,
      });

      return {
        equipmentType,
        before: currentMax,
        after: newMax,
        cost,
      };
    });

    logger.info(`User ${uid} upgraded ${equipmentType} for ${corpsClass}`);
    return {
      success: true,
      message: `${equipmentType} upgraded to ${(result.after * 100).toFixed(0)}% max!`,
      results: result,
    };
  } catch (error) {
    logger.error(`Error upgrading equipment for user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to upgrade equipment.");
  }
});

/**
 * Set Show Difficulty - Choose difficulty level
 * Higher difficulty = Higher ceiling, but needs more preparation
 */
const setShowDifficulty = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const { corpsClass, difficulty } = request.data;
  const uid = request.auth.uid;

  if (!corpsClass || !difficulty) {
    throw new HttpsError("invalid-argument", "Corps class and difficulty required.");
  }

  const validDifficulties = ['conservative', 'moderate', 'ambitious', 'legendary'];
  if (!validDifficulties.includes(difficulty)) {
    throw new HttpsError("invalid-argument", "Invalid difficulty level.");
  }

  const db = getDb();
  const profileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);

  try {
    await db.runTransaction(async (transaction) => {
      const profileDoc = await transaction.get(profileRef);
      if (!profileDoc.exists) {
        throw new HttpsError("not-found", "User profile not found.");
      }

      const profileData = profileDoc.data();

      if (!profileData.corps?.[corpsClass]?.execution) {
        throw new HttpsError("failed-precondition", "Initialize your corps first.");
      }

      const difficultyConfig = SHOW_DIFFICULTY_PRESETS[difficulty];

      // Can only change difficulty before day 10 (early season)
      const currentDay = profileData.currentDay || 1;
      if (currentDay > 10) {
        throw new HttpsError("failed-precondition",
          "Cannot change show difficulty after day 10. You're committed!");
      }

      transaction.update(profileRef, {
        [`corps.${corpsClass}.execution.showDesign`]: difficultyConfig,
      });
    });

    logger.info(`User ${uid} set ${corpsClass} difficulty to ${difficulty}`);
    return {
      success: true,
      message: `Show difficulty set to ${difficulty}!`,
      config: SHOW_DIFFICULTY_PRESETS[difficulty],
    };
  } catch (error) {
    logger.error(`Error setting show difficulty for user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to set show difficulty.");
  }
});

/**
 * Get Execution Status - View current execution state
 */
const getExecutionStatus = onCall({ cors: true }, async (request) => {
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
    const profileDoc = await profileRef.get();
    if (!profileDoc.exists) {
      throw new HttpsError("not-found", "User profile not found.");
    }

    const profileData = profileDoc.data();
    const execution = profileData.corps?.[corpsClass]?.execution;

    if (!execution) {
      // Initialize if not present
      const defaultExecution = getDefaultExecutionState();
      await profileRef.update({
        [`corps.${corpsClass}.execution`]: defaultExecution
      });

      return {
        success: true,
        execution: defaultExecution,
        initialized: true,
      };
    }

    return {
      success: true,
      execution: execution,
      currentDay: profileData.currentDay || 1,
    };
  } catch (error) {
    logger.error(`Error getting execution status for user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to get execution status.");
  }
});

/**
 * Boost Morale - Spend CorpsCoin to improve corps morale
 * Used when morale drops from excessive rehearsals
 */
const boostMorale = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const { corpsClass } = request.data;
  const uid = request.auth.uid;

  if (!corpsClass) {
    throw new HttpsError("invalid-argument", "Corps class required.");
  }

  const MORALE_BOOST_COST = 100; // CorpsCoin
  const MORALE_BOOST_AMOUNT = 0.10; // +10% morale

  const db = getDb();
  const profileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);

  try {
    const result = await db.runTransaction(async (transaction) => {
      const profileDoc = await transaction.get(profileRef);
      if (!profileDoc.exists) {
        throw new HttpsError("not-found", "User profile not found.");
      }

      const profileData = profileDoc.data();

      if (!profileData.corps?.[corpsClass]?.execution) {
        throw new HttpsError("failed-precondition", "Initialize your corps first.");
      }

      const execution = profileData.corps[corpsClass].execution;
      const currentMorale = typeof execution.morale === 'number'
        ? execution.morale
        : (execution.morale?.overall || 0.80);

      if (currentMorale >= 1.00) {
        throw new HttpsError("failed-precondition", "Morale is already at maximum.");
      }

      // Check CorpsCoin balance
      const currentCoin = profileData.corpsCoin || 0;
      if (currentCoin < MORALE_BOOST_COST) {
        throw new HttpsError("failed-precondition",
          `Insufficient CorpsCoin. Need ${MORALE_BOOST_COST}, have ${currentCoin}.`);
      }

      // Apply morale boost
      const newMorale = Math.min(currentMorale + MORALE_BOOST_AMOUNT, 1.00);

      transaction.update(profileRef, {
        corpsCoin: currentCoin - MORALE_BOOST_COST,
        [`corps.${corpsClass}.execution.morale`]: newMorale,
      });

      return {
        before: currentMorale,
        after: newMorale,
        cost: MORALE_BOOST_COST,
      };
    });

    logger.info(`User ${uid} boosted morale for ${corpsClass}`);
    return {
      success: true,
      message: "Corps morale boosted!",
      newMorale: result.after,
      cost: result.cost,
    };
  } catch (error) {
    logger.error(`Error boosting morale for user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to boost morale.");
  }
});

/**
 * Boost Staff Morale - Improve a specific staff member's morale
 * Staff morale affects their teaching effectiveness
 */
const boostStaffMorale = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const { staffId } = request.data;
  const uid = request.auth.uid;

  if (!staffId) {
    throw new HttpsError("invalid-argument", "Staff ID required.");
  }

  const STAFF_MORALE_BOOST_COST = 150; // CorpsCoin
  const STAFF_MORALE_BOOST_AMOUNT = 0.10; // +10% morale

  const db = getDb();
  const profileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);

  try {
    const result = await db.runTransaction(async (transaction) => {
      const profileDoc = await transaction.get(profileRef);
      if (!profileDoc.exists) {
        throw new HttpsError("not-found", "User profile not found.");
      }

      const profileData = profileDoc.data();
      const staffArray = profileData.staff || [];

      // Find the staff member
      const staffIndex = staffArray.findIndex(s => s.staffId === staffId);
      if (staffIndex === -1) {
        throw new HttpsError("not-found", "Staff member not found in your roster.");
      }

      const staff = staffArray[staffIndex];
      const currentMorale = staff.morale || 0.90;

      if (currentMorale >= 1.00) {
        throw new HttpsError("failed-precondition", "Staff morale is already at maximum.");
      }

      // Check CorpsCoin balance
      const currentCoin = profileData.corpsCoin || 0;
      if (currentCoin < STAFF_MORALE_BOOST_COST) {
        throw new HttpsError("failed-precondition",
          `Insufficient CorpsCoin. Need ${STAFF_MORALE_BOOST_COST}, have ${currentCoin}.`);
      }

      // Apply morale boost
      const newMorale = Math.min(currentMorale + STAFF_MORALE_BOOST_AMOUNT, 1.00);
      staffArray[staffIndex] = { ...staff, morale: newMorale };

      transaction.update(profileRef, {
        corpsCoin: currentCoin - STAFF_MORALE_BOOST_COST,
        staff: staffArray,
      });

      return {
        staffId,
        staffName: staff.name || staffId,
        before: currentMorale,
        after: newMorale,
        cost: STAFF_MORALE_BOOST_COST,
      };
    });

    logger.info(`User ${uid} boosted staff morale for ${result.staffName}`);
    return {
      success: true,
      message: `${result.staffName}'s morale boosted!`,
      results: result,
    };
  } catch (error) {
    logger.error(`Error boosting staff morale for user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to boost staff morale.");
  }
});

module.exports = {
  dailyRehearsal,
  repairEquipment,
  upgradeEquipment,
  setShowDifficulty,
  getExecutionStatus,
  boostMorale,
  boostStaffMorale,
};
