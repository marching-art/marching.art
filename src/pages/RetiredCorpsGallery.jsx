import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, Award, Calendar, MapPin, Star, TrendingUp,
  Crown, Archive, RefreshCw, X, Music, Medal
} from 'lucide-react';
import { useAuth } from '../App';
import { db, dataNamespace } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { unretireCorps } from '../firebase/functions';
import toast from 'react-hot-toast';
import LoadingScreen from '../components/LoadingScreen';
import Portal from '../components/Portal';

const RetiredCorpsGallery = () => {
  const { user } = useAuth();
  const [retiredCorps, setRetiredCorps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCorps, setSelectedCorps] = useState(null);
  const [showUnretireModal, setShowUnretireModal] = useState(false);
  const [unretiring, setUnretiring] = useState(false);
  const [filterClass, setFilterClass] = useState('all');
  const [sortBy, setSortBy] = useState('retiredAt'); // retiredAt, totalSeasons, bestScore

  useEffect(() => {
    if (!user?.uid) return;

    const profileRef = doc(db, 'artifacts', dataNamespace, 'users', user.uid, 'profile', 'data');
    const unsubscribe = onSnapshot(profileRef, (snapshot) => {
      if (snapshot.exists()) {
        const profileData = snapshot.data();
        setRetiredCorps(profileData.retiredCorps || []);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

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

  const handleUnretire = async (corpsClass, retiredIndex) => {
    setUnretiring(true);
    try {
      const result = await unretireCorps({ corpsClass, retiredIndex });
      if (result.data.success) {
        toast.success(result.data.message);
        setShowUnretireModal(false);
        setSelectedCorps(null);
      }
    } catch (error) {
      console.error('Error unretiring corps:', error);
      toast.error(error.message || 'Failed to unretire corps');
    } finally {
      setUnretiring(false);
    }
  };

  // Filter and sort retired corps
  const filteredCorps = retiredCorps
    .filter(corps => filterClass === 'all' || corps.corpsClass === filterClass)
    .map((corps, index) => ({ ...corps, originalIndex: index }))
    .sort((a, b) => {
      switch (sortBy) {
        case 'totalSeasons':
          return b.totalSeasons - a.totalSeasons;
        case 'bestScore':
          return b.bestSeasonScore - a.bestSeasonScore;
        case 'retiredAt':
        default:
          return (b.retiredAt?.seconds || 0) - (a.retiredAt?.seconds || 0);
      }
    });

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-4 sm:p-6">
        <LoadingScreen fullScreen={false} />
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
          <Archive className="w-8 h-8 text-purple-400" />
          <h1 className="text-3xl sm:text-4xl font-bold text-white">
            Retired Corps Gallery
          </h1>
        </div>
        <p className="text-gray-300 text-lg">
          Honor the legacy of your past corps and their achievements
        </p>
      </motion.div>

      {/* Filters and Sort */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto mb-6 bg-white/5 backdrop-blur-sm rounded-lg p-4"
      >
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          {/* Class Filter */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFilterClass('all')}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                filterClass === 'all'
                  ? 'bg-purple-500 text-white'
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              All Classes
            </button>
            <button
              onClick={() => setFilterClass('worldClass')}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                filterClass === 'worldClass'
                  ? 'bg-purple-500 text-white'
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              World Class
            </button>
            <button
              onClick={() => setFilterClass('openClass')}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                filterClass === 'openClass'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              Open Class
            </button>
            <button
              onClick={() => setFilterClass('aClass')}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                filterClass === 'aClass'
                  ? 'bg-green-500 text-white'
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              A Class
            </button>
            <button
              onClick={() => setFilterClass('soundSport')}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                filterClass === 'soundSport'
                  ? 'bg-orange-500 text-white'
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              SoundSport
            </button>
          </div>

          {/* Sort Options */}
          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 rounded-lg bg-white/10 text-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="retiredAt">Recently Retired</option>
              <option value="totalSeasons">Most Seasons</option>
              <option value="bestScore">Best Score</option>
            </select>
          </div>
        </div>
      </motion.div>

      {/* Empty State */}
      {filteredCorps.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="max-w-2xl mx-auto text-center py-16"
        >
          <Archive className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <h3 className="text-2xl font-bold text-white mb-2">
            {filterClass === 'all' ? 'No Retired Corps Yet' : `No Retired ${getClassDisplayName(filterClass)} Corps`}
          </h3>
          <p className="text-gray-400">
            Retired corps will appear here when you retire them from your active roster.
          </p>
        </motion.div>
      )}

      {/* Corps Grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {filteredCorps.map((corps, index) => (
            <motion.div
              key={`${corps.corpsClass}-${corps.originalIndex}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: index * 0.05 }}
              className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm rounded-xl overflow-hidden border border-white/10 hover:border-purple-500/50 transition-all duration-300 group cursor-pointer"
              onClick={() => setSelectedCorps({ ...corps, index: corps.originalIndex })}
            >
              {/* Class Badge Header */}
              <div className={`h-2 bg-gradient-to-r ${getClassColor(corps.corpsClass)}`} />

              <div className="p-6">
                {/* Corps Name */}
                <div className="mb-4">
                  <div className="flex items-start justify-between mb-2">
                    <Music className="w-6 h-6 text-purple-400" />
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r ${getClassColor(corps.corpsClass)} text-white`}>
                      {getClassDisplayName(corps.corpsClass)}
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-1 group-hover:text-purple-300 transition-colors">
                    {corps.corpsName}
                  </h3>
                  <div className="flex items-center gap-1 text-gray-400 text-sm">
                    <MapPin className="w-4 h-4" />
                    {corps.location}
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="w-4 h-4 text-blue-400" />
                      <span className="text-xs text-gray-400">Seasons</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {corps.totalSeasons || 0}
                    </div>
                  </div>

                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Trophy className="w-4 h-4 text-yellow-400" />
                      <span className="text-xs text-gray-400">Best Score</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {corps.bestSeasonScore?.toFixed(1) || '0.0'}
                    </div>
                  </div>

                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Star className="w-4 h-4 text-purple-400" />
                      <span className="text-xs text-gray-400">Shows</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {corps.totalShows || 0}
                    </div>
                  </div>

                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Archive className="w-4 h-4 text-gray-400" />
                      <span className="text-xs text-gray-400">Retired</span>
                    </div>
                    <div className="text-xs font-semibold text-white">
                      {corps.retiredAt
                        ? new Date(corps.retiredAt.seconds * 1000).toLocaleDateString()
                        : 'Unknown'}
                    </div>
                  </div>
                </div>

                {/* Bring Out of Retirement Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedCorps({ ...corps, index: corps.originalIndex });
                    setShowUnretireModal(true);
                  }}
                  className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-lg transition-all duration-300 flex items-center justify-center gap-2 group-hover:shadow-lg group-hover:shadow-purple-500/50"
                >
                  <RefreshCw className="w-4 h-4" />
                  Bring Out of Retirement
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Unretire Confirmation Modal */}
      <AnimatePresence>
        {showUnretireModal && selectedCorps && (
          <Portal>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => !unretiring && setShowUnretireModal(false)}
            >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 max-w-md w-full border border-purple-500/30"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-2xl font-bold text-white">Bring Out of Retirement?</h3>
                <button
                  onClick={() => setShowUnretireModal(false)}
                  disabled={unretiring}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>

              <div className="mb-6">
                <div className="bg-white/5 rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Music className="w-6 h-6 text-purple-400" />
                    <div>
                      <h4 className="text-xl font-bold text-white">{selectedCorps.corpsName}</h4>
                      <p className="text-sm text-gray-400">{getClassDisplayName(selectedCorps.corpsClass)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <div className="text-center">
                      <div className="text-xs text-gray-400">Seasons</div>
                      <div className="text-lg font-bold text-white">{selectedCorps.totalSeasons}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-gray-400">Best Score</div>
                      <div className="text-lg font-bold text-white">{selectedCorps.bestSeasonScore?.toFixed(1)}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-gray-400">Shows</div>
                      <div className="text-lg font-bold text-white">{selectedCorps.totalShows}</div>
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                  <p className="text-sm text-yellow-200">
                    <strong>Note:</strong> This corps will become your active {getClassDisplayName(selectedCorps.corpsClass)} corps.
                    All season history will be preserved, but you'll start fresh for the current season.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowUnretireModal(false)}
                  disabled={unretiring}
                  className="flex-1 py-3 px-4 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleUnretire(selectedCorps.corpsClass, selectedCorps.index)}
                  disabled={unretiring}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {unretiring ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Unretiring...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Confirm
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        </Portal>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RetiredCorpsGallery;
