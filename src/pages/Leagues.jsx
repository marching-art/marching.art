// src/pages/Leagues.jsx
// League Hub: The center of competition with improved discovery
import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Users, Trophy, Plus, Search, ChevronRight, AlertTriangle,
  RefreshCw, Crown, ArrowLeft, Flame, Filter, Ticket,
  TrendingUp, Sparkles, X, Check, SlidersHorizontal
} from 'lucide-react';
import { useAuth } from '../App';
import toast from 'react-hot-toast';
import BrandLogo from '../components/BrandLogo';

// Import React Query hooks
import {
  useMyLeagues,
  usePublicLeagues,
  useCreateLeague,
  useJoinLeague,
  useJoinLeagueByCode,
  useLeaveLeague
} from '../hooks/useLeagues';
import { useProfile } from '../hooks/useProfile';

// Import modular components
import { CreateLeagueModal, LeagueDetailView } from '../components/Leagues';
import LeagueHubCard from '../components/Leagues/LeagueHubCard';

// Filter options
const MEMBER_FILTERS = [
  { value: 'all', label: 'All Sizes' },
  { value: 'small', label: '4-8 members', min: 1, max: 8 },
  { value: 'medium', label: '9-14 members', min: 9, max: 14 },
  { value: 'large', label: '15+ members', min: 15, max: 999 }
];

const ACTIVITY_FILTERS = [
  { value: 'all', label: 'All Activity' },
  { value: 'active', label: 'Most Active' },
  { value: 'new', label: 'Recently Created' },
  { value: 'open', label: 'Has Open Spots' }
];

const Leagues = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [showQuickJoin, setShowQuickJoin] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [joiningByCode, setJoiningByCode] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [memberFilter, setMemberFilter] = useState('all');
  const [activityFilter, setActivityFilter] = useState('all');

  // React Query hooks
  const { data: userProfile } = useProfile(user?.uid);
  const {
    data: myLeagues = [],
    isLoading: loadingMyLeagues,
    error: myLeaguesError,
    isError: myLeaguesHasError,
    refetch: refetchMyLeagues
  } = useMyLeagues(user?.uid);
  const {
    data: publicLeaguesData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: loadingPublicLeagues,
    error: publicLeaguesError,
    isError: publicLeaguesHasError,
    refetch: refetchPublicLeagues
  } = usePublicLeagues(12);

  // Mutations
  const createLeagueMutation = useCreateLeague();
  const joinLeagueMutation = useJoinLeague(user?.uid);
  const joinByCodeMutation = useJoinLeagueByCode(user?.uid);
  const leaveLeagueMutation = useLeaveLeague(user?.uid);

  // Handle URL parameters (invite code or action)
  useEffect(() => {
    const joinCode = searchParams.get('join');
    const action = searchParams.get('action');

    if (joinCode) {
      setInviteCode(joinCode.toUpperCase());
      setShowQuickJoin(true);
      // Clear the URL parameter
      setSearchParams({});
    } else if (action === 'create') {
      setShowCreateModal(true);
      // Clear the URL parameter
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  // Flatten paginated public leagues data
  const availableLeagues = useMemo(() => {
    if (!publicLeaguesData?.pages) return [];
    return publicLeaguesData.pages.flatMap(page => page.data);
  }, [publicLeaguesData]);

  // Get user's corps class for recommendations
  const userCorpsClass = useMemo(() => {
    if (!userProfile?.corps) return null;
    const classes = Object.keys(userProfile.corps).filter(c => userProfile.corps[c]);
    return classes[0] || null;
  }, [userProfile]);

  // Filter out already joined leagues and apply search/filters
  const discoverLeagues = useMemo(() => {
    const myLeagueIds = new Set(myLeagues.map(l => l.id));
    let filtered = availableLeagues.filter(league => !myLeagueIds.has(league.id));

    // Apply search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(league =>
        league.name.toLowerCase().includes(term) ||
        league.description?.toLowerCase().includes(term)
      );
    }

    // Apply member count filter
    if (memberFilter !== 'all') {
      const filter = MEMBER_FILTERS.find(f => f.value === memberFilter);
      if (filter) {
        filtered = filtered.filter(league => {
          const count = league.memberCount || league.members?.length || 0;
          return count >= filter.min && count <= filter.max;
        });
      }
    }

    // Apply activity filter
    if (activityFilter === 'open') {
      filtered = filtered.filter(league => {
        const count = league.memberCount || league.members?.length || 0;
        const max = league.maxMembers || 20;
        return count < max;
      });
    } else if (activityFilter === 'new') {
      // Sort by creation date (most recent first)
      filtered = [...filtered].sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt);
        const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt);
        return dateB - dateA;
      });
    } else if (activityFilter === 'active') {
      // Sort by member activity/count
      filtered = [...filtered].sort((a, b) =>
        (b.memberCount || 0) - (a.memberCount || 0)
      );
    }

    return filtered;
  }, [availableLeagues, myLeagues, searchTerm, memberFilter, activityFilter]);

  // Recommended leagues based on corps class
  const recommendedLeagues = useMemo(() => {
    if (!userCorpsClass || discoverLeagues.length === 0) return [];

    // Find leagues that might be good fits
    // Priority: has open spots, medium-sized, active
    return [...discoverLeagues]
      .filter(league => {
        const count = league.memberCount || league.members?.length || 0;
        const max = league.maxMembers || 20;
        return count < max; // Must have open spots
      })
      .sort((a, b) => {
        // Prefer leagues with more members (more active)
        const scoreA = a.memberCount || 0;
        const scoreB = b.memberCount || 0;
        return scoreB - scoreA;
      })
      .slice(0, 3);
  }, [discoverLeagues, userCorpsClass]);

  // Featured leagues (top public leagues by member count)
  const featuredLeagues = useMemo(() => {
    return [...discoverLeagues]
      .sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0))
      .slice(0, 3);
  }, [discoverLeagues]);

  const handleCreateLeague = async (leagueData) => {
    try {
      const result = await createLeagueMutation.mutateAsync(leagueData);
      toast.success('League created successfully!', { icon: '🏆' });
      return result;
    } catch (error) {
      console.error('Error creating league:', error);
      toast.error(error.message || 'Failed to create league');
      throw error;
    }
  };

  const handleJoinLeague = async (leagueId) => {
    try {
      await joinLeagueMutation.mutateAsync(leagueId);
      toast.success('Joined league successfully!', { icon: '🎉' });
    } catch (error) {
      console.error('Error joining league:', error);
      toast.error(error.message || 'Failed to join league');
    }
  };

  const handleJoinByCode = async () => {
    if (!inviteCode.trim()) {
      toast.error('Please enter an invite code');
      return;
    }

    setJoiningByCode(true);
    try {
      // Join the league using the invite code
      await joinByCodeMutation.mutateAsync(inviteCode.trim().toUpperCase());
      toast.success('Joined league successfully!', { icon: '🎉' });
      setShowQuickJoin(false);
      setInviteCode('');
      refetchMyLeagues();
    } catch (error) {
      console.error('Error joining by code:', error);
      toast.error(error.message || 'Invalid invite code or league not found');
    } finally {
      setJoiningByCode(false);
    }
  };

  const handleLeaveLeague = async (leagueId) => {
    if (!window.confirm('Are you sure you want to leave this league?')) return;

    try {
      await leaveLeagueMutation.mutateAsync(leagueId);
      toast.success('Left league successfully');
      setSelectedLeague(null);
    } catch (error) {
      console.error('Error leaving league:', error);
      toast.error(error.message || 'Failed to leave league');
    }
  };

  const handleSelectLeague = (league) => {
    setSelectedLeague(league);
  };

  const hasActiveFilters = memberFilter !== 'all' || activityFilter !== 'all';
  const hasNoLeagues = myLeagues.length === 0 && !loadingMyLeagues;

  // If a league is selected, show the detail view
  if (selectedLeague) {
    return (
      <div className="flex flex-col h-full min-h-0">
        {/* Back Navigation */}
        <div className="flex-shrink-0 p-4 border-b border-cream-500/10 bg-charcoal-950/50">
          <button
            onClick={() => setSelectedLeague(null)}
            className="flex items-center gap-2 text-cream-400 hover:text-cream-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-display">Back to League Hub</span>
          </button>
        </div>

        {/* League Detail */}
        <div className="flex-1 min-h-0 overflow-y-auto hud-scroll">
          <LeagueDetailView
            league={selectedLeague}
            userProfile={userProfile}
            onBack={() => setSelectedLeague(null)}
            onLeave={() => handleLeaveLeague(selectedLeague.id)}
            embedded={true}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ================================================================
          LEAGUE HUB HEADER
          ================================================================ */}
      <div className="flex-shrink-0 p-4 md:p-6 border-b border-cream-500/10 bg-charcoal-950/50">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-display font-bold text-cream-100 uppercase tracking-wide">
              League Hub
            </h1>
            <p className="text-sm text-cream-500/60 mt-1 hidden sm:block">
              Compete against other directors
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setShowQuickJoin(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-cream-500/20 text-cream-400 font-display font-semibold text-sm hover:bg-cream-500/10 transition-colors"
            >
              <Ticket className="w-4 h-4" />
              <span className="hidden sm:inline">Join</span>
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gold-500 text-charcoal-900 font-display font-bold text-sm uppercase tracking-wide hover:bg-gold-400 transition-colors shadow-[0_0_15px_rgba(234,179,8,0.3)]"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Create</span>
            </button>
          </div>
        </div>
      </div>

      {/* ================================================================
          SCROLLABLE CONTENT
          ================================================================ */}
      <div className="flex-1 min-h-0 overflow-y-auto hud-scroll">
        <div className="p-4 md:p-6 space-y-8">

          {/* ============================================================
              MY LEAGUES SECTION - Prominently Displayed
              ============================================================ */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <Trophy className="w-5 h-5 text-gold-400" />
              <h2 className="text-lg font-display font-bold text-cream-100 uppercase tracking-wide">
                My Leagues
              </h2>
              {myLeagues.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-gold-500/20 text-gold-400 text-xs font-bold">
                  {myLeagues.length}
                </span>
              )}
            </div>

            {loadingMyLeagues ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="animate-pulse">
                  <BrandLogo className="w-10 h-10" color="text-gold-500" />
                </div>
                <p className="font-mono text-xs text-gold-500/50 uppercase tracking-wide">Loading your leagues...</p>
              </div>
            ) : myLeaguesHasError ? (
              <div className="text-center py-8 bg-charcoal-900/30 border border-cream-500/10 rounded-xl">
                <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                <p className="text-sm text-cream-500/60 mb-3">{myLeaguesError?.message || 'Error loading leagues'}</p>
                <button
                  onClick={() => refetchMyLeagues()}
                  className="text-xs text-gold-400 hover:text-gold-300 flex items-center gap-1 mx-auto"
                >
                  <RefreshCw className="w-3 h-3" />
                  Retry
                </button>
              </div>
            ) : hasNoLeagues ? (
              <div className="bg-gradient-to-br from-gold-500/5 to-charcoal-900/50 border-2 border-dashed border-gold-500/30 rounded-xl p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gold-500/10 flex items-center justify-center">
                  <Trophy className="w-8 h-8 text-gold-400" />
                </div>
                <h3 className="text-xl font-display font-bold text-cream-100 mb-2">
                  Join the Competition
                </h3>
                <p className="text-sm text-cream-500/60 mb-6 max-w-md mx-auto">
                  Leagues let you compete head-to-head with other directors. Track rankings, chat with rivals, and prove you're the best.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button
                    onClick={() => setShowQuickJoin(true)}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-cream-500/20 text-cream-300 font-display font-semibold hover:bg-cream-500/10 transition-colors"
                  >
                    <Ticket className="w-4 h-4" />
                    Enter Invite Code
                  </button>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-gold-500 text-charcoal-900 font-display font-bold uppercase tracking-wide hover:bg-gold-400 transition-colors shadow-[0_0_15px_rgba(234,179,8,0.3)]"
                  >
                    <Plus className="w-4 h-4" />
                    Create League
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {myLeagues.map((league, index) => (
                  <LeagueHubCard
                    key={league.id}
                    league={league}
                    userProfile={userProfile}
                    onClick={() => handleSelectLeague(league)}
                    rank={index + 1}
                    isMember={true}
                  />
                ))}
              </div>
            )}
          </section>

          {/* ============================================================
              RECOMMENDED LEAGUES (when user has corps but no leagues)
              ============================================================ */}
          {hasNoLeagues && recommendedLeagues.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <h2 className="text-lg font-display font-bold text-cream-100 uppercase tracking-wide">
                  Recommended for You
                </h2>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {recommendedLeagues.map(league => (
                  <RecommendedLeagueCard
                    key={league.id}
                    league={league}
                    onJoin={() => handleJoinLeague(league.id)}
                    isJoining={joinLeagueMutation.isPending}
                  />
                ))}
              </div>
            </section>
          )}

          {/* ============================================================
              DISCOVER LEAGUES SECTION
              ============================================================ */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Search className="w-5 h-5 text-cream-400" />
                <h2 className="text-lg font-display font-bold text-cream-100 uppercase tracking-wide">
                  Discover Leagues
                </h2>
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  showFilters || hasActiveFilters
                    ? 'bg-gold-500/20 text-gold-400 border border-gold-500/30'
                    : 'text-cream-400 hover:bg-cream-500/10 border border-transparent'
                }`}
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span className="hidden sm:inline">Filters</span>
                {hasActiveFilters && (
                  <span className="w-2 h-2 rounded-full bg-gold-400" />
                )}
              </button>
            </div>

            {/* Search & Filter Bar */}
            <div className="space-y-3 mb-6">
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-cream-500/40" />
                <input
                  type="text"
                  placeholder="Search leagues by name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-charcoal-900/50 border border-cream-500/20 rounded-xl text-sm text-cream-100 placeholder:text-cream-500/40 focus:outline-none focus:border-gold-500/50 transition-colors"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-cream-500/10 rounded"
                  >
                    <X className="w-4 h-4 text-cream-500/60" />
                  </button>
                )}
              </div>

              {/* Filter Options */}
              <AnimatePresence>
                {showFilters && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-charcoal-900/30 border border-cream-500/10 rounded-xl">
                      {/* Member Count Filter */}
                      <div>
                        <label className="block text-xs font-semibold text-cream-500/60 uppercase tracking-wider mb-2">
                          Size
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {MEMBER_FILTERS.map(filter => (
                            <button
                              key={filter.value}
                              onClick={() => setMemberFilter(filter.value)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                memberFilter === filter.value
                                  ? 'bg-gold-500/20 text-gold-400 border border-gold-500/30'
                                  : 'bg-charcoal-800 text-cream-400 border border-cream-500/10 hover:border-cream-500/30'
                              }`}
                            >
                              {filter.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Activity Filter */}
                      <div>
                        <label className="block text-xs font-semibold text-cream-500/60 uppercase tracking-wider mb-2">
                          Activity
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {ACTIVITY_FILTERS.map(filter => (
                            <button
                              key={filter.value}
                              onClick={() => setActivityFilter(filter.value)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                activityFilter === filter.value
                                  ? 'bg-gold-500/20 text-gold-400 border border-gold-500/30'
                                  : 'bg-charcoal-800 text-cream-400 border border-cream-500/10 hover:border-cream-500/30'
                              }`}
                            >
                              {filter.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Clear Filters */}
                      {hasActiveFilters && (
                        <div className="sm:col-span-2 pt-2 border-t border-cream-500/10">
                          <button
                            onClick={() => {
                              setMemberFilter('all');
                              setActivityFilter('all');
                            }}
                            className="text-xs text-cream-500/60 hover:text-cream-400 transition-colors"
                          >
                            Clear all filters
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Featured Leagues (when not searching/filtering) */}
            {!searchTerm && !hasActiveFilters && featuredLeagues.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Flame className="w-4 h-4 text-orange-400" />
                  <h3 className="text-sm font-display font-semibold text-cream-400 uppercase tracking-wide">
                    Featured
                  </h3>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  {featuredLeagues.map(league => (
                    <FeaturedLeagueCard
                      key={league.id}
                      league={league}
                      onJoin={() => handleJoinLeague(league.id)}
                      isJoining={joinLeagueMutation.isPending}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* All Discover Leagues */}
            {loadingPublicLeagues ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="animate-pulse">
                  <BrandLogo className="w-10 h-10" color="text-gold-500" />
                </div>
                <p className="font-mono text-xs text-gold-500/50 uppercase tracking-wide">Loading leagues...</p>
              </div>
            ) : publicLeaguesHasError ? (
              <div className="text-center py-8 bg-charcoal-900/30 border border-cream-500/10 rounded-xl">
                <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                <p className="text-sm text-cream-500/60 mb-3">{publicLeaguesError?.message || 'Error loading'}</p>
                <button
                  onClick={() => refetchPublicLeagues()}
                  className="text-xs text-gold-400 hover:text-gold-300 flex items-center gap-1 mx-auto"
                >
                  <RefreshCw className="w-3 h-3" />
                  Retry
                </button>
              </div>
            ) : discoverLeagues.length === 0 ? (
              <div className="text-center py-8 bg-charcoal-900/30 border border-cream-500/10 rounded-xl">
                <Users className="w-10 h-10 text-cream-500/20 mx-auto mb-3" />
                <p className="text-sm text-cream-500/60">
                  {searchTerm || hasActiveFilters
                    ? 'No leagues match your search or filters'
                    : 'No public leagues available'}
                </p>
                {(searchTerm || hasActiveFilters) && (
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setMemberFilter('all');
                      setActivityFilter('all');
                    }}
                    className="mt-3 text-xs text-gold-400 hover:text-gold-300"
                  >
                    Clear search & filters
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Results count */}
                {(searchTerm || hasActiveFilters) && (
                  <p className="text-xs text-cream-500/60 mb-3">
                    Showing {discoverLeagues.length} league{discoverLeagues.length !== 1 ? 's' : ''}
                  </p>
                )}

                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {discoverLeagues.map(league => (
                    <DiscoverLeagueCard
                      key={league.id}
                      league={league}
                      onJoin={() => handleJoinLeague(league.id)}
                      isJoining={joinLeagueMutation.isPending}
                    />
                  ))}
                </div>

                {/* Load More */}
                {hasNextPage && !searchTerm && (
                  <div className="mt-6 text-center">
                    <button
                      onClick={() => fetchNextPage()}
                      disabled={isFetchingNextPage}
                      className="px-6 py-2 text-sm text-cream-400 hover:text-cream-100 border border-cream-500/20 rounded-lg hover:border-cream-500/40 transition-colors disabled:opacity-50"
                    >
                      {isFetchingNextPage ? 'Loading...' : 'Load More Leagues'}
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>

      {/* Quick Join Modal */}
      <AnimatePresence>
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
      </AnimatePresence>

      {/* Create League Modal */}
      {showCreateModal && (
        <CreateLeagueModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateLeague}
        />
      )}
    </div>
  );
};

// Quick Join Modal Component
const QuickJoinModal = ({ inviteCode, setInviteCode, onJoin, onClose, isJoining }) => {
  const handleSubmit = (e) => {
    e.preventDefault();
    onJoin();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-sm bg-charcoal-900 border border-cream-500/20 rounded-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <Ticket className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-display font-bold text-cream-100">
                Quick Join
              </h2>
              <p className="text-xs text-cream-500/60">Enter your invite code</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-cream-500/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-cream-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-cream-500/60 uppercase tracking-wider mb-2">
              Invite Code
            </label>
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="e.g., ABC123"
              className="w-full px-4 py-3 bg-charcoal-950 border-2 border-dashed border-cream-500/30 rounded-xl text-center text-xl font-mono font-bold text-cream-100 placeholder:text-cream-500/30 tracking-widest focus:outline-none focus:border-gold-500/50 transition-colors"
              maxLength={8}
              autoFocus
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isJoining}
              className="flex-1 px-4 py-3 border border-cream-500/20 rounded-xl text-cream-400 font-display font-semibold hover:bg-cream-500/10 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isJoining || !inviteCode.trim()}
              className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-xl font-display font-bold hover:bg-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isJoining ? 'Joining...' : 'Join League'}
            </button>
          </div>
        </form>

        <p className="text-xs text-cream-500/40 text-center mt-4">
          Ask a league admin for the invite code
        </p>
      </motion.div>
    </motion.div>
  );
};

// Recommended League Card - Highlighted for personalized suggestions
const RecommendedLeagueCard = ({ league, onJoin, isJoining }) => {
  const memberCount = league.memberCount || league.members?.length || 0;
  const maxMembers = league.maxMembers || 20;
  const isFull = memberCount >= maxMembers;
  const spotsLeft = maxMembers - memberCount;

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="bg-gradient-to-br from-purple-500/10 to-charcoal-900/50 border border-purple-500/30 rounded-xl p-4"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h4 className="font-display font-bold text-cream-100 text-sm truncate">
              {league.name}
            </h4>
            <div className="flex items-center gap-1 text-xs text-cream-500/60">
              <Users className="w-3 h-3" />
              <span>{memberCount}/{maxMembers}</span>
              {spotsLeft <= 3 && spotsLeft > 0 && (
                <span className="text-orange-400 ml-1">• {spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} left</span>
              )}
            </div>
          </div>
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onJoin?.();
        }}
        disabled={isFull || isJoining}
        className="w-full py-2 text-xs font-display font-bold uppercase tracking-wide rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isFull ? 'Full' : 'Join'}
      </button>
    </motion.div>
  );
};

// Featured League Card - Compact horizontal card for featured section
const FeaturedLeagueCard = ({ league, onJoin, isJoining }) => {
  const memberCount = league.memberCount || league.members?.length || 0;
  const maxMembers = league.maxMembers || 20;
  const isFull = memberCount >= maxMembers;

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="bg-gradient-to-br from-orange-500/10 to-charcoal-900/50 border border-orange-500/30 rounded-xl p-4 cursor-pointer"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
            <Trophy className="w-4 h-4 text-orange-400" />
          </div>
          <div>
            <h4 className="font-display font-bold text-cream-100 text-sm truncate">
              {league.name}
            </h4>
            <div className="flex items-center gap-1 text-xs text-cream-500/60">
              <Users className="w-3 h-3" />
              <span>{memberCount}/{maxMembers}</span>
            </div>
          </div>
        </div>
        <Flame className="w-4 h-4 text-orange-400" />
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onJoin?.();
        }}
        disabled={isFull || isJoining}
        className="w-full py-2 text-xs font-display font-bold uppercase tracking-wide rounded-lg bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isFull ? 'Full' : 'Join'}
      </button>
    </motion.div>
  );
};

// Discover League Card - Standard card for browse grid
const DiscoverLeagueCard = ({ league, onJoin, isJoining }) => {
  const memberCount = league.memberCount || league.members?.length || 0;
  const maxMembers = league.maxMembers || 20;
  const isFull = memberCount >= maxMembers;
  const spotsLeft = maxMembers - memberCount;
  const fillPercent = Math.round((memberCount / maxMembers) * 100);

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      className="bg-charcoal-900/30 border border-cream-500/10 rounded-xl p-4 hover:border-cream-500/30 transition-all"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-charcoal-800 flex items-center justify-center flex-shrink-0">
          <Trophy className="w-5 h-5 text-cream-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-display font-bold text-cream-100 text-sm truncate">
            {league.name}
          </h4>
          <p className="text-xs text-cream-500/60 line-clamp-1 mt-0.5">
            {league.description || 'No description'}
          </p>
        </div>
      </div>

      {/* Member Progress Bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs text-cream-500/60 mb-1">
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            <span>{memberCount}/{maxMembers} members</span>
          </div>
          {spotsLeft <= 5 && spotsLeft > 0 && (
            <span className="text-orange-400">{spotsLeft} left</span>
          )}
        </div>
        <div className="h-1.5 bg-charcoal-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              fillPercent >= 90 ? 'bg-orange-500' : fillPercent >= 70 ? 'bg-gold-500' : 'bg-green-500'
            }`}
            style={{ width: `${fillPercent}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-cream-500/60">
          <div className="flex items-center gap-1">
            <Trophy className="w-3 h-3 text-gold-500" />
            <span>{league.settings?.prizePool || 1000}</span>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onJoin?.();
          }}
          disabled={isFull || isJoining}
          className="px-4 py-1.5 text-xs font-display font-bold uppercase tracking-wide rounded-lg bg-gold-500/20 text-gold-400 hover:bg-gold-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isFull ? 'Full' : 'Join'}
        </button>
      </div>
    </motion.div>
  );
};

export default Leagues;
