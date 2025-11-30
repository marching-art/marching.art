// src/pages/Scores.jsx
// Unified hub for scores, rankings, and statistics
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy,
  Calendar,
  TrendingUp,
  Clock,
  Award,
  Medal,
  ChevronRight,
  ChevronDown,
  Star,
  Music,
  Eye,
  Users,
  Crown,
  BarChart3,
  X
} from 'lucide-react';
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { db, dataNamespace } from '../firebase';
import { CAPTION_CATEGORIES } from '../utils/captionPricing';
import { useAuth } from '../App';
import { useUserStore } from '../store/userStore';
import LoadingScreen from '../components/LoadingScreen';
import Portal from '../components/Portal';
import toast from 'react-hot-toast';

const Scores = () => {
  const { user } = useAuth();
  const { loggedInProfile } = useUserStore();

  // Main tab state
  const [activeTab, setActiveTab] = useState('latest');
  const [loading, setLoading] = useState(true);

  // Scores data
  const [liveScores, setLiveScores] = useState([]);
  const [recentShows, setRecentShows] = useState([]);
  const [selectedShow, setSelectedShow] = useState(null);
  const [stats, setStats] = useState({ showsToday: 0, recentShows: 0, topScore: '-', corpsActive: 0 });
  const [currentSeason, setCurrentSeason] = useState(null);

  // Rankings/Leaderboard data
  const [leaderboardData, setLeaderboardData] = useState({
    overall: [],
    weekly: [],
    monthly: [],
    lifetime: []
  });
  const [rankingsTab, setRankingsTab] = useState('overall');
  const [activeClass, setActiveClass] = useState('world');
  const [userRank, setUserRank] = useState(null);
  const [lifetimeView, setLifetimeView] = useState('totalPoints');

  // Get current date for live scores
  const today = new Date().toISOString().split('T')[0];

  // Main tabs
  const mainTabs = [
    { id: 'latest', name: 'Latest Scores', icon: Clock, description: 'Recent shows' },
    { id: 'rankings', name: 'Rankings', icon: Trophy, description: 'Leaderboards' },
    { id: 'stats', name: 'Stats', icon: BarChart3, description: 'Lifetime' },
    { id: 'soundsport', name: 'SoundSport', icon: Music, description: 'Ratings' }
  ];

  // Rankings sub-tabs
  const rankingsTabs = [
    { id: 'overall', label: 'Overall', icon: Trophy },
    { id: 'weekly', label: 'Weekly', icon: TrendingUp },
    { id: 'monthly', label: 'Monthly', icon: Star }
  ];

  // Class filters
  const classes = [
    { id: 'world', label: 'World Class' },
    { id: 'open', label: 'Open Class' },
    { id: 'a', label: 'A Class' },
    { id: 'soundsport', label: 'SoundSport' }
  ];

  // Lifetime views
  const lifetimeViews = [
    { id: 'totalPoints', label: 'Total Points', desc: 'All-time points' },
    { id: 'totalSeasons', label: 'Seasons', desc: 'Seasons played' },
    { id: 'totalShows', label: 'Shows', desc: 'Shows attended' },
    { id: 'bestSeasonScore', label: 'Best Season', desc: 'Highest season score' },
    { id: 'leagueChampionships', label: 'Championships', desc: 'League titles won' }
  ];

  // Fetch current season info
  useEffect(() => {
    const fetchCurrentSeason = async () => {
      try {
        const seasonsRef = collection(db, 'seasons');
        const seasonsQuery = query(seasonsRef, where('status', '==', 'active'), limit(1));
        const snapshot = await getDocs(seasonsQuery);

        if (!snapshot.empty) {
          const seasonData = snapshot.docs[0].data();
          setCurrentSeason({ id: snapshot.docs[0].id, ...seasonData });
        }
      } catch (error) {
        console.error('Error fetching current season:', error);
      }
    };

    fetchCurrentSeason();
  }, []);

  // Fetch scores data (live + recent)
  useEffect(() => {
    const fetchScoresData = async () => {
      if (!currentSeason) return;
      if (activeTab !== 'latest' && activeTab !== 'soundsport') return;

      try {
        setLoading(true);
        const recapRef = doc(db, 'fantasy_recaps', currentSeason.id);
        const recapDoc = await getDoc(recapRef);

        if (recapDoc.exists()) {
          const data = recapDoc.data();

          // Get today's shows (live)
          const todayRecaps = data.recaps?.filter(recap => {
            const recapDate = recap.date?.toDate?.() || new Date(recap.date);
            const recapDateStr = recapDate.toISOString().split('T')[0];
            return recapDateStr === today;
          }) || [];

          const todayShows = todayRecaps.flatMap(recap =>
            recap.shows?.map(show => ({
              eventName: show.eventName,
              location: show.location,
              date: recap.date?.toDate?.().toLocaleDateString() || 'TBD',
              scores: show.results?.map(result => ({
                corps: result.corpsName,
                score: result.totalScore || 0,
                geScore: result.geScore || 0,
                visualScore: result.visualScore || 0,
                musicScore: result.musicScore || 0,
                corpsClass: result.corpsClass
              })).sort((a, b) => b.score - a.score) || []
            })) || []
          );

          setLiveScores(todayShows);

          // Get recent shows (past 7 days)
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

          const recentRecaps = data.recaps?.filter(recap => {
            const recapDate = recap.date?.toDate?.() || new Date(recap.date);
            return recapDate >= sevenDaysAgo;
          }) || [];

          const shows = recentRecaps.flatMap(recap =>
            recap.shows?.map(show => ({
              eventName: show.eventName,
              location: show.location,
              date: recap.date?.toDate?.().toLocaleDateString() || 'TBD',
              offSeasonDay: recap.offSeasonDay,
              scores: show.results?.map(result => ({
                corps: result.corpsName,
                score: result.totalScore || 0,
                geScore: result.geScore || 0,
                visualScore: result.visualScore || 0,
                musicScore: result.musicScore || 0,
                corpsClass: result.corpsClass
              })).sort((a, b) => b.score - a.score) || []
            })) || []
          ).sort((a, b) => b.offSeasonDay - a.offSeasonDay);

          setRecentShows(shows);

          // Calculate stats
          const allScores = shows.flatMap(show => show.scores.map(s => s.score));
          const topScore = allScores.length > 0 ? Math.max(...allScores).toFixed(3) : '-';
          const uniqueCorps = new Set(shows.flatMap(show => show.scores.map(s => s.corps)));

          setStats({
            showsToday: todayShows.length,
            recentShows: shows.length,
            topScore,
            corpsActive: uniqueCorps.size
          });
        }
        setLoading(false);
      } catch (error) {
        console.error('Error fetching scores:', error);
        setLoading(false);
      }
    };

    fetchScoresData();
  }, [activeTab, currentSeason, today]);

  // Fetch leaderboard data
  useEffect(() => {
    const fetchLeaderboardData = async () => {
      if (activeTab !== 'rankings' && activeTab !== 'stats') return;

      setLoading(true);
      try {
        const safeCollectionFetch = async (collectionPath, orderField = 'score') => {
          try {
            const collRef = collection(db, ...collectionPath);
            const q = query(collRef, orderBy(orderField, 'desc'), limit(100));
            const snapshot = await getDocs(q);
            return snapshot.docs.map((doc, index) => ({
              id: doc.id,
              rank: index + 1,
              ...doc.data()
            }));
          } catch (err) {
            console.log(`Collection ${collectionPath.join('/')} not found or empty`);
            return [];
          }
        };

        // Fetch overall leaderboard
        const overallData = await safeCollectionFetch(
          ['artifacts', dataNamespace, 'leaderboard', 'overall', activeClass]
        );

        // Fetch weekly leaderboard
        const weeklyData = await safeCollectionFetch(
          ['artifacts', dataNamespace, 'leaderboard', 'weekly', activeClass]
        );

        // Fetch monthly leaderboard
        const monthlyData = await safeCollectionFetch(
          ['artifacts', dataNamespace, 'leaderboard', 'monthly', activeClass]
        );

        // Fetch lifetime stats
        let sortedLifetimeData = [];
        try {
          const lifetimeRef = doc(db, `artifacts/${dataNamespace}/leaderboard/lifetime_${lifetimeView}/data`);
          const lifetimeDoc = await getDoc(lifetimeRef);

          if (lifetimeDoc.exists()) {
            const lifetimeLeaderboard = lifetimeDoc.data();
            sortedLifetimeData = (lifetimeLeaderboard.entries || []).map((entry, index) => ({
              id: entry.userId,
              rank: index + 1,
              username: entry.username,
              userTitle: entry.userTitle,
              lifetimeStats: entry.lifetimeStats
            }));
          }
        } catch (err) {
          console.log('Lifetime leaderboard not available yet');
        }

        setLeaderboardData({
          overall: overallData,
          weekly: weeklyData,
          monthly: monthlyData,
          lifetime: sortedLifetimeData
        });

        // Find user's rank if logged in
        if (user && loggedInProfile?.username) {
          const userData = overallData.find(entry => entry.username === loggedInProfile.username);
          if (userData) {
            setUserRank(userData.rank);
          }
        }

      } catch (error) {
        console.error('Error fetching leaderboard:', error);
        if (error.code !== 'permission-denied' && error.code !== 'not-found') {
          toast.error('Failed to load leaderboard data');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboardData();
  }, [activeTab, activeClass, user, loggedInProfile, lifetimeView]);

  // Helper functions for rankings
  const getRankIcon = (rank) => {
    switch (rank) {
      case 1:
        return <Crown className="w-5 h-5 md:w-6 md:h-6 text-yellow-400" />;
      case 2:
        return <Trophy className="w-5 h-5 md:w-6 md:h-6 text-gray-400" />;
      case 3:
        return <Medal className="w-5 h-5 md:w-6 md:h-6 text-orange-400" />;
      default:
        return <span className="text-cream-300 font-bold">#{rank}</span>;
    }
  };

  const getRankBgColor = (rank) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-yellow-400/20 to-yellow-500/10 border-yellow-400/30';
      case 2:
        return 'bg-gradient-to-r from-gray-400/20 to-gray-500/10 border-gray-400/30';
      case 3:
        return 'bg-gradient-to-r from-orange-400/20 to-orange-500/10 border-orange-400/30';
      default:
        if (rank <= 10) return 'bg-charcoal-800/30 border-cream-500/20';
        return 'bg-charcoal-900/30 border-cream-500/10';
    }
  };

  // SoundSport rating helper
  const getSoundSportRating = (score) => {
    if (score >= 90) return { rating: 'Gold', color: 'text-yellow-500', bgColor: 'bg-yellow-500/10', borderColor: 'border-yellow-500/30' };
    if (score >= 75) return { rating: 'Silver', color: 'text-gray-400', bgColor: 'bg-gray-500/10', borderColor: 'border-gray-400/30' };
    if (score >= 60) return { rating: 'Bronze', color: 'text-orange-600', bgColor: 'bg-orange-500/10', borderColor: 'border-orange-600/30' };
    return { rating: 'Participation', color: 'text-cream-500', bgColor: 'bg-cream-500/10', borderColor: 'border-cream-500/30' };
  };

  // Render Latest Scores tab
  const renderLatestScores = () => {
    if (loading) {
      return <LoadingScreen fullScreen={false} />;
    }

    const hasLiveShows = liveScores.length > 0;
    const hasRecentShows = recentShows.length > 0;

    return (
      <div className="space-y-6">
        {/* Live Shows */}
        {hasLiveShows && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-cream-100 flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              Live Now
            </h3>
            {liveScores.map((show, idx) => (
              <ShowCard key={`live-${idx}`} show={show} isLive={true} onClick={() => setSelectedShow(show)} />
            ))}
          </div>
        )}

        {/* Recent Shows */}
        {hasRecentShows ? (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-cream-100 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-cream-400" />
              Recent Shows
            </h3>
            {recentShows.map((show, idx) => (
              <ShowCard key={`recent-${idx}`} show={show} onClick={() => setSelectedShow(show)} />
            ))}
          </div>
        ) : !hasLiveShows && (
          <div className="card p-6 md:p-12 text-center">
            <Clock className="w-12 h-12 md:w-16 md:h-16 text-cream-500/40 mx-auto mb-4" />
            <p className="text-base md:text-xl text-cream-300 mb-2">No shows this week</p>
            <p className="text-sm text-cream-500/60 max-w-sm mx-auto">Check back during competition times or view the schedule</p>
          </div>
        )}
      </div>
    );
  };

  // Render Rankings tab
  const renderRankings = () => {
    const currentData = leaderboardData[rankingsTab];

    return (
      <div className="space-y-6">
        {/* User Rank Card */}
        {user && userRank && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-gradient-to-r from-gold-500/20 to-gold-400/10 border border-gold-500/30 rounded-lg p-4 md:p-6"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-gold-500/20 flex items-center justify-center">
                  {getRankIcon(userRank)}
                </div>
                <div>
                  <p className="text-cream-400 text-xs md:text-sm">Your Current Rank</p>
                  <p className="text-xl md:text-2xl font-bold text-cream-100">#{userRank}</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Rankings Sub-tabs */}
        <div className="flex justify-center">
          <div className="flex bg-charcoal-800/50 rounded-lg p-1">
            {rankingsTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setRankingsTab(tab.id)}
                  className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-6 py-2 md:py-3 rounded-lg transition-all text-sm md:text-base whitespace-nowrap ${
                    rankingsTab === tab.id
                      ? 'bg-gold-500 text-charcoal-900 font-medium'
                      : 'text-cream-300 hover:text-cream-100 hover:bg-charcoal-800/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Class Filter */}
        <div className="flex justify-center">
          <div className="flex flex-wrap gap-2 justify-center">
            {classes.map((cls) => (
              <button
                key={cls.id}
                onClick={() => setActiveClass(cls.id)}
                className={`px-3 md:px-4 py-2 rounded-lg transition-all text-sm ${
                  activeClass === cls.id
                    ? 'bg-cream-100 text-charcoal-900 font-medium'
                    : 'bg-charcoal-800/50 text-cream-300 hover:bg-charcoal-800'
                }`}
              >
                {cls.label}
              </button>
            ))}
          </div>
        </div>

        {/* Leaderboard Table/Cards */}
        <motion.div
          key={`${rankingsTab}-${activeClass}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-charcoal-800/30 rounded-lg overflow-hidden"
        >
          {loading ? (
            <LoadingScreen fullScreen={false} />
          ) : currentData.length > 0 ? (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-charcoal-900/50 border-b border-cream-500/10">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-medium text-cream-400">Rank</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-cream-400">Player</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-cream-400">Corps</th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-cream-400">Score</th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-cream-400">Trophies</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cream-500/10">
                    {currentData.map((entry) => (
                      <tr
                        key={entry.id}
                        className={`hover:bg-charcoal-800/50 transition-colors ${
                          loggedInProfile?.username === entry.username ? 'bg-gold-500/5' : ''
                        }`}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            {getRankIcon(entry.rank)}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-charcoal-800 flex items-center justify-center">
                              <Users className="w-5 h-5 text-cream-400" />
                            </div>
                            <div>
                              <p className="text-cream-100 font-medium">{entry.username}</p>
                              <p className="text-cream-500/60 text-sm">{entry.userTitle || 'Rookie'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-cream-300">{entry.corpsName || 'No Corps'}</p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className="text-cream-100 font-bold">{entry.score?.toFixed(2) || '0.00'}</p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Trophy className="w-4 h-4 text-gold-500" />
                            <span className="text-cream-100">{entry.trophies || 0}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-3 p-3">
                {currentData.map((entry) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`rounded-lg p-3 border transition-all ${
                      getRankBgColor(entry.rank)
                    } ${loggedInProfile?.username === entry.username ? 'ring-2 ring-gold-500' : ''}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-shrink-0">
                          {getRankIcon(entry.rank)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-cream-100 font-semibold text-sm truncate">{entry.username}</p>
                          <p className="text-cream-500/60 text-xs">{entry.userTitle || 'Rookie'}</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-cream-100 font-bold">{entry.score?.toFixed(2) || '0.00'}</p>
                        <p className="text-cream-500/60 text-xs">Score</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-cream-400 min-w-0">
                        <Users className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{entry.corpsName || 'No Corps'}</span>
                      </div>
                      <div className="flex items-center gap-1 text-cream-300 flex-shrink-0">
                        <Trophy className="w-3.5 h-3.5 text-gold-500" />
                        <span className="font-semibold">{entry.trophies || 0}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center p-6 md:p-12">
              <Trophy className="w-12 h-12 md:w-16 md:h-16 text-cream-500/30 mx-auto mb-4" />
              <p className="text-cream-300 text-base md:text-lg font-semibold">No scores recorded yet</p>
              <p className="text-cream-500/60 text-sm mt-2 max-w-sm mx-auto">
                {rankingsTab === 'weekly'
                  ? 'Weekly rankings will appear after shows are scored this week'
                  : rankingsTab === 'monthly'
                  ? 'Monthly rankings will appear after shows are scored this month'
                  : 'Rankings will appear after the first shows are scored this season'}
              </p>
            </div>
          )}
        </motion.div>

        {/* Load More Button */}
        {!loading && currentData.length >= 100 && (
          <div className="flex justify-center">
            <button className="flex items-center gap-2 px-5 py-2.5 bg-charcoal-800/50 text-cream-300 rounded-lg hover:bg-charcoal-800 transition-colors text-sm">
              <ChevronDown className="w-4 h-4" />
              Load More
            </button>
          </div>
        )}
      </div>
    );
  };

  // Render Stats tab (Lifetime Stats)
  const renderStats = () => {
    const lifetimeData = leaderboardData.lifetime;

    return (
      <div className="space-y-6">
        {/* Lifetime View Selector */}
        <div className="-mx-4 px-4 overflow-x-auto md:mx-0 md:px-0 scrollbar-hide">
          <div className="flex gap-2 justify-center md:flex-wrap min-w-max md:min-w-0">
            {lifetimeViews.map((view) => (
              <button
                key={view.id}
                onClick={() => setLifetimeView(view.id)}
                className={`px-3 md:px-4 py-2 rounded-lg transition-all whitespace-nowrap ${
                  lifetimeView === view.id
                    ? 'bg-gold-500 text-charcoal-900 font-medium'
                    : 'bg-charcoal-800/50 text-cream-300 hover:bg-charcoal-800'
                }`}
              >
                <div className="text-xs md:text-sm font-semibold">{view.label}</div>
                <div className="text-xs opacity-75 hidden md:block">{view.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Lifetime Stats Table/Cards */}
        <motion.div
          key={lifetimeView}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-charcoal-800/30 rounded-lg overflow-hidden"
        >
          {loading ? (
            <LoadingScreen fullScreen={false} />
          ) : lifetimeData.length > 0 ? (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-charcoal-900/50 border-b border-cream-500/10">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-medium text-cream-400">Rank</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-cream-400">Player</th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-cream-400">Total Points</th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-cream-400">Seasons</th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-cream-400">Shows</th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-cream-400">Best Season</th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-cream-400">Championships</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cream-500/10">
                    {lifetimeData.map((entry) => (
                      <tr
                        key={entry.id}
                        className={`hover:bg-charcoal-800/50 transition-colors ${
                          loggedInProfile?.username === entry.username ? 'bg-gold-500/5' : ''
                        }`}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            {getRankIcon(entry.rank)}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-charcoal-800 flex items-center justify-center">
                              <Users className="w-5 h-5 text-cream-400" />
                            </div>
                            <div>
                              <p className="text-cream-100 font-medium">{entry.username}</p>
                              <p className="text-cream-500/60 text-sm">{entry.userTitle || 'Rookie'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className="text-cream-100 font-bold">{entry.lifetimeStats?.totalPoints?.toLocaleString() || '0'}</p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className="text-cream-100 font-bold">{entry.lifetimeStats?.totalSeasons || 0}</p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className="text-cream-100 font-bold">{entry.lifetimeStats?.totalShows || 0}</p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className="text-cream-100 font-bold">{entry.lifetimeStats?.bestSeasonScore?.toFixed(2) || '0.00'}</p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Trophy className="w-4 h-4 text-gold-500" />
                            <span className="text-cream-100 font-bold">{entry.lifetimeStats?.leagueChampionships || 0}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-3 p-3">
                {lifetimeData.map((entry) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`rounded-lg p-3 border transition-all ${
                      getRankBgColor(entry.rank)
                    } ${loggedInProfile?.username === entry.username ? 'ring-2 ring-gold-500' : ''}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-shrink-0">
                          {getRankIcon(entry.rank)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-cream-100 font-semibold text-sm truncate">{entry.username}</p>
                          <p className="text-cream-500/60 text-xs">{entry.userTitle || 'Rookie'}</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-cream-100 font-bold">
                          {lifetimeView === 'bestSeasonScore'
                            ? (entry.lifetimeStats?.bestSeasonScore?.toFixed(2) || '0.00')
                            : (entry.lifetimeStats?.[lifetimeView]?.toLocaleString() || '0')}
                        </p>
                        <p className="text-cream-500/60 text-xs">{lifetimeViews.find(v => v.id === lifetimeView)?.label}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex flex-col text-cream-400">
                        <span className="text-cream-500/60">Total Points</span>
                        <span className="font-semibold text-cream-300">{entry.lifetimeStats?.totalPoints?.toLocaleString() || '0'}</span>
                      </div>
                      <div className="flex flex-col text-cream-400">
                        <span className="text-cream-500/60">Seasons</span>
                        <span className="font-semibold text-cream-300">{entry.lifetimeStats?.totalSeasons || 0}</span>
                      </div>
                      <div className="flex flex-col text-cream-400">
                        <span className="text-cream-500/60">Shows</span>
                        <span className="font-semibold text-cream-300">{entry.lifetimeStats?.totalShows || 0}</span>
                      </div>
                      <div className="flex flex-col text-cream-400">
                        <span className="text-cream-500/60">Championships</span>
                        <div className="flex items-center gap-1">
                          <Trophy className="w-3 h-3 text-gold-500" />
                          <span className="font-semibold text-cream-300">{entry.lifetimeStats?.leagueChampionships || 0}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center p-6 md:p-12">
              <Award className="w-12 h-12 md:w-16 md:h-16 text-cream-500/30 mx-auto mb-4" />
              <p className="text-cream-300 text-base md:text-lg font-semibold">No lifetime stats yet</p>
              <p className="text-cream-500/60 text-sm mt-2 max-w-sm mx-auto">
                Complete seasons to appear on the lifetime leaderboard
              </p>
            </div>
          )}
        </motion.div>
      </div>
    );
  };

  // Render SoundSport tab
  const renderSoundSport = () => {
    const soundSportShows = recentShows.filter(show =>
      show.scores?.some(s => s.corpsClass === 'soundSport')
    );

    return (
      <div className="space-y-6">
        {/* SoundSport Info */}
        <div className="card p-4 md:p-6 border border-green-500/20">
          <div className="flex flex-col md:flex-row md:items-start gap-3 md:gap-4">
            <div className="flex items-center gap-3 md:block">
              <Music className="w-6 h-6 md:w-8 md:h-8 text-green-500 flex-shrink-0" />
              <h3 className="text-base md:text-lg font-semibold text-cream-100 md:hidden">
                About SoundSport
              </h3>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-cream-100 mb-2 hidden md:block">
                About SoundSport Scoring
              </h3>
              <p className="text-cream-300 text-sm md:text-base mb-4">
                SoundSport ensembles receive ratings (Gold, Silver, Bronze) based on Overall Impression scoring.
                Scores are not publicly announced or ranked.
              </p>
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2 md:p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-center md:text-left">
                  <div className="flex flex-col md:flex-row items-center gap-1 md:gap-2 mb-1">
                    <Medal className="w-4 h-4 md:w-5 md:h-5 text-yellow-500" />
                    <span className="font-semibold text-yellow-500 text-xs md:text-sm">Gold</span>
                  </div>
                  <p className="text-xs text-cream-400">90+</p>
                </div>
                <div className="p-2 md:p-3 bg-gray-500/10 border border-gray-400/30 rounded-lg text-center md:text-left">
                  <div className="flex flex-col md:flex-row items-center gap-1 md:gap-2 mb-1">
                    <Medal className="w-4 h-4 md:w-5 md:h-5 text-gray-400" />
                    <span className="font-semibold text-gray-400 text-xs md:text-sm">Silver</span>
                  </div>
                  <p className="text-xs text-cream-400">75-89</p>
                </div>
                <div className="p-2 md:p-3 bg-orange-500/10 border border-orange-600/30 rounded-lg text-center md:text-left">
                  <div className="flex flex-col md:flex-row items-center gap-1 md:gap-2 mb-1">
                    <Medal className="w-4 h-4 md:w-5 md:h-5 text-orange-600" />
                    <span className="font-semibold text-orange-600 text-xs md:text-sm">Bronze</span>
                  </div>
                  <p className="text-xs text-cream-400">60-74</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SoundSport Results */}
        {loading ? (
          <LoadingScreen fullScreen={false} />
        ) : soundSportShows.length > 0 ? (
          <div className="space-y-4">
            {soundSportShows.map((show, showIdx) => (
              <div key={showIdx} className="card p-4 md:p-6">
                <div className="mb-3 md:mb-4">
                  <h3 className="text-lg md:text-xl font-semibold text-cream-100">{show.eventName}</h3>
                  <p className="text-xs md:text-sm text-cream-500/60">{show.location} • {show.date}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
                  {show.scores
                    .filter(s => s.corpsClass === 'soundSport')
                    .map((score, idx) => {
                      const ratingInfo = getSoundSportRating(score.score);
                      return (
                        <div
                          key={idx}
                          className={`p-3 md:p-4 rounded-lg border ${ratingInfo.bgColor} ${ratingInfo.borderColor}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 md:gap-3 min-w-0">
                              <Medal className={`w-5 h-5 md:w-6 md:h-6 flex-shrink-0 ${ratingInfo.color}`} />
                              <div className="min-w-0">
                                <p className="font-semibold text-cream-100 text-sm md:text-base truncate">{score.corps}</p>
                                <p className={`text-xs md:text-sm font-semibold ${ratingInfo.color}`}>
                                  {ratingInfo.rating}
                                </p>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-xs text-cream-500/60 hidden md:block">Overall Impression</p>
                              <p className="text-base md:text-lg font-bold text-cream-100">{score.score.toFixed(3)}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card p-6 md:p-12 text-center">
            <Star className="w-12 h-12 md:w-16 md:h-16 text-cream-500/30 mx-auto mb-4" />
            <p className="text-base md:text-xl text-cream-300 mb-2">No Recent SoundSport Events</p>
            <p className="text-sm text-cream-500/60 max-w-sm mx-auto">SoundSport event results will appear here when available</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-4xl font-display font-bold text-gradient mb-4">
          Scores & Rankings
        </h1>
        <p className="text-cream-300">
          Live results, player rankings, and performance statistics
        </p>
      </motion.div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card p-4 hover:bg-charcoal-800/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 md:p-3 bg-gold-500/10 rounded-lg">
              <Trophy className="w-5 h-5 md:w-6 md:h-6 text-gold-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xl md:text-2xl font-bold text-cream-100">{stats.showsToday}</p>
              <p className="text-xs text-cream-500/60">Shows Today</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card p-4 hover:bg-charcoal-800/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 md:p-3 bg-blue-500/10 rounded-lg">
              <Calendar className="w-5 h-5 md:w-6 md:h-6 text-blue-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xl md:text-2xl font-bold text-cream-100">{stats.recentShows}</p>
              <p className="text-xs text-cream-500/60">Recent Shows</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card p-4 hover:bg-charcoal-800/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 md:p-3 bg-purple-500/10 rounded-lg">
              <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-purple-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xl md:text-2xl font-bold text-cream-100 truncate">{stats.topScore}</p>
              <p className="text-xs text-cream-500/60">Top Score</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="card p-4 hover:bg-charcoal-800/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 md:p-3 bg-green-500/10 rounded-lg">
              <Award className="w-5 h-5 md:w-6 md:h-6 text-green-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xl md:text-2xl font-bold text-cream-100">{stats.corpsActive}</p>
              <p className="text-xs text-cream-500/60">Corps Active</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Main Tabs */}
      <div className="border-b border-cream-500/20">
        <div className="flex gap-1 overflow-x-auto pb-px -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide">
          {mainTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-5 py-2.5 md:py-3 font-medium transition-all whitespace-nowrap text-sm md:text-base ${
                  activeTab === tab.id
                    ? 'text-gold-500 border-b-2 border-gold-500'
                    : 'text-cream-500/60 hover:text-cream-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'latest' && renderLatestScores()}
          {activeTab === 'rankings' && renderRankings()}
          {activeTab === 'stats' && renderStats()}
          {activeTab === 'soundsport' && renderSoundSport()}
        </motion.div>
      </AnimatePresence>

      {/* Show Detail Modal */}
      {selectedShow && (
        <ShowDetailModal show={selectedShow} onClose={() => setSelectedShow(null)} />
      )}
    </div>
  );
};

// Show Card Component
const ShowCard = ({ show, isLive = false, onClick }) => {
  return (
    <motion.div
      whileHover={{ scale: 1.005 }}
      className="card p-4 md:p-6 cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3 mb-3 md:mb-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base md:text-xl font-semibold text-cream-100 truncate">{show.eventName}</h3>
            {isLive && (
              <span className="px-2 py-0.5 bg-red-500/20 text-red-500 text-xs font-semibold rounded-full animate-pulse flex-shrink-0">
                LIVE
              </span>
            )}
          </div>
          <p className="text-xs md:text-sm text-cream-500/60 truncate">{show.location}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs md:text-sm text-cream-500/60">{show.date}</p>
          <p className="text-xs text-cream-500/40">{show.scores?.length || 0} corps</p>
        </div>
      </div>

      {show.scores && show.scores.length > 0 && (
        <div className="space-y-1.5 md:space-y-2">
          {show.scores.slice(0, 3).map((score, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2.5 md:p-3 bg-charcoal-900/30 rounded-lg"
            >
              <div className="flex items-center gap-2 md:gap-3 min-w-0">
                <span className={`text-xs md:text-sm font-bold flex-shrink-0 ${
                  idx === 0 ? 'text-yellow-500' :
                  idx === 1 ? 'text-gray-400' :
                  'text-orange-600'
                }`}>
                  #{idx + 1}
                </span>
                <span className="text-cream-100 font-medium text-sm md:text-base truncate">{score.corps}</span>
              </div>
              <span className="text-gold-500 font-bold text-base md:text-lg flex-shrink-0">{score.score.toFixed(3)}</span>
            </div>
          ))}
          {show.scores.length > 3 && (
            <button className="w-full py-2 text-xs md:text-sm text-cream-500/60 hover:text-cream-300 flex items-center justify-center gap-1">
              View all {show.scores.length} corps
              <ChevronRight className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
};

// Show Detail Modal Component
const ShowDetailModal = ({ show, onClose }) => {
  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-black/80" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="card max-w-4xl w-full max-h-[85vh] md:max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-4 md:p-6 border-b border-cream-500/20 sticky top-0 bg-charcoal-900/95 backdrop-blur-sm z-10">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-lg md:text-2xl font-bold text-cream-100 mb-1 md:mb-2 truncate">{show.eventName}</h2>
                <p className="text-xs md:text-sm text-cream-500/60">{show.location} • {show.date}</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-cream-500/60 hover:text-cream-300 hover:bg-charcoal-800 transition-colors flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-4 md:p-6">
            <h3 className="text-base md:text-lg font-semibold text-cream-100 mb-3 md:mb-4">Full Results</h3>
            <div className="space-y-2 md:space-y-3">
              {show.scores?.map((score, idx) => (
                <ScoreRow key={idx} score={score} rank={idx + 1} />
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </Portal>
  );
};

// Score Row Component with Caption Breakdown
const ScoreRow = ({ score, rank }) => {
  const [expanded, setExpanded] = useState(false);

  // Check if we have detailed captions (historical data) or aggregate scores (fantasy data)
  const hasDetailedCaptions = score.captions && Object.keys(score.captions).length > 0;

  // Get scores - either from detailed captions or from aggregate scores
  const geScore = hasDetailedCaptions
    ? (score.captions.GE1 || 0) + (score.captions.GE2 || 0)
    : (score.geScore || 0);

  const visualScore = hasDetailedCaptions
    ? ((score.captions.VP || 0) + (score.captions.VA || 0) + (score.captions.CG || 0)) / 2
    : (score.visualScore || 0);

  const musicScore = hasDetailedCaptions
    ? ((score.captions.B || 0) + (score.captions.MA || 0) + (score.captions.P || 0)) / 2
    : (score.musicScore || 0);

  // Check if we have any caption data to show
  const hasCaptions = geScore > 0 || visualScore > 0 || musicScore > 0;

  return (
    <div className="bg-charcoal-900/30 rounded-lg overflow-hidden">
      <div
        className={`p-3 md:p-4 transition-colors ${
          hasDetailedCaptions ? 'cursor-pointer hover:bg-charcoal-900/50' : ''
        }`}
        onClick={() => hasDetailedCaptions && setExpanded(!expanded)}
      >
        {/* Main row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 md:gap-4 min-w-0">
            <span className={`text-sm md:text-lg font-bold w-6 md:w-8 flex-shrink-0 ${
              rank === 1 ? 'text-yellow-500' :
              rank === 2 ? 'text-gray-400' :
              rank === 3 ? 'text-orange-600' :
              'text-cream-500/60'
            }`}>
              #{rank}
            </span>
            <div className="min-w-0">
              <span className="text-cream-100 font-medium text-sm md:text-base truncate block">{score.corps}</span>
              {score.corpsClass && (
                <span className="text-xs text-cream-500/60">
                  {score.corpsClass}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 md:gap-6 flex-shrink-0">
            {/* Desktop caption display */}
            <div className="hidden md:flex items-center gap-4 text-sm">
              <div className="text-center">
                <div className="text-cream-500/60 text-xs">GE</div>
                <div className="text-cream-100 font-semibold">{geScore.toFixed(3)}</div>
              </div>
              <div className="text-center">
                <div className="text-cream-500/60 text-xs flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  Visual
                </div>
                <div className="text-cream-100 font-semibold">{visualScore.toFixed(3)}</div>
              </div>
              <div className="text-center">
                <div className="text-cream-500/60 text-xs flex items-center gap-1">
                  <Music className="w-3 h-3" />
                  Music
                </div>
                <div className="text-cream-100 font-semibold">{musicScore.toFixed(3)}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xl md:text-2xl font-bold text-gold-500">{score.score.toFixed(3)}</div>
            </div>
          </div>
        </div>

        {/* Mobile caption summary */}
        {hasCaptions && (
          <div className="md:hidden flex items-center justify-end gap-3 mt-2 text-xs text-cream-500/60">
            <span>GE: {geScore.toFixed(1)}</span>
            <span>V: {visualScore.toFixed(1)}</span>
            <span>M: {musicScore.toFixed(1)}</span>
            {hasDetailedCaptions && (
              <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            )}
          </div>
        )}
      </div>

      {/* Only show caption breakdown if we have detailed caption data */}
      {expanded && hasDetailedCaptions && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="px-3 pb-3 md:px-4 md:pb-4"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 p-3 md:p-4 bg-charcoal-900/50 rounded-lg">
            {Object.entries(CAPTION_CATEGORIES).map(([key, caption]) => {
              const value = score.captions[key] || 0;
              const maxValue = caption.weight;
              const percentage = (value / maxValue) * 100;

              return (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-cream-500/60">{caption.shortName}</span>
                    <span className="text-cream-100 font-semibold">{value.toFixed(3)}</span>
                  </div>
                  <div className="h-1.5 md:h-2 bg-charcoal-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-gold-500 to-gold-400"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <div className="text-xs text-cream-500/40">of {maxValue}</div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default Scores;
