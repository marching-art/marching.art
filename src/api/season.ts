// Season API - Season data and schedule operations
// Handles season state, schedules, and fantasy recaps

import {
  doc,
  getDoc,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db, paths, withErrorHandling } from './client';
import type { SeasonData, Show, ShowResult, CorpsClass } from '../types';

// =============================================================================
// SEASON DATA
// =============================================================================

/**
 * Get current season data
 */
export async function getSeasonData(): Promise<SeasonData | null> {
  return withErrorHandling(async () => {
    const seasonRef = doc(db, paths.season());
    const seasonDoc = await getDoc(seasonRef);

    if (!seasonDoc.exists()) {
      return null;
    }

    return seasonDoc.data() as SeasonData;
  }, 'Failed to fetch season data');
}

/**
 * Subscribe to real-time season updates
 */
export function subscribeToSeason(
  onData: (season: SeasonData | null) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const seasonRef = doc(db, paths.season());

  return onSnapshot(
    seasonRef,
    (doc) => {
      if (doc.exists()) {
        onData(doc.data() as SeasonData);
      } else {
        onData(null);
      }
    },
    (error) => {
      console.error('Season subscription error:', error);
      onError?.(error);
    }
  );
}

// =============================================================================
// FANTASY RECAPS
// =============================================================================

export interface DayRecap {
  offSeasonDay: number;
  date: Date;
  shows: ShowWithResults[];
}

export interface ShowWithResults {
  eventName: string;
  location: string;
  results: ShowResult[];
}

/**
 * Get fantasy recaps for a season
 */
export async function getFantasyRecaps(seasonUid: string): Promise<DayRecap[]> {
  return withErrorHandling(async () => {
    const recapsRef = doc(db, paths.fantasyRecaps(seasonUid));
    const recapsDoc = await getDoc(recapsRef);

    if (!recapsDoc.exists()) {
      return [];
    }

    const data = recapsDoc.data();
    return (data.recaps || []) as DayRecap[];
  }, 'Failed to fetch fantasy recaps');
}

/**
 * Get shows grouped by day for a season
 */
export async function getShowsByDay(seasonUid: string): Promise<Map<number, Show[]>> {
  const recaps = await getFantasyRecaps(seasonUid);
  const showsByDay = new Map<number, Show[]>();

  for (const recap of recaps) {
    const day = recap.offSeasonDay;
    const shows: Show[] = (recap.shows || []).map((show, index) => ({
      showId: `${day}-${index}`,
      eventName: show.eventName,
      location: show.location,
      date: recap.date as unknown as import('firebase/firestore').Timestamp,
      offSeasonDay: day,
      classes: [] as CorpsClass[],
      results: show.results,
    }));

    showsByDay.set(day, shows);
  }

  return showsByDay;
}

/**
 * Get all shows as a flat list, sorted by day (most recent first)
 */
export async function getAllShows(seasonUid: string): Promise<Show[]> {
  const showsByDay = await getShowsByDay(seasonUid);
  const allShows: Show[] = [];

  for (const shows of showsByDay.values()) {
    allShows.push(...shows);
  }

  return allShows.sort((a, b) => b.offSeasonDay - a.offSeasonDay);
}

// =============================================================================
// SEASON CALCULATIONS
// =============================================================================

/**
 * Calculate current week and day in the season
 */
export function calculateSeasonProgress(season: SeasonData): {
  currentWeek: number;
  currentDay: number;
  weeksRemaining: number;
  daysRemaining: number;
  progress: number;
} {
  const startDate = season.schedule.startDate.toDate();
  const endDate = season.schedule.endDate.toDate();
  const now = new Date();

  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const elapsedDays = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
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
 * Check if registration is still open
 */
export function isRegistrationOpen(season: SeasonData): boolean {
  if (!season.registrationDeadline) {
    return season.registrationOpen;
  }

  const deadline = season.registrationDeadline.toDate();
  return season.registrationOpen && new Date() < deadline;
}

/**
 * Get season type display info
 */
export function getSeasonTypeInfo(season: SeasonData): {
  label: string;
  description: string;
  color: string;
} {
  if (season.seasonType === 'live') {
    return {
      label: 'Live Season',
      description: 'The main competitive season',
      color: 'gold',
    };
  }

  return {
    label: `Off-Season ${season.seasonNumber}`,
    description: 'Practice and preparation period',
    color: 'blue',
  };
}

/**
 * Format season display name from SeasonData object
 * Use utils/season.ts formatSeasonName for simple string formatting
 */
export function formatSeasonDisplayName(season: SeasonData): string {
  if (season.seasonType === 'live') {
    return `${season.year} Live Season`;
  }
  return `${season.year} Off-Season ${season.seasonNumber}`;
}

// =============================================================================
// GAME DAY UTILITIES
// =============================================================================

/**
 * Get the current game day (1-indexed)
 * This accounts for the season schedule and returns the day number
 */
export function getGameDay(season: SeasonData): number {
  const startDate = season.schedule.startDate.toDate();
  const now = new Date();

  const elapsedMs = now.getTime() - startDate.getTime();
  const elapsedDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));

  return Math.max(1, elapsedDays + 1);
}

/**
 * Get the date string for a game day (YYYY-MM-DD format)
 */
export function getGameDayDate(season: SeasonData, day: number): string {
  const startDate = season.schedule.startDate.toDate();
  const targetDate = new Date(startDate);
  targetDate.setDate(targetDate.getDate() + day - 1);

  return targetDate.toISOString().split('T')[0];
}
