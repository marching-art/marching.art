// src/hooks/useExecution.js
import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../firebase';
import toast from 'react-hot-toast';

export const useExecution = (userId, corpsClass) => {
  const [executionState, setExecutionState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const functions = getFunctions();

  useEffect(() => {
    if (!userId || !corpsClass) {
      setLoading(false);
      return;
    }

    // Subscribe to profile document where execution state is stored
    const profileRef = doc(
      db,
      'artifacts/marching-art/users',
      userId,
      'profile',
      'data'
    );

    const unsubscribe = onSnapshot(profileRef, async (docSnap) => {
      if (docSnap.exists()) {
        const profileData = docSnap.data();
        const execution = profileData.corps?.[corpsClass]?.execution;

        if (execution) {
          setExecutionState(execution);
          setLoading(false);
        } else {
          // Initialize execution state via Cloud Function
          try {
            const getStatus = httpsCallable(functions, 'getExecutionStatus');
            await getStatus({ corpsClass });
            // The snapshot listener will update state when data is created
          } catch (error) {
            console.error('Error initializing execution:', error);
            // Set default local state as fallback
            setExecutionState({
              readiness: 0.85,
              morale: 0.90,
              equipment: {
                uniforms: { condition: 1.0, level: 1 },
                instruments: { condition: 1.0, level: 1 },
                props: { condition: 1.0, level: 1 }
              },
              staff: [],
              lastRehearsalDate: null,
              rehearsalsThisWeek: 0,
              showDifficulty: 'medium'
            });
            setLoading(false);
          }
        }
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [userId, corpsClass, functions]);

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
  const calculateMultiplier = () => {
    if (!executionState) return 1.0;

    const { readiness = 0, morale = 0, equipment = {}, staff = [] } = executionState;

    // Average equipment condition
    const equipmentConditions = Object.values(equipment).map(e => e.condition || 0);
    const avgEquipment = equipmentConditions.length > 0
      ? equipmentConditions.reduce((sum, c) => sum + c, 0) / equipmentConditions.length
      : 0;

    // Staff effectiveness (0.95-1.05 range)
    const staffBonus = Math.min(staff.length * 0.01, 0.05);

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
