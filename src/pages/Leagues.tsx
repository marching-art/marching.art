// =============================================================================
// LEAGUES HUB - LEAGUE DASHBOARD STYLE (Gold Standard Aligned)
// =============================================================================
// Dense league cards, 2-col discover grid, activity indicators
// Laws: No glow, no shadow, tight spacing, data-rich cards

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Users,
  Trophy,
  Plus,
  Search,
  Crown,
  Zap,
  ChevronRight,
  Swords,
  Sprout,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  useMyLeagues,
  usePublicLeagues,
  useCreateLeague,
  useJoinLeague,
  useJoinLeagueByCode,
  useLeaveLeague,
  useLeague,
} from '../hooks/useLeagues';
import { useProfileStore } from '../store/profileStore';
import { useSeasonStore } from '../store/seasonStore';
import { CreateLeagueModal, LeagueDetailView } from '../components/Leagues';
import { PullToRefresh } from '../components/ui/PullToRefresh';
import type { League } from '../types';
import { EmptyDiscover, EmptyMyLeagues, QuickJoinModal } from './LeaguesParts';
import type { ProfileDoc } from '../store/profileStore';
import {
  getRosterSize,
  getActiveMemberCount,
  isMemberActive,
  isLeagueDormant,
  needsCorpsSetup,
} from '../utils/leagueActivity';

// =============================================================================
// LEAGUE TYPE TAGS
// =============================================================================

/**
 * A league as the cards read it: the canonical document plus the two display
 * fields the list layers on (`creatorName`, and the legacy activity flags).
 */
type LeagueCardDoc = Partial<League> & {
  /** Layered on by the discovery list, not stored on the document. */
  creatorName?: string;
  /** Legacy display flags. Nothing writes these; both read as false. */
  hasUnreadMessages?: boolean;
  isMatchupActive?: boolean;
  matchupsGeneratedWeek?: number;
};

const LEAGUE_TAGS: Record<string, { label: string; color: string }> = {
  competitive: { label: 'Competitive', color: 'text-red-400 bg-red-500/10' },
  casual: { label: 'Casual', color: 'text-green-400 bg-green-500/10' },
  roleplay: { label: 'Roleplay', color: 'text-purple-400 bg-purple-500/10' },
  dynasty: { label: 'Dynasty', color: 'text-secondary bg-surface-raised' },
  weekly: { label: 'Weekly', color: 'text-blue-400 bg-blue-500/10' },
  public: { label: 'Public', color: 'text-muted bg-white/5' },
  rookie: { label: 'Rookie', color: 'text-brand bg-brand/10' },
  // Not a commissioner-set vibe tag like the rest — derived below from the
  // league's live scoring format. A league whose weeks are decided on captions
  // is playing a different game, which is a reason to join THAT league.
  captionWars: { label: 'Caption Wars', color: 'text-purple-400 bg-purple-500/10' },
};

/** Filter chips over the discover grid, in the order they read best. */
const DISCOVER_FILTERS = ['competitive', 'casual', 'roleplay', 'dynasty', 'rookie'];

// `league.tag` is the taxonomy commissioners now set (updateLeagueSettings).
// This used to read isCompetitive / isDynasty / type — three fields that
// nothing in the codebase ever wrote — so every league in the browse grid
// rendered as "Casual", and discovery had no signal to filter on at all.
const getLeagueTags = (league: LeagueCardDoc) => {
  const tags: string[] = [];
  if (league.tag && LEAGUE_TAGS[league.tag]) tags.push(league.tag);
  // Both conditions, exactly as the server reads it: a format left over from a
  // previous season is not this season's format.
  if (
    league.settings?.scoringFormat === 'captionWars' &&
    league.seasonId &&
    league.settings?.scoringFormatSeasonUid === league.seasonId
  ) {
    tags.push('captionWars');
  }
  if (league.isRookieCircuit) tags.push('rookie');
  if (league.isPublic) tags.push('public');
  return tags;
};

// =============================================================================
// ACTIVITY INDICATOR
// =============================================================================

const ActivityIndicator = ({
  hasNewMessages,
  isLive,
}: {
  hasNewMessages?: boolean;
  isLive?: boolean;
}) => {
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

const MyLeagueCard = ({
  league,
  userProfile,
  currentWeek,
  onClick,
}: {
  league: LeagueCardDoc;
  userProfile?: ProfileDoc | null;
  currentWeek?: number;
  onClick?: () => void;
}) => {
  const memberCount = getRosterSize(league);
  const activeCount = getActiveMemberCount(league);
  const dormant = isLeagueDormant(league);
  const youArePlaying = isMemberActive(league, userProfile?.uid);
  const youNeedSetup = needsCorpsSetup(league, userProfile?.uid);
  const maxMembers = league.maxMembers || 20;

  // There used to be a rank badge here, computed by sorting `league.members`
  // on `totalScore` and looking for a member whose `odNumber` matched. But
  // `members` is an array of UID STRINGS: `m.totalScore` and `m.odNumber` are
  // both undefined on a string, so the sort was a no-op and the lookup always
  // returned -1. The badge rendered null on every card, for every director,
  // always. Deleted rather than typed around — the league card has no
  // standings loaded, so an honest rank would need a fetch this list
  // deliberately avoids.

  // Check for activity
  const hasNewMessages = Boolean(league.hasUnreadMessages);
  const isLive = Boolean(league.isMatchupActive);

  // Check if matchups are actually generated for current week
  // Only show matchup status if the league has this data from Firestore
  const hasMatchupsGenerated = (league.matchupsGeneratedWeek ?? 0) >= (currentWeek ?? 0);

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 p-3 bg-surface-card border border-line hover:border-line-strong cursor-pointer transition-colors active:bg-surface-raised press-feedback"
    >
      {/* League Avatar */}
      <div className="w-12 h-12 bg-line border border-line-strong rounded-none flex-shrink-0 flex items-center justify-center">
        <Trophy className="w-5 h-5 text-secondary" />
      </div>

      {/* League Info - Middle */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <h3 className="text-sm font-bold text-white truncate">{league.name}</h3>
          <ActivityIndicator hasNewMessages={hasNewMessages} isLive={isLive} />
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted">
          {/* Directors actually fielding a corps this season, not the roster
              size — a league can be full and still have nobody competing. */}
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {activeCount === null
              ? `${memberCount}/${maxMembers}`
              : `${activeCount}/${memberCount}`}
          </span>
          <span className="text-muted">•</span>
          <span>{activeCount === null ? 'members' : 'playing'}</span>
          <span className="text-muted">•</span>
          <span>Week {currentWeek}</span>
        </div>
        {/* Each of these is only shown when it is provably true of THIS
            director. Participation we haven't computed yet falls through to
            the normal matchup line — an un-backfilled league is not an empty
            one, and telling a competing director mid-season that their season
            hasn't started is worse than saying nothing. */}
        {youNeedSetup ? (
          <div className="flex items-center gap-1 mt-1 text-[10px] text-brand">
            <Sprout className="w-3 h-3" />
            <span>You haven&apos;t registered a corps this season</span>
          </div>
        ) : dormant ? (
          <div className="flex items-center gap-1 mt-1 text-[10px] text-brand">
            <Sprout className="w-3 h-3" />
            <span>No corps registered here yet this season</span>
          </div>
        ) : youArePlaying && activeCount === 1 ? (
          <div className="flex items-center gap-1 mt-1 text-[10px] text-muted">
            <Sprout className="w-3 h-3" />
            <span>Waiting on other members to set up their corps</span>
          </div>
        ) : (
          hasMatchupsGenerated && (
            <div className="flex items-center gap-1 mt-1 text-[10px] text-muted">
              <Swords className="w-3 h-3" />
              <span>Matchup in progress</span>
            </div>
          )
        )}
      </div>

      {/* Rank - Right. Ranking against directors who aren't playing is
          meaningless, so a dormant league shows no placement at all. */}

      {/* Chevron */}
      <ChevronRight className="w-4 h-4 text-muted flex-shrink-0" />
    </div>
  );
};

// =============================================================================
// DISCOVER LEAGUE CARD (Grid Style)
// =============================================================================

const DiscoverLeagueCard = ({
  league,
  onJoin,
  isJoining,
}: {
  league: LeagueCardDoc;
  onJoin?: (league: LeagueCardDoc) => void;
  isJoining?: boolean;
}) => {
  const memberCount = getRosterSize(league);
  const activeCount = getActiveMemberCount(league);
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
              <Trophy className="w-4 h-4 text-secondary" />
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
            {/* The headline number is how many directors are actually
                competing this season. Showing the roster instead is what made
                a league look thriving when nobody had registered a corps. */}
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3 text-green-500" />
              <span className="text-white font-bold">{activeCount ?? memberCount}</span>
              <span>{activeCount === null ? `/${maxMembers}` : `of ${memberCount} playing`}</span>
            </span>
            {!!league.creatorName && (
              <span className="flex items-center gap-1 truncate max-w-[80px]">
                <Crown className="w-3 h-3 text-muted" />
                <span className="truncate">{league.creatorName}</span>
              </span>
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onJoin?.(league);
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
// MAIN LEAGUES COMPONENT
// =============================================================================

const Leagues = () => {
  // Null outside AuthProvider is a supported case (see context/AuthContext).
  const user = useAuth()?.user;
  const [searchParams, setSearchParams] = useSearchParams();
  // The league being viewed lives in the URL, not in component state. That is
  // what makes a league linkable, bookmarkable, restorable on refresh, and
  // reachable from the champion notification the backend has always written as
  // /leagues/{leagueId}.
  const { leagueId: routeLeagueId, tab: routeTab } = useParams();
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [showQuickJoin, setShowQuickJoin] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [joiningByCode, setJoiningByCode] = useState(false);
  const [joiningLeagueId, setJoiningLeagueId] = useState<string | null>(null);

  // Hooks
  // Current user's profile comes from the global realtime store — no need for
  // a second one-shot read of the same document through react-query.
  const userProfile = useProfileStore((state) => state.profile);
  // The season week comes from the season store, the same source
  // LeagueDetailView uses. League documents carry no `currentWeek` field, so
  // the old `league.currentWeek || 1` was a fallback that could only ever
  // resolve to 1 — every card claimed Week 1 all season long.
  const currentWeek = useSeasonStore((s) => s.currentWeek);
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
  const createLeagueMutation = useCreateLeague(user?.uid);
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

  // Resolve the routed league. Prefer the copy already in "My Leagues" so
  // navigating from the list is instant, and fall back to a direct fetch for a
  // link opened cold — including a link to a league the viewer is not in.
  const routedFromMine = useMemo(
    () => (routeLeagueId ? myLeagues.find((l) => l.id === routeLeagueId) : null),
    [myLeagues, routeLeagueId]
  );
  const { data: fetchedLeague, isLoading: loadingRoutedLeague } = useLeague(
    routeLeagueId && !routedFromMine ? routeLeagueId : undefined
  );
  const selectedLeague = routedFromMine || fetchedLeague || null;

  const openLeague = useCallback(
    (league: LeagueCardDoc) => navigate(`/leagues/${league.id}`),
    [navigate]
  );
  const closeLeague = useCallback(() => navigate('/leagues'), [navigate]);

  // Flatten public leagues
  const availableLeagues = useMemo(() => {
    if (!publicLeaguesData?.pages) return [];
    return publicLeaguesData.pages.flatMap((page) => page.data);
  }, [publicLeaguesData]);

  // Discovery drops leagues with nobody registered this season, and it does so
  // AFTER the read (see getPublicLeagues). A page that happens to be all
  // dormant therefore comes back empty with more pages behind it — keep
  // pulling rather than stranding the user on an empty grid that has a full
  // one right behind it.
  useEffect(() => {
    if (availableLeagues.length === 0 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [availableLeagues.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Filter available leagues
  const discoverLeagues = useMemo(() => {
    const myLeagueIds = new Set(myLeagues.map((l) => l.id));
    let filtered = availableLeagues.filter((league) => !myLeagueIds.has(league.id));
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (league) =>
          league.name.toLowerCase().includes(term) ||
          (league.description || '').toLowerCase().includes(term)
      );
    }
    if (activeFilter) {
      filtered = filtered.filter((league) => getLeagueTags(league).includes(activeFilter));
    }
    return filtered;
  }, [availableLeagues, myLeagues, searchTerm, activeFilter]);

  // Handlers
  const handleCreateLeague = async (
    leagueData: Parameters<typeof createLeagueMutation.mutateAsync>[0]
  ) => {
    try {
      // Returned to the modal: it shows the server's real invite code on the
      // success screen. Never substitute a client-generated code — a made-up
      // code is worse than none, because friends who use it can't join.
      const result = await createLeagueMutation.mutateAsync(leagueData);
      toast.success('League created!');
      return result;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create league');
      throw error;
    }
  };

  const handleJoinLeague = async (leagueId: string) => {
    setJoiningLeagueId(leagueId);
    try {
      await joinLeagueMutation.mutateAsync(leagueId);
      toast.success('Joined league!');
      refetchMyLeagues();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to join');
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
      toast.error(error instanceof Error ? error.message : 'Invalid code');
    } finally {
      setJoiningByCode(false);
    }
  };

  const handleLeaveLeague = async (leagueId: string) => {
    try {
      await leaveLeagueMutation.mutateAsync(leagueId);
      toast.success('Left league');
      closeLeague();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to leave');
    }
  };

  // A routed league that is still loading, or that does not exist / is not
  // visible to this viewer. Silently redirecting would make a shared link look
  // broken, so say which it is.
  if (routeLeagueId && !selectedLeague) {
    if (loadingRoutedLeague || loadingMyLeagues) {
      return (
        <div className="h-full flex items-center justify-center bg-background">
          <div className="text-center">
            <div className="w-5 h-5 border-2 border-interactive border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs text-muted">Loading league…</p>
          </div>
        </div>
      );
    }
    return (
      <div className="h-full flex items-center justify-center bg-background px-6">
        <div className="p-6 bg-surface-card border-2 border-dashed border-line text-center max-w-sm">
          <Trophy className="w-8 h-8 text-muted mx-auto mb-3" />
          <h2 className="text-sm font-bold text-white mb-1">League not found</h2>
          <p className="text-xs text-muted mb-4">
            This league may have been dissolved, or it&apos;s private and you&apos;re not a member.
          </p>
          <button
            onClick={closeLeague}
            className="px-4 py-2 text-xs font-bold text-white bg-interactive hover:bg-interactive-hover"
          >
            Back to Leagues
          </button>
        </div>
      </div>
    );
  }

  // If league selected, show the LeagueDetailView
  if (selectedLeague) {
    return (
      <LeagueDetailView
        league={selectedLeague}
        userProfile={userProfile}
        userId={user?.uid}
        initialTab={routeTab}
        onTabChange={(tab) =>
          navigate(`/leagues/${selectedLeague.id}${tab === 'standings' ? '' : `/${tab}`}`, {
            replace: true,
          })
        }
        onBack={closeLeague}
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
                {myLeagues.length} joined • {discoverLeagues.length} available
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
                  currentWeek={currentWeek}
                  onClick={() => openLeague(league)}
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

            {/* Discovery had exactly one signal — a name search. These chips
                filter on the league type its commissioner set. */}
            <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-0.5">
              {DISCOVER_FILTERS.map((filter) => {
                const config = LEAGUE_TAGS[filter];
                const isActive = activeFilter === filter;
                return (
                  <button
                    key={filter}
                    onClick={() => setActiveFilter(isActive ? null : filter)}
                    aria-pressed={isActive}
                    className={`flex-shrink-0 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider border transition-colors ${
                      isActive
                        ? 'border-interactive text-white bg-interactive/10'
                        : 'border-line text-muted hover:border-line-strong hover:text-white'
                    }`}
                  >
                    {config.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* League Grid */}
          <div className="p-3">
            {loadingPublicLeagues ? (
              <div className="p-6 text-center">
                <div className="w-5 h-5 border-2 border-interactive border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs text-muted">Loading leagues...</p>
              </div>
            ) : (
              <>
                {discoverLeagues.length === 0 ? (
                  <EmptyDiscover searchTerm={searchTerm} hasFilter={!!activeFilter} />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {discoverLeagues.map((league) => (
                      <DiscoverLeagueCard
                        key={league.id}
                        league={league}
                        onJoin={(joined) => handleJoinLeague(joined.id || '')}
                        isJoining={joiningLeagueId === league.id}
                      />
                    ))}
                  </div>
                )}
                {/* Rendered alongside the empty state too: a page can filter
                    down to nothing and still have leagues behind it. */}
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
          onOpenLeague={(leagueId) => {
            setShowCreateModal(false);
            navigate(`/leagues/${leagueId}`);
          }}
        />
      )}
    </div>
  );
};

export default Leagues;
