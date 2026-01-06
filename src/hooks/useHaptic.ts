// =============================================================================
// HAPTIC FEEDBACK HOOK
// =============================================================================
// Native-feel haptic feedback using the Vibration API
// Provides tactile feedback for touch interactions on supported devices

// =============================================================================
// HAPTIC PATTERNS
// =============================================================================
// Pre-defined vibration patterns for different interaction types
// Values are in milliseconds

export const hapticPatterns = {
  // Single vibrations
  light: 10,        // Light tap - buttons, toggles
  medium: 25,       // Medium tap - tab switches, selections
  heavy: 50,        // Heavy tap - important actions, confirmations

  // Pattern vibrations [vibrate, pause, vibrate, ...]
  success: [10, 30, 10],           // Success feedback - form submissions
  error: [50, 50, 50],             // Error feedback - validation errors
  warning: [30, 50, 30],           // Warning feedback - destructive actions
  notification: [10, 50, 10, 50, 10], // Notification arrival

  // Gesture feedback
  swipe: 15,                       // Swipe gesture completion
  pull: [10, 20, 30],              // Pull-to-refresh trigger
  longPress: [20, 30, 50],         // Long press activation

  // UI transitions
  sheetOpen: 20,                   // Bottom sheet opening
  sheetClose: 15,                  // Bottom sheet closing
  modalOpen: 25,                   // Modal opening
  modalClose: 20,                  // Modal closing
} as const;

export type HapticPattern = keyof typeof hapticPatterns;

// =============================================================================
// HAPTIC UTILITY FUNCTIONS
// =============================================================================

/**
 * Check if haptic feedback is supported on the current device
 */
export const isHapticSupported = (): boolean => {
  return 'vibrate' in navigator;
};

/**
 * Trigger haptic feedback with a predefined pattern or custom vibration
 * @param pattern - A predefined pattern name, single duration, or array of durations
 */
export const triggerHaptic = (
  pattern: HapticPattern | number | number[]
): boolean => {
  if (!isHapticSupported()) {
    return false;
  }

  try {
    const vibrationPattern = typeof pattern === 'string'
      ? hapticPatterns[pattern]
      : pattern;

    return navigator.vibrate(vibrationPattern);
  } catch (error) {
    console.warn('Haptic feedback failed:', error);
    return false;
  }
};

/**
 * Cancel any ongoing haptic feedback
 */
export const cancelHaptic = (): boolean => {
  if (!isHapticSupported()) {
    return false;
  }

  return navigator.vibrate(0);
};

// =============================================================================
// REACT HOOK
// =============================================================================

import { useCallback, useMemo } from 'react';

export interface UseHapticOptions {
  /** Disable haptic feedback globally */
  disabled?: boolean;
  /** Reduce haptic intensity (uses lighter patterns) */
  reduced?: boolean;
}

export interface UseHapticReturn {
  /** Whether haptic feedback is supported on this device */
  isSupported: boolean;
  /** Trigger haptic feedback */
  trigger: (pattern?: HapticPattern | number | number[]) => void;
  /** Cancel ongoing haptic feedback */
  cancel: () => void;
  /** Pre-bound handlers for common interactions */
  handlers: {
    onTap: () => void;
    onPress: () => void;
    onSuccess: () => void;
    onError: () => void;
    onSwipe: () => void;
  };
}

/**
 * React hook for haptic feedback
 * Provides easy access to haptic patterns and interaction handlers
 */
export const useHaptic = (options: UseHapticOptions = {}): UseHapticReturn => {
  const { disabled = false, reduced = false } = options;

  const isSupported = useMemo(() => isHapticSupported(), []);

  const trigger = useCallback(
    (pattern: HapticPattern | number | number[] = 'light') => {
      if (disabled) return;

      // Use lighter patterns when reduced motion is preferred
      if (reduced && typeof pattern === 'string') {
        const reducedPatterns: Partial<Record<HapticPattern, HapticPattern | number>> = {
          medium: 'light',
          heavy: 'medium',
          error: 'light',
          warning: 'light',
        };
        pattern = reducedPatterns[pattern] || pattern;
      }

      triggerHaptic(pattern);
    },
    [disabled, reduced]
  );

  const cancel = useCallback(() => {
    cancelHaptic();
  }, []);

  // Pre-bound handlers for common interactions
  const handlers = useMemo(
    () => ({
      onTap: () => trigger('light'),
      onPress: () => trigger('medium'),
      onSuccess: () => trigger('success'),
      onError: () => trigger('error'),
      onSwipe: () => trigger('swipe'),
    }),
    [trigger]
  );

  return {
    isSupported,
    trigger,
    cancel,
    handlers,
  };
};

// =============================================================================
// HIGHER-ORDER COMPONENT WRAPPER
// =============================================================================

/**
 * Wrap an event handler with haptic feedback
 * @param handler - The original event handler
 * @param pattern - The haptic pattern to trigger
 */
export const withHaptic = <T extends (...args: any[]) => any>(
  handler: T,
  pattern: HapticPattern | number | number[] = 'light'
): T => {
  return ((...args: Parameters<T>) => {
    triggerHaptic(pattern);
    return handler(...args);
  }) as T;
};

export default useHaptic;
