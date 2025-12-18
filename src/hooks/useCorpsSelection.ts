// =============================================================================
// CORPS SELECTION HOOK
// =============================================================================
// Manages active corps selection and switching
// Usage: const { activeCorpsClass, handleCorpsSwitch } = useCorpsSelection(uid, corps);

import { useState, useEffect, useCallback } from 'react';
import type { CorpsClass, CorpsData } from '../types';
import toast from 'react-hot-toast';
import { getCorpsClassName, getCorpsClassColor } from '../utils/corps';

// Re-export for backwards compatibility
export { getCorpsClassName, getCorpsClassColor };

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

// Valid class names for validation
const VALID_CLASSES: CorpsClass[] = ['soundSport', 'aClass', 'open', 'world'];

// =============================================================================
// HOOK
// =============================================================================

export function useCorpsSelection(
  uid: string | undefined,
  corps: Record<CorpsClass, CorpsData | undefined> | null
): UseCorpsSelectionReturn {
  const [selectedCorpsClass, setSelectedCorpsClass] = useState<CorpsClass | null>(null);

  // Derived values - sorted by class order (world, open, a, soundsport)
  const CLASS_ORDER: Record<string, number> = { worldClass: 0, openClass: 1, aClass: 2, soundSport: 3 };
  const corpsEntries = corps
    ? Object.entries(corps)
        .filter(([_, data]) => data)
        .sort((a, b) => (CLASS_ORDER[a[0]] ?? 99) - (CLASS_ORDER[b[0]] ?? 99))
    : [];
  const hasMultipleCorps = corpsEntries.length > 1;
  const firstCorpsClass = corpsEntries.length > 0 ? (corpsEntries[0][0] as CorpsClass) : null;
  const activeCorpsClass = selectedCorpsClass || firstCorpsClass;
  const activeCorps = activeCorpsClass && corps ? (corps[activeCorpsClass] || null) : null;

  // Load selected corps from localStorage on mount
  useEffect(() => {
    if (uid) {
      const savedCorpsClass = localStorage.getItem(`selectedCorps_${uid}`);
      if (savedCorpsClass && VALID_CLASSES.includes(savedCorpsClass as CorpsClass)) {
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
      const corpsClasses = (Object.keys(corps).filter(
        (key) => corps[key as CorpsClass]
      ) as CorpsClass[]).sort((a, b) => (CLASS_ORDER[a] ?? 99) - (CLASS_ORDER[b] ?? 99));

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
