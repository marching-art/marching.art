// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
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
import { getCommunityStats } from '../../api/community';

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

  const stats = await getCommunityStats();
  if (stats) {
    statsCache.set(stats);
  }
  return stats;
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

    fetchCommunityStats().then((data) => {
      if (mounted) {
        setStats(data);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  // Don't render if no data and still loading, or if all stats are 0
  if (loading) {
    return (
      <div className={`flex items-center justify-center gap-6 py-3 ${className}`}>
        <div className="h-4 w-32 bg-surface-raised rounded-none animate-pulse" />
        <div className="h-4 w-28 bg-surface-raised rounded-none animate-pulse" />
        <div className="h-4 w-36 bg-surface-raised rounded-none animate-pulse" />
      </div>
    );
  }

  // Only render when we have at least one real, non-zero metric from a
  // publicly-readable source. The users/leagues counts are auth-gated
  // (see Firestore rules) and resolve to 0 for unauthenticated visitors;
  // totalPoints is public via the lifetime leaderboard. We deliberately
  // do not substitute static floor values when real data is unavailable —
  // fabricated counts would mislead visitors evaluating platform activity.
  if (!stats || (stats.directors === 0 && stats.leagues === 0 && stats.totalPoints === 0)) {
    return null;
  }

  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className={`flex flex-wrap items-center justify-center gap-x-6 gap-y-2 py-3 px-4 bg-surface-sunken border border-line-subtle rounded-none ${className}`}
    >
      {/* Directors count */}
      {stats.directors > 0 && (
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-interactive" />
          <span className="text-sm text-muted font-data tabular-nums">
            <span className="text-white font-semibold">{formatNumber(stats.directors)}</span>{' '}
            directors
          </span>
        </div>
      )}

      {/* Leagues count */}
      {stats.leagues > 0 && (
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-secondary" />
          <span className="text-sm text-muted font-data tabular-nums">
            <span className="text-white font-semibold">{formatNumber(stats.leagues)}</span> leagues
          </span>
        </div>
      )}

      {/* Total points */}
      {stats.totalPoints > 0 && (
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-orange-500" />
          <span className="text-sm text-muted font-data tabular-nums">
            <span className="text-white font-semibold">{formatNumber(stats.totalPoints)}</span>{' '}
            points scored
          </span>
        </div>
      )}
    </m.div>
  );
};

export default SocialProofBar;
