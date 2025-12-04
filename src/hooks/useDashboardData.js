// src/hooks/useDashboardData.js
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../App';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import { getBattlePassProgress, retireCorps } from '../firebase/functions';
import { useExecution } from './useExecution';
import { useSeason, getSeasonProgress } from './useSeason';
import { useUserStore, getGameDay } from '../store/userStore';
import toast from 'react-hot-toast';

/**
 * Custom hook that centralizes all dashboard data fetching and state management.
 * This reduces the main Dashboard component complexity significantly.
 */
export const useDashboardData = () => {
  const { user } = useAuth();
  const { saveDailyChallenges, completeDailyChallenge, loggedInProfile } = useUserStore();
  const { seasonData, loading: seasonLoading, weeksRemaining } = useSeason();

  // Core state
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [corps, setCorps] = useState(null);
  const [availableCorps, setAvailableCorps] = useState([]);
  const [recentScores, setRecentScores] = useState([]);
  const [selectedCorpsClass, setSelectedCorpsClass] = useState(null);

  // Battle pass
  const [battlePassRewards, setBattlePassRewards] = useState(null);
  const [unclaimedRewardsCount, setUnclaimedRewardsCount] = useState(0);

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

  // Challenges
  const [dailyChallenges, setDailyChallenges] = useState([]);
  const [weeklyProgress, setWeeklyProgress] = useState({
    rehearsalsCompleted: 0,
    scoreImprovement: 0,
    rankChange: 0,
    challengesCompleted: 0,
    equipmentMaintained: 0
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

  // Use execution hook
  const executionHook = useExecution(user?.uid, activeCorpsClass);

  // Utility functions
  const formatSeasonName = (name) => {
    if (!name) return 'Loading season...';
    return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const getCorpsClassName = (classId) => {
    const classNames = {
      soundSport: 'SoundSport',
      aClass: 'A Class',
      open: 'Open Class',
      world: 'World Class'
    };
    return classNames[classId] || classId;
  };

  const getCorpsClassColor = (classId) => {
    const colors = {
      soundSport: 'text-green-500 bg-green-500/10 border-green-500/30',
      aClass: 'text-blue-500 bg-blue-500/10 border-blue-500/30',
      open: 'text-purple-500 bg-purple-500/10 border-purple-500/30',
      world: 'text-gold-500 bg-gold-500/10 border-gold-500/30'
    };
    return colors[classId] || 'text-cream-500 bg-cream-500/10 border-cream-500/30';
  };

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

      fetchBattlePassProgress();

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
                message: `New high score: ${activeCorps.totalSeasonScore.toFixed(2)} in ${getCorpsClassName(classKey)}!`,
                timestamp: new Date().toISOString(),
                icon: 'star'
              });
            }
          }

          // Track rehearsal milestones
          if (executionHook.executionState?.rehearsalsCompleted) {
            const rehearsalMilestones = [5, 10, 25, 50, 100];
            const currentRehearsals = executionHook.executionState.rehearsalsCompleted;
            const trackedRehearsals = classMilestones.rehearsalMilestones || [];

            for (const milestone of rehearsalMilestones) {
              if (currentRehearsals >= milestone && !trackedRehearsals.includes(milestone)) {
                updatedMilestones[classKey].rehearsalMilestones = [...trackedRehearsals, milestone];
                hasNewMilestone = true;

                const achievementId = `rehearsals_${milestone}_${classKey}`;
                const existingAchievements = profile.achievements || [];
                if (!existingAchievements.find(a => a.id === achievementId)) {
                  newAchievements.push({
                    id: achievementId,
                    title: `${milestone} Rehearsals!`,
                    description: `Completed ${milestone} rehearsals in ${getCorpsClassName(classKey)}`,
                    icon: 'star',
                    earnedAt: new Date().toISOString(),
                    rarity: milestone >= 50 ? 'epic' : milestone >= 25 ? 'rare' : 'common'
                  });
                }
              }
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
  }, [user, profile?.uid, activeCorps?.rank, activeCorps?.totalSeasonScore, executionHook.executionState?.rehearsalsCompleted]);

  // Generate and track daily challenges
  useEffect(() => {
    if (user && profile && activeCorps) {
      const generateChallenges = () => {
        const today = getGameDay();
        const savedChallenges = profile.challenges || {};
        const todayChallenges = savedChallenges[today];

        if (todayChallenges) {
          setDailyChallenges(todayChallenges);
          return;
        }

        const challenges = [];
        const lastRehearsalDate = executionHook.executionState?.lastRehearsalDate?.toDate?.();
        const rehearsedToday = lastRehearsalDate &&
          new Date(lastRehearsalDate.getTime()).toDateString() === new Date().toDateString() &&
          new Date().getHours() >= 2;

        if (executionHook.canRehearseToday && activeCorpsClass !== 'soundSport') {
          challenges.push({
            id: 'rehearse_today',
            title: 'Daily Practice',
            description: 'Complete a rehearsal with your corps',
            progress: rehearsedToday ? 1 : 0,
            target: 1,
            reward: '50 XP',
            icon: 'target',
            completed: rehearsedToday
          });
        }

        challenges.push({
          id: 'check_leaderboard',
          title: 'Scout the Competition',
          description: 'Visit the leaderboard page',
          progress: 0,
          target: 1,
          reward: '25 XP',
          icon: 'trophy',
          completed: false,
          action: () => window.location.href = '/leaderboard'
        });

        if (executionHook.executionState?.equipment) {
          challenges.push({
            id: 'maintain_equipment',
            title: 'Equipment Care',
            description: 'Check your equipment status',
            progress: 0,
            target: 1,
            reward: '30 XP',
            icon: 'wrench',
            completed: false
          });
        }

        challenges.push({
          id: 'staff_meeting',
          title: 'Staff Meeting',
          description: 'Visit the staff market',
          progress: 0,
          target: 1,
          reward: '25 XP',
          icon: 'users',
          completed: false
        });

        if (activeCorps?.selectedShows) {
          const totalWeeks = 7;
          const weeksWithShows = Object.keys(activeCorps.selectedShows).filter(
            weekKey => activeCorps.selectedShows[weekKey]?.length > 0
          ).length;
          const hasFullSchedule = weeksWithShows >= totalWeeks;

          challenges.push({
            id: 'schedule_master',
            title: 'Schedule Master',
            description: 'Select shows for all 7 weeks',
            progress: weeksWithShows,
            target: totalWeeks,
            reward: '100 XP',
            icon: 'calendar',
            completed: hasFullSchedule
          });
        }

        setDailyChallenges(challenges);

        if (challenges.length > 0) {
          saveDailyChallenges(challenges);
        }
      };

      generateChallenges();
    }
  }, [user, profile, activeCorps, executionHook.canRehearseToday, executionHook.executionState?.lastRehearsalDate, executionHook.executionState?.equipment, saveDailyChallenges]);

  // Sync challenges from store when updated
  useEffect(() => {
    if (loggedInProfile?.challenges) {
      const today = getGameDay();
      const storeChallenges = loggedInProfile.challenges[today];
      if (storeChallenges && storeChallenges.length > 0) {
        const hasUpdates = storeChallenges.some((storeChallenge) => {
          const localChallenge = dailyChallenges.find(c => c.id === storeChallenge.id);
          return localChallenge && !localChallenge.completed && storeChallenge.completed;
        });
        if (hasUpdates) {
          setDailyChallenges(storeChallenges);
        }
      }
    }
  }, [loggedInProfile?.challenges, dailyChallenges]);

  // Calculate weekly progress
  useEffect(() => {
    if (user && profile && activeCorps && activeCorpsClass !== 'soundSport') {
      const calculateWeeklyProgressData = () => {
        const weekData = profile.engagement?.weeklyProgress?.[activeCorpsClass] || {};
        const previousWeekData = weekData.previous || {};

        const rehearsalsThisWeek = executionHook.executionState?.rehearsalsCompleted || 0;
        const rehearsalsLastWeek = previousWeekData.rehearsalsCompleted || 0;

        const currentScore = activeCorps.totalSeasonScore || 0;
        const previousScore = previousWeekData.totalScore || 0;
        const scoreImprovement = currentScore - previousScore;

        const currentRank = activeCorps.rank || 0;
        const previousRank = previousWeekData.rank || currentRank;
        const rankChange = previousRank - currentRank;

        let equipmentMaintained = 0;
        if (executionHook.executionState?.equipment) {
          const equipment = executionHook.executionState.equipment;
          // Equipment values are flat numbers (0.0-1.0), filter out Max keys
          const equipmentConditions = Object.entries(equipment)
            .filter(([key, value]) => !key.includes('Max') && typeof value === 'number')
            .map(([, value]) => value);

          if (equipmentConditions.length > 0) {
            // Calculate average equipment condition as percentage
            const avgCondition = equipmentConditions.reduce((sum, c) => sum + c, 0) / equipmentConditions.length;
            equipmentMaintained = avgCondition * 100;
          }
        }

        const challengesCompleted = dailyChallenges.filter(c => c.completed).length;

        setWeeklyProgress({
          rehearsalsCompleted: rehearsalsThisWeek - rehearsalsLastWeek,
          scoreImprovement,
          rankChange,
          challengesCompleted,
          equipmentMaintained
        });
      };

      calculateWeeklyProgressData();
    }
  }, [user, profile, activeCorps, activeCorpsClass, executionHook.executionState, dailyChallenges]);

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
            totalScore: isSoundSport ? 'Complete' : (typeof r.totalScore === 'number' ? r.totalScore.toFixed(2) : (r.totalScore || '0.00')),
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

  // Fetch battle pass progress
  const fetchBattlePassProgress = async () => {
    try {
      const result = await getBattlePassProgress();
      if (result.data && result.data.success) {
        const progress = result.data.progress;
        setBattlePassRewards(progress);

        let unclaimedCount = 0;
        for (let level = 1; level <= progress.currentLevel; level++) {
          if (!progress.claimedRewards?.free?.includes(level)) {
            unclaimedCount++;
          }
          if (progress.hasBattlePass && !progress.claimedRewards?.premium?.includes(level)) {
            unclaimedCount++;
          }
        }
        setUnclaimedRewardsCount(unclaimedCount);
      }
    } catch (error) {
      if (error.message && !error.message.includes('No active battle pass season')) {
        console.error('Error fetching battle pass progress:', error);
      }
      setBattlePassRewards(null);
      setUnclaimedRewardsCount(0);
    }
  };

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

    // Battle pass
    battlePassRewards,
    unclaimedRewardsCount,

    // Class unlock
    newlyUnlockedClass,
    clearNewlyUnlockedClass,

    // Engagement
    engagementData,

    // Challenges
    dailyChallenges,
    setDailyChallenges,
    weeklyProgress,
    completeDailyChallenge,

    // Season setup
    showSeasonSetupWizard,
    setShowSeasonSetupWizard,
    corpsNeedingSetup,
    handleSeasonSetupComplete,

    // Achievements
    newAchievement,
    clearNewAchievement,

    // Execution hook (pass through)
    executionState: executionHook.executionState,
    executionLoading: executionHook.loading,
    executionProcessing: executionHook.processing,
    rehearse: executionHook.rehearse,
    repairEquipment: executionHook.repairEquipment,
    upgradeEquipment: executionHook.upgradeEquipment,
    boostMorale: executionHook.boostMorale,
    calculateMultiplier: executionHook.calculateMultiplier,
    canRehearseToday: executionHook.canRehearseToday,

    // Utility functions
    getCorpsClassName,
    getCorpsClassColor,
    refreshProfile
  };
};

export default useDashboardData;
