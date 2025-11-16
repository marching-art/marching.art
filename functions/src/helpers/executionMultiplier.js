/**
 * Execution Multiplier System
 *
 * Calculates how well a corps executes their show based on:
 * - Section readiness (rehearsal quality)
 * - Staff effectiveness (coaching quality)
 * - Equipment condition (maintenance)
 * - Section morale (mental state)
 * - Show difficulty (risk vs reward)
 * - Random variance (realistic unpredictability)
 *
 * Returns a multiplier between 0.70 and 1.10
 * Applied to historical DCI caption scores
 */

const { getDb, dataNamespaceParam } = require('../config');
const { logger } = require('firebase-functions/v2');

/**
 * Main function: Calculate execution multiplier for a specific caption
 *
 * @param {string} uid - User ID
 * @param {string} corpsClass - Corps class (worldClass, open, aClass, soundSport)
 * @param {string} caption - Caption code (GE1, GE2, VP, VA, CG, B, MA, P)
 * @param {number} scoredDay - Current day in season (1-49)
 * @param {string} eventName - Event name for context
 * @returns {Promise<number>} Execution multiplier (0.70 - 1.10)
 */
async function calculateExecutionMultiplier(uid, corpsClass, caption, scoredDay, eventName) {
  const db = getDb();

  try {
    // Get user's execution state
    const userDoc = await db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`).get();

    if (!userDoc.exists) {
      logger.warn(`User ${uid} not found for execution calculation`);
      return 0.90; // Default: slight penalty
    }

    const userData = userDoc.data();
    const execution = userData.corps?.[corpsClass]?.execution;

    // If no execution data, use default (new corps)
    if (!execution) {
      logger.info(`No execution data for ${uid}/${corpsClass}, using default`);
      return 0.90; // Default for new corps
    }

    let multiplier = 1.00; // Start at 100% (perfect execution)
    const breakdown = {}; // Track each factor for analytics

    // FACTOR 1: Section Readiness (±12%)
    // Accumulated through rehearsals
    const sectionReadiness = getSectionReadiness(caption, execution.readiness);
    const readinessBonus = (sectionReadiness - 0.80) * 0.60; // Range: -0.12 to +0.12
    multiplier += readinessBonus;
    breakdown.readiness = readinessBonus;

    // FACTOR 2: Staff Effectiveness (±8%)
    // Based on assigned staff quality
    const staffEffectiveness = await getStaffEffectiveness(uid, corpsClass, caption, userData.staff);
    const staffBonus = (staffEffectiveness - 0.80) * 0.40; // Range: -0.08 to +0.08
    multiplier += staffBonus;
    breakdown.staff = staffBonus;

    // FACTOR 3: Equipment Condition (±5%)
    // Affects execution quality
    const equipmentHealth = getEquipmentHealth(caption, execution.equipment);
    const equipmentPenalty = (equipmentHealth - 1.00) * 0.50; // Range: -0.05 to 0
    multiplier += equipmentPenalty;
    breakdown.equipment = equipmentPenalty;

    // Bus/Truck condition affects overall morale
    const travelHealth = (execution.equipment?.bus || 0.90) + (execution.equipment?.truck || 0.90);
    if (travelHealth < 1.40) { // Both below 0.70
      const travelPenalty = -0.03;
      multiplier += travelPenalty;
      breakdown.travelCondition = travelPenalty;
    }

    // FACTOR 4: Section Morale (±8%)
    // Emotional state of performers
    const sectionMorale = getSectionMorale(caption, execution.morale);
    const moraleBonus = (sectionMorale - 0.75) * 0.32; // Range: -0.08 to +0.08
    multiplier += moraleBonus;
    breakdown.morale = moraleBonus;

    // FACTOR 5: Show Difficulty Risk/Reward (±15%)
    // High difficulty = high ceiling, needs preparation
    const showDifficulty = execution.showDesign || { difficulty: 5, preparednessThreshold: 0.80, ceilingBonus: 0.08, riskPenalty: -0.10 };
    const avgReadiness = calculateAverageReadiness(execution.readiness);

    if (avgReadiness >= showDifficulty.preparednessThreshold) {
      // Well-prepared: Get the ceiling bonus!
      multiplier += showDifficulty.ceilingBonus;
      breakdown.showDifficulty = showDifficulty.ceilingBonus;
    } else {
      // Under-prepared: Take the risk penalty
      multiplier += showDifficulty.riskPenalty;
      breakdown.showDifficulty = showDifficulty.riskPenalty;
    }

    // FACTOR 6: Random Variance (±2%)
    // Represents day-to-day unpredictability (weather, nerves, etc.)
    const variance = (Math.random() - 0.5) * 0.04;
    multiplier += variance;
    breakdown.randomVariance = variance;

    // FACTOR 7: Championship Pressure (Finals only, ±2%)
    // High-stakes moments affect execution
    if (scoredDay >= 47 && scoredDay <= 49) {
      const pressureHandling = execution.morale?.overall || 0.80;
      const pressureEffect = (pressureHandling - 0.80) * 0.10; // Range: -0.02 to +0.02
      multiplier += pressureEffect;
      breakdown.championshipPressure = pressureEffect;
    }

    // FACTOR 8: Fatigue (Late season, -5% max)
    // Corps get tired as season progresses
    if (scoredDay > 35) {
      const fatigueLevel = (scoredDay - 35) / 14; // 0 to 1 over final 2 weeks
      const fatiguePenalty = -0.05 * fatigueLevel;
      multiplier += fatiguePenalty;
      breakdown.fatigue = fatiguePenalty;
    }

    // Clamp to realistic bounds (0.70 - 1.10)
    const finalMultiplier = Math.max(0.70, Math.min(1.10, multiplier));

    // Log execution result
    logger.info(`Execution for ${uid}/${corpsClass}/${caption}: ${finalMultiplier.toFixed(3)}`, {
      breakdown,
      day: scoredDay,
      event: eventName
    });

    // Store execution history (for analytics)
    await storeExecutionHistory(uid, corpsClass, caption, scoredDay, eventName, finalMultiplier, breakdown);

    return finalMultiplier;

  } catch (error) {
    logger.error(`Error calculating execution multiplier for ${uid}/${corpsClass}/${caption}:`, error);
    return 0.90; // Safe fallback
  }
}

/**
 * Map caption to section for readiness/morale lookup
 */
function getSectionReadiness(caption, readiness) {
  const sectionMap = {
    B: 'brass',
    MA: 'brass',
    P: 'percussion',
    VP: 'guard',
    VA: 'guard',
    CG: 'guard',
    GE1: 'ensemble',
    GE2: 'ensemble'
  };

  const section = sectionMap[caption] || 'ensemble';
  return readiness?.[section] || 0.75; // Default if not set
}

/**
 * Get equipment health for caption type
 */
function getEquipmentHealth(caption, equipment) {
  const equipmentMap = {
    B: 'instruments',
    MA: 'instruments',
    P: 'instruments',
    VP: 'uniforms',
    VA: 'uniforms',
    CG: 'props'
  };

  const equipmentType = equipmentMap[caption] || 'instruments';
  return equipment?.[equipmentType] || 0.90;
}

/**
 * Get section morale
 */
function getSectionMorale(caption, morale) {
  const sectionMap = {
    B: 'brass',
    MA: 'brass',
    P: 'percussion',
    VP: 'guard',
    VA: 'guard',
    CG: 'guard',
    GE1: 'overall',
    GE2: 'overall'
  };

  const section = sectionMap[caption] || 'overall';
  return morale?.[section] || 0.75;
}

/**
 * Calculate average readiness across all sections
 */
function calculateAverageReadiness(readiness) {
  if (!readiness) return 0.75;

  const sections = ['brass', 'percussion', 'guard', 'ensemble'];
  const values = sections.map(s => readiness[s] || 0.75);
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Get staff effectiveness for assigned staff member
 */
async function getStaffEffectiveness(uid, corpsClass, caption, staffArray) {
  if (!staffArray || staffArray.length === 0) {
    return 0.75; // No staff = below average
  }

  // Find staff assigned to this caption
  const assignedStaff = staffArray.find(s =>
    s.assignedTo?.corpsClass === corpsClass &&
    s.assignedTo?.caption === caption
  );

  if (!assignedStaff) {
    return 0.75; // No staff assigned = below average
  }

  // Get staff details from database
  const db = getDb();
  const staffDoc = await db.doc(`staff_database/${assignedStaff.staffId}`).get();

  if (!staffDoc.exists) {
    return 0.80; // Staff not found, use default
  }

  const staffData = staffDoc.data();
  let effectiveness = 0.80; // Base effectiveness

  // Caption match bonus (staff teaching their specialty)
  if (staffData.caption === caption) {
    effectiveness += 0.15; // Perfect match!
  } else {
    effectiveness -= 0.05; // Teaching outside specialty
  }

  // Experience bonus (from seasons completed)
  const experienceBonus = Math.min((assignedStaff.seasonsCompleted || 0) * 0.01, 0.10);
  effectiveness += experienceBonus;

  // Hall of Fame bonus (elite staff)
  if (staffData.baseValue > 500) {
    effectiveness += 0.05;
  }

  // Morale factor (overworked staff less effective)
  const staffMorale = assignedStaff.morale || 0.90;
  effectiveness *= staffMorale;

  return Math.min(effectiveness, 1.00); // Cap at 100%
}

/**
 * Store execution history for analytics
 */
async function storeExecutionHistory(uid, corpsClass, caption, day, eventName, multiplier, breakdown) {
  const db = getDb();
  const userRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);

  try {
    await userRef.update({
      [`corps.${corpsClass}.execution.performanceHistory`]: require('firebase-admin').firestore.FieldValue.arrayUnion({
        day,
        event: eventName,
        caption,
        multiplier,
        breakdown,
        timestamp: new Date()
      })
    });
  } catch (error) {
    // Non-critical, just log
    logger.warn(`Failed to store execution history: ${error.message}`);
  }
}

/**
 * Initialize execution state for new corps
 */
function getDefaultExecutionState() {
  return {
    readiness: {
      brass: 0.75,
      percussion: 0.75,
      guard: 0.75,
      ensemble: 0.75
    },
    morale: {
      brass: 0.80,
      percussion: 0.80,
      guard: 0.80,
      overall: 0.80
    },
    equipment: {
      instruments: 0.90,
      uniforms: 0.90,
      props: 0.90,
      bus: 0.90,
      truck: 0.90
    },
    showDesign: {
      difficulty: 5,
      preparednessThreshold: 0.80,
      ceilingBonus: 0.08,
      riskPenalty: -0.10
    },
    lastRehearsalDay: 0,
    rehearsalStreak: 0,
    performanceHistory: []
  };
}

module.exports = {
  calculateExecutionMultiplier,
  getDefaultExecutionState
};
