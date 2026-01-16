// Leaderboard API - Rankings and stats operations
// Handles overall, weekly, monthly, and lifetime leaderboards

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  startAfter,
  where,
  getCountFromServer,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { db, paths, withErrorHandling, DATA_NAMESPACE } from './client';
import type {
  LeaderboardEntry,
  LeaderboardType,
  CorpsClass,
  PaginatedResponse,
  LifetimeStats,
} from '../types';

// =============================================================================
// LEADERBOARD QUERIES
// =============================================================================

const DEFAULT_PAGE_SIZE = 25;

/**
 * Get leaderboard entries with pagination
 */
export async function getLeaderboard(
  type: LeaderboardType,
  corpsClass: CorpsClass,
  pageSize = DEFAULT_PAGE_SIZE,
  lastDoc?: unknown
): Promise<PaginatedResponse<LeaderboardEntry>> {
  return withErrorHandling(async () => {
    // Handle lifetime separately (different structure)
    if (type === 'lifetime') {
      return getLifetimeLeaderboard('totalPoints', pageSize);
    }

    const leaderboardRef = collection(db, 'artifacts', DATA_NAMESPACE, 'leaderboard', type, corpsClass);

    let q = query(
      leaderboardRef,
      orderBy('score', 'desc'),
      limit(pageSize)
    );

    // Cast lastDoc to the expected type for pagination
    const lastDocSnapshot = lastDoc as QueryDocumentSnapshot<DocumentData> | undefined;
    if (lastDocSnapshot) {
      q = query(
        leaderboardRef,
        orderBy('score', 'desc'),
        startAfter(lastDocSnapshot),
        limit(pageSize)
      );
    }

    const snapshot = await getDocs(q);

    // Calculate starting rank based on pagination
    const startRank = lastDoc ? (snapshot.docs.length > 0 ? 1 : 0) : 1;

    const entries: LeaderboardEntry[] = snapshot.docs.map((doc, index) => ({
      id: doc.id,
      rank: startRank + index,
      uid: doc.data().uid || doc.id,
      username: doc.data().username || 'Unknown',
      userTitle: doc.data().userTitle,
      corpsName: doc.data().corpsName,
      corpsClass: doc.data().corpsClass,
      score: doc.data().score || 0,
      trophies: doc.data().trophies || 0,
    }));

    const lastVisible = snapshot.docs[snapshot.docs.length - 1];

    return {
      data: entries,
      hasMore: snapshot.docs.length === pageSize,
      lastDoc: lastVisible,
    };
  }, `Failed to fetch ${type} leaderboard`);
}

/**
 * Get lifetime leaderboard (different structure - single document)
 */
export async function getLifetimeLeaderboard(
  sortBy: keyof LifetimeStats = 'totalPoints',
  pageSize = DEFAULT_PAGE_SIZE
): Promise<PaginatedResponse<LeaderboardEntry>> {
  return withErrorHandling(async () => {
    const lifetimeRef = doc(db, paths.lifetimeLeaderboard(sortBy));
    const lifetimeDoc = await getDoc(lifetimeRef);

    if (!lifetimeDoc.exists()) {
      return { data: [], hasMore: false };
    }

    const data = lifetimeDoc.data();
    const entries = (data.entries || []) as Array<{
      userId: string;
      username: string;
      userTitle?: string;
      lifetimeStats: LifetimeStats;
    }>;

    // Convert to LeaderboardEntry format
    const leaderboardEntries: LeaderboardEntry[] = entries
      .slice(0, pageSize)
      .map((entry, index) => ({
        id: entry.userId,
        rank: index + 1,
        uid: entry.userId,
        username: entry.username,
        userTitle: entry.userTitle,
        score: entry.lifetimeStats[sortBy] || 0,
        lifetimeStats: entry.lifetimeStats,
      }));

    return {
      data: leaderboardEntries,
      hasMore: entries.length > pageSize,
      total: entries.length,
    };
  }, 'Failed to fetch lifetime leaderboard');
}

// =============================================================================
// USER RANKING
// =============================================================================

/**
 * Get a specific user's rank in a leaderboard
 * OPTIMIZATION #3: Uses targeted query + count instead of fetching 100 entries
 * Before: 100 document reads to find one user's rank
 * After: 1 query for user entry + 1 aggregation count = ~2 operations
 */
export async function getUserRank(
  type: LeaderboardType,
  corpsClass: CorpsClass,
  username: string
): Promise<number | null> {
  return withErrorHandling(async () => {
    // Handle lifetime separately (different structure)
    if (type === 'lifetime') {
      const result = await getLifetimeLeaderboard('totalPoints', 100);
      const userEntry = result.data.find(entry => entry.username === username);
      return userEntry?.rank || null;
    }

    const leaderboardRef = collection(db, 'artifacts', DATA_NAMESPACE, 'leaderboard', type, corpsClass);

    // Step 1: Query for the user's specific entry by username (1 document read)
    const userQuery = query(leaderboardRef, where('username', '==', username), limit(1));
    const userSnapshot = await getDocs(userQuery);

    if (userSnapshot.empty) {
      return null; // User not on leaderboard
    }

    const userDoc = userSnapshot.docs[0];
    const userScore = userDoc.data().score || 0;

    // Step 2: Count how many entries have a higher score (aggregation query)
    const higherScoreQuery = query(leaderboardRef, where('score', '>', userScore));
    const countSnapshot = await getCountFromServer(higherScoreQuery);

    // Rank = number of entries with higher scores + 1
    return countSnapshot.data().count + 1;
  }, `Failed to get user rank for ${username}`);
}

/**
 * Get a user's position and nearby entries
 * OPTIMIZATION: Uses targeted queries instead of fetching 100 entries
 * Fetches only the entries needed for context display
 */
export async function getUserContext(
  type: LeaderboardType,
  corpsClass: CorpsClass,
  username: string,
  contextSize = 2
): Promise<{
  userRank: number | null;
  entries: LeaderboardEntry[];
}> {
  return withErrorHandling(async () => {
    // Handle lifetime separately (different structure - keep simple approach)
    if (type === 'lifetime') {
      const result = await getLifetimeLeaderboard('totalPoints', 50);
      const userIndex = result.data.findIndex(entry => entry.username === username);
      if (userIndex === -1) {
        return { userRank: null, entries: result.data.slice(0, contextSize * 2 + 1) };
      }
      const startIndex = Math.max(0, userIndex - contextSize);
      const endIndex = Math.min(result.data.length, userIndex + contextSize + 1);
      return { userRank: userIndex + 1, entries: result.data.slice(startIndex, endIndex) };
    }

    const leaderboardRef = collection(db, 'artifacts', DATA_NAMESPACE, 'leaderboard', type, corpsClass);

    // Step 1: Find the user's entry and score
    const userQuery = query(leaderboardRef, where('username', '==', username), limit(1));
    const userSnapshot = await getDocs(userQuery);

    if (userSnapshot.empty) {
      // User not found - return top entries as fallback
      const topQuery = query(leaderboardRef, orderBy('score', 'desc'), limit(contextSize * 2 + 1));
      const topSnapshot = await getDocs(topQuery);
      const entries = topSnapshot.docs.map((doc, index) => ({
        id: doc.id,
        rank: index + 1,
        uid: doc.data().uid || doc.id,
        username: doc.data().username || 'Unknown',
        userTitle: doc.data().userTitle,
        corpsName: doc.data().corpsName,
        corpsClass: doc.data().corpsClass,
        score: doc.data().score || 0,
        trophies: doc.data().trophies || 0,
      }));
      return { userRank: null, entries };
    }

    const userDoc = userSnapshot.docs[0];
    const userScore = userDoc.data().score || 0;

    // Step 2: Count entries with higher scores to get rank
    const higherScoreQuery = query(leaderboardRef, where('score', '>', userScore));
    const countSnapshot = await getCountFromServer(higherScoreQuery);
    const userRank = countSnapshot.data().count + 1;

    // Step 3: Fetch entries above the user (limited to contextSize)
    const aboveQuery = query(
      leaderboardRef,
      where('score', '>', userScore),
      orderBy('score', 'asc'),
      limit(contextSize)
    );
    const aboveSnapshot = await getDocs(aboveQuery);

    // Step 4: Fetch entries below the user (limited to contextSize)
    const belowQuery = query(
      leaderboardRef,
      where('score', '<', userScore),
      orderBy('score', 'desc'),
      limit(contextSize)
    );
    const belowSnapshot = await getDocs(belowQuery);

    // Build the context entries with proper ranks
    const entries: LeaderboardEntry[] = [];

    // Add entries above (in descending score order)
    const aboveEntries = aboveSnapshot.docs.reverse();
    aboveEntries.forEach((doc, index) => {
      entries.push({
        id: doc.id,
        rank: userRank - (aboveEntries.length - index),
        uid: doc.data().uid || doc.id,
        username: doc.data().username || 'Unknown',
        userTitle: doc.data().userTitle,
        corpsName: doc.data().corpsName,
        corpsClass: doc.data().corpsClass,
        score: doc.data().score || 0,
        trophies: doc.data().trophies || 0,
      });
    });

    // Add the user's entry
    entries.push({
      id: userDoc.id,
      rank: userRank,
      uid: userDoc.data().uid || userDoc.id,
      username: userDoc.data().username || 'Unknown',
      userTitle: userDoc.data().userTitle,
      corpsName: userDoc.data().corpsName,
      corpsClass: userDoc.data().corpsClass,
      score: userDoc.data().score || 0,
      trophies: userDoc.data().trophies || 0,
    });

    // Add entries below
    belowSnapshot.docs.forEach((doc, index) => {
      entries.push({
        id: doc.id,
        rank: userRank + index + 1,
        uid: doc.data().uid || doc.id,
        username: doc.data().username || 'Unknown',
        userTitle: doc.data().userTitle,
        corpsName: doc.data().corpsName,
        corpsClass: doc.data().corpsClass,
        score: doc.data().score || 0,
        trophies: doc.data().trophies || 0,
      });
    });

    return { userRank, entries };
  }, `Failed to get user context for ${username}`);
}

// =============================================================================
// STATS AGGREGATION
// =============================================================================

export interface LeaderboardStats {
  totalPlayers: number;
  topScore: number;
  averageScore: number;
  lastUpdated?: Date;
}

/**
 * Get stats for a leaderboard
 * OPTIMIZATION: Uses count aggregation + targeted top score query
 * Before: 100 document reads
 * After: 1 count query + 1 document read for top score
 */
export async function getLeaderboardStats(
  type: LeaderboardType,
  corpsClass: CorpsClass
): Promise<LeaderboardStats> {
  return withErrorHandling(async () => {
    // Handle lifetime separately
    if (type === 'lifetime') {
      const result = await getLifetimeLeaderboard('totalPoints', 100);
      if (result.data.length === 0) {
        return { totalPlayers: 0, topScore: 0, averageScore: 0 };
      }
      const scores = result.data.map(e => e.score);
      const totalScore = scores.reduce((sum, score) => sum + score, 0);
      return {
        totalPlayers: result.total || result.data.length,
        topScore: Math.max(...scores),
        averageScore: totalScore / scores.length,
      };
    }

    const leaderboardRef = collection(db, 'artifacts', DATA_NAMESPACE, 'leaderboard', type, corpsClass);

    // Get total count using aggregation (no document reads)
    const countSnapshot = await getCountFromServer(query(leaderboardRef));
    const totalPlayers = countSnapshot.data().count;

    if (totalPlayers === 0) {
      return { totalPlayers: 0, topScore: 0, averageScore: 0 };
    }

    // Get top score (only 1 document read)
    const topQuery = query(leaderboardRef, orderBy('score', 'desc'), limit(1));
    const topSnapshot = await getDocs(topQuery);
    const topScore = topSnapshot.docs[0]?.data().score || 0;

    // Note: Average score would require reading all documents, so we estimate from top scores
    // For accurate average, we'd need to maintain this in a stats document during score processing
    // For now, we'll fetch a sample of top 10 for a reasonable estimate
    const sampleQuery = query(leaderboardRef, orderBy('score', 'desc'), limit(10));
    const sampleSnapshot = await getDocs(sampleQuery);
    const sampleScores = sampleSnapshot.docs.map(doc => doc.data().score || 0);
    const sampleAverage = sampleScores.length > 0
      ? sampleScores.reduce((sum, score) => sum + score, 0) / sampleScores.length
      : 0;

    return {
      totalPlayers,
      topScore,
      averageScore: sampleAverage, // Approximate from top 10
    };
  }, 'Failed to fetch leaderboard stats');
}

// =============================================================================
// RANKING DISPLAY HELPERS
// =============================================================================

/**
 * Get icon/styling for a rank
 */
export function getRankDisplay(rank: number): {
  icon: 'crown' | 'trophy' | 'medal' | null;
  color: string;
  bgColor: string;
  borderColor: string;
} {
  switch (rank) {
    case 1:
      return {
        icon: 'crown',
        color: 'text-yellow-400',
        bgColor: 'bg-gradient-to-r from-yellow-400/20 to-yellow-500/10',
        borderColor: 'border-yellow-400/30',
      };
    case 2:
      return {
        icon: 'trophy',
        color: 'text-gray-400',
        bgColor: 'bg-gradient-to-r from-gray-400/20 to-gray-500/10',
        borderColor: 'border-gray-400/30',
      };
    case 3:
      return {
        icon: 'medal',
        color: 'text-orange-400',
        bgColor: 'bg-gradient-to-r from-orange-400/20 to-orange-500/10',
        borderColor: 'border-orange-400/30',
      };
    default:
      if (rank <= 10) {
        return {
          icon: null,
          color: 'text-cream-300',
          bgColor: 'bg-charcoal-800/30',
          borderColor: 'border-cream-500/20',
        };
      }
      return {
        icon: null,
        color: 'text-cream-500/60',
        bgColor: 'bg-charcoal-900/30',
        borderColor: 'border-cream-500/10',
      };
  }
}

/**
 * Lifetime stat view options
 */
export const LIFETIME_VIEWS = [
  { id: 'totalPoints' as const, label: 'Total Points', desc: 'All-time points' },
  { id: 'totalSeasons' as const, label: 'Seasons', desc: 'Seasons played' },
  { id: 'totalShows' as const, label: 'Shows', desc: 'Shows attended' },
  { id: 'bestSeasonScore' as const, label: 'Best Season', desc: 'Highest season score' },
  { id: 'leagueChampionships' as const, label: 'Championships', desc: 'League titles won' },
] as const;

export type LifetimeViewId = typeof LIFETIME_VIEWS[number]['id'];
