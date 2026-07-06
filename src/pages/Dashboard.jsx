// =============================================================================
// DASHBOARD - TEAM OVERVIEW (ESPN Fantasy Style)
// =============================================================================
// Hero: Active Lineup Roster Table. Sidebar: Season Scorecard + Recent Results.
// Laws: App Shell, 2/3 + 1/3 grid, data tables over cards, no glow

import React, { useMemo, lazy, Suspense } from 'react';
import { Trophy, FileText } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

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
const StreakModal = lazy(() => import('../components/modals/StreakModal'));
const CorpsCoinModal = lazy(() => import('../components/modals/CorpsCoinModal'));
const SeasonRecapModal = lazy(() => import('../components/modals/SeasonRecapModal'));

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
  JourneyPanel,
  CLASS_DISPLAY_NAMES,
  CLASS_UNLOCK_LEVELS,
  CLASS_UNLOCK_COSTS,
} from '../components/Dashboard';

import { ModalLoadingFallback } from '../components/ui';
import { getWeeksUntilUnlock } from '../utils/classUnlockTime';
import NextPerformancePanel from '../components/Dashboard/NextPerformancePanel';
import { useScheduleStore } from '../store/scheduleStore';

import { useDashboardData } from '../hooks/useDashboardData';
import { useScoresData } from '../hooks/useScoresData';
import { useMyLeagues } from '../hooks/useLeagues';
import { CORPS_CLASS_ORDER } from '../utils/corps';
import { canEditCorpsThisSeason, corpsHasPendingWork } from '../utils/corps';
import { useDashboardModals } from '../hooks/useDashboardModals';
import { useLineupScores, useRecentResults, useBestInShowCount } from '../hooks/useDashboardScores';
import { useSeasonStore } from '../store/seasonStore';
import { getEffectiveDay, getNextSelectedShow } from '../utils/dashboardScoring';

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

  // Modal state, modal-queue effects, and modal action handlers
  // (extracted to src/hooks/useDashboardModals.js)
  const {
    modalQueue,
    showRegistration,
    setShowRegistration,
    registrationDefaultClass,
    setRegistrationDefaultClass,
    slotPickerClass,
    setSlotPickerClass,
    unretiring,
    showCaptionSelection,
    setShowCaptionSelection,
    selectedCaption,
    setSelectedCaption,
    showEditCorps,
    setShowEditCorps,
    showDeleteConfirm,
    setShowDeleteConfirm,
    showMoveCorps,
    setShowMoveCorps,
    showRetireConfirm,
    setShowRetireConfirm,
    retiring,
    transferring,
    showQuickStartGuide,
    setShowQuickStartGuide,
    classToPurchase,
    setClassToPurchase,
    showUniformDesign,
    setShowUniformDesign,
    showNewsSubmission,
    setShowNewsSubmission,
    submittingNews,
    showStreakModal,
    setShowStreakModal,
    showWalletModal,
    setShowWalletModal,
    handleTourComplete,
    handleSetupNewClass,
    handleDeclineSetup,
    handleAchievementClose,
    handleSeasonRecapClose,
    handleSeasonSetupFinish,
    handleEditCorps,
    handleDeleteCorps,
    handleRetireCorps,
    handleMoveCorps,
    handleCorpsRegistration,
    handleClassUnlock,
    handleUnretireCorps,
    handleConfirmClassPurchase,
    openCaptionSelection,
    handleNewsSubmission,
    handleUniformDesign,
  } = useDashboardModals(user, dashboardData);

  // Destructure dashboard data
  const {
    profile,
    corps,
    activeCorps,
    activeCorpsClass,
    seasonData,
    currentWeek,
    corpsNeedingSetup,
    newlyUnlockedClass,
    clearNewlyUnlockedClass,
    newAchievement,
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

  // Places climbed (positive) or dropped since the last daily rank snapshot,
  // written by the rivals job (scheduled/rivalsComputation.js) at 2:30 AM ET.
  const userRankChange = useMemo(() => {
    const snapshot = profile?.classRanks?.[activeCorpsClass];
    if (!snapshot?.rank || !snapshot?.previousRank) return null;
    return snapshot.previousRank - snapshot.rank;
  }, [profile?.classRanks, activeCorpsClass]);

  const bestInShowCount = useBestInShowCount(activeCorps, activeCorpsClass, allShows);

  const thisWeekShows = useMemo(() => {
    if (!activeCorps?.selectedShows) return [];
    return (activeCorps.selectedShows[`week${currentWeek}`] || []).slice(0, 3);
  }, [activeCorps?.selectedShows, currentWeek]);

  // The director's actual next competition. Every caption competes together at
  // the shows the director registered for, so this is a single corps-level fact
  // shared by all lineup slots — not the source corps' real-world schedule.
  const nextSelectedShow = useMemo(
    () => getNextSelectedShow(activeCorps?.selectedShows, currentDay),
    [activeCorps?.selectedShows, currentDay]
  );

  const { lineupScoreData, lineupScoresLoading } = useLineupScores(
    lineup,
    currentDay,
    activeCorpsClass
  );
  const recentResults = useRecentResults(user, seasonData, activeCorpsClass, currentDay);

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#0a0a0a]">
      {/* Rename-required modal: hard-blocks all dashboard actions until every
          duplicate-name conflict surfaced by the admin sweep is resolved. */}
      {duplicateCorps.length > 0 && (
        <Suspense fallback={<ModalLoadingFallback />}>
          <RenameDuplicateCorpsModal duplicates={duplicateCorps} onResolved={refreshProfile} />
        </Suspense>
      )}

      {/* Season Setup Wizard */}
      {modalQueue.isActive('seasonSetup') && seasonData && (
        <Suspense fallback={<ModalLoadingFallback />}>
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
            onStreakClick={() => setShowStreakModal(true)}
            onWalletClick={() => setShowWalletModal(true)}
          />
        </div>

        {activeCorps ? (
          <div className="p-3 md:p-4">
            {/* 2/3 + 1/3 Grid Layout - balanced columns. The scorecard is
                first in the DOM so the headline score/rank leads the mobile
                stack; explicit lg placement keeps the desktop layout
                (main left, scorecard atop the right sidebar) unchanged. */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* SCORECARD - top of mobile stack, top of right column on lg */}
              <div className="lg:col-start-3 lg:row-start-1" data-tour="scorecard">
                <SeasonScorecard
                  score={userCorpsScore}
                  rank={userCorpsRank}
                  rankChange={userRankChange}
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

              {/* MAIN CONTENT (2/3) - Lineup + related analysis */}
              <div className="lg:col-span-2 lg:col-start-1 lg:row-start-1 lg:row-span-2 space-y-4">
                <div data-tour="lineup">
                  <ActiveLineupTable
                    lineup={lineup}
                    lineupScoreData={lineupScoreData}
                    loading={lineupScoresLoading}
                    onManageLineup={() => openCaptionSelection()}
                    onSlotClick={(captionId) => openCaptionSelection(captionId)}
                    scoresAvailable={scoresAvailable}
                    nextShow={nextSelectedShow}
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
                <PredictionGamePanel recentResults={recentResults} corpsClass={activeCorpsClass} />
              </div>

              {/* SIDEBAR (1/3) - Engagement panels below the scorecard */}
              <div className="lg:col-start-3 space-y-4">
                {/* First Season Journey - server-rewarded quest line for new
                    directors; hides itself once all steps are claimed */}
                <JourneyPanel
                  profile={profile}
                  resultCount={recentResults.length}
                  onEditLineup={() => openCaptionSelection()}
                  onSetConcept={() => setShowEditCorps(true)}
                />

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
        <Suspense fallback={<ModalLoadingFallback />}>
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
        <Suspense fallback={<ModalLoadingFallback />}>
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
        <Suspense fallback={<ModalLoadingFallback />}>
          <UniformDesignModal
            onClose={() => setShowUniformDesign(false)}
            onSubmit={handleUniformDesign}
            currentDesign={activeCorps.uniformDesign}
            corpsName={activeCorps.corpsName || activeCorps.name}
          />
        </Suspense>
      )}

      {showNewsSubmission && (
        <Suspense fallback={<ModalLoadingFallback />}>
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

      {/* End-of-season results + payout ceremony (one-shot, written by rollover) */}
      {modalQueue.isActive('seasonRecap') && profile?.pendingSeasonRecap && (
        <Suspense fallback={<ModalLoadingFallback />}>
          <SeasonRecapModal recap={profile.pendingSeasonRecap} onClose={handleSeasonRecapClose} />
        </Suspense>
      )}

      {showStreakModal && (
        <Suspense fallback={<ModalLoadingFallback />}>
          <StreakModal
            onClose={() => setShowStreakModal(false)}
            corpsCoin={profile?.corpsCoin || 0}
          />
        </Suspense>
      )}

      {showWalletModal && (
        <Suspense fallback={<ModalLoadingFallback />}>
          <CorpsCoinModal onClose={() => setShowWalletModal(false)} />
        </Suspense>
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
        <Suspense fallback={<ModalLoadingFallback />}>
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
