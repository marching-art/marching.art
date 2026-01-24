// =============================================================================
// ANALYTICS UTILITIES
// =============================================================================
// Safe analytics logging that gracefully handles ad blockers
// Usage: import { analytics } from '@/api/analytics';

import { getAnalytics, logEvent, isSupported, Analytics } from 'firebase/analytics';
import { app } from './client';

// =============================================================================
// ANALYTICS INITIALIZATION
// =============================================================================

let analyticsInstance: Analytics | null = null;

// Initialize analytics only if supported (handles ad blockers gracefully)
isSupported()
  .then((supported) => {
    if (supported) {
      analyticsInstance = getAnalytics(app);
    }
  })
  .catch(() => {
    // Analytics not supported or blocked - fail silently
  });

// =============================================================================
// SAFE LOGGING
// =============================================================================

/**
 * Safely log an analytics event
 * Silently fails if analytics is blocked or unavailable
 */
function safeLogEvent(eventName: string, eventParams?: Record<string, unknown>): void {
  if (analyticsInstance) {
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
  logExperimentExposure: (experimentId: string, variantId: string, experimentName?: string, variantName?: string) => {
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
  logExperimentConversion: (experimentId: string, variantId: string, conversionType: string, metadata?: Record<string, unknown>) => {
    safeLogEvent('experiment_conversion', {
      experiment_id: experimentId,
      variant_id: variantId,
      conversion_type: conversionType,
      ...metadata,
    });
  },
};

export default analytics;
