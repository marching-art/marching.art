// Season API - Season data and schedule operations
// Handles season state, schedules, and fantasy recaps

import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  DocumentData,
  Unsubscribe,
} from 'firebase/firestore';
import { db, paths, withErrorHandling } from './client';
import type { SeasonData, Show, CorpsClass, DayRecap, ShowWithResults } from '../types';

// =============================================================================
// SEASON DATA
// =============================================================================

/**
 * Tonight's score-drop plan (drop_plans/{showDateKey}), written nightly by the
 * backend drop dispatcher from ~8 PM ET. Carries the exact instant fantasy
 * scores publish (`dropInstant`) — variable in live season by the night's
 * westernmost show. Null when no plan exists yet (earlier in the day, or the
 * dispatcher isn't deployed); callers fall back to seasonClock's estimate.
 */
export async function getDropPlan(showDateKey: string): Promise<DocumentData | null> {
  return withErrorHandling(async () => {
    const snap = await getDoc(doc(db, `drop_plans/${showDateKey}`));
    return snap.exists() ? snap.data() : null;
  }, 'getDropPlan');
}

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

// Canonical recap types now live in src/types/recap.ts (single source of
// truth shared with the score-pipeline hooks); re-exported here so existing
// imports from the api layer keep working.
export type { DayRecap, ShowWithResults, RecapResult } from '../types/recap';

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
  return getLegacySeasonRecaps(seasonUid);
}

/** Read the legacy single-document `recaps` array (pre-subcollection format). */
async function getLegacySeasonRecaps(seasonUid: string): Promise<DayRecap[]> {
  const legacyDocRef = doc(db, paths.fantasyRecaps(seasonUid));
  const legacyDoc = await getDoc(legacyDocRef);
  if (legacyDoc.exists()) {
    return (legacyDoc.data().recaps || []) as DayRecap[];
  }
  return [];
}

/**
 * Number of most-recent recap days fetched by bounded consumers (the
 * always-mounted ticker and the Dashboard recent-results box). Shared so both
 * hooks read through a single react-query cache entry. Large enough for
 * trend/mover windows (a corps typically performs every 2-3 days), small
 * enough that the 5-minute stale refetch no longer re-downloads the whole
 * season on every authenticated page.
 */
export const RECENT_RECAP_DAYS = 10;

/**
 * Get the most recent `days` daily recap documents for a season, ascending by
 * day. Uses an orderBy(offSeasonDay desc) + limit query so only the tail of
 * the season is downloaded (single-field orderBy — no composite index
 * needed). Falls back to the legacy single-document format (sliced to the
 * same window) when the per-day subcollection is empty. Errors propagate to
 * the caller unchanged, mirroring getSeasonRecaps.
 */
export async function getRecentSeasonRecaps(seasonUid: string, days: number): Promise<DayRecap[]> {
  const recapsCollectionRef = collection(db, paths.fantasyRecapsDays(seasonUid));
  const recentQuery = query(recapsCollectionRef, orderBy('offSeasonDay', 'desc'), limit(days));
  const recapsSnapshot = await getDocs(recentQuery);

  if (!recapsSnapshot.empty) {
    return recapsSnapshot.docs
      .map((d) => d.data() as DayRecap)
      .sort((a, b) => a.offSeasonDay - b.offSeasonDay);
  }

  // Fallback to legacy single-document format: keep the most recent `days`
  const legacyRecaps = await getLegacySeasonRecaps(seasonUid);
  return legacyRecaps.sort((a, b) => a.offSeasonDay - b.offSeasonDay).slice(-days);
}

// =============================================================================
// PODIUM CLASS RECAPS
//
// Podium scores are computed by a separate nightly pipeline and stored in the
// `podium-recaps` collection, NOT in fantasy_recaps. Each day doc is keyed by
// competition day and carries `shows: [{ eventName, location, results }]`,
// where each result is per-show ranked (result.place) with a full caption
// breakdown. Public read, backend-written (see firestore.rules).
// =============================================================================

export interface PodiumDayRecap {
  competitionDay: number;
  calendarDay?: number;
  shows: ShowWithResults[];
}

/**
 * Get all daily Podium recap documents for a season. Returns [] when the
 * season has no Podium results yet. Errors propagate to the caller unchanged
 * (callers own their own fallback), mirroring getSeasonRecaps.
 */
export async function getPodiumSeasonRecaps(seasonUid: string): Promise<PodiumDayRecap[]> {
  const daysRef = collection(db, paths.podiumRecapsDays(seasonUid));
  const snapshot = await getDocs(daysRef);
  return snapshot.docs.map((d) => d.data() as PodiumDayRecap);
}

/**
 * Get the most recent `days` Podium recap documents, descending by day. The
 * bounded counterpart of getPodiumSeasonRecaps (mirroring
 * getRecentSeasonRecaps for fantasy): the Dashboard recent-results box only
 * needs the tail of the season, not every day doc. Single-field orderBy — no
 * composite index needed.
 */
export async function getRecentPodiumRecaps(
  seasonUid: string,
  days: number
): Promise<PodiumDayRecap[]> {
  const daysRef = collection(db, paths.podiumRecapsDays(seasonUid));
  const recentQuery = query(daysRef, orderBy('competitionDay', 'desc'), limit(days));
  const snapshot = await getDocs(recentQuery);
  return snapshot.docs.map((d) => d.data() as PodiumDayRecap);
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
// NOTE: day/week math lives in utils/seasonProgress.getSeasonProgress — the
// one client mirror of the backend gameDay.js authority (2 AM ET reset,
// UTC-normalized start). The naive (now - startDate)/24h helpers that used
// to live here rolled the day over at midnight UTC (8 PM ET in summer) and
// were removed so nothing can drift from the scorer's clock again.

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
