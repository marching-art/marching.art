import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, Calendar, Star, TrendingUp, Award, Music,
  ChevronDown, ChevronUp, MapPin, Target, Activity,
  BarChart3, Clock, Medal, Crown
} from 'lucide-react';
import { useAuth } from '../App';
import { db, dataNamespace } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { SkeletonLoader } from '../components/LoadingScreen';
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
  const [selectedCorpsClass, setSelectedCorpsClass] = useState(null);
  const [expandedSeason, setExpandedSeason] = useState(null);

  useEffect(() => {
    if (!user?.uid) return;

    const profileRef = doc(db, 'artifacts', dataNamespace, 'users', user.uid, 'profile', 'data');
    const unsubscribe = onSnapshot(profileRef, (snapshot) => {
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
    });

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
      worldClass: 'from-purple-500 to-pink-500',
      openClass: 'from-blue-500 to-cyan-500',
      aClass: 'from-green-500 to-emerald-500',
      soundSport: 'from-orange-500 to-yellow-500'
    };
    return colors[corpsClass] || 'from-gray-500 to-gray-600';
  };

  const activeCorps = selectedCorpsClass ? corps?.[selectedCorpsClass] : null;
  const seasonHistory = activeCorps?.seasonHistory || [];
  const hasHistory = seasonHistory.length > 0;

  // Calculate career stats
  const careerStats = {
    totalSeasons: seasonHistory.length,
    totalShows: seasonHistory.reduce((sum, season) => sum + (season.showsAttended || 0), 0),
    totalPoints: seasonHistory.reduce((sum, season) => sum + (season.totalSeasonScore || 0), 0),
    bestSeasonScore: Math.max(...seasonHistory.map(s => s.totalSeasonScore || 0), 0),
    bestWeeklyScore: Math.max(...seasonHistory.map(s => s.highestWeeklyScore || 0), 0),
    averageSeasonScore: seasonHistory.length > 0
      ? seasonHistory.reduce((sum, s) => sum + (s.totalSeasonScore || 0), 0) / seasonHistory.length
      : 0
  };

  // Prepare chart data
  const chartData = {
    labels: seasonHistory.map(s => s.seasonName || 'Unknown').reverse(),
    datasets: [
      {
        label: 'Season Score',
        data: seasonHistory.map(s => s.totalSeasonScore || 0).reverse(),
        borderColor: 'rgb(168, 85, 247)',
        backgroundColor: 'rgba(168, 85, 247, 0.1)',
        fill: true,
        tension: 0.4
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: 'rgb(168, 85, 247)',
        borderWidth: 1
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        },
        ticks: {
          color: '#9ca3af'
        }
      },
      x: {
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        },
        ticks: {
          color: '#9ca3af'
        }
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-4 sm:p-6">
        <SkeletonLoader />
      </div>
    );
  }

  if (!corps || Object.keys(corps).length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-4 sm:p-6">
        <div className="max-w-4xl mx-auto text-center py-16">
          <Music className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <h3 className="text-2xl font-bold text-white mb-2">No Corps Found</h3>
          <p className="text-gray-400">Create a corps to start building your legacy!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-4 sm:p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto mb-8"
      >
        <div className="flex items-center gap-3 mb-2">
          <BarChart3 className="w-8 h-8 text-purple-400" />
          <h1 className="text-3xl sm:text-4xl font-bold text-white">
            Corps History
          </h1>
        </div>
        <p className="text-gray-300 text-lg">
          Track your corps' performance and growth over time
        </p>
      </motion.div>

      {/* Corps Selector */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto mb-6"
      >
        <div className="flex gap-2 flex-wrap">
          {Object.entries(corps).map(([corpsClass, corpsData]) => (
            <button
              key={corpsClass}
              onClick={() => setSelectedCorpsClass(corpsClass)}
              className={`px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 ${
                selectedCorpsClass === corpsClass
                  ? `bg-gradient-to-r ${getClassColor(corpsClass)} text-white shadow-lg`
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              <Music className="w-4 h-4" />
              <div className="text-left">
                <div className="text-sm">{corpsData.corpsName}</div>
                <div className="text-xs opacity-75">{getClassDisplayName(corpsClass)}</div>
              </div>
            </button>
          ))}
        </div>
      </motion.div>

      {activeCorps && (
        <>
          {/* Career Stats Overview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-7xl mx-auto mb-8"
          >
            <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <Trophy className="w-6 h-6 text-yellow-400" />
                Career Stats - {activeCorps.corpsName}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="bg-white/5 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-4 h-4 text-blue-400" />
                    <span className="text-xs text-gray-400">Seasons</span>
                  </div>
                  <div className="text-3xl font-bold text-white">{careerStats.totalSeasons}</div>
                </div>

                <div className="bg-white/5 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Star className="w-4 h-4 text-purple-400" />
                    <span className="text-xs text-gray-400">Total Shows</span>
                  </div>
                  <div className="text-3xl font-bold text-white">{careerStats.totalShows}</div>
                </div>

                <div className="bg-white/5 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Trophy className="w-4 h-4 text-yellow-400" />
                    <span className="text-xs text-gray-400">Total Points</span>
                  </div>
                  <div className="text-3xl font-bold text-white">{careerStats.totalPoints.toFixed(1)}</div>
                </div>

                <div className="bg-white/5 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Crown className="w-4 h-4 text-yellow-400" />
                    <span className="text-xs text-gray-400">Best Season</span>
                  </div>
                  <div className="text-3xl font-bold text-white">{careerStats.bestSeasonScore.toFixed(1)}</div>
                </div>

                <div className="bg-white/5 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Medal className="w-4 h-4 text-orange-400" />
                    <span className="text-xs text-gray-400">Best Week</span>
                  </div>
                  <div className="text-3xl font-bold text-white">{careerStats.bestWeeklyScore.toFixed(1)}</div>
                </div>

                <div className="bg-white/5 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-4 h-4 text-green-400" />
                    <span className="text-xs text-gray-400">Avg Season</span>
                  </div>
                  <div className="text-3xl font-bold text-white">{careerStats.averageSeasonScore.toFixed(1)}</div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Performance Chart */}
          {hasHistory && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="max-w-7xl mx-auto mb-8"
            >
              <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
                <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                  <Activity className="w-6 h-6 text-purple-400" />
                  Performance Over Time
                </h2>
                <div className="h-64">
                  <Line data={chartData} options={chartOptions} />
                </div>
              </div>
            </motion.div>
          )}

          {/* Season History Timeline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="max-w-7xl mx-auto"
          >
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <Clock className="w-6 h-6 text-blue-400" />
              Season History
            </h2>

            {!hasHistory && (
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-white/10 text-center">
                <Calendar className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                <h3 className="text-xl font-bold text-white mb-2">No Season History Yet</h3>
                <p className="text-gray-400">
                  Complete your first season to start building your corps' legacy!
                </p>
              </div>
            )}

            <div className="space-y-4">
              <AnimatePresence>
                {seasonHistory.sort((a, b) =>
                  (b.archivedAt?.seconds || 0) - (a.archivedAt?.seconds || 0)
                ).map((season, index) => {
                  const isExpanded = expandedSeason === index;
                  const weeklyScores = season.weeklyScores || {};
                  const weeks = Object.keys(weeklyScores).sort();

                  return (
                    <motion.div
                      key={`${season.seasonId}-${index}`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ delay: index * 0.05 }}
                      className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm rounded-xl overflow-hidden border border-white/10 hover:border-purple-500/50 transition-all"
                    >
                      {/* Season Header */}
                      <div
                        onClick={() => setExpandedSeason(isExpanded ? null : index)}
                        className="p-6 cursor-pointer hover:bg-white/5 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <Trophy className="w-6 h-6 text-yellow-400" />
                              <h3 className="text-xl font-bold text-white">
                                {season.seasonName || 'Unknown Season'}
                              </h3>
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r ${getClassColor(season.corpsClass)} text-white`}>
                                {getClassDisplayName(season.corpsClass)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-gray-400 text-sm mb-3">
                              <Calendar className="w-4 h-4" />
                              Archived: {season.archivedAt
                                ? new Date(season.archivedAt.seconds * 1000).toLocaleDateString()
                                : 'Unknown'}
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              <div className="bg-white/5 rounded-lg p-3">
                                <div className="text-xs text-gray-400 mb-1">Final Score</div>
                                <div className="text-2xl font-bold text-white">
                                  {season.totalSeasonScore?.toFixed(1) || '0.0'}
                                </div>
                              </div>
                              <div className="bg-white/5 rounded-lg p-3">
                                <div className="text-xs text-gray-400 mb-1">Best Week</div>
                                <div className="text-2xl font-bold text-white">
                                  {season.highestWeeklyScore?.toFixed(1) || '0.0'}
                                </div>
                              </div>
                              <div className="bg-white/5 rounded-lg p-3">
                                <div className="text-xs text-gray-400 mb-1">Shows</div>
                                <div className="text-2xl font-bold text-white">
                                  {season.showsAttended || 0}
                                </div>
                              </div>
                              <div className="bg-white/5 rounded-lg p-3">
                                <div className="text-xs text-gray-400 mb-1">Weeks</div>
                                <div className="text-2xl font-bold text-white">
                                  {weeks.length}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="ml-4">
                            {isExpanded ? (
                              <ChevronUp className="w-6 h-6 text-gray-400" />
                            ) : (
                              <ChevronDown className="w-6 h-6 text-gray-400" />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Expanded Season Details */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="border-t border-white/10"
                          >
                            <div className="p-6">
                              {/* Weekly Scores */}
                              <div className="mb-6">
                                <h4 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                                  <BarChart3 className="w-5 h-5 text-purple-400" />
                                  Weekly Performance
                                </h4>
                                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2">
                                  {weeks.map(week => (
                                    <div key={week} className="bg-white/5 rounded-lg p-3 text-center">
                                      <div className="text-xs text-gray-400 mb-1">{week}</div>
                                      <div className="text-lg font-bold text-white">
                                        {weeklyScores[week]?.toFixed(1) || '0.0'}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Lineup */}
                              {season.lineup && (
                                <div className="mb-6">
                                  <h4 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                                    <Target className="w-5 h-5 text-blue-400" />
                                    Season Lineup
                                  </h4>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {Object.entries(season.lineup).map(([caption, value]) => {
                                      const [corpsName, year] = (value || '').split('|');
                                      return (
                                        <div key={caption} className="bg-white/5 rounded-lg p-3">
                                          <div className="text-xs text-gray-400 mb-1">{caption}</div>
                                          <div className="text-sm font-semibold text-white truncate">
                                            {corpsName || 'Not Set'}
                                          </div>
                                          {year && (
                                            <div className="text-xs text-purple-400">{year}</div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* Shows Attended */}
                              {season.selectedShows && Object.keys(season.selectedShows).length > 0 && (
                                <div>
                                  <h4 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                                    <MapPin className="w-5 h-5 text-green-400" />
                                    Shows Attended
                                  </h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {Object.entries(season.selectedShows).map(([week, shows]) => (
                                      <div key={week} className="bg-white/5 rounded-lg p-3">
                                        <div className="text-sm font-semibold text-purple-400 mb-2">
                                          {week}
                                        </div>
                                        <div className="space-y-1">
                                          {shows.map((show, idx) => (
                                            <div key={idx} className="text-sm text-gray-300">
                                              {show.eventName}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
};

export default CorpsHistory;
