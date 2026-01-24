/**
 * A/B Testing Framework - Experiment Configuration and Variant Assignment
 *
 * This framework enables controlled experiments to optimize user experience.
 * Features:
 * - Consistent variant assignment (same user always sees same variant)
 * - Firebase Analytics integration for tracking
 * - Support for multiple simultaneous experiments
 * - Easy experiment definition and management
 *
 * Usage:
 *   import { useExperiment } from '../hooks/useExperiment';
 *   const { variant, isControl } = useExperiment('hero_cta_text');
 */

// =============================================================================
// EXPERIMENT DEFINITIONS
// =============================================================================

/**
 * Active experiments configuration
 *
 * Each experiment has:
 * - id: Unique identifier (used in analytics and storage)
 * - name: Human-readable name for dashboards
 * - description: What we're testing and why
 * - variants: Array of variant objects with id, name, and weight
 * - enabled: Whether the experiment is active
 * - startDate: When the experiment began (for reference)
 * - targetAudience: Who sees this experiment ('all', 'new_users', 'returning_users')
 */
export const EXPERIMENTS = {
  // ==========================================================================
  // HERO CTA EXPERIMENT
  // Test different call-to-action text on the hero banner
  // ==========================================================================
  hero_cta_text: {
    id: 'hero_cta_text',
    name: 'Hero CTA Text',
    description: 'Testing different CTA button text on hero banner for signup conversion',
    enabled: true,
    startDate: '2025-01-24',
    targetAudience: 'new_users',
    variants: [
      { id: 'control', name: 'Control', weight: 50, value: 'Create Your Corps' },
      { id: 'variant_a', name: 'Action-focused', weight: 50, value: 'Start Playing Free' },
    ],
  },

  // ==========================================================================
  // REGISTRATION FORM EXPERIMENT
  // Test simplified vs full registration form
  // ==========================================================================
  registration_form: {
    id: 'registration_form',
    name: 'Registration Form Layout',
    description: 'Testing simplified form vs standard form for registration completion',
    enabled: true,
    startDate: '2025-01-24',
    targetAudience: 'new_users',
    variants: [
      { id: 'control', name: 'Standard Form', weight: 50, value: 'standard' },
      { id: 'variant_a', name: 'Simplified Form', weight: 50, value: 'simplified' },
    ],
  },

  // ==========================================================================
  // SOCIAL PROOF PLACEMENT EXPERIMENT
  // Test social proof bar position on landing page
  // ==========================================================================
  social_proof_placement: {
    id: 'social_proof_placement',
    name: 'Social Proof Placement',
    description: 'Testing social proof bar above vs below hero for engagement',
    enabled: true,
    startDate: '2025-01-24',
    targetAudience: 'all',
    variants: [
      { id: 'control', name: 'Below Hero', weight: 50, value: 'below' },
      { id: 'variant_a', name: 'Above Hero', weight: 50, value: 'above' },
    ],
  },

  // ==========================================================================
  // URGENCY DISPLAY EXPERIMENT
  // Test urgency banner visibility
  // ==========================================================================
  urgency_display: {
    id: 'urgency_display',
    name: 'Urgency Banner Display',
    description: 'Testing urgency banner prominence for conversion',
    enabled: true,
    startDate: '2025-01-24',
    targetAudience: 'new_users',
    variants: [
      { id: 'control', name: 'Standard', weight: 50, value: 'standard' },
      { id: 'variant_a', name: 'Prominent', weight: 50, value: 'prominent' },
    ],
  },

  // ==========================================================================
  // DEMO PREVIEW CTA EXPERIMENT
  // Test "Try Demo" button prominence
  // ==========================================================================
  demo_cta_style: {
    id: 'demo_cta_style',
    name: 'Demo CTA Style',
    description: 'Testing demo preview button style for demo engagement',
    enabled: true,
    startDate: '2025-01-24',
    targetAudience: 'new_users',
    variants: [
      { id: 'control', name: 'Secondary Button', weight: 50, value: 'secondary' },
      { id: 'variant_a', name: 'Primary Button', weight: 50, value: 'primary' },
    ],
  },
};

// =============================================================================
// STORAGE KEYS
// =============================================================================

const STORAGE_KEYS = {
  USER_ID: 'marching_art_experiment_uid',
  ASSIGNMENTS: 'marching_art_experiment_assignments',
  EXPOSURES: 'marching_art_experiment_exposures',
};

// =============================================================================
// HASH FUNCTION FOR DETERMINISTIC ASSIGNMENT
// =============================================================================

/**
 * Simple hash function for consistent variant assignment
 * Uses FNV-1a hash algorithm for good distribution
 */
function hashString(str) {
  let hash = 2166136261; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 16777619) >>> 0; // FNV prime, keep as 32-bit
  }
  return hash;
}

/**
 * Get or create a persistent anonymous user ID for experiment assignment
 * This ensures the same user always gets the same variants
 */
export function getExperimentUserId() {
  try {
    let userId = localStorage.getItem(STORAGE_KEYS.USER_ID);
    if (!userId) {
      // Generate a random ID
      userId = `exp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      localStorage.setItem(STORAGE_KEYS.USER_ID, userId);
    }
    return userId;
  } catch {
    // localStorage not available, use session-based ID
    return `session_${Math.random().toString(36).substring(2, 11)}`;
  }
}

// =============================================================================
// VARIANT ASSIGNMENT
// =============================================================================

/**
 * Get stored experiment assignments
 */
function getStoredAssignments() {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.ASSIGNMENTS);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

/**
 * Store experiment assignments
 */
function storeAssignments(assignments) {
  try {
    localStorage.setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(assignments));
  } catch {
    // localStorage not available
  }
}

/**
 * Assign a user to a variant based on experiment weights
 * Uses deterministic hashing for consistent assignment
 */
export function assignVariant(experimentId, userId) {
  const experiment = EXPERIMENTS[experimentId];
  if (!experiment || !experiment.enabled) {
    return null;
  }

  // Check for existing assignment
  const assignments = getStoredAssignments();
  if (assignments[experimentId]) {
    // Verify the stored variant still exists in the experiment
    const storedVariant = experiment.variants.find(
      (v) => v.id === assignments[experimentId]
    );
    if (storedVariant) {
      return storedVariant;
    }
  }

  // Calculate new assignment using hash
  const hashInput = `${experimentId}:${userId}`;
  const hash = hashString(hashInput);
  const bucket = hash % 100; // 0-99

  // Assign based on cumulative weights
  let cumulative = 0;
  let assignedVariant = experiment.variants[0]; // Default to first

  for (const variant of experiment.variants) {
    cumulative += variant.weight;
    if (bucket < cumulative) {
      assignedVariant = variant;
      break;
    }
  }

  // Store assignment
  assignments[experimentId] = assignedVariant.id;
  storeAssignments(assignments);

  return assignedVariant;
}

// =============================================================================
// EXPOSURE TRACKING
// =============================================================================

/**
 * Get tracked exposures (to avoid duplicate tracking)
 */
function getTrackedExposures() {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.EXPOSURES);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

/**
 * Mark an experiment as exposed (user has seen it)
 */
function markExposure(experimentId, variantId) {
  try {
    const exposures = getTrackedExposures();
    const key = `${experimentId}:${variantId}`;
    if (!exposures[key]) {
      exposures[key] = Date.now();
      localStorage.setItem(STORAGE_KEYS.EXPOSURES, JSON.stringify(exposures));
      return true; // First exposure
    }
    return false; // Already exposed
  } catch {
    return false;
  }
}

/**
 * Check if user has been exposed to this experiment variant
 */
export function hasBeenExposed(experimentId, variantId) {
  const exposures = getTrackedExposures();
  return !!exposures[`${experimentId}:${variantId}`];
}

/**
 * Track experiment exposure (should be called when variant is rendered)
 * Only tracks first exposure per experiment/variant combination
 */
export function trackExposure(experimentId, variantId, analytics) {
  const isFirstExposure = markExposure(experimentId, variantId);

  if (isFirstExposure && analytics) {
    const experiment = EXPERIMENTS[experimentId];
    analytics.logEvent('experiment_exposure', {
      experiment_id: experimentId,
      experiment_name: experiment?.name || experimentId,
      variant_id: variantId,
      variant_name: experiment?.variants.find((v) => v.id === variantId)?.name || variantId,
    });
  }

  return isFirstExposure;
}

// =============================================================================
// CONVERSION TRACKING
// =============================================================================

/**
 * Track a conversion event for an experiment
 * Call this when the user completes a desired action
 */
export function trackConversion(experimentId, conversionType, analytics, metadata = {}) {
  const assignments = getStoredAssignments();
  const variantId = assignments[experimentId];

  if (!variantId) return; // User not in experiment

  const experiment = EXPERIMENTS[experimentId];

  if (analytics) {
    analytics.logEvent('experiment_conversion', {
      experiment_id: experimentId,
      experiment_name: experiment?.name || experimentId,
      variant_id: variantId,
      variant_name: experiment?.variants.find((v) => v.id === variantId)?.name || variantId,
      conversion_type: conversionType,
      ...metadata,
    });
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get all active experiments
 */
export function getActiveExperiments() {
  return Object.values(EXPERIMENTS).filter((exp) => exp.enabled);
}

/**
 * Get current assignments for debugging/admin
 */
export function getCurrentAssignments() {
  const assignments = getStoredAssignments();
  return Object.entries(assignments).map(([experimentId, variantId]) => {
    const experiment = EXPERIMENTS[experimentId];
    const variant = experiment?.variants.find((v) => v.id === variantId);
    return {
      experimentId,
      experimentName: experiment?.name || experimentId,
      variantId,
      variantName: variant?.name || variantId,
      variantValue: variant?.value,
    };
  });
}

/**
 * Reset all experiment assignments (for testing)
 */
export function resetExperiments() {
  try {
    localStorage.removeItem(STORAGE_KEYS.ASSIGNMENTS);
    localStorage.removeItem(STORAGE_KEYS.EXPOSURES);
  } catch {
    // localStorage not available
  }
}

/**
 * Force a specific variant for testing
 */
export function forceVariant(experimentId, variantId) {
  const experiment = EXPERIMENTS[experimentId];
  if (!experiment) return false;

  const variant = experiment.variants.find((v) => v.id === variantId);
  if (!variant) return false;

  const assignments = getStoredAssignments();
  assignments[experimentId] = variantId;
  storeAssignments(assignments);

  return true;
}

export default EXPERIMENTS;
