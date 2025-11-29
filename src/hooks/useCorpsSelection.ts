// =============================================================================
// CORPS SELECTION HOOK
// =============================================================================
// Manages active corps selection and switching
// Usage: const { activeCorpsClass, handleCorpsSwitch } = useCorpsSelection(uid, corps);

import { useState, useEffect, useCallback } from 'react';
import type { CorpsClass, CorpsData } from '../types';
import toast from 'react-hot-toast';

// =============================================================================
// TYPES
// =============================================================================

export interface UseCorpsSelectionReturn {
  selectedCorpsClass: CorpsClass | null;
  setSelectedCorpsClass: (classId: CorpsClass | null) => void;
  activeCorpsClass: CorpsClass | null;
  activeCorps: CorpsData | null;
  hasMultipleCorps: boolean;
  handleCorpsSwitch: (classId: CorpsClass) => void;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

const CLASS_NAMES: Record<CorpsClass, string> = {
  soundSport: 'SoundSport',
  aClass: 'A Class',
  open: 'Open Class',
  world: 'World Class',
};

const CLASS_COLORS: Record<CorpsClass, string> = {
  soundSport: 'text-green-500 bg-green-500/10 border-green-500/30',
  aClass: 'text-blue-500 bg-blue-500/10 border-blue-500/30',
  open: 'text-purple-500 bg-purple-500/10 border-purple-500/30',
  world: 'text-gold-500 bg-gold-500/10 border-gold-500/30',
};

export function getCorpsClassName(classId: CorpsClass | string): string {
  return CLASS_NAMES[classId as CorpsClass] || classId;
}

export function getCorpsClassColor(classId: CorpsClass | string): string {
  return CLASS_COLORS[classId as CorpsClass] || 'text-cream-500 bg-cream-500/10 border-cream-500/30';
}

// =============================================================================
// HOOK
// =============================================================================

export function useCorpsSelection(
  uid: string | undefined,
  corps: Record<CorpsClass, CorpsData | undefined> | null
): UseCorpsSelectionReturn {
  const [selectedCorpsClass, setSelectedCorpsClass] = useState<CorpsClass | null>(null);

  // Derived values
  const corpsEntries = corps ? Object.entries(corps).filter(([_, data]) => data) : [];
  const hasMultipleCorps = corpsEntries.length > 1;
  const firstCorpsClass = corpsEntries.length > 0 ? (corpsEntries[0][0] as CorpsClass) : null;
  const activeCorpsClass = selectedCorpsClass || firstCorpsClass;
  const activeCorps = activeCorpsClass && corps ? (corps[activeCorpsClass] || null) : null;

  // Load selected corps from localStorage on mount
  useEffect(() => {
    if (uid) {
      const savedCorpsClass = localStorage.getItem(`selectedCorps_${uid}`);
      if (savedCorpsClass && CLASS_NAMES[savedCorpsClass as CorpsClass]) {
        setSelectedCorpsClass(savedCorpsClass as CorpsClass);
      }
    }
  }, [uid]);

  // Save selected corps to localStorage when it changes
  useEffect(() => {
    if (uid && selectedCorpsClass) {
      localStorage.setItem(`selectedCorps_${uid}`, selectedCorpsClass);
    }
  }, [uid, selectedCorpsClass]);

  // Update selected corps when corps data changes
  useEffect(() => {
    if (corps) {
      const corpsClasses = Object.keys(corps).filter(
        (key) => corps[key as CorpsClass]
      ) as CorpsClass[];

      if (selectedCorpsClass && !corpsClasses.includes(selectedCorpsClass)) {
        setSelectedCorpsClass(corpsClasses[0] || null);
      }
      if (!selectedCorpsClass && corpsClasses.length > 0) {
        setSelectedCorpsClass(corpsClasses[0]);
      }
    }
  }, [corps, selectedCorpsClass]);

  // Corps switching handler
  const handleCorpsSwitch = useCallback((classId: CorpsClass) => {
    setSelectedCorpsClass(classId);
    toast.success(`Switched to ${getCorpsClassName(classId)}`);
  }, []);

  return {
    selectedCorpsClass,
    setSelectedCorpsClass,
    activeCorpsClass,
    activeCorps,
    hasMultipleCorps,
    handleCorpsSwitch,
  };
}

export default useCorpsSelection;
