// MatchupsTab - Real matchups from Firestore, grouped by corps class
// Design System: Compact strips, inline scores, week navigation

import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Swords, Calendar, Radio, Flame, ChevronLeft, ChevronRight, Trophy, Award, Star, Zap } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { GAME_CONFIG } from '../../../config';
import MatchupDetailView from '../MatchupDetailView';

// Corps class display configuration
const CORPS_CLASS_CONFIG = {
  worldClass: {
    name: 'World Class',
    icon: Trophy,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
  },
  openClass: {
    name: 'Open Class',
    icon: Award,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
  },
  aClass: {
    name: 'A Class',
    icon: Star,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
  },
  soundSport: {
    name: 'SoundSport',
    icon: Zap,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
  },
};

const CORPS_CLASSES = ['worldClass', 'openClass', 'aClass', 'soundSport'];

const MatchupsTab = ({ league, userProfile, standings = [], memberProfiles = {}, rivalries = [] }) => {
  const [matchupsByClass, setMatchupsByClass] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [selectedMatchup, setSelectedMatchup] = useState(null);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [weeksWithMatchups, setWeeksWithMatchups] = useState(new Set());

  // Check if matchup is a rivalry
  const isRivalryMatchup = (matchup) => {
    if (!userProfile?.uid || !rivalries.length || !matchup.pair) return false;
    const [p1, p2] = matchup.pair;
    const opponentId = p1 === userProfile.uid ? p2 : p2 === userProfile.uid ? p1 : null;
    return opponentId ? rivalries.some(r => r.rivalId === opponentId) : false;
  };

  // Fetch matchups from Firestore
  useEffect(() => {
    const fetchData = async () => {
      if (!league?.id) {
        setLoading(false);
        return;
      }

      try {
        // Get current week from season data
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

        // Fetch matchups for all weeks up to current + 1
        const matchupsData = {};
        const weeksFound = new Set();

        for (let w = 1; w <= Math.min(week + 1, GAME_CONFIG.season.totalWeeks); w++) {
          const matchupRef = doc(db, `artifacts/marching-art/leagues/${league.id}/matchups/week-${w}`);
          const matchupDoc = await getDoc(matchupRef);

          if (matchupDoc.exists()) {
            const data = matchupDoc.data();
            matchupsData[w] = data;
            weeksFound.add(w);
          }
        }

        setMatchupsByClass(matchupsData);
        setWeeksWithMatchups(weeksFound);
      } catch (error) {
        console.error('Error fetching matchups:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [league?.id]);

  // Get matchups for selected week, organized by class
  const weekMatchups = useMemo(() => {
    const weekData = matchupsByClass[selectedWeek] || {};
    const result = {};

    for (const corpsClass of CORPS_CLASSES) {
      const classMatchups = weekData[`${corpsClass}Matchups`] || [];
      if (classMatchups.length > 0) {
        result[corpsClass] = classMatchups.map((m, idx) => ({
          ...m,
          id: `${selectedWeek}-${corpsClass}-${idx}`,
          corpsClass,
          week: selectedWeek,
          // Determine status based on week
          status: selectedWeek < currentWeek ? 'completed' :
                  selectedWeek === currentWeek ? 'live' : 'scheduled',
        }));
      }
    }

    return result;
  }, [matchupsByClass, selectedWeek, currentWeek]);

  // Get user's matchups across all classes
  const userMatchups = useMemo(() => {
    const matches = [];
    for (const [corpsClass, matchups] of Object.entries(weekMatchups)) {
      for (const matchup of matchups) {
        if (matchup.pair && (matchup.pair[0] === userProfile?.uid || matchup.pair[1] === userProfile?.uid)) {
          matches.push(matchup);
        }
      }
    }
    return matches;
  }, [weekMatchups, userProfile?.uid]);

  // Check if any matchups exist for selected week
  const hasMatchups = Object.keys(weekMatchups).length > 0;

  // Get display name
  const getDisplayName = (userId) => {
    if (!userId) return 'BYE';
    if (userId === userProfile?.uid) return 'You';
    const profile = memberProfiles[userId];
    return profile?.displayName || profile?.username || `User ${userId?.slice(0, 6)}`;
  };

  // Get user standing
  const getStanding = (userId) => standings.find(s => s.uid === userId);

  // Handle matchup click
  const handleMatchupClick = (matchup) => {
    if (!matchup.pair || !matchup.pair[1]) return; // Don't click bye matchups
    setSelectedMatchup({
      user1: matchup.pair[0],
      user2: matchup.pair[1],
      week: matchup.week,
      status: matchup.status,
      corpsClass: matchup.corpsClass,
      isUserMatchup: matchup.pair[0] === userProfile?.uid || matchup.pair[1] === userProfile?.uid,
    });
  };

  // Week navigation
  const goToPrevWeek = () => {
    if (selectedWeek > 1) setSelectedWeek(selectedWeek - 1);
  };

  const goToNextWeek = () => {
    if (selectedWeek < GAME_CONFIG.season.totalWeeks) setSelectedWeek(selectedWeek + 1);
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
                disabled={selectedWeek >= GAME_CONFIG.season.totalWeeks}
                className="p-1 text-gray-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Week Pills */}
        <div className="p-3 flex gap-1.5 overflow-x-auto scrollbar-hide">
          {Array.from({ length: GAME_CONFIG.season.totalWeeks }, (_, i) => i + 1).map(week => {
            const hasData = weeksWithMatchups.has(week);
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
                    : hasData
                    ? 'bg-[#222] border border-[#444] text-white hover:border-[#555]'
                    : 'bg-[#222] border border-[#333] text-gray-500 hover:text-white hover:border-[#444]'
                }`}
              >
                W{week}
                {isCurrent && !isSelected && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-purple-500 rounded-sm animate-pulse" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Your Matchups - Featured */}
      {userMatchups.length > 0 && (
        <div className="bg-[#1a1a1a] border border-[#333]">
          <div className="px-4 py-2 border-b border-[#333] bg-[#222] flex items-center justify-between">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Your Matchups ({userMatchups.length})
            </h3>
            {selectedWeek === currentWeek && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-500/20 text-red-500 text-[10px] font-bold uppercase">
                <Radio className="w-2.5 h-2.5 animate-pulse" />
                LIVE
              </span>
            )}
          </div>

          <div className="divide-y divide-[#222]">
            {userMatchups.map(matchup => (
              <VersusStrip
                key={matchup.id}
                matchup={matchup}
                getDisplayName={getDisplayName}
                getStanding={getStanding}
                userProfile={userProfile}
                isRivalry={isRivalryMatchup(matchup)}
                onClick={() => handleMatchupClick(matchup)}
                featured
                showClass
              />
            ))}
          </div>
        </div>
      )}

      {/* Matchups by Corps Class */}
      {CORPS_CLASSES.map(corpsClass => {
        const classMatchups = weekMatchups[corpsClass] || [];
        // Filter out user's matchups (already shown above)
        const otherMatchups = classMatchups.filter(m =>
          !m.pair || (m.pair[0] !== userProfile?.uid && m.pair[1] !== userProfile?.uid)
        );

        if (otherMatchups.length === 0) return null;

        const config = CORPS_CLASS_CONFIG[corpsClass];
        const Icon = config.icon;

        return (
          <div key={corpsClass} className="bg-[#1a1a1a] border border-[#333]">
            <div className={`px-4 py-2 border-b border-[#333] bg-[#222] flex items-center gap-2`}>
              <div className={`p-1 ${config.bgColor} border ${config.borderColor}`}>
                <Icon className={`w-3 h-3 ${config.color}`} />
              </div>
              <h3 className={`text-[10px] font-bold uppercase tracking-wider ${config.color}`}>
                {config.name} ({otherMatchups.length})
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
                  isRivalry={isRivalryMatchup(matchup)}
                  onClick={() => handleMatchupClick(matchup)}
                />
              ))}
            </div>
          </div>
        );
      })}

      {!hasMatchups && (
        <div className="bg-[#1a1a1a] border border-[#333] p-8 text-center">
          <Swords className="w-8 h-8 text-gray-500 mx-auto mb-2" />
          <p className="text-sm text-gray-400 mb-1">No matchups for Week {selectedWeek}</p>
          <p className="text-xs text-gray-600">
            {league?.members?.length < 2
              ? 'Need at least 2 league members to generate matchups'
              : 'The commissioner needs to generate matchups for this week'}
          </p>
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
  featured = false,
  showClass = false
}) => {
  const [p1_uid, p2_uid] = matchup.pair || [null, null];
  const isBye = !p2_uid;

  const home = {
    name: getDisplayName(p1_uid),
    standing: getStanding(p1_uid),
    isUser: p1_uid === userProfile?.uid,
    score: matchup.scores?.[p1_uid] || 0,
  };

  const away = {
    name: getDisplayName(p2_uid),
    standing: p2_uid ? getStanding(p2_uid) : null,
    isUser: p2_uid === userProfile?.uid,
    score: matchup.scores?.[p2_uid] || 0,
  };

  const homeWon = matchup.completed && matchup.winner === p1_uid;
  const awayWon = matchup.completed && matchup.winner === p2_uid;
  const isTie = matchup.completed && matchup.winner === 'tie';

  const classConfig = CORPS_CLASS_CONFIG[matchup.corpsClass];

  return (
    <button
      onClick={onClick}
      disabled={isBye}
      className={`w-full text-left transition-colors ${
        isBye
          ? 'opacity-50 cursor-default'
          : isRivalry
            ? 'bg-red-500/5 hover:bg-red-500/10'
            : featured
              ? 'bg-purple-500/5 hover:bg-purple-500/10'
              : 'hover:bg-[#222]'
      }`}
    >
      <div className={`px-4 py-3 ${featured ? 'py-4' : ''}`}>
        {/* Class + Rivalry indicators */}
        <div className="flex items-center gap-2 mb-2">
          {showClass && classConfig && (
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold uppercase ${classConfig.bgColor} ${classConfig.color} border ${classConfig.borderColor}`}>
              {classConfig.name}
            </span>
          )}
          {isRivalry && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-red-500">
              <Flame className="w-3 h-3" />
              Rivalry
            </span>
          )}
          {isBye && (
            <span className="text-[10px] font-bold uppercase text-gray-500">BYE WEEK</span>
          )}
        </div>

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
            {isBye ? (
              <div className="px-2 py-1 bg-[#222] text-gray-500 text-xs">
                WIN
              </div>
            ) : matchup.completed || matchup.status === 'live' ? (
              <div className="flex items-center justify-center gap-1">
                <span className={`text-sm font-bold font-data tabular-nums ${
                  homeWon ? 'text-green-400' : isTie ? 'text-yellow-400' : 'text-gray-400'
                }`}>
                  {home.score.toFixed(0)}
                </span>
                <span className="text-gray-600">-</span>
                <span className={`text-sm font-bold font-data tabular-nums ${
                  awayWon ? 'text-green-400' : isTie ? 'text-yellow-400' : 'text-gray-400'
                }`}>
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
          {!isBye && (
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
          )}
        </div>
      </div>
    </button>
  );
};

export default MatchupsTab;
