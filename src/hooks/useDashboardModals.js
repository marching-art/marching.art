// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
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
  generateCorpsAvatar,
  registerCorps,
  retireCorps,
  unlockClassWithCorpsCoin,
  submitNewsForApproval,
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
export const DASHBOARD_PANELS = ['lineup', 'concept', 'register', 'quickstart'];

export function useDashboardModals(user, dashboardData) {
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
  const setShowRegistration = useCallback(
    (next) => (next ? openPanel('register') : closePanel()),
    [openPanel, closePanel]
  );
  const showCaptionSelection = modalRoute.isOpen('lineup');
  const selectedCaption = showCaptionSelection ? modalRoute.detail : null;
  const showConceptModal = modalRoute.isOpen('concept');
  const setShowConceptModal = useCallback(
    (next) => (next ? openPanel('concept') : closePanel()),
    [openPanel, closePanel]
  );
  const showQuickStartGuide = modalRoute.isOpen('quickstart');
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
  const [classToPurchase, setClassToPurchase] = useState(null);
  const [showUniformDesign, setShowUniformDesign] = useState(false);
  const [showNewsSubmission, setShowNewsSubmission] = useState(false);
  const [submittingNews, setSubmittingNews] = useState(false);
  const [showStreakModal, setShowStreakModal] = useState(false);
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

  useEffect(() => {
    if (profile?.isFirstVisit && activeCorps) {
      const timer = setTimeout(() => {
        enqueueModal('onboarding', MODAL_PRIORITY.ONBOARDING);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [profile?.isFirstVisit, activeCorps, enqueueModal]);

  useEffect(() => {
    if (newlyUnlockedClass) {
      enqueueModal('classUnlock', MODAL_PRIORITY.CLASS_UNLOCK, {
        unlockedClass: newlyUnlockedClass,
      });
    }
  }, [newlyUnlockedClass, enqueueModal]);

  useEffect(() => {
    if (newAchievement) {
      enqueueModal('achievement', MODAL_PRIORITY.ACHIEVEMENT, {
        achievement: newAchievement,
      });
    }
  }, [newAchievement, enqueueModal]);

  useEffect(() => {
    const userModalOpen =
      showRegistration ||
      showCaptionSelection ||
      showConceptModal ||
      showQuickStartGuide ||
      showDeleteConfirm ||
      showMoveCorps ||
      showRetireConfirm ||
      showNewsSubmission ||
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
    showNewsSubmission,
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

  const handleSetupNewClass = useCallback(() => {
    modalQueue.dequeue();
    setShowRegistration(true);
  }, [modalQueue, setShowRegistration]);

  const handleDeclineSetup = useCallback(() => {
    modalQueue.dequeue();
    clearNewlyUnlockedClass();
    toast.success('You can register your new corps anytime!');
  }, [modalQueue, clearNewlyUnlockedClass]);

  const handleAchievementClose = useCallback(() => {
    modalQueue.dequeue();
    clearNewAchievement();
  }, [modalQueue, clearNewAchievement]);

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
    [seasonData?.seasonUid, clearNewlyUnlockedClass, refreshProfile, setShowRegistration]
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

  // `captionId` rides along as ?slot=, so a link can open the editor already
  // focused on the slot that needs attention.
  const openCaptionSelection = useCallback(
    (captionId = null) => openPanel('lineup', captionId),
    [openPanel]
  );
  const closeCaptionSelection = useCallback(() => closePanel(), [closePanel]);

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
        toast.success('Uniform design saved!');
        setShowUniformDesign(false);
        refreshProfile?.();
        // Avatar generation is invoked explicitly — there is no server-side
        // trigger watching profile writes for design changes. The profile
        // listener picks up the new avatarUrl when the callable finishes.
        toast.promise(generateCorpsAvatar({ corpsClass: activeCorpsClass }), {
          loading: 'Generating avatar...',
          success: 'Avatar generated!',
          error: 'Avatar generation failed — you can retry from your profile.',
        });
      } catch (error) {
        toast.error('Failed to save uniform design');
        throw error;
      }
    },
    [user, activeCorpsClass, refreshProfile]
  );

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
    showUniformDesign,
    setShowUniformDesign,
    showNewsSubmission,
    setShowNewsSubmission,
    submittingNews,
    showStreakModal,
    setShowStreakModal,
    showWalletModal,
    setShowWalletModal,
    // Handlers
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
    closeCaptionSelection,
    handleNewsSubmission,
    handleUniformDesign,
  };
}
