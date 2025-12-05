// src/pages/CorpsHistory.jsx
// Fixed Height Split Layout: Top Stats + Bottom Split (Chart/Timeline)
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, Calendar, Star, TrendingUp, Award, Music,
  ChevronRight, MapPin, Target, Activity, AlertTriangle, RefreshCw,
  BarChart3, Clock, Medal, Crown, History
} from 'lucide-react';
import { useAuth } from '../App';
import { db, dataNamespace } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import LoadingScreen from '../components/LoadingScreen';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

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

    const profileRef = doc(db, 'artifacts', dataNamespace, 'users', user.uid, 'profile', 'data');
    const unsubscribe = onSnapshot(
      profileRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const profileData = snapshot.data();
          setCorps(profileData.corps || {});

          // Auto-select first corps with history
          if (!selectedCorpsClass && profileData.corps) {
            const corpsWithHistory = Object.entries(profileData.corps)
              .find(([_, corpsData]) => corpsData?.seasonHistory?.length > 0);
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
      soundSport: 'SoundSport'
    };
    return classNames[corpsClass] || corpsClass;
  };

  const getClassColor = (corpsClass) => {
    const colors = {
      worldClass: 'text-gold-400 bg-gold-500/20 border-gold-500/30',
      openClass: 'text-purple-400 bg-purple-500/20 border-purple-500/30',
      aClass: 'text-blue-400 bg-blue-500/20 border-blue-500/30',
      soundSport: 'text-green-400 bg-green-500/20 border-green-500/30'
    };
    return colors[corpsClass] || 'text-cream-400 bg-cream-500/20 border-cream-500/30';
  };

  const activeCorps = selectedCorpsClass ? corps?.[selectedCorpsClass] : null;
  const seasonHistory = useMemo(() => {
    return (activeCorps?.seasonHistory || []).sort((a, b) =>
      (b.archivedAt?.seconds || 0) - (a.archivedAt?.seconds || 0)
    );
  }, [activeCorps]);
  const hasHistory = seasonHistory.length > 0;

  // Calculate career stats
  const careerStats = useMemo(() => ({
    totalSeasons: seasonHistory.length,
    totalShows: seasonHistory.reduce((sum, season) => sum + (season.showsAttended || 0), 0),
    totalPoints: seasonHistory.reduce((sum, season) => sum + (season.totalSeasonScore || 0), 0),
    bestSeasonScore: Math.max(...seasonHistory.map(s => s.totalSeasonScore || 0), 0),
    bestWeeklyScore: Math.max(...seasonHistory.map(s => s.highestWeeklyScore || 0), 0),
    averageSeasonScore: seasonHistory.length > 0
      ? seasonHistory.reduce((sum, s) => sum + (s.totalSeasonScore || 0), 0) / seasonHistory.length
      : 0
  }), [seasonHistory]);

  // Prepare chart data
  const chartData = useMemo(() => ({
    labels: [...seasonHistory].reverse().map(s => s.seasonName || 'Unknown'),
    datasets: [
      {
        label: 'Season Score',
        data: [...seasonHistory].reverse().map(s => s.totalSeasonScore || 0),
        borderColor: 'rgb(250, 204, 21)',
        backgroundColor: 'rgba(250, 204, 21, 0.1)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: 'rgb(250, 204, 21)',
        pointBorderColor: '#0A0A0A',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7
      }
    ]
  }), [seasonHistory]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(10, 10, 10, 0.9)',
        titleColor: '#F5F5DC',
        bodyColor: '#F5F5DC',
        borderColor: 'rgb(250, 204, 21)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(245, 245, 220, 0.05)' },
        ticks: { color: 'rgba(245, 245, 220, 0.6)', font: { family: 'JetBrains Mono' } }
      },
      x: {
        grid: { color: 'rgba(245, 245, 220, 0.05)' },
        ticks: { color: 'rgba(245, 245, 220, 0.6)', maxRotation: 45, font: { family: 'JetBrains Mono', size: 10 } }
      }
    }
  };

  if (loading) {
    return <LoadingScreen fullScreen={false} />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center p-8 bg-charcoal-900/50 border border-red-500/20 rounded-xl max-w-md">
          <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-cream-100 mb-2">Error Loading History</h2>
          <p className="text-cream-500/60 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gold-500 text-charcoal-900 rounded-lg font-bold"
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
          <Music className="w-16 h-16 text-cream-500/20 mx-auto mb-4" />
          <h3 className="text-2xl font-display font-bold text-cream-100 mb-2">No Corps Found</h3>
          <p className="text-cream-500/60">Create a corps to start building your legacy!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ================================================================
          FIXED HEIGHT LAYOUT: Top Stats + Bottom Split
          ================================================================ */}

      {/* ============================================================
          TOP: Corps Selector + Stats Row
          ============================================================ */}
      <div className="flex-shrink-0 border-b border-cream-500/10 bg-charcoal-950/50">
        <div className="p-4 lg:p-6">
          {/* Header & Corps Selector */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gold-500/30 to-purple-500/30 border-2 border-gold-500/50 flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-gold-400" />
              </div>
              <div>
                <h1 className="text-xl font-display font-bold text-cream-100 uppercase tracking-wide">
                  Corps History
                </h1>
                <p className="text-xs text-cream-500/60">
                  Track performance and growth over time
                </p>
              </div>
            </div>

            {/* Corps Selector Pills */}
            <div className="flex gap-2 flex-wrap">
              {Object.entries(corps)
                .sort((a, b) => {
                  const classOrder = { worldClass: 0, openClass: 1, aClass: 2, soundSport: 3 };
                  return (classOrder[a[0]] ?? 99) - (classOrder[b[0]] ?? 99);
                })
                .map(([corpsClass, corpsData]) => (
                  <button
                    key={corpsClass}
                    onClick={() => {
                      setSelectedCorpsClass(corpsClass);
                      setSelectedSeason(null);
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all ${
                      selectedCorpsClass === corpsClass
                        ? 'bg-gold-500/20 border-gold-500/50 text-gold-400'
                        : 'bg-charcoal-900/30 border-cream-500/10 text-cream-400 hover:border-cream-500/30'
                    }`}
                  >
                    <Music className="w-4 h-4" />
                    <div className="text-left">
                      <div className="text-sm font-display font-bold">{corpsData.corpsName}</div>
                      <div className="text-[10px] opacity-75">{getClassDisplayName(corpsClass)}</div>
                    </div>
                  </button>
                ))}
            </div>
          </div>

          {/* Stats Row */}
          {activeCorps && (
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              <div className="bg-charcoal-900/50 border border-cream-500/10 rounded-xl p-3 text-center">
                <p className="text-[10px] text-cream-500/60 uppercase tracking-wide mb-1">Seasons</p>
                <p className="text-xl font-mono font-bold text-cream-100">{careerStats.totalSeasons}</p>
              </div>
              <div className="bg-charcoal-900/50 border border-cream-500/10 rounded-xl p-3 text-center">
                <p className="text-[10px] text-cream-500/60 uppercase tracking-wide mb-1">Shows</p>
                <p className="text-xl font-mono font-bold text-cream-100">{careerStats.totalShows}</p>
              </div>
              <div className="bg-charcoal-900/50 border border-cream-500/10 rounded-xl p-3 text-center">
                <p className="text-[10px] text-cream-500/60 uppercase tracking-wide mb-1">Total Pts</p>
                <p className="text-xl font-mono font-bold text-cream-100">{careerStats.totalPoints.toFixed(1)}</p>
              </div>
              <div className="bg-gold-500/10 border border-gold-500/20 rounded-xl p-3 text-center">
                <p className="text-[10px] text-gold-400 uppercase tracking-wide mb-1">Best Season</p>
                <p className="text-xl font-mono font-bold text-gold-400">{careerStats.bestSeasonScore.toFixed(1)}</p>
              </div>
              <div className="bg-charcoal-900/50 border border-cream-500/10 rounded-xl p-3 text-center">
                <p className="text-[10px] text-cream-500/60 uppercase tracking-wide mb-1">Best Week</p>
                <p className="text-xl font-mono font-bold text-cream-100">{careerStats.bestWeeklyScore.toFixed(1)}</p>
              </div>
              <div className="bg-charcoal-900/50 border border-cream-500/10 rounded-xl p-3 text-center">
                <p className="text-[10px] text-cream-500/60 uppercase tracking-wide mb-1">Avg Season</p>
                <p className="text-xl font-mono font-bold text-cream-100">{careerStats.averageSeasonScore.toFixed(1)}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================
          BOTTOM: Split View (Chart/Timeline on Left, Season Detail on Right)
          ============================================================ */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">

        {/* LEFT: Chart or Timeline View */}
        <div className="flex-1 flex flex-col min-h-0 lg:border-r border-cream-500/10">
          {/* View Toggle */}
          <div className="flex-shrink-0 flex items-center justify-between p-3 border-b border-cream-500/10 bg-charcoal-950/30">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveView('chart')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-bold uppercase tracking-wide transition-all ${
                  activeView === 'chart'
                    ? 'bg-gold-500/20 text-gold-400'
                    : 'text-cream-500/60 hover:text-cream-300'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                Chart
              </button>
              <button
                onClick={() => setActiveView('timeline')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-bold uppercase tracking-wide transition-all ${
                  activeView === 'timeline'
                    ? 'bg-gold-500/20 text-gold-400'
                    : 'text-cream-500/60 hover:text-cream-300'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                Timeline
              </button>
            </div>
            <span className="text-xs text-cream-500/40">{seasonHistory.length} seasons</span>
          </div>

          {/* Content Area */}
          <div className="flex-1 min-h-0 overflow-y-auto hud-scroll p-4 lg:p-6">
            {!hasHistory ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <Calendar className="w-12 h-12 text-cream-500/20 mx-auto mb-3" />
                  <h3 className="text-xl font-display font-bold text-cream-100 mb-2">No Season History Yet</h3>
                  <p className="text-cream-500/60 text-sm">
                    Complete your first season to start building your corps' legacy!
                  </p>
                </div>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                {activeView === 'chart' ? (
                  <motion.div
                    key="chart"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-full min-h-[300px]"
                  >
                    <h3 className="text-sm font-display font-bold text-cream-300 uppercase tracking-wide mb-4 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-gold-400" />
                      Performance Over Time
                    </h3>
                    <div className="h-[calc(100%-40px)] bg-charcoal-900/30 border border-cream-500/10 rounded-xl p-4">
                      <Line data={chartData} options={chartOptions} />
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
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
                          className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                            isSelected
                              ? 'bg-gold-500/20 border-gold-500/50 shadow-[0_0_12px_rgba(234,179,8,0.2)]'
                              : 'bg-charcoal-900/30 border-cream-500/10 hover:border-cream-500/30'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                              isSelected ? 'bg-gold-500/30' : 'bg-charcoal-800'
                            }`}>
                              <Trophy className={`w-5 h-5 ${isSelected ? 'text-gold-400' : 'text-cream-400'}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className={`font-display font-bold truncate ${isSelected ? 'text-gold-400' : 'text-cream-100'}`}>
                                  {season.seasonName || 'Unknown Season'}
                                </h4>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getClassColor(season.corpsClass)}`}>
                                  {getClassDisplayName(season.corpsClass)}
                                </span>
                              </div>
                              <div className="flex items-center gap-4 text-xs text-cream-500/60">
                                <span className="flex items-center gap-1">
                                  <Star className="w-3 h-3" />
                                  {(season.totalSeasonScore || 0).toFixed(1)} pts
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
                            <ChevronRight className={`w-5 h-5 transition-transform ${
                              isSelected ? 'text-gold-400 rotate-90' : 'text-cream-500/40'
                            }`} />
                          </div>
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* RIGHT: Season Detail Panel (visible on lg+) */}
        <div className="hidden lg:flex lg:w-80 xl:w-96 flex-col min-h-0 bg-charcoal-950/30">
          {selectedSeason !== null && seasonHistory[selectedSeason] ? (
            (() => {
              const season = seasonHistory[selectedSeason];
              const weeklyScores = season.weeklyScores || {};
              const weeks = Object.keys(weeklyScores).sort();

              return (
                <>
                  {/* Panel Header */}
                  <div className="flex-shrink-0 p-4 border-b border-cream-500/10">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gold-500/20 flex items-center justify-center">
                        <Trophy className="w-5 h-5 text-gold-400" />
                      </div>
                      <div>
                        <h3 className="font-display font-bold text-cream-100 truncate">{season.seasonName}</h3>
                        <p className="text-xs text-cream-500/60">
                          {season.archivedAt
                            ? new Date(season.archivedAt.seconds * 1000).toLocaleDateString()
                            : 'Unknown date'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Panel Content */}
                  <div className="flex-1 min-h-0 overflow-y-auto hud-scroll p-4 space-y-4">
                    {/* Final Score */}
                    <div className="bg-gold-500/10 border border-gold-500/20 rounded-xl p-4 text-center">
                      <p className="text-xs text-gold-400 uppercase tracking-wide mb-1">Final Score</p>
                      <p className="text-3xl font-mono font-bold text-gold-400">
                        {(season.totalSeasonScore || 0).toFixed(1)}
                      </p>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-charcoal-900/50 border border-cream-500/10 rounded-xl p-3 text-center">
                        <p className="text-[10px] text-cream-500/60 uppercase tracking-wide mb-1">Best Week</p>
                        <p className="text-xl font-mono font-bold text-cream-100">{(season.highestWeeklyScore || 0).toFixed(1)}</p>
                      </div>
                      <div className="bg-charcoal-900/50 border border-cream-500/10 rounded-xl p-3 text-center">
                        <p className="text-[10px] text-cream-500/60 uppercase tracking-wide mb-1">Shows</p>
                        <p className="text-xl font-mono font-bold text-cream-100">{season.showsAttended || 0}</p>
                      </div>
                    </div>

                    {/* Weekly Performance */}
                    {weeks.length > 0 && (
                      <div>
                        <h4 className="text-xs font-display font-bold text-cream-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 text-purple-400" />
                          Weekly Breakdown
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                          {weeks.map(week => (
                            <div key={week} className="bg-charcoal-800/50 rounded-lg p-2 flex items-center justify-between">
                              <span className="text-xs text-cream-500/60">{week}</span>
                              <span className="text-xs font-mono font-bold text-cream-100">
                                {(weeklyScores[week] || 0).toFixed(1)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Lineup */}
                    {season.lineup && Object.keys(season.lineup).length > 0 && (
                      <div>
                        <h4 className="text-xs font-display font-bold text-cream-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                          <Target className="w-4 h-4 text-blue-400" />
                          Season Lineup
                        </h4>
                        <div className="space-y-2">
                          {Object.entries(season.lineup).map(([caption, value]) => {
                            const [corpsName, year] = (value || '').split('|');
                            return (
                              <div key={caption} className="bg-charcoal-800/50 rounded-lg p-2">
                                <div className="text-[10px] text-cream-500/60 uppercase">{caption}</div>
                                <div className="text-sm font-semibold text-cream-100 truncate">
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
                <History className="w-12 h-12 text-cream-500/20 mx-auto mb-3" />
                <p className="text-sm text-cream-500/60">
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
