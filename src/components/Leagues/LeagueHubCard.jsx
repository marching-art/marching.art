// LeagueHubCard - Enhanced league card for the League Hub
// Shows: name, your rank, record, next matchup, quick actions, activity indicators
import React, { useState, useEffect } from 'react';
import { m } from 'framer-motion';
import {
  Trophy, Users, Crown, ChevronRight, MessageSquare,
  BarChart3, Calendar, Flame, ArrowRightLeft, Medal,
  TrendingUp, Swords
} from 'lucide-react';
import { getLeagueStandings } from '../../api/leagues';

const LeagueHubCard = ({ league, userProfile, onClick, isMember }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const memberCount = league.members?.length || league.memberCount || 0;
  const maxMembers = league.maxMembers || 20;
  const isCommissioner = league.creatorId === userProfile?.uid;

  // Fetch user's standings in this league
  useEffect(() => {
    const fetchStats = async () => {
      if (!userProfile?.uid || !league?.id) {
        setLoading(false);
        return;
      }

      try {
        const standings = await getLeagueStandings(league.id);
        const userStanding = standings.find(s => s.uid === userProfile.uid);

        if (userStanding) {
          setStats({
            rank: userStanding.rank || standings.indexOf(userStanding) + 1,
            wins: userStanding.wins || 0,
            losses: userStanding.losses || 0,
            circuitPoints: userStanding.circuitPoints || userStanding.totalPoints || 0,
            isOnFire: (userStanding.streakType === 'W' && userStanding.streak >= 3)
          });
        } else {
          // User has no standings data yet
          setStats(null);
        }
      } catch (error) {
        console.error('Error fetching league stats:', error);
        setStats(null);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [league, userProfile]);

  // Activity indicators (would come from real-time data)
  const hasRecentMessages = league.lastMessageAt &&
    (Date.now() - new Date(league.lastMessageAt).getTime()) < 24 * 60 * 60 * 1000;
  const hasRecentTrades = league.lastTradeAt &&
    (Date.now() - new Date(league.lastTradeAt).getTime()) < 24 * 60 * 60 * 1000;
  const hasActivity = hasRecentMessages || hasRecentTrades || (memberCount > 5);

  // Get ordinal suffix for rank
  const getOrdinal = (n) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  // Determine card accent based on rank
  const getAccentByRank = (rank) => {
    if (rank === 1) return 'gold';
    if (rank === 2) return 'silver';
    if (rank === 3) return 'bronze';
    return 'default';
  };

  const accent = stats ? getAccentByRank(stats.rank) : 'default';

  const accentStyles = {
    gold: {
      border: 'border-gold-500/50 hover:border-gold-500',
      bg: 'bg-gradient-to-br from-gold-500/10 to-charcoal-900/50',
      icon: 'text-gold-400',
      badge: 'bg-gold-500/20 text-gold-400'
    },
    silver: {
      border: 'border-gray-400/50 hover:border-gray-400',
      bg: 'bg-gradient-to-br from-gray-400/10 to-charcoal-900/50',
      icon: 'text-gray-400',
      badge: 'bg-gray-400/20 text-gray-400'
    },
    bronze: {
      border: 'border-orange-400/50 hover:border-orange-400',
      bg: 'bg-gradient-to-br from-orange-500/10 to-charcoal-900/50',
      icon: 'text-orange-400',
      badge: 'bg-orange-500/20 text-orange-400'
    },
    default: {
      border: 'border-cream-500/20 hover:border-cream-500/40',
      bg: 'bg-charcoal-900/30',
      icon: 'text-cream-400',
      badge: 'bg-cream-500/10 text-cream-400'
    }
  };

  const style = accentStyles[accent];

  return (
    <m.div
      whileHover={{ scale: 1.01, y: -2 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={`${style.bg} border-2 ${style.border} rounded-sm p-4 cursor-pointer transition-all`}
    >
      {/* Header Row */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-sm ${accent === 'gold' ? 'bg-gold-500/20' : accent === 'silver' ? 'bg-gray-400/20' : accent === 'bronze' ? 'bg-orange-500/20' : 'bg-charcoal-800'} flex items-center justify-center`}>
            <Trophy className={`w-6 h-6 ${style.icon}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display font-bold text-cream-100 text-base">
                {league.name}
              </h3>
              {isCommissioner && (
                <Crown className="w-4 h-4 text-gold-500" title="Commissioner" />
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-cream-500/60">
              <Users className="w-3 h-3" />
              <span>{memberCount} members</span>
              {hasActivity && (
                <span className="flex items-center gap-1 text-green-400">
                  <span className="w-1.5 h-1.5 rounded-sm bg-green-400 animate-pulse" />
                  Active
                </span>
              )}
            </div>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-cream-500/40" />
      </div>

      {/* Stats Row - Your Record & Rank */}
      {stats ? (
        <div className="flex items-center gap-4 mb-4 p-3 bg-black/20 rounded-sm">
          {/* Rank */}
          <div className="flex items-center gap-2">
            {stats.rank <= 3 ? (
              <Medal className={`w-5 h-5 ${stats.rank === 1 ? 'text-gold-400' : stats.rank === 2 ? 'text-gray-400' : 'text-orange-400'}`} />
            ) : (
              <TrendingUp className="w-5 h-5 text-cream-500/60" />
            )}
            <div>
              <p className="text-xs text-cream-500/60">Rank</p>
              <p className={`font-display font-bold ${stats.rank <= 3 ? style.icon : 'text-cream-100'}`}>
                {getOrdinal(stats.rank)}
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="w-px h-8 bg-cream-500/20" />

          {/* Record */}
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-cream-500/60" />
            <div>
              <p className="text-xs text-cream-500/60">Record</p>
              <p className="font-display font-bold text-cream-100">
                <span className="text-green-400">{stats.wins}</span>
                <span className="text-cream-500/60">-</span>
                <span className="text-red-400">{stats.losses}</span>
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="w-px h-8 bg-cream-500/20" />

          {/* Circuit Points */}
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-gold-500" />
            <div>
              <p className="text-xs text-cream-500/60">Points</p>
              <p className="font-display font-bold text-gold-400">
                {stats.circuitPoints}
              </p>
            </div>
          </div>

          {/* On Fire Indicator */}
          {stats.isOnFire && (
            <Flame className="w-5 h-5 text-orange-400 ml-auto animate-pulse" title="On a win streak!" />
          )}
        </div>
      ) : !loading && (
        <div className="flex items-center gap-2 mb-4 p-3 bg-black/20 rounded-sm text-cream-500/60">
          <BarChart3 className="w-4 h-4" />
          <span className="text-xs">No standings data yet</span>
        </div>
      )}

      {/* This Week Matchup Preview */}
      <div className="mb-4 p-3 bg-black/20 rounded-sm border border-cream-500/5">
        <div className="flex items-center gap-2 mb-2">
          <Swords className="w-4 h-4 text-purple-400" />
          <span className="text-xs font-display font-semibold text-cream-400 uppercase tracking-wide">
            This Week
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-sm bg-charcoal-800 flex items-center justify-center">
              <span className="text-xs font-bold text-cream-100">
                {userProfile?.displayName?.charAt(0) || 'Y'}
              </span>
            </div>
            <span className="text-sm font-display text-cream-100">You</span>
          </div>
          <span className="text-xs font-display font-bold text-cream-500/60 uppercase">vs</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-display text-cream-400">
              TBD
            </span>
            <div className="w-8 h-8 rounded-sm bg-charcoal-800 flex items-center justify-center">
              <span className="text-xs font-bold text-cream-500/60">?</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2">
        <QuickActionButton
          icon={BarChart3}
          label="Standings"
          onClick={(e) => {
            e.stopPropagation();
            onClick?.();
          }}
        />
        <QuickActionButton
          icon={MessageSquare}
          label="Chat"
          hasNotification={hasRecentMessages}
          onClick={(e) => {
            e.stopPropagation();
            onClick?.();
          }}
        />
        <QuickActionButton
          icon={Calendar}
          label="Matchups"
          onClick={(e) => {
            e.stopPropagation();
            onClick?.();
          }}
        />
      </div>

      {/* Activity Indicators */}
      {(hasRecentMessages || hasRecentTrades) && (
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-cream-500/10">
          {hasRecentMessages && (
            <div className="flex items-center gap-1.5 text-xs text-purple-400">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>New messages</span>
            </div>
          )}
          {hasRecentTrades && (
            <div className="flex items-center gap-1.5 text-xs text-blue-400">
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Recent trade</span>
            </div>
          )}
        </div>
      )}
    </m.div>
  );
};

// Quick Action Button Component
const QuickActionButton = ({ icon: Icon, label, hasNotification, onClick }) => (
  <button
    onClick={onClick}
    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-sm bg-charcoal-800/50 border border-cream-500/10 text-cream-400 hover:bg-charcoal-800 hover:border-cream-500/30 hover:text-cream-100 transition-all text-xs font-display font-semibold uppercase tracking-wide relative"
  >
    <Icon className="w-3.5 h-3.5" />
    <span className="hidden sm:inline">{label}</span>
    {hasNotification && (
      <span className="absolute -top-1 -right-1 w-2 h-2 rounded-sm bg-purple-500 animate-pulse" />
    )}
  </button>
);

export default LeagueHubCard;
