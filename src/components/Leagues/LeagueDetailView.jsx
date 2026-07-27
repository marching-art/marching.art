// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// LeagueDetailView - Command Center for league competition
// Design System: App Shell layout with fixed header, sticky tabs, scrollable content
//
// This file is orchestration and render only. Loading lives in
// hooks/useLeagueDetail (four React Query entries + a memoized table
// computation), the live feeds live in hooks/useLeagueLiveStandings and
// hooks/useLeagueChat, and the table math itself lives in utils/leagueStats.

import React, { useState, useMemo, lazy, Suspense } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Swords, MessageSquare, BarChart3, Bell } from 'lucide-react';
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
import { useLeagueInviteCode } from '../../hooks/useLeagues';
import { useLeagueStats } from '../../hooks/useLeagueStats';
import { useLeagueDetail } from '../../hooks/useLeagueDetail';
import { useLeagueLiveStandings } from '../../hooks/useLeagueLiveStandings';
import { useLeagueChat } from '../../hooks/useLeagueChat';
import { SmackTalkInput, LeaveLeagueModal } from './LeagueDetailViewParts';
import LeagueDetailHeader from './LeagueDetailHeader';
import LeaguePoolCard from './LeaguePoolCard';

const LeagueDetailView = ({ league, userProfile, userId, onBack, onLeave }) => {
  const [activeTab, setActiveTab] = useState('standings');
  const [selectedMatchup, setSelectedMatchup] = useState(null);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);

  // Use auth userId directly for commissioner check (more reliable than profile.uid)
  const isCommissioner = league.creatorId === userId;

  const {
    memberProfiles,
    recaps,
    currentWeek,
    weeklyMatchups,
    weeklyResults,
    computedStandings,
    loading,
    loadError,
    retry,
  } = useLeagueDetail(league);

  // The backend standings document is authoritative; the computed table is a
  // fallback for a league whose first week hasn't resolved yet. These used to
  // race each other last-writer-wins, so a member's record changed on its own.
  const {
    standings,
    lastUpdated: standingsLastUpdated,
    isProvisional: standingsProvisional,
  } = useLeagueLiveStandings(league?.id, computedStandings);

  // Real-time chat (api helper: newest 50, delivered oldest-first)
  const messages = useLeagueChat(league?.id);

  const handleLeaveConfirm = async () => {
    setIsLeaving(true);
    try {
      await onLeave();
    } finally {
      setIsLeaving(false);
      setShowLeaveModal(false);
    }
  };

  const inviteCode = useLeagueInviteCode(league);

  const handleCopyInvite = async () => {
    if (!inviteCode) return;
    try {
      await navigator.clipboard.writeText(inviteCode);
      setInviteCopied(true);
      toast.success('Invite code copied!');
      setTimeout(() => setInviteCopied(false), 2000);
    } catch {
      toast.success(`Code: ${inviteCode}`);
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
      <LeagueDetailHeader
        leagueName={league.name}
        memberCount={league.members?.length || 0}
        currentWeek={currentWeek}
        isCommissioner={isCommissioner}
        inviteCode={inviteCode}
        inviteCopied={inviteCopied}
        userStats={userStats}
        tabs={tabs}
        activeTab={activeTab}
        onBack={onBack}
        onOpenSettings={() => setActiveTab('settings')}
        onLeaveClick={() => setShowLeaveModal(true)}
        onCopyInvite={handleCopyInvite}
        onTabChange={setActiveTab}
      />

      {/* SCROLLABLE CONTENT */}
      <div
        className="flex-1 overflow-y-auto min-h-0 scroll-smooth"
        id="league-tabpanel"
        role="tabpanel"
        aria-labelledby={`league-tab-${activeTab}`}
      >
        {/* Load failure: previously the league just rendered blank. Give the
            member a clear error + retry instead of silent empty standings. */}
        {loadError && !loading && (
          <div className="mx-4 mt-4 p-4 bg-red-500/10 border border-red-500/30 text-center">
            <p className="text-sm text-red-300 mb-3">We couldn't load this league's data.</p>
            <button
              onClick={retry}
              className="inline-flex items-center gap-2 px-4 py-2 bg-interactive text-white font-semibold text-sm hover:bg-interactive/90 transition-colors"
            >
              Retry
            </button>
          </div>
        )}
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
              isProvisional={standingsProvisional}
              playoffSize={league.settings?.playoffSize || league.settings?.finalsSize || 4}
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
              memberProfiles={memberProfiles}
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
