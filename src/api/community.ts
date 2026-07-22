// Community API - Community pulse / social proof stats for landing widgets
// Moved from components/Landing/CommunityPulse.jsx and SocialProofBar.jsx.
//
// NOTE: These functions intentionally do NOT use withErrorHandling — the
// consuming widgets rely on the original error semantics (permission-denied
// checks, null fallbacks) to decide whether to render at all.
//
// NOTE: The 'artifacts/fantasy_drum_corps_v1/...' paths are kept as literals
// (rather than the paths.* helpers) because paths.* is built from
// DATA_CONFIG.namespace, which defaults to 'marching-art' — swapping helpers
// in would silently change the collections these widgets read. This module
// INTENTIONALLY reads the frozen legacy 'fantasy_drum_corps_v1' namespace:
// the landing-page social-proof stats (user/league counts, top score) come
// from the original game's archived data, which is never written anymore.
// It is a registered known exception in the path-literal ratchet
// (scripts/checkPathLiterals.mjs / scripts/path-literals.baseline.json);
// do not migrate it to paths.* without an explicit product decision.

import {
  collection,
  doc,
  getDoc,
  getDocs,
  getCountFromServer,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db, auth } from './client';

// =============================================================================
// COMMUNITY PULSE (recent activity feed)
// =============================================================================

export interface CommunityActivityItem {
  id: string;
  type: 'league';
  text: string;
  time: string;
  icon: string;
}

/**
 * Fetch recent league creations as a proxy for community activity.
 * Requires an authenticated user (the leagues collection is auth-gated at the
 * Firestore rule level); errors propagate unchanged to the caller.
 *
 * @returns Up to 4 shaped activity items, most recent first.
 */
export async function getRecentLeagueActivity(): Promise<CommunityActivityItem[]> {
  // Fetch recent league creations as a proxy for community activity
  const leaguesRef = collection(db, 'artifacts', 'fantasy_drum_corps_v1', 'leagues');
  const q = query(leaguesRef, orderBy('createdAt', 'desc'), limit(5));
  const snapshot = await getDocs(q);

  const items: CommunityActivityItem[] = [];

  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    const memberCount = data.members?.length || data.memberCount || 1;
    const createdAt = data.createdAt?.toDate?.() || new Date();
    const hoursAgo = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60));

    items.push({
      id: doc.id,
      type: 'league',
      text: `New league created with ${memberCount} director${memberCount !== 1 ? 's' : ''}`,
      time:
        hoursAgo < 1
          ? 'Just now'
          : hoursAgo < 24
            ? `${hoursAgo}h ago`
            : `${Math.floor(hoursAgo / 24)}d ago`,
      icon: 'users',
    });
  });

  // Sort by recency and take top 4
  return items.slice(0, 4);
}

// =============================================================================
// SOCIAL PROOF STATS
// =============================================================================

export interface CommunityStats {
  directors: number;
  leagues: number;
  totalPoints: number;
}

/**
 * Fetch community-wide stats (director count, league count, lifetime points).
 * The users/leagues counts are auth-gated and skipped for unauthenticated
 * visitors; the lifetime leaderboard is public.
 *
 * @returns The stats, or null when the fetch fails entirely.
 */
export async function getCommunityStats(): Promise<CommunityStats | null> {
  try {
    const isAuthenticated = !!auth.currentUser;

    // Fetch stats in parallel
    const [usersCount, leaguesCount, lifetimeData] = await Promise.all([
      // Count users collection — requires admin, skip if not authenticated
      isAuthenticated
        ? getCountFromServer(collection(db, 'artifacts', 'fantasy_drum_corps_v1', 'users'))
            .then((snap) => snap.data().count)
            .catch(() => null)
        : Promise.resolve(null),

      // Count leagues collection — requires auth, skip if not authenticated
      isAuthenticated
        ? getCountFromServer(collection(db, 'artifacts', 'fantasy_drum_corps_v1', 'leagues'))
            .then((snap) => snap.data().count)
            .catch(() => null)
        : Promise.resolve(null),

      // Get lifetime leaderboard for total points (aggregated, public)
      getDoc(doc(db, 'artifacts', 'fantasy_drum_corps_v1', 'leaderboard', 'lifetime_totalPoints'))
        .then((docSnap) => (docSnap.exists() ? docSnap.data() : null))
        .catch(() => null),
    ]);

    // Calculate total points from lifetime leaderboard entries
    let totalPoints = 0;
    if (lifetimeData?.entries) {
      totalPoints = lifetimeData.entries.reduce(
        (sum: number, entry: { lifetimeStats?: { totalPoints?: number } }) => {
          return sum + (entry.lifetimeStats?.totalPoints || 0);
        },
        0
      );
    }

    const stats = {
      directors: usersCount || 0,
      leagues: leaguesCount || 0,
      totalPoints: totalPoints,
    };

    return stats;
  } catch (error) {
    console.error('Failed to fetch community stats:', error);
    return null;
  }
}
