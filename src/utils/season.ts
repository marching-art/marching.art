// Season utility functions
// Consolidated from multiple locations to prevent duplication

// =============================================================================
// STRING FORMATTING
// =============================================================================

/**
 * Format a season name string for display
 * Replaces underscores with spaces and capitalizes words.
 *
 * Live seasons are stored with a two-year suffix (e.g. 'live_2026-26') to match
 * the off-season naming scheme, but a live season never spans the new year, so
 * the display collapses it to the single competition year (e.g. 'LIVE 2026').
 * This is a display-only transform; the underlying season name is unchanged.
 *
 * @param name - Raw season name (e.g., 'off_season_2024', 'live_2026-26')
 * @returns Formatted name (e.g., 'Off Season 2024', 'LIVE 2026')
 */
export function formatSeasonName(name: string | null | undefined): string {
  if (!name) return 'New Season';

  const liveMatch = /^live_(\d{4})/i.exec(name);
  if (liveMatch) {
    return `LIVE ${liveMatch[1]}`;
  }

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
