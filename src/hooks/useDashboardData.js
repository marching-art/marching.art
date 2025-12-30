// src/hooks/useDashboardData.js
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../App';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import { useSeason, getSeasonProgress } from './useSeason';
import toast from 'react-hot-toast';
import { getCorpsClassName, getCorpsClassColor } from '../utils/corps';
import { formatSeasonName } from '../utils/season';

/**
 * Custom hook that centralizes all dashboard data fetching and state management.
 * This reduces the main Dashboard component complexity significantly.
 */
export const useDashboardData = () => {
  const { user } = useAuth();
  const { seasonData, loading: seasonLoading, weeksRemaining } = useSeason();

  // Core state
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [corps, setCorps] = useState(null);
  const [availableCorps, setAvailableCorps] = useState([]);
  const [recentScores, setRecentScores] = useState([]);
  const [selectedCorpsClass, setSelectedCorpsClass] = useState(null);

  // Class unlock tracking
  const [newlyUnlockedClass, setNewlyUnlockedClass] = useState(null);
  const [previousUnlockedClasses, setPreviousUnlockedClasses] = useState([]);

  // Engagement data
  const [engagementData, setEngagementData] = useState({
    loginStreak: 0,
    lastLogin: null,
    totalLogins: 0,
    recentActivity: [],
    weeklyProgress: []
  });

  // Season setup
  const [showSeasonSetupWizard, setShowSeasonSetupWizard] = useState(false);
  const [corpsNeedingSetup, setCorpsNeedingSetup] = useState([]);

  // Achievement state
  const [newAchievement, setNewAchievement] = useState(null);

  // Derived values
  const activeCorpsClass = selectedCorpsClass || (corps ? Object.keys(corps)[0] : null);
  const activeCorps = (activeCorpsClass && corps) ? corps[activeCorpsClass] : null;
  const hasMultipleCorps = corps && Object.keys(corps).length > 1;
  const { currentWeek, currentDay } = seasonData ? getSeasonProgress(seasonData) : { currentWeek: 1, currentDay: 1 };

  // Load selected corps from localStorage on mount
  useEffect(() => {
    if (user) {
      const savedCorpsClass = localStorage.getItem(`selectedCorps_${user.uid}`);
      if (savedCorpsClass) {
        setSelectedCorpsClass(savedCorpsClass);
      }
    }
  }, [user]);

  // Save selected corps to localStorage when it changes
  useEffect(() => {
    if (user && selectedCorpsClass) {
      localStorage.setItem(`selectedCorps_${user.uid}`, selectedCorpsClass);
    }
  }, [user, selectedCorpsClass]);

  // Update selected corps when corps data changes
  useEffect(() => {
    if (corps) {
      const corpsClasses = Object.keys(corps);
      if (selectedCorpsClass && !corpsClasses.includes(selectedCorpsClass)) {
        setSelectedCorpsClass(corpsClasses[0] || null);
      }
      if (!selectedCorpsClass && corpsClasses.length > 0) {
        setSelectedCorpsClass(corpsClasses[0]);
      }
    }
  }, [corps, selectedCorpsClass]);

  // Detect when a new class is unlocked
  useEffect(() => {
    if (profile?.unlockedClasses && previousUnlockedClasses.length > 0) {
      const currentUnlocked = profile.unlockedClasses;
      const newlyUnlocked = currentUnlocked.filter(
        classId => !previousUnlockedClasses.includes(classId)
      );
      if (newlyUnlocked.length > 0) {
        setNewlyUnlockedClass(newlyUnlocked[0]);
      }
    }
    if (profile?.unlockedClasses) {
      setPreviousUnlockedClasses(profile.unlockedClasses);
    }
  }, [profile?.unlockedClasses, previousUnlockedClasses]);

  // Subscribe to profile updates
  useEffect(() => {
    if (user) {
      const profileRef = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');
      const unsubscribeProfile = onSnapshot(profileRef, (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          setProfile(data);
          setCorps(data.corps || null);
        } else {
          const initialProfile = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || 'Director',
            createdAt: new Date(),
            xp: 0,
            xpLevel: 1,
            unlockedClasses: ['soundSport'],
            achievements: [],
            stats: {
              seasonsPlayed: 0,
              championships: 0,
              topTenFinishes: 0
            }
          };
          setDoc(profileRef, initialProfile);
        }
        setLoading(false);
      });

      return () => {
        unsubscribeProfile();
      };
    }
  }, [user]);

  // Detect corps that need season setup
  useEffect(() => {
    if (profile && seasonData && !loading && !seasonLoading) {
      const needSetup = [];
      const hasCorps = corps && Object.keys(corps).length > 0;
      const hasRetiredCorps = profile.retiredCorps && profile.retiredCorps.length > 0;
      const unlockedClasses = profile.unlockedClasses || ['soundSport'];

      if (corps) {
        Object.entries(corps).forEach(([classId, corpsData]) => {
          const hasLineup = corpsData.lineup && Object.keys(corpsData.lineup).length === 8;
          if (!hasLineup && corpsData.corpsName) {
            needSetup.push(classId);
          }
        });
      }

      const hasEligibleNewClasses = unlockedClasses.some(classId => {
        return !corps?.[classId]?.corpsName;
      });

      const shouldShowWizard = needSetup.length > 0 ||
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
  }, [profile, corps, seasonData, loading, seasonLoading]);

  // Track daily login streaks and engagement
  useEffect(() => {
    if (user && profile) {
      const updateEngagement = async () => {
        try {
          const profileRef = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');
          const today = new Date().toDateString();
          const lastLogin = profile.engagement?.lastLogin;
          const lastLoginDate = lastLogin
            ? (lastLogin.toDate ? lastLogin.toDate() : new Date(lastLogin)).toDateString()
            : null;

          if (lastLoginDate !== today) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toDateString();

            let newStreak = 1;
            const currentStreak = profile.engagement?.loginStreak || 0;

            if (lastLoginDate === yesterdayStr) {
              newStreak = currentStreak + 1;
            }

            const updatedEngagement = {
              loginStreak: newStreak,
              lastLogin: new Date().toISOString(),
              totalLogins: (profile.engagement?.totalLogins || 0) + 1,
              recentActivity: profile.engagement?.recentActivity || [],
              weeklyProgress: profile.engagement?.weeklyProgress || []
            };

            updatedEngagement.recentActivity.unshift({
              type: 'login',
              message: `Day ${newStreak} login streak!`,
              timestamp: new Date().toISOString(),
              icon: 'flame'
            });

            updatedEngagement.recentActivity = updatedEngagement.recentActivity.slice(0, 10);

            // Award streak achievements
            const milestones = [3, 7, 14, 30, 60, 100];
            if (milestones.includes(newStreak)) {
              const achievementId = `streak_${newStreak}`;
              const existingAchievements = profile.achievements || [];

              if (!existingAchievements.find(a => a.id === achievementId)) {
                const achievement = {
                  id: achievementId,
                  title: `${newStreak} Day Streak!`,
                  description: `Logged in ${newStreak} days in a row`,
                  icon: 'flame',
                  earnedAt: new Date().toISOString(),
                  rarity: newStreak >= 30 ? 'legendary' : newStreak >= 14 ? 'epic' : newStreak >= 7 ? 'rare' : 'common'
                };

                await updateDoc(profileRef, {
                  achievements: [...existingAchievements, achievement]
                });

                setNewAchievement(achievement);
              }
            }

            await updateDoc(profileRef, {
              engagement: updatedEngagement
            });

            setEngagementData(updatedEngagement);
          } else {
            if (profile.engagement) {
              setEngagementData(profile.engagement);
            }
          }
        } catch (error) {
          console.error('Error updating engagement:', error);
        }
      };

      updateEngagement();
    }
  }, [user, profile?.uid]);

  // Track performance milestones and achievements
  useEffect(() => {
    if (user && profile && activeCorps && activeCorpsClass !== 'soundSport') {
      const trackMilestones = async () => {
        try {
          const profileRef = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');
          const milestones = profile.milestones || {};
          const classKey = activeCorpsClass;
          const classMilestones = milestones[classKey] || {};

          let hasNewMilestone = false;
          const updatedMilestones = { ...milestones, [classKey]: { ...classMilestones } };
          const newActivities = [];
          const newAchievements = [];

          // Track best rank
          if (activeCorps.rank) {
            const bestRank = classMilestones.bestRank || Infinity;
            if (activeCorps.rank < bestRank) {
              updatedMilestones[classKey].bestRank = activeCorps.rank;
              hasNewMilestone = true;

              newActivities.push({
                type: 'milestone',
                message: `New best rank: #${activeCorps.rank} in ${getCorpsClassName(classKey)}!`,
                timestamp: new Date().toISOString(),
                icon: 'trophy'
              });

              if (activeCorps.rank <= 10) {
                const achievementId = `top_10_${classKey}`;
                const existingAchievements = profile.achievements || [];
                if (!existingAchievements.find(a => a.id === achievementId)) {
                  newAchievements.push({
                    id: achievementId,
                    title: 'Top 10 Finish!',
                    description: `Reached top 10 in ${getCorpsClassName(classKey)}`,
                    icon: 'trophy',
                    earnedAt: new Date().toISOString(),
                    rarity: activeCorps.rank === 1 ? 'legendary' : activeCorps.rank <= 3 ? 'epic' : 'rare'
                  });
                }
              }
            }
          }

          // Track best score
          if (activeCorps.totalSeasonScore) {
            const bestScore = classMilestones.bestScore || 0;
            if (activeCorps.totalSeasonScore > bestScore) {
              updatedMilestones[classKey].bestScore = activeCorps.totalSeasonScore;
              hasNewMilestone = true;

              newActivities.push({
                type: 'milestone',
                message: `New high score: ${activeCorps.totalSeasonScore.toFixed(3)} in ${getCorpsClassName(classKey)}!`,
                timestamp: new Date().toISOString(),
                icon: 'star'
              });
            }
          }

          if (hasNewMilestone) {
            const updateData = {
              milestones: updatedMilestones
            };

            if (newActivities.length > 0) {
              const currentActivities = profile.engagement?.recentActivity || [];
              updateData['engagement.recentActivity'] = [...newActivities, ...currentActivities].slice(0, 10);
            }

            if (newAchievements.length > 0) {
              const currentAchievements = profile.achievements || [];
              updateData.achievements = [...currentAchievements, ...newAchievements];
              setNewAchievement(newAchievements[0]);
            }

            await updateDoc(profileRef, updateData);
          }
        } catch (error) {
          console.error('Error tracking milestones:', error);
        }
      };

      trackMilestones();
    }
  }, [user, profile?.uid, activeCorps?.rank, activeCorps?.totalSeasonScore]);

  // Fetch available corps
  const fetchAvailableCorps = useCallback(async () => {
    try {
      if (!seasonData?.seasonUid) {
        setAvailableCorps([]);
        return;
      }

      const corpsDataRef = doc(db, 'dci-data', seasonData.seasonUid);
      const corpsDataSnap = await getDoc(corpsDataRef);

      if (corpsDataSnap.exists()) {
        const data = corpsDataSnap.data();
        setAvailableCorps(data.corpsValues || []);
      } else {
        setAvailableCorps([]);
      }
    } catch (error) {
      console.error('Error fetching available corps:', error);
      setAvailableCorps([]);
    }
  }, [seasonData?.seasonUid]);

  // Fetch recent scores
  const fetchRecentScores = useCallback(async () => {
    try {
      if (!seasonData?.seasonUid) {
        setRecentScores([]);
        return;
      }

      const recapDocRef = doc(db, 'fantasy_recaps', seasonData.seasonUid);
      const recapDocSnap = await getDoc(recapDocRef);

      if (recapDocSnap.exists()) {
        const allRecaps = recapDocSnap.data().recaps || [];
        const isSoundSport = activeCorpsClass === 'soundSport';
        const sortedRecaps = allRecaps
          .filter(r => r.showName || r.eventName || r.name)
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .slice(0, 5)
          .map(r => ({
            showName: r.showName || r.eventName || r.name || 'Show',
            date: r.date || '',
            totalScore: isSoundSport ? 'Complete' : (typeof r.totalScore === 'number' ? r.totalScore.toFixed(3) : (r.totalScore || '0.000')),
            rank: isSoundSport ? null : (r.rank ?? '-')
          }));
        setRecentScores(sortedRecaps);
      } else {
        setRecentScores([]);
      }
    } catch (error) {
      console.error('Error fetching recent scores:', error);
    }
  }, [seasonData?.seasonUid, activeCorpsClass]);

  // Fetch season-specific data when seasonData is available (parallel)
  useEffect(() => {
    if (seasonData?.seasonUid) {
      Promise.all([fetchAvailableCorps(), fetchRecentScores()]);
    }
  }, [seasonData?.seasonUid, fetchAvailableCorps, fetchRecentScores]);

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

  // Manual profile refresh - useful after daily activities complete
  const refreshProfile = useCallback(async () => {
    if (user) {
      try {
        const profileRef = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');
        const profileDoc = await getDoc(profileRef);
        if (profileDoc.exists()) {
          const data = profileDoc.data();
          setProfile(data);
          setCorps(data.corps || null);
        }
      } catch (error) {
        console.error('Error refreshing profile:', error);
      }
    }
  }, [user]);

  return {
    // Core data
    user,
    profile,
    loading,
    corps,
    availableCorps,
    recentScores,

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
    refreshProfile
  };
};

export default useDashboardData;
