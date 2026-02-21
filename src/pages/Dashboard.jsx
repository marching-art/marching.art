// =============================================================================
// DASHBOARD - TEAM OVERVIEW (ESPN Fantasy Style)
// =============================================================================
// Hero: Active Lineup Roster Table. Sidebar: Season Scorecard + Recent Results.
// Laws: App Shell, 2/3 + 1/3 grid, data tables over cards, no glow

import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Trophy, Edit, TrendingUp, TrendingDown, Minus,
  Calendar, Users, Lock, ChevronRight, Activity, MapPin,
  Flame, Coins, Medal, Palette, FileText
} from 'lucide-react';
import { useAuth } from '../App';
import { db } from '../firebase';
import { doc, updateDoc, getDoc, collection, getDocs } from 'firebase/firestore';
import toast from 'react-hot-toast';

// OPTIMIZATION #9: Lazy-load large modal components to reduce initial bundle size
// Prioritized by file size: CaptionSelectionModal (1007 lines), UniformDesignModal (794 lines),
// NewsSubmissionModal (283 lines), ClassPurchaseModal (247 lines)
const CaptionSelectionModal = lazy(() => import('../components/CaptionSelection/CaptionSelectionModal'));
const SeasonSetupWizard = lazy(() => import('../components/SeasonSetupWizard'));
const UniformDesignModal = lazy(() => import('../components/modals/UniformDesignModal'));
const NewsSubmissionModal = lazy(() => import('../components/modals/NewsSubmissionModal'));
const ClassPurchaseModal = lazy(() => import('../components/modals/ClassPurchaseModal'));

import {
  ClassUnlockCongratsModal,
  CorpsRegistrationModal,
  EditCorpsModal,
  DeleteConfirmModal,
  RetireConfirmModal,
  MoveCorpsModal,
  AchievementModal,
  OnboardingTour,
  QuickStartGuide,
  // OPTIMIZATION #4: Import extracted section components
  ControlBar,
  ActiveLineupTable,
  SeasonScorecard,
  RecentResultsFeed,
  LeagueStatus,
  DailyChallenges,
  QuickStats,
  CAPTIONS,
  CLASS_LABELS,
  CLASS_DISPLAY_NAMES,
  CLASS_UNLOCK_LEVELS,
  CLASS_UNLOCK_COSTS,
  getSoundSportRating,
} from '../components/Dashboard';

import { getWeeksUntilUnlock } from '../utils/classUnlockTime';

import { useDashboardData } from '../hooks/useDashboardData';
import { useScoresData } from '../hooks/useScoresData';
import { useMyLeagues } from '../hooks/useLeagues';
import { retireCorps } from '../firebase/functions';
import { registerCorps, unlockClassWithCorpsCoin, submitNewsForApproval, transferCorps } from '../api/functions';
import { useHaptic } from '../hooks/useHaptic';
import { useModalQueue, MODAL_PRIORITY } from '../hooks/useModalQueue';
import { useSeasonStore } from '../store/seasonStore';
import { CORPS_CLASS_ORDER } from '../utils/corps';

// OPTIMIZATION #4: Constants moved to src/components/Dashboard/sections/constants.js
// Imported via: CLASS_LABELS, CAPTIONS, CLASS_DISPLAY_NAMES, getSoundSportRating

// =============================================================================
// HISTORICAL SCORE HELPERS
// =============================================================================

/**
 * Get the effective current day for score filtering
 * Scores are processed at 2 AM, so between midnight and 2 AM
 * we should still show the previous day's cutoff
 */
const getEffectiveDay = (currentDay) => {
  const now = new Date();
  const hour = now.getHours();
  // Scores for day N are processed at 2 AM and become available after that.
  // After 2 AM: previous day's scores were just processed (currentDay - 1)
  // Before 2 AM: scores only available up to currentDay - 2 (yesterday's processing hasn't run)
  const effectiveDay = hour < 2 ? currentDay - 2 : currentDay - 1;

  // Return null if no scores should be available yet (e.g., day 1)
  return effectiveDay >= 1 ? effectiveDay : null;
};

/**
 * Process historical scores for a corps to get category totals (for SoundSport)
 * Returns: { geTotal, visTotal, musTotal } from the most recent score
 */
const processCategoryTotals = (yearData, corpsName, effectiveDay) => {
  // If no effective day (e.g., day 1 before scores processed), return no scores
  if (effectiveDay === null) {
    return { geTotal: null, visTotal: null, musTotal: null };
  }

  const scores = [];

  for (const event of yearData) {
    // Only include scores from days up to and including the effective day
    // effectiveDay represents the day whose scores have been processed (at 2 AM)
    if (event.offSeasonDay > effectiveDay) continue;

    const scoreData = event.scores?.find(s => s.corps === corpsName);
    if (scoreData?.captions) {
      scores.push({
        day: event.offSeasonDay,
        captions: scoreData.captions
      });
    }
  }

  if (scores.length === 0) {
    return { geTotal: null, visTotal: null, musTotal: null };
  }

  // Sort by day descending (most recent first)
  scores.sort((a, b) => b.day - a.day);
  const latestCaptions = scores[0].captions;

  // Calculate category totals
  const geTotal = (latestCaptions.GE1 || 0) + (latestCaptions.GE2 || 0);
  const visTotal = (latestCaptions.VP || 0) + (latestCaptions.VA || 0) + (latestCaptions.CG || 0);
  const musTotal = (latestCaptions.B || 0) + (latestCaptions.MA || 0) + (latestCaptions.P || 0);

  // Calculate trends for each category by comparing to previous score
  let geTrend = null, visTrend = null, musTrend = null;

  if (scores.length > 1) {
    const previousCaptions = scores[1].captions;
    const prevGe = (previousCaptions.GE1 || 0) + (previousCaptions.GE2 || 0);
    const prevVis = (previousCaptions.VP || 0) + (previousCaptions.VA || 0) + (previousCaptions.CG || 0);
    const prevMus = (previousCaptions.B || 0) + (previousCaptions.MA || 0) + (previousCaptions.P || 0);

    const calcTrend = (current, previous) => {
      const delta = current - previous;
      if (delta > 0.001) return { direction: 'up', delta: `+${delta.toFixed(2)}` };
      if (delta < -0.001) return { direction: 'down', delta: delta.toFixed(2) };
      return { direction: 'same', delta: '0.00' };
    };

    geTrend = calcTrend(geTotal, prevGe);
    visTrend = calcTrend(visTotal, prevVis);
    musTrend = calcTrend(musTotal, prevMus);
  }

  return { geTotal, visTotal, musTotal, geTrend, visTrend, musTrend };
};

/**
 * Process historical scores for a corps to get caption-specific data
 * Returns: { score, trend, nextShow } for a given caption
 */
const processCaptionScores = (yearData, corpsName, captionId, effectiveDay) => {
  // If no effective day (e.g., day 1 before scores processed), return no scores
  // but still find the next upcoming show
  if (effectiveDay === null) {
    // Find the first show (day 1)
    const sortedEvents = [...yearData].sort((a, b) => (a.offSeasonDay || 0) - (b.offSeasonDay || 0));
    const firstShow = sortedEvents.find(e => e.scores?.find(s => s.corps === corpsName));
    return {
      score: null,
      trend: null,
      nextShow: firstShow ? { day: firstShow.offSeasonDay, location: firstShow.eventName || firstShow.name || 'TBD' } : null
    };
  }

  const scores = [];
  let nextShow = null;

  // Sort events by day
  const sortedEvents = [...yearData].sort((a, b) => (a.offSeasonDay || 0) - (b.offSeasonDay || 0));

  for (const event of sortedEvents) {
    const scoreData = event.scores?.find(s => s.corps === corpsName);

    // Find next upcoming show (first event with day > effectiveDay)
    if (event.offSeasonDay > effectiveDay && !nextShow && scoreData) {
      nextShow = {
        day: event.offSeasonDay,
        location: event.eventName || event.name || 'TBD'
      };
    }

    // Only include scores from days up to and including the effective day
    // effectiveDay represents the day whose scores have been processed (at 2 AM)
    if (event.offSeasonDay > effectiveDay) continue;

    if (scoreData?.captions) {
      const captionScore = scoreData.captions[captionId];
      // Skip zero scores
      if (captionScore && captionScore > 0) {
        scores.push({
          day: event.offSeasonDay,
          score: captionScore,
          eventName: event.eventName || event.name
        });
      }
    }
  }

  if (scores.length === 0) {
    return { score: null, trend: null, nextShow };
  }

  // Sort by day descending (most recent first)
  scores.sort((a, b) => b.day - a.day);

  const latestScore = scores[0].score;
  const latestDay = scores[0].day;

  // Find previous score from a different day
  let previousScore = null;
  for (let i = 1; i < scores.length; i++) {
    if (scores[i].day !== latestDay) {
      previousScore = scores[i].score;
      break;
    }
  }

  // Calculate trend
  let trend = null;
  if (previousScore !== null) {
    const delta = latestScore - previousScore;
    if (delta > 0.001) {
      trend = { direction: 'up', delta: `+${delta.toFixed(2)}` };
    } else if (delta < -0.001) {
      trend = { direction: 'down', delta: delta.toFixed(2) };
    } else {
      trend = { direction: 'same', delta: '0.00' };
    }
  }

  return { score: latestScore, trend, nextShow };
};

// OPTIMIZATION #4: Inline components extracted to src/components/Dashboard/sections/
// - ControlBar, ActiveLineupTable, SeasonScorecard, RecentResultsFeed, LeagueStatus
// This reduces Dashboard.jsx from 1600+ lines to ~800 lines and isolates renders

// =============================================================================
// DASHBOARD COMPONENT
// =============================================================================

const Dashboard = () => {
  const { user } = useAuth();
  const location = useLocation();
  const dashboardData = useDashboardData();
  const { aggregatedScores, allShows, loading: scoresLoading } = useScoresData({
    // Dashboard should only show current season data, not fall back to archived seasons
    disableArchiveFallback: true,
    // Filter to active corps class to include SoundSport scores (excluded by default with 'all')
    classFilter: dashboardData.activeCorpsClass || 'all'
  });
  const { data: myLeagues } = useMyLeagues(user?.uid);
  const { trigger: haptic } = useHaptic();
  const { weeksRemaining, isRegistrationLocked, currentDay } = useSeasonStore();

  // Calculate if scores are available (for hiding Last Score/Trend columns on Day 1)
  const scoresAvailable = currentDay ? getEffectiveDay(currentDay) !== null : false;

  // Modal states
  const modalQueue = useModalQueue();
  const [showRegistration, setShowRegistration] = useState(false);
  const [showCaptionSelection, setShowCaptionSelection] = useState(false);
  const [selectedCaption, setSelectedCaption] = useState(null);
  const [showEditCorps, setShowEditCorps] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMoveCorps, setShowMoveCorps] = useState(false);
  const [showRetireConfirm, setShowRetireConfirm] = useState(false);
  const [retiring, setRetiring] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [showQuickStartGuide, setShowQuickStartGuide] = useState(false);
  const [classToPurchase, setClassToPurchase] = useState(null);
  const [lineupScoreData, setLineupScoreData] = useState({});
  const [lineupScoresLoading, setLineupScoresLoading] = useState(true);
  const [recentResults, setRecentResults] = useState([]);
  const [showUniformDesign, setShowUniformDesign] = useState(false);
  const [showNewsSubmission, setShowNewsSubmission] = useState(false);
  const [submittingNews, setSubmittingNews] = useState(false);

  // Destructure dashboard data
  const {
    profile,
    corps,
    activeCorps,
    activeCorpsClass,
    seasonData,
    currentWeek,
    showSeasonSetupWizard,
    setShowSeasonSetupWizard,
    corpsNeedingSetup,
    handleSeasonSetupComplete,
    newlyUnlockedClass,
    clearNewlyUnlockedClass,
    newAchievement,
    clearNewAchievement,
    getCorpsClassName,
    refreshProfile,
    handleCorpsSwitch,
    unlockedClasses  // Includes admin override - admins have all classes
  } = dashboardData;

  // Computed values
  const lineup = useMemo(() => activeCorps?.lineup || {}, [activeCorps?.lineup]);
  const lineupCount = useMemo(() => Object.keys(lineup).length, [lineup]);

  const userCorpsScore = useMemo(() => {
    if (!activeCorps) return null;
    const corpsName = activeCorps.corpsName || activeCorps.name;
    const entry = aggregatedScores.find(s => s.corpsName === corpsName);
    return entry?.score ?? null;
  }, [aggregatedScores, activeCorps]);

  const userCorpsRank = useMemo(() => {
    if (!activeCorps) return null;
    const corpsName = activeCorps.corpsName || activeCorps.name;
    const entry = aggregatedScores.find(s => s.corpsName === corpsName);
    return entry?.rank ?? null;
  }, [aggregatedScores, activeCorps]);

  // Calculate Best in Show count for SoundSport (count of shows where user had the highest score)
  const bestInShowCount = useMemo(() => {
    if (!activeCorps || activeCorpsClass !== 'soundSport' || !allShows?.length) return 0;

    const corpsName = activeCorps.corpsName || activeCorps.name;
    let count = 0;

    allShows.forEach(show => {
      if (!show.scores?.length) return;

      // Find the highest score in this show
      const maxScore = Math.max(...show.scores.map(s => s.score || 0));
      if (maxScore <= 0) return;

      // Check if user's corps has the highest score
      const userScore = show.scores.find(s => s.corpsName === corpsName || s.corps === corpsName);
      if (userScore && userScore.score === maxScore) {
        count++;
      }
    });

    return count;
  }, [activeCorps, activeCorpsClass, allShows]);

  const thisWeekShows = useMemo(() => {
    if (!activeCorps?.selectedShows) return [];
    return (activeCorps.selectedShows[`week${currentWeek}`] || []).slice(0, 3);
  }, [activeCorps?.selectedShows, currentWeek]);

  // Fetch caption scores from historical_scores
  useEffect(() => {
    const fetchLineupScores = async () => {
      if (!lineup || Object.keys(lineup).length === 0 || !currentDay) {
        setLineupScoresLoading(false);
        return;
      }

      setLineupScoresLoading(true);
      const isSoundSport = activeCorpsClass === 'soundSport';

      try {
        // Calculate effective day (accounting for 2AM score processing)
        const effectiveDay = getEffectiveDay(currentDay);

        // Guard: If effectiveDay is null or < 1, no scores should be visible
        // This handles Day 1 (no previous day exists) and Day 2 before 2 AM (Day 1 not processed yet)
        if (!effectiveDay || effectiveDay < 1) {
          setLineupScoreData({});
          setLineupScoresLoading(false);
          return;
        }

        // Get unique years from lineup
        const yearsNeeded = new Set();
        Object.values(lineup).forEach(value => {
          if (value) {
            const [, sourceYear] = value.split('|');
            if (sourceYear) yearsNeeded.add(sourceYear);
          }
        });

        // Fetch historical_scores for each year
        const historicalData = {};
        const yearPromises = [...yearsNeeded].map(async (year) => {
          const docSnap = await getDoc(doc(db, `historical_scores/${year}`));
          if (docSnap.exists()) {
            historicalData[year] = docSnap.data().data || [];
          }
        });
        await Promise.all(yearPromises);

        // For SoundSport, pre-compute category totals for each corps/year combo
        const categoryTotalsCache = {};
        if (isSoundSport) {
          Object.values(lineup).forEach(value => {
            if (value) {
              const [corpsName, sourceYear] = value.split('|');
              const yearData = historicalData[sourceYear];
              if (yearData) {
                const cacheKey = `${corpsName}|${sourceYear}`;
                categoryTotalsCache[cacheKey] = processCategoryTotals(yearData, corpsName, effectiveDay);
              }
            }
          });
        }

        // Process scores for each caption slot
        const scoreData = {};
        CAPTIONS.forEach(caption => {
          const value = lineup[caption.id];
          if (!value) {
            scoreData[caption.id] = { score: null, trend: null, nextShow: null };
            return;
          }

          const [corpsName, sourceYear] = value.split('|');
          const yearData = historicalData[sourceYear];

          if (!yearData) {
            scoreData[caption.id] = { score: null, trend: null, nextShow: null };
            return;
          }

          // For SoundSport, show category totals instead of individual caption scores
          if (isSoundSport) {
            const cacheKey = `${corpsName}|${sourceYear}`;
            const categoryData = categoryTotalsCache[cacheKey] || {};
            const baseData = processCaptionScores(yearData, corpsName, caption.id, effectiveDay);

            // Map caption category to the appropriate total
            let categoryScore = null;
            let categoryTrend = null;
            if (caption.category === 'ge') {
              categoryScore = categoryData.geTotal;
              categoryTrend = categoryData.geTrend;
            } else if (caption.category === 'vis') {
              categoryScore = categoryData.visTotal;
              categoryTrend = categoryData.visTrend;
            } else if (caption.category === 'mus') {
              categoryScore = categoryData.musTotal;
              categoryTrend = categoryData.musTrend;
            }

            scoreData[caption.id] = {
              score: categoryScore,
              trend: categoryTrend,
              nextShow: baseData.nextShow
            };
          } else {
            // Process scores for this caption (non-SoundSport)
            scoreData[caption.id] = processCaptionScores(yearData, corpsName, caption.id, effectiveDay);
          }
        });

        setLineupScoreData(scoreData);
      } catch (error) {
        console.error('Error fetching lineup scores:', error);
      } finally {
        setLineupScoresLoading(false);
      }
    };

    fetchLineupScores();
  }, [lineup, currentDay, activeCorpsClass]);

  // Fetch recent results from fantasy_recaps (for sidebar)
  useEffect(() => {
    const fetchRecentResults = async () => {
      if (!user?.uid || !seasonData?.seasonUid || !activeCorpsClass || !currentDay) return;

      // Calculate effective day - only show scores from days that have been processed
      const effectiveDay = getEffectiveDay(currentDay);

      // If no effective day (e.g., day 1), no results should be visible yet
      if (effectiveDay === null) {
        setRecentResults([]);
        return;
      }

      try {
        // OPTIMIZATION: Read from subcollection instead of single large document
        const recapsCollectionRef = collection(db, 'fantasy_recaps', seasonData.seasonUid, 'days');
        const recapsSnapshot = await getDocs(recapsCollectionRef);

        if (!recapsSnapshot.empty) {
          const recaps = recapsSnapshot.docs.map(d => d.data());
          const results = [];

          // Sort by day descending and filter to only include processed days
          const sortedRecaps = [...recaps]
            .filter(recap => recap.offSeasonDay <= effectiveDay)
            .sort((a, b) => (b.offSeasonDay || 0) - (a.offSeasonDay || 0));

          for (const recap of sortedRecaps) {
            for (const show of (recap.shows || [])) {
              const userResult = (show.results || []).find(
                r => r.uid === user.uid && r.corpsClass === activeCorpsClass
              );

              if (userResult && results.length < 5) {
                results.push({
                  eventName: show.eventName || show.name || 'Show',
                  score: userResult.totalScore,
                  placement: userResult.placement,
                  date: recap.date ? new Date(recap.date.seconds * 1000).toLocaleDateString('en-US', { timeZone: 'UTC' }) : null
                });
              }
            }
          }

          setRecentResults(results);
        }
      } catch (error) {
        console.error('Error fetching recent results:', error);
      }
    };

    fetchRecentResults();
  }, [user?.uid, seasonData?.seasonUid, activeCorpsClass, currentDay]);

  // Handle navigation state for class purchase (from header Buy button)
  useEffect(() => {
    if (location.state?.purchaseClass) {
      setClassToPurchase(location.state.purchaseClass);
      // Clear the state to prevent re-triggering on subsequent renders
      window.history.replaceState({}, document.title);
    }
  }, [location.state?.purchaseClass]);

  // Queue auto-triggered modals
  useEffect(() => {
    if (showSeasonSetupWizard && seasonData) {
      modalQueue.enqueue('seasonSetup', MODAL_PRIORITY.SEASON_SETUP, { seasonData });
    }
  }, [showSeasonSetupWizard, seasonData, modalQueue.enqueue]);

  useEffect(() => {
    if (profile?.isFirstVisit && activeCorps) {
      const timer = setTimeout(() => {
        modalQueue.enqueue('onboarding', MODAL_PRIORITY.ONBOARDING);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [profile?.isFirstVisit, activeCorps, modalQueue.enqueue]);

  useEffect(() => {
    if (newlyUnlockedClass) {
      modalQueue.enqueue('classUnlock', MODAL_PRIORITY.CLASS_UNLOCK, { unlockedClass: newlyUnlockedClass });
    }
  }, [newlyUnlockedClass, modalQueue.enqueue]);

  useEffect(() => {
    if (newAchievement) {
      modalQueue.enqueue('achievement', MODAL_PRIORITY.ACHIEVEMENT, { achievement: newAchievement });
    }
  }, [newAchievement, modalQueue.enqueue]);

  useEffect(() => {
    const userModalOpen = showRegistration || showCaptionSelection || showEditCorps ||
                          showDeleteConfirm || showMoveCorps || showRetireConfirm || showNewsSubmission;
    if (userModalOpen) {
      modalQueue.pauseQueue();
    } else {
      modalQueue.resumeQueue();
    }
  }, [showRegistration, showCaptionSelection, showEditCorps, showDeleteConfirm, showMoveCorps, showRetireConfirm, showNewsSubmission, modalQueue]);

  // Handlers
  const handleTourComplete = useCallback(async () => {
    modalQueue.dequeue();
    if (profile?.isFirstVisit && user) {
      try {
        const profileRef = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');
        await updateDoc(profileRef, { isFirstVisit: false });
      } catch (error) {
        console.error('Error updating first visit flag:', error);
      }
    }
  }, [modalQueue, profile?.isFirstVisit, user]);

  const handleSetupNewClass = useCallback(() => {
    modalQueue.dequeue();
    setShowRegistration(true);
  }, [modalQueue]);

  const handleDeclineSetup = useCallback(() => {
    modalQueue.dequeue();
    clearNewlyUnlockedClass();
    toast.success('You can register your new corps anytime!');
  }, [modalQueue, clearNewlyUnlockedClass]);

  const handleAchievementClose = useCallback(() => {
    modalQueue.dequeue();
    clearNewAchievement();
  }, [modalQueue, clearNewAchievement]);

  const handleSeasonSetupClose = useCallback(() => {
    modalQueue.dequeue();
    setShowSeasonSetupWizard(false);
  }, [modalQueue, setShowSeasonSetupWizard]);

  // Save initialSetupComplete flag when wizard is completed
  // This prevents the wizard from showing again on subsequent page loads
  const handleSeasonSetupFinish = useCallback(async () => {
    handleSeasonSetupComplete();
    handleSeasonSetupClose();

    // Save flag to prevent wizard from showing again this season
    if (user?.uid && seasonData?.seasonUid) {
      try {
        const profileRef = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');
        await updateDoc(profileRef, {
          initialSetupComplete: seasonData.seasonUid
        });
      } catch (error) {
        console.error('Failed to save initial setup flag:', error);
        // Don't show error to user - the wizard closed successfully
      }
    }
  }, [handleSeasonSetupComplete, handleSeasonSetupClose, user?.uid, seasonData?.seasonUid]);

  const handleEditCorps = useCallback(async (formData) => {
    try {
      const profileRef = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');
      await updateDoc(profileRef, {
        [`corps.${activeCorpsClass}.corpsName`]: formData.name,
        [`corps.${activeCorpsClass}.location`]: formData.location,
        [`corps.${activeCorpsClass}.showConcept`]: formData.showConcept,
      });
      toast.success('Corps updated!');
      setShowEditCorps(false);
    } catch (error) {
      toast.error('Failed to update corps');
    }
  }, [user, activeCorpsClass]);

  const handleDeleteCorps = useCallback(async () => {
    try {
      const profileRef = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');
      await updateDoc(profileRef, { [`corps.${activeCorpsClass}`]: null });
      toast.success('Corps deleted');
      setShowDeleteConfirm(false);
    } catch (error) {
      toast.error('Failed to delete corps');
    }
  }, [user, activeCorpsClass]);

  const handleRetireCorps = useCallback(async () => {
    setRetiring(true);
    try {
      const result = await retireCorps({ corpsClass: activeCorpsClass });
      if (result.data.success) {
        toast.success(result.data.message);
        setShowRetireConfirm(false);
      }
    } catch (error) {
      toast.error(error.message || 'Failed to retire corps');
    } finally {
      setRetiring(false);
    }
  }, [activeCorpsClass]);

  const handleMoveCorps = useCallback(async (targetClass) => {
    try {
      setTransferring(true);
      const result = await transferCorps({ fromClass: activeCorpsClass, toClass: targetClass });
      toast.success(result.data.message || 'Corps transferred!');
      setShowMoveCorps(false);
    } catch (error) {
      const msg = error?.message || error?.details?.message || 'Failed to transfer corps';
      toast.error(msg);
    } finally {
      setTransferring(false);
    }
  }, [activeCorpsClass]);

  const handleCorpsRegistration = useCallback(async (formData) => {
    try {
      if (!seasonData?.seasonUid) {
        toast.error('Season data not loaded');
        return;
      }
      const result = await registerCorps({
        corpsName: formData.name,
        location: formData.location,
        showConcept: formData.showConcept || '',
        class: formData.class
      });
      if (result.data.success) {
        toast.success(`${formData.name} registered!`);
        setShowRegistration(false);
        clearNewlyUnlockedClass();
        refreshProfile?.();
      }
    } catch (error) {
      toast.error(error.message || 'Failed to register corps');
    }
  }, [seasonData?.seasonUid, clearNewlyUnlockedClass, refreshProfile]);

  const handleClassUnlock = useCallback((classKey) => {
    setClassToPurchase(classKey);
  }, []);

  const handleConfirmClassPurchase = useCallback(async () => {
    if (!classToPurchase) return;
    try {
      const result = await unlockClassWithCorpsCoin({ classToUnlock: classToPurchase });
      if (result.data.success) {
        toast.success(`${CLASS_DISPLAY_NAMES[classToPurchase]} unlocked!`);
        setClassToPurchase(null);
        refreshProfile?.();
      }
    } catch (error) {
      throw new Error(error.message || 'Failed to unlock class');
    }
  }, [classToPurchase, refreshProfile]);

  const openCaptionSelection = useCallback((captionId = null) => {
    setSelectedCaption(captionId);
    setShowCaptionSelection(true);
  }, []);

  const handleNewsSubmission = useCallback(async (formData) => {
    setSubmittingNews(true);
    try {
      const result = await submitNewsForApproval(formData);
      if (result.data.success) {
        toast.success('Article submitted for review!');
        setShowNewsSubmission(false);
      }
    } catch (error) {
      toast.error(error.message || 'Failed to submit article');
    } finally {
      setSubmittingNews(false);
    }
  }, []);

  const handleUniformDesign = useCallback(async (design) => {
    try {
      const profileRef = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');
      await updateDoc(profileRef, {
        [`corps.${activeCorpsClass}.uniformDesign`]: design,
      });
      toast.success('Uniform design saved! Avatar will be generated soon.');
      setShowUniformDesign(false);
      refreshProfile?.();
    } catch (error) {
      toast.error('Failed to save uniform design');
      throw error;
    }
  }, [user, activeCorpsClass, refreshProfile]);

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#0a0a0a]">
      {/* Season Setup Wizard */}
      {modalQueue.isActive('seasonSetup') && seasonData && (
        <Suspense fallback={null}>
          <SeasonSetupWizard
            onComplete={handleSeasonSetupFinish}
            profile={profile}
            seasonData={seasonData}
            corpsNeedingSetup={corpsNeedingSetup}
            existingCorps={corps || {}}
            retiredCorps={profile?.retiredCorps || []}
            unlockedClasses={unlockedClasses}
          />
        </Suspense>
      )}

      {/* SCROLLABLE CONTENT */}
      <div className="flex-1 overflow-y-auto min-h-0 pb-20 md:pb-4">
        {/* Control Bar - Class Tabs + Director HUD */}
        <ControlBar
          corps={corps}
          activeCorpsClass={activeCorpsClass}
          unlockedClasses={unlockedClasses}
          profile={profile}
          onSwitch={handleCorpsSwitch}
          onCreateCorps={(classId) => {
            clearNewlyUnlockedClass();
            setShowRegistration(true);
          }}
          onUnlockClass={handleClassUnlock}
        />

        {activeCorps ? (
          <div className="p-3 md:p-4">
            {/* 2/3 + 1/3 Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* MAIN CONTENT (2/3) - Active Lineup */}
              <div className="lg:col-span-2">
                <ActiveLineupTable
                  lineup={lineup}
                  lineupScoreData={lineupScoreData}
                  loading={lineupScoresLoading}
                  onManageLineup={() => openCaptionSelection()}
                  onSlotClick={(captionId) => openCaptionSelection(captionId)}
                  scoresAvailable={scoresAvailable}
                />
              </div>

              {/* SIDEBAR (1/3) - Season Stats */}
              <div className="space-y-4">
                <SeasonScorecard
                  score={userCorpsScore}
                  rank={userCorpsRank}
                  rankChange={null}
                  corpsName={activeCorps.corpsName || activeCorps.name}
                  corpsClass={activeCorpsClass}
                  loading={scoresLoading}
                  avatarUrl={activeCorps.avatarUrl}
                  onDesignUniform={() => setShowUniformDesign(true)}
                  bestInShowCount={bestInShowCount}
                />

                <RecentResultsFeed
                  results={recentResults}
                  loading={scoresLoading}
                  corpsClass={activeCorpsClass}
                />

                <LeagueStatus leagues={myLeagues} />

                {/* Daily Challenges - drives daily return visits */}
                <DailyChallenges onLineupClick={() => openCaptionSelection()} />

                {/* Quick Stats - rotating fun facts about user performance */}
                <QuickStats
                  profile={profile}
                  corpsClass={activeCorpsClass}
                  recentResults={recentResults}
                  lineupScoreData={lineupScoreData}
                  lineupCount={lineupCount}
                />

                {/* Submit Article */}
                <div className="bg-[#1a1a1a] border border-[#333] overflow-hidden">
                  <div className="bg-[#222] px-4 py-3 border-b border-[#333]">
                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-green-500" />
                      Community Content
                    </h3>
                  </div>
                  <div className="p-4">
                    <p className="text-xs text-gray-500 mb-3">
                      Share your insights, analysis, or news with the community.
                    </p>
                    <button
                      onClick={() => setShowNewsSubmission(true)}
                      className="w-full py-2.5 bg-[#222] hover:bg-[#333] border border-[#333] text-white text-sm font-bold transition-colors flex items-center justify-center gap-2"
                    >
                      <FileText className="w-4 h-4" />
                      Submit Article
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* No Corps State */
          <div className="flex items-center justify-center min-h-[60vh] p-4">
            <div className="bg-[#1a1a1a] border border-[#333] max-w-sm w-full">
              <div className="bg-[#222] px-4 py-3 border-b border-[#333]">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Start Your Season
                </h3>
              </div>
              <div className="p-6 text-center">
                <Trophy className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-sm text-gray-400 mb-4">
                  Create your first fantasy corps to begin competing.
                </p>
                <button
                  onClick={() => setShowRegistration(true)}
                  className="w-full py-3 bg-[#0057B8] text-white text-sm font-bold hover:bg-[#0066d6]"
                >
                  Register Corps
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODALS */}
      {modalQueue.isActive('classUnlock') && newlyUnlockedClass && (
        <ClassUnlockCongratsModal
          unlockedClass={newlyUnlockedClass}
          onSetup={handleSetupNewClass}
          onDecline={handleDeclineSetup}
        />
      )}

      {showRegistration && (
        <CorpsRegistrationModal
          onClose={() => { setShowRegistration(false); clearNewlyUnlockedClass(); }}
          onSubmit={handleCorpsRegistration}
          unlockedClasses={unlockedClasses}
          defaultClass={newlyUnlockedClass}
        />
      )}

      {showCaptionSelection && activeCorps && seasonData && (
        <Suspense fallback={null}>
          <CaptionSelectionModal
            onClose={() => { setShowCaptionSelection(false); setSelectedCaption(null); }}
            onSubmit={() => { setShowCaptionSelection(false); setSelectedCaption(null); }}
            corpsClass={activeCorpsClass}
            currentLineup={activeCorps.lineup || {}}
            seasonId={seasonData.seasonUid}
            initialCaption={selectedCaption}
          />
        </Suspense>
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

      {showRetireConfirm && activeCorps && (
        <RetireConfirmModal
          onClose={() => setShowRetireConfirm(false)}
          onConfirm={handleRetireCorps}
          corpsName={activeCorps.corpsName || activeCorps.name}
          corpsClass={activeCorpsClass}
          retiring={retiring}
          inLeague={false}
        />
      )}

      {showMoveCorps && activeCorps && (
        <MoveCorpsModal
          onClose={() => setShowMoveCorps(false)}
          onMove={handleMoveCorps}
          currentClass={activeCorpsClass}
          corpsName={activeCorps.corpsName || activeCorps.name}
          unlockedClasses={unlockedClasses}
          existingCorps={corps}
          transferring={transferring}
        />
      )}

      {/* OPTIMIZATION #9: Lazy-loaded modals wrapped with Suspense */}
      {showUniformDesign && activeCorps && (
        <Suspense fallback={null}>
          <UniformDesignModal
            onClose={() => setShowUniformDesign(false)}
            onSubmit={handleUniformDesign}
            currentDesign={activeCorps.uniformDesign}
            corpsName={activeCorps.corpsName || activeCorps.name}
          />
        </Suspense>
      )}

      {showNewsSubmission && (
        <Suspense fallback={null}>
          <NewsSubmissionModal
            onClose={() => setShowNewsSubmission(false)}
            onSubmit={handleNewsSubmission}
            isSubmitting={submittingNews}
          />
        </Suspense>
      )}

      {modalQueue.isActive('achievement') && newAchievement && (
        <AchievementModal
          onClose={handleAchievementClose}
          achievements={profile?.achievements || []}
          newAchievement={newAchievement}
        />
      )}

      <OnboardingTour
        isOpen={modalQueue.isActive('onboarding')}
        onClose={() => modalQueue.dequeue()}
        onComplete={handleTourComplete}
      />

      <QuickStartGuide
        isOpen={showQuickStartGuide}
        onClose={() => setShowQuickStartGuide(false)}
        onAction={(action) => {
          if (action === 'lineup') setShowCaptionSelection(true);
        }}
        completedSteps={[
          ...(lineupCount === 8 ? ['lineup'] : []),
          ...(thisWeekShows.length > 0 ? ['schedule'] : []),
          ...(myLeagues?.length > 0 ? ['league'] : []),
        ]}
      />

      {classToPurchase && profile && (
        <Suspense fallback={null}>
          <ClassPurchaseModal
            classKey={classToPurchase}
            className={CLASS_DISPLAY_NAMES[classToPurchase]}
            coinCost={CLASS_UNLOCK_COSTS[classToPurchase]}
            currentBalance={profile.corpsCoin || 0}
            levelRequired={CLASS_UNLOCK_LEVELS[classToPurchase]}
            currentLevel={profile.xpLevel || 1}
            weeksRemaining={weeksRemaining}
            weeksUntilAutoUnlock={profile?.createdAt ? getWeeksUntilUnlock(profile.createdAt, classToPurchase) : null}
            isRegistrationLocked={isRegistrationLocked(classToPurchase)}
            onConfirm={handleConfirmClassPurchase}
            onClose={() => setClassToPurchase(null)}
          />
        </Suspense>
      )}
    </div>
  );
};

export default Dashboard;
