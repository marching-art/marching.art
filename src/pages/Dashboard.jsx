// =============================================================================
// DASHBOARD - ESPN DATA GRID LAYOUT
// =============================================================================
// Dense, puzzle-fit panels. Zero black space between cards.
// Laws: gap-px creates borders, tables over cards, no glow

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Trophy, Calendar, Edit, ChevronRight, Coins, Users,
  Music, TrendingUp, TrendingDown, Activity
} from 'lucide-react';
import { useAuth } from '../App';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
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
  SoundSportWelcome,
} from '../components/Dashboard';
import toast from 'react-hot-toast';
import SeasonSetupWizard from '../components/SeasonSetupWizard';
import { useDashboardData } from '../hooks/useDashboardData';
import { useScoresData } from '../hooks/useScoresData';
import { useMyLeagues } from '../hooks/useLeagues';
import { retireCorps } from '../firebase/functions';
import { DataTable } from '../components/ui/DataTable';
import { Card } from '../components/ui/Card';
import { PullToRefresh } from '../components/ui/PullToRefresh';
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

// =============================================================================
// STANDINGS TABLE COLUMNS
// =============================================================================

const standingsColumns = [
  {
    key: 'rank',
    header: 'RK',
    width: '36px',
    isRank: true,
  },
  {
    key: 'corpsName',
    header: 'Corps',
    render: (row) => (
      <span className="truncate block max-w-[180px] sm:max-w-[140px] text-sm sm:text-xs">
        {row.corpsName || row.corps}
      </span>
    ),
  },
  {
    key: 'score',
    header: 'Score',
    align: 'right',
    width: '75px',
    render: (row) => (
      <span className="text-white tabular-nums text-sm sm:text-xs">
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
  const handleRefresh = async () => {
    haptic('pull');
    await Promise.all([
      dashboardData.refreshProfile?.(),
      refetchScores?.(),
      refetchLeagues?.(),
    ]);
    haptic('success');
  };

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

  // Handlers
  const handleTourComplete = async () => {
    modalQueue.dequeue(); // Close onboarding modal
    if (profile?.isFirstVisit && user) {
      try {
        const profileRef = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');
        await updateDoc(profileRef, { isFirstVisit: false });
      } catch (error) {
        console.error('Error updating first visit flag:', error);
      }
    }
  };

  const handleSetupNewClass = () => {
    modalQueue.dequeue(); // Close class unlock modal
    setShowRegistration(true);
  };

  const handleDeclineSetup = () => {
    modalQueue.dequeue(); // Close class unlock modal
    clearNewlyUnlockedClass();
    toast.success('You can register your new corps anytime!');
  };

  const handleAchievementClose = () => {
    modalQueue.dequeue(); // Close achievement modal
    clearNewAchievement();
  };

  const handleSeasonSetupClose = () => {
    modalQueue.dequeue(); // Close season setup wizard
    setShowSeasonSetupWizard(false);
  };

  const handleEditCorps = async (formData) => {
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
  };

  const handleDeleteCorps = async () => {
    try {
      const profileRef = doc(db, 'artifacts/marching-art/users', user.uid, 'profile/data');
      await updateDoc(profileRef, { [`corps.${activeCorpsClass}`]: null });
      toast.success('Corps deleted');
      setShowDeleteConfirm(false);
    } catch (error) {
      toast.error('Failed to delete corps');
    }
  };

  const handleRetireCorps = async () => {
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
  };

  const handleMoveCorps = async (targetClass) => {
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
  };

  const handleCorpsRegistration = async (formData) => {
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
  };

  // Computed values
  const lineup = activeCorps?.lineup || {};
  const lineupCount = Object.keys(lineup).length;
  const standingsData = aggregatedScores.slice(0, 8);
  const primaryLeague = myLeagues?.[0];

  const getThisWeekShows = () => {
    if (!activeCorps?.selectedShows) return [];
    return (activeCorps.selectedShows[`week${currentWeek}`] || []).slice(0, 4);
  };

  const getRankTrend = () => {
    if (!activeCorps?.rankHistory || activeCorps.rankHistory.length < 2) return null;
    const prev = activeCorps.rankHistory[activeCorps.rankHistory.length - 2];
    const curr = activeCorps.rank;
    if (prev > curr) return 'up';
    if (prev < curr) return 'down';
    return null;
  };

  const thisWeekShows = getThisWeekShows();
  const rankTrend = getRankTrend();

  // Open caption selection, optionally focused on a specific caption
  const openCaptionSelection = (captionId = null) => {
    setSelectedCaption(captionId);
    setShowCaptionSelection(true);
  };

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
          {/* Corps Switcher Bar - Mobile optimized with larger touch targets */}
          {hasMultipleCorps && (
            <div className="bg-[#1a1a1a] border-b border-[#333] px-3 py-2.5 flex items-center gap-2 overflow-x-auto scrollbar-hide">
              {Object.entries(corps)
                .sort((a, b) => {
                  const classOrder = { worldClass: 0, openClass: 1, aClass: 2, soundSport: 3 };
                  return (classOrder[a[0]] ?? 99) - (classOrder[b[0]] ?? 99);
                })
                .map(([classId, corpsData]) => (
                <button
                  key={classId}
                  onClick={() => { haptic('light'); handleCorpsSwitch(classId); }}
                  className={`px-4 py-2 text-xs font-bold uppercase whitespace-nowrap rounded transition-colors min-h-[44px] press-feedback ${
                    activeCorpsClass === classId
                      ? 'bg-[#0057B8] text-white'
                      : 'bg-[#333] text-gray-400 hover:text-white active:bg-[#444]'
                  }`}
                >
                  {corpsData.corpsName || corpsData.name || ''}
                </button>
              ))}
            </div>
          )}

          {/* MOBILE TABS - Only show on mobile */}
          <div className="lg:hidden flex border-b border-[#333] bg-[#1a1a1a]">
            {MOBILE_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => { haptic('medium'); setActiveMobileTab(tab.id); }}
                className={`flex-1 py-3.5 min-h-[48px] text-sm font-bold uppercase tracking-wide transition-all press-feedback ${
                  activeMobileTab === tab.id
                    ? 'text-[#0057B8] border-b-2 border-[#0057B8] bg-[#0a0a0a]'
                    : 'text-gray-500 border-b-2 border-transparent active:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Pull to Refresh Wrapper */}
          <PullToRefresh onRefresh={handleRefresh}>
            {/* MAIN GRID - Desktop: 3 columns, Mobile: single panel based on tab */}
            <div className="lg:grid lg:grid-cols-3 w-full gap-px bg-[#333]">

            {/* LEFT COLUMN - My Team */}
            <div className={`bg-[#1a1a1a] p-4 ${activeMobileTab !== 'team' ? 'hidden lg:block' : ''}`}>
              {/* SoundSport Welcome Card - Show for SoundSport directors */}
              {activeCorpsClass === 'soundSport' && (
                <SoundSportWelcome showCompact={true} />
              )}

              {/* Team Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] sm:text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    {CLASS_LABELS[activeCorpsClass] || activeCorpsClass}
                  </span>
                </div>
                <button
                  onClick={() => setShowEditCorps(true)}
                  className="p-2 -mr-2 text-gray-500 hover:text-white active:text-white"
                  aria-label="Edit corps"
                >
                  <Edit className="w-5 h-5 sm:w-4 sm:h-4" />
                </button>
              </div>

              {/* Corps Name */}
              <h2 className="text-xl sm:text-lg font-bold text-white mb-4 leading-tight">
                {activeCorps.corpsName || activeCorps.name || 'Your Corps'}
              </h2>

              {/* Big Score */}
              <div className="mb-4">
                <div className="text-[11px] sm:text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                  Season Score
                </div>
                <div className="text-4xl sm:text-3xl font-bold font-data text-white tabular-nums">
                  {activeCorps.totalSeasonScore?.toFixed(3) || '0.000'}
                </div>
              </div>

              {/* Rank and Lineup - Better mobile layout */}
              <div className="flex items-start gap-6 sm:gap-4 mb-4 pb-4 border-b border-[#333]">
                <div className="flex-shrink-0">
                  <div className="text-[11px] sm:text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                    Rank
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-3xl sm:text-2xl font-bold text-white">
                      #{activeCorps.rank || '-'}
                    </span>
                    {rankTrend === 'up' && (
                      <span className="flex items-center text-green-500">
                        <TrendingUp className="w-5 h-5 sm:w-4 sm:h-4" />
                      </span>
                    )}
                    {rankTrend === 'down' && (
                      <span className="flex items-center text-red-500">
                        <TrendingDown className="w-5 h-5 sm:w-4 sm:h-4" />
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <div className="text-[11px] sm:text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                    Lineup
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-2xl sm:text-xl font-bold ${lineupCount === 8 ? 'text-green-500' : 'text-yellow-500'}`}>
                      {lineupCount}/8
                    </span>
                    <button
                      onClick={() => openCaptionSelection()}
                      className="flex items-center gap-1 text-[11px] sm:text-[10px] text-[#0057B8] hover:underline active:underline py-1"
                    >
                      <Edit className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                      Edit All
                    </button>
                  </div>
                </div>
              </div>

              {/* Lineup Grid - Mobile: 2 cols with full names, Desktop: 4 cols compact */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-1 mb-4">
                {CAPTIONS.map((caption) => {
                  const value = lineup[caption.id];
                  const hasValue = !!value;
                  const corpsName = hasValue ? value.split('|')[0] : null;
                  return (
                    <button
                      key={caption.id}
                      onClick={() => openCaptionSelection(caption.id)}
                      className={`p-2.5 sm:p-1.5 text-center border transition-all cursor-pointer group min-h-[52px] sm:min-h-0 ${
                        hasValue
                          ? 'border-[#444] bg-[#222] hover:border-[#0057B8] hover:bg-[#0057B8]/10 active:bg-[#0057B8]/20'
                          : 'border-dashed border-[#444] bg-[#1a1a1a] hover:border-[#0057B8] hover:bg-[#0057B8]/10 active:bg-[#0057B8]/20'
                      }`}
                    >
                      <div className="text-[11px] sm:text-[10px] font-bold text-gray-400 group-hover:text-[#0057B8]">
                        {caption.name}
                      </div>
                      <div className={`text-[11px] sm:text-[9px] ${
                        hasValue
                          ? 'text-gray-300 group-hover:text-white'
                          : 'text-[#0057B8] font-medium'
                      }`}>
                        {hasValue ? corpsName : '+ Draft'}
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
            </div>

            {/* CENTER COLUMN - Standings */}
            <div className={`bg-[#0a0a0a] ${activeMobileTab !== 'standings' ? 'hidden lg:block' : ''}`}>
              {/* Header hidden on mobile since we have tabs */}
              <div className="hidden lg:flex bg-[#222] px-4 sm:px-3 py-3 sm:py-2 border-b border-[#333] items-center justify-between">
                <span className="text-[11px] sm:text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Standings
                </span>
                <Link to="/scores" className="text-[11px] sm:text-[10px] text-[#0057B8] hover:underline active:underline flex items-center gap-1 py-1">
                  View All <ChevronRight className="w-4 h-4 sm:w-3 sm:h-3" />
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
                className="lg:hidden flex items-center justify-center gap-1 py-4 text-sm text-[#0057B8] hover:underline active:underline border-t border-[#333] bg-[#1a1a1a]"
              >
                View Full Standings <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            {/* RIGHT COLUMN - Schedule */}
            <div className={`bg-[#1a1a1a] ${activeMobileTab !== 'schedule' ? 'hidden lg:block' : ''}`}>
              {/* Header hidden on mobile since we have tabs */}
              <div className="hidden lg:flex bg-[#222] px-4 sm:px-3 py-3 sm:py-2 border-b border-[#333] items-center justify-between">
                <span className="text-[11px] sm:text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Week {currentWeek} Schedule
                </span>
                <Link to="/schedule" className="text-[11px] sm:text-[10px] text-[#0057B8] hover:underline active:underline flex items-center gap-1 py-1">
                  Full Schedule <ChevronRight className="w-4 h-4 sm:w-3 sm:h-3" />
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
                    className="inline-block text-sm sm:text-xs text-[#0057B8] hover:underline active:underline py-1"
                  >
                    Select Shows
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
                className="lg:hidden flex items-center justify-center gap-1 py-4 text-sm text-[#0057B8] hover:underline active:underline border-t border-[#333] bg-[#222]"
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
    </div>
  );
};

export default Dashboard;
