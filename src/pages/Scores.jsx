// =============================================================================
// SCORES - ESPN SPREADSHEET VIEW
// =============================================================================
// Full-width DataTable, all columns visible, horizontal scroll on mobile
// Laws: Dense, tabular, sticky header, no glow

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Trophy, Calendar, Archive, TrendingUp, TrendingDown } from 'lucide-react';
import { useAuth } from '../App';
import { useUserStore } from '../store/userStore';
import { useSeasonStore } from '../store/seasonStore';
import { useScoresData } from '../hooks/useScoresData';
import { DataTable } from '../components/ui/DataTable';
import { Card } from '../components/ui/Card';
import ScoreBreakdown from '../components/Scores/ScoreBreakdown';

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
        {typeof row.score === 'number' ? row.score.toFixed(2) : row.score || '-'}
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
        {row.geScore?.toFixed(2) || row.ge?.toFixed(2) || '-'}
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
        {row.visScore?.toFixed(2) || row.vis?.toFixed(2) || '-'}
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
        {row.musScore?.toFixed(2) || row.mus?.toFixed(2) || '-'}
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
        {(row.score || row.totalScore || 0).toFixed(2)}
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
        {row.ge?.toFixed(2) || '-'}
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
        {row.vis?.toFixed(2) || '-'}
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
        {row.mus?.toFixed(2) || '-'}
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

  // Tab state
  const [activeTab, setActiveTab] = useState('standings');

  // Score breakdown modal
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [selectedScore, setSelectedScore] = useState(null);
  const [selectedShowInfo, setSelectedShowInfo] = useState({});

  // Scores data
  const {
    loading,
    error,
    allShows,
    stats,
    aggregatedScores,
    archivedSeasons,
  } = useScoresData({
    classFilter: 'all',
    enabledCaptions: { ge: true, vis: true, mus: true }
  });

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
      const latestScore = entry.scores[entry.scores.length - 1];
      setSelectedScore({ ...entry, ...latestScore });
      setSelectedShowInfo({
        eventName: latestScore.eventName,
        date: latestScore.date,
        location: latestScore.location
      });
      setBreakdownOpen(true);
    }
  }, []);

  // Get latest show with scores
  const latestShow = useMemo(() => {
    if (!allShows || allShows.length === 0) return null;
    return allShows.find(s => s.scores && s.scores.length > 0);
  }, [allShows]);

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header Bar */}
      <div className="bg-[#1a1a1a] border-b border-[#333] px-4 py-3">
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trophy className="w-5 h-5 text-[#0057B8]" />
            <div>
              <h1 className="text-sm font-bold text-white uppercase">Scores</h1>
              <p className="text-[10px] text-gray-500">{currentSeasonName}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="text-right">
              <div className="text-gray-500">Corps</div>
              <div className="font-bold text-white tabular-nums">{stats.corpsActive || 0}</div>
            </div>
            <div className="text-right">
              <div className="text-gray-500">High Score</div>
              <div className="font-bold text-green-500 tabular-nums">{stats.topScore || '-'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="bg-[#1a1a1a] border-b border-[#333]">
        <div className="w-full px-4">
          <nav className="flex gap-4">
            {[
              { id: 'latest', label: 'Latest' },
              { id: 'standings', label: 'Standings' },
              { id: 'history', label: 'History' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  py-3 text-xs font-bold uppercase tracking-wider border-b-2 -mb-px
                  ${activeTab === tab.id
                    ? 'text-[#0057B8] border-[#0057B8]'
                    : 'text-gray-500 border-transparent hover:text-gray-300'
                  }
                `}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
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
                    <p className="text-gray-500">No recent shows</p>
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

      {/* Score Breakdown Modal */}
      <ScoreBreakdown
        isOpen={breakdownOpen}
        onClose={() => setBreakdownOpen(false)}
        score={selectedScore}
        showInfo={selectedShowInfo}
      />
    </div>
  );
};

export default Scores;
