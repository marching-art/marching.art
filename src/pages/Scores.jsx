// =============================================================================
// SCORES - ESPN SPREADSHEET VIEW
// =============================================================================
// Full-width DataTable, all columns visible, horizontal scroll on mobile
// Laws: Dense, tabular, sticky header, no glow

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Trophy, Calendar, Archive, TrendingUp, TrendingDown, Music } from 'lucide-react';
import { useAuth } from '../App';
import { useUserStore } from '../store/userStore';
import { useSeasonStore } from '../store/seasonStore';
import { useScoresData } from '../hooks/useScoresData';
import { DataTable } from '../components/ui/DataTable';
import { Card } from '../components/ui/Card';
import { PullToRefresh } from '../components/ui/PullToRefresh';
import { useHaptic } from '../hooks/useHaptic';
import ScoreBreakdown from '../components/Scores/ScoreBreakdown';
import SoundSportTab from '../components/Scores/tabs/SoundSportTab';

// =============================================================================
// STANDINGS TABLE COLUMNS - Full spreadsheet with all captions
// =============================================================================

const createStandingsColumns = () => [
  {
    key: 'rank',
    header: 'RK',
    width: '45px',
    isRank: true,
  },
  {
    key: 'corps',
    header: 'Corps',
    width: '160px',
    sticky: true,
    render: (row) => (
      <span className="font-medium text-white">
        {row.corpsName || row.corps}
      </span>
    ),
  },
  {
    key: 'director',
    header: 'Director',
    width: '120px',
    render: (row) => (
      <span className="text-gray-400 truncate block">
        {row.director || '-'}
      </span>
    ),
  },
  {
    key: 'score',
    header: 'Total',
    width: '70px',
    align: 'right',
    render: (row) => (
      <span className="font-bold text-white tabular-nums">
        {typeof row.score === 'number' ? row.score.toFixed(3) : row.score || '-'}
      </span>
    ),
  },
  {
    key: 'trend',
    header: '+/-',
    width: '50px',
    align: 'center',
    render: (row) => {
      const change = row.rankChange || row.trend?.direction;
      if (change > 0) {
        return <TrendingUp className="w-4 h-4 text-green-500 mx-auto" />;
      }
      if (change < 0) {
        return <TrendingDown className="w-4 h-4 text-red-500 mx-auto" />;
      }
      return <span className="text-gray-600">-</span>;
    },
  },
  {
    key: 'ge',
    header: 'GE',
    width: '55px',
    align: 'right',
    render: (row) => (
      <span className="text-gray-300 tabular-nums">
        {row.geScore?.toFixed(3) || row.ge?.toFixed(3) || '-'}
      </span>
    ),
  },
  {
    key: 'vis',
    header: 'VIS',
    width: '55px',
    align: 'right',
    render: (row) => (
      <span className="text-gray-300 tabular-nums">
        {row.visScore?.toFixed(3) || row.vis?.toFixed(3) || '-'}
      </span>
    ),
  },
  {
    key: 'mus',
    header: 'MUS',
    width: '55px',
    align: 'right',
    render: (row) => (
      <span className="text-gray-300 tabular-nums">
        {row.musScore?.toFixed(3) || row.mus?.toFixed(3) || '-'}
      </span>
    ),
  },
  {
    key: 'shows',
    header: 'Shows',
    width: '55px',
    align: 'center',
    render: (row) => (
      <span className="text-gray-400 tabular-nums">
        {row.showCount || row.scores?.length || '-'}
      </span>
    ),
  },
];

// =============================================================================
// LATEST SHOWS TABLE COLUMNS
// =============================================================================

const createLatestColumns = () => [
  {
    key: 'rank',
    header: 'RK',
    width: '45px',
    isRank: true,
  },
  {
    key: 'corps',
    header: 'Corps',
    sticky: true,
    render: (row) => (
      <span className="font-medium text-white">
        {row.corps || row.corpsName}
      </span>
    ),
  },
  {
    key: 'score',
    header: 'Score',
    width: '70px',
    align: 'right',
    render: (row) => (
      <span className="font-bold text-white tabular-nums">
        {(row.score || row.totalScore || 0).toFixed(3)}
      </span>
    ),
  },
  {
    key: 'ge',
    header: 'GE',
    width: '55px',
    align: 'right',
    render: (row) => (
      <span className="text-gray-300 tabular-nums">
        {row.ge?.toFixed(3) || '-'}
      </span>
    ),
  },
  {
    key: 'vis',
    header: 'VIS',
    width: '55px',
    align: 'right',
    render: (row) => (
      <span className="text-gray-300 tabular-nums">
        {row.vis?.toFixed(3) || '-'}
      </span>
    ),
  },
  {
    key: 'mus',
    header: 'MUS',
    width: '55px',
    align: 'right',
    render: (row) => (
      <span className="text-gray-300 tabular-nums">
        {row.mus?.toFixed(3) || '-'}
      </span>
    ),
  },
];

// =============================================================================
// MAIN SCORES COMPONENT
// =============================================================================

const Scores = () => {
  const { user } = useAuth();
  const { loggedInProfile, completeDailyChallenge } = useUserStore();
  const formatSeasonName = useSeasonStore((state) => state.formatSeasonName);
  const [searchParams] = useSearchParams();
  const { trigger: haptic } = useHaptic();

  // Get specific show and season from URL if provided
  const targetShowName = searchParams.get('show');
  const targetSeasonId = searchParams.get('season');

  // Tab state - default to 'latest' if a specific show is requested
  const [activeTab, setActiveTab] = useState(targetShowName ? 'latest' : 'standings');

  // Score breakdown modal
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [selectedScore, setSelectedScore] = useState(null);
  const [selectedShowInfo, setSelectedShowInfo] = useState({});
  const [previousScore, setPreviousScore] = useState(null);
  const [previousShowInfo, setPreviousShowInfo] = useState(null);

  // Scores data
  const {
    loading,
    error,
    allShows,
    unfilteredShows,
    stats,
    aggregatedScores,
    archivedSeasons,
    refetch,
  } = useScoresData({
    seasonId: targetSeasonId,
    classFilter: 'all',
    enabledCaptions: { ge: true, vis: true, mus: true }
  });

  // Pull to refresh handler
  const handleRefresh = async () => {
    haptic('pull');
    await refetch?.();
    haptic('success');
  };

  // Season name
  const currentSeasonName = useMemo(() => {
    return formatSeasonName?.() || 'Current Season';
  }, [formatSeasonName]);

  // User's corps name for highlighting
  const userCorpsName = useMemo(() => {
    if (!loggedInProfile?.corps) return null;
    const activeCorps = Object.values(loggedInProfile.corps).find(c => c?.lineup);
    return activeCorps?.corpsName || null;
  }, [loggedInProfile?.corps]);

  // Daily challenge
  useEffect(() => {
    if (user && loggedInProfile && completeDailyChallenge) {
      completeDailyChallenge('check_leaderboard');
    }
  }, [user, loggedInProfile, completeDailyChallenge]);

  // Switch to latest tab when a specific show is requested via URL
  useEffect(() => {
    if (targetShowName) {
      setActiveTab('latest');
    }
  }, [targetShowName]);

  // Columns
  const standingsColumns = useMemo(() => createStandingsColumns(), []);
  const latestColumns = useMemo(() => createLatestColumns(), []);

  // Highlight user's row
  const highlightRow = useCallback((row) => {
    const corpsName = row.corps || row.corpsName;
    return userCorpsName && corpsName?.toLowerCase() === userCorpsName.toLowerCase();
  }, [userCorpsName]);

  // Handle row click for breakdown
  const handleRowClick = useCallback((entry) => {
    if (entry.scores && entry.scores.length > 0) {
      // scores[0] is the most recent since shows are sorted by offSeasonDay descending
      const latestScore = entry.scores[0];
      const prevScore = entry.scores.length > 1 ? entry.scores[1] : null;
      setSelectedScore({ ...entry, ...latestScore });
      setSelectedShowInfo({
        eventName: latestScore.eventName,
        date: latestScore.date,
        location: latestScore.location
      });
      setPreviousScore(prevScore);
      setPreviousShowInfo(prevScore ? {
        eventName: prevScore.eventName,
        date: prevScore.date,
        location: prevScore.location
      } : null);
      setBreakdownOpen(true);
    }
  }, []);

  // Get latest show with scores (or specific show if requested via URL)
  const latestShow = useMemo(() => {
    if (!allShows || allShows.length === 0) return null;

    // If a specific show was requested, find it by event name
    // Don't fall back to most recent - return null if not found
    if (targetShowName) {
      return allShows.find(
        s => s.eventName === targetShowName && s.scores && s.scores.length > 0
      ) || null;
    }

    // Otherwise, return the most recent show with scores
    return allShows.find(s => s.scores && s.scores.length > 0);
  }, [allShows, targetShowName]);

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <div className="h-full overflow-y-auto bg-[#0a0a0a]">
      {/* Header Bar */}
      <div className="bg-[#1a1a1a] border-b border-[#333] px-4 py-3.5">
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trophy className="w-6 h-6 text-[#0057B8]" />
            <div>
              <h1 className="text-base font-bold text-white uppercase">Scores</h1>
              <p className="text-xs text-gray-500">{currentSeasonName}</p>
            </div>
          </div>
          <div className="flex items-center gap-5 text-sm">
            <div className="text-right">
              <div className="text-xs text-gray-500">Corps</div>
              <div className="font-bold text-white tabular-nums">{stats.corpsActive || 0}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">High Score</div>
              <div className="font-bold text-green-500 tabular-nums">{stats.topScore || '-'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Bar - Touch-optimized */}
      <div className="bg-[#1a1a1a] border-b border-[#333]">
        <div className="w-full px-2">
          <nav className="flex gap-1 overflow-x-auto scrollbar-hide">
            {[
              { id: 'latest', label: 'Latest' },
              { id: 'standings', label: 'Standings' },
              { id: 'soundsport', label: 'SoundSport', icon: Music, accent: 'green' },
              { id: 'history', label: 'History' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => { haptic('medium'); setActiveTab(tab.id); }}
                className={`
                  flex items-center gap-2 px-4 py-3 min-h-[48px] text-sm font-bold uppercase tracking-wider border-b-2 -mb-px whitespace-nowrap press-feedback
                  ${activeTab === tab.id
                    ? tab.accent === 'green'
                      ? 'text-green-500 border-green-500'
                      : 'text-[#0057B8] border-[#0057B8]'
                    : 'text-gray-500 border-transparent hover:text-gray-300 active:text-white'
                  }
                `}
              >
                {tab.icon && <tab.icon className="w-4 h-4" />}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content with Pull to Refresh */}
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="w-full">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading scores...</div>
        ) : error ? (
          <div className="p-8 text-center text-red-500">{error}</div>
        ) : (
          <>
            {/* LATEST TAB */}
            {activeTab === 'latest' && (
              <div>
                {latestShow ? (
                  <>
                    {/* Show Header */}
                    <div className="bg-[#222] px-4 py-3 border-b border-[#333]">
                      <div className="flex items-center gap-3">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        <div>
                          <div className="text-sm font-bold text-white">{latestShow.eventName}</div>
                          <div className="text-[10px] text-gray-500">
                            {latestShow.date} • {latestShow.location}
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Results Table */}
                    <DataTable
                      columns={latestColumns}
                      data={latestShow.scores.map((s, i) => ({ ...s, rank: i + 1 }))}
                      getRowKey={(row) => row.corps || row.corpsName}
                      zebraStripes={true}
                      highlightRow={highlightRow}
                      maxHeight="calc(100vh - 240px)"
                    />
                  </>
                ) : (
                  <div className="p-8 text-center">
                    <Calendar className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-500">
                      {targetShowName
                        ? `No results available for "${targetShowName}"`
                        : 'No recent shows'}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* STANDINGS TAB */}
            {activeTab === 'standings' && (
              <DataTable
                columns={standingsColumns}
                data={aggregatedScores}
                getRowKey={(row) => row.corpsName || row.corps}
                onRowClick={handleRowClick}
                zebraStripes={true}
                highlightRow={highlightRow}
                maxHeight="calc(100vh - 180px)"
                emptyState={
                  <div className="p-8 text-center">
                    <Trophy className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-500">No standings yet</p>
                  </div>
                }
              />
            )}

            {/* SOUNDSPORT TAB */}
            {activeTab === 'soundsport' && (
              <div className="p-4">
                <SoundSportTab loading={loading} allShows={unfilteredShows} />
              </div>
            )}

            {/* HISTORY TAB */}
            {activeTab === 'history' && (
              <div className="p-4">
                {archivedSeasons && archivedSeasons.length > 0 ? (
                  <div className="space-y-2">
                    {archivedSeasons.map((season) => (
                      <Card key={season.id} hoverable>
                        <Card.Header>
                          <Card.Title>{season.seasonName}</Card.Title>
                        </Card.Header>
                        <Card.Body className="px-3 py-2">
                          <p className="text-xs text-gray-500">
                            Archived {season.archivedAt?.toLocaleDateString?.() || ''}
                          </p>
                        </Card.Body>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <Archive className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-500">No archived seasons</p>
                    <p className="text-xs text-gray-600 mt-1">Past seasons will appear here</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
        </div>
      </PullToRefresh>

      {/* Score Breakdown Modal */}
      <ScoreBreakdown
        isOpen={breakdownOpen}
        onClose={() => setBreakdownOpen(false)}
        score={selectedScore}
        previousScore={previousScore}
        showInfo={selectedShowInfo}
        previousShowInfo={previousShowInfo}
      />
    </div>
  );
};

export default Scores;
