// Season utility functions
// Consolidated from multiple locations to prevent duplication

import type { SeasonData } from '../types';

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

// =============================================================================
// WEEK CALCULATIONS
// =============================================================================

/**
 * Get the current week number for a season
 * @param season - Season data object with schedule information
 * @returns Current week number (1-indexed)
 */
export function getCurrentWeek(season: SeasonData): number {
  const startDate = season.schedule.startDate.toDate();
  const now = new Date();

  const elapsedMs = now.getTime() - startDate.getTime();
  const elapsedDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));

  return Math.max(1, Math.ceil((elapsedDays + 1) / 7));
}

/**
 * Calculate detailed season progress
 * @param season - Season data object
 * @returns Object with week, day, and remaining time information
 */
export function getSeasonProgress(season: SeasonData): {
  currentWeek: number;
  currentDay: number;
  weeksRemaining: number;
  daysRemaining: number;
  progress: number;
} {
  const startDate = season.schedule.startDate.toDate();
  const endDate = season.schedule.endDate.toDate();
  const now = new Date();

  const totalDays = Math.ceil(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  const elapsedDays = Math.ceil(
    (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  const daysRemaining = Math.max(0, totalDays - elapsedDays);

  const currentDay = Math.max(1, Math.min(elapsedDays, totalDays));
  const currentWeek = Math.ceil(currentDay / 7);
  const weeksRemaining = Math.ceil(daysRemaining / 7);
  const progress = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));

  return {
    currentWeek,
    currentDay,
    weeksRemaining,
    daysRemaining,
    progress,
  };
}

/**
 * Get the current game day (1-indexed)
 * This accounts for the season schedule and returns the day number
 * @param season - Season data object
 * @returns Current game day number
 */
export function getGameDay(season: SeasonData): number {
  const startDate = season.schedule.startDate.toDate();
  const now = new Date();

  const elapsedMs = now.getTime() - startDate.getTime();
  const elapsedDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));

  return Math.max(1, elapsedDays + 1);
}
