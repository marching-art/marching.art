// src/hooks/usePWAInstall.ts
// -----------------------------------------------------------------------------
// Shared PWA install state.
//
// The browser fires `beforeinstallprompt` exactly once, early in the page
// lifecycle, and the event can only be used to prompt a single time. If nothing
// captures it, the ability to install is lost until the next hard reload. A
// one-off toast that the user ignores therefore becomes a dead end.
//
// This module captures that event at import time (before any component mounts)
// into a small external store, so any part of the app can offer a persistent,
// discoverable "Install" action for the rest of the session — not just the
// transient prompt. Components subscribe via `usePWAInstall`.
// -----------------------------------------------------------------------------
import { useCallback, useSyncExternalStore } from 'react';

export type PWAPlatform = 'ios' | 'ipados' | 'android' | 'macos' | 'windows' | 'other';

// The event isn't in the standard lib DOM types yet.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface PWAInstallState {
  /** A native install prompt is queued and can be shown right now. */
  canPromptInstall: boolean;
  /** The app is already running as an installed PWA. */
  isInstalled: boolean;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

const detectPlatform = (): PWAPlatform => {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent || navigator.vendor || '';
  const isIPad =
    /iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isIPhone = /iPhone/.test(ua);
  const isAndroid = /android/i.test(ua);
  const isMac = /Macintosh|MacIntel/.test(ua) && !isIPad;
  const isWindows = /Win/.test(ua);

  if (isIPhone) return 'ios';
  if (isIPad) return 'ipados';
  if (isAndroid) return 'android';
  if (isMac) return 'macos';
  if (isWindows) return 'windows';
  return 'other';
};

// Platform never changes for the life of the tab, so compute it once.
const platform: PWAPlatform = detectPlatform();

const detectInstalled = (): boolean => {
  if (typeof window === 'undefined') return false;
  const displayModeInstalled =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches;
  // iOS Safari exposes standalone on the navigator instead of matchMedia.
  const iosInstalled =
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return displayModeInstalled || iosInstalled;
};

// useSyncExternalStore requires getSnapshot to return a stable reference while
// the state is unchanged, so we cache the snapshot and only replace it on change.
let state: PWAInstallState = {
  canPromptInstall: false,
  isInstalled: detectInstalled(),
};

const listeners = new Set<() => void>();

const setState = (next: Partial<PWAInstallState>) => {
  const merged = { ...state, ...next };
  if (
    merged.canPromptInstall === state.canPromptInstall &&
    merged.isInstalled === state.isInstalled
  ) {
    return;
  }
  state = merged;
  listeners.forEach((l) => l());
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = (): PWAInstallState => state;

// SSR / non-browser: constant snapshot so hydration is stable.
const serverState: PWAInstallState = { canPromptInstall: false, isInstalled: false };
const getServerSnapshot = (): PWAInstallState => serverState;

// Register the global listeners exactly once, as early as this module loads.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Stop the browser's own mini-infobar so we control when to prompt.
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    setState({ canPromptInstall: true });
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    setState({ canPromptInstall: false, isInstalled: true });
  });

  // Catch installs completed through the browser's own UI (address-bar icon,
  // menu) where `appinstalled` may not fire on every engine.
  const standaloneQuery = window.matchMedia('(display-mode: standalone)');
  const handleDisplayModeChange = (e: MediaQueryListEvent) => {
    if (e.matches) {
      deferredPrompt = null;
      setState({ canPromptInstall: false, isInstalled: true });
    }
  };
  if (standaloneQuery.addEventListener) {
    standaloneQuery.addEventListener('change', handleDisplayModeChange);
  } else if (standaloneQuery.addListener) {
    // Safari < 14 fallback.
    standaloneQuery.addListener(handleDisplayModeChange);
  }
}

export type PromptInstallResult = 'accepted' | 'dismissed' | 'unavailable';

/**
 * Fire the queued native install prompt, if one is available. Resolves with the
 * user's choice, or 'unavailable' when there is no prompt to show (e.g. iOS, or
 * the prompt was already consumed) — callers should fall back to showing the
 * manual, platform-specific instructions in that case.
 */
export const promptInstall = async (): Promise<PromptInstallResult> => {
  const evt = deferredPrompt;
  if (!evt) return 'unavailable';
  try {
    await evt.prompt();
    const { outcome } = await evt.userChoice;
    // A deferred prompt can only be used once.
    deferredPrompt = null;
    setState({ canPromptInstall: false });
    return outcome;
  } catch (error) {
    console.error('PWA install prompt error:', error);
    deferredPrompt = null;
    setState({ canPromptInstall: false });
    return 'unavailable';
  }
};

export interface UsePWAInstall extends PWAInstallState {
  platform: PWAPlatform;
  /**
   * True when the app can be installed but only via manual, platform-specific
   * steps (iOS share sheet, or a desktop/Android browser where the native
   * prompt isn't currently available). Callers should render instructions.
   */
  needsManualInstall: boolean;
  promptInstall: () => Promise<PromptInstallResult>;
}

/**
 * Subscribe to app-wide PWA install state. Safe to call from any component; the
 * underlying event listeners are registered once at module load.
 */
export function usePWAInstall(): UsePWAInstall {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const doPrompt = useCallback(() => promptInstall(), []);

  return {
    ...snapshot,
    platform,
    needsManualInstall: !snapshot.isInstalled && !snapshot.canPromptInstall,
    promptInstall: doPrompt,
  };
}
