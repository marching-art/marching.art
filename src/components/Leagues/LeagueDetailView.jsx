// LeagueDetailView - Social hub for league competition
// Features: Your status, this week's matchups, standings, chat, history, activity
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, Crown, ChevronLeft, Settings, Swords,
  MessageSquare, BarChart3, History, Medal, Flame,
  TrendingUp, TrendingDown, Minus, Bell, Activity
} from 'lucide-react';
import { collection, query, orderBy, limit as firestoreLimit, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';

// Import tab components
import StandingsTab from './tabs/StandingsTab';
import ChatTab from './tabs/ChatTab';
import HistoryTab from './tabs/HistoryTab';
import MatchupDetailView from './MatchupDetailView';
import LeagueActivityFeed, { RivalryBadge } from './LeagueActivityFeed';
import { useRivalries, isRivalry as checkRivalry } from '../../hooks/useLeagueNotifications';

const LeagueDetailView = ({ league, userProfile, onBack, onLeave }) => {
  const [activeTab, setActiveTab] = useState('standings');
  const [standings, setStandings] = useState([]);
  const [messages, setMessages] = useState([]);
  const [weeklyMatchups, setWeeklyMatchups] = useState([]);
  const [weeklyResults, setWeeklyResults] = useState({}); // For rivalry calculations
  const [currentWeek, setCurrentWeek] = useState(1);
  const [memberProfiles, setMemberProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedMatchup, setSelectedMatchup] = useState(null);

  const isCommissioner = league.creatorId === userProfile?.uid;

  // Calculate rivalries using the hook
  const rivalries = useRivalries(
    userProfile?.uid,
    league?.id,
    weeklyMatchups,
    weeklyResults,
    memberProfiles
  );

  // Fetch all data
  useEffect(() => {
    const fetchData = async () => {
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

        // Fetch season data for week calculation
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
          setCurrentWeek(week);

          // Fetch fantasy recaps for standings calculation
          const recapsRef = doc(db, `fantasy_recaps/${sData.seasonUid}`);
          const recapsDoc = await getDoc(recapsRef);

          if (recapsDoc.exists()) {
            const recaps = recapsDoc.data().recaps || [];
            const memberUids = new Set(league.members);
            const weeklyResults = {};
            const memberStats = {};

            // Initialize member stats
            league.members.forEach(uid => {
              memberStats[uid] = {
                uid,
                wins: 0,
                losses: 0,
                totalPoints: 0,
                weeklyScores: {},
                streak: 0,
                streakType: null, // 'W' or 'L'
                lastWeekRank: null,
                currentRank: null,
                trend: 'same' // 'up', 'down', 'same'
              };
            });

            // Process recaps into weekly results
            recaps.forEach(dayRecap => {
              const weekNum = Math.ceil(dayRecap.offSeasonDay / 7);
              if (!weeklyResults[weekNum]) {
                weeklyResults[weekNum] = {};
              }

              dayRecap.shows?.forEach(show => {
                show.results?.forEach(result => {
                  if (memberUids.has(result.uid)) {
                    if (!weeklyResults[weekNum][result.uid]) {
                      weeklyResults[weekNum][result.uid] = 0;
                    }
                    weeklyResults[weekNum][result.uid] += result.totalScore || 0;
                  }
                });
              });
            });

            // Generate matchups for each week (round robin style)
            const matchupsPerWeek = generateMatchups(league.members, week);
            setWeeklyMatchups(matchupsPerWeek);

            // Store weekly results for rivalry calculations
            setWeeklyResults(weeklyResults);

            // Calculate head-to-head records
            Object.entries(weeklyResults).forEach(([weekNum, scores]) => {
              const weekMatchups = matchupsPerWeek[parseInt(weekNum)] || [];

              weekMatchups.forEach(matchup => {
                const score1 = scores[matchup.user1] || 0;
                const score2 = scores[matchup.user2] || 0;

                if (memberStats[matchup.user1]) {
                  memberStats[matchup.user1].weeklyScores[weekNum] = score1;
                }
                if (memberStats[matchup.user2]) {
                  memberStats[matchup.user2].weeklyScores[weekNum] = score2;
                }

                if (score1 > score2) {
                  if (memberStats[matchup.user1]) memberStats[matchup.user1].wins++;
                  if (memberStats[matchup.user2]) memberStats[matchup.user2].losses++;
                } else if (score2 > score1) {
                  if (memberStats[matchup.user2]) memberStats[matchup.user2].wins++;
                  if (memberStats[matchup.user1]) memberStats[matchup.user1].losses++;
                }
              });

              // Calculate total points
              Object.entries(scores).forEach(([uid, score]) => {
                if (memberStats[uid]) {
                  memberStats[uid].totalPoints += score;
                }
              });
            });

            // Calculate streaks
            Object.values(memberStats).forEach(stats => {
              let streak = 0;
              let streakType = null;
              const weeks = Object.keys(stats.weeklyScores).sort((a, b) => parseInt(b) - parseInt(a));

              for (const weekNum of weeks) {
                const matchups = matchupsPerWeek[parseInt(weekNum)] || [];
                const matchup = matchups.find(m => m.user1 === stats.uid || m.user2 === stats.uid);

                if (matchup) {
                  const myScore = weeklyResults[weekNum]?.[stats.uid] || 0;
                  const oppUid = matchup.user1 === stats.uid ? matchup.user2 : matchup.user1;
                  const oppScore = weeklyResults[weekNum]?.[oppUid] || 0;

                  const won = myScore > oppScore;
                  const currentType = won ? 'W' : 'L';

                  if (streakType === null) {
                    streakType = currentType;
                    streak = 1;
                  } else if (streakType === currentType) {
                    streak++;
                  } else {
                    break;
                  }
                }
              }

              stats.streak = streak;
              stats.streakType = streakType;
            });

            // Sort standings by wins, then total points
            const sortedStandings = Object.values(memberStats)
              .sort((a, b) => {
                if (b.wins !== a.wins) return b.wins - a.wins;
                return b.totalPoints - a.totalPoints;
              });

            // Calculate trend (compare to last week's rank)
            sortedStandings.forEach((stats, idx) => {
              stats.currentRank = idx + 1;
              // For now, use random trends for demo - in production, compare to stored history
              if (stats.wins > 0 && stats.losses === 0) {
                stats.trend = 'up';
              } else if (stats.losses > stats.wins) {
                stats.trend = 'down';
              } else {
                stats.trend = 'same';
              }
            });

            setStandings(sortedStandings);
          }
        }
      } catch (error) {
        console.error('Error fetching league data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Real-time chat listener
    const messagesRef = collection(db, `artifacts/marching-art/leagues/${league.id}/chat`);
    const unsubMessages = onSnapshot(
      query(messagesRef, orderBy('createdAt', 'desc'), firestoreLimit(50)),
      (snapshot) => {
        const messagesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setMessages(messagesData.reverse());
      }
    );

    return () => {
      unsubMessages();
    };
  }, [league]);

  // Generate round-robin matchups
  const generateMatchups = (members, maxWeek) => {
    const matchups = {};
    const n = members.length;

    for (let week = 1; week <= maxWeek; week++) {
      matchups[week] = [];
      const shuffled = [...members];

      // Simple round-robin pairing based on week
      const offset = (week - 1) % Math.floor(n / 2);
      for (let i = 0; i < Math.floor(n / 2); i++) {
        const idx1 = (i + offset) % n;
        const idx2 = (n - 1 - i + offset) % n;
        if (idx1 !== idx2 && shuffled[idx1] && shuffled[idx2]) {
          matchups[week].push({
            user1: shuffled[idx1],
            user2: shuffled[idx2]
          });
        }
      }
    }

    return matchups;
  };

  // Get user's current stats
  const userStats = useMemo(() => {
    return standings.find(s => s.uid === userProfile?.uid);
  }, [standings, userProfile]);

  // Get this week's matchups
  const thisWeekMatchups = useMemo(() => {
    return weeklyMatchups[currentWeek] || [];
  }, [weeklyMatchups, currentWeek]);

  // Get user's matchup this week
  const userMatchup = useMemo(() => {
    return thisWeekMatchups.find(m =>
      m.user1 === userProfile?.uid || m.user2 === userProfile?.uid
    );
  }, [thisWeekMatchups, userProfile]);

  // Helper to get display name
  const getDisplayName = (uid) => {
    if (uid === userProfile?.uid) return 'You';
    const profile = memberProfiles[uid];
    return profile?.displayName || profile?.username || `Director ${uid?.slice(0, 6)}`;
  };

  // Get rank badge
  const getRankBadge = (rank) => {
    if (rank === 1) return { emoji: '🥇', color: 'text-yellow-400', bg: 'bg-yellow-500/20' };
    if (rank === 2) return { emoji: '🥈', color: 'text-gray-400', bg: 'bg-gray-400/20' };
    if (rank === 3) return { emoji: '🥉', color: 'text-orange-400', bg: 'bg-orange-500/20' };
    return { emoji: `#${rank}`, color: 'text-cream-400', bg: 'bg-cream-500/10' };
  };

  const tabs = [
    { id: 'standings', label: 'Standings', icon: BarChart3 },
    { id: 'activity', label: 'Activity', icon: Bell },
    { id: 'chat', label: 'Chat', icon: MessageSquare, badge: messages.length > 0 },
    { id: 'history', label: 'History', icon: History }
  ];

  // Get rivalry for selected matchup
  const getMatchupRivalry = (matchup) => {
    if (!userProfile?.uid) return null;
    const opponentId = matchup.user1 === userProfile.uid ? matchup.user2 :
                      matchup.user2 === userProfile.uid ? matchup.user1 : null;
    if (!opponentId) return null;
    return checkRivalry(rivalries, opponentId);
  };

  // If viewing matchup detail, show that instead
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
        rivalry={getMatchupRivalry(selectedMatchup)}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-xl p-4"
      >
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-cream-300 hover:text-cream-100 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="text-sm">Back</span>
          </button>

          <div className="flex items-center gap-2">
            {isCommissioner && (
              <button
                onClick={() => setActiveTab('settings')}
                className="p-2 rounded-lg glass hover:bg-cream-500/10 transition-colors"
              >
                <Settings className="w-5 h-5 text-cream-400" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gold-500/20 to-purple-500/20 flex items-center justify-center">
            <Trophy className="w-6 h-6 text-gold-400" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-display font-bold text-cream-100">
                {league.name}
              </h1>
              {isCommissioner && (
                <Crown className="w-4 h-4 text-gold-500" title="Commissioner" />
              )}
            </div>
            <p className="text-sm text-cream-500/60">
              {league.members?.length || 0} members • Week {currentWeek}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Your Status Card */}
      {userStats && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-xl p-4"
        >
          <h3 className="text-xs font-display font-semibold text-cream-500/60 uppercase tracking-wide mb-3">
            Your Status
          </h3>
          <div className="flex items-center gap-4">
            {/* Rank Badge */}
            <div className={`px-4 py-2 rounded-lg ${getRankBadge(userStats.currentRank).bg}`}>
              <span className="text-2xl">{getRankBadge(userStats.currentRank).emoji}</span>
              <span className={`ml-2 font-display font-bold ${getRankBadge(userStats.currentRank).color}`}>
                {userStats.currentRank <= 3 ? '' : 'Place'}
              </span>
            </div>

            <div className="w-px h-10 bg-cream-500/20" />

            {/* Record */}
            <div className="text-center">
              <p className="text-xs text-cream-500/60">Record</p>
              <p className="font-display font-bold text-lg">
                <span className="text-green-400">{userStats.wins}</span>
                <span className="text-cream-500/40">-</span>
                <span className="text-red-400">{userStats.losses}</span>
              </p>
            </div>

            <div className="w-px h-10 bg-cream-500/20" />

            {/* Streak */}
            <div className="text-center">
              <p className="text-xs text-cream-500/60">Streak</p>
              <p className={`font-display font-bold text-lg flex items-center gap-1 ${
                userStats.streakType === 'W' ? 'text-green-400' : 'text-red-400'
              }`}>
                {userStats.streakType === 'W' && <Flame className="w-4 h-4" />}
                {userStats.streakType || '—'}{userStats.streak > 0 ? userStats.streak : ''}
              </p>
            </div>

            {/* Trend */}
            <div className="ml-auto">
              {userStats.trend === 'up' && (
                <div className="flex items-center gap-1 text-green-400">
                  <TrendingUp className="w-5 h-5" />
                </div>
              )}
              {userStats.trend === 'down' && (
                <div className="flex items-center gap-1 text-red-400">
                  <TrendingDown className="w-5 h-5" />
                </div>
              )}
              {userStats.trend === 'same' && (
                <div className="flex items-center gap-1 text-cream-500/40">
                  <Minus className="w-5 h-5" />
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* This Week's Matchups */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass rounded-xl p-4"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-display font-semibold text-cream-500/60 uppercase tracking-wide">
            This Week's Matchups
          </h3>
          <span className="text-xs text-cream-500/40">Week {currentWeek}</span>
        </div>

        {/* User's Matchup - Highlighted */}
        {userMatchup && (
          <div
            onClick={() => setSelectedMatchup({
              ...userMatchup,
              week: currentWeek,
              isUserMatchup: true
            })}
            className={`mb-3 p-4 rounded-xl cursor-pointer transition-all ${
              getMatchupRivalry(userMatchup)
                ? 'bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/30 hover:border-red-500/50'
                : 'bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 hover:border-purple-500/40'
            }`}
          >
            {/* Rivalry indicator */}
            {getMatchupRivalry(userMatchup) && (
              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-red-500/20">
                <Flame className="w-4 h-4 text-red-400" />
                <span className="text-xs font-display font-semibold text-red-400">
                  Rivalry Matchup - {getMatchupRivalry(userMatchup).matchupCount}x meetings
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-charcoal-800 flex items-center justify-center border-2 border-purple-500/50">
                  <span className="font-display font-bold text-cream-100">
                    {getDisplayName(userMatchup.user1).charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="font-display font-semibold text-cream-100">
                    {getDisplayName(userMatchup.user1)}
                  </p>
                  <p className="text-xs text-cream-500/60">
                    {standings.find(s => s.uid === userMatchup.user1)?.totalPoints.toFixed(1) || '0.0'} pts
                  </p>
                </div>
              </div>

              <div className="px-3 py-1 rounded-full bg-charcoal-900/50">
                <Swords className="w-4 h-4 text-purple-400" />
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="font-display font-semibold text-cream-100">
                    {getDisplayName(userMatchup.user2)}
                  </p>
                  <p className="text-xs text-cream-500/60">
                    {standings.find(s => s.uid === userMatchup.user2)?.totalPoints.toFixed(1) || '0.0'} pts
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full bg-charcoal-800 flex items-center justify-center border-2 border-cream-500/20">
                  <span className="font-display font-bold text-cream-500/60">
                    {getDisplayName(userMatchup.user2).charAt(0)}
                  </span>
                </div>
              </div>
            </div>
            <p className="text-center text-xs text-purple-400 mt-2">
              Tap to view matchup details →
            </p>
          </div>
        )}

        {/* Other Matchups */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {thisWeekMatchups
            .filter(m => m.user1 !== userProfile?.uid && m.user2 !== userProfile?.uid)
            .map((matchup, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedMatchup({
                  ...matchup,
                  week: currentWeek,
                  isUserMatchup: false
                })}
                className="p-3 rounded-lg bg-charcoal-900/30 border border-cream-500/10 cursor-pointer hover:border-cream-500/30 transition-all"
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="font-display text-cream-300 truncate flex-1">
                    @{getDisplayName(matchup.user1)}
                  </span>
                  <span className="text-xs text-cream-500/40 mx-2">vs</span>
                  <span className="font-display text-cream-300 truncate flex-1 text-right">
                    @{getDisplayName(matchup.user2)}
                  </span>
                </div>
              </div>
            ))}
        </div>

        {thisWeekMatchups.length === 0 && (
          <p className="text-center text-cream-500/40 py-4">
            No matchups scheduled yet
          </p>
        )}
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-2">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-display font-semibold transition-all ${
                activeTab === tab.id
                  ? 'bg-gold-500 text-charcoal-900'
                  : 'glass text-cream-300 hover:text-cream-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.badge && (
                <span className="w-2 h-2 rounded-full bg-purple-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'standings' && (
          <StandingsTab
            key="standings"
            standings={standings}
            memberProfiles={memberProfiles}
            userProfile={userProfile}
            loading={loading}
          />
        )}
        {activeTab === 'activity' && (
          <motion.div
            key="activity"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Rivalries Section */}
            {rivalries.length > 0 && (
              <div className="glass rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Flame className="w-4 h-4 text-red-400" />
                  <h3 className="text-sm font-display font-semibold text-cream-100">
                    Your Rivalries
                  </h3>
                </div>
                <div className="space-y-2">
                  {rivalries.map(rivalry => (
                    <RivalryBadge key={rivalry.rivalId} rivalry={rivalry} compact={false} />
                  ))}
                </div>
              </div>
            )}

            {/* Activity Feed */}
            <LeagueActivityFeed
              leagueId={league?.id}
              userId={userProfile?.uid}
              league={league}
              showFilters={true}
              maxItems={15}
              onActivityTap={(activity) => {
                // Navigate to relevant content based on activity type
                if (activity.type === 'matchup_result' && activity.metadata?.week) {
                  const matchups = weeklyMatchups[activity.metadata.week];
                  if (matchups) {
                    const matchup = matchups.find(m =>
                      (m.user1 === userProfile?.uid || m.user2 === userProfile?.uid)
                    );
                    if (matchup) {
                      setSelectedMatchup({
                        ...matchup,
                        week: activity.metadata.week,
                        isUserMatchup: true
                      });
                    }
                  }
                } else if (activity.type === 'new_message') {
                  setActiveTab('chat');
                }
              }}
            />
          </motion.div>
        )}
        {activeTab === 'chat' && (
          <ChatTab
            key="chat"
            league={league}
            messages={messages}
            userProfile={userProfile}
            memberProfiles={memberProfiles}
          />
        )}
        {activeTab === 'history' && (
          <HistoryTab
            key="history"
            league={league}
            weeklyMatchups={weeklyMatchups}
            standings={standings}
            memberProfiles={memberProfiles}
            userProfile={userProfile}
            currentWeek={currentWeek}
          />
        )}
      </AnimatePresence>

      {/* Leave League Button */}
      <div className="pt-4">
        <button
          onClick={onLeave}
          className="w-full py-3 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-colors"
        >
          Leave League
        </button>
      </div>
    </div>
  );
};

export default LeagueDetailView;
