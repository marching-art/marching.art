// =============================================================================
// LEAGUES HUB - LEAGUE DASHBOARD STYLE (Gold Standard Aligned)
// =============================================================================
// Dense league cards, 2-col discover grid, activity indicators
// Laws: No glow, no shadow, tight spacing, data-rich cards

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Users, Trophy, Plus, Search, Crown, X, Zap, ChevronRight, Swords } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  useMyLeagues,
  usePublicLeagues,
  useCreateLeague,
  useJoinLeague,
  useJoinLeagueByCode,
  useLeaveLeague,
} from '../hooks/useLeagues';
import { useProfileStore } from '../store/profileStore';
import { CreateLeagueModal, LeagueDetailView } from '../components/Leagues';
import { PullToRefresh } from '../components/ui/PullToRefresh';
import { useEscapeKey } from '../hooks/useEscapeKey';

// =============================================================================
// LEAGUE TYPE TAGS
// =============================================================================

const LEAGUE_TAGS = {
  competitive: { label: 'Competitive', color: 'text-red-400 bg-red-500/10' },
  casual: { label: 'Casual', color: 'text-green-400 bg-green-500/10' },
  roleplay: { label: 'Roleplay', color: 'text-purple-400 bg-purple-500/10' },
  dynasty: { label: 'Dynasty', color: 'text-yellow-400 bg-yellow-500/10' },
  weekly: { label: 'Weekly', color: 'text-blue-400 bg-blue-500/10' },
  public: { label: 'Public', color: 'text-muted bg-white/5' },
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
    <div
      className={`
      flex flex-col items-center justify-center px-2
      ${isFirst ? 'text-yellow-400' : isTop3 ? 'text-green-400' : 'text-muted'}
    `}
    >
      <span className="text-lg font-bold font-data tabular-nums leading-tight">#{rank}</span>
      <span className="text-[9px] uppercase tracking-wider text-muted">of {total}</span>
    </div>
  );
};

// =============================================================================
// ACTIVITY INDICATOR
// =============================================================================

const ActivityIndicator = ({ hasNewMessages, isLive }) => {
  if (isLive) {
    return (
      <span className="flex items-center gap-1 px-1.5 py-0.5 bg-red-500/20 border border-red-500/30 rounded-none">
        <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
        <span className="text-[9px] font-bold text-red-400 uppercase">Live</span>
      </span>
    );
  }
  if (hasNewMessages) {
    return <span className="w-2 h-2 bg-green-500 rounded-full" title="New activity" />;
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
    const idx = sorted.findIndex((m) => m.odNumber === userProfile.odNumber);
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
      className="flex items-center gap-3 p-3 bg-surface-card border border-line hover:border-line-strong cursor-pointer transition-colors active:bg-surface-raised press-feedback"
    >
      {/* League Avatar */}
      <div className="w-12 h-12 bg-line border border-line-strong rounded-none flex-shrink-0 flex items-center justify-center">
        <Trophy className="w-5 h-5 text-yellow-500" />
      </div>

      {/* League Info - Middle */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <h3 className="text-sm font-bold text-white truncate">{league.name}</h3>
          <ActivityIndicator hasNewMessages={hasNewMessages} isLive={isLive} />
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted">
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {memberCount}/{maxMembers}
          </span>
          <span className="text-muted">•</span>
          <span>Week {currentWeek}</span>
        </div>
        {hasMatchupsGenerated && (
          <div className="flex items-center gap-1 mt-1 text-[10px] text-muted">
            <Swords className="w-3 h-3" />
            <span>Matchup in progress</span>
          </div>
        )}
      </div>

      {/* Rank - Right */}
      <RankBadge rank={userRank} total={memberCount} />

      {/* Chevron */}
      <ChevronRight className="w-4 h-4 text-muted flex-shrink-0" />
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
    <div className="bg-surface-card border border-line hover:border-line-strong transition-colors overflow-hidden">
      {/* Card Header */}
      <div className="px-3 py-2.5 border-b border-line">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 bg-line border border-line-strong rounded-none flex-shrink-0 flex items-center justify-center">
              <Trophy className="w-4 h-4 text-yellow-500" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white truncate">{league.name}</h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                {tags.slice(0, 2).map((tag) => {
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
      <div className="px-3 py-2 bg-surface-sunken">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-[11px] text-muted">
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
            onClick={(e) => {
              e.stopPropagation();
              onJoin(league.id);
            }}
            disabled={isFull || isJoining}
            className={`px-4 min-h-touch text-[10px] font-bold uppercase transition-colors press-feedback ${
              isFull
                ? 'bg-line text-muted cursor-not-allowed'
                : 'bg-interactive text-white hover:bg-interactive-hover active:bg-interactive-subtle'
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

const QuickJoinModal = ({ inviteCode, setInviteCode, onJoin, onClose, isJoining }) => {
  useEscapeKey(onClose);
  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Join league by invite code"
    >
      <div
        className="w-full sm:max-w-sm bg-surface-card border-t sm:border border-line rounded-none sm:rounded-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle - mobile */}
        <div className="sm:hidden flex justify-center py-2">
          <div className="w-8 h-1 bg-charcoal-600 rounded-full" />
        </div>

        <div className="px-4 py-3 border-b border-line bg-surface-raised flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-muted">
            Join by Code
          </span>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-muted hover:text-white min-w-touch min-h-touch flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onJoin();
          }}
          className="p-4 space-y-3"
        >
          <input
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            placeholder="XXXXXXXX"
            className="w-full px-4 py-3 bg-background border border-line-strong text-center text-xl font-bold font-data text-white tracking-[0.3em] focus:outline-none focus:border-interactive placeholder:text-muted"
            maxLength={8}
            autoFocus
          />
          <button
            type="submit"
            disabled={isJoining || !inviteCode.trim()}
            className="w-full py-3 min-h-[44px] bg-interactive text-white font-bold text-sm hover:bg-interactive-hover disabled:opacity-50 transition-colors"
          >
            {isJoining ? 'Joining...' : 'Join League'}
          </button>
        </form>
      </div>
    </div>
  );
};

// =============================================================================
// EMPTY STATE COMPONENTS
// =============================================================================

const EmptyMyLeagues = ({ onCreate }) => (
  <div className="p-6 bg-surface-card border-2 border-dashed border-line text-center">
    <div className="w-12 h-12 bg-surface-raised border border-line rounded-none mx-auto mb-3 flex items-center justify-center">
      <Trophy className="w-6 h-6 text-muted" />
    </div>
    <h3 className="text-sm font-bold text-white mb-1">No Leagues Yet</h3>
    <p className="text-xs text-muted mb-4 max-w-[200px] mx-auto">
      Join a league to compete with other directors
    </p>
    <div className="flex items-center justify-center gap-2">
      <button
        onClick={onCreate}
        className="px-4 py-2 text-xs font-bold text-white bg-interactive hover:bg-interactive-hover flex items-center gap-1.5"
      >
        <Plus className="w-3.5 h-3.5" />
        Create League
      </button>
    </div>
  </div>
);

const EmptyDiscover = ({ searchTerm }) => (
  <div className="col-span-2 p-6 bg-surface-card border-2 border-dashed border-line text-center">
    <Users className="w-8 h-8 text-muted mx-auto mb-2" />
    <p className="text-sm text-muted">
      {searchTerm ? 'No leagues match your search' : 'No public leagues available'}
    </p>
    <p className="text-xs text-muted mt-1">
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
  // Current user's profile comes from the global realtime store — no need for
  // a second one-shot read of the same document through react-query.
  const userProfile = useProfileStore((state) => state.profile);
  const {
    data: myLeagues = [],
    isLoading: loadingMyLeagues,
    refetch: refetchMyLeagues,
  } = useMyLeagues(user?.uid);
  const {
    data: publicLeaguesData,
    isLoading: loadingPublicLeagues,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch: refetchPublicLeagues,
  } = usePublicLeagues(12);

  // Pull-to-refresh (mobile) — refresh both league lists together
  const handlePullRefresh = useCallback(async () => {
    await Promise.all([refetchMyLeagues(), refetchPublicLeagues()]);
  }, [refetchMyLeagues, refetchPublicLeagues]);

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
    return publicLeaguesData.pages.flatMap((page) => page.data);
  }, [publicLeaguesData]);

  // Filter available leagues
  const discoverLeagues = useMemo(() => {
    const myLeagueIds = new Set(myLeagues.map((l) => l.id));
    let filtered = availableLeagues.filter((league) => !myLeagueIds.has(league.id));
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((league) => league.name.toLowerCase().includes(term));
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
    <div className="h-full flex flex-col overflow-hidden bg-background">
      {/* FIXED HEADER */}
      <div className="flex-shrink-0 bg-surface-card border-b border-line px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-interactive" />
            <div>
              <h1 className="text-sm font-bold text-white uppercase">Leagues</h1>
              <p className="text-[10px] text-muted">
                {myLeagues.length} active • {discoverLeagues.length} available
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowQuickJoin(true)}
              className="px-3 py-2 text-[10px] font-bold uppercase text-muted border border-line-strong hover:text-white hover:border-line-strong min-h-touch transition-colors press-feedback"
            >
              Join Code
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-3 py-2 text-[10px] font-bold uppercase text-white bg-interactive hover:bg-interactive-hover flex items-center gap-1.5 min-h-touch transition-colors press-feedback"
            >
              <Plus className="w-3.5 h-3.5" />
              Create
            </button>
          </div>
        </div>
      </div>

      {/* SCROLLABLE CONTENT — pull down at the top to refresh both lists */}
      <PullToRefresh onRefresh={handlePullRefresh} className="flex-1 min-h-0">
        {/* MY LEAGUES SECTION */}
        <section className="border-b border-line">
          <div className="bg-surface-raised px-4 py-3 border-b border-line flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-interactive" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted">My Leagues</h2>
            </div>
            {myLeagues.length > 0 && (
              <span className="text-[10px] font-data tabular-nums text-muted">
                {myLeagues.length}
              </span>
            )}
          </div>

          {loadingMyLeagues ? (
            <div className="p-6 text-center">
              <div className="w-5 h-5 border-2 border-interactive border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-muted">Loading leagues...</p>
            </div>
          ) : myLeagues.length === 0 ? (
            <EmptyMyLeagues onCreate={() => setShowCreateModal(true)} />
          ) : (
            <div className="divide-y divide-line">
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
          <div className="bg-surface-raised px-4 py-3 border-b border-line flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted">
              Discover Leagues
            </h2>
            {discoverLeagues.length > 0 && (
              <span className="text-[10px] font-data tabular-nums text-muted">
                {discoverLeagues.length}
              </span>
            )}
          </div>

          {/* Search */}
          <div className="p-3 border-b border-line bg-surface-card">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="search"
                inputMode="search"
                placeholder="Search leagues..."
                aria-label="Search public leagues"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-11 pl-10 pr-4 bg-background border border-line-strong text-base text-white focus:outline-none focus:border-interactive placeholder:text-muted"
              />
            </div>
          </div>

          {/* League Grid */}
          <div className="p-3">
            {loadingPublicLeagues ? (
              <div className="p-6 text-center">
                <div className="w-5 h-5 border-2 border-interactive border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs text-muted">Loading leagues...</p>
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
                      className="px-6 py-2.5 border border-line text-muted text-sm font-bold uppercase tracking-wider hover:border-line-strong hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
      </PullToRefresh>

      {/* MODALS */}
      {showQuickJoin && (
        <QuickJoinModal
          inviteCode={inviteCode}
          setInviteCode={setInviteCode}
          onJoin={handleJoinByCode}
          onClose={() => {
            setShowQuickJoin(false);
            setInviteCode('');
          }}
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
