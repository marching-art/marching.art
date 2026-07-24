// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// MatchupsTab - Season overview with matchup brackets and history
// Design System: Week cards, head-to-head tracking, schedule overview

import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { m } from 'framer-motion';
import { Swords, Calendar, Radio, ChevronLeft, ChevronRight, LayoutGrid, List } from 'lucide-react';
import { getLeagueMatchups } from '../../../api/leagues';
import { getSeasonData } from '../../../api/season';
import { queryClient, queryKeys } from '../../../lib/queryClient';
import { getSeasonProgress } from '../../../utils/seasonProgress';
import { GAME_CONFIG } from '../../../config';
import {
  SeasonScheduleOverview,
  YourSeasonHistory,
  HeadToHeadSection,
  EmptyMatchupsState,
  VersusStrip,
  CORPS_CLASS_CONFIG,
} from './MatchupsTabParts';
// OPTIMIZATION #9: Lazy-load heavy MatchupDetailView component (1058 lines)
const MatchupDetailView = lazy(() => import('../MatchupDetailView'));

// Registry-derived (Phase 7.4): mirrors the server's MATCHUP_CLASSES, so
// Podium matchups render automatically when the class registry enables it.
import { ENABLED_CLASSES as CORPS_CLASSES } from '../../../utils/classRegistry';

// Season Schedule Overview - Visual week-by-week calendar
const MatchupsTab = ({
  league,
  userProfile,
  standings = [],
  memberProfiles = {},
  rivalries = [],
}) => {
  const [matchupsByClass, setMatchupsByClass] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [selectedMatchup, setSelectedMatchup] = useState(null);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [weeksWithMatchups, setWeeksWithMatchups] = useState(new Set());
  const [weeklyResults, _setWeeklyResults] = useState({});
  const [viewMode, setViewMode] = useState('week'); // 'week' | 'season'

  const isCommissioner = league?.creatorId === userProfile?.uid;

  // Check if matchup is a rivalry
  const isRivalryMatchup = (matchup) => {
    if (!userProfile?.uid || !rivalries.length || !matchup.pair) return false;
    const [p1, p2] = matchup.pair;
    const opponentId = p1 === userProfile.uid ? p2 : p2 === userProfile.uid ? p1 : null;
    return opponentId ? rivalries.some((r) => r.rivalId === opponentId) : false;
  };

  // Fetch matchups from Firestore
  useEffect(() => {
    const fetchData = async () => {
      if (!league?.id) {
        setLoading(false);
        return;
      }

      try {
        // Get current week from season data — shared 2AM-ET/UTC-normalized
        // math (utils/seasonProgress). The raw (now - startDate)/24h count
        // used here before rolled the week over at midnight UTC (8 PM ET in
        // summer), highlighting the wrong "live" week every evening.
        // Read through the shared react-query season entry — LeagueDetailView
        // fetches the same doc when the league opens, so this tab is a cache
        // hit instead of a second read.
        const sData = await queryClient.fetchQuery({
          queryKey: queryKeys.season(),
          queryFn: () => getSeasonData(),
          staleTime: 5 * 60 * 1000,
        });
        const week = sData ? Math.max(1, getSeasonProgress(sData).currentWeek) : 1;
        setCurrentWeek(week);
        setSelectedWeek(week);

        // One collection read for every generated week — this was a serial
        // per-week getDoc waterfall (up to 8 round-trips).
        const matchupsData = {};
        const weeksFound = new Set();
        const maxWeek = Math.min(week + 1, GAME_CONFIG.season.totalWeeks);

        const matchupDocs = await getLeagueMatchups(league.id);
        matchupDocs.forEach((matchupDoc) => {
          const weekMatch = matchupDoc.id.match(/^week-(\d+)$/);
          if (!weekMatch) return;
          const w = parseInt(weekMatch[1]);
          if (w < 1 || w > maxWeek) return;
          matchupsData[w] = matchupDoc;
          weeksFound.add(w);
        });

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
          status:
            selectedWeek < currentWeek
              ? 'completed'
              : selectedWeek === currentWeek
                ? 'live'
                : 'scheduled',
        }));
      }
    }

    return result;
  }, [matchupsByClass, selectedWeek, currentWeek]);

  // Get user's matchups across all classes
  const userMatchups = useMemo(() => {
    const matches = [];
    for (const [_corpsClass, matchups] of Object.entries(weekMatchups)) {
      for (const matchup of matchups) {
        if (
          matchup.pair &&
          (matchup.pair[0] === userProfile?.uid || matchup.pair[1] === userProfile?.uid)
        ) {
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
          if (
            matchup.pair &&
            (matchup.pair[0] === userProfile?.uid || matchup.pair[1] === userProfile?.uid)
          ) {
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
    const name = profile?.displayName;
    if (name && name !== 'Director') return name;
    return profile?.username || name || `User ${userId?.slice(0, 6)}`;
  };

  // Get user standing
  const getStanding = (userId) => standings.find((s) => s.uid === userId);

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
        <div className="bg-surface-card border border-line p-8 text-center">
          <Swords className="w-8 h-8 text-muted mx-auto mb-2 animate-pulse" />
          <p className="text-muted text-sm">Loading matchups...</p>
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
          rivalry={
            isRivalryMatchup(selectedMatchup)
              ? rivalries.find(
                  (r) =>
                    r.rivalId ===
                    (selectedMatchup.user1 === userProfile?.uid
                      ? selectedMatchup.user2
                      : selectedMatchup.user1)
                )
              : null
          }
        />
      </Suspense>
    );
  }

  return (
    <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4">
      {/* View Toggle */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted">
          {viewMode === 'week' ? `Week ${selectedWeek} Matchups` : 'Season Overview'}
        </h2>
        <div className="flex items-center gap-1 p-1 bg-surface-card border border-line">
          <button
            onClick={() => setViewMode('week')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold transition-colors ${
              viewMode === 'week' ? 'bg-interactive text-white' : 'text-muted hover:text-white'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            Weekly
          </button>
          <button
            onClick={() => setViewMode('season')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold transition-colors ${
              viewMode === 'season' ? 'bg-interactive text-white' : 'text-muted hover:text-white'
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
          <div className="bg-surface-card border border-line mb-4">
            <div className="px-4 py-3 border-b border-line bg-surface-raised">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-secondary" />
                  Week {selectedWeek}
                </h3>
                <div className="flex items-center gap-1">
                  <button
                    onClick={goToPrevWeek}
                    disabled={selectedWeek <= 1}
                    className="p-1 text-muted hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-muted min-w-[60px] text-center">
                    {selectedWeek === currentWeek
                      ? 'Current'
                      : selectedWeek < currentWeek
                        ? 'Past'
                        : 'Upcoming'}
                  </span>
                  <button
                    onClick={goToNextWeek}
                    disabled={selectedWeek >= GAME_CONFIG.season.totalWeeks}
                    className="p-1 text-muted hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Week Pills */}
            <div className="p-3 flex gap-1.5 overflow-x-auto scrollbar-hide">
              {Array.from({ length: GAME_CONFIG.season.totalWeeks }, (_, i) => i + 1).map(
                (week) => {
                  const hasData = weeksWithMatchups.has(week);
                  const isSelected = selectedWeek === week;
                  const isCurrent = week === currentWeek;

                  return (
                    <button
                      key={week}
                      onClick={() => setSelectedWeek(week)}
                      className={`flex-shrink-0 px-3 py-1.5 text-xs font-bold transition-all relative ${
                        isSelected
                          ? 'bg-interactive text-white'
                          : isCurrent
                            ? 'bg-surface-raised border border-purple-500/50 text-white'
                            : hasData
                              ? 'bg-surface-raised border border-line-strong text-white hover:border-line-strong'
                              : 'bg-surface-raised border border-line text-muted hover:text-white hover:border-line-strong'
                      }`}
                    >
                      W{week}
                      {isCurrent && !isSelected && (
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-purple-500 rounded-none animate-pulse" />
                      )}
                    </button>
                  );
                }
              )}
            </div>
          </div>

          {/* Your Matchups - Featured */}
          {userMatchups.length > 0 && (
            <div className="bg-surface-card border border-line mb-4">
              <div className="px-4 py-2 border-b border-line bg-surface-raised flex items-center justify-between">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted">
                  Your Matchups ({userMatchups.length})
                </h3>
                {selectedWeek === currentWeek && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-500/20 text-red-500 text-[10px] font-bold uppercase">
                    <Radio className="w-2.5 h-2.5 animate-pulse" />
                    LIVE
                  </span>
                )}
              </div>

              <div className="divide-y divide-line-subtle">
                {userMatchups.map((matchup) => (
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
          {CORPS_CLASSES.map((corpsClass) => {
            const classMatchups = weekMatchups[corpsClass] || [];
            // Filter out user's matchups (already shown above)
            const otherMatchups = classMatchups.filter(
              (m) => !m.pair || (m.pair[0] !== userProfile?.uid && m.pair[1] !== userProfile?.uid)
            );

            if (otherMatchups.length === 0) return null;

            const config = CORPS_CLASS_CONFIG[corpsClass];
            const Icon = config.icon;

            return (
              <div key={corpsClass} className="bg-surface-card border border-line mb-4">
                <div
                  className={`px-4 py-2 border-b border-line bg-surface-raised flex items-center gap-2`}
                >
                  <div className={`p-1 ${config.bgColor} border ${config.borderColor}`}>
                    <Icon className={`w-3 h-3 ${config.color}`} />
                  </div>
                  <h3 className={`text-[10px] font-bold uppercase tracking-wider ${config.color}`}>
                    {config.name} ({otherMatchups.length})
                  </h3>
                </div>

                <div className="divide-y divide-line-subtle">
                  {otherMatchups.map((matchup) => (
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
    </m.div>
  );
};

// Versus Strip Component - Compact matchup display
// OPTIMIZATION #3: Memoized to prevent re-renders when sibling matchups update
export default MatchupsTab;
