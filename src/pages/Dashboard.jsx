// =============================================================================
// DASHBOARD - ESPN DATA GRID LAYOUT
// =============================================================================
// Dense, puzzle-fit panels. Zero black space between cards.
// Laws: gap-px creates borders, tables over cards, no glow

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Trophy, Calendar, Edit, ChevronRight, Coins, Users,
  Music, TrendingUp, TrendingDown, Activity, Medal, FileText
} from 'lucide-react';
import { useAuth } from '../App';
import { db } from '../firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import CaptionSelectionModal from '../components/CaptionSelection/CaptionSelectionModal';
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
} from '../components/Dashboard';
import toast from 'react-hot-toast';
import SeasonSetupWizard from '../components/SeasonSetupWizard';
import { useDashboardData } from '../hooks/useDashboardData';
import { useScoresData } from '../hooks/useScoresData';
import { useMyLeagues } from '../hooks/useLeagues';
import { retireCorps } from '../firebase/functions';
import { submitNewsForApproval } from '../api/functions';
import NewsSubmissionModal from '../components/modals/NewsSubmissionModal';
import { DataTable } from '../components/ui/DataTable';
import { Card } from '../components/ui/Card';
import { PullToRefresh } from '../components/ui/PullToRefresh';
import { TeamAvatar } from '../components/ui/TeamAvatar';
import { useHaptic } from '../hooks/useHaptic';
import { useModalQueue, MODAL_PRIORITY } from '../hooks/useModalQueue';

// =============================================================================
// CONSTANTS
// =============================================================================

const CAPTIONS = [
  { id: 'GE1', name: 'GE1', category: 'ge' },
  { id: 'GE2', name: 'GE2', category: 'ge' },
  { id: 'VP', name: 'VP', category: 'vis' },
  { id: 'VA', name: 'VA', category: 'vis' },
  { id: 'CG', name: 'CG', category: 'vis' },
  { id: 'B', name: 'B', category: 'mus' },
  { id: 'MA', name: 'MA', category: 'mus' },
  { id: 'P', name: 'P', category: 'mus' },
];

const CLASS_LABELS = {
  worldClass: 'World',
  openClass: 'Open',
  aClass: 'A Class',
  soundSport: 'SoundSport',
};

// SoundSport rating thresholds for dashboard medal display
const SOUNDSPORT_RATINGS = [
  { rating: 'Gold', min: 90, color: 'bg-yellow-400', textColor: 'text-black' },
  { rating: 'Silver', min: 75, color: 'bg-stone-300', textColor: 'text-black' },
  { rating: 'Bronze', min: 60, color: 'bg-orange-400', textColor: 'text-black' },
  { rating: 'Participation', min: 0, color: 'bg-white', textColor: 'text-black' },
];

const getSoundSportRating = (score) => {
  for (const threshold of SOUNDSPORT_RATINGS) {
    if (score >= threshold.min) return threshold;
  }
  return SOUNDSPORT_RATINGS[SOUNDSPORT_RATINGS.length - 1];
};

// =============================================================================
// STANDINGS TABLE COLUMNS
// =============================================================================

const standingsColumns = [
  {
    key: 'rank',
    header: 'RK',
    width: '44px',
    isRank: true,
    render: (row) => (
      <div className="flex items-center justify-center">
        <span className="w-6 h-6 rounded bg-[#333] border border-[#444] flex items-center justify-center text-gray-400 font-medium tabular-nums text-xs">
          {row.rank}
        </span>
      </div>
    ),
  },
  {
    key: 'corpsName',
    header: 'Corps',
    render: (row) => (
      <div className="flex items-center gap-2">
        <TeamAvatar name={row.corpsName || row.corps} size="xs" />
        <span className="font-bold text-white truncate block max-w-[160px] sm:max-w-[120px] text-sm sm:text-xs">
          {row.corpsName || row.corps}
        </span>
      </div>
    ),
  },
  {
    key: 'score',
    header: 'Score',
    align: 'right',
    width: '75px',
    render: (row) => (
      <span className="text-white font-data tabular-nums text-sm sm:text-xs">
        {typeof row.score === 'number' ? row.score.toFixed(3) : row.score}
      </span>
    ),
  },
];

// =============================================================================
// MOBILE TAB LABELS
// =============================================================================

const MOBILE_TABS = [
  { id: 'team', label: 'My Team' },
  { id: 'standings', label: 'Standings' },
  { id: 'schedule', label: 'Schedule' },
];

// =============================================================================
// DASHBOARD COMPONENT
// =============================================================================

const Dashboard = () => {
  const { user } = useAuth();
  const dashboardData = useDashboardData();
  const { aggregatedScores, loading: scoresLoading, refetch: refetchScores } = useScoresData();
  const { data: myLeagues, refetch: refetchLeagues } = useMyLeagues(user?.uid);
  const { trigger: haptic } = useHaptic();

  // Mobile tab state
  const [activeMobileTab, setActiveMobileTab] = useState('team');

  // Pull to refresh handler
  const handleRefresh = useCallback(async () => {
    haptic('pull');
    await Promise.all([
      dashboardData.refreshProfile?.(),
      refetchScores?.(),
      refetchLeagues?.(),
    ]);
    haptic('success');
  }, [haptic, dashboardData.refreshProfile, refetchScores, refetchLeagues]);

  // Modal queue for auto-triggered modals (prevents modal chaos)
  const modalQueue = useModalQueue();

  // User-triggered modal states (not queued - they take priority)
  const [showRegistration, setShowRegistration] = useState(false);
  const [showCaptionSelection, setShowCaptionSelection] = useState(false);
  const [selectedCaption, setSelectedCaption] = useState(null);
  const [showEditCorps, setShowEditCorps] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMoveCorps, setShowMoveCorps] = useState(false);
  const [showRetireConfirm, setShowRetireConfirm] = useState(false);
  const [retiring, setRetiring] = useState(false);
  const [showQuickStartGuide, setShowQuickStartGuide] = useState(false);
  const [showNewsSubmission, setShowNewsSubmission] = useState(false);
  const [submittingNews, setSubmittingNews] = useState(false);
  const [corpsStats, setCorpsStats] = useState({});

  // Destructure dashboard data
  const {
    profile,
    corps,
    activeCorps,
    activeCorpsClass,
    hasMultipleCorps,
    seasonData,
    currentWeek,
    formatSeasonName,
    engagementData,
    showSeasonSetupWizard,
    setShowSeasonSetupWizard,
    corpsNeedingSetup,
    handleSeasonSetupComplete,
    handleCorpsSwitch,
    newlyUnlockedClass,
    clearNewlyUnlockedClass,
    newAchievement,
    clearNewAchievement,
    getCorpsClassName,
    refreshProfile
  } = dashboardData;

  // Queue auto-triggered modals based on conditions
  useEffect(() => {
    // Season setup wizard (highest priority)
    if (showSeasonSetupWizard && seasonData) {
      modalQueue.enqueue('seasonSetup', MODAL_PRIORITY.SEASON_SETUP, { seasonData });
    }
  }, [showSeasonSetupWizard, seasonData, modalQueue.enqueue]);

  useEffect(() => {
    // Onboarding tour for first visit
    if (profile?.isFirstVisit && activeCorps) {
      const timer = setTimeout(() => {
        modalQueue.enqueue('onboarding', MODAL_PRIORITY.ONBOARDING);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [profile?.isFirstVisit, activeCorps, modalQueue.enqueue]);

  useEffect(() => {
    // Class unlock celebration
    if (newlyUnlockedClass) {
      modalQueue.enqueue('classUnlock', MODAL_PRIORITY.CLASS_UNLOCK, { unlockedClass: newlyUnlockedClass });
    }
  }, [newlyUnlockedClass, modalQueue.enqueue]);

  useEffect(() => {
    // Achievement celebration
    if (newAchievement) {
      modalQueue.enqueue('achievement', MODAL_PRIORITY.ACHIEVEMENT, { achievement: newAchievement });
    }
  }, [newAchievement, modalQueue.enqueue]);

  // Pause queue when user-triggered modals are open
  useEffect(() => {
    const userModalOpen = showRegistration || showCaptionSelection || showEditCorps ||
                          showDeleteConfirm || showMoveCorps || showRetireConfirm;
    if (userModalOpen) {
      modalQueue.pauseQueue();
    } else {
      modalQueue.resumeQueue();
    }
  }, [showRegistration, showCaptionSelection, showEditCorps, showDeleteConfirm, showMoveCorps, showRetireConfirm, modalQueue]);

  // Fetch user's fantasy recap scores for lineup display
  useEffect(() => {
    const fetchUserScores = async () => {
      if (!user?.uid || !seasonData?.seasonUid || !activeCorpsClass) return;

      try {
        const recapRef = doc(db, 'fantasy_recaps', seasonData.seasonUid);
        const recapSnap = await getDoc(recapRef);

        if (recapSnap.exists()) {
          const data = recapSnap.data();
          const recaps = data.recaps || [];

          // Sort by offSeasonDay descending to get most recent first
          const sortedRecaps = [...recaps].sort((a, b) => (b.offSeasonDay || 0) - (a.offSeasonDay || 0));

          // Find the user's most recent score for this corps class
          for (const recap of sortedRecaps) {
            for (const show of (recap.shows || [])) {
              const userResult = (show.results || []).find(
                r => r.uid === user.uid && r.corpsClass === activeCorpsClass
              );
              if (userResult) {
                // Store the category scores (geScore, visualScore, musicScore)
                setCorpsStats({
                  geScore: userResult.geScore,
                  visualScore: userResult.visualScore,
                  musicScore: userResult.musicScore
                });
                return;
              }
            }
          }
        }
        setCorpsStats({});
      } catch (error) {
        console.error('Error fetching user scores:', error);
      }
    };
    fetchUserScores();
  }, [user?.uid, seasonData?.seasonUid, activeCorpsClass]);

  // Handlers - memoized to prevent unnecessary re-renders
  const handleTourComplete = useCallback(async () => {
    modalQueue.dequeue(); // Close onboarding modal
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
    modalQueue.dequeue(); // Close class unlock modal
    setShowRegistration(true);
  }, [modalQueue]);

  const handleDeclineSetup = useCallback(() => {
    modalQueue.dequeue(); // Close class unlock modal
    clearNewlyUnlockedClass();
    toast.success('You can register your new corps anytime!');
  }, [modalQueue, clearNewlyUnlockedClass]);

  const handleAchievementClose = useCallback(() => {
    modalQueue.dequeue(); // Close achievement modal
    clearNewAchievement();
  }, [modalQueue, clearNewAchievement]);

  const handleSeasonSetupClose = useCallback(() => {
    modalQueue.dequeue(); // Close season setup wizard
    setShowSeasonSetupWizard(false);
  }, [modalQueue, setShowSeasonSetupWizard]);

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
      if (corps[targetClass]) {
        toast.error(`Already have a corps in ${getCorpsClassName(targetClass)}`);
        return;
      }
      const profileRef = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');
      await updateDoc(profileRef, {
        [`corps.${targetClass}`]: { ...activeCorps, class: targetClass },
        [`corps.${activeCorpsClass}`]: null
      });
      toast.success('Corps moved!');
      setShowMoveCorps(false);
    } catch (error) {
      toast.error('Failed to move corps');
    }
  }, [corps, getCorpsClassName, user, activeCorps, activeCorpsClass]);

  const handleCorpsRegistration = useCallback(async (formData) => {
    try {
      if (!seasonData?.seasonUid) {
        toast.error('Season data not loaded');
        return;
      }
      const profileRef = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');
      await updateDoc(profileRef, {
        [`corps.${formData.class}`]: {
          name: formData.name,
          location: formData.location,
          showConcept: formData.showConcept,
          class: formData.class,
          createdAt: new Date(),
          seasonId: seasonData.seasonUid,
          lineup: {},
          score: 0,
          rank: null
        }
      });
      toast.success(`${formData.name} registered!`);
      setShowRegistration(false);
      clearNewlyUnlockedClass();
    } catch (error) {
      toast.error('Failed to register corps');
    }
  }, [seasonData?.seasonUid, user, clearNewlyUnlockedClass]);

  // Computed values - memoized to prevent unnecessary recalculations
  const lineup = useMemo(() => activeCorps?.lineup || {}, [activeCorps?.lineup]);
  const lineupCount = useMemo(() => Object.keys(lineup).length, [lineup]);
  const standingsData = useMemo(() => aggregatedScores.slice(0, 8), [aggregatedScores]);
  // Get user's corps score from aggregatedScores - reuses data already fetched for standings
  // Corps names are unique per season, so lookup by name is valid
  const userCorpsScore = useMemo(() => {
    if (!activeCorps) return null;
    const corpsName = activeCorps.corpsName || activeCorps.name;
    const entry = aggregatedScores.find(s => s.corpsName === corpsName);
    return entry?.score ?? null;
  }, [aggregatedScores, activeCorps]);
  const primaryLeague = useMemo(() => myLeagues?.[0], [myLeagues]);

  const thisWeekShows = useMemo(() => {
    if (!activeCorps?.selectedShows) return [];
    return (activeCorps.selectedShows[`week${currentWeek}`] || []).slice(0, 4);
  }, [activeCorps?.selectedShows, currentWeek]);

  const rankTrend = useMemo(() => {
    if (!activeCorps?.rankHistory || activeCorps.rankHistory.length < 2) return null;
    const prev = activeCorps.rankHistory[activeCorps.rankHistory.length - 2];
    const curr = activeCorps.rank;
    if (prev > curr) return 'up';
    if (prev < curr) return 'down';
    return null;
  }, [activeCorps?.rankHistory, activeCorps?.rank]);

  // Open caption selection, optionally focused on a specific caption
  const openCaptionSelection = useCallback((captionId = null) => {
    setSelectedCaption(captionId);
    setShowCaptionSelection(true);
  }, []);

  // Handle news article submission
  const handleNewsSubmission = useCallback(async (formData) => {
    setSubmittingNews(true);
    try {
      const result = await submitNewsForApproval(formData);
      if (result.data.success) {
        toast.success('Article submitted for review!');
        setShowNewsSubmission(false);
      } else {
        toast.error(result.data.message || 'Failed to submit article');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to submit article');
    } finally {
      setSubmittingNews(false);
    }
  }, []);

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <div className="w-full h-full min-h-screen bg-[#0a0a0a]">
      {/* Season Setup Wizard - via modal queue */}
      {modalQueue.isActive('seasonSetup') && seasonData && (
        <SeasonSetupWizard
          onComplete={() => { handleSeasonSetupComplete(); handleSeasonSetupClose(); }}
          profile={profile}
          seasonData={seasonData}
          corpsNeedingSetup={corpsNeedingSetup}
          existingCorps={corps || {}}
          retiredCorps={profile?.retiredCorps || []}
          unlockedClasses={profile?.unlockedClasses || ['soundSport']}
        />
      )}

      {activeCorps ? (
        <>
          {/* Team Switcher - Horizontal Pill Navigation */}
          {hasMultipleCorps && (
            <div className="bg-[#0a0a0a] border-b border-[#333] px-3 py-2 overflow-x-auto scrollbar-hide">
              <div className="flex items-center gap-2 min-w-max">
                {Object.entries(corps)
                  .sort((a, b) => {
                    const classOrder = { worldClass: 0, openClass: 1, aClass: 2, soundSport: 3 };
                    return (classOrder[a[0]] ?? 99) - (classOrder[b[0]] ?? 99);
                  })
                  .map(([classId, corpsData]) => {
                    const isActive = activeCorpsClass === classId;
                    const fullName = corpsData.corpsName || corpsData.name || 'Team';
                    // Truncate names longer than 20 characters
                    const displayName = fullName.length > 20
                      ? fullName.substring(0, 18) + '…'
                      : fullName;

                    return (
                      <button
                        key={classId}
                        onClick={() => { haptic('light'); handleCorpsSwitch(classId); }}
                        className={`
                          flex items-center gap-2 px-3 py-2 min-h-[40px] rounded-full
                          text-sm font-bold whitespace-nowrap transition-all duration-200 press-feedback
                          ${isActive
                            ? 'bg-gradient-to-r from-yellow-500 to-yellow-400 text-black'
                            : 'bg-[#2a2a2a] text-gray-400 hover:bg-[#333] hover:text-gray-200 active:bg-[#3a3a3a]'
                          }
                        `}
                        title={fullName}
                      >
                        <TeamAvatar
                          name={fullName}
                          size="xs"
                          className={isActive ? '!bg-black/20 !border-black/30 !text-black' : ''}
                        />
                        <span>{displayName}</span>
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          {/* MOBILE TABS - Premium Pill Style */}
          <div className="lg:hidden flex gap-1 px-2 py-1.5 border-b border-[#333] bg-[#1a1a1a]">
            {MOBILE_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => { haptic('medium'); setActiveMobileTab(tab.id); }}
                className={`relative flex-1 py-2.5 min-h-[44px] text-sm font-bold uppercase tracking-wide transition-all duration-200 ease-out rounded-full press-feedback ${
                  activeMobileTab === tab.id
                    ? 'text-[#0057B8] bg-[#0057B8]/15'
                    : 'text-gray-500 hover:text-gray-300 active:text-white active:bg-white/10'
                }`}
              >
                {tab.label}
                {/* Active indicator dot */}
                {activeMobileTab === tab.id && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#0057B8]" />
                )}
              </button>
            ))}
          </div>

          {/* Pull to Refresh Wrapper */}
          <PullToRefresh onRefresh={handleRefresh}>
            {/* MAIN GRID - Desktop: 3 columns, Mobile: single panel based on tab */}
            <div className="lg:grid lg:grid-cols-3 w-full gap-px bg-[#333]">

            {/* LEFT COLUMN - My Team */}
            <div className={`bg-[#1a1a1a] p-4 pt-3 ${activeMobileTab !== 'team' ? 'hidden lg:block' : ''}`}>
              {/* Compact Team Header - Class label + Edit */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    {CLASS_LABELS[activeCorpsClass] || activeCorpsClass}
                  </span>
                  {!hasMultipleCorps && (
                    <span className="text-[10px] text-gray-600">•</span>
                  )}
                  {!hasMultipleCorps && (
                    <span className="text-[10px] text-gray-400 truncate max-w-[150px]">
                      {activeCorps.corpsName || activeCorps.name}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setShowEditCorps(true)}
                  className="p-2 -mr-2 text-gray-500 hover:text-white active:text-white"
                  aria-label="Edit corps"
                >
                  <Edit className="w-4 h-4" />
                </button>
              </div>

              {/* Score or Medal Rating based on class */}
              <div className="mb-3">
                {activeCorpsClass === 'soundSport' ? (
                  <>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                      Season Rating
                    </div>
                    {(() => {
                      const rating = getSoundSportRating(userCorpsScore || 0);
                      return (
                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded ${rating.color}`}>
                          <Medal className={`w-5 h-5 ${rating.textColor}`} />
                          <span className={`text-lg font-bold ${rating.textColor}`}>{rating.rating}</span>
                        </div>
                      );
                    })()}
                  </>
                ) : (
                  <>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-0.5">
                      Season Score
                    </div>
                    <div className="text-4xl sm:text-3xl font-bold font-data text-white tabular-nums leading-none">
                      {userCorpsScore?.toFixed(3) || '0.000'}
                    </div>
                  </>
                )}
              </div>

              {/* Rank and Lineup - Compact inline row */}
              <div className="flex items-center gap-4 mb-3 pb-3 border-b border-[#333]">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Rank</span>
                  <span className="text-2xl font-bold text-white font-data">
                    #{activeCorps.rank || '-'}
                  </span>
                  {rankTrend === 'up' && <TrendingUp className="w-4 h-4 text-green-500" />}
                  {rankTrend === 'down' && <TrendingDown className="w-4 h-4 text-red-500" />}
                </div>
                <div className="w-px h-6 bg-[#333]" />
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Lineup</span>
                  <span className={`text-xl font-bold font-data ${lineupCount === 8 ? 'text-green-500' : 'text-yellow-500'}`}>
                    {lineupCount}/8
                  </span>
                  <button
                    onClick={() => openCaptionSelection()}
                    className="flex items-center gap-0.5 text-[10px] text-[#F5A623] hover:text-[#FFB84D] transition-colors"
                  >
                    <Edit className="w-3 h-3" />
                    Edit
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Lineup List - Clean ESPN-style rows */}
              <div className="mb-4 border border-[#333] rounded-sm overflow-hidden">
                {CAPTIONS.map((caption, index) => {
                  const value = lineup[caption.id];
                  const hasValue = !!value;
                  const [corpsName, sourceYear] = hasValue ? value.split('|') : [null, null];
                  // Get category score from user's fantasy recap (GE/Visual/Music)
                  let captionScore = null;
                  if (['GE1', 'GE2'].includes(caption.id)) {
                    captionScore = corpsStats.geScore ?? null;
                  } else if (['VP', 'VA', 'CG'].includes(caption.id)) {
                    captionScore = corpsStats.visualScore ?? null;
                  } else if (['B', 'MA', 'P'].includes(caption.id)) {
                    captionScore = corpsStats.musicScore ?? null;
                  }
                  return (
                    <button
                      key={caption.id}
                      onClick={() => openCaptionSelection(caption.id)}
                      className={`w-full flex items-center gap-3 px-3 py-3.5 transition-all cursor-pointer group ${
                        index !== CAPTIONS.length - 1 ? 'border-b border-[#333]/50' : ''
                      } ${
                        hasValue
                          ? 'bg-[#1a1a1a] hover:bg-[#222] active:bg-[#252525]'
                          : 'bg-[#1a1a1a] hover:bg-[#222] active:bg-[#252525]'
                      }`}
                    >
                      {/* Position Badge */}
                      <div className={`w-10 h-8 flex items-center justify-center rounded text-xs font-bold ${
                        hasValue ? 'bg-[#0057B8]/20 text-[#0057B8]' : 'bg-[#333] text-gray-500'
                      }`}>
                        {caption.name}
                      </div>
                      {/* Corps Name + Year */}
                      <div className="flex-1 text-left min-w-0">
                        {hasValue ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm text-white truncate">{corpsName}</span>
                            {sourceYear && (
                              <span className="text-[10px] text-gray-500">'{sourceYear?.slice(-2)}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500 italic">Empty slot</span>
                        )}
                      </div>
                      {/* Caption Score / Action */}
                      <div className="flex items-center gap-2">
                        {hasValue ? (
                          <span className="text-xs font-data text-gray-400 tabular-nums">
                            {captionScore !== null ? captionScore.toFixed(1) : '—'}
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-[#F5A623] group-hover:text-[#FFB84D]">+ Draft</span>
                        )}
                        <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400" />
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* League Link */}
              {primaryLeague ? (
                <Link
                  to="/leagues"
                  className="flex items-center justify-between p-3 sm:p-2 bg-[#222] border border-[#333] hover:border-[#444] active:bg-[#333] rounded"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Users className="w-5 h-5 sm:w-4 sm:h-4 text-[#0057B8] flex-shrink-0" />
                    <span className="text-sm text-white truncate">{primaryLeague.name}</span>
                  </div>
                  <span className="text-sm sm:text-xs font-bold text-[#0057B8] flex-shrink-0 ml-2">#{primaryLeague.userRank || '-'}</span>
                </Link>
              ) : (
                <Link
                  to="/leagues"
                  className="flex items-center justify-center gap-2 p-3 sm:p-2 border border-dashed border-[#444] text-gray-500 hover:text-white hover:border-[#555] active:bg-[#222] rounded min-h-[48px] sm:min-h-0"
                >
                  <Users className="w-5 h-5 sm:w-4 sm:h-4" />
                  <span className="text-sm sm:text-xs">Join a League</span>
                </Link>
              )}

              {/* CorpsCoin */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#333]">
                <div className="flex items-center gap-2">
                  <Coins className="w-5 h-5 sm:w-4 sm:h-4 text-yellow-500" />
                  <span className="text-sm sm:text-xs text-gray-400">CorpsCoin</span>
                </div>
                <span className="text-base sm:text-sm font-bold font-data text-yellow-500 tabular-nums">
                  {(profile?.corpsCoin || 0).toLocaleString()}
                </span>
              </div>

              {/* Submit News */}
              <button
                onClick={() => setShowNewsSubmission(true)}
                className="w-full mt-4 flex items-center justify-center gap-2 p-3 sm:p-2 border border-dashed border-[#444] text-gray-400 hover:text-white hover:border-[#555] active:bg-[#222] rounded min-h-[48px] sm:min-h-0 transition-colors"
              >
                <FileText className="w-5 h-5 sm:w-4 sm:h-4" />
                <span className="text-sm sm:text-xs">Submit News Article</span>
              </button>
            </div>

            {/* CENTER COLUMN - Standings */}
            <div className={`bg-[#0a0a0a] ${activeMobileTab !== 'standings' ? 'hidden lg:block' : ''}`}>
              {/* Header hidden on mobile since we have tabs */}
              <div className="hidden lg:flex bg-[#222] px-4 sm:px-3 py-3 sm:py-2 border-b border-[#333] items-center justify-between">
                <span className="text-[11px] sm:text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Standings
                </span>
                <Link to="/scores" className="text-[11px] sm:text-[10px] text-[#F5A623] hover:text-[#FFB84D] transition-colors flex items-center gap-0.5 py-1">
                  Results <ChevronRight className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                </Link>
              </div>
              {scoresLoading ? (
                <div className="p-4 text-center text-gray-500 text-sm">Loading...</div>
              ) : (
                <DataTable
                  columns={standingsColumns}
                  data={standingsData}
                  getRowKey={(row) => row.corpsName || row.corps}
                  zebraStripes={true}
                  highlightRow={(row) =>
                    row.corpsName === (activeCorps.corpsName || activeCorps.name)
                  }
                  emptyState={
                    <div className="p-4 text-center text-gray-500 text-sm">
                      No standings yet
                    </div>
                  }
                />
              )}
              {/* Mobile View All link */}
              <Link
                to="/scores"
                className="lg:hidden flex items-center justify-center gap-1 py-4 text-sm font-medium text-[#F5A623] hover:text-[#FFB84D] transition-colors border-t border-[#333] bg-[#1a1a1a]"
              >
                View Full Results <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            {/* RIGHT COLUMN - Schedule */}
            <div className={`bg-[#1a1a1a] ${activeMobileTab !== 'schedule' ? 'hidden lg:block' : ''}`}>
              {/* Header hidden on mobile since we have tabs */}
              <div className="hidden lg:flex bg-[#222] px-4 sm:px-3 py-3 sm:py-2 border-b border-[#333] items-center justify-between">
                <span className="text-[11px] sm:text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Week {currentWeek} Schedule
                </span>
                <Link to="/schedule" className="text-[11px] sm:text-[10px] text-[#F5A623] hover:text-[#FFB84D] transition-colors flex items-center gap-0.5 py-1">
                  Full Schedule <ChevronRight className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                </Link>
              </div>

              {thisWeekShows.length > 0 ? (
                <div className="divide-y divide-[#333]">
                  {thisWeekShows.map((show, idx) => (
                    <div key={idx} className="px-4 sm:px-3 py-3 sm:py-2 flex items-center gap-3 hover:bg-[#222] active:bg-[#222]">
                      <Calendar className="w-5 h-5 sm:w-4 sm:h-4 text-gray-500 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-white truncate">
                          {show.eventName || show.name || 'Show'}
                        </div>
                        <div className="text-[11px] sm:text-[10px] text-gray-500 truncate">
                          {show.location || show.date || ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-5 sm:p-4 text-center">
                  <Calendar className="w-8 h-8 sm:w-6 sm:h-6 text-gray-600 mx-auto mb-2" />
                  <p className="text-sm sm:text-xs text-gray-500 mb-3 sm:mb-2">No shows selected</p>
                  <Link
                    to="/schedule"
                    className="inline-flex items-center gap-1 text-sm sm:text-xs text-[#F5A623] hover:text-[#FFB84D] transition-colors py-1"
                  >
                    Select Shows <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}

              {/* Season Info - desktop only */}
              <div className="hidden lg:block px-4 sm:px-3 py-3 sm:py-2 border-t border-[#333] bg-[#222]">
                <div className="text-[11px] sm:text-[10px] text-gray-500">
                  {formatSeasonName(seasonData?.name)} • Week {currentWeek}
                </div>
              </div>
              {/* Mobile View All link */}
              <Link
                to="/schedule"
                className="lg:hidden flex items-center justify-center gap-1 py-4 text-sm font-medium text-[#F5A623] hover:text-[#FFB84D] transition-colors border-t border-[#333] bg-[#222]"
              >
                View Full Schedule <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

            {/* BOTTOM ROW - Activity Feed - Desktop only */}
            <div className="hidden lg:block bg-[#1a1a1a] border-t border-[#333]">
              <div className="bg-[#222] px-4 sm:px-3 py-3 sm:py-2 border-b border-[#333] flex items-center gap-2">
                <Activity className="w-5 h-5 sm:w-4 sm:h-4 text-gray-500" />
                <span className="text-[11px] sm:text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Recent Activity
                </span>
              </div>
              <div className="px-4 py-4 sm:py-3 text-sm text-gray-500">
                {engagementData?.streak > 0 ? (
                  <span>🔥 {engagementData.streak} day streak! Keep it up.</span>
                ) : (
                  <span>No recent activity. Check back after competing!</span>
                )}
              </div>
            </div>
          </PullToRefresh>
        </>
      ) : (
        /* No Corps State */
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="max-w-sm">
            <Card.Header>
              <Card.Title>Start Your Season</Card.Title>
            </Card.Header>
            <Card.Body className="p-4 text-center">
              <Trophy className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-400 mb-4">
                Create your first fantasy corps to begin competing.
              </p>
              <button
                onClick={() => setShowRegistration(true)}
                className="w-full py-2 bg-[#0057B8] text-white text-sm font-bold hover:bg-[#0066d6]"
              >
                Register Corps
              </button>
            </Card.Body>
          </Card>
        </div>
      )}

      {/* MODALS - Queued modals use modalQueue.isActive() */}
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
          unlockedClasses={profile?.unlockedClasses || ['soundSport']}
          defaultClass={newlyUnlockedClass}
        />
      )}

      {showCaptionSelection && activeCorps && seasonData && (
        <CaptionSelectionModal
          onClose={() => { setShowCaptionSelection(false); setSelectedCaption(null); }}
          onSubmit={() => { setShowCaptionSelection(false); setSelectedCaption(null); }}
          corpsClass={activeCorpsClass}
          currentLineup={activeCorps.lineup || {}}
          seasonId={seasonData.seasonUid}
          initialCaption={selectedCaption}
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
          unlockedClasses={profile?.unlockedClasses || ['soundSport']}
          existingCorps={corps}
        />
      )}

      {modalQueue.isActive('achievement') && newAchievement && (
        <AchievementModal
          onClose={handleAchievementClose}
          achievements={profile?.achievements || []}
          newAchievement={newAchievement}
        />
      )}

      {/* Morning Report removed - streak now visible in header PlayerStatusBar */}

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

      {showNewsSubmission && (
        <NewsSubmissionModal
          onClose={() => setShowNewsSubmission(false)}
          onSubmit={handleNewsSubmission}
          isSubmitting={submittingNews}
        />
      )}
    </div>
  );
};

export default Dashboard;
