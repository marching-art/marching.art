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
 */
export async function getUserRank(
  type: LeaderboardType,
  corpsClass: CorpsClass,
  username: string
): Promise<number | null> {
  const result = await getLeaderboard(type, corpsClass, 100);

  const userEntry = result.data.find(entry => entry.username === username);
  return userEntry?.rank || null;
}

/**
 * Get a user's position and nearby entries
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
  // Fetch more entries to find user context
  const result = await getLeaderboard(type, corpsClass, 100);

  const userIndex = result.data.findIndex(entry => entry.username === username);

  if (userIndex === -1) {
    return { userRank: null, entries: result.data.slice(0, contextSize * 2 + 1) };
  }

  const startIndex = Math.max(0, userIndex - contextSize);
  const endIndex = Math.min(result.data.length, userIndex + contextSize + 1);

  return {
    userRank: userIndex + 1,
    entries: result.data.slice(startIndex, endIndex),
  };
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
 */
export async function getLeaderboardStats(
  type: LeaderboardType,
  corpsClass: CorpsClass
): Promise<LeaderboardStats> {
  return withErrorHandling(async () => {
    const result = await getLeaderboard(type, corpsClass, 100);

    if (result.data.length === 0) {
      return {
        totalPlayers: 0,
        topScore: 0,
        averageScore: 0,
      };
    }

    const scores = result.data.map(e => e.score);
    const totalScore = scores.reduce((sum, score) => sum + score, 0);

    return {
      totalPlayers: result.data.length + (result.hasMore ? 100 : 0), // Estimate
      topScore: Math.max(...scores),
      averageScore: totalScore / scores.length,
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
