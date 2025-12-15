// src/pages/Scores.jsx
// Redesigned Scores page with underline tabs: Latest, Standings, History

import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, TrendingUp, TrendingDown, Minus, Calendar, MapPin, ChevronRight, Archive, Clock } from 'lucide-react';
import { useAuth } from '../App';
import { useUserStore } from '../store/userStore';
import { useSeasonStore } from '../store/seasonStore';

// Hooks
import { useScoresData } from '../hooks/useScoresData';

// Components
import GameShell from '../components/Layout/GameShell';
import { Card } from '../components/ui/Card';
import { DataTable } from '../components/ui/DataTable';
import ScoreBreakdown from '../components/Scores/ScoreBreakdown';
import { SystemLoader, ConsoleEmptyState } from '../components/ui/CommandConsole';

// =============================================================================
// UNDERLINE TABS COMPONENT
// =============================================================================

const UnderlineTabs = ({ tabs, activeTab, onChange, className = '' }) => {
  return (
    <div className={`border-b border-cream-500/10 ${className}`}>
      <nav className="flex gap-6" aria-label="Score tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            onClick={() => onChange(tab.id)}
            className={`
              relative pb-3 text-sm font-display font-semibold uppercase tracking-wide
              transition-colors duration-200
              ${activeTab === tab.id
                ? 'text-cream-100'
                : 'text-cream-500/50 hover:text-cream-500/80'
              }
            `}
            aria-selected={activeTab === tab.id}
            aria-controls={`tabpanel-${tab.id}`}
            role="tab"
          >
            <span className="flex items-center gap-2">
              {tab.icon}
              {tab.label}
            </span>
            {activeTab === tab.id && (
              <motion.div
                layoutId="activeTabUnderline"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold-500"
                initial={false}
                transition={{ type: 'spring', duration: 0.3, bounce: 0.2 }}
              />
            )}
          </button>
        ))}
      </nav>
    </div>
  );
};

// =============================================================================
// TREND INDICATOR COMPONENT
// =============================================================================

const TrendIndicator = memo(({ trend, change }) => {
  if (trend === 'up' || change > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-green-400 text-sm font-medium">
        <TrendingUp className="w-3.5 h-3.5" />
        <span className="text-xs">{change ? Math.abs(change) : ''}</span>
      </span>
    );
  }
  if (trend === 'down' || change < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-red-400 text-sm font-medium">
        <TrendingDown className="w-3.5 h-3.5" />
        <span className="text-xs">{change ? Math.abs(change) : ''}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-cream-500/40 text-sm">
      <Minus className="w-3.5 h-3.5" />
    </span>
  );
});

TrendIndicator.displayName = 'TrendIndicator';

// =============================================================================
// RANK BADGE COMPONENT
// =============================================================================

const RankBadge = memo(({ rank }) => {
  const getStyle = () => {
    if (rank === 1) return 'bg-gold-500 text-charcoal-900';
    if (rank === 2) return 'bg-gray-400 text-charcoal-900';
    if (rank === 3) return 'bg-amber-600 text-charcoal-900';
    return 'bg-charcoal-800 text-cream-400';
  };

  return (
    <div className={`w-7 h-7 rounded flex items-center justify-center font-display font-bold text-xs ${getStyle()}`}>
      {rank}
    </div>
  );
});

RankBadge.displayName = 'RankBadge';

// =============================================================================
// MINI RESULTS TABLE (for Latest tab cards)
// =============================================================================

const MiniResultsTable = memo(({ scores, userCorpsName }) => {
  const top3 = scores.slice(0, 3);

  return (
    <div className="space-y-1">
      {top3.map((score, idx) => {
        const corpsName = score.corps || score.corpsName;
        const isUserCorps = userCorpsName && corpsName?.toLowerCase() === userCorpsName.toLowerCase();

        return (
          <div
            key={`${corpsName}-${idx}`}
            className={`flex items-center gap-3 px-2 py-1.5 rounded ${
              isUserCorps ? 'bg-gold-500/10 border border-gold-500/20' : ''
            }`}
          >
            <RankBadge rank={idx + 1} />
            <span className={`flex-1 text-sm truncate ${
              isUserCorps ? 'text-gold-400 font-semibold' : 'text-cream-300'
            }`}>
              {corpsName}
            </span>
            <span className="font-mono text-sm font-bold text-cream-100 tabular-nums">
              {(score.score || score.totalScore || 0).toFixed(2)}
            </span>
          </div>
        );
      })}
    </div>
  );
});

MiniResultsTable.displayName = 'MiniResultsTable';

// =============================================================================
// SHOW CARD COMPONENT (for Latest tab)
// =============================================================================

const ShowResultCard = memo(({ show, userCorpsName, onClick }) => {
  return (
    <Card hoverable onClick={() => onClick?.(show)}>
      <Card.Header className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded bg-purple-500/10 flex items-center justify-center flex-shrink-0">
            <Trophy className="w-4 h-4 text-purple-400" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-display font-bold text-cream-100 uppercase tracking-wide truncate">
              {show.eventName}
            </h3>
            <div className="flex items-center gap-2 text-xs text-cream-500/50">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {show.date}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {show.location}
              </span>
            </div>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-cream-500/30 flex-shrink-0" />
      </Card.Header>

      <Card.Body>
        {show.scores && show.scores.length > 0 ? (
          <>
            <MiniResultsTable scores={show.scores} userCorpsName={userCorpsName} />
            {show.scores.length > 3 && (
              <p className="mt-2 text-xs text-cream-500/40 text-center">
                +{show.scores.length - 3} more corps
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-cream-500/50 text-center py-4">No results yet</p>
        )}
      </Card.Body>
    </Card>
  );
});

ShowResultCard.displayName = 'ShowResultCard';

// =============================================================================
// STANDINGS TABLE COLUMNS
// =============================================================================

const createStandingsColumns = (onViewDetails) => [
  {
    key: 'rank',
    header: '#',
    width: '50px',
    align: 'center',
    sticky: true,
    render: (row) => <RankBadge rank={row.rank} />,
  },
  {
    key: 'corps',
    header: 'Corps',
    sticky: true,
    render: (row) => (
      <span className="font-semibold text-cream truncate block max-w-[150px] md:max-w-none">
        {row.corpsName || row.corps}
      </span>
    ),
  },
  {
    key: 'score',
    header: 'Score',
    align: 'right',
    width: '90px',
    render: (row) => (
      <span className="font-mono font-bold text-gold-400 tabular-nums">
        {typeof row.score === 'number' ? row.score.toFixed(2) : row.score}
      </span>
    ),
  },
  {
    key: 'trend',
    header: 'Change',
    align: 'center',
    width: '70px',
    render: (row) => (
      <TrendIndicator
        trend={row.trend?.trend}
        change={row.rankChange || row.trend?.direction}
      />
    ),
  },
  {
    key: 'director',
    header: 'Director',
    width: '120px',
    cellClassName: 'hidden md:table-cell',
    headerClassName: 'hidden md:table-cell',
    render: (row) => (
      <span className="text-cream-500/70 text-sm truncate block max-w-[100px]">
        {row.director || '-'}
      </span>
    ),
  },
];

// =============================================================================
// MEMOIZED STANDINGS TABLE
// =============================================================================

const StandingsTable = memo(({
  data,
  userCorpsName,
  onRowClick,
  isLoading
}) => {
  const columns = useMemo(() => createStandingsColumns(onRowClick), [onRowClick]);

  const highlightRow = useCallback((row) => {
    const corpsName = row.corps || row.corpsName;
    return userCorpsName && corpsName?.toLowerCase() === userCorpsName.toLowerCase();
  }, [userCorpsName]);

  return (
    <DataTable
      columns={columns}
      data={data}
      getRowKey={(row) => row.corpsName || row.corps}
      onRowClick={onRowClick}
      isLoading={isLoading}
      skeletonRows={10}
      zebraStripes={true}
      rowHeight="default"
      maxHeight="600px"
      highlightRow={highlightRow}
      emptyState={
        <div className="text-center py-12">
          <Trophy className="w-12 h-12 text-cream-500/20 mx-auto mb-3" />
          <p className="text-cream-500/50 text-sm">No standings available yet</p>
        </div>
      }
    />
  );
});

StandingsTable.displayName = 'StandingsTable';

// =============================================================================
// LATEST TAB CONTENT
// =============================================================================

const LatestTab = memo(({ shows, userCorpsName, onShowClick }) => {
  if (!shows || shows.length === 0) {
    return (
      <div
        role="tabpanel"
        id="tabpanel-latest"
        aria-labelledby="tab-latest"
        className="flex items-center justify-center py-16"
      >
        <div className="text-center">
          <Calendar className="w-12 h-12 text-cream-500/20 mx-auto mb-3" />
          <p className="text-cream-500/50 text-sm">No recent shows</p>
        </div>
      </div>
    );
  }

  return (
    <div
      role="tabpanel"
      id="tabpanel-latest"
      aria-labelledby="tab-latest"
      className="grid grid-cols-1 md:grid-cols-2 gap-4"
    >
      {shows.slice(0, 6).map((show, idx) => (
        <motion.div
          key={`${show.eventName}-${idx}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.05 }}
        >
          <ShowResultCard
            show={show}
            userCorpsName={userCorpsName}
            onClick={onShowClick}
          />
        </motion.div>
      ))}
    </div>
  );
});

LatestTab.displayName = 'LatestTab';

// =============================================================================
// STANDINGS TAB CONTENT
// =============================================================================

const StandingsTab = memo(({ aggregatedScores, userCorpsName, onEntryClick, isLoading }) => {
  return (
    <div
      role="tabpanel"
      id="tabpanel-standings"
      aria-labelledby="tab-standings"
    >
      <StandingsTable
        data={aggregatedScores}
        userCorpsName={userCorpsName}
        onRowClick={onEntryClick}
        isLoading={isLoading}
      />
    </div>
  );
});

StandingsTab.displayName = 'StandingsTab';

// =============================================================================
// HISTORY TAB CONTENT
// =============================================================================

const HistoryTab = memo(({ archivedSeasons, onSeasonSelect }) => {
  if (!archivedSeasons || archivedSeasons.length === 0) {
    return (
      <div
        role="tabpanel"
        id="tabpanel-history"
        aria-labelledby="tab-history"
        className="flex items-center justify-center py-16"
      >
        <div className="text-center">
          <Archive className="w-12 h-12 text-cream-500/20 mx-auto mb-3" />
          <p className="text-cream-500/50 text-sm">No archived seasons yet</p>
          <p className="text-cream-500/30 text-xs mt-1">Past season data will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div
      role="tabpanel"
      id="tabpanel-history"
      aria-labelledby="tab-history"
      className="space-y-3"
    >
      {archivedSeasons.map((season) => (
        <Card
          key={season.id}
          hoverable
          pressable
          onClick={() => onSeasonSelect?.(season.id)}
          className="cursor-pointer"
        >
          <Card.Body className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-amber-500/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-sm font-display font-bold text-cream-100 uppercase">
                  {season.seasonName}
                </h3>
                <p className="text-xs text-cream-500/50">
                  {season.archivedAt?.toLocaleDateString?.() || 'Archived'}
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-cream-500/30" />
          </Card.Body>
        </Card>
      ))}
    </div>
  );
});

HistoryTab.displayName = 'HistoryTab';

// =============================================================================
// MAIN SCORES COMPONENT
// =============================================================================

const Scores = () => {
  const { user } = useAuth();
  const { loggedInProfile, completeDailyChallenge } = useUserStore();
  const formatSeasonName = useSeasonStore((state) => state.formatSeasonName);

  // Active tab state
  const [activeTab, setActiveTab] = useState('latest');

  // Score breakdown modal state
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [selectedScore, setSelectedScore] = useState(null);
  const [selectedShowInfo, setSelectedShowInfo] = useState({});
  const [previousScore, setPreviousScore] = useState(null);
  const [previousShowInfo, setPreviousShowInfo] = useState(null);

  // Use the scores data hook
  const {
    loading,
    error,
    allShows,
    stats,
    aggregatedScores,
    archivedSeasons,
    isArchived
  } = useScoresData({
    classFilter: 'all',
    enabledCaptions: { ge: true, vis: true, mus: true }
  });

  // Get current season name
  const currentSeasonName = useMemo(() => {
    return formatSeasonName?.() || 'Current Season';
  }, [formatSeasonName]);

  // Extract user's corps name
  const userCorpsName = useMemo(() => {
    if (!loggedInProfile?.corps) return null;
    const activeCorps = Object.values(loggedInProfile.corps).find(c => c?.lineup);
    return activeCorps?.corpsName || null;
  }, [loggedInProfile?.corps]);

  // Complete daily challenge on visit
  useEffect(() => {
    if (user && loggedInProfile && completeDailyChallenge) {
      completeDailyChallenge('check_leaderboard');
    }
  }, [user, loggedInProfile, completeDailyChallenge]);

  // Handle viewing score breakdown
  const handleViewBreakdown = useCallback((score, showInfo, prevScore = null, prevShowInfo = null) => {
    setSelectedScore(score);
    setSelectedShowInfo(showInfo);
    setPreviousScore(prevScore);
    setPreviousShowInfo(prevShowInfo);
    setBreakdownOpen(true);
  }, []);

  // Handle leaderboard entry click
  const handleEntryClick = useCallback((entry) => {
    if (entry.scores && entry.scores.length > 0) {
      const latestScore = entry.scores[entry.scores.length - 1];
      const prevScore = entry.scores.length > 1 ? entry.scores[entry.scores.length - 2] : null;

      handleViewBreakdown(
        { ...entry, ...latestScore },
        {
          eventName: latestScore.eventName,
          date: latestScore.date,
          location: latestScore.location
        },
        prevScore,
        prevScore ? { eventName: prevScore.eventName } : null
      );
    }
  }, [handleViewBreakdown]);

  // Handle show card click
  const handleShowClick = useCallback((show) => {
    if (show.scores && show.scores.length > 0) {
      const topScore = show.scores[0];
      handleViewBreakdown(
        topScore,
        {
          eventName: show.eventName,
          date: show.date,
          location: show.location
        }
      );
    }
  }, [handleViewBreakdown]);

  // Handle archived season selection
  const handleSeasonSelect = useCallback((seasonId) => {
    // TODO: Navigate to archived season view with router
    // Future: navigate(`/scores/archive/${seasonId}`)
  }, []);

  // Tab definitions
  const tabs = useMemo(() => [
    { id: 'latest', label: 'Latest', icon: <Calendar className="w-4 h-4" /> },
    { id: 'standings', label: 'Standings', icon: <Trophy className="w-4 h-4" /> },
    { id: 'history', label: 'History', icon: <Archive className="w-4 h-4" /> },
  ], []);

  return (
    <div className="h-full flex flex-col overflow-hidden bg-charcoal-950">
      {/* Page Header */}
      <div className="flex-shrink-0 border-b border-cream-500/10 bg-charcoal-950/80 backdrop-blur-sm">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gold-500/20 border border-gold-500/30 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-gold-400" />
              </div>
              <div>
                <h1 className="text-xl font-display font-black uppercase tracking-tight text-cream-100">
                  Scores
                </h1>
                <p className="text-xs text-cream-500/60 font-mono uppercase tracking-wide">
                  {currentSeasonName}
                </p>
              </div>
            </div>
            <div>
              <h1 className="text-xl font-display font-bold text-cream uppercase tracking-wide">
                Scores
              </h1>
              <p className="text-xs text-cream-500/60 font-mono uppercase tracking-wide">
                {currentSeasonName}
              </p>
            </div>
          </div>

          {/* Quick stats */}
          <div className="hidden sm:flex items-center gap-4">
            <div className="text-right">
              <p className="text-[10px] text-cream-500/60 uppercase tracking-wide">Corps</p>
              <p className="font-mono text-lg font-bold text-cream-100">{stats.corpsActive || 0}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-cream-500/60 uppercase tracking-wide">Top Score</p>
              <p className="font-mono text-lg font-bold text-gold-400">{stats.topScore || '-'}</p>
            </div>
          </div>
        </div>

        {/* Archive Notice */}
        {isArchived && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center gap-3"
          >
            <Archive className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-display font-bold text-amber-400 uppercase tracking-wide">
                Historical Archive
              </p>
              <p className="text-xs text-amber-400/70">
                Viewing archived data. Some features may be limited.
              </p>
            </div>
          </motion.div>
        )}

        {/* Underline Tabs */}
        <UnderlineTabs
          tabs={tabs}
          activeTab={activeTab}
          onChange={setActiveTab}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <SystemLoader
              messages={[
                'Loading scores...',
                'Calculating rankings...',
                'Almost there...'
              ]}
              showProgress={true}
            />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-20">
            <ConsoleEmptyState
              variant="network"
              title="CONNECTION ERROR"
              subtitle={error}
            />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'latest' && (
                <LatestTab
                  shows={allShows}
                  userCorpsName={userCorpsName}
                  onShowClick={handleShowClick}
                />
              )}

              {activeTab === 'standings' && (
                <StandingsTab
                  aggregatedScores={aggregatedScores}
                  userCorpsName={userCorpsName}
                  onEntryClick={handleEntryClick}
                  isLoading={loading}
                />
              )}

              {activeTab === 'history' && (
                <HistoryTab
                  archivedSeasons={archivedSeasons}
                  onSeasonSelect={handleSeasonSelect}
                />
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

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
