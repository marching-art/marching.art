// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// Activity tab recap cards: weekly recap and rivalries (both fetch their own
// data). Extracted verbatim from ActivityTab.jsx.

import React, { useState, useEffect } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import {
  Flame,
  Trophy,
  Star,
  ChevronRight,
  MessageCircle,
  AlertTriangle,
  Swords,
} from 'lucide-react';
import { getLeagueWeekRecap, getLeagueRivalries } from '../../../api/leagues';

// Weekly Recap Card - Displays auto-generated weekly highlights
const WeeklyRecapCard = ({ leagueId, currentWeek, memberProfiles: _memberProfiles }) => {
  const [recap, setRecap] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecap = async () => {
      if (!leagueId || currentWeek < 1) {
        setLoading(false);
        return;
      }

      try {
        // Try to fetch the most recent recap
        const recapData = await getLeagueWeekRecap(leagueId, currentWeek);

        if (recapData) {
          setRecap(recapData);
        } else if (currentWeek > 1) {
          // Try previous week
          const prevRecapData = await getLeagueWeekRecap(leagueId, currentWeek - 1);
          if (prevRecapData) {
            setRecap(prevRecapData);
          }
        }
      } catch (error) {
        console.error('Error fetching recap:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecap();
  }, [leagueId, currentWeek]);

  if (loading) {
    return (
      <div className="bg-surface-card border border-line p-6">
        <div className="animate-pulse flex flex-col gap-3">
          <div className="h-4 bg-line rounded-none w-1/3" />
          <div className="h-12 bg-line rounded-none" />
          <div className="h-12 bg-line rounded-none" />
        </div>
      </div>
    );
  }

  if (!recap || !recap.highlights || recap.highlights.length === 0) {
    return null; // Don't show anything if no recap
  }

  const getHighlightIcon = (type) => {
    switch (type) {
      case 'upset':
        return AlertTriangle;
      case 'close_game':
        return Swords;
      case 'top_scorer':
        return Trophy;
      default:
        return Star;
    }
  };

  const getHighlightColor = (type) => {
    switch (type) {
      case 'upset':
        return 'text-orange-500 bg-orange-500/10 border-orange-500/30';
      case 'close_game':
        return 'text-red-500 bg-red-500/10 border-red-500/30';
      case 'top_scorer':
        return 'text-brand bg-brand/10 border-brand/30';
      default:
        return 'text-blue-500 bg-blue-500/10 border-blue-500/30';
    }
  };

  return (
    <div className="bg-surface-card border border-line">
      <div className="px-4 py-3 border-b border-line bg-surface-raised">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-purple-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">
              Week {recap.week} Recap
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted">
            <Swords className="w-3 h-3" />
            <span>{recap.stats?.totalMatchups || 0} matchups</span>
          </div>
        </div>
      </div>

      <div className="p-3 space-y-2">
        {recap.highlights.slice(0, 3).map((highlight, idx) => {
          const Icon = getHighlightIcon(highlight.type);
          const colorClasses = getHighlightColor(highlight.type);

          return (
            <m.div
              key={idx}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={`p-3 border ${colorClasses}`}
            >
              <div className="flex items-start gap-2">
                <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${colorClasses.split(' ')[0]}`} />
                <p className="text-sm text-white">{highlight.text}</p>
              </div>
            </m.div>
          );
        })}

        {/* Recap Stats Summary */}
        {recap.stats && (
          <div className="grid grid-cols-3 gap-2 pt-2">
            {recap.stats.biggestUpset && (
              <div className="bg-surface-raised p-2 text-center">
                <AlertTriangle className="w-4 h-4 text-orange-500 mx-auto mb-1" />
                <p className="text-[9px] text-muted uppercase">Upset</p>
                <p className="text-xs font-bold text-white truncate">
                  {recap.stats.biggestUpset.magnitude} ranks
                </p>
              </div>
            )}
            {recap.stats.closestMatch && (
              <div className="bg-surface-raised p-2 text-center">
                <Swords className="w-4 h-4 text-red-500 mx-auto mb-1" />
                <p className="text-[9px] text-muted uppercase">Closest</p>
                <p className="text-xs font-bold text-white truncate">
                  {recap.stats.closestMatch.margin?.toFixed(1)} pts
                </p>
              </div>
            )}
            {recap.stats.highestScorer && (
              <div className="bg-surface-raised p-2 text-center">
                <Trophy className="w-4 h-4 text-brand mx-auto mb-1" />
                <p className="text-[9px] text-muted uppercase">Top Score</p>
                <p className="text-xs font-bold text-white truncate">
                  {recap.stats.highestScorer.score?.toFixed(1)}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Enhanced Rivalries Card - Shows rivalries with intensity levels
const EnhancedRivalriesCard = ({ leagueId, userProfile, memberProfiles }) => {
  const [rivalries, setRivalries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const fetchRivalries = async () => {
      if (!leagueId) {
        setLoading(false);
        return;
      }

      try {
        const data = await getLeagueRivalries(leagueId);

        if (data) {
          // Filter to show rivalries involving the current user
          const userRivalries = (data.rivalries || []).filter(
            (r) => r.player1 === userProfile?.uid || r.player2 === userProfile?.uid
          );
          setRivalries(userRivalries);
        }
      } catch (error) {
        console.error('Error fetching rivalries:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRivalries();
  }, [leagueId, userProfile?.uid]);

  if (loading || rivalries.length === 0) {
    return null;
  }

  const getIntensityStyles = (intensity) => {
    switch (intensity) {
      case 'intense':
        return {
          bg: 'bg-surface-raised',
          border: 'border-red-500/50',
          badge: 'bg-red-500',
          badgeText: 'INTENSE',
        };
      case 'established':
        return {
          bg: 'bg-surface-raised',
          border: 'border-purple-500/50',
          badge: 'bg-purple-500',
          badgeText: 'ESTABLISHED',
        };
      default:
        return {
          bg: 'bg-surface-raised',
          border: 'border-blue-500/50',
          badge: 'bg-blue-500',
          badgeText: 'EMERGING',
        };
    }
  };

  const getDisplayName = (uid) => {
    if (uid === userProfile?.uid) return 'You';
    const profile = memberProfiles[uid];
    const name = profile?.displayName;
    if (name && name !== 'Director') return name;
    return profile?.username || name || `User ${uid?.slice(0, 6)}`;
  };

  const getRivalName = (rivalry) => {
    const rivalId = rivalry.player1 === userProfile?.uid ? rivalry.player2 : rivalry.player1;
    return getDisplayName(rivalId);
  };

  const getUserWins = (rivalry) => {
    return rivalry.player1 === userProfile?.uid ? rivalry.p1Wins : rivalry.p2Wins;
  };

  const getRivalWins = (rivalry) => {
    return rivalry.player1 === userProfile?.uid ? rivalry.p2Wins : rivalry.p1Wins;
  };

  const displayRivalries = expanded ? rivalries : rivalries.slice(0, 2);

  return (
    <div className="bg-surface-card border border-line">
      <div className="px-4 py-3 border-b border-line bg-surface-raised">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-red-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">
              Your Rivalries ({rivalries.length})
            </span>
          </div>
          {rivalries.length > 2 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-muted hover:text-white flex items-center gap-1"
            >
              {expanded ? 'Show less' : 'Show all'}
              <ChevronRight
                className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`}
              />
            </button>
          )}
        </div>
      </div>

      <div className="p-3 space-y-2">
        <AnimatePresence>
          {displayRivalries.map((rivalry, _idx) => {
            const styles = getIntensityStyles(rivalry.intensity);
            const userWins = getUserWins(rivalry);
            const rivalWins = getRivalWins(rivalry);

            return (
              <m.div
                key={`${rivalry.player1}_${rivalry.player2}`}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={`p-3 border ${styles.bg} ${styles.border}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-red-500" />
                    <span className="text-sm font-bold text-white">vs {getRivalName(rivalry)}</span>
                  </div>
                  <span className={`px-1.5 py-0.5 text-[8px] font-bold text-white ${styles.badge}`}>
                    {styles.badgeText}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-surface-raised/50 p-2">
                    <p className="text-xs text-muted">Your Wins</p>
                    <p className="text-lg font-bold text-green-500 font-data tabular-nums">
                      {userWins}
                    </p>
                  </div>
                  <div className="bg-surface-raised/50 p-2">
                    <p className="text-xs text-muted">Total</p>
                    <p className="text-lg font-bold text-white font-data tabular-nums">
                      {rivalry.totalMatches}
                    </p>
                  </div>
                  <div className="bg-surface-raised/50 p-2">
                    <p className="text-xs text-muted">Their Wins</p>
                    <p className="text-lg font-bold text-red-500 font-data tabular-nums">
                      {rivalWins}
                    </p>
                  </div>
                </div>

                {rivalry.closeMatches > 0 && (
                  <p className="text-[10px] text-muted mt-2 text-center">
                    {rivalry.closeMatches} close game{rivalry.closeMatches !== 1 ? 's' : ''} between
                    you
                  </p>
                )}
              </m.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};

export { WeeklyRecapCard, EnhancedRivalriesCard };
