// MatchupsTab - Season overview with matchup brackets and history
// Design System: Week cards, head-to-head tracking, schedule overview

import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Swords, Calendar, Radio, Flame, ChevronLeft, ChevronRight,
  Trophy, Award, Star, Zap, Users, Clock, Target, History,
  TrendingUp, Crown, LayoutGrid, List
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { GAME_CONFIG } from '../../../config';
// OPTIMIZATION #9: Lazy-load heavy MatchupDetailView component (1058 lines)
const MatchupDetailView = lazy(() => import('../MatchupDetailView'));

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

const CORPS_CLASSES = ['worldClass', 'openClass', 'aClass', 'soundSport'];

// Season Schedule Overview - Visual week-by-week calendar
const SeasonScheduleOverview = ({
  currentWeek,
  totalWeeks,
  weeksWithMatchups,
  onSelectWeek,
  selectedWeek
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
          {Array.from({ length: totalWeeks }, (_, i) => i + 1).map(week => {
            const hasData = weeksWithMatchups.has(week);
            const isSelected = selectedWeek === week;
            const isCurrent = week === currentWeek;
            const isPast = week < currentWeek;
            const isFuture = week > currentWeek;

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
const YourSeasonHistory = ({
  userMatchupHistory,
  memberProfiles,
  userProfile,
  onMatchupClick
}) => {
  if (!userMatchupHistory || userMatchupHistory.length === 0) return null;

  const getDisplayName = (uid) => {
    if (uid === userProfile?.uid) return 'You';
    const profile = memberProfiles[uid];
    return profile?.displayName || profile?.username || `User ${uid?.slice(0, 6)}`;
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
                    <p className={`text-xs font-bold truncate ${
                      won ? 'text-green-500' :
                      lost ? 'text-red-500' :
                      tie ? 'text-yellow-500' : 'text-gray-400'
                    }`}>
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
  standings,
  memberProfiles,
  userProfile,
  weeklyMatchups,
  weeklyResults,
  onSelectOpponent
}) => {
  // Calculate head-to-head records
  const h2hRecords = useMemo(() => {
    if (!userProfile?.uid || !weeklyMatchups) return [];

    const records = {};

    Object.entries(weeklyMatchups).forEach(([week, matchups]) => {
      matchups.forEach(matchup => {
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
        totalGames: record.wins + record.losses + record.ties
      }))
      .sort((a, b) => b.totalGames - a.totalGames);
  }, [userProfile?.uid, weeklyMatchups, weeklyResults]);

  if (h2hRecords.length === 0) return null;

  const getDisplayName = (uid) => {
    const profile = memberProfiles[uid];
    return profile?.displayName || profile?.username || `User ${uid?.slice(0, 6)}`;
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
        {h2hRecords.slice(0, 5).map(record => {
          const winPct = record.totalGames > 0
            ? (record.wins / record.totalGames * 100).toFixed(0)
            : 0;
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
                <div className={`w-12 h-6 flex items-center justify-center text-xs font-bold ${
                  isWinning
                    ? 'bg-green-500/20 text-green-500'
                    : isLosing
                    ? 'bg-red-500/20 text-red-500'
                    : 'bg-gray-500/20 text-gray-400'
                }`}>
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
      <div className="w-16 h-16 mx-auto mb-4 bg-[#222] border border-[#333] flex items-center justify-center">
        <Swords className="w-8 h-8 text-gray-500" />
      </div>

      <h3 className="text-lg font-bold text-white mb-2">
        {isPastWeek && 'No Matchups Recorded'}
        {isCurrentWeek && 'Matchups Not Generated Yet'}
        {isFutureWeek && 'Upcoming Week'}
      </h3>

      <p className="text-sm text-gray-400 mb-4 max-w-sm mx-auto">
        {isPastWeek && 'This week had no matchups generated or recorded.'}
        {isCurrentWeek && (
          league?.members?.length < 2
            ? 'Need at least 2 league members to generate matchups.'
            : isCommissioner
            ? 'As the commissioner, you can generate matchups from the league settings.'
            : 'The commissioner needs to generate matchups for this week.'
        )}
        {isFutureWeek && 'Matchups for this week will be available as the season progresses.'}
      </p>

      {isCurrentWeek && (
        <div className="flex flex-col items-center gap-2">
          {league?.members?.length >= 2 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-[#222] border border-[#333]">
              <Users className="w-4 h-4 text-green-500" />
              <span className="text-xs text-gray-400">
                {league.members.length} members ready
              </span>
            </div>
          )}
          {league?.members?.length < 2 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-yellow-500/10 border border-yellow-500/30">
              <Users className="w-4 h-4 text-yellow-500" />
              <span className="text-xs text-yellow-500">
                Invite {2 - (league?.members?.length || 0)} more member{2 - (league?.members?.length || 0) !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      )}

      {isFutureWeek && (
        <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
          <Clock className="w-4 h-4" />
          <span>Week {selectedWeek} starts soon</span>
        </div>
      )}
    </div>
  );
};

const MatchupsTab = ({ league, userProfile, standings = [], memberProfiles = {}, rivalries = [] }) => {
  const [matchupsByClass, setMatchupsByClass] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [selectedMatchup, setSelectedMatchup] = useState(null);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [weeksWithMatchups, setWeeksWithMatchups] = useState(new Set());
  const [weeklyResults, setWeeklyResults] = useState({});
  const [viewMode, setViewMode] = useState('week'); // 'week' | 'season'

  const isCommissioner = league?.creatorId === userProfile?.uid;

  // Check if matchup is a rivalry
  const isRivalryMatchup = (matchup) => {
    if (!userProfile?.uid || !rivalries.length || !matchup.pair) return false;
    const [p1, p2] = matchup.pair;
    const opponentId = p1 === userProfile.uid ? p2 : p2 === userProfile.uid ? p1 : null;
    return opponentId ? rivalries.some(r => r.rivalId === opponentId) : false;
  };

  // Fetch matchups from Firestore
  useEffect(() => {
    const fetchData = async () => {
      if (!league?.id) {
        setLoading(false);
        return;
      }

      try {
        // Get current week from season data
        const seasonRef = doc(db, 'game-settings/season');
        const seasonDoc = await getDoc(seasonRef);

        let week = 1;
        if (seasonDoc.exists()) {
          const sData = seasonDoc.data();
          const startDate = sData.schedule?.startDate?.toDate();
          if (startDate) {
            const now = new Date();
            const diffInDays = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
            week = Math.max(1, Math.ceil((diffInDays + 1) / 7));
          }
        }
        setCurrentWeek(week);
        setSelectedWeek(week);

        // Fetch matchups for all weeks up to current + 1
        const matchupsData = {};
        const weeksFound = new Set();

        for (let w = 1; w <= Math.min(week + 1, GAME_CONFIG.season.totalWeeks); w++) {
          const matchupRef = doc(db, `artifacts/marching-art/leagues/${league.id}/matchups/week-${w}`);
          const matchupDoc = await getDoc(matchupRef);

          if (matchupDoc.exists()) {
            const data = matchupDoc.data();
            matchupsData[w] = data;
            weeksFound.add(w);
          }
        }

        setMatchupsByClass(matchupsData);
        setWeeksWithMatchups(weeksFound);
      } catch (error) {
        console.error('Error fetching matchups:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [league?.id]);

  // Get matchups for selected week, organized by class
  const weekMatchups = useMemo(() => {
    const weekData = matchupsByClass[selectedWeek] || {};
    const result = {};

    for (const corpsClass of CORPS_CLASSES) {
      const classMatchups = weekData[`${corpsClass}Matchups`] || [];
      if (classMatchups.length > 0) {
        result[corpsClass] = classMatchups.map((m, idx) => ({
          ...m,
          id: `${selectedWeek}-${corpsClass}-${idx}`,
          corpsClass,
          week: selectedWeek,
          // Determine status based on week
          status: selectedWeek < currentWeek ? 'completed' :
                  selectedWeek === currentWeek ? 'live' : 'scheduled',
        }));
      }
    }

    return result;
  }, [matchupsByClass, selectedWeek, currentWeek]);

  // Get user's matchups across all classes
  const userMatchups = useMemo(() => {
    const matches = [];
    for (const [corpsClass, matchups] of Object.entries(weekMatchups)) {
      for (const matchup of matchups) {
        if (matchup.pair && (matchup.pair[0] === userProfile?.uid || matchup.pair[1] === userProfile?.uid)) {
          matches.push(matchup);
        }
      }
    }
    return matches;
  }, [weekMatchups, userProfile?.uid]);

  // Get user's matchup history across all weeks
  const userMatchupHistory = useMemo(() => {
    const history = [];
    for (let w = 1; w <= currentWeek; w++) {
      const weekData = matchupsByClass[w] || {};
      for (const corpsClass of CORPS_CLASSES) {
        const classMatchups = weekData[`${corpsClass}Matchups`] || [];
        for (const matchup of classMatchups) {
          if (matchup.pair && (matchup.pair[0] === userProfile?.uid || matchup.pair[1] === userProfile?.uid)) {
            history.push({ ...matchup, week: w, corpsClass });
          }
        }
      }
    }
    return history.sort((a, b) => a.week - b.week);
  }, [matchupsByClass, userProfile?.uid, currentWeek]);

  // Check if any matchups exist for selected week
  const hasMatchups = Object.keys(weekMatchups).length > 0;

  // Get display name
  const getDisplayName = (userId) => {
    if (!userId) return 'BYE';
    if (userId === userProfile?.uid) return 'You';
    const profile = memberProfiles[userId];
    return profile?.displayName || profile?.username || `User ${userId?.slice(0, 6)}`;
  };

  // Get user standing
  const getStanding = (userId) => standings.find(s => s.uid === userId);

  // Handle matchup click
  const handleMatchupClick = (matchup) => {
    if (!matchup.pair || !matchup.pair[1]) return; // Don't click bye matchups
    setSelectedMatchup({
      user1: matchup.pair[0],
      user2: matchup.pair[1],
      week: matchup.week,
      status: matchup.status,
      corpsClass: matchup.corpsClass,
      isUserMatchup: matchup.pair[0] === userProfile?.uid || matchup.pair[1] === userProfile?.uid,
    });
  };

  // Week navigation
  const goToPrevWeek = () => {
    if (selectedWeek > 1) setSelectedWeek(selectedWeek - 1);
  };

  const goToNextWeek = () => {
    if (selectedWeek < GAME_CONFIG.season.totalWeeks) setSelectedWeek(selectedWeek + 1);
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="bg-[#1a1a1a] border border-[#333] p-8 text-center">
          <Swords className="w-8 h-8 text-gray-500 mx-auto mb-2 animate-pulse" />
          <p className="text-gray-500 text-sm">Loading matchups...</p>
        </div>
      </div>
    );
  }

  // Show matchup detail if selected
  if (selectedMatchup) {
    return (
      <Suspense fallback={<div className="p-4 text-center text-zinc-400">Loading matchup...</div>}>
        <MatchupDetailView
          matchup={selectedMatchup}
          league={league}
          userProfile={userProfile}
          memberProfiles={memberProfiles}
          standings={standings}
          currentWeek={currentWeek}
          onBack={() => setSelectedMatchup(null)}
          rivalry={isRivalryMatchup(selectedMatchup) ? rivalries.find(r =>
            r.rivalId === (selectedMatchup.user1 === userProfile?.uid ? selectedMatchup.user2 : selectedMatchup.user1)
          ) : null}
        />
      </Suspense>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="p-4"
    >
      {/* View Toggle */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
          {viewMode === 'week' ? `Week ${selectedWeek} Matchups` : 'Season Overview'}
        </h2>
        <div className="flex items-center gap-1 p-1 bg-[#1a1a1a] border border-[#333]">
          <button
            onClick={() => setViewMode('week')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold transition-colors ${
              viewMode === 'week'
                ? 'bg-yellow-500 text-black'
                : 'text-gray-500 hover:text-white'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            Weekly
          </button>
          <button
            onClick={() => setViewMode('season')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold transition-colors ${
              viewMode === 'season'
                ? 'bg-yellow-500 text-black'
                : 'text-gray-500 hover:text-white'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Season
          </button>
        </div>
      </div>

      {/* Season Overview Mode */}
      {viewMode === 'season' && (
        <>
          <SeasonScheduleOverview
            currentWeek={currentWeek}
            totalWeeks={GAME_CONFIG.season.totalWeeks}
            weeksWithMatchups={weeksWithMatchups}
            selectedWeek={selectedWeek}
            onSelectWeek={(week) => {
              setSelectedWeek(week);
              setViewMode('week');
            }}
          />

          <YourSeasonHistory
            userMatchupHistory={userMatchupHistory}
            memberProfiles={memberProfiles}
            userProfile={userProfile}
            onMatchupClick={handleMatchupClick}
          />

          <HeadToHeadSection
            standings={standings}
            memberProfiles={memberProfiles}
            userProfile={userProfile}
            weeklyMatchups={matchupsByClass}
            weeklyResults={weeklyResults}
          />
        </>
      )}

      {/* Weekly View Mode */}
      {viewMode === 'week' && (
        <>
          {/* Week Navigator */}
          <div className="bg-[#1a1a1a] border border-[#333] mb-4">
            <div className="px-4 py-3 border-b border-[#333] bg-[#222]">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-yellow-500" />
                  Week {selectedWeek}
                </h3>
                <div className="flex items-center gap-1">
                  <button
                    onClick={goToPrevWeek}
                    disabled={selectedWeek <= 1}
                    className="p-1 text-gray-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-gray-500 min-w-[60px] text-center">
                    {selectedWeek === currentWeek ? 'Current' : selectedWeek < currentWeek ? 'Past' : 'Upcoming'}
                  </span>
                  <button
                    onClick={goToNextWeek}
                    disabled={selectedWeek >= GAME_CONFIG.season.totalWeeks}
                    className="p-1 text-gray-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Week Pills */}
            <div className="p-3 flex gap-1.5 overflow-x-auto scrollbar-hide">
              {Array.from({ length: GAME_CONFIG.season.totalWeeks }, (_, i) => i + 1).map(week => {
                const hasData = weeksWithMatchups.has(week);
                const isSelected = selectedWeek === week;
                const isCurrent = week === currentWeek;

                return (
                  <button
                    key={week}
                    onClick={() => setSelectedWeek(week)}
                    className={`flex-shrink-0 px-3 py-1.5 text-xs font-bold transition-all relative ${
                      isSelected
                        ? 'bg-yellow-500 text-black'
                        : isCurrent
                        ? 'bg-[#222] border border-purple-500/50 text-white'
                        : hasData
                        ? 'bg-[#222] border border-[#444] text-white hover:border-[#555]'
                        : 'bg-[#222] border border-[#333] text-gray-500 hover:text-white hover:border-[#444]'
                    }`}
                  >
                    W{week}
                    {isCurrent && !isSelected && (
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-purple-500 rounded-sm animate-pulse" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Your Matchups - Featured */}
          {userMatchups.length > 0 && (
            <div className="bg-[#1a1a1a] border border-[#333] mb-4">
              <div className="px-4 py-2 border-b border-[#333] bg-[#222] flex items-center justify-between">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Your Matchups ({userMatchups.length})
                </h3>
                {selectedWeek === currentWeek && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-500/20 text-red-500 text-[10px] font-bold uppercase">
                    <Radio className="w-2.5 h-2.5 animate-pulse" />
                    LIVE
                  </span>
                )}
              </div>

              <div className="divide-y divide-[#222]">
                {userMatchups.map(matchup => (
                  <VersusStrip
                    key={matchup.id}
                    matchup={matchup}
                    getDisplayName={getDisplayName}
                    getStanding={getStanding}
                    userProfile={userProfile}
                    isRivalry={isRivalryMatchup(matchup)}
                    onClick={() => handleMatchupClick(matchup)}
                    featured
                    showClass
                  />
                ))}
              </div>
            </div>
          )}

          {/* Matchups by Corps Class */}
          {CORPS_CLASSES.map(corpsClass => {
            const classMatchups = weekMatchups[corpsClass] || [];
            // Filter out user's matchups (already shown above)
            const otherMatchups = classMatchups.filter(m =>
              !m.pair || (m.pair[0] !== userProfile?.uid && m.pair[1] !== userProfile?.uid)
            );

            if (otherMatchups.length === 0) return null;

            const config = CORPS_CLASS_CONFIG[corpsClass];
            const Icon = config.icon;

            return (
              <div key={corpsClass} className="bg-[#1a1a1a] border border-[#333] mb-4">
                <div className={`px-4 py-2 border-b border-[#333] bg-[#222] flex items-center gap-2`}>
                  <div className={`p-1 ${config.bgColor} border ${config.borderColor}`}>
                    <Icon className={`w-3 h-3 ${config.color}`} />
                  </div>
                  <h3 className={`text-[10px] font-bold uppercase tracking-wider ${config.color}`}>
                    {config.name} ({otherMatchups.length})
                  </h3>
                </div>

                <div className="divide-y divide-[#222]">
                  {otherMatchups.map(matchup => (
                    <VersusStrip
                      key={matchup.id}
                      matchup={matchup}
                      getDisplayName={getDisplayName}
                      getStanding={getStanding}
                      userProfile={userProfile}
                      isRivalry={isRivalryMatchup(matchup)}
                      onClick={() => handleMatchupClick(matchup)}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {/* Empty State */}
          {!hasMatchups && (
            <EmptyMatchupsState
              selectedWeek={selectedWeek}
              currentWeek={currentWeek}
              league={league}
              isCommissioner={isCommissioner}
            />
          )}
        </>
      )}
    </motion.div>
  );
};

// Versus Strip Component - Compact matchup display
const VersusStrip = ({
  matchup,
  getDisplayName,
  getStanding,
  userProfile,
  isRivalry = false,
  onClick,
  featured = false,
  showClass = false
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
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold uppercase ${classConfig.bgColor} ${classConfig.color} border ${classConfig.borderColor}`}>
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
            <div className={`w-8 h-8 flex-shrink-0 flex items-center justify-center ${
              home.isUser ? 'bg-purple-500/20 border border-purple-500/50' : 'bg-[#333]'
            }`}>
              <span className={`text-xs font-bold ${home.isUser ? 'text-purple-400' : 'text-gray-400'}`}>
                {home.name.charAt(0)}
              </span>
            </div>
            <div className="min-w-0">
              <p className={`text-sm font-bold truncate ${
                homeWon ? 'text-green-400' : home.isUser ? 'text-purple-400' : 'text-white'
              }`}>
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
              <div className="px-2 py-1 bg-[#222] text-gray-500 text-xs">
                WIN
              </div>
            ) : matchup.completed || matchup.status === 'live' ? (
              <div className="flex items-center justify-center gap-1">
                <span className={`text-sm font-bold font-data tabular-nums ${
                  homeWon ? 'text-green-400' : isTie ? 'text-yellow-400' : 'text-gray-400'
                }`}>
                  {home.score.toFixed(0)}
                </span>
                <span className="text-gray-600">-</span>
                <span className={`text-sm font-bold font-data tabular-nums ${
                  awayWon ? 'text-green-400' : isTie ? 'text-yellow-400' : 'text-gray-400'
                }`}>
                  {away.score.toFixed(0)}
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
                <p className={`text-sm font-bold truncate ${
                  awayWon ? 'text-green-400' : away.isUser ? 'text-purple-400' : 'text-white'
                }`}>
                  {away.name}
                </p>
                {away.standing && (
                  <p className="text-[10px] text-gray-500">
                    {away.standing.wins}-{away.standing.losses}
                  </p>
                )}
              </div>
              <div className={`w-8 h-8 flex-shrink-0 flex items-center justify-center ${
                away.isUser ? 'bg-purple-500/20 border border-purple-500/50' : 'bg-[#333]'
              }`}>
                <span className={`text-xs font-bold ${away.isUser ? 'text-purple-400' : 'text-gray-400'}`}>
                  {away.name.charAt(0)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </button>
  );
};

export default MatchupsTab;
