// MatchupsTab - Versus Strips with LIVE badges
// Design System: Compact strips, inline scores, week navigation

import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Swords, Calendar, Radio, Flame, ChevronLeft, ChevronRight } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import MatchupDetailView from '../MatchupDetailView';

// Generate matchups for demonstration
const generateMockMatchups = (league, userProfile, memberProfiles, currentWeek) => {
  if (!league?.members?.length || league.members.length < 2) return [];

  const members = league.members;
  const matchups = [];

  for (let week = 1; week <= Math.min(currentWeek + 1, 12); week++) {
    const weekMembers = [...members];
    const seed = week * 31;
    weekMembers.sort((a, b) => {
      const hashA = (a.charCodeAt(0) + seed) % 100;
      const hashB = (b.charCodeAt(0) + seed) % 100;
      return hashA - hashB;
    });

    for (let i = 0; i < weekMembers.length - 1; i += 2) {
      const homeUserId = weekMembers[i];
      const awayUserId = weekMembers[i + 1];

      let status = 'scheduled';
      if (week < currentWeek) status = 'completed';
      else if (week === currentWeek) status = 'live';

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
      };

      if (status === 'completed') {
        matchup.winnerId = matchup.homeScore > matchup.awayScore ? homeUserId : awayUserId;
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

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      if (!league?.members?.length) {
        setLoading(false);
        return;
      }

      try {
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

  // Get user's matchup
  const userMatchup = useMemo(() => {
    return weekMatchups.find(m =>
      m.homeUserId === userProfile?.uid || m.awayUserId === userProfile?.uid
    );
  }, [weekMatchups, userProfile?.uid]);

  // Other matchups
  const otherMatchups = useMemo(() => {
    return weekMatchups.filter(m =>
      m.homeUserId !== userProfile?.uid && m.awayUserId !== userProfile?.uid
    );
  }, [weekMatchups, userProfile?.uid]);

  // Get display name
  const getDisplayName = (userId) => {
    if (userId === userProfile?.uid) return 'You';
    const profile = memberProfiles[userId];
    return profile?.displayName || profile?.username || `User ${userId?.slice(0, 6)}`;
  };

  // Get user standing
  const getStanding = (userId) => standings.find(s => s.uid === userId);

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

  // Week navigation
  const goToPrevWeek = () => {
    if (selectedWeek > 1) setSelectedWeek(selectedWeek - 1);
  };

  const goToNextWeek = () => {
    if (selectedWeek < 12) setSelectedWeek(selectedWeek + 1);
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="bg-[#1a1a1a] border border-[#333] p-8 text-center">
          <Swords className="w-8 h-8 text-gray-500 mx-auto mb-2 animate-pulse" />
          <p className="text-gray-500 text-sm">Loading matchups...</p>
        </div>
      </div>
    );
  }

  // Show matchup detail if selected
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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="p-4 space-y-4"
    >
      {/* Week Navigator */}
      <div className="bg-[#1a1a1a] border border-[#333]">
        <div className="px-4 py-3 border-b border-[#333] bg-[#222]">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-yellow-500" />
              Week {selectedWeek}
            </h3>
            <div className="flex items-center gap-1">
              <button
                onClick={goToPrevWeek}
                disabled={selectedWeek <= 1}
                className="p-1 text-gray-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-gray-500 min-w-[60px] text-center">
                {selectedWeek === currentWeek ? 'Current' : selectedWeek < currentWeek ? 'Past' : 'Upcoming'}
              </span>
              <button
                onClick={goToNextWeek}
                disabled={selectedWeek >= 12}
                className="p-1 text-gray-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Week Pills */}
        <div className="p-3 flex gap-1.5 overflow-x-auto scrollbar-hide">
          {Array.from({ length: 12 }, (_, i) => i + 1).map(week => {
            const hasLive = matchups.some(m => m.week === week && m.status === 'live');
            const isSelected = selectedWeek === week;
            const isCurrent = week === currentWeek;

            return (
              <button
                key={week}
                onClick={() => setSelectedWeek(week)}
                className={`flex-shrink-0 px-3 py-1.5 text-xs font-bold transition-all relative ${
                  isSelected
                    ? 'bg-yellow-500 text-black'
                    : isCurrent
                    ? 'bg-[#222] border border-purple-500/50 text-white'
                    : 'bg-[#222] border border-[#333] text-gray-500 hover:text-white hover:border-[#444]'
                }`}
              >
                W{week}
                {hasLive && !isSelected && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-sm animate-pulse" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Your Matchup - Featured Versus Strip */}
      {userMatchup && (
        <div className="bg-[#1a1a1a] border border-[#333]">
          <div className="px-4 py-2 border-b border-[#333] bg-[#222] flex items-center justify-between">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Your Matchup
            </h3>
            {userMatchup.status === 'live' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-500/20 text-red-500 text-[10px] font-bold uppercase">
                <Radio className="w-2.5 h-2.5 animate-pulse" />
                LIVE
              </span>
            )}
          </div>

          <VersusStrip
            matchup={userMatchup}
            getDisplayName={getDisplayName}
            getStanding={getStanding}
            userProfile={userProfile}
            isRivalry={isRivalryMatchup(userMatchup)}
            onClick={() => handleMatchupClick(userMatchup)}
            featured
          />
        </div>
      )}

      {/* Other Matchups */}
      {otherMatchups.length > 0 && (
        <div className="bg-[#1a1a1a] border border-[#333]">
          <div className="px-4 py-2 border-b border-[#333] bg-[#222]">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Other Matchups ({otherMatchups.length})
            </h3>
          </div>

          <div className="divide-y divide-[#222]">
            {otherMatchups.map(matchup => (
              <VersusStrip
                key={matchup.id}
                matchup={matchup}
                getDisplayName={getDisplayName}
                getStanding={getStanding}
                userProfile={userProfile}
                onClick={() => handleMatchupClick(matchup)}
              />
            ))}
          </div>
        </div>
      )}

      {weekMatchups.length === 0 && (
        <div className="bg-[#1a1a1a] border border-[#333] p-8 text-center">
          <Swords className="w-8 h-8 text-gray-500 mx-auto mb-2" />
          <p className="text-sm text-gray-400 mb-1">No matchups for Week {selectedWeek}</p>
          <p className="text-xs text-gray-600">Check back later</p>
        </div>
      )}
    </motion.div>
  );
};

// Versus Strip Component - Compact matchup display
const VersusStrip = ({
  matchup,
  getDisplayName,
  getStanding,
  userProfile,
  isRivalry = false,
  onClick,
  featured = false
}) => {
  const home = {
    name: getDisplayName(matchup.homeUserId),
    standing: getStanding(matchup.homeUserId),
    isUser: matchup.homeUserId === userProfile?.uid,
    score: matchup.homeScore,
  };

  const away = {
    name: getDisplayName(matchup.awayUserId),
    standing: getStanding(matchup.awayUserId),
    isUser: matchup.awayUserId === userProfile?.uid,
    score: matchup.awayScore,
  };

  const homeWon = matchup.status === 'completed' && matchup.winnerId === matchup.homeUserId;
  const awayWon = matchup.status === 'completed' && matchup.winnerId === matchup.awayUserId;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left transition-colors ${
        isRivalry
          ? 'bg-red-500/5 hover:bg-red-500/10'
          : featured
            ? 'bg-purple-500/5 hover:bg-purple-500/10'
            : 'hover:bg-[#222]'
      }`}
    >
      <div className={`px-4 py-3 ${featured ? 'py-4' : ''}`}>
        {/* Rivalry indicator */}
        {isRivalry && (
          <div className="flex items-center gap-1.5 mb-2">
            <Flame className="w-3 h-3 text-red-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-red-500">Rivalry</span>
          </div>
        )}

        <div className="flex items-center gap-3">
          {/* Home */}
          <div className="flex-1 flex items-center gap-2">
            <div className={`w-8 h-8 flex-shrink-0 flex items-center justify-center ${
              home.isUser ? 'bg-purple-500/20 border border-purple-500/50' : 'bg-[#333]'
            }`}>
              <span className={`text-xs font-bold ${home.isUser ? 'text-purple-400' : 'text-gray-400'}`}>
                {home.name.charAt(0)}
              </span>
            </div>
            <div className="min-w-0">
              <p className={`text-sm font-bold truncate ${
                homeWon ? 'text-green-400' : home.isUser ? 'text-purple-400' : 'text-white'
              }`}>
                {home.name}
              </p>
              {home.standing && (
                <p className="text-[10px] text-gray-500">
                  {home.standing.wins}-{home.standing.losses}
                </p>
              )}
            </div>
          </div>

          {/* Score / VS */}
          <div className="flex-shrink-0 text-center min-w-[70px]">
            {matchup.status !== 'scheduled' ? (
              <div className="flex items-center justify-center gap-1">
                <span className={`text-sm font-bold font-data tabular-nums ${homeWon ? 'text-green-400' : 'text-gray-400'}`}>
                  {home.score.toFixed(0)}
                </span>
                <span className="text-gray-600">-</span>
                <span className={`text-sm font-bold font-data tabular-nums ${awayWon ? 'text-green-400' : 'text-gray-400'}`}>
                  {away.score.toFixed(0)}
                </span>
              </div>
            ) : (
              <div className="px-2 py-1 bg-[#222]">
                <Swords className="w-3.5 h-3.5 text-gray-500 mx-auto" />
              </div>
            )}
            {matchup.status === 'live' && !featured && (
              <span className="text-[9px] text-red-500 font-bold">LIVE</span>
            )}
          </div>

          {/* Away */}
          <div className="flex-1 flex items-center gap-2 justify-end">
            <div className="min-w-0 text-right">
              <p className={`text-sm font-bold truncate ${
                awayWon ? 'text-green-400' : away.isUser ? 'text-purple-400' : 'text-white'
              }`}>
                {away.name}
              </p>
              {away.standing && (
                <p className="text-[10px] text-gray-500">
                  {away.standing.wins}-{away.standing.losses}
                </p>
              )}
            </div>
            <div className={`w-8 h-8 flex-shrink-0 flex items-center justify-center ${
              away.isUser ? 'bg-purple-500/20 border border-purple-500/50' : 'bg-[#333]'
            }`}>
              <span className={`text-xs font-bold ${away.isUser ? 'text-purple-400' : 'text-gray-400'}`}>
                {away.name.charAt(0)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
};

export default MatchupsTab;
