// src/hooks/useExecution.js
import { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import toast from 'react-hot-toast';

export const useExecution = (userId, corpsClass) => {
  const [executionState, setExecutionState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const initializingRef = useRef(false);

  useEffect(() => {
    if (!userId || !corpsClass) {
      setLoading(false);
      return;
    }

    initializingRef.current = false;

    // Subscribe to profile document where execution state is stored
    const profileRef = doc(
      db,
      'artifacts/marching-art/users',
      userId,
      'profile',
      'data'
    );

    const unsubscribe = onSnapshot(profileRef, (docSnap) => {
      if (docSnap.exists()) {
        const profileData = docSnap.data();
        const execution = profileData.corps?.[corpsClass]?.execution;

        if (execution) {
          setExecutionState(execution);
          setLoading(false);
        } else if (!initializingRef.current) {
          // Initialize execution state via Cloud Function (only once)
          initializingRef.current = true;
          const getStatus = httpsCallable(functions, 'getExecutionStatus');
          getStatus({ corpsClass })
            .catch((error) => {
              console.error('Error initializing execution:', error);
              // Set default local state as fallback (using flat number format matching backend)
              setExecutionState({
                readiness: 0.85,
                morale: 0.90,
                equipment: {
                  uniforms: 0.90,
                  instruments: 0.90,
                  props: 0.90,
                  uniformsMax: 1.00,
                  instrumentsMax: 1.00,
                  propsMax: 1.00
                },
                staff: [],
                lastRehearsalDate: null,
                rehearsalsThisWeek: 0,
                showDifficulty: 'medium'
              });
              setLoading(false);
            });
          // The snapshot listener will update state when data is created
        }
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [userId, corpsClass]);

  // Daily rehearsal function
  const rehearse = async () => {
    if (!userId || !corpsClass) return { success: false };

    setProcessing(true);
    try {
      const dailyRehearsal = httpsCallable(functions, 'dailyRehearsal');
      const result = await dailyRehearsal({ corpsClass });

      if (result.data.success) {
        toast.success(`Rehearsal complete! +${result.data.xpGained} XP`);
        return { success: true, data: result.data };
      } else {
        toast.error(result.data.message || 'Rehearsal failed');
        return { success: false };
      }
    } catch (error) {
      console.error('Error during rehearsal:', error);
      toast.error(error.message || 'Failed to complete rehearsal');
      return { success: false };
    } finally {
      setProcessing(false);
    }
  };

  // Repair equipment function
  const repairEquipment = async (equipmentType) => {
    if (!userId || !corpsClass) return { success: false };

    setProcessing(true);
    try {
      const repair = httpsCallable(functions, 'repairEquipment');
      const result = await repair({ corpsClass, equipmentType });

      if (result.data.success) {
        toast.success(`${equipmentType} repaired!`);
        return { success: true, data: result.data };
      } else {
        toast.error(result.data.message || 'Repair failed');
        return { success: false };
      }
    } catch (error) {
      console.error('Error repairing equipment:', error);
      toast.error(error.message || 'Failed to repair equipment');
      return { success: false };
    } finally {
      setProcessing(false);
    }
  };

  // Upgrade equipment function
  const upgradeEquipment = async (equipmentType) => {
    if (!userId || !corpsClass) return { success: false };

    setProcessing(true);
    try {
      const upgrade = httpsCallable(functions, 'upgradeEquipment');
      const result = await upgrade({ corpsClass, equipmentType });

      if (result.data.success) {
        toast.success(`${equipmentType} upgraded to level ${result.data.newLevel}!`);
        return { success: true, data: result.data };
      } else {
        toast.error(result.data.message || 'Upgrade failed');
        return { success: false };
      }
    } catch (error) {
      console.error('Error upgrading equipment:', error);
      toast.error(error.message || 'Failed to upgrade equipment');
      return { success: false };
    } finally {
      setProcessing(false);
    }
  };

  // Set show difficulty function
  const setShowDifficulty = async (difficulty) => {
    if (!userId || !corpsClass) return { success: false };

    setProcessing(true);
    try {
      const setDifficulty = httpsCallable(functions, 'setShowDifficulty');
      const result = await setDifficulty({ corpsClass, difficulty });

      if (result.data.success) {
        toast.success(`Show difficulty set to ${difficulty}`);
        return { success: true, data: result.data };
      } else {
        toast.error(result.data.message || 'Failed to set difficulty');
        return { success: false };
      }
    } catch (error) {
      console.error('Error setting difficulty:', error);
      toast.error(error.message || 'Failed to set difficulty');
      return { success: false };
    } finally {
      setProcessing(false);
    }
  };

  // Boost morale function
  const boostMorale = async () => {
    if (!userId || !corpsClass) return { success: false };

    setProcessing(true);
    try {
      const boost = httpsCallable(functions, 'boostMorale');
      const result = await boost({ corpsClass });

      if (result.data.success) {
        toast.success('Morale boosted!');
        return { success: true, data: result.data };
      } else {
        toast.error(result.data.message || 'Morale boost failed');
        return { success: false };
      }
    } catch (error) {
      console.error('Error boosting morale:', error);
      toast.error(error.message || 'Failed to boost morale');
      return { success: false };
    } finally {
      setProcessing(false);
    }
  };

  // Get execution status
  const getExecutionStatus = async () => {
    if (!userId || !corpsClass) return { success: false };

    try {
      const getStatus = httpsCallable(functions, 'getExecutionStatus');
      const result = await getStatus({ corpsClass });

      if (result.data.success) {
        return { success: true, data: result.data };
      } else {
        return { success: false };
      }
    } catch (error) {
      console.error('Error getting execution status:', error);
      return { success: false };
    }
  };

  // Calculate current execution multiplier
  // Note: This is an approximation - actual scoring uses per-caption calculations
  const calculateMultiplier = (currentDay = 1) => {
    if (!executionState) return { multiplier: 0.90, breakdown: {} };

    const { readiness = 0.75, morale = 0.80, equipment = {}, showDesign } = executionState;

    // Helper to extract condition value from either flat number or object format
    const getConditionValue = (value) => {
      if (typeof value === 'number') return value;
      if (typeof value === 'object' && value?.condition !== undefined) return value.condition;
      return 0.90;
    };

    // Average equipment condition (handles both flat numbers and objects)
    // Filter out "Max" keys which store upgrade limits, and bus/truck which have separate travel penalty
    const equipmentConditions = Object.entries(equipment)
      .filter(([key]) => !key.includes('Max') && !key.includes('bus') && !key.includes('truck'))
      .map(([, value]) => getConditionValue(value))
      .filter(v => v > 0);
    const avgEquipment = equipmentConditions.length > 0
      ? equipmentConditions.reduce((sum, c) => sum + c, 0) / equipmentConditions.length
      : 0.90;

    // Start at 1.00 (100% - perfect execution)
    let multiplier = 1.00;
    const breakdown = {};

    // FACTOR 1: Readiness (±12%)
    // Baseline is 0.80 (80%) - above that helps, below hurts
    const readinessBonus = (readiness - 0.80) * 0.60;
    multiplier += readinessBonus;
    breakdown.readiness = {
      value: readinessBonus,
      current: readiness,
      description: `${readiness >= 0.80 ? '+' : ''}${(readinessBonus * 100).toFixed(1)}% (${Math.round(readiness * 100)}% readiness)`
    };

    // FACTOR 2: Staff Effectiveness (±8%)
    // Staff bonus is per-caption in backend, simplified here for display
    // No staff = 0.75 effectiveness, good staff = up to 1.00
    const staffArray = executionState.staff || [];
    const staffEffectiveness = staffArray.length > 0
      ? Math.min(0.80 + (staffArray.length * 0.03), 1.00)
      : 0.75;
    const staffBonus = (staffEffectiveness - 0.80) * 0.40;
    multiplier += staffBonus;
    breakdown.staff = {
      value: staffBonus,
      count: staffArray.length,
      effectiveness: staffEffectiveness,
      description: `${staffBonus >= 0 ? '+' : ''}${(staffBonus * 100).toFixed(1)}% (${staffArray.length} staff)`
    };

    // FACTOR 3: Equipment Condition (-5% to +10%)
    // Baseline is 1.00 (100%) - below hurts, upgraded above can help
    const equipmentPenalty = (avgEquipment - 1.00) * 0.50;
    multiplier += equipmentPenalty;
    breakdown.equipment = {
      value: equipmentPenalty,
      current: avgEquipment,
      description: `${equipmentPenalty >= 0 ? '+' : ''}${(equipmentPenalty * 100).toFixed(1)}% (${Math.round(avgEquipment * 100)}% condition)`
    };

    // Travel condition penalty (bus + truck)
    const busCondition = getConditionValue(equipment.bus) || 0.90;
    const truckCondition = getConditionValue(equipment.truck) || 0.90;
    if (busCondition < 0.70 && truckCondition < 0.70) {
      const travelPenalty = -0.03;
      multiplier += travelPenalty;
      breakdown.travel = {
        value: travelPenalty,
        description: '-3% (poor travel conditions)'
      };
    }

    // FACTOR 4: Morale (±8%)
    // Baseline is 0.75 (75%) - above helps, below hurts
    const moraleBonus = (morale - 0.75) * 0.32;
    multiplier += moraleBonus;
    breakdown.morale = {
      value: moraleBonus,
      current: morale,
      description: `${moraleBonus >= 0 ? '+' : ''}${(moraleBonus * 100).toFixed(1)}% (${Math.round(morale * 100)}% morale)`
    };

    // FACTOR 5: Show Difficulty (-20% to +15%)
    // High difficulty = high ceiling if prepared, high risk if not
    const difficulty = showDesign || {
      difficulty: 5,
      preparednessThreshold: 0.80,
      ceilingBonus: 0.08,
      riskPenalty: -0.10
    };
    const isPrepared = readiness >= difficulty.preparednessThreshold;
    const difficultyEffect = isPrepared ? difficulty.ceilingBonus : difficulty.riskPenalty;
    multiplier += difficultyEffect;
    breakdown.showDifficulty = {
      value: difficultyEffect,
      isPrepared,
      threshold: difficulty.preparednessThreshold,
      description: isPrepared
        ? `+${(difficulty.ceilingBonus * 100).toFixed(0)}% (prepared for difficulty ${difficulty.difficulty})`
        : `${(difficulty.riskPenalty * 100).toFixed(0)}% (under-prepared, need ${Math.round(difficulty.preparednessThreshold * 100)}% readiness)`
    };

    // FACTOR 6: Late Season Fatigue (day 35+, up to -5%)
    if (currentDay > 35) {
      const fatigueLevel = (currentDay - 35) / 14;
      const fatiguePenalty = -0.05 * Math.min(fatigueLevel, 1);
      multiplier += fatiguePenalty;
      breakdown.fatigue = {
        value: fatiguePenalty,
        description: `${(fatiguePenalty * 100).toFixed(1)}% (late season fatigue)`
      };
    }

    // FACTOR 7: Championship Pressure (days 47-49, ±2%)
    if (currentDay >= 47 && currentDay <= 49) {
      const pressureEffect = (morale - 0.80) * 0.10;
      multiplier += pressureEffect;
      breakdown.championship = {
        value: pressureEffect,
        description: `${pressureEffect >= 0 ? '+' : ''}${(pressureEffect * 100).toFixed(1)}% (championship pressure)`
      };
    }

    // Note: Random variance (±2%) happens at scoring time, not shown here

    // Clamp to realistic bounds (0.70 - 1.10)
    const finalMultiplier = Math.max(0.70, Math.min(1.10, multiplier));

    return {
      multiplier: finalMultiplier,
      rawMultiplier: multiplier,
      breakdown,
      clamped: multiplier !== finalMultiplier
    };
  };

  // Check if can rehearse today
  const canRehearseToday = () => {
    if (!executionState || !executionState.lastRehearsalDate) return true;

    const lastRehearsalValue = executionState.lastRehearsalDate;
    const lastRehearsal = lastRehearsalValue?.toDate
      ? lastRehearsalValue.toDate()
      : new Date(lastRehearsalValue);
    const today = new Date();

    // Reset hours to compare just the date
    lastRehearsal.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    return lastRehearsal.getTime() !== today.getTime();
  };

  return {
    executionState,
    loading,
    processing,
    rehearse,
    repairEquipment,
    upgradeEquipment,
    setShowDifficulty,
    boostMorale,
    getExecutionStatus,
    calculateMultiplier,
    canRehearseToday
  };
};
