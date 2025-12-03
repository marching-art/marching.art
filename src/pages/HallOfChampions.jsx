// src/pages/HallOfChampions.jsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Award, Calendar, Crown } from 'lucide-react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import EmptyState from '../components/EmptyState';

const CLASS_CONFIG = {
  worldClass: { name: 'World Class', color: 'gold', icon: Crown },
  openClass: { name: 'Open Class', color: 'blue', icon: Trophy },
  aClass: { name: 'A Class', color: 'emerald', icon: Award }
};

const HallOfChampions = () => {
  const [loading, setLoading] = useState(true);
  const [seasons, setSeasons] = useState([]);
  const [selectedClass, setSelectedClass] = useState('worldClass');

  useEffect(() => {
    fetchSeasonChampions();
  }, []);

  const fetchSeasonChampions = async () => {
    try {
      setLoading(true);
      const championsRef = collection(db, 'season_champions');
      const championsSnapshot = await getDocs(championsRef);

      const seasonsData = [];
      championsSnapshot.forEach(doc => {
        const data = doc.data();
        seasonsData.push({
          id: doc.id,
          seasonName: data.seasonName,
          seasonType: data.seasonType,
          archivedAt: data.archivedAt?.toDate?.() || new Date(data.archivedAt),
          classes: data.classes || {}
        });
      });

      // Sort by archived date descending (most recent first)
      seasonsData.sort((a, b) => b.archivedAt - a.archivedAt);
      setSeasons(seasonsData);
    } catch (error) {
      console.error('Error fetching season champions:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatSeasonName = (name) => {
    if (!name) return 'Unknown Season';
    // Convert "live_2024-25" to "Live Season 2024-25" or "crescendo_2024-25" to "Crescendo 2024-25"
    const parts = name.split('_');
    if (parts.length >= 2) {
      const type = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
      const year = parts.slice(1).join('-');
      if (type === 'Live') {
        return `Live Season ${year}`;
      }
      return `${type} ${year}`;
    }
    return name;
  };

  const getChampionsForClass = (season, corpsClass) => {
    return season.classes[corpsClass] || [];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold-500"></div>
      </div>
    );
  }

  const ClassIcon = CLASS_CONFIG[selectedClass]?.icon || Trophy;

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="text-center">
          <h1 className="text-5xl font-display font-bold text-charcoal-950 dark:text-cream-100 mb-4">Hall of Champions</h1>
          <p className="text-xl text-slate-600 dark:text-cream-300">Celebrating excellence in marching.art fantasy drum corps</p>
        </div>
      </motion.div>

      {/* Class Filter Tabs */}
      <div className="flex justify-center gap-4 flex-wrap">
        {Object.entries(CLASS_CONFIG).map(([classKey, config]) => {
          const Icon = config.icon;
          return (
            <button
              key={classKey}
              onClick={() => setSelectedClass(classKey)}
              className={`px-6 py-3 rounded-lg font-semibold transition-all flex items-center gap-2 ${
                selectedClass === classKey
                  ? `bg-${config.color}-500/20 border-2 border-${config.color}-500 text-${config.color}-600 dark:text-${config.color}-400`
                  : 'bg-stone-100 dark:bg-charcoal-800 border-2 border-stone-300 dark:border-charcoal-700 text-slate-600 dark:text-cream-300 hover:border-slate-400 dark:hover:border-cream-500'
              }`}
            >
              <Icon className="w-5 h-5" />
              {config.name}
            </button>
          );
        })}
      </div>

      {seasons.length === 0 ? (
        <EmptyState
          title="NO CHAMPIONS YET"
          subtitle="Champions will be crowned at the end of each season..."
        />
      ) : (
        <div className="space-y-8">
          {seasons.map((season, index) => {
            const champions = getChampionsForClass(season, selectedClass);

            if (champions.length === 0) {
              return (
                <motion.div
                  key={season.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="space-y-4"
                >
                  <div className="flex items-center gap-3">
                    <Calendar className="w-6 h-6 text-amber-600 dark:text-gold-500" />
                    <h2 className="text-3xl font-display font-bold text-charcoal-950 dark:text-cream-100">
                      {formatSeasonName(season.seasonName)}
                    </h2>
                  </div>
                  <EmptyState
                    title="NO CHAMPIONS RECORDED"
                    subtitle={`No ${CLASS_CONFIG[selectedClass]?.name} champions for this season...`}
                  />
                </motion.div>
              );
            }

            return (
              <motion.div
                key={season.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="space-y-4"
              >
                {/* Season Header */}
                <div className="flex items-center gap-3">
                  <Calendar className="w-6 h-6 text-amber-600 dark:text-gold-500" />
                  <h2 className="text-3xl font-display font-bold text-charcoal-950 dark:text-cream-100">
                    {formatSeasonName(season.seasonName)}
                  </h2>
                  <span className="text-sm text-slate-500 dark:text-cream-500/60 bg-stone-100 dark:bg-charcoal-800 px-3 py-1 rounded-full">
                    {CLASS_CONFIG[selectedClass]?.name}
                  </span>
                </div>

                {/* Podium */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Champion - 1st Place */}
                  {champions[0] && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.1 + 0.1 }}
                      className="card-premium text-center p-6 md:order-2"
                    >
                      <div className="w-20 h-20 bg-gradient-gold rounded-full mx-auto mb-4 flex items-center justify-center">
                        <ClassIcon className="w-10 h-10 text-charcoal-900" />
                      </div>
                      <div className="mb-2">
                        <span className="text-sm font-semibold text-yellow-500">CHAMPION</span>
                      </div>
                      <Link
                        to={`/profile/${champions[0].uid}`}
                        className="text-xl font-semibold text-cream-100 mb-1 hover:text-gold-400 transition-colors block"
                      >
                        {champions[0].username}
                      </Link>
                      <p className="text-sm text-cream-400 mb-2">{champions[0].corpsName}</p>
                      <p className="text-2xl font-bold text-gold-500 mb-1">{champions[0].score?.toFixed(2)}</p>
                      <p className="text-xs text-cream-500/60">points</p>
                    </motion.div>
                  )}

                  {/* Runner Up - 2nd Place */}
                  {champions[1] && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.1 + 0.2 }}
                      className="card text-center p-6 border-2 border-gray-400/30 md:order-1"
                    >
                      <div className="w-16 h-16 bg-gray-400/20 border-2 border-gray-400 rounded-full mx-auto mb-4 flex items-center justify-center">
                        <Award className="w-8 h-8 text-gray-400" />
                      </div>
                      <div className="mb-2">
                        <span className="text-xs font-semibold text-gray-400">2ND PLACE</span>
                      </div>
                      <Link
                        to={`/profile/${champions[1].uid}`}
                        className="text-lg font-semibold text-cream-100 mb-1 hover:text-gray-300 transition-colors block"
                      >
                        {champions[1].username}
                      </Link>
                      <p className="text-sm text-cream-400 mb-2">{champions[1].corpsName}</p>
                      <p className="text-xl font-bold text-gray-400 mb-1">{champions[1].score?.toFixed(2)}</p>
                      <p className="text-xs text-cream-500/60">points</p>
                    </motion.div>
                  )}

                  {/* Third Place */}
                  {champions[2] && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.1 + 0.3 }}
                      className="card text-center p-6 border-2 border-orange-600/30 md:order-3"
                    >
                      <div className="w-16 h-16 bg-orange-500/20 border-2 border-orange-600 rounded-full mx-auto mb-4 flex items-center justify-center">
                        <Award className="w-8 h-8 text-orange-600" />
                      </div>
                      <div className="mb-2">
                        <span className="text-xs font-semibold text-orange-600">3RD PLACE</span>
                      </div>
                      <Link
                        to={`/profile/${champions[2].uid}`}
                        className="text-lg font-semibold text-cream-100 mb-1 hover:text-orange-400 transition-colors block"
                      >
                        {champions[2].username}
                      </Link>
                      <p className="text-sm text-cream-400 mb-2">{champions[2].corpsName}</p>
                      <p className="text-xl font-bold text-orange-600 mb-1">{champions[2].score?.toFixed(2)}</p>
                      <p className="text-xs text-cream-500/60">points</p>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default HallOfChampions;
