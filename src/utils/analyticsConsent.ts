// =============================================================================
// ANALYTICS CONSENT
// =============================================================================
// The Privacy policy (§7, §10) says Google Analytics runs on the visitor's
// consent, which they can withdraw at any time. This is the single source of
// truth for that decision, stored per browser so it covers guests as well as
// signed-in directors and survives sign-out.
//
//   'unset'   — never asked or answered; the consent bar shows, analytics OFF
//   'granted' — analytics initialises and reports
//   'denied'  — analytics stays off; the bar never shows again
//
// `src/api/analytics.ts` subscribes to it and turns collection on/off live;
// the consent bar and the Settings toggle write it. Nothing here touches
// Firebase, so it is safe to import from anywhere (including tests).

import { useCallback, useSyncExternalStore } from 'react';

export type AnalyticsConsent = 'unset' | 'granted' | 'denied';

export const ANALYTICS_CONSENT_KEY = 'ma:analyticsConsent';

const listeners = new Set<() => void>();

/** Memoised so useSyncExternalStore gets a stable snapshot between writes. */
let snapshot: AnalyticsConsent | null = null;

function readStorage(): AnalyticsConsent {
  try {
    const value = localStorage.getItem(ANALYTICS_CONSENT_KEY);
    return value === 'granted' || value === 'denied' ? value : 'unset';
  } catch {
    // Storage blocked (private mode, sandboxed iframe): treat as never asked,
    // which keeps analytics off. The bar re-asks each visit, which is the
    // honest outcome when the answer cannot be remembered.
    return 'unset';
  }
}

function notify(): void {
  listeners.forEach((fn) => fn());
}

/** Current decision. */
export function getAnalyticsConsent(): AnalyticsConsent {
  if (snapshot === null) snapshot = readStorage();
  return snapshot;
}

/** True only when the visitor has explicitly allowed analytics. */
export function isAnalyticsAllowed(): boolean {
  return getAnalyticsConsent() === 'granted';
}

/** Record a decision (the bar's buttons, the Settings toggle). */
export function setAnalyticsConsent(value: 'granted' | 'denied'): void {
  try {
    localStorage.setItem(ANALYTICS_CONSENT_KEY, value);
  } catch {
    // Still honour the choice for this page load.
  }
  if (snapshot === value) return;
  snapshot = value;
  notify();
}

/** Forget the decision (tests, and a future "ask me again"). */
export function resetAnalyticsConsent(): void {
  try {
    localStorage.removeItem(ANALYTICS_CONSENT_KEY);
  } catch {
    /* nothing to clear */
  }
  snapshot = 'unset';
  notify();
}

/** Subscribe to changes, including those made in another tab. */
export function subscribeAnalyticsConsent(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== null && event.key !== ANALYTICS_CONSENT_KEY) return;
    const next = readStorage();
    if (next === snapshot) return;
    snapshot = next;
    notify();
  });
}

/**
 * React view of the decision.
 *
 * `enabled` is what a toggle shows (granted → on, anything else → off);
 * `consent` distinguishes "never asked" from "declined" for the consent bar.
 */
export function useAnalyticsConsent() {
  const consent = useSyncExternalStore(
    subscribeAnalyticsConsent,
    getAnalyticsConsent,
    () => 'unset' as AnalyticsConsent
  );
  const setEnabled = useCallback((enabled: boolean) => {
    setAnalyticsConsent(enabled ? 'granted' : 'denied');
  }, []);
  return {
    consent,
    enabled: consent === 'granted',
    asked: consent !== 'unset',
    setEnabled,
    grant: () => setEnabled(true),
    deny: () => setEnabled(false),
  };
}
