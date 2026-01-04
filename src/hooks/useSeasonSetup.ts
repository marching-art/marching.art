// =============================================================================
// SEASON SETUP HOOK
// =============================================================================
// Manages season setup wizard state and corps needing setup detection
// Usage: const { showWizard, corpsNeedingSetup } = useSeasonSetup(profile, corps, seasonData);

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import type { UserProfile, CorpsData, CorpsClass, SeasonData } from '../types';

// =============================================================================
// TYPES
// =============================================================================

export interface UseSeasonSetupReturn {
  showSeasonSetupWizard: boolean;
  setShowSeasonSetupWizard: (show: boolean) => void;
  corpsNeedingSetup: CorpsClass[];
  handleSeasonSetupComplete: () => void;
}

// =============================================================================
// HOOK
// =============================================================================

export function useSeasonSetup(
  profile: UserProfile | null,
  corps: Record<CorpsClass, CorpsData | undefined> | null,
  seasonData: SeasonData | null,
  loading: boolean,
  seasonLoading: boolean
): UseSeasonSetupReturn {
  const [showSeasonSetupWizard, setShowSeasonSetupWizard] = useState(false);
  const [corpsNeedingSetup, setCorpsNeedingSetup] = useState<CorpsClass[]>([]);

  // Detect corps that need season setup
  useEffect(() => {
    if (!profile || !seasonData || loading || seasonLoading) return;

    // Skip wizard if initial setup was already completed for this season
    // This prevents the wizard from showing repeatedly after the user has
    // already gone through the initial registration/show selection process
    if (profile.initialSetupComplete === seasonData.seasonUid) {
      setCorpsNeedingSetup([]);
      setShowSeasonSetupWizard(false);
      return;
    }

    const needSetup: CorpsClass[] = [];
    const hasCorps = corps && Object.keys(corps).length > 0;
    const hasRetiredCorps = profile.retiredCorps && profile.retiredCorps.length > 0;
    const unlockedClasses = profile.unlockedClasses || ['soundSport'];

    if (corps) {
      Object.entries(corps).forEach(([classId, corpsData]) => {
        if (!corpsData) return;
        const hasLineup = corpsData.lineup && Object.keys(corpsData.lineup).length === 8;
        if (!hasLineup && corpsData.corpsName) {
          needSetup.push(classId as CorpsClass);
        }
      });
    }

    const hasEligibleNewClasses = unlockedClasses.some((classId) => {
      return !corps?.[classId as CorpsClass]?.corpsName;
    });

    const shouldShowWizard =
      needSetup.length > 0 ||
      (hasCorps && needSetup.length > 0) ||
      (hasRetiredCorps && !hasCorps) ||
      (hasEligibleNewClasses && !hasCorps && hasRetiredCorps);

    if (shouldShowWizard) {
      setCorpsNeedingSetup(needSetup);
      setShowSeasonSetupWizard(true);
    } else {
      setCorpsNeedingSetup([]);
      setShowSeasonSetupWizard(false);
    }
  }, [profile, corps, seasonData, loading, seasonLoading]);

  const handleSeasonSetupComplete = useCallback(() => {
    setShowSeasonSetupWizard(false);
    setCorpsNeedingSetup([]);
    toast.success('Season setup complete! Time to compete!');
  }, []);

  return {
    showSeasonSetupWizard,
    setShowSeasonSetupWizard,
    corpsNeedingSetup,
    handleSeasonSetupComplete,
  };
}

export default useSeasonSetup;
