// src/pages/Scores.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy,
  Calendar,
  TrendingUp,
  BarChart3,
  Search,
  Filter,
  Clock,
  Award,
  Target,
  Medal,
  ChevronRight,
  Star,
  Music,
  Eye,
  Zap
} from 'lucide-react';
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { CAPTION_CATEGORIES } from '../utils/captionPricing';

const Scores = () => {
  const [activeTab, setActiveTab] = useState('live');
  const [loading, setLoading] = useState(true);
  const [liveScores, setLiveScores] = useState([]);
  const [recentShows, setRecentShows] = useState([]);
  const [historicalShows, setHistoricalShows] = useState([]);
  const [selectedShow, setSelectedShow] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClass, setFilterClass] = useState('all');
  const [filterDate, setFilterDate] = useState('');
  const [selectedCorps, setSelectedCorps] = useState([]);
  const [stats, setStats] = useState({ showsToday: 0, recentShows: 0, topScore: '-', corpsActive: 0 });
  const [currentSeason, setCurrentSeason] = useState(null);

  // Get current date for live scores
  const today = new Date().toISOString().split('T')[0];

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

  // Fetch live scores from fantasy_recaps
  useEffect(() => {
    const fetchLiveScores = async () => {
      if (!currentSeason) return;

      try {
        setLoading(true);
        const recapRef = doc(db, 'fantasy_recaps', currentSeason.id);
        const recapDoc = await getDoc(recapRef);

        if (recapDoc.exists()) {
          const data = recapDoc.data();
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
          setStats(prev => ({ ...prev, showsToday: todayShows.length }));
        }
        setLoading(false);
      } catch (error) {
        console.error('Error fetching live scores:', error);
        setLoading(false);
      }
    };

    if (activeTab === 'live' && currentSeason) {
      fetchLiveScores();
    }
  }, [activeTab, currentSeason, today]);

  // Fetch recent shows (past 7 days)
  useEffect(() => {
    const fetchRecentShows = async () => {
      if (!currentSeason) return;

      try {
        setLoading(true);
        const recapRef = doc(db, 'fantasy_recaps', currentSeason.id);
        const recapDoc = await getDoc(recapRef);

        if (recapDoc.exists()) {
          const data = recapDoc.data();
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

          // Calculate top score
          const allScores = shows.flatMap(show => show.scores.map(s => s.score));
          const topScore = allScores.length > 0 ? Math.max(...allScores).toFixed(2) : '-';

          // Count unique corps
          const uniqueCorps = new Set(shows.flatMap(show => show.scores.map(s => s.corps)));

          setStats(prev => ({
            ...prev,
            recentShows: shows.length,
            topScore,
            corpsActive: uniqueCorps.size
          }));
        }
        setLoading(false);
      } catch (error) {
        console.error('Error fetching recent shows:', error);
        setLoading(false);
      }
    };

    // Fetch recent shows for both 'recent' and 'soundsport' tabs
    if ((activeTab === 'recent' || activeTab === 'soundsport') && currentSeason) {
      fetchRecentShows();
    }
  }, [activeTab, currentSeason]);

  const tabs = [
    { id: 'live', name: 'Live', icon: Clock, description: 'Current shows' },
    { id: 'recent', name: 'Recent', icon: Calendar, description: 'Past 7 days' },
    { id: 'historical', name: 'Historical', icon: Trophy, description: 'All shows' },
    { id: 'comparison', name: 'Compare', icon: BarChart3, description: 'Side-by-side' },
    { id: 'soundsport', name: 'SoundSport', icon: Music, description: 'Ratings' }
  ];

  const renderLiveScores = () => {
    if (loading) {
      return (
        <div className="card p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-500 mx-auto mb-4"></div>
          <p className="text-cream-300">Loading live scores...</p>
        </div>
      );
    }

    if (liveScores.length === 0) {
      return (
        <div className="card p-12 text-center">
          <Clock className="w-16 h-16 text-cream-500/40 mx-auto mb-4" />
          <p className="text-xl text-cream-300 mb-2">No live shows today</p>
          <p className="text-cream-500/60">Check back during competition times or view recent shows</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {liveScores.map((show, idx) => (
          <ShowCard key={idx} show={show} isLive={true} />
        ))}
      </div>
    );
  };

  const renderRecentShows = () => {
    if (loading) {
      return (
        <div className="card p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-500 mx-auto mb-4"></div>
          <p className="text-cream-300">Loading recent shows...</p>
        </div>
      );
    }

    if (recentShows.length === 0) {
      return (
        <div className="card p-12 text-center">
          <Calendar className="w-16 h-16 text-cream-500/40 mx-auto mb-4" />
          <p className="text-xl text-cream-300 mb-2">No recent shows</p>
          <p className="text-cream-500/60">Shows from the past 7 days will appear here</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {recentShows.map((show, idx) => (
          <ShowCard key={idx} show={show} onClick={() => setSelectedShow(show)} />
        ))}
      </div>
    );
  };

  // Fetch historical scores with search and filters
  useEffect(() => {
    const fetchHistoricalScores = async () => {
      if (activeTab !== 'historical') return;

      try {
        setLoading(true);
        const years = ['2024', '2023', '2022', '2021', '2020'];
        let allShows = [];

        for (const year of years) {
          const historicalRef = doc(db, 'historical_scores', year);
          const historicalDoc = await getDoc(historicalRef);

          if (historicalDoc.exists()) {
            const data = historicalDoc.data();
            const yearShows = data.data?.map(show => ({
              eventName: show.eventName,
              location: show.location,
              date: show.date,
              year: year,
              offSeasonDay: show.offSeasonDay,
              scores: show.scores?.map(score => ({
                corps: score.corps,
                score: score.score || 0,
                captions: score.captions || {}
              })).sort((a, b) => b.score - a.score) || []
            })) || [];
            allShows = [...allShows, ...yearShows];
          }
        }

        // Apply filters
        let filteredShows = allShows;

        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          filteredShows = filteredShows.filter(show =>
            show.eventName?.toLowerCase().includes(query) ||
            show.location?.toLowerCase().includes(query) ||
            show.scores?.some(s => s.corps?.toLowerCase().includes(query))
          );
        }

        if (filterDate) {
          filteredShows = filteredShows.filter(show =>
            show.date && show.date.includes(filterDate)
          );
        }

        setHistoricalShows(filteredShows.slice(0, 50)); // Limit to 50 results
        setLoading(false);
      } catch (error) {
        console.error('Error fetching historical scores:', error);
        setLoading(false);
      }
    };

    fetchHistoricalScores();
  }, [activeTab, searchQuery, filterClass, filterDate]);

  const renderHistoricalScores = () => {
    return (
      <div className="space-y-6">
        {/* Search and Filter Bar */}
        <div className="card p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-cream-300 mb-2">
                Search Shows or Corps
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-cream-500/40" />
                <input
                  type="text"
                  placeholder="e.g., 'DCI Finals 2023' or 'Blue Devils'"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-charcoal-900/50 border border-cream-500/20 rounded-lg text-cream-100 placeholder-cream-500/40 focus:border-gold-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Class Filter */}
            <div>
              <label className="block text-sm font-medium text-cream-300 mb-2">
                Class
              </label>
              <select
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
                className="w-full px-4 py-2 bg-charcoal-900/50 border border-cream-500/20 rounded-lg text-cream-100 focus:border-gold-500 focus:outline-none"
              >
                <option value="all">All Classes</option>
                <option value="world">World Class</option>
                <option value="open">Open Class</option>
                <option value="aClass">A Class</option>
                <option value="soundSport">SoundSport</option>
              </select>
            </div>

            {/* Date Filter */}
            <div>
              <label className="block text-sm font-medium text-cream-300 mb-2">
                Date
              </label>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full px-4 py-2 bg-charcoal-900/50 border border-cream-500/20 rounded-lg text-cream-100 focus:border-gold-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="card p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-500 mx-auto mb-4"></div>
            <p className="text-cream-300">Searching historical scores...</p>
          </div>
        ) : historicalShows.length > 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-cream-500/60">
              Found {historicalShows.length} show{historicalShows.length !== 1 ? 's' : ''}
            </p>
            {historicalShows.map((show, idx) => (
              <ShowCard key={idx} show={show} onClick={() => setSelectedShow(show)} />
            ))}
          </div>
        ) : (
          <div className="card p-8 text-center">
            <Trophy className="w-16 h-16 text-cream-500/40 mx-auto mb-4" />
            <p className="text-xl text-cream-300 mb-2">
              {searchQuery || filterDate ? 'No shows found' : 'Search Historical Scores'}
            </p>
            <p className="text-cream-500/60">
              {searchQuery || filterDate
                ? 'Try adjusting your search criteria'
                : 'Use the filters above to find specific shows and results'}
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderComparison = () => {
    return (
      <div className="space-y-6">
        {/* Corps Selection */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-cream-100 mb-4">
            Select Corps to Compare
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-cream-300 mb-2">
                Corps 1
              </label>
              <select className="w-full px-4 py-2 bg-charcoal-900/50 border border-cream-500/20 rounded-lg text-cream-100 focus:border-gold-500 focus:outline-none">
                <option value="">Select a corps...</option>
                <option value="bd">Blue Devils</option>
                <option value="bluecoats">Bluecoats</option>
                <option value="carolina-crown">Carolina Crown</option>
                <option value="cavaliers">The Cavaliers</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-cream-300 mb-2">
                Corps 2
              </label>
              <select className="w-full px-4 py-2 bg-charcoal-900/50 border border-cream-500/20 rounded-lg text-cream-100 focus:border-gold-500 focus:outline-none">
                <option value="">Select a corps...</option>
                <option value="bd">Blue Devils</option>
                <option value="bluecoats">Bluecoats</option>
                <option value="carolina-crown">Carolina Crown</option>
                <option value="cavaliers">The Cavaliers</option>
              </select>
            </div>
          </div>
        </div>

        {/* Comparison View */}
        <div className="card p-8 text-center">
          <BarChart3 className="w-16 h-16 text-cream-500/40 mx-auto mb-4" />
          <p className="text-xl text-cream-300 mb-2">Compare Corps Performance</p>
          <p className="text-cream-500/60">Select two corps above to see side-by-side comparison</p>
        </div>
      </div>
    );
  };

  // Helper function to get SoundSport rating based on score
  const getSoundSportRating = (score) => {
    if (score >= 90) return { rating: 'Gold', color: 'text-yellow-500', bgColor: 'bg-yellow-500/10', borderColor: 'border-yellow-500/30' };
    if (score >= 75) return { rating: 'Silver', color: 'text-gray-400', bgColor: 'bg-gray-500/10', borderColor: 'border-gray-400/30' };
    if (score >= 60) return { rating: 'Bronze', color: 'text-orange-600', bgColor: 'bg-orange-500/10', borderColor: 'border-orange-600/30' };
    return { rating: 'Participation', color: 'text-cream-500', bgColor: 'bg-cream-500/10', borderColor: 'border-cream-500/30' };
  };

  const renderSoundSport = () => {
    // Filter for SoundSport events from recent shows
    const soundSportShows = recentShows.filter(show =>
      show.scores?.some(s => s.corpsClass === 'soundSport')
    );

    return (
      <div className="space-y-6">
        {/* SoundSport Info */}
        <div className="card p-6 border-2 border-green-500/20">
          <div className="flex items-start gap-4">
            <Music className="w-8 h-8 text-green-500 mt-1" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-cream-100 mb-2">
                About SoundSport Scoring
              </h3>
              <p className="text-cream-300 mb-4">
                SoundSport ensembles receive ratings (Gold, Silver, Bronze) based on Overall Impression scoring.
                Scores are not publicly announced or ranked - the focus is on creative, entertaining performances.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Medal className="w-5 h-5 text-yellow-500" />
                    <span className="font-semibold text-yellow-500">Gold</span>
                  </div>
                  <p className="text-xs text-cream-400">90-100 points</p>
                </div>
                <div className="p-3 bg-gray-500/10 border border-gray-400/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Medal className="w-5 h-5 text-gray-400" />
                    <span className="font-semibold text-gray-400">Silver</span>
                  </div>
                  <p className="text-xs text-cream-400">75-89 points</p>
                </div>
                <div className="p-3 bg-orange-500/10 border border-orange-600/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Medal className="w-5 h-5 text-orange-600" />
                    <span className="font-semibold text-orange-600">Bronze</span>
                  </div>
                  <p className="text-xs text-cream-400">60-74 points</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SoundSport Results */}
        {soundSportShows.length > 0 ? (
          <div className="space-y-4">
            {soundSportShows.map((show, showIdx) => (
              <div key={showIdx} className="card p-6">
                <div className="mb-4">
                  <h3 className="text-xl font-semibold text-cream-100">{show.eventName}</h3>
                  <p className="text-sm text-cream-500/60">{show.location} • {show.date}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {show.scores
                    .filter(s => s.corpsClass === 'soundSport')
                    .map((score, idx) => {
                      const ratingInfo = getSoundSportRating(score.score);
                      return (
                        <div
                          key={idx}
                          className={`p-4 rounded-lg border ${ratingInfo.bgColor} ${ratingInfo.borderColor}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Medal className={`w-6 h-6 ${ratingInfo.color}`} />
                              <div>
                                <p className="font-semibold text-cream-100">{score.corps}</p>
                                <p className={`text-sm font-semibold ${ratingInfo.color}`}>
                                  {ratingInfo.rating}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-cream-500/60">Overall Impression</p>
                              <p className="text-lg font-bold text-cream-100">{score.score.toFixed(2)}</p>
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
          <div className="card p-8 text-center">
            <Star className="w-16 h-16 text-cream-500/40 mx-auto mb-4" />
            <p className="text-xl text-cream-300 mb-2">No Recent SoundSport Events</p>
            <p className="text-cream-500/60">SoundSport event results will appear here when available</p>
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
          Scores Central
        </h1>
        <p className="text-cream-300">
          Live results, historical data, and performance analytics
        </p>
      </motion.div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card p-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gold-500/10 rounded-lg">
              <Trophy className="w-6 h-6 text-gold-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-cream-100">{stats.showsToday}</p>
              <p className="text-xs text-cream-500/60">Shows Today</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card p-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500/10 rounded-lg">
              <Target className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-cream-100">{stats.recentShows}</p>
              <p className="text-xs text-cream-500/60">Recent Shows</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card p-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-500/10 rounded-lg">
              <TrendingUp className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-cream-100">{stats.topScore}</p>
              <p className="text-xs text-cream-500/60">Top Score</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="card p-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-500/10 rounded-lg">
              <Award className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-cream-100">{stats.corpsActive}</p>
              <p className="text-xs text-cream-500/60">Corps Active</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Tabs */}
      <div className="border-b border-cream-500/20">
        <div className="flex gap-1 overflow-x-auto pb-px">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-gold-500 border-b-2 border-gold-500'
                    : 'text-cream-500/60 hover:text-cream-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.name}
                <span className="hidden md:inline text-xs text-cream-500/40">
                  {tab.description}
                </span>
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
          {activeTab === 'live' && renderLiveScores()}
          {activeTab === 'recent' && renderRecentShows()}
          {activeTab === 'historical' && renderHistoricalScores()}
          {activeTab === 'comparison' && renderComparison()}
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
      whileHover={{ scale: 1.01 }}
      className="card p-6 cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-xl font-semibold text-cream-100">{show.eventName}</h3>
            {isLive && (
              <span className="px-2 py-1 bg-red-500/20 text-red-500 text-xs font-semibold rounded-full animate-pulse">
                LIVE
              </span>
            )}
          </div>
          <p className="text-cream-500/60">{show.location}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-cream-500/60">{show.date}</p>
          <p className="text-xs text-cream-500/40">{show.scores?.length || 0} corps</p>
        </div>
      </div>

      {show.scores && show.scores.length > 0 && (
        <div className="space-y-2">
          {show.scores.slice(0, 3).map((score, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-3 bg-charcoal-900/30 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <span className={`text-sm font-bold ${
                  idx === 0 ? 'text-yellow-500' :
                  idx === 1 ? 'text-gray-400' :
                  'text-orange-600'
                }`}>
                  #{idx + 1}
                </span>
                <span className="text-cream-100 font-medium">{score.corps}</span>
              </div>
              <span className="text-gold-500 font-bold text-lg">{score.score.toFixed(2)}</span>
            </div>
          ))}
          {show.scores.length > 3 && (
            <button className="w-full py-2 text-sm text-cream-500/60 hover:text-cream-300 flex items-center justify-center gap-1">
              View all {show.scores.length} corps
              <ChevronRight className="w-4 h-4" />
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="card max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-cream-500/20">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-cream-100 mb-2">{show.eventName}</h2>
              <p className="text-cream-500/60">{show.location} • {show.date}</p>
            </div>
            <button
              onClick={onClose}
              className="text-cream-500/60 hover:text-cream-300"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-6">
          <h3 className="text-lg font-semibold text-cream-100 mb-4">Full Results</h3>
          <div className="space-y-3">
            {show.scores?.map((score, idx) => (
              <ScoreRow key={idx} score={score} rank={idx + 1} />
            ))}
          </div>
        </div>
      </motion.div>
    </div>
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

  return (
    <div className="bg-charcoal-900/30 rounded-lg overflow-hidden">
      <div
        className={`flex items-center justify-between p-4 transition-colors ${
          hasDetailedCaptions ? 'cursor-pointer hover:bg-charcoal-900/50' : ''
        }`}
        onClick={() => hasDetailedCaptions && setExpanded(!expanded)}
      >
        <div className="flex items-center gap-4">
          <span className={`text-lg font-bold w-8 ${
            rank === 1 ? 'text-yellow-500' :
            rank === 2 ? 'text-gray-400' :
            rank === 3 ? 'text-orange-600' :
            'text-cream-500/60'
          }`}>
            #{rank}
          </span>
          <div>
            <span className="text-cream-100 font-medium">{score.corps}</span>
            {score.corpsClass && (
              <span className="ml-2 text-xs text-cream-500/60">
                ({score.corpsClass})
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-4 text-sm">
            <div className="text-center">
              <div className="text-cream-500/60 text-xs">GE</div>
              <div className="text-cream-100 font-semibold">{geScore.toFixed(2)}</div>
            </div>
            <div className="text-center">
              <div className="text-cream-500/60 text-xs flex items-center gap-1">
                <Eye className="w-3 h-3" />
                Visual
              </div>
              <div className="text-cream-100 font-semibold">{visualScore.toFixed(2)}</div>
            </div>
            <div className="text-center">
              <div className="text-cream-500/60 text-xs flex items-center gap-1">
                <Music className="w-3 h-3" />
                Music
              </div>
              <div className="text-cream-100 font-semibold">{musicScore.toFixed(2)}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gold-500">{score.score.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* Only show caption breakdown if we have detailed caption data */}
      {expanded && hasDetailedCaptions && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="px-4 pb-4"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-charcoal-900/50 rounded-lg">
            {Object.entries(CAPTION_CATEGORIES).map(([key, caption]) => {
              const value = score.captions[key] || 0;
              const maxValue = caption.weight;
              const percentage = (value / maxValue) * 100;

              return (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-cream-500/60">{caption.shortName}</span>
                    <span className="text-cream-100 font-semibold">{value.toFixed(2)}</span>
                  </div>
                  <div className="h-2 bg-charcoal-900 rounded-full overflow-hidden">
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
