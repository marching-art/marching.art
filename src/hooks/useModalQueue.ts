// =============================================================================
// MODAL QUEUE HOOK
// =============================================================================
// Manages sequential display of modals to prevent modal chaos
// Only one modal from the queue shows at a time

import { useState, useCallback, useEffect, useRef } from 'react';

// Modal priorities (lower number = higher priority)
export const MODAL_PRIORITY = {
  SEASON_SETUP: 1,      // Critical - needed to play
  ONBOARDING: 2,        // High - first visit experience
  CLASS_UNLOCK: 3,      // Medium - celebration
  ACHIEVEMENT: 4,       // Medium - celebration
  SOUNDSPORT_WELCOME: 5, // Low - informational
} as const;

export type ModalPriority = typeof MODAL_PRIORITY[keyof typeof MODAL_PRIORITY];

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
}

/**
 * Hook to manage a queue of modals with priority
 * Ensures only one automated modal shows at a time
 */
export function useModalQueue(): UseModalQueueReturn {
  const [queue, setQueue] = useState<QueuedModal[]>([]);
  const [currentModal, setCurrentModal] = useState<QueuedModal | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const processedIds = useRef<Set<string>>(new Set());

  // Process the queue when it changes
  useEffect(() => {
    if (isPaused || currentModal !== null || queue.length === 0) {
      return;
    }

    // Get highest priority modal (lowest priority number)
    const sorted = [...queue].sort((a, b) => a.priority - b.priority);
    const next = sorted[0];

    if (next) {
      setCurrentModal(next);
      setQueue((prev) => prev.filter((m) => m.id !== next.id));
    }
  }, [queue, currentModal, isPaused]);

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

  const isActive = useCallback((id: string): boolean => {
    return currentModal?.id === id;
  }, [currentModal]);

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
  };
}

export default useModalQueue;
