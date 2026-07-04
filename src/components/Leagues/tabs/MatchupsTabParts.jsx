// Presentational sections for the league Matchups tab: schedule overview,
// season history, head-to-head, empty state, and the versus strip.
// Extracted verbatim from MatchupsTab.jsx.

import React, { useMemo, memo } from 'react';
import {
  Calendar,
  History,
  Target,
  Clock,
  Swords,
  Users,
  Zap,
  Flame,
  Trophy,
  Award,
  Star,
} from 'lucide-react';
import { getSoundSportRating } from '../../../utils/scoresUtils';

// Corps class display configuration
const CORPS_CLASS_CONFIG = {
  worldClass: {
    name: 'World Class',
    icon: Trophy,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
  },
  openClass: {
    name: 'Open Class',
    icon: Award,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
  },
  aClass: {
    name: 'A Class',
    icon: Star,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
  },
  soundSport: {
    name: 'SoundSport',
    icon: Zap,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
  },
};

const SeasonScheduleOverview = ({
  currentWeek,
  totalWeeks,
  weeksWithMatchups,
  onSelectWeek,
  selectedWeek,
}) => {
  return (
    <div className="bg-[#1a1a1a] border border-[#333] mb-4">
      <div className="px-4 py-3 border-b border-[#333] bg-[#222]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Season Schedule
            </span>
          </div>
          <span className="text-xs text-gray-500">
            Week {currentWeek} of {totalWeeks}
          </span>
        </div>
      </div>

      {/* Visual Week Grid */}
      <div className="p-3">
        <div className="grid grid-cols-6 sm:grid-cols-12 gap-1">
          {Array.from({ length: totalWeeks }, (_, i) => i + 1).map((week) => {
            const hasData = weeksWithMatchups.has(week);
            const isSelected = selectedWeek === week;
            const isCurrent = week === currentWeek;
            const isPast = week < currentWeek;

            return (
              <button
                key={week}
                onClick={() => onSelectWeek(week)}
                className={`relative aspect-square flex items-center justify-center text-xs font-bold transition-all ${
                  isSelected
                    ? 'bg-yellow-500 text-black'
                    : isCurrent
                      ? 'bg-purple-500/30 border-2 border-purple-500 text-white'
                      : hasData && isPast
                        ? 'bg-green-500/20 border border-green-500/30 text-green-500'
                        : hasData
                          ? 'bg-blue-500/20 border border-blue-500/30 text-blue-400'
                          : isPast
                            ? 'bg-[#222] border border-[#333] text-gray-600'
                            : 'bg-[#222] border border-[#333] text-gray-500 hover:border-[#444]'
                }`}
              >
                {week}
                {isCurrent && !isSelected && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-purple-500 animate-pulse" />
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-[#333] text-[9px] text-gray-500">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-purple-500/30 border-2 border-purple-500" />
            <span>Current</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500/20 border border-green-500/30" />
            <span>Completed</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-500/20 border border-blue-500/30" />
            <span>Scheduled</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-[#222] border border-[#333]" />
            <span>No matchups</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Your Season History - Shows user's matchup record by week
const YourSeasonHistory = ({ userMatchupHistory, memberProfiles, userProfile, onMatchupClick }) => {
  if (!userMatchupHistory || userMatchupHistory.length === 0) return null;

  const getDisplayName = (uid) => {
    if (uid === userProfile?.uid) return 'You';
    const profile = memberProfiles[uid];
    const name = profile?.displayName;
    if (name && name !== 'Director') return name;
    return profile?.username || name || `User ${uid?.slice(0, 6)}`;
  };

  return (
    <div className="bg-[#1a1a1a] border border-[#333] mb-4">
      <div className="px-4 py-3 border-b border-[#333] bg-[#222]">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-purple-500" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Your Season History
          </span>
        </div>
      </div>

      <div className="p-3">
        <div className="flex gap-1 overflow-x-auto pb-2">
          {userMatchupHistory.map((match, idx) => {
            const opponentId = match.pair[0] === userProfile?.uid ? match.pair[1] : match.pair[0];
            const isBye = !opponentId;
            const won = match.winner === userProfile?.uid;
            const lost = match.winner && match.winner !== userProfile?.uid;
            const tie = match.completed && !match.winner;

            return (
              <button
                key={idx}
                onClick={() => !isBye && onMatchupClick?.(match)}
                disabled={isBye}
                className={`flex-shrink-0 w-16 p-2 text-center transition-colors ${
                  isBye
                    ? 'bg-[#222] cursor-default'
                    : won
                      ? 'bg-green-500/10 border border-green-500/30 hover:bg-green-500/20'
                      : lost
                        ? 'bg-red-500/10 border border-red-500/30 hover:bg-red-500/20'
                        : tie
                          ? 'bg-yellow-500/10 border border-yellow-500/30 hover:bg-yellow-500/20'
                          : 'bg-[#222] border border-[#333] hover:border-[#444]'
                }`}
              >
                <p className="text-[9px] text-gray-500 mb-0.5">Wk {match.week}</p>
                {isBye ? (
                  <p className="text-xs text-gray-500">BYE</p>
                ) : (
                  <>
                    <p
                      className={`text-xs font-bold truncate ${
                        won
                          ? 'text-green-500'
                          : lost
                            ? 'text-red-500'
                            : tie
                              ? 'text-yellow-500'
                              : 'text-gray-400'
                      }`}
                    >
                      {won ? 'W' : lost ? 'L' : tie ? 'T' : 'vs'}
                    </p>
                    <p className="text-[9px] text-gray-500 truncate">
                      {getDisplayName(opponentId)}
                    </p>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// Head to Head Section - Shows record against each opponent
const HeadToHeadSection = ({
  standings: _standings,
  memberProfiles,
  userProfile,
  weeklyMatchups,
  weeklyResults,
  onSelectOpponent: _onSelectOpponent,
}) => {
  // Calculate head-to-head records
  const h2hRecords = useMemo(() => {
    if (!userProfile?.uid || !weeklyMatchups) return [];

    const records = {};

    Object.entries(weeklyMatchups).forEach(([week, matchups]) => {
      matchups.forEach((matchup) => {
        if (matchup.user1 !== userProfile.uid && matchup.user2 !== userProfile.uid) return;

        const opponentId = matchup.user1 === userProfile.uid ? matchup.user2 : matchup.user1;
        if (!opponentId) return;

        if (!records[opponentId]) {
          records[opponentId] = { wins: 0, losses: 0, ties: 0, lastWeek: 0 };
        }

        const userScore = weeklyResults?.[week]?.[userProfile.uid] || 0;
        const oppScore = weeklyResults?.[week]?.[opponentId] || 0;

        if (userScore > oppScore) records[opponentId].wins++;
        else if (oppScore > userScore) records[opponentId].losses++;
        else if (userScore > 0 || oppScore > 0) records[opponentId].ties++;

        records[opponentId].lastWeek = Math.max(records[opponentId].lastWeek, parseInt(week));
      });
    });

    return Object.entries(records)
      .map(([opponentId, record]) => ({
        opponentId,
        ...record,
        totalGames: record.wins + record.losses + record.ties,
      }))
      .sort((a, b) => b.totalGames - a.totalGames);
  }, [userProfile?.uid, weeklyMatchups, weeklyResults]);

  if (h2hRecords.length === 0) return null;

  const getDisplayName = (uid) => {
    const profile = memberProfiles[uid];
    const name = profile?.displayName;
    if (name && name !== 'Director') return name;
    return profile?.username || name || `User ${uid?.slice(0, 6)}`;
  };

  return (
    <div className="bg-[#1a1a1a] border border-[#333] mb-4">
      <div className="px-4 py-3 border-b border-[#333] bg-[#222]">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-orange-500" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Head to Head Records
          </span>
        </div>
      </div>

      <div className="divide-y divide-[#222]">
        {h2hRecords.slice(0, 5).map((record) => {
          const winPct =
            record.totalGames > 0 ? ((record.wins / record.totalGames) * 100).toFixed(0) : 0;
          const isWinning = record.wins > record.losses;
          const isLosing = record.losses > record.wins;

          return (
            <div
              key={record.opponentId}
              className="px-4 py-3 flex items-center justify-between hover:bg-[#222] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-[#333] flex items-center justify-center">
                  <span className="text-xs font-bold text-gray-400">
                    {getDisplayName(record.opponentId).charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="font-bold text-sm text-white">
                    {getDisplayName(record.opponentId)}
                  </p>
                  <p className="text-[10px] text-gray-500">
                    {record.totalGames} matchup{record.totalGames !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-bold text-green-500 font-data tabular-nums">
                      {record.wins}
                    </span>
                    <span className="text-gray-600">-</span>
                    <span className="text-sm font-bold text-red-500 font-data tabular-nums">
                      {record.losses}
                    </span>
                    {record.ties > 0 && (
                      <>
                        <span className="text-gray-600">-</span>
                        <span className="text-sm font-bold text-yellow-500 font-data tabular-nums">
                          {record.ties}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div
                  className={`w-12 h-6 flex items-center justify-center text-xs font-bold ${
                    isWinning
                      ? 'bg-green-500/20 text-green-500'
                      : isLosing
                        ? 'bg-red-500/20 text-red-500'
                        : 'bg-gray-500/20 text-gray-400'
                  }`}
                >
                  {winPct}%
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Empty State Component
const EmptyMatchupsState = ({ selectedWeek, currentWeek, league, isCommissioner }) => {
  const isPastWeek = selectedWeek < currentWeek;
  const isCurrentWeek = selectedWeek === currentWeek;
  const isFutureWeek = selectedWeek > currentWeek;

  return (
    <div className="bg-[#1a1a1a] border border-[#333] p-8 text-center">
      <div
        className={`w-16 h-16 mx-auto mb-4 flex items-center justify-center ${
          isCommissioner && isCurrentWeek
            ? 'bg-yellow-500/10 border-2 border-yellow-500/30'
            : 'bg-[#222] border border-[#333]'
        }`}
      >
        <Swords
          className={`w-8 h-8 ${isCommissioner && isCurrentWeek ? 'text-yellow-500' : 'text-gray-500'}`}
        />
      </div>

      <h3 className="text-lg font-bold text-white mb-2">
        {isPastWeek && 'No Matchups Recorded'}
        {isCurrentWeek && 'Matchups Not Generated Yet'}
        {isFutureWeek && 'Upcoming Week'}
      </h3>

      <p className="text-sm text-gray-400 mb-4 max-w-sm mx-auto">
        {isPastWeek && 'This week had no matchups generated or recorded.'}
        {isCurrentWeek &&
          (league?.members?.length < 2
            ? 'Need at least 2 league members to generate matchups.'
            : isCommissioner
              ? "Generate matchups to start this week's competition!"
              : 'Waiting for the commissioner to generate matchups for this week.')}
        {isFutureWeek && 'Matchups will be automatically generated each Sunday at midnight ET.'}
      </p>

      {isCurrentWeek && (
        <div className="flex flex-col items-center gap-3">
          {league?.members?.length >= 2 ? (
            <>
              <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/30">
                <Users className="w-4 h-4 text-green-500" />
                <span className="text-xs text-green-400">
                  {league.members.length} members ready to compete
                </span>
              </div>
              {isCommissioner && (
                <div className="flex flex-col items-center gap-2">
                  <p className="text-xs text-gray-500">
                    Go to Settings → Generate Matchups to create this week's schedule
                  </p>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/30 text-xs text-yellow-500">
                    <Zap className="w-3.5 h-3.5" />
                    Uses smart pairing based on standings
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-2 bg-yellow-500/10 border border-yellow-500/30">
                <Users className="w-4 h-4 text-yellow-500" />
                <span className="text-xs text-yellow-500">
                  Invite {2 - (league?.members?.length || 0)} more member
                  {2 - (league?.members?.length || 0) !== 1 ? 's' : ''} to start
                </span>
              </div>
              {league?.inviteCode && (
                <p className="text-xs text-gray-500">
                  Share code: <span className="font-mono text-gray-400">{league.inviteCode}</span>
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {isFutureWeek && (
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
            <Clock className="w-4 h-4" />
            <span>Week {selectedWeek} matchups will be set automatically</span>
          </div>
          <p className="text-xs text-gray-600">
            Matchups are generated every Sunday at 11:59 PM ET
          </p>
        </div>
      )}
    </div>
  );
};

const VersusStrip = memo(
  ({
    matchup,
    getDisplayName,
    getStanding,
    userProfile,
    isRivalry = false,
    onClick,
    featured = false,
    showClass = false,
  }) => {
    const [p1_uid, p2_uid] = matchup.pair || [null, null];
    const isBye = !p2_uid;

    const home = {
      name: getDisplayName(p1_uid),
      standing: getStanding(p1_uid),
      isUser: p1_uid === userProfile?.uid,
      score: matchup.scores?.[p1_uid] || 0,
    };

    const away = {
      name: getDisplayName(p2_uid),
      standing: p2_uid ? getStanding(p2_uid) : null,
      isUser: p2_uid === userProfile?.uid,
      score: matchup.scores?.[p2_uid] || 0,
    };

    const homeWon = matchup.completed && matchup.winner === p1_uid;
    const awayWon = matchup.completed && matchup.winner === p2_uid;
    const isTie = matchup.completed && matchup.winner === 'tie';

    const classConfig = CORPS_CLASS_CONFIG[matchup.corpsClass];
    // SoundSport is a ratings-only format — a SoundSport matchup must show the
    // earned rating tiers, never the numeric scores.
    const isSoundSport = matchup.corpsClass === 'soundSport';

    return (
      <button
        onClick={onClick}
        disabled={isBye}
        className={`w-full text-left transition-colors ${
          isBye
            ? 'opacity-50 cursor-default'
            : isRivalry
              ? 'bg-red-500/5 hover:bg-red-500/10'
              : featured
                ? 'bg-purple-500/5 hover:bg-purple-500/10'
                : 'hover:bg-[#222]'
        }`}
      >
        <div className={`px-4 py-3 ${featured ? 'py-4' : ''}`}>
          {/* Class + Rivalry indicators */}
          <div className="flex items-center gap-2 mb-2">
            {showClass && classConfig && (
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold uppercase ${classConfig.bgColor} ${classConfig.color} border ${classConfig.borderColor}`}
              >
                {classConfig.name}
              </span>
            )}
            {isRivalry && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-red-500">
                <Flame className="w-3 h-3" />
                Rivalry
              </span>
            )}
            {isBye && (
              <span className="text-[10px] font-bold uppercase text-gray-500">BYE WEEK</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Home */}
            <div className="flex-1 flex items-center gap-2">
              <div
                className={`w-8 h-8 flex-shrink-0 flex items-center justify-center ${
                  home.isUser ? 'bg-purple-500/20 border border-purple-500/50' : 'bg-[#333]'
                }`}
              >
                <span
                  className={`text-xs font-bold ${home.isUser ? 'text-purple-400' : 'text-gray-400'}`}
                >
                  {home.name.charAt(0)}
                </span>
              </div>
              <div className="min-w-0">
                <p
                  className={`text-sm font-bold truncate ${
                    homeWon ? 'text-green-400' : home.isUser ? 'text-purple-400' : 'text-white'
                  }`}
                >
                  {home.name}
                </p>
                {home.standing && (
                  <p className="text-[10px] text-gray-500">
                    {home.standing.wins}-{home.standing.losses}
                  </p>
                )}
              </div>
            </div>

            {/* Score / VS */}
            <div className="flex-shrink-0 text-center min-w-[70px]">
              {isBye ? (
                <div className="px-2 py-1 bg-[#222] text-gray-500 text-xs">WIN</div>
              ) : matchup.completed || matchup.status === 'live' ? (
                <div className="flex items-center justify-center gap-1">
                  <span
                    className={`font-bold ${
                      isSoundSport ? 'text-[10px] uppercase' : 'text-sm font-data tabular-nums'
                    } ${homeWon ? 'text-green-400' : isTie ? 'text-yellow-400' : 'text-gray-400'}`}
                  >
                    {isSoundSport
                      ? home.score > 0
                        ? getSoundSportRating(home.score)
                        : '—'
                      : home.score.toFixed(0)}
                  </span>
                  <span className="text-gray-600">-</span>
                  <span
                    className={`font-bold ${
                      isSoundSport ? 'text-[10px] uppercase' : 'text-sm font-data tabular-nums'
                    } ${awayWon ? 'text-green-400' : isTie ? 'text-yellow-400' : 'text-gray-400'}`}
                  >
                    {isSoundSport
                      ? away.score > 0
                        ? getSoundSportRating(away.score)
                        : '—'
                      : away.score.toFixed(0)}
                  </span>
                </div>
              ) : (
                <div className="px-2 py-1 bg-[#222]">
                  <Swords className="w-3.5 h-3.5 text-gray-500 mx-auto" />
                </div>
              )}
              {matchup.status === 'live' && !featured && (
                <span className="text-[9px] text-red-500 font-bold">LIVE</span>
              )}
            </div>

            {/* Away */}
            {!isBye && (
              <div className="flex-1 flex items-center gap-2 justify-end">
                <div className="min-w-0 text-right">
                  <p
                    className={`text-sm font-bold truncate ${
                      awayWon ? 'text-green-400' : away.isUser ? 'text-purple-400' : 'text-white'
                    }`}
                  >
                    {away.name}
                  </p>
                  {away.standing && (
                    <p className="text-[10px] text-gray-500">
                      {away.standing.wins}-{away.standing.losses}
                    </p>
                  )}
                </div>
                <div
                  className={`w-8 h-8 flex-shrink-0 flex items-center justify-center ${
                    away.isUser ? 'bg-purple-500/20 border border-purple-500/50' : 'bg-[#333]'
                  }`}
                >
                  <span
                    className={`text-xs font-bold ${away.isUser ? 'text-purple-400' : 'text-gray-400'}`}
                  >
                    {away.name.charAt(0)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </button>
    );
  }
);

export {
  CORPS_CLASS_CONFIG,
  SeasonScheduleOverview,
  YourSeasonHistory,
  HeadToHeadSection,
  EmptyMatchupsState,
  VersusStrip,
};
