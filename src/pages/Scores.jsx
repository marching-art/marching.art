// src/pages/Scores.jsx
// Competitive Analytics Terminal - High-density scores and rankings hub
// Layout: Filter Rail (Left) + Main Ledger (Center) + Ticker (Top)

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, BarChart3 } from 'lucide-react';
import { useAuth } from '../App';
import { useUserStore } from '../store/userStore';
import { useSeasonStore } from '../store/seasonStore';

// Hooks
import { useScoresData, calculateCaptionAggregates } from '../hooks/useScoresData';

// Components
import FilterRail from '../components/Scores/FilterRail';
import AnalyticsTicker from '../components/Scores/AnalyticsTicker';
import ScoreLedger from '../components/Scores/ScoreLedger';
import CorpsDossier from '../components/Scores/CorpsDossier';
import { SystemLoader, ConsoleEmptyState } from '../components/ui/CommandConsole';

const Scores = () => {
  const { user } = useAuth();
  const { loggedInProfile, completeDailyChallenge } = useUserStore();
  const seasonData = useSeasonStore((state) => state.seasonData);
  const formatSeasonName = useSeasonStore((state) => state.formatSeasonName);

  // Filter state
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [activeClass, setActiveClass] = useState('all');
  const [enabledCaptions, setEnabledCaptions] = useState({ ge: true, vis: true, mus: true });
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileFilterVisible, setMobileFilterVisible] = useState(false);

  // Dossier state
  const [selectedCorps, setSelectedCorps] = useState(null);

  // Use the scores data hook
  const {
    loading,
    error,
    allShows,
    archivedSeasons,
    stats,
    aggregatedScores,
    columnStats,
    isArchived,
    currentSeasonUid
  } = useScoresData({
    seasonId: selectedSeason,
    classFilter: activeClass,
    enabledCaptions
  });

  // Get current season name
  const currentSeasonName = useMemo(() => {
    if (selectedSeason) {
      const archived = archivedSeasons.find(s => s.id === selectedSeason);
      return archived?.seasonName?.replace(/_/g, ' ') || selectedSeason;
    }
    return formatSeasonName?.() || 'Current Season';
  }, [selectedSeason, archivedSeasons, formatSeasonName]);

  // Filter scores by search query
  const filteredScores = useMemo(() => {
    if (!searchQuery.trim()) return aggregatedScores;

    const query = searchQuery.toLowerCase();
    return aggregatedScores.filter(score => {
      const corpsName = (score.corps || score.corpsName || '').toLowerCase();
      return corpsName.includes(query);
    });
  }, [aggregatedScores, searchQuery]);

  // Extract user's corps names for highlighting
  const userCorpsNames = useMemo(() => {
    if (!loggedInProfile?.corps) return [];
    return Object.values(loggedInProfile.corps)
      .filter(corps => corps?.corpsName)
      .map(corps => corps.corpsName);
  }, [loggedInProfile?.corps]);

  // Get user's active corps for head-to-head comparison
  const userActiveCorps = useMemo(() => {
    if (!loggedInProfile?.corps) return null;
    // Get first corps with a lineup (active corps)
    const activeCorps = Object.values(loggedInProfile.corps).find(c => c?.lineup);
    if (!activeCorps) return null;
    return {
      corpsName: activeCorps.corpsName,
      ...calculateCaptionAggregates({
        geScore: activeCorps.totalSeasonScore || 0,
        visualScore: 0,
        musicScore: 0
      })
    };
  }, [loggedInProfile?.corps]);

  // Complete daily challenge on visit
  useEffect(() => {
    if (user && loggedInProfile && completeDailyChallenge) {
      completeDailyChallenge('check_leaderboard');
    }
  }, [user, loggedInProfile, completeDailyChallenge]);

  // Handle caption toggle
  const handleCaptionToggle = (caption) => {
    setEnabledCaptions(prev => ({
      ...prev,
      [caption]: !prev[caption]
    }));
  };

  // Handle row click - open dossier
  const handleRowClick = (corps) => {
    setSelectedCorps(corps);
  };

  return (
    <div className={`
      h-full w-full flex flex-col overflow-hidden bg-charcoal-950
      ${isArchived ? 'sepia-[.15] grayscale-[.1]' : ''}
    `}>
      {/* ================================================================
          ZONE C: THE TICKER (Top Bar)
          ================================================================ */}
      <AnalyticsTicker
        stats={stats}
        isArchived={isArchived}
        seasonName={currentSeasonName}
      />

      {/* ================================================================
          MAIN CONTENT: Filter Rail + Main Ledger
          ================================================================ */}
      <div className="flex-1 flex overflow-hidden">
        {/* ==============================================================
            ZONE A: THE FILTER RAIL (Left Sidebar - Fixed Width 250px)
            ============================================================== */}
        <div className={`hidden lg:block flex-shrink-0 w-[250px] ${isArchived ? 'opacity-90' : ''}`}>
          <FilterRail
            selectedSeason={selectedSeason}
            onSeasonChange={setSelectedSeason}
            archivedSeasons={archivedSeasons}
            activeClass={activeClass}
            onClassChange={setActiveClass}
            enabledCaptions={enabledCaptions}
            onCaptionToggle={handleCaptionToggle}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            isVisible={true}
            onToggleVisibility={() => {}}
          />
        </div>

        {/* Mobile Filter Rail - Only shows when toggled via FAB button */}
        <div className="lg:hidden">
          <FilterRail
            selectedSeason={selectedSeason}
            onSeasonChange={setSelectedSeason}
            archivedSeasons={archivedSeasons}
            activeClass={activeClass}
            onClassChange={setActiveClass}
            enabledCaptions={enabledCaptions}
            onCaptionToggle={handleCaptionToggle}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            isVisible={mobileFilterVisible}
            onToggleVisibility={() => setMobileFilterVisible(!mobileFilterVisible)}
            isMobile={true}
          />
        </div>

        {/* ==============================================================
            ZONE B: THE MAIN LEDGER (Center - Flex Grow)
            ============================================================== */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Terminal Header */}
          <div className="flex-shrink-0 px-4 py-3 border-b border-cream-500/10 bg-charcoal-950/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gold-500/20 border border-gold-500/30 flex items-center justify-center">
                  <Terminal className="w-5 h-5 text-gold-400" />
                </div>
                <div>
                  <h1 className="text-lg font-display font-black uppercase tracking-tight text-cream-100">
                    Competitive Analytics
                  </h1>
                  <p className="text-[10px] text-cream-500/60 font-mono uppercase tracking-widest">
                    Score Ledger • {filteredScores.length} Corps
                  </p>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="hidden md:flex items-center gap-4">
                <div className="text-right">
                  <p className="text-[10px] text-cream-500/60 uppercase tracking-wide">Top Score</p>
                  <p className="font-mono text-lg font-bold text-gold-400">{stats.topScore || '-'}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-cream-500/60 uppercase tracking-wide">Active</p>
                  <p className="font-mono text-lg font-bold text-cream-100">{stats.corpsActive || 0}</p>
                </div>
              </div>
            </div>

            {/* Mobile: Quick Filters */}
            <div className="lg:hidden flex items-center gap-2 mt-3 overflow-x-auto pb-2 hud-scroll">
              {['all', 'world', 'open', 'a'].map(cls => (
                <button
                  key={cls}
                  onClick={() => setActiveClass(cls)}
                  className={`
                    flex-shrink-0 px-3 py-1.5 text-xs font-display font-bold uppercase tracking-wide
                    border rounded transition-all
                    ${activeClass === cls
                      ? 'bg-gold-500 text-charcoal-900 border-gold-500'
                      : 'bg-charcoal-900 text-cream-400 border-cream-500/10 hover:border-cream-500/30'
                    }
                  `}
                >
                  {cls === 'all' ? 'All' : cls}
                </button>
              ))}
            </div>
          </div>

          {/* Score Ledger Content */}
          <div className="flex-1 overflow-y-auto hud-scroll">
            {loading ? (
              <div className="flex items-center justify-center h-full py-12">
                <SystemLoader
                  messages={[
                    'RETRIEVING SCORE DATA...',
                    'PROCESSING RESULTS...',
                    'CALCULATING RANKINGS...',
                    'AGGREGATING CAPTIONS...',
                    'COMPILING STANDINGS...',
                  ]}
                  showProgress={true}
                />
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full p-4">
                <ConsoleEmptyState
                  variant="network"
                  title="CONNECTION ERROR"
                  subtitle={error}
                />
              </div>
            ) : filteredScores.length === 0 ? (
              <div className="flex items-center justify-center h-full p-4">
                <ConsoleEmptyState
                  variant="radar"
                  title={searchQuery ? 'NO MATCHES FOUND' : 'NO SCORE DATA AVAILABLE'}
                  subtitle={
                    searchQuery
                      ? `No corps matching "${searchQuery}". Try a different search.`
                      : isArchived
                        ? 'This archived season has no score data available.'
                        : 'Awaiting DCI season data transmission...'
                  }
                />
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="p-4"
              >
                {/* Archive Notice */}
                {isArchived && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center gap-3"
                  >
                    <BarChart3 className="w-5 h-5 text-amber-400" />
                    <div>
                      <p className="text-sm font-display font-bold text-amber-400 uppercase tracking-wide">
                        Historical Archive Mode
                      </p>
                      <p className="text-xs text-amber-400/70">
                        Viewing archived data from {currentSeasonName}. Some features are disabled.
                      </p>
                    </div>
                  </motion.div>
                )}

                {/* The Ledger Table */}
                <div className="bg-charcoal-900/30 border border-cream-500/10 rounded-lg overflow-hidden">
                  <ScoreLedger
                    scores={filteredScores}
                    columnStats={columnStats}
                    enabledCaptions={enabledCaptions}
                    onRowClick={handleRowClick}
                    selectedCorps={selectedCorps?.corps || selectedCorps?.corpsName}
                    highlightedCorps={userCorpsNames}
                    isArchived={isArchived}
                  />
                </div>

                {/* Results count */}
                <div className="mt-4 flex items-center justify-between text-[10px] font-mono text-cream-500/40 uppercase tracking-widest">
                  <span>Displaying {filteredScores.length} of {aggregatedScores.length} corps</span>
                  <span>{isArchived ? 'Archive Mode' : 'Live Data'}</span>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* ================================================================
          CORPS DOSSIER SLIDE-OVER PANEL
          ================================================================ */}
      <CorpsDossier
        isOpen={!!selectedCorps}
        onClose={() => setSelectedCorps(null)}
        corps={selectedCorps}
        myCorps={userActiveCorps}
        isArchived={isArchived}
      />
    </div>
  );
};

export default Scores;
