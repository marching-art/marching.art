// MatchupCard - Compact matchup summary card for lists and previews
import React, { useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Swords, Trophy, Check, Radio, Clock, ChevronRight } from 'lucide-react';

const MatchupCard = React.memo(({
  matchup,
  currentUserId,
  homeUser,
  awayUser,
  onClick,
  compact = false
}) => {
  const isCurrentUserHome = matchup.homeUserId === currentUserId;
  const isCurrentUserAway = matchup.awayUserId === currentUserId;
  const isParticipant = isCurrentUserHome || isCurrentUserAway;

  const userScore = isCurrentUserHome ? matchup.homeScore : matchup.awayScore;
  const opponentScore = isCurrentUserHome ? matchup.awayScore : matchup.homeScore;
  const userIsWinning = userScore > opponentScore;
  const isTied = userScore === opponentScore;

  const opponent = isCurrentUserHome ? awayUser : homeUser;
  const user = isCurrentUserHome ? homeUser : awayUser;

  const isLive = matchup.status === 'live';
  const isCompleted = matchup.status === 'completed';
  const isScheduled = matchup.status === 'scheduled';

  const userWon = isCompleted && matchup.winnerId === currentUserId;
  const userLost = isCompleted && matchup.winnerId && matchup.winnerId !== currentUserId;

  // Memoize click handler
  const handleClick = useCallback(() => {
    onClick?.();
  }, [onClick]);

  // Status indicator colors and text
  const getStatusDisplay = () => {
    if (isLive) {
      return {
        color: 'text-red-400',
        bgColor: 'bg-red-500/20',
        icon: Radio,
        text: 'LIVE'
      };
    }
    if (isCompleted) {
      return {
        color: userWon ? 'text-green-400' : 'text-red-400',
        bgColor: userWon ? 'bg-green-500/20' : 'bg-red-500/20',
        icon: userWon ? Trophy : Check,
        text: userWon ? 'WIN' : 'LOSS'
      };
    }
    return {
      color: 'text-cream-500/60',
      bgColor: 'bg-cream-500/10',
      icon: Clock,
      text: `Week ${matchup.week}`
    };
  };

  const status = getStatusDisplay();
  const StatusIcon = status.icon;

  // Score difference display
  const scoreDiff = Math.abs(userScore - opponentScore).toFixed(1);
  const diffDisplay = userIsWinning ? `+${scoreDiff}` : isTied ? 'TIED' : `-${scoreDiff}`;

  if (compact) {
    return (
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleClick}
        className={`p-3 rounded-lg cursor-pointer transition-all border ${
          isLive
            ? 'bg-red-500/10 border-red-500/30 hover:border-red-500/50'
            : userWon
            ? 'bg-green-500/10 border-green-500/30 hover:border-green-500/50'
            : userLost
            ? 'bg-red-500/10 border-red-500/20 hover:border-red-500/30'
            : 'bg-charcoal-900/50 border-cream-500/10 hover:border-cream-500/30'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Swords className={`w-4 h-4 ${isLive ? 'text-red-400' : 'text-purple-400'}`} />
            <div>
              <p className="text-sm font-semibold text-cream-100">
                vs @{opponent?.displayName || 'Unknown'}
              </p>
              <p className="text-xs text-cream-500/60">Week {matchup.week}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(isLive || isCompleted) && (
              <div className="text-right">
                <p className={`text-sm font-bold ${userIsWinning ? 'text-green-400' : isTied ? 'text-cream-400' : 'text-red-400'}`}>
                  {diffDisplay}
                </p>
              </div>
            )}
            <div className={`px-2 py-1 rounded-full text-xs font-semibold ${status.bgColor} ${status.color}`}>
              {isLive && <span className="inline-block w-1.5 h-1.5 bg-red-400 rounded-full mr-1 animate-pulse" />}
              {status.text}
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      whileHover={{ scale: 1.01, y: -2 }}
      whileTap={{ scale: 0.99 }}
      onClick={handleClick}
      className={`relative p-4 rounded-xl cursor-pointer transition-all border-2 ${
        isLive
          ? 'bg-gradient-to-br from-red-500/10 to-charcoal-900/50 border-red-500/40 hover:border-red-500/60'
          : userWon
          ? 'bg-gradient-to-br from-green-500/10 to-charcoal-900/50 border-green-500/30 hover:border-green-500/50'
          : userLost
          ? 'bg-gradient-to-br from-red-500/5 to-charcoal-900/50 border-red-500/20 hover:border-red-500/30'
          : 'bg-charcoal-900/30 border-cream-500/20 hover:border-cream-500/40'
      }`}
    >
      {/* Live pulse animation */}
      {isLive && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
          </span>
          <span className="text-xs font-bold text-red-400 uppercase tracking-wide">Live</span>
        </div>
      )}

      {/* Status badge for completed */}
      {isCompleted && (
        <div className={`absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 rounded-full ${status.bgColor}`}>
          <StatusIcon className={`w-3.5 h-3.5 ${status.color}`} />
          <span className={`text-xs font-bold uppercase tracking-wide ${status.color}`}>
            {status.text}
          </span>
        </div>
      )}

      {/* Week label */}
      <div className="flex items-center gap-2 mb-3">
        <Swords className="w-4 h-4 text-purple-400" />
        <span className="text-xs font-display font-semibold text-cream-400 uppercase tracking-wide">
          Week {matchup.week} Matchup
        </span>
      </div>

      {/* Matchup display */}
      <div className="flex items-center justify-between gap-4">
        {/* User side */}
        <div className={`flex-1 text-center ${isParticipant && isCurrentUserHome ? '' : 'order-2'}`}>
          <div className="w-12 h-12 rounded-full bg-charcoal-800 flex items-center justify-center mx-auto mb-2 border-2 border-cream-500/30">
            <span className="text-lg font-bold text-cream-100">
              {(isCurrentUserHome ? user : homeUser)?.displayName?.charAt(0) || 'Y'}
            </span>
          </div>
          <p className="text-sm font-semibold text-cream-100 truncate">
            {isCurrentUserHome ? 'You' : homeUser?.displayName || 'Home'}
          </p>
          <p className="text-xs text-cream-500/60 truncate">
            {homeUser?.corpsName || 'Corps'}
          </p>
          {(isLive || isCompleted) && (
            <p className={`text-2xl font-display font-bold mt-2 ${
              matchup.homeScore > matchup.awayScore ? 'text-green-400' :
              matchup.homeScore < matchup.awayScore ? 'text-cream-400' : 'text-cream-300'
            }`}>
              {matchup.homeScore.toFixed(1)}
            </p>
          )}
        </div>

        {/* VS divider */}
        <div className="flex flex-col items-center px-4">
          <span className="text-lg font-display font-bold text-cream-500/60">VS</span>
          {(isLive || isCompleted) && !isTied && (
            <div className={`mt-2 px-2 py-1 rounded text-xs font-bold ${
              userIsWinning ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            }`}>
              {diffDisplay} {userIsWinning && '✓'}
            </div>
          )}
          {(isLive || isCompleted) && isTied && (
            <div className="mt-2 px-2 py-1 rounded text-xs font-bold bg-cream-500/20 text-cream-400">
              TIED
            </div>
          )}
        </div>

        {/* Opponent side */}
        <div className={`flex-1 text-center ${isParticipant && isCurrentUserAway ? '' : 'order-3'}`}>
          <div className="w-12 h-12 rounded-full bg-charcoal-800 flex items-center justify-center mx-auto mb-2 border-2 border-cream-500/30">
            <span className="text-lg font-bold text-cream-500/60">
              {(isCurrentUserAway ? user : awayUser)?.displayName?.charAt(0) || '?'}
            </span>
          </div>
          <p className="text-sm font-semibold text-cream-100 truncate">
            {isCurrentUserAway ? 'You' : `@${awayUser?.displayName || 'Away'}`}
          </p>
          <p className="text-xs text-cream-500/60 truncate">
            {awayUser?.corpsName || 'Corps'}
          </p>
          {(isLive || isCompleted) && (
            <p className={`text-2xl font-display font-bold mt-2 ${
              matchup.awayScore > matchup.homeScore ? 'text-green-400' :
              matchup.awayScore < matchup.homeScore ? 'text-cream-400' : 'text-cream-300'
            }`}>
              {matchup.awayScore.toFixed(1)}
            </p>
          )}
        </div>
      </div>

      {/* View details prompt */}
      <div className="flex items-center justify-center gap-2 mt-4 pt-3 border-t border-cream-500/10">
        <span className="text-xs text-cream-500/60">View matchup details</span>
        <ChevronRight className="w-4 h-4 text-cream-500/40" />
      </div>
    </motion.div>
  );
});
MatchupCard.displayName = 'MatchupCard';

export default MatchupCard;
