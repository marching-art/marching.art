// src/pages/HallOfChampions.jsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Award, Calendar, TrendingUp, Users } from 'lucide-react';
import { db } from '../firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

const HallOfChampions = () => {
  const [loading, setLoading] = useState(true);
  const [rankings, setRankings] = useState([]);

  useEffect(() => {
    fetchChampions();
  }, []);

  const fetchChampions = async () => {
    try {
      setLoading(true);
      const rankingsRef = collection(db, 'final_rankings');
      const rankingsSnapshot = await getDocs(rankingsRef);

      const championsData = [];
      rankingsSnapshot.forEach(doc => {
        const year = doc.id;
        const data = doc.data();

        if (data.data && data.data.length > 0) {
          // Get the top 3 corps for each year
          const topCorps = [...data.data]
            .sort((a, b) => b.points - a.points)
            .slice(0, 3);

          championsData.push({
            year,
            champion: topCorps[0],
            runnerUp: topCorps[1],
            thirdPlace: topCorps[2]
          });
        }
      });

      // Sort by year descending
      championsData.sort((a, b) => parseInt(b.year) - parseInt(a.year));
      setRankings(championsData);
    } catch (error) {
      console.error('Error fetching champions:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="text-center">
          <h1 className="text-5xl font-display font-bold text-gradient mb-4">Hall of Champions</h1>
          <p className="text-xl text-cream-300">Celebrating excellence in fantasy drum corps</p>
        </div>
      </motion.div>

      {rankings.length === 0 ? (
        <div className="card p-12 text-center">
          <Trophy className="w-16 h-16 text-cream-500/40 mx-auto mb-4" />
          <p className="text-xl text-cream-300 mb-2">No Champions Yet</p>
          <p className="text-cream-500/60">Champions will be crowned at the end of each season</p>
        </div>
      ) : (
        <div className="space-y-8">
          {rankings.map((yearData, index) => (
            <motion.div
              key={yearData.year}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="space-y-4"
            >
              {/* Year Header */}
              <div className="flex items-center gap-3">
                <Calendar className="w-6 h-6 text-gold-500" />
                <h2 className="text-3xl font-display font-bold text-cream-100">{yearData.year} Season</h2>
              </div>

              {/* Podium */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Champion - 1st Place */}
                {yearData.champion && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.1 + 0.1 }}
                    className="card-premium text-center p-6 md:order-2"
                  >
                    <div className="w-20 h-20 bg-gradient-gold rounded-full mx-auto mb-4 flex items-center justify-center">
                      <Trophy className="w-10 h-10 text-charcoal-900" />
                    </div>
                    <div className="mb-2">
                      <span className="text-sm font-semibold text-yellow-500">CHAMPION</span>
                    </div>
                    <h3 className="text-xl font-semibold text-cream-100 mb-1">{yearData.champion.corps}</h3>
                    <p className="text-2xl font-bold text-gold-500 mb-1">{yearData.champion.points.toFixed(2)}</p>
                    <p className="text-xs text-cream-500/60">points</p>
                  </motion.div>
                )}

                {/* Runner Up - 2nd Place */}
                {yearData.runnerUp && (
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
                    <h3 className="text-lg font-semibold text-cream-100 mb-1">{yearData.runnerUp.corps}</h3>
                    <p className="text-xl font-bold text-gray-400 mb-1">{yearData.runnerUp.points.toFixed(2)}</p>
                    <p className="text-xs text-cream-500/60">points</p>
                  </motion.div>
                )}

                {/* Third Place */}
                {yearData.thirdPlace && (
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
                    <h3 className="text-lg font-semibold text-cream-100 mb-1">{yearData.thirdPlace.corps}</h3>
                    <p className="text-xl font-bold text-orange-600 mb-1">{yearData.thirdPlace.points.toFixed(2)}</p>
                    <p className="text-xs text-cream-500/60">points</p>
                  </motion.div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HallOfChampions;
