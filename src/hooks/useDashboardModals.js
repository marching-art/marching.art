// =============================================================================
// DASHBOARD MODALS HOOK
// =============================================================================
// Owns all Dashboard modal state, the modal-queue auto-trigger effects, and
// the modal action handlers. Extracted verbatim from src/pages/Dashboard.jsx.

import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { updateProfile } from '../api/profile';
import {
  registerCorps,
  retireCorps,
  unlockClassWithCorpsCoin,
  transferCorps,
  unretireCorps,
} from '../api/functions';
import { CLASS_DISPLAY_NAMES } from '../components/Dashboard/sections/constants';
import { useModalQueue, MODAL_PRIORITY } from './useModalQueue';
import { useModalRoute } from './useModalRoute';

/**
 * Panels a director opens deliberately, so each gets a URL and a back button
 * that closes it (hooks/useModalRoute).
 *
 * The queued interrupts — season recap, onboarding tour, achievement, class
 * unlock, season setup — are deliberately absent: they are not places anyone
 * navigated to, and letting a back gesture dismiss a one-shot ceremony would
 * skip it for good. The destructive confirms (delete/retire/move) are absent
 * for the same reason in reverse: a confirm is a question, not a destination.
 *
 * `quickstart` is here mostly so it exists at all: the Quick Start guide had
 * no caller anywhere in the app, so nothing could open it. A URL gives the
 * help menu and the mobile More sheet something to link to.
 */
// `streak` is routed so a push/inbox deep link (/dashboard?panel=streak) can
// open the streak panel with the freeze offer directly.
export const DASHBOARD_PANELS = ['lineup', 'concept', 'register', 'quickstart', 'streak'];

/**
 * @param {{ uid: string }} user
 * @param {any} dashboardData - Aggregated dashboard state (from useDashboardData).
 * @param {{ isPodiumSelected?: boolean, podiumExists?: boolean }} [podiumContext]
 *   Podium surface signals, owned by pages/Dashboard (podium state is hoisted
 *   there, not in dashboardData). Drives the first-run Podium tour, which can
 *   only fire once the founded daily-loop panels it points at are on screen.
 */
export function useDashboardModals(user, dashboardData, podiumContext = {}) {
  const { isPodiumSelected = false, podiumExists = false } = podiumContext;
  const location = useLocation();
  const {
    profile,
    activeCorps,
    activeCorpsClass,
    seasonData,
    showSeasonSetupWizard,
    setShowSeasonSetupWizard,
    handleSeasonSetupComplete,
    newlyUnlockedClass,
    clearNewlyUnlockedClass,
    newAchievement,
    clearNewAchievement,
    refreshProfile,
    setSelectedCorpsClass,
  } = dashboardData;

  // Modal states
  const modalQueue = useModalQueue();
  // Stable enqueue reference (memoized in the hook) for the modal-queue effects below
  const { enqueue: enqueueModal } = modalQueue;

  // The three panels below live in the URL rather than in component state, so
  // each is linkable and each closes on a back gesture. Their `show*` /
  // `set*` names are kept so every existing call site reads unchanged.
  const modalRoute = useModalRoute(DASHBOARD_PANELS);
  const { open: openPanel, close: closePanel } = modalRoute;

  const showRegistration = modalRoute.isOpen('register');
  /** @type {(next: boolean) => void} */
  const setShowRegistration = useCallback(
    (next) => (next ? openPanel('register') : closePanel()),
    [openPanel, closePanel]
  );
  const showCaptionSelection = modalRoute.isOpen('lineup');
  const selectedCaption = showCaptionSelection ? modalRoute.detail : null;
  const showConceptModal = modalRoute.isOpen('concept');
  /** @type {(next: boolean) => void} */
  const setShowConceptModal = useCallback(
    (next) => (next ? openPanel('concept') : closePanel()),
    [openPanel, closePanel]
  );
  const showQuickStartGuide = modalRoute.isOpen('quickstart');
  /** @type {(next: boolean) => void} */
  const setShowQuickStartGuide = useCallback(
    (next) => (next ? openPanel('quickstart') : closePanel()),
    [openPanel, closePanel]
  );

  const [registrationDefaultClass, setRegistrationDefaultClass] = useState(null);
  const [slotPickerClass, setSlotPickerClass] = useState(null);
  const [unretiring, setUnretiring] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMoveCorps, setShowMoveCorps] = useState(false);
  const [showRetireConfirm, setShowRetireConfirm] = useState(false);
  const [retiring, setRetiring] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [classToPurchase, setClassToPurchase] = useState(/** @type {string|null} */ (null));
  const showStreakModal = modalRoute.isOpen('streak');
  /** @type {(next: boolean) => void} */
  const setShowStreakModal = useCallback(
    (next) => (next ? openPanel('streak') : closePanel()),
    [openPanel, closePanel]
  );
  const [showWalletModal, setShowWalletModal] = useState(false);

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
      enqueueModal('seasonSetup', MODAL_PRIORITY.SEASON_SETUP, { seasonData });
    }
  }, [showSeasonSetupWizard, seasonData, enqueueModal]);

  // Last season's results + payouts, written by the season rollover.
  // Highest priority so the payday shows before the new-season setup wizard.
  useEffect(() => {
    if (profile?.pendingSeasonRecap) {
      enqueueModal('seasonRecap', MODAL_PRIORITY.SEASON_RECAP);
    }
  }, [profile?.pendingSeasonRecap, enqueueModal]);

  // Podium's end-of-season ceremony, the parallel to the fantasy recap above.
  // The flag rides the always-loaded profile (Podium state only loads on its own
  // tab), so this fires proactively on any tab. Same priority as the fantasy
  // recap; the queue serializes them for a director who plays both games.
  useEffect(() => {
    if (profile?.pendingPodiumRecap) {
      enqueueModal('podiumSeasonRecap', MODAL_PRIORITY.SEASON_RECAP);
    }
  }, [profile?.pendingPodiumRecap, enqueueModal]);

  useEffect(() => {
    if (profile?.isFirstVisit && activeCorps) {
      const timer = setTimeout(() => {
        enqueueModal('onboarding', MODAL_PRIORITY.ONBOARDING);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [profile?.isFirstVisit, activeCorps, enqueueModal]);

  // Podium's first-run tour. It targets the daily-loop panels (rehearsal,
  // captions, condition, trajectory), which only render once a corps is
  // founded — so unlike the fantasy tour it waits on `podiumExists`, not just
  // the flag. `podiumFirstVisit` is set at onboarding for a director who chose
  // Podium (pages/Onboarding handlePodiumSubmit) and cleared when the tour is
  // seen; it is a sibling of the fantasy `isFirstVisit` so a director who plays
  // both games gets each tour exactly once.
  useEffect(() => {
    if (profile?.podiumFirstVisit && isPodiumSelected && podiumExists) {
      const timer = setTimeout(() => {
        enqueueModal('podiumOnboarding', MODAL_PRIORITY.ONBOARDING);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [profile?.podiumFirstVisit, isPodiumSelected, podiumExists, enqueueModal]);

  // Celebrations are NOT interrupts. A class unlock and an achievement each
  // land in the inbox server-side (helpers/rewardMoments.js) where they wait
  // for the director; here they get a passing toast and nothing stands in
  // front of the page. The toast for an unlock points at the control bar,
  // which already carries the "register a corps" affordance for it.
  useEffect(() => {
    if (!newlyUnlockedClass) return;
    const name = CLASS_DISPLAY_NAMES[newlyUnlockedClass] || newlyUnlockedClass;
    toast.success(
      `${name} unlocked! Register a corps from the control bar whenever you're ready.`,
      {
        id: `class-unlock-${newlyUnlockedClass}`,
        duration: 6000,
      }
    );
    clearNewlyUnlockedClass();
  }, [newlyUnlockedClass, clearNewlyUnlockedClass]);

  useEffect(() => {
    if (!newAchievement) return;
    toast.success(`Achievement unlocked: ${newAchievement.title}`, {
      id: `achievement-${newAchievement.id}`,
      duration: 6000,
      icon: '🏆',
    });
    clearNewAchievement();
  }, [newAchievement, clearNewAchievement]);

  useEffect(() => {
    const userModalOpen =
      showRegistration ||
      showCaptionSelection ||
      showConceptModal ||
      showQuickStartGuide ||
      showDeleteConfirm ||
      showMoveCorps ||
      showRetireConfirm ||
      showStreakModal ||
      showWalletModal;
    if (userModalOpen) {
      modalQueue.pauseQueue();
    } else {
      modalQueue.resumeQueue();
    }
  }, [
    showRegistration,
    showCaptionSelection,
    showConceptModal,
    showQuickStartGuide,
    showDeleteConfirm,
    showMoveCorps,
    showRetireConfirm,
    showStreakModal,
    showWalletModal,
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

  // Podium tour dismissal — clears its own flag so it shows exactly once,
  // independent of the fantasy tour above.
  const handlePodiumTourComplete = useCallback(async () => {
    modalQueue.dequeue();
    if (profile?.podiumFirstVisit && user) {
      try {
        await updateProfile(user.uid, { podiumFirstVisit: false });
      } catch (error) {
        console.error('Error updating Podium first visit flag:', error);
      }
    }
  }, [modalQueue, profile?.podiumFirstVisit, user]);

  // Dismissing the season recap clears the one-shot pendingSeasonRecap field
  // (a client-writable field; the rewards themselves were applied server-side).
  const handleSeasonRecapClose = useCallback(async () => {
    modalQueue.dequeue();
    if (user?.uid) {
      try {
        await updateProfile(user.uid, { pendingSeasonRecap: null });
      } catch (error) {
        console.error('Error clearing season recap:', error);
      }
    }
  }, [modalQueue, user?.uid]);

  // Dismissing the Podium recap clears its one-shot flag (client-writable, like
  // pendingSeasonRecap — the payout/refund itself was applied server-side).
  const handlePodiumSeasonRecapClose = useCallback(async () => {
    modalQueue.dequeue();
    if (user?.uid) {
      try {
        await updateProfile(user.uid, { pendingPodiumRecap: null });
      } catch (error) {
        console.error('Error clearing Podium season recap:', error);
      }
    }
  }, [modalQueue, user?.uid]);

  // "Set Up Next Season" — clear the flag and switch to the Podium tab, where
  // the full between-seasons assessment and re-registration render (§5.13).
  const handlePodiumSeasonRecapSetup = useCallback(() => {
    handlePodiumSeasonRecapClose();
    setSelectedCorpsClass?.('podiumClass');
    if (user?.uid) {
      try {
        localStorage.setItem(`selectedCorps_${user.uid}`, 'podiumClass');
      } catch {
        // localStorage unavailable — the live switch above still lands the tab.
      }
    }
  }, [handlePodiumSeasonRecapClose, setSelectedCorpsClass, user?.uid]);

  // Podium has no drafted lineup, so the Lineup tab / ?panel=lineup route opens
  // the PodiumLineupSheet chooser instead of the caption editor. When a director
  // picks a fantasy class there, switch the active class and persist it: the
  // ?panel=lineup route is already open, so flipping the class re-runs the
  // editor gate in DashboardModalHost — which now passes — and the caption
  // editor mounts for the chosen class. Mirrors handlePodiumSeasonRecapSetup.
  /** @type {(classId: string) => void} */
  const handleSwitchToFantasyLineup = useCallback(
    (classId) => {
      setSelectedCorpsClass?.(classId);
      if (user?.uid) {
        try {
          localStorage.setItem(`selectedCorps_${user.uid}`, classId);
        } catch {
          // localStorage unavailable — the live switch above still lands the tab.
        }
      }
    },
    [setSelectedCorpsClass, user?.uid]
  );

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

  const handleDeleteCorps = useCallback(async () => {
    try {
      await updateProfile(user.uid, { [`corps.${activeCorpsClass}`]: null });
      toast.success('Corps deleted');
      setShowDeleteConfirm(false);
    } catch {
      toast.error('Failed to delete corps');
    }
  }, [user, activeCorpsClass]);

  const handleRetireCorps = useCallback(async () => {
    setRetiring(true);
    try {
      const result = await retireCorps({ corpsClass: activeCorpsClass });
      if (result.data.success) {
        toast.success(result.data.message || 'Corps retired');
        setShowRetireConfirm(false);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to retire corps');
    } finally {
      setRetiring(false);
    }
  }, [activeCorpsClass]);

  /** @type {(targetClass: string) => Promise<void>} */
  const handleMoveCorps = useCallback(
    async (targetClass) => {
      try {
        setTransferring(true);
        const result = await transferCorps({ fromClass: activeCorpsClass, toClass: targetClass });
        toast.success(result.data.message || 'Corps transferred!');
        setShowMoveCorps(false);
      } catch (error) {
        const e = /** @type {any} */ (error);
        const msg = e?.message || e?.details?.message || 'Failed to transfer corps';
        toast.error(msg);
      } finally {
        setTransferring(false);
      }
    },
    [activeCorpsClass]
  );

  /** @type {(formData: any) => Promise<void>} */
  const handleCorpsRegistration = useCallback(
    async (formData) => {
      try {
        if (!seasonData?.seasonUid) {
          toast.error('Season data not loaded');
          return;
        }
        // Note: registerCorps only reads { corpsName, location, description, class }
        // server-side (functions/src/callable/registerCorps.js) — it never reads a
        // showConcept, so the field is not sent here.
        const result = await registerCorps({
          corpsName: formData.name,
          location: formData.location,
          class: formData.class,
        });
        if (result.data.success) {
          toast.success(`${formData.name} registered!`);
          setShowRegistration(false);
          clearNewlyUnlockedClass();
          refreshProfile?.();
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to register corps');
      }
    },
    [seasonData?.seasonUid, clearNewlyUnlockedClass, refreshProfile, setShowRegistration]
  );

  /** @type {(classKey: string) => void} */
  const handleClassUnlock = useCallback((classKey) => {
    setClassToPurchase(classKey);
  }, []);

  /** @type {(corpsClass: string, retiredIndex: number) => Promise<void>} */
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
        toast.error(error instanceof Error ? error.message : 'Failed to unretire corps');
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
      throw new Error(error instanceof Error ? error.message : 'Failed to unlock class');
    }
  }, [classToPurchase, refreshProfile]);

  // `captionId` rides along as ?slot=, so a link can open the editor already
  // focused on the slot that needs attention.
  const openCaptionSelection = useCallback(
    (captionId = null) => openPanel('lineup', captionId),
    [openPanel]
  );
  const closeCaptionSelection = useCallback(() => closePanel(), [closePanel]);

  // News authoring (press releases + article submissions) moved off the
  // Dashboard to the director's profile (components/Profile/NewsroomActions),
  // which owns that state and its handlers now — publishing news is not a
  // daily-loop action.

  return {
    modalQueue,
    // Modal state
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
    showStreakModal,
    setShowStreakModal,
    showWalletModal,
    setShowWalletModal,
    // Handlers
    handleTourComplete,
    handlePodiumTourComplete,
    handleSeasonRecapClose,
    handlePodiumSeasonRecapClose,
    handlePodiumSeasonRecapSetup,
    handleSwitchToFantasyLineup,
    handleSeasonSetupFinish,
    handleDeleteCorps,
    handleRetireCorps,
    handleMoveCorps,
    handleCorpsRegistration,
    handleClassUnlock,
    handleUnretireCorps,
    handleConfirmClassPurchase,
    openCaptionSelection,
    closeCaptionSelection,
  };
}
