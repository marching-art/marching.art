// =============================================================================
// ANALYTICS UTILITIES
// =============================================================================
// Safe analytics logging that gracefully handles ad blockers — and, more
// importantly, consent. Google Analytics is NOT initialised on import: the
// Privacy policy promises analytics cookies are consent-based, so the SDK is
// only created once the visitor allows it (utils/analyticsConsent) and
// collection is switched off again the moment they withdraw. Events logged
// before consent are dropped, never queued.
//
// Usage: import { analytics } from '@/api/analytics';

import {
  getAnalytics,
  logEvent,
  isSupported,
  setAnalyticsCollectionEnabled,
  type Analytics,
} from 'firebase/analytics';
import { app } from './client';
import { FEATURE_FLAGS, FIREBASE_CONFIG } from '../config';
import { isAnalyticsAllowed, subscribeAnalyticsConsent } from '../utils/analyticsConsent';

// =============================================================================
// ANALYTICS INITIALIZATION (consent-gated)
// =============================================================================

let analyticsInstance: Analytics | null = null;
let collecting = false;
let initializing: Promise<void> | null = null;
/** isSupported() is answered once per page; an unsupported browser stays so. */
let unsupported = false;

/** Builds without a measurement id (local dev, forks) have nothing to report to. */
const configured = Boolean(FEATURE_FLAGS.analytics && FIREBASE_CONFIG.measurementId);

/**
 * Bring the SDK in line with the current consent: create it (once) and enable
 * collection when allowed; disable collection when withdrawn. Idempotent and
 * safe to call from any consent change.
 */
export async function syncAnalyticsWithConsent(): Promise<void> {
  if (!configured) return;

  if (!isAnalyticsAllowed()) {
    if (analyticsInstance && collecting) {
      collecting = false;
      try {
        setAnalyticsCollectionEnabled(analyticsInstance, false);
      } catch {
        // Nothing to do — collection was best-effort to begin with.
      }
    }
    return;
  }

  if (!analyticsInstance) {
    if (unsupported) return;
    if (!initializing) {
      initializing = isSupported()
        .then((supported) => {
          if (!supported) {
            unsupported = true;
            return;
          }
          // Re-check: consent may have been withdrawn while we awaited.
          if (isAnalyticsAllowed()) {
            analyticsInstance = getAnalytics(app);
          }
        })
        .catch(() => {
          // Analytics not supported or blocked - fail silently
        })
        .finally(() => {
          initializing = null;
        });
    }
    await initializing;
  }

  if (analyticsInstance && !collecting) {
    collecting = true;
    try {
      setAnalyticsCollectionEnabled(analyticsInstance, true);
    } catch {
      // Best-effort.
    }
  }
}

subscribeAnalyticsConsent(() => {
  void syncAnalyticsWithConsent();
});
void syncAnalyticsWithConsent();

/** Test seam. */
export function _resetAnalyticsForTesting(): void {
  analyticsInstance = null;
  collecting = false;
  initializing = null;
  unsupported = false;
}

// =============================================================================
// SAFE LOGGING
// =============================================================================

/**
 * Safely log an analytics event
 * Silently fails if analytics is blocked, unavailable, or not consented to
 */
function safeLogEvent(eventName: string, eventParams?: Record<string, unknown>): void {
  if (analyticsInstance && collecting) {
    try {
      logEvent(analyticsInstance, eventName, eventParams);
    } catch {
      // Silently ignore analytics errors (e.g., ad blockers)
    }
  }
}

// =============================================================================
// ANALYTICS API
// =============================================================================

export const analytics = {
  /**
   * Log a page view event
   */
  logPageView: (pageName: string) => {
    safeLogEvent('page_view', { page_name: pageName });
  },

  /**
   * Log a button click event
   */
  logButtonClick: (buttonName: string) => {
    safeLogEvent('button_click', { button_name: buttonName });
  },

  /**
   * Log corps creation
   */
  logCorpsCreated: (corpsClass: string) => {
    safeLogEvent('corps_created', { corps_class: corpsClass });
  },

  /**
   * Log league joined
   */
  logLeagueJoined: (leagueId: string) => {
    safeLogEvent('league_joined', { league_id: leagueId });
  },

  /**
   * Log caption selected
   */
  logCaptionSelected: (caption: string, corps: string) => {
    safeLogEvent('caption_selected', { caption, corps });
  },

  /**
   * Log user login
   */
  logLogin: (method: 'email' | 'anonymous' | 'custom_token' | 'google') => {
    safeLogEvent('login', { method });
  },

  /**
   * Log user sign up
   */
  logSignUp: (method: 'email' | 'anonymous' | 'google') => {
    safeLogEvent('sign_up', { method });
  },

  /**
   * Log user logout
   */
  logLogout: () => {
    safeLogEvent('logout');
  },

  /**
   * Log a custom event
   */
  logEvent: safeLogEvent,

  // ==========================================================================
  // A/B TESTING ANALYTICS
  // ==========================================================================

  /**
   * Log experiment exposure (user saw a variant)
   */
  logExperimentExposure: (
    experimentId: string,
    variantId: string,
    experimentName?: string,
    variantName?: string
  ) => {
    safeLogEvent('experiment_exposure', {
      experiment_id: experimentId,
      experiment_name: experimentName || experimentId,
      variant_id: variantId,
      variant_name: variantName || variantId,
    });
  },

  /**
   * Log experiment conversion (user completed desired action)
   */
  logExperimentConversion: (
    experimentId: string,
    variantId: string,
    conversionType: string,
    metadata?: Record<string, unknown>
  ) => {
    safeLogEvent('experiment_conversion', {
      experiment_id: experimentId,
      variant_id: variantId,
      conversion_type: conversionType,
      ...metadata,
    });
  },
};

export default analytics;
