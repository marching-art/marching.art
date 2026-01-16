// HistoryTab - Past week matchup results and activity feed
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  History, Calendar, Trophy, CheckCircle, XCircle,
  ChevronDown, ChevronUp, Swords
} from 'lucide-react';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase';

const HistoryTab = ({
  league,
  weeklyMatchups,
  standings,
  memberProfiles,
  userProfile,
  currentWeek
}) => {
  const [weekResults, setWeekResults] = useState({});
  const [expandedWeek, setExpandedWeek] = useState(null);
  const [loading, setLoading] = useState(true);

  // Helper to get display name
  const getDisplayName = (uid) => {
    if (uid === userProfile?.uid) return 'You';
    const profile = memberProfiles?.[uid];
    return profile?.displayName || profile?.username || `Director ${uid?.slice(0, 6)}`;
  };

  // Fetch historical results
  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const seasonRef = doc(db, 'game-settings/season');
        const seasonDoc = await getDoc(seasonRef);

        if (seasonDoc.exists()) {
          const sData = seasonDoc.data();
          // OPTIMIZATION: Read from subcollection instead of single large document
          const recapsCollectionRef = collection(db, 'fantasy_recaps', sData.seasonUid, 'days');
          const recapsSnapshot = await getDocs(recapsCollectionRef);

          if (!recapsSnapshot.empty) {
            const recaps = recapsSnapshot.docs.map(d => d.data());
            const memberUids = new Set(league.members);
            const results = {};

            // Calculate weekly scores
            recaps.forEach(dayRecap => {
              const weekNum = Math.ceil(dayRecap.offSeasonDay / 7);
              if (!results[weekNum]) {
                results[weekNum] = {};
              }

              dayRecap.shows?.forEach(show => {
                show.results?.forEach(result => {
                  if (memberUids.has(result.uid)) {
                    if (!results[weekNum][result.uid]) {
                      results[weekNum][result.uid] = 0;
                    }
                    results[weekNum][result.uid] += result.totalScore || 0;
                  }
                });
              });
            });

            setWeekResults(results);
          }
        }
      } catch (error) {
        console.error('Error fetching history:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [league]);

  // Get weeks with completed matchups
  const completedWeeks = Object.keys(weeklyMatchups)
    .map(Number)
    .filter(w => w < currentWeek)
    .sort((a, b) => b - a);

  // Determine matchup result
  const getMatchupResult = (matchup, weekNum) => {
    const scores = weekResults[weekNum] || {};
    const score1 = scores[matchup.user1] || 0;
    const score2 = scores[matchup.user2] || 0;

    if (score1 === 0 && score2 === 0) return 'pending';
    if (score1 > score2) return { winner: matchup.user1, loser: matchup.user2, winScore: score1, loseScore: score2 };
    if (score2 > score1) return { winner: matchup.user2, loser: matchup.user1, winScore: score2, loseScore: score1 };
    return 'tie';
  };

  // Get user's record for a specific week
  const getUserWeekResult = (weekNum) => {
    const matchups = weeklyMatchups[weekNum] || [];
    const userMatchup = matchups.find(m =>
      m.user1 === userProfile?.uid || m.user2 === userProfile?.uid
    );

    if (!userMatchup) return null;

    const result = getMatchupResult(userMatchup, weekNum);
    if (result === 'pending' || result === 'tie') return result;

    return result.winner === userProfile?.uid ? 'win' : 'loss';
  };

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-sm p-8 text-center"
      >
        <p className="text-cream-500/60">Loading history...</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-4"
    >
      {/* Summary Card */}
      <div className="glass rounded-sm p-4">
        <h3 className="font-display font-bold text-cream-100 flex items-center gap-2 mb-4">
          <History className="w-5 h-5 text-gold-500" />
          Season History
        </h3>

        {/* Your Season Record */}
        {userProfile && (
          <div className="flex items-center gap-4 p-3 bg-charcoal-900/30 rounded-sm">
            <div className="flex-1">
              <p className="text-xs text-cream-500/60 mb-1">Your Season</p>
              <div className="flex items-center gap-2">
                {completedWeeks.map(week => {
                  const result = getUserWeekResult(week);
                  return (
                    <div
                      key={week}
                      title={`Week ${week}`}
                      className={`w-6 h-6 rounded-sm flex items-center justify-center text-xs font-bold ${
                        result === 'win'
                          ? 'bg-green-500/20 text-green-400'
                          : result === 'loss'
                          ? 'bg-red-500/20 text-red-400'
                          : result === 'tie'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-cream-500/10 text-cream-500/30'
                      }`}
                    >
                      {result === 'win' ? 'W' : result === 'loss' ? 'L' : result === 'tie' ? 'T' : '-'}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Current Streak */}
            {standings.find(s => s.uid === userProfile.uid)?.streak > 0 && (
              <div className="text-right">
                <p className="text-xs text-cream-500/60">Streak</p>
                <p className={`font-display font-bold ${
                  standings.find(s => s.uid === userProfile.uid)?.streakType === 'W'
                    ? 'text-green-400'
                    : 'text-red-400'
                }`}>
                  {standings.find(s => s.uid === userProfile.uid)?.streakType}
                  {standings.find(s => s.uid === userProfile.uid)?.streak}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Week by Week Results */}
      {completedWeeks.length === 0 ? (
        <div className="glass rounded-sm p-8 text-center">
          <Calendar className="w-12 h-12 text-cream-500/20 mx-auto mb-3" />
          <p className="text-cream-500/60 font-display">No completed weeks yet</p>
          <p className="text-xs text-cream-500/40 mt-1">
            Results will appear after each week
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {completedWeeks.map(weekNum => {
            const matchups = weeklyMatchups[weekNum] || [];
            const isExpanded = expandedWeek === weekNum;
            const userResult = getUserWeekResult(weekNum);

            return (
              <motion.div
                key={weekNum}
                className="glass rounded-sm overflow-hidden"
              >
                {/* Week Header */}
                <button
                  onClick={() => setExpandedWeek(isExpanded ? null : weekNum)}
                  className="w-full p-4 flex items-center justify-between hover:bg-cream-500/5 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-sm bg-charcoal-800 flex items-center justify-center">
                      <span className="font-display font-bold text-cream-100">{weekNum}</span>
                    </div>
                    <div className="text-left">
                      <p className="font-display font-semibold text-cream-100">
                        Week {weekNum}
                      </p>
                      <p className="text-xs text-cream-500/40">
                        {matchups.length} matchups
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* User's result badge */}
                    {userResult && userResult !== 'pending' && (
                      <div className={`px-3 py-1 rounded-sm text-xs font-display font-bold ${
                        userResult === 'win'
                          ? 'bg-green-500/20 text-green-400'
                          : userResult === 'loss'
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {userResult === 'win' ? 'WIN' : userResult === 'loss' ? 'LOSS' : 'TIE'}
                      </div>
                    )}

                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-cream-500/40" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-cream-500/40" />
                    )}
                  </div>
                </button>

                {/* Expanded Matchups */}
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="border-t border-cream-500/10"
                  >
                    {matchups.map((matchup, idx) => {
                      const result = getMatchupResult(matchup, weekNum);
                      const isUserMatchup =
                        matchup.user1 === userProfile?.uid || matchup.user2 === userProfile?.uid;

                      return (
                        <div
                          key={idx}
                          className={`p-4 border-b border-cream-500/5 last:border-b-0 ${
                            isUserMatchup ? 'bg-purple-500/5' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            {/* User 1 */}
                            <div className="flex items-center gap-2 flex-1">
                              <div className={`w-8 h-8 rounded-sm flex items-center justify-center ${
                                result !== 'pending' && result !== 'tie' && result.winner === matchup.user1
                                  ? 'bg-green-500/20 border border-green-500/50'
                                  : 'bg-charcoal-800'
                              }`}>
                                {result !== 'pending' && result !== 'tie' && result.winner === matchup.user1 ? (
                                  <CheckCircle className="w-4 h-4 text-green-400" />
                                ) : result !== 'pending' && result !== 'tie' && result.loser === matchup.user1 ? (
                                  <XCircle className="w-4 h-4 text-red-400" />
                                ) : (
                                  <span className="text-xs font-bold text-cream-500/60">
                                    {getDisplayName(matchup.user1).charAt(0)}
                                  </span>
                                )}
                              </div>
                              <div>
                                <p className={`text-sm font-display ${
                                  matchup.user1 === userProfile?.uid ? 'text-purple-400' : 'text-cream-100'
                                }`}>
                                  {getDisplayName(matchup.user1)}
                                </p>
                                <p className="text-xs text-cream-500/40">
                                  {weekResults[weekNum]?.[matchup.user1]?.toFixed(1) || '0.0'} pts
                                </p>
                              </div>
                            </div>

                            {/* VS */}
                            <div className="px-3">
                              <Swords className="w-4 h-4 text-cream-500/30" />
                            </div>

                            {/* User 2 */}
                            <div className="flex items-center gap-2 flex-1 justify-end">
                              <div className="text-right">
                                <p className={`text-sm font-display ${
                                  matchup.user2 === userProfile?.uid ? 'text-purple-400' : 'text-cream-100'
                                }`}>
                                  {getDisplayName(matchup.user2)}
                                </p>
                                <p className="text-xs text-cream-500/40">
                                  {weekResults[weekNum]?.[matchup.user2]?.toFixed(1) || '0.0'} pts
                                </p>
                              </div>
                              <div className={`w-8 h-8 rounded-sm flex items-center justify-center ${
                                result !== 'pending' && result !== 'tie' && result.winner === matchup.user2
                                  ? 'bg-green-500/20 border border-green-500/50'
                                  : 'bg-charcoal-800'
                              }`}>
                                {result !== 'pending' && result !== 'tie' && result.winner === matchup.user2 ? (
                                  <CheckCircle className="w-4 h-4 text-green-400" />
                                ) : result !== 'pending' && result !== 'tie' && result.loser === matchup.user2 ? (
                                  <XCircle className="w-4 h-4 text-red-400" />
                                ) : (
                                  <span className="text-xs font-bold text-cream-500/60">
                                    {getDisplayName(matchup.user2).charAt(0)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};

export default HistoryTab;
