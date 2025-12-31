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
          p-3 rounded-xl cursor-pointer transition-all border
          ${isUserMatchup
            ? 'bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-purple-500/30 hover:border-purple-500/50'
            : 'bg-charcoal-900/30 border-cream-500/10 hover:border-cream-500/30'
          }
        `}
      >
        <div className="flex items-center justify-between">
          {/* User 1 */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              isUser1 ? 'bg-purple-500/20 text-purple-400' : 'bg-charcoal-800 text-cream-500/60'
            }`}>
              {user1?.displayName?.charAt(0) || 'T'}
            </div>
            <span className={`truncate text-sm font-display ${
              isUser1 ? 'text-purple-400 font-semibold' : 'text-cream-300'
            }`}>
              {user1?.displayName || 'TBD'}
            </span>
          </div>

          {/* Scores */}
          <div className="flex items-center gap-2 px-3">
            <span className={`font-display font-bold tabular-nums ${
              user1Leading ? 'text-green-400' : 'text-cream-100'
            }`}>
              {user1Score.toFixed(1)}
            </span>
            <span className="text-cream-500/40 text-xs">-</span>
            <span className={`font-display font-bold tabular-nums ${
              user2Leading ? 'text-green-400' : 'text-cream-100'
            }`}>
              {user2Score.toFixed(1)}
            </span>
          </div>

          {/* User 2 */}
          <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
            <span className={`truncate text-sm font-display text-right ${
              isUser2 ? 'text-purple-400 font-semibold' : 'text-cream-300'
            }`}>
              {user2?.displayName || 'TBD'}
            </span>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              isUser2 ? 'bg-purple-500/20 text-purple-400' : 'bg-charcoal-800 text-cream-500/60'
            }`}>
              {user2?.displayName?.charAt(0) || 'T'}
            </div>
          </div>

          <ChevronRight className="w-4 h-4 text-cream-500/30 ml-2" />
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
        rounded-xl cursor-pointer transition-all overflow-hidden
        ${isRivalry
          ? 'bg-gradient-to-r from-red-500/10 to-orange-500/10 border-2 border-red-500/30 hover:border-red-500/50'
          : isUserMatchup
            ? 'bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-2 border-purple-500/30 hover:border-purple-500/50'
            : 'glass border border-cream-500/10 hover:border-cream-500/30'
        }
      `}
    >
      {/* Status Header */}
      <div className={`px-4 py-2 border-b flex items-center justify-between ${
        isRivalry ? 'border-red-500/20' : 'border-cream-500/10'
      }`}>
        <div className="flex items-center gap-2">
          {isLive && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs font-semibold">
              <Radio className="w-3 h-3 animate-pulse" />
              LIVE
            </span>
          )}
          {isCompleted && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-cream-500/10 text-cream-400 text-xs font-semibold">
              <Trophy className="w-3 h-3" />
              FINAL
            </span>
          )}
          {!isLive && !isCompleted && (
            <span className="text-xs text-cream-500/50">
              Week {week} Matchup
            </span>
          )}
          {isRivalry && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs font-semibold">
              <Flame className="w-3 h-3" />
              RIVALRY
            </span>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-cream-500/30" />
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
                ? 'bg-gradient-to-br from-green-500/30 to-green-600/20 border-2 border-green-500/50 ring-2 ring-green-500/30'
                : user1Leading && isLive
                  ? 'bg-gradient-to-br from-green-500/20 to-green-600/10 border-2 border-green-500/40'
                  : isUser1
                    ? 'bg-purple-500/20 border-2 border-purple-500/50'
                    : 'bg-charcoal-800 border-2 border-cream-500/20'
              }
            `}>
              <span className={`text-xl font-display font-bold ${
                user1Won ? 'text-green-400' : isUser1 ? 'text-purple-400' : 'text-cream-100'
              }`}>
                {user1?.displayName?.charAt(0) || 'T'}
              </span>
              {user1Won && (
                <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                  <Crown className="w-3 h-3 text-charcoal-900" />
                </div>
              )}
            </div>

            {/* Name */}
            <p className={`font-display font-semibold text-sm truncate ${
              isUser1 ? 'text-purple-400' : 'text-cream-100'
            }`}>
              {isUser1 ? 'You' : user1?.displayName || 'TBD'}
            </p>

            {/* Record */}
            <p className="text-xs text-cream-500/50">
              {user1Record.wins}-{user1Record.losses}
            </p>

            {/* Score */}
            <div className="mt-2">
              <p className={`text-3xl font-display font-bold tabular-nums ${
                user1Won ? 'text-green-400' :
                user1Leading && isLive ? 'text-green-400' :
                tied ? 'text-yellow-400' : 'text-cream-100'
              }`}>
                {user1Score.toFixed(1)}
              </p>
              {user1Projected > 0 && !isCompleted && (
                <p className="text-xs text-cream-500/40 flex items-center justify-center gap-1">
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
                : 'bg-charcoal-900/50 border border-cream-500/20'
            }`}>
              <Swords className={`w-5 h-5 ${isRivalry ? 'text-red-400' : 'text-purple-400'}`} />
            </div>
            {(isLive || isCompleted) && scoreDiff > 0 && (
              <div className="mt-2 text-center">
                <span className={`text-xs font-display font-bold ${
                  user1Leading ? 'text-green-400' : 'text-red-400'
                }`}>
                  {user1Leading ? '+' : '-'}{scoreDiff.toFixed(1)}
                </span>
              </div>
            )}
            {tied && (isLive || isCompleted) && (
              <span className="mt-2 text-xs font-display font-bold text-yellow-400">
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
                ? 'bg-gradient-to-br from-green-500/30 to-green-600/20 border-2 border-green-500/50 ring-2 ring-green-500/30'
                : user2Leading && isLive
                  ? 'bg-gradient-to-br from-green-500/20 to-green-600/10 border-2 border-green-500/40'
                  : isUser2
                    ? 'bg-purple-500/20 border-2 border-purple-500/50'
                    : 'bg-charcoal-800 border-2 border-cream-500/20'
              }
            `}>
              <span className={`text-xl font-display font-bold ${
                user2Won ? 'text-green-400' : isUser2 ? 'text-purple-400' : 'text-cream-100'
              }`}>
                {user2?.displayName?.charAt(0) || 'T'}
              </span>
              {user2Won && (
                <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                  <Crown className="w-3 h-3 text-charcoal-900" />
                </div>
              )}
            </div>

            {/* Name */}
            <p className={`font-display font-semibold text-sm truncate ${
              isUser2 ? 'text-purple-400' : 'text-cream-100'
            }`}>
              {isUser2 ? 'You' : user2?.displayName || 'TBD'}
            </p>

            {/* Record */}
            <p className="text-xs text-cream-500/50">
              {user2Record.wins}-{user2Record.losses}
            </p>

            {/* Score */}
            <div className="mt-2">
              <p className={`text-3xl font-display font-bold tabular-nums ${
                user2Won ? 'text-green-400' :
                user2Leading && isLive ? 'text-green-400' :
                tied ? 'text-yellow-400' : 'text-cream-100'
              }`}>
                {user2Score.toFixed(1)}
              </p>
              {user2Projected > 0 && !isCompleted && (
                <p className="text-xs text-cream-500/40 flex items-center justify-center gap-1">
                  <Zap className="w-3 h-3" />
                  Proj: {user2Projected.toFixed(1)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Win Probability Bar */}
        {(isLive || user1Score > 0 || user2Score > 0) && (
          <div className="mt-4 pt-3 border-t border-cream-500/10">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className={`font-display font-semibold ${
                winProbability >= 50 ? 'text-green-400' : 'text-cream-500/60'
              }`}>
                {winProbability.toFixed(0)}%
              </span>
              <span className="text-cream-500/40 uppercase tracking-wide text-[10px]">
                Win Probability
              </span>
              <span className={`font-display font-semibold ${
                winProbability < 50 ? 'text-green-400' : 'text-cream-500/60'
              }`}>
                {(100 - winProbability).toFixed(0)}%
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden flex bg-charcoal-800">
              <motion.div
                initial={{ width: '50%' }}
                animate={{ width: `${winProbability}%` }}
                transition={{ type: 'spring', damping: 20 }}
                className={`h-full rounded-l-full ${
                  isUser1 ? 'bg-purple-500' :
                  winProbability >= 50 ? 'bg-green-500' : 'bg-cream-500/30'
                }`}
              />
              <motion.div
                initial={{ width: '50%' }}
                animate={{ width: `${100 - winProbability}%` }}
                transition={{ type: 'spring', damping: 20 }}
                className={`h-full rounded-r-full ${
                  isUser2 ? 'bg-purple-500' :
                  winProbability < 50 ? 'bg-green-500' : 'bg-cream-500/30'
                }`}
              />
            </div>
          </div>
        )}
      </div>

      {/* View Details Footer */}
      <div className={`px-4 py-2 text-center border-t ${
        isRivalry ? 'border-red-500/20' : 'border-cream-500/10'
      }`}>
        <span className={`text-xs ${
          isRivalry ? 'text-red-400' : 'text-purple-400'
        }`}>
          Tap to view matchup details →
        </span>
      </div>
    </motion.div>
  );
};

export default VersusCard;
