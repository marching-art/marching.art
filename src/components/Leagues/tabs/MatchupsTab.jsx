// MatchupsTab - Weekly matchups view for league members
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, Calendar, Radio, Trophy, ChevronRight, Users, Clock } from 'lucide-react';
import { doc, getDoc, collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../../firebase';
import MatchupCard from '../MatchupCard';
import MatchupDetail from '../MatchupDetail';

// Generate mock matchups for demonstration
const generateMockMatchups = (league, userProfile, memberProfiles, currentWeek) => {
  if (!league?.members?.length || league.members.length < 2) return [];

  const members = league.members;
  const matchups = [];

  // Generate matchups for weeks 1 through current week + 1
  for (let week = 1; week <= Math.min(currentWeek + 1, 7); week++) {
    // Create pairings for this week
    const weekMembers = [...members];

    // Shuffle for variety (deterministic based on week for consistency)
    const seed = week * 31;
    weekMembers.sort((a, b) => {
      const hashA = (a.charCodeAt(0) + seed) % 100;
      const hashB = (b.charCodeAt(0) + seed) % 100;
      return hashA - hashB;
    });

    // Pair up members
    for (let i = 0; i < weekMembers.length - 1; i += 2) {
      const homeUserId = weekMembers[i];
      const awayUserId = weekMembers[i + 1];

      // Determine status based on week
      let status = 'scheduled';
      if (week < currentWeek) status = 'completed';
      else if (week === currentWeek) status = 'live';

      // Generate scores for completed/live matchups
      const baseHome = 800 + Math.random() * 100;
      const baseAway = 800 + Math.random() * 100;

      const matchup = {
        id: `${league.id}-w${week}-${i}`,
        leagueId: league.id,
        week,
        status,
        homeUserId,
        awayUserId,
        homeScore: status !== 'scheduled' ? baseHome : 0,
        awayScore: status !== 'scheduled' ? baseAway : 0,
        homeCaptions: status !== 'scheduled' ? {
          GE1: 18 + Math.random() * 2,
          GE2: 18 + Math.random() * 2,
          VP: 16 + Math.random() * 2,
          VA: 17 + Math.random() * 2,
          CG: 17 + Math.random() * 2,
          B: 18 + Math.random() * 2,
          MA: 17 + Math.random() * 2,
          P: 18 + Math.random() * 2
        } : null,
        awayCaptions: status !== 'scheduled' ? {
          GE1: 18 + Math.random() * 2,
          GE2: 18 + Math.random() * 2,
          VP: 16 + Math.random() * 2,
          VA: 17 + Math.random() * 2,
          CG: 17 + Math.random() * 2,
          B: 18 + Math.random() * 2,
          MA: 17 + Math.random() * 2,
          P: 18 + Math.random() * 2
        } : null,
        createdAt: new Date()
      };

      // Set winner for completed matchups
      if (status === 'completed') {
        matchup.winnerId = matchup.homeScore > matchup.awayScore ? homeUserId : awayUserId;
        matchup.margin = Math.abs(matchup.homeScore - matchup.awayScore);
      }

      matchups.push(matchup);
    }
  }

  return matchups;
};

const MatchupsTab = ({ league, userProfile }) => {
  const [matchups, setMatchups] = useState([]);
  const [memberProfiles, setMemberProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [selectedMatchup, setSelectedMatchup] = useState(null);
  const [currentWeek, setCurrentWeek] = useState(1);

  // Fetch member profiles and matchups
  useEffect(() => {
    const fetchData = async () => {
      if (!league?.members?.length) {
        setLoading(false);
        return;
      }

      try {
        // Fetch member profiles
        const profiles = {};
        await Promise.all(league.members.map(async (uid) => {
          const profileRef = doc(db, `artifacts/marching-art/users/${uid}/profile/data`);
          const profileDoc = await getDoc(profileRef);
          if (profileDoc.exists()) {
            const data = profileDoc.data();
            profiles[uid] = {
              uid,
              displayName: data.displayName || data.username || `User ${uid.slice(0, 6)}`,
              corpsName: data.corps ? Object.values(data.corps).find(c => c.corpsName)?.corpsName : 'Unknown Corps'
            };
          } else {
            profiles[uid] = {
              uid,
              displayName: `User ${uid.slice(0, 6)}`,
              corpsName: 'Unknown Corps'
            };
          }
        }));
        setMemberProfiles(profiles);

        // Fetch season data to get current week
        const seasonRef = doc(db, 'game-settings/season');
        const seasonDoc = await getDoc(seasonRef);

        let week = 1;
        if (seasonDoc.exists()) {
          const sData = seasonDoc.data();
          const startDate = sData.schedule?.startDate?.toDate();
          if (startDate) {
            const now = new Date();
            const diffInDays = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
            week = Math.max(1, Math.ceil((diffInDays + 1) / 7));
          }
        }
        setCurrentWeek(week);
        setSelectedWeek(week);

        // Generate mock matchups (replace with real data in production)
        const mockMatchups = generateMockMatchups(league, userProfile, profiles, week);
        setMatchups(mockMatchups);

      } catch (error) {
        console.error('Error fetching matchups:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [league, userProfile]);

  // Get matchups for selected week
  const weekMatchups = useMemo(() => {
    return matchups.filter(m => m.week === selectedWeek);
  }, [matchups, selectedWeek]);

  // Get user's matchup for selected week
  const userMatchup = useMemo(() => {
    return weekMatchups.find(m =>
      m.homeUserId === userProfile?.uid || m.awayUserId === userProfile?.uid
    );
  }, [weekMatchups, userProfile?.uid]);

  // Get all user's matchups across all weeks
  const userMatchups = useMemo(() => {
    return matchups.filter(m =>
      m.homeUserId === userProfile?.uid || m.awayUserId === userProfile?.uid
    );
  }, [matchups, userProfile?.uid]);

  // Calculate record
  const record = useMemo(() => {
    const completed = userMatchups.filter(m => m.status === 'completed');
    const wins = completed.filter(m => m.winnerId === userProfile?.uid).length;
    const losses = completed.length - wins;
    return { wins, losses };
  }, [userMatchups, userProfile?.uid]);

  // Get user info for a matchup participant
  const getUserInfo = (userId) => memberProfiles[userId] || {
    uid: userId,
    displayName: `User ${userId?.slice(0, 6)}`,
    corpsName: 'Unknown Corps'
  };

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-8 text-center"
      >
        <Swords className="w-12 h-12 text-cream-500/40 mx-auto mb-4 animate-pulse" />
        <p className="text-cream-500/60">Loading matchups...</p>
      </motion.div>
    );
  }

  // Show matchup detail if one is selected
  if (selectedMatchup) {
    return (
      <MatchupDetail
        matchup={selectedMatchup}
        league={league}
        currentUserId={userProfile?.uid}
        homeUser={getUserInfo(selectedMatchup.homeUserId)}
        awayUser={getUserInfo(selectedMatchup.awayUserId)}
        onBack={() => setSelectedMatchup(null)}
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-4"
    >
      {/* Your Record Summary */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <Swords className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-cream-100">Your Record</h3>
              <p className="text-sm text-cream-500/60">Season {currentWeek > 1 ? `Week ${currentWeek}` : 'Start'}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-display font-bold">
              <span className="text-green-400">{record.wins}</span>
              <span className="text-cream-500/40"> - </span>
              <span className="text-red-400">{record.losses}</span>
            </p>
            <p className="text-xs text-cream-500/60">W-L</p>
          </div>
        </div>
      </div>

      {/* This Week's Matchup (Highlighted) */}
      {userMatchup && selectedWeek === currentWeek && (
        <div className="card p-4 border-2 border-purple-500/40 bg-gradient-to-br from-purple-500/10 to-charcoal-900">
          <div className="flex items-center gap-2 mb-3">
            {userMatchup.status === 'live' && (
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
              </span>
            )}
            <h3 className="text-sm font-display font-semibold text-cream-400 uppercase tracking-wide">
              {userMatchup.status === 'live' ? 'Live Matchup' : 'This Week'}
            </h3>
          </div>
          <MatchupCard
            matchup={userMatchup}
            currentUserId={userProfile?.uid}
            homeUser={getUserInfo(userMatchup.homeUserId)}
            awayUser={getUserInfo(userMatchup.awayUserId)}
            onClick={() => setSelectedMatchup(userMatchup)}
          />
        </div>
      )}

      {/* Week Selector */}
      <div className="card p-4">
        <h3 className="text-lg font-bold text-cream-100 mb-3 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-gold-500" />
          Weekly Schedule
        </h3>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[1, 2, 3, 4, 5, 6, 7].map(week => {
            const hasMatchups = matchups.some(m => m.week === week);
            const isCurrentWeek = week === currentWeek;
            const isSelected = selectedWeek === week;
            const isPast = week < currentWeek;

            return (
              <button
                key={week}
                onClick={() => setSelectedWeek(week)}
                className={`flex-shrink-0 px-4 py-2 rounded-lg font-semibold transition-all relative ${
                  isSelected
                    ? 'bg-gold-500 text-charcoal-900'
                    : isCurrentWeek
                    ? 'glass text-cream-100 border-2 border-purple-500/50 hover:bg-purple-500/10'
                    : hasMatchups
                    ? 'glass text-cream-100 hover:bg-cream-500/10'
                    : 'glass text-cream-500/40'
                }`}
              >
                <span className="text-sm">Week {week}</span>
                {isCurrentWeek && !isSelected && (
                  <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-purple-500" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Week Matchups */}
      {weekMatchups.length > 0 ? (
        <div className="card p-4">
          <h3 className="text-lg font-bold text-cream-100 mb-4 flex items-center gap-2">
            <Swords className="w-5 h-5 text-purple-400" />
            Week {selectedWeek} Matchups
            {selectedWeek === currentWeek && weekMatchups.some(m => m.status === 'live') && (
              <span className="ml-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs font-semibold">
                <Radio className="w-3 h-3" />
                LIVE
              </span>
            )}
          </h3>

          <div className="space-y-3">
            {weekMatchups.map(matchup => {
              const isUserMatchup = matchup.homeUserId === userProfile?.uid || matchup.awayUserId === userProfile?.uid;

              return (
                <div
                  key={matchup.id}
                  className={isUserMatchup ? 'ring-2 ring-purple-500/30 rounded-xl' : ''}
                >
                  <MatchupCard
                    matchup={matchup}
                    currentUserId={userProfile?.uid}
                    homeUser={getUserInfo(matchup.homeUserId)}
                    awayUser={getUserInfo(matchup.awayUserId)}
                    onClick={() => setSelectedMatchup(matchup)}
                    compact={!isUserMatchup}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="card p-8 text-center">
          <Clock className="w-12 h-12 text-cream-500/40 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-cream-100 mb-2">No Matchups Yet</h3>
          <p className="text-cream-500/60">
            Week {selectedWeek} matchups will be available soon
          </p>
        </div>
      )}

      {/* Past Results Summary */}
      {selectedWeek === currentWeek && userMatchups.filter(m => m.status === 'completed').length > 0 && (
        <div className="card p-4">
          <h3 className="text-lg font-bold text-cream-100 mb-3 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-gold-500" />
            Your Past Results
          </h3>
          <div className="space-y-2">
            {userMatchups
              .filter(m => m.status === 'completed')
              .sort((a, b) => b.week - a.week)
              .slice(0, 5)
              .map(matchup => {
                const won = matchup.winnerId === userProfile?.uid;
                const isHome = matchup.homeUserId === userProfile?.uid;
                const opponent = getUserInfo(isHome ? matchup.awayUserId : matchup.homeUserId);
                const userScore = isHome ? matchup.homeScore : matchup.awayScore;
                const oppScore = isHome ? matchup.awayScore : matchup.homeScore;

                return (
                  <div
                    key={matchup.id}
                    onClick={() => setSelectedMatchup(matchup)}
                    className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all ${
                      won
                        ? 'bg-green-500/10 border border-green-500/20 hover:border-green-500/40'
                        : 'bg-red-500/10 border border-red-500/20 hover:border-red-500/40'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        won ? 'bg-green-500/20' : 'bg-red-500/20'
                      }`}>
                        <span className={`text-xs font-bold ${won ? 'text-green-400' : 'text-red-400'}`}>
                          {won ? 'W' : 'L'}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-cream-100">
                          vs @{opponent.displayName}
                        </p>
                        <p className="text-xs text-cream-500/60">Week {matchup.week}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold ${won ? 'text-green-400' : 'text-cream-400'}`}>
                        {userScore.toFixed(1)}
                      </span>
                      <span className="text-cream-500/40">-</span>
                      <span className={`font-bold ${!won ? 'text-green-400' : 'text-cream-400'}`}>
                        {oppScore.toFixed(1)}
                      </span>
                      <ChevronRight className="w-4 h-4 text-cream-500/40 ml-2" />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default MatchupsTab;
