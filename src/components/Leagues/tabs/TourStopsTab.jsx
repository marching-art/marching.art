// TourStopsTab - Weekly tour stop results for league members
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trophy, MapPin, Calendar, CircleDot } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase';

// Placement points
const PLACEMENT_POINTS = {
  1: 15, 2: 12, 3: 10, 4: 8, 5: 6,
  6: 5, 7: 4, 8: 3, 9: 2, 10: 1
};

const getPlacementPoints = (placement) => {
  return PLACEMENT_POINTS[placement] || 1;
};

const TourStopsTab = ({ league }) => {
  const [tourStops, setTourStops] = useState([]);
  const [memberProfiles, setMemberProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState(null);

  useEffect(() => {
    const fetchTourStops = async () => {
      if (!league?.members?.length) return;
      setLoading(true);

      try {
        // Fetch member profiles
        const profiles = {};
        await Promise.all(league.members.map(async (uid) => {
          const profileRef = doc(db, `artifacts/marching-art/users/${uid}/profile/data`);
          const profileDoc = await getDoc(profileRef);
          if (profileDoc.exists()) {
            profiles[uid] = profileDoc.data();
          }
        }));
        setMemberProfiles(profiles);

        // Fetch season data
        const seasonRef = doc(db, 'game-settings/season');
        const seasonDoc = await getDoc(seasonRef);

        if (seasonDoc.exists()) {
          const sData = seasonDoc.data();

          // Calculate current week
          const startDate = sData.schedule?.startDate?.toDate();
          if (startDate) {
            const now = new Date();
            const diffInDays = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
            const currentWeek = Math.max(1, Math.ceil((diffInDays + 1) / 7));
            setSelectedWeek(currentWeek);
          }

          // Fetch fantasy recaps
          const recapsRef = doc(db, `fantasy_recaps/${sData.seasonUid}`);
          const recapsDoc = await getDoc(recapsRef);

          if (recapsDoc.exists()) {
            const recaps = recapsDoc.data().recaps || [];
            const memberUids = new Set(league.members);

            // Group by week
            const weeklyData = {};

            recaps.forEach(dayRecap => {
              const week = Math.ceil(dayRecap.offSeasonDay / 7);
              if (!weeklyData[week]) {
                weeklyData[week] = {
                  week,
                  shows: [],
                  memberResults: {}
                };
              }

              dayRecap.shows?.forEach(show => {
                const leagueResults = (show.results || []).filter(r => memberUids.has(r.uid));
                if (leagueResults.length > 0) {
                  weeklyData[week].shows.push({
                    eventName: show.eventName,
                    location: show.location,
                    day: dayRecap.offSeasonDay,
                    results: leagueResults.sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0))
                  });

                  // Aggregate member results for the week
                  leagueResults.forEach(result => {
                    if (!weeklyData[week].memberResults[result.uid]) {
                      weeklyData[week].memberResults[result.uid] = {
                        totalScore: 0,
                        showCount: 0,
                        highScore: 0
                      };
                    }
                    weeklyData[week].memberResults[result.uid].totalScore += result.totalScore || 0;
                    weeklyData[week].memberResults[result.uid].showCount += 1;
                    weeklyData[week].memberResults[result.uid].highScore = Math.max(
                      weeklyData[week].memberResults[result.uid].highScore,
                      result.totalScore || 0
                    );
                  });
                }
              });
            });

            // Calculate rankings for each week
            Object.values(weeklyData).forEach(weekData => {
              weekData.rankings = Object.entries(weekData.memberResults)
                .map(([uid, data]) => ({ uid, ...data }))
                .sort((a, b) => b.totalScore - a.totalScore)
                .map((item, index) => ({
                  ...item,
                  placement: index + 1,
                  pointsEarned: getPlacementPoints(index + 1)
                }));
            });

            setTourStops(Object.values(weeklyData).sort((a, b) => b.week - a.week));
          }
        }
      } catch (error) {
        console.error('Error fetching tour stops:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTourStops();
  }, [league]);

  const getDirectorName = (uid) => {
    const profile = memberProfiles[uid];
    return profile?.displayName || profile?.username || `Director ${uid.slice(0, 6)}`;
  };

  const getCorpsName = (uid) => {
    const profile = memberProfiles[uid];
    if (profile?.corps) {
      const activeCorps = Object.values(profile.corps).find(c => c.corpsName || c.name);
      return activeCorps?.corpsName || activeCorps?.name || 'Unknown Corps';
    }
    return 'Unknown Corps';
  };

  const getMedalColor = (placement) => {
    if (placement === 1) return 'text-yellow-500 bg-yellow-500/20';
    if (placement === 2) return 'text-gray-400 bg-gray-400/20';
    if (placement === 3) return 'text-orange-600 bg-orange-600/20';
    return 'text-cream-500/60 bg-cream-500/10';
  };

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-8 text-center"
      >
        <p className="text-cream-500/60">Loading tour stops...</p>
      </motion.div>
    );
  }

  const selectedStop = tourStops.find(s => s.week === selectedWeek);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-4"
    >
      {/* Week Selector */}
      <div className="card p-4">
        <h3 className="text-lg font-bold text-cream-100 mb-3 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-gold-500" />
          Tour Schedule
        </h3>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[1, 2, 3, 4, 5, 6, 7].map(week => {
            const hasResults = tourStops.some(s => s.week === week && s.rankings?.length > 0);
            const isSelected = selectedWeek === week;

            return (
              <button
                key={week}
                onClick={() => setSelectedWeek(week)}
                className={`flex-shrink-0 px-4 py-2 rounded-sm font-semibold transition-all ${
                  isSelected
                    ? 'bg-gold-500 text-charcoal-900'
                    : hasResults
                    ? 'glass text-cream-100 hover:bg-cream-500/10'
                    : 'glass text-cream-500/40'
                }`}
              >
                <span className="text-sm">Week {week}</span>
                {hasResults && !isSelected && (
                  <CircleDot className="w-3 h-3 inline ml-1 text-green-400" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Week Results */}
      {selectedStop && selectedStop.rankings?.length > 0 ? (
        <div className="card p-6">
          <h3 className="text-xl font-bold text-cream-100 mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-gold-500" />
            Week {selectedStop.week} Results
          </h3>

          {/* Rankings Table */}
          <div className="overflow-x-auto -mx-6 px-6 md:mx-0 md:px-0 mb-6">
            <table className="w-full">
              <thead>
                <tr className="border-b border-cream-500/20">
                  <th className="text-left py-3 px-2 md:px-4 text-xs md:text-sm font-semibold text-cream-500/60">Place</th>
                  <th className="text-left py-3 px-2 md:px-4 text-xs md:text-sm font-semibold text-cream-500/60">Director</th>
                  <th className="text-center py-3 px-2 md:px-4 text-xs md:text-sm font-semibold text-cream-500/60">Shows</th>
                  <th className="text-center py-3 px-2 md:px-4 text-xs md:text-sm font-semibold text-cream-500/60">Total</th>
                  <th className="text-center py-3 px-2 md:px-4 text-xs md:text-sm font-semibold text-cream-500/60 hidden md:table-cell">High</th>
                  <th className="text-center py-3 px-2 md:px-4 text-xs md:text-sm font-semibold text-cream-500/60">Pts</th>
                </tr>
              </thead>
              <tbody>
                {selectedStop.rankings.map((ranking) => (
                  <tr key={ranking.uid} className="border-b border-cream-500/10 hover:bg-cream-500/5">
                    <td className="py-3 px-2 md:px-4">
                      <div className={`inline-flex items-center justify-center w-8 h-8 rounded-sm font-bold ${getMedalColor(ranking.placement)}`}>
                        {ranking.placement}
                      </div>
                    </td>
                    <td className="py-3 px-2 md:px-4">
                      <div>
                        <span className="font-semibold text-cream-100 text-sm md:text-base">
                          {getDirectorName(ranking.uid)}
                        </span>
                        <p className="text-xs text-cream-500/60 hidden md:block">
                          {getCorpsName(ranking.uid)}
                        </p>
                      </div>
                    </td>
                    <td className="text-center py-3 px-2 md:px-4 text-cream-100">
                      {ranking.showCount}
                    </td>
                    <td className="text-center py-3 px-2 md:px-4 text-cream-100 font-bold">
                      {ranking.totalScore.toFixed(1)}
                    </td>
                    <td className="text-center py-3 px-2 md:px-4 text-cream-100 hidden md:table-cell">
                      {ranking.highScore.toFixed(1)}
                    </td>
                    <td className="text-center py-3 px-2 md:px-4">
                      <span className="text-gold-500 font-bold">+{ranking.pointsEarned}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Shows List */}
          {selectedStop.shows?.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-cream-300 mb-3">Shows This Week</h4>
              <div className="space-y-2">
                {selectedStop.shows.map((show, idx) => (
                  <div key={idx} className="p-3 bg-charcoal-900/50 rounded-sm">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-cream-100 text-sm">{show.eventName}</p>
                        <p className="text-xs text-cream-500/60 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {show.location}
                        </p>
                      </div>
                      <span className="text-xs text-cream-500/40">Day {show.day}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="card p-12 text-center">
          <Calendar className="w-16 h-16 text-cream-500/40 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-cream-100 mb-2">
            No Results Yet
          </h3>
          <p className="text-cream-500/60">
            {selectedWeek ? `Week ${selectedWeek} results will appear after shows are scored` : 'Select a week to view results'}
          </p>
        </div>
      )}
    </motion.div>
  );
};

export default TourStopsTab;
