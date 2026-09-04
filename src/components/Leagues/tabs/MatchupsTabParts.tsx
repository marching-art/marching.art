// Presentational sections for the league Matchups tab: schedule overview,
// season history, head-to-head, and the empty state. The weekly versus strip
// lives in VersusStrip.tsx; shared shapes and config in matchupsTabConfig.ts.

import React, { useMemo } from 'react';
import { Calendar, History, Target, Clock, Swords, Users, Zap } from 'lucide-react';
// Two matchup shapes legitimately meet in this file: the raw `pair`-keyed
// documents the weekly strip renders, and the flattened `user1`/`user2`
// pairings utils/leagueStats derives for the tables.
import type { LeagueMatchup } from '../../../utils/leagueStats';
import { useLeagueInviteCode } from '../../../hooks/useLeagues';
import { Heading } from '../../ui';
import type { MemberProfiles, TabMatchup, TabStanding } from './matchupsTabConfig';

export type { TabMatchup } from './matchupsTabConfig';

const SeasonScheduleOverview = ({
  currentWeek,
  totalWeeks,
  weeksWithMatchups,
  onSelectWeek,
  selectedWeek,
}: {
  currentWeek: number;
  totalWeeks: number;
  weeksWithMatchups: Set<number>;
  onSelectWeek: (week: number) => void;
  selectedWeek: number;
}) => {
  return (
    <div className="bg-surface-card border border-line mb-4">
      <div className="px-4 py-3 border-b border-line bg-surface-raised">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
              Season Schedule
            </span>
          </div>
          <span className="text-xs text-muted">
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
                    ? 'bg-interactive text-white'
                    : isCurrent
                      ? 'bg-purple-500/30 border-2 border-purple-500 text-white'
                      : hasData && isPast
                        ? 'bg-green-500/20 border border-green-500/30 text-green-500'
                        : hasData
                          ? 'bg-blue-500/20 border border-blue-500/30 text-blue-400'
                          : isPast
                            ? 'bg-surface-raised border border-line text-muted'
                            : 'bg-surface-raised border border-line text-muted hover:border-line-strong'
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
        <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-line text-[9px] text-muted">
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
            <div className="w-3 h-3 bg-surface-raised border border-line" />
            <span>No matchups</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Your Season History - Shows user's matchup record by week
const YourSeasonHistory = ({
  userMatchupHistory,
  memberProfiles,
  userProfile,
  onMatchupClick,
}: {
  userMatchupHistory: Array<TabMatchup & { week: number; result?: string }>;
  memberProfiles?: MemberProfiles;
  userProfile?: { uid?: string } | null;
  onMatchupClick?: (matchup: TabMatchup) => void;
}) => {
  if (!userMatchupHistory || userMatchupHistory.length === 0) return null;

  const getDisplayName = (uid?: string) => {
    if (uid === userProfile?.uid) return 'You';
    const profile = uid ? memberProfiles?.[uid] : undefined;
    const name = profile?.displayName;
    if (name && name !== 'Director') return name;
    return profile?.username || name || `User ${uid?.slice(0, 6)}`;
  };

  return (
    <div className="bg-surface-card border border-line mb-4">
      <div className="px-4 py-3 border-b border-line bg-surface-raised">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-purple-500" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
            Your Season History
          </span>
        </div>
      </div>

      <div className="p-3">
        <div className="flex gap-1 overflow-x-auto pb-2">
          {userMatchupHistory.map((match, idx) => {
            const opponentId =
              match.pair?.[0] === userProfile?.uid ? match.pair?.[1] : match.pair?.[0];
            const isBye = !opponentId;
            const won = match.winner === userProfile?.uid;
            // Ties are stored as winner:'tie' (both the automatic weekly
            // close and the commissioner callable); legacy docs used null.
            const tie = match.completed && (match.winner === 'tie' || !match.winner);
            const lost = !tie && match.winner && match.winner !== userProfile?.uid;

            return (
              <button
                key={idx}
                onClick={() => !isBye && onMatchupClick?.(match)}
                disabled={isBye}
                className={`flex-shrink-0 w-16 p-2 text-center transition-colors ${
                  isBye
                    ? 'bg-surface-raised cursor-default'
                    : won
                      ? 'bg-green-500/10 border border-green-500/30 hover:bg-green-500/20'
                      : lost
                        ? 'bg-red-500/10 border border-red-500/30 hover:bg-red-500/20'
                        : tie
                          ? 'bg-surface-raised border border-line hover:bg-line'
                          : 'bg-surface-raised border border-line hover:border-line-strong'
                }`}
              >
                <p className="text-[9px] text-muted mb-0.5">Wk {match.week}</p>
                {isBye ? (
                  <p className="text-xs text-muted">BYE</p>
                ) : (
                  <>
                    <p
                      className={`text-xs font-bold truncate ${
                        won
                          ? 'text-green-500'
                          : lost
                            ? 'text-red-500'
                            : tie
                              ? 'text-secondary'
                              : 'text-muted'
                      }`}
                    >
                      {won ? 'W' : lost ? 'L' : tie ? 'T' : 'vs'}
                    </p>
                    <p className="text-[9px] text-muted truncate">{getDisplayName(opponentId)}</p>
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
}: {
  standings?: TabStanding[];
  memberProfiles?: MemberProfiles;
  userProfile?: { uid?: string } | null;
  weeklyMatchups?: Record<number, LeagueMatchup[]>;
  weeklyResults?: Record<number, Record<string, number>>;
  onSelectOpponent?: (uid: string) => void;
}) => {
  // Calculate head-to-head records
  const h2hRecords = useMemo(() => {
    if (!userProfile?.uid || !weeklyMatchups) return [];

    const records: Record<
      string,
      { wins: number; losses: number; ties: number; lastWeek: number }
    > = {};

    Object.entries(weeklyMatchups).forEach(([week, matchups]) => {
      matchups.forEach((matchup) => {
        if (matchup.user1 !== userProfile.uid && matchup.user2 !== userProfile.uid) return;

        const opponentId = matchup.user1 === userProfile.uid ? matchup.user2 : matchup.user1;
        if (!opponentId) return;

        if (!records[opponentId]) {
          records[opponentId] = { wins: 0, losses: 0, ties: 0, lastWeek: 0 };
        }

        // The matchup's own stored result is authoritative — it is what was
        // folded into the standings. Fall back to the derived weekly scores
        // only for a week that has not resolved yet.
        if (matchup.completed && matchup.winner) {
          if (matchup.winner === userProfile.uid) records[opponentId].wins++;
          else if (matchup.winner === opponentId) records[opponentId].losses++;
          else records[opponentId].ties++;
        } else {
          const weekNum = Number(week);
          const userScore = weeklyResults?.[weekNum]?.[userProfile.uid] || 0;
          const oppScore = weeklyResults?.[weekNum]?.[opponentId] || 0;

          if (userScore > oppScore) records[opponentId].wins++;
          else if (oppScore > userScore) records[opponentId].losses++;
          else if (userScore > 0 || oppScore > 0) records[opponentId].ties++;
        }

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

  const getDisplayName = (uid?: string) => {
    const profile = uid ? memberProfiles?.[uid] : undefined;
    const name = profile?.displayName;
    if (name && name !== 'Director') return name;
    return profile?.username || name || `User ${uid?.slice(0, 6)}`;
  };

  return (
    <div className="bg-surface-card border border-line mb-4">
      <div className="px-4 py-3 border-b border-line bg-surface-raised">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-orange-500" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
            Head to Head Records
          </span>
        </div>
      </div>

      <div className="divide-y divide-line-subtle">
        {h2hRecords.slice(0, 5).map((record) => {
          const winPct =
            record.totalGames > 0 ? ((record.wins / record.totalGames) * 100).toFixed(0) : 0;
          const isWinning = record.wins > record.losses;
          const isLosing = record.losses > record.wins;

          return (
            <div
              key={record.opponentId}
              className="px-4 py-3 flex items-center justify-between hover:bg-surface-raised transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-line flex items-center justify-center">
                  <span className="text-xs font-bold text-muted">
                    {getDisplayName(record.opponentId).charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="font-bold text-sm text-white">
                    {getDisplayName(record.opponentId)}
                  </p>
                  <p className="text-[10px] text-muted">
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
                    <span className="text-muted">-</span>
                    <span className="text-sm font-bold text-red-500 font-data tabular-nums">
                      {record.losses}
                    </span>
                    {record.ties > 0 && (
                      <>
                        <span className="text-muted">-</span>
                        <span className="text-sm font-bold text-secondary font-data tabular-nums">
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
                        : 'bg-charcoal-500/20 text-muted'
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
const EmptyMatchupsState = ({
  selectedWeek,
  currentWeek,
  league,
  isCommissioner,
}: {
  selectedWeek: number;
  currentWeek: number;
  league?: { id?: string; members?: string[] } | null;
  isCommissioner?: boolean;
}) => {
  const inviteCode = useLeagueInviteCode(league);
  const isPastWeek = selectedWeek < currentWeek;
  const isCurrentWeek = selectedWeek === currentWeek;
  const isFutureWeek = selectedWeek > currentWeek;

  return (
    <div className="bg-surface-card border border-line p-8 text-center">
      <div
        className={`w-16 h-16 mx-auto mb-4 flex items-center justify-center ${
          isCommissioner && isCurrentWeek
            ? 'bg-warning/10 border-2 border-warning/30'
            : 'bg-surface-raised border border-line'
        }`}
      >
        <Swords
          className={`w-8 h-8 ${isCommissioner && isCurrentWeek ? 'text-warning' : 'text-muted'}`}
        />
      </div>

      <Heading level="title" as="h3" className="mb-2">
        {isPastWeek && 'No Matchups Recorded'}
        {isCurrentWeek && 'Matchups Not Generated Yet'}
        {isFutureWeek && 'Upcoming Week'}
      </Heading>

      <p className="text-sm text-muted mb-4 max-w-sm mx-auto">
        {isPastWeek && 'This week had no matchups generated or recorded.'}
        {isCurrentWeek &&
          ((league?.members?.length ?? 0) < 2
            ? 'Need at least 2 league members to generate matchups.'
            : isCommissioner
              ? "Generate matchups to start this week's competition!"
              : 'Waiting for the commissioner to generate matchups for this week.')}
        {isFutureWeek && 'Matchups will be automatically generated each Sunday at midnight ET.'}
      </p>

      {isCurrentWeek && (
        <div className="flex flex-col items-center gap-3">
          {(league?.members?.length ?? 0) >= 2 ? (
            <>
              <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/30">
                <Users className="w-4 h-4 text-green-500" />
                <span className="text-xs text-green-400">
                  {league?.members?.length ?? 0} members ready to compete
                </span>
              </div>
              {isCommissioner && (
                <div className="flex flex-col items-center gap-2">
                  <p className="text-xs text-muted">
                    Go to Settings → Generate Matchups to create this week's schedule
                  </p>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-raised border border-line text-xs text-secondary">
                    <Zap className="w-3.5 h-3.5" />
                    Uses smart pairing based on standings
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-2 bg-warning/10 border border-warning/30">
                <Users className="w-4 h-4 text-warning" />
                <span className="text-xs text-warning">
                  Invite {2 - (league?.members?.length || 0)} more member
                  {2 - (league?.members?.length || 0) !== 1 ? 's' : ''} to start
                </span>
              </div>
              {inviteCode && (
                <p className="text-xs text-muted">
                  Share code: <span className="font-mono text-muted">{inviteCode}</span>
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {isFutureWeek && (
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center justify-center gap-2 text-xs text-muted">
            <Clock className="w-4 h-4" />
            <span>Week {selectedWeek} matchups will be set automatically</span>
          </div>
          <p className="text-xs text-muted">Matchups are generated every Sunday at 11:59 PM ET</p>
        </div>
      )}
    </div>
  );
};

export { SeasonScheduleOverview, YourSeasonHistory, HeadToHeadSection, EmptyMatchupsState };
