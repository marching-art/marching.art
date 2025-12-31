// LeagueDetailView - Social hub for league competition
// Features: Logo, Commissioner tag, Share League, Smack Talk, matchups, standings, chat, activity

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, Crown, ChevronLeft, Settings, Swords,
  MessageSquare, BarChart3, History, Medal, Flame,
  TrendingUp, TrendingDown, Minus, Bell, Activity,
  Share2, Copy, Check, Send, Users, Calendar
} from 'lucide-react';
import { collection, query, orderBy, limit as firestoreLimit, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import toast from 'react-hot-toast';

// Import tab components
import StandingsTab from './tabs/StandingsTab';
import MatchupsTab from './tabs/MatchupsTab';
import ChatTab from './tabs/ChatTab';
import HistoryTab from './tabs/HistoryTab';
import MatchupDetailView from './MatchupDetailView';
import LeagueActivityFeed, { RivalryBadge } from './LeagueActivityFeed';
import { useRivalries, isRivalry as checkRivalry } from '../../hooks/useLeagueNotifications';
import { postLeagueMessage } from '../../firebase/functions';

// marching.art Logo Component
const MarchingArtLogo = ({ className = '' }) => (
  <svg
    viewBox="0 0 40 40"
    className={className}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Background Circle */}
    <circle cx="20" cy="20" r="18" fill="#1A1A1A" stroke="#333" strokeWidth="1" />
    {/* M Shape - Stylized marching */}
    <path
      d="M10 28V14L16 22L20 16L24 22L30 14V28"
      stroke="#FFD700"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    {/* Dot accent */}
    <circle cx="20" cy="12" r="2" fill="#FFD700" />
  </svg>
);

// Quick Smack Talk Input Component
const SmackTalkInput = ({ leagueId, userProfile, disabled = false }) => {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const inputRef = useRef(null);

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!message.trim() || sending) return;

    setSending(true);
    try {
      await postLeagueMessage({ leagueId, message: message.trim() });
      setMessage('');
      toast.success('Message sent!');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send');
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={handleSend} className="flex gap-2">
      <input
        ref={inputRef}
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Talk some trash..."
        className="flex-1 px-3 py-2 bg-[#1a1a1a] border border-[#333] rounded-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-[#555] transition-all text-sm"
        disabled={sending || disabled}
        maxLength={200}
      />
      <button
        type="submit"
        disabled={sending || !message.trim() || disabled}
        className="px-3 py-2 bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-sm text-black font-bold flex items-center gap-2 transition-colors"
      >
        <Send className="w-4 h-4" />
      </button>
    </form>
  );
};

// Share League Button Component
const ShareLeagueButton = ({ league }) => {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/leagues?join=${league.inviteCode}`;
    const shareText = `Join my league "${league.name}" on marching.art! Use code: ${league.inviteCode}`;

    try {
      // Try native share first (mobile)
      if (navigator.share) {
        await navigator.share({
          title: `Join ${league.name}`,
          text: shareText,
          url: shareUrl,
        });
        return;
      }

      // Fallback to clipboard
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      setCopied(true);
      toast.success('Invite link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      // If clipboard fails, show the code
      toast.success(`Invite Code: ${league.inviteCode}`);
    }
  };

  return (
    <button
      onClick={handleShare}
      className="flex items-center gap-2 px-3 py-2 rounded-sm bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/20 transition-all font-bold text-sm"
    >
      {copied ? (
        <>
          <Check className="w-4 h-4" />
          Copied!
        </>
      ) : (
        <>
          <Share2 className="w-4 h-4" />
          Share League
        </>
      )}
    </button>
  );
};

// Commissioner Badge Component with Gold styling
const CommissionerBadge = ({ isCommissioner }) => {
  if (!isCommissioner) return null;

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-yellow-500/20 border border-yellow-500/30 text-yellow-500 text-xs font-bold">
      <Crown className="w-3 h-3" />
      Commissioner
    </span>
  );
};

const LeagueDetailView = ({ league, userProfile, onBack, onLeave }) => {
  const [activeTab, setActiveTab] = useState('standings');
  const [standings, setStandings] = useState([]);
  const [messages, setMessages] = useState([]);
  const [weeklyMatchups, setWeeklyMatchups] = useState([]);
  const [weeklyResults, setWeeklyResults] = useState({});
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
                streakType: null,
                lastWeekRank: null,
                currentRank: null,
                trend: 'same'
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

            // Generate matchups for each week
            const matchupsPerWeek = generateMatchups(league.members, week);
            setWeeklyMatchups(matchupsPerWeek);
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

            // Calculate trend
            sortedStandings.forEach((stats, idx) => {
              stats.currentRank = idx + 1;
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
      const offset = (week - 1) % Math.floor(n / 2);
      for (let i = 0; i < Math.floor(n / 2); i++) {
        const idx1 = (i + offset) % n;
        const idx2 = (n - 1 - i + offset) % n;
        if (idx1 !== idx2 && members[idx1] && members[idx2]) {
          matchups[week].push({
            user1: members[idx1],
            user2: members[idx2]
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
    if (rank === 1) return { emoji: '🥇', color: 'text-yellow-500', bg: 'bg-yellow-500/10' };
    if (rank === 2) return { emoji: '🥈', color: 'text-gray-400', bg: 'bg-gray-500/10' };
    if (rank === 3) return { emoji: '🥉', color: 'text-orange-500', bg: 'bg-orange-500/10' };
    return { emoji: `#${rank}`, color: 'text-gray-400', bg: 'bg-[#222]' };
  };

  const tabs = [
    { id: 'standings', label: 'Standings', icon: BarChart3 },
    { id: 'matchups', label: 'Matchups', icon: Swords },
    { id: 'activity', label: 'Activity', icon: Bell },
    { id: 'chat', label: 'Chat', icon: MessageSquare, badge: messages.length > 0 },
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
      {/* Header with Logo */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#1a1a1a] border border-[#333] rounded-sm p-4"
      >
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="text-sm">Back</span>
          </button>

          <div className="flex items-center gap-2">
            <ShareLeagueButton league={league} />
            {isCommissioner && (
              <button
                onClick={() => setActiveTab('settings')}
                className="p-2 rounded-sm bg-[#222] hover:bg-[#333] transition-colors"
              >
                <Settings className="w-5 h-5 text-gray-400" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Logo */}
          <div className="w-14 h-14 rounded-sm bg-[#222] border border-[#444] flex items-center justify-center overflow-hidden">
            <MarchingArtLogo className="w-12 h-12" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-white truncate">
                {league.name}
              </h1>
              <CommissionerBadge isCommissioner={isCommissioner} />
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {league.members?.length || 0} members
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Week {currentWeek}
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Your Status Card */}
      {userStats && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-[#1a1a1a] border border-[#333] rounded-sm p-4"
        >
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
            Your Status
          </h3>
          <div className="flex items-center gap-4">
            {/* Rank Badge */}
            <div className={`px-4 py-2 rounded-sm ${getRankBadge(userStats.currentRank).bg}`}>
              <span className="text-2xl">{getRankBadge(userStats.currentRank).emoji}</span>
              <span className={`ml-2 font-bold ${getRankBadge(userStats.currentRank).color}`}>
                {userStats.currentRank <= 3 ? '' : 'Place'}
              </span>
            </div>

            <div className="w-px h-10 bg-[#333]" />

            {/* Record */}
            <div className="text-center">
              <p className="text-xs text-gray-500">Record</p>
              <p className="font-bold text-lg">
                <span className="text-green-500">{userStats.wins}</span>
                <span className="text-gray-600">-</span>
                <span className="text-red-500">{userStats.losses}</span>
              </p>
            </div>

            <div className="w-px h-10 bg-[#333]" />

            {/* Streak */}
            <div className="text-center">
              <p className="text-xs text-gray-500">Streak</p>
              <p className={`font-bold text-lg flex items-center gap-1 ${
                userStats.streakType === 'W' ? 'text-green-500' : 'text-red-500'
              }`}>
                {userStats.streakType === 'W' && <Flame className="w-4 h-4" />}
                {userStats.streakType || '—'}{userStats.streak > 0 ? userStats.streak : ''}
              </p>
            </div>

            {/* Trend */}
            <div className="ml-auto">
              {userStats.trend === 'up' && (
                <div className="flex items-center gap-1 text-green-500">
                  <TrendingUp className="w-5 h-5" />
                </div>
              )}
              {userStats.trend === 'down' && (
                <div className="flex items-center gap-1 text-red-500">
                  <TrendingDown className="w-5 h-5" />
                </div>
              )}
              {userStats.trend === 'same' && (
                <div className="flex items-center gap-1 text-gray-600">
                  <Minus className="w-5 h-5" />
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* This Week's Matchup Card */}
      {userMatchup && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-[#1a1a1a] border border-[#333] rounded-sm p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">
              Your Week {currentWeek} Matchup
            </h3>
          </div>

          <div
            onClick={() => setSelectedMatchup({
              ...userMatchup,
              week: currentWeek,
              isUserMatchup: true
            })}
            className={`p-4 rounded-sm cursor-pointer transition-all ${
              getMatchupRivalry(userMatchup)
                ? 'bg-red-500/10 border border-red-500/30 hover:border-red-500/50'
                : 'bg-[#222] border border-[#444] hover:border-[#555]'
            }`}
          >
            {getMatchupRivalry(userMatchup) && (
              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-red-500/20">
                <Flame className="w-4 h-4 text-red-500" />
                <span className="text-xs font-bold text-red-500">
                  Rivalry Matchup
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#333] flex items-center justify-center border-2 border-purple-500/50">
                  <span className="font-bold text-white">
                    {getDisplayName(userMatchup.user1).charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="font-bold text-white">
                    {getDisplayName(userMatchup.user1)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {standings.find(s => s.uid === userMatchup.user1)?.totalPoints.toFixed(1) || '0.0'} pts
                  </p>
                </div>
              </div>

              <div className="px-3 py-1 rounded-full bg-[#1a1a1a]">
                <Swords className="w-4 h-4 text-purple-500" />
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="font-bold text-white">
                    {getDisplayName(userMatchup.user2)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {standings.find(s => s.uid === userMatchup.user2)?.totalPoints.toFixed(1) || '0.0'} pts
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full bg-[#333] flex items-center justify-center border-2 border-[#555]">
                  <span className="font-bold text-gray-400">
                    {getDisplayName(userMatchup.user2).charAt(0)}
                  </span>
                </div>
              </div>
            </div>
            <p className="text-center text-xs text-purple-500 mt-2">
              Tap to view matchup details →
            </p>
          </div>
        </motion.div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-sm font-bold transition-all ${
                activeTab === tab.id
                  ? 'bg-yellow-500 text-black'
                  : 'bg-[#1a1a1a] border border-[#333] text-gray-400 hover:text-white hover:border-[#444]'
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
            league={league}
          />
        )}
        {activeTab === 'matchups' && (
          <MatchupsTab
            key="matchups"
            league={league}
            userProfile={userProfile}
            standings={standings}
            memberProfiles={memberProfiles}
            rivalries={rivalries}
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
              <div className="bg-[#1a1a1a] border border-[#333] rounded-sm p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Flame className="w-4 h-4 text-red-500" />
                  <h3 className="text-sm font-bold text-white">
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
            isCommissioner={isCommissioner}
          />
        )}
      </AnimatePresence>

      {/* Persistent Smack Talk Area */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-[#1a1a1a] border border-[#333] rounded-sm p-4"
      >
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="w-4 h-4 text-yellow-500" />
          <h3 className="text-sm font-bold text-white">
            Smack Talk
          </h3>
          <span className="text-xs text-gray-500">
            Quick message the league
          </span>
        </div>
        <SmackTalkInput
          leagueId={league.id}
          userProfile={userProfile}
        />
      </motion.div>

      {/* Leave League Button */}
      <div className="pt-4">
        <button
          onClick={onLeave}
          className="w-full py-3 text-sm text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-sm transition-colors"
        >
          Leave League
        </button>
      </div>
    </div>
  );
};

export default LeagueDetailView;
