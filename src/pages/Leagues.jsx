// src/pages/Leagues.jsx
// League Hub: The center of competition
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Trophy, Plus, Search, ChevronRight, AlertTriangle,
  RefreshCw, Crown, ArrowLeft, Flame, MessageSquare,
  ArrowRightLeft, Calendar, TrendingUp
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
  useLeaveLeague
} from '../hooks/useLeagues';
import { useProfile } from '../hooks/useProfile';

// Import modular components
import { CreateLeagueModal, LeagueDetailView } from '../components/Leagues';
import LeagueHubCard from '../components/Leagues/LeagueHubCard';
import EmptyState from '../components/EmptyState';

const Leagues = () => {
  const { user } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLeague, setSelectedLeague] = useState(null);

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
  const leaveLeagueMutation = useLeaveLeague(user?.uid);

  // Flatten paginated public leagues data
  const availableLeagues = useMemo(() => {
    if (!publicLeaguesData?.pages) return [];
    return publicLeaguesData.pages.flatMap(page => page.data);
  }, [publicLeaguesData]);

  // Filter out already joined leagues and apply search
  const discoverLeagues = useMemo(() => {
    const myLeagueIds = new Set(myLeagues.map(l => l.id));
    return availableLeagues
      .filter(league => !myLeagueIds.has(league.id))
      .filter(league =>
        !searchTerm ||
        league.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        league.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
  }, [availableLeagues, myLeagues, searchTerm]);

  // Featured leagues (top 3 public leagues by member count)
  const featuredLeagues = useMemo(() => {
    return [...discoverLeagues]
      .sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0))
      .slice(0, 3);
  }, [discoverLeagues]);

  const handleCreateLeague = async (leagueData) => {
    try {
      await createLeagueMutation.mutateAsync(leagueData);
      toast.success('League created successfully!', { icon: '🏆' });
      setShowCreateModal(false);
    } catch (error) {
      console.error('Error creating league:', error);
      toast.error(error.message || 'Failed to create league');
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-display font-bold text-cream-100 uppercase tracking-wide">
              League Hub
            </h1>
            <p className="text-sm text-cream-500/60 mt-1">
              Compete against other directors
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gold-500 text-charcoal-900 font-display font-bold text-sm uppercase tracking-wide hover:bg-gold-400 transition-colors shadow-[0_0_15px_rgba(234,179,8,0.3)]"
          >
            <Plus className="w-4 h-4" />
            Create League
          </button>
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
            ) : myLeagues.length === 0 ? (
              <div className="bg-charcoal-900/30 border-2 border-dashed border-cream-500/20 rounded-xl p-8 text-center">
                <Trophy className="w-12 h-12 text-cream-500/20 mx-auto mb-4" />
                <h3 className="text-lg font-display font-bold text-cream-100 mb-2">
                  Join the Competition
                </h3>
                <p className="text-sm text-cream-500/60 mb-6 max-w-md mx-auto">
                  Leagues let you compete against other directors. Track rankings, chat with rivals, and prove you're the best.
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gold-500/20 border border-gold-500/30 text-gold-400 font-display font-bold text-sm uppercase tracking-wide hover:bg-gold-500/30 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Create Your First League
                </button>
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
              DISCOVER LEAGUES SECTION
              ============================================================ */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <Search className="w-5 h-5 text-cream-400" />
              <h2 className="text-lg font-display font-bold text-cream-100 uppercase tracking-wide">
                Discover Leagues
              </h2>
            </div>

            {/* Search Input */}
            <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-cream-500/40" />
              <input
                type="text"
                placeholder="Search public leagues..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-charcoal-900/50 border border-cream-500/20 rounded-xl text-sm text-cream-100 placeholder:text-cream-500/40 focus:outline-none focus:border-gold-500/50 transition-colors"
              />
            </div>

            {/* Featured Leagues (when not searching) */}
            {!searchTerm && featuredLeagues.length > 0 && (
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
                  {searchTerm ? 'No leagues match your search' : 'No public leagues available'}
                </p>
              </div>
            ) : (
              <>
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

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-cream-500/60">
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            <span>{memberCount}/{maxMembers}</span>
          </div>
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
