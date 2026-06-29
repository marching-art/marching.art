// Season utility functions
// Consolidated from multiple locations to prevent duplication

// =============================================================================
// STRING FORMATTING
// =============================================================================

/**
 * Format a season name string for display
 * Replaces underscores with spaces and capitalizes words
 * @param name - Raw season name (e.g., 'off_season_2024')
 * @returns Formatted name (e.g., 'Off Season 2024')
 */
export function formatSeasonName(name: string | null | undefined): string {
  if (!name) return 'New Season';
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Format an event name for display
 * Replaces 'DCI' with 'marching.art' for branding consistency
 * @param name - Raw event name (e.g., 'DCI Indianapolis')
 * @returns Formatted name (e.g., 'marching.art Indianapolis')
 */
export function formatEventName(name: string | null | undefined): string {
  if (!name) return '';
  return name.replace(/\bDCI\b/g, 'marching.art');
}
