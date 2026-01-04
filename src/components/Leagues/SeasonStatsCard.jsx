// SeasonStatsCard - Individual user season stats display
// Shows detailed stats for a league member including caption win rates, achievements

import React from 'react';
import { motion } from 'framer-motion';
import {
  Trophy, Target, Zap, Flame, TrendingUp, TrendingDown, Crown,
  Award, Medal, X, ChevronRight, BarChart3
} from 'lucide-react';
import { GAME_CONFIG } from '../../config';

/**
 * Compact stat row
 */
const StatRow = ({ label, value, subValue, icon: Icon, color = 'cream' }) => {
  const colorClasses = {
    cream: 'text-gray-300',
    green: 'text-green-400',
    red: 'text-red-400',
    yellow: 'text-yellow-400',
    purple: 'text-purple-400',
    blue: 'text-blue-400',
  };

  return (
    <div className="flex items-center justify-between py-2 border-b border-[#222] last:border-0">
      <div className="flex items-center gap-2">
        {Icon && <Icon className={`w-3.5 h-3.5 ${colorClasses[color]}`} />}
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <div className="text-right">
        <span className={`text-sm font-bold ${colorClasses[color]}`}>{value}</span>
        {subValue && (
          <span className="text-[10px] text-gray-500 ml-1">({subValue})</span>
        )}
      </div>
    </div>
  );
};

/**
 * Caption win rate bar
 */
const CaptionBar = ({ caption, winRate, avgDiff, isStrength, isWeakness }) => {
  const percentage = winRate * 100;

  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-gray-400 w-8">{caption}</span>
          {isStrength && <Crown className="w-3 h-3 text-yellow-500" />}
          {isWeakness && <TrendingDown className="w-3 h-3 text-red-400" />}
        </div>
        <span className={`text-[10px] font-bold ${
          percentage >= 60 ? 'text-green-400' :
          percentage >= 40 ? 'text-gray-400' : 'text-red-400'
        }`}>
          {percentage.toFixed(0)}%
        </span>
      </div>
      <div className="h-1.5 bg-[#222] rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className={`h-full rounded-full ${
            percentage >= 60 ? 'bg-green-500' :
            percentage >= 40 ? 'bg-gray-500' : 'bg-red-500'
          }`}
        />
      </div>
    </div>
  );
};

/**
 * Achievement badge
 */
const AchievementBadge = ({ label, value, icon: Icon, color }) => {
  if (!value || value === 0) return null;

  const colorClasses = {
    yellow: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
    green: 'bg-green-500/10 border-green-500/30 text-green-400',
    red: 'bg-red-500/10 border-red-500/30 text-red-400',
    purple: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
    orange: 'bg-orange-500/10 border-orange-500/30 text-orange-400',
  };

  return (
    <div className={`px-2 py-1.5 border ${colorClasses[color]} flex items-center gap-1.5`}>
      <Icon className="w-3 h-3" />
      <span className="text-[10px] font-bold">{value}</span>
      <span className="text-[10px] text-gray-500">{label}</span>
    </div>
  );
};

/**
 * Main SeasonStatsCard component
 */
const SeasonStatsCard = ({
  stats, // SeasonMatchupStats object
  displayName,
  isCurrentUser = false,
  onClose,
  compact = false,
}) => {
  if (!stats) {
    return (
      <div className="bg-[#1a1a1a] border border-[#333] p-6 text-center">
        <BarChart3 className="w-8 h-8 text-gray-500 mx-auto mb-2" />
        <p className="text-sm text-gray-400">No stats available</p>
      </div>
    );
  }

  const {
    wins,
    losses,
    ties,
    winPercentage,
    totalBattlePointsFor,
    totalBattlePointsAgainst,
    avgBattlePointsFor,
    avgBattlePointsAgainst,
    captionWinRates,
    bestCaption,
    bestCaptionWinRate,
    worstCaption,
    worstCaptionWinRate,
    totalScoreBattlesWon,
    highSingleBattlesWon,
    momentumBattlesWon,
    clutchWins,
    blowoutWins,
    comebackWins,
    currentStreak,
    currentStreakType,
    longestWinStreak,
    longestLossStreak,
    bestWeek,
    worstWeek,
  } = stats;

  const totalMatchups = wins + losses + ties;
  const pointDiff = avgBattlePointsFor - avgBattlePointsAgainst;

  if (compact) {
    // Compact inline view for standings table
    return (
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        className="bg-[#111] border-t border-[#333] px-4 py-3"
      >
        <div className="grid grid-cols-4 gap-3 text-center">
          <div>
            <p className="text-[10px] text-gray-500 uppercase">BP For</p>
            <p className="text-sm font-bold text-yellow-400">{totalBattlePointsFor}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase">BP Avg</p>
            <p className={`text-sm font-bold ${pointDiff >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {pointDiff >= 0 ? '+' : ''}{pointDiff.toFixed(1)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase">Best Cap</p>
            <p className="text-sm font-bold text-purple-400">{bestCaption}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase">Clutch</p>
            <p className="text-sm font-bold text-orange-400">{clutchWins}</p>
          </div>
        </div>
      </motion.div>
    );
  }

  // Full modal/card view
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-[#1a1a1a] border border-[#333] overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#333] bg-[#222] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 flex items-center justify-center ${
            isCurrentUser ? 'bg-purple-500/20 border border-purple-500/50' : 'bg-[#333]'
          }`}>
            <span className={`text-sm font-bold ${isCurrentUser ? 'text-purple-400' : 'text-gray-400'}`}>
              {displayName.charAt(0)}
            </span>
          </div>
          <div>
            <p className={`font-bold text-sm ${isCurrentUser ? 'text-purple-400' : 'text-white'}`}>
              {displayName}
            </p>
            <p className="text-[10px] text-gray-500">Season Stats</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 text-gray-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Main Stats */}
      <div className="p-4 space-y-4">
        {/* Record Overview */}
        <div className="bg-[#111] p-3">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-white">
                <span className="text-green-400">{wins}</span>
                <span className="text-gray-600">-</span>
                <span className="text-red-400">{losses}</span>
                {ties > 0 && <span className="text-yellow-400">-{ties}</span>}
              </p>
              <p className="text-[10px] text-gray-500 uppercase mt-1">Record</p>
            </div>
            <div>
              <p className={`text-2xl font-bold ${winPercentage >= 0.5 ? 'text-green-400' : 'text-red-400'}`}>
                {(winPercentage * 100).toFixed(0)}%
              </p>
              <p className="text-[10px] text-gray-500 uppercase mt-1">Win Rate</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-400">{totalBattlePointsFor}</p>
              <p className="text-[10px] text-gray-500 uppercase mt-1">Battle Pts</p>
            </div>
          </div>
        </div>

        {/* Battle Point Stats */}
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1.5">
            <Trophy className="w-3 h-3 text-yellow-500" />
            Battle Points
          </h3>
          <div className="bg-[#111] p-3">
            <StatRow
              label="BP Per Match"
              value={avgBattlePointsFor.toFixed(1)}
              subValue={`${pointDiff >= 0 ? '+' : ''}${pointDiff.toFixed(1)} diff`}
              icon={Trophy}
              color={pointDiff >= 0 ? 'green' : 'red'}
            />
            <StatRow
              label="BP Against"
              value={avgBattlePointsAgainst.toFixed(1)}
              icon={Target}
              color="cream"
            />
            <StatRow
              label="Total Score Wins"
              value={totalScoreBattlesWon}
              subValue={`of ${totalMatchups}`}
              icon={Award}
              color="yellow"
            />
            <StatRow
              label="High Single Wins"
              value={highSingleBattlesWon}
              subValue={`of ${totalMatchups}`}
              icon={Zap}
              color="purple"
            />
            <StatRow
              label="Momentum Wins"
              value={momentumBattlesWon}
              subValue={`of ${totalMatchups}`}
              icon={TrendingUp}
              color="blue"
            />
          </div>
        </div>

        {/* Caption Performance */}
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1.5">
            <Target className="w-3 h-3 text-purple-400" />
            Caption Performance
          </h3>
          <div className="bg-[#111] p-3">
            {GAME_CONFIG.captions.map(caption => {
              const rate = captionWinRates[caption];
              return (
                <CaptionBar
                  key={caption}
                  caption={caption}
                  winRate={rate?.winRate || 0}
                  avgDiff={rate?.avgDifferential || 0}
                  isStrength={caption === bestCaption}
                  isWeakness={caption === worstCaption}
                />
              );
            })}
          </div>
        </div>

        {/* Achievements */}
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1.5">
            <Medal className="w-3 h-3 text-yellow-400" />
            Achievements
          </h3>
          <div className="flex flex-wrap gap-2">
            <AchievementBadge
              label="Clutch"
              value={clutchWins}
              icon={Flame}
              color="orange"
            />
            <AchievementBadge
              label="Blowout"
              value={blowoutWins}
              icon={Zap}
              color="red"
            />
            <AchievementBadge
              label="Comeback"
              value={comebackWins}
              icon={TrendingUp}
              color="green"
            />
            {longestWinStreak >= 3 && (
              <AchievementBadge
                label="Win Streak"
                value={`W${longestWinStreak}`}
                icon={Crown}
                color="yellow"
              />
            )}
          </div>
        </div>

        {/* Current Streak */}
        {currentStreak > 0 && currentStreakType && (
          <div className={`p-3 ${
            currentStreakType === 'W' ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Current Streak</span>
              <span className={`text-lg font-bold flex items-center gap-1 ${
                currentStreakType === 'W' ? 'text-green-400' : 'text-red-400'
              }`}>
                {currentStreakType === 'W' && <Flame className="w-4 h-4" />}
                {currentStreakType}{currentStreak}
              </span>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default SeasonStatsCard;
