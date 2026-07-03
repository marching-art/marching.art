// =============================================================================
// USE REDUCED MOTION HOOK
// =============================================================================
// Two SEPARATE signals, not conflated:
//
// 1. prefersReducedMotion — the user's OS accessibility setting. This is the
//    DEFAULT driver of shouldReduceMotion: a mobile user who did not ask for
//    reduced motion gets animations.
// 2. isLowPower — device/connection heuristics (mobile, 2G/3G, low memory).
//    Heavy animations (confetti, celebrations) can opt in via
//    { includePerformanceHeuristics: true } to also suppress on weak devices.

import { useState, useEffect, useCallback } from 'react';

// Type declarations for Navigator APIs not in standard TypeScript definitions
interface NetworkInformation extends EventTarget {
  effectiveType?: 'slow-2g' | '2g' | '3g' | '4g';
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

interface NavigatorWithExtensions extends Navigator {
  connection?: NetworkInformation;
  mozConnection?: NetworkInformation;
  webkitConnection?: NetworkInformation;
  deviceMemory?: number;
}

declare const navigator: NavigatorWithExtensions;

interface ReducedMotionOptions {
  /** Allow override - force animations on even on mobile */
  forceAnimations?: boolean;
  /**
   * Also reduce motion on low-power devices (mobile, slow connection, low
   * memory). Off by default — only the OS accessibility preference reduces
   * motion unless a heavy animation opts in.
   */
  includePerformanceHeuristics?: boolean;
}

interface ReducedMotionResult {
  /** Primary flag - should reduce/disable animations */
  shouldReduceMotion: boolean;
  /** User explicitly prefers reduced motion (OS accessibility setting) */
  prefersReducedMotion: boolean;
  /** Device/connection heuristics suggest skipping heavy animations */
  isLowPower: boolean;
  /** Device is mobile */
  isMobile: boolean;
  /** Connection is slow */
  isSlowConnection: boolean;
  /** Device has limited memory */
  isLowMemory: boolean;
}

// Detect if running on mobile device
const checkIsMobile = (): boolean => {
  if (typeof window === 'undefined') return false;

  // Check touch capability
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  // Check screen size (mobile breakpoint)
  const isSmallScreen = window.innerWidth < 768;

  // Check user agent for mobile indicators
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
  const isMobileUA = mobileRegex.test(navigator.userAgent);

  // Consider it mobile if touch + small screen OR mobile user agent
  return (hasTouch && isSmallScreen) || isMobileUA;
};

// Detect slow connection
const checkIsSlowConnection = (): boolean => {
  if (typeof navigator === 'undefined') return false;

  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

  if (!connection || !connection.effectiveType) return false;

  // effectiveType can be 'slow-2g', '2g', '3g', '4g'
  const slowTypes: string[] = ['slow-2g', '2g', '3g'];
  return slowTypes.includes(connection.effectiveType);
};

// Detect low memory device
const checkIsLowMemory = (): boolean => {
  if (typeof navigator === 'undefined') return false;

  // deviceMemory is in GB (e.g., 0.5, 1, 2, 4, 8)
  const deviceMemory = navigator.deviceMemory;
  if (deviceMemory === undefined) return false;

  // Consider < 4GB as low memory for animation purposes
  return deviceMemory < 4;
};

/**
 * Hook to detect if animations should be reduced
 * Checks user preference, device type, connection speed, and memory
 */
export const useReducedMotion = (options: ReducedMotionOptions = {}): ReducedMotionResult => {
  const { forceAnimations = false, includePerformanceHeuristics = false } = options;

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  const [isMobile, setIsMobile] = useState(() => checkIsMobile());
  const [isSlowConnection, setIsSlowConnection] = useState(() => checkIsSlowConnection());
  const [isLowMemory] = useState(() => checkIsLowMemory());

  // Listen for changes to prefers-reduced-motion
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    // Legacy browsers
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  // Listen for resize to update mobile status
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let timeoutId: ReturnType<typeof setTimeout>;

    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setIsMobile(checkIsMobile());
      }, 150);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, []);

  // Listen for connection changes
  useEffect(() => {
    if (typeof navigator === 'undefined') return;

    const connection =
      navigator.connection || navigator.mozConnection || navigator.webkitConnection;

    if (!connection) return;

    const handleConnectionChange = () => {
      setIsSlowConnection(checkIsSlowConnection());
    };

    connection.addEventListener?.('change', handleConnectionChange);
    return () => connection.removeEventListener?.('change', handleConnectionChange);
  }, []);

  const isLowPower = isMobile || isSlowConnection || isLowMemory;

  // Calculate if we should reduce motion
  const shouldReduceMotion = (() => {
    // Always respect force override
    if (forceAnimations) return false;

    // The OS accessibility preference always wins
    if (prefersReducedMotion) return true;

    // Performance-based reduction only when the caller opted in
    return includePerformanceHeuristics ? isLowPower : false;
  })();

  return {
    shouldReduceMotion,
    prefersReducedMotion,
    isLowPower,
    isMobile,
    isSlowConnection,
    isLowMemory,
  };
};

/**
 * Simple hook that just returns a boolean for reduced motion
 * Useful for inline conditionals
 */
export const useShouldReduceMotion = (options?: ReducedMotionOptions): boolean => {
  return useReducedMotion(options).shouldReduceMotion;
};

/**
 * Hook specifically for checking if device is mobile
 */
export const useIsMobile = (): boolean => {
  const [isMobile, setIsMobile] = useState(() => checkIsMobile());

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let timeoutId: ReturnType<typeof setTimeout>;

    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setIsMobile(checkIsMobile());
      }, 150);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, []);

  return isMobile;
};

export default useReducedMotion;
