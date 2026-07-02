// =============================================================================
// DASHBOARD - TEAM OVERVIEW (ESPN Fantasy Style)
// =============================================================================
// Hero: Active Lineup Roster Table. Sidebar: Season Scorecard + Recent Results.
// Laws: App Shell, 2/3 + 1/3 grid, data tables over cards, no glow

import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { Trophy, FileText } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { updateProfile } from '../api/profile';
import toast from 'react-hot-toast';

// OPTIMIZATION #9: Lazy-load large modal components to reduce initial bundle size
// Prioritized by file size: CaptionSelectionModal (1007 lines), UniformDesignModal (794 lines),
// NewsSubmissionModal (283 lines), ClassPurchaseModal (247 lines)
const CaptionSelectionModal = lazy(
  () => import('../components/CaptionSelection/CaptionSelectionModal')
);
const SeasonSetupWizard = lazy(() => import('../components/SeasonSetupWizard'));
const UniformDesignModal = lazy(() => import('../components/modals/UniformDesignModal'));
const NewsSubmissionModal = lazy(() => import('../components/modals/NewsSubmissionModal'));
const ClassPurchaseModal = lazy(() => import('../components/modals/ClassPurchaseModal'));
const NewCorpsSlotModal = lazy(() => import('../components/modals/NewCorpsSlotModal'));
const RenameDuplicateCorpsModal = lazy(
  () => import('../components/modals/RenameDuplicateCorpsModal')
);

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
  RivalsPanel,
  DailyChallenges,
  QuickStats,
  LineupSimulatorPanel,
  PredictionGamePanel,
  AchievementTrackerPanel,
  CLASS_DISPLAY_NAMES,
  CLASS_UNLOCK_LEVELS,
  CLASS_UNLOCK_COSTS,
} from '../components/Dashboard';

import { getWeeksUntilUnlock } from '../utils/classUnlockTime';
import NextPerformancePanel from '../components/Dashboard/NextPerformancePanel';
import { useScheduleStore } from '../store/scheduleStore';

import { useDashboardData } from '../hooks/useDashboardData';
import { useScoresData } from '../hooks/useScoresData';
import { useMyLeagues } from '../hooks/useLeagues';
import {
  registerCorps,
  retireCorps,
  unlockClassWithCorpsCoin,
  submitNewsForApproval,
  transferCorps,
  unretireCorps,
} from '../api/functions';
import { CORPS_CLASS_ORDER } from '../utils/corps';
import { canEditCorpsThisSeason, corpsHasPendingWork } from '../utils/corps';
import { useModalQueue, MODAL_PRIORITY } from '../hooks/useModalQueue';
import { useLineupScores, useRecentResults, useBestInShowCount } from '../hooks/useDashboardScores';
import { useSeasonStore } from '../store/seasonStore';
import { getEffectiveDay } from '../utils/dashboardScoring';

// OPTIMIZATION #4: Constants moved to src/components/Dashboard/sections/constants.js
// Imported via: CLASS_LABELS, CAPTIONS, CLASS_DISPLAY_NAMES, getSoundSportRating

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
  const {
    aggregatedScores,
    allShows,
    loading: scoresLoading,
  } = useScoresData({
    // Dashboard should only show current season data, not fall back to archived seasons
    disableArchiveFallback: true,
    // Filter to active corps class to include SoundSport scores (excluded by default with 'all')
    classFilter: dashboardData.activeCorpsClass || 'all',
  });
  const { data: myLeagues } = useMyLeagues(user?.uid);
  const { weeksRemaining, isRegistrationLocked, currentDay } = useSeasonStore();

  // Calculate if scores are available (for hiding Last Score/Trend columns on Day 1)
  const scoresAvailable = currentDay ? getEffectiveDay(currentDay) !== null : false;

  // Modal states
  const modalQueue = useModalQueue();
  const [showRegistration, setShowRegistration] = useState(false);
  const [registrationDefaultClass, setRegistrationDefaultClass] = useState(null);
  const [slotPickerClass, setSlotPickerClass] = useState(null);
  const [unretiring, setUnretiring] = useState(false);
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
    refreshProfile,
    handleCorpsSwitch,
    unlockedClasses, // Includes admin override - admins have all classes
  } = dashboardData;

  // Computed values
  const lineup = useMemo(() => activeCorps?.lineup || {}, [activeCorps?.lineup]);
  const lineupCount = useMemo(() => Object.keys(lineup).length, [lineup]);

  // Enriched schedule (real start times + running order) for the Next Performance
  // panel. Single shared listener via the store — no extra reads.
  const competitions = useScheduleStore((state) => state.competitions);

  // Rivals are precomputed daily by scheduledRivalsUpdate and stored on the
  // profile under rivals[<corpsClass>]. Pull the slice for the active corps.
  const activeCorpsRivals = useMemo(() => {
    if (!profile?.rivals || !activeCorpsClass) return [];
    return profile.rivals[activeCorpsClass] || [];
  }, [profile?.rivals, activeCorpsClass]);

  // Surface every corps the admin sweep flagged for rename. The dashboard
  // hard-blocks all other actions until each one is resolved.
  const duplicateCorps = useMemo(() => {
    if (!corps) return [];
    return CORPS_CLASS_ORDER.map((cls) => {
      const c = corps[cls];
      if (!c?.mustRename || !c.corpsName) return null;
      return {
        corpsClass: cls,
        corpsName: c.corpsName,
        conflictsWith: c.duplicateConflict || null,
      };
    }).filter(Boolean);
  }, [corps]);

  const userCorpsScore = useMemo(() => {
    if (!activeCorps) return null;
    const corpsName = activeCorps.corpsName || activeCorps.name;
    const entry = aggregatedScores.find((s) => s.corpsName === corpsName);
    return entry?.score ?? null;
  }, [aggregatedScores, activeCorps]);

  const userCorpsRank = useMemo(() => {
    if (!activeCorps) return null;
    const corpsName = activeCorps.corpsName || activeCorps.name;
    const entry = aggregatedScores.find((s) => s.corpsName === corpsName);
    return entry?.rank ?? null;
  }, [aggregatedScores, activeCorps]);

  const bestInShowCount = useBestInShowCount(activeCorps, activeCorpsClass, allShows);

  const thisWeekShows = useMemo(() => {
    if (!activeCorps?.selectedShows) return [];
    return (activeCorps.selectedShows[`week${currentWeek}`] || []).slice(0, 3);
  }, [activeCorps?.selectedShows, currentWeek]);

  const { lineupScoreData, lineupScoresLoading } = useLineupScores(
    lineup,
    currentDay,
    activeCorpsClass
  );
  const recentResults = useRecentResults(user, seasonData, activeCorpsClass, currentDay);

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
      modalQueue.enqueue('classUnlock', MODAL_PRIORITY.CLASS_UNLOCK, {
        unlockedClass: newlyUnlockedClass,
      });
    }
  }, [newlyUnlockedClass, modalQueue.enqueue]);

  useEffect(() => {
    if (newAchievement) {
      modalQueue.enqueue('achievement', MODAL_PRIORITY.ACHIEVEMENT, {
        achievement: newAchievement,
      });
    }
  }, [newAchievement, modalQueue.enqueue]);

  useEffect(() => {
    const userModalOpen =
      showRegistration ||
      showCaptionSelection ||
      showEditCorps ||
      showDeleteConfirm ||
      showMoveCorps ||
      showRetireConfirm ||
      showNewsSubmission;
    if (userModalOpen) {
      modalQueue.pauseQueue();
    } else {
      modalQueue.resumeQueue();
    }
  }, [
    showRegistration,
    showCaptionSelection,
    showEditCorps,
    showDeleteConfirm,
    showMoveCorps,
    showRetireConfirm,
    showNewsSubmission,
    modalQueue,
  ]);

  // Handlers
  const handleTourComplete = useCallback(async () => {
    modalQueue.dequeue();
    if (profile?.isFirstVisit && user) {
      try {
        await updateProfile(user.uid, { isFirstVisit: false });
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
        await updateProfile(user.uid, {
          initialSetupComplete: seasonData.seasonUid,
        });
      } catch (error) {
        console.error('Failed to save initial setup flag:', error);
        // Don't show error to user - the wizard closed successfully
      }
    }
  }, [handleSeasonSetupComplete, handleSeasonSetupClose, user?.uid, seasonData?.seasonUid]);

  const handleEditCorps = useCallback(
    async (formData) => {
      try {
        await updateProfile(user.uid, {
          [`corps.${activeCorpsClass}.corpsName`]: formData.name,
          [`corps.${activeCorpsClass}.location`]: formData.location,
          [`corps.${activeCorpsClass}.showConcept`]: formData.showConcept,
        });
        toast.success('Corps updated!');
        setShowEditCorps(false);
      } catch (error) {
        toast.error('Failed to update corps');
      }
    },
    [user, activeCorpsClass]
  );

  const handleDeleteCorps = useCallback(async () => {
    try {
      await updateProfile(user.uid, { [`corps.${activeCorpsClass}`]: null });
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

  const handleMoveCorps = useCallback(
    async (targetClass) => {
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
    },
    [activeCorpsClass]
  );

  const handleCorpsRegistration = useCallback(
    async (formData) => {
      try {
        if (!seasonData?.seasonUid) {
          toast.error('Season data not loaded');
          return;
        }
        const result = await registerCorps({
          corpsName: formData.name,
          location: formData.location,
          showConcept: formData.showConcept || '',
          class: formData.class,
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
    },
    [seasonData?.seasonUid, clearNewlyUnlockedClass, refreshProfile]
  );

  const handleClassUnlock = useCallback((classKey) => {
    setClassToPurchase(classKey);
  }, []);

  const handleUnretireCorps = useCallback(
    async (corpsClass, retiredIndex) => {
      setUnretiring(true);
      try {
        const retiredRecord = profile?.retiredCorps?.[retiredIndex];
        const result = await unretireCorps({ corpsClass, retiredIndex });
        if (result.data.success) {
          toast.success(
            retiredRecord?.corpsName
              ? `${retiredRecord.corpsName} is back in action!`
              : 'Corps brought out of retirement!'
          );
          setSlotPickerClass(null);
          refreshProfile?.();
        }
      } catch (error) {
        toast.error(error.message || 'Failed to unretire corps');
      } finally {
        setUnretiring(false);
      }
    },
    [profile?.retiredCorps, refreshProfile]
  );

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

  const handleUniformDesign = useCallback(
    async (design) => {
      try {
        await updateProfile(user.uid, {
          [`corps.${activeCorpsClass}.uniformDesign`]: design,
        });
        toast.success('Uniform design saved! Avatar will be generated soon.');
        setShowUniformDesign(false);
        refreshProfile?.();
      } catch (error) {
        toast.error('Failed to save uniform design');
        throw error;
      }
    },
    [user, activeCorpsClass, refreshProfile]
  );

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#0a0a0a]">
      {/* Rename-required modal: hard-blocks all dashboard actions until every
          duplicate-name conflict surfaced by the admin sweep is resolved. */}
      {duplicateCorps.length > 0 && (
        <Suspense fallback={null}>
          <RenameDuplicateCorpsModal duplicates={duplicateCorps} onResolved={refreshProfile} />
        </Suspense>
      )}

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
        <div data-tour="control-bar">
          <ControlBar
            corps={corps}
            activeCorpsClass={activeCorpsClass}
            unlockedClasses={unlockedClasses}
            profile={profile}
            onSwitch={handleCorpsSwitch}
            onCreateCorps={(classId) => {
              clearNewlyUnlockedClass();
              // If the director has retired corps for this class, offer the
              // choice between starting fresh and bringing one back. Otherwise
              // jump straight to registration with this class preselected.
              const retiredForClass = (profile?.retiredCorps || [])
                .map((record, retiredIndex) => ({ record, retiredIndex }))
                .filter((entry) => entry.record?.corpsClass === classId);
              if (retiredForClass.length > 0) {
                setSlotPickerClass(classId);
              } else {
                setRegistrationDefaultClass(classId || null);
                setShowRegistration(true);
              }
            }}
            onUnlockClass={handleClassUnlock}
          />
        </div>

        {activeCorps ? (
          <div className="p-3 md:p-4">
            {/* 2/3 + 1/3 Grid Layout - balanced columns */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* MAIN CONTENT (2/3) - Lineup + related analysis */}
              <div className="lg:col-span-2 space-y-4">
                <div data-tour="lineup">
                  <ActiveLineupTable
                    lineup={lineup}
                    lineupScoreData={lineupScoreData}
                    loading={lineupScoresLoading}
                    onManageLineup={() => openCaptionSelection()}
                    onSlotClick={(captionId) => openCaptionSelection(captionId)}
                    scoresAvailable={scoresAvailable}
                  />
                </div>

                {/* Lineup Analyzer - per-caption efficiency and weak-spot identification */}
                <LineupSimulatorPanel
                  lineup={lineup}
                  lineupScoreData={lineupScoreData}
                  activeCorpsClass={activeCorpsClass}
                  onSwapCaption={openCaptionSelection}
                />

                <div data-tour="recent-results">
                  <RecentResultsFeed
                    results={recentResults}
                    loading={scoresLoading}
                    corpsClass={activeCorpsClass}
                  />
                </div>

                {/* Daily Predictions - check-back-tomorrow engagement loop */}
                <PredictionGamePanel recentResults={recentResults} />
              </div>

              {/* SIDEBAR (1/3) - Identity, stats & engagement */}
              <div className="space-y-4">
                <div data-tour="scorecard">
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
                    canManage={canEditCorpsThisSeason(activeCorps)}
                    canMove={
                      Object.values(corps || {}).filter(Boolean).length <
                      (unlockedClasses?.length || 0)
                    }
                    lockReason={
                      canEditCorpsThisSeason(activeCorps)
                        ? null
                        : 'Locked — this corps has already competed this season.'
                    }
                    onMoveCorps={() => setShowMoveCorps(true)}
                    onRetireCorps={() => setShowRetireConfirm(true)}
                  />
                </div>

                {/* Daily Challenges - drives daily return visits */}
                <DailyChallenges onLineupClick={() => openCaptionSelection()} />

                {/* Next Performance - real show timing + running order + your-picks-live spotlight */}
                <NextPerformancePanel
                  competitions={competitions}
                  selectedShows={activeCorps?.selectedShows || {}}
                  lineup={lineup}
                />

                {/* Rivals - closest competitors in the active corps's class */}
                <RivalsPanel rivals={activeCorpsRivals} corpsClass={activeCorpsClass} />

                {/* Quick Stats - rotating fun facts about user performance */}
                <QuickStats
                  profile={profile}
                  corpsClass={activeCorpsClass}
                  recentResults={recentResults}
                  lineupScoreData={lineupScoreData}
                  lineupCount={lineupCount}
                />

                {/* Achievement Tracker - progress toward next unlockable achievements */}
                <AchievementTrackerPanel
                  profile={profile}
                  lineupCount={lineupCount}
                  resultCount={recentResults.length}
                  leagueCount={myLeagues?.length || 0}
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
          onClose={() => {
            setShowRegistration(false);
            setRegistrationDefaultClass(null);
            clearNewlyUnlockedClass();
          }}
          onSubmit={handleCorpsRegistration}
          unlockedClasses={unlockedClasses}
          defaultClass={registrationDefaultClass || newlyUnlockedClass}
        />
      )}

      {slotPickerClass && (
        <Suspense fallback={null}>
          <NewCorpsSlotModal
            onClose={() => setSlotPickerClass(null)}
            onStartNew={() => {
              const targetClass = slotPickerClass;
              setSlotPickerClass(null);
              setRegistrationDefaultClass(targetClass);
              setShowRegistration(true);
            }}
            onUnretire={(retiredIndex) => handleUnretireCorps(slotPickerClass, retiredIndex)}
            corpsClass={slotPickerClass}
            retiredCorps={(profile?.retiredCorps || [])
              .map((record, retiredIndex) => ({ record, retiredIndex }))
              .filter((entry) => entry.record?.corpsClass === slotPickerClass)}
            processing={unretiring}
          />
        </Suspense>
      )}

      {showCaptionSelection && activeCorps && seasonData && (
        <Suspense fallback={null}>
          <CaptionSelectionModal
            onClose={() => {
              setShowCaptionSelection(false);
              setSelectedCaption(null);
            }}
            onSubmit={() => {
              setShowCaptionSelection(false);
              setSelectedCaption(null);
            }}
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
            showConcept: activeCorps.showConcept,
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
          hasPendingWork={corpsHasPendingWork(activeCorps)}
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
          hasPendingWork={corpsHasPendingWork(activeCorps)}
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
            weeksUntilAutoUnlock={
              profile?.createdAt ? getWeeksUntilUnlock(profile.createdAt, classToPurchase) : null
            }
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
