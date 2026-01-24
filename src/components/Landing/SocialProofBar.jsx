/**
 * SocialProofBar Component
 *
 * Displays community stats (directors, leagues, points) in a subtle data-bar format.
 * Fetches real data from Firestore with caching to minimize reads.
 * Designed to feel like a stats ticker, not marketing fluff.
 */

import React, { useState, useEffect } from 'react';
import { m } from 'framer-motion';
import { Users, Trophy, Zap } from 'lucide-react';
import { collection, getCountFromServer, doc, getDoc } from 'firebase/firestore';
import { db } from '../../api/client';

// =============================================================================
// STATS CACHE
// =============================================================================
// Cache stats for 15 minutes to minimize Firestore reads
// These numbers don't change rapidly, so stale data is acceptable

const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

const statsCache = {
  data: null,
  timestamp: 0,

  isValid() {
    return this.data && Date.now() - this.timestamp < CACHE_TTL;
  },

  set(data) {
    this.data = data;
    this.timestamp = Date.now();
  },

  get() {
    return this.isValid() ? this.data : null;
  },
};

// =============================================================================
// FETCH COMMUNITY STATS
// =============================================================================

async function fetchCommunityStats() {
  // Return cached data if valid
  const cached = statsCache.get();
  if (cached) return cached;

  try {
    // Fetch stats in parallel
    const [usersCount, leaguesCount, lifetimeData] = await Promise.all([
      // Count users collection
      getCountFromServer(collection(db, 'artifacts', 'fantasy_drum_corps_v1', 'users'))
        .then(snap => snap.data().count)
        .catch(() => null),

      // Count leagues collection
      getCountFromServer(collection(db, 'artifacts', 'fantasy_drum_corps_v1', 'leagues'))
        .then(snap => snap.data().count)
        .catch(() => null),

      // Get lifetime leaderboard for total points (aggregated)
      getDoc(doc(db, 'artifacts', 'fantasy_drum_corps_v1', 'leaderboard', 'lifetime_totalPoints', 'data'))
        .then(docSnap => docSnap.exists() ? docSnap.data() : null)
        .catch(() => null),
    ]);

    // Calculate total points from lifetime leaderboard entries
    let totalPoints = 0;
    if (lifetimeData?.entries) {
      totalPoints = lifetimeData.entries.reduce((sum, entry) => {
        return sum + (entry.lifetimeStats?.totalPoints || 0);
      }, 0);
    }

    const stats = {
      directors: usersCount || 0,
      leagues: leaguesCount || 0,
      totalPoints: totalPoints,
    };

    statsCache.set(stats);
    return stats;
  } catch (error) {
    console.error('Failed to fetch community stats:', error);
    return null;
  }
}

// =============================================================================
// FORMAT HELPERS
// =============================================================================

function formatNumber(num) {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toLocaleString();
}

// =============================================================================
// SOCIAL PROOF BAR COMPONENT
// =============================================================================

const SocialProofBar = ({ className = '' }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    fetchCommunityStats().then(data => {
      if (mounted) {
        setStats(data);
        setLoading(false);
      }
    });

    return () => { mounted = false; };
  }, []);

  // Don't render if no data and still loading, or if all stats are 0
  if (loading) {
    return (
      <div className={`flex items-center justify-center gap-6 py-3 ${className}`}>
        <div className="h-4 w-32 bg-[#222] rounded animate-pulse" />
        <div className="h-4 w-28 bg-[#222] rounded animate-pulse" />
        <div className="h-4 w-36 bg-[#222] rounded animate-pulse" />
      </div>
    );
  }

  // Don't show if we have no meaningful data
  if (!stats || (stats.directors === 0 && stats.leagues === 0)) {
    return null;
  }

  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className={`flex flex-wrap items-center justify-center gap-x-6 gap-y-2 py-3 px-4 bg-[#111] border border-[#222] rounded-sm ${className}`}
    >
      {/* Directors count */}
      {stats.directors > 0 && (
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-[#0057B8]" />
          <span className="text-sm text-gray-400 font-data tabular-nums">
            <span className="text-white font-semibold">{formatNumber(stats.directors)}</span>
            {' '}directors
          </span>
        </div>
      )}

      {/* Leagues count */}
      {stats.leagues > 0 && (
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-yellow-500" />
          <span className="text-sm text-gray-400 font-data tabular-nums">
            <span className="text-white font-semibold">{formatNumber(stats.leagues)}</span>
            {' '}leagues
          </span>
        </div>
      )}

      {/* Total points */}
      {stats.totalPoints > 0 && (
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-orange-500" />
          <span className="text-sm text-gray-400 font-data tabular-nums">
            <span className="text-white font-semibold">{formatNumber(stats.totalPoints)}</span>
            {' '}points scored
          </span>
        </div>
      )}
    </m.div>
  );
};

export default SocialProofBar;
