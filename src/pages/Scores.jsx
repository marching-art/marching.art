// =============================================================================
// SCORES - CONSOLIDATED RECAP TERMINAL
// =============================================================================
// High-density data grid for scores with caption breakdowns (GE, VIS, MUS)
// Laws: App Shell, Pill Tab Segmented Control, High-Density Tables, no glow

import React, { useState, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Calendar, Activity, Archive } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useProfileStore } from '../store/profileStore';
import { useSeasonStore } from '../store/seasonStore';
import { formatEventName } from '../utils/season';
import { useScoresData } from '../hooks/useScoresData';
import { PullToRefresh } from '../components/ui/PullToRefresh';
import { useHaptic } from '../hooks/useHaptic';
import { usePodiumEnabled } from '../hooks/useFeatures';
import { useEscapeKey } from '../hooks/useEscapeKey';
import {
  PillTabControl,
  RecapDataGrid,
  EasternCombinedSheet,
  SoundSportMedalList,
  ClassStandingsGrid,
} from './ScoresParts';
import { lazyWithRetry } from '../utils/lazyWithRetry';

// Lazy-load Hall of Champions — only loaded if the user opens that tab.
// lazyWithRetry recovers from stale-chunk 404s after a deploy (see utils/lazyWithRetry).
const HallOfChampions = lazyWithRetry(() => import('./HallOfChampions'), 'HallOfChampionsTab');
// Podium Class recap sheets (flag-gated tab) — full-caption DCI-style box scores.
const PodiumRecapSheet = lazyWithRetry(
  () => import('../components/Podium/PodiumRecapSheet'),
  'PodiumRecapSheet'
);

// =============================================================================
// CONSTANTS
// =============================================================================

const TABS = [
  { id: 'latest', label: 'Latest' },
  { id: 'world', label: 'World' },
  { id: 'open', label: 'Open' },
  { id: 'aclass', label: 'A Class' },
  { id: 'soundsport', label: 'SoundSport', accent: 'green' },
  { id: 'archive', label: 'Archive', accent: 'yellow' },
  { id: 'champions', label: 'Hall of Champions', accent: 'yellow' },
];

// Inserted after SoundSport when game-settings/features.podiumClass is on.
// Podium shows ALL 8 captions (its scores are earned, not drafted); the
// fantasy tabs stay condensed to GE/VIS/MUS — the anti-lineup-harvesting
// rule (design §5.4).
const PODIUM_TAB = { id: 'podium', label: 'Podium', accent: 'yellow' };

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

// Blue Ribbon icon for Best in Show awards

// =============================================================================
// MAIN SCORES COMPONENT
// =============================================================================

const Scores = () => {
  const { user } = useAuth();
  const profile = useProfileStore((state) => state.profile);
  const completeDailyChallenge = useProfileStore((state) => state.completeDailyChallenge);
  const formatSeasonName = useSeasonStore((state) => state.formatSeasonName);
  const [searchParams] = useSearchParams();
  const { trigger: haptic } = useHaptic();

  const targetShowName = searchParams.get('show');
  const targetSeasonId = searchParams.get('season');
  const targetTab = searchParams.get('tab');

  const podiumEnabled = usePodiumEnabled();
  const tabs = useMemo(() => {
    if (!podiumEnabled) return TABS;
    const archiveIndex = TABS.findIndex((t) => t.id === 'archive');
    return [...TABS.slice(0, archiveIndex), PODIUM_TAB, ...TABS.slice(archiveIndex)];
  }, [podiumEnabled]);
  const validTabIds = useMemo(() => tabs.map((t) => t.id), [tabs]);
  const [activeTab, setActiveTab] = useState(() =>
    validTabIds.includes(targetTab) ? targetTab : 'latest'
  );

  // React to ?tab= changes when navigating within the app.
  // Intentionally excludes `activeTab`: including it would re-sync to the URL
  // param whenever the user manually switches tabs, overriding their choice.
  useEffect(() => {
    if (targetTab && validTabIds.includes(targetTab) && targetTab !== activeTab) {
      setActiveTab(targetTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetTab, validTabIds]);
  const [selectedShow, setSelectedShow] = useState(null);
  const [selectedArchiveSeason, setSelectedArchiveSeason] = useState(null);
  const [selectedArchiveYear, setSelectedArchiveYear] = useState(null);
  const [archiveViewTab, setArchiveViewTab] = useState('latest'); // Sub-tab within archive

  // Close the full-recap modal on Escape
  useEscapeKey(() => setSelectedShow(null), !!selectedShow);

  const {
    loading,
    error,
    unfilteredShows,
    stats,
    aggregatedScores,
    refetch,
    isArchived,
    displayedSeasonId,
    archivedSeasons,
    selectSeason,
    currentSeasonUid,
  } = useScoresData({
    seasonId: targetSeasonId,
    classFilter: 'all',
    enabledCaptions: { ge: true, vis: true, mus: true },
    // Disable auto-fallback so Latest tab starts fresh on new season
    disableArchiveFallback: activeTab !== 'archive',
  });

  const handleRefresh = async () => {
    haptic('pull');
    await refetch?.();
    haptic('success');
  };

  // Determine displayed season name - could be current or archived
  const displayedSeasonName = useMemo(() => {
    if (isArchived && displayedSeasonId) {
      // Find the archived season name
      const archivedSeason = archivedSeasons.find((s) => s.id === displayedSeasonId);
      if (archivedSeason?.seasonName) {
        return archivedSeason.seasonName;
      }
      // Fallback: parse from ID (e.g., "adagio_2025-26" -> "Adagio 2025-26")
      const parts = displayedSeasonId.split('_');
      if (parts.length === 2) {
        return `${parts[0].charAt(0).toUpperCase() + parts[0].slice(1)} ${parts[1]}`;
      }
      return displayedSeasonId;
    }
    return formatSeasonName?.() || 'Current Season';
  }, [formatSeasonName, isArchived, displayedSeasonId, archivedSeasons]);

  const userCorpsName = useMemo(() => {
    if (!profile?.corps) return null;
    const activeCorps = Object.values(profile.corps).find((c) => c?.lineup);
    return activeCorps?.corpsName || null;
  }, [profile?.corps]);

  useEffect(() => {
    // Soft no-op server-side when 'visit-scores' isn't in today's rotation
    if (user && profile && completeDailyChallenge) {
      completeDailyChallenge('visit-scores');
    }
  }, [user, profile, completeDailyChallenge]);

  useEffect(() => {
    if (targetShowName) {
      setActiveTab('latest');
    }
  }, [targetShowName]);

  // Group archived seasons by year (parsed from id suffix like "adagio_2025-26",
  // falling back to the archivedAt year). Years render newest-first; seasons
  // within each year keep their archivedAt-desc order.
  const archivedSeasonsByYear = useMemo(() => {
    const yearOf = (season) => {
      const parts = season.id.split('_');
      const suffix = parts.length > 1 ? parts.slice(1).join('_') : '';
      if (/^\d{4}/.test(suffix)) return suffix;
      return season.archivedAt instanceof Date && !isNaN(season.archivedAt)
        ? String(season.archivedAt.getFullYear())
        : 'Unknown';
    };
    const map = new Map();
    archivedSeasons.forEach((season) => {
      const year = yearOf(season);
      if (!map.has(year)) map.set(year, []);
      map.get(year).push(season);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([year, seasons]) => ({ year, seasons }));
  }, [archivedSeasons]);

  const archivedYears = useMemo(
    () => archivedSeasonsByYear.map((g) => g.year),
    [archivedSeasonsByYear]
  );

  const seasonsForSelectedYear = useMemo(() => {
    if (!selectedArchiveYear) return [];
    return archivedSeasonsByYear.find((g) => g.year === selectedArchiveYear)?.seasons || [];
  }, [archivedSeasonsByYear, selectedArchiveYear]);

  // Handle switching to/from Archive tab
  useEffect(() => {
    if (activeTab === 'archive') {
      // When entering Archive tab, select the most recent archived season if none selected
      if (!selectedArchiveSeason && archivedSeasons.length > 0) {
        const mostRecent = archivedSeasons[0];
        setSelectedArchiveSeason(mostRecent.id);
        selectSeason(mostRecent.id);
      } else if (selectedArchiveSeason) {
        selectSeason(selectedArchiveSeason);
      }
    } else {
      // When leaving Archive tab, reset to current season
      if (isArchived && currentSeasonUid) {
        selectSeason(currentSeasonUid);
      }
    }
  }, [
    activeTab,
    archivedSeasons,
    selectedArchiveSeason,
    selectSeason,
    isArchived,
    currentSeasonUid,
  ]);

  // Keep the selected year in sync with the selected season (or most-recent year
  // on first load) so the Year row always highlights the right pill.
  useEffect(() => {
    if (archivedSeasonsByYear.length === 0) return;
    if (selectedArchiveSeason) {
      const match = archivedSeasonsByYear.find((g) =>
        g.seasons.some((s) => s.id === selectedArchiveSeason)
      );
      if (match && match.year !== selectedArchiveYear) {
        setSelectedArchiveYear(match.year);
      }
    } else if (!selectedArchiveYear) {
      setSelectedArchiveYear(archivedSeasonsByYear[0].year);
    }
  }, [archivedSeasonsByYear, selectedArchiveSeason, selectedArchiveYear]);

  // Handle archive season selection change
  const handleArchiveSeasonChange = (seasonId) => {
    setSelectedArchiveSeason(seasonId);
    selectSeason(seasonId);
  };

  const handleArchiveYearChange = (year) => {
    setSelectedArchiveYear(year);
    const group = archivedSeasonsByYear.find((g) => g.year === year);
    const firstSeason = group?.seasons?.[0];
    if (firstSeason) {
      setSelectedArchiveSeason(firstSeason.id);
      selectSeason(firstSeason.id);
    }
  };

  // Filter standings by class for each tab and re-rank within each class
  const worldStandings = useMemo(
    () =>
      aggregatedScores
        .filter((s) => s.corpsClass === 'worldClass')
        .map((entry, idx) => ({ ...entry, rank: idx + 1 })),
    [aggregatedScores]
  );

  const openStandings = useMemo(
    () =>
      aggregatedScores
        .filter((s) => s.corpsClass === 'openClass')
        .map((entry, idx) => ({ ...entry, rank: idx + 1 })),
    [aggregatedScores]
  );

  const aClassStandings = useMemo(
    () =>
      aggregatedScores
        .filter((s) => s.corpsClass === 'aClass')
        .map((entry, idx) => ({ ...entry, rank: idx + 1 })),
    [aggregatedScores]
  );

  // Recap Shows - all shows from all classes (excluding SoundSport), used by Archive
  const recapShows = useMemo(() => {
    return unfilteredShows
      .filter((s) => s.scores && s.scores.length > 0)
      .map((show) => ({
        ...show,
        // Filter out SoundSport from the recap view, but keep all other classes
        scores: show.scores.filter((s) => s.corpsClass !== 'soundSport'),
      }))
      .filter((show) => show.scores.length > 0);
  }, [unfilteredShows]);

  // Latest Recaps - most recent 10 shows for the live-season "Latest" tab
  const latestShows = useMemo(() => recapShows.slice(0, 10), [recapShows]);

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#0A0A0A]">
      {/* FIXED HEADER */}
      <div className="flex-shrink-0 bg-[#1a1a1a] border-b border-[#333] px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-[#0057B8]" />
            <div>
              <h1 className="text-sm font-bold text-white uppercase tracking-wider">
                Scores & Recaps
              </h1>
              <p className="text-[10px] text-muted">
                {displayedSeasonName}
                {isArchived && <span className="ml-1 text-yellow-500">(Archived)</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="text-right">
              <div className="text-[10px] text-muted uppercase">Corps</div>
              <div className="font-bold text-white tabular-nums">{stats.corpsActive || 0}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-muted uppercase">High</div>
              <div className="font-bold text-green-400 tabular-nums">{stats.topScore || '-'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* TAB STRIP */}
      <div className="flex-shrink-0 bg-[#0A0A0A] px-3">
        <PillTabControl
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          haptic={haptic}
        />
      </div>

      {/* SCROLLABLE CONTENT - PullToRefresh owns the single scroll container.
          Bottom-nav clearance rides on the content (contentClassName) so there
          is no second outer scroller leaving a dead band above the nav. */}
      <div className="flex-1 min-h-0">
        <PullToRefresh onRefresh={handleRefresh} contentClassName="pb-20 md:pb-4">
          {loading ? (
            <div className="p-8 text-center text-muted text-sm">Loading scores...</div>
          ) : error ? (
            <div className="p-8 text-center text-red-500 text-sm">{error}</div>
          ) : (
            <>
              {/* LATEST RECAPS TAB */}
              {activeTab === 'latest' && (
                <div className="p-3 md:p-4 space-y-3">
                  {/* Eastern Classic combined standings — appears once both
                      nights (days 41-42) have processed (§5.11) */}
                  <EasternCombinedSheet shows={recapShows} userCorpsName={userCorpsName} />
                  {latestShows.length > 0 ? (
                    latestShows.map((show, idx) => (
                      <RecapDataGrid
                        key={idx}
                        scores={show.scores}
                        eventName={show.eventName}
                        location={show.location}
                        date={show.date}
                        userCorpsName={userCorpsName}
                      />
                    ))
                  ) : (
                    <div className="p-8 text-center">
                      <Calendar className="w-8 h-8 text-muted mx-auto mb-2" />
                      <p className="text-muted text-sm">No recent shows</p>
                    </div>
                  )}
                </div>
              )}

              {/* WORLD CLASS TAB */}
              {activeTab === 'world' && (
                <div className="p-3 md:p-4">
                  <ClassStandingsGrid
                    standings={worldStandings}
                    className="World Class"
                    userCorpsName={userCorpsName}
                  />
                </div>
              )}

              {/* OPEN CLASS TAB */}
              {activeTab === 'open' && (
                <div className="p-3 md:p-4">
                  <ClassStandingsGrid
                    standings={openStandings}
                    className="Open Class"
                    userCorpsName={userCorpsName}
                  />
                </div>
              )}

              {/* CLASS A TAB */}
              {activeTab === 'aclass' && (
                <div className="p-3 md:p-4">
                  <ClassStandingsGrid
                    standings={aClassStandings}
                    className="A Class"
                    userCorpsName={userCorpsName}
                  />
                </div>
              )}

              {/* SOUNDSPORT TAB */}
              {activeTab === 'soundsport' && (
                <div className="p-3 md:p-4">
                  <SoundSportMedalList shows={unfilteredShows} />
                </div>
              )}

              {/* PODIUM CLASS TAB — full-caption recap sheets (flag-gated) */}
              {activeTab === 'podium' && (
                <Suspense
                  fallback={<div className="p-8 text-center text-xs text-muted">Loading…</div>}
                >
                  <PodiumRecapSheet
                    seasonUid={currentSeasonUid}
                    seasonName={formatSeasonName?.(displayedSeasonId) || undefined}
                    userCorpsName={profile?.corps?.podiumClass?.corpsName}
                  />
                </Suspense>
              )}

              {/* ARCHIVE TAB */}
              {activeTab === 'archive' && (
                <div>
                  {/* Archive Header with Year → Season Selector */}
                  <div className="bg-[#1a1a1a] border-b border-[#333] px-4 py-3">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Archive className="w-4 h-4 text-yellow-500" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                          Historical Seasons
                        </span>
                      </div>
                      {archivedSeasons.length > 0 && (
                        <span className="text-[10px] text-muted tabular-nums">
                          {archivedSeasons.length} season{archivedSeasons.length === 1 ? '' : 's'} ·{' '}
                          {archivedYears.length} year{archivedYears.length === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>

                    {archivedSeasons.length > 0 ? (
                      <>
                        {/* Year Selector Row */}
                        <div
                          role="tablist"
                          aria-label="Archived season year"
                          className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-2 mb-2 border-b border-[#2a2a2a]"
                        >
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted pr-1">
                            Year
                          </span>
                          {archivedSeasonsByYear.map(({ year, seasons }) => (
                            <button
                              key={year}
                              role="tab"
                              aria-selected={selectedArchiveYear === year}
                              onClick={() => {
                                haptic('medium');
                                handleArchiveYearChange(year);
                              }}
                              className={`px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide whitespace-nowrap rounded-none border transition-all tabular-nums ${
                                selectedArchiveYear === year
                                  ? 'bg-yellow-500 text-black border-yellow-500'
                                  : 'bg-[#222] text-gray-300 border-[#444] hover:border-yellow-500/50 hover:text-white'
                              }`}
                            >
                              {year}
                              <span className="ml-1.5 text-[9px] opacity-70">
                                ({seasons.length})
                              </span>
                            </button>
                          ))}
                        </div>

                        {/* Season Selector Row (within selected year) */}
                        {seasonsForSelectedYear.length > 0 && (
                          <div
                            role="tablist"
                            aria-label="Archived season"
                            className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1"
                          >
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted pr-1">
                              Season
                            </span>
                            {seasonsForSelectedYear.map((season) => (
                              <button
                                key={season.id}
                                role="tab"
                                aria-selected={selectedArchiveSeason === season.id}
                                onClick={() => {
                                  haptic('medium');
                                  handleArchiveSeasonChange(season.id);
                                }}
                                className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wide whitespace-nowrap rounded-none border transition-all ${
                                  selectedArchiveSeason === season.id
                                    ? 'bg-yellow-500 text-black border-yellow-500'
                                    : 'bg-[#222] text-gray-300 border-[#444] hover:border-yellow-500/50 hover:text-white'
                                }`}
                              >
                                {season.seasonName || season.id.replace(/_/g, ' ')}
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-muted text-xs">No archived seasons available</p>
                    )}
                  </div>

                  {/* Archive Sub-tabs for different views — scrollable so five
                      tabs can't force horizontal page scroll on narrow phones */}
                  {selectedArchiveSeason && (
                    <div className="bg-[#111] border-b border-[#333] px-4 py-2">
                      <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
                        {[
                          { id: 'latest', label: 'Recaps' },
                          { id: 'world', label: 'World' },
                          { id: 'open', label: 'Open' },
                          { id: 'aclass', label: 'A Class' },
                          { id: 'soundsport', label: 'SoundSport' },
                          // Podium recap archives persist per season
                          ...(podiumEnabled ? [{ id: 'podium', label: 'Podium' }] : []),
                        ].map((tab) => (
                          <button
                            key={tab.id}
                            onClick={() => {
                              haptic('light');
                              setArchiveViewTab(tab.id);
                            }}
                            className={`px-2.5 py-1.5 min-h-touch text-[10px] font-bold uppercase tracking-wider transition-all rounded-none whitespace-nowrap flex-shrink-0 ${
                              archiveViewTab === tab.id
                                ? 'bg-[#333] text-white'
                                : 'text-muted hover:text-gray-300'
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Archive Content */}
                  {selectedArchiveSeason && !loading && (
                    <>
                      {/* Recaps View */}
                      {archiveViewTab === 'latest' && (
                        <div className="p-3 md:p-4 space-y-3">
                          <EasternCombinedSheet shows={recapShows} userCorpsName={userCorpsName} />
                          {recapShows.length > 0 ? (
                            recapShows.map((show, idx) => (
                              <RecapDataGrid
                                key={idx}
                                scores={show.scores}
                                eventName={show.eventName}
                                location={show.location}
                                date={show.date}
                                userCorpsName={userCorpsName}
                              />
                            ))
                          ) : (
                            <div className="p-8 text-center">
                              <Calendar className="w-8 h-8 text-muted mx-auto mb-2" />
                              <p className="text-muted text-sm">
                                No recaps found for this season
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* World Class View */}
                      {archiveViewTab === 'world' && (
                        <div className="p-3 md:p-4">
                          <ClassStandingsGrid
                            standings={worldStandings}
                            className="World Class"
                            userCorpsName={userCorpsName}
                          />
                        </div>
                      )}

                      {/* Open Class View */}
                      {archiveViewTab === 'open' && (
                        <div className="p-3 md:p-4">
                          <ClassStandingsGrid
                            standings={openStandings}
                            className="Open Class"
                            userCorpsName={userCorpsName}
                          />
                        </div>
                      )}

                      {/* Class A View */}
                      {archiveViewTab === 'aclass' && (
                        <div className="p-3 md:p-4">
                          <ClassStandingsGrid
                            standings={aClassStandings}
                            className="A Class"
                            userCorpsName={userCorpsName}
                          />
                        </div>
                      )}

                      {/* SoundSport View */}
                      {archiveViewTab === 'soundsport' && (
                        <div className="p-3 md:p-4">
                          <SoundSportMedalList shows={unfilteredShows} />
                        </div>
                      )}

                      {/* Podium View — recap sheets persist in podium-recaps
                          per seasonUid, so archived seasons render directly */}
                      {archiveViewTab === 'podium' && podiumEnabled && (
                        <Suspense
                          fallback={
                            <div className="p-8 text-center text-xs text-muted">Loading…</div>
                          }
                        >
                          <PodiumRecapSheet
                            seasonUid={selectedArchiveSeason}
                            seasonName={displayedSeasonName}
                            userCorpsName={profile?.corps?.podiumClass?.corpsName}
                          />
                        </Suspense>
                      )}
                    </>
                  )}

                  {/* No season selected state */}
                  {!selectedArchiveSeason && archivedSeasons.length > 0 && (
                    <div className="p-8 text-center">
                      <Archive className="w-8 h-8 text-muted mx-auto mb-2" />
                      <p className="text-muted text-sm">
                        Select a season to view historical scores
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* HALL OF CHAMPIONS TAB */}
              {activeTab === 'champions' && (
                <div className="min-h-[calc(100vh-180px)] flex flex-col">
                  <Suspense
                    fallback={
                      <div className="p-8 text-center text-muted text-sm">
                        Loading Hall of Champions...
                      </div>
                    }
                  >
                    <HallOfChampions />
                  </Suspense>
                </div>
              )}
            </>
          )}
        </PullToRefresh>
      </div>

      {/* SELECTED SHOW MODAL (Full Recap) */}
      {selectedShow && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-label={`Recap for ${formatEventName(selectedShow.eventName)}`}
        >
          <div className="absolute inset-0 bg-black/80" onClick={() => setSelectedShow(null)} />
          <div className="relative w-full max-w-lg max-h-[80dvh] bg-[#1a1a1a] border border-[#333] sm:rounded-none overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="bg-[#222] px-4 py-3 border-b border-[#333] flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-sm font-bold text-white">
                  {formatEventName(selectedShow.eventName)}
                </h2>
                <p className="text-[10px] text-muted">
                  {selectedShow.location} • {selectedShow.date}
                </p>
              </div>
              <button
                onClick={() => setSelectedShow(null)}
                className="text-gray-400 hover:text-white text-xs font-bold"
              >
                CLOSE
              </button>
            </div>

            {/* Modal Content - Uses same RecapDataGrid */}
            <div className="flex-1 overflow-y-auto p-3 md:p-4">
              <RecapDataGrid
                scores={selectedShow.scores}
                eventName={selectedShow.eventName}
                location={selectedShow.location}
                date={selectedShow.date}
                userCorpsName={userCorpsName}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Scores;
