// =============================================================================
// SCORES - RESULTS TERMINAL
// =============================================================================
// Dense, scannable data terminal for scores and recaps
// Laws: App Shell, Segmented Control, High-Density Tables, no glow

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Trophy, Calendar, Archive, TrendingUp, TrendingDown, Music,
  ChevronRight, MapPin, Medal, Users, Activity
} from 'lucide-react';
import { useAuth } from '../App';
import { useUserStore } from '../store/userStore';
import { useSeasonStore } from '../store/seasonStore';
import { useScoresData } from '../hooks/useScoresData';
import { DataTable } from '../components/ui/DataTable';
import { PullToRefresh } from '../components/ui/PullToRefresh';
import { TeamAvatar } from '../components/ui/TeamAvatar';
import { useHaptic } from '../hooks/useHaptic';
import ScoreBreakdown from '../components/Scores/ScoreBreakdown';

// =============================================================================
// CONSTANTS
// =============================================================================

const TABS = [
  { id: 'latest', label: 'Latest Recaps' },
  { id: 'world', label: 'World' },
  { id: 'open', label: 'Open/Class A' },
  { id: 'soundsport', label: 'SoundSport', accent: 'green' },
];

const RATING_CONFIG = {
  Gold: { color: 'bg-yellow-500', text: 'text-black', border: 'border-yellow-600' },
  Silver: { color: 'bg-gray-300', text: 'text-black', border: 'border-gray-400' },
  Bronze: { color: 'bg-orange-400', text: 'text-black', border: 'border-orange-500' },
  Participation: { color: 'bg-gray-600', text: 'text-white', border: 'border-gray-500' },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const getSoundSportRating = (score) => {
  if (score >= 90) return 'Gold';
  if (score >= 75) return 'Silver';
  if (score >= 60) return 'Bronze';
  return 'Participation';
};

// =============================================================================
// STANDINGS TABLE COLUMNS
// =============================================================================

const createStandingsColumns = () => [
  {
    key: 'rank',
    header: 'RK',
    width: '48px',
    isRank: true,
    render: (row) => (
      <span className="w-6 h-6 bg-[#222] border border-[#333] flex items-center justify-center text-xs font-bold text-gray-400 tabular-nums">
        {row.rank}
      </span>
    ),
  },
  {
    key: 'corps',
    header: 'Corps',
    sticky: true,
    render: (row) => (
      <div className="flex items-center gap-2">
        <TeamAvatar name={row.corpsName || row.corps} size="sm" />
        <span className="font-bold text-white text-sm truncate">
          {row.corpsName || row.corps}
        </span>
      </div>
    ),
  },
  {
    key: 'score',
    header: 'Avg',
    width: '70px',
    align: 'right',
    render: (row) => (
      <span className="font-bold text-white font-data tabular-nums text-sm">
        {typeof row.score === 'number' ? row.score.toFixed(2) : '-'}
      </span>
    ),
  },
  {
    key: 'highScore',
    header: 'High',
    width: '70px',
    align: 'right',
    render: (row) => (
      <span className="text-green-400 font-data tabular-nums text-sm">
        {row.highScore?.toFixed(2) || row.scores?.[0]?.score?.toFixed(2) || '-'}
      </span>
    ),
  },
  {
    key: 'trend',
    header: '+/-',
    width: '44px',
    align: 'center',
    render: (row) => {
      const change = row.rankChange || row.trend?.direction;
      if (change > 0) return <TrendingUp className="w-3.5 h-3.5 text-green-500 mx-auto" />;
      if (change < 0) return <TrendingDown className="w-3.5 h-3.5 text-red-500 mx-auto" />;
      return <span className="text-gray-600 text-xs">-</span>;
    },
  },
  {
    key: 'strength',
    header: 'Strength',
    width: '90px',
    render: (row) => {
      // Determine strongest caption
      const ge = row.GE_Total || 0;
      const vis = row.VIS_Total || 0;
      const mus = row.MUS_Total || 0;
      let strength = 'Balanced';
      if (ge > vis && ge > mus) strength = 'High GE';
      else if (vis > ge && vis > mus) strength = 'High Visual';
      else if (mus > ge && mus > vis) strength = 'High Brass';
      return <span className="text-xs text-gray-400">{strength}</span>;
    },
  },
];

// =============================================================================
// SHOW SUMMARY STRIP COMPONENT
// =============================================================================

const ShowSummaryStrip = ({ show, onViewFull }) => {
  if (!show.scores || show.scores.length === 0) return null;

  const topThree = show.scores.slice(0, 3);
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="border-b border-[#333] hover:bg-[#111] transition-colors">
      {/* Strip Header */}
      <div className="bg-[#1a1a1a] px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Calendar className="w-4 h-4 text-[#0057B8] flex-shrink-0" />
          <span className="font-bold text-white text-sm truncate">{show.eventName}</span>
          <span className="text-gray-500 text-xs hidden sm:flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {show.location}
          </span>
        </div>
        <span className="text-[10px] text-gray-500 font-data tabular-nums flex-shrink-0">
          {formatDate(show.date)}
        </span>
      </div>

      {/* Top 3 Results */}
      <div className="px-4 py-3">
        <div className="space-y-1.5">
          {topThree.map((score, idx) => (
            <div key={idx} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-5 h-5 flex items-center justify-center text-[10px] font-bold rounded-sm ${
                  idx === 0 ? 'bg-yellow-500 text-black' :
                  idx === 1 ? 'bg-gray-400 text-black' :
                  'bg-orange-400 text-black'
                }`}>
                  {idx + 1}
                </span>
                <span className="text-sm text-white">{score.corps || score.corpsName}</span>
              </div>
              <span className="font-data tabular-nums text-sm text-gray-300">
                {(score.score || score.totalScore || 0).toFixed(3)}
              </span>
            </div>
          ))}
        </div>

        {/* View Full Button */}
        {show.scores.length > 3 && (
          <button
            onClick={() => onViewFull?.(show)}
            className="mt-3 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#0057B8] hover:text-[#0066d6] transition-colors"
          >
            Full Recap ({show.scores.length} corps)
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
};

// =============================================================================
// MEDAL CARD COMPONENT (SoundSport)
// =============================================================================

const MedalCard = ({ ensemble, rating }) => {
  const config = RATING_CONFIG[rating] || RATING_CONFIG.Participation;

  return (
    <div className={`${config.color} ${config.border} border-2 p-3 flex flex-col items-center justify-center text-center`}>
      <Medal className={`w-8 h-8 ${config.text} mb-1`} />
      <span className={`text-[10px] font-bold uppercase ${config.text}`}>{rating}</span>
      <span className={`text-xs font-bold ${config.text} mt-1 line-clamp-2`}>{ensemble}</span>
    </div>
  );
};

// =============================================================================
// SOUNDSPORT SECTION
// =============================================================================

const SoundSportSection = ({ shows }) => {
  // Process SoundSport data
  const soundSportData = useMemo(() => {
    return shows
      .filter(show => show.scores?.some(s => s.corpsClass === 'soundSport'))
      .map(show => ({
        ...show,
        scores: show.scores
          .filter(s => s.corpsClass === 'soundSport')
          .sort((a, b) => b.score - a.score),
      }));
  }, [shows]);

  if (soundSportData.length === 0) {
    return (
      <div className="p-8 text-center">
        <Music className="w-8 h-8 text-gray-600 mx-auto mb-2" />
        <p className="text-gray-500 text-sm">No SoundSport results yet</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-[#333]">
      {soundSportData.map((show, showIdx) => (
        <div key={showIdx}>
          {/* Event Header */}
          <div className="bg-[#1a1a1a] px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Music className="w-4 h-4 text-green-500" />
              <span className="font-bold text-white text-sm">{show.eventName}</span>
            </div>
            <span className="text-[10px] text-gray-500">
              {show.scores.length} ensembles
            </span>
          </div>

          {/* Medal Cards Grid */}
          <div className="p-4">
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {show.scores.map((score, idx) => (
                <MedalCard
                  key={idx}
                  ensemble={score.corps}
                  rating={getSoundSportRating(score.score)}
                />
              ))}
            </div>

            {/* Summary */}
            <div className="mt-3 pt-3 border-t border-[#333]/50 flex flex-wrap gap-4 text-[10px] text-gray-500">
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {show.scores.length} Total
              </span>
              <span className="flex items-center gap-1 text-yellow-500">
                <Medal className="w-3 h-3" />
                {show.scores.filter(s => s.score >= 90).length} Gold
              </span>
              <span className="flex items-center gap-1 text-gray-300">
                <Medal className="w-3 h-3" />
                {show.scores.filter(s => s.score >= 75 && s.score < 90).length} Silver
              </span>
            </div>
          </div>
        </div>
      ))}

      {/* Learn More Link */}
      <div className="px-4 py-3 bg-[#111]">
        <Link
          to="/soundsport"
          className="flex items-center gap-2 text-xs text-green-400 hover:text-green-300 font-bold transition-colors"
        >
          Learn about SoundSport scoring
          <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
};

// =============================================================================
// MAIN SCORES COMPONENT
// =============================================================================

const Scores = () => {
  const { user } = useAuth();
  const loggedInProfile = useUserStore((state) => state.loggedInProfile);
  const completeDailyChallenge = useUserStore((state) => state.completeDailyChallenge);
  const formatSeasonName = useSeasonStore((state) => state.formatSeasonName);
  const [searchParams] = useSearchParams();
  const { trigger: haptic } = useHaptic();

  const targetShowName = searchParams.get('show');
  const targetSeasonId = searchParams.get('season');

  const [activeTab, setActiveTab] = useState(targetShowName ? 'latest' : 'latest');
  const [selectedShow, setSelectedShow] = useState(null);

  // Score breakdown modal
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [selectedScore, setSelectedScore] = useState(null);
  const [selectedShowInfo, setSelectedShowInfo] = useState({});
  const [previousScore, setPreviousScore] = useState(null);
  const [previousShowInfo, setPreviousShowInfo] = useState(null);

  const {
    loading,
    error,
    allShows,
    unfilteredShows,
    stats,
    aggregatedScores,
    refetch,
  } = useScoresData({
    seasonId: targetSeasonId,
    classFilter: 'all',
    enabledCaptions: { ge: true, vis: true, mus: true }
  });

  const handleRefresh = async () => {
    haptic('pull');
    await refetch?.();
    haptic('success');
  };

  const currentSeasonName = useMemo(() => {
    return formatSeasonName?.() || 'Current Season';
  }, [formatSeasonName]);

  const userCorpsName = useMemo(() => {
    if (!loggedInProfile?.corps) return null;
    const activeCorps = Object.values(loggedInProfile.corps).find(c => c?.lineup);
    return activeCorps?.corpsName || null;
  }, [loggedInProfile?.corps]);

  useEffect(() => {
    if (user && loggedInProfile && completeDailyChallenge) {
      completeDailyChallenge('check_leaderboard');
    }
  }, [user, loggedInProfile, completeDailyChallenge]);

  useEffect(() => {
    if (targetShowName) {
      setActiveTab('latest');
    }
  }, [targetShowName]);

  const standingsColumns = useMemo(() => createStandingsColumns(), []);

  const highlightRow = useCallback((row) => {
    const corpsName = row.corps || row.corpsName;
    return userCorpsName && corpsName?.toLowerCase() === userCorpsName.toLowerCase();
  }, [userCorpsName]);

  const handleRowClick = useCallback((entry) => {
    if (entry.scores && entry.scores.length > 0) {
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

  // Filter standings by class
  const filteredStandings = useMemo(() => {
    if (activeTab === 'world') {
      return aggregatedScores.filter(s => s.corpsClass === 'worldClass');
    }
    if (activeTab === 'open') {
      return aggregatedScores.filter(s =>
        s.corpsClass === 'openClass' || s.corpsClass === 'aClass'
      );
    }
    return aggregatedScores;
  }, [aggregatedScores, activeTab]);

  // Get shows with scores for Latest Recaps
  const recentShows = useMemo(() => {
    return allShows
      .filter(s => s.scores && s.scores.length > 0)
      .slice(0, 10);
  }, [allShows]);

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
              <p className="text-[10px] text-gray-500">{currentSeasonName}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="text-right">
              <div className="text-[10px] text-gray-500 uppercase">Corps</div>
              <div className="font-bold text-white tabular-nums">{stats.corpsActive || 0}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-gray-500 uppercase">High</div>
              <div className="font-bold text-green-400 tabular-nums">{stats.topScore || '-'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* SEGMENTED CONTROL */}
      <div className="flex-shrink-0 bg-[#1a1a1a] border-b border-[#333] px-3 py-2">
        <div className="flex items-center gap-1 p-1 bg-[#111] border border-[#333] rounded-sm">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { haptic('medium'); setActiveTab(tab.id); }}
              className={`flex-1 px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? tab.accent === 'green'
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-[#0057B8] text-white'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* SCROLLABLE CONTENT */}
      <div className="flex-1 overflow-y-auto min-h-0 pb-20 md:pb-4">
        <PullToRefresh onRefresh={handleRefresh}>
          {loading ? (
            <div className="p-8 text-center text-gray-500 text-sm">Loading scores...</div>
          ) : error ? (
            <div className="p-8 text-center text-red-500 text-sm">{error}</div>
          ) : (
            <>
              {/* LATEST RECAPS TAB */}
              {activeTab === 'latest' && (
                <div>
                  {/* Section Header */}
                  <div className="bg-[#222] px-4 py-2 border-b border-[#333]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Recent Shows
                    </span>
                  </div>

                  {recentShows.length > 0 ? (
                    recentShows.map((show, idx) => (
                      <ShowSummaryStrip
                        key={idx}
                        show={show}
                        onViewFull={setSelectedShow}
                      />
                    ))
                  ) : (
                    <div className="p-8 text-center">
                      <Calendar className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">No recent shows</p>
                    </div>
                  )}
                </div>
              )}

              {/* WORLD STANDINGS TAB */}
              {activeTab === 'world' && (
                <div>
                  <div className="bg-[#222] px-4 py-2 border-b border-[#333]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      World Class Standings
                    </span>
                  </div>
                  <DataTable
                    columns={standingsColumns}
                    data={filteredStandings}
                    getRowKey={(row) => row.corpsName || row.corps}
                    onRowClick={handleRowClick}
                    zebraStripes={true}
                    highlightRow={highlightRow}
                    maxHeight="calc(100vh - 220px)"
                    emptyState={
                      <div className="p-8 text-center">
                        <Trophy className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                        <p className="text-gray-500 text-sm">No World Class standings</p>
                      </div>
                    }
                  />
                </div>
              )}

              {/* OPEN/CLASS A STANDINGS TAB */}
              {activeTab === 'open' && (
                <div>
                  <div className="bg-[#222] px-4 py-2 border-b border-[#333]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Open & Class A Standings
                    </span>
                  </div>
                  <DataTable
                    columns={standingsColumns}
                    data={filteredStandings}
                    getRowKey={(row) => row.corpsName || row.corps}
                    onRowClick={handleRowClick}
                    zebraStripes={true}
                    highlightRow={highlightRow}
                    maxHeight="calc(100vh - 220px)"
                    emptyState={
                      <div className="p-8 text-center">
                        <Trophy className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                        <p className="text-gray-500 text-sm">No Open/Class A standings</p>
                      </div>
                    }
                  />
                </div>
              )}

              {/* SOUNDSPORT TAB */}
              {activeTab === 'soundsport' && (
                <SoundSportSection shows={unfilteredShows} />
              )}
            </>
          )}
        </PullToRefresh>
      </div>

      {/* SELECTED SHOW MODAL (Full Recap) */}
      {selectedShow && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/80"
            onClick={() => setSelectedShow(null)}
          />
          <div className="relative w-full max-w-lg max-h-[80vh] bg-[#1a1a1a] border border-[#333] sm:rounded-sm overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="bg-[#222] px-4 py-3 border-b border-[#333] flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-sm font-bold text-white">{selectedShow.eventName}</h2>
                <p className="text-[10px] text-gray-500">
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

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="divide-y divide-[#333]">
                {selectedShow.scores.map((score, idx) => (
                  <div key={idx} className="px-4 py-2.5 flex items-center justify-between hover:bg-[#111]">
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 flex items-center justify-center text-[10px] font-bold rounded-sm ${
                        idx === 0 ? 'bg-yellow-500 text-black' :
                        idx === 1 ? 'bg-gray-400 text-black' :
                        idx === 2 ? 'bg-orange-400 text-black' :
                        'bg-[#333] text-gray-400'
                      }`}>
                        {idx + 1}
                      </span>
                      <span className="text-sm text-white">{score.corps || score.corpsName}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="font-data tabular-nums text-white font-bold">
                        {(score.score || score.totalScore || 0).toFixed(3)}
                      </span>
                      <div className="text-gray-500 hidden sm:flex gap-2">
                        <span>GE: {score.geScore?.toFixed(1) || '-'}</span>
                        <span>VIS: {score.visualScore?.toFixed(1) || '-'}</span>
                        <span>MUS: {score.musicScore?.toFixed(1) || '-'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

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
