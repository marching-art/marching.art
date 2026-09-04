// MatchupsTab - Season overview with matchup brackets and history
// Design System: Week cards, head-to-head tracking, schedule overview

import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { m } from 'framer-motion';
import { Swords, Calendar, Radio, ChevronLeft, ChevronRight, LayoutGrid, List } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getSeasonData } from '../../../api/season';
import { queryKeys } from '../../../lib/queryClient';
import { useLeagueMatchups } from '../../../hooks/useLeagueMatchups';
import { getSeasonProgress } from '../../../utils/seasonProgress';
import { GAME_CONFIG } from '../../../config';
import { isLeagueCommissioner } from '../../../utils/leaguePermissions';
import {
  SeasonScheduleOverview,
  YourSeasonHistory,
  HeadToHeadSection,
  EmptyMatchupsState,
} from './MatchupsTabParts';
import VersusStrip from './VersusStrip';
import { CORPS_CLASS_CONFIG } from './matchupsTabConfig';
// OPTIMIZATION #9: Lazy-load heavy MatchupDetailView component (1058 lines)
const MatchupDetailView = lazy(() => import('../MatchupDetailView'));

// Registry-derived (Phase 7.4): mirrors the server's MATCHUP_CLASSES, so
// Podium matchups render automatically when the class registry enables it.
import { ENABLED_CLASSES as CORPS_CLASSES } from '../../../utils/classRegistry';
import type { TabMatchup } from './matchupsTabConfig';
import type { LeagueMatchup } from '../../../utils/leagueStats';

/** A `week-N` matchup document: one array per corps class. */
interface MatchupWeekDoc {
  id: string;
  [key: string]: unknown;
}

import type { CaptionsBlock } from '../../../utils/captionWars';
import type { RivalryData } from '../../../types';

// Season Schedule Overview - Visual week-by-week calendar
interface TabStanding {
  uid: string;
  wins: number;
  losses: number;
}

interface MatchupsTabProps {
  league?: { id?: string; members?: string[]; creatorId?: string } | null;
  userProfile?: { uid?: string } | null;
  standings?: TabStanding[];
  memberProfiles?: Record<string, { displayName?: string; username?: string } | undefined>;
  rivalries?: RivalryData[];
}

/** A matchup opened into the detail view. */
interface SelectedMatchup {
  user1: string;
  user2: string;
  week: number;
  status?: string;
  corpsClass?: string;
  captions?: CaptionsBlock;
  /** Cross-class matchup fields, passed through so the detail view shows the
   *  percentile verdict rather than recomputing one from raw totals. */
  crossClass?: boolean;
  classes?: Record<string, string>;
  normalized?: Record<string, number>;
  /** Each side's per-show average, the figure the default format decided on. */
  averages?: Record<string, number>;
  /** Each side's best single show, on a league running One-Night Slate. */
  best?: Record<string, { score?: number; showName?: string | null } | undefined>;
  winner?: string | null;
  completed?: boolean;
  isUserMatchup: boolean;
}

const MatchupsTab = ({
  league,
  userProfile,
  standings = [],
  memberProfiles = {},
  rivalries = [],
}: MatchupsTabProps) => {
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [selectedMatchup, setSelectedMatchup] = useState<SelectedMatchup | null>(null);
  const [viewMode, setViewMode] = useState<'week' | 'season'>('week');

  // Both reads go through React Query, so opening this tab is a cache hit
  // against what LeagueDetailView already fetched. This used to duplicate both
  // fetches into local useState — a second copy of the season document and a
  // second copy of the matchup schedule, with their own loading flag and their
  // own idea of the current week.
  const { data: seasonData } = useQuery({
    queryKey: queryKeys.season(),
    queryFn: () => getSeasonData(),
    staleTime: 5 * 60 * 1000,
  });
  const { data: matchupDocs = [], isPending: loading } = useLeagueMatchups(league?.id);

  // Shared 2AM-ET/UTC-normalized week math (utils/seasonProgress). A raw
  // (now - startDate)/24h count rolled the week over at midnight UTC (8 PM ET
  // in summer), highlighting the wrong "live" week every evening.
  const currentWeek = useMemo(
    () => (seasonData ? Math.max(1, getSeasonProgress(seasonData).currentWeek) : 1),
    [seasonData]
  );

  const { matchupsByClass, weeksWithMatchups } = useMemo(() => {
    const byWeek: Record<number, MatchupWeekDoc> = {};
    const weeks = new Set<number>();
    const maxWeek = Math.min(currentWeek + 1, GAME_CONFIG.season.totalWeeks);

    matchupDocs.forEach((matchupDoc) => {
      const weekMatch = matchupDoc.id.match(/^week-(\d+)$/);
      if (!weekMatch) return;
      const w = parseInt(weekMatch[1]);
      if (w < 1 || w > maxWeek) return;
      byWeek[w] = matchupDoc;
      weeks.add(w);
    });

    return { matchupsByClass: byWeek, weeksWithMatchups: weeks };
  }, [matchupDocs, currentWeek]);

  // Land on the live week once the season resolves, without clobbering a week
  // the member has since picked.
  useEffect(() => {
    setSelectedWeek((prev) => prev ?? currentWeek);
  }, [currentWeek]);

  const isCommissioner = isLeagueCommissioner(league, userProfile?.uid);

  // Check if matchup is a rivalry
  const isRivalryMatchup = (matchup: TabMatchup) => {
    if (!userProfile?.uid || !rivalries.length || !matchup.pair) return false;
    const [p1, p2] = matchup.pair;
    const opponentId = p1 === userProfile.uid ? p2 : p2 === userProfile.uid ? p1 : null;
    return opponentId ? rivalries.some((r) => r.rivalId === opponentId) : false;
  };

  // Per-week scores, read off the matchup documents the backend already wrote.
  //
  // This was `useState({})` whose setter was never called, so every head-to-head
  // record in this tab rendered as 0-0-0 for every opponent, all season. The
  // resolved matchup docs carry `scores` keyed by uid (helpers/weeklyMatchups.js),
  // which is the same number the standings were folded from — so deriving it
  // here costs nothing and cannot disagree with the table.
  const weeklyResults = useMemo(() => {
    const byWeek: Record<number, Record<string, number>> = {};
    for (const [week, weekData] of Object.entries(matchupsByClass)) {
      const scores: Record<string, number> = {};
      for (const corpsClass of CORPS_CLASSES) {
        const classMatchups = (weekData?.[`${corpsClass}Matchups`] as TabMatchup[]) || [];
        for (const matchup of classMatchups) {
          for (const [uid, score] of Object.entries(matchup.scores || {})) {
            // Summed, not overwritten: a director fielding two classes has two
            // matchups in the same week.
            scores[uid] = (scores[uid] || 0) + (Number(score) || 0);
          }
        }
      }
      byWeek[Number(week)] = scores;
    }
    return byWeek;
  }, [matchupsByClass]);

  // Every week's pairings, flattened to the `user1`/`user2` shape the season
  // views read.
  //
  // The head-to-head section used to be handed `matchupsByClass` directly —
  // a map of week to the raw `week-N` DOCUMENT — and called `.forEach` on it,
  // which is a TypeError on an object. Switching the Matchups tab to its
  // Season view threw for any league that had matchup documents at all; it
  // only appeared to work for a league with none.
  const pairingsByWeek = useMemo(() => {
    const byWeek: Record<number, LeagueMatchup[]> = {};
    for (const [week, weekData] of Object.entries(matchupsByClass)) {
      const pairings: LeagueMatchup[] = [];
      for (const corpsClass of CORPS_CLASSES) {
        const classMatchups = (weekData?.[`${corpsClass}Matchups`] as TabMatchup[]) || [];
        for (const matchup of classMatchups) {
          // Byes have no opponent, so they are not head-to-head results.
          if (!matchup.pair?.[0] || !matchup.pair?.[1]) continue;
          pairings.push({
            user1: matchup.pair[0],
            user2: matchup.pair[1],
            winner: matchup.winner,
            completed: matchup.completed,
            scores: matchup.scores,
            corpsClass,
          });
        }
      }
      byWeek[Number(week)] = pairings;
    }
    return byWeek;
  }, [matchupsByClass]);

  // Get matchups for selected week, organized by class
  const weekMatchups = useMemo(() => {
    const weekData: MatchupWeekDoc = (selectedWeek ? matchupsByClass[selectedWeek] : undefined) || {
      id: '',
    };
    const result: Record<string, TabMatchup[]> = {};

    for (const corpsClass of CORPS_CLASSES) {
      const classMatchups = (weekData[`${corpsClass}Matchups`] as TabMatchup[]) || [];
      if (classMatchups.length > 0) {
        result[corpsClass] = classMatchups.map((m, idx) => ({
          ...m,
          id: `${selectedWeek}-${corpsClass}-${idx}`,
          corpsClass,
          week: selectedWeek ?? 0,
          // Determine status based on week
          status:
            (selectedWeek ?? 0) < currentWeek
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
      const weekData: MatchupWeekDoc = matchupsByClass[w] || { id: '' };
      for (const corpsClass of CORPS_CLASSES) {
        const classMatchups = (weekData[`${corpsClass}Matchups`] as TabMatchup[]) || [];
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
  const getDisplayName = (userId?: string | null) => {
    if (!userId) return 'BYE';
    if (userId === userProfile?.uid) return 'You';
    const profile = memberProfiles[userId];
    const name = profile?.displayName;
    if (name && name !== 'Director') return name;
    return profile?.username || name || `User ${userId?.slice(0, 6)}`;
  };

  // Get user standing
  const getStanding = (userId?: string | null) =>
    userId ? standings.find((s) => s.uid === userId) : undefined;

  // Handle matchup click
  const handleMatchupClick = (matchup: TabMatchup) => {
    if (!matchup.pair || !matchup.pair[1]) return; // Don't click bye matchups
    setSelectedMatchup({
      user1: matchup.pair[0],
      user2: matchup.pair[1],
      week: matchup.week ?? 0,
      status: matchup.status,
      corpsClass: matchup.corpsClass,
      // The stored caption verdicts, on a league running Caption Wars. Passed
      // through rather than recomputed so the detail card can never disagree
      // with the result on the row that opened it.
      captions: matchup.captions,
      // Same principle for cross-class and One-Night matchups: the stored
      // verdict and the per-side classes/percentiles travel with the row.
      crossClass: matchup.crossClass,
      classes: matchup.classes,
      normalized: matchup.normalized,
      averages: matchup.averages,
      best: matchup.best,
      winner: matchup.winner,
      completed: matchup.completed,
      isUserMatchup: matchup.pair[0] === userProfile?.uid || matchup.pair[1] === userProfile?.uid,
    });
  };

  // Week navigation
  const goToPrevWeek = () => {
    if ((selectedWeek ?? 1) > 1) setSelectedWeek((selectedWeek ?? 1) - 1);
  };

  const goToNextWeek = () => {
    if ((selectedWeek ?? 1) < GAME_CONFIG.season.totalWeeks)
      setSelectedWeek((selectedWeek ?? 1) + 1);
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
            selectedWeek={selectedWeek ?? currentWeek}
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
            weeklyMatchups={pairingsByWeek}
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
                    aria-label="Previous week"
                    onClick={goToPrevWeek}
                    disabled={(selectedWeek ?? 1) <= 1}
                    className="p-1 text-muted hover:text-white disabled:opacity-30 disabled:cursor-not-allowed min-w-[44px] min-h-[44px] inline-flex items-center justify-center"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-muted min-w-[60px] text-center">
                    {selectedWeek === currentWeek
                      ? 'Current'
                      : (selectedWeek ?? 1) < currentWeek
                        ? 'Past'
                        : 'Upcoming'}
                  </span>
                  <button
                    aria-label="Next week"
                    onClick={goToNextWeek}
                    disabled={(selectedWeek ?? 1) >= GAME_CONFIG.season.totalWeeks}
                    className="p-1 text-muted hover:text-white disabled:opacity-30 disabled:cursor-not-allowed min-w-[44px] min-h-[44px] inline-flex items-center justify-center"
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
              selectedWeek={selectedWeek ?? currentWeek}
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
