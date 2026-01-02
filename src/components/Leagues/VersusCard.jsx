// VersusCard - ESPN/Sleeper Fantasy Style Head-to-Head Matchup Card
// Features: Side-by-side scores, Win Probability bar, live/projected indicators

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Swords, Radio, Trophy, Crown, ChevronRight,
  TrendingUp, TrendingDown, Flame, Zap
} from 'lucide-react';

// Calculate win probability based on current scores and historical performance
const calculateWinProbability = (user1Score, user2Score, user1Avg, user2Avg) => {
  if (user1Score === 0 && user2Score === 0) {
    // Before match starts, use historical averages
    const total = (user1Avg || 50) + (user2Avg || 50);
    return ((user1Avg || 50) / total) * 100;
  }

  // During match, weight current score heavily
  const totalScore = user1Score + user2Score;
  if (totalScore === 0) return 50;

  // Basic probability from current scores
  const scoreProbability = (user1Score / totalScore) * 100;

  // Add some variance based on historical performance
  const historyWeight = 0.2;
  const historyProbability = user1Avg && user2Avg
    ? (user1Avg / (user1Avg + user2Avg)) * 100
    : 50;

  return scoreProbability * (1 - historyWeight) + historyProbability * historyWeight;
};

const VersusCard = ({
  matchup,
  user1,
  user2,
  user1Score = 0,
  user2Score = 0,
  user1Projected = 0,
  user2Projected = 0,
  user1Record = { wins: 0, losses: 0 },
  user2Record = { wins: 0, losses: 0 },
  user1AvgScore = 0,
  user2AvgScore = 0,
  isLive = false,
  isCompleted = false,
  isUserMatchup = false,
  isRivalry = false,
  currentUserId,
  week = 1,
  onClick,
  compact = false,
}) => {
  const isUser1 = user1?.uid === currentUserId;
  const isUser2 = user2?.uid === currentUserId;

  const user1Leading = user1Score > user2Score;
  const user2Leading = user2Score > user1Score;
  const tied = user1Score === user2Score && (user1Score > 0 || user2Score > 0);

  const scoreDiff = Math.abs(user1Score - user2Score);

  // Calculate win probability
  const winProbability = useMemo(() => {
    return calculateWinProbability(user1Score, user2Score, user1AvgScore, user2AvgScore);
  }, [user1Score, user2Score, user1AvgScore, user2AvgScore]);

  // Determine winner for completed matchups
  const user1Won = isCompleted && user1Score > user2Score;
  const user2Won = isCompleted && user2Score > user1Score;

  if (compact) {
    // Compact version for list views
    return (
      <motion.div
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onClick={onClick}
        className={`
          p-3 rounded-sm cursor-pointer transition-all border
          ${isUserMatchup
            ? 'bg-purple-500/10 border-purple-500/30 hover:border-purple-500/50'
            : 'bg-[#1a1a1a] border-[#333] hover:border-[#555]'
          }
        `}
      >
        <div className="flex items-center justify-between">
          {/* User 1 */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              isUser1 ? 'bg-purple-500/20 text-purple-500' : 'bg-[#333] text-gray-400'
            }`}>
              {user1?.displayName?.charAt(0) || 'T'}
            </div>
            <span className={`truncate text-sm font-bold ${
              isUser1 ? 'text-purple-500' : 'text-gray-300'
            }`}>
              {user1?.displayName || 'TBD'}
            </span>
          </div>

          {/* Scores */}
          <div className="flex items-center gap-2 px-3">
            <span className={`font-bold tabular-nums ${
              user1Leading ? 'text-green-500' : 'text-white'
            }`}>
              {user1Score.toFixed(1)}
            </span>
            <span className="text-gray-600 text-xs">-</span>
            <span className={`font-bold tabular-nums ${
              user2Leading ? 'text-green-500' : 'text-white'
            }`}>
              {user2Score.toFixed(1)}
            </span>
          </div>

          {/* User 2 */}
          <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
            <span className={`truncate text-sm font-bold text-right ${
              isUser2 ? 'text-purple-500' : 'text-gray-300'
            }`}>
              {user2?.displayName || 'TBD'}
            </span>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              isUser2 ? 'bg-purple-500/20 text-purple-500' : 'bg-[#333] text-gray-400'
            }`}>
              {user2?.displayName?.charAt(0) || 'T'}
            </div>
          </div>

          <ChevronRight className="w-4 h-4 text-gray-600 ml-2" />
        </div>
      </motion.div>
    );
  }

  // Full version with win probability bar
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.005 }}
      whileTap={{ scale: 0.995 }}
      onClick={onClick}
      className={`
        rounded-sm cursor-pointer transition-all overflow-hidden
        ${isRivalry
          ? 'bg-red-500/10 border-2 border-red-500/30 hover:border-red-500/50'
          : isUserMatchup
            ? 'bg-purple-500/10 border-2 border-purple-500/30 hover:border-purple-500/50'
            : 'bg-[#1a1a1a] border border-[#333] hover:border-[#555]'
        }
      `}
    >
      {/* Status Header */}
      <div className={`px-4 py-2 border-b flex items-center justify-between ${
        isRivalry ? 'border-red-500/20' : 'border-[#333]'
      }`}>
        <div className="flex items-center gap-2">
          {isLive && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-red-500/20 text-red-500 text-xs font-bold">
              <Radio className="w-3 h-3 animate-pulse" />
              LIVE
            </span>
          )}
          {isCompleted && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-[#333] text-gray-400 text-xs font-bold">
              <Trophy className="w-3 h-3" />
              FINAL
            </span>
          )}
          {!isLive && !isCompleted && (
            <span className="text-xs text-gray-500">
              Week {week} Matchup
            </span>
          )}
          {isRivalry && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-sm bg-red-500/20 text-red-500 text-xs font-bold">
              <Flame className="w-3 h-3" />
              RIVALRY
            </span>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-gray-600" />
      </div>

      {/* Main Matchup Content */}
      <div className="p-4">
        <div className="flex items-center justify-between gap-4">
          {/* User 1 Side */}
          <div className="flex-1 text-center">
            {/* Avatar */}
            <div className={`
              w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-2 transition-all
              ${user1Won
                ? 'bg-green-500/20 border-2 border-green-500/50 ring-2 ring-green-500/30'
                : user1Leading && isLive
                  ? 'bg-green-500/10 border-2 border-green-500/40'
                  : isUser1
                    ? 'bg-purple-500/20 border-2 border-purple-500/50'
                    : 'bg-[#333] border-2 border-[#555]'
              }
            `}>
              <span className={`text-xl font-bold ${
                user1Won ? 'text-green-500' : isUser1 ? 'text-purple-500' : 'text-white'
              }`}>
                {user1?.displayName?.charAt(0) || 'T'}
              </span>
              {user1Won && (
                <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                  <Crown className="w-3 h-3 text-black" />
                </div>
              )}
            </div>

            {/* Name */}
            <p className={`font-bold text-sm truncate ${
              isUser1 ? 'text-purple-500' : 'text-white'
            }`}>
              {isUser1 ? 'You' : user1?.displayName || 'TBD'}
            </p>

            {/* Record */}
            <p className="text-xs text-gray-500">
              {user1Record.wins}-{user1Record.losses}
            </p>

            {/* Score */}
            <div className="mt-2">
              <p className={`text-3xl font-bold tabular-nums ${
                user1Won ? 'text-green-500' :
                user1Leading && isLive ? 'text-green-500' :
                tied ? 'text-yellow-500' : 'text-white'
              }`}>
                {user1Score.toFixed(1)}
              </p>
              {user1Projected > 0 && !isCompleted && (
                <p className="text-xs text-gray-500 flex items-center justify-center gap-1">
                  <Zap className="w-3 h-3" />
                  Proj: {user1Projected.toFixed(1)}
                </p>
              )}
            </div>
          </div>

          {/* VS Divider */}
          <div className="flex flex-col items-center">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              isRivalry
                ? 'bg-red-500/20 border border-red-500/30'
                : 'bg-[#222] border border-[#444]'
            }`}>
              <Swords className={`w-5 h-5 ${isRivalry ? 'text-red-500' : 'text-purple-500'}`} />
            </div>
            {(isLive || isCompleted) && scoreDiff > 0 && (
              <div className="mt-2 text-center">
                <span className={`text-xs font-bold ${
                  user1Leading ? 'text-green-500' : 'text-red-500'
                }`}>
                  {user1Leading ? '+' : '-'}{scoreDiff.toFixed(1)}
                </span>
              </div>
            )}
            {tied && (isLive || isCompleted) && (
              <span className="mt-2 text-xs font-bold text-yellow-500">
                TIE
              </span>
            )}
          </div>

          {/* User 2 Side */}
          <div className="flex-1 text-center">
            {/* Avatar */}
            <div className={`
              w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-2 relative transition-all
              ${user2Won
                ? 'bg-green-500/20 border-2 border-green-500/50 ring-2 ring-green-500/30'
                : user2Leading && isLive
                  ? 'bg-green-500/10 border-2 border-green-500/40'
                  : isUser2
                    ? 'bg-purple-500/20 border-2 border-purple-500/50'
                    : 'bg-[#333] border-2 border-[#555]'
              }
            `}>
              <span className={`text-xl font-bold ${
                user2Won ? 'text-green-500' : isUser2 ? 'text-purple-500' : 'text-white'
              }`}>
                {user2?.displayName?.charAt(0) || 'T'}
              </span>
              {user2Won && (
                <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                  <Crown className="w-3 h-3 text-black" />
                </div>
              )}
            </div>

            {/* Name */}
            <p className={`font-bold text-sm truncate ${
              isUser2 ? 'text-purple-500' : 'text-white'
            }`}>
              {isUser2 ? 'You' : user2?.displayName || 'TBD'}
            </p>

            {/* Record */}
            <p className="text-xs text-gray-500">
              {user2Record.wins}-{user2Record.losses}
            </p>

            {/* Score */}
            <div className="mt-2">
              <p className={`text-3xl font-bold tabular-nums ${
                user2Won ? 'text-green-500' :
                user2Leading && isLive ? 'text-green-500' :
                tied ? 'text-yellow-500' : 'text-white'
              }`}>
                {user2Score.toFixed(1)}
              </p>
              {user2Projected > 0 && !isCompleted && (
                <p className="text-xs text-gray-500 flex items-center justify-center gap-1">
                  <Zap className="w-3 h-3" />
                  Proj: {user2Projected.toFixed(1)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Win Probability Bar */}
        {(isLive || user1Score > 0 || user2Score > 0) && (
          <div className="mt-4 pt-3 border-t border-[#333]">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className={`font-bold ${
                winProbability >= 50 ? 'text-green-500' : 'text-gray-500'
              }`}>
                {winProbability.toFixed(0)}%
              </span>
              <span className="text-gray-600 uppercase tracking-wide text-[10px]">
                Win Probability
              </span>
              <span className={`font-bold ${
                winProbability < 50 ? 'text-green-500' : 'text-gray-500'
              }`}>
                {(100 - winProbability).toFixed(0)}%
              </span>
            </div>
            <div className="h-2 rounded-sm overflow-hidden flex bg-[#222]">
              <motion.div
                initial={{ width: '50%' }}
                animate={{ width: `${winProbability}%` }}
                transition={{ type: 'spring', damping: 20 }}
                className={`h-full ${
                  isUser1 ? 'bg-purple-500' :
                  winProbability >= 50 ? 'bg-green-500' : 'bg-gray-600'
                }`}
              />
              <motion.div
                initial={{ width: '50%' }}
                animate={{ width: `${100 - winProbability}%` }}
                transition={{ type: 'spring', damping: 20 }}
                className={`h-full ${
                  isUser2 ? 'bg-purple-500' :
                  winProbability < 50 ? 'bg-green-500' : 'bg-gray-600'
                }`}
              />
            </div>
          </div>
        )}
      </div>

      {/* View Details Footer */}
      <div className={`px-4 py-2 text-center border-t ${
        isRivalry ? 'border-red-500/20' : 'border-[#333]'
      }`}>
        <span className={`text-xs ${
          isRivalry ? 'text-red-500' : 'text-purple-500'
        }`}>
          Tap to view matchup details →
        </span>
      </div>
    </motion.div>
  );
};

// Memoize to prevent re-renders when parent list updates
export default React.memo(VersusCard);
