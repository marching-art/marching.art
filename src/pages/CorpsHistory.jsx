// src/pages/CorpsHistory.jsx
// Fixed Height Split Layout: Top Stats + Bottom Split (Chart/Timeline)
import React, { useState, useEffect, useMemo } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import {
  Trophy,
  Calendar,
  Star,
  TrendingUp,
  Music,
  ChevronRight,
  MapPin,
  Target,
  Activity,
  AlertTriangle,
  RefreshCw,
  BarChart3,
  History,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import BrandLogo from '../components/BrandLogo';
import { subscribeToProfile } from '../api/profile';
import { compareCorpsClasses } from '../utils/corps';
import LoadingScreen from '../components/LoadingScreen';
import { Line } from '../components/charts';
import { getSoundSportRating } from '../utils/scoresUtils';
import { toCanonicalClassKey } from '../utils/classUnlocks';

const CorpsHistory = () => {
  const { user } = useAuth();
  const [corps, setCorps] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCorpsClass, setSelectedCorpsClass] = useState(null);
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [activeView, setActiveView] = useState('chart'); // 'chart' or 'timeline'

  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = subscribeToProfile(
      user.uid,
      (profileData) => {
        if (profileData) {
          setCorps(profileData.corps || {});

          // Auto-select first corps with history
          if (!selectedCorpsClass && profileData.corps) {
            const corpsWithHistory = Object.entries(profileData.corps).find(
              ([_, corpsData]) => corpsData?.seasonHistory?.length > 0
            );
            if (corpsWithHistory) {
              setSelectedCorpsClass(corpsWithHistory[0]);
            } else {
              // If no history, select first available corps
              setSelectedCorpsClass(Object.keys(profileData.corps)[0]);
            }
          }
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error loading corps data:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, selectedCorpsClass]);

  const getClassDisplayName = (corpsClass) => {
    const classNames = {
      worldClass: 'World Class',
      openClass: 'Open Class',
      aClass: 'A Class',
      soundSport: 'SoundSport',
    };
    return classNames[corpsClass] || corpsClass;
  };

  const getClassColor = (corpsClass) => {
    const colors = {
      worldClass: 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30',
      openClass: 'text-purple-400 bg-purple-500/20 border-purple-500/30',
      aClass: 'text-blue-400 bg-blue-500/20 border-blue-500/30',
      soundSport: 'text-green-400 bg-green-500/20 border-green-500/30',
    };
    return colors[corpsClass] || 'text-gray-400 bg-white/20 border-white/30';
  };

  const activeCorps = selectedCorpsClass ? corps?.[selectedCorpsClass] : null;
  // SoundSport is a ratings-only format — its numeric scores must never be
  // displayed. When the selected corps is SoundSport we surface medal ratings
  // (Gold/Silver/Bronze/Participation) and best-in-show recognition instead.
  const isSoundSportView = toCanonicalClassKey(selectedCorpsClass || '') === 'soundSport';
  const seasonHistory = useMemo(() => {
    return (activeCorps?.seasonHistory || []).sort(
      (a, b) => (b.archivedAt?.seconds || 0) - (a.archivedAt?.seconds || 0)
    );
  }, [activeCorps]);
  const hasHistory = seasonHistory.length > 0;

  // Medal tallies + best rating for SoundSport corps, derived from season
  // scores without ever exposing the numbers themselves.
  const soundSportRatings = useMemo(() => {
    const counts = { Gold: 0, Silver: 0, Bronze: 0, Participation: 0 };
    let bestScore = 0;
    seasonHistory.forEach((s) => {
      const score = s.totalSeasonScore || 0;
      if (score > 0) {
        counts[getSoundSportRating(score)]++;
        if (score > bestScore) bestScore = score;
      }
    });
    return { counts, bestRating: bestScore > 0 ? getSoundSportRating(bestScore) : null };
  }, [seasonHistory]);

  // SoundSport has no line chart of scores; force the timeline view.
  const effectiveView = isSoundSportView ? 'timeline' : activeView;

  // Calculate career stats
  const careerStats = useMemo(
    () => ({
      totalSeasons: seasonHistory.length,
      totalShows: seasonHistory.reduce((sum, season) => sum + (season.showsAttended || 0), 0),
      totalPoints: seasonHistory.reduce((sum, season) => sum + (season.totalSeasonScore || 0), 0),
      bestSeasonScore: Math.max(...seasonHistory.map((s) => s.totalSeasonScore || 0), 0),
      bestWeeklyScore: Math.max(...seasonHistory.map((s) => s.highestWeeklyScore || 0), 0),
      averageSeasonScore:
        seasonHistory.length > 0
          ? seasonHistory.reduce((sum, s) => sum + (s.totalSeasonScore || 0), 0) /
            seasonHistory.length
          : 0,
    }),
    [seasonHistory]
  );

  // Prepare chart data
  const chartData = useMemo(
    () => ({
      labels: [...seasonHistory].reverse().map((s) => s.seasonName || 'Unknown'),
      datasets: [
        {
          label: 'Season Score',
          data: [...seasonHistory].reverse().map((s) => s.totalSeasonScore || 0),
          borderColor: 'rgb(250, 204, 21)',
          backgroundColor: 'rgba(250, 204, 21, 0.1)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: 'rgb(250, 204, 21)',
          pointBorderColor: '#0A0A0A',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7,
        },
      ],
    }),
    [seasonHistory]
  );

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    // Touch-friendly tooltips: snap to the nearest x-position instead of
    // requiring the finger to land exactly on a 5px point.
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(10, 10, 10, 0.9)',
        titleColor: '#F5F5DC',
        bodyColor: '#F5F5DC',
        borderColor: 'rgb(250, 204, 21)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(245, 245, 220, 0.05)' },
        ticks: { color: 'rgba(245, 245, 220, 0.6)', font: { family: 'JetBrains Mono' } },
      },
      x: {
        grid: { color: 'rgba(245, 245, 220, 0.05)' },
        ticks: {
          color: 'rgba(245, 245, 220, 0.6)',
          maxRotation: 45,
          font: { family: 'JetBrains Mono', size: 10 },
        },
      },
    },
  };

  if (loading) {
    return <LoadingScreen fullScreen={false} />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center p-8 bg-[#111] border border-red-500/20 rounded-none max-w-md">
          <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Error Loading History</h2>
          <p className="text-gray-500/60 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500 text-charcoal-900 rounded-none font-bold"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!corps || Object.keys(corps).length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center px-6">
          <BrandLogo className="w-16 h-16 mx-auto mb-4" color="text-gray-500/20" />
          <h3 className="text-2xl font-bold text-white mb-2">No Corps Found</h3>
          <p className="text-gray-500/60">Create a corps to start building your legacy!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden bg-[#0a0a0a]">
      {/* ================================================================
          FIXED HEIGHT LAYOUT: Top Stats + Bottom Split
          ================================================================ */}

      {/* ============================================================
          TOP: Corps Selector + Stats Row
          ============================================================ */}
      <div className="flex-shrink-0 border-b border-[#333] bg-[#1a1a1a]">
        <div className="p-4 lg:p-6">
          {/* Header & Corps Selector */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-5 h-5 text-[#0057B8] flex-shrink-0" aria-hidden="true" />
              <div>
                <h1 className="text-sm font-bold text-white uppercase tracking-wider">
                  Corps History
                </h1>
                <p className="text-[10px] text-gray-500">Track performance and growth over time</p>
              </div>
            </div>

            {/* Corps Selector Pills - sorted by class order (World → Open → A → SoundSport) */}
            <div className="flex gap-2 flex-wrap">
              {Object.entries(corps)
                .sort((a, b) => compareCorpsClasses(a[0], b[0]))
                .map(([corpsClass, corpsData]) => (
                  <button
                    key={corpsClass}
                    onClick={() => {
                      setSelectedCorpsClass(corpsClass);
                      setSelectedSeason(null);
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-none border transition-all ${
                      selectedCorpsClass === corpsClass
                        ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400'
                        : 'bg-[#111] border-[#333] text-gray-400 hover:border-[#444]'
                    }`}
                  >
                    <Music className="w-4 h-4" />
                    <div className="text-left">
                      <div className="text-sm font-bold">{corpsData.corpsName}</div>
                      <div className="text-[10px] opacity-75">
                        {getClassDisplayName(corpsClass)}
                      </div>
                    </div>
                  </button>
                ))}
            </div>
          </div>

          {/* Stats Row */}
          {activeCorps && (
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              <div className="bg-[#111] border border-[#333] rounded-none p-3 text-center">
                <p className="text-[10px] text-gray-500/60 uppercase tracking-wide mb-1">Seasons</p>
                <p className="text-xl font-mono font-bold text-white">{careerStats.totalSeasons}</p>
              </div>
              <div className="bg-[#111] border border-[#333] rounded-none p-3 text-center">
                <p className="text-[10px] text-gray-500/60 uppercase tracking-wide mb-1">Shows</p>
                <p className="text-xl font-mono font-bold text-white">{careerStats.totalShows}</p>
              </div>
              {isSoundSportView ? (
                <>
                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-none p-3 text-center">
                    <p className="text-[10px] text-yellow-400 uppercase tracking-wide mb-1">
                      Best Rating
                    </p>
                    <p className="text-xl font-bold text-yellow-400">
                      {soundSportRatings.bestRating || '—'}
                    </p>
                  </div>
                  <div className="bg-[#111] border border-[#333] rounded-none p-3 text-center">
                    <p className="text-[10px] text-gray-500/60 uppercase tracking-wide mb-1">
                      Gold
                    </p>
                    <p className="text-xl font-mono font-bold text-yellow-400">
                      {soundSportRatings.counts.Gold}
                    </p>
                  </div>
                  <div className="bg-[#111] border border-[#333] rounded-none p-3 text-center">
                    <p className="text-[10px] text-gray-500/60 uppercase tracking-wide mb-1">
                      Silver
                    </p>
                    <p className="text-xl font-mono font-bold text-gray-300">
                      {soundSportRatings.counts.Silver}
                    </p>
                  </div>
                  <div className="bg-[#111] border border-[#333] rounded-none p-3 text-center">
                    <p className="text-[10px] text-gray-500/60 uppercase tracking-wide mb-1">
                      Bronze
                    </p>
                    <p className="text-xl font-mono font-bold text-orange-400">
                      {soundSportRatings.counts.Bronze}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-[#111] border border-[#333] rounded-none p-3 text-center">
                    <p className="text-[10px] text-gray-500/60 uppercase tracking-wide mb-1">
                      Total Pts
                    </p>
                    <p className="text-xl font-mono font-bold text-white">
                      {careerStats.totalPoints.toFixed(3)}
                    </p>
                  </div>
                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-none p-3 text-center">
                    <p className="text-[10px] text-yellow-400 uppercase tracking-wide mb-1">
                      Best Season
                    </p>
                    <p className="text-xl font-mono font-bold text-yellow-400">
                      {careerStats.bestSeasonScore.toFixed(3)}
                    </p>
                  </div>
                  <div className="bg-[#111] border border-[#333] rounded-none p-3 text-center">
                    <p className="text-[10px] text-gray-500/60 uppercase tracking-wide mb-1">
                      Best Week
                    </p>
                    <p className="text-xl font-mono font-bold text-white">
                      {careerStats.bestWeeklyScore.toFixed(3)}
                    </p>
                  </div>
                  <div className="bg-[#111] border border-[#333] rounded-none p-3 text-center">
                    <p className="text-[10px] text-gray-500/60 uppercase tracking-wide mb-1">
                      Avg Season
                    </p>
                    <p className="text-xl font-mono font-bold text-white">
                      {careerStats.averageSeasonScore.toFixed(3)}
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ============================================================
          BOTTOM: Split View (Chart/Timeline on Left, Season Detail on Right)
          ============================================================ */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* LEFT: Chart or Timeline View */}
        <div className="flex-1 flex flex-col min-h-0 lg:border-r border-[#333]">
          {/* View Toggle */}
          <div className="flex-shrink-0 flex items-center justify-between p-3 border-b border-[#333] bg-[#111]">
            <div className="flex items-center gap-1">
              {/* SoundSport has no numeric score chart — only the timeline. */}
              {!isSoundSportView && (
                <button
                  onClick={() => setActiveView('chart')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-none text-xs font-bold uppercase tracking-wide transition-all ${
                    effectiveView === 'chart'
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : 'text-gray-500/60 hover:text-gray-300'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  Chart
                </button>
              )}
              <button
                onClick={() => setActiveView('timeline')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-none text-xs font-bold uppercase tracking-wide transition-all ${
                  effectiveView === 'timeline'
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : 'text-gray-500/60 hover:text-gray-300'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                Timeline
              </button>
            </div>
            <span className="text-xs text-gray-500/40">{seasonHistory.length} seasons</span>
          </div>

          {/* Content Area */}
          <div className="flex-1 min-h-0 overflow-y-auto hud-scroll p-4 lg:p-6">
            {!hasHistory ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <Calendar className="w-12 h-12 text-gray-500/20 mx-auto mb-3" />
                  <h3 className="text-xl font-bold text-white mb-2">No Season History Yet</h3>
                  <p className="text-gray-500/60 text-sm">
                    Complete your first season to start building your corps' legacy!
                  </p>
                </div>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                {effectiveView === 'chart' ? (
                  <m.div
                    key="chart"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-full min-h-[300px]"
                  >
                    <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wide mb-4 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-yellow-400" />
                      Performance Over Time
                    </h3>
                    <div className="h-[calc(100%-40px)] bg-[#111] border border-[#333] rounded-none p-4">
                      <Line data={chartData} options={chartOptions} />
                    </div>
                  </m.div>
                ) : (
                  <m.div
                    key="timeline"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-3"
                  >
                    {seasonHistory.map((season, index) => {
                      const isSelected = selectedSeason === index;
                      const weeklyScores = season.weeklyScores || {};
                      const weeks = Object.keys(weeklyScores).length;

                      return (
                        <button
                          key={`${season.seasonId}-${index}`}
                          onClick={() => setSelectedSeason(isSelected ? null : index)}
                          className={`w-full text-left p-4 rounded-none border transition-all ${
                            isSelected
                              ? 'bg-yellow-500/20 border-yellow-500/50'
                              : 'bg-[#111] border-[#333] hover:border-[#444]'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div
                              className={`w-12 h-12 rounded-none flex items-center justify-center ${
                                isSelected ? 'bg-yellow-500/30' : 'bg-[#222]'
                              }`}
                            >
                              <Trophy
                                className={`w-5 h-5 ${isSelected ? 'text-yellow-400' : 'text-gray-400'}`}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h4
                                  className={`font-bold truncate ${isSelected ? 'text-yellow-400' : 'text-white'}`}
                                >
                                  {season.seasonName || 'Unknown Season'}
                                </h4>
                                <span
                                  className={`px-2 py-0.5 rounded-none text-[10px] font-bold ${getClassColor(season.corpsClass)}`}
                                >
                                  {getClassDisplayName(season.corpsClass)}
                                </span>
                              </div>
                              <div className="flex items-center gap-4 text-xs text-gray-500/60">
                                <span className="flex items-center gap-1">
                                  <Star className="w-3 h-3" />
                                  {isSoundSportView
                                    ? season.totalSeasonScore > 0
                                      ? getSoundSportRating(season.totalSeasonScore)
                                      : '—'
                                    : `${(season.totalSeasonScore || 0).toFixed(3)} pts`}
                                </span>
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {season.showsAttended || 0} shows
                                </span>
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {weeks} weeks
                                </span>
                              </div>
                            </div>
                            <ChevronRight
                              className={`w-5 h-5 transition-transform ${
                                isSelected ? 'text-yellow-400 rotate-90' : 'text-gray-500/40'
                              }`}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </m.div>
                )}
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* RIGHT: Season Detail Panel (visible on lg+) */}
        <div className="hidden lg:flex lg:w-80 xl:w-96 flex-col min-h-0 bg-[#111]">
          {selectedSeason !== null && seasonHistory[selectedSeason] ? (
            (() => {
              const season = seasonHistory[selectedSeason];
              const weeklyScores = season.weeklyScores || {};
              const weeks = Object.keys(weeklyScores).sort();

              return (
                <>
                  {/* Panel Header */}
                  <div className="flex-shrink-0 p-4 border-b border-[#333]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-none bg-yellow-500/20 flex items-center justify-center">
                        <Trophy className="w-5 h-5 text-yellow-400" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white truncate">{season.seasonName}</h3>
                        <p className="text-xs text-gray-500/60">
                          {season.archivedAt
                            ? new Date(season.archivedAt.seconds * 1000).toLocaleDateString()
                            : 'Unknown date'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Panel Content */}
                  <div className="flex-1 min-h-0 overflow-y-auto hud-scroll p-4 space-y-4">
                    {/* Final Score / Rating */}
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-none p-4 text-center">
                      <p className="text-xs text-yellow-400 uppercase tracking-wide mb-1">
                        {isSoundSportView ? 'Rating' : 'Final Score'}
                      </p>
                      <p className="text-3xl font-bold text-yellow-400 font-mono">
                        {isSoundSportView
                          ? season.totalSeasonScore > 0
                            ? getSoundSportRating(season.totalSeasonScore)
                            : '—'
                          : (season.totalSeasonScore || 0).toFixed(3)}
                      </p>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-[#111] border border-[#333] rounded-none p-3 text-center">
                        <p className="text-[10px] text-gray-500/60 uppercase tracking-wide mb-1">
                          Best Week
                        </p>
                        <p className="text-xl font-mono font-bold text-white">
                          {isSoundSportView
                            ? season.highestWeeklyScore > 0
                              ? getSoundSportRating(season.highestWeeklyScore)
                              : '—'
                            : (season.highestWeeklyScore || 0).toFixed(3)}
                        </p>
                      </div>
                      <div className="bg-[#111] border border-[#333] rounded-none p-3 text-center">
                        <p className="text-[10px] text-gray-500/60 uppercase tracking-wide mb-1">
                          Shows
                        </p>
                        <p className="text-xl font-mono font-bold text-white">
                          {season.showsAttended || 0}
                        </p>
                      </div>
                    </div>

                    {/* Weekly Performance */}
                    {weeks.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 text-purple-400" />
                          Weekly Breakdown
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                          {weeks.map((week) => (
                            <div
                              key={week}
                              className="bg-[#222] rounded-none p-2 flex items-center justify-between"
                            >
                              <span className="text-xs text-gray-500/60">{week}</span>
                              <span className="text-xs font-mono font-bold text-white">
                                {isSoundSportView
                                  ? weeklyScores[week] > 0
                                    ? getSoundSportRating(weeklyScores[week])
                                    : '—'
                                  : (weeklyScores[week] || 0).toFixed(3)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Lineup */}
                    {season.lineup && Object.keys(season.lineup).length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                          <Target className="w-4 h-4 text-blue-400" />
                          Season Lineup
                        </h4>
                        <div className="space-y-2">
                          {Object.entries(season.lineup).map(([caption, value]) => {
                            const [corpsName] = (value || '').split('|');
                            return (
                              <div key={caption} className="bg-[#222] rounded-none p-2">
                                <div className="text-[10px] text-gray-500/60 uppercase">
                                  {caption}
                                </div>
                                <div className="text-sm font-semibold text-white truncate">
                                  {corpsName || 'Not Set'}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              );
            })()
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center px-6">
                <History className="w-12 h-12 text-gray-500/20 mx-auto mb-3" />
                <p className="text-sm text-gray-500/60">
                  Select a season from the timeline to view details
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CorpsHistory;
