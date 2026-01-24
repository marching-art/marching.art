/**
 * ABTest Component - Declarative A/B Testing Wrapper
 *
 * Provides a clean way to render different content based on experiment variants.
 *
 * Usage:
 *   <ABTest experimentId="hero_cta_text">
 *     <ABTest.Control>
 *       <button>Create Your Corps</button>
 *     </ABTest.Control>
 *     <ABTest.Variant id="variant_a">
 *       <button>Start Playing Free</button>
 *     </ABTest.Variant>
 *   </ABTest>
 *
 * Or with render props:
 *   <ABTest experimentId="hero_cta_text">
 *     {({ variant, value, isControl }) => (
 *       <button>{value}</button>
 *     )}
 *   </ABTest>
 */

import React, { Children, isValidElement, useMemo } from 'react';
import { useExperiment } from '../hooks/useExperiment';

// =============================================================================
// ABTEST COMPONENT
// =============================================================================

const ABTest = ({ experimentId, children, fallback = null, trackOnMount = true }) => {
  const {
    variant,
    variantId,
    value,
    isControl,
    isLoading,
    trackConversion,
  } = useExperiment(experimentId, { trackOnMount });

  // Handle loading state
  if (isLoading) {
    return fallback;
  }

  // Handle render props pattern
  if (typeof children === 'function') {
    return children({
      variant,
      variantId,
      value,
      isControl,
      trackConversion,
    });
  }

  // Handle component children pattern
  const childArray = Children.toArray(children);

  // Find matching variant child
  for (const child of childArray) {
    if (!isValidElement(child)) continue;

    // Check for Control component
    if (child.type === ABTest.Control && isControl) {
      return child.props.children;
    }

    // Check for Variant component with matching ID
    if (child.type === ABTest.Variant && child.props.id === variantId) {
      return child.props.children;
    }
  }

  // Fallback to control if no match found
  for (const child of childArray) {
    if (isValidElement(child) && child.type === ABTest.Control) {
      return child.props.children;
    }
  }

  // No matching content
  return fallback;
};

// =============================================================================
// CONTROL COMPONENT
// =============================================================================

/**
 * Renders content for the control variant
 */
ABTest.Control = ({ children }) => {
  // This component is just a marker - actual rendering happens in ABTest
  return children;
};

ABTest.Control.displayName = 'ABTest.Control';

// =============================================================================
// VARIANT COMPONENT
// =============================================================================

/**
 * Renders content for a specific variant
 * @param {string} id - Variant ID to match (e.g., 'variant_a')
 */
ABTest.Variant = ({ id, children }) => {
  // This component is just a marker - actual rendering happens in ABTest
  return children;
};

ABTest.Variant.displayName = 'ABTest.Variant';

// =============================================================================
// EXPERIMENT VALUE COMPONENT
// =============================================================================

/**
 * Simple component that just renders the experiment value
 * Useful for text-only experiments
 *
 * Usage:
 *   <ExperimentValue experimentId="hero_cta_text" />
 */
export const ExperimentValue = ({ experimentId, fallback = '' }) => {
  const { value, isLoading } = useExperiment(experimentId);

  if (isLoading) return fallback;
  return value || fallback;
};

// =============================================================================
// EXPERIMENT WRAPPER HOC
// =============================================================================

/**
 * Higher-order component for class components or external components
 *
 * Usage:
 *   const EnhancedButton = withExperiment('hero_cta_text')(Button);
 */
export function withExperiment(experimentId) {
  return function wrapComponent(WrappedComponent) {
    return function ExperimentWrapper(props) {
      const experimentState = useExperiment(experimentId);

      return (
        <WrappedComponent
          {...props}
          experiment={experimentState}
        />
      );
    };
  };
}

// =============================================================================
// EXPERIMENT DEBUG PANEL (for development)
// =============================================================================

/**
 * Debug panel showing all active experiments and assignments
 * Only render in development
 */
export const ExperimentDebugPanel = () => {
  const {
    getCurrentAssignments,
    getActiveExperiments,
    resetExperiments,
    forceVariant,
    EXPERIMENTS,
  } = require('../lib/experiments');

  const assignments = useMemo(() => getCurrentAssignments(), []);
  const activeExperiments = useMemo(() => getActiveExperiments(), []);

  const handleReset = () => {
    resetExperiments();
    window.location.reload();
  };

  const handleForceVariant = (experimentId, variantId) => {
    forceVariant(experimentId, variantId);
    window.location.reload();
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-[#1a1a1a] border border-[#333] rounded-sm p-4 max-w-md shadow-xl">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-white">A/B Test Debug</h3>
        <button
          onClick={handleReset}
          className="text-xs text-red-400 hover:text-red-300"
        >
          Reset All
        </button>
      </div>

      <div className="space-y-3 max-h-64 overflow-y-auto">
        {activeExperiments.map((exp) => {
          const assignment = assignments.find((a) => a.experimentId === exp.id);

          return (
            <div key={exp.id} className="p-2 bg-[#111] rounded-sm">
              <div className="text-xs font-medium text-white mb-1">{exp.name}</div>
              <div className="text-[10px] text-gray-500 mb-2">{exp.description}</div>

              <div className="flex flex-wrap gap-1">
                {exp.variants.map((variant) => (
                  <button
                    key={variant.id}
                    onClick={() => handleForceVariant(exp.id, variant.id)}
                    className={`px-2 py-1 text-[10px] rounded-sm transition-colors ${
                      assignment?.variantId === variant.id
                        ? 'bg-[#0057B8] text-white'
                        : 'bg-[#222] text-gray-400 hover:bg-[#333]'
                    }`}
                  >
                    {variant.name}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 pt-3 border-t border-[#333]">
        <div className="text-[10px] text-gray-500">
          Current assignments: {assignments.length} / {activeExperiments.length}
        </div>
      </div>
    </div>
  );
};

export default ABTest;
