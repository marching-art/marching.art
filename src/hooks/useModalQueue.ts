// =============================================================================
// MODAL QUEUE HOOK
// =============================================================================
// Manages the dashboard's automated interrupts (the dialogs nobody asked to
// open: season recap, season setup, the first-visit tour).
//
// Two rules. Only one queued modal is on screen at a time, and only ONE is
// shown per visit: whatever is still queued when the first is dismissed stays
// pending for the next visit — every trigger is a profile flag, so it simply
// re-enqueues on the next mount. A returning director at season rollover used
// to face recap → setup wizard → class unlock → achievement → install nudge
// before seeing the page (site review U-H4). Celebrations (achievements,
// class unlocks) no longer queue at all — they are inbox rows plus a passing
// toast.

import { useState, useCallback, useEffect, useRef } from 'react';

// Modal priorities (lower number = higher priority)
export const MODAL_PRIORITY = {
  SEASON_RECAP: 0, // Last season's results + payouts — shown before new-season setup
  SEASON_SETUP: 1, // Critical - needed to play
  ONBOARDING: 2, // High - first visit experience
} as const;

/** Automated interrupts allowed per dashboard visit (one mount of the queue). */
export const MAX_INTERRUPTS_PER_VISIT = 1;

/**
 * sessionStorage key stamped when an interrupt is shown, so other transient
 * nudges (the PWA install prompt) can yield for the rest of this browser
 * session instead of stacking a second interruption on the same visit.
 */
export const INTERRUPT_SHOWN_KEY = 'ma:interruptShown';

export function markInterruptShown(): void {
  try {
    sessionStorage.setItem(INTERRUPT_SHOWN_KEY, String(Date.now()));
  } catch {
    /* storage unavailable — the in-memory cap still holds */
  }
}

export function wasInterruptShownThisSession(): boolean {
  try {
    return sessionStorage.getItem(INTERRUPT_SHOWN_KEY) !== null;
  } catch {
    return false;
  }
}

export type ModalPriority = (typeof MODAL_PRIORITY)[keyof typeof MODAL_PRIORITY];

interface QueuedModal {
  id: string;
  priority: ModalPriority;
  data?: unknown;
}

interface UseModalQueueReturn {
  // Current modal to show (null if none)
  currentModal: QueuedModal | null;
  // Add a modal to the queue
  enqueue: (id: string, priority: ModalPriority, data?: unknown) => void;
  // Remove current modal and show next
  dequeue: () => void;
  // Check if a specific modal is current
  isActive: (id: string) => boolean;
  // Clear entire queue
  clearQueue: () => void;
  // Pause queue (for user-triggered modals)
  pauseQueue: () => void;
  // Resume queue
  resumeQueue: () => void;
  // Check if queue is paused
  isPaused: boolean;
  // How many automated modals this visit has shown so far
  shownThisVisit: number;
}

/**
 * Hook to manage a queue of modals with priority
 * Ensures only one automated modal shows at a time
 */
export function useModalQueue(): UseModalQueueReturn {
  const [queue, setQueue] = useState<QueuedModal[]>([]);
  const [currentModal, setCurrentModal] = useState<QueuedModal | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [shownThisVisit, setShownThisVisit] = useState(0);
  const processedIds = useRef<Set<string>>(new Set());

  // Process the queue when it changes
  useEffect(() => {
    if (isPaused || currentModal !== null || queue.length === 0) {
      return;
    }
    // The visit's interrupt budget is spent: leave the rest queued. They are
    // not lost — each trigger is a profile flag that re-enqueues next visit.
    if (shownThisVisit >= MAX_INTERRUPTS_PER_VISIT) {
      return;
    }

    // Get highest priority modal (lowest priority number)
    const sorted = [...queue].sort((a, b) => a.priority - b.priority);
    const next = sorted[0];

    if (next) {
      setCurrentModal(next);
      setShownThisVisit((n) => n + 1);
      markInterruptShown();
      setQueue((prev) => prev.filter((m) => m.id !== next.id));
    }
  }, [queue, currentModal, isPaused, shownThisVisit]);

  const enqueue = useCallback((id: string, priority: ModalPriority, data?: unknown) => {
    // Prevent duplicate modals and re-showing dismissed modals
    if (processedIds.current.has(id)) {
      return;
    }

    setQueue((prev) => {
      // Don't add if already in queue
      if (prev.some((m) => m.id === id)) {
        return prev;
      }
      return [...prev, { id, priority, data }];
    });
  }, []);

  const dequeue = useCallback(() => {
    if (currentModal) {
      processedIds.current.add(currentModal.id);
    }
    setCurrentModal(null);
  }, [currentModal]);

  const isActive = useCallback(
    (id: string): boolean => {
      return currentModal?.id === id;
    },
    [currentModal]
  );

  const clearQueue = useCallback(() => {
    setQueue([]);
    setCurrentModal(null);
  }, []);

  const pauseQueue = useCallback(() => {
    setIsPaused(true);
  }, []);

  const resumeQueue = useCallback(() => {
    setIsPaused(false);
  }, []);

  return {
    currentModal,
    enqueue,
    dequeue,
    isActive,
    clearQueue,
    pauseQueue,
    resumeQueue,
    isPaused,
    shownThisVisit,
  };
}

export default useModalQueue;
