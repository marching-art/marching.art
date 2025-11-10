// src/pages/Leaderboard.jsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Trophy, Medal, Award, TrendingUp, TrendingDown, 
  Minus, Filter, ChevronDown, Star, Crown, Shield
} from 'lucide-react';
import { db, seasonHelpers } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { SkeletonLoader } from '../components/LoadingScreen';

const Leaderboard = () => {
  const [activeClass, setActiveClass] = useState('world');
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [season] = useState(seasonHelpers.getCurrentSeason());
  const [timeFilter, setTimeFilter] = useState('current');
  const [expandedRows, setExpandedRows] = useState(new Set());

  useEffect(() => {
    subscribeToRankings();
  }, [activeClass, timeFilter]);

  const subscribeToRankings = () => {
    setLoading(true);
    
    try {
      const seasonId = `${season.year}-${season.type}`;
      let rankingsQuery;

      if (timeFilter === 'current') {
        // Get current rankings from leaderboards collection
        rankingsQuery = query(
          collection(db, 'leaderboards', seasonId, 'rankings'),
          where('class', '==', activeClass),
          orderBy('totalScore', 'desc'),
          limit(100)
        );
      } else {
        // Get historical rankings
        rankingsQuery = query(
          collection(db, 'final_rankings', seasonId),
          where('class', '==', activeClass),
          orderBy('finalScore', 'desc'),
          limit(50)
        );
      }

      const unsubscribe = onSnapshot(rankingsQuery, (snapshot) => {
        const data = snapshot.docs.map((doc, index) => ({
          id: doc.id,
          rank: index + 1,
          ...doc.data(),
          previousRank: doc.data().previousRank || index + 1,
        }));
        setRankings(data);
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error('Error fetching rankings:', error);
      setLoading(false);
    }
  };

  const getRankChange = (current, previous) => {
    const change = previous - current;
    if (change > 0) {
      return { icon: TrendingUp, color: 'text-green-400', value: `+${change}` };
    } else if (change < 0) {
      return { icon: TrendingDown, color: 'text-red-400', value: change };
    } else {
      return { icon: Minus, color: 'text-cream-500/40', value: '—' };
    }
  };

  const getRankIcon = (rank) => {
    switch (rank) {
      case 1:
        return <Crown className="w-6 h-6 text-gold-500" />;
      case 2:
        return <Medal className="w-6 h-6 text-cream-400" />;
      case 3:
        return <Award className="w-6 h-6 text-orange-400" />;
      default:
        return <span className="text-lg font-bold text-cream-300">{rank}</span>;
    }
  };

  const classes = [
    { id: 'world', name: 'World Class', color: 'gold' },
    { id: 'open', name: 'Open Class', color: 'cream' },
    { id: 'aClass', name: 'A Class', color: 'blue' },
    { id: 'soundSport', name: 'SoundSport', color: 'green' }
  ];

  const toggleRowExpansion = (id) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative"
      >
        <div className="glass rounded-2xl p-8 bg-gradient-to-br from-gold-500/5 to-cream-500/5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-4xl font-display font-bold text-gradient flex items-center gap-3">
                <Trophy className="w-10 h-10" />
                Leaderboard
              </h1>
              <p className="text-cream-300 mt-2">
                {seasonHelpers.formatSeasonName(season)} Rankings
              </p>
            </div>
            
            {/* Time Filter */}
            <div className="flex items-center gap-3">
              <select
                className="select"
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value)}
              >
                <option value="current">Current Season</option>
                <option value="week">This Week</option>
                <option value="allTime">All Time</option>
              </select>
              <button className="btn-ghost">
                <Filter className="w-4 h-4 mr-2" />
                Filters
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Class Tabs */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex flex-wrap gap-2"
      >
        {classes.map((cls) => (
          <button
            key={cls.id}
            onClick={() => setActiveClass(cls.id)}
            className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
              activeClass === cls.id
                ? `bg-${cls.color}-500/20 text-${cls.color}-400 border-2 border-${cls.color}-500/50`
                : 'glass text-cream-300 hover:bg-cream-500/10'
            }`}
          >
            {cls.name}
          </button>
        ))}
      </motion.div>

      {/* Rankings Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {loading ? (
          <div className="space-y-4">
            <SkeletonLoader type="table-row" count={10} />
          </div>
        ) : rankings.length === 0 ? (
          <div className="card p-12 text-center">
            <Trophy className="w-16 h-16 text-cream-500/40 mx-auto mb-4" />
            <p className="text-xl text-cream-300">No rankings available yet</p>
            <p className="text-cream-500/60 mt-2">Check back once the season begins!</p>
          </div>
        ) : (
          <div className="glass rounded-xl overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 p-4 bg-charcoal-900/50 border-b border-cream-500/10">
              <div className="col-span-1 text-center">
                <span className="text-xs font-semibold text-cream-500/60 uppercase">Rank</span>
              </div>
              <div className="col-span-1 text-center">
                <span className="text-xs font-semibold text-cream-500/60 uppercase">Change</span>
              </div>
              <div className="col-span-6">
                <span className="text-xs font-semibold text-cream-500/60 uppercase">Corps</span>
              </div>
              <div className="col-span-2 text-center">
                <span className="text-xs font-semibold text-cream-500/60 uppercase">Score</span>
              </div>
              <div className="col-span-2 text-center">
                <span className="text-xs font-semibold text-cream-500/60 uppercase">Director</span>
              </div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-cream-500/10">
              {rankings.map((corps, index) => {
                const rankChange = getRankChange(corps.rank, corps.previousRank);
                const RankChangeIcon = rankChange.icon;
                const isExpanded = expandedRows.has(corps.id);

                return (
                  <motion.div
                    key={corps.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className={`${
                      corps.rank <= 3 ? 'bg-gradient-to-r from-gold-500/5 to-transparent' : ''
                    }`}
                  >
                    {/* Main Row */}
                    <div 
                      className="grid grid-cols-12 gap-4 p-4 hover:bg-cream-500/5 transition-colors cursor-pointer"
                      onClick={() => toggleRowExpansion(corps.id)}
                    >
                      {/* Rank */}
                      <div className="col-span-1 flex items-center justify-center">
                        {getRankIcon(corps.rank)}
                      </div>

                      {/* Rank Change */}
                      <div className="col-span-1 flex items-center justify-center">
                        <div className={`flex items-center gap-1 ${rankChange.color}`}>
                          <RankChangeIcon className="w-4 h-4" />
                          <span className="text-sm font-semibold">{rankChange.value}</span>
                        </div>
                      </div>

                      {/* Corps Info */}
                      <div className="col-span-6">
                        <div className="flex items-center gap-3">
                          {/* Corps Avatar */}
                          <div className="w-10 h-10 bg-gradient-to-br from-gold-500/20 to-cream-500/20 rounded-lg flex items-center justify-center">
                            <Music className="w-5 h-5 text-gold-500" />
                          </div>
                          <div>
                            <p className="font-semibold text-cream-100">
                              {corps.corpsName}
                            </p>
                            <p className="text-sm text-cream-500/60">
                              {corps.location}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Score */}
                      <div className="col-span-2 flex items-center justify-center">
                        <div className="text-center">
                          <p className="text-xl font-bold text-gold-500">
                            {corps.totalScore?.toFixed(2) || '0.00'}
                          </p>
                          {corps.lastScore && (
                            <p className="text-xs text-cream-500/60">
                              Last: {corps.lastScore.toFixed(2)}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Director */}
                      <div className="col-span-2 flex items-center justify-center">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-cream-300">
                            {corps.directorName || 'Unknown'}
                          </span>
                          {corps.directorLevel >= 10 && (
                            <Star className="w-4 h-4 text-gold-500" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="px-4 pb-4 bg-charcoal-900/30"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                          {/* Caption Scores */}
                          <div className="glass rounded-lg p-4">
                            <h4 className="text-sm font-semibold text-cream-100 mb-3">
                              Caption Breakdown
                            </h4>
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-cream-500/60">General Effect</span>
                                <span className="text-cream-300">
                                  {corps.geScore?.toFixed(2) || '0.00'}
                                </span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-cream-500/60">Visual</span>
                                <span className="text-cream-300">
                                  {corps.visualScore?.toFixed(2) || '0.00'}
                                </span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-cream-500/60">Music</span>
                                <span className="text-cream-300">
                                  {corps.musicScore?.toFixed(2) || '0.00'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Recent Performance */}
                          <div className="glass rounded-lg p-4">
                            <h4 className="text-sm font-semibold text-cream-100 mb-3">
                              Recent Shows
                            </h4>
                            <div className="space-y-2">
                              {corps.recentShows?.slice(0, 3).map((show, idx) => (
                                <div key={idx} className="flex justify-between text-sm">
                                  <span className="text-cream-500/60">{show.name}</span>
                                  <span className="text-cream-300">{show.score.toFixed(2)}</span>
                                </div>
                              )) || (
                                <p className="text-sm text-cream-500/60">No recent shows</p>
                              )}
                            </div>
                          </div>

                          {/* Show Concept */}
                          <div className="glass rounded-lg p-4">
                            <h4 className="text-sm font-semibold text-cream-100 mb-3">
                              Show Concept
                            </h4>
                            <p className="text-sm text-cream-300">
                              {corps.showConcept || 'No concept provided'}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* Load More */}
            {rankings.length >= 100 && (
              <div className="p-4 text-center border-t border-cream-500/10">
                <button className="btn-ghost">
                  Load More
                  <ChevronDown className="w-4 h-4 ml-2" />
                </button>
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* Top Performers Cards */}
      {!loading && rankings.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {/* Champion */}
          {rankings[0] && (
            <div className="card-premium text-center p-6">
              <Crown className="w-12 h-12 text-gold-500 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-cream-100 mb-1">
                Current Champion
              </h3>
              <p className="text-2xl font-bold text-gradient mb-2">
                {rankings[0].corpsName}
              </p>
              <p className="text-3xl font-bold text-gold-500">
                {rankings[0].totalScore?.toFixed(2)}
              </p>
            </div>
          )}

          {/* Biggest Mover */}
          <div className="card text-center p-6">
            <TrendingUp className="w-12 h-12 text-green-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-cream-100 mb-1">
              Biggest Mover
            </h3>
            <p className="text-xl font-semibold text-cream-300 mb-2">
              TBD Corps
            </p>
            <p className="text-2xl font-bold text-green-400">
              +5 Ranks
            </p>
          </div>

          {/* Perfect Score */}
          <div className="card text-center p-6">
            <Shield className="w-12 h-12 text-purple-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-cream-100 mb-1">
              Top Caption Score
            </h3>
            <p className="text-xl font-semibold text-cream-300 mb-2">
              Blue Devils
            </p>
            <p className="text-2xl font-bold text-purple-400">
              19.95
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default Leaderboard;
