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
  // Optional staffCount param allows override from marketplace data
  const calculateMultiplier = (staffCount = null) => {
    if (!executionState) return 1.0;

    const { readiness = 0, morale = 0, equipment = {}, staff = [] } = executionState;

    // Helper to extract condition value from either flat number or object format
    const getConditionValue = (value) => {
      if (typeof value === 'number') return value;
      if (typeof value === 'object' && value?.condition !== undefined) return value.condition;
      return 0;
    };

    // Average equipment condition (handles both flat numbers and objects)
    // Filter out "Max" keys which store upgrade limits
    const equipmentConditions = Object.entries(equipment)
      .filter(([key]) => !key.includes('Max') && !key.includes('bus') && !key.includes('truck'))
      .map(([, value]) => getConditionValue(value))
      .filter(v => v > 0);
    const avgEquipment = equipmentConditions.length > 0
      ? equipmentConditions.reduce((sum, c) => sum + c, 0) / equipmentConditions.length
      : 0.90;

    // Staff bonus: use provided staffCount if available, otherwise fall back to executionState
    const effectiveStaffCount = staffCount !== null ? staffCount : staff.length;
    const staffBonus = Math.min(effectiveStaffCount * 0.01, 0.05);

    // Base calculation
    const baseMultiplier = (readiness * 0.4) + (morale * 0.3) + (avgEquipment * 0.3);

    // Apply staff bonus and clamp to 0.70-1.10
    const multiplier = Math.max(0.70, Math.min(1.10, baseMultiplier + staffBonus));

    return multiplier;
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
