// CircuitStandingsTab - League standings based on circuit points
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Crown, Medal, Star } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase';

// Placement points - DCI/NASCAR style scoring
const PLACEMENT_POINTS = {
  1: 15, 2: 12, 3: 10, 4: 8, 5: 6,
  6: 5, 7: 4, 8: 3, 9: 2, 10: 1
};

const getPlacementPoints = (placement) => {
  return PLACEMENT_POINTS[placement] || 1;
};

const CircuitStandingsTab = ({ league }) => {
  const [memberData, setMemberData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMemberData = async () => {
      if (!league?.members?.length) return;
      setLoading(true);

      try {
        // Fetch all member profiles and their corps data
        const memberPromises = league.members.map(async (uid) => {
          const profileRef = doc(db, `artifacts/marching-art/users/${uid}/profile/data`);
          const profileDoc = await getDoc(profileRef);

          if (!profileDoc.exists()) return null;

          const profile = profileDoc.data();

          // Get the total season score from their active corps
          let totalScore = 0;
          let corpsName = 'Unknown Corps';
          let corpsClass = null;

          if (profile.corps) {
            Object.entries(profile.corps).forEach(([cls, data]) => {
              if (data.totalSeasonScore && data.totalSeasonScore > totalScore) {
                totalScore = data.totalSeasonScore;
                corpsName = data.corpsName || data.name || 'Unknown Corps';
                corpsClass = cls;
              }
            });
          }

          return {
            uid,
            displayName: profile.displayName || profile.username || `Director ${uid.slice(0, 6)}`,
            corpsName,
            corpsClass,
            totalSeasonScore: totalScore,
            circuitPoints: 0,
            medals: { gold: 0, silver: 0, bronze: 0 },
            tourStops: 0,
            seasonHighScore: 0,
            averagePlacement: 0
          };
        });

        const members = (await Promise.all(memberPromises)).filter(Boolean);

        // Fetch fantasy recaps to calculate circuit standings
        const seasonRef = doc(db, 'game-settings/season');
        const seasonDoc = await getDoc(seasonRef);

        if (seasonDoc.exists()) {
          const seasonData = seasonDoc.data();
          const recapsRef = doc(db, `fantasy_recaps/${seasonData.seasonUid}`);
          const recapsDoc = await getDoc(recapsRef);

          if (recapsDoc.exists()) {
            const recaps = recapsDoc.data().recaps || [];
            const memberUids = new Set(league.members);
            const weeklyResults = {};

            recaps.forEach(dayRecap => {
              const week = Math.ceil(dayRecap.offSeasonDay / 7);
              if (!weeklyResults[week]) {
                weeklyResults[week] = {};
              }

              dayRecap.shows?.forEach(show => {
                show.results?.forEach(result => {
                  if (memberUids.has(result.uid)) {
                    if (!weeklyResults[week][result.uid]) {
                      weeklyResults[week][result.uid] = {
                        totalScore: 0,
                        showCount: 0,
                        highScore: 0
                      };
                    }
                    weeklyResults[week][result.uid].totalScore += result.totalScore || 0;
                    weeklyResults[week][result.uid].showCount += 1;
                    weeklyResults[week][result.uid].highScore = Math.max(
                      weeklyResults[week][result.uid].highScore,
                      result.totalScore || 0
                    );
                  }
                });
              });
            });

            // Calculate circuit points and medals from weekly rankings
            const tourStops = [];

            Object.entries(weeklyResults).forEach(([week, weekData]) => {
              const weekRankings = Object.entries(weekData)
                .map(([uid, data]) => ({
                  uid,
                  weekScore: data.totalScore,
                  showCount: data.showCount,
                  highScore: data.highScore
                }))
                .sort((a, b) => b.weekScore - a.weekScore);

              tourStops.push({
                week: parseInt(week),
                rankings: weekRankings
              });

              weekRankings.forEach((ranking, index) => {
                const member = members.find(m => m.uid === ranking.uid);
                if (member) {
                  const placement = index + 1;
                  member.circuitPoints += getPlacementPoints(placement);
                  member.tourStops += 1;
                  member.seasonHighScore = Math.max(member.seasonHighScore, ranking.highScore);

                  if (placement === 1) member.medals.gold += 1;
                  else if (placement === 2) member.medals.silver += 1;
                  else if (placement === 3) member.medals.bronze += 1;
                }
              });
            });

            // Calculate average placement
            members.forEach(member => {
              if (member.tourStops > 0) {
                let totalPlacements = 0;
                tourStops.forEach(stop => {
                  const ranking = stop.rankings.findIndex(r => r.uid === member.uid);
                  if (ranking !== -1) {
                    totalPlacements += ranking + 1;
                  }
                });
                member.averagePlacement = totalPlacements / member.tourStops;
              }
            });
          }
        }

        // Sort by circuit points, then by total season score
        members.sort((a, b) => {
          if (b.circuitPoints !== a.circuitPoints) return b.circuitPoints - a.circuitPoints;
          return b.totalSeasonScore - a.totalSeasonScore;
        });

        setMemberData(members);
      } catch (error) {
        console.error('Error fetching member data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMemberData();
  }, [league]);

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-8 text-center"
      >
        <p className="text-cream-500/60">Loading circuit standings...</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="card p-6"
    >
      <h2 className="text-xl md:text-2xl font-bold text-cream-100 mb-4 md:mb-6 flex items-center gap-2">
        <Trophy className="w-5 h-5 md:w-6 md:h-6 text-gold-500" />
        Circuit Standings
      </h2>

      <div className="overflow-x-auto -mx-6 px-6 md:mx-0 md:px-0">
        <table className="w-full">
          <thead>
            <tr className="border-b border-cream-500/20">
              <th className="text-left py-3 px-2 md:px-4 text-xs md:text-sm font-semibold text-cream-500/60">Rank</th>
              <th className="text-left py-3 px-2 md:px-4 text-xs md:text-sm font-semibold text-cream-500/60">Director</th>
              <th className="text-center py-3 px-2 md:px-4 text-xs md:text-sm font-semibold text-cream-500/60">
                <span className="hidden md:inline">Circuit</span> Pts
              </th>
              <th className="text-center py-3 px-2 md:px-4 text-xs md:text-sm font-semibold text-cream-500/60">Medals</th>
              <th className="text-center py-3 px-2 md:px-4 text-xs md:text-sm font-semibold text-cream-500/60 hidden md:table-cell">Stops</th>
              <th className="text-center py-3 px-2 md:px-4 text-xs md:text-sm font-semibold text-cream-500/60 hidden lg:table-cell">High</th>
              <th className="text-center py-3 px-2 md:px-4 text-xs md:text-sm font-semibold text-cream-500/60">
                <span className="hidden md:inline">Season</span> Total
              </th>
            </tr>
          </thead>
          <tbody>
            {memberData.map((member, index) => {
              const isFinalsSpot = index < (league.settings?.finalsSize || 12);

              return (
                <tr
                  key={member.uid}
                  className={`border-b border-cream-500/10 hover:bg-cream-500/5 ${
                    isFinalsSpot ? 'bg-green-500/5' : ''
                  }`}
                >
                  <td className="py-3 px-2 md:px-4">
                    <div className="flex items-center gap-1 md:gap-2">
                      <span className="text-base md:text-lg font-bold text-cream-100">{index + 1}</span>
                      {index === 0 && <Crown className="w-4 h-4 text-gold-500" />}
                    </div>
                  </td>
                  <td className="py-3 px-2 md:px-4">
                    <div>
                      <span className="font-semibold text-cream-100 text-sm md:text-base">{member.displayName}</span>
                      <p className="text-xs text-cream-500/60 hidden md:block">{member.corpsName}</p>
                    </div>
                  </td>
                  <td className="text-center py-3 px-2 md:px-4">
                    <span className="text-base md:text-lg font-bold text-gold-500">{member.circuitPoints}</span>
                  </td>
                  <td className="text-center py-3 px-2 md:px-4">
                    <div className="flex items-center justify-center gap-0.5 md:gap-1">
                      {member.medals.gold > 0 && (
                        <div className="flex items-center gap-0.5 px-1 md:px-1.5 py-0.5 bg-yellow-500/20 rounded text-xs">
                          <Medal className="w-3 h-3 text-yellow-500" />
                          <span className="text-yellow-500 font-bold">{member.medals.gold}</span>
                        </div>
                      )}
                      {member.medals.silver > 0 && (
                        <div className="flex items-center gap-0.5 px-1 md:px-1.5 py-0.5 bg-gray-400/20 rounded text-xs">
                          <Medal className="w-3 h-3 text-gray-400" />
                          <span className="text-gray-400 font-bold">{member.medals.silver}</span>
                        </div>
                      )}
                      {member.medals.bronze > 0 && (
                        <div className="flex items-center gap-0.5 px-1 md:px-1.5 py-0.5 bg-orange-600/20 rounded text-xs">
                          <Medal className="w-3 h-3 text-orange-600" />
                          <span className="text-orange-600 font-bold">{member.medals.bronze}</span>
                        </div>
                      )}
                      {member.medals.gold === 0 && member.medals.silver === 0 && member.medals.bronze === 0 && (
                        <span className="text-cream-500/40 text-xs">—</span>
                      )}
                    </div>
                  </td>
                  <td className="text-center py-3 px-2 md:px-4 text-cream-100 hidden md:table-cell">
                    {member.tourStops}
                  </td>
                  <td className="text-center py-3 px-2 md:px-4 text-cream-100 hidden lg:table-cell">
                    {member.seasonHighScore > 0 ? member.seasonHighScore.toFixed(1) : '—'}
                  </td>
                  <td className="text-center py-3 px-2 md:px-4 text-cream-100 font-bold text-sm md:text-base">
                    {member.totalSeasonScore.toFixed(1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {league.settings?.finalsSize && (
        <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
          <p className="text-sm text-green-400">
            <Star className="w-4 h-4 inline mr-1" />
            Top {league.settings.finalsSize || 12} directors advance to League Finals
          </p>
        </div>
      )}

      {/* Scoring Legend */}
      <div className="mt-6 p-4 bg-charcoal-900/50 rounded-lg">
        <h4 className="text-sm font-semibold text-cream-300 mb-2">Circuit Points per Tour Stop</h4>
        <div className="flex flex-wrap gap-2 text-xs text-cream-500/60">
          <span className="px-2 py-1 bg-gold-500/20 rounded text-gold-500">1st: 15 pts</span>
          <span className="px-2 py-1 bg-gray-400/20 rounded text-gray-400">2nd: 12 pts</span>
          <span className="px-2 py-1 bg-orange-600/20 rounded text-orange-600">3rd: 10 pts</span>
          <span className="px-2 py-1 bg-cream-500/10 rounded">4th: 8 pts</span>
          <span className="px-2 py-1 bg-cream-500/10 rounded">5th: 6 pts</span>
          <span className="px-2 py-1 bg-cream-500/10 rounded">6th+: 5-1 pts</span>
        </div>
      </div>
    </motion.div>
  );
};

export default CircuitStandingsTab;
