// src/hooks/useDashboardData.js
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { db } from '../api';
import { doc, updateDoc } from 'firebase/firestore';
import { getSeasonRecaps, getCorpsValues } from '../api/season';
import { queryKeys } from '../lib/queryClient';
import { useSeason, getSeasonProgress } from './useSeason';
import { useProfileStore } from '../store/profileStore';
import toast from 'react-hot-toast';
import { getCorpsClassName, getCorpsClassColor } from '../utils/corps';
import { formatSeasonName } from '../utils/season';

/**
 * Custom hook that centralizes all dashboard data fetching and state management.
 * This reduces the main Dashboard component complexity significantly.
 *
 * NOTE: Profile data now comes from the global profileStore to prevent
 * duplicate Firestore listeners. The store is initialized in App.jsx.
 */
export const useDashboardData = () => {
  const { user } = useAuth();
  const { seasonData, loading: seasonLoading, weeksRemaining } = useSeason();

  // Get profile data from global store (singleton listener)
  const storeProfile = useProfileStore((state) => state.profile);
  const storeCorps = useProfileStore((state) => state.corps);
  const storeLoading = useProfileStore((state) => state.loading);
  const storeIsAdmin = useProfileStore((state) => state.isAdmin);

  // Core state - profile and corps now come from store
  const profile = storeProfile;
  const loading = storeLoading;
  const corps = storeCorps;
  const isAdmin = storeIsAdmin;
  // Compute unlocked classes directly (admins get all classes)
  // Must compute here rather than using store method so React tracks the isAdmin dependency
  // Note: class IDs are 'worldClass', 'openClass', 'aClass', 'soundSport'
  const unlockedClasses = useMemo(
    () =>
      isAdmin
        ? ['worldClass', 'openClass', 'aClass', 'soundSport']
        : profile?.unlockedClasses || ['soundSport'],
    [isAdmin, profile?.unlockedClasses]
  );

  // Additional local state
  const [availableCorps, setAvailableCorps] = useState([]);
  const [selectedCorpsClass, setSelectedCorpsClass] = useState(null);

  // Class unlock tracking - use ref to avoid re-render loops
  const [newlyUnlockedClass, setNewlyUnlockedClass] = useState(null);
  const previousUnlockedClassesRef = useRef([]);

  // Guard to prevent duplicate milestone Firestore writes within same session
  const milestonesProcessedRef = useRef(new Map()); // Map<classKey, {rank, score}>

  // Engagement data
  const [engagementData, setEngagementData] = useState({
    loginStreak: 0,
    lastLogin: null,
    totalLogins: 0,
    recentActivity: [],
    weeklyProgress: [],
  });

  // Season setup
  const [showSeasonSetupWizard, setShowSeasonSetupWizard] = useState(false);
  const [corpsNeedingSetup, setCorpsNeedingSetup] = useState([]);

  // Achievement state
  const [newAchievement, setNewAchievement] = useState(null);

  // Derived values
  const activeCorpsClass = selectedCorpsClass || (corps ? Object.keys(corps)[0] : null);
  const activeCorps = activeCorpsClass && corps ? corps[activeCorpsClass] : null;
  const hasMultipleCorps = corps && Object.keys(corps).length > 1;
  const { currentWeek, currentDay } = seasonData
    ? getSeasonProgress(seasonData)
    : { currentWeek: 1, currentDay: 1 };

  // CONSOLIDATED: Corps selection state management
  // Combines localStorage load/save and corps data sync into single effect
  // This prevents cascading effect chains when corps data changes
  useEffect(() => {
    if (!user) return;

    const corpsClasses = corps ? Object.keys(corps) : [];
    const storageKey = `selectedCorps_${user.uid}`;

    // On mount or user change: load from localStorage
    if (selectedCorpsClass === null) {
      const savedCorpsClass = localStorage.getItem(storageKey);
      if (savedCorpsClass && corpsClasses.includes(savedCorpsClass)) {
        setSelectedCorpsClass(savedCorpsClass);
        return;
      }
    }

    // Sync selection with available corps
    if (corpsClasses.length > 0) {
      if (selectedCorpsClass && !corpsClasses.includes(selectedCorpsClass)) {
        // Current selection no longer valid, reset to first available
        setSelectedCorpsClass(corpsClasses[0]);
      } else if (!selectedCorpsClass) {
        // No selection, set to first available
        setSelectedCorpsClass(corpsClasses[0]);
      } else {
        // Valid selection, persist to localStorage
        localStorage.setItem(storageKey, selectedCorpsClass);
      }
    }
  }, [user, corps, selectedCorpsClass]);

  // Detect when a new class is unlocked
  // Uses ref to track previous value without triggering re-renders
  // Note: For admins, all classes are always unlocked so this won't trigger
  useEffect(() => {
    if (!unlockedClasses || unlockedClasses.length === 0) return;

    const currentUnlocked = unlockedClasses;
    const previousUnlocked = previousUnlockedClassesRef.current;

    // Only check for new unlocks if we have a previous state to compare
    if (previousUnlocked.length > 0) {
      const newlyUnlocked = currentUnlocked.filter(
        (classId) => !previousUnlocked.includes(classId)
      );
      // Filter out classes where user already has a corps (e.g., purchased before XP unlock)
      // This prevents showing "class unlocked" notification when they already have a corps
      const newlyUnlockedWithoutCorps = newlyUnlocked.filter((classId) => !corps?.[classId]);
      if (newlyUnlockedWithoutCorps.length > 0) {
        setNewlyUnlockedClass(newlyUnlockedWithoutCorps[0]);
      }
    }

    // Update ref for next comparison (doesn't trigger re-render)
    previousUnlockedClassesRef.current = currentUnlocked;
  }, [unlockedClasses, corps]);

  // NOTE: Profile subscription is now handled by profileStore (initialized in App.jsx)
  // This eliminates duplicate Firestore listeners when multiple components use this hook

  // Detect corps that need season setup
  useEffect(() => {
    if (profile && seasonData && !loading && !seasonLoading) {
      // Skip wizard if initial setup was already completed for this season
      if (profile.initialSetupComplete === seasonData.seasonUid) {
        setCorpsNeedingSetup([]);
        setShowSeasonSetupWizard(false);
        return;
      }

      // Skip if user has any show registrations (means they already completed initial setup)
      if (corps) {
        const hasAnyShowRegistrations = Object.values(corps).some((corpsData) => {
          if (!corpsData?.selectedShows) return false;
          return Object.values(corpsData.selectedShows).some(
            (shows) => Array.isArray(shows) && shows.length > 0
          );
        });

        if (hasAnyShowRegistrations) {
          setCorpsNeedingSetup([]);
          setShowSeasonSetupWizard(false);
          return;
        }
      }

      const needSetup = [];
      const hasCorps = corps && Object.keys(corps).length > 0;
      const hasRetiredCorps = profile.retiredCorps && profile.retiredCorps.length > 0;
      // Use unlockedClasses from store (already computed, handles admin override)

      if (corps) {
        Object.entries(corps).forEach(([classId, corpsData]) => {
          const hasLineup = corpsData.lineup && Object.keys(corpsData.lineup).length === 8;
          if (!hasLineup && corpsData.corpsName) {
            needSetup.push(classId);
          }
        });
      }

      const hasEligibleNewClasses = unlockedClasses.some((classId) => {
        return !corps?.[classId]?.corpsName;
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
    }
  }, [profile, corps, seasonData, loading, seasonLoading, unlockedClasses]);

  // Streaks are server-authoritative: claimDailyLogin (called once per day
  // from App.jsx) owns loginStreak/lastLogin/totalLogins and awards streak
  // milestone achievements. This hook only mirrors the profile's engagement
  // data into local state. (A legacy client-side writer here used to update
  // engagement and achievements directly, which could diverge from the
  // server's streak count.)
  useEffect(() => {
    if (profile?.engagement) {
      setEngagementData(profile.engagement);
    }
  }, [profile?.engagement]);

  // Achievements are awarded server-side (daily sweep in claimDailyLogin,
  // league champion at archival). Watch the profile snapshot for additions and
  // surface the newest one in the celebration modal. The initial snapshot
  // seeds the baseline without firing, so returning users aren't re-shown
  // old achievements.
  const achievementIdsRef = useRef(null);
  useEffect(() => {
    const list = profile?.achievements;
    if (!list) return;
    if (achievementIdsRef.current === null) {
      achievementIdsRef.current = new Set(list.map((a) => a.id));
      return;
    }
    const added = list.filter((a) => !achievementIdsRef.current.has(a.id));
    if (added.length > 0) {
      setNewAchievement(added[added.length - 1]);
      added.forEach((a) => achievementIdsRef.current.add(a.id));
    }
  }, [profile?.achievements]);

  // Track performance milestones and achievements
  // Guard prevents duplicate writes for same rank/score values
  useEffect(() => {
    if (!user || !profile || !activeCorps || activeCorpsClass === 'soundSport') return;

    const classKey = activeCorpsClass;
    const currentRank = activeCorps.rank;
    const currentScore = activeCorps.totalSeasonScore;

    // Check if we've already processed these exact values for this class
    const processed = milestonesProcessedRef.current.get(classKey);
    if (processed?.rank === currentRank && processed?.score === currentScore) {
      return; // Skip - already processed this combination
    }

    const trackMilestones = async () => {
      try {
        const profileRef = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');
        const milestones = profile.milestones || {};
        const classMilestones = milestones[classKey] || {};

        let hasNewMilestone = false;
        const updatedMilestones = { ...milestones, [classKey]: { ...classMilestones } };
        const newActivities = [];

        // Track best rank. (Top-10 achievements are awarded server-side by the
        // daily achievement sweep in claimDailyLogin — not written from here.)
        if (currentRank) {
          const bestRank = classMilestones.bestRank || Infinity;
          if (currentRank < bestRank) {
            updatedMilestones[classKey].bestRank = currentRank;
            hasNewMilestone = true;

            newActivities.push({
              type: 'milestone',
              message: `New best rank: #${currentRank} in ${getCorpsClassName(classKey)}!`,
              timestamp: new Date().toISOString(),
              icon: 'trophy',
            });
          }
        }

        // Track best score
        if (currentScore) {
          const bestScore = classMilestones.bestScore || 0;
          if (currentScore > bestScore) {
            updatedMilestones[classKey].bestScore = currentScore;
            hasNewMilestone = true;

            newActivities.push({
              type: 'milestone',
              message: `New high score: ${currentScore.toFixed(3)} in ${getCorpsClassName(classKey)}!`,
              timestamp: new Date().toISOString(),
              icon: 'star',
            });
          }
        }

        if (hasNewMilestone) {
          const updateData = {
            milestones: updatedMilestones,
          };

          if (newActivities.length > 0) {
            const currentActivities = profile.engagement?.recentActivity || [];
            updateData['engagement.recentActivity'] = [
              ...newActivities,
              ...currentActivities,
            ].slice(0, 10);
          }

          await updateDoc(profileRef, updateData);
        }

        // Mark as processed for this class/rank/score combination
        milestonesProcessedRef.current.set(classKey, { rank: currentRank, score: currentScore });
      } catch (error) {
        console.error('Error tracking milestones:', error);
      }
    };

    trackMilestones();
    // Intentionally keyed on the specific rank/score fields this effect acts on.
    // The milestonesProcessedRef guard dedupes writes, so the full `profile` and
    // `activeCorps` objects are deliberately excluded to avoid redundant work.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile?.uid, activeCorps?.rank, activeCorps?.totalSeasonScore, activeCorpsClass]);

  // Fetch available corps
  const fetchAvailableCorps = useCallback(async () => {
    try {
      if (!seasonData?.seasonUid) {
        setAvailableCorps([]);
        return;
      }

      setAvailableCorps(await getCorpsValues(seasonData.seasonUid));
    } catch (error) {
      console.error('Error fetching available corps:', error);
      setAvailableCorps([]);
    }
  }, [seasonData?.seasonUid]);

  // Season recaps from the shared react-query cache. Dashboard already fetches
  // the full recap set via useScoresData/useRecentResults under this same key,
  // so this costs no extra Firestore reads (a previous version ran a separate
  // limit(5) query alongside the full fetch — pure redundancy on this page).
  // The recentScores memo below slices to the 5 most recent days itself.
  const { data: rawRecentRecaps } = useQuery({
    queryKey: queryKeys.fantasyRecaps(seasonData?.seasonUid),
    queryFn: () => getSeasonRecaps(seasonData.seasonUid),
    enabled: !!seasonData?.seasonUid,
    staleTime: 5 * 60 * 1000,
  });

  const recentScores = useMemo(() => {
    if (!rawRecentRecaps?.length) return [];
    const isSoundSport = activeCorpsClass === 'soundSport';
    return rawRecentRecaps
      .filter((r) => r.showName || r.eventName || r.name || r.shows?.length > 0)
      .sort((a, b) => (b.offSeasonDay || 0) - (a.offSeasonDay || 0))
      .slice(0, 5)
      .map((r) => ({
        showName: r.showName || r.eventName || r.name || r.shows?.[0]?.eventName || 'Show',
        date: r.date || '',
        totalScore: isSoundSport
          ? 'Complete'
          : typeof r.totalScore === 'number'
            ? r.totalScore.toFixed(3)
            : r.totalScore || '0.000',
        rank: isSoundSport ? null : (r.rank ?? '-'),
      }));
  }, [rawRecentRecaps, activeCorpsClass]);

  // Fetch season-specific data when seasonData is available
  useEffect(() => {
    if (seasonData?.seasonUid) {
      fetchAvailableCorps();
    }
  }, [seasonData?.seasonUid, fetchAvailableCorps]);

  // Corps switching handler
  const handleCorpsSwitch = (classId) => {
    setSelectedCorpsClass(classId);
    toast.success(`Switched to ${getCorpsClassName(classId)}`);
  };

  // Handle season setup completion
  const handleSeasonSetupComplete = () => {
    setShowSeasonSetupWizard(false);
    setCorpsNeedingSetup([]);
    toast.success('Season setup complete! Time to compete!');
  };

  // Clear newly unlocked class
  const clearNewlyUnlockedClass = () => {
    setNewlyUnlockedClass(null);
  };

  // Clear new achievement
  const clearNewAchievement = () => {
    setNewAchievement(null);
  };

  // Manual profile refresh - now handled automatically by profileStore's onSnapshot
  // This is a no-op but kept for API compatibility
  const refreshProfile = useCallback(async () => {
    // Profile data is now managed by profileStore with real-time updates
    // No manual refresh needed - onSnapshot handles it automatically
  }, []);

  return {
    // Core data
    user,
    profile,
    loading,
    corps,
    availableCorps,
    recentScores,

    // Admin status and unlocked classes (admins have all classes unlocked)
    isAdmin,
    unlockedClasses,

    // Corps selection
    selectedCorpsClass,
    setSelectedCorpsClass,
    activeCorpsClass,
    activeCorps,
    hasMultipleCorps,
    handleCorpsSwitch,

    // Season
    seasonData,
    seasonLoading,
    weeksRemaining,
    currentWeek,
    currentDay,
    formatSeasonName,

    // Class unlock
    newlyUnlockedClass,
    clearNewlyUnlockedClass,

    // Engagement
    engagementData,

    // Season setup
    showSeasonSetupWizard,
    setShowSeasonSetupWizard,
    corpsNeedingSetup,
    handleSeasonSetupComplete,

    // Achievements
    newAchievement,
    clearNewAchievement,

    // Utility functions
    getCorpsClassName,
    getCorpsClassColor,
    refreshProfile,
  };
};

export default useDashboardData;
