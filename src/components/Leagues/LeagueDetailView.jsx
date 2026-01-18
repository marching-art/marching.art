// LeagueDetailView - Command Center for league competition
// Design System: App Shell layout with fixed header, sticky tabs, scrollable content

import React, { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import {
  Trophy, Crown, ChevronLeft, Settings, Swords,
  MessageSquare, BarChart3, Flame,
  TrendingUp, TrendingDown, Minus, Bell,
  Share2, Copy, Check, Send, Users, Calendar, LogOut,
  AlertTriangle, X
} from 'lucide-react';
import { collection, query, orderBy, limit as firestoreLimit, onSnapshot, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import toast from 'react-hot-toast';

// Import tab components
import StandingsTab from './tabs/StandingsTab';
import MatchupsTab from './tabs/MatchupsTab';
import ChatTab from './tabs/ChatTab';
import ActivityTab from './tabs/ActivityTab';
import SettingsTab from './tabs/SettingsTab';
// OPTIMIZATION #9: Lazy-load heavy MatchupDetailView component (1058 lines)
const MatchupDetailView = lazy(() => import('./MatchupDetailView'));
import { useRivalries, isRivalry as checkRivalry } from '../../hooks/useLeagueNotifications';
import { useLeagueStats } from '../../hooks/useLeagueStats';
import { postLeagueMessage } from '../../firebase/functions';

// Quick Smack Talk Input - Compact inline form
const SmackTalkInput = ({ leagueId, userProfile, disabled = false }) => {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!message.trim() || sending) return;

    setSending(true);
    try {
      await postLeagueMessage({ leagueId, message: message.trim() });
      setMessage('');
      toast.success('Sent!');
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
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Talk trash..."
        className="flex-1 h-9 px-3 bg-[#111] border border-[#333] text-white placeholder:text-gray-600 focus:outline-none focus:border-[#444] text-sm"
        disabled={sending || disabled}
        maxLength={200}
      />
      <button
        type="submit"
        disabled={sending || !message.trim() || disabled}
        className="h-9 px-3 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold flex items-center gap-1.5 transition-colors text-sm"
      >
        <Send className="w-3.5 h-3.5" />
      </button>
    </form>
  );
};

// Leave League Confirmation Modal
const LeaveLeagueModal = ({ leagueName, onClose, onConfirm, isLoading }) => {
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <m.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-sm bg-[#1a1a1a] border border-[#333]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#333] bg-[#222]">
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-red-400 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5" />
            Leave League
          </h2>
          <button onClick={onClose} className="p-1 text-gray-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          <div className="w-10 h-10 mx-auto mb-3 bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <LogOut className="w-5 h-5 text-red-500" />
          </div>
          <div className="text-center mb-3">
            <p className="text-sm text-gray-400 mb-1">Are you sure?</p>
            <p className="text-base font-bold text-white">{leagueName}</p>
          </div>
          <div className="bg-red-500/10 border border-red-500/30 p-2.5">
            <p className="text-[11px] text-red-400 text-center">
              You'll lose access to standings, matchups, and chat history.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[#333] bg-[#222] flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="h-8 px-3 border border-[#333] text-gray-400 text-xs font-bold uppercase tracking-wider hover:border-[#444] hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="h-8 px-3 bg-red-600 text-white text-xs font-bold uppercase tracking-wider hover:bg-red-500 disabled:opacity-50 flex items-center gap-1.5"
          >
            {isLoading ? 'Leaving...' : <><LogOut className="w-3.5 h-3.5" />Leave</>}
          </button>
        </div>
      </m.div>
    </div>
  );
};

const LeagueDetailView = ({ league, userProfile, userId, onBack, onLeave }) => {
  const [activeTab, setActiveTab] = useState('standings');
  const [standings, setStandings] = useState([]);
  const [messages, setMessages] = useState([]);
  const [weeklyMatchups, setWeeklyMatchups] = useState({});
  const [weeklyResults, setWeeklyResults] = useState({});
  const [currentWeek, setCurrentWeek] = useState(1);
  const [memberProfiles, setMemberProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedMatchup, setSelectedMatchup] = useState(null);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [recaps, setRecaps] = useState([]);

  // Use auth userId directly for commissioner check (more reliable than profile.uid)
  const isCommissioner = league.creatorId === userId;

  const handleLeaveConfirm = async () => {
    setIsLeaving(true);
    try {
      await onLeave();
    } finally {
      setIsLeaving(false);
      setShowLeaveModal(false);
    }
  };

  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(league.inviteCode);
      setInviteCopied(true);
      toast.success('Invite code copied!');
      setTimeout(() => setInviteCopied(false), 2000);
    } catch {
      toast.success(`Code: ${league.inviteCode}`);
    }
  };

  // Calculate rivalries
  const rivalries = useRivalries(
    userProfile?.uid,
    league?.id,
    weeklyMatchups,
    weeklyResults,
    memberProfiles
  );

  // Calculate league-wide battle stats
  const { memberStats: leagueStats } = useLeagueStats({
    recaps,
    weeklyMatchups,
    memberIds: league?.members || [],
    currentWeek,
  });

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

        // Fetch season data
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

          // Try new subcollection format first, fallback to legacy single-document format
          const recapsCollectionRef = collection(db, 'fantasy_recaps', sData.seasonUid, 'days');
          const recapsSnapshot = await getDocs(recapsCollectionRef);

          let recapsData = [];
          if (!recapsSnapshot.empty) {
            recapsData = recapsSnapshot.docs.map(d => d.data());
          } else {
            // Fallback to legacy single-document format
            const legacyDocRef = doc(db, 'fantasy_recaps', sData.seasonUid);
            const legacyDoc = await getDoc(legacyDocRef);
            if (legacyDoc.exists()) {
              recapsData = legacyDoc.data().recaps || [];
            }
          }

          if (recapsData.length > 0) {
            setRecaps(recapsData); // Store for useLeagueStats hook
            const recaps = recapsData;
            const memberUids = new Set(league.members);
            const weeklyResults = {};
            const memberStats = {};

            league.members.forEach(uid => {
              memberStats[uid] = {
                uid,
                wins: 0,
                losses: 0,
                totalPoints: 0,
                weeklyScores: {},
                streak: 0,
                streakType: null,
                trend: 'same'
              };
            });

            recaps.forEach(dayRecap => {
              const weekNum = Math.ceil(dayRecap.offSeasonDay / 7);
              if (!weeklyResults[weekNum]) weeklyResults[weekNum] = {};

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

            // Fetch ACTUAL matchups from Firestore instead of generating client-side
            const matchupsPerWeek = {};
            const CORPS_CLASSES = ['worldClass', 'openClass', 'aClass', 'soundSport'];

            // Fetch all matchup documents for this league
            const matchupsCollectionRef = collection(db, `artifacts/marching-art/leagues/${league.id}/matchups`);
            const matchupsSnapshot = await getDocs(matchupsCollectionRef);

            matchupsSnapshot.forEach(matchupDoc => {
              const weekMatch = matchupDoc.id.match(/^week-(\d+)$/);
              if (!weekMatch) return;

              const weekNum = parseInt(weekMatch[1]);
              const matchupData = matchupDoc.data();

              // Convert class-based matchups to flat array format for useLeagueStats
              matchupsPerWeek[weekNum] = [];

              for (const corpsClass of CORPS_CLASSES) {
                const classMatchups = matchupData[`${corpsClass}Matchups`] || [];
                classMatchups.forEach(matchup => {
                  if (matchup.pair && matchup.pair[0] && matchup.pair[1]) {
                    matchupsPerWeek[weekNum].push({
                      user1: matchup.pair[0],
                      user2: matchup.pair[1],
                      winner: matchup.winner,
                      completed: matchup.completed,
                      scores: matchup.scores,
                      corpsClass
                    });
                  }
                });
              }
            });

            // If no matchups exist in Firestore, fall back to client-side generation
            // (This maintains backwards compatibility for leagues without generated matchups)
            if (Object.keys(matchupsPerWeek).length === 0) {
              const fallbackMatchups = generateMatchups(league.members, week);
              Object.assign(matchupsPerWeek, fallbackMatchups);
            }

            setWeeklyMatchups(matchupsPerWeek);
            setWeeklyResults(weeklyResults);

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

            const sortedStandings = Object.values(memberStats)
              .sort((a, b) => {
                if (b.wins !== a.wins) return b.wins - a.wins;
                return b.totalPoints - a.totalPoints;
              });

            // Calculate trend based on recent matchup performance (last 3 weeks)
            sortedStandings.forEach((stats, idx) => {
              stats.currentRank = idx + 1;

              // Get last 3 weeks of results for trend calculation
              const recentWeeks = Object.keys(stats.weeklyScores)
                .map(Number)
                .sort((a, b) => b - a)
                .slice(0, 3);

              let recentWins = 0;
              let recentLosses = 0;

              for (const weekNum of recentWeeks) {
                const matchups = matchupsPerWeek[weekNum] || [];
                const matchup = matchups.find(m => m.user1 === stats.uid || m.user2 === stats.uid);

                if (matchup) {
                  const myScore = weeklyResults[weekNum]?.[stats.uid] || 0;
                  const oppUid = matchup.user1 === stats.uid ? matchup.user2 : matchup.user1;
                  const oppScore = weeklyResults[weekNum]?.[oppUid] || 0;

                  if (myScore > oppScore) {
                    recentWins++;
                  } else if (oppScore > myScore) {
                    recentLosses++;
                  }
                }
              }

              // Determine trend based on recent performance
              if (recentWins > recentLosses) {
                stats.trend = 'up';
              } else if (recentLosses > recentWins) {
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

    return () => unsubMessages();
  }, [league]);

  // Fallback: Generate round-robin matchups client-side
  // Only used if no matchups exist in Firestore (backwards compatibility)
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
          matchups[week].push({ user1: members[idx1], user2: members[idx2] });
        }
      }
    }
    return matchups;
  };

  // Get user's current stats
  const userStats = useMemo(() => {
    return standings.find(s => s.uid === userProfile?.uid);
  }, [standings, userProfile]);

  // Get rivalry for selected matchup
  const getMatchupRivalry = (matchup) => {
    if (!userProfile?.uid) return null;
    const opponentId = matchup.user1 === userProfile.uid ? matchup.user2 :
                      matchup.user2 === userProfile.uid ? matchup.user1 : null;
    if (!opponentId) return null;
    return checkRivalry(rivalries, opponentId);
  };

  // If viewing matchup detail
  if (selectedMatchup) {
    return (
      <Suspense fallback={<div className="p-4 text-center text-zinc-400">Loading matchup...</div>}>
        <MatchupDetailView
          matchup={selectedMatchup}
          league={league}
          userProfile={userProfile}
          memberProfiles={memberProfiles}
          standings={standings}
          currentWeek={currentWeek}
          onBack={() => setSelectedMatchup(null)}
          rivalry={getMatchupRivalry(selectedMatchup)}
          recaps={recaps}
        />
      </Suspense>
    );
  }

  const tabs = [
    { id: 'standings', label: 'Standings', icon: BarChart3 },
    { id: 'matchups', label: 'Matchups', icon: Swords },
    { id: 'activity', label: 'Activity', icon: Bell },
    { id: 'chat', label: 'Chat', icon: MessageSquare, badge: messages.length > 0 },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#0a0a0a]">
      {/* FIXED HEADER - League Banner (Director Card Pattern) */}
      <div className="flex-shrink-0 bg-[#1a1a1a] border-b border-[#333]">
        {/* Top Bar: Back + Actions */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-[#222]">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors text-sm"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          <div className="flex items-center gap-2">
            {isCommissioner && (
              <button
                onClick={() => setActiveTab('settings')}
                className="p-1.5 bg-[#222] hover:bg-[#333] transition-colors"
              >
                <Settings className="w-4 h-4 text-gray-400" />
              </button>
            )}
            <button
              onClick={() => setShowLeaveModal(true)}
              className="p-1.5 bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 transition-colors"
              title="Leave League"
            >
              <LogOut className="w-4 h-4 text-red-500" />
            </button>
          </div>
        </div>

        {/* League Banner Content */}
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            {/* League Avatar */}
            <div className="w-12 h-12 bg-[#333] border border-[#444] flex-shrink-0 flex items-center justify-center">
              <Trophy className="w-6 h-6 text-yellow-500" />
            </div>

            {/* Name + Meta */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white truncate">{league.name}</h1>
                {isCommissioner && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-yellow-500/20 border border-yellow-500/30 text-yellow-500 text-[10px] font-bold">
                    <Crown className="w-2.5 h-2.5" />
                    Commish
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {league.members?.length || 0}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Wk {currentWeek}
                </span>
              </div>
            </div>

            {/* Invite Code Badge */}
            <button
              onClick={handleCopyInvite}
              className="hidden sm:flex items-center gap-2 px-3 py-2 bg-[#222] border border-[#333] hover:border-[#444] transition-colors"
            >
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wider text-gray-500">Invite Code</p>
                <p className="text-sm font-bold font-mono text-yellow-500">{league.inviteCode}</p>
              </div>
              {inviteCopied ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <Copy className="w-4 h-4 text-gray-500" />
              )}
            </button>

            {/* Your Stats - Desktop */}
            {userStats && (
              <div className="hidden md:flex items-center gap-1 border-l border-[#333] pl-3">
                <div className="px-2 py-1 bg-[#222] text-center min-w-[50px]">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500">Rank</p>
                  <p className="text-base font-bold text-white font-data tabular-nums">#{userStats.currentRank}</p>
                </div>
                <div className="px-2 py-1 bg-[#222] text-center min-w-[60px]">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500">Record</p>
                  <p className="text-base font-bold font-data tabular-nums">
                    <span className="text-green-500">{userStats.wins}</span>
                    <span className="text-gray-600">-</span>
                    <span className="text-red-500">{userStats.losses}</span>
                  </p>
                </div>
                {userStats.streak > 0 && (
                  <div className="px-2 py-1 bg-[#222] text-center min-w-[50px]">
                    <p className="text-[10px] uppercase tracking-wider text-gray-500">Streak</p>
                    <p className={`text-base font-bold font-data tabular-nums flex items-center justify-center gap-0.5 ${
                      userStats.streakType === 'W' ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {userStats.streakType === 'W' && <Flame className="w-3.5 h-3.5" />}
                      {userStats.streakType}{userStats.streak}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile Stats Strip */}
          {userStats && (
            <div className="flex md:hidden items-center gap-2 mt-3 pt-3 border-t border-[#222]">
              <div className="flex-1 px-2 py-1.5 bg-[#222] text-center">
                <p className="text-[10px] uppercase tracking-wider text-gray-500">Rank</p>
                <p className="text-sm font-bold text-white font-data tabular-nums">#{userStats.currentRank}</p>
              </div>
              <div className="flex-1 px-2 py-1.5 bg-[#222] text-center">
                <p className="text-[10px] uppercase tracking-wider text-gray-500">Record</p>
                <p className="text-sm font-bold font-data tabular-nums">
                  <span className="text-green-500">{userStats.wins}</span>
                  <span className="text-gray-600">-</span>
                  <span className="text-red-500">{userStats.losses}</span>
                </p>
              </div>
              {userStats.streak > 0 && (
                <div className="flex-1 px-2 py-1.5 bg-[#222] text-center">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500">Streak</p>
                  <p className={`text-sm font-bold font-data tabular-nums flex items-center justify-center gap-0.5 ${
                    userStats.streakType === 'W' ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {userStats.streakType === 'W' && <Flame className="w-3 h-3" />}
                    {userStats.streakType}{userStats.streak}
                  </p>
                </div>
              )}
              {/* Mobile Invite Code */}
              <button
                onClick={handleCopyInvite}
                className="flex-1 px-2 py-1.5 bg-[#222] text-center"
              >
                <p className="text-[10px] uppercase tracking-wider text-gray-500">Code</p>
                <p className="text-sm font-bold font-mono text-yellow-500">{league.inviteCode}</p>
              </button>
            </div>
          )}
        </div>

        {/* STICKY TABS */}
        <div className="flex border-t border-[#222]">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 font-bold text-sm transition-all relative ${
                  isActive
                    ? 'bg-[#0a0a0a] text-yellow-500 border-t-2 border-yellow-500'
                    : 'text-gray-500 hover:text-white hover:bg-[#222]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                {tab.badge && !isActive && (
                  <span className="w-1.5 h-1.5 rounded-sm bg-purple-500" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* SCROLLABLE CONTENT */}
      <div className="flex-1 overflow-y-auto min-h-0 scroll-smooth">
        <AnimatePresence mode="wait">
          {activeTab === 'standings' && (
            <StandingsTab
              key="standings"
              standings={standings}
              memberProfiles={memberProfiles}
              userProfile={userProfile}
              loading={loading}
              league={league}
              leagueStats={leagueStats}
              showLeaderboards={true}
              currentWeek={currentWeek}
              weeklyMatchups={weeklyMatchups}
              onMatchupClick={(matchup) => {
                if (matchup) {
                  setSelectedMatchup({
                    user1: matchup.user1,
                    user2: matchup.user2,
                    week: currentWeek,
                    isUserMatchup: matchup.user1 === userProfile?.uid || matchup.user2 === userProfile?.uid
                  });
                }
              }}
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
            <ActivityTab
              key="activity"
              league={league}
              userProfile={userProfile}
              standings={standings}
              memberProfiles={memberProfiles}
              leagueStats={leagueStats}
              rivalries={rivalries}
              weeklyMatchups={weeklyMatchups}
              weeklyResults={weeklyResults}
              currentWeek={currentWeek}
              onMatchupClick={(activity) => {
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
                }
              }}
              onChatOpen={() => setActiveTab('chat')}
            />
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
          {activeTab === 'settings' && isCommissioner && (
            <SettingsTab
              key="settings"
              league={league}
              userProfile={userProfile}
              currentWeek={currentWeek}
              onBack={() => setActiveTab('standings')}
            />
          )}
        </AnimatePresence>
      </div>

      {/* FIXED BOTTOM: Smack Talk Input - pb-14 clears mobile nav */}
      <div className="flex-shrink-0 bg-[#1a1a1a] border-t border-[#333] px-4 py-3 pb-14 md:pb-3 z-40">
        <SmackTalkInput leagueId={league.id} userProfile={userProfile} />
      </div>

      {/* Leave League Modal */}
      <AnimatePresence>
        {showLeaveModal && (
          <LeaveLeagueModal
            leagueName={league.name}
            onClose={() => setShowLeaveModal(false)}
            onConfirm={handleLeaveConfirm}
            isLoading={isLeaving}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default LeagueDetailView;
