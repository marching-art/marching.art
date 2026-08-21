// @ts-nocheck -- mechanical extraction from Dashboard.jsx; types come with that file
// =============================================================================
// DASHBOARD MODAL HOST
// =============================================================================
// Every modal the dashboard can open, in one place. Moved out of
// pages/Dashboard.jsx so that file is about layout — the mobile zones, the
// desktop grid — rather than about fifteen conditional overlays.
//
// Purely a render surface: all state, queueing, and handlers still live in
// hooks/useDashboardModals, whose whole return is passed straight through as
// `modals`. The season-setup wizard and the duplicate-rename blocker stay in
// Dashboard.jsx: they render ahead of the scroll container, and moving them
// here would reorder the DOM.

import React, { Suspense } from 'react';
import {
  ClassUnlockCongratsModal,
  CorpsRegistrationModal,
  DeleteConfirmModal,
  RetireConfirmModal,
  MoveCorpsModal,
  AchievementModal,
  OnboardingTour,
  QuickStartGuide,
  CLASS_DISPLAY_NAMES,
  CLASS_UNLOCK_LEVELS,
  CLASS_UNLOCK_COSTS,
} from './index';
import { ModalLoadingFallback } from '../ui';
import { lazyWithRetry } from '../../utils/lazyWithRetry';
import { getSeasonsUntilUnlock } from '../../utils/classUnlocks';
import { classHasLineup } from '../../utils/classRegistry';
import { corpsHasPendingWork } from '../../utils/corps';
import { useSeasonStore } from '../../store/seasonStore';

// Same lazyWithRetry treatment these carried in Dashboard.jsx: a stale hashed
// chunk after a deploy self-recovers with one reload instead of crashing into
// the page error boundary. Installed mobile PWAs are the common victim.
const CaptionSelectionModal = lazyWithRetry(
  () => import('../CaptionSelection/CaptionSelectionModal'),
  'CaptionSelectionModal'
);
const UniformDesignModal = lazyWithRetry(
  () => import('../modals/UniformDesignModal'),
  'UniformDesignModal'
);
const ClassPurchaseModal = lazyWithRetry(
  () => import('../modals/ClassPurchaseModal'),
  'ClassPurchaseModal'
);
const NewCorpsSlotModal = lazyWithRetry(
  () => import('../modals/NewCorpsSlotModal'),
  'NewCorpsSlotModal'
);
const StreakModal = lazyWithRetry(() => import('../modals/StreakModal'), 'StreakModal');
const CorpsCoinModal = lazyWithRetry(() => import('../modals/CorpsCoinModal'), 'CorpsCoinModal');
const SeasonRecapModal = lazyWithRetry(
  () => import('../modals/SeasonRecapModal'),
  'SeasonRecapModal'
);
const ShowConceptModal = lazyWithRetry(
  () => import('../modals/ShowConceptModal'),
  'ShowConceptModal'
);

const DashboardModalHost = ({ modals, data, quickStartSteps, onRequestZone }) => {
  const weeksRemaining = useSeasonStore((s) => s.weeksRemaining);
  const isRegistrationLocked = useSeasonStore((s) => s.isRegistrationLocked);

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
    selectedCaption,
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
    showStreakModal,
    setShowStreakModal,
    showWalletModal,
    setShowWalletModal,
    handleTourComplete,
    handlePodiumTourComplete,
    handleSetupNewClass,
    handleDeclineSetup,
    handleAchievementClose,
    handleSeasonRecapClose,
    handleDeleteCorps,
    handleRetireCorps,
    handleMoveCorps,
    handleCorpsRegistration,
    handleUnretireCorps,
    handleConfirmClassPurchase,
    openCaptionSelection,
    closeCaptionSelection,
    handleUniformDesign,
  } = modals;

  const {
    profile,
    corps,
    activeCorps,
    activeCorpsClass,
    seasonData,
    unlockedClasses,
    newlyUnlockedClass,
    clearNewlyUnlockedClass,
    newAchievement,
  } = data;

  return (
    <>
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

      {/* Podium has no caption lineup (classRegistry hasLineup:false), so the
        editor must not open onto it — its budget would be undefined. The
        gate lives here because every route into the editor passes through
        it, including the Lineup nav tab and a ?panel=lineup deep link. */}
      {showCaptionSelection && activeCorps && seasonData && classHasLineup(activeCorpsClass) && (
        <Suspense fallback={<ModalLoadingFallback />}>
          <CaptionSelectionModal
            onClose={closeCaptionSelection}
            onSubmit={closeCaptionSelection}
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

      {/* Fantasy (drafted-lineup) tour. onRequestZone lets its mobile steps
          switch the dashboard to the zone a target lives in before pointing. */}
      <OnboardingTour
        isOpen={modalQueue.isActive('onboarding')}
        onClose={() => modalQueue.dequeue()}
        onComplete={handleTourComplete}
        onRequestZone={onRequestZone}
      />

      {/* Podium (director-sim) tour — same component, its own step list and
          first-visit flag, so a director who plays both games gets each once. */}
      <OnboardingTour
        variant="podium"
        isOpen={modalQueue.isActive('podiumOnboarding')}
        onClose={() => modalQueue.dequeue()}
        onComplete={handlePodiumTourComplete}
        onRequestZone={onRequestZone}
      />

      <QuickStartGuide
        isOpen={showQuickStartGuide}
        onClose={() => setShowQuickStartGuide(false)}
        onAction={(action) => {
          if (action === 'lineup') openCaptionSelection();
        }}
        completedSteps={quickStartSteps}
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
    </>
  );
};

export default DashboardModalHost;
