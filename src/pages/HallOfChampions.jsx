// src/pages/HallOfChampions.jsx
// Sidebar (Seasons) + Main Stage (Podium) Layout
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Award, Calendar, Crown, Star, ChevronRight, Medal, ArrowLeft } from 'lucide-react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import LoadingScreen from '../components/LoadingScreen';

const CLASS_CONFIG = {
  worldClass: { name: 'World Class', color: 'gold', icon: Crown },
  openClass: { name: 'Open Class', color: 'purple', icon: Trophy },
  aClass: { name: 'A Class', color: 'blue', icon: Award }
};

const HallOfChampions = () => {
  const [loading, setLoading] = useState(true);
  const [seasons, setSeasons] = useState([]);
  const [selectedClass, setSelectedClass] = useState('worldClass');
  const [selectedSeason, setSelectedSeason] = useState(null);

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

      // Auto-select first season
      if (seasonsData.length > 0) {
        setSelectedSeason(seasonsData[0]);
      }
    } catch (error) {
      console.error('Error fetching season champions:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatSeasonName = (name) => {
    if (!name) return 'Unknown Season';
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

  const formatSeasonShort = (name) => {
    if (!name) return 'Unknown';
    const parts = name.split('_');
    if (parts.length >= 2) {
      return parts.slice(1).join('-');
    }
    return name;
  };

  const getChampionsForClass = (season, corpsClass) => {
    return season?.classes[corpsClass] || [];
  };

  // Get current champions
  const currentChampions = useMemo(() => {
    return selectedSeason ? getChampionsForClass(selectedSeason, selectedClass) : [];
  }, [selectedSeason, selectedClass]);

  if (loading) {
    return <LoadingScreen fullScreen={false} />;
  }

  const ClassIcon = CLASS_CONFIG[selectedClass]?.icon || Trophy;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ================================================================
          SIDEBAR + MAIN STAGE LAYOUT
          ================================================================ */}
      <div className="flex-1 flex min-h-0">

        {/* ============================================================
            LEFT SIDEBAR: Seasons List
            ============================================================ */}
        <div className={`flex flex-col min-h-0 border-r border-cream-500/10 bg-charcoal-950/50 ${
          selectedSeason ? 'hidden lg:flex lg:w-72 xl:w-80' : 'w-full lg:w-72 xl:w-80'
        }`}>

          {/* Sidebar Header */}
          <div className="flex-shrink-0 p-4 border-b border-cream-500/10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gold-500/20 border border-gold-500/30 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-gold-400" />
              </div>
              <div>
                <h1 className="text-xl font-display font-bold text-cream uppercase tracking-wide">
                  Hall of Champions
                </h1>
                <p className="text-xs text-cream-500/60">
                  {seasons.length} Season{seasons.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {/* Class Filter */}
            <div className="flex gap-1 p-1 bg-charcoal-900/50 rounded-lg">
              {Object.entries(CLASS_CONFIG).map(([classKey, config]) => {
                const Icon = config.icon;
                const isSelected = selectedClass === classKey;
                const colorClasses = {
                  gold: isSelected ? 'bg-gold-500 text-charcoal-900' : 'text-gold-400',
                  purple: isSelected ? 'bg-purple-500 text-white' : 'text-purple-400',
                  blue: isSelected ? 'bg-blue-500 text-white' : 'text-blue-400'
                };

                return (
                  <button
                    key={classKey}
                    onClick={() => setSelectedClass(classKey)}
                    className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-display font-bold uppercase tracking-wide transition-all ${
                      isSelected
                        ? colorClasses[config.color]
                        : `${colorClasses[config.color]} hover:bg-charcoal-800`
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    <span className="hidden sm:inline">{config.name.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Seasons List */}
          <div className="flex-1 min-h-0 overflow-y-auto hud-scroll p-3 space-y-2">
            {seasons.length === 0 ? (
              <div className="text-center py-12">
                <Trophy className="w-10 h-10 text-cream-500/20 mx-auto mb-3" />
                <p className="text-sm text-cream-500/60">No seasons recorded</p>
              </div>
            ) : (
              seasons.map((season) => {
                const champions = getChampionsForClass(season, selectedClass);
                const isSelected = selectedSeason?.id === season.id;
                const hasChampions = champions.length > 0;

                return (
                  <button
                    key={season.id}
                    onClick={() => setSelectedSeason(season)}
                    className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                      isSelected
                        ? 'bg-gold-500/20 border-gold-500/50 shadow-[0_0_12px_rgba(234,179,8,0.2)]'
                        : hasChampions
                        ? 'bg-charcoal-900/30 border-cream-500/10 hover:border-cream-500/30'
                        : 'bg-charcoal-900/20 border-cream-500/5 opacity-50 hover:opacity-70'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        isSelected ? 'bg-gold-500/30' : hasChampions ? 'bg-charcoal-800' : 'bg-charcoal-900'
                      }`}>
                        <Calendar className={`w-5 h-5 ${
                          isSelected ? 'text-gold-400' : hasChampions ? 'text-cream-400' : 'text-cream-500/40'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className={`font-display font-bold text-sm truncate ${
                          isSelected ? 'text-gold-400' : 'text-cream-100'
                        }`}>
                          {formatSeasonShort(season.seasonName)}
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-cream-500/60">
                          {hasChampions ? (
                            <>
                              <Crown className="w-3 h-3 text-gold-400" />
                              <span>{champions[0]?.corpsName || 'Champion'}</span>
                            </>
                          ) : (
                            <span className="italic">No champions</span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 ${isSelected ? 'text-gold-400' : 'text-cream-500/40'}`} />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ============================================================
            MAIN STAGE: Podium Display
            ============================================================ */}
        <div className={`flex-1 flex flex-col min-h-0 ${!selectedSeason ? 'hidden lg:flex' : 'flex'}`}>
          {selectedSeason ? (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Mobile Back Button */}
              <div className="lg:hidden flex-shrink-0 p-3 border-b border-cream-500/10 bg-charcoal-950/50">
                <button
                  onClick={() => setSelectedSeason(null)}
                  className="flex items-center gap-2 text-cream-400 hover:text-cream-100 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="text-sm font-display">Back to Seasons</span>
                </button>
              </div>

              {/* Season Header */}
              <div className="flex-shrink-0 p-4 lg:p-6 border-b border-cream-500/10 bg-charcoal-950/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-gold-500/30 to-amber-500/30 border-2 border-gold-500/50 flex items-center justify-center">
                      <ClassIcon className="w-7 h-7 text-gold-400" />
                    </div>
                    <div>
                      <h2 className="text-xl lg:text-2xl font-display font-bold text-cream-100 uppercase tracking-wide">
                        {formatSeasonName(selectedSeason.seasonName)}
                      </h2>
                      <p className="text-sm text-cream-500/60 flex items-center gap-2">
                        <span>{CLASS_CONFIG[selectedClass]?.name} Division</span>
                        <span className="text-cream-500/30">•</span>
                        <span>{selectedSeason.archivedAt?.toLocaleDateString?.() || 'Unknown date'}</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Podium Content */}
              <div className="flex-1 min-h-0 overflow-y-auto hud-scroll p-4 lg:p-8">
                {currentChampions.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <EmptyState
                      variant="awaiting"
                      title="No Champions Recorded"
                      subtitle={`No ${CLASS_CONFIG[selectedClass]?.name} champions for this season`}
                    />
                  </div>
                ) : (
                  <div className="max-w-4xl mx-auto">
                    {/* Podium Layout - 3 Column with center elevated */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                      {/* 2nd Place - Left */}
                      {currentChampions[1] && (
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.2 }}
                          className="md:order-1"
                        >
                          <div className="bg-gradient-to-b from-gray-500/10 to-gray-500/5 border-2 border-gray-400/30 rounded-2xl p-6 text-center">
                            <div className="w-20 h-20 bg-gray-500/20 border-4 border-gray-400 rounded-full mx-auto mb-4 flex items-center justify-center relative">
                              <Medal className="w-10 h-10 text-gray-400" />
                              <div className="absolute -bottom-2 px-2 py-0.5 rounded-full bg-gray-500 text-white text-[10px] font-bold">
                                2ND
                              </div>
                            </div>
                            <Link
                              to={`/profile/${currentChampions[1].uid}`}
                              className="text-xl font-display font-bold text-cream-100 mb-1 hover:text-gray-300 transition-colors block"
                            >
                              {currentChampions[1].username}
                            </Link>
                            <p className="text-sm text-cream-400 mb-3">{currentChampions[1].corpsName}</p>
                            <div className="bg-gray-500/10 rounded-xl p-3">
                              <p className="text-2xl font-mono font-bold text-gray-300">{currentChampions[1].score?.toFixed(2)}</p>
                              <p className="text-[10px] text-cream-500/60 uppercase tracking-wide">Points</p>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {/* 1st Place - Center (Elevated) */}
                      {currentChampions[0] && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.1 }}
                          className="md:order-2 md:-mt-8"
                        >
                          <div className="bg-gradient-to-b from-gold-500/20 to-amber-500/10 border-2 border-gold-500/50 rounded-2xl p-8 text-center shadow-[0_0_30px_rgba(234,179,8,0.2)] relative overflow-hidden">
                            {/* Crown decoration */}
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                              <Crown className="w-8 h-8 text-gold-400" />
                            </div>

                            <div className="w-24 h-24 bg-gradient-to-br from-gold-500 to-amber-400 rounded-full mx-auto mb-4 flex items-center justify-center relative shadow-[0_0_20px_rgba(234,179,8,0.4)]">
                              <ClassIcon className="w-12 h-12 text-charcoal-900" />
                              <div className="absolute -bottom-2 px-3 py-1 rounded-full bg-gold-500 text-charcoal-900 text-xs font-black">
                                CHAMPION
                              </div>
                            </div>
                            <Link
                              to={`/profile/${currentChampions[0].uid}`}
                              className="text-2xl font-display font-bold text-gold-400 mb-1 hover:text-gold-300 transition-colors block"
                            >
                              {currentChampions[0].username}
                            </Link>
                            <p className="text-lg text-cream-300 mb-4">{currentChampions[0].corpsName}</p>
                            <div className="bg-gold-500/20 rounded-xl p-4">
                              <p className="text-3xl font-mono font-bold text-gold-400">{currentChampions[0].score?.toFixed(2)}</p>
                              <p className="text-xs text-gold-400/60 uppercase tracking-wide">Points</p>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {/* 3rd Place - Right */}
                      {currentChampions[2] && (
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.3 }}
                          className="md:order-3"
                        >
                          <div className="bg-gradient-to-b from-amber-600/10 to-amber-700/5 border-2 border-amber-600/30 rounded-2xl p-6 text-center">
                            <div className="w-20 h-20 bg-amber-600/20 border-4 border-amber-600 rounded-full mx-auto mb-4 flex items-center justify-center relative">
                              <Award className="w-10 h-10 text-amber-600" />
                              <div className="absolute -bottom-2 px-2 py-0.5 rounded-full bg-amber-600 text-white text-[10px] font-bold">
                                3RD
                              </div>
                            </div>
                            <Link
                              to={`/profile/${currentChampions[2].uid}`}
                              className="text-xl font-display font-bold text-cream-100 mb-1 hover:text-amber-400 transition-colors block"
                            >
                              {currentChampions[2].username}
                            </Link>
                            <p className="text-sm text-cream-400 mb-3">{currentChampions[2].corpsName}</p>
                            <div className="bg-amber-600/10 rounded-xl p-3">
                              <p className="text-2xl font-mono font-bold text-amber-500">{currentChampions[2].score?.toFixed(2)}</p>
                              <p className="text-[10px] text-cream-500/60 uppercase tracking-wide">Points</p>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </div>

                    {/* Additional Finalists */}
                    {currentChampions.length > 3 && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4 }}
                        className="mt-8"
                      >
                        <h3 className="text-sm font-display font-bold text-cream-400 uppercase tracking-wide mb-4 flex items-center gap-2">
                          <Star className="w-4 h-4 text-purple-400" />
                          Additional Finalists
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {currentChampions.slice(3).map((finalist, index) => (
                            <div
                              key={finalist.uid}
                              className="bg-charcoal-900/30 border border-cream-500/10 rounded-xl p-4 text-center"
                            >
                              <p className="text-xs text-cream-500/60 mb-1">#{index + 4}</p>
                              <Link
                                to={`/profile/${finalist.uid}`}
                                className="font-display font-bold text-cream-100 hover:text-cream-300 transition-colors block truncate"
                              >
                                {finalist.username}
                              </Link>
                              <p className="text-xs text-cream-500/60">{finalist.corpsName}</p>
                              <p className="text-lg font-mono font-bold text-cream-300 mt-2">{finalist.score?.toFixed(2)}</p>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Empty State - No Season Selected */
            <div className="flex-1 flex items-center justify-center bg-charcoal-950/30">
              <EmptyState
                variant="signal"
                title="Select a Season"
                subtitle="Choose a season from the sidebar to view its champions."
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HallOfChampions;
