// =============================================================================
// DASHBOARD - TEAM OVERVIEW (data-terminal style)
// =============================================================================
// Hero: Active Lineup Roster Table. Sidebar: Season Scorecard + Recent Results.
// Laws: App Shell, 2/3 + 1/3 grid, data tables over cards, no glow

import React, { useMemo, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, FileText } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { lazyWithRetry } from '../utils/lazyWithRetry';

// OPTIMIZATION #9: Lazy-load large modal components to reduce initial bundle size
// Prioritized by file size: CaptionSelectionModal (1007 lines), UniformDesignModal (794 lines),
// NewsSubmissionModal (283 lines), ClassPurchaseModal (247 lines)
//
// These use lazyWithRetry (not raw React.lazy) so that a stale hashed chunk
// after a deploy self-recovers with a single reload instead of crashing into
// the page error boundary. Installed mobile PWAs are the common victim: they
// run cached entry code that imports an old chunk hash which 404s the first
// time a not-yet-opened modal is triggered.
const CaptionSelectionModal = lazyWithRetry(
  () => import('../components/CaptionSelection/CaptionSelectionModal'),
  'CaptionSelectionModal'
);
const SeasonSetupWizard = lazyWithRetry(
  () => import('../components/SeasonSetupWizard'),
  'SeasonSetupWizard'
);
const UniformDesignModal = lazyWithRetry(
  () => import('../components/modals/UniformDesignModal'),
  'UniformDesignModal'
);
const NewsSubmissionModal = lazyWithRetry(
  () => import('../components/modals/NewsSubmissionModal'),
  'NewsSubmissionModal'
);
const ClassPurchaseModal = lazyWithRetry(
  () => import('../components/modals/ClassPurchaseModal'),
  'ClassPurchaseModal'
);
const NewCorpsSlotModal = lazyWithRetry(
  () => import('../components/modals/NewCorpsSlotModal'),
  'NewCorpsSlotModal'
);
const RenameDuplicateCorpsModal = lazyWithRetry(
  () => import('../components/modals/RenameDuplicateCorpsModal'),
  'RenameDuplicateCorpsModal'
);
// Podium Class Zone C (flag-gated director sim — registration, rehearsal
// planner, caption progress). Lazy: fantasy-only players never load it.
const PodiumZone = lazyWithRetry(() => import('../components/Podium/PodiumZone'), 'PodiumZone');
const PodiumJourneyPanel = lazyWithRetry(
  () => import('../components/Podium/PodiumJourneyPanel'),
  'PodiumJourneyPanel'
);
const StreakModal = lazyWithRetry(() => import('../components/modals/StreakModal'), 'StreakModal');
const CorpsCoinModal = lazyWithRetry(
  () => import('../components/modals/CorpsCoinModal'),
  'CorpsCoinModal'
);
const SeasonRecapModal = lazyWithRetry(
  () => import('../components/modals/SeasonRecapModal'),
  'SeasonRecapModal'
);
const ShowConceptModal = lazyWithRetry(
  () => import('../components/modals/ShowConceptModal'),
  'ShowConceptModal'
);

import {
  ClassUnlockCongratsModal,
  CorpsRegistrationModal,
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
  LineupSimulatorPanel,
  JourneyPanel,
  SeasonProgressHub,
  DirectorsReport,
  CLASS_DISPLAY_NAMES,
  CLASS_UNLOCK_LEVELS,
  CLASS_UNLOCK_COSTS,
} from '../components/Dashboard';

import { ModalLoadingFallback } from '../components/ui';
import { getSeasonsUntilUnlock } from '../utils/classUnlocks';
import NextPerformancePanel from '../components/Dashboard/NextPerformancePanel';
import { useScheduleStore } from '../store/scheduleStore';

import { useDashboardData } from '../hooks/useDashboardData';
import { useScoresData } from '../hooks/useScoresData';
import { useMyLeagues } from '../hooks/useLeagues';
import { CORPS_CLASS_ORDER } from '../utils/corps';
import { canEditCorpsThisSeason, corpsHasPendingWork } from '../utils/corps';
import { useDashboardModals } from '../hooks/useDashboardModals';
import { usePodiumEnabled } from '../hooks/useFeatures';
import {
  useLineupScores,
  useRecentResults,
  usePodiumRecentResults,
  useBestInShowCount,
} from '../hooks/useDashboardScores';
import { useSeasonStore } from '../store/seasonStore';
import { getEffectiveDay, getNextSelectedShow } from '../utils/dashboardScoring';
import { getEquippedCosmetic } from '../utils/cosmetics';

// OPTIMIZATION #4: Constants moved to src/components/Dashboard/sections/constants.js
// Imported via: CLASS_LABELS, CAPTIONS, CLASS_DISPLAY_NAMES, getSoundSportRating

// OPTIMIZATION #4: Inline components extracted to src/components/Dashboard/sections/
// - ControlBar, ActiveLineupTable, SeasonScorecard, RecentResultsFeed
// This reduces Dashboard.jsx from 1600+ lines to ~800 lines and isolates renders

// =============================================================================
// DASHBOARD COMPONENT
// =============================================================================

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
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
    showConceptModal,
    setShowConceptModal,
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
    availableCorps, // Season pool (corpsValues) — supplies resultDays for pick highlights
  } = dashboardData;

  // Podium Class (flag-gated): when its tab is selected, Zone C swaps to the
  // director-sim surface and the no-corps state runs Podium registration.
  const podiumEnabled = usePodiumEnabled();
  const isPodiumSelected = podiumEnabled && activeCorpsClass === 'podiumClass';

  // Computed values
  const lineup = useMemo(() => activeCorps?.lineup || {}, [activeCorps?.lineup]);
  // Corps Identity Shop card theme (equipped cosmetic) for the scorecard
  const equippedCardTheme = useMemo(() => getEquippedCosmetic(profile, 'cardTheme'), [profile]);
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
    // Podium Class scores never land in the fantasy recap aggregation: the
    // nightly Podium processor writes to podium-recaps and mirrors the current
    // total onto profile.corps.podiumClass (activeCorps here). Read that
    // display copy instead of searching aggregatedScores, which is always
    // empty for Podium.
    if (activeCorpsClass === 'podiumClass') return activeCorps.totalSeasonScore ?? null;
    const corpsName = activeCorps.corpsName || activeCorps.name;
    const entry = aggregatedScores.find((s) => s.corpsName === corpsName);
    return entry?.score ?? null;
  }, [aggregatedScores, activeCorps, activeCorpsClass]);

  const userCorpsRank = useMemo(() => {
    if (!activeCorps) return null;
    // Podium ranks come from the same profile display copy (seasonRank),
    // written by computePodiumRankings in the nightly processor.
    if (activeCorpsClass === 'podiumClass') return activeCorps.seasonRank ?? null;
    const corpsName = activeCorps.corpsName || activeCorps.name;
    const entry = aggregatedScores.find((s) => s.corpsName === corpsName);
    return entry?.rank ?? null;
  }, [aggregatedScores, activeCorps, activeCorpsClass]);

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
  // Recent results: fantasy classes read fantasy_recaps; Podium reads its own
  // podium-recaps pipeline. Only the active class's source is enabled, so the
  // idle one costs no Firestore reads.
  const fantasyRecentResults = useRecentResults(
    user,
    seasonData,
    activeCorpsClass,
    activeCorpsClass === 'podiumClass' ? null : currentDay
  );
  const podiumRecentResults = usePodiumRecentResults(
    user,
    seasonData,
    currentDay,
    activeCorpsClass === 'podiumClass'
  );
  const recentResults =
    activeCorpsClass === 'podiumClass' ? podiumRecentResults : fantasyRecentResults;

  // Best recent result — the one fact kept from the retired QuickStats
  // widget, shown inline on the scorecard (Zone A).
  const bestRecent = useMemo(() => {
    if (!recentResults?.length) return null;
    return recentResults.reduce((a, b) => ((a.score || 0) > (b.score || 0) ? a : b));
  }, [recentResults]);

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background">
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
            onLevelClick={() => navigate('/achievements')}
          />
        </div>

        {isPodiumSelected && !activeCorps ? (
          /* Podium tab, no corps yet — the four-step founding flow */
          <div className="p-3 md:p-4 flex justify-center">
            <Suspense fallback={<ModalLoadingFallback />}>
              <PodiumZone />
            </Suspense>
          </div>
        ) : activeCorps ? (
          <div className="p-3 md:p-4">
            {/* 2/3 + 1/3 grid. Zone C (My Corps) leads the DOM and holds the
                left column; the right sidebar (scorecard, Today, The Season) is
                grouped into a single grid cell so its row tracks aren't
                stretched by the taller left column — that stretching used to pad
                blank space between the scorecard, Today, and The Season on the
                Podium tab. `order-*` restores the mobile stack order (scorecard
                → today → my corps → season); `items-start` keeps each desktop
                column top-aligned. */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:items-start">
              {/* ZONE C — MY CORPS (2/3): the strategic work — build, tune,
                  and tonight's performances. `order-3` drops it into the
                  My-Corps slot of the mobile stack. */}
              <div className="order-3 lg:order-none lg:col-span-2 lg:col-start-1 lg:row-start-1 space-y-4">
                <h2 className="text-[10px] font-bold uppercase tracking-wider text-muted -mb-2 lg:sr-only">
                  My Corps
                </h2>
                {isPodiumSelected ? (
                  /* Podium Class — director sim replaces the lineup surfaces
                     (design §6): rehearsal planner + caption progress. */
                  <Suspense fallback={<ModalLoadingFallback />}>
                    <div data-tour="lineup">
                      <PodiumZone />
                    </div>
                  </Suspense>
                ) : (
                  <>
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

                    {/* Next Performance - real show timing + running order + your-picks-live spotlight */}
                    <NextPerformancePanel
                      competitions={competitions}
                      selectedShows={activeCorps?.selectedShows || {}}
                      lineup={lineup}
                      poolCorps={availableCorps}
                    />
                  </>
                )}
              </div>

              {/* RIGHT SIDEBAR (1/3) — Zones A, B, and D as one grid cell. On
                  mobile the wrapper is `contents`, so A/B/D stay independent
                  grid items and the `order-*` classes preserve the
                  scorecard-first stack; `lg:block` turns it into a real 1/3
                  column, top-aligned by the grid's items-start so the taller
                  left column no longer inflates these rows. */}
              <div className="contents lg:block lg:col-start-3 lg:row-start-1 lg:space-y-4">
                {/* ZONE A — HEADLINE: last night's payoff leads the page on
                    every device (top of mobile stack, top of right column) */}
                <div className="order-1 lg:order-none" data-tour="scorecard">
                  <SeasonScorecard
                    themeClass={equippedCardTheme?.cardClass}
                    bestRecent={bestRecent}
                    onShowConcept={() => setShowConceptModal(true)}
                    showConcept={activeCorps.showConcept}
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

                {/* ZONE B — TODAY: the whole daily set in one card (second in
                    the mobile stack so the to-do list is one scroll from the
                    score) */}
                <div className="order-2 lg:order-none space-y-4">
                  <h2 className="text-[10px] font-bold uppercase tracking-wider text-muted -mb-2">
                    Today
                  </h2>

                  {/* Director's Report — login + challenges + predictions +
                      pending claims as one checklist with a single count */}
                  <DirectorsReport
                    recentResults={recentResults}
                    corpsClass={activeCorpsClass}
                    seasonUid={seasonData?.seasonUid}
                    onLineupClick={() => openCaptionSelection()}
                    onConceptClick={() => setShowConceptModal(true)}
                  />

                  {/* First Season Journey - server-rewarded quest line for new
                      directors; hides itself once all steps are claimed */}
                  {isPodiumSelected ? (
                    /* Podium Rookie Journey — the director-sim equivalent quest
                       line, kept in the right column like the fantasy journey */
                    <Suspense fallback={null}>
                      <PodiumJourneyPanel />
                    </Suspense>
                  ) : (
                    <JourneyPanel
                      profile={profile}
                      resultCount={recentResults.length}
                      onEditLineup={() => openCaptionSelection()}
                      onSetConcept={() => setShowConceptModal(true)}
                    />
                  )}
                </div>

                {/* ZONE D — THE SEASON: how am I advancing, who am I chasing,
                    what just happened */}
                <div className="order-4 lg:order-none space-y-4">
                  <h2 className="text-[10px] font-bold uppercase tracking-wider text-muted -mb-2">
                    The Season
                  </h2>

                  {/* Season progress hub — ladder + achievements as one surface */}
                  <SeasonProgressHub
                    profile={profile}
                    seasonUid={seasonData?.seasonUid}
                    lineupCount={lineupCount}
                    resultCount={recentResults.length}
                    leagueCount={myLeagues?.length || 0}
                  />

                  {/* Rivals - closest competitors in the active corps's class */}
                  <RivalsPanel rivals={activeCorpsRivals} corpsClass={activeCorpsClass} />

                  <div data-tour="recent-results">
                    <RecentResultsFeed
                      results={recentResults}
                      loading={scoresLoading}
                      corpsClass={activeCorpsClass}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer — community content is not a daily action, so it sits
                below the zones instead of occupying sidebar real estate */}
            <div className="mt-4 bg-surface-card border border-line overflow-hidden">
              <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <p className="text-xs text-muted flex-1">
                  Share your insights, analysis, or news with the community.
                </p>
                <button
                  onClick={() => setShowNewsSubmission(true)}
                  className="py-2.5 px-4 bg-surface-raised hover:bg-line border border-line text-white text-sm font-bold transition-colors flex items-center justify-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  Submit Article
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* No Corps State */
          <div className="flex items-center justify-center min-h-[60vh] p-4">
            <div className="bg-surface-card border border-line max-w-sm w-full">
              <div className="bg-surface-raised px-4 py-3 border-b border-line">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted">
                  Start Your Season
                </h3>
              </div>
              <div className="p-6 text-center">
                <Trophy className="w-12 h-12 text-muted mx-auto mb-4" />
                <p className="text-sm text-muted mb-4">
                  Create your first fantasy corps to begin competing.
                </p>
                <button
                  onClick={() => setShowRegistration(true)}
                  className="w-full py-3 bg-interactive text-white text-sm font-bold hover:bg-interactive-hover"
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

      {showConceptModal && activeCorps && (
        <Suspense fallback={<ModalLoadingFallback />}>
          <ShowConceptModal
            onClose={() => setShowConceptModal(false)}
            corpsClass={activeCorpsClass}
            corpsName={activeCorps.corpsName || activeCorps.name}
            currentConcept={activeCorps.showConcept}
          />
        </Suspense>
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
            seasonsUntilUnlock={getSeasonsUntilUnlock(
              profile?.lifetimeStats?.totalSeasons,
              classToPurchase
            )}
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
