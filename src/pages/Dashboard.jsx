// src/pages/Dashboard.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Music, Trophy, Users, Calendar, Star,
  ChevronRight, Plus, Edit, Lock, Zap, AlertCircle, Check,
  Target, Wrench, MapPin, Crown, Gift, Sparkles, ChevronDown,
  Trash2, ArrowRightLeft, MoreVertical, X
} from 'lucide-react';
import { useAuth } from '../App';
import { db, functions, analyticsHelpers } from '../firebase';
import { doc, onSnapshot, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getBattlePassProgress } from '../firebase/functions';
import { SkeletonLoader } from '../components/LoadingScreen';
import SeasonInfo from '../components/SeasonInfo';
import PerformanceChart from '../components/PerformanceChart';
import {
  ExecutionDashboard,
  RehearsalPanel,
  EquipmentManager,
  StaffRoster,
  ShowDifficultySelector
} from '../components/Execution';
import { useExecution } from '../hooks/useExecution';
import CaptionSelectionModal from '../components/CaptionSelection/CaptionSelectionModal';
import ShowSelectionModal from '../components/ShowSelection/ShowSelectionModal';
import InfoTooltip from '../components/InfoTooltip';
import toast from 'react-hot-toast';
import { useSeason, getSeasonProgress } from '../hooks/useSeason';

const Dashboard = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [corps, setCorps] = useState(null);
  const [showRegistration, setShowRegistration] = useState(false);
  const [showCaptionSelection, setShowCaptionSelection] = useState(false);
  const [showShowSelection, setShowShowSelection] = useState(false);
  const [availableCorps, setAvailableCorps] = useState([]);
  const { seasonData, loading: seasonLoading, weeksRemaining } = useSeason();
  const [recentScores, setRecentScores] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [battlePassRewards, setBattlePassRewards] = useState(null);
  const [unclaimedRewardsCount, setUnclaimedRewardsCount] = useState(0);
  const [selectedCorpsClass, setSelectedCorpsClass] = useState(null);
  const [showCorpsSelector, setShowCorpsSelector] = useState(false);
  const [newlyUnlockedClass, setNewlyUnlockedClass] = useState(null);
  const [showClassUnlockCongrats, setShowClassUnlockCongrats] = useState(false);
  const [previousUnlockedClasses, setPreviousUnlockedClasses] = useState([]);
  const [showEditCorps, setShowEditCorps] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMoveCorps, setShowMoveCorps] = useState(false);
  const [showCorpsManagementMenu, setShowCorpsManagementMenu] = useState(false);

  // Get the active corps class - use selected or default to first available
  const activeCorpsClass = selectedCorpsClass || (corps ? Object.keys(corps)[0] : null);
  const activeCorps = activeCorpsClass ? corps[activeCorpsClass] : null;

  // Check if user has multiple corps
  const hasMultipleCorps = corps && Object.keys(corps).length > 1;

  // Calculate current week from season data
  const { currentWeek } = seasonData ? getSeasonProgress(seasonData) : { currentWeek: 1 };

  // Use execution hook
  const {
    executionState,
    loading: executionLoading,
    processing: executionProcessing,
    rehearse,
    repairEquipment,
    upgradeEquipment,
    boostMorale,
    calculateMultiplier,
    canRehearseToday
  } = useExecution(user?.uid, activeCorpsClass);
  
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

  // Update selected corps when corps data changes (e.g., new corps registered)
  useEffect(() => {
    if (corps) {
      const corpsClasses = Object.keys(corps);
      // If selected corps doesn't exist anymore, reset to first available
      if (selectedCorpsClass && !corpsClasses.includes(selectedCorpsClass)) {
        setSelectedCorpsClass(corpsClasses[0] || null);
      }
      // If no corps selected yet, select the first one
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
        // Show congratulations for the first newly unlocked class
        const unlockedClass = newlyUnlocked[0];
        setNewlyUnlockedClass(unlockedClass);
        setShowClassUnlockCongrats(true);
      }
    }

    // Update the previous unlocked classes tracker
    if (profile?.unlockedClasses) {
      setPreviousUnlockedClasses(profile.unlockedClasses);
    }
  }, [profile?.unlockedClasses, previousUnlockedClasses]);

  useEffect(() => {
    if (user) {
      // Subscribe to profile updates
      const profileRef = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');
      const unsubscribeProfile = onSnapshot(profileRef, (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          setProfile(data);
          setCorps(data.corps || null);
        } else {
          // Create initial profile
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

      // Fetch battle pass progress
      fetchBattlePassProgress();

      // Subscribe to league rankings
      subscribeToLeagueRankings();

      return () => {
        unsubscribeProfile();
      };
    }
  }, [user]);

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
        const corpsData = data.corpsValues || [];
        setAvailableCorps(corpsData);
      } else {
        setAvailableCorps([]);
      }
    } catch (error) {
      console.error('Error fetching available corps:', error);
      setAvailableCorps([]);
    }
  }, [seasonData?.seasonUid]);

  const fetchRecentScores = useCallback(async () => {
    try {
      if (!seasonData?.seasonUid) {
        setRecentScores([]);
        return;
      }

      const recapDocRef = doc(db, 'fantasy_recaps', seasonData.seasonUid);
      const recapDocSnap = await getDoc(recapDocSnap);

      if (recapDocSnap.exists()) {
        const allRecaps = recapDocSnap.data().recaps || [];
        // Sort by date descending and take the first 5, map to expected UI shape
        const sortedRecaps = allRecaps
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .slice(0, 5)
          .map(r => {
            // For SoundSport, mask the scores
            const isSoundSport = activeCorpsClass === 'soundSport';
            return {
              showName: r.showName || r.name || 'Unknown Show',
              date: r.date || '',
              totalScore: isSoundSport ? 'Complete' : (typeof r.totalScore === 'number' ? r.totalScore.toFixed(2) : (r.totalScore || '0.00')),
              rank: isSoundSport ? '🎉' : (r.rank ?? '-')
            };
          });
        setRecentScores(sortedRecaps);
      } else {
        setRecentScores([]);
      }
    } catch (error) {
      console.error('Error fetching recent scores:', error);
    }
  }, [seasonData?.seasonUid, activeCorpsClass]);

  // Fetch season-specific data when seasonData is available
  useEffect(() => {
    if (seasonData?.seasonUid) {
      fetchAvailableCorps();
      fetchRecentScores();
    }
  }, [seasonData?.seasonUid, fetchAvailableCorps, fetchRecentScores]);

  const fetchBattlePassProgress = async () => {
    try {
      const result = await getBattlePassProgress();
      if (result.data && result.data.success) {
        const progress = result.data.progress;
        setBattlePassRewards(progress);

        // Count unclaimed rewards
        let unclaimedCount = 0;
        for (let level = 1; level <= progress.currentLevel; level++) {
          // Check free tier
          if (!progress.claimedRewards?.free?.includes(level)) {
            unclaimedCount++;
          }
          // Check premium tier if user has battle pass
          if (progress.hasBattlePass && !progress.claimedRewards?.premium?.includes(level)) {
            unclaimedCount++;
          }
        }
        setUnclaimedRewardsCount(unclaimedCount);
      }
    } catch (error) {
      // Silently handle "no active season" errors - this is expected when no battle pass is configured
      if (error.message && !error.message.includes('No active battle pass season')) {
        console.error('Error fetching battle pass progress:', error);
      }
      setBattlePassRewards(null);
      setUnclaimedRewardsCount(0);
    }
  };

  const subscribeToLeagueRankings = () => {
    // Subscribe to user's league rankings
    if (profile?.leagues) {
      // Implementation for league rankings
    }
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

  const handleCorpsSwitch = (classId) => {
    setSelectedCorpsClass(classId);
    setShowCorpsSelector(false);
    toast.success(`Switched to ${getCorpsClassName(classId)}`);
  };

  const handleSetupNewClass = () => {
    setShowClassUnlockCongrats(false);
    setShowRegistration(true);
  };

  const handleDeclineSetup = () => {
    setShowClassUnlockCongrats(false);
    toast.success('You can register your new corps anytime from the dashboard!');
  };

  const handleEditCorps = async (formData) => {
    try {
      const profileRef = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');
      await updateDoc(profileRef, {
        [`corps.${activeCorpsClass}.corpsName`]: formData.name,
        [`corps.${activeCorpsClass}.location`]: formData.location,
        [`corps.${activeCorpsClass}.showConcept`]: formData.showConcept,
      });

      toast.success('Corps updated successfully!');
      setShowEditCorps(false);
    } catch (error) {
      console.error('Error updating corps:', error);
      toast.error('Failed to update corps. Please try again.');
    }
  };

  const handleDeleteCorps = async () => {
    try {
      const profileRef = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');

      // Remove the corps from the profile
      const updatedCorps = { ...corps };
      delete updatedCorps[activeCorpsClass];

      await updateDoc(profileRef, {
        [`corps.${activeCorpsClass}`]: null
      });

      toast.success(`${activeCorps.corpsName || activeCorps.name} has been deleted`);
      setShowDeleteConfirm(false);

      // Switch to another corps if available
      const remainingCorps = Object.keys(updatedCorps);
      if (remainingCorps.length > 0) {
        setSelectedCorpsClass(remainingCorps[0]);
      } else {
        setSelectedCorpsClass(null);
      }
    } catch (error) {
      console.error('Error deleting corps:', error);
      toast.error('Failed to delete corps. Please try again.');
    }
  };

  const handleMoveCorps = async (targetClass) => {
    try {
      if (corps[targetClass]) {
        toast.error(`You already have a corps registered in ${getCorpsClassName(targetClass)}`);
        return;
      }

      const profileRef = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');

      // Copy corps to new class and remove from old class
      const corpsData = { ...activeCorps, class: targetClass };

      await updateDoc(profileRef, {
        [`corps.${targetClass}`]: corpsData,
        [`corps.${activeCorpsClass}`]: null
      });

      toast.success(`${activeCorps.corpsName || activeCorps.name} moved to ${getCorpsClassName(targetClass)}`);
      setShowMoveCorps(false);
      setSelectedCorpsClass(targetClass);
    } catch (error) {
      console.error('Error moving corps:', error);
      toast.error('Failed to move corps. Please try again.');
    }
  };

  const handleCorpsRegistration = async (formData) => {
    try {
      if (!seasonData?.seasonUid) {
        toast.error('Season data not loaded. Please try again.');
        return;
      }

      const profileRef = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');
      const corpsData = {
        name: formData.name,
        location: formData.location,
        showConcept: formData.showConcept,
        class: formData.class,
        createdAt: new Date(),
        seasonId: seasonData.seasonUid,
        lineup: {},
        score: 0,
        rank: null
      };

      await updateDoc(profileRef, {
        [`corps.${formData.class}`]: corpsData
      });

      analyticsHelpers.logCorpsCreated(formData.class);
      toast.success(`${formData.name} registered successfully!`);
      setShowRegistration(false);
      setNewlyUnlockedClass(null); // Clear newly unlocked class after registration
    } catch (error) {
      console.error('Error registering corps:', error);
      toast.error('Failed to register corps. Please try again.');
    }
  };

  const handleCloseRegistration = () => {
    setShowRegistration(false);
    setNewlyUnlockedClass(null); // Clear newly unlocked class when closing
  };

  const handleCaptionSelection = async (captions) => {
    // The new CaptionSelectionModal handles saving via the backend function
    // This callback is called after successful save
    setShowCaptionSelection(false);
  };

  const handleShowSelection = async (shows) => {
    // The ShowSelectionModal handles saving via the backend function
    // This callback is called after successful save
    setShowShowSelection(false);
  };

  const handleDailyRehearsal = async () => {
    try {
      const dailyRehearsal = httpsCallable(functions, 'dailyRehearsal');
      const result = await dailyRehearsal();

      const data = result.data;

      // Show success message
      if (data.classUnlocked) {
        toast.success(data.message, { duration: 5000, icon: '🎉' });
      } else {
        toast.success(data.message, { duration: 3000 });
      }

      // Show XP gained
      toast.success(`+${data.xpEarned} XP! (${data.totalXP} total)`, {
        duration: 2000,
        icon: '⭐'
      });

      if (data.level > (profile?.xpLevel || 1)) {
        toast.success(`Level Up! Now Level ${data.level}`, {
          duration: 4000,
          icon: '🎊'
        });
      }
    } catch (error) {
      console.error('Error with daily rehearsal:', error);

      if (error.message && error.message.includes('rehearse again in')) {
        toast.error(error.message);
      } else {
        toast.error('Failed to complete rehearsal. Please try again.');
      }
    }
  };

  if (loading || seasonLoading) {
    return (
      <div className="space-y-6">
        <SkeletonLoader type="card" count={3} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-gold-500/10 to-cream-500/10 rounded-2xl" />
        <div className="relative p-8 glass rounded-2xl">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-4xl font-display font-bold text-gradient mb-2">
                Welcome back, {profile?.displayName || 'Director'}!
              </h1>
              <p className="text-cream-300">
                {seasonData?.name || 'Loading season...'}
              </p>
            </div>
            <div className="flex items-center gap-4">
              {/* XP Progress */}
              <div className="glass-dark rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Zap className="w-8 h-8 text-gold-500" />
                    <span className="absolute -top-1 -right-1 text-xs font-bold text-gold-500">
                      {profile?.xpLevel || 1}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-cream-500/60">Level Progress</p>
                      <InfoTooltip
                        content="Earn XP by performing shows, completing achievements, and claiming Battle Pass rewards. Every 1000 XP unlocks a new level and may unlock new corps classes."
                        title="Experience Points"
                      />
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-32 h-2 bg-charcoal-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-gold transition-all duration-500"
                          style={{ width: `${((profile?.xp || 0) % 1000) / 10}%` }}
                        />
                      </div>
                      <span className="text-xs text-cream-300">
                        {profile?.xp || 0} XP
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Corps Selector - Show only if user has multiple corps */}
      {hasMultipleCorps && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative"
        >
          <div className="glass rounded-xl p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Music className="w-5 h-5 text-gold-500" />
                <div>
                  <p className="text-xs text-cream-500/60 mb-1">Active Corps</p>
                  <p className="text-sm font-semibold text-cream-100">
                    {activeCorps?.corpsName || activeCorps?.name || 'Select a corps'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCorpsSelector(!showCorpsSelector)}
                className="btn-outline text-sm py-2 px-4 flex items-center gap-2"
              >
                Switch Corps
                <ChevronDown className={`w-4 h-4 transition-transform ${showCorpsSelector ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* Corps Selection Dropdown */}
            <AnimatePresence>
              {showCorpsSelector && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 space-y-2 overflow-hidden"
                >
                  <div className="border-t border-cream-500/10 pt-4">
                    <p className="text-xs text-cream-500/60 mb-3">Select a corps to manage:</p>
                    <div className="space-y-2">
                      {Object.entries(corps).map(([classId, corpsData]) => (
                        <button
                          key={classId}
                          onClick={() => handleCorpsSwitch(classId)}
                          className={`w-full text-left p-3 rounded-lg border transition-all ${
                            activeCorpsClass === classId
                              ? 'border-gold-500 bg-gold-500/10'
                              : 'border-cream-500/20 hover:border-cream-500/40 hover:bg-cream-500/5'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-sm font-semibold ${
                                  activeCorpsClass === classId ? 'text-gold-500' : 'text-cream-100'
                                }`}>
                                  {corpsData.corpsName || corpsData.name}
                                </span>
                                {activeCorpsClass === classId && (
                                  <Check className="w-4 h-4 text-gold-500" />
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-xs px-2 py-0.5 rounded border ${getCorpsClassColor(classId)}`}>
                                  {getCorpsClassName(classId)}
                                </span>
                                {corpsData.location && (
                                  <span className="text-xs text-cream-500/60">
                                    {corpsData.location}
                                  </span>
                                )}
                              </div>
                              {classId !== 'soundSport' && (
                                <div className="flex items-center gap-3 mt-2">
                                  {corpsData.rank && (
                                    <span className="text-xs text-cream-500/60">
                                      Rank: <span className="text-gold-500 font-semibold">#{corpsData.rank}</span>
                                    </span>
                                  )}
                                  {corpsData.totalSeasonScore !== undefined && (
                                    <span className="text-xs text-cream-500/60">
                                      Score: <span className="text-gold-500 font-semibold">{corpsData.totalSeasonScore.toFixed(2)}</span>
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => setShowRegistration(true)}
                      className="w-full mt-3 p-3 rounded-lg border-2 border-dashed border-cream-500/20 hover:border-gold-500/40 hover:bg-gold-500/5 transition-all text-sm text-cream-500/60 hover:text-gold-500 flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Register Another Corps
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}

      {/* Battle Pass Notification */}
      {unclaimedRewardsCount > 0 && (
        <motion.a
          href="/battlepass"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="block"
        >
          <div className="glass-premium rounded-xl p-4 border border-gold-500/30 hover:border-gold-500/60 transition-all cursor-pointer group">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Crown className="w-8 h-8 text-gold-500 group-hover:scale-110 transition-transform" />
                  <Sparkles className="w-4 h-4 text-gold-500 absolute -top-1 -right-1 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gradient flex items-center gap-2">
                    Battle Pass Rewards Available!
                    <span className="px-2 py-0.5 bg-gold-500 text-charcoal-900 rounded-full text-xs font-bold">
                      {unclaimedRewardsCount}
                    </span>
                  </h3>
                  <p className="text-sm text-cream-300">
                    You have {unclaimedRewardsCount} unclaimed reward{unclaimedRewardsCount > 1 ? 's' : ''} waiting for you
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-gold-500">
                <Gift className="w-5 h-5" />
                <span className="text-sm font-semibold">Claim Now</span>
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        </motion.a>
      )}

      {/* Quick Stats */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-4 gap-4"
      >
        <div className="card-hover">
          <div className="flex items-center justify-between mb-2">
            <Trophy className="w-5 h-5 text-gold-500" />
            <span className="text-2xl font-bold text-cream-100">
              {activeCorpsClass === 'soundSport' ? '🎉' : (activeCorps?.rank || '-')}
            </span>
          </div>
          <p className="text-sm text-cream-500/60">
            {activeCorpsClass === 'soundSport' ? 'Participant' : 'Current Rank'}
          </p>
        </div>

        <div className="card-hover">
          <div className="flex items-center justify-between mb-2">
            <Star className="w-5 h-5 text-gold-500" />
            <span className="text-2xl font-bold text-cream-100">
              {activeCorpsClass === 'soundSport' ? (
                activeCorps?.totalSeasonScore > 0 ? '✓' : '-'
              ) : (
                activeCorps?.totalSeasonScore?.toFixed(2) || '0.00'
              )}
            </span>
          </div>
          <p className="text-sm text-cream-500/60">
            {activeCorpsClass === 'soundSport' ? 'Performance' : 'Total Score'}
          </p>
        </div>

        <div className="card-hover">
          <div className="flex items-center justify-between mb-2">
            <Users className="w-5 h-5 text-gold-500" />
            <span className="text-2xl font-bold text-cream-100">
              {profile?.leagues?.length || 0}
            </span>
          </div>
          <p className="text-sm text-cream-500/60">Active Leagues</p>
        </div>

        <div className="card-hover">
          <div className="flex items-center justify-between mb-2">
            <Calendar className="w-5 h-5 text-gold-500" />
            <span className="text-2xl font-bold text-cream-100">
              {weeksRemaining ? `${weeksRemaining}w` : '-'}
            </span>
          </div>
          <p className="text-sm text-cream-500/60">Weeks Remaining</p>
        </div>
      </motion.div>

      {/* Tab Navigation */}
      {activeCorps && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex gap-2 overflow-x-auto"
        >
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all whitespace-nowrap ${
              activeTab === 'overview'
                ? 'bg-gold-500 text-charcoal-900'
                : 'bg-charcoal-800 text-cream-500/60 hover:text-cream-100'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('execution')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'execution'
                ? 'bg-gold-500 text-charcoal-900'
                : 'bg-charcoal-800 text-cream-500/60 hover:text-cream-100'
            }`}
          >
            <Target className="w-4 h-4" />
            Execution
          </button>
          <button
            onClick={() => setActiveTab('equipment')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'equipment'
                ? 'bg-gold-500 text-charcoal-900'
                : 'bg-charcoal-800 text-cream-500/60 hover:text-cream-100'
            }`}
          >
            <Wrench className="w-4 h-4" />
            Equipment
          </button>
          <button
            onClick={() => setActiveTab('staff')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'staff'
                ? 'bg-gold-500 text-charcoal-900'
                : 'bg-charcoal-800 text-cream-500/60 hover:text-cream-100'
            }`}
          >
            <Users className="w-4 h-4" />
            Staff
          </button>
        </motion.div>
      )}

      {/* Execution System Panels */}
      <AnimatePresence mode="wait">
        {activeCorps && activeTab === 'execution' && (
          <motion.div
            key="execution"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <ExecutionDashboard
              executionState={executionState}
              multiplier={calculateMultiplier()}
            />
            <RehearsalPanel
              executionState={executionState}
              canRehearseToday={canRehearseToday()}
              onRehearsal={rehearse}
              processing={executionProcessing}
            />
            <ShowDifficultySelector
              corpsClass={activeCorpsClass}
              currentDifficulty={executionState?.showDesign?.difficulty || activeCorps?.execution?.showDesign?.difficulty}
              currentDay={profile?.currentDay || 1}
              onSuccess={() => {
                toast.success('Show difficulty updated successfully!');
              }}
            />
          </motion.div>
        )}

        {activeCorps && activeTab === 'equipment' && (
          <motion.div
            key="equipment"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <EquipmentManager
              equipment={executionState?.equipment}
              onRepair={repairEquipment}
              onUpgrade={upgradeEquipment}
              processing={executionProcessing}
              corpsCoin={profile?.corpsCoin || 0}
            />
          </motion.div>
        )}

        {activeCorps && activeTab === 'staff' && (
          <motion.div
            key="staff"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <StaffRoster
              staff={executionState?.staff}
              processing={executionProcessing}
              corpsCoin={profile?.corpsCoin || 0}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Season Info & Corps Management */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Season Information */}
        <SeasonInfo className="lg:col-span-1" />

        {/* Corps Management Card */}
        <div className="lg:col-span-2">
          {/* Corps Management */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {!activeCorps ? (
          // Registration CTA
          <div className="card-premium p-8 text-center">
            <Music className="w-16 h-16 text-gold-500 mx-auto mb-4" />
            <h2 className="text-2xl font-display font-bold text-cream-100 mb-2">
              Start Your Journey
            </h2>
            <p className="text-cream-300 mb-6">
              Register your fantasy corps and compete in the ultimate drum corps experience
            </p>
            <button
              onClick={() => setShowRegistration(true)}
              className="btn-primary"
            >
              <Plus className="w-5 h-5 inline mr-2" />
              Register Corps
            </button>
          </div>
        ) : (
          // Corps Dashboard
          <div className="space-y-6">
            {/* Corps Info */}
            <div className="card">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-display font-bold text-cream-100 mb-1">
                    {activeCorps.corpsName || activeCorps.name}
                  </h2>
                  <p className="text-cream-500/60">{activeCorps.location}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`badge ${
                      activeCorpsClass === 'world' ? 'badge-gold' :
                      activeCorpsClass === 'open' ? 'badge-cream' :
                      activeCorpsClass === 'soundSport' ? 'badge-success' :
                      'badge-primary'
                    }`}>
                      {activeCorpsClass === 'soundSport' ? 'SoundSport' :
                       activeCorpsClass === 'world' ? 'World Class' :
                       activeCorpsClass === 'open' ? 'Open Class' :
                       activeCorpsClass === 'aClass' ? 'A Class' : 'Unknown'}
                    </span>
                    {activeCorpsClass !== 'soundSport' && activeCorps.rank && activeCorps.rank <= 10 && (
                      <span className="badge badge-gold">
                        <Trophy className="w-3 h-3 mr-1" />
                        Top 10
                      </span>
                    )}
                  </div>
                </div>
                <div className="relative">
                  <button
                    onClick={() => setShowCorpsManagementMenu(!showCorpsManagementMenu)}
                    className="btn-ghost"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>

                  {/* Corps Management Dropdown Menu */}
                  <AnimatePresence>
                    {showCorpsManagementMenu && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        className="absolute right-0 top-full mt-2 w-48 glass-dark rounded-lg shadow-xl border border-cream-500/20 z-20 overflow-hidden"
                      >
                        <button
                          onClick={() => {
                            setShowEditCorps(true);
                            setShowCorpsManagementMenu(false);
                          }}
                          className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-cream-500/10 transition-colors text-cream-100"
                        >
                          <Edit className="w-4 h-4 text-blue-500" />
                          <span className="text-sm">Edit Details</span>
                        </button>
                        <button
                          onClick={() => {
                            setShowMoveCorps(true);
                            setShowCorpsManagementMenu(false);
                          }}
                          className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-cream-500/10 transition-colors text-cream-100"
                        >
                          <ArrowRightLeft className="w-4 h-4 text-purple-500" />
                          <span className="text-sm">Move to Another Class</span>
                        </button>
                        <div className="border-t border-cream-500/10"></div>
                        <button
                          onClick={() => {
                            setShowDeleteConfirm(true);
                            setShowCorpsManagementMenu(false);
                          }}
                          className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-red-500/10 transition-colors text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="text-sm">Delete Corps</span>
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Show Concept */}
              {activeCorps.showConcept && (
                <div className="p-4 bg-charcoal-900/30 rounded-lg mb-6">
                  <p className="text-sm text-cream-500/60 mb-1">Show Concept</p>
                  <p className="text-cream-100">{activeCorps.showConcept}</p>
                </div>
              )}

              {/* Caption Lineup */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-cream-100">
                        Caption Lineup
                      </h3>
                      <InfoTooltip
                        content="Select historical caption heads from different corps and years. Each selection has a point value based on their real-world performance. Stay within your class limit."
                        title="Caption Selection"
                      />
                    </div>
                    {Object.keys(activeCorps.lineup || {}).length > 0 && (() => {
                      const totalPoints = Object.values(activeCorps.lineup).reduce((sum, selection) => {
                        const parts = selection.split('|');
                        return sum + (parseInt(parts[2]) || 0);
                      }, 0);
                      const pointLimits = { soundSport: 90, aClass: 60, open: 120, world: 150 };
                      const limit = pointLimits[activeCorpsClass] || 150;
                      return (
                        <p className="text-sm text-cream-500/60">
                          Total: <span className={`font-bold ${totalPoints > limit ? 'text-red-500' : 'text-gold-500'}`}>
                            {totalPoints}
                          </span> / {limit} points
                        </p>
                      );
                    })()}
                  </div>
                  <button
                    onClick={() => setShowCaptionSelection(true)}
                    className="btn-outline text-sm py-2"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Lineup
                  </button>
                </div>

                {Object.keys(activeCorps.lineup || {}).length === 0 ? (
                  <div className="text-center py-8">
                    <AlertCircle className="w-12 h-12 text-cream-500/40 mx-auto mb-3" />
                    <p className="text-cream-500/60">No captions selected yet</p>
                    <button
                      onClick={() => setShowCaptionSelection(true)}
                      className="btn-primary mt-4"
                    >
                      Select Captions
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Object.entries(activeCorps.lineup).map(([caption, selection]) => {
                      // Parse the selection string: corpsName|sourceYear|points
                      const parts = selection.split('|');
                      const corpsName = parts[0] || selection;
                      const year = parts[1] || '';
                      const points = parts[2] || '';

                      return (
                        <div key={caption} className="flex items-center justify-between p-3 bg-charcoal-900/30 rounded-lg">
                          <div className="flex-1">
                            <p className="text-xs text-cream-500/60">{caption}</p>
                            <p className="text-sm font-medium text-cream-100">{corpsName}</p>
                            {year && <p className="text-xs text-cream-500/40">({year})</p>}
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-gold-500">{points || '?'}</p>
                            <p className="text-xs text-cream-500/60">pts</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Show Selection */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-cream-100">
                      Show Schedule
                    </h3>
                    <InfoTooltip
                      content="Select up to 4 shows to compete in each week. More competitive shows offer higher scores but face tougher competition. Choose strategically!"
                      title="Show Selection"
                    />
                  </div>
                  <p className="text-sm text-cream-500/60">
                    Week {currentWeek}
                    {activeCorps.selectedShows?.[`week${currentWeek}`]?.length > 0 &&
                      ` - ${activeCorps.selectedShows[`week${currentWeek}`].length} shows selected`
                    }
                  </p>
                </div>
                <button
                  onClick={() => {
                    // Check if lineup is complete before allowing show selection
                    const lineup = activeCorps?.lineup;
                    if (!lineup || Object.keys(lineup).length !== 8) {
                      toast.error('Please select your 8 captions before choosing shows');
                      return;
                    }
                    setShowShowSelection(true);
                  }}
                  className="btn-outline text-sm py-2"
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  {activeCorps.selectedShows?.[`week${currentWeek}`]?.length > 0 ? 'Edit Shows' : 'Select Shows'}
                </button>
              </div>

              {!activeCorps.selectedShows?.[`week${currentWeek}`] || activeCorps.selectedShows[`week${currentWeek}`].length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 text-cream-500/40 mx-auto mb-3" />
                  <p className="text-cream-500/60 mb-1">No shows selected for this week</p>
                  <p className="text-sm text-cream-500/40 mb-4">Select up to 4 shows to attend</p>
                  <button
                    onClick={() => {
                      // Check if lineup is complete before allowing show selection
                      const lineup = activeCorps?.lineup;
                      if (!lineup || Object.keys(lineup).length !== 8) {
                        toast.error('Please select your 8 captions before choosing shows');
                        return;
                      }
                      setShowShowSelection(true);
                    }}
                    className="btn-primary"
                  >
                    Select Shows
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeCorps.selectedShows[`week${currentWeek}`].map((show, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-charcoal-900/30 rounded-lg">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-cream-100">{show.eventName}</p>
                        <div className="flex items-center gap-3 mt-1">
                          {show.date && (
                            <p className="text-xs text-cream-500/60 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {show.date}
                            </p>
                          )}
                          {show.location && (
                            <p className="text-xs text-cream-500/60 flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {show.location}
                            </p>
                          )}
                        </div>
                      </div>
                      <Check className="w-5 h-5 text-green-500" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Performance Chart */}
            <PerformanceChart scores={recentScores} corpsClass={activeCorpsClass} />
          </div>
        )}
      </motion.div>
        </div>
      </div>
      )}

      {/* Recent Activity */}
      {activeTab === 'overview' && (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        {/* Recent Scores */}
        <div className="card">
          <h3 className="text-lg font-semibold text-cream-100 mb-4">
            {activeCorpsClass === 'soundSport' ? 'Recent Performances' : 'Recent Scores'}
          </h3>
          {recentScores.length === 0 ? (
            <p className="text-cream-500/60 text-center py-8">
              {activeCorpsClass === 'soundSport'
                ? 'No performances yet'
                : 'No scores available yet'}
            </p>
          ) : (
            <div className="space-y-3">
              {recentScores.map((score, index) => (
                <div key={index} className="flex items-center justify-between p-3 hover:bg-cream-500/5 rounded-lg transition-colors">
                  <div>
                    <p className="font-medium text-cream-100">{score.showName}</p>
                    <p className="text-sm text-cream-500/60">{score.date}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gold-500">{score.totalScore}</p>
                    {activeCorpsClass !== 'soundSport' && (
                      <p className="text-xs text-cream-500/60">Rank #{score.rank}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* League Activity */}
        <div className="card">
          <h3 className="text-lg font-semibold text-cream-100 mb-4">
            League Activity
          </h3>
          {!profile?.leagues || profile.leagues.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-cream-500/40 mx-auto mb-3" />
              <p className="text-cream-500/60 mb-4">Not in any leagues yet</p>
              <a href="/leagues" className="btn-outline inline-flex items-center">
                Browse Leagues
                <ChevronRight className="w-4 h-4 ml-2" />
              </a>
            </div>
          ) : (
            <div className="space-y-3">
              {profile.leagues.slice(0, 3).map((leagueId, index) => (
                <div
                  key={leagueId}
                  className="flex items-center justify-between p-3 bg-charcoal-900/30 rounded-lg hover:bg-charcoal-900/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Trophy className="w-5 h-5 text-gold-500" />
                    <div>
                      <p className="text-sm font-semibold text-cream-100">League {index + 1}</p>
                      <p className="text-xs text-cream-500/60">Active</p>
                    </div>
                  </div>
                  <a href="/leagues" className="text-sm text-gold-500 hover:text-gold-400">
                    View
                  </a>
                </div>
              ))}
              <a
                href="/leagues"
                className="block text-center p-3 text-sm text-gold-500 hover:text-gold-400 hover:bg-charcoal-900/30 rounded-lg transition-colors"
              >
                View All Leagues →
              </a>
            </div>
          )}
        </div>
      </motion.div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {showClassUnlockCongrats && newlyUnlockedClass && (
          <ClassUnlockCongratsModal
            unlockedClass={newlyUnlockedClass}
            onSetup={handleSetupNewClass}
            onDecline={handleDeclineSetup}
            xpLevel={profile?.xpLevel || 1}
          />
        )}

        {showRegistration && (
          <CorpsRegistrationModal
            onClose={handleCloseRegistration}
            onSubmit={handleCorpsRegistration}
            unlockedClasses={profile?.unlockedClasses || ['soundSport']}
            defaultClass={newlyUnlockedClass}
          />
        )}
        
        {showCaptionSelection && activeCorps && seasonData && (
          <CaptionSelectionModal
            onClose={() => setShowCaptionSelection(false)}
            onSubmit={handleCaptionSelection}
            corpsClass={activeCorpsClass}
            currentLineup={activeCorps.lineup || {}}
            seasonId={seasonData.seasonUid}
          />
        )}

        {showShowSelection && activeCorps && seasonData && (
          <ShowSelectionModal
            onClose={() => setShowShowSelection(false)}
            onSubmit={handleShowSelection}
            corpsClass={activeCorpsClass}
            currentWeek={currentWeek}
            seasonId={seasonData.seasonUid}
            currentSelections={activeCorps.selectedShows?.[`week${currentWeek}`] || []}
          />
        )}

        {showEditCorps && activeCorps && (
          <EditCorpsModal
            onClose={() => setShowEditCorps(false)}
            onSubmit={handleEditCorps}
            currentData={{
              name: activeCorps.corpsName || activeCorps.name,
              location: activeCorps.location,
              showConcept: activeCorps.showConcept
            }}
          />
        )}

        {showDeleteConfirm && activeCorps && (
          <DeleteConfirmModal
            onClose={() => setShowDeleteConfirm(false)}
            onConfirm={handleDeleteCorps}
            corpsName={activeCorps.corpsName || activeCorps.name}
            corpsClass={activeCorpsClass}
          />
        )}

        {showMoveCorps && activeCorps && (
          <MoveCorpsModal
            onClose={() => setShowMoveCorps(false)}
            onMove={handleMoveCorps}
            currentClass={activeCorpsClass}
            corpsName={activeCorps.corpsName || activeCorps.name}
            unlockedClasses={profile?.unlockedClasses || ['soundSport']}
            existingCorps={corps}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// Class Unlock Congratulations Modal Component
const ClassUnlockCongratsModal = ({ unlockedClass, onSetup, onDecline, xpLevel }) => {
  const getClassInfo = (classId) => {
    const classInfo = {
      aClass: {
        name: 'A Class',
        description: 'Intermediate level corps with higher point limits and more competitive shows',
        icon: '🎺',
        color: 'from-blue-500 to-blue-600',
        requiredLevel: 3
      },
      open: {
        name: 'Open Class',
        description: 'Advanced level corps with expanded opportunities and prestigious competitions',
        icon: '🎖️',
        color: 'from-purple-500 to-purple-600',
        requiredLevel: 5
      },
      world: {
        name: 'World Class',
        description: 'Elite level corps competing at the highest tier of drum corps activity',
        icon: '👑',
        color: 'from-gold-500 to-gold-600',
        requiredLevel: 10
      }
    };
    return classInfo[classId] || classInfo.aClass;
  };

  const classInfo = getClassInfo(unlockedClass);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0, y: 50 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.8, opacity: 0, y: 50 }}
        transition={{ type: 'spring', duration: 0.5 }}
        className="w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="glass-premium rounded-2xl p-8 border-2 border-gold-500/30 relative overflow-hidden">
          {/* Animated background gradient */}
          <div className={`absolute inset-0 bg-gradient-to-br ${classInfo.color} opacity-10 animate-pulse`} />

          <div className="relative z-10">
            {/* Celebration icon */}
            <div className="text-center mb-6">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                className="text-7xl mb-4"
              >
                {classInfo.icon}
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <h2 className="text-4xl font-display font-bold text-gradient mb-2">
                  Congratulations!
                </h2>
                <p className="text-xl text-cream-100 font-semibold">
                  You've reached Level {xpLevel}!
                </p>
              </motion.div>
            </div>

            {/* Class unlock info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="glass-dark rounded-xl p-6 mb-6"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${classInfo.color} flex items-center justify-center`}>
                    <Lock className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-display font-bold text-cream-100 mb-2">
                    {classInfo.name} Unlocked!
                  </h3>
                  <p className="text-cream-300 text-sm leading-relaxed">
                    {classInfo.description}
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Call to action */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="space-y-3"
            >
              <p className="text-center text-cream-300 mb-4">
                Would you like to register a corps for {classInfo.name} now?
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={onDecline}
                  className="btn-ghost flex-1"
                >
                  Maybe Later
                </button>
                <button
                  onClick={onSetup}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-5 h-5" />
                  Register Corps
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// Corps Registration Modal Component
const CorpsRegistrationModal = ({ onClose, onSubmit, unlockedClasses, defaultClass }) => {
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    showConcept: '',
    class: defaultClass || 'soundSport'
  });

  const classes = [
    { 
      id: 'soundSport', 
      name: 'SoundSport', 
      description: 'Entry level - Perfect for beginners',
      unlocked: true,
      color: 'bg-green-500'
    },
    { 
      id: 'aClass', 
      name: 'A Class', 
      description: 'Intermediate - Requires Level 3',
      unlocked: unlockedClasses.includes('aClass'),
      color: 'bg-blue-500'
    },
    { 
      id: 'open', 
      name: 'Open Class', 
      description: 'Advanced - Requires Level 5',
      unlocked: unlockedClasses.includes('open'),
      color: 'bg-purple-500'
    },
    { 
      id: 'world', 
      name: 'World Class', 
      description: 'Elite - Requires Level 10',
      unlocked: unlockedClasses.includes('world'),
      color: 'bg-gold-500'
    }
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="glass-dark rounded-2xl p-8">
          <h2 className="text-3xl font-display font-bold text-gradient mb-6">
            Register Your Corps
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Corps Name */}
            <div>
              <label className="label">Corps Name</label>
              <input
                type="text"
                className="input"
                placeholder="Enter your corps name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                maxLength={50}
              />
            </div>

            {/* Location */}
            <div>
              <label className="label">Home Location</label>
              <input
                type="text"
                className="input"
                placeholder="City, State"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                required
                maxLength={50}
              />
            </div>

            {/* Show Concept */}
            <div>
              <label className="label">Show Concept</label>
              <textarea
                className="textarea h-24"
                placeholder="Describe your show concept for this season..."
                value={formData.showConcept}
                onChange={(e) => setFormData({ ...formData, showConcept: e.target.value })}
                required
                maxLength={500}
              />
              <p className="text-xs text-cream-500/40 mt-1">
                {formData.showConcept.length}/500 characters
              </p>
            </div>

            {/* Class Selection */}
            <div>
              <label className="label">Competition Class</label>
              <div className="grid grid-cols-2 gap-3">
                {classes.map((cls) => (
                  <button
                    key={cls.id}
                    type="button"
                    className={`
                      relative p-4 rounded-lg border-2 transition-all duration-300
                      ${formData.class === cls.id 
                        ? 'border-gold-500 bg-gold-500/10' 
                        : 'border-cream-500/20 hover:border-cream-500/40'
                      }
                      ${!cls.unlocked ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                    onClick={() => cls.unlocked && setFormData({ ...formData, class: cls.id })}
                    disabled={!cls.unlocked}
                  >
                    {!cls.unlocked && (
                      <div className="absolute top-2 right-2">
                        <Lock className="w-4 h-4 text-cream-500/40" />
                      </div>
                    )}
                    {cls.unlocked && formData.class === cls.id && (
                      <div className="absolute top-2 right-2">
                        <Check className="w-4 h-4 text-gold-500" />
                      </div>
                    )}
                    <div className={`w-2 h-2 ${cls.color} rounded-full mb-2`} />
                    <p className="font-semibold text-cream-100">{cls.name}</p>
                    <p className="text-xs text-cream-500/60 mt-1">{cls.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="btn-ghost flex-1"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary flex-1"
              >
                Register Corps
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </motion.div>
  );
};

// Edit Corps Modal Component
const EditCorpsModal = ({ onClose, onSubmit, currentData }) => {
  const [formData, setFormData] = useState({
    name: currentData.name || '',
    location: currentData.location || '',
    showConcept: currentData.showConcept || ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="glass-dark rounded-2xl p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-display font-bold text-gradient">
              Edit Corps Details
            </h2>
            <button onClick={onClose} className="btn-ghost p-2">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Corps Name */}
            <div>
              <label className="label">Corps Name</label>
              <input
                type="text"
                className="input"
                placeholder="Enter your corps name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                maxLength={50}
              />
            </div>

            {/* Location */}
            <div>
              <label className="label">Home Location</label>
              <input
                type="text"
                className="input"
                placeholder="City, State"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                required
                maxLength={50}
              />
            </div>

            {/* Show Concept */}
            <div>
              <label className="label">Show Concept</label>
              <textarea
                className="textarea h-24"
                placeholder="Describe your show concept for this season..."
                value={formData.showConcept}
                onChange={(e) => setFormData({ ...formData, showConcept: e.target.value })}
                required
                maxLength={500}
              />
              <p className="text-xs text-cream-500/40 mt-1">
                {formData.showConcept.length}/500 characters
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="btn-ghost flex-1"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary flex-1"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </motion.div>
  );
};

// Delete Confirmation Modal Component
const DeleteConfirmModal = ({ onClose, onConfirm, corpsName, corpsClass }) => {
  const getCorpsClassName = (classId) => {
    const classNames = {
      soundSport: 'SoundSport',
      aClass: 'A Class',
      open: 'Open Class',
      world: 'World Class'
    };
    return classNames[classId] || classId;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="glass-dark rounded-2xl p-8 border-2 border-red-500/30">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-2xl font-display font-bold text-cream-100 mb-2">
              Delete Corps?
            </h2>
            <p className="text-cream-300">
              This action cannot be undone
            </p>
          </div>

          <div className="glass-premium rounded-xl p-4 mb-6">
            <p className="text-sm text-cream-500/60 mb-1">You are about to delete:</p>
            <p className="text-lg font-semibold text-cream-100">{corpsName}</p>
            <p className="text-sm text-cream-500/60 mt-1">{getCorpsClassName(corpsClass)}</p>
          </div>

          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-300">
              All data for this corps will be permanently deleted, including:
            </p>
            <ul className="text-sm text-red-300/80 mt-2 space-y-1 ml-4">
              <li>• Caption lineup</li>
              <li>• Show selections</li>
              <li>• Equipment and staff</li>
              <li>• Performance history</li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onClose}
              className="btn-outline flex-1"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition-colors"
            >
              Delete Corps
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// Move Corps Modal Component
const MoveCorpsModal = ({ onClose, onMove, currentClass, corpsName, unlockedClasses, existingCorps }) => {
  const [selectedClass, setSelectedClass] = useState('');

  const getCorpsClassName = (classId) => {
    const classNames = {
      soundSport: 'SoundSport',
      aClass: 'A Class',
      open: 'Open Class',
      world: 'World Class'
    };
    return classNames[classId] || classId;
  };

  const getClassColor = (classId) => {
    const colors = {
      soundSport: 'from-green-500 to-green-600',
      aClass: 'from-blue-500 to-blue-600',
      open: 'from-purple-500 to-purple-600',
      world: 'from-gold-500 to-gold-600'
    };
    return colors[classId] || 'from-cream-500 to-cream-600';
  };

  const availableClasses = [
    { id: 'soundSport', name: 'SoundSport', level: 'Entry' },
    { id: 'aClass', name: 'A Class', level: 'Intermediate' },
    { id: 'open', name: 'Open Class', level: 'Advanced' },
    { id: 'world', name: 'World Class', level: 'Elite' }
  ].filter(cls =>
    cls.id !== currentClass && // Not current class
    unlockedClasses.includes(cls.id) && // User has unlocked it
    !existingCorps[cls.id] // No corps already in that class
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedClass) {
      onMove(selectedClass);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="glass-dark rounded-2xl p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-display font-bold text-gradient">
              Move Corps
            </h2>
            <button onClick={onClose} className="btn-ghost p-2">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="glass-premium rounded-xl p-4 mb-6">
            <p className="text-sm text-cream-500/60 mb-1">Moving:</p>
            <p className="text-lg font-semibold text-cream-100">{corpsName}</p>
            <p className="text-sm text-cream-500/60 mt-1">
              From: <span className="text-cream-300">{getCorpsClassName(currentClass)}</span>
            </p>
          </div>

          {availableClasses.length === 0 ? (
            <div className="text-center py-8">
              <Lock className="w-12 h-12 text-cream-500/40 mx-auto mb-3" />
              <p className="text-cream-500/60 mb-2">No classes available</p>
              <p className="text-sm text-cream-500/40">
                Either you haven't unlocked other classes, or you already have a corps in each available class.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Select Target Class</label>
                <div className="space-y-2">
                  {availableClasses.map((cls) => (
                    <button
                      key={cls.id}
                      type="button"
                      onClick={() => setSelectedClass(cls.id)}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                        selectedClass === cls.id
                          ? 'border-gold-500 bg-gold-500/10'
                          : 'border-cream-500/20 hover:border-cream-500/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-cream-100">{cls.name}</p>
                          <p className="text-sm text-cream-500/60">{cls.level}</p>
                        </div>
                        {selectedClass === cls.id && (
                          <Check className="w-5 h-5 text-gold-500" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <p className="text-sm text-blue-300">
                  <strong>Note:</strong> Moving your corps will preserve all data including lineup, shows, equipment, and staff.
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-ghost flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedClass}
                  className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Move Corps
                </button>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default Dashboard;
