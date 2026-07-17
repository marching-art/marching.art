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
  submitNewsForApproval,
  transferCorps,
  unretireCorps,
} from '../api/functions';
import { CLASS_DISPLAY_NAMES } from '../components/Dashboard/sections/constants';
import { useModalQueue, MODAL_PRIORITY } from './useModalQueue';
import { useSeasonStore } from '../store/seasonStore';
import { useNightlyReveal } from './useNightlyReveal';

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
  const [showRegistration, setShowRegistration] = useState(false);
  const [registrationDefaultClass, setRegistrationDefaultClass] = useState(null);
  const [slotPickerClass, setSlotPickerClass] = useState(null);
  const [unretiring, setUnretiring] = useState(false);
  const [showCaptionSelection, setShowCaptionSelection] = useState(false);
  const [selectedCaption, setSelectedCaption] = useState(null);
  const [showConceptModal, setShowConceptModal] = useState(false);
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

  // Nightly reveal — "scores are up." Enqueued at the lowest priority so
  // celebrations, setup, and onboarding always come first; the eligibility
  // hook enforces once-per-game-day via a localStorage marker.
  const currentDay = useSeasonStore((s) => s.currentDay);
  const nightlyReveal = useNightlyReveal(user, seasonData, currentDay, profile);
  useEffect(() => {
    if (nightlyReveal) {
      enqueueModal('nightlyReveal', MODAL_PRIORITY.NIGHTLY_REVEAL);
    }
  }, [nightlyReveal, enqueueModal]);

  const handleNightlyRevealClose = useCallback(() => {
    nightlyReveal?.markSeen();
    modalQueue.dequeue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nightlyReveal, modalQueue.dequeue]);

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

  return {
    modalQueue,
    // Nightly reveal ("scores are up" ceremony)
    nightlyReveal,
    handleNightlyRevealClose,
    // Modal state
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
    handleNewsSubmission,
    handleUniformDesign,
  };
}
