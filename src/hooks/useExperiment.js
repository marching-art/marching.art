/**
 * useExperiment Hook - A/B Testing for React Components
 *
 * Provides easy access to experiment variants in React components.
 * Automatically tracks exposure when the variant is first rendered.
 *
 * Usage:
 *   const { variant, value, isControl, isLoading } = useExperiment('hero_cta_text');
 *
 *   // Use variant value directly
 *   <button>{value}</button>
 *
 *   // Or check variant type
 *   {isControl ? <ControlComponent /> : <VariantComponent />}
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  EXPERIMENTS,
  getExperimentUserId,
  assignVariant,
  trackExposure,
  trackConversion,
  hasBeenExposed,
} from '../lib/experiments';
import { analytics } from '../api/analytics';

// =============================================================================
// USE EXPERIMENT HOOK
// =============================================================================

/**
 * Main hook for accessing experiment variants
 *
 * @param {string} experimentId - The experiment ID from EXPERIMENTS config
 * @param {Object} options - Optional configuration
 * @param {boolean} options.trackOnMount - Whether to track exposure on mount (default: true)
 * @param {string} options.userId - Override the auto-generated user ID
 *
 * @returns {Object} Experiment state and utilities
 */
export function useExperiment(experimentId, options = {}) {
  const { trackOnMount = true, userId: providedUserId } = options;

  const [isLoading, setIsLoading] = useState(true);
  const [variant, setVariant] = useState(null);
  const [hasTrackedExposure, setHasTrackedExposure] = useState(false);

  // Get or generate user ID
  const userId = useMemo(() => {
    return providedUserId || getExperimentUserId();
  }, [providedUserId]);

  // Assign variant on mount
  useEffect(() => {
    const experiment = EXPERIMENTS[experimentId];

    if (!experiment || !experiment.enabled) {
      // Experiment doesn't exist or is disabled - return control
      const controlVariant = experiment?.variants?.[0] || {
        id: 'control',
        name: 'Control',
        value: null,
      };
      setVariant(controlVariant);
      setIsLoading(false);
      return;
    }

    // Assign variant
    const assignedVariant = assignVariant(experimentId, userId);
    setVariant(assignedVariant);
    setIsLoading(false);

    // Track exposure if enabled
    if (trackOnMount && assignedVariant) {
      const isFirst = trackExposure(experimentId, assignedVariant.id, analytics);
      setHasTrackedExposure(isFirst);
    }
  }, [experimentId, userId, trackOnMount]);

  // Manual exposure tracking (if trackOnMount is false)
  const trackExposureManually = useCallback(() => {
    if (variant && !hasBeenExposed(experimentId, variant.id)) {
      const isFirst = trackExposure(experimentId, variant.id, analytics);
      setHasTrackedExposure(isFirst);
      return isFirst;
    }
    return false;
  }, [experimentId, variant]);

  // Conversion tracking helper
  const trackConversionEvent = useCallback(
    (conversionType, metadata = {}) => {
      trackConversion(experimentId, conversionType, analytics, metadata);
    },
    [experimentId]
  );

  // Computed values
  const isControl = variant?.id === 'control';
  const value = variant?.value ?? null;
  const variantId = variant?.id ?? 'control';
  const variantName = variant?.name ?? 'Control';

  return {
    // Core variant data
    variant,
    variantId,
    variantName,
    value,

    // Convenience booleans
    isControl,
    isVariantA: variantId === 'variant_a',
    isVariantB: variantId === 'variant_b',

    // State
    isLoading,
    hasTrackedExposure,

    // Actions
    trackExposure: trackExposureManually,
    trackConversion: trackConversionEvent,

    // Experiment metadata
    experimentId,
    experiment: EXPERIMENTS[experimentId],
  };
}

// =============================================================================
// USE MULTIPLE EXPERIMENTS HOOK
// =============================================================================

/**
 * Hook for accessing multiple experiments at once
 * Useful for pages that need several experiments
 *
 * @param {string[]} experimentIds - Array of experiment IDs
 * @returns {Object} Map of experiment ID to experiment state
 */
export function useExperiments(experimentIds) {
  const [experiments, setExperiments] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  const userId = useMemo(() => getExperimentUserId(), []);

  useEffect(() => {
    const results = {};

    for (const experimentId of experimentIds) {
      const experiment = EXPERIMENTS[experimentId];

      if (!experiment || !experiment.enabled) {
        const controlVariant = experiment?.variants?.[0] || {
          id: 'control',
          name: 'Control',
          value: null,
        };
        results[experimentId] = {
          variant: controlVariant,
          variantId: controlVariant.id,
          value: controlVariant.value,
          isControl: true,
        };
      } else {
        const assignedVariant = assignVariant(experimentId, userId);
        results[experimentId] = {
          variant: assignedVariant,
          variantId: assignedVariant?.id,
          value: assignedVariant?.value,
          isControl: assignedVariant?.id === 'control',
        };

        // Track exposure
        if (assignedVariant) {
          trackExposure(experimentId, assignedVariant.id, analytics);
        }
      }
    }

    setExperiments(results);
    setIsLoading(false);
  }, [experimentIds, userId]);

  return {
    experiments,
    isLoading,
    // Helper to get a specific experiment's value
    getValue: (experimentId) => experiments[experimentId]?.value ?? null,
    getVariant: (experimentId) => experiments[experimentId]?.variant ?? null,
    isControl: (experimentId) => experiments[experimentId]?.isControl ?? true,
  };
}

// =============================================================================
// EXPERIMENT CONTEXT (for app-wide access)
// =============================================================================

import { createContext, useContext } from 'react';

const ExperimentContext = createContext(null);

/**
 * Provider for experiment context
 * Wrap your app with this to enable useExperimentContext
 */
export function ExperimentProvider({ children }) {
  const userId = useMemo(() => getExperimentUserId(), []);

  const value = useMemo(
    () => ({
      userId,
      getVariant: (experimentId) => assignVariant(experimentId, userId),
      trackConversion: (experimentId, conversionType, metadata) =>
        trackConversion(experimentId, conversionType, analytics, metadata),
    }),
    [userId]
  );

  return (
    <ExperimentContext.Provider value={value}>
      {children}
    </ExperimentContext.Provider>
  );
}

/**
 * Use experiment context for lower-level access
 */
export function useExperimentContext() {
  return useContext(ExperimentContext);
}

export default useExperiment;
