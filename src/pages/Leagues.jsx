// =============================================================================
// LEAGUES HUB - LEAGUE DASHBOARD STYLE (Gold Standard Aligned)
// =============================================================================
// Dense league cards, 2-col discover grid, activity indicators
// Laws: No glow, no shadow, tight spacing, data-rich cards

import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Users, Trophy, Plus, Search, Crown, X, Zap,
  ChevronRight, TrendingUp, Swords, MessageCircle
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

// =============================================================================
// LEAGUE TYPE TAGS
// =============================================================================

const LEAGUE_TAGS = {
  competitive: { label: 'Competitive', color: 'text-red-400 bg-red-500/10' },
  casual: { label: 'Casual', color: 'text-green-400 bg-green-500/10' },
  roleplay: { label: 'Roleplay', color: 'text-purple-400 bg-purple-500/10' },
  dynasty: { label: 'Dynasty', color: 'text-yellow-400 bg-yellow-500/10' },
  weekly: { label: 'Weekly', color: 'text-blue-400 bg-blue-500/10' },
  public: { label: 'Public', color: 'text-gray-400 bg-white/5' },
};

const getLeagueTags = (league) => {
  const tags = [];
  if (league.isCompetitive || league.type === 'competitive') tags.push('competitive');
  else if (league.type === 'casual') tags.push('casual');
  if (league.isDynasty) tags.push('dynasty');
  if (league.isPublic) tags.push('public');
  if (tags.length === 0) tags.push('casual');
  return tags;
};

// =============================================================================
// RANK BADGE COMPONENT
// =============================================================================

const RankBadge = ({ rank, total }) => {
  if (!rank) return null;

  const isTop3 = rank <= 3;
  const isFirst = rank === 1;

  return (
    <div className={`
      flex flex-col items-center justify-center px-2
      ${isFirst ? 'text-yellow-400' : isTop3 ? 'text-green-400' : 'text-gray-400'}
    `}>
      <span className="text-lg font-bold font-data tabular-nums leading-tight">
        #{rank}
      </span>
      <span className="text-[9px] uppercase tracking-wider text-gray-500">
        of {total}
      </span>
    </div>
  );
};

// =============================================================================
// ACTIVITY INDICATOR
// =============================================================================

const ActivityIndicator = ({ hasNewMessages, isLive }) => {
  if (isLive) {
    return (
      <span className="flex items-center gap-1 px-1.5 py-0.5 bg-red-500/20 border border-red-500/30 rounded-sm">
        <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
        <span className="text-[9px] font-bold text-red-400 uppercase">Live</span>
      </span>
    );
  }
  if (hasNewMessages) {
    return (
      <span className="w-2 h-2 bg-green-500 rounded-full" title="New activity" />
    );
  }
  return null;
};

// =============================================================================
// MY LEAGUE CARD (High-Density)
// =============================================================================

const MyLeagueCard = ({ league, userProfile, onClick }) => {
  const memberCount = league.memberCount || league.members?.length || 0;
  const maxMembers = league.maxMembers || 20;
  const currentWeek = league.currentWeek || 1;

  // Find user's rank in this league
  const userRank = useMemo(() => {
    if (!league.members || !userProfile?.odNumber) return null;
    const sorted = [...league.members].sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));
    const idx = sorted.findIndex(m => m.odNumber === userProfile.odNumber);
    return idx >= 0 ? idx + 1 : null;
  }, [league.members, userProfile?.odNumber]);

  // Check for activity
  const hasNewMessages = league.hasUnreadMessages || false;
  const isLive = league.isMatchupActive || false;

  // Check if matchups are actually generated for current week
  // Only show matchup status if the league has this data from Firestore
  const hasMatchupsGenerated = league.matchupsGeneratedWeek >= currentWeek;

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 p-3 bg-[#1a1a1a] border border-[#333] hover:border-[#444] cursor-pointer transition-colors active:bg-[#222] press-feedback"
    >
      {/* League Avatar */}
      <div className="w-12 h-12 bg-[#333] border border-[#444] rounded-sm flex-shrink-0 flex items-center justify-center">
        <Trophy className="w-5 h-5 text-yellow-500" />
      </div>

      {/* League Info - Middle */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <h3 className="text-sm font-bold text-white truncate">{league.name}</h3>
          <ActivityIndicator hasNewMessages={hasNewMessages} isLive={isLive} />
        </div>
        <div className="flex items-center gap-2 text-[11px] text-gray-500">
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {memberCount}/{maxMembers}
          </span>
          <span className="text-gray-600">•</span>
          <span>Week {currentWeek}</span>
        </div>
        {hasMatchupsGenerated && (
          <div className="flex items-center gap-1 mt-1 text-[10px] text-gray-600">
            <Swords className="w-3 h-3" />
            <span>Matchup in progress</span>
          </div>
        )}
      </div>

      {/* Rank - Right */}
      <RankBadge rank={userRank} total={memberCount} />

      {/* Chevron */}
      <ChevronRight className="w-4 h-4 text-gray-600 flex-shrink-0" />
    </div>
  );
};

// =============================================================================
// DISCOVER LEAGUE CARD (Grid Style)
// =============================================================================

const DiscoverLeagueCard = ({ league, onJoin, isJoining }) => {
  const memberCount = league.memberCount || league.members?.length || 0;
  const maxMembers = league.maxMembers || 20;
  const isFull = memberCount >= maxMembers;
  const tags = getLeagueTags(league);

  return (
    <div className="bg-[#1a1a1a] border border-[#333] hover:border-[#444] transition-colors overflow-hidden">
      {/* Card Header */}
      <div className="px-3 py-2.5 border-b border-[#333]">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 bg-[#333] border border-[#444] rounded-sm flex-shrink-0 flex items-center justify-center">
              <Trophy className="w-4 h-4 text-yellow-500" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white truncate">{league.name}</h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                {tags.slice(0, 2).map(tag => {
                  const config = LEAGUE_TAGS[tag];
                  return (
                    <span
                      key={tag}
                      className={`px-1.5 py-0.5 text-[9px] font-bold uppercase ${config.color}`}
                    >
                      {config.label}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Card Body */}
      <div className="px-3 py-2 bg-[#111]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-[11px] text-gray-500">
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {memberCount}/{maxMembers}
            </span>
            {league.creatorName && (
              <span className="flex items-center gap-1 truncate max-w-[80px]">
                <Crown className="w-3 h-3 text-yellow-500/50" />
                <span className="truncate">{league.creatorName}</span>
              </span>
            )}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onJoin(league.id); }}
            disabled={isFull || isJoining}
            className={`px-3 py-1.5 text-[10px] font-bold uppercase transition-colors ${
              isFull
                ? 'bg-[#333] text-gray-500 cursor-not-allowed'
                : 'bg-[#0057B8] text-white hover:bg-[#0066d6] active:bg-[#004a9e]'
            }`}
          >
            {isFull ? 'Full' : 'Join'}
          </button>
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
    className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center"
    onClick={onClose}
  >
    <div
      className="w-full sm:max-w-sm bg-[#1a1a1a] border-t sm:border border-[#333] rounded-t-xl sm:rounded-sm"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Drag handle - mobile */}
      <div className="sm:hidden flex justify-center py-2">
        <div className="w-8 h-1 bg-gray-600 rounded-full" />
      </div>

      <div className="px-4 py-3 border-b border-[#333] bg-[#222] flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Join by Code</span>
        <button
          onClick={onClose}
          className="p-2 -mr-2 text-gray-500 hover:text-white min-w-touch min-h-touch flex items-center justify-center"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); onJoin(); }} className="p-4 space-y-3">
        <input
          type="text"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
          placeholder="XXXXXXXX"
          className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#444] text-center text-xl font-bold font-data text-white tracking-[0.3em] focus:outline-none focus:border-[#0057B8] placeholder:text-gray-600"
          maxLength={8}
          autoFocus
        />
        <button
          type="submit"
          disabled={isJoining || !inviteCode.trim()}
          className="w-full py-3 min-h-[44px] bg-[#0057B8] text-white font-bold text-sm hover:bg-[#0066d6] disabled:opacity-50 transition-colors"
        >
          {isJoining ? 'Joining...' : 'Join League'}
        </button>
      </form>
    </div>
  </div>
);

// =============================================================================
// EMPTY STATE COMPONENTS
// =============================================================================

const EmptyMyLeagues = ({ onCreate }) => (
  <div className="p-6 bg-[#1a1a1a] border-2 border-dashed border-[#333] text-center">
    <div className="w-12 h-12 bg-[#222] border border-[#333] rounded-sm mx-auto mb-3 flex items-center justify-center">
      <Trophy className="w-6 h-6 text-gray-600" />
    </div>
    <h3 className="text-sm font-bold text-white mb-1">No Leagues Yet</h3>
    <p className="text-xs text-gray-500 mb-4 max-w-[200px] mx-auto">
      Join a league to compete with other directors
    </p>
    <div className="flex items-center justify-center gap-2">
      <button
        onClick={onCreate}
        className="px-4 py-2 text-xs font-bold text-white bg-[#0057B8] hover:bg-[#0066d6] flex items-center gap-1.5"
      >
        <Plus className="w-3.5 h-3.5" />
        Create League
      </button>
    </div>
  </div>
);

const EmptyDiscover = ({ searchTerm }) => (
  <div className="col-span-2 p-6 bg-[#1a1a1a] border-2 border-dashed border-[#333] text-center">
    <Users className="w-8 h-8 text-gray-600 mx-auto mb-2" />
    <p className="text-sm text-gray-500">
      {searchTerm ? 'No leagues match your search' : 'No public leagues available'}
    </p>
    <p className="text-xs text-gray-600 mt-1">
      {searchTerm ? 'Try a different search term' : 'Create one to get started!'}
    </p>
  </div>
);

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
  const [joiningLeagueId, setJoiningLeagueId] = useState(null);

  // Hooks
  const { data: userProfile } = useProfile(user?.uid);
  const { data: myLeagues = [], isLoading: loadingMyLeagues, refetch: refetchMyLeagues } = useMyLeagues(user?.uid);
  const {
    data: publicLeaguesData,
    isLoading: loadingPublicLeagues,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = usePublicLeagues(12);

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
    setJoiningLeagueId(leagueId);
    try {
      await joinLeagueMutation.mutateAsync(leagueId);
      toast.success('Joined league!');
      refetchMyLeagues();
    } catch (error) {
      toast.error(error.message || 'Failed to join');
    } finally {
      setJoiningLeagueId(null);
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
    try {
      await leaveLeagueMutation.mutateAsync(leagueId);
      toast.success('Left league');
      setSelectedLeague(null);
    } catch (error) {
      toast.error(error.message || 'Failed to leave');
    }
  };

  // If league selected, show the LeagueDetailView
  if (selectedLeague) {
    return (
      <LeagueDetailView
        league={selectedLeague}
        userProfile={userProfile}
        userId={user?.uid}
        onBack={() => setSelectedLeague(null)}
        onLeave={() => handleLeaveLeague(selectedLeague.id)}
      />
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#0a0a0a]">
      {/* FIXED HEADER */}
      <div className="flex-shrink-0 bg-[#1a1a1a] border-b border-[#333] px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-[#0057B8]" />
            <div>
              <h1 className="text-sm font-bold text-white uppercase">Leagues</h1>
              <p className="text-[10px] text-gray-500">
                {myLeagues.length} active • {discoverLeagues.length} available
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowQuickJoin(true)}
              className="px-3 py-2 text-[10px] font-bold uppercase text-gray-400 border border-[#444] hover:text-white hover:border-[#555] min-h-[36px] transition-colors"
            >
              Join Code
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-3 py-2 text-[10px] font-bold uppercase text-white bg-[#0057B8] hover:bg-[#0066d6] flex items-center gap-1.5 min-h-[36px] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Create
            </button>
          </div>
        </div>
      </div>

      {/* SCROLLABLE CONTENT */}
      <div className="flex-1 overflow-y-auto min-h-0 scroll-momentum">
        {/* MY LEAGUES SECTION */}
        <section className="border-b border-[#333]">
          <div className="bg-[#222] px-4 py-3 border-b border-[#333] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-[#0057B8]" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                My Leagues
              </h2>
            </div>
            {myLeagues.length > 0 && (
              <span className="text-[10px] font-data tabular-nums text-gray-500">
                {myLeagues.length}
              </span>
            )}
          </div>

          {loadingMyLeagues ? (
            <div className="p-6 text-center">
              <div className="w-5 h-5 border-2 border-[#0057B8] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-gray-500">Loading leagues...</p>
            </div>
          ) : myLeagues.length === 0 ? (
            <EmptyMyLeagues onCreate={() => setShowCreateModal(true)} />
          ) : (
            <div className="divide-y divide-[#333]">
              {myLeagues.map((league) => (
                <MyLeagueCard
                  key={league.id}
                  league={league}
                  userProfile={userProfile}
                  onClick={() => setSelectedLeague(league)}
                />
              ))}
            </div>
          )}
        </section>

        {/* DISCOVER SECTION */}
        <section>
          <div className="bg-[#222] px-4 py-3 border-b border-[#333] flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Discover Leagues
            </h2>
            {discoverLeagues.length > 0 && (
              <span className="text-[10px] font-data tabular-nums text-gray-500">
                {discoverLeagues.length}
              </span>
            )}
          </div>

          {/* Search */}
          <div className="p-3 border-b border-[#333] bg-[#1a1a1a]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search leagues..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-[#0a0a0a] border border-[#444] text-sm text-white focus:outline-none focus:border-[#0057B8] placeholder:text-gray-600"
              />
            </div>
          </div>

          {/* League Grid */}
          <div className="p-3">
            {loadingPublicLeagues ? (
              <div className="p-6 text-center">
                <div className="w-5 h-5 border-2 border-[#0057B8] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs text-gray-500">Loading leagues...</p>
              </div>
            ) : discoverLeagues.length === 0 ? (
              <EmptyDiscover searchTerm={searchTerm} />
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {discoverLeagues.map((league) => (
                    <DiscoverLeagueCard
                      key={league.id}
                      league={league}
                      onJoin={handleJoinLeague}
                      isJoining={joiningLeagueId === league.id}
                    />
                  ))}
                </div>
                {hasNextPage && (
                  <div className="mt-4 text-center">
                    <button
                      onClick={() => fetchNextPage()}
                      disabled={isFetchingNextPage}
                      className="px-6 py-2.5 border border-[#333] text-gray-400 text-sm font-bold uppercase tracking-wider hover:border-[#444] hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isFetchingNextPage ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          Loading...
                        </span>
                      ) : (
                        'Load More Leagues'
                      )}
                    </button>
                  </div>
                )}
              </>
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
