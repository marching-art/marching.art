// MatchupsTab - Enhanced Weekly Matchups View with Versus Cards
// Features: Week navigation, live matchups, user's matchup highlighted, rivalry detection

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, Calendar, Radio, Trophy, Clock, Flame, Users } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import VersusCard from '../VersusCard';
import MatchupDetailView from '../MatchupDetailView';

// Generate matchups for demonstration (would be replaced with real data)
const generateMockMatchups = (league, userProfile, memberProfiles, currentWeek) => {
  if (!league?.members?.length || league.members.length < 2) return [];

  const members = league.members;
  const matchups = [];

  // Generate matchups for weeks 1 through current week + 1
  for (let week = 1; week <= Math.min(currentWeek + 1, 12); week++) {
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

const MatchupsTab = ({ league, userProfile, standings = [], memberProfiles = {}, rivalries = [] }) => {
  const [matchups, setMatchups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [selectedMatchup, setSelectedMatchup] = useState(null);
  const [currentWeek, setCurrentWeek] = useState(1);

  // Check if matchup is a rivalry
  const isRivalryMatchup = (matchup) => {
    if (!userProfile?.uid || !rivalries.length) return false;
    const opponentId = matchup.homeUserId === userProfile.uid
      ? matchup.awayUserId
      : matchup.awayUserId === userProfile.uid
        ? matchup.homeUserId
        : null;
    return opponentId ? rivalries.some(r => r.rivalId === opponentId) : false;
  };

  // Fetch member profiles and matchups
  useEffect(() => {
    const fetchData = async () => {
      if (!league?.members?.length) {
        setLoading(false);
        return;
      }

      try {
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
        const mockMatchups = generateMockMatchups(league, userProfile, memberProfiles, week);
        setMatchups(mockMatchups);

      } catch (error) {
        console.error('Error fetching matchups:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [league, userProfile, memberProfiles]);

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

  // Other matchups (not involving user)
  const otherMatchups = useMemo(() => {
    return weekMatchups.filter(m =>
      m.homeUserId !== userProfile?.uid && m.awayUserId !== userProfile?.uid
    );
  }, [weekMatchups, userProfile?.uid]);

  // Get all user's matchups across all weeks for record calculation
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
  const getUserInfo = (userId) => {
    const profile = memberProfiles[userId];
    const standing = standings.find(s => s.uid === userId);
    return {
      uid: userId,
      displayName: profile?.displayName || profile?.username || `User ${userId?.slice(0, 6)}`,
      corpsName: profile?.corps ? Object.values(profile.corps).find(c => c.corpsName)?.corpsName : 'Unknown Corps',
      record: standing ? { wins: standing.wins || 0, losses: standing.losses || 0 } : { wins: 0, losses: 0 },
      avgScore: standing?.totalPoints ? standing.totalPoints / (standing.wins + standing.losses || 1) : 0,
    };
  };

  // Handle matchup click
  const handleMatchupClick = (matchup) => {
    setSelectedMatchup({
      user1: matchup.homeUserId,
      user2: matchup.awayUserId,
      week: matchup.week,
      status: matchup.status,
      isUserMatchup: matchup.homeUserId === userProfile?.uid || matchup.awayUserId === userProfile?.uid,
    });
  };

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#1a1a1a] border border-[#333] rounded-sm p-8 text-center"
      >
        <Swords className="w-12 h-12 text-gray-500 mx-auto mb-4 animate-pulse" />
        <p className="text-gray-500">Loading matchups...</p>
      </motion.div>
    );
  }

  // Show matchup detail if one is selected
  if (selectedMatchup) {
    return (
      <MatchupDetailView
        matchup={selectedMatchup}
        league={league}
        userProfile={userProfile}
        memberProfiles={memberProfiles}
        standings={standings}
        currentWeek={currentWeek}
        onBack={() => setSelectedMatchup(null)}
        rivalry={isRivalryMatchup(selectedMatchup) ? rivalries.find(r =>
          r.rivalId === (selectedMatchup.user1 === userProfile?.uid ? selectedMatchup.user2 : selectedMatchup.user1)
        ) : null}
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
      <div className="bg-[#1a1a1a] border border-[#333] rounded-sm p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-sm bg-purple-500/20 flex items-center justify-center">
              <Swords className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Your Record</h3>
              <p className="text-sm text-gray-500">Season {currentWeek > 1 ? `Week ${currentWeek}` : 'Start'}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold tabular-nums">
              <span className="text-green-500">{record.wins}</span>
              <span className="text-gray-600"> - </span>
              <span className="text-red-500">{record.losses}</span>
            </p>
            <p className="text-xs text-gray-500">W-L</p>
          </div>
        </div>
      </div>

      {/* Week Selector */}
      <div className="bg-[#1a1a1a] border border-[#333] rounded-sm p-4">
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-yellow-500" />
          Weekly Schedule
        </h3>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {Array.from({ length: 12 }, (_, i) => i + 1).map(week => {
            const hasMatchups = matchups.some(m => m.week === week);
            const isCurrentWeek = week === currentWeek;
            const isSelected = selectedWeek === week;
            const isPast = week < currentWeek;
            const hasLive = matchups.some(m => m.week === week && m.status === 'live');

            return (
              <button
                key={week}
                onClick={() => setSelectedWeek(week)}
                className={`flex-shrink-0 px-4 py-2 rounded-sm font-bold transition-all relative min-w-[72px] ${
                  isSelected
                    ? 'bg-yellow-500 text-black'
                    : isCurrentWeek
                    ? 'bg-[#222] border-2 border-purple-500/50 text-white hover:bg-purple-500/10'
                    : hasMatchups
                    ? 'bg-[#222] border border-[#444] text-white hover:bg-[#333]'
                    : 'bg-[#222] border border-[#333] text-gray-600'
                }`}
              >
                <span className="text-sm">Week {week}</span>
                {hasLive && !isSelected && (
                  <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                  </span>
                )}
                {isCurrentWeek && !hasLive && !isSelected && (
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

      {/* User's Matchup - Featured */}
      {userMatchup && (
        <div>
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
            {userMatchup.status === 'live' && (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-red-500/20 text-red-500 text-xs font-bold">
                <Radio className="w-3 h-3 animate-pulse" />
                LIVE
              </span>
            )}
            Your Matchup
          </h3>
          <VersusCard
            matchup={userMatchup}
            user1={getUserInfo(userMatchup.homeUserId)}
            user2={getUserInfo(userMatchup.awayUserId)}
            user1Score={userMatchup.homeScore}
            user2Score={userMatchup.awayScore}
            user1Record={getUserInfo(userMatchup.homeUserId).record}
            user2Record={getUserInfo(userMatchup.awayUserId).record}
            user1AvgScore={getUserInfo(userMatchup.homeUserId).avgScore}
            user2AvgScore={getUserInfo(userMatchup.awayUserId).avgScore}
            isLive={userMatchup.status === 'live'}
            isCompleted={userMatchup.status === 'completed'}
            isUserMatchup={true}
            isRivalry={isRivalryMatchup(userMatchup)}
            currentUserId={userProfile?.uid}
            week={userMatchup.week}
            onClick={() => handleMatchupClick(userMatchup)}
          />
        </div>
      )}

      {/* Other Matchups */}
      {otherMatchups.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Users className="w-4 h-4" />
            Other Matchups ({otherMatchups.length})
          </h3>
          <div className="space-y-3">
            {otherMatchups.map(matchup => (
              <VersusCard
                key={matchup.id}
                matchup={matchup}
                user1={getUserInfo(matchup.homeUserId)}
                user2={getUserInfo(matchup.awayUserId)}
                user1Score={matchup.homeScore}
                user2Score={matchup.awayScore}
                user1Record={getUserInfo(matchup.homeUserId).record}
                user2Record={getUserInfo(matchup.awayUserId).record}
                isLive={matchup.status === 'live'}
                isCompleted={matchup.status === 'completed'}
                isUserMatchup={false}
                currentUserId={userProfile?.uid}
                week={matchup.week}
                onClick={() => handleMatchupClick(matchup)}
                compact={true}
              />
            ))}
          </div>
        </div>
      )}

      {weekMatchups.length === 0 && (
        <div className="bg-[#1a1a1a] border border-[#333] rounded-sm p-8 text-center">
          <Clock className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-white mb-2">No Matchups Yet</h3>
          <p className="text-gray-500">
            Week {selectedWeek} matchups will be available soon
          </p>
        </div>
      )}

      {/* Past Results Quick View */}
      {selectedWeek === currentWeek && userMatchups.filter(m => m.status === 'completed').length > 0 && (
        <div className="bg-[#1a1a1a] border border-[#333] rounded-sm p-4">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-yellow-500" />
            Recent Results
          </h3>
          <div className="space-y-2">
            {userMatchups
              .filter(m => m.status === 'completed')
              .sort((a, b) => b.week - a.week)
              .slice(0, 3)
              .map(matchup => {
                const won = matchup.winnerId === userProfile?.uid;
                const isHome = matchup.homeUserId === userProfile?.uid;
                const opponent = getUserInfo(isHome ? matchup.awayUserId : matchup.homeUserId);
                const userScore = isHome ? matchup.homeScore : matchup.awayScore;
                const oppScore = isHome ? matchup.awayScore : matchup.homeScore;

                return (
                  <div
                    key={matchup.id}
                    onClick={() => handleMatchupClick(matchup)}
                    className={`flex items-center justify-between p-3 rounded-sm cursor-pointer transition-all ${
                      won
                        ? 'bg-green-500/10 border border-green-500/20 hover:border-green-500/40'
                        : 'bg-red-500/10 border border-red-500/20 hover:border-red-500/40'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-sm flex items-center justify-center ${
                        won ? 'bg-green-500/20' : 'bg-red-500/20'
                      }`}>
                        <span className={`text-xs font-bold ${won ? 'text-green-500' : 'text-red-500'}`}>
                          {won ? 'W' : 'L'}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">
                          vs @{opponent.displayName}
                        </p>
                        <p className="text-xs text-gray-500">Week {matchup.week}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`font-bold ${won ? 'text-green-500' : 'text-gray-400'}`}>
                        {userScore.toFixed(1)}
                      </span>
                      <span className="text-gray-600 mx-1">-</span>
                      <span className={`font-bold ${!won ? 'text-green-500' : 'text-gray-400'}`}>
                        {oppScore.toFixed(1)}
                      </span>
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
