// LeagueLeaderboards - Category-based stat rankings
// Shows leaders in various stats: caption win rates, clutch wins, blowouts, etc.

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, Target, Zap, Flame, TrendingUp, Crown, Award,
  ChevronDown, ChevronUp, Medal
} from 'lucide-react';
import { GAME_CONFIG } from '../../config';

// Leaderboard categories with display info
const LEADERBOARD_CATEGORIES = [
  {
    id: 'battlePoints',
    label: 'Battle Points',
    shortLabel: 'BP',
    icon: Trophy,
    color: 'yellow',
    description: 'Total battle points earned',
    format: (v) => v.toFixed(0),
  },
  {
    id: 'captionWinRate',
    label: 'Caption Win %',
    shortLabel: 'CAP%',
    icon: Target,
    color: 'purple',
    description: 'Overall caption battle win rate',
    format: (v) => `${(v * 100).toFixed(0)}%`,
  },
  {
    id: 'avgMargin',
    label: 'Avg Margin',
    shortLabel: 'AVG',
    icon: TrendingUp,
    color: 'green',
    description: 'Average battle point margin',
    format: (v) => v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1),
  },
  {
    id: 'clutchWins',
    label: 'Clutch Wins',
    shortLabel: 'CLT',
    icon: Flame,
    color: 'orange',
    description: 'Wins decided by 1-2 battle points',
    format: (v) => v.toString(),
  },
  {
    id: 'blowoutWins',
    label: 'Blowouts',
    shortLabel: 'BLW',
    icon: Zap,
    color: 'red',
    description: 'Wins by 5+ battle points',
    format: (v) => v.toString(),
  },
  {
    id: 'longestStreak',
    label: 'Best Streak',
    shortLabel: 'STK',
    icon: Crown,
    color: 'gold',
    description: 'Longest win streak',
    format: (v) => `W${v}`,
  },
];

// Caption-specific leaderboards
const CAPTION_CATEGORIES = GAME_CONFIG.captions.map(caption => ({
  id: `bestCaption_${caption}`,
  label: GAME_CONFIG.captionNames[caption],
  shortLabel: caption,
  icon: Medal,
  color: 'blue',
  description: `Best ${GAME_CONFIG.captionNames[caption]} win rate`,
  format: (v) => `${(v * 100).toFixed(0)}%`,
  caption,
}));

const colorClasses = {
  yellow: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  purple: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
  green: 'text-green-400 bg-green-500/10 border-green-500/30',
  orange: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  red: 'text-red-400 bg-red-500/10 border-red-500/30',
  gold: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30',
  blue: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
};

/**
 * Single leaderboard category card
 */
const LeaderboardCard = ({
  category,
  entries,
  expanded,
  onToggle,
  currentUserId,
  getDisplayName,
}) => {
  const Icon = category.icon;
  const colors = colorClasses[category.color];
  const topThree = entries.slice(0, 3);
  const hasMore = entries.length > 3;

  return (
    <div className="bg-[#1a1a1a] border border-[#333] overflow-hidden">
      {/* Header - clickable to expand */}
      <button
        onClick={onToggle}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-[#222] transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className={`w-6 h-6 flex items-center justify-center border ${colors}`}>
            <Icon className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-bold text-white">{category.label}</span>
        </div>
        <div className="flex items-center gap-2">
          {topThree[0] && (
            <span className={`text-xs font-bold ${colors.split(' ')[0]}`}>
              {category.format(topThree[0].value)}
            </span>
          )}
          {hasMore && (
            expanded
              ? <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
              : <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
          )}
        </div>
      </button>

      {/* Top 3 Preview */}
      <div className="px-3 pb-2">
        <div className="flex items-center gap-1">
          {topThree.map((entry, idx) => {
            const isUser = entry.userId === currentUserId;
            return (
              <div
                key={entry.userId}
                className={`flex-1 px-2 py-1.5 text-center ${
                  isUser ? 'bg-purple-500/10 border border-purple-500/30' : 'bg-[#222]'
                }`}
              >
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <RankBadge rank={idx + 1} size="sm" />
                </div>
                <p className={`text-[10px] truncate ${isUser ? 'text-purple-400' : 'text-gray-400'}`}>
                  {getDisplayName(entry.userId)}
                </p>
                <p className={`text-xs font-bold ${colors.split(' ')[0]}`}>
                  {category.format(entry.value)}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Expanded List */}
      <AnimatePresence>
        {expanded && entries.length > 3 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-[#333] overflow-hidden"
          >
            <div className="divide-y divide-[#222]">
              {entries.slice(3).map((entry, idx) => {
                const rank = idx + 4;
                const isUser = entry.userId === currentUserId;
                return (
                  <div
                    key={entry.userId}
                    className={`px-3 py-2 flex items-center justify-between ${
                      isUser ? 'bg-purple-500/5' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 text-center text-xs text-gray-500 font-bold">
                        {rank}
                      </span>
                      <span className={`text-sm ${isUser ? 'text-purple-400' : 'text-gray-300'}`}>
                        {getDisplayName(entry.userId)}
                      </span>
                    </div>
                    <span className={`text-sm font-bold ${colors.split(' ')[0]}`}>
                      {category.format(entry.value)}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * Small rank badge
 */
const RankBadge = ({ rank, size = 'md' }) => {
  const sizeClasses = size === 'sm' ? 'w-4 h-4 text-[9px]' : 'w-5 h-5 text-[10px]';

  if (rank === 1) {
    return (
      <div className={`${sizeClasses} flex items-center justify-center bg-yellow-500/20 text-yellow-500 font-bold`}>
        1
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className={`${sizeClasses} flex items-center justify-center bg-gray-500/20 text-gray-400 font-bold`}>
        2
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className={`${sizeClasses} flex items-center justify-center bg-orange-500/20 text-orange-500 font-bold`}>
        3
      </div>
    );
  }
  return (
    <div className={`${sizeClasses} flex items-center justify-center bg-[#333] text-gray-500 font-bold`}>
      {rank}
    </div>
  );
};

/**
 * Main LeagueLeaderboards component
 */
const LeagueLeaderboards = ({
  leagueStats, // Map of userId -> SeasonMatchupStats
  currentUserId,
  getDisplayName,
}) => {
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [showCaptions, setShowCaptions] = useState(false);

  // Build leaderboard entries for each category
  const leaderboards = React.useMemo(() => {
    if (!leagueStats || Object.keys(leagueStats).length === 0) return {};

    const stats = Object.values(leagueStats);
    const boards = {};

    // Battle Points
    boards.battlePoints = stats
      .map(s => ({ userId: s.userId, value: s.totalBattlePointsFor }))
      .sort((a, b) => b.value - a.value);

    // Caption Win Rate (overall)
    boards.captionWinRate = stats
      .map(s => {
        const totalWins = Object.values(s.captionWinRates).reduce((sum, c) => sum + c.wins, 0);
        const totalMatchups = Object.values(s.captionWinRates).reduce((sum, c) => sum + c.totalMatchups, 0);
        return {
          userId: s.userId,
          value: totalMatchups > 0 ? totalWins / totalMatchups : 0,
        };
      })
      .sort((a, b) => b.value - a.value);

    // Avg Margin
    boards.avgMargin = stats
      .map(s => ({
        userId: s.userId,
        value: s.avgBattlePointsFor - s.avgBattlePointsAgainst,
      }))
      .sort((a, b) => b.value - a.value);

    // Clutch Wins
    boards.clutchWins = stats
      .map(s => ({ userId: s.userId, value: s.clutchWins }))
      .sort((a, b) => b.value - a.value);

    // Blowout Wins
    boards.blowoutWins = stats
      .map(s => ({ userId: s.userId, value: s.blowoutWins }))
      .sort((a, b) => b.value - a.value);

    // Longest Streak
    boards.longestStreak = stats
      .map(s => ({ userId: s.userId, value: s.longestWinStreak }))
      .sort((a, b) => b.value - a.value);

    // Caption-specific
    GAME_CONFIG.captions.forEach(caption => {
      boards[`bestCaption_${caption}`] = stats
        .map(s => ({
          userId: s.userId,
          value: s.captionWinRates[caption]?.winRate || 0,
        }))
        .sort((a, b) => b.value - a.value);
    });

    return boards;
  }, [leagueStats]);

  if (!leagueStats || Object.keys(leagueStats).length === 0) {
    return (
      <div className="bg-[#1a1a1a] border border-[#333] p-8 text-center">
        <Award className="w-8 h-8 text-gray-500 mx-auto mb-2" />
        <p className="text-sm text-gray-400">No stats available yet</p>
        <p className="text-xs text-gray-600">Complete some matchups to see leaderboards</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Main Categories */}
      <div className="space-y-2">
        {LEADERBOARD_CATEGORIES.map(category => (
          <LeaderboardCard
            key={category.id}
            category={category}
            entries={leaderboards[category.id] || []}
            expanded={expandedCategory === category.id}
            onToggle={() => setExpandedCategory(
              expandedCategory === category.id ? null : category.id
            )}
            currentUserId={currentUserId}
            getDisplayName={getDisplayName}
          />
        ))}
      </div>

      {/* Caption Categories Toggle */}
      <button
        onClick={() => setShowCaptions(!showCaptions)}
        className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#333] flex items-center justify-between hover:bg-[#222] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-bold text-white">Caption Leaders</span>
        </div>
        {showCaptions
          ? <ChevronUp className="w-4 h-4 text-gray-500" />
          : <ChevronDown className="w-4 h-4 text-gray-500" />
        }
      </button>

      {/* Caption Categories */}
      <AnimatePresence>
        {showCaptions && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="space-y-2 overflow-hidden"
          >
            {CAPTION_CATEGORIES.map(category => (
              <LeaderboardCard
                key={category.id}
                category={category}
                entries={leaderboards[category.id] || []}
                expanded={expandedCategory === category.id}
                onToggle={() => setExpandedCategory(
                  expandedCategory === category.id ? null : category.id
                )}
                currentUserId={currentUserId}
                getDisplayName={getDisplayName}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LeagueLeaderboards;
