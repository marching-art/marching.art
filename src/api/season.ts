// Season API - Season data and schedule operations
// Handles season state, schedules, and fantasy recaps

import {
  doc,
  getDoc,
  getDocs,
  collection,
  onSnapshot,
  DocumentData,
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
 * Get all daily recap documents for a season.
 *
 * Reads the per-day subcollection first (the current format) and falls back
 * to the legacy single-document `recaps` array when the subcollection is
 * empty. Errors propagate to the caller unchanged (callers own their own
 * try/catch and fallback behavior), so this intentionally does not use
 * withErrorHandling.
 */
export async function getSeasonRecaps(seasonUid: string): Promise<DayRecap[]> {
  const recapsCollectionRef = collection(db, paths.fantasyRecapsDays(seasonUid));
  const recapsSnapshot = await getDocs(recapsCollectionRef);

  if (!recapsSnapshot.empty) {
    return recapsSnapshot.docs.map((d) => d.data() as DayRecap);
  }

  // Fallback to legacy single-document format
  const legacyDocRef = doc(db, paths.fantasyRecaps(seasonUid));
  const legacyDoc = await getDoc(legacyDocRef);
  if (legacyDoc.exists()) {
    return (legacyDoc.data().recaps || []) as DayRecap[];
  }
  return [];
}

// =============================================================================
// REFERENCE GAME DATA (public read)
//
// Corps point values (dci-data) and scraped DCI results (historical_scores)
// are public reference data used across gameplay and the admin panel. These
// readers are the single source for both; errors propagate unchanged.
// =============================================================================

/**
 * Get the corpsValues array from a dci-data season doc.
 * Returns [] if the doc or array does not exist.
 */
export async function getCorpsValues(docId: string): Promise<DocumentData[]> {
  const snap = await getDoc(doc(db, `dci-data/${docId}`));
  return snap.exists() ? snap.data().corpsValues || [] : [];
}

/**
 * Get the full dci-data season doc, or null if it does not exist.
 */
export async function getDciDataDoc(docId: string): Promise<DocumentData | null> {
  const snap = await getDoc(doc(db, `dci-data/${docId}`));
  return snap.exists() ? snap.data() : null;
}

/**
 * Fetch the scraped event array for a single year from historical_scores.
 * Returns [] if the doc or array does not exist.
 */
export async function getHistoricalScoresForYear(year: string | number): Promise<DocumentData[]> {
  const scoresDoc = await getDoc(doc(db, `historical_scores/${year}`));
  return scoresDoc.exists() ? scoresDoc.data().data || [] : [];
}

/**
 * Fetch historical_scores docs for a set of years, keyed by year (doc ID).
 * Years with no doc are omitted from the map; each value is the doc's `data`
 * event array (or [] if missing).
 */
export async function getHistoricalScoresMap(
  years: Array<string | number>
): Promise<Record<string, DocumentData[]>> {
  const historicalDocs = await Promise.all(
    years.map((year) => getDoc(doc(db, `historical_scores/${year}`)))
  );
  const historical: Record<string, DocumentData[]> = {};
  historicalDocs.forEach((docSnap) => {
    if (docSnap.exists()) {
      historical[docSnap.id] = docSnap.data().data || [];
    }
  });
  return historical;
}

/**
 * Get all season champion archive docs as `{ id, ...data }` (raw; callers own
 * date conversion and sorting). Errors propagate unchanged.
 */
export async function getSeasonChampionDocs(): Promise<
  Array<{ id: string } & Record<string, unknown>>
> {
  const snapshot = await getDocs(collection(db, 'season_champions'));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
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

// =============================================================================
// SEASON CHAMPIONS (Hall of Champions)
// =============================================================================

/** A single finalist entry within an archived season's class standings. */
export interface SeasonChampionEntry {
  uid?: string;
  username?: string;
  corpsName?: string;
  score?: number;
  rank?: number;
}

/** An archived season's championship record. */
export interface SeasonChampions {
  id: string;
  seasonName?: string;
  seasonType?: string;
  archivedAt: Date | null;
  classes: Record<string, SeasonChampionEntry[]>;
}

/**
 * Get all archived season championship records, most recently archived first.
 * Errors propagate unchanged to the caller (intentionally not wrapped with
 * withErrorHandling — consumers rely on the original error semantics).
 */
export async function getSeasonChampions(): Promise<SeasonChampions[]> {
  const championsRef = collection(db, 'season_champions');
  const championsSnapshot = await getDocs(championsRef);

  const seasonsData: SeasonChampions[] = [];
  championsSnapshot.forEach((doc) => {
    const data = doc.data();
    seasonsData.push({
      id: doc.id,
      seasonName: data.seasonName,
      seasonType: data.seasonType,
      archivedAt:
        data.archivedAt?.toDate?.() || (data.archivedAt ? new Date(data.archivedAt) : null),
      classes: data.classes || {},
    });
  });

  seasonsData.sort((a, b) => (b.archivedAt?.getTime?.() || 0) - (a.archivedAt?.getTime?.() || 0));

  return seasonsData;
}
