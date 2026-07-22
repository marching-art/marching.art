// src/hooks/useDashboardData.ts
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { DocumentData } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { getRecentSeasonRecaps, getCorpsValues, RECENT_RECAP_DAYS } from '../api/season';
import { queryKeys } from '../lib/queryClient';
import { useSeason } from './useSeason';
import { useProfileStore, type Engagement, type ProfileDoc } from '../store/profileStore';
import toast from 'react-hot-toast';
import { getCorpsClassName, getCorpsClassColor } from '../utils/corps';
import { formatSeasonName } from '../utils/season';
import { getRecapEventName, recapHasEvent } from '../utils/recap';
import type { RecapDate } from '../types/recap';

// =============================================================================
// LOCAL TYPES
// =============================================================================

/** Per-class corps entry on the profile, as this hook reads it. */
interface DashboardCorpsData {
  corpsName?: string;
  lineup?: Record<string, string>;
  selectedShows?: Record<string, unknown>;
  [key: string]: unknown;
}

type CorpsMap = Record<string, DashboardCorpsData>;

interface Achievement {
  id: string;
  [key: string]: unknown;
}

/** Profile fields this hook reads beyond the base ProfileDoc index signature. */
type DashboardProfile = ProfileDoc & {
  classUnlockPaths?: Record<string, string>;
  initialSetupComplete?: string;
  retiredCorps?: unknown[];
  achievements?: Achievement[];
};

/** A row in the Dashboard's recent-scores list. */
interface RecentScoreRow {
  showName: string;
  date: RecapDate | '';
  totalScore: string;
  rank: number | string | null;
}

/**
 * Custom hook that centralizes all dashboard data fetching and state management.
 * This reduces the main Dashboard component complexity significantly.
 *
 * NOTE: Profile data now comes from the global profileStore to prevent
 * duplicate Firestore listeners. The store is initialized in App.jsx.
 */
export const useDashboardData = () => {
  const { user } = useAuth();
  const {
    seasonData,
    loading: seasonLoading,
    weeksRemaining,
    currentDay,
    currentWeek,
  } = useSeason();

  // Get profile data from global store (singleton listener)
  const storeProfile = useProfileStore((state) => state.profile);
  const storeCorps = useProfileStore((state) => state.corps);
  const storeLoading = useProfileStore((state) => state.loading);
  const storeIsAdmin = useProfileStore((state) => state.isAdmin);

  // Core state - profile and corps now come from store
  const profile = storeProfile as DashboardProfile | null;
  const loading = storeLoading;
  const corps = storeCorps as CorpsMap | null;
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
  const [availableCorps, setAvailableCorps] = useState<DocumentData[]>([]);
  const [selectedCorpsClass, setSelectedCorpsClass] = useState<string | null>(null);

  // Class unlock tracking - use ref to avoid re-render loops
  const [newlyUnlockedClass, setNewlyUnlockedClass] = useState<string | null>(null);
  const previousUnlockedClassesRef = useRef<string[]>([]);

  // Guard to prevent duplicate milestone Firestore writes within same session

  // Engagement data
  const [engagementData, setEngagementData] = useState<Engagement>({
    loginStreak: 0,
    lastLogin: null,
    totalLogins: 0,
    recentActivity: [],
    weeklyProgress: [],
  });

  // Season setup
  const [showSeasonSetupWizard, setShowSeasonSetupWizard] = useState(false);
  const [corpsNeedingSetup, setCorpsNeedingSetup] = useState<string[]>([]);

  // Achievement state
  const [newAchievement, setNewAchievement] = useState<Achievement | null>(null);

  // Derived values
  const activeCorpsClass = selectedCorpsClass || (corps ? Object.keys(corps)[0] : null);
  const activeCorps = activeCorpsClass && corps ? corps[activeCorpsClass] : null;
  const hasMultipleCorps = corps && Object.keys(corps).length > 1;

  // CONSOLIDATED: Corps selection state management
  // Combines localStorage load/save and corps data sync into single effect
  // This prevents cascading effect chains when corps data changes
  useEffect(() => {
    if (!user) return;

    const corpsClasses = corps ? Object.keys(corps) : [];
    const storageKey = `selectedCorps_${user.uid}`;

    // On mount or user change: load from localStorage. podiumClass is
    // selectable without a corps entry (the Podium zone renders the founding
    // flow), so it restores too.
    if (selectedCorpsClass === null) {
      const savedCorpsClass = localStorage.getItem(storageKey);
      if (
        savedCorpsClass &&
        (corpsClasses.includes(savedCorpsClass) || savedCorpsClass === 'podiumClass')
      ) {
        setSelectedCorpsClass(savedCorpsClass);
        return;
      }
    }

    // Sync selection with available corps. podiumClass is exempt from the
    // has-a-corps check — clicking its (dashed, unfounded) tab must land on
    // the founding flow, not snap back to the first fantasy class.
    if (corpsClasses.length > 0) {
      if (
        selectedCorpsClass &&
        selectedCorpsClass !== 'podiumClass' &&
        !corpsClasses.includes(selectedCorpsClass)
      ) {
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
      // This prevents showing "class unlocked" notification when they already have a corps.
      // Backstop unlocks (account-age anti-frustration floor) are deliberately
      // silent — a graduation ceremony for a grant you didn't earn reads as
      // hollow, so those skip the congrats modal entirely.
      const newlyUnlockedWithoutCorps = newlyUnlocked.filter(
        (classId) => !corps?.[classId] && profile?.classUnlockPaths?.[classId] !== 'backstop'
      );
      if (newlyUnlockedWithoutCorps.length > 0) {
        setNewlyUnlockedClass(newlyUnlockedWithoutCorps[0]);
      }
    }

    // Update ref for next comparison (doesn't trigger re-render)
    previousUnlockedClassesRef.current = currentUnlocked;
  }, [unlockedClasses, corps, profile?.classUnlockPaths]);

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

      const needSetup: string[] = [];
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
  const achievementIdsRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    const list = profile?.achievements;
    if (!list) return;
    if (achievementIdsRef.current === null) {
      achievementIdsRef.current = new Set(list.map((a) => a.id));
      return;
    }
    const knownIds = achievementIdsRef.current;
    const added = list.filter((a) => !knownIds.has(a.id));
    if (added.length > 0) {
      setNewAchievement(added[added.length - 1]);
      added.forEach((a) => knownIds.add(a.id));
    }
  }, [profile?.achievements]);

  // NOTE: a client-side milestones writer used to live here (profile
  // `milestones` + `engagement.recentActivity` via direct updateDoc). It was
  // the last surviving client profile write, and nothing anywhere rendered
  // the data it produced — so it's gone. Lifetime bests are server-owned
  // (lifetimeStats at season archival) and personal-best callouts ride the
  // season recap.

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

  // Recent season recaps via the bounded most-recent-days query (shared cache
  // entry with the always-mounted ticker, so this usually costs no extra
  // Firestore reads). The recentScores memo below only needs the 5 most
  // recent days with shows, so fetching the full season archive here — as a
  // previous version did via the shared full-archive key — was pure excess.
  const { data: rawRecentRecaps } = useQuery({
    queryKey: queryKeys.fantasyRecapsRecent(seasonData?.seasonUid ?? '', RECENT_RECAP_DAYS),
    queryFn: () => getRecentSeasonRecaps(seasonData?.seasonUid ?? '', RECENT_RECAP_DAYS),
    enabled: !!seasonData?.seasonUid,
    staleTime: 5 * 60 * 1000,
  });

  const recentScores = useMemo<RecentScoreRow[]>(() => {
    if (!rawRecentRecaps?.length) return [];
    const isSoundSport = activeCorpsClass === 'soundSport';
    return rawRecentRecaps
      .filter((r) => recapHasEvent(r))
      .sort((a, b) => (b.offSeasonDay || 0) - (a.offSeasonDay || 0))
      .slice(0, 5)
      .map((r) => ({
        showName: getRecapEventName(r),
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
  const handleCorpsSwitch = (classId: string) => {
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
