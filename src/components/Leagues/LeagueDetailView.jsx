// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// LeagueDetailView - Command Center for league competition
// Design System: App Shell layout with fixed header, sticky tabs, scrollable content

import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  Trophy,
  Crown,
  ChevronLeft,
  Settings,
  Swords,
  MessageSquare,
  BarChart3,
  Flame,
  Bell,
  Copy,
  Check,
  Users,
  Calendar,
  LogOut,
} from 'lucide-react';
import {
  subscribeToStandings,
  subscribeToChat,
  getMemberProfiles,
  getLeagueMatchups,
} from '../../api/leagues';
import { getSeasonData, getSeasonRecaps } from '../../api/season';
import { getSeasonProgress } from '../../utils/seasonProgress';
import { queryClient, queryKeys } from '../../lib/queryClient';
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
import { SmackTalkInput, LeaveLeagueModal } from './LeagueDetailViewParts';
import LeaguePoolCard from './LeaguePoolCard';
import { Heading } from '../ui';

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
  const [standingsLastUpdated, setStandingsLastUpdated] = useState(null);

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
        const profiles = await getMemberProfiles(league.members);
        setMemberProfiles(profiles);

        // Fetch season data
        const sData = await getSeasonData();
        let week = 1;

        if (sData) {
          // Shared 2AM-ET/UTC-normalized week math (utils/seasonProgress) —
          // a raw (now - startDate)/24h count here used to roll the week
          // over at midnight UTC (8 PM ET in summer), disagreeing with the
          // seasonStore and the nightly scorer every evening.
          week = Math.max(1, getSeasonProgress(sData).currentWeek);
          setCurrentWeek(week);

          // Subcollection format with legacy single-document fallback.
          // Read through the shared react-query cache entry (same key as the
          // Scores page / Dashboard full-archive fetch) so opening a league
          // reuses the already-downloaded season archive instead of
          // re-reading every day-doc on each league visit.
          const recapsData = await queryClient.fetchQuery({
            queryKey: queryKeys.fantasyRecaps(sData.seasonUid),
            queryFn: () => getSeasonRecaps(sData.seasonUid),
            // sData.seasonUid is always the *current* season here, so the
            // 5-minute freshness window applies (archived-season reads pin
            // staleTime: Infinity in useScoresData — past days are immutable).
            staleTime: 5 * 60 * 1000,
          });

          if (recapsData.length > 0) {
            setRecaps(recapsData); // Store for useLeagueStats hook
            const recaps = recapsData;
            const memberUids = new Set(league.members);
            const weeklyResults = {};
            const memberStats = {};

            league.members.forEach((uid) => {
              memberStats[uid] = {
                uid,
                wins: 0,
                losses: 0,
                totalPoints: 0,
                weeklyScores: {},
                streak: 0,
                streakType: null,
                trend: 'same',
              };
            });

            recaps.forEach((dayRecap) => {
              const weekNum = Math.ceil(dayRecap.offSeasonDay / 7);
              if (!weeklyResults[weekNum]) weeklyResults[weekNum] = {};

              dayRecap.shows?.forEach((show) => {
                show.results?.forEach((result) => {
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
            const matchupDocs = await getLeagueMatchups(league.id);

            matchupDocs.forEach((matchupData) => {
              const weekMatch = matchupData.id.match(/^week-(\d+)$/);
              if (!weekMatch) return;

              const weekNum = parseInt(weekMatch[1]);

              // Convert class-based matchups to flat array format for useLeagueStats
              matchupsPerWeek[weekNum] = [];

              for (const corpsClass of CORPS_CLASSES) {
                const classMatchups = matchupData[`${corpsClass}Matchups`] || [];
                classMatchups.forEach((matchup) => {
                  if (matchup.pair && matchup.pair[0] && matchup.pair[1]) {
                    matchupsPerWeek[weekNum].push({
                      user1: matchup.pair[0],
                      user2: matchup.pair[1],
                      winner: matchup.winner,
                      completed: matchup.completed,
                      scores: matchup.scores,
                      corpsClass,
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

              weekMatchups.forEach((matchup) => {
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
            Object.values(memberStats).forEach((stats) => {
              let streak = 0;
              let streakType = null;
              const weeks = Object.keys(stats.weeklyScores).sort(
                (a, b) => parseInt(b) - parseInt(a)
              );

              for (const weekNum of weeks) {
                const matchups = matchupsPerWeek[parseInt(weekNum)] || [];
                const matchup = matchups.find(
                  (m) => m.user1 === stats.uid || m.user2 === stats.uid
                );

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

            const sortedStandings = Object.values(memberStats).sort((a, b) => {
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
                const matchup = matchups.find(
                  (m) => m.user1 === stats.uid || m.user2 === stats.uid
                );

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

    // Real-time chat listener (api helper: newest 50, delivered oldest-first)
    const unsubMessages = subscribeToChat(league.id, (messagesData) => {
      setMessages(messagesData);
    });

    // Real-time standings listener for instant updates
    const unsubStandings = subscribeToStandings(
      league.id,
      (standingsData) => {
        if (standingsData && standingsData.length > 0) {
          // Backend standings are already sorted - use them directly
          setStandings(
            standingsData.map((s, idx) => ({
              ...s,
              currentRank: idx + 1,
              trend:
                s.streak > 2 && s.streakType === 'W'
                  ? 'up'
                  : s.streak > 2 && s.streakType === 'L'
                    ? 'down'
                    : 'same',
            }))
          );
          setStandingsLastUpdated(new Date());
        }
      },
      (error) => {
        console.error('Standings subscription error:', error);
      }
    );

    return () => {
      unsubMessages();
      unsubStandings();
    };
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
    return standings.find((s) => s.uid === userProfile?.uid);
  }, [standings, userProfile]);

  // Get rivalry for selected matchup
  const getMatchupRivalry = (matchup) => {
    if (!userProfile?.uid) return null;
    const opponentId =
      matchup.user1 === userProfile.uid
        ? matchup.user2
        : matchup.user2 === userProfile.uid
          ? matchup.user1
          : null;
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
    <div className="h-full flex flex-col overflow-hidden bg-background">
      {/* FIXED HEADER - League Banner (Director Card Pattern) */}
      <div className="flex-shrink-0 bg-surface-card border-b border-line">
        {/* Top Bar: Back + Actions */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-line-subtle">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-muted hover:text-white transition-colors text-sm"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          <div className="flex items-center gap-2">
            {isCommissioner && (
              <button
                onClick={() => setActiveTab('settings')}
                className="p-1.5 bg-surface-raised hover:bg-line transition-colors"
              >
                <Settings className="w-4 h-4 text-muted" />
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
            <div className="w-12 h-12 bg-line border border-line-strong flex-shrink-0 flex items-center justify-center">
              <Trophy className="w-6 h-6 text-secondary" />
            </div>

            {/* Name + Meta */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Heading level="title" as="h1" className="truncate">
                  {league.name}
                </Heading>
                {isCommissioner && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-surface-raised border border-line text-secondary text-[10px] font-bold">
                    <Crown className="w-2.5 h-2.5" />
                    Commish
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted mt-0.5">
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
              className="hidden sm:flex items-center gap-2 px-3 py-2 bg-surface-raised border border-line hover:border-line-strong transition-colors"
            >
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wider text-muted">Invite Code</p>
                <p className="text-sm font-bold font-mono text-interactive">{league.inviteCode}</p>
              </div>
              {inviteCopied ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <Copy className="w-4 h-4 text-muted" />
              )}
            </button>

            {/* Your Stats - Desktop */}
            {userStats && (
              <div className="hidden md:flex items-center gap-1 border-l border-line pl-3">
                <div className="px-2 py-1 bg-surface-raised text-center min-w-[50px]">
                  <p className="text-[10px] uppercase tracking-wider text-muted">Rank</p>
                  <p className="text-base font-bold text-white font-data tabular-nums">
                    #{userStats.currentRank}
                  </p>
                </div>
                <div className="px-2 py-1 bg-surface-raised text-center min-w-[60px]">
                  <p className="text-[10px] uppercase tracking-wider text-muted">Record</p>
                  <p className="text-base font-bold font-data tabular-nums">
                    <span className="text-green-500">{userStats.wins}</span>
                    <span className="text-muted">-</span>
                    <span className="text-red-500">{userStats.losses}</span>
                  </p>
                </div>
                {userStats.streak > 0 && (
                  <div className="px-2 py-1 bg-surface-raised text-center min-w-[50px]">
                    <p className="text-[10px] uppercase tracking-wider text-muted">Streak</p>
                    <p
                      className={`text-base font-bold font-data tabular-nums flex items-center justify-center gap-0.5 ${
                        userStats.streakType === 'W' ? 'text-green-500' : 'text-red-500'
                      }`}
                    >
                      {userStats.streakType === 'W' && <Flame className="w-3.5 h-3.5" />}
                      {userStats.streakType}
                      {userStats.streak}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile Stats Strip */}
          {userStats && (
            <div className="flex md:hidden items-center gap-2 mt-3 pt-3 border-t border-line-subtle">
              <div className="flex-1 px-2 py-1.5 bg-surface-raised text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted">Rank</p>
                <p className="text-sm font-bold text-white font-data tabular-nums">
                  #{userStats.currentRank}
                </p>
              </div>
              <div className="flex-1 px-2 py-1.5 bg-surface-raised text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted">Record</p>
                <p className="text-sm font-bold font-data tabular-nums">
                  <span className="text-green-500">{userStats.wins}</span>
                  <span className="text-muted">-</span>
                  <span className="text-red-500">{userStats.losses}</span>
                </p>
              </div>
              {userStats.streak > 0 && (
                <div className="flex-1 px-2 py-1.5 bg-surface-raised text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted">Streak</p>
                  <p
                    className={`text-sm font-bold font-data tabular-nums flex items-center justify-center gap-0.5 ${
                      userStats.streakType === 'W' ? 'text-green-500' : 'text-red-500'
                    }`}
                  >
                    {userStats.streakType === 'W' && <Flame className="w-3 h-3" />}
                    {userStats.streakType}
                    {userStats.streak}
                  </p>
                </div>
              )}
              {/* Mobile Invite Code */}
              <button
                onClick={handleCopyInvite}
                className="flex-1 px-2 py-1.5 bg-surface-raised text-center"
              >
                <p className="text-[10px] uppercase tracking-wider text-muted">Code</p>
                <p className="text-sm font-bold font-mono text-interactive">{league.inviteCode}</p>
              </button>
            </div>
          )}
        </div>

        {/* STICKY TABS */}
        <div className="flex border-t border-line-subtle">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 font-bold text-sm transition-all relative ${
                  isActive
                    ? 'bg-background text-interactive border-t-2 border-interactive'
                    : 'text-muted hover:text-white hover:bg-surface-raised'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                {tab.badge && !isActive && (
                  <span className="w-1.5 h-1.5 rounded-none bg-purple-500" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* SCROLLABLE CONTENT */}
      <div className="flex-1 overflow-y-auto min-h-0 scroll-smooth">
        {/* Daily prediction pool — the league's social side-pot, on the
            default tab where every member lands */}
        {activeTab === 'standings' && (
          <div className="px-4 pt-4">
            <LeaguePoolCard league={league} userProfile={userProfile} />
          </div>
        )}
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
              lastUpdated={standingsLastUpdated}
              onMatchupClick={(matchup) => {
                if (matchup) {
                  setSelectedMatchup({
                    user1: matchup.user1,
                    user2: matchup.user2,
                    week: currentWeek,
                    isUserMatchup:
                      matchup.user1 === userProfile?.uid || matchup.user2 === userProfile?.uid,
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
                    const matchup = matchups.find(
                      (m) => m.user1 === userProfile?.uid || m.user2 === userProfile?.uid
                    );
                    if (matchup) {
                      setSelectedMatchup({
                        ...matchup,
                        week: activity.metadata.week,
                        isUserMatchup: true,
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

      {/* FIXED BOTTOM: Smack Talk Input — Chat tab only. It used to render
          across every tab, so a member on Standings could type, send, get a
          success toast, and never see the message (it lands in the Chat tab).
          Sending now always happens where the conversation is visible.
          pb-14 clears mobile nav. */}
      {activeTab === 'chat' && (
        <div className="flex-shrink-0 bg-surface-card border-t border-line px-4 py-3 pb-14 md:pb-3 z-40">
          <SmackTalkInput leagueId={league.id} userProfile={userProfile} />
        </div>
      )}

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
