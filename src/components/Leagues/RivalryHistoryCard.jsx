// RivalryHistoryCard - Head-to-Head Rivalry History Display
// Shows historical matchup data, caption domination, streaks, and all past matchups

import React, { useMemo } from 'react';
import { m } from 'framer-motion';
import { Swords, Trophy, Flame, TrendingUp, Target, Award, Zap } from 'lucide-react';
import { GAME_CONFIG } from '../../config';

/**
 * Caption domination bar showing who wins each caption more often
 */
const CaptionDominationBar = ({
  caption,
  user1Wins,
  user2Wins,
  user1Name: _user1Name,
  user2Name: _user2Name,
}) => {
  const total = user1Wins + user2Wins;
  const user1Pct = total > 0 ? (user1Wins / total) * 100 : 50;
  const tied = user1Wins === user2Wins;

  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-bold text-muted w-8">{caption}</span>
        <div className="flex items-center gap-2 text-[10px]">
          <span className={`font-bold ${user1Wins > user2Wins ? 'text-green-400' : 'text-muted'}`}>
            {user1Wins}
          </span>
          <span className="text-muted">-</span>
          <span className={`font-bold ${user2Wins > user1Wins ? 'text-red-400' : 'text-muted'}`}>
            {user2Wins}
          </span>
        </div>
      </div>
      <div className="h-1.5 bg-surface-raised rounded-full overflow-hidden flex">
        <m.div
          initial={{ width: 0 }}
          animate={{ width: `${user1Pct}%` }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className={`h-full ${
            tied ? 'bg-charcoal-500' : user1Pct > 50 ? 'bg-green-500' : 'bg-green-500/30'
          }`}
        />
        <m.div
          initial={{ width: 0 }}
          animate={{ width: `${100 - user1Pct}%` }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className={`h-full ${
            tied ? 'bg-charcoal-500' : user1Pct < 50 ? 'bg-red-500' : 'bg-red-500/30'
          }`}
        />
      </div>
    </div>
  );
};

/**
 * Single matchup history item
 */
const MatchupHistoryItem = ({
  week,
  winnerId,
  user1BattlePoints,
  user2BattlePoints,
  user1Score,
  user2Score,
  user1Id,
  user1Name: _user1Name,
  user2Name: _user2Name,
  isUser1CurrentUser,
}) => {
  const user1Won = winnerId === user1Id;
  const isTie = winnerId === null;
  const margin = Math.abs(user1BattlePoints - user2BattlePoints);
  const isClutch = !isTie && margin <= 2;
  const isBlowout = margin >= 5;

  return (
    <div
      className={`flex items-center justify-between py-2 px-3 border-b border-line-subtle last:border-0 ${
        isUser1CurrentUser
          ? user1Won
            ? 'bg-green-500/5'
            : isTie
              ? 'bg-surface-raised'
              : 'bg-red-500/5'
          : ''
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-bold text-muted w-8">W{week}</span>
        <div className="flex items-center gap-1.5">
          {isClutch && <Flame className="w-3 h-3 text-orange-400" />}
          {isBlowout && <Zap className="w-3 h-3 text-red-400" />}
          <span
            className={`text-xs font-bold ${
              isTie ? 'text-secondary' : user1Won ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {isTie ? 'TIE' : user1Won ? 'W' : 'L'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Battle Points */}
        <div className="text-center">
          <p className="text-[9px] text-muted uppercase">BP</p>
          <p className="text-sm font-bold font-data tabular-nums">
            <span
              className={user1BattlePoints > user2BattlePoints ? 'text-green-400' : 'text-muted'}
            >
              {user1BattlePoints}
            </span>
            <span className="text-muted">-</span>
            <span className={user2BattlePoints > user1BattlePoints ? 'text-red-400' : 'text-muted'}>
              {user2BattlePoints}
            </span>
          </p>
        </div>

        {/* Total Scores */}
        <div className="text-center">
          <p className="text-[9px] text-muted uppercase">Score</p>
          <p className="text-sm font-data tabular-nums text-muted">
            {user1Score.toFixed(1)} - {user2Score.toFixed(1)}
          </p>
        </div>
      </div>
    </div>
  );
};

/**
 * Main RivalryHistoryCard component
 */
const RivalryHistoryCard = ({
  headToHead, // ExtendedHeadToHead object
  user1DisplayName,
  user2DisplayName,
  currentUserId,
  compact = false,
}) => {
  // Hooks must run on every render, before any early return (rules-of-hooks).
  // Guard against a null/empty headToHead since this runs before the check below.
  const captionDominationCounts = useMemo(() => {
    let user1Dominant = 0;
    let user2Dominant = 0;
    let tied = 0;

    const domination = headToHead?.captionDomination;
    if (domination) {
      Object.values(domination).forEach((dom) => {
        if (dom.dominantUserId === headToHead.user1Id) user1Dominant++;
        else if (dom.dominantUserId === headToHead.user2Id) user2Dominant++;
        else tied++;
      });
    }

    return { user1Dominant, user2Dominant, tied };
  }, [headToHead]);

  if (!headToHead || headToHead.totalMatchups === 0) {
    return (
      <div className="bg-surface-card border border-line p-6 text-center">
        <Swords className="w-8 h-8 text-muted mx-auto mb-2" />
        <p className="text-sm text-muted">No head-to-head history yet</p>
        <p className="text-xs text-muted mt-1">This is the first matchup between these directors</p>
      </div>
    );
  }

  const {
    user1Id,
    user2Id,
    user1Wins,
    user2Wins,
    ties,
    totalMatchups,
    user1TotalBattlePoints,
    user2TotalBattlePoints,
    captionDomination,
    avgMargin,
    currentStreak,
    matchupHistory,
  } = headToHead;

  const isUser1CurrentUser = currentUserId === user1Id;
  const overallLeader = user1Wins > user2Wins ? user1Id : user2Wins > user1Wins ? user2Id : null;
  const user1WinPct = totalMatchups > 0 ? (user1Wins / totalMatchups) * 100 : 0;

  if (compact) {
    // Compact inline view
    return (
      <m.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        className="bg-surface-sunken border-t border-line px-4 py-3"
      >
        <div className="grid grid-cols-4 gap-3 text-center">
          <div>
            <p className="text-[10px] text-muted uppercase">Series</p>
            <p className="text-sm font-bold font-data tabular-nums">
              <span className={user1Wins > user2Wins ? 'text-green-400' : 'text-muted'}>
                {user1Wins}
              </span>
              <span className="text-muted">-</span>
              <span className={user2Wins > user1Wins ? 'text-red-400' : 'text-muted'}>
                {user2Wins}
              </span>
              {ties > 0 && <span className="text-secondary">-{ties}</span>}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted uppercase">Total BP</p>
            <p className="text-sm font-bold font-data tabular-nums">
              <span className="text-green-400">{user1TotalBattlePoints}</span>
              <span className="text-muted">-</span>
              <span className="text-red-400">{user2TotalBattlePoints}</span>
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted uppercase">Cap Lead</p>
            <p className="text-sm font-bold text-purple-400">
              {captionDominationCounts.user1Dominant}-{captionDominationCounts.user2Dominant}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted uppercase">Streak</p>
            <p
              className={`text-sm font-bold ${
                currentStreak?.userId === user1Id
                  ? 'text-green-400'
                  : currentStreak?.userId === user2Id
                    ? 'text-red-400'
                    : 'text-muted'
              }`}
            >
              {currentStreak ? `${currentStreak.count}` : '—'}
            </p>
          </div>
        </div>
      </m.div>
    );
  }

  // Full card view
  return (
    <m.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface-card border border-line overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-line bg-surface-raised">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-2">
            <Swords className="w-3.5 h-3.5 text-red-400" />
            Rivalry History
          </h3>
          <span className="text-[10px] text-muted">
            {totalMatchups} matchup{totalMatchups !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Main Stats */}
      <div className="p-4 space-y-4">
        {/* Overall Series Record */}
        <div className="bg-surface-sunken p-3">
          <div className="flex items-center justify-between mb-3">
            <div className="text-center flex-1">
              <p
                className={`text-2xl font-bold ${
                  isUser1CurrentUser
                    ? 'text-purple-400'
                    : overallLeader === user1Id
                      ? 'text-green-400'
                      : 'text-muted'
                }`}
              >
                {user1Wins}
              </p>
              <p className="text-[10px] text-muted truncate max-w-[80px]">{user1DisplayName}</p>
            </div>

            <div className="text-center px-4">
              {ties > 0 && <p className="text-lg font-bold text-secondary">{ties}</p>}
              <p className="text-[10px] text-muted uppercase">{ties > 0 ? 'Ties' : 'vs'}</p>
            </div>

            <div className="text-center flex-1">
              <p
                className={`text-2xl font-bold ${
                  !isUser1CurrentUser && currentUserId === user2Id
                    ? 'text-purple-400'
                    : overallLeader === user2Id
                      ? 'text-green-400'
                      : 'text-muted'
                }`}
              >
                {user2Wins}
              </p>
              <p className="text-[10px] text-muted truncate max-w-[80px]">{user2DisplayName}</p>
            </div>
          </div>

          {/* Win Percentage Bar */}
          <div className="h-2 bg-surface-raised rounded-full overflow-hidden flex">
            <m.div
              initial={{ width: 0 }}
              animate={{ width: `${user1WinPct}%` }}
              transition={{ duration: 0.5 }}
              className={`h-full ${
                user1Wins === user2Wins
                  ? 'bg-charcoal-500'
                  : user1Wins > user2Wins
                    ? 'bg-green-500'
                    : 'bg-green-500/30'
              }`}
            />
            <m.div
              initial={{ width: 0 }}
              animate={{ width: `${100 - user1WinPct}%` }}
              transition={{ duration: 0.5 }}
              className={`h-full ${
                user1Wins === user2Wins
                  ? 'bg-charcoal-500'
                  : user2Wins > user1Wins
                    ? 'bg-red-500'
                    : 'bg-red-500/30'
              }`}
            />
          </div>
        </div>

        {/* Battle Points & Streak Row */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-surface-sunken p-2.5 text-center">
            <Trophy className="w-4 h-4 text-secondary mx-auto mb-1" />
            <p className="text-[10px] text-muted uppercase mb-0.5">Total BP</p>
            <p className="text-sm font-bold font-data tabular-nums">
              <span className="text-green-400">{user1TotalBattlePoints}</span>
              <span className="text-muted">-</span>
              <span className="text-red-400">{user2TotalBattlePoints}</span>
            </p>
          </div>

          <div className="bg-surface-sunken p-2.5 text-center">
            <TrendingUp className="w-4 h-4 text-blue-400 mx-auto mb-1" />
            <p className="text-[10px] text-muted uppercase mb-0.5">Avg Margin</p>
            <p
              className={`text-sm font-bold ${
                avgMargin > 0 ? 'text-green-400' : avgMargin < 0 ? 'text-red-400' : 'text-muted'
              }`}
            >
              {avgMargin > 0 ? '+' : ''}
              {avgMargin.toFixed(1)}
            </p>
          </div>

          <div className="bg-surface-sunken p-2.5 text-center">
            <Flame className="w-4 h-4 text-orange-400 mx-auto mb-1" />
            <p className="text-[10px] text-muted uppercase mb-0.5">Streak</p>
            {currentStreak ? (
              <p
                className={`text-sm font-bold flex items-center justify-center gap-0.5 ${
                  currentStreak.userId === user1Id ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {currentStreak.count}
                <span className="text-[10px] text-muted">
                  (
                  {currentStreak.userId === user1Id
                    ? user1DisplayName.slice(0, 3)
                    : user2DisplayName.slice(0, 3)}
                  )
                </span>
              </p>
            ) : (
              <p className="text-sm font-bold text-muted">—</p>
            )}
          </div>
        </div>

        {/* Caption Domination */}
        <div>
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted mb-2 flex items-center gap-1.5">
            <Target className="w-3 h-3 text-purple-400" />
            Caption Domination
          </h4>
          <div className="bg-surface-sunken p-3">
            <div className="flex items-center justify-between mb-2 text-[10px] text-muted">
              <span className="truncate max-w-[80px]">{user1DisplayName}</span>
              <span className="truncate max-w-[80px]">{user2DisplayName}</span>
            </div>
            {GAME_CONFIG.captions.map((caption) => {
              const dom = captionDomination[caption];
              return (
                <CaptionDominationBar
                  key={caption}
                  caption={caption}
                  user1Wins={dom?.user1Wins || 0}
                  user2Wins={dom?.user2Wins || 0}
                  user1Name={user1DisplayName}
                  user2Name={user2DisplayName}
                />
              );
            })}
            <div className="mt-2 pt-2 border-t border-line-subtle flex items-center justify-between text-[10px]">
              <span className="text-muted">Captions Led:</span>
              <span>
                <span className="text-green-400 font-bold">
                  {captionDominationCounts.user1Dominant}
                </span>
                <span className="text-muted mx-1">-</span>
                <span className="text-red-400 font-bold">
                  {captionDominationCounts.user2Dominant}
                </span>
                {captionDominationCounts.tied > 0 && (
                  <span className="text-muted ml-1">({captionDominationCounts.tied} tied)</span>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Matchup History */}
        <div>
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted mb-2 flex items-center gap-1.5">
            <Award className="w-3 h-3 text-secondary" />
            Match History
          </h4>
          <div className="bg-surface-sunken divide-y divide-line-subtle">
            {matchupHistory
              .slice()
              .reverse()
              .map((match, _idx) => (
                <MatchupHistoryItem
                  key={match.week}
                  {...match}
                  user1Id={user1Id}
                  user1Name={user1DisplayName}
                  user2Name={user2DisplayName}
                  isUser1CurrentUser={isUser1CurrentUser}
                />
              ))}
          </div>
        </div>
      </div>
    </m.div>
  );
};

export default RivalryHistoryCard;
