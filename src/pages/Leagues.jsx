// =============================================================================
// LEAGUES - ESPN LEAGUE OFFICE STYLE
// =============================================================================
// League header, standings table, matchup scoreboard
// Laws: Dense, split grid, versus cards

import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Users, Trophy, Plus, Search, Crown, ArrowLeft,
  X, ChevronDown
} from 'lucide-react';
import { useAuth } from '../App';
import toast from 'react-hot-toast';
import {
  useMyLeagues,
  usePublicLeagues,
  useCreateLeague,
  useJoinLeague,
  useJoinLeagueByCode,
  useLeaveLeague
} from '../hooks/useLeagues';
import { useProfile } from '../hooks/useProfile';
import { CreateLeagueModal, LeagueDetailView } from '../components/Leagues';
import { DataTable } from '../components/ui/DataTable';

// =============================================================================
// STANDINGS TABLE COLUMNS
// =============================================================================

const standingsColumns = [
  {
    key: 'rank',
    header: 'RK',
    width: '40px',
    isRank: true,
  },
  {
    key: 'team',
    header: 'Team',
    render: (row) => (
      <span className="text-white font-medium truncate block max-w-[120px]">
        {row.displayName || row.name || 'Unknown'}
      </span>
    ),
  },
  {
    key: 'record',
    header: 'W-L',
    width: '60px',
    align: 'center',
    render: (row) => (
      <span className="text-gray-300 tabular-nums">
        {row.wins || 0}-{row.losses || 0}
      </span>
    ),
  },
  {
    key: 'points',
    header: 'Pts',
    width: '60px',
    align: 'right',
    render: (row) => (
      <span className="text-white font-bold tabular-nums">
        {(row.totalScore || row.points || 0).toFixed(1)}
      </span>
    ),
  },
];

// =============================================================================
// VERSUS CARD COMPONENT
// =============================================================================

const VersusCard = ({ matchup, currentUserId }) => {
  const team1 = matchup.team1 || {};
  const team2 = matchup.team2 || {};
  const isUserTeam1 = team1.userId === currentUserId;
  const isUserTeam2 = team2.userId === currentUserId;

  return (
    <div className="h-16 border border-[#333] flex">
      {/* Left Team */}
      <div className={`flex-1 p-2 flex items-center justify-between ${
        isUserTeam1 ? 'bg-[#0057B8]/10' : 'bg-black/50'
      }`}>
        <div className="min-w-0">
          <div className={`text-sm font-bold truncate ${isUserTeam1 ? 'text-[#0057B8]' : 'text-white'}`}>
            {team1.displayName || team1.name || 'TBD'}
          </div>
          <div className="text-[10px] text-gray-500 truncate">
            {team1.corpsName || ''}
          </div>
        </div>
        <div className="text-lg font-bold font-data tabular-nums text-white ml-2">
          {team1.score?.toFixed(1) || '-'}
        </div>
      </div>

      {/* Divider */}
      <div className="w-px bg-[#333] flex items-center justify-center">
        <div className="bg-[#222] px-1 text-[10px] text-gray-500 font-bold">VS</div>
      </div>

      {/* Right Team */}
      <div className={`flex-1 p-2 flex items-center justify-between ${
        isUserTeam2 ? 'bg-[#0057B8]/10' : 'bg-black/50'
      }`}>
        <div className="text-lg font-bold font-data tabular-nums text-white mr-2">
          {team2.score?.toFixed(1) || '-'}
        </div>
        <div className="min-w-0 text-right">
          <div className={`text-sm font-bold truncate ${isUserTeam2 ? 'text-[#0057B8]' : 'text-white'}`}>
            {team2.displayName || team2.name || 'TBD'}
          </div>
          <div className="text-[10px] text-gray-500 truncate">
            {team2.corpsName || ''}
          </div>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// LEAGUE OFFICE VIEW (when viewing a specific league)
// =============================================================================

const LeagueOfficeView = ({ league, userProfile, userId, onBack, onLeave }) => {
  // Get standings data
  const standings = useMemo(() => {
    if (!league?.members) return [];
    return league.members
      .map((member, idx) => ({
        ...member,
        rank: idx + 1,
        wins: member.wins || 0,
        losses: member.losses || 0,
      }))
      .sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0))
      .map((member, idx) => ({ ...member, rank: idx + 1 }));
  }, [league?.members]);

  // Get matchups (simulated for now)
  const matchups = useMemo(() => {
    if (!league?.members || league.members.length < 2) return [];
    const members = [...league.members];
    const result = [];
    for (let i = 0; i < members.length - 1; i += 2) {
      result.push({
        id: `${members[i].odNumber || i}-${members[i+1]?.odNumber || i+1}`,
        team1: members[i],
        team2: members[i + 1] || null,
        week: league.currentWeek || 1,
      });
    }
    return result.slice(0, 4); // Show top 4 matchups
  }, [league?.members, league?.currentWeek]);

  const commissioner = league?.creatorId === userId;
  const memberCount = league?.members?.length || 0;

  // Highlight user's row
  const highlightRow = (row) => row.odNumber === userProfile?.odNumber;

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Back Button */}
      <div className="bg-[#1a1a1a] border-b border-[#333] px-4 py-2">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-400 hover:text-white text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Leagues
        </button>
      </div>

      {/* LEAGUE HEADER - h-20 */}
      <div className="h-20 bg-[#1a1a1a] border-b border-[#333] p-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[#333] border border-[#444] flex items-center justify-center">
            <Trophy className="w-6 h-6 text-yellow-500" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">{league?.name || 'League'}</h1>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Crown className="w-3 h-3" />
                {league?.creatorName || 'Commissioner'}
              </span>
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {memberCount} members
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {commissioner && (
            <span className="px-2 py-1 bg-yellow-500/20 text-yellow-500 text-[10px] font-bold uppercase">
              Commissioner
            </span>
          )}
          <button
            onClick={onLeave}
            className="px-3 py-1.5 text-xs text-red-400 border border-red-500/30 hover:bg-red-500/10"
          >
            Leave
          </button>
        </div>
      </div>

      {/* CONTENT GRID - Split view */}
      <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
        {/* LEFT PANEL - Standings */}
        <div className="bg-[#1a1a1a] border border-[#333]">
          <div className="bg-[#222] px-3 py-2 border-b border-[#333]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Standings
            </span>
          </div>
          <DataTable
            columns={standingsColumns}
            data={standings}
            getRowKey={(row) => row.odNumber || row.userId}
            zebraStripes={true}
            highlightRow={highlightRow}
            emptyState={
              <div className="p-6 text-center text-gray-500 text-sm">
                No standings yet
              </div>
            }
          />
        </div>

        {/* RIGHT PANEL - Matchups */}
        <div className="bg-[#1a1a1a] border border-[#333]">
          <div className="bg-[#222] px-3 py-2 border-b border-[#333] flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Week {league?.currentWeek || 1} Matchups
            </span>
          </div>
          {matchups.length > 0 ? (
            <div className="divide-y divide-[#333]">
              {matchups.map((matchup) => (
                <VersusCard
                  key={matchup.id}
                  matchup={matchup}
                  currentUserId={userId}
                />
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-gray-500 text-sm">
              No matchups scheduled
            </div>
          )}
        </div>
      </div>

      {/* League Info */}
      <div className="w-full px-4 pb-4">
        <div className="bg-[#1a1a1a] border border-[#333] p-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">
            League Info
          </div>
          <p className="text-sm text-gray-400">
            {league?.description || 'No description provided.'}
          </p>
          {league?.inviteCode && commissioner && (
            <div className="mt-3 pt-3 border-t border-[#333]">
              <div className="text-[10px] text-gray-500 mb-1">Invite Code</div>
              <div className="text-sm font-bold font-data text-[#0057B8]">
                {league.inviteCode}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// QUICK JOIN MODAL
// =============================================================================

const QuickJoinModal = ({ inviteCode, setInviteCode, onJoin, onClose, isJoining }) => (
  <div
    className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
    onClick={onClose}
  >
    <div
      className="w-full max-w-sm bg-[#1a1a1a] border border-[#333]"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-3 py-2 border-b border-[#333] bg-[#222] flex items-center justify-between">
        <span className="text-xs font-bold uppercase text-gray-400">Join by Code</span>
        <button onClick={onClose} className="text-gray-500 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); onJoin(); }} className="p-4 space-y-4">
        <input
          type="text"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
          placeholder="Enter code..."
          className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#444] text-center text-xl font-bold font-data text-white tracking-widest focus:outline-none focus:border-[#0057B8]"
          maxLength={8}
          autoFocus
        />
        <button
          type="submit"
          disabled={isJoining || !inviteCode.trim()}
          className="w-full py-2 bg-[#0057B8] text-white font-bold text-sm hover:bg-[#0066d6] disabled:opacity-50"
        >
          {isJoining ? 'Joining...' : 'Join League'}
        </button>
      </form>
    </div>
  </div>
);

// =============================================================================
// LEAGUE CARD (for list view)
// =============================================================================

const LeagueCard = ({ league, onClick, isMember }) => {
  const memberCount = league.memberCount || league.members?.length || 0;
  const maxMembers = league.maxMembers || 20;

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 p-3 bg-[#1a1a1a] border border-[#333] hover:border-[#444] cursor-pointer"
    >
      <div className="w-10 h-10 bg-[#333] flex items-center justify-center flex-shrink-0">
        <Trophy className="w-5 h-5 text-yellow-500" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-white truncate">{league.name}</div>
        <div className="text-xs text-gray-500 flex items-center gap-2">
          <span>{memberCount}/{maxMembers} members</span>
          {isMember && <span className="text-green-500">Joined</span>}
        </div>
      </div>
      {!isMember && (
        <button className="px-3 py-1 text-xs font-bold text-[#0057B8] border border-[#0057B8]/30 hover:bg-[#0057B8]/10">
          Join
        </button>
      )}
    </div>
  );
};

// =============================================================================
// MAIN LEAGUES COMPONENT
// =============================================================================

const Leagues = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [showQuickJoin, setShowQuickJoin] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [joiningByCode, setJoiningByCode] = useState(false);

  // Hooks
  const { data: userProfile } = useProfile(user?.uid);
  const { data: myLeagues = [], isLoading: loadingMyLeagues, refetch: refetchMyLeagues } = useMyLeagues(user?.uid);
  const { data: publicLeaguesData, isLoading: loadingPublicLeagues } = usePublicLeagues(20);

  // Mutations
  const createLeagueMutation = useCreateLeague();
  const joinLeagueMutation = useJoinLeague(user?.uid);
  const joinByCodeMutation = useJoinLeagueByCode(user?.uid);
  const leaveLeagueMutation = useLeaveLeague(user?.uid);

  // Handle URL params
  useEffect(() => {
    const joinCode = searchParams.get('join');
    if (joinCode) {
      setInviteCode(joinCode.toUpperCase());
      setShowQuickJoin(true);
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  // Flatten public leagues
  const availableLeagues = useMemo(() => {
    if (!publicLeaguesData?.pages) return [];
    return publicLeaguesData.pages.flatMap(page => page.data);
  }, [publicLeaguesData]);

  // Filter available leagues
  const discoverLeagues = useMemo(() => {
    const myLeagueIds = new Set(myLeagues.map(l => l.id));
    let filtered = availableLeagues.filter(league => !myLeagueIds.has(league.id));
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(league => league.name.toLowerCase().includes(term));
    }
    return filtered;
  }, [availableLeagues, myLeagues, searchTerm]);

  // Handlers
  const handleCreateLeague = async (leagueData) => {
    try {
      await createLeagueMutation.mutateAsync(leagueData);
      toast.success('League created!');
    } catch (error) {
      toast.error(error.message || 'Failed to create league');
      throw error;
    }
  };

  const handleJoinLeague = async (leagueId) => {
    try {
      await joinLeagueMutation.mutateAsync(leagueId);
      toast.success('Joined league!');
    } catch (error) {
      toast.error(error.message || 'Failed to join');
    }
  };

  const handleJoinByCode = async () => {
    if (!inviteCode.trim()) return;
    setJoiningByCode(true);
    try {
      await joinByCodeMutation.mutateAsync(inviteCode.trim().toUpperCase());
      toast.success('Joined league!');
      setShowQuickJoin(false);
      setInviteCode('');
      refetchMyLeagues();
    } catch (error) {
      toast.error(error.message || 'Invalid code');
    } finally {
      setJoiningByCode(false);
    }
  };

  const handleLeaveLeague = async (leagueId) => {
    // Confirmation is now handled by LeaveLeagueModal in LeagueDetailView
    try {
      await leaveLeagueMutation.mutateAsync(leagueId);
      toast.success('Left league');
      setSelectedLeague(null);
    } catch (error) {
      toast.error(error.message || 'Failed to leave');
    }
  };

  // If league selected, show the enhanced LeagueDetailView
  if (selectedLeague) {
    return (
      <LeagueDetailView
        league={selectedLeague}
        userProfile={userProfile}
        onBack={() => setSelectedLeague(null)}
        onLeave={() => handleLeaveLeague(selectedLeague.id)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* HEADER */}
      <div className="bg-[#1a1a1a] border-b border-[#333] px-4 py-3">
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-[#0057B8]" />
            <h1 className="text-sm font-bold text-white uppercase">Leagues</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowQuickJoin(true)}
              className="px-3 py-1.5 text-xs font-bold text-gray-400 border border-[#444] hover:text-white hover:border-[#555]"
            >
              Join Code
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-3 py-1.5 text-xs font-bold text-white bg-[#0057B8] hover:bg-[#0066d6] flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              Create
            </button>
          </div>
        </div>
      </div>

      <div className="w-full p-4 space-y-6">
        {/* MY LEAGUES */}
        <section>
          <div className="bg-[#222] px-3 py-2 border border-[#333] border-b-0 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              My Leagues
            </span>
            {myLeagues.length > 0 && (
              <span className="text-[10px] text-gray-500">{myLeagues.length}</span>
            )}
          </div>
          <div className="border border-[#333] border-t-0">
            {loadingMyLeagues ? (
              <div className="p-6 text-center text-gray-500 text-sm">Loading...</div>
            ) : myLeagues.length === 0 ? (
              <div className="p-6 text-center">
                <Trophy className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-500 mb-3">No leagues yet</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="text-xs text-[#0057B8] hover:underline"
                >
                  Create or join a league
                </button>
              </div>
            ) : (
              <div className="divide-y divide-[#333]">
                {myLeagues.map((league) => (
                  <LeagueCard
                    key={league.id}
                    league={league}
                    onClick={() => setSelectedLeague(league)}
                    isMember={true}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* DISCOVER LEAGUES */}
        <section>
          <div className="bg-[#222] px-3 py-2 border border-[#333] border-b-0 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Discover
            </span>
          </div>
          <div className="border border-[#333] border-t-0">
            {/* Search */}
            <div className="p-3 border-b border-[#333]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search leagues..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-[#0a0a0a] border border-[#444] text-sm text-white focus:outline-none focus:border-[#0057B8]"
                />
              </div>
            </div>

            {loadingPublicLeagues ? (
              <div className="p-6 text-center text-gray-500 text-sm">Loading...</div>
            ) : discoverLeagues.length === 0 ? (
              <div className="p-6 text-center">
                <Users className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-500">
                  {searchTerm ? 'No leagues match your search' : 'No public leagues available'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#333]">
                {discoverLeagues.slice(0, 10).map((league) => (
                  <LeagueCard
                    key={league.id}
                    league={league}
                    onClick={() => handleJoinLeague(league.id)}
                    isMember={false}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* MODALS */}
      {showQuickJoin && (
        <QuickJoinModal
          inviteCode={inviteCode}
          setInviteCode={setInviteCode}
          onJoin={handleJoinByCode}
          onClose={() => { setShowQuickJoin(false); setInviteCode(''); }}
          isJoining={joiningByCode}
        />
      )}

      {showCreateModal && (
        <CreateLeagueModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateLeague}
        />
      )}
    </div>
  );
};

export default Leagues;
